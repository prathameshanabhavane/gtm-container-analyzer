/**
 * @gtm-analyzer/core — GTM Type Constant Maps
 *
 * Typed lookup records mapping GTM internal type keys to human-readable labels.
 * These are compiled from the official GTM developer documentation and
 * community template registry.
 *
 * All maps use `Record<string, string>` so they can be merged with
 * dynamically built template maps from container exports (safeJSONMerge-safe).
 */

// ─── Tag Type Map ─────────────────────────────────────────────────────────────

/**
 * Maps GTM internal tag type identifiers to human-readable display names.
 * Covers all built-in tag types as of GTM API v2.
 */
export const BASE_TAG_TYPE_MAP: Record<string, string> = {
  // Google Analytics
  ua: 'Google Analytics: Universal Analytics',
  ua_event: 'Google Analytics: UA Event',
  awct: 'Google Ads: Conversion Tracking',
  sp: 'Google Ads: Remarketing',
  gclidw: 'Google Ads: Conversion Linker',
  gaawc: 'Google Analytics: GA4 Configuration',
  gaawe: 'Google Analytics: GA4 Event',

  // Meta / Facebook
  html: 'Custom HTML',
  img: 'Custom Image',

  // Other 3rd party common types
  flc: 'Floodlight Counter',
  fls: 'Floodlight Sales',
  bsa: 'AdSense (deprecated)',

  // Consent
  googtag: 'Google tag (gtag.js)',
  bb: 'Bing UET (deprecated)',

  // Utility
  c: 'Constant',
  d: 'Data Layer Variable',
  v: 'Variable',
  smm: 'Lookup Table',
  r: 'RegEx Table',

  // Zones
  zone: 'Zone Tag',
};

// ─── Trigger Type Map ─────────────────────────────────────────────────────────

/**
 * Maps GTM internal trigger type identifiers to human-readable labels.
 */
export const TRIGGER_TYPE_MAP: Record<string, string> = {
  pageview: 'Page View',
  domReady: 'DOM Ready',
  windowLoaded: 'Window Loaded',
  click: 'All Element Clicks',
  linkClick: 'Just Links',
  elementVisibility: 'Element Visibility',
  formSubmission: 'Form Submission',
  historyChange: 'History Change',
  jsError: 'JavaScript Error',
  scrollDepth: 'Scroll Depth',
  timer: 'Timer',
  youTubeVideo: 'YouTube Video',
  customEvent: 'Custom Event',
  firebaseEvent: 'Firebase / App Event',
  consentInit: 'Consent Initialization',
  init: 'Initialization',
  always: 'All Pages (Always)',
  // Catch-all
  other: 'Other',
};

// ─── Variable Type Map ────────────────────────────────────────────────────────

/**
 * Maps GTM internal variable type identifiers to human-readable labels.
 */
export const VARIABLE_TYPE_MAP: Record<string, string> = {
  // Data Sources
  v: 'Data Layer Variable',
  jsm: 'Custom JavaScript',
  c: 'Constant',
  e: 'DOM Element',
  k: 'First-Party Cookie',
  f: 'HTTP Referrer',
  j: 'JavaScript Variable',
  u: 'URL',

  // Lookups
  smm: 'Lookup Table',
  r: 'RegEx Table',
  gas: 'Google Analytics Settings (deprecated)',

  // Auto-Event
  aev: 'Auto-Event Variable',

  // Utilities
  vis: 'Element Visibility',
  dbg: 'Debug Mode',
  cl: 'Container Version',

  // Linked Variable
  ctv: 'Container Version Number',
};

// ─── Condition Type Map ───────────────────────────────────────────────────────

/**
 * Maps GTM condition type codes to human-readable operator labels.
 */
export const CONDITION_TYPE_MAP: Record<string, string> = {
  contains: 'contains',
  css_selector: 'matches CSS selector',
  ends_with: 'ends with',
  equals: 'equals',
  greater: 'greater than',
  greater_or_equals: 'greater than or equal to',
  less: 'less than',
  less_or_equals: 'less than or equal to',
  match_regex: 'matches RegEx',
  starts_with: 'starts with',
  unique_match_regex: 'matches RegEx (ignore case)',
};

// ─── GA4 Reserved Event Names ─────────────────────────────────────────────────

/**
 * GA4 automatically collects these events. Using them as custom event names
 * causes conflicts and data processing issues.
 * Source: https://support.google.com/analytics/answer/9267738
 */
