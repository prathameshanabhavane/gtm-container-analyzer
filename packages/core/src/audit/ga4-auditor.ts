/**
 * @gtm-analyzer/core — GA4 Compliance Auditor
 *
 * Validates GA4 event configurations against Google's official developer specifications.
 *
 * Rules from governance-best-practices.md §2:
 *   - Event names ≤ 40 characters
 *   - Only letters, numbers, underscores allowed
 *   - Must start with a letter
 *   - All lowercase recommended
 *   - No reserved event names (automatically collected by GA4)
 *   - Recommended event matching for ecommerce/leads/gaming verticals
 *   - Custom event parameter volume limits (50 event params, 25 user params)
 */

import type {
  ContainerContext,
  GA4AuditResult,
  AuditIssue,
  ProcessedTag,
} from '../types.js';

import {
  GA4_RESERVED_EVENT_NAMES,
  GA4_RECOMMENDED_EVENTS,
} from '../constants/index.js';

// ─── GA4 Tag Type Identifiers ─────────────────────────────────────────────────

const GA4_EVENT_TAG_TYPES = new Set(['gaawe']); // GA4 Event tag type key
const GA4_CONFIG_TAG_TYPES = new Set(['gaawc']); // GA4 Config tag type key

// ─── Validation Helpers ───────────────────────────────────────────────────────

const VALID_EVENT_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]*$/;
const LOWERCASE_RECOMMENDED_PATTERN = /[A-Z]/;

function isGA4EventTag(tag: ProcessedTag): boolean {
  return GA4_EVENT_TAG_TYPES.has(tag.type);
}

/** Extracts the GA4 event name from a GA4 Event tag's parameters */
function extractGA4EventName(tag: ProcessedTag): string | null {
  const eventName = tag.parameters['eventName'];
  if (typeof eventName === 'string') return eventName;
  return null;
}

/** Finds the closest recommended event name for a custom event */
function findRecommendedAlternative(customEvent: string): string | null {
  const lowerEvent = customEvent.toLowerCase();

  // Check across all recommended event verticals
  for (const [_vertical, events] of Object.entries(GA4_RECOMMENDED_EVENTS)) {
    for (const recommended of events) {
      // Simple Levenshtein-like: if the event name is "close enough", suggest it
      if (
        recommended.includes(lowerEvent) ||
        lowerEvent.includes(recommended) ||
        lowerEvent.replace(/[-_]/g, '') === recommended.replace(/[-_]/g, '')
      ) {
        return recommended;
      }
    }
  }
  return null;
}

// ─── Main Auditor ─────────────────────────────────────────────────────────────

/**
 * Runs all GA4-specific compliance checks on the container.
 *
 * @param ctx - Container context to audit
 * @returns GA4AuditResult with issues and counts
 */
export function auditGA4(ctx: ContainerContext): GA4AuditResult {
  const issues: AuditIssue[] = [];
  let validCount = 0;
  let violationCount = 0;

  const ga4EventTags = ctx.tags.filter(isGA4EventTag);

  // ── Per-tag event name checks ────────────────────────────────────────────────
  for (const tag of ga4EventTags) {
    const eventName = extractGA4EventName(tag);
    if (!eventName) continue;

    let tagHasViolation = false;

    // Check 1: Character limit (≤40 chars)
    if (eventName.length > 40) {
      tagHasViolation = true;
      violationCount++;
      issues.push({
        code: 'GA4_EVENT_NAME_TOO_LONG',
        severity: 'critical',
        message: `GA4 event "${eventName}" is ${eventName.length} characters — exceeds the 40-character Google Analytics limit.`,
        suggestion: `Shorten the event name to 40 characters or fewer. Current: "${eventName}"`,
        affectedItem: tag.name,
        affectedId: tag.id,
      });
    }

    // Check 2: Allowed characters (letters, numbers, underscores only)
    if (!VALID_EVENT_NAME_PATTERN.test(eventName)) {
      tagHasViolation = true;
      violationCount++;
      issues.push({
        code: 'GA4_EVENT_NAME_INVALID_CHARS',
        severity: 'critical',
        message: `GA4 event "${eventName}" contains invalid characters. Only letters, numbers, and underscores are allowed.`,
        suggestion: `Replace spaces and special characters with underscores: "${eventName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}"`,
        affectedItem: tag.name,
        affectedId: tag.id,
      });
    }

    // Check 3: Reserved event name
    if (GA4_RESERVED_EVENT_NAMES.includes(eventName.toLowerCase())) {
      tagHasViolation = true;
      violationCount++;
      issues.push({
        code: 'GA4_EVENT_NAME_RESERVED',
        severity: 'critical',
        message: `GA4 event "${eventName}" is a reserved name automatically collected by Google Analytics.`,
        suggestion: `Remove this custom event tag — GA4 already collects "${eventName}" automatically. Using it as a custom event causes data conflicts.`,
        affectedItem: tag.name,
        affectedId: tag.id,
      });
    }

    // Check 4: Lowercase recommendation
    if (LOWERCASE_RECOMMENDED_PATTERN.test(eventName)) {
      tagHasViolation = true;
      issues.push({
        code: 'GA4_EVENT_NAME_CASE',
        severity: 'warning',
        message: `GA4 event "${eventName}" contains uppercase letters. Event names are case-sensitive — "${eventName}" and "${eventName.toLowerCase()}" are tracked as different events.`,
        suggestion: `Rename to all-lowercase: "${eventName.toLowerCase()}"`,
        affectedItem: tag.name,
        affectedId: tag.id,
      });
    }

    // Check 5: Recommended event alternatives
    if (VALID_EVENT_NAME_PATTERN.test(eventName) && eventName.length <= 40) {
      const alternative = findRecommendedAlternative(eventName);
      if (alternative && alternative !== eventName.toLowerCase()) {
        issues.push({
          code: 'GA4_EVENT_NAME_RECOMMENDED_ALTERNATIVE',
          severity: 'info',
          message: `Custom event "${eventName}" may map to Google's recommended event "${alternative}".`,
          suggestion: `Using the standard name "${alternative}" enables enhanced GA4 reporting for this event type.`,
          affectedItem: tag.name,
          affectedId: tag.id,
        });
      }
    }

    if (!tagHasViolation) {
      validCount++;
    }
  }

  // ── Container-wide parameter volume check ─────────────────────────────────
  // Count unique custom event parameter names across all GA4 event tags
  const uniqueEventParams = new Set<string>();
  for (const tag of ga4EventTags) {
    const eventParams = tag.parameters['eventParameters'];
    if (Array.isArray(eventParams)) {
      for (const param of eventParams) {
        if (typeof param === 'object' && param !== null && 'name' in param) {
          uniqueEventParams.add(String((param as { name: unknown }).name));
        }
      }
    }
  }

  if (uniqueEventParams.size > 50) {
    issues.push({
      code: 'GA4_CUSTOM_PARAMS_LIMIT',
      severity: 'warning',
      message: `Container has ${uniqueEventParams.size} unique custom event parameters, exceeding GA4's limit of 50.`,
      suggestion:
        'Review and consolidate custom event parameters. Parameters beyond 50 will not be processed by Google Analytics.',
    });
  }

  return {
    validCount,
    violationCount,
    issues,
  };
}
