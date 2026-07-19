/**
 * @gtm-analyzer/core — Health Score Engine
 *
 * Computes a 0–100 composite health score for a GTM container based on
 * the results from all audit modules. Outputs a letter grade (A–F).
 *
 * Deduction model (from governance-best-practices.md & security spec):
 *   - Naming violations:    -2 per violation (max -20)
 *   - Duplicate tags:       -15 per group
 *   - Orphan triggers:      -3 per trigger (max -15)
 *   - Unused variables:     -1 per variable (max -10)
 *   - GA4 violations:       -5 per critical, -2 per warning
 *   - Performance issues:   applied from PerformanceAuditResult.score delta
 *   - Security issues:      -10 per critical security finding
 */

import type {
  ContainerContext,
  HealthScore,
  NamingAuditResult,
  GA4AuditResult,
  PerformanceAuditResult,
  CleanupAuditResult,
} from '../types.js';

export interface HealthScoreInput {
  ctx: ContainerContext;
  naming: NamingAuditResult;
  ga4: GA4AuditResult;
  performance: PerformanceAuditResult;
  cleanup: CleanupAuditResult;
}

/**
 * Computes the composite health score from all audit results.
 * Returns a score 0–100 and a letter grade.
 */
export function computeHealthScore(input: HealthScoreInput): HealthScore {
  let namingScore = 100;
  let performanceScore = 100;
  let cleanupScore = 100;
  let ga4Score = 100;
  const securityScore = 100; // Will be wired to security audit in future

  // ── Naming deductions ────────────────────────────────────────────────────────
  const namingDeduction = Math.min(input.naming.violationCount * 2, 20);
  namingScore -= namingDeduction;

  // ── GA4 deductions ───────────────────────────────────────────────────────────
  const ga4CriticalCount = input.ga4.issues.filter((i) => i.severity === 'critical').length;
  const ga4WarningCount = input.ga4.issues.filter((i) => i.severity === 'warning').length;
  const ga4Deduction = Math.min(ga4CriticalCount * 5 + ga4WarningCount * 2, 30);
  ga4Score -= ga4Deduction;

  // ── Performance deductions (use PerformanceAuditResult.score as the component score) ──
  performanceScore = input.performance.score;

  // ── Cleanup deductions ───────────────────────────────────────────────────────
  const duplicateDeduction = Math.min(input.cleanup.duplicateTags.length * 15, 30);
  const orphanDeduction = Math.min(input.cleanup.orphanTriggers.length * 3, 15);
  const unusedDeduction = Math.min(input.cleanup.unusedVariables.length * 1, 10);
  cleanupScore -= duplicateDeduction + orphanDeduction + unusedDeduction;

  namingScore = Math.max(0, namingScore);
  performanceScore = Math.max(0, performanceScore);
  cleanupScore = Math.max(0, cleanupScore);
  ga4Score = Math.max(0, ga4Score);

  // ── Weighted composite score ─────────────────────────────────────────────────
  // Weights: performance 30%, cleanup 25%, naming 20%, ga4 15%, security 10%
  const total = Math.round(
    performanceScore * 0.3 +
    cleanupScore * 0.25 +
    namingScore * 0.2 +
    ga4Score * 0.15 +
    securityScore * 0.1,
  );

  return {
    total,
    grade: scoreToGrade(total),
    breakdown: {
      naming: namingScore,
      performance: performanceScore,
      cleanup: cleanupScore,
      ga4: ga4Score,
      security: securityScore,
    },
  };
}

function scoreToGrade(score: number): HealthScore['grade'] {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 45) return 'D';
  return 'F';
}
