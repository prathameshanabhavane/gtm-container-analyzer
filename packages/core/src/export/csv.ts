/**
 * @gtm-analyzer/core — CSV Exporter
 *
 * Compiles processed GTM entities (tags, triggers, variables) into
 * standard CSV format for download or spreadsheet analysis.
 *
 * Pure function, zero side effects.
 */

import type { ProcessedTag, ProcessedTrigger, ProcessedVariable } from '../types.js';

/**
 * Escapes values containing commas, newlines, or quotes for CSV safety.
 */
function escapeCsvValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Compiles a list of processed tags into a CSV string.
 */
export function compileTagsToCsv(tags: readonly ProcessedTag[]): string {
  const headers = ['Tag ID', 'Tag Name', 'Type Label', 'Triggers Count', 'Live Only', 'Notes'];
  const rows = tags.map((t) => [
    t.id,
    t.name,
    t.typeLabel,
    t.firingTriggerIds.length,
    t.isLiveOnly ? 'Yes' : 'No',
    t.notes ?? '',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map(escapeCsvValue).join(',')),
  ].join('\n');

  return csvContent;
}

/**
 * Compiles a list of processed triggers into a CSV string.
 */
export function compileTriggersToCsv(triggers: readonly ProcessedTrigger[]): string {
  const headers = ['Trigger ID', 'Trigger Name', 'Type Label', 'Conditions Count', 'Notes'];
  const rows = triggers.map((t) => [
    t.id,
    t.name,
    t.typeLabel,
    t.conditions.length,
    t.notes ?? '',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map(escapeCsvValue).join(',')),
  ].join('\n');

  return csvContent;
}

/**
 * Compiles a list of processed variables into a CSV string.
 */
export function compileVariablesToCsv(variables: readonly ProcessedVariable[]): string {
  const headers = ['Variable ID', 'Variable Name', 'Type Label', 'Notes'];
  const rows = variables.map((v) => [
    v.id,
    v.name,
    v.typeLabel,
    v.notes ?? '',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map(escapeCsvValue).join(',')),
  ].join('\n');

  return csvContent;
}
