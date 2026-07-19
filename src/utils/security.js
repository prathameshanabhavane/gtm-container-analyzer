/**
 * Security utilities for input sanitization
 * Multi-layer defense against XSS, injection, and malicious input
 */

import { 
  DANGEROUS_PATTERNS, 
  ALLOWED_QUERY_PARAMS, 
  DANGEROUS_KEYS 
} from '../constants';

/**
 * Deep sanitize any string input - removes ALL potentially dangerous content
 * @param {string} input - The string to sanitize
 * @returns {string|null} - Sanitized string or null if invalid
 */
export const deepSanitize = (input) => {
  if (input === null || input === undefined) return null;
  if (typeof input !== 'string') return null;
  
  let sanitized = input;
  
  // Remove all dangerous patterns
  DANGEROUS_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });
  
  // Remove all HTML tags
  sanitized = sanitized.replace(/<[^>]*>/g, '');
  
  // Remove all special characters that could be used for injection
  sanitized = sanitized.replace(/[<>"'`\\]/g, '');
  
  // Trim and limit length
  sanitized = sanitized.trim().substring(0, 100);
  
  return sanitized;
};

/**
 * Sanitizes and validates a query parameter value
 * STRICT whitelist-only approach
 * @param {string} paramName - The parameter name
 * @param {string} value - The parameter value to sanitize
 * @returns {string|null} - Sanitized value or null if invalid
 */
export const sanitizeQueryParam = (paramName, value) => {
  // Step 1: Type check
  if (!value || typeof value !== 'string') return null;
  
  // Step 2: Length check (prevent DoS)
  if (value.length > 50) return null;
  
  // Step 3: Deep sanitize
  const sanitized = deepSanitize(value);
  if (!sanitized) return null;
  
  // Step 4: Whitelist validation
  const allowedValues = ALLOWED_QUERY_PARAMS[paramName];
  if (!allowedValues) return null;
  
  // Step 5: Exact match only (case-insensitive)
  const normalized = sanitized.toLowerCase();
  if (allowedValues.includes(normalized)) {
    return normalized;
  }
  
  return null;
};

/**
 * Validate uploaded JSON file - prevent malicious JSON
 * @param {object} data - The parsed JSON data
 * @returns {object} - { valid: boolean, error?: string }
 */
export const validateGTMJson = (data) => {
  // Must be an object
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { valid: false, error: 'Invalid JSON structure' };
  }
  
  // Must have containerVersion (GTM export structure)
  if (!data.containerVersion) {
    return { valid: false, error: 'Not a valid GTM container export' };
  }
  
  // Check for prototype pollution attempts
  const checkForDangerousKeys = (obj, depth = 0) => {
    if (depth > 20) return true; // Max depth to prevent DoS
    if (!obj || typeof obj !== 'object') return false;
    
    for (const key of Object.keys(obj)) {
      if (DANGEROUS_KEYS.includes(key)) return true;
      if (typeof obj[key] === 'object' && checkForDangerousKeys(obj[key], depth + 1)) {
        return true;
      }
    }
    return false;
  };
  
  if (checkForDangerousKeys(data)) {
    return { valid: false, error: 'Suspicious content detected' };
  }
  
  // Size limit (50MB max)
  const jsonSize = JSON.stringify(data).length;
  if (jsonSize > 50 * 1024 * 1024) {
    return { valid: false, error: 'File too large' };
  }
  
  return { valid: true };
};

/**
 * Sanitize text for display - prevents XSS when rendering
 * @param {string} text - The text to sanitize
 * @returns {string} - Sanitized text safe for HTML display
 */
export const sanitizeForDisplay = (text) => {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

