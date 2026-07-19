/**
 * @gtm-analyzer/core — Container Diff Engine
 *
 * Compares two GTM container contexts (Container A vs Container B)
 * and returns structural differences: additions, deletions, and modifications
 * for tags, triggers, and variables.
 *
 * Pure function, zero side effects.
 */

import type { ContainerContext } from '../types.js';

export interface DiffItem<T> {
  id: string;
  name: string;
  typeLabel: string;
  changeType: 'added' | 'deleted' | 'modified';
  before?: T;
  after?: T;
  details?: string[];
}

export interface ContainerDiffResult {
  tags: DiffItem<any>[];
  triggers: DiffItem<any>[];
  variables: DiffItem<any>[];
  summary: {
    addedCount: number;
    deletedCount: number;
    modifiedCount: number;
  };
}

/**
 * Compares Container A (before) with Container B (after).
 */
export function compareContainers(
  a: ContainerContext,
  b: ContainerContext,
): ContainerDiffResult {
  const tags: DiffItem<any>[] = [];
  const triggers: DiffItem<any>[] = [];
  const variables: DiffItem<any>[] = [];

  // ── 1. Diff Tags ────────────────────────────────────────────────────────────
  // Added tags (in B but not A)
  for (const tagB of b.tags) {
    const tagA = a.tagById.get(tagB.id) || findByName(a.tags, tagB.name);
    if (!tagA) {
      tags.push({
        id: tagB.id,
        name: tagB.name,
        typeLabel: tagB.typeLabel,
        changeType: 'added',
        after: tagB,
      });
    } else {
      // Exists in both, check for modification
      const diffDetails = getTagDiffDetails(tagA, tagB);
      if (diffDetails.length > 0) {
        tags.push({
          id: tagB.id,
          name: tagB.name,
          typeLabel: tagB.typeLabel,
          changeType: 'modified',
          before: tagA,
          after: tagB,
          details: diffDetails,
        });
      }
    }
  }
  // Deleted tags (in A but not B)
  for (const tagA of a.tags) {
    const tagB = b.tagById.get(tagA.id) || findByName(b.tags, tagA.name);
    if (!tagB) {
      tags.push({
        id: tagA.id,
        name: tagA.name,
        typeLabel: tagA.typeLabel,
        changeType: 'deleted',
        before: tagA,
      });
    }
  }

  // ── 2. Diff Triggers ────────────────────────────────────────────────────────
  for (const trigB of b.triggers) {
    const trigA = a.triggerById.get(trigB.id) || findByName(a.triggers, trigB.name);
    if (!trigA) {
      triggers.push({
        id: trigB.id,
        name: trigB.name,
        typeLabel: trigB.typeLabel,
        changeType: 'added',
        after: trigB,
      });
    } else {
      const diffDetails = getTriggerDiffDetails(trigA, trigB);
      if (diffDetails.length > 0) {
        triggers.push({
          id: trigB.id,
          name: trigB.name,
          typeLabel: trigB.typeLabel,
          changeType: 'modified',
          before: trigA,
          after: trigB,
          details: diffDetails,
        });
      }
    }
  }
  for (const trigA of a.triggers) {
    const trigB = b.triggerById.get(trigA.id) || findByName(b.triggers, trigA.name);
    if (!trigB) {
      triggers.push({
        id: trigA.id,
        name: trigA.name,
        typeLabel: trigA.typeLabel,
        changeType: 'deleted',
        before: trigA,
      });
    }
  }

  // ── 3. Diff Variables ───────────────────────────────────────────────────────
  for (const varB of b.variables) {
    const varA = a.variableById.get(varB.id) || findByName(a.variables, varB.name);
    if (!varA) {
      variables.push({
        id: varB.id,
        name: varB.name,
        typeLabel: varB.typeLabel,
        changeType: 'added',
        after: varB,
      });
    } else {
      const diffDetails = getVariableDiffDetails(varA, varB);
      if (diffDetails.length > 0) {
        variables.push({
          id: varB.id,
          name: varB.name,
          typeLabel: varB.typeLabel,
          changeType: 'modified',
          before: varA,
          after: varB,
          details: diffDetails,
        });
      }
    }
  }
  for (const varA of a.variables) {
    const varB = b.variableById.get(varA.id) || findByName(b.variables, varA.name);
    if (!varB) {
      variables.push({
        id: varA.id,
        name: varA.name,
        typeLabel: varA.typeLabel,
        changeType: 'deleted',
        before: varA,
      });
    }
  }

  const addedCount =
    tags.filter((t) => t.changeType === 'added').length +
    triggers.filter((t) => t.changeType === 'added').length +
    variables.filter((t) => t.changeType === 'added').length;

  const deletedCount =
    tags.filter((t) => t.changeType === 'deleted').length +
    triggers.filter((t) => t.changeType === 'deleted').length +
    variables.filter((t) => t.changeType === 'deleted').length;

  const modifiedCount =
    tags.filter((t) => t.changeType === 'modified').length +
    triggers.filter((t) => t.changeType === 'modified').length +
    variables.filter((t) => t.changeType === 'modified').length;

  return {
    tags,
    triggers,
    variables,
    summary: { addedCount, deletedCount, modifiedCount },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findByName<T extends { name: string }>(items: readonly T[], name: string): T | undefined {
  return items.find((item) => item.name === name);
}

function getTagDiffDetails(a: any, b: any): string[] {
  const details: string[] = [];
  if (a.name !== b.name) details.push(`Name changed: "${a.name}" ➔ "${b.name}"`);
  if (a.typeLabel !== b.typeLabel) details.push(`Type changed: "${a.typeLabel}" ➔ "${b.typeLabel}"`);
  
  // Triggers diff
  const triggersA = [...a.firingTriggerIds].sort().join(',');
  const triggersB = [...b.firingTriggerIds].sort().join(',');
  if (triggersA !== triggersB) {
    details.push('Firing trigger rules modified.');
  }

  // Parameters diff
  const keys = new Set([...Object.keys(a.parameters), ...Object.keys(b.parameters)]);
  for (const key of keys) {
    const valA = JSON.stringify(a.parameters[key]);
    const valB = JSON.stringify(b.parameters[key]);
    if (valA !== valB) {
      details.push(`Parameter "${key}" modified.`);
    }
  }

  return details;
}

function getTriggerDiffDetails(a: any, b: any): string[] {
  const details: string[] = [];
  if (a.name !== b.name) details.push(`Name changed: "${a.name}" ➔ "${b.name}"`);
  if (a.typeLabel !== b.typeLabel) details.push(`Type changed: "${a.typeLabel}" ➔ "${b.typeLabel}"`);

  // Compare conditions count & strings
  if (a.conditions.length !== b.conditions.length) {
    details.push(`Conditions count changed: ${a.conditions.length} ➔ ${b.conditions.length}`);
  } else {
    for (let i = 0; i < a.conditions.length; i++) {
      const condA = `${a.conditions[i].parameter} ${a.conditions[i].operator} ${a.conditions[i].value}`;
      const condB = `${b.conditions[i].parameter} ${b.conditions[i].operator} ${b.conditions[i].value}`;
      if (condA !== condB) {
        details.push(`Condition #${i + 1} modified.`);
      }
    }
  }

  return details;
}

function getVariableDiffDetails(a: any, b: any): string[] {
  const details: string[] = [];
  if (a.name !== b.name) details.push(`Name changed: "${a.name}" ➔ "${b.name}"`);
  if (a.typeLabel !== b.typeLabel) details.push(`Type changed: "${a.typeLabel}" ➔ "${b.typeLabel}"`);

  // Compare parameters
  const keys = new Set([...Object.keys(a.parameters), ...Object.keys(b.parameters)]);
  for (const key of keys) {
    const valA = JSON.stringify(a.parameters[key]);
    const valB = JSON.stringify(b.parameters[key]);
    if (valA !== valB) {
      details.push(`Parameter "${key}" modified.`);
    }
  }

  return details;
}
