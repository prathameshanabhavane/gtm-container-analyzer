/**
 * @gtm-analyzer/core — Naming Convention Auditor
 *
 * Validates tag, trigger, and variable names against standard naming schemas.
 *
 * Rules from governance-best-practices.md §1:
 *   - Tags:      `[Type/Platform] – [Action/Event] – [Detail/Page]`
 *   - Triggers:  `TR – [Type] – [Detail]`
 *   - Variables: `[Type] – [Detail]`
 *   - Alphabetical prefix enforcement (flags tags without a platform prefix)
 *   - Folder governance (flags containers where >20% of tags lack a folder)
 */

import type {
  ContainerContext,
  NamingAuditResult,
  AuditIssue,
} from '../types.js';

// ─── Naming Pattern Definitions ───────────────────────────────────────────────

/**
 * Tag naming pattern: starts with a platform/type word (letters only), then dash separator.
 * Valid: "GA4 – Event – Purchase", "Meta Pixel – PageView – All Pages"
 * Invalid: "fb pixel purchase", "google analytics pageview final"
 */
const TAG_NAME_PATTERN = /^[A-Za-z0-9 ]+\s*[–-]\s*.+/;

/**
 * Trigger naming: must start with "TR" prefix.
 * Valid: "TR – Click – CTA Button", "TR - Custom Event - purchase"
 */
const TRIGGER_NAME_PATTERN = /^TR\s*[–-]\s*.+/i;

/**
 * Variable naming: `[TYPE] – [Detail]`
 * Valid: "DLV – Transaction ID", "JS – Browser Language", "CJS – User Status"
 */
const VARIABLE_NAME_PATTERN = /^[A-Z]{1,5}\s*[–-]\s*.+/;

// Known GTM built-in variable names that follow their own conventions
const BUILT_IN_VARIABLE_NAMES = new Set([
  'Page URL', 'Page Hostname', 'Page Path', 'Referrer',
  'Event', 'Environment Name', 'Container ID', 'Container Version',
  'Click Element', 'Click Classes', 'Click ID', 'Click Target', 'Click URL', 'Click Text',
  'Form Element', 'Form Classes', 'Form ID', 'Form Target', 'Form URL', 'Form Text',
  'Error Message', 'Error URL', 'Error Line', 'Debug Mode',
  'Scroll Depth Threshold', 'Scroll Depth Units', 'Scroll Direction',
  'Video Current Time', 'Video Duration', 'Video Percent', 'Video Provider', 'Video Status', 'Video Title', 'Video URL', 'Video Visible',
  'History Source', 'History State', 'History New URL Fragment', 'History Old URL Fragment', 'New History State', 'Old History State',
]);

// ─── Auditor ──────────────────────────────────────────────────────────────────

/**
 * Audits naming conventions across all tags, triggers, and variables.
 *
 * @param ctx - The container context to audit
 * @returns A NamingAuditResult with issue list and compliance metrics
 */
export function auditNaming(ctx: ContainerContext): NamingAuditResult {
  const issues: AuditIssue[] = [];
  let totalItems = 0;
  let violations = 0;

  // ── Tag naming audit ────────────────────────────────────────────────────────
  for (const tag of ctx.tags) {
    totalItems++;
    if (!TAG_NAME_PATTERN.test(tag.name)) {
      violations++;
      issues.push({
        code: 'NAMING_TAG_PATTERN',
        severity: 'warning',
        message: `Tag "${tag.name}" does not follow the naming convention.`,
        suggestion: `Rename to format: "[Platform] – [Action] – [Detail]" (e.g., "GA4 – Event – Purchase").`,
        affectedItem: tag.name,
        affectedId: tag.id,
      });
    }
  }

  // ── Trigger naming audit ─────────────────────────────────────────────────────
  for (const trigger of ctx.triggers) {
    totalItems++;
    if (!TRIGGER_NAME_PATTERN.test(trigger.name)) {
      violations++;
      issues.push({
        code: 'NAMING_TRIGGER_PATTERN',
        severity: 'warning',
        message: `Trigger "${trigger.name}" does not follow the naming convention.`,
        suggestion: `Rename to format: "TR – [Type] – [Detail]" (e.g., "TR – Custom Event – purchase").`,
        affectedItem: trigger.name,
        affectedId: trigger.id,
      });
    }
  }

  // ── Variable naming audit ────────────────────────────────────────────────────
  for (const variable of ctx.variables) {
    // Skip built-in variables — they have their own convention
    if (BUILT_IN_VARIABLE_NAMES.has(variable.name)) continue;
    totalItems++;
    if (!VARIABLE_NAME_PATTERN.test(variable.name)) {
      violations++;
      issues.push({
        code: 'NAMING_VARIABLE_PATTERN',
        severity: 'info',
        message: `Variable "${variable.name}" does not follow the naming convention.`,
        suggestion: `Rename to format: "[TYPE] – [Detail]" (e.g., "DLV – Transaction ID", "JS – Page Category").`,
        affectedItem: variable.name,
        affectedId: variable.id,
      });
    }
  }

  // ── Folder governance audit (>20% tags without a folder) ────────────────────
  const tagCount = ctx.tags.length;
  if (tagCount > 0) {
    const tagsWithoutFolder = ctx.tags.filter((t) => !t.folderId).length;
    const folderOrphanPercent = tagsWithoutFolder / tagCount;

    if (folderOrphanPercent > 0.2) {
      issues.push({
        code: 'NAMING_FOLDER_GOVERNANCE',
        severity: 'info',
        message: `${tagsWithoutFolder} of ${tagCount} tags (${Math.round(folderOrphanPercent * 100)}%) are not organized in any folder.`,
        suggestion:
          'Google recommends using GTM folders to organize tags by tool or team. Create folders (e.g., "GA4", "Meta", "Utilities") and move tags into them.',
      });
    }
  }

  const compliantCount = totalItems - violations;
  const compliancePercent =
    totalItems > 0 ? Math.round((compliantCount / totalItems) * 100) : 100;

  return {
    compliantCount,
    violationCount: violations,
    compliancePercent,
    issues,
  };
}
