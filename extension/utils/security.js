/**
 * GTM Container Analyzer - Tag+Pixel Debugger | Security Module
 * 
 * Bulletproof security and data safety checks.
 * All data validation, sanitization, and security utilities.
 * 
 * SECURITY PRINCIPLES:
 * 1. Never trust external input
 * 2. Sanitize all data before use
 * 3. Validate message origins
 * 4. Limit data exposure
 * 5. Prevent XSS/injection attacks
 */

// ============================================
// CONSTANTS
// ============================================

// Allowed message sources
const TRUSTED_SOURCES = [
  'gtm-live-analyzer-extension',
  'gtm-live-interceptor'
];

// Maximum sizes to prevent memory attacks
const MAX_LIMITS = {
  STRING_LENGTH: 10000,        // Max string length
  ARRAY_LENGTH: 1000,          // Max array items
  OBJECT_DEPTH: 10,            // Max nested object depth
  URL_LENGTH: 2048,            // Max URL length
  PARAM_VALUE_LENGTH: 5000,    // Max parameter value length
  REQUESTS_PER_PAGE: 500,      // Max requests to store
  EVENTS_PER_PAGE: 200,        // Max dataLayer events
  STORAGE_SIZE_MB: 10,         // Max storage size in MB
};

// Dangerous patterns to block
const DANGEROUS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,  // Script tags
  /javascript:/gi,                                         // JavaScript protocol
  /on\w+\s*=/gi,                                          // Event handlers
  /data:\s*text\/html/gi,                                 // Data URLs with HTML
  /vbscript:/gi,                                          // VBScript protocol
  /expression\s*\(/gi,                                    // CSS expressions
];

// ============================================
// INPUT VALIDATION
// ============================================

/**
 * Validate that a value is a safe string
 */
export function isValidString(value, maxLength = MAX_LIMITS.STRING_LENGTH) {
  if (typeof value !== 'string') return false;
  if (value.length > maxLength) return false;
  return true;
}

/**
 * Validate URL format and safety
 */
export function isValidURL(url) {
  if (!isValidString(url, MAX_LIMITS.URL_LENGTH)) return false;
  
  try {
    const parsed = new URL(url);
    // Only allow http/https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate message source is trusted
 */
export function isValidMessageSource(source) {
  return TRUSTED_SOURCES.includes(source);
}

/**
 * Validate message type
 */
export function isValidMessageType(type) {
  const validTypes = [
    'GTM_LIVE_DATALAYER_PUSH',
    'GTM_LIVE_DATALAYER_INIT',
    'GTM_LIVE_NETWORK_REQUEST',
    'GTM_LIVE_INTERCEPTOR_READY',
    'GTM_LIVE_EXTENSION_READY',
    'GTM_LIVE_DATA_FROM_EXTENSION',
    'GTM_LIVE_DATA_UPDATED',
    'GTM_LIVE_DATA_CLEARED',
    'GTM_LIVE_REQUEST_DATA',
    'CAPTURE_UPDATE',
    'GET_CAPTURED_DATA',
    'CLEAR_CAPTURED_DATA',
    'OPEN_DASHBOARD',
  ];
  return validTypes.includes(type);
}

/**
 * Validate object depth to prevent prototype pollution
 */
export function isValidObjectDepth(obj, maxDepth = MAX_LIMITS.OBJECT_DEPTH, currentDepth = 0) {
  if (currentDepth > maxDepth) return false;
  if (obj === null || typeof obj !== 'object') return true;
  
  for (const key of Object.keys(obj)) {
    // Block __proto__ and constructor attacks
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      return false;
    }
    if (!isValidObjectDepth(obj[key], maxDepth, currentDepth + 1)) {
      return false;
    }
  }
  return true;
}

// ============================================
// SANITIZATION
// ============================================

/**
 * Sanitize string - remove dangerous content
 */
export function sanitizeString(value, maxLength = MAX_LIMITS.STRING_LENGTH) {
  if (typeof value !== 'string') {
    return String(value || '').substring(0, maxLength);
  }
  
  let sanitized = value.substring(0, maxLength);
  
  // Remove dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[BLOCKED]');
  }
  
  // Encode HTML entities
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
  
  return sanitized;
}

/**
 * Sanitize URL - ensure safe URL
 */
export function sanitizeURL(url) {
  if (!isValidURL(url)) {
    return '';
  }
  return url.substring(0, MAX_LIMITS.URL_LENGTH);
}

/**
 * Sanitize object - deep sanitize all string values
 */
export function sanitizeObject(obj, depth = 0) {
  if (depth > MAX_LIMITS.OBJECT_DEPTH) {
    return '[MAX_DEPTH_EXCEEDED]';
  }
  
  if (obj === null || obj === undefined) {
    return null;
  }
  
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  
  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.slice(0, MAX_LIMITS.ARRAY_LENGTH).map(item => sanitizeObject(item, depth + 1));
  }
  
  if (typeof obj === 'object') {
    const sanitized = {};
    const keys = Object.keys(obj).slice(0, 100); // Limit keys
    
    for (const key of keys) {
      // Skip dangerous keys
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue;
      }
      const sanitizedKey = sanitizeString(key, 100);
      sanitized[sanitizedKey] = sanitizeObject(obj[key], depth + 1);
    }
    return sanitized;
  }
  
  return null;
}

/**
 * Sanitize event parameters
 */
