/**
 * GTM Container Analyzer - Tag+Pixel Debugger | Constants
 * 
 * Centralized configuration for the extension.
 * Easy to update patterns and settings in one place.
 */

// ============================================
// 🔧 ENVIRONMENT CONFIGURATION
// ============================================
// Change this to switch between development and production:
//   - true  = Development mode (localhost:5173)
//   - false = Production mode (gtmcontaineranalyzer.com)
// ============================================
const DEV_MODE = true;

// URLs based on environment
const URLS = {
  development: {
    dashboard: 'http://localhost:5173',
    live: 'http://localhost:5173/live'
  },
  production: {
    dashboard: 'https://gtm-container-analyzer-mcp.onrender.com',
    live: 'https://gtm-container-analyzer-mcp.onrender.com/live'
  }
};

// Export the appropriate URLs based on DEV_MODE
export const ENV = DEV_MODE ? 'development' : 'production';
export const DASHBOARD_URL = URLS[ENV].dashboard;
export const DASHBOARD_LIVE_URL = URLS[ENV].live;
export const DASHBOARD_LIVE_PATH = '/live';

// Storage keys
export const STORAGE_KEYS = {
  CAPTURED_DATA: 'gtm_live_captured_data',
  DASHBOARD_DATA: 'gtm_live_dashboard_data',
  CAPTURE_ENABLED: 'gtm_live_capture_enabled',
  CAPTURE_HISTORY: 'gtm_live_capture_history',
  SETTINGS: 'gtm_live_settings',
  // Tab isolation mode
  TAB_ISOLATED_MODE: 'gtm_live_tab_isolated',
  TAB_SESSIONS: 'gtm_live_tab_sessions',  // Object keyed by tabId
};

// Tab session limits (for storage management)
export const TAB_SESSION_LIMITS = {
  MAX_EVENTS_PER_TAB: 1000,      // Max events per tab session
  MAX_REQUESTS_PER_TAB: 500,     // Max network requests per tab
  SESSION_EXPIRY_HOURS: 4,       // Auto-cleanup sessions older than this
  MAX_TOTAL_SESSIONS: 20,        // Max number of tab sessions to keep
};

