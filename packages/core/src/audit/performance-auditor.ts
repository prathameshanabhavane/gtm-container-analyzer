/**
 * @gtm-analyzer/core — Performance & Container Health Auditor
 *
 * Audits GTM containers for performance issues, consent mode compliance,
 * and container size safety.
 *
 * Rules from governance-best-practices.md §3 & §4:
 *   - Non-critical tag deferral (marketing pixels on Page View → move to DOM Ready)
 *   - Custom HTML → sandboxed template recommendations (Meta, Hotjar, TikTok, etc.)
 *   - Container size alerts: warning at 160KB (80%), critical at 190KB (95%)
 *   - Consent mode validation: CMP must load on Consent Initialization trigger
 *   - Async/defer attribute check for custom HTML script tags
 */

import type {
  ContainerContext,
  PerformanceAuditResult,
  AuditIssue,
  ProcessedTag,
} from '../types.js';

import {
  GTM_CONTAINER_SIZE_LIMIT_BYTES,
  GTM_CONTAINER_SIZE_WARNING_BYTES,
  GTM_CONTAINER_SIZE_CRITICAL_BYTES,
  CUSTOM_HTML_TEMPLATE_RECOMMENDATIONS,
} from '../constants/index.js';

// ─── Trigger Type Constants ───────────────────────────────────────────────────

/** Trigger types considered "early" — only consent-critical tags should fire here */
const EARLY_TRIGGER_TYPES = new Set(['pageview', 'init', 'consentInit']);

/** Trigger types that are "deferred" — better for non-critical marketing pixels */
const DEFERRED_TRIGGER_TYPES = new Set(['domReady', 'windowLoaded']);

/** Marketing/analytics tag types that should NOT fire on early triggers (non-consent-related) */
const DEFERRABLE_TAG_TYPES = new Set([
  'html',       // Custom HTML (marketing pixels)
  'flc', 'fls', // Floodlight
]);

/** CMP-related vendor script patterns — these MUST fire on Consent Initialization */
const CMP_SCRIPT_PATTERNS = [
  /cookiebot/i,
  /onetrust/i,
  /usercentrics/i,
  /quantcast/i,
  /didomi/i,
  /trustarc/i,
  /consentmanager/i,
  /iubenda/i,
];

// ─── Auditor ──────────────────────────────────────────────────────────────────

/**
 * Audits performance and compliance issues in the container.
 *
 * @param ctx - Container context to audit
 * @returns PerformanceAuditResult with score and issue list
 */
