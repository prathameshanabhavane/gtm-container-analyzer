/**
 * GTM Data Constants
 * Static type mappings for tags, triggers, and conditions
 */

// ============================================
// TAG TYPE MAPPINGS
// ============================================

/**
 * Base tag type mappings (built-in GTM native tags only)
 * Community templates are detected dynamically from metadata
 */
export const BASE_TAG_TYPE_MAP = {
  // Google native tags
  'googtag': 'Google Tag',
  'html': 'Custom HTML',
  'gaawe': 'Google Analytics: GA4 Event',
  'gaawc': 'Google Analytics: GA4 Configuration',
  'awct': 'Google Ads Conversion Tracking',
  'awrm': 'Google Ads Remarketing',
  'gclidw': 'Conversion Linker',
  'awud': 'Google Ads User Data Event',
  'flc': 'Floodlight Counter',
  'fls': 'Floodlight Sales',
  'ua': 'Google Analytics: Universal Analytics',
  // Microsoft
  'baut': 'Microsoft Advertising UET',
  'bzi': 'Bing Ads',
  // Other native types
  'img': 'Custom Image',
  'remm': 'Remarketing',
  'sp': 'Scroll Depth',
  
  // Popular Community Templates (Global IDs - stable across all containers)
  'cvt_5RM3Q': 'Facebook Pixel',
  'cvt_8Hnxd': 'TikTok Pixel',
  'cvt_K4VXG': 'Snapchat Pixel',
  'cvt_kzh2L': 'LinkedIn Insight Tag',
  'cvt_Rdn3J': 'Pinterest Tag',
  'cvt_7Zg5K': 'Twitter Pixel',
  'cvt_NNQ8S': 'Outbrain Pixel',
  'cvt_Qm4Xf': 'Hotjar Tracking',
  'cvt_Lp9Ks': 'Intercom',
  'cvt_Xd7Hm': 'Drift',
  'cvt_Mn2Wp': 'Heap Analytics',
  'cvt_Jk8Qr': 'Mixpanel',
  'cvt_Vb3Nt': 'Segment',
  'cvt_Ys6Fg': 'Amplitude',
  'cvt_Wc9Dx': 'FullStory',
  'cvt_Pl4Mz': 'Clarity',
  'cvt_Hg5Rv': 'Crazy Egg',
  'cvt_Tn1Ux': 'Lucky Orange',
  'cvt_Ae2Sy': 'Reddit Pixel',
  'cvt_Bk7Lq': 'Quora Pixel',
  'cvt_Cf3Oj': 'Taboola Pixel',
  'cvt_Dw8Pi': 'Criteo',
  'cvt_Ex4Nh': 'AdRoll',
};

// ============================================
// CONDITION TYPE MAPPINGS
// ============================================

/**
 * Condition type human-readable mapping
 */
export const CONDITION_TYPE_MAP = {
  // Positive matches
  'EQUALS': 'Equals',
  'CONTAINS': 'Contains',
  'STARTS_WITH': 'Starts With',
  'ENDS_WITH': 'Ends With',
  'CSS_SELECTOR': 'Matches CSS Selector',
  'MATCH_REGEX': 'Matches RegEx',
  'MATCH_REGEX_IGNORE_CASE': 'Matches RegEx (ignore case)',
  
  // Negative matches
  'DOES_NOT_EQUAL': 'Does Not Equal',
  'DOES_NOT_CONTAIN': 'Does Not Contain',
  'DOES_NOT_START_WITH': 'Does Not Start With',
  'DOES_NOT_END_WITH': 'Does Not End With',
  'DOES_NOT_MATCH_CSS_SELECTOR': 'Does Not Match CSS Selector',
  'DOES_NOT_MATCH_REGEX': 'Does Not Match RegEx',
  'DOES_NOT_MATCH_REGEX_IGNORE_CASE': 'Does Not Match RegEx (ignore case)',
  
  // Comparison operators
  'LESS_THAN': 'Less Than',
  'LESS_THAN_OR_EQUALS': 'Less Than or Equal To',
  'GREATER_THAN': 'Greater Than',
  'GREATER_THAN_OR_EQUALS': 'Greater Than or Equal To',
};

/**
 * Condition type categories for styling
 */
export const CONDITION_STYLE_MAP = {
  'EQUALS': 'positive',
  'CONTAINS': 'positive',
  'STARTS_WITH': 'positive',
  'ENDS_WITH': 'positive',
  'CSS_SELECTOR': 'positive',
  'MATCH_REGEX': 'positive',
  'MATCH_REGEX_IGNORE_CASE': 'positive',
  'DOES_NOT_EQUAL': 'negative',
  'DOES_NOT_CONTAIN': 'negative',
  'DOES_NOT_START_WITH': 'negative',
  'DOES_NOT_END_WITH': 'negative',
  'DOES_NOT_MATCH_CSS_SELECTOR': 'negative',
  'DOES_NOT_MATCH_REGEX': 'negative',
  'DOES_NOT_MATCH_REGEX_IGNORE_CASE': 'negative',
  'LESS_THAN': 'comparison',
  'LESS_THAN_OR_EQUALS': 'comparison',
  'GREATER_THAN': 'comparison',
  'GREATER_THAN_OR_EQUALS': 'comparison',
};

// ============================================
// TRIGGER TYPE MAPPINGS
// ============================================

/**
 * Trigger type human-readable mapping
 */
export const TRIGGER_TYPE_MAP = {
  'PAGEVIEW': 'Page View',
  'CLICK': 'Click - All Elements',
  'LINK_CLICK': 'Click - Just Links',
  'FORM_SUBMIT': 'Form Submission',
  'CUSTOM_EVENT': 'Custom Event',
  'HISTORY_CHANGE': 'History Change',
  'JAVASCRIPT_ERROR': 'JavaScript Error',
  'SCROLL_DEPTH': 'Scroll Depth',
  'ELEMENT_VISIBILITY': 'Element Visibility',
  'YOUTUBE_VIDEO': 'YouTube Video',
  'TIMER': 'Timer',
  'TRIGGER_GROUP': 'Trigger Group',
  'WINDOW_LOADED': 'Window Loaded',
  'DOM_READY': 'DOM Ready',
  'CONSENT_INIT': 'Consent Initialization',
  'INIT': 'Initialization',
  'ALWAYS': 'All Pages',
};

// ============================================
// VARIABLE TYPE MAPPINGS
// ============================================

/**
 * Variable type human-readable mapping
 */
export const VARIABLE_TYPE_MAP = {
  'v': 'Data Layer Variable',
  'c': 'Constant',
  'k': 'First Party Cookie',
  'j': 'JavaScript Variable',
  'jsm': 'Custom JavaScript',
  'u': 'URL',
  'f': 'HTTP Referrer',
  'e': 'Auto-Event Variable',
  'd': 'DOM Element',
  'vis': 'Element Visibility',
  'smm': 'Lookup Table',
  'remm': 'RegEx Table',
  'gas': 'Google Analytics Settings',
  'gtes': 'Google Tag: Event Settings',
  'gtcs': 'Google Tag: Configuration Settings',
  'aev': 'Auto-Event Variable',
};