// Tag type patterns for network request detection
// These patterns match common marketing/analytics tag endpoints
export const TAG_PATTERNS = {
  // Google
  GA4: {
    name: 'Google Analytics 4',
    patterns: [
      /google-analytics\.com\/g\/collect/,
      /analytics\.google\.com\/g\/collect/,
    ],
    icon: 'ga4',
  },
  GOOGLE_ADS: {
    name: 'Google Ads',
    patterns: [
      /googleads\.g\.doubleclick\.net/,
      /www\.googleadservices\.com\/pagead\/conversion/,
      /googleadservices\.com\/pagead/,
    ],
    icon: 'google-ads',
  },
  GTM: {
    name: 'Google Tag Manager',
    patterns: [
      /googletagmanager\.com\/gtm\.js/,
      /googletagmanager\.com\/gtag\/js/,
    ],
    icon: 'gtm',
  },

  // Meta
  META_PIXEL: {
    name: 'Meta Pixel (Facebook)',
    patterns: [
      /facebook\.com\/tr/,
      /connect\.facebook\.net/,
    ],
    icon: 'meta',
  },

  // TikTok
  TIKTOK: {
    name: 'TikTok Pixel',
    patterns: [
      /analytics\.tiktok\.com/,
      /tiktok\.com\/i18n\/pixel/,
    ],
    icon: 'tiktok',
  },

  // Snapchat
  SNAPCHAT: {
    name: 'Snapchat Pixel',
    patterns: [
      /tr\.snapchat\.com/,
      /sc-static\.net\/scevent/,
    ],
    icon: 'snapchat',
  },

  // LinkedIn
  LINKEDIN: {
    name: 'LinkedIn Insight Tag',
    patterns: [
      /px\.ads\.linkedin\.com/,
      /snap\.licdn\.com/,
    ],
    icon: 'linkedin',
  },

  // Twitter/X
  TWITTER: {
    name: 'Twitter/X Pixel',
    patterns: [
      /t\.co\/i\/adsct/,
      /analytics\.twitter\.com/,
    ],
    icon: 'twitter',
  },

  // Pinterest
  PINTEREST: {
    name: 'Pinterest Tag',
    patterns: [
      /ct\.pinterest\.com/,
    ],
    icon: 'pinterest',
  },

  // Microsoft
  MICROSOFT_UET: {
    name: 'Microsoft UET',
    patterns: [
      /bat\.bing\.com/,
      /bat\.r\.msn\.com/,
    ],
    icon: 'microsoft',
  },

  // Hotjar
  HOTJAR: {
    name: 'Hotjar',
    patterns: [
      /static\.hotjar\.com/,
      /vars\.hotjar\.com/,
    ],
    icon: 'hotjar',
  },

  // Clarity
  CLARITY: {
    name: 'Microsoft Clarity',
    patterns: [
      /clarity\.ms/,
    ],
    icon: 'clarity',
  },

  // Criteo
  CRITEO: {
    name: 'Criteo',
    patterns: [
      /static\.criteo\.net/,
      /dis\.criteo\.com/,
    ],
    icon: 'criteo',
  },

  // ============================================
  // Additional Tags
  // ============================================

  // Google Universal Analytics (Legacy)
  UNIVERSAL_ANALYTICS: {
    name: 'Universal Analytics (UA)',
    patterns: [
      /google-analytics\.com\/collect/,
      /google-analytics\.com\/r\/collect/,
      /analytics\.google\.com\/collect/,
    ],
    icon: 'ua',
  },

  // Google Floodlight (DoubleClick)
  FLOODLIGHT: {
    name: 'Floodlight (DoubleClick)',
    patterns: [
      /fls\.doubleclick\.net/,
      /ad\.doubleclick\.net\/ddm/,
      /googleads\.g\.doubleclick\.net\/pagead\/viewthroughconversion/,
    ],
    icon: 'floodlight',
  },

  // Reddit Ads
  REDDIT: {
    name: 'Reddit Pixel',
    patterns: [
      /redditmedia\.com\/pixel/,
      /alb\.reddit\.com\/rp/,
      /events\.reddit\.com/,
    ],
    icon: 'reddit',
  },

  // Quora Ads
  QUORA: {
    name: 'Quora Pixel',
    patterns: [
      /q\.quora\.com\/_\/ad/,
      /quora\.com\/qpixel/,
    ],
    icon: 'quora',
  },

  // Outbrain
  OUTBRAIN: {
    name: 'Outbrain Pixel',
    patterns: [
      /outbrain\.com\/b\/track/,
      /amplify\.outbrain\.com/,
      /tr\.outbrain\.com/,
    ],
    icon: 'outbrain',
  },

  // Taboola
  TABOOLA: {
    name: 'Taboola Pixel',
    patterns: [
      /trc\.taboola\.com/,
      /cdn\.taboola\.com/,
      /taboola\.com\/livetrc/,
    ],
    icon: 'taboola',
  },

  // AB Tasty
  ABTASTY: {
    name: 'AB Tasty',
    patterns: [
      /try\.abtasty\.com/,
      /abtasty\.com\/tag/,
    ],
    icon: 'abtasty',
  },

  // Amplitude
  AMPLITUDE: {
    name: 'Amplitude',
    patterns: [
      /api\.amplitude\.com/,
      /api2\.amplitude\.com/,
      /cdn\.amplitude\.com/,
    ],
    icon: 'amplitude',
  },

  // Mixpanel
  MIXPANEL: {
    name: 'Mixpanel',
    patterns: [
      /api\.mixpanel\.com/,
      /api-js\.mixpanel\.com/,
      /cdn\.mxpnl\.com/,
    ],
    icon: 'mixpanel',
  },

  // AppsFlyer
  APPSFLYER: {
    name: 'AppsFlyer',
    patterns: [
      /appsflyer\.com\/api/,
      /onelink\.appsflyer\.com/,
      /impressions\.appsflyer\.com/,
    ],
    icon: 'appsflyer',
  },

  // Plausible Analytics
  PLAUSIBLE: {
    name: 'Plausible Analytics',
    patterns: [
      /plausible\.io\/api/,
      /plausible\.io\/js/,
    ],
    icon: 'plausible',
  },

  // Umami Analytics
  UMAMI: {
    name: 'Umami Analytics',
    patterns: [
      /umami\.is\/api/,
      /analytics\.umami\.is/,
      /\/api\/send/,  // Self-hosted Umami
    ],
    icon: 'umami',
  },

  // Segment
  SEGMENT: {
    name: 'Segment',
    patterns: [
      /api\.segment\.io/,
      /cdn\.segment\.com/,
      /api\.segment\.com/,
    ],
    icon: 'segment',
  },

  // Heap Analytics
  HEAP: {
    name: 'Heap Analytics',
    patterns: [
      /heapanalytics\.com/,
      /heap\.io/,
    ],
    icon: 'heap',
  },

  // FullStory
  FULLSTORY: {
    name: 'FullStory',
    patterns: [
      /fullstory\.com\/s\/fs/,
      /rs\.fullstory\.com/,
    ],
    icon: 'fullstory',
  },

  // Intercom
  INTERCOM: {
    name: 'Intercom',
    patterns: [
      /api-iam\.intercom\.io/,
      /widget\.intercom\.io/,
      /intercom\.io\/messenger/,
    ],
    icon: 'intercom',
  },

  // Hubspot
  HUBSPOT: {
    name: 'HubSpot',
    patterns: [
      /js\.hs-scripts\.com/,
      /track\.hubspot\.com/,
      /forms\.hubspot\.com/,
    ],
    icon: 'hubspot',
  },

  // Klaviyo
  KLAVIYO: {
    name: 'Klaviyo',
    patterns: [
      /static\.klaviyo\.com/,
      /a\.klaviyo\.com/,
    ],
    icon: 'klaviyo',
  },

  // Optimizely
  OPTIMIZELY: {
    name: 'Optimizely',
    patterns: [
      /cdn\.optimizely\.com/,
      /logx\.optimizely\.com/,
    ],
    icon: 'optimizely',
  },

  // VWO (Visual Website Optimizer)
  VWO: {
    name: 'VWO',
    patterns: [
      /dev\.visualwebsiteoptimizer\.com/,
      /vwo\.com\/j/,
    ],
    icon: 'vwo',
  },

  // Crazy Egg
  CRAZYEGG: {
    name: 'Crazy Egg',
    patterns: [
      /script\.crazyegg\.com/,
      /cetrk\.crazyegg\.com/,
    ],
    icon: 'crazyegg',
  },

  // Lucky Orange
  LUCKYORANGE: {
    name: 'Lucky Orange',
    patterns: [
      /luckyorange\.com/,
      /cdn\.luckyorange\.com/,
    ],
    icon: 'luckyorange',
  },

  // Matomo (Piwik)
  MATOMO: {
    name: 'Matomo',
    patterns: [
      /matomo\.php/,
      /piwik\.php/,
      /matomo\.js/,
    ],
    icon: 'matomo',
  },

  // Posthog
  POSTHOG: {
    name: 'PostHog',
    patterns: [
      /app\.posthog\.com/,
      /posthog\.com\/static/,
    ],
    icon: 'posthog',
  },

  // Sentry
  SENTRY: {
    name: 'Sentry',
    patterns: [
      /sentry\.io\/api/,
      /browser\.sentry-cdn\.com/,
    ],
    icon: 'sentry',
  },

  // LogRocket
  LOGROCKET: {
    name: 'LogRocket',
    patterns: [
      /cdn\.logrocket\.io/,
      /r\.logrocket\.io/,
    ],
    icon: 'logrocket',
  },

  // Drift
  DRIFT: {
    name: 'Drift',
    patterns: [
      /js\.driftt\.com/,
      /event\.drift\.com/,
    ],
    icon: 'drift',
  },

  // Zendesk
  ZENDESK: {
    name: 'Zendesk',
    patterns: [
      /static\.zdassets\.com/,
      /zendesk\.com\/embeddable/,
    ],
    icon: 'zendesk',
  },

  // Freshchat/Freshdesk
  FRESHWORKS: {
    name: 'Freshworks',
    patterns: [
      /wchat\.freshchat\.com/,
      /assets\.freshdesk\.com/,
    ],
    icon: 'freshworks',
  },

  // Tawk.to
  TAWKTO: {
    name: 'Tawk.to',
    patterns: [
      /embed\.tawk\.to/,
      /va\.tawk\.to/,
    ],
    icon: 'tawkto',
  },

  // Crisp
  CRISP: {
    name: 'Crisp Chat',
    patterns: [
      /client\.crisp\.chat/,
      /client\.relay\.crisp\.chat/,
    ],
    icon: 'crisp',
  },

  // Salesforce/Pardot
  PARDOT: {
    name: 'Pardot (Salesforce)',
    patterns: [
      /pi\.pardot\.com/,
      /pardot\.com\/pd/,
      /go\.pardot\.com/,
    ],
    icon: 'pardot',
  },

  // Marketo
  MARKETO: {
    name: 'Marketo',
    patterns: [
      /munchkin\.marketo\.net/,
      /marketo\.com\/munchkin/,
    ],
    icon: 'marketo',
  },

  // Adobe Analytics
  ADOBE_ANALYTICS: {
    name: 'Adobe Analytics',
    patterns: [
      /omtrdc\.net/,
      /sc\.omtrdc\.net/,
      /2o7\.net/,
    ],
    icon: 'adobe',
  },

  // Adobe Target
  ADOBE_TARGET: {
    name: 'Adobe Target',
    patterns: [
      /tt\.omtrdc\.net/,
      /mbox\.net/,
    ],
    icon: 'adobe-target',
  },

  // Shopify Analytics
  SHOPIFY: {
    name: 'Shopify Analytics',
    patterns: [
      /monorail-edge\.shopifysvc\.com/,
      /shopify\.com\/s\/js/,
    ],
    icon: 'shopify',
  },

  // Adroll
  ADROLL: {
    name: 'AdRoll',
    patterns: [
      /d\.adroll\.com/,
      /s\.adroll\.com/,
    ],
    icon: 'adroll',
  },

  // Yahoo/Verizon Pixel
  YAHOO: {
    name: 'Yahoo/Verizon Pixel',
    patterns: [
      /sp\.analytics\.yahoo\.com/,
      /pixel\.advertising\.com/,
    ],
    icon: 'yahoo',
  },

  // TradeDoubler
  TRADEDOUBLER: {
    name: 'TradeDoubler',
    patterns: [
      /tbs\.tradedoubler\.com/,
      /tradedoubler\.com\/pixel/,
    ],
    icon: 'tradedoubler',
  },

  // Impact (formerly Impact Radius)
  IMPACT: {
    name: 'Impact',
    patterns: [
      /d\.impactradius-event\.com/,
      /api\.impact\.com/,
    ],
    icon: 'impact',
  },

  // Commission Junction (CJ)
  CJ: {
    name: 'Commission Junction',
    patterns: [
      /www\.emjcd\.com/,
      /tags\.cj\.com/,
    ],
    icon: 'cj',
  },

  // Rakuten Advertising
  RAKUTEN: {
    name: 'Rakuten Advertising',
    patterns: [
      /click\.linksynergy\.com/,
      /track\.linksynergy\.com/,
    ],
    icon: 'rakuten',
  },

  // ShareASale
  SHAREASALE: {
    name: 'ShareASale',
    patterns: [
      /shareasale\.com\/pixel/,
      /shareasale-analytics\.com/,
    ],
    icon: 'shareasale',
  },

  // Awin
  AWIN: {
    name: 'Awin',
    patterns: [
      /dwin1\.com/,
      /awin1\.com/,
    ],
    icon: 'awin',
  },
};

// DataLayer event types to capture
export const DATALAYER_EVENTS = {
  PAGE_VIEW: ['page_view', 'pageview', 'gtm.js', 'gtm.dom', 'gtm.load'],
  ECOMMERCE: ['purchase', 'add_to_cart', 'remove_from_cart', 'begin_checkout', 'view_item', 'view_item_list', 'select_item', 'add_payment_info', 'add_shipping_info'],
  USER: ['login', 'sign_up', 'user_engagement'],
  CUSTOM: [], // Will capture any event not in above categories
};

// Maximum items to store in history
export const MAX_HISTORY_ITEMS = 100;

// Maximum captured requests per page
export const MAX_REQUESTS_PER_PAGE = 500;

