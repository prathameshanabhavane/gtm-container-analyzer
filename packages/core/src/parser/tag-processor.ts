/**
 * @gtm-analyzer/core — Tag Processor
 *
 * Resolves tag type labels and extracts parameter data from raw GTM tags.
 * All functions are pure — they take inputs and return outputs with no side effects.
 */

import type { RawParameter } from '../types.js';
import { CUSTOM_HTML_TEMPLATE_RECOMMENDATIONS } from '../constants/index.js';

/**
 * Resolves a human-readable display label for a tag's type.
 *
 * Resolution order:
 *   1. Look up in the full type map (built-ins + dynamic templates)
 *   2. If type is 'html', scan parameter values for known vendor scripts
 *      to provide a more specific label (e.g., "Custom HTML (Meta Pixel?)")
 *   3. Fall back to `Unknown (type_key)` format
 */
export function resolveTagTypeLabel(
  type: string,
  parameters: RawParameter[] | undefined,
  typeMap: Record<string, string>,
): string {
  // Direct map lookup (most common path)
  const mapped = typeMap[type];
  if (mapped) return mapped;

  // For custom HTML, try to detect the embedded vendor script
  if (type === 'html' && parameters) {
    const htmlParam = parameters.find((p) => p.key === 'html');
    if (htmlParam?.value) {
      for (const rec of CUSTOM_HTML_TEMPLATE_RECOMMENDATIONS) {
        if (rec.detectPattern.test(htmlParam.value)) {
          return `Custom HTML (${rec.platformName})`;
        }
      }
    }
    return 'Custom HTML';
  }

  return `Unknown (${type})`;
}

/**
 * Extracts tag parameters into a flat, typed key-value record.
 * Handles nested list and map parameter types.
 *
 * Special handling:
 *   - `gaSettings` template variables are expanded to their referenced name
 *   - Consent type parameters are preserved as arrays
 */
export function extractTagParameters(params: RawParameter[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const param of params) {
    if (!param.key) continue;

    switch (param.type) {
      case 'template':
      case 'boolean':
      case 'integer':
        result[param.key] = param.value ?? null;
        break;

      case 'list':
        result[param.key] = (param.list ?? []).map((item) =>
          extractFlatParam(item),
        );
        break;

      case 'map': {
        const mapResult: Record<string, unknown> = {};
        for (const entry of param.map ?? []) {
          if (entry.key) {
            mapResult[entry.key] = extractFlatParam(entry);
          }
        }
        result[param.key] = mapResult;
        break;
      }

      default:
        result[param.key] = param.value ?? null;
    }
  }

  return result;
}

/** Recursively resolves a single parameter to its scalar/structured value */
function extractFlatParam(param: RawParameter): unknown {
  if (param.type === 'list') {
    return (param.list ?? []).map(extractFlatParam);
  }
  if (param.type === 'map') {
    const m: Record<string, unknown> = {};
    for (const entry of param.map ?? []) {
      if (entry.key) m[entry.key] = extractFlatParam(entry);
    }
    return m;
  }
  return param.value ?? null;
}