export const GA4_RESERVED_EVENT_NAMES: readonly string[] = [
  'ad_click',
  'ad_exposure',
  'ad_impression',
  'ad_query',
  'ad_reward',
  'adunit_exposure',
  'app_clear_data',
  'app_exception',
  'app_install',
  'app_remove',
  'app_store_refund',
  'app_store_subscription_cancel',
  'app_store_subscription_convert',
  'app_store_subscription_renew',
  'app_update',
  'click',
  'dynamic_link_app_open',
  'dynamic_link_app_update',
  'dynamic_link_first_open',
  'error',
  'file_download',
  'firebase_campaign',
  'firebase_in_app_message_action',
  'firebase_in_app_message_dismiss',
  'firebase_in_app_message_impression',
  'first_open',
  'first_visit',
  'form_start',
  'form_submit',
  'in_app_purchase',
  'notification_dismiss',
  'notification_foreground',
  'notification_open',
  'notification_receive',
  'os_update',
  'page_view',
  'screen_view',
  'scroll',
  'search',
  'session_start',
  'tutorial_begin',
  'tutorial_complete',
  'user_engagement',
  'video_complete',
  'video_progress',
  'video_start',
  'view_search_results',
];

// ─── GA4 Recommended Events ───────────────────────────────────────────────────

/**
 * Google-recommended event names for specific business verticals.
 * Using these enables enhanced reporting in GA4.
 * Source: https://support.google.com/analytics/answer/9267735
 */
export const GA4_RECOMMENDED_EVENTS: Record<string, readonly string[]> = {
  ecommerce: [
    'view_item_list',
    'select_item',
    'view_item',
    'add_to_cart',
    'remove_from_cart',
    'view_cart',
    'begin_checkout',
    'add_shipping_info',
    'add_payment_info',
    'purchase',
    'refund',
    'add_to_wishlist',
    'view_promotion',
    'select_promotion',
  ],
  lead_generation: [
    'generate_lead',
    'qualify_lead',
    'sign_up',
    'login',
    'share',
    'search',
  ],
  gaming: [
    'level_start',
    'level_end',
    'level_up',
    'post_score',
    'unlock_achievement',
    'virtual_currency_balance_updated',
    'earn_virtual_currency',
    'spend_virtual_currency',
    'tutorial_begin',
    'tutorial_complete',
  ],
  engagement: [
    'select_content',
    'view_item',
  ],
};

// ─── Custom Template Replacement Mapping ────────────────────────────────────

/**
 * Maps Custom HTML tag script domain signatures to their recommended
 * sandboxed GTM Community Template equivalents.
 * Source: governance-best-practices.md §4.1
 */
export const CUSTOM_HTML_TEMPLATE_RECOMMENDATIONS: Array<{
  detectPattern: RegExp;
  platformName: string;
  recommendedTemplate: string;
  templateOwner: string;
}> = [
  {
    detectPattern: /connect\.facebook\.net|fbevents\.js/i,
    platformName: 'Meta Pixel / Facebook',
    recommendedTemplate: 'Meta Pixel',
    templateOwner: 'facebookarchive',
  },
  {
    detectPattern: /static\.hotjar\.com/i,
    platformName: 'Hotjar',
    recommendedTemplate: 'Hotjar Tracking Code',
    templateOwner: 'hotjar',
  },
  {
    detectPattern: /c\.clarity\.ms/i,
    platformName: 'Microsoft Clarity',
    recommendedTemplate: 'Microsoft Clarity',
    templateOwner: 'Microsoft',
  },
  {
    detectPattern: /assets\.pinterest\.com/i,
    platformName: 'Pinterest',
    recommendedTemplate: 'Pinterest Tag',
    templateOwner: 'pinterest',
  },
  {
    detectPattern: /analytics\.tiktok\.com/i,
    platformName: 'TikTok',
    recommendedTemplate: 'TikTok Pixel',
    templateOwner: 'TikTok',
  },
  {
    detectPattern: /snap\.licdn\.com|linkedin\.com\/px/i,
    platformName: 'LinkedIn Insight',
    recommendedTemplate: 'LinkedIn Insight Tag',
    templateOwner: 'linkedin',
  },
];

// ─── Container Size Thresholds ────────────────────────────────────────────────

/** GTM's hard compile size limit in bytes (200KB) */
export const GTM_CONTAINER_SIZE_LIMIT_BYTES = 200 * 1024;

/** Warning threshold (80% of limit) — governance-best-practices.md §3.3 */
export const GTM_CONTAINER_SIZE_WARNING_BYTES = GTM_CONTAINER_SIZE_LIMIT_BYTES * 0.8;

/** Critical threshold (95% of limit) — governance-best-practices.md §3.3 */
export const GTM_CONTAINER_SIZE_CRITICAL_BYTES = GTM_CONTAINER_SIZE_LIMIT_BYTES * 0.95;
