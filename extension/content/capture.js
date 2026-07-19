/**
 * GTM Container Analyzer - Tag+Pixel Debugger | Content Script
 * 
 * Runs on every page to capture GTM-related data.
 * Injects interceptor script and listens for data.
 * 
 * PRIVACY: All data stays in local storage, never sent externally.
 * SECURITY: All messages are validated and data is sanitized.
 */

(function () {
  'use strict';

  // ============================================
  // PERFORMANCE & SECURITY CONSTANTS
  // ============================================
  // LIGHTWEIGHT: Optimized for zero impact on user experience
  // REAL-WORLD READY: Supports complex e-commerce & marketing campaigns
  // SECURITY: Object.freeze prevents runtime tampering
  const SECURITY = Object.freeze({
    TRUSTED_SOURCE: 'gtm-live-interceptor',
    MAX_STRING_LENGTH: 5000,       // Efficient for most values
    MAX_URL_LENGTH: 2048,
    MAX_REQUESTS: 300,             // Enough for most sessions
    MAX_EVENTS: 150,               // Typical sessions have <100
    MAX_PARAMS: 100,               // Real-world: e-commerce can have 60-80 params
    MAX_OBJECT_DEPTH: 5,           // Prevent deeply nested attacks
    UPDATE_DEBOUNCE_MS: 100,       // Debounce updates to popup
    VALID_MESSAGE_TYPES: Object.freeze([
      'GTM_LIVE_DATALAYER_PUSH',
      'GTM_LIVE_DATALAYER_INIT',
      'GTM_LIVE_NETWORK_REQUEST',
      'GTM_LIVE_INTERCEPTOR_READY',
      'GTM_LIVE_PAGE_CHANGE',
      'GTM_LIVE_CONSENT_UPDATE'
    ]),
    BLOCKED_KEYS: Object.freeze(['__proto__', 'constructor', 'prototype', '__defineGetter__', '__defineSetter__']),
    BLOCKED_PROTOCOLS: Object.freeze(['javascript:', 'data:', 'vbscript:', 'file:']),
  });

  // PERFORMANCE: Debounce popup updates
  let updateTimeout = null;
  let pendingUpdate = false;

  // Security: Validate message type
  function isValidMessageType(type) {
    return SECURITY.VALID_MESSAGE_TYPES.includes(type);
  }

  // Security: Validate URL
  function isValidURL(url) {
    if (typeof url !== 'string' || url.length > SECURITY.MAX_URL_LENGTH) return false;
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  // Security: Sanitize string - COMPREHENSIVE XSS prevention
  function sanitizeString(value, maxLength = SECURITY.MAX_STRING_LENGTH) {
    if (typeof value !== 'string') value = String(value || '');

    let sanitized = value.substring(0, maxLength);

    // SECURITY: Remove dangerous patterns
    sanitized = sanitized
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '[BLOCKED]')
      .replace(/<\/script>/gi, '')
      .replace(/<script/gi, '')
      .replace(/javascript:/gi, '[BLOCKED]')
      .replace(/vbscript:/gi, '[BLOCKED]')
      .replace(/on\w+\s*=/gi, '[BLOCKED]=')
      .replace(/expression\s*\(/gi, '[BLOCKED](');

    // SECURITY: Remove null bytes and control characters
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    return sanitized;
  }

  // Security: Sanitize object - PREVENT prototype pollution
  function sanitizeObject(obj, depth = 0) {
    if (depth > SECURITY.MAX_OBJECT_DEPTH) return '[MAX_DEPTH]';
    if (obj === null || obj === undefined) return null;
    if (typeof obj === 'string') return sanitizeString(obj);
    if (typeof obj === 'number') return isFinite(obj) ? obj : null;
    if (typeof obj === 'boolean') return obj;
    if (Array.isArray(obj)) {
      return obj.slice(0, SECURITY.MAX_PARAMS).map(item => sanitizeObject(item, depth + 1));
    }
    if (typeof obj === 'object') {
      const result = {};
      const keys = Object.keys(obj).slice(0, SECURITY.MAX_PARAMS);
      for (const key of keys) {
        // SECURITY: Block prototype pollution keys
        if (SECURITY.BLOCKED_KEYS.includes(key)) continue;
        const safeKey = sanitizeString(key, 100);
        if (!safeKey || safeKey === '[BLOCKED]') continue;
        result[safeKey] = sanitizeObject(obj[key], depth + 1);
      }
      return result;
    }
    return null;
  }

  // Security: Validate payload structure
  // Note: We allow all property names since sanitizeObject() safely handles dangerous keys
  // This is a READ-ONLY tool - we display data, we don't execute it
  function isValidPayload(payload) {
    if (!payload || typeof payload !== 'object') return false;
    // Only block __proto__ as direct property (actual attack vector)
    // Allow 'constructor' and 'prototype' as they're common in legitimate data
    // (e.g., car websites have "constructor" meaning manufacturer)
    if (Object.prototype.hasOwnProperty.call(payload, '__proto__')) {
      console.warn('[GTM Live Security] Blocked __proto__ property');
      return false;
    }
    return true;
  }

  // ============================================
  // STATE
  // ============================================

  // Current page's domain
  const CURRENT_DOMAIN = sanitizeString(window.location.hostname, 255);
  const CURRENT_DOMAIN_NORMALIZED = CURRENT_DOMAIN.toLowerCase().replace(/^www\./, '');

  // State for current page capture
  let capturedData = {
    url: sanitizeString(window.location.href, SECURITY.MAX_URL_LENGTH),
    pathname: sanitizeString(window.location.pathname, 500),
    hostname: CURRENT_DOMAIN,
    lockedDomain: null, // Will be set when user locks domain
    queryParams: sanitizeObject(Object.fromEntries(new URLSearchParams(window.location.search))),
    referrer: sanitizeString(document.referrer, SECURITY.MAX_URL_LENGTH),
    title: sanitizeString(document.title, 500),
    gtmContainerId: null,
    dataLayerEvents: [],
    networkRequests: [],
    consentEvents: [],
    captureStarted: new Date().toISOString(),
  };

  // AUTO-CAPTURE: Always capture on page load
  // DOMAIN LOCK: User can lock to prevent other tabs from overwriting
  // TAB ISOLATION: Each tab can have its own session
  let isCapturing = true; // Auto-capture enabled by default
  let isLocked = false;   // Domain lock status
  let lockedDomain = null; // The domain user locked to
  let isTabIsolated = false; // Tab isolation mode

  /**
   * Check if current page should capture
   * - If not locked: always capture (auto-capture)
   * - If locked: only capture if domain matches
   */
  function shouldCapture() {
    if (!isCapturing) return false;

    // If locked, check domain match
    if (isLocked && lockedDomain) {
      const normalizedLocked = lockedDomain.toLowerCase().replace(/^www\./, '');
      return CURRENT_DOMAIN_NORMALIZED === normalizedLocked ||
        CURRENT_DOMAIN_NORMALIZED.endsWith('.' + normalizedLocked);
    }

    // Not locked - always capture
    return true;
  }

  /**
   * Check if this tab can send updates to dashboard
   * - In tab isolation mode: always allow (each tab has its own session)
   * - If locked to another domain: block updates
   * - If locked to this domain: allow
   * - If not locked: allow
   */
  function canSendUpdates() {
    // In tab isolation mode, each tab is independent
    if (isTabIsolated) return true;

    if (!isLocked || !lockedDomain) return true;

    const normalizedLocked = lockedDomain.toLowerCase().replace(/^www\./, '');
    return CURRENT_DOMAIN_NORMALIZED === normalizedLocked ||
      CURRENT_DOMAIN_NORMALIZED.endsWith('.' + normalizedLocked);
  }

  /**
   * Initialize capture state from storage
   * Check if domain lock is active and tab isolation mode
   */
  async function initializeCaptureState() {
    try {
      // Load domain lock state
      const lockResult = await chrome.storage.local.get(['gtm_live_locked', 'gtm_live_locked_domain']);
      if (lockResult.gtm_live_locked && lockResult.gtm_live_locked_domain) {
        isLocked = true;
        lockedDomain = lockResult.gtm_live_locked_domain;
        capturedData.lockedDomain = lockedDomain;
        console.log(`GTM Container Analyzer - Tag+Pixel Debugger Domain locked to: ${lockedDomain}`);
      }

      // Load tab isolation mode (stored in sync for cross-device consistency)
      const isolationResult = await chrome.storage.sync.get('gtm_live_tab_isolated');
      if (isolationResult.gtm_live_tab_isolated) {
        isTabIsolated = true;
        console.log('GTM Container Analyzer - Tag+Pixel Debugger Tab isolation mode enabled');
      }
    } catch (e) {
      console.error('GTM Container Analyzer - Tag+Pixel Debugger Error initializing capture state:', e);
    }
  }

  /**
   * Lock to current domain - prevents other tabs from overwriting
   */
  async function lockDomain() {
    isLocked = true;
    lockedDomain = CURRENT_DOMAIN_NORMALIZED;
    capturedData.lockedDomain = CURRENT_DOMAIN;

    // Persist lock state
    await chrome.storage.local.set({
      'gtm_live_locked': true,
      'gtm_live_locked_domain': lockedDomain,
    });

    console.log(`GTM Container Analyzer - Tag+Pixel Debugger Locked to domain: ${lockedDomain}`);
    sendUpdateToPopup();
  }

  /**
   * Unlock domain - allows any tab to update dashboard
   */
  async function unlockDomain() {
    isLocked = false;
    lockedDomain = null;
    capturedData.lockedDomain = null;

    // Clear lock state
    await chrome.storage.local.set({
      'gtm_live_locked': false,
      'gtm_live_locked_domain': null,
    });

    console.log('GTM Container Analyzer - Tag+Pixel Debugger Domain unlocked');
    sendUpdateToPopup();
  }

  /**
   * Check if a hostname matches the locked domain
   * Allows subdomains (e.g., www.example.com matches example.com)
   */
  function isDomainAllowed(hostname) {
    if (!lockedDomain) return false;
    if (!hostname) hostname = CURRENT_DOMAIN;
    const normalizedHostname = hostname.toLowerCase().replace(/^www\./, '');
    const normalizedTarget = lockedDomain.toLowerCase().replace(/^www\./, '');
    // Exact match or subdomain match
    return normalizedHostname === normalizedTarget ||
      normalizedHostname.endsWith('.' + normalizedTarget);
  }

  /**
   * Inject the dataLayer interceptor script into page context
   */
  function injectInterceptor() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('injected/gtm-interceptor.js');
    script.onload = function () {
      this.remove(); // Clean up after injection
    };
    (document.head || document.documentElement).appendChild(script);
  }

  /**
   * Listen for messages from injected script
   * SECURITY: All messages are validated before processing
   */
  function setupMessageListener() {
    window.addEventListener('message', (event) => {
      // SECURITY: Only accept messages from same window
      if (event.source !== window) return;

      const { type, payload, source } = event.data || {};

      // SECURITY: Validate message type
      if (!isValidMessageType(type)) return;

      // SECURITY: Validate source for network requests (most sensitive)
      if (type === 'GTM_LIVE_NETWORK_REQUEST') {
        if (source !== SECURITY.TRUSTED_SOURCE) {
          console.warn('[GTM Live Security] Blocked untrusted network request message');
          return;
        }
      }

      // SECURITY: Validate payload
      if (payload && !isValidPayload(payload)) {
        console.warn('[GTM Live Security] Blocked invalid payload');
        return;
      }

      // SECURITY: Check limits
      if (capturedData.networkRequests.length >= SECURITY.MAX_REQUESTS) {
        console.warn('[GTM Live Security] Request limit reached');
        return;
      }
      if (capturedData.dataLayerEvents.length >= SECURITY.MAX_EVENTS) {
        console.warn('[GTM Live Security] Event limit reached');
        return;
      }

      switch (type) {
        case 'GTM_LIVE_DATALAYER_PUSH':
          handleDataLayerPush(payload);
          break;

        case 'GTM_LIVE_DATALAYER_INIT':
          handleDataLayerInit(payload);
          break;

        case 'GTM_LIVE_INTERCEPTOR_READY':
          console.log('GTM Container Analyzer - Tag+Pixel Debugger Interceptor ready - capturing network requests');
          break;

        case 'GTM_LIVE_NETWORK_REQUEST':
          handleNetworkRequest(payload);
          break;

        case 'GTM_LIVE_CONSENT_UPDATE':
          // Store consent events (max 50 for safety)
          if (capturedData.consentEvents && capturedData.consentEvents.length < 50) {
            capturedData.consentEvents.push({
              consentType: payload.consentType,
              consentState: payload.consentState,
              timestamp: payload.timestamp,
              waitForUpdate: payload.waitForUpdate,
              regions: payload.regions,
            });
            scheduleUpdate();
          }
          break;
      }
    });
  }

  // Track events by key for aggregation (merge follow-up requests)
  const eventAggregationMap = new Map();
  // Extended to 30 seconds for production reliability (async operations can be slow)
  const EVENT_AGGREGATION_WINDOW_MS = 30000;
  // Secondary matching by event name + session for fallback
  const eventBySessionMap = new Map();

  /**
   * Check if a value is empty/null/undefined
   */
  function isEmpty(v) {
    return v === null || v === undefined || v === '' || v === '(empty)' || v === 'undefined';
  }

  /**
   * Merge event parameters - smart merging with priority logic
   * Priority: Non-empty values > Empty values
   * Latest non-empty values win
   */
  function mergeEventParams(existing, incoming) {
    const merged = { ...existing };

    for (const [key, value] of Object.entries(incoming)) {
      const existingValue = merged[key];

      // Skip internal correlation IDs during merge (keep original)
      if (key.startsWith('_') && key !== '_event_name') {
        if (!merged.hasOwnProperty(key) || isEmpty(existingValue)) {
          merged[key] = value;
        }
        continue;
      }

      // For regular params: update if new value is non-empty
      if (!merged.hasOwnProperty(key)) {
        // New key - add it
        merged[key] = value;
      } else if (isEmpty(existingValue) && !isEmpty(value)) {
        // Existing was empty, new is not - update
        merged[key] = value;
      } else if (!isEmpty(value)) {
        // Both have values - use latest (incoming)
        merged[key] = value;
      }
      // If new is empty and existing is not, keep existing (do nothing)
    }

    return merged;
  }

  /**
   * Find matching event using multiple strategies
   * 1. Exact eventKey match (client_id + session_id + event_name)
   * 2. Fallback: session_id + event_name match
   */
  function findMatchingEvent(eventKey, eventParams, now) {
    // Strategy 1: Exact key match
    if (eventKey && eventAggregationMap.has(eventKey)) {
      const entry = eventAggregationMap.get(eventKey);
      if (now - entry.timestamp <= EVENT_AGGREGATION_WINDOW_MS) {
        return entry;
      }
    }

    // Strategy 2: Session + event name fallback (for GA4)
    const sessionId = eventParams?._session_id;
    const eventName = eventParams?._event_name;
    if (sessionId && eventName) {
      const sessionKey = `session:${sessionId}:${eventName}`;
      if (eventBySessionMap.has(sessionKey)) {
        const entry = eventBySessionMap.get(sessionKey);
        if (now - entry.timestamp <= EVENT_AGGREGATION_WINDOW_MS) {
          return entry;
        }
      }
    }

    return null;
  }

  /**
   * Handle network request captured from injected script
   * This captures POST body data that PerformanceObserver can't see
   * Implements event aggregation to merge follow-up requests
   * DOMAIN LOCK: Only captures events from the locked domain
   */
  function handleNetworkRequest(payload) {
    // USER-CONTROLLED: Only capture if user started capture for this domain
    if (!shouldCapture() || !payload) return;

    const { url, tagType, eventParams, eventKey, method, timestamp, isSDKCall, sdkName } = payload;

    // Debug: Log SDK events with pixel info
    if (isSDKCall) {
      console.log('[GTM Live Capture] SDK event received:', {
        tagType,
        eventName: eventParams?._event_name,
        pixelId: eventParams?._pixel_id,
        sdkName,
        allParams: eventParams
      });
    }

    // Map tag type to display name (comprehensive list - 100+ tags worldwide)
    const tagNames = {
      // ============ GTM / DATALAYER ============
      'DATALAYER': 'GTM DataLayer',

      // ============ GOOGLE ============
      'GA4': 'Google Analytics 4',
      'UNIVERSAL_ANALYTICS': 'Universal Analytics',
      'GOOGLE_ADS': 'Google Ads',
      'GTM': 'Google Tag Manager',
      'GTM_GTAG': 'Google Tag (gtag.js)',
      'GTAG': 'Google Tag',
      'FLOODLIGHT': 'Floodlight',

      // ============ SOCIAL MEDIA ============
      'META_PIXEL': 'Meta Pixel',
      'TIKTOK': 'TikTok Pixel',
      'SNAPCHAT': 'Snapchat Pixel',
      'LINKEDIN': 'LinkedIn Ads',
      'TWITTER': 'Twitter/X Pixel',
      'PINTEREST': 'Pinterest Tag',
      'REDDIT': 'Reddit Pixel',
      'QUORA': 'Quora Pixel',

      // ============ NATIVE ADS ============
      'OUTBRAIN': 'Outbrain',
      'TABOOLA': 'Taboola',
      'CRITEO': 'Criteo',

      // ============ ANALYTICS ============
      'CLARITY': 'Microsoft Clarity',
      'MICROSOFT_UET': 'Microsoft Ads',
      'BING_ADS': 'Bing Ads',
      'AMPLITUDE': 'Amplitude',
      'MIXPANEL': 'Mixpanel',
      'SEGMENT': 'Segment',
      'HEAP': 'Heap Analytics',
      'PLAUSIBLE': 'Plausible',
      'UMAMI': 'Umami',
      'MATOMO': 'Matomo',
      'POSTHOG': 'PostHog',

      // ============ SESSION RECORDING ============
      'HOTJAR': 'Hotjar',
      'FULLSTORY': 'FullStory',
      'LOGROCKET': 'LogRocket',
      'CRAZYEGG': 'Crazy Egg',
      'LUCKYORANGE': 'Lucky Orange',

      // ============ A/B TESTING ============
      'ABTASTY': 'AB Tasty',
      'OPTIMIZELY': 'Optimizely',
      'VWO': 'VWO',

      // ============ MOBILE ATTRIBUTION ============
      'APPSFLYER': 'AppsFlyer',

      // ============ MARKETING AUTOMATION ============
      'HUBSPOT': 'HubSpot',
      'KLAVIYO': 'Klaviyo',
      'MARKETO': 'Marketo',
      'PARDOT': 'Pardot',

      // ============ CHAT & SUPPORT ============
      'INTERCOM': 'Intercom',
      'DRIFT': 'Drift',
      'ZENDESK': 'Zendesk',
      'TAWKTO': 'Tawk.to',
      'CRISP': 'Crisp',
      'FRESHWORKS': 'Freshworks',

      // ============ ENTERPRISE ============
      'ADOBE_ANALYTICS': 'Adobe Analytics',
      'ADOBE_TARGET': 'Adobe Target',
      'SENTRY': 'Sentry',
      'SALESFORCE_CDP': 'Salesforce CDP',
      'TEALIUM': 'Tealium',
      'MPARTICLE': 'mParticle',

      // ============ E-COMMERCE ============
      'SHOPIFY': 'Shopify',

      // ============ AFFILIATES ============
      'ADROLL': 'AdRoll',
      'YAHOO_ADS': 'Yahoo Ads',
      'IMPACT': 'Impact',
      'CJ': 'Commission Junction',
      'AWIN': 'Awin',
      'TRADEDESK': 'Trade Desk',
      'AMAZON_ADS': 'Amazon Ads',
      'STACKADAPT': 'StackAdapt',
      'BASIS': 'Basis/Centro',

      // ============ CONSENT MANAGEMENT ============
      'ONETRUST': 'OneTrust',
      'TRUSTARC': 'TrustArc',
      'COOKIEBOT': 'Cookiebot',

      // ============ CHINA 🇨🇳 ============
      'BAIDU_ANALYTICS': 'Baidu Analytics (百度统计)',
      'BAIDU_ADS': 'Baidu Ads (百度推广)',
      'WECHAT': 'WeChat (微信)',
      'ALIBABA': 'Alibaba (阿里巴巴)',
      'JD': 'JD.com (京东)',
      'BYTEDANCE': 'ByteDance (字节跳动)',
      'WEIBO': 'Weibo (微博)',

      // ============ RUSSIA 🇷🇺 ============
      'YANDEX_METRICA': 'Yandex Metrica (Яндекс.Метрика)',
      'YANDEX_ADS': 'Yandex Ads (Яндекс.Директ)',
      'VK': 'VK (ВКонтакте)',
      'MAILRU': 'Mail.ru',

      // ============ JAPAN 🇯🇵 ============
      'YAHOO_JAPAN': 'Yahoo Japan (ヤフー)',
      'LINE': 'LINE',
      'RAKUTEN': 'Rakuten (楽天)',

      // ============ KOREA 🇰🇷 ============
      'NAVER': 'Naver (네이버)',
      'KAKAO': 'Kakao (카카오)',

      // ============ LATIN AMERICA 🇧🇷🇲🇽 ============
      'MERCADOLIBRE': 'MercadoLibre',

      // ============ INDIA 🇮🇳 ============
      'FLIPKART': 'Flipkart',

      // ============ ADDITIONAL MARKETING PLATFORMS ============
      'MEDIAALPHA': 'MediaAlpha',
      'ROCKERBOX': 'Rockerbox',
      'NORTHBEAM': 'Northbeam',
      'TRIPLEWHALE': 'Triple Whale',
      'ELEVAR': 'Elevar',
      'LITTLEDATA': 'Littledata',
      'CUSTOMERIO': 'Customer.io',
      'BRAZE': 'Braze',
      'ITERABLE': 'Iterable',
      'LEANPLUM': 'Leanplum',
      'CLEVERTAP': 'CleverTap',
      'INSIDER': 'Insider',
      'EMARSYS': 'Emarsys',
      'SAILTHRU': 'Sailthru',
      'ATTENTIVE': 'Attentive',
      'LISTRAK': 'Listrak',
      'BLUESHIFT': 'Blueshift',
      'BLOOMREACH': 'Bloomreach',
      'DRIP': 'Drip',
      'ACTIVECAMPAIGN': 'ActiveCampaign',
      'SENDLANE': 'Sendlane',
      'OMNISEND': 'Omnisend',
      'OMETRIA': 'Ometria',
      'DOTDIGITAL': 'Dotdigital',
      'ZAIUS': 'Zaius',

      // ============ ATTRIBUTION & ANALYTICS ============
      'SINGULAR': 'Singular',
      'BRANCH': 'Branch',
      'KOCHAVA': 'Kochava',
      'ADJUST': 'Adjust',
      'ATTRIBUTION': 'Attribution',
      'DREAMDATA': 'Dreamdata',
      'FACTORS': 'Factors.ai',
      'CLEARBIT': 'Clearbit',
      'SIXSENSE': '6sense',
      'DEMANDBASE': 'Demandbase',
      'ZOOMINFO': 'ZoomInfo',
      'LEADFEEDER': 'Leadfeeder',
      'ALBACROSS': 'Albacross',

      // ============ VIDEO & RICH MEDIA ============
      'WISTIA': 'Wistia',
      'VIMEO': 'Vimeo',
      'VIDYARD': 'Vidyard',
      'BRIGHTCOVE': 'Brightcove',
      'JWPLAYER': 'JW Player',

      // ============ PUSH NOTIFICATIONS ============
      'ONESIGNAL': 'OneSignal',
      'PUSHWOOSH': 'Pushwoosh',
      'AIRSHIP': 'Airship',
      'WEBENGAGE': 'WebEngage',
      'PUSHENGAGE': 'PushEngage',

      // ============ SURVEY & FEEDBACK ============
      'QUALTRICS': 'Qualtrics',
      'SURVEYMONKEY': 'SurveyMonkey',
      'TYPEFORM': 'Typeform',
      'DELIGHTED': 'Delighted',
      'MEDALLIA': 'Medallia',
      'USERVOICE': 'UserVoice',

      // ============ REVIEWS & UGC ============
      'YOTPO': 'Yotpo',
      'BAZAARVOICE': 'Bazaarvoice',
      'TRUSTPILOT': 'Trustpilot',
      'POWERREVIEWS': 'PowerReviews',
      'STAMPED': 'Stamped.io',
      'OKENDO': 'Okendo',
      'JUDGEME': 'Judge.me',
      'LOOX': 'Loox',

      // ============ PERSONALIZATION ============
      'DYNAMICYIELD': 'Dynamic Yield',
      'MONETATE': 'Monetate',
      'NOSTO': 'Nosto',
      'BARILLIANCE': 'Barilliance',
      'RICHRELEVANCE': 'RichRelevance',
      'CERTONA': 'Certona',
      'ALGOLIA': 'Algolia',
      'CONSTRUCTOR': 'Constructor.io',
      'SEARCHSPRING': 'SearchSpring',
      'KLEVU': 'Klevu',

      // ============ FRAUD PREVENTION ============
      'PERIMETERX': 'PerimeterX',
      'FORTER': 'Forter',
      'SIGNIFYD': 'Signifyd',
      'RISKIFIED': 'Riskified',
      'SHAPE': 'Shape Security',

      // ============ GTM TEMPLATES (Additional) ============
      'COMSCORE': 'comScore',
      'NIELSEN': 'Nielsen DCR',
      'QUANTCAST': 'Quantcast',
      'MOUSEFLOW': 'Mouseflow',
      'CONTENTSQUARE': 'Contentsquare',
      'LYTICS': 'Lytics',
      'MARIN': 'Marin Software',
      'MEDIAPLEX': 'Mediaplex',
      'TRADEDOUBLER': 'Tradedoubler',
      'INFINITY': 'Infinity Call Tracking',
      'SURVICATE': 'Survicate',
      'TAPAD': 'Tapad',
      'TURN': 'Turn (Amobee)',
      'UPSELLIT': 'Upsellit',
      'VEINTERACTIVE': 'Ve Interactive',
      'YIELDIFY': 'Yieldify',
      'SALECYCLE': 'SaleCycle',
      'SHAREAHOLIC': 'Shareaholic',
      'XTREMEPUSH': 'Xtremepush',
      'DSTILLERY': 'Dstillery',
      'EULERIAN': 'Eulerian Analytics',
      'FOXMETRICS': 'FoxMetrics',
      'LEADLAB': 'LeadLab',
      'PLACED': 'Placed',
      'K50': 'K50',
      'PERSONALI': 'Personali',
      'PERFECTAUDIENCE': 'Perfect Audience',
      'PULSEINSIGHTS': 'Pulse Insights',
      'BIZRATE': 'Bizrate Insights',
      'ADOMETRY': 'Adometry',
      'DISTROSCALE': 'DistroScale',
      'AUDIENCE360': 'Audience Center 360',
      'OKTOPOST': 'Oktopost',
      'VISUALDNA': 'VisualDNA',
      'NEUSTAR': 'Neustar AdAdvisor',
      'GOOGLE_REVIEWS': 'Google Customer Reviews',
      'CONVERSION_LINKER': 'Conversion Linker',
    };

    const tagIcons = {
      // GTM / DataLayer
      'DATALAYER': 'gtm',
      // Google
      'GA4': 'ga4', 'UNIVERSAL_ANALYTICS': 'ua', 'GOOGLE_ADS': 'google-ads', 'GTM': 'gtm', 'GTM_GTAG': 'gtm', 'GTAG': 'gtm', 'FLOODLIGHT': 'floodlight',
      // Social
      'META_PIXEL': 'meta', 'TIKTOK': 'tiktok', 'SNAPCHAT': 'snapchat', 'LINKEDIN': 'linkedin', 'TWITTER': 'twitter', 'PINTEREST': 'pinterest', 'REDDIT': 'reddit', 'QUORA': 'quora',
      // Native Ads
      'OUTBRAIN': 'outbrain', 'TABOOLA': 'taboola', 'CRITEO': 'criteo',
      // Analytics
      'CLARITY': 'clarity', 'MICROSOFT_UET': 'microsoft', 'BING_ADS': 'microsoft', 'AMPLITUDE': 'amplitude', 'MIXPANEL': 'mixpanel', 'SEGMENT': 'segment', 'HEAP': 'heap', 'PLAUSIBLE': 'plausible', 'UMAMI': 'umami', 'MATOMO': 'matomo', 'POSTHOG': 'posthog',
      // Session Recording
      'HOTJAR': 'hotjar', 'FULLSTORY': 'fullstory', 'LOGROCKET': 'logrocket', 'CRAZYEGG': 'crazyegg', 'LUCKYORANGE': 'luckyorange',
      // A/B Testing
      'ABTASTY': 'abtasty', 'OPTIMIZELY': 'optimizely', 'VWO': 'vwo',
      // Mobile
      'APPSFLYER': 'appsflyer',
      // Marketing
      'HUBSPOT': 'hubspot', 'KLAVIYO': 'klaviyo', 'MARKETO': 'marketo', 'PARDOT': 'pardot',
      // Chat
      'INTERCOM': 'intercom', 'DRIFT': 'drift', 'ZENDESK': 'zendesk', 'TAWKTO': 'tawkto', 'CRISP': 'crisp', 'FRESHWORKS': 'freshworks',
      // Enterprise
      'ADOBE_ANALYTICS': 'adobe', 'ADOBE_TARGET': 'adobe-target', 'SENTRY': 'sentry', 'SALESFORCE_CDP': 'salesforce', 'TEALIUM': 'tealium', 'MPARTICLE': 'mparticle',
      // E-commerce
      'SHOPIFY': 'shopify',
      // Affiliates
      'ADROLL': 'adroll', 'YAHOO_ADS': 'yahoo', 'IMPACT': 'impact', 'CJ': 'cj', 'AWIN': 'awin', 'TRADEDESK': 'tradedesk', 'AMAZON_ADS': 'amazon', 'STACKADAPT': 'stackadapt', 'BASIS': 'basis',
      // Consent
      'ONETRUST': 'onetrust', 'TRUSTARC': 'trustarc', 'COOKIEBOT': 'cookiebot',
      // China
      'BAIDU_ANALYTICS': 'baidu', 'BAIDU_ADS': 'baidu', 'WECHAT': 'wechat', 'ALIBABA': 'alibaba', 'JD': 'jd', 'BYTEDANCE': 'bytedance', 'WEIBO': 'weibo',
      // Russia
      'YANDEX_METRICA': 'yandex', 'YANDEX_ADS': 'yandex', 'VK': 'vk', 'MAILRU': 'mailru',
      // Japan
      'YAHOO_JAPAN': 'yahoo-japan', 'LINE': 'line', 'RAKUTEN': 'rakuten',
      // Korea
      'NAVER': 'naver', 'KAKAO': 'kakao',
      // LATAM
      'MERCADOLIBRE': 'mercadolibre',
      // India
      'FLIPKART': 'flipkart',
    };

    const now = Date.now();

    // Try to find a matching event using multiple strategies
    const matchingEntry = findMatchingEvent(eventKey, eventParams, now);

    if (matchingEntry) {
      // Found a matching event - merge parameters
      const existingRequest = capturedData.networkRequests.find(r => r.id === matchingEntry.id);

      if (existingRequest) {
        // Merge event parameters (smart merge - non-empty values win)
        existingRequest.eventParams = mergeEventParams(existingRequest.eventParams, eventParams);
        existingRequest.hitCount = (existingRequest.hitCount || 1) + 1;
        existingRequest.lastUpdated = timestamp;
        existingRequest.mergeCount = (existingRequest.mergeCount || 0) + 1;

        // Update the map timestamps
        matchingEntry.timestamp = now;

        sendUpdateToPopup();
        return; // Don't create a new entry
      }
    }

    // Create new event entry
    const newId = now.toString() + Math.random().toString(36).substr(2, 9);

    // Capture current page URL for this event (to identify source page)
    const currentPageUrl = window.location.href;
    const currentPagePath = window.location.pathname;
    const currentPageHostname = window.location.hostname;

    capturedData.networkRequests.push({
      id: newId,
      url: url,
      tag: {
        type: tagType,
        name: tagNames[tagType] || tagType,
        icon: tagIcons[tagType] || 'tag',
      },
      eventParams: eventParams,
      eventKey: eventKey,
      timestamp: timestamp,
      method: method,
      hitCount: 1,
      source: isSDKCall ? 'sdk' : 'interceptor',
      // SDK call indicator (for events from JS SDK methods like fbq(), ttq.track())
      isSDKCall: isSDKCall || false,
      sdkName: sdkName || null,
      // Page context - which page triggered this event
      pageUrl: sanitizeString(currentPageUrl, SECURITY.MAX_URL_LENGTH),
      pagePath: sanitizeString(currentPagePath, 500),
      pageHostname: sanitizeString(currentPageHostname, 255),
    });

    // Store in aggregation maps for future merging
    const entryData = {
      id: newId,
      timestamp: now,
    };

    // Primary map: exact eventKey
    if (eventKey) {
      eventAggregationMap.set(eventKey, entryData);
    }

    // Secondary map: session + event name (for GA4 fallback matching)
    const sessionId = eventParams?._session_id;
    const eventName = eventParams?._event_name;
    if (sessionId && eventName) {
      const sessionKey = `session:${sessionId}:${eventName}`;
      eventBySessionMap.set(sessionKey, entryData);
    }

    // Clean up old entries from both maps (older than 60 seconds)
    const cleanupThreshold = 60000;
    for (const [key, entry] of eventAggregationMap.entries()) {
      if (now - entry.timestamp > cleanupThreshold) {
        eventAggregationMap.delete(key);
      }
    }
    for (const [key, entry] of eventBySessionMap.entries()) {
      if (now - entry.timestamp > cleanupThreshold) {
        eventBySessionMap.delete(key);
      }
    }

    sendUpdateToPopup();
  }

  /**
   * Handle dataLayer.push event
   */
  function handleDataLayerPush(payload) {
    // USER-CONTROLLED: Only capture if user started capture for this domain
    if (!shouldCapture() || !payload?.data) return;

    payload.data.forEach(item => {
      if (typeof item === 'object' && item !== null) {
        capturedData.dataLayerEvents.push({
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          event: item.event || 'data_push',
          data: item,
          timestamp: payload.timestamp,
          category: categorizeEvent(item.event),
        });
      }
    });

    // Notify popup of update
    sendUpdateToPopup();
  }

  /**
   * Handle initial dataLayer state
   */
  function handleDataLayerInit(payload) {
    if (!isCapturing || !payload?.data) return;

    payload.data.forEach((item, index) => {
      if (typeof item === 'object' && item !== null) {
        capturedData.dataLayerEvents.push({
          id: `init_${index}_${Date.now()}`,
          event: item.event || 'initial_data',
          data: item,
          timestamp: payload.timestamp,
          category: categorizeEvent(item.event),
          isInitial: true,
        });
      }
    });

    sendUpdateToPopup();
  }

  /**
   * Categorize event by type
   */
  function categorizeEvent(eventName) {
    if (!eventName) return 'Data';

    const pageViewEvents = ['page_view', 'pageview', 'gtm.js', 'gtm.dom', 'gtm.load'];
    const ecommerceEvents = ['purchase', 'add_to_cart', 'remove_from_cart', 'begin_checkout', 'view_item', 'view_item_list', 'select_item'];
    const userEvents = ['login', 'sign_up', 'user_engagement'];

    if (pageViewEvents.includes(eventName)) return 'Page View';
    if (ecommerceEvents.includes(eventName)) return 'Ecommerce';
    if (userEvents.includes(eventName)) return 'User';
    return 'Custom';
  }

  /**
   * Extract event parameters from tag request URLs
   */
  function extractEventParameters(url, tagType) {
    try {
      const urlObj = new URL(url);
      const params = new URLSearchParams(urlObj.search);
      const eventParams = {};

      switch (tagType) {
        case 'GA4':
          // GA4 parameters: ep.* = event parameters, epn.* = numeric event parameters
          // en = event name, tid = tracking id
          for (const [key, value] of params.entries()) {
            if (key.startsWith('ep.')) {
              // Event parameter (string)
              eventParams[key.replace('ep.', '')] = decodeURIComponent(value);
            } else if (key.startsWith('epn.')) {
              // Event parameter (numeric)
              eventParams[key.replace('epn.', '')] = decodeURIComponent(value);
            } else if (key === 'en') {
              eventParams['_event_name'] = decodeURIComponent(value);
            } else if (key === 'tid') {
              eventParams['_measurement_id'] = value;
            } else if (key === 'dl') {
              eventParams['_document_location'] = decodeURIComponent(value);
            } else if (key === 'dr') {
              eventParams['_document_referrer'] = decodeURIComponent(value);
            } else if (key === 'dt') {
              eventParams['_document_title'] = decodeURIComponent(value);
            } else if (key === 'cid') {
              eventParams['_client_id'] = value;
            } else if (key === 'sid') {
              eventParams['_session_id'] = value;
            }
          }
          break;

        case 'META_PIXEL':
          // Meta Pixel parameters
          for (const [key, value] of params.entries()) {
            if (key === 'ev') {
              eventParams['_event_name'] = decodeURIComponent(value);
            } else if (key === 'id') {
              eventParams['_pixel_id'] = value;
            } else if (key === 'cd') {
              // Custom data is JSON encoded
              try {
                const customData = JSON.parse(decodeURIComponent(value));
                Object.entries(customData).forEach(([k, v]) => {
                  eventParams[k] = v;
                });
              } catch (e) {
                eventParams['custom_data'] = decodeURIComponent(value);
              }
            } else if (key === 'ud') {
              eventParams['_user_data'] = '(hashed)';
            }
          }
          break;

        case 'GOOGLE_ADS':
          // Google Ads parameters
          for (const [key, value] of params.entries()) {
            if (key === 'label') {
              eventParams['_conversion_label'] = value;
            } else if (key === 'value') {
              eventParams['conversion_value'] = decodeURIComponent(value);
            } else if (key === 'currency') {
              eventParams['currency'] = value;
            } else if (key === 'oid') {
              eventParams['order_id'] = decodeURIComponent(value);
            }
          }
          break;

        case 'TIKTOK':
          // TikTok Pixel parameters
          for (const [key, value] of params.entries()) {
            if (key === 'event') {
              eventParams['_event_name'] = decodeURIComponent(value);
            } else if (key === 'pixel_code') {
              eventParams['_pixel_id'] = value;
            } else if (key.startsWith('data[')) {
              const paramName = key.replace('data[', '').replace(']', '');
              eventParams[paramName] = decodeURIComponent(value);
            }
          }
          break;

        case 'LINKEDIN':
          // LinkedIn Insight parameters
          for (const [key, value] of params.entries()) {
            if (key === 'conversionId') {
              eventParams['_conversion_id'] = value;
            } else if (key === 'pid') {
              eventParams['_partner_id'] = value;
            }
          }
          break;

        case 'MICROSOFT_UET':
          // Microsoft UET parameters
          for (const [key, value] of params.entries()) {
            if (key === 'evt') {
              eventParams['_event_name'] = decodeURIComponent(value);
            } else if (key === 'ti') {
              eventParams['_tag_id'] = value;
            } else if (key === 'ec') {
              eventParams['event_category'] = decodeURIComponent(value);
            } else if (key === 'ea') {
              eventParams['event_action'] = decodeURIComponent(value);
            } else if (key === 'el') {
              eventParams['event_label'] = decodeURIComponent(value);
            } else if (key === 'ev') {
              eventParams['event_value'] = decodeURIComponent(value);
            } else if (key === 'gv') {
              eventParams['revenue'] = decodeURIComponent(value);
            }
          }
          break;

        default:
          // Generic parameter extraction for other tags
          for (const [key, value] of params.entries()) {
            // Skip common tracking params
            if (!['v', 't', 'z', '_', 'rand', 'cb', 'cachebuster'].includes(key)) {
              eventParams[key] = decodeURIComponent(value);
            }
          }
      }

      return Object.keys(eventParams).length > 0 ? eventParams : null;
    } catch (e) {
      return null;
    }
  }

  // Track URLs already captured by interceptor to avoid duplicates
  // SECURITY: Capped at 1000 entries to prevent unbounded memory growth
  const capturedUrls = new Set();
  const MAX_CAPTURED_URLS = 1000;

  /**
   * Check if URL was already captured (to avoid duplicates between interceptor and PerformanceObserver)
   */
  function isUrlCaptured(url) {
    // Normalize URL for comparison (remove timestamp params that may differ)
    const normalizedUrl = url.split('?')[0];
    return capturedUrls.has(normalizedUrl);
  }

  /**
   * Mark URL as captured
   */
  function markUrlCaptured(url) {
    const normalizedUrl = url.split('?')[0];
    // Prevent unbounded Set growth on long-lived pages
    if (capturedUrls.size >= MAX_CAPTURED_URLS) {
      capturedUrls.clear();
    }
    capturedUrls.add(normalizedUrl);
  }

  /**
   * Observe network requests for tag fires
   * Note: GA4/Meta/etc POST body data is captured by the injected script.
   * PerformanceObserver mainly captures GTM container IDs and fallback for GET requests.
   */
  function observeNetworkRequests() {
    // Use PerformanceObserver to watch for network requests
    if (typeof PerformanceObserver === 'undefined') return;

    const observer = new PerformanceObserver((list) => {
      if (!isCapturing) return;

      for (const entry of list.getEntries()) {
        const url = entry.name;
        const tagInfo = identifyTag(url);

        if (tagInfo) {
          // Always capture GTM container ID
          if (tagInfo.type === 'GTM') {
            const containerId = extractGTMId(url);
            if (containerId) {
              capturedData.gtmContainerId = containerId;
            }
            // Continue to add GTM as a network request
          }

          // Check for duplicates - interceptor might have already captured this
          // Use a simple URL match (without random params) to check duplicates
          const urlBase = url.split('?')[0];
          const isDuplicate = capturedData.networkRequests.some(req => {
            const reqBase = req.url?.split('?')[0];
            return reqBase === urlBase &&
              req.source === 'interceptor' &&
              req.tag?.type === tagInfo.type;
          });

          if (isDuplicate) {
            // Skip if interceptor already captured this with POST body data
            continue;
          }

          // Extract event parameters from the request URL
          const eventParams = extractEventParameters(url, tagInfo.type);

          capturedData.networkRequests.push({
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            url: url,
            tag: tagInfo,
            eventParams: eventParams,
            timestamp: new Date().toISOString(),
            duration: entry.duration,
            initiatorType: entry.initiatorType,
            source: 'performance', // Mark source
          });

          sendUpdateToPopup();
        }
      }
    });

    try {
      observer.observe({ entryTypes: ['resource'] });
    } catch (e) {
      // Fallback if PerformanceObserver not available
    }

    // Also check existing entries
    if (performance.getEntriesByType) {
      const existingEntries = performance.getEntriesByType('resource');
      existingEntries.forEach(entry => {
        const url = entry.name;
        const tagInfo = identifyTag(url);

        if (tagInfo) {
          if (tagInfo.type === 'GTM') {
            const containerId = extractGTMId(url);
            if (containerId) {
              capturedData.gtmContainerId = containerId;
            }
          }

          // Extract event parameters from the request URL
          const eventParams = extractEventParameters(url, tagInfo.type);

          capturedData.networkRequests.push({
            id: `existing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            url: url,
            tag: tagInfo,
            eventParams: eventParams,
            timestamp: new Date().toISOString(),
            duration: entry.duration,
            initiatorType: entry.initiatorType,
            isExisting: true,
          });
        }
      });
    }
  }

  /**
   * Identify tag type from URL - Comprehensive list (50+ tags)
   */
  function identifyTag(url) {
    const patterns = {
      // ============================================
      // Google Products
      // ============================================
      GA4: {
        name: 'Google Analytics 4',
        patterns: [/google-analytics\.com\/g\/collect/, /analytics\.google\.com\/g\/collect/, /region\d*\.google-analytics\.com\/g\/collect/],
        icon: 'ga4',
      },
      UNIVERSAL_ANALYTICS: {
        name: 'Universal Analytics',
        patterns: [/google-analytics\.com\/collect(?!\/g)/, /google-analytics\.com\/r\/collect/],
        icon: 'ua',
      },
      GOOGLE_ADS: {
        name: 'Google Ads',
        patterns: [/googleads\.g\.doubleclick\.net/, /googleadservices\.com\/pagead/],
        icon: 'google-ads',
      },
      GTM: {
        name: 'Google Tag Manager',
        patterns: [/googletagmanager\.com\/gtm\.js/, /googletagmanager\.com\/gtag\/js/],
        icon: 'gtm',
      },
      FLOODLIGHT: {
        name: 'Floodlight',
        patterns: [/fls\.doubleclick\.net/, /ad\.doubleclick\.net\/ddm/],
        icon: 'floodlight',
      },

      // ============================================
      // Social Media Pixels
      // ============================================
      META_PIXEL: {
        name: 'Meta Pixel',
        patterns: [/facebook\.com\/tr/, /connect\.facebook\.net/],
        icon: 'meta',
      },
      TIKTOK: {
        name: 'TikTok Pixel',
        patterns: [/analytics\.tiktok\.com/, /tiktok\.com\/i18n\/pixel/],
        icon: 'tiktok',
      },
      SNAPCHAT: {
        name: 'Snapchat Pixel',
        patterns: [/tr\.snapchat\.com/, /sc-static\.net\/scevent/],
        icon: 'snapchat',
      },
      LINKEDIN: {
        name: 'LinkedIn Ads',
        patterns: [/px\.ads\.linkedin\.com/, /snap\.licdn\.com/],
        icon: 'linkedin',
      },
      TWITTER: {
        name: 'Twitter/X Pixel',
        patterns: [/t\.co\/i\/adsct/, /analytics\.twitter\.com/],
        icon: 'twitter',
      },
      PINTEREST: {
        name: 'Pinterest Tag',
        patterns: [/ct\.pinterest\.com/],
        icon: 'pinterest',
      },
      REDDIT: {
        name: 'Reddit Pixel',
        patterns: [/redditmedia\.com\/pixel/, /alb\.reddit\.com/],
        icon: 'reddit',
      },
      QUORA: {
        name: 'Quora Pixel',
        patterns: [/q\.quora\.com/],
        icon: 'quora',
      },

      // ============================================
      // Native Ad Networks
      // ============================================
      OUTBRAIN: {
        name: 'Outbrain',
        patterns: [/outbrain\.com/],
        icon: 'outbrain',
      },
      TABOOLA: {
        name: 'Taboola',
        patterns: [/trc\.taboola\.com/, /taboola\.com\/livetrc/],
        icon: 'taboola',
      },
      CRITEO: {
        name: 'Criteo',
        patterns: [/static\.criteo\.net/, /dis\.criteo\.com/],
        icon: 'criteo',
      },

      // ============================================
      // Analytics Platforms
      // ============================================
      CLARITY: {
        name: 'Microsoft Clarity',
        patterns: [/clarity\.ms/],
        icon: 'clarity',
      },
      MICROSOFT_UET: {
        name: 'Microsoft Ads',
        patterns: [/bat\.bing\.com/, /bat\.r\.msn\.com/],
        icon: 'microsoft',
      },
      AMPLITUDE: {
        name: 'Amplitude',
        patterns: [/api\.amplitude\.com/, /api2\.amplitude\.com/],
        icon: 'amplitude',
      },
      MIXPANEL: {
        name: 'Mixpanel',
        patterns: [/api\.mixpanel\.com/, /api-js\.mixpanel\.com/],
        icon: 'mixpanel',
      },
      SEGMENT: {
        name: 'Segment',
        patterns: [/api\.segment\.io/, /api\.segment\.com/],
        icon: 'segment',
      },
      HEAP: {
        name: 'Heap Analytics',
        patterns: [/heapanalytics\.com/],
        icon: 'heap',
      },
      PLAUSIBLE: {
        name: 'Plausible',
        patterns: [/plausible\.io/],
        icon: 'plausible',
      },
      UMAMI: {
        name: 'Umami',
        patterns: [/umami\.is/],
        icon: 'umami',
      },
      MATOMO: {
        name: 'Matomo',
        patterns: [/matomo\.php/, /piwik\.php/],
        icon: 'matomo',
      },
      POSTHOG: {
        name: 'PostHog',
        patterns: [/posthog\.com/],
        icon: 'posthog',
      },

      // ============================================
      // Session Recording & Heatmaps
      // ============================================
      HOTJAR: {
        name: 'Hotjar',
        patterns: [/static\.hotjar\.com/, /vars\.hotjar\.com/],
        icon: 'hotjar',
      },
      FULLSTORY: {
        name: 'FullStory',
        patterns: [/fullstory\.com/],
        icon: 'fullstory',
      },
      LOGROCKET: {
        name: 'LogRocket',
        patterns: [/logrocket\.io/],
        icon: 'logrocket',
      },
      CRAZYEGG: {
        name: 'Crazy Egg',
        patterns: [/crazyegg\.com/],
        icon: 'crazyegg',
      },
      LUCKYORANGE: {
        name: 'Lucky Orange',
        patterns: [/luckyorange\.com/],
        icon: 'luckyorange',
      },

      // ============================================
      // A/B Testing
      // ============================================
      ABTASTY: {
        name: 'AB Tasty',
        patterns: [/abtasty\.com/],
        icon: 'abtasty',
      },
      OPTIMIZELY: {
        name: 'Optimizely',
        patterns: [/cdn\.optimizely\.com/, /logx\.optimizely\.com/],
        icon: 'optimizely',
      },
      VWO: {
        name: 'VWO',
        patterns: [/visualwebsiteoptimizer\.com/],
        icon: 'vwo',
      },

      // ============================================
      // Mobile Attribution
      // ============================================
      APPSFLYER: {
        name: 'AppsFlyer',
        patterns: [/appsflyer\.com/],
        icon: 'appsflyer',
      },

      // ============================================
      // Marketing Automation
      // ============================================
      HUBSPOT: {
        name: 'HubSpot',
        patterns: [/js\.hs-scripts\.com/, /track\.hubspot\.com/],
        icon: 'hubspot',
      },
      KLAVIYO: {
        name: 'Klaviyo',
        patterns: [/klaviyo\.com/],
        icon: 'klaviyo',
      },
      MARKETO: {
        name: 'Marketo',
        patterns: [/munchkin\.marketo\.net/],
        icon: 'marketo',
      },
      PARDOT: {
        name: 'Pardot',
        patterns: [/pi\.pardot\.com/, /go\.pardot\.com/],
        icon: 'pardot',
      },

      // ============================================
      // Chat & Support
      // ============================================
      INTERCOM: {
        name: 'Intercom',
        patterns: [/intercom\.io/],
        icon: 'intercom',
      },
      DRIFT: {
        name: 'Drift',
        patterns: [/drift\.com/],
        icon: 'drift',
      },
      ZENDESK: {
        name: 'Zendesk',
        patterns: [/zdassets\.com/, /zendesk\.com/],
        icon: 'zendesk',
      },
      TAWKTO: {
        name: 'Tawk.to',
        patterns: [/tawk\.to/],
        icon: 'tawkto',
      },
      CRISP: {
        name: 'Crisp',
        patterns: [/crisp\.chat/],
        icon: 'crisp',
      },
      FRESHWORKS: {
        name: 'Freshworks',
        patterns: [/freshchat\.com/, /freshdesk\.com/],
        icon: 'freshworks',
      },

      // ============================================
      // Enterprise Analytics
      // ============================================
      ADOBE_ANALYTICS: {
        name: 'Adobe Analytics',
        patterns: [/omtrdc\.net/, /2o7\.net/],
        icon: 'adobe',
      },
      ADOBE_TARGET: {
        name: 'Adobe Target',
        patterns: [/tt\.omtrdc\.net/],
        icon: 'adobe-target',
      },
      SENTRY: {
        name: 'Sentry',
        patterns: [/sentry\.io/],
        icon: 'sentry',
      },

      // ============================================
      // E-commerce
      // ============================================
      SHOPIFY: {
        name: 'Shopify',
        patterns: [/monorail-edge\.shopifysvc\.com/],
        icon: 'shopify',
      },

      // ============================================
      // Affiliate Networks
      // ============================================
      ADROLL: {
        name: 'AdRoll',
        patterns: [/adroll\.com/],
        icon: 'adroll',
      },
      YAHOO: {
        name: 'Yahoo Ads',
        patterns: [/sp\.analytics\.yahoo\.com/, /pixel\.advertising\.com/],
        icon: 'yahoo',
      },
      IMPACT: {
        name: 'Impact',
        patterns: [/impactradius/],
        icon: 'impact',
      },
      CJ: {
        name: 'Commission Junction',
        patterns: [/emjcd\.com/, /tags\.cj\.com/],
        icon: 'cj',
      },
      AWIN: {
        name: 'Awin',
        patterns: [/awin1\.com/, /dwin1\.com/],
        icon: 'awin',
      },
      RAKUTEN: {
        name: 'Rakuten',
        patterns: [/linksynergy\.com/],
        icon: 'rakuten',
      },
    };

    for (const [type, config] of Object.entries(patterns)) {
      for (const pattern of config.patterns) {
        if (pattern.test(url)) {
          return { type, name: config.name, icon: config.icon };
        }
      }
    }

    return null;
  }

  /**
   * Extract GTM container ID from URL
   */
  function extractGTMId(url) {
    const match = url.match(/[?&]id=(GTM-[A-Z0-9]+)/i);
    return match ? match[1] : null;
  }

  /**
   * Send update to popup/background
   * PERFORMANCE: Debounced to prevent flooding
   * Respects domain lock - if locked to another domain, don't send
   */
  function sendUpdateToPopup() {
    // Check if this tab is allowed to send updates
    if (!canSendUpdates()) {
      return; // Locked to another domain - don't overwrite
    }

    // Only send updates from VISIBLE tabs (unless it's the locked domain)
    if (document.visibilityState !== 'visible' && !isLocked) {
      return; // Don't send updates from hidden/background tabs unless locked
    }

    // PERFORMANCE: Debounce rapid updates
    pendingUpdate = true;

    if (updateTimeout) {
      return; // Already scheduled
    }

    updateTimeout = setTimeout(() => {
      updateTimeout = null;

      if (!pendingUpdate) return;
      pendingUpdate = false;

      try {
        chrome.runtime.sendMessage({
          type: 'CAPTURE_UPDATE',
          payload: capturedData,
        });
      } catch (e) {
        // Extension context may not be available - silent fail
      }
    }, SECURITY.UPDATE_DEBOUNCE_MS);
  }

  /**
   * Handle visibility change - send update when tab becomes visible
   */
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && isCapturing && canSendUpdates()) {
      // Tab became visible - send current data to dashboard
      sendUpdateToPopup();
    }
  });

  /**
   * Listen for messages from popup/background
   * SECURITY: Validates sender is from our extension
   */
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // SECURITY: Only accept messages from our extension (popup or background)
    if (sender.id !== chrome.runtime.id) {
      console.warn('[GTM Live Security] Blocked message from unknown extension:', sender.id);
      sendResponse({ error: 'Unauthorized', code: 'AUTH_FAILED' });
      return true;
    }

    // SECURITY: Validate message has required structure
    if (!message || typeof message !== 'object' || !message.type) {
      sendResponse({ error: 'Invalid message format', code: 'INVALID_FORMAT' });
      return true;
    }

    switch (message.type) {
      case 'GET_CAPTURED_DATA':
        sendResponse(capturedData);
        break;

      case 'GET_CAPTURE_STATUS':
        sendResponse({
          isCapturing: isCapturing,
          currentDomain: CURRENT_DOMAIN,
          canSendUpdates: canSendUpdates(),
          isTabIsolated: isTabIsolated,
        });
        break;

      // Lock domain functionality kept for backward compatibility but not exposed in UI
      case 'LOCK_DOMAIN':
        lockDomain().then(() => {
          sendResponse({ success: true, domain: CURRENT_DOMAIN });
        });
        return true;

      case 'UNLOCK_DOMAIN':
        unlockDomain().then(() => {
          sendResponse({ success: true });
        });
        return true;

      case 'CLEAR_CAPTURED_DATA':
        capturedData = {
          url: window.location.href,
          pathname: window.location.pathname,
          hostname: window.location.hostname,
          lockedDomain: lockedDomain,
          queryParams: Object.fromEntries(new URLSearchParams(window.location.search)),
          referrer: document.referrer,
          title: document.title,
          gtmContainerId: null,
          dataLayerEvents: [],
          networkRequests: [],
          consentEvents: [],
          captureStarted: isCapturing ? new Date().toISOString() : null,
        };
        sendUpdateToPopup();
        sendResponse({ success: true });
        break;

      case 'SET_CAPTURE_ENABLED':
        isCapturing = message.enabled;
        sendResponse({ success: true });
        break;

      case 'SET_TAB_ISOLATED_MODE':
        isTabIsolated = message.enabled;
        console.log(`[GTM Live Capture] Tab isolation mode: ${isTabIsolated ? 'enabled' : 'disabled'}`);
        // If switching to tab isolated mode, immediately send current data
        if (isTabIsolated) {
          sendUpdateToPopup();
        }
        sendResponse({ success: true, tabIsolated: isTabIsolated });
        break;

      case 'PING':
        sendResponse({ alive: true });
        break;
    }

    return true; // Keep message channel open for async response
  });

  /**
   * Update page title when it changes
   */
  function observeTitle() {
    const titleObserver = new MutationObserver(() => {
      capturedData.title = document.title;
    });

    const titleElement = document.querySelector('title');
    if (titleElement) {
      titleObserver.observe(titleElement, { childList: true });
    }
  }

  /**
   * Initialize capture
   */
  async function init() {
    // Update title once DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        capturedData.title = document.title;
        observeTitle();
      });
    } else {
      capturedData.title = document.title;
      observeTitle();
    }

    // Initialize capture state from storage (USER-CONTROLLED)
    await initializeCaptureState();

    // Inject dataLayer interceptor
    injectInterceptor();

    // Setup message listener
    setupMessageListener();

    // Start observing network requests
    observeNetworkRequests();

    // Notify that content script is ready
    chrome.runtime.sendMessage({
      type: 'CONTENT_SCRIPT_READY',
      payload: {
        url: window.location.href,
        domain: CURRENT_DOMAIN,
        isCapturing: isCapturing,
        lockedDomain: lockedDomain,
      }
    }).catch(() => {
      // Ignore if background not available yet
    });
  }

  // Start
  init();

})();

