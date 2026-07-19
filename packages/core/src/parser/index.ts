/**
 * @gtm-analyzer/core — Main Parser Entry Point
 *
 * analyze(rawJson) is the single public entry point for the parsing pipeline.
 *
 * Design principles:
 *   - Pure function: same input always produces same output
 *   - Immutable output: ContainerContext is frozen after creation
 *   - Stateless: no module-level mutable variables
 *   - Fail-fast: security validation runs before any parsing
 *
 * Usage:
 *   import { analyze } from '@gtm-analyzer/core';
 *   const ctx = analyze(uploadedJson);
 *   // ctx is now fully typed, immutable, and safe to pass to any auditor
 */

import type {
  ContainerContext,
  ParseOptions,
  ProcessedTag,
  ProcessedTrigger,
  ProcessedVariable,
  ProcessedFolder,
  RawGTMExport,
  RawTag,
  RawTrigger,
  RawVariable,
  RawFolder,
  RawParameter,
} from '../types.js';

import { validateGTMJson } from '../security/sanitizer.js';
import { BASE_TAG_TYPE_MAP, TRIGGER_TYPE_MAP, VARIABLE_TYPE_MAP } from '../constants/index.js';
import { buildTemplateMap } from './template-builder.js';
import { extractTagParameters, resolveTagTypeLabel } from './tag-processor.js';
import { extractTriggerConditions, resolveTriggerTypeLabel } from './trigger-processor.js';

// ─── Main Entry Point ─────────────────────────────────────────────────────────

/**
 * Analyzes a raw GTM JSON export and returns an immutable ContainerContext.
 *
 * @param rawJson - The parsed JSON object from a GTM container export file
 * @param options - Optional parsing options
 * @returns A fully typed, immutable ContainerContext
 * @throws GTMParseError if the JSON is structurally invalid or contains security issues
 * @throws GTMValidationError if Zod schema validation fails
 */
export function analyze(rawJson: unknown, options: ParseOptions = {}): ContainerContext {
  // ── Step 1: Security validation (throws on failure) ─────────────────────────
  validateGTMJson(rawJson);

  // After validation, we know this is a valid GTM export shape
  const data = rawJson as unknown as RawGTMExport;
  const cv = data.containerVersion;

  // ── Step 2: Build dynamic template type map ──────────────────────────────────
  const dynamicTemplateMap = buildTemplateMap(data);
  const fullTagTypeMap: Record<string, string> = {
    ...BASE_TAG_TYPE_MAP,
    ...dynamicTemplateMap,
  };

  // ── Step 3: Extract raw collections (safe defaults) ──────────────────────────
  const rawTags: RawTag[] = cv.tag ?? [];
  const rawTriggers: RawTrigger[] = cv.trigger ?? [];
  const rawVariables: RawVariable[] = cv.variable ?? [];
  const rawFolders: RawFolder[] = cv.folder ?? [];

  // ── Step 4: Process each entity type ─────────────────────────────────────────
  const tags = rawTags.map((tag) =>
    processTag(tag, fullTagTypeMap, options),
  );

  const triggers = rawTriggers.map((trigger) =>
    processTrigger(trigger, options),
  );

  const variables = rawVariables.map((variable) =>
    processVariable(variable, options),
  );

  const folders = rawFolders.map(
    (folder): ProcessedFolder => ({
      id: folder.folderId ?? '',
      name: folder.name,
    }),
  );

  // ── Step 5: Build O(1) lookup maps ───────────────────────────────────────────
  const tagById = new Map(tags.map((t) => [t.id, t]));
  const triggerById = new Map(triggers.map((t) => [t.id, t]));
  const variableById = new Map(variables.map((v) => [v.id, v]));
  const folderById = new Map(folders.map((f) => [f.id, f]));

  // ── Step 6: Compute container size stat ──────────────────────────────────────
  const containerSizeBytes = JSON.stringify(data).length;

  // ── Step 7: Assemble and freeze the context ───────────────────────────────────
  const context: ContainerContext = Object.freeze({
    analyzedAt: new Date().toISOString(),

    // Container metadata
    containerName: cv.name ?? 'Unnamed Container',
    containerPublicId: cv.container?.publicId ?? '',
    accountId: cv.accountId ?? '',
    containerId: cv.containerId ?? '',
    exportTime: data.exportTime ?? '',
    exportFormatVersion: data.exportFormatVersion ?? 0,

    // Processed collections (frozen arrays)
    tags: Object.freeze(tags),
    triggers: Object.freeze(triggers),
    variables: Object.freeze(variables),
    folders: Object.freeze(folders),
    builtInVariables: Object.freeze(cv.builtInVariable ?? []),
    customTemplates: Object.freeze(cv.customTemplate ?? []),

    // Lookup maps
    tagById,
    triggerById,
    variableById,
    folderById,

    // Pre-computed stats
    stats: Object.freeze({
      tagCount: tags.length,
      triggerCount: triggers.length,
      variableCount: variables.length,
      folderCount: folders.length,
      customTemplateCount: (cv.customTemplate ?? []).length,
      containerSizeBytes,
    }),
  });

  return context;
}

