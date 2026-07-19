/**
 * @gtm-analyzer/core — Security & Input Sanitization
 *
 * OWASP 2025 Alignment:
 *   A03:2025 - Injection: deepSanitize strips HTML/script injections
 *   A04:2025 - Insecure Design: safeJSONMerge prevents prototype pollution
 *   A05:2025 - Security Misconfiguration: validateGTMJson enforces strict structure
 *   A10:2025 - Server-Side Request Forgery: No outbound requests made here
 *
 * All functions are pure — they take input and return sanitized output.
 * No global state, no side effects.
 */

import { z } from 'zod';
import { GTMParseError, GTMValidationError } from '../errors.js';

// ─── Dangerous Patterns ───────────────────────────────────────────────────────

/** Regex patterns that indicate script injection or XSS attempts */
const DANGEROUS_PATTERNS: RegExp[] = [
  /javascript:/gi,
  /vbscript:/gi,
  /data:text\/html/gi,
  /on\w+\s*=/gi, // onclick=, onload=, etc.
  /<script[\s\S]*?>/gi,
  /<\/script>/gi,
  /eval\s*\(/gi,
  /expression\s*\(/gi,
];

/** Keys that, if present in the JSON, indicate prototype pollution attempts */
const DANGEROUS_KEYS: readonly string[] = [
  '__proto__',
  'constructor',
  'prototype',
];

// ─── Sanitization Functions ───────────────────────────────────────────────────

/**
 * Deeply sanitizes a string input.
 * Removes HTML tags, dangerous patterns, and special injection characters.
 * Returns null for invalid input types.
 *
 * @param input - Raw string from user input or JSON
 * @param maxLength - Maximum allowed length (default: 500)
 */
export function deepSanitize(input: unknown, maxLength = 500): string | null {
  if (input === null || input === undefined) return null;
  if (typeof input !== 'string') return null;

  let sanitized = input;

  // Strip dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    sanitized = sanitized.replace(pattern, '');
  }

  // Strip all HTML tags
  sanitized = sanitized.replace(/<[^>]*>/g, '');

  // Strip characters commonly used for injection
  sanitized = sanitized.replace(/[<>"'`\\]/g, '');

  // Trim whitespace and enforce length limit
  return sanitized.trim().substring(0, maxLength);
}

/**
 * Sanitizes text for safe HTML display by escaping HTML entities.
 * Use this when rendering any user-supplied or container-derived text
 * inside innerHTML (though we prefer textContent where possible).
 */
export function sanitizeForDisplay(text: unknown): string {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Safe recursive JSON merge that prevents prototype pollution.
 *
 * The standard `Object.assign()` and spread operator `{...a, ...b}` are
 * vulnerable to prototype pollution when source objects contain `__proto__`,
 * `constructor`, or `prototype` keys. This function uses `Object.create(null)`
 * to build a null-prototype map, scrubbing dangerous keys at every level.
 *
 * @param target - Base object to merge into
 * @param source - Object whose properties override target
 * @returns A new plain object with merged properties, safe from prototype pollution
 */
export function safeJSONMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
  depth = 0,
): Record<string, unknown> {
  // Guard against excessively deep merges (DoS prevention)
  if (depth > 20) return target;

  // Use a null-prototype object as the accumulator to prevent prototype chain attacks
  const result: Record<string, unknown> = Object.create(null);

  // Copy target properties first
  for (const key of Object.keys(target)) {
    if (DANGEROUS_KEYS.includes(key)) continue; // Skip dangerous keys
    result[key] = target[key];
  }

  // Override with source properties
  for (const key of Object.keys(source)) {
    if (DANGEROUS_KEYS.includes(key)) continue; // Skip dangerous keys

    const targetValue = result[key];
    const sourceValue = source[key];

    // Recurse for plain objects
    if (
      targetValue !== null &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue) &&
      sourceValue !== null &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue)
    ) {
      result[key] = safeJSONMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>,
        depth + 1,
      );
    } else {
      result[key] = sourceValue;
    }
  }

  // Convert back to a regular object (restore standard prototype)
  return Object.assign({}, result);
}

