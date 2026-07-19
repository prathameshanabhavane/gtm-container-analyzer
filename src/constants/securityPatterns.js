/**
 * Security patterns for input sanitization
 * Following OWASP security guidelines
 */

// Allowed query parameter values (whitelist approach)
export const ALLOWED_QUERY_PARAMS = {
  status: ['active', 'paused'],
};

// Dangerous patterns to block for XSS prevention
export const DANGEROUS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,  // Script tags
  /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,  // Iframe tags
  /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,  // Object tags
  /<embed\b[^<]*>/gi,                                      // Embed tags
  /<link\b[^<]*>/gi,                                       // Link tags
  /<meta\b[^<]*>/gi,                                       // Meta tags
  /javascript:/gi,                                         // JavaScript protocol
  /vbscript:/gi,                                          // VBScript protocol
  /data:/gi,                                               // Data protocol
  /on\w+\s*=/gi,                                          // Event handlers (onclick, onerror, etc.)
  /expression\s*\(/gi,                                     // CSS expression
  /url\s*\(/gi,                                           // CSS url()
  /@import/gi,                                            // CSS import
  /<!--[\s\S]*?-->/g,                                     // HTML comments
  /\\\x00/g,                                              // Null bytes
  /%00/g,                                                  // URL-encoded null
  /&#/g,                                                   // HTML entities
  /\\u00/gi,                                              // Unicode escapes
];

// Keys that could be used for prototype pollution attacks
export const DANGEROUS_KEYS = ['__proto__', 'constructor', 'prototype'];

