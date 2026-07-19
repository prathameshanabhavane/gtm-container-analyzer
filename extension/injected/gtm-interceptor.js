/**
 * GTM Container Analyzer - Tag+Pixel Debugger | DataLayer & Network Interceptor
 * 
 * This script is injected into the page context to intercept:
 * 1. dataLayer.push calls
 * 2. fetch requests (for POST body data)
 * 3. XMLHttpRequest (for POST body data)
 * 
 * This allows capturing GA4 event parameters sent via POST body.
 * 
 * PRIVACY: All data stays local - sent only to content script via postMessage
 * SECURITY: All data is validated and sanitized before transmission
 */

(function () {
  'use strict';

  // Prevent multiple injections (Symbol-based to resist page tampering)
  var INSTALL_KEY = Symbol.for('__gtm_live_interceptor__');
  if (window[INSTALL_KEY]) {
    return;
  }
  try {
    Object.defineProperty(window, INSTALL_KEY, { value: true, writable: false, configurable: false });
  } catch (e) {
    return; // If we can't set the flag, another instance likely exists
  }

  // ============================================
  // PERFORMANCE & SECURITY CONSTANTS
  // ============================================
  // LIGHTWEIGHT BY DESIGN: Minimal footprint, zero blocking
  // REAL-WORLD READY: Supports complex e-commerce & campaigns
  // SECURITY: All constants are frozen to prevent tampering
  var SECURITY = Object.freeze({
    MAX_STRING_LENGTH: 5000,      // Efficient for most values
    MAX_URL_LENGTH: 2048,
    MAX_PARAM_VALUE: 2000,        // Most params are small
    MAX_PARAMS: 100,              // Real-world: e-commerce purchase can have 60-80 params
    MAX_EVENTS_PER_BATCH: 20,     // Reduced for faster processing
    RATE_LIMIT_PER_SECOND: 15,    // Prevent any CPU spike
    MESSAGE_SOURCE: 'gtm-live-interceptor',
    DEBOUNCE_MS: 50,              // Debounce rapid-fire events
    // Additional security settings
    MAX_OBJECT_DEPTH: 5,          // Prevent deeply nested attacks
    BLOCKED_KEYS: ['__proto__', 'constructor', 'prototype', '__defineGetter__', '__defineSetter__', '__lookupGetter__', '__lookupSetter__'],
    BLOCKED_PROTOCOLS: ['javascript:', 'data:', 'vbscript:', 'file:'],
  });

  // Rate limiting - prevents CPU spikes
  var rateLimitCounter = 0;
  var rateLimitReset = Date.now();

  // Message queue for debouncing (prevents flooding)
  var messageQueue = [];
  var messageTimeout = null;

  function checkRateLimit() {
    var now = Date.now();
    if (now - rateLimitReset > 1000) {
      rateLimitCounter = 0;
      rateLimitReset = now;
    }
    if (rateLimitCounter >= SECURITY.RATE_LIMIT_PER_SECOND) {
      return false;
    }
    rateLimitCounter++;
    return true;
  }

  /**
   * PERFORMANCE: Debounced message sending
   * Batches rapid-fire events to prevent browser slowdown
   */
  function sendMessageDebounced(message) {
    messageQueue.push(message);

    // Clear existing timeout
    if (messageTimeout) {
      clearTimeout(messageTimeout);
    }

    // Send after debounce delay
    messageTimeout = setTimeout(function () {
      // Process queued messages (max 5 at a time)
      var toSend = messageQueue.splice(0, 5);
      toSend.forEach(function (msg) {
        try {
          window.postMessage(msg, window.location.origin);
        } catch (e) {
          // Silent fail - never break the page
        }
      });
      messageTimeout = null;

      // If more in queue, schedule next batch
      if (messageQueue.length > 0) {
        sendMessageDebounced({ type: '__FLUSH__' });
      }
    }, SECURITY.DEBOUNCE_MS);
  }

  // Sanitize string - prevent XSS and limit size
  // SECURITY: Comprehensive sanitization against injection attacks
  function sanitizeString(value, maxLength) {
    if (typeof value !== 'string') {
      value = String(value || '');
    }

    // Truncate first for performance
    var sanitized = value.substring(0, maxLength || SECURITY.MAX_STRING_LENGTH);

    // SECURITY: Remove script tags and event handlers
    sanitized = sanitized
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '[BLOCKED]')
      .replace(/<\/script>/gi, '')
      .replace(/<script/gi, '')
      .replace(/javascript:/gi, '[BLOCKED]')
      .replace(/vbscript:/gi, '[BLOCKED]')
      .replace(/data:/gi, function (match, offset, str) {
        // Allow data: only for image URLs, block others
        var nextChars = str.substring(offset, offset + 15).toLowerCase();
        if (nextChars.match(/^data:image\//)) return match;
        return '[BLOCKED]';
      })
      .replace(/on\w+\s*=/gi, '[BLOCKED]=')
      .replace(/expression\s*\(/gi, '[BLOCKED](')
      .replace(/url\s*\(\s*['"]?\s*javascript/gi, '[BLOCKED]');

    // SECURITY: Remove null bytes and control characters (except newlines/tabs)
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    return sanitized;
  }

  // Validate URL - SECURITY: Strict validation to prevent attacks
  function isValidURL(url) {
    if (typeof url !== 'string') return false;
    if (url.length > SECURITY.MAX_URL_LENGTH) return false;

    // SECURITY: Block dangerous protocols before parsing
    var urlLower = url.toLowerCase().trim();
    for (var i = 0; i < SECURITY.BLOCKED_PROTOCOLS.length; i++) {
      if (urlLower.startsWith(SECURITY.BLOCKED_PROTOCOLS[i])) {
        return false;
      }
    }

    try {
      var parsed = new URL(url);
      // SECURITY: Only allow http and https
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch (e) {
      return false;
    }
  }

  // Sanitize object (deep) - SECURITY: Prevent prototype pollution & injection
  function sanitizeObject(obj, depth) {
    if (depth === undefined) depth = 0;
    if (depth > SECURITY.MAX_OBJECT_DEPTH) return '[MAX_DEPTH]';
    if (obj === null || obj === undefined) return null;
    if (typeof obj === 'string') return sanitizeString(obj, SECURITY.MAX_PARAM_VALUE);
    if (typeof obj === 'number') return isFinite(obj) ? obj : null;
    if (typeof obj === 'boolean') return obj;
    if (Array.isArray(obj)) {
      return obj.slice(0, SECURITY.MAX_PARAMS).map(function (item) {
        return sanitizeObject(item, depth + 1);
      });
    }
    if (typeof obj === 'object') {
      var result = {};
      var keys = Object.keys(obj).slice(0, SECURITY.MAX_PARAMS);
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        // SECURITY: Block prototype pollution keys
        if (SECURITY.BLOCKED_KEYS.indexOf(key) !== -1) continue;
        // SECURITY: Sanitize key names
        var safeKey = sanitizeString(key, 100);
        if (!safeKey || safeKey === '[BLOCKED]') continue;
        result[safeKey] = sanitizeObject(obj[key], depth + 1);
      }
      return result;
    }
    return null;
  }

  // Analytics URL patterns to intercept (comprehensive list)
  var ANALYTICS_PATTERNS = [
    // ============================================
    // Google Products
    // ============================================
    // GA4
    { pattern: /google-analytics\.com\/g\/collect/, type: 'GA4' },
    { pattern: /analytics\.google\.com\/g\/collect/, type: 'GA4' },
    { pattern: /www\.google-analytics\.com\/g\/collect/, type: 'GA4' },
    { pattern: /region\d*\.google-analytics\.com\/g\/collect/, type: 'GA4' },
    // Universal Analytics (Legacy)
    { pattern: /google-analytics\.com\/collect/, type: 'UNIVERSAL_ANALYTICS' },
    { pattern: /google-analytics\.com\/r\/collect/, type: 'UNIVERSAL_ANALYTICS' },
    // GTM/gtag.js
    { pattern: /googletagmanager\.com\/gtag\/js/, type: 'GTM_GTAG' },
    { pattern: /googletagmanager\.com\/gtm\.js/, type: 'GTM' },
    // Google Ads
    { pattern: /googleads\.g\.doubleclick\.net/, type: 'GOOGLE_ADS' },
    { pattern: /googleadservices\.com/, type: 'GOOGLE_ADS' },
    // Floodlight (DoubleClick)
    { pattern: /fls\.doubleclick\.net/, type: 'FLOODLIGHT' },
    { pattern: /ad\.doubleclick\.net/, type: 'FLOODLIGHT' },

    // ============================================
    // Social Media Pixels
    // ============================================
    // Meta/Facebook
    { pattern: /facebook\.com\/tr/, type: 'META_PIXEL' },
    { pattern: /connect\.facebook\.net/, type: 'META_PIXEL' },
    // TikTok
    { pattern: /analytics\.tiktok\.com/, type: 'TIKTOK' },
    { pattern: /tiktok\.com\/i18n\/pixel/, type: 'TIKTOK' },
    // Twitter/X
    { pattern: /t\.co\/i\/adsct/, type: 'TWITTER' },
    { pattern: /analytics\.twitter\.com/, type: 'TWITTER' },
    // LinkedIn
    { pattern: /px\.ads\.linkedin\.com/, type: 'LINKEDIN' },
    { pattern: /snap\.licdn\.com/, type: 'LINKEDIN' },
    // Pinterest
    { pattern: /ct\.pinterest\.com/, type: 'PINTEREST' },
    // Snapchat
    { pattern: /tr\.snapchat\.com/, type: 'SNAPCHAT' },
    { pattern: /sc-static\.net\/scevent/, type: 'SNAPCHAT' },
    // Reddit
    { pattern: /redditmedia\.com\/pixel/, type: 'REDDIT' },
    { pattern: /alb\.reddit\.com/, type: 'REDDIT' },
    // Quora
    { pattern: /q\.quora\.com/, type: 'QUORA' },

    // ============================================
    // Native Ad Networks
    // ============================================
    // Outbrain
    { pattern: /outbrain\.com/, type: 'OUTBRAIN' },
    // Taboola
    { pattern: /trc\.taboola\.com/, type: 'TABOOLA' },
    { pattern: /taboola\.com\/livetrc/, type: 'TABOOLA' },
    // Criteo
    { pattern: /static\.criteo\.net/, type: 'CRITEO' },
    { pattern: /dis\.criteo\.com/, type: 'CRITEO' },

    // ============================================
    // Analytics Platforms
    // ============================================
    // Microsoft Clarity
    { pattern: /clarity\.ms/, type: 'CLARITY' },
    // Microsoft UET (Bing)
    { pattern: /bat\.bing\.com/, type: 'MICROSOFT_UET' },
    // Amplitude
    { pattern: /api\.amplitude\.com/, type: 'AMPLITUDE' },
    { pattern: /api2\.amplitude\.com/, type: 'AMPLITUDE' },
    // Mixpanel
    { pattern: /api\.mixpanel\.com/, type: 'MIXPANEL' },
    { pattern: /api-js\.mixpanel\.com/, type: 'MIXPANEL' },
    // Segment
    { pattern: /api\.segment\.io/, type: 'SEGMENT' },
    { pattern: /api\.segment\.com/, type: 'SEGMENT' },
    // Heap
    { pattern: /heapanalytics\.com/, type: 'HEAP' },
    // Plausible
    { pattern: /plausible\.io/, type: 'PLAUSIBLE' },
    // Umami
    { pattern: /umami\.is/, type: 'UMAMI' },
    // Matomo
    { pattern: /matomo\.php/, type: 'MATOMO' },
    { pattern: /piwik\.php/, type: 'MATOMO' },
    // PostHog
    { pattern: /posthog\.com/, type: 'POSTHOG' },

    // ============================================
    // Session Recording & Heatmaps
    // ============================================
    // Hotjar
    { pattern: /static\.hotjar\.com/, type: 'HOTJAR' },
    { pattern: /vars\.hotjar\.com/, type: 'HOTJAR' },
    // FullStory
    { pattern: /fullstory\.com/, type: 'FULLSTORY' },
    // LogRocket
    { pattern: /logrocket\.io/, type: 'LOGROCKET' },
    // Crazy Egg
    { pattern: /crazyegg\.com/, type: 'CRAZYEGG' },
    // Lucky Orange
    { pattern: /luckyorange\.com/, type: 'LUCKYORANGE' },

    // ============================================
    // A/B Testing
    // ============================================
    // AB Tasty
    { pattern: /abtasty\.com/, type: 'ABTASTY' },
    // Optimizely
    { pattern: /cdn\.optimizely\.com/, type: 'OPTIMIZELY' },
    { pattern: /logx\.optimizely\.com/, type: 'OPTIMIZELY' },
    // VWO
    { pattern: /visualwebsiteoptimizer\.com/, type: 'VWO' },

    // ============================================
    // Mobile Attribution
    // ============================================
    // AppsFlyer
    { pattern: /appsflyer\.com/, type: 'APPSFLYER' },

    // ============================================
    // Marketing Automation
    // ============================================
    // HubSpot
    { pattern: /js\.hs-scripts\.com/, type: 'HUBSPOT' },
    { pattern: /track\.hubspot\.com/, type: 'HUBSPOT' },
    // Klaviyo
    { pattern: /klaviyo\.com/, type: 'KLAVIYO' },
    // Marketo
    { pattern: /munchkin\.marketo\.net/, type: 'MARKETO' },
    // Pardot
    { pattern: /pi\.pardot\.com/, type: 'PARDOT' },

    // ============================================
    // Chat & Support
    // ============================================
    // Intercom
    { pattern: /intercom\.io/, type: 'INTERCOM' },
    // Drift
    { pattern: /drift\.com/, type: 'DRIFT' },
    // Zendesk
    { pattern: /zdassets\.com/, type: 'ZENDESK' },
    // Tawk.to
    { pattern: /tawk\.to/, type: 'TAWKTO' },
    // Crisp
    { pattern: /crisp\.chat/, type: 'CRISP' },
    // Freshworks
    { pattern: /freshchat\.com/, type: 'FRESHWORKS' },

    // ============================================
    // Enterprise Analytics
    // ============================================
    // Adobe Analytics
    { pattern: /omtrdc\.net/, type: 'ADOBE_ANALYTICS' },
    { pattern: /2o7\.net/, type: 'ADOBE_ANALYTICS' },
    // Sentry
    { pattern: /sentry\.io/, type: 'SENTRY' },

    // ============================================
    // E-commerce
    // ============================================
    // Shopify
    { pattern: /monorail-edge\.shopifysvc\.com/, type: 'SHOPIFY' },

    // ============================================
    // Affiliate Networks
    // ============================================
    // AdRoll
    { pattern: /adroll\.com/, type: 'ADROLL' },
    // Impact
    { pattern: /impactradius/, type: 'IMPACT' },
    // Commission Junction
    { pattern: /emjcd\.com/, type: 'CJ' },
    // Awin
    { pattern: /awin1\.com/, type: 'AWIN' },
    { pattern: /dwin1\.com/, type: 'AWIN' },

    // ============================================
    // CHINA - Regional Platforms
    // ============================================
    // Baidu Analytics
    { pattern: /hm\.baidu\.com/, type: 'BAIDU_ANALYTICS' },
    { pattern: /tongji\.baidu\.com/, type: 'BAIDU_ANALYTICS' },
    // Baidu Ads
    { pattern: /pos\.baidu\.com/, type: 'BAIDU_ADS' },
    { pattern: /cpro\.baidu\.com/, type: 'BAIDU_ADS' },
    // Tencent/WeChat
    { pattern: /wx\.qq\.com/, type: 'WECHAT' },
    { pattern: /res\.wx\.qq\.com/, type: 'WECHAT' },
    // Alibaba/Alimama
    { pattern: /log\.mmstat\.com/, type: 'ALIBABA' },
    { pattern: /g\.alicdn\.com/, type: 'ALIBABA' },
    // JD.com
    { pattern: /wl\.jd\.com/, type: 'JD' },
    // ByteDance (Douyin/China TikTok)
    { pattern: /analytics\.oceanengine\.com/, type: 'BYTEDANCE' },
    { pattern: /mcs\.ctobsnssdk\.com/, type: 'BYTEDANCE' },
    // Weibo
    { pattern: /beacon\.sina\.com\.cn/, type: 'WEIBO' },

    // ============================================
    // RUSSIA - Regional Platforms  
    // ============================================
    // Yandex Metrica
    { pattern: /mc\.yandex\.ru/, type: 'YANDEX_METRICA' },
    { pattern: /mc\.yandex\.com/, type: 'YANDEX_METRICA' },
    // Yandex Ads
    { pattern: /an\.yandex\.ru/, type: 'YANDEX_ADS' },
    // VK (VKontakte)
    { pattern: /vk\.com\/rtrg/, type: 'VK' },
    { pattern: /top-fwz1\.mail\.ru/, type: 'MAILRU' },

    // ============================================
    // JAPAN - Regional Platforms
    // ============================================
    // Yahoo Japan
    { pattern: /yjtag\.yahoo\.co\.jp/, type: 'YAHOO_JAPAN' },
    { pattern: /b\.yjtag\.jp/, type: 'YAHOO_JAPAN' },
    // LINE
    { pattern: /tr\.line\.me/, type: 'LINE' },
    // Rakuten
    { pattern: /tag\.rmp\.rakuten\.co\.jp/, type: 'RAKUTEN' },

    // ============================================
    // SOUTH KOREA - Regional Platforms
    // ============================================
    // Naver
    { pattern: /wcs\.naver\.com/, type: 'NAVER' },
    // Kakao
    { pattern: /t1\.kakaocdn\.net/, type: 'KAKAO' },

    // ============================================
    // LATIN AMERICA - Regional Platforms
    // ============================================
    // MercadoLibre
    { pattern: /http2\.mlstatic\.com/, type: 'MERCADOLIBRE' },

    // ============================================
    // INDIA - Regional Platforms
    // ============================================
    // Flipkart
    { pattern: /img1a\.flixcart\.com/, type: 'FLIPKART' },

    // ============================================
    // Additional Ad Networks (Global)
    // ============================================
    // Trade Desk
    { pattern: /js\.adsrvr\.org/, type: 'TRADEDESK' },
    { pattern: /match\.adsrvr\.org/, type: 'TRADEDESK' },
    // Amazon Ads
    { pattern: /amazon-adsystem\.com/, type: 'AMAZON_ADS' },
    { pattern: /aax\.amazon/, type: 'AMAZON_ADS' },
    // Bing Ads
    { pattern: /bing\.com\/action/, type: 'BING_ADS' },
    // Yahoo Ads (International)
    { pattern: /analytics\.yahoo\.com/, type: 'YAHOO_ADS' },
    // Conversant
    // StackAdapt
    { pattern: /tags\.srv\.stackadapt\.com/, type: 'STACKADAPT' },
    // Basis/Centro
    { pattern: /rtb\.me/, type: 'BASIS' },

    // ============================================
    // Consent Management Platforms
    // ============================================
    // OneTrust
    { pattern: /cdn\.cookielaw\.org/, type: 'ONETRUST' },
    // TrustArc
    { pattern: /consent\.trustarc\.com/, type: 'TRUSTARC' },
    // Cookiebot
    { pattern: /consent\.cookiebot\.com/, type: 'COOKIEBOT' },

    // ============================================
    // Customer Data Platforms
    // ============================================
    // Salesforce CDP
    { pattern: /cdn\.evgnet\.com/, type: 'SALESFORCE_CDP' },
    // Tealium
    { pattern: /tags\.tiqcdn\.com/, type: 'TEALIUM' },
    { pattern: /collect\.tealiumiq\.com/, type: 'TEALIUM' },
    // mParticle
    { pattern: /jssdkcdns\.mparticle\.com/, type: 'MPARTICLE' },

    // ============================================
    // Additional Marketing Platforms (Global)
    // ============================================
    // MediaAlpha (Auto/Lead/Marketplace)
    { pattern: /mediaalpha\.com/, type: 'MEDIAALPHA' },
    { pattern: /px\.mediaalpha\.com/, type: 'MEDIAALPHA' },
    { pattern: /quoteengine\./, type: 'MEDIAALPHA' },
    // Rockerbox
    { pattern: /getrockerbox\.com/, type: 'ROCKERBOX' },
    // Northbeam
    { pattern: /northbeam\.io/, type: 'NORTHBEAM' },
    // Triple Whale
    { pattern: /triplewhale\.com/, type: 'TRIPLEWHALE' },
    // Elevar
    { pattern: /getelevar\.com/, type: 'ELEVAR' },
    // Littledata
    { pattern: /app\.littledata\.io/, type: 'LITTLEDATA' },
    // Customer.io
    { pattern: /track\.customer\.io/, type: 'CUSTOMERIO' },
    // Braze (Appboy)
    { pattern: /sdk\.iad-\d+\.braze\.com/, type: 'BRAZE' },
    { pattern: /rest\.iad-\d+\.braze\.com/, type: 'BRAZE' },
    // Iterable
    { pattern: /api\.iterable\.com/, type: 'ITERABLE' },
    // Leanplum
    { pattern: /api\.leanplum\.com/, type: 'LEANPLUM' },
    // CleverTap
    { pattern: /wzrkt\.com/, type: 'CLEVERTAP' },
    // Insider
    { pattern: /api\.useinsider\.com/, type: 'INSIDER' },
    // Emarsys
    { pattern: /cdn\.scarabresearch\.com/, type: 'EMARSYS' },
    // Sailthru
    { pattern: /ak\.sail-horizon\.com/, type: 'SAILTHRU' },
    // Attentive
    { pattern: /cdn\.attn\.tv/, type: 'ATTENTIVE' },
    // Listrak
    { pattern: /s1\.listrakbi\.com/, type: 'LISTRAK' },
    // Blueshift
    { pattern: /api\.getblueshift\.com/, type: 'BLUESHIFT' },
    // Bloomreach
    { pattern: /cdn\.exponea\.com/, type: 'BLOOMREACH' },
    // Drip
    { pattern: /api\.getdrip\.com/, type: 'DRIP' },
    // ActiveCampaign
    { pattern: /trackcmp\.net/, type: 'ACTIVECAMPAIGN' },
    // Sendlane
    { pattern: /beacon\.sendlane\.com/, type: 'SENDLANE' },
    // Omnisend
    { pattern: /api\.omnisend\.com/, type: 'OMNISEND' },
    // Ometria
    { pattern: /api\.ometria\.com/, type: 'OMETRIA' },
    // Dotdigital
    { pattern: /r\.trackedlink\.net/, type: 'DOTDIGITAL' },
    // Zaius (Optimizely Data Platform)
    { pattern: /d\.zaius\.io/, type: 'ZAIUS' },

    // ============================================
    // Attribution & Analytics
    // ============================================
    // Singular
    { pattern: /sdk\.singular\.net/, type: 'SINGULAR' },
    // Branch
    { pattern: /api\.branch\.io/, type: 'BRANCH' },
    // Kochava
    { pattern: /kochava\.com/, type: 'KOCHAVA' },
    // Adjust
    { pattern: /adj\.st/, type: 'ADJUST' },
    { pattern: /app\.adjust\.com/, type: 'ADJUST' },
    // Attribution
    { pattern: /attribution\.io/, type: 'ATTRIBUTION' },
    // Dreamdata
    { pattern: /cdn\.dreamdata\.cloud/, type: 'DREAMDATA' },
    // Factors.ai
    { pattern: /app\.factors\.ai/, type: 'FACTORS' },
    // Reveal (Clearbit)
    { pattern: /reveal\.clearbit\.com/, type: 'CLEARBIT' },
    // 6sense
    { pattern: /j\.6sc\.co/, type: 'SIXSENSE' },
    // Demandbase
    { pattern: /tag\.demandbase\.com/, type: 'DEMANDBASE' },
    // ZoomInfo
    { pattern: /ws\.zoominfo\.com/, type: 'ZOOMINFO' },
    // LeadFeeder
    { pattern: /lftracker\.leadfeeder\.com/, type: 'LEADFEEDER' },
    // Albacross
    { pattern: /serve\.albacross\.com/, type: 'ALBACROSS' },

    // ============================================
    // Video & Rich Media
    // ============================================
    // Wistia
    { pattern: /fast\.wistia\.com/, type: 'WISTIA' },
    // Vimeo
    { pattern: /vimeo\.com\/api/, type: 'VIMEO' },
    // Vidyard
    { pattern: /play\.vidyard\.com/, type: 'VIDYARD' },
    // Brightcove
    { pattern: /metrics\.brightcove\.com/, type: 'BRIGHTCOVE' },
    // JW Player
    { pattern: /jwpltx\.com/, type: 'JWPLAYER' },

    // ============================================
    // Push Notifications
    // ============================================
    // OneSignal
    { pattern: /onesignal\.com/, type: 'ONESIGNAL' },
    // Pushwoosh
    { pattern: /cp\.pushwoosh\.com/, type: 'PUSHWOOSH' },
    // Airship
    { pattern: /web-sdk\.urbanairship\.com/, type: 'AIRSHIP' },
    // WebEngage
    { pattern: /cdn\.webengage\.com/, type: 'WEBENGAGE' },
    // PushEngage
    { pattern: /pushengage\.com/, type: 'PUSHENGAGE' },

    // ============================================
    // Survey & Feedback
    // ============================================
    // Qualtrics
    { pattern: /siteintercept\.qualtrics\.com/, type: 'QUALTRICS' },
    // SurveyMonkey
    { pattern: /widget\.surveymonkey\.com/, type: 'SURVEYMONKEY' },
    // Typeform
    { pattern: /embed\.typeform\.com/, type: 'TYPEFORM' },
    // Delighted
    { pattern: /d\.delighted\.com/, type: 'DELIGHTED' },
    // Medallia
    { pattern: /resources\.medallia\.com/, type: 'MEDALLIA' },
    // UserVoice
    { pattern: /widget\.uservoice\.com/, type: 'USERVOICE' },

    // ============================================
    // Reviews & UGC
    // ============================================
    // Yotpo
    { pattern: /staticw2\.yotpo\.com/, type: 'YOTPO' },
    // Bazaarvoice
    { pattern: /display\.ugc\.bazaarvoice\.com/, type: 'BAZAARVOICE' },
    // Trustpilot
    { pattern: /widget\.trustpilot\.com/, type: 'TRUSTPILOT' },
    // PowerReviews
    { pattern: /analytics\.powerreviews\.com/, type: 'POWERREVIEWS' },
    // Stamped.io
    { pattern: /stamped\.io/, type: 'STAMPED' },
    // Okendo
    { pattern: /api\.okendo\.io/, type: 'OKENDO' },
    // Judge.me
    { pattern: /judge\.me/, type: 'JUDGEME' },
    // Loox
    { pattern: /loox\.io/, type: 'LOOX' },

    // ============================================
    // Personalization
    // ============================================
    // Dynamic Yield
    { pattern: /cdn\.dynamicyield\.com/, type: 'DYNAMICYIELD' },
    // Monetate
    { pattern: /se\.monetate\.net/, type: 'MONETATE' },
    // Nosto
    { pattern: /connect\.nosto\.com/, type: 'NOSTO' },
    // Barilliance
    { pattern: /cdn\.barilliance\.com/, type: 'BARILLIANCE' },
    // RichRelevance
    { pattern: /recs\.richrelevance\.com/, type: 'RICHRELEVANCE' },
    // Certona
    { pattern: /edge\.certona\.net/, type: 'CERTONA' },
    // Algolia (Recommend)
    { pattern: /insights\.algolia\.io/, type: 'ALGOLIA' },
    // Constructor.io
    { pattern: /ac\.cnstrc\.com/, type: 'CONSTRUCTOR' },
    // SearchSpring
    { pattern: /cdn\.searchspring\.net/, type: 'SEARCHSPRING' },
    // Klevu
    { pattern: /js\.klevu\.com/, type: 'KLEVU' },

    // ============================================
    // Fraud Prevention & Security
    // ============================================
    // PerimeterX/HUMAN
    { pattern: /px-cloud\.net/, type: 'PERIMETERX' },
    // Forter
    { pattern: /forter\.com/, type: 'FORTER' },
    // Signifyd
    { pattern: /cdn-scripts\.signifyd\.com/, type: 'SIGNIFYD' },
    // Riskified
    { pattern: /beacon\.riskified\.com/, type: 'RISKIFIED' },
    // Shape Security (F5)
    { pattern: /ct\.captcha-delivery\.com/, type: 'SHAPE' },

    // ============================================
    // GTM Built-in & Community Templates (Additional)
    // ============================================
    // comScore
    { pattern: /scorecardresearch\.com/, type: 'COMSCORE' },
    { pattern: /sb\.scorecardresearch\.com/, type: 'COMSCORE' },
    // Nielsen DCR
    { pattern: /imrworldwide\.com/, type: 'NIELSEN' },
    { pattern: /secure-dcr\.imrworldwide\.com/, type: 'NIELSEN' },
    // Quantcast
    { pattern: /pixel\.quantserve\.com/, type: 'QUANTCAST' },
    { pattern: /quantcast\.mgr\.consensu\.org/, type: 'QUANTCAST' },
    // Mouseflow
    { pattern: /mouseflow\.com/, type: 'MOUSEFLOW' },
    // Contentsquare (ClickTale)
    { pattern: /contentsquare\.net/, type: 'CONTENTSQUARE' },
    { pattern: /clicktale\.net/, type: 'CONTENTSQUARE' },
    // Lytics
    { pattern: /api\.lytics\.io/, type: 'LYTICS' },
    { pattern: /c\.lytics\.io/, type: 'LYTICS' },
    // Marin Software
    { pattern: /tracker\.marinsm\.com/, type: 'MARIN' },
    // Mediaplex
    { pattern: /mediaplex\.com/, type: 'MEDIAPLEX' },
    // Tradedoubler
    { pattern: /tradedoubler\.com/, type: 'TRADEDOUBLER' },
    // Infinity Call Tracking
    { pattern: /infinity-tracking\.net/, type: 'INFINITY' },
    // Survicate
    { pattern: /survey\.survicate\.com/, type: 'SURVICATE' },
    // Tapad
    { pattern: /tapad\.com/, type: 'TAPAD' },
    // Turn (Amobee)
    { pattern: /ad\.turn\.com/, type: 'TURN' },
    // Upsellit
    { pattern: /upsellit\.com/, type: 'UPSELLIT' },
    // Ve Interactive
    { pattern: /veinteractive\.com/, type: 'VEINTERACTIVE' },
    // Yieldify
    { pattern: /yieldify\.com/, type: 'YIELDIFY' },
    // SaleCycle
    { pattern: /salecycle\.com/, type: 'SALECYCLE' },
    // Shareaholic
    { pattern: /shareaholic\.com/, type: 'SHAREAHOLIC' },
    // Xtremepush
    { pattern: /xtremepush\.com/, type: 'XTREMEPUSH' },
    // Dstillery
    { pattern: /dstillery\.com/, type: 'DSTILLERY' },
    { pattern: /media6degrees\.com/, type: 'DSTILLERY' },
    // Eulerian Analytics
    { pattern: /eulerian\.net/, type: 'EULERIAN' },
    // FoxMetrics
    { pattern: /foxmetrics\.com/, type: 'FOXMETRICS' },
    // LeadLab (wiredminds)
    { pattern: /wiredminds\.de/, type: 'LEADLAB' },
    // Placed
    { pattern: /placed\.com/, type: 'PLACED' },
    // K50
    { pattern: /k50\.ru/, type: 'K50' },
    // Personali
    { pattern: /personali\.com/, type: 'PERSONALI' },
    // Perfect Audience
    { pattern: /perfectaudience\.com/, type: 'PERFECTAUDIENCE' },
    // Pulse Insights
    { pattern: /pulseinsights\.com/, type: 'PULSEINSIGHTS' },
    // Bizrate Insights
    { pattern: /bizrate\.com/, type: 'BIZRATE' },
    // Adometry
    { pattern: /adometry\.com/, type: 'ADOMETRY' },
    // DistroScale
    { pattern: /distroscale\.com/, type: 'DISTROSCALE' },
    // Audience Center 360
    { pattern: /audience360\.com/, type: 'AUDIENCE360' },
    // Oktopost
    { pattern: /oktopost\.com/, type: 'OKTOPOST' },
    // VisualDNA
    { pattern: /visualdna\.com/, type: 'VISUALDNA' },
    // Neustar AdAdvisor
    { pattern: /adadvisor\.net/, type: 'NEUSTAR' },
    // Google Trusted Stores / Google Customer Reviews
    { pattern: /apis\.google\.com\/js\/platform/, type: 'GOOGLE_REVIEWS' },
    // Conversion Linker (Google)
    { pattern: /pagead\/landing/, type: 'CONVERSION_LINKER' },
  ];

  // Debug logging (can be disabled in production)
  const DEBUG = true;
  function debugLog() {
    if (DEBUG) {
      var args = Array.prototype.slice.call(arguments);
      args.unshift('[GTM Live Interceptor]');
      console.log.apply(console, args);
    }
  }

  /**
   * Check if URL matches analytics patterns
   */
  function getAnalyticsType(url) {
    for (const { pattern, type } of ANALYTICS_PATTERNS) {
      if (pattern.test(url)) {
        return type;
      }
    }
    return null;
  }

  /**
   * Parse GA4 payload - Production-ready parsing
   * Handles single events AND batch requests (multiple events in one request)
   * Returns an ARRAY of event objects
   */
  function parseGA4Payload(url, body) {
    // Combine URL and body into one string
    var fullParams = '';

    try {
      var urlObj = new URL(url);
      fullParams = urlObj.search.substring(1);
    } catch (e) { }

    // Handle body - could be string, Blob, or other
    if (body) {
      var bodyStr = '';
      if (typeof body === 'string') {
        bodyStr = body;
      } else if (body instanceof URLSearchParams) {
        bodyStr = body.toString();
      } else if (body instanceof FormData) {
        // Convert FormData to string
        var pairs = [];
        body.forEach(function (value, key) {
          pairs.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
        });
        bodyStr = pairs.join('&');
      }

      if (bodyStr) {
        if (fullParams) fullParams += '&';
        // Handle newline-separated params in body (GA4 batch format)
        fullParams += bodyStr.replace(/\n/g, '&');
      }
    }

    // Use URLSearchParams for reliable parsing
    var params;
    try {
      params = new URLSearchParams(fullParams);
    } catch (e) {
      return [{ '_event_name': null, '_measurement_id': null }];
    }

    // Get shared correlation identifiers (same for all events in batch)
    var measurementId = params.get('tid');
    var clientId = params.get('cid');
    var sessionId = params.get('sid');
    var sessionCount = params.get('sct');

    // Check if this is a batch request (multiple 'en' parameters)
    var allEventNames = params.getAll('en');

    if (allEventNames.length <= 1) {
      // Single event - use simple parsing
      var eventName = params.get('en');
      if (eventName) {
        try { eventName = decodeURIComponent(eventName); } catch (e) { }
      }

      var eventParams = {
        '_event_name': eventName,
        '_measurement_id': measurementId,
        '_client_id': clientId,
        '_session_id': sessionId,
        '_session_count': sessionCount,
        '_hit_sequence': params.get('_s'),
        '_event_number': params.get('_ee'),
        '_timestamp': params.get('_et') || params.get('tfd')
      };

      // Extract custom event params
      params.forEach(function (value, key) {
        if (key.indexOf('ep.') === 0 || key.indexOf('epn.') === 0) {
          var paramName = key.replace(/^epn?\./, '');
          try { value = decodeURIComponent(value); } catch (e) { }
          eventParams[paramName] = value;
        }
      });

      return [eventParams];
    }

    // Batch request - parse each event separately
    // GA4 batch format: params appear in order, with 'en' marking new events
    var events = [];
    var currentEvent = null;
    var paramEntries = [];

    // Convert to array to iterate in order
    params.forEach(function (value, key) {
      paramEntries.push([key, value]);
    });

    for (var i = 0; i < paramEntries.length; i++) {
      var key = paramEntries[i][0];
      var value = paramEntries[i][1];

      if (key === 'en') {
        // New event starts - save previous if exists
        if (currentEvent && currentEvent._event_name) {
          events.push(currentEvent);
        }

        var eventName = value;
        try { eventName = decodeURIComponent(eventName); } catch (e) { }

        currentEvent = {
          '_event_name': eventName,
          '_measurement_id': measurementId,
          '_client_id': clientId,
          '_session_id': sessionId,
          '_session_count': sessionCount,
          '_hit_sequence': null,
          '_event_number': null,
          '_timestamp': null
        };
      } else if (currentEvent) {
        // Add param to current event
        if (key === '_s') currentEvent._hit_sequence = value;
        else if (key === '_ee') currentEvent._event_number = value;
        else if (key === '_et' || key === 'tfd') currentEvent._timestamp = value;
        else if (key.indexOf('ep.') === 0 || key.indexOf('epn.') === 0) {
          var paramName = key.replace(/^epn?\./, '');
          try { value = decodeURIComponent(value); } catch (e) { }
          currentEvent[paramName] = value;
        }
      }
    }

    // Don't forget the last event
    if (currentEvent && currentEvent._event_name) {
      events.push(currentEvent);
    }

    return events.length > 0 ? events : [{ '_event_name': null, '_measurement_id': null }];
  }

  /**
   * Parse Meta Pixel payload
   */
  function parseMetaPayload(url, body) {
    const params = {};
    try {
      const urlObj = new URL(url);
      for (const [key, value] of urlObj.searchParams.entries()) {
        params[key] = decodeURIComponent(value);
      }
    } catch (e) { }

    const eventParams = {};
    if (params.ev) eventParams['_event_name'] = params.ev;
    if (params.id) eventParams['_pixel_id'] = params.id;

    // Parse custom data
    if (params.cd) {
      try {
        const customData = JSON.parse(params.cd);
        Object.assign(eventParams, customData);
      } catch (e) { }
    }

    return eventParams;
  }

  /**
   * Parse Taboola payload from network request
   * Taboola URLs can have event name in various places:
   * - URL path: /event/add_to_cart/
   * - Query param: ?en=add_to_cart or ?event=add_to_cart or ?name=add_to_cart
   */
  function parseTaboolaPayload(url, body) {
    const eventParams = {};

    try {
      const urlObj = new URL(url);

      // Check URL path for pixel ID and event name
      // Taboola URL format: https://trc.taboola.com/1684845/log/3/unip?en=add_to_cart
      // The first path segment after domain is usually the PIXEL ID
      const pathParts = urlObj.pathname.split('/').filter(p => p);

      // FIRST: Extract Pixel ID from path (usually first numeric segment)
      // Example: /1684845/log/3/unip → pixel ID is 1684845
      for (let i = 0; i < pathParts.length; i++) {
        const part = pathParts[i];
        // If it's a large number (5+ digits), it's likely the pixel ID
        if (/^\d{5,}$/.test(part)) {
          eventParams['_pixel_id'] = part;
          debugLog('Taboola: Found pixel ID in path:', part);
          break;
        }
      }

      // SECOND: Extract event name from path
      for (let i = 0; i < pathParts.length; i++) {
        const part = pathParts[i];
        // If we find 'event' or 'notify', the next part might be the event name
        if ((part === 'event' || part === 'notify') && pathParts[i + 1]) {
          const possibleName = pathParts[i + 1];
          // Skip if it looks like an ID (all numbers)
          if (!/^\d+$/.test(possibleName)) {
            eventParams['_event_name'] = possibleName;
            break;
          }
        }
        // Common event names in path
        if (['page_view', 'pageview', 'add_to_cart', 'purchase', 'lead', 'complete_registration', 'search', 'view_content', 'checkout', 'click'].includes(part.toLowerCase())) {
          eventParams['_event_name'] = part;
          break;
        }
      }

      // THIRD: Check query params (may override path values)
      for (const [key, value] of urlObj.searchParams.entries()) {
        const lowerKey = key.toLowerCase();
        // Event name params
        if (['en', 'event', 'name', 'event_name', 'eventname', 'action', 'n'].includes(lowerKey)) {
          if (value && !/^\d+$/.test(value)) {
            eventParams['_event_name'] = decodeURIComponent(value);
          }
        }
        // Pixel ID from query params (if not found in path)
        if (!eventParams['_pixel_id'] && ['id', 'pixel_id', 'pixelid', 'account_id', 'pid'].includes(lowerKey)) {
          eventParams['_pixel_id'] = decodeURIComponent(value);
        }
        // Revenue
        if (['revenue', 'value', 'price', 'ordervalue'].includes(lowerKey)) {
          eventParams['_revenue'] = decodeURIComponent(value);
        }
        // Currency
        if (lowerKey === 'currency') {
          eventParams['_currency'] = decodeURIComponent(value);
        }
        // Order ID
        if (['order_id', 'orderid', 'transaction_id', 'oid'].includes(lowerKey)) {
          eventParams['_order_id'] = decodeURIComponent(value);
        }
      }

      // FOURTH: Parse body if it's JSON
      if (body) {
        try {
          const bodyData = typeof body === 'string' ? JSON.parse(body) : body;
          if (bodyData.name) eventParams['_event_name'] = bodyData.name;
          if (bodyData.event) eventParams['_event_name'] = bodyData.event;
          if (bodyData.id && !eventParams['_pixel_id']) eventParams['_pixel_id'] = String(bodyData.id);
        } catch (e) { }
      }

    } catch (e) {
      debugLog('Taboola parse error:', e.message);
    }

    // If still no event name, try to extract from URL patterns
    if (!eventParams['_event_name']) {
      // Check if URL contains common event keywords
      const urlLower = url.toLowerCase();
      const eventKeywords = ['page_view', 'pageview', 'add_to_cart', 'purchase', 'lead', 'signup', 'click', 'conversion'];
      for (const keyword of eventKeywords) {
        if (urlLower.includes(keyword) || urlLower.includes(keyword.replace('_', ''))) {
          eventParams['_event_name'] = keyword;
          break;
        }
      }
    }

    debugLog('Taboola parsed:', eventParams);

    debugLog('Taboola parsed:', eventParams);
    return eventParams;
  }

  /**
   * Generic pixel payload parser
   * Works for most pixels that use standard URL parameters
   * Used for: Outbrain, Criteo, LinkedIn, Twitter, Pinterest, Reddit, Snapchat, etc.
   */
  function parseGenericPixelPayload(url, body, pixelType) {
    const eventParams = {};

    try {
      const urlObj = new URL(url);
      const urlLower = url.toLowerCase();

      // Common event name parameter keys across different platforms
      const eventNameKeys = ['ev', 'en', 'event', 'event_name', 'eventname', 'action', 'a', 'e', 'type', 'event_type', 'conversion_event', 'goal', 'n'];
      const pixelIdKeys = ['id', 'pixel_id', 'pixelid', 'tid', 'tag_id', 'tagid', 'account_id', 'partner_id', 'conversion_id', 'advertiser_id', 'pid', 'ti', 'pixel_code', 'p_id'];
      const revenueKeys = ['revenue', 'value', 'price', 'total', 'amount', 'order_value', 'gv', 'tw_sale_amount'];
      const currencyKeys = ['currency', 'cur', 'cc'];
      const orderIdKeys = ['order_id', 'orderid', 'transaction_id', 'transactionid', 'txn_id', 'oid'];

      // FIRST: Check URL path for pixel/tag IDs (like Taboola, Microsoft UET)
      // Many pixels put ID in path: /1684845/log or /action/0?ti=12345678
      const pathParts = urlObj.pathname.split('/').filter(p => p);
      for (const part of pathParts) {
        // Look for numeric IDs (5+ digits) in path - likely pixel/account ID
        if (/^\d{5,}$/.test(part) && !eventParams['_pixel_id']) {
          eventParams['_pixel_id'] = part;
          debugLog('Found pixel ID in path:', part);
        }
      }

      // Parse query parameters
      for (const [key, value] of urlObj.searchParams.entries()) {
        const lowerKey = key.toLowerCase();
        const decodedValue = decodeURIComponent(value);

        if (eventNameKeys.includes(lowerKey) && decodedValue && !/^\d+$/.test(decodedValue)) {
          eventParams['_event_name'] = decodedValue;
        }
        // Pixel ID from query params (override path if explicit)
        if (pixelIdKeys.includes(lowerKey) && decodedValue) {
          eventParams['_pixel_id'] = decodedValue;
        }
        if (revenueKeys.includes(lowerKey)) {
          eventParams['_revenue'] = decodedValue;
        }
        if (currencyKeys.includes(lowerKey)) {
          eventParams['_currency'] = decodedValue;
        }
        if (orderIdKeys.includes(lowerKey)) {
          eventParams['_order_id'] = decodedValue;
        }
      }

      // Check URL path for event names
      const commonEvents = [
        'pageview', 'page_view', 'viewcontent', 'view_content', 'addtocart', 'add_to_cart',
        'purchase', 'conversion', 'lead', 'signup', 'sign_up', 'registration', 'complete_registration',
        'search', 'checkout', 'initiate_checkout', 'add_payment_info', 'subscribe', 'click',
        'view', 'impression', 'visit', 'track', 'event', 'goal', 'custom'
      ];

      if (!eventParams['_event_name']) {
        for (const part of pathParts) {
          const partLower = part.toLowerCase();
          if (commonEvents.includes(partLower)) {
            eventParams['_event_name'] = part;
            break;
          }
        }
      }

      // Check URL for common event keywords
      if (!eventParams['_event_name']) {
        for (const eventName of commonEvents) {
          if (urlLower.includes('/' + eventName) || urlLower.includes('=' + eventName) || urlLower.includes('event=' + eventName)) {
            eventParams['_event_name'] = eventName;
            break;
          }
        }
      }

      // Parse body if JSON
      if (body) {
        try {
          const bodyData = typeof body === 'string' ? JSON.parse(body) : body;
          if (bodyData.event) eventParams['_event_name'] = bodyData.event;
          if (bodyData.name) eventParams['_event_name'] = bodyData.name;
          if (bodyData.eventName) eventParams['_event_name'] = bodyData.eventName;
          if (bodyData.action) eventParams['_event_name'] = bodyData.action;
          if (bodyData.id) eventParams['_pixel_id'] = bodyData.id;
          if (bodyData.value) eventParams['_revenue'] = bodyData.value;
        } catch (e) { }
      }

      // Platform-specific parsing
      if (pixelType === 'MICROSOFT_UET' || pixelType === 'BING_ADS') {
        // Microsoft UET: ti=tag_id, ea=event_action, ec=event_category, el=event_label
        // URL format: https://bat.bing.com/action/0?ti=12345678&evt=custom&...
        if (urlObj.searchParams.get('ti')) eventParams['_tag_id'] = urlObj.searchParams.get('ti');
        if (urlObj.searchParams.get('ea')) eventParams['_event_name'] = urlObj.searchParams.get('ea');
        if (urlObj.searchParams.get('evt')) eventParams['_event_name'] = urlObj.searchParams.get('evt');
        if (urlObj.searchParams.get('ec')) eventParams['_category'] = urlObj.searchParams.get('ec');
        if (urlObj.searchParams.get('el')) eventParams['_label'] = urlObj.searchParams.get('el');
        if (urlObj.searchParams.get('gv')) eventParams['_revenue'] = urlObj.searchParams.get('gv');
        // Also set pixel_id from tag_id
        if (!eventParams['_pixel_id'] && eventParams['_tag_id']) {
          eventParams['_pixel_id'] = eventParams['_tag_id'];
        }
      }

      if (pixelType === 'LINKEDIN') {
        // LinkedIn: pid=partner_id, conversionId in URL
        // URL format: https://px.ads.linkedin.com/collect?pid=123456&conversionId=789
        if (urlObj.searchParams.get('pid')) {
          eventParams['_partner_id'] = urlObj.searchParams.get('pid');
          if (!eventParams['_pixel_id']) eventParams['_pixel_id'] = urlObj.searchParams.get('pid');
        }
        const convMatch = url.match(/conversionId[=\/](\d+)/i);
        if (convMatch) eventParams['_conversion_id'] = convMatch[1];
        if (urlObj.searchParams.get('fmt')) eventParams['_event_name'] = 'conversion';
      }

      if (pixelType === 'TWITTER') {
        // Twitter/X: p_id=pixel_id, txn_id, tw_sale_amount
        // URL format: https://analytics.twitter.com/i/adsct?p_id=xxxxx&...
        if (urlObj.searchParams.get('p_id')) {
          eventParams['_pixel_id'] = urlObj.searchParams.get('p_id');
        }
        if (urlObj.searchParams.get('txn_id')) eventParams['_transaction_id'] = urlObj.searchParams.get('txn_id');
        if (urlObj.searchParams.get('tw_sale_amount')) eventParams['_revenue'] = urlObj.searchParams.get('tw_sale_amount');
        if (urlObj.searchParams.get('events')) eventParams['_event_name'] = urlObj.searchParams.get('events');
      }

      if (pixelType === 'TIKTOK') {
        // TikTok: pixel_code in query, event in query/body
        // URL format: https://analytics.tiktok.com/api/v2/pixel?pixel_code=XXXXX&event=...
        if (urlObj.searchParams.get('pixel_code')) {
          eventParams['_pixel_id'] = urlObj.searchParams.get('pixel_code');
        }
        if (urlObj.searchParams.get('event')) eventParams['_event_name'] = urlObj.searchParams.get('event');
        const ttMatch = url.match(/pixel[_\/]([A-Z0-9]+)/i);
        if (ttMatch && !eventParams['_pixel_id']) eventParams['_pixel_id'] = ttMatch[1];
      }

      if (pixelType === 'SNAPCHAT') {
        // Snapchat: pid=pixel_id, event_type
        // URL format: https://tr.snapchat.com/p?pid=xxxxx&ev=PAGE_VIEW
        if (urlObj.searchParams.get('pid')) {
          eventParams['_pixel_id'] = urlObj.searchParams.get('pid');
        }
        if (urlObj.searchParams.get('ev')) eventParams['_event_name'] = urlObj.searchParams.get('ev');
        if (urlObj.searchParams.get('event_type')) eventParams['_event_name'] = urlObj.searchParams.get('event_type');
      }

      if (pixelType === 'PINTEREST') {
        // Pinterest: tid=tag_id, ed (event data), event
        // URL format: https://ct.pinterest.com/v3/?tid=xxxxx&event=...
        if (urlObj.searchParams.get('tid')) {
          eventParams['_pixel_id'] = urlObj.searchParams.get('tid');
        }
        if (urlObj.searchParams.get('event')) eventParams['_event_name'] = urlObj.searchParams.get('event');
        if (urlObj.searchParams.get('ed')) {
          try {
            const ed = JSON.parse(decodeURIComponent(urlObj.searchParams.get('ed')));
            if (ed.event_name) eventParams['_event_name'] = ed.event_name;
            if (ed.value) eventParams['_revenue'] = ed.value;
          } catch (e) { }
        }
      }

      if (pixelType === 'OUTBRAIN') {
        // Outbrain: marketerId, ob_click_id, name
        // URL format: https://tr.outbrain.com/pixel?ob_click_id=xxx&marketerId=xxx
        if (urlObj.searchParams.get('marketerId')) {
          eventParams['_pixel_id'] = urlObj.searchParams.get('marketerId');
        }
        if (urlObj.searchParams.get('name')) eventParams['_event_name'] = urlObj.searchParams.get('name');
        const obMatch = url.match(/tr\/([^\/\?]+)/);
        if (obMatch && !eventParams['_event_name']) eventParams['_event_name'] = obMatch[1];
        // Look for pixel ID in path
        const obIdMatch = url.match(/outbrain\.com\/(\d+)/);
        if (obIdMatch && !eventParams['_pixel_id']) eventParams['_pixel_id'] = obIdMatch[1];
      }

      if (pixelType === 'CRITEO') {
        // Criteo: account/partner in URL, event in body
        // URL format: https://dis.criteo.com/dis/rtb/.../cookiematch.aspx?partner=xxx
        if (urlObj.searchParams.get('partner')) {
          eventParams['_pixel_id'] = urlObj.searchParams.get('partner');
        }
        if (urlObj.searchParams.get('account')) {
          eventParams['_pixel_id'] = urlObj.searchParams.get('account');
        }
        if (urlObj.searchParams.get('e')) eventParams['_event_name'] = urlObj.searchParams.get('e');
        // Look for account ID in path
        const criteoMatch = url.match(/criteo\.com\/(\d+)/);
        if (criteoMatch && !eventParams['_pixel_id']) eventParams['_pixel_id'] = criteoMatch[1];
      }

      if (pixelType === 'REDDIT') {
        // Reddit: a=advertiser_id, t=event_type
        if (urlObj.searchParams.get('a')) {
          eventParams['_pixel_id'] = urlObj.searchParams.get('a');
        }
        if (urlObj.searchParams.get('t')) eventParams['_event_name'] = urlObj.searchParams.get('t');
        if (urlObj.searchParams.get('event')) eventParams['_event_name'] = urlObj.searchParams.get('event');
      }

      if (pixelType === 'QUORA') {
        // Quora: a=account_id
        if (urlObj.searchParams.get('a')) {
          eventParams['_pixel_id'] = urlObj.searchParams.get('a');
        }
        if (urlObj.searchParams.get('evtname')) eventParams['_event_name'] = urlObj.searchParams.get('evtname');
      }

    } catch (e) {
      debugLog('Generic pixel parse error:', pixelType, e.message);
    }

    debugLog('Pixel parsed:', pixelType, eventParams);
    return eventParams;
  }

  /**
   * Generate a unique event key for aggregation
   * Uses multiple identifiers for accurate event correlation
   * Events with same key within time window will be merged
   */
  function generateEventKey(type, eventParams) {
    var eventName = eventParams['_event_name'] || 'unknown';
    var measurementId = eventParams['_measurement_id'] || eventParams['_pixel_id'] || '';
    var clientId = eventParams['_client_id'] || '';
    var sessionId = eventParams['_session_id'] || '';

    // For GA4: Use client_id + session_id + event_name for precise matching
    // This ensures we correlate events from the same user session
    if (type === 'GA4' && clientId && sessionId) {
      return type + ':' + clientId + ':' + sessionId + ':' + eventName;
    }

    // Fallback: Use measurement ID + event name
    return type + ':' + measurementId + ':' + eventName;
  }

  /**
   * Send captured network request to content script
   * SECURITY: All data is validated, sanitized, and rate-limited
   */
  function sendNetworkCapture(url, type, eventParams, method) {
    // SECURITY: Rate limiting to prevent abuse
    if (!checkRateLimit()) {
      debugLog('Rate limit exceeded, skipping capture');
      return;
    }

    // SECURITY: Validate URL
    if (!isValidURL(url)) {
      debugLog('Invalid URL, skipping capture');
      return;
    }

    // SECURITY: Validate type
    if (typeof type !== 'string' || type.length > 50) {
      return;
    }

    // Clean up and SANITIZE eventParams
    var cleanParams = {};
    var paramCount = 0;

    for (var key in eventParams) {
      if (eventParams.hasOwnProperty(key)) {
        // SECURITY: Limit number of parameters
        if (paramCount >= SECURITY.MAX_PARAMS) break;

        // SECURITY: Skip dangerous keys
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;

        var value = eventParams[key];
        if (value === null || value === undefined) continue;

        // SECURITY: Sanitize key and value
        var safeKey = sanitizeString(key, 100);
        var cleanValue = sanitizeString(String(value), SECURITY.MAX_PARAM_VALUE);

        // Remove any trailing event markers from values
        if (cleanValue.includes(' en=')) {
          cleanValue = cleanValue.split(' en=')[0];
        }
        if (cleanValue.includes('&en=')) {
          cleanValue = cleanValue.split('&en=')[0];
        }
        if (cleanValue.includes('&ep.')) {
          cleanValue = cleanValue.split('&ep.')[0];
        }

        cleanParams[safeKey] = cleanValue;
        paramCount++;
      }
    }

    // Generate event key for aggregation
    var eventKey = generateEventKey(type, cleanParams);

    // SECURITY: Send with trusted source identifier
    window.postMessage({
      type: 'GTM_LIVE_NETWORK_REQUEST',
      source: SECURITY.MESSAGE_SOURCE,
      payload: {
        url: sanitizeString(url, SECURITY.MAX_URL_LENGTH),
        tagType: sanitizeString(type, 50),
        eventParams: cleanParams,
        eventKey: sanitizeString(eventKey, 500),
        method: sanitizeString(method || 'GET', 10),
        timestamp: new Date().toISOString(),
      }
    }, window.location.origin);
  }

  // ==========================================
  // INTERCEPT FETCH REQUESTS
  // ==========================================
  const originalFetch = window.fetch;
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : input.url;
    var method = (init && init.method) ? init.method : 'GET';
    var body = init ? init.body : undefined;

    // Debug: log all fetch requests to analytics endpoints
    if (url && (url.includes('google') || url.includes('analytics') || url.includes('facebook') || url.includes('clarity'))) {
      debugLog('Fetch request:', url.substring(0, 100));
    }

    var analyticsType = getAnalyticsType(url);
    if (analyticsType) {
      debugLog('Matched analytics type:', analyticsType, 'URL:', url.substring(0, 80));

      if (analyticsType === 'GA4') {
        // GA4 returns array (for batch support)
        var ga4Events = parseGA4Payload(url, body);
        debugLog('GA4 events count:', ga4Events.length);

        for (var i = 0; i < ga4Events.length; i++) {
          var eventParams = ga4Events[i];
          debugLog('GA4 event:', eventParams._event_name, eventParams);
          sendNetworkCapture(url, analyticsType, eventParams, method);
        }
      } else if (analyticsType === 'META_PIXEL') {
        var metaParams = parseMetaPayload(url, body);
        if (Object.keys(metaParams).length > 0) {
          sendNetworkCapture(url, analyticsType, metaParams, method);
        }
      } else if (analyticsType === 'TABOOLA') {
        var taboolaParams = parseTaboolaPayload(url, body);
        sendNetworkCapture(url, analyticsType, taboolaParams, method);
      } else {
        // All other pixels - use generic parser
        var genericParams = parseGenericPixelPayload(url, body, analyticsType);
        sendNetworkCapture(url, analyticsType, genericParams, method);
      }
    }

    return originalFetch.apply(this, arguments);
  };

  // ==========================================
  // INTERCEPT XMLHttpRequest
  // ==========================================
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url) {
    this._gtmLiveUrl = url;
    this._gtmLiveMethod = method;
    return originalXHROpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function (body) {
    var url = this._gtmLiveUrl;
    var method = this._gtmLiveMethod;

    if (url) {
      var analyticsType = getAnalyticsType(url);
      if (analyticsType) {
        if (analyticsType === 'GA4') {
          var ga4Events = parseGA4Payload(url, body);
          for (var i = 0; i < ga4Events.length; i++) {
            sendNetworkCapture(url, analyticsType, ga4Events[i], method);
          }
        } else if (analyticsType === 'META_PIXEL') {
          var metaParams = parseMetaPayload(url, body);
          if (Object.keys(metaParams).length > 0) {
            sendNetworkCapture(url, analyticsType, metaParams, method);
          }
        } else if (analyticsType === 'TABOOLA') {
          var taboolaParams = parseTaboolaPayload(url, body);
          sendNetworkCapture(url, analyticsType, taboolaParams, method);
        } else {
          // All other pixels - use generic parser
          var genericParams = parseGenericPixelPayload(url, body, analyticsType);
          sendNetworkCapture(url, analyticsType, genericParams, method);
        }
      }
    }

    return originalXHRSend.apply(this, arguments);
  };

  // ==========================================
  // INTERCEPT navigator.sendBeacon
  // ==========================================
  var originalSendBeacon = navigator.sendBeacon;
  if (originalSendBeacon) {
    navigator.sendBeacon = function (url, data) {
      // Debug: log all beacon requests
      if (url && (url.includes('google') || url.includes('analytics') || url.includes('facebook') || url.includes('clarity'))) {
        debugLog('SendBeacon request:', url.substring(0, 100));
      }

      var analyticsType = getAnalyticsType(url);
      if (analyticsType) {
        debugLog('SendBeacon matched:', analyticsType, 'URL:', url.substring(0, 80));

        if (analyticsType === 'GA4') {
          var ga4Events = parseGA4Payload(url, data);
          debugLog('GA4 beacon events:', ga4Events.length);
          for (var i = 0; i < ga4Events.length; i++) {
            sendNetworkCapture(url, analyticsType, ga4Events[i], 'BEACON');
          }
        } else if (analyticsType === 'META_PIXEL') {
          var metaParams = parseMetaPayload(url, data);
          if (Object.keys(metaParams).length > 0) {
            sendNetworkCapture(url, analyticsType, metaParams, 'BEACON');
          }
        } else if (analyticsType === 'TABOOLA') {
          var taboolaParams = parseTaboolaPayload(url, data);
          sendNetworkCapture(url, analyticsType, taboolaParams, 'BEACON');
        } else {
          // All other pixels - use generic parser
          var genericParams = parseGenericPixelPayload(url, data, analyticsType);
          sendNetworkCapture(url, analyticsType, genericParams, 'BEACON');
        }
      }

      return originalSendBeacon.apply(this, arguments);
    };
  }

  // ==========================================
  // INTERCEPT dataLayer.push
  // ==========================================
  // GTM templates (default, custom HTML, community) all push to dataLayer
  // This captures ALL GTM tag fires

  /**
   * Extract meaningful event data from dataLayer push
   * Handles various GTM event structures
   */
  function parseDataLayerEvent(data) {
    if (!data || typeof data !== 'object') return null;

    var eventParams = {};

    // Extract event name from various GTM patterns
    var eventName = data.event
      || data.eventName
      || data['gtm.element'] && 'gtm.click'
      || data['gtm.triggers'] && 'gtm.trigger'
      || null;

    if (eventName) {
      eventParams._event_name = eventName;
    }

    // Skip GTM internal events unless they have useful data
    var gtmInternalEvents = ['gtm.js', 'gtm.dom', 'gtm.load', 'gtm.init', 'gtm.init_consent'];
    if (eventName && gtmInternalEvents.includes(eventName) && !data.ecommerce) {
      return null;
    }

    // Extract ecommerce data (GA4 / UA format)
    if (data.ecommerce) {
      var ecom = data.ecommerce;

      // GA4 ecommerce events
      if (ecom.items) {
        eventParams._items_count = ecom.items.length;
        eventParams._value = ecom.value || ecom.total;
        eventParams._currency = ecom.currency;
        eventParams._transaction_id = ecom.transaction_id;
      }

      // UA ecommerce events
      if (ecom.purchase) {
        eventParams._event_name = eventParams._event_name || 'purchase';
        eventParams._transaction_id = ecom.purchase.actionField?.id;
        eventParams._revenue = ecom.purchase.actionField?.revenue;
      }
      if (ecom.add) {
        eventParams._event_name = eventParams._event_name || 'add_to_cart';
      }
      if (ecom.remove) {
        eventParams._event_name = eventParams._event_name || 'remove_from_cart';
      }
      if (ecom.checkout) {
        eventParams._event_name = eventParams._event_name || 'begin_checkout';
      }
      if (ecom.impressions) {
        eventParams._event_name = eventParams._event_name || 'view_item_list';
        eventParams._items_count = ecom.impressions.length;
      }
      if (ecom.detail) {
        eventParams._event_name = eventParams._event_name || 'view_item';
      }
    }

    // Extract common conversion parameters
    if (data.transactionId || data.transaction_id) {
      eventParams._transaction_id = data.transactionId || data.transaction_id;
    }
    if (data.transactionTotal || data.value || data.revenue) {
      eventParams._revenue = data.transactionTotal || data.value || data.revenue;
    }
    if (data.currencyCode || data.currency) {
      eventParams._currency = data.currencyCode || data.currency;
    }

    // GTM click events
    if (data['gtm.element']) {
      eventParams._click_element = data['gtm.elementClasses'] || data['gtm.elementId'] || 'element';
      eventParams._click_url = data['gtm.elementUrl'];
      eventParams._click_text = data['gtm.elementText']?.substring(0, 50);
    }

    // Form events
    if (data['gtm.formId']) {
      eventParams._form_id = data['gtm.formId'];
      eventParams._event_name = eventParams._event_name || 'form_submit';
    }

    // Video events
    if (data['gtm.videoTitle']) {
      eventParams._video_title = data['gtm.videoTitle'];
      eventParams._video_percent = data['gtm.videoPercent'];
      eventParams._video_status = data['gtm.videoStatus'];
    }

    // Scroll events
    if (data['gtm.scrollThreshold']) {
      eventParams._scroll_depth = data['gtm.scrollThreshold'];
      eventParams._event_name = eventParams._event_name || 'scroll';
    }

    // Custom dimensions/metrics (common in GTM)
    for (var key in data) {
      if (key.startsWith('dimension') || key.startsWith('metric') || key.startsWith('cd') || key.startsWith('cm')) {
        eventParams[key] = data[key];
      }
    }

    // User properties
    if (data.userId || data.user_id) {
      eventParams._user_id = data.userId || data.user_id;
    }

    return eventParams._event_name ? eventParams : null;
  }

  // Ensure dataLayer exists
  window.dataLayer = window.dataLayer || [];

  // Store original push method
  const originalDataLayerPush = window.dataLayer.push;

  // Override push method
  window.dataLayer.push = function () {
    var args = Array.prototype.slice.call(arguments);

    // Process each pushed item
    for (var i = 0; i < args.length; i++) {
      var item = args[i];

      // ==========================================
      // CONSENT MODE DETECTION
      // Detect: gtag('consent', 'default'|'update', { ... })
      // These are pushed as arrays: ['consent', 'default', { ad_storage: 'denied', ... }]
      // ==========================================
      if (Array.isArray(item) && item[0] === 'consent' && (item[1] === 'default' || item[1] === 'update') && item[2]) {
        try {
          var consentData = {};
          var rawConsent = item[2];
          // Only pick known consent types for safety
          var consentKeys = ['ad_storage', 'analytics_storage', 'ad_user_data', 'ad_personalization', 'functionality_storage', 'personalization_storage', 'security_storage'];
          for (var c = 0; c < consentKeys.length; c++) {
            if (rawConsent[consentKeys[c]]) {
              consentData[consentKeys[c]] = sanitizeString(String(rawConsent[consentKeys[c]]), 20);
            }
          }
          window.postMessage({
            type: 'GTM_LIVE_CONSENT_UPDATE',
            source: SECURITY.MESSAGE_SOURCE,
            payload: {
              consentType: item[1], // 'default' or 'update'
              consentState: consentData,
              timestamp: new Date().toISOString(),
              waitForUpdate: rawConsent.wait_for_update || null,
              regions: rawConsent.region || null,
            }
          }, window.location.origin);
          debugLog('Consent mode detected:', item[1], consentData);
        } catch (e) {
          // Silent fail
        }
      }

      // Parse and send meaningful events
      var parsedEvent = parseDataLayerEvent(item);
      if (parsedEvent) {
        debugLog('dataLayer event:', parsedEvent._event_name, parsedEvent);

        // Send as network capture so it appears with other events
        sendNetworkCapture(
          'datalayer://' + (parsedEvent._event_name || 'push'),
          'DATALAYER',
          parsedEvent,
          'PUSH'
        );
      }
    }

    // Also send raw data for full visibility
    try {
      window.postMessage({
        type: 'GTM_LIVE_DATALAYER_PUSH',
        payload: {
          data: JSON.parse(JSON.stringify(args)),
          timestamp: new Date().toISOString(),
        }
      }, window.location.origin);
    } catch (error) {
      var eventName = (args[0] && args[0].event) ? args[0].event : 'unknown';
      window.postMessage({
        type: 'GTM_LIVE_DATALAYER_PUSH',
        payload: {
          data: [{ event: eventName, _serializationError: true }],
          timestamp: new Date().toISOString(),
        }
      }, window.location.origin);
    }

    // Call original push
    return originalDataLayerPush.apply(window.dataLayer, args);
  };

  // Capture existing dataLayer items
  if (window.dataLayer.length > 0) {
    // Process existing items
    for (var i = 0; i < window.dataLayer.length; i++) {
      var parsedEvent = parseDataLayerEvent(window.dataLayer[i]);
      if (parsedEvent) {
        sendNetworkCapture(
          'datalayer://' + (parsedEvent._event_name || 'init'),
          'DATALAYER',
          parsedEvent,
          'INIT'
        );
      }
    }

    try {
      window.postMessage({
        type: 'GTM_LIVE_DATALAYER_INIT',
        payload: {
          data: JSON.parse(JSON.stringify(window.dataLayer)),
          timestamp: new Date().toISOString(),
        }
      }, window.location.origin);
    } catch (error) {
      // Ignore serialization errors for initial data
    }
  }

  // ==========================================
  // SDK METHOD INTERCEPTION
  // ==========================================
  // Captures events from tracking SDKs like:
  // - Meta Pixel (fbq)
  // - TikTok (ttq)
  // - Taboola (_tfa)
  // - Snapchat (snaptr)
  // - Twitter (twq)
  // - Pinterest (pintrk)
  // - Reddit (rdt)
  // - LinkedIn (lintrk)
  // ==========================================

  /**
   * SDK Configuration - Easy to add new SDKs
   * Each SDK defines: method name, how to extract event data
   */
  var SDK_CONFIG = {
    // Meta Pixel
    fbq: {
      name: 'Meta Pixel',
      type: 'META_PIXEL',
      extract: function (args) {
        // fbq('track', 'Purchase', {value: 10})
        // fbq('trackCustom', 'MyEvent', {})
        var action = args[0]; // 'track', 'trackCustom', 'init'
        var eventName = args[1] || action;
        var params = args[2] || {};

        if (action === 'init') {
          return { _event_name: 'init', _pixel_id: args[1] };
        }

        return {
          _event_name: eventName,
          _action: action,
          ...params
        };
      }
    },

    // TikTok Pixel
    ttq: {
      name: 'TikTok Pixel',
      type: 'TIKTOK',
      methods: ['track', 'identify', 'page'], // Sub-methods to watch
      extract: function (method, args) {
        // ttq.track('ViewContent', {content_id: '123'})
        var eventName = args[0] || method;
        var params = args[1] || {};

        return {
          _event_name: eventName,
          _method: method,
          ...params
        };
      }
    },

    // Taboola - Enhanced to handle all event patterns
    _tfa: {
      name: 'Taboola',
      type: 'TABOOLA',
      isArray: true,
      extractMultiple: true,
      additionalMethods: ['notify', 'event', 'track', 'conversion', 'sendEvent'],
      extract: function (args) {
        var data = args[0];

        // Skip null/undefined/empty
        if (!data) return null;

        // Handle array format: ['notify', 'event', 'eventName']
        if (Array.isArray(data)) {
          var eventName = data[2] || data[1] || data[0];
          if (!eventName) return null;
          return {
            _event_name: eventName,
            _notify: data[0],
            _action: data[1],
            _format: 'array'
          };
        }

        // Handle string (just event name)
        if (typeof data === 'string') {
          return { _event_name: data };
        }

        // Handle object format: {notify: 'event', name: 'page_view', id: 123}
        if (typeof data === 'object') {
          // STRICT: Only capture if it has a REAL event name
          // The event name MUST be explicitly provided - no defaults!
          var eventName = data.name || data.event || data.eventName || data.action;

          // NO EVENT NAME = SKIP
          // Don't capture internal SDK calls that don't have explicit event names
          if (!eventName) {
            debugLog('Taboola: Skipping - no event name in:', JSON.stringify(data).substring(0, 100));
            return null;
          }

          return {
            _event_name: eventName,
            _notify: data.notify,
            _pixel_id: data.id || data.pixelId || data.pixel_id,
            _revenue: data.revenue,
            _currency: data.currency,
            _order_id: data.orderId || data.order_id,
            _item_name: data.item || data.item_name,
            _quantity: data.quantity,
            _format: 'object'
          };
        }

        return null;
      },
      extractMethod: function (method, args) {
        var eventName = args[1] || args[0] || method;
        if (!eventName) return null;
        return {
          _event_name: eventName,
          _method: method,
          _type: args[0],
          _pixel_id: args[2] || null
        };
      }
    },

    // Snapchat
    snaptr: {
      name: 'Snapchat Pixel',
      type: 'SNAPCHAT',
      extract: function (args) {
        // snaptr('track', 'PURCHASE', {price: 10})
        var action = args[0];
        var eventName = args[1] || action;
        var params = args[2] || {};

        if (action === 'init') {
          return { _event_name: 'init', _pixel_id: args[1] };
        }

        return {
          _event_name: eventName,
          _action: action,
          ...params
        };
      }
    },

    // Twitter/X
    twq: {
      name: 'Twitter Pixel',
      type: 'TWITTER',
      extract: function (args) {
        // twq('track', 'Purchase', {value: 10})
        var action = args[0];
        var eventName = args[1] || action;
        var params = args[2] || {};

        if (action === 'init') {
          return { _event_name: 'init', _pixel_id: args[1] };
        }

        return {
          _event_name: eventName,
          _action: action,
          ...params
        };
      }
    },

    // Pinterest
    pintrk: {
      name: 'Pinterest Tag',
      type: 'PINTEREST',
      extract: function (args) {
        // pintrk('track', 'checkout', {value: 10})
        var action = args[0];
        var eventName = args[1] || action;
        var params = args[2] || {};

        if (action === 'load') {
          return { _event_name: 'load', _tag_id: args[1] };
        }

        return {
          _event_name: eventName,
          _action: action,
          ...params
        };
      }
    },

    // Reddit
    rdt: {
      name: 'Reddit Pixel',
      type: 'REDDIT',
      extract: function (args) {
        // rdt('track', 'Purchase', {value: 10})
        var action = args[0];
        var eventName = args[1] || action;
        var params = args[2] || {};

        if (action === 'init') {
          return { _event_name: 'init', _pixel_id: args[1] };
        }

        return {
          _event_name: eventName,
          _action: action,
          ...params
        };
      }
    },

    // LinkedIn
    lintrk: {
      name: 'LinkedIn Insight',
      type: 'LINKEDIN',
      extract: function (args) {
        // lintrk('track', {conversion_id: 123})
        var action = args[0];
        var params = args[1] || {};

        return {
          _event_name: action,
          _conversion_id: params.conversion_id,
          ...params
        };
      }
    },

    // ============================================
    // ADDITIONAL GLOBAL SDKS
    // ============================================

    // Outbrain
    obApi: {
      name: 'Outbrain',
      type: 'OUTBRAIN',
      extract: function (args) {
        var action = args[0];
        var eventName = args[1] || action;
        return { _event_name: eventName, _action: action };
      }
    },

    // Criteo
    criteo_q: {
      name: 'Criteo',
      type: 'CRITEO',
      isArray: true,
      extract: function (args) {
        var data = args[0];
        if (typeof data === 'object') {
          return {
            _event_name: data.event || 'criteo_event',
            ...data
          };
        }
        return { _event_name: 'criteo_push' };
      }
    },

    // Quora Pixel
    qp: {
      name: 'Quora Pixel',
      type: 'QUORA',
      extract: function (args) {
        var action = args[0];
        var eventName = args[1] || action;
        var params = args[2] || {};
        return { _event_name: eventName, _action: action, ...params };
      }
    },

    // Microsoft UET (Bing Ads)
    uetq: {
      name: 'Microsoft UET',
      type: 'MICROSOFT_UET',
      isArray: true,
      extract: function (args) {
        var data = args[0];
        var params = args[1];

        // uetq.push('event', 'purchase', {revenue_value: 100})
        if (typeof data === 'string') {
          var eventName = data;
          var eventParams = params || {};
          if (data === 'event' && typeof params === 'string') {
            eventName = params;
            eventParams = args[2] || {};
          }
          return {
            _event_name: eventName,
            _tag_id: eventParams.ti,
            _pixel_id: eventParams.ti,
            _revenue: eventParams.revenue_value || eventParams.gv,
            _currency: eventParams.currency,
            ...eventParams
          };
        }

        // uetq.push({ea: 'purchase', ec: 'ecommerce', ...})
        if (typeof data === 'object') {
          return {
            _event_name: data.ea || data.ec || data.event || 'uet_event',
            _action: data.ea,
            _category: data.ec,
            _label: data.el,
            _value: data.ev,
            _tag_id: data.ti,
            _pixel_id: data.ti,
            _revenue: data.gv || data.revenue_value,
            ...data
          };
        }
        return { _event_name: 'uet_push' };
      }
    },

    // Google gtag (alternative to dataLayer)
    gtag: {
      name: 'Google Tag',
      type: 'GTAG',
      extract: function (args) {
        // gtag('event', 'purchase', {transaction_id: 'T_12345'})
        var action = args[0];
        var eventName = args[1] || action;
        var params = args[2] || {};
        return { _event_name: eventName, _action: action, ...params };
      }
    },

    // Klaviyo
    _learnq: {
      name: 'Klaviyo',
      type: 'KLAVIYO',
      isArray: true,
      extract: function (args) {
        var data = args[0];
        if (Array.isArray(data)) {
          return { _event_name: data[0] || 'klaviyo_event', _data: data[1] };
        }
        return { _event_name: 'klaviyo_push' };
      }
    },

    // HubSpot
    _hsq: {
      name: 'HubSpot',
      type: 'HUBSPOT',
      isArray: true,
      extract: function (args) {
        var data = args[0];
        if (Array.isArray(data)) {
          return { _event_name: data[0] || 'hubspot_event', _data: data[1] };
        }
        return { _event_name: 'hubspot_push' };
      }
    },

    // Intercom
    Intercom: {
      name: 'Intercom',
      type: 'INTERCOM',
      extract: function (args) {
        var action = args[0];
        var params = args[1] || {};
        return { _event_name: action, ...params };
      }
    },

    // Drift
    drift: {
      name: 'Drift',
      type: 'DRIFT',
      methods: ['track', 'identify', 'page'],
      extract: function (method, args) {
        return { _event_name: args[0] || method, _method: method };
      }
    },

    // Amplitude
    amplitude: {
      name: 'Amplitude',
      type: 'AMPLITUDE',
      methods: ['track', 'logEvent', 'identify'],
      extract: function (method, args) {
        return { _event_name: args[0] || method, _method: method, _data: args[1] };
      }
    },

    // Mixpanel
    mixpanel: {
      name: 'Mixpanel',
      type: 'MIXPANEL',
      methods: ['track', 'identify', 'people.set'],
      extract: function (method, args) {
        return { _event_name: args[0] || method, _method: method, _data: args[1] };
      }
    },

    // Segment Analytics.js
    analytics: {
      name: 'Segment',
      type: 'SEGMENT',
      methods: ['track', 'identify', 'page', 'group'],
      extract: function (method, args) {
        return { _event_name: args[0] || method, _method: method, _data: args[1] };
      }
    },

    // Heap
    heap: {
      name: 'Heap',
      type: 'HEAP',
      methods: ['track', 'identify', 'addUserProperties'],
      extract: function (method, args) {
        return { _event_name: args[0] || method, _method: method, _data: args[1] };
      }
    },

    // PostHog
    posthog: {
      name: 'PostHog',
      type: 'POSTHOG',
      methods: ['capture', 'identify'],
      extract: function (method, args) {
        return { _event_name: args[0] || method, _method: method, _data: args[1] };
      }
    },

    // ============================================
    // CHINA SDKs
    // ============================================

    // Baidu Analytics
    _hmt: {
      name: 'Baidu Analytics',
      type: 'BAIDU_ANALYTICS',
      isArray: true,
      extract: function (args) {
        var data = args[0];
        if (Array.isArray(data)) {
          return { _event_name: data[0] || 'baidu_event', _category: data[1], _action: data[2] };
        }
        return { _event_name: 'baidu_push' };
      }
    },

    // ByteDance/Ocean Engine (Douyin)
    _byteq: {
      name: 'ByteDance',
      type: 'BYTEDANCE',
      isArray: true,
      extract: function (args) {
        var data = args[0];
        if (typeof data === 'object') {
          return { _event_name: data.event || 'bytedance_event', ...data };
        }
        return { _event_name: 'bytedance_push' };
      }
    },

    // ============================================
    // RUSSIA SDKs
    // ============================================

    // Yandex Metrica
    ym: {
      name: 'Yandex Metrica',
      type: 'YANDEX_METRICA',
      extract: function (args) {
        // ym(COUNTER_ID, 'reachGoal', 'TARGET_NAME')
        var counterId = args[0];
        var method = args[1];
        var target = args[2];
        return {
          _event_name: target || method || 'yandex_event',
          _counter_id: counterId,
          _method: method
        };
      }
    },

    // VK Pixel
    VK: {
      name: 'VK Pixel',
      type: 'VK',
      methods: ['Goal', 'Retarget'],
      extract: function (method, args) {
        return { _event_name: method, _data: args[0] };
      }
    },

    // ============================================
    // JAPAN SDKs
    // ============================================

    // Yahoo Japan
    ytag: {
      name: 'Yahoo Japan',
      type: 'YAHOO_JAPAN',
      extract: function (args) {
        return { _event_name: args[0] || 'yahoo_event', _data: args[1] };
      }
    },

    // LINE Tag
    _lt: {
      name: 'LINE',
      type: 'LINE',
      isArray: true,
      extract: function (args) {
        var data = args[0];
        if (Array.isArray(data)) {
          return { _event_name: data[0] || 'line_event' };
        }
        return { _event_name: 'line_push' };
      }
    },

    // ============================================
    // KOREA SDKs
    // ============================================

    // Naver
    wcs: {
      name: 'Naver',
      type: 'NAVER',
      methods: ['event'],
      extract: function (method, args) {
        return { _event_name: args[0] || 'naver_event', _method: method };
      }
    },

    // Kakao Pixel
    kakaoPixel: {
      name: 'Kakao',
      type: 'KAKAO',
      extract: function (args) {
        return { _event_name: args[0] || 'kakao_event' };
      }
    },

    // ============================================
    // ADDITIONAL GLOBAL SDKs
    // ============================================

    // MediaAlpha (Auto/Lead/Marketplace)
    MediaAlpha: {
      name: 'MediaAlpha',
      type: 'MEDIAALPHA',
      isArray: true,
      extract: function (args) {
        var data = args[0];
        if (typeof data === 'object') {
          return {
            _event_name: data.type || 'mediaalpha_event',
            _placement_id: data.placement_id,
            _vertical: data.vertical,
            _lead_id: data.lead_id,
            _value: data.value,
            ...data
          };
        }
        return { _event_name: 'mediaalpha_push' };
      }
    },


    // Braze (Appboy)
    appboy: {
      name: 'Braze',
      type: 'BRAZE',
      methods: ['logCustomEvent', 'logPurchase', 'changeUser'],
      extract: function (method, args) {
        return { _event_name: args[0] || method, _method: method, _data: args[1] };
      }
    },

    // Customer.io
    _cio: {
      name: 'Customer.io',
      type: 'CUSTOMERIO',
      isArray: true,
      extract: function (args) {
        var data = args[0];
        if (Array.isArray(data)) {
          return { _event_name: data[0] || 'customerio_event', _data: data[1] };
        }
        return { _event_name: 'customerio_push' };
      }
    },

    // Iterable
    _iaq: {
      name: 'Iterable',
      type: 'ITERABLE',
      isArray: true,
      extract: function (args) {
        var data = args[0];
        if (Array.isArray(data)) {
          return { _event_name: data[0] || 'iterable_event', _data: data[1] };
        }
        return { _event_name: 'iterable_push' };
      }
    },

    // CleverTap
    clevertap: {
      name: 'CleverTap',
      type: 'CLEVERTAP',
      methods: ['event', 'profile', 'onUserLogin'],
      extract: function (method, args) {
        return { _event_name: args[0] || method, _method: method, _data: args[1] };
      }
    },

    // Insider
    Insider: {
      name: 'Insider',
      type: 'INSIDER',
      methods: ['track', 'identify', 'page'],
      extract: function (method, args) {
        return { _event_name: args[0] || method, _method: method, _data: args[1] };
      }
    },

    // OneSignal
    OneSignal: {
      name: 'OneSignal',
      type: 'ONESIGNAL',
      methods: ['push', 'sendTag', 'sendTags'],
      extract: function (method, args) {
        return { _event_name: method, _data: args[0] };
      }
    },

    // WebEngage
    webengage: {
      name: 'WebEngage',
      type: 'WEBENGAGE',
      methods: ['track', 'user', 'screen'],
      extract: function (method, args) {
        return { _event_name: args[0] || method, _method: method, _data: args[1] };
      }
    },

    // Tealium
    utag: {
      name: 'Tealium',
      type: 'TEALIUM',
      methods: ['track', 'link', 'view'],
      extract: function (method, args) {
        return { _event_name: method, _data: args[0] };
      }
    },

    // mParticle
    mParticle: {
      name: 'mParticle',
      type: 'MPARTICLE',
      methods: ['logEvent', 'logPageView', 'Identity.login'],
      extract: function (method, args) {
        return { _event_name: args[0] || method, _method: method, _data: args[1] };
      }
    },

    // Optimizely
    optimizely: {
      name: 'Optimizely',
      type: 'OPTIMIZELY',
      methods: ['push'],
      extract: function (method, args) {
        var data = args[0];
        if (data && data.type) {
          return { _event_name: data.type, _data: data };
        }
        return { _event_name: 'optimizely_event' };
      }
    },

    // VWO
    _vis_opt_queue: {
      name: 'VWO',
      type: 'VWO',
      isArray: true,
      extract: function (args) {
        return { _event_name: 'vwo_event', _data: args[0] };
      }
    },

    // Hotjar
    hj: {
      name: 'Hotjar',
      type: 'HOTJAR',
      extract: function (args) {
        var action = args[0];
        var eventName = args[1] || action;
        return { _event_name: eventName, _action: action };
      }
    },

    // FullStory
    FS: {
      name: 'FullStory',
      type: 'FULLSTORY',
      methods: ['event', 'identify', 'setUserVars'],
      extract: function (method, args) {
        return { _event_name: args[0] || method, _method: method, _data: args[1] };
      }
    },

    // LogRocket
    LogRocket: {
      name: 'LogRocket',
      type: 'LOGROCKET',
      methods: ['track', 'identify'],
      extract: function (method, args) {
        return { _event_name: args[0] || method, _method: method, _data: args[1] };
      }
    },

    // Clarity
    clarity: {
      name: 'Microsoft Clarity',
      type: 'CLARITY',
      extract: function (args) {
        var action = args[0];
        var eventData = args[1];

        // Only capture specific meaningful Clarity calls
        // clarity('event', 'EventName') - custom events
        // clarity('set', 'key', 'value') - custom dimensions
        // clarity('identify', 'userId') - user identification
        // clarity('consent') - consent given

        if (action === 'event' && typeof eventData === 'string') {
          return { _event_name: eventData, _action: 'event' };
        }
        if (action === 'identify' && eventData) {
          return { _event_name: 'identify', _user_id: eventData };
        }
        if (action === 'consent') {
          return { _event_name: 'consent' };
        }
        if (action === 'set' && typeof eventData === 'string') {
          return { _event_name: 'set: ' + eventData, _action: 'set' };
        }

        // Skip all other internal Clarity calls (tracking data, configs, etc.)
        return null;
      }
    },

    // Attentive
    attentive: {
      name: 'Attentive',
      type: 'ATTENTIVE',
      methods: ['track', 'identify'],
      extract: function (method, args) {
        return { _event_name: args[0] || method, _method: method, _data: args[1] };
      }
    },

    // Drip
    _dcq: {
      name: 'Drip',
      type: 'DRIP',
      isArray: true,
      extract: function (args) {
        var data = args[0];
        if (Array.isArray(data)) {
          return { _event_name: data[0] || 'drip_event', _data: data[1] };
        }
        return { _event_name: 'drip_push' };
      }
    },

    // ActiveCampaign
    vgo: {
      name: 'ActiveCampaign',
      type: 'ACTIVECAMPAIGN',
      extract: function (args) {
        var action = args[0];
        return { _event_name: action, _data: args[1] };
      }
    },

    // Omnisend
    omnisend: {
      name: 'Omnisend',
      type: 'OMNISEND',
      methods: ['track', 'identify'],
      extract: function (method, args) {
        return { _event_name: args[0] || method, _method: method, _data: args[1] };
      }
    },

    // Yotpo
    yotpo: {
      name: 'Yotpo',
      type: 'YOTPO',
      methods: ['track', 'refreshWidgets'],
      extract: function (method, args) {
        return { _event_name: method, _data: args[0] };
      }
    },

    // Dynamic Yield
    DY: {
      name: 'Dynamic Yield',
      type: 'DYNAMICYIELD',
      methods: ['API', 'recommendationWidgetImpression'],
      extract: function (method, args) {
        return { _event_name: method, _data: args[0] };
      }
    },

    // Nosto
    nostojs: {
      name: 'Nosto',
      type: 'NOSTO',
      extract: function (args) {
        return { _event_name: 'nosto_event', _data: args[0] };
      }
    },

    // Branch
    branch: {
      name: 'Branch',
      type: 'BRANCH',
      methods: ['track', 'logEvent', 'setIdentity'],
      extract: function (method, args) {
        return { _event_name: args[0] || method, _method: method, _data: args[1] };
      }
    },

    // Singular
    singularSdk: {
      name: 'Singular',
      type: 'SINGULAR',
      methods: ['event', 'revenue'],
      extract: function (method, args) {
        return { _event_name: args[0] || method, _method: method, _data: args[1] };
      }
    },

    // Adjust
    Adjust: {
      name: 'Adjust',
      type: 'ADJUST',
      methods: ['trackEvent', 'addSessionCallbackParameter'],
      extract: function (method, args) {
        return { _event_name: method, _data: args[0] };
      }
    },

    // Qualtrics
    QSI: {
      name: 'Qualtrics',
      type: 'QUALTRICS',
      methods: ['API'],
      extract: function (method, args) {
        return { _event_name: 'qualtrics_event', _data: args[0] };
      }
    },

    // Wistia
    _wq: {
      name: 'Wistia',
      type: 'WISTIA',
      isArray: true,
      extract: function (args) {
        return { _event_name: 'wistia_event', _data: args[0] };
      }
    },

    // Trustpilot
    tp: {
      name: 'Trustpilot',
      type: 'TRUSTPILOT',
      extract: function (args) {
        var action = args[0];
        return { _event_name: action, _data: args[1] };
      }
    }
  };

  /**
   * Send SDK event to content script
   */
  function sendSDKEvent(sdkName, sdkType, eventParams) {
    // Skip if extract returned null (internal SDK calls to ignore)
    if (!eventParams) return;
    if (!checkRateLimit()) return;

    var eventName = eventParams._event_name || sdkName + '_event';
    var clientId = '';
    var sessionId = '';

    // Create event key for aggregation
    var eventKey = sdkType + ':' + eventName + ':' + Date.now();

    window.postMessage({
      type: 'GTM_LIVE_NETWORK_REQUEST',
      source: SECURITY.MESSAGE_SOURCE,
      payload: {
        url: 'sdk://' + sdkName.toLowerCase().replace(/\s/g, '-'),
        tagType: sdkType,
        eventParams: sanitizeObject(eventParams),
        eventKey: eventKey,
        method: 'SDK',
        timestamp: new Date().toISOString(),
        isSDKCall: true,
        sdkName: sdkName
      }
    }, window.location.origin);

    debugLog('SDK captured:', sdkName, eventName, eventParams);
  }

  /**
   * Hook the push method on any object that has push (array or SDK object)
   * This is called SYNCHRONOUSLY to avoid missing events
   * 
   * Handles both:
   * - Plain arrays: _tfa = []; _tfa.push({...})
   * - SDK objects: Taboola SDK replaces _tfa with object that has push()
   */
  function hookPushMethod(obj, config) {
    if (!obj || obj.__gtm_live_hooked__) return;
    if (typeof obj.push !== 'function') return;

    var originalPush = obj.push;
    obj.push = function () {
      var args = Array.prototype.slice.call(arguments);

      debugLog('SDK push called:', config.name, 'args:', args.length, JSON.stringify(args).substring(0, 200));

      try {
        // Handle SDKs that can push multiple events at once
        if (config.extractMultiple && args.length > 0) {
          // Send each argument as a separate event
          for (var i = 0; i < args.length; i++) {
            try {
              var singleArg = [args[i]];
              var eventParams = config.extract(singleArg);
              // Only send if extract returned valid event (null = skip internal call)
              if (eventParams && eventParams._event_name) {
                debugLog('SDK event captured:', config.name, eventParams._event_name, 'pixelId:', eventParams._pixel_id);
                sendSDKEvent(config.name, config.type, eventParams);
              }
            } catch (innerE) {
              debugLog('SDK extract single error:', innerE.message);
            }
          }
        } else {
          // Standard single event extraction
          var eventParams = config.extract(args);
          // Only send if extract returned valid event
          if (eventParams && eventParams._event_name) {
            debugLog('SDK event captured:', config.name, eventParams._event_name);
            sendSDKEvent(config.name, config.type, eventParams);
          }
        }
      } catch (e) {
        debugLog('SDK extract error:', config.name, e.message);
      }
      return originalPush.apply(obj, arguments);
    };
    obj.__gtm_live_hooked__ = true;

    // Hook additional methods if SDK adds them (like _tfa.notify, _tfa.event)
    if (config.additionalMethods && config.extractMethod) {
      hookAdditionalMethods(obj, config);
    }

    debugLog('Hooked SDK push:', config.name, Array.isArray(obj) ? '(array)' : '(object)');
  }

  /**
   * Hook additional SDK methods beyond push
   * Some SDKs add methods like .notify(), .event(), .track() after loading
   */
  function hookAdditionalMethods(obj, config) {
    if (!config.additionalMethods || !config.extractMethod) return;

    config.additionalMethods.forEach(function (methodName) {
      // Check if method exists
      if (typeof obj[methodName] === 'function' && !obj[methodName].__gtm_live_hooked__) {
        var originalMethod = obj[methodName];
        obj[methodName] = function () {
          var args = Array.prototype.slice.call(arguments);
          debugLog('SDK method called:', config.name, methodName, args);
          try {
            var eventParams = config.extractMethod(methodName, args);
            sendSDKEvent(config.name, config.type, eventParams);
          } catch (e) {
            debugLog('SDK method extract error:', e.message);
          }
          return originalMethod.apply(obj, arguments);
        };
        obj[methodName].__gtm_live_hooked__ = true;
        debugLog('Hooked SDK method:', config.name, methodName);
      }
    });

    // Watch for methods being added later
    var methodsToWatch = config.additionalMethods.slice();
    var checkInterval = setInterval(function () {
      var hooked = 0;
      methodsToWatch.forEach(function (methodName) {
        if (typeof obj[methodName] === 'function' && !obj[methodName].__gtm_live_hooked__) {
          var originalMethod = obj[methodName];
          obj[methodName] = function () {
            var args = Array.prototype.slice.call(arguments);
            try {
              var eventParams = config.extractMethod(methodName, args);
              sendSDKEvent(config.name, config.type, eventParams);
            } catch (e) { }
            return originalMethod.apply(obj, arguments);
          };
          obj[methodName].__gtm_live_hooked__ = true;
          debugLog('Late-hooked SDK method:', config.name, methodName);
          hooked++;
        }
      });
      // Stop checking after all methods hooked or 10 seconds
    }, 1000);

    // Stop after 10 seconds
    setTimeout(function () { clearInterval(checkInterval); }, 10000);
  }

  /**
   * Hook into an SDK method
   * Uses defineProperty to watch for variable creation/replacement
   */
  function hookSDK(globalName, config) {
    // If SDK already exists, hook it directly BEFORE setting up watcher
    if (typeof window[globalName] !== 'undefined') {
      var existing = window[globalName];

      // Hook based on SDK type
      if (config.isArray && existing && typeof existing.push === 'function') {
        hookPushMethod(existing, config);
      } else if (config.methods && typeof existing === 'object') {
        hookMethodsSDK(globalName, config);
      } else if (typeof existing === 'function' && !existing.__gtm_live_hooked__) {
        // Wrap function-based SDK inline (BEFORE setting up property descriptor)
        var originalFn = existing;
        var wrappedFn = function () {
          var args = Array.prototype.slice.call(arguments);
          try {
            var eventParams = config.extract(args);
            sendSDKEvent(config.name, config.type, eventParams);
          } catch (e) { /* Silent fail */ }
          return originalFn.apply(this, arguments);
        };
        for (var prop in originalFn) {
          if (originalFn.hasOwnProperty(prop)) wrappedFn[prop] = originalFn[prop];
        }
        if (originalFn.queue) wrappedFn.queue = originalFn.queue;
        wrappedFn.__gtm_live_hooked__ = true;
        window[globalName] = wrappedFn;
        debugLog('Hooked existing SDK (function):', globalName);
        // Don't set up property descriptor for already-hooked function SDKs
        // as it can cause issues. The SDK is hooked and that's what matters.
        return;
      }
      // Don't return for array/method SDKs - also set up watcher in case SDK replaces it
    }

    // Set up watcher for future changes (SDK might replace the object)
    var descriptor = Object.getOwnPropertyDescriptor(window, globalName);

    // Only set up watcher if property is configurable
    if (!descriptor || descriptor.configurable) {
      var currentValue = window[globalName];

      try {
        Object.defineProperty(window, globalName, {
          configurable: true,
          enumerable: true,
          get: function () { return currentValue; },
          set: function (newValue) {
            debugLog('SDK variable changed:', globalName, typeof newValue);

            if (newValue) {
              // For array-based SDKs, hook push method SYNCHRONOUSLY
              if (config.isArray && typeof newValue.push === 'function') {
                currentValue = newValue;
                hookPushMethod(newValue, config);
              } else if (config.methods && typeof newValue === 'object') {
                // For method-based SDKs, hook SYNCHRONOUSLY
                currentValue = newValue;
                hookMethodsSDK(globalName, config);
              } else if (typeof newValue === 'function' && !newValue.__gtm_live_hooked__) {
                // For function-based SDKs (like ctrk), wrap INLINE to avoid recursion
                var originalFn = newValue;
                var wrappedFn = function () {
                  var args = Array.prototype.slice.call(arguments);
                  try {
                    var eventParams = config.extract(args);
                    sendSDKEvent(config.name, config.type, eventParams);
                  } catch (e) {
                    // Silent fail
                  }
                  return originalFn.apply(this, arguments);
                };
                // Copy properties from original
                for (var prop in originalFn) {
                  if (originalFn.hasOwnProperty(prop)) {
                    wrappedFn[prop] = originalFn[prop];
                  }
                }
                if (originalFn.queue) wrappedFn.queue = originalFn.queue;
                wrappedFn.__gtm_live_hooked__ = true;
                currentValue = wrappedFn;
                debugLog('Hooked SDK (function via setter):', globalName);
              } else {
                // Already hooked or not a function, just store it
                currentValue = newValue;
              }
            } else {
              currentValue = newValue;
            }
          }
        });
      } catch (e) {
        debugLog('Could not watch SDK:', globalName, e.message);
      }
    }
  }

  /**
   * Periodic check for SDKs that might bypass our watcher
   * Some SDKs use Object.defineProperty themselves or other tricks
   */
  function periodicSDKCheck() {
    Object.keys(SDK_CONFIG).forEach(function (globalName) {
      var config = SDK_CONFIG[globalName];
      if (!config.isArray) return; // Only check array-based SDKs

      var obj = window[globalName];
      if (obj && typeof obj.push === 'function' && !obj.__gtm_live_hooked__) {
        debugLog('Periodic check found unhook SDK:', globalName);
        hookPushMethod(obj, config);
      }
    });
  }

  // Run periodic check - more aggressive initially, then slower
  // This catches SDKs that load/replace after page load
  var checkCount = 0;

  // Fast checks for first 5 seconds (every 500ms)
  var fastInterval = setInterval(function () {
    periodicSDKCheck();
    checkCount++;
    if (checkCount >= 10) { // 10 * 500ms = 5 seconds
      clearInterval(fastInterval);
      debugLog('Fast SDK checks complete, switching to slow checks');
    }
  }, 500);

  // Slower checks for next 30 seconds (every 3s)
  setTimeout(function () {
    var slowCount = 0;
    var slowInterval = setInterval(function () {
      periodicSDKCheck();
      slowCount++;
      if (slowCount >= 10) { // 10 * 3s = 30 more seconds
        clearInterval(slowInterval);
        debugLog('Stopped periodic SDK checks');
      }
    }, 3000);
  }, 5000);

  // ==========================================
  // SPA (Single Page Application) SUPPORT
  // ==========================================
  // Detect page navigation in SPAs and re-check for SDKs

  var lastUrl = window.location.href;

  // Monitor for URL changes (SPAs use pushState/replaceState)
  function checkForUrlChange() {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      debugLog('SPA navigation detected:', lastUrl);

      // Re-run SDK checks after navigation (new SDKs might load)
      setTimeout(function () {
        periodicSDKCheck();
      }, 500);

      // Also notify content script of page change
      window.postMessage({
        type: 'GTM_LIVE_PAGE_CHANGE',
        source: SECURITY.MESSAGE_SOURCE,
        payload: {
          url: window.location.href,
          timestamp: new Date().toISOString()
        }
      }, window.location.origin);
    }
  }

  // Hook pushState and replaceState for SPA detection
  var originalPushState = history.pushState;
  var originalReplaceState = history.replaceState;

  history.pushState = function () {
    var result = originalPushState.apply(this, arguments);
    checkForUrlChange();
    return result;
  };

  history.replaceState = function () {
    var result = originalReplaceState.apply(this, arguments);
    checkForUrlChange();
    return result;
  };

  // Also listen for popstate (back/forward buttons)
  window.addEventListener('popstate', function () {
    setTimeout(checkForUrlChange, 0);
  });

  // ==========================================
  // CONSENT MANAGEMENT HANDLING
  // ==========================================
  // Many sites delay loading pixels until consent is given
  // Watch for common consent callbacks

  function setupConsentWatchers() {
    // OneTrust callback
    if (typeof window.OneTrust !== 'undefined' || typeof window.OptanonWrapper !== 'undefined') {
      var originalOptanonWrapper = window.OptanonWrapper;
      window.OptanonWrapper = function () {
        if (originalOptanonWrapper) originalOptanonWrapper.apply(this, arguments);
        debugLog('OneTrust consent callback - re-checking SDKs');
        setTimeout(periodicSDKCheck, 1000);
      };
    }

    // Watch for window consent events
    window.addEventListener('consent', function () {
      debugLog('Consent event detected - re-checking SDKs');
      setTimeout(periodicSDKCheck, 1000);
    });

    // Watch for GTM consent events via dataLayer
    var consentEvents = ['consent_update', 'consent.update', 'gtm.consent'];
    // This is handled by dataLayer interception
  }

  // Setup consent watchers after a short delay
  setTimeout(setupConsentWatchers, 1000);

  // ==========================================
  // DYNAMIC SCRIPT LOADING DETECTION
  // ==========================================
  // Detect when new scripts are added (SDKs loading late)

  var scriptObserver = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      mutation.addedNodes.forEach(function (node) {
        if (node.tagName === 'SCRIPT' && node.src) {
          // Check if this is a tracking script
          var src = node.src.toLowerCase();
          var trackingScripts = [
            'facebook', 'fbevents', 'tiktok', 'snapchat', 'twitter',
            'pinterest', 'linkedin', 'reddit', 'taboola', 'outbrain',
            'criteo', 'google-analytics', 'gtag', 'gtm', 'amplitude',
            'mixpanel', 'segment', 'heap', 'posthog', 'klaviyo',
            'hubspot', 'intercom', 'drift', 'baidu', 'yandex', 'vk',
            'yahoo', 'line', 'naver', 'kakao'
          ];

          if (trackingScripts.some(function (t) { return src.includes(t); })) {
            debugLog('Tracking script loaded:', src);
            // Re-check SDKs after script loads
            node.addEventListener('load', function () {
              setTimeout(periodicSDKCheck, 500);
            });
          }
        }
      });
    });
  });

  // Observe document for new scripts
  scriptObserver.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  // Legacy function name for compatibility
  var hookArrayPush = hookPushMethod;

  /**
   * Hook SDKs with sub-methods (ttq.track, ttq.identify, etc.)
   */
  function hookMethodsSDK(globalName, config) {
    var obj = window[globalName];
    if (!obj || typeof obj !== 'object') return;
    if (!config.methods) return;

    config.methods.forEach(function (methodName) {
      if (typeof obj[methodName] === 'function' && !obj[methodName].__gtm_live_hooked__) {
        var originalMethod = obj[methodName];
        obj[methodName] = function () {
          var args = Array.prototype.slice.call(arguments);
          try {
            var eventParams = config.extract(methodName, args);
            sendSDKEvent(config.name, config.type, eventParams);
          } catch (e) {
            // Silent fail
          }
          return originalMethod.apply(obj, arguments);
        };
        obj[methodName].__gtm_live_hooked__ = true;
      }
    });
    debugLog('Hooked SDK (methods):', globalName, config.methods);
  }

  /**
   * Initialize all SDK hooks
   */
  function initSDKHooks() {
    Object.keys(SDK_CONFIG).forEach(function (globalName) {
      try {
        var config = SDK_CONFIG[globalName];

        // Set up watcher first
        hookSDK(globalName, config);

        // For SDKs that already exist, hook them directly
        // BUT skip function-based SDKs here - they're handled in the setter
        // to avoid triggering the setter and causing recursion
        if (window[globalName]) {
          if (config.isArray) {
            hookPushMethod(window[globalName], config);
          } else if (config.methods) {
            hookMethodsSDK(globalName, config);
          }
          // NOTE: Function-based SDKs are hooked when hookSDK reads window[globalName]
          // and the existing value triggers immediate inline wrapping in hookSDK
        }
      } catch (e) {
        // Silent fail for individual SDKs
        debugLog('Failed to hook SDK:', globalName, e.message);
      }
    });
  }

  // Initialize SDK hooks
  initSDKHooks();

  // ==========================================
  // INITIALIZATION COMPLETE
  // ==========================================

  // Notify that interceptor is ready
  window.postMessage({
    type: 'GTM_LIVE_INTERCEPTOR_READY',
    payload: {
      timestamp: new Date().toISOString(),
      sdksMonitored: Object.keys(SDK_CONFIG)
    }
  }, window.location.origin);

  console.log('[GTM Container Analyzer - Tag+Pixel Debugger] Interceptor installed - capturing dataLayer + network + SDK calls');

})();