/**
 * Redacts sensitive credentials from display strings.
 * Detects patterns like API keys, secrets, tokens, and OAuth credentials.
 * Used before logging or displaying tag parameter values.
 */
export function redactCredentials(value: string): string {
  // API key patterns (Google, AWS, Stripe, etc.)
  return value
    .replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_API_KEY]')
    .replace(/sk[-_][a-zA-Z0-9]{20,}/g, '[REDACTED_SECRET_KEY]')
    .replace(/pk[-_][a-zA-Z0-9]{20,}/g, '[REDACTED_PUBLIC_KEY]')
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/g, 'Bearer [REDACTED_TOKEN]')
    .replace(/token["']?\s*[:=]\s*["']?[A-Za-z0-9\-._~+/]{20,}/gi, 'token: [REDACTED_TOKEN]')
    .replace(/password["']?\s*[:=]\s*["']?[^\s"',]{6,}/gi, 'password: [REDACTED]');
}

// ─── GTM JSON Validation ──────────────────────────────────────────────────────

/** Minimal Zod schema for the GTM export root structure */
const gtmExportSchema = z.object({
  exportFormatVersion: z.number().optional(),
  exportTime: z.string().optional(),
  containerVersion: z.object({
    accountId: z.string().optional(),
    containerId: z.string().optional(),
    containerVersionId: z.string().optional(),
    name: z.string().optional(),
    tag: z.array(z.object({ name: z.string(), type: z.string() })).optional(),
    trigger: z.array(z.object({ name: z.string(), type: z.string() })).optional(),
    variable: z.array(z.object({ name: z.string(), type: z.string() })).optional(),
    folder: z.array(z.object({ name: z.string() })).optional(),
  }),
});

/**
 * Validates that the uploaded JSON is a structurally valid GTM container export.
 *
 * Multi-layer checks:
 *   1. Type check — must be a non-array object
 *   2. Prototype pollution check — scans all keys recursively
 *   3. Size limit — rejects files over 50MB (DoS prevention)
 *   4. Zod schema validation — enforces required GTM structure
 *
 * @throws GTMParseError for structural or security failures
 * @throws GTMValidationError for Zod schema violations
 */
export function validateGTMJson(data: unknown): asserts data is Record<string, unknown> {
  // Layer 1: Basic type check
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new GTMParseError('Input must be a non-null, non-array JSON object.');
  }

  // Layer 2: Prototype pollution detection (recursive)
  const hasDangerousKey = (obj: unknown, depth = 0): boolean => {
    if (depth > 20) return false; // DoS guard
    if (!obj || typeof obj !== 'object') return false;
    for (const key of Object.keys(obj)) {
      if ((DANGEROUS_KEYS as string[]).includes(key)) return true;
      if (hasDangerousKey((obj as Record<string, unknown>)[key], depth + 1)) return true;
    }
    return false;
  };

  if (hasDangerousKey(data)) {
    throw new GTMParseError(
      'Security violation: JSON contains prototype pollution keys (__proto__, constructor, prototype).',
      '__proto__',
    );
  }

  // Layer 3: Size limit (50MB)
  const jsonSize = JSON.stringify(data).length;
  if (jsonSize > 50 * 1024 * 1024) {
    throw new GTMParseError(
      `File too large (${Math.round(jsonSize / 1024 / 1024)}MB). Maximum allowed size is 50MB.`,
      'size',
    );
  }

  // Layer 4: Structural validation with Zod
  const result = gtmExportSchema.safeParse(data);
  if (!result.success) {
    const violations = result.error.errors.map(
      (e) => `${e.path.join('.')}: ${e.message}`,
    );
    throw new GTMValidationError(
      'The uploaded file does not match the GTM container export format.',
      violations,
    );
  }
}