export function sanitizeEventParams(params) {
  if (!params || typeof params !== 'object') {
    return {};
  }
  
  const sanitized = {};
  const entries = Object.entries(params).slice(0, 100);
  
  for (const [key, value] of entries) {
    // Skip dangerous keys
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }
    
    const sanitizedKey = sanitizeString(key, 100);
    
    if (typeof value === 'string') {
      sanitized[sanitizedKey] = sanitizeString(value, MAX_LIMITS.PARAM_VALUE_LENGTH);
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      sanitized[sanitizedKey] = value;
    } else if (value === null || value === undefined) {
      sanitized[sanitizedKey] = null;
    } else {
      sanitized[sanitizedKey] = sanitizeObject(value);
    }
  }
  
  return sanitized;
}

// ============================================
// DATA SAFETY
// ============================================

/**
 * Check if storage limit is exceeded
 */
export async function isStorageLimitExceeded() {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const result = await chrome.storage.local.getBytesInUse();
      const limitBytes = MAX_LIMITS.STORAGE_SIZE_MB * 1024 * 1024;
      return result > limitBytes;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Safely parse JSON with validation
 */
export function safeJSONParse(jsonString, defaultValue = null) {
  if (!isValidString(jsonString)) {
    return defaultValue;
  }
  
  try {
    const parsed = JSON.parse(jsonString);
    
    // Validate object depth
    if (!isValidObjectDepth(parsed)) {
      console.warn('[GTM Live Security] JSON depth exceeded limit');
      return defaultValue;
    }
    
    return parsed;
  } catch {
    return defaultValue;
  }
}

/**
 * Safely stringify object
 */
export function safeJSONStringify(obj) {
  try {
    // Check depth first
    if (!isValidObjectDepth(obj)) {
      return '{"error": "Object depth exceeded"}';
    }
    return JSON.stringify(obj);
  } catch (error) {
    return '{"error": "Serialization failed"}';
  }
}

// ============================================
// RATE LIMITING
// ============================================

const rateLimitMap = new Map();

/**
 * Check rate limit for an action
 */
export function checkRateLimit(action, maxPerSecond = 10) {
  const now = Date.now();
  const key = action;
  
  if (!rateLimitMap.has(key)) {
    rateLimitMap.set(key, { count: 1, timestamp: now });
    return true;
  }
  
  const entry = rateLimitMap.get(key);
  
  // Reset if more than 1 second has passed
  if (now - entry.timestamp > 1000) {
    rateLimitMap.set(key, { count: 1, timestamp: now });
    return true;
  }
  
  // Check if limit exceeded
  if (entry.count >= maxPerSecond) {
    return false;
  }
  
  entry.count++;
  return true;
}

// ============================================
// CONTENT SECURITY
// ============================================

/**
 * Check if content contains dangerous patterns
 */
export function containsDangerousContent(content) {
  if (typeof content !== 'string') return false;
  
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(content)) {
      return true;
    }
  }
  return false;
}

/**
 * Validate captured data structure
 */
export function validateCapturedData(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, reason: 'Invalid data type' };
  }
  
  // Check required fields
  if (!data.url || !isValidURL(data.url)) {
    return { valid: false, reason: 'Invalid URL' };
  }
  
  // Check array limits
  if (data.networkRequests && data.networkRequests.length > MAX_LIMITS.REQUESTS_PER_PAGE) {
    return { valid: false, reason: 'Too many network requests' };
  }
  
  if (data.dataLayerEvents && data.dataLayerEvents.length > MAX_LIMITS.EVENTS_PER_PAGE) {
    return { valid: false, reason: 'Too many dataLayer events' };
  }
  
  // Check object depth
  if (!isValidObjectDepth(data)) {
    return { valid: false, reason: 'Object depth exceeded' };
  }
  
  return { valid: true };
}

/**
 * Create a secure copy of data (deep clone without references)
 */
export function secureDeepCopy(data) {
  try {
    // Use structured clone if available (prevents prototype pollution)
    if (typeof structuredClone === 'function') {
      return structuredClone(data);
    }
    
    // Fallback: JSON parse/stringify (safe but loses some types)
    const jsonStr = JSON.stringify(data);
    if (!isValidString(jsonStr, MAX_LIMITS.STRING_LENGTH * 10)) {
      throw new Error('Data too large');
    }
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

// ============================================
// LOGGING (Secure - no sensitive data)
// ============================================

/**
 * Secure logging - redacts sensitive information
 */
export function secureLog(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const prefix = `[GTM Live Security ${timestamp}]`;
  
  // Redact sensitive data
  let safeData = data;
  if (data) {
    safeData = redactSensitiveData(data);
  }
  
  switch (level) {
    case 'warn':
      console.warn(prefix, message, safeData || '');
      break;
    case 'error':
      console.error(prefix, message, safeData || '');
      break;
    default:
      console.log(prefix, message, safeData || '');
  }
}

/**
 * Redact sensitive data from logs
 */
function redactSensitiveData(data) {
  if (typeof data !== 'object' || data === null) {
    return data;
  }
  
  const sensitiveKeys = [
    'password', 'token', 'secret', 'key', 'auth', 'credential',
    'credit', 'card', 'cvv', 'ssn', 'email', 'phone'
  ];
  
  const redacted = { ...data };
  
  for (const key of Object.keys(redacted)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some(s => lowerKey.includes(s))) {
      redacted[key] = '[REDACTED]';
    }
  }
  
  return redacted;
}

// ============================================
// EXPORTS SUMMARY
// ============================================
export const SECURITY_LIMITS = MAX_LIMITS;




