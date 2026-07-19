/**
 * @gtm-analyzer/core — Structured Error Classes
 *
 * Provides typed, named error classes so that error handling in the UI
 * can distinguish between parse failures, validation errors, and audit errors
 * without relying on string matching of generic Error messages.
 *
 * Usage:
 *   import { GTMParseError, GTMValidationError } from '@gtm-analyzer/core';
 *   try { analyze(json) } catch (e) { if (e instanceof GTMParseError) { ... } }
 */

/**
 * Thrown when the input JSON cannot be parsed into a valid GTM container structure.
 * For example: missing `containerVersion`, wrong root shape, prototype pollution detected.
 */
export class GTMParseError extends Error {
  readonly name = 'GTMParseError' as const;
  constructor(
    message: string,
    /** The field or key path that caused the failure, if known */
    public readonly field?: string,
  ) {
    super(message);
    // Maintains proper stack trace in V8 environments
    const errClass = Error as any;
    if (typeof errClass.captureStackTrace === 'function') {
      errClass.captureStackTrace(this, GTMParseError);
    }
  }
}

/**
 * Thrown when the JSON structure is valid but fails Zod schema validation.
 * Carries all violation details for user-facing display.
 */
export class GTMValidationError extends Error {
  readonly name = 'GTMValidationError' as const;
  constructor(
    message: string,
    /** Array of human-readable validation violation messages */
    public readonly violations: readonly string[],
  ) {
    super(message);
    const errClass = Error as any;
    if (typeof errClass.captureStackTrace === 'function') {
      errClass.captureStackTrace(this, GTMValidationError);
    }
  }
}

/**
 * Thrown when an audit module encounters an unexpected state
 * that prevents it from completing its analysis.
 */
export class GTMAuditError extends Error {
  readonly name = 'GTMAuditError' as const;
  constructor(
    message: string,
    /** The audit module that failed (e.g., 'naming-auditor', 'ga4-auditor') */
    public readonly auditType: string,
  ) {
    super(message);
    const errClass = Error as any;
    if (typeof errClass.captureStackTrace === 'function') {
      errClass.captureStackTrace(this, GTMAuditError);
    }
  }
}

/**
 * Thrown by the MCP server or CLI when a requested file path
 * falls outside the allowed base directory (path traversal attempt).
 */
export class GTMSecurityError extends Error {
  readonly name = 'GTMSecurityError' as const;
  constructor(message: string) {
    super(message);
    const errClass = Error as any;
    if (typeof errClass.captureStackTrace === 'function') {
      errClass.captureStackTrace(this, GTMSecurityError);
    }
  }
}

