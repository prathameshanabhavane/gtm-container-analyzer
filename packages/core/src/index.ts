/**
 * @gtm-analyzer/core — Public API
 *
 * This file is the single entry point for the package.
 * Import everything you need from '@gtm-analyzer/core'.
 *
 * Example:
 *   import { analyze, auditNaming, computeHealthScore } from '@gtm-analyzer/core';
 */

// ── Core Parser ────────────────────────────────────────────────────────────────
export { analyze } from './parser/index.js';

// ── Audit Engines ─────────────────────────────────────────────────────────────
export { auditNaming } from './audit/naming-auditor.js';
export { auditGA4 } from './audit/ga4-auditor.js';
export { auditPerformance } from './audit/performance-auditor.js';
export { auditCleanup, detectDuplicateTags, detectOrphanTriggers, detectUnusedVariables } from './audit/cleanup-auditor.js';

// ── Health Score ──────────────────────────────────────────────────────────────
export { computeHealthScore } from './analysis/health-score.js';
export type { HealthScoreInput } from './analysis/health-score.js';

// ── GA4 Correlation Engine ────────────────────────────────────────────────────
export { correlateGTMWithGA4, parseGA4EventLogs } from './analysis/ga4-correlation.js';
export type { GA4LiveEvent, TagCorrelationResult, CorrelationSummary } from './analysis/ga4-correlation.js';

// ── Compare / Diff ────────────────────────────────────────────────────────────
export { compareContainers } from './compare/diff.js';
export type { DiffItem, ContainerDiffResult } from './compare/diff.js';

// ── Variable Resolver ─────────────────────────────────────────────────────────
export { resolveVariableString } from './resolve/variable-resolver.js';

// ── Global Search ─────────────────────────────────────────────────────────────
export { globalSearch } from './search/global-search.js';
export type { SearchFilters, SearchResults } from './search/global-search.js';

// ── CSV Exporters ─────────────────────────────────────────────────────────────
export { compileTagsToCsv, compileTriggersToCsv, compileVariablesToCsv } from './export/csv.js';

// ── Deep Link Builder ─────────────────────────────────────────────────────────
export { buildGTMEditLink } from './links/gtm-links.js';
export type { GTMLinkParams } from './links/gtm-links.js';

// ── Security Utilities ────────────────────────────────────────────────────────
export { deepSanitize, sanitizeForDisplay, safeJSONMerge, redactCredentials, validateGTMJson } from './security/sanitizer.js';

// ── Constants ─────────────────────────────────────────────────────────────────
export {
  BASE_TAG_TYPE_MAP,
  TRIGGER_TYPE_MAP,
  VARIABLE_TYPE_MAP,
  CONDITION_TYPE_MAP,
  GA4_RESERVED_EVENT_NAMES,
  GA4_RECOMMENDED_EVENTS,
  CUSTOM_HTML_TEMPLATE_RECOMMENDATIONS,
  GTM_CONTAINER_SIZE_LIMIT_BYTES,
  GTM_CONTAINER_SIZE_WARNING_BYTES,
  GTM_CONTAINER_SIZE_CRITICAL_BYTES,
} from './constants/index.js';

// ── Error Classes ─────────────────────────────────────────────────────────────
export { GTMParseError, GTMValidationError, GTMAuditError, GTMSecurityError } from './errors.js';

// ── Types (all public) ────────────────────────────────────────────────────────
export type {
  // Raw GTM JSON types
  RawGTMExport,
  RawContainerVersion,
  RawTag,
  RawTrigger,
  RawVariable,
  RawFolder,
  RawParameter,
  RawCondition,
  RawCustomTemplate,
  RawBuiltInVariable,

  // Processed types
  ProcessedTag,
  ProcessedTrigger,
  ProcessedVariable,
  ProcessedFolder,
  ProcessedCondition,

  // The central contract
  ContainerContext,
  ParseOptions,

  // Audit result types
  IssueSeverity,
  AuditIssue,
  NamingAuditResult,
  GA4AuditResult,
  PerformanceAuditResult,
  CleanupAuditResult,
  DuplicateGroup,
  HealthScore,
} from './types.js';
