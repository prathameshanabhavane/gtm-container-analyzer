/**
 * @gtm-analyzer/core — Trigger Processor
 *
 * Resolves trigger type labels and extracts condition data from raw GTM triggers.
 * Pure functions, no side effects.
 */

import type { ProcessedCondition, RawCondition, RawTrigger } from '../types.js';
import { TRIGGER_TYPE_MAP, CONDITION_TYPE_MAP } from '../constants/index.js';

/**
 * Resolves a human-readable label for a trigger type.
 * Falls back to a formatted version of the raw type string.
 */
export function resolveTriggerTypeLabel(type: string): string {
  return TRIGGER_TYPE_MAP[type] ?? formatUnknownType(type);
}

/**
 * Extracts and normalizes all condition arrays from a raw trigger.
 *
 * GTM stores conditions in three separate arrays depending on the trigger type:
 *   - `filter`: Standard conditions for page/click triggers
 *   - `customEventFilter`: Conditions for Custom Event triggers
 *   - `autoEventFilter`: Conditions for auto-event triggers (scroll, visibility)
 *
 * This function merges them into a single typed array for uniform processing.
 */
export function extractTriggerConditions(
  raw: RawTrigger,
): ProcessedCondition[] {
  const allConditions: RawCondition[] = [
    ...(raw.filter ?? []),
    ...(raw.customEventFilter ?? []),
    ...(raw.autoEventFilter ?? []),
  ];

  return allConditions.flatMap((condition) =>
    processCondition(condition),
  );
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

function processCondition(condition: RawCondition): ProcessedCondition[] {
  const params = condition.parameter ?? [];

  // GTM conditions have a specific parameter layout:
  //   arg0 = the variable reference (e.g., "{{Page URL}}")
  //   arg1 = the comparison value (e.g., "/checkout")
  const arg0 = params.find((p) => p.key === 'arg0')?.value ?? '';
  const arg1 = params.find((p) => p.key === 'arg1')?.value ?? '';

  const operator = CONDITION_TYPE_MAP[condition.type] ?? condition.type;

  return [
    {
      type: condition.type,
      parameter: arg0,
      operator,
      value: arg1,
    },
  ];
}

/** Formats an unknown trigger type key into a readable string */
function formatUnknownType(type: string): string {
  // Convert camelCase to Title Case with spaces
  return type
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}