// ─── Entity Processors ────────────────────────────────────────────────────────

function processTag(
  raw: RawTag,
  typeMap: Record<string, string>,
  _options: ParseOptions,
): ProcessedTag {
  return {
    id: raw.tagId ?? '',
    name: raw.name,
    type: raw.type,
    typeLabel: resolveTagTypeLabel(raw.type, raw.parameter, typeMap),
    firingTriggerIds: raw.firingTriggerId ?? [],
    blockingTriggerIds: raw.blockingTriggerId ?? [],
    parameters: extractTagParameters(raw.parameter ?? []),
    consentStatus: raw.consentSettings?.consentStatus ?? null,
    consentTypes: extractConsentTypes(raw.consentSettings?.consentType),
    folderId: raw.parentFolderId ?? null,
    notes: raw.notes ?? null,
    isLiveOnly: raw.liveOnly ?? false,
    raw,
  };
}

function processTrigger(
  raw: RawTrigger,
  _options: ParseOptions,
): ProcessedTrigger {
  return {
    id: raw.triggerId ?? '',
    name: raw.name,
    type: raw.type,
    typeLabel: resolveTriggerTypeLabel(raw.type),
    parameters: extractParameters(raw.parameter ?? []),
    conditions: extractTriggerConditions(raw),
    folderId: raw.parentFolderId ?? null,
    notes: raw.notes ?? null,
    raw,
  };
}

function processVariable(
  raw: RawVariable,
  _options: ParseOptions,
): ProcessedVariable {
  const typeLabel = VARIABLE_TYPE_MAP[raw.type] ?? `Unknown (${raw.type})`;
  return {
    id: raw.variableId ?? '',
    name: raw.name,
    type: raw.type,
    typeLabel,
    parameters: extractParameters(raw.parameter ?? []),
    folderId: raw.parentFolderId ?? null,
    notes: raw.notes ?? null,
    raw,
  };
}

// ─── Parameter Helpers ────────────────────────────────────────────────────────

/**
 * Converts a flat GTM parameter array into a typed key-value record.
 * Handles all GTM parameter types: template, boolean, integer, list, map.
 */
function extractParameters(params: RawParameter[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const param of params) {
    if (!param.key) continue;
    result[param.key] = resolveParamValue(param);
  }
  return result;
}

function resolveParamValue(param: RawParameter): unknown {
  switch (param.type) {
    case 'template':
    case 'boolean':
    case 'integer':
      return param.value ?? null;
    case 'list':
      return (param.list ?? []).map(resolveParamValue);
    case 'map': {
      const map: Record<string, unknown> = {};
      for (const entry of param.map ?? []) {
        if (entry.key) {
          map[entry.key] = resolveParamValue(entry);
        }
      }
      return map;
    }
    default:
      return param.value ?? null;
  }
}

function extractConsentTypes(
  consentTypeParam: RawParameter[] | undefined,
): string[] {
  if (!consentTypeParam) return [];
  return consentTypeParam
    .filter((p) => p.type === 'template' && p.value)
    .map((p) => p.value as string);
}
