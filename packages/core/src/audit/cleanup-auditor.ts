/**
 * @gtm-analyzer/core — Cleanup Auditors
 *
 * Three audit modules that detect container cleanup opportunities:
 *   1. Duplicate tag detector
 *   2. Orphan trigger detector
 *   3. Unused variable detector
 *
 * All functions are pure — they receive ContainerContext and return results.
 * Migrated and upgraded from:
 *   - src/data/cleanup/duplicates.js
 *   - src/data/cleanup/orphanTriggers.js
 *   - src/data/cleanup/unusedVariables.js
 */

import type {
  ContainerContext,
  CleanupAuditResult,
  DuplicateGroup,
  ProcessedTag,
  ProcessedTrigger,
  ProcessedVariable,
} from '../types.js';

// ─── Main Entry Point ─────────────────────────────────────────────────────────

/**
 * Runs all three cleanup audits and returns combined results.
 */
export function auditCleanup(ctx: ContainerContext): CleanupAuditResult {
  return {
    duplicateTags: detectDuplicateTags(ctx),
    orphanTriggers: detectOrphanTriggers(ctx),
    unusedVariables: detectUnusedVariables(ctx),
  };
}

// ─── 1. Duplicate Tag Detector ────────────────────────────────────────────────

/**
 * Detects groups of tags that appear to be duplicates.
 *
 * Two tags are considered duplicates if they share:
 *   - Same type AND same set of firing trigger IDs
 *   - OR same name (exact match — catch copy-paste issues)
 */
export function detectDuplicateTags(ctx: ContainerContext): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];

  // ── Group by type + trigger signature ───────────────────────────────────────
  const typeSignatureMap = new Map<string, ProcessedTag[]>();

  for (const tag of ctx.tags) {
    const triggerKey = [...tag.firingTriggerIds].sort().join(',');
    const signature = `${tag.type}::${triggerKey}`;

    if (!typeSignatureMap.has(signature)) {
      typeSignatureMap.set(signature, []);
    }
    typeSignatureMap.get(signature)!.push(tag);
  }

  for (const [signature, tags] of typeSignatureMap) {
    if (tags.length > 1) {
      const [type] = signature.split('::');
      groups.push({
        reason: `${tags.length} tags of the same type ("${type}") fire on the same trigger set.`,
        tags,
      });
    }
  }

  // ── Group by exact name ──────────────────────────────────────────────────────
  const nameMap = new Map<string, ProcessedTag[]>();
  for (const tag of ctx.tags) {
    const key = tag.name.trim().toLowerCase();
    if (!nameMap.has(key)) nameMap.set(key, []);
    nameMap.get(key)!.push(tag);
  }

  for (const [name, tags] of nameMap) {
    if (tags.length > 1) {
      groups.push({
        reason: `${tags.length} tags share the exact same name: "${name}".`,
        tags,
      });
    }
  }

  return groups;
}

// ─── 2. Orphan Trigger Detector ───────────────────────────────────────────────

/**
 * Detects triggers that are not referenced by any tag.
 *
 * Orphan triggers waste container compile space and confuse developers.
 * They accumulate when tags are deleted but their triggers are left behind.
 */
export function detectOrphanTriggers(ctx: ContainerContext): ProcessedTrigger[] {
  // Build a set of all trigger IDs that are actually referenced by tags
  const referencedTriggerIds = new Set<string>();

  for (const tag of ctx.tags) {
    for (const id of tag.firingTriggerIds) {
      referencedTriggerIds.add(id);
    }
    for (const id of tag.blockingTriggerIds) {
      referencedTriggerIds.add(id);
    }
  }

  // The "All Pages" trigger (triggerId: "0") is a GTM built-in — never orphaned
  referencedTriggerIds.add('0');

  return ctx.triggers.filter(
    (trigger) => !referencedTriggerIds.has(trigger.id),
  );
}

// ─── 3. Unused Variable Detector ─────────────────────────────────────────────

/**
 * Detects variables that are not referenced anywhere in the container.
 *
 * A variable is "used" if its `{{variable name}}` template syntax appears
 * in any tag parameter, trigger condition, or other variable parameter.
 */
export function detectUnusedVariables(ctx: ContainerContext): ProcessedVariable[] {
  // Build a set of all referenced variable names by scanning all parameter strings
  const referencedVariableNames = new Set<string>();

  // Regex: matches {{VariableName}} GTM template syntax
  const variableRefPattern = /\{\{([^}]+)\}\}/g;

  const scanString = (str: string): void => {
    let match: RegExpExecArray | null;
    while ((match = variableRefPattern.exec(str)) !== null) {
      if (match[1]) {
        referencedVariableNames.add(match[1].trim());
      }
    }
  };

  const scanObject = (obj: unknown, depth = 0): void => {
    if (depth > 10) return; // DoS guard
    if (typeof obj === 'string') {
      scanString(obj);
    } else if (Array.isArray(obj)) {
      for (const item of obj) scanObject(item, depth + 1);
    } else if (obj !== null && typeof obj === 'object') {
      for (const value of Object.values(obj as Record<string, unknown>)) {
        scanObject(value, depth + 1);
      }
    }
  };

  // Scan all tag parameters
  for (const tag of ctx.tags) {
    scanObject(tag.parameters);
  }

  // Scan all trigger conditions
  for (const trigger of ctx.triggers) {
    for (const condition of trigger.conditions) {
      scanString(condition.parameter);
      scanString(condition.value);
    }
    scanObject(trigger.parameters);
  }

  // Scan all variable parameters (variables can reference other variables)
  for (const variable of ctx.variables) {
    scanObject(variable.parameters);
  }

  // Return variables whose names never appear in any reference
  return ctx.variables.filter(
    (variable) => !referencedVariableNames.has(variable.name),
  );
}