export function auditPerformance(ctx: ContainerContext): PerformanceAuditResult {
  const issues: AuditIssue[] = [];
  let score = 100;

  // ── Container size check ─────────────────────────────────────────────────────
  const sizeBytes = ctx.stats.containerSizeBytes;
  let containerSizeWarning: PerformanceAuditResult['containerSizeWarning'] = 'ok';

  if (sizeBytes >= GTM_CONTAINER_SIZE_CRITICAL_BYTES) {
    containerSizeWarning = 'critical';
    score -= 20;
    issues.push({
      code: 'PERF_CONTAINER_SIZE_CRITICAL',
      severity: 'critical',
      message: `Container size is ${formatBytes(sizeBytes)} — at ${Math.round((sizeBytes / GTM_CONTAINER_SIZE_LIMIT_BYTES) * 100)}% of GTM's 200KB publish limit.`,
      suggestion:
        'Remove unused variables, merge duplicate tags, and delete legacy custom HTML scripts to reduce container size before publish fails.',
    });
  } else if (sizeBytes >= GTM_CONTAINER_SIZE_WARNING_BYTES) {
    containerSizeWarning = 'warning';
    score -= 10;
    issues.push({
      code: 'PERF_CONTAINER_SIZE_WARNING',
      severity: 'warning',
      message: `Container size is ${formatBytes(sizeBytes)} (${Math.round((sizeBytes / GTM_CONTAINER_SIZE_LIMIT_BYTES) * 100)}% of the 200KB limit).`,
      suggestion:
        'Start cleaning up unused variables and old tags to prevent hitting the GTM publish limit.',
    });
  }

  // ── Non-critical tag deferral check ──────────────────────────────────────────
  const earlyMarketingTags = ctx.tags.filter((tag) => {
    if (!DEFERRABLE_TAG_TYPES.has(tag.type)) return false;
    // Check if any firing trigger is an "early" type
    return tag.firingTriggerIds.some((triggerId) => {
      const trigger = ctx.triggerById.get(triggerId);
      return trigger && EARLY_TRIGGER_TYPES.has(trigger.type);
    });
  });

  for (const tag of earlyMarketingTags) {
    // Don't flag CMP loaders — they legitimately need early triggers
    if (isCMPTag(tag)) continue;

    score -= 3;
    issues.push({
      code: 'PERF_TAG_EARLY_FIRING',
      severity: 'warning',
      message: `Tag "${tag.name}" fires on Page View/Initialization, which can slow page load (INP/LCP).`,
      suggestion:
        'Move non-essential marketing pixels to "DOM Ready" or "Window Loaded" triggers to defer their execution and improve Core Web Vitals.',
      affectedItem: tag.name,
      affectedId: tag.id,
    });
  }

  // ── Custom HTML → sandboxed template recommendations ────────────────────────
  const htmlTags = ctx.tags.filter((t) => t.type === 'html');
  for (const tag of htmlTags) {
    const htmlContent = tag.parameters['html'];
    if (typeof htmlContent !== 'string') continue;

    for (const rec of CUSTOM_HTML_TEMPLATE_RECOMMENDATIONS) {
      if (rec.detectPattern.test(htmlContent)) {
        score -= 5;
        issues.push({
          code: 'PERF_USE_SANDBOXED_TEMPLATE',
          severity: 'warning',
          message: `Tag "${tag.name}" appears to implement ${rec.platformName} via Custom HTML, which runs without security sandboxing.`,
          suggestion: `Replace with the "${rec.recommendedTemplate}" template from the GTM Community Gallery (by ${rec.templateOwner}). Sandboxed templates are faster, safer, and natively respect GTM consent settings.`,
          affectedItem: tag.name,
          affectedId: tag.id,
        });
        break; // Only report first match per tag
      }
    }

    // Check for missing async/defer on script tags within custom HTML
    if (/<script(?![^>]*\b(async|defer)\b)[^>]*src=/i.test(htmlContent)) {
      score -= 2;
      issues.push({
        code: 'PERF_SCRIPT_NO_ASYNC_DEFER',
        severity: 'info',
        message: `Tag "${tag.name}" loads an external script without "async" or "defer" attribute, which blocks page rendering.`,
        suggestion: 'Add async or defer to any <script src="..."> tags inside Custom HTML to prevent render-blocking.',
        affectedItem: tag.name,
        affectedId: tag.id,
      });
    }
  }

  // ── Consent mode validation ───────────────────────────────────────────────────
  // CMP loaders must be on the "Consent Initialization" trigger, not All Pages
  for (const tag of htmlTags) {
    if (!isCMPTag(tag)) continue;

    const hasConsentInitTrigger = tag.firingTriggerIds.some((triggerId) => {
      const trigger = ctx.triggerById.get(triggerId);
      return trigger?.type === 'consentInit';
    });

    if (!hasConsentInitTrigger) {
      score -= 15;
      issues.push({
        code: 'PERF_CMP_WRONG_TRIGGER',
        severity: 'critical',
        message: `Consent Management Platform tag "${tag.name}" is not firing on the "Consent Initialization" trigger.`,
        suggestion:
          'CMP loaders (Cookiebot, OneTrust, etc.) MUST fire on the GTM "Consent Initialization" trigger. Firing on "All Pages" or "DOM Ready" allows marketing pixels to execute before consent is established — a GDPR/CCPA violation.',
        affectedItem: tag.name,
        affectedId: tag.id,
      });
    }
  }

  return {
    score: Math.max(0, score),
    containerSizeBytes: sizeBytes,
    containerSizeWarning,
    issues,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isCMPTag(tag: ProcessedTag): boolean {
  const htmlContent = tag.parameters['html'];
  if (typeof htmlContent !== 'string') return false;
  return CMP_SCRIPT_PATTERNS.some((pattern) => pattern.test(htmlContent));
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
