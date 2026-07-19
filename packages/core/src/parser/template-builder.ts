/**
 * @gtm-analyzer/core — Template Map Builder
 *
 * Builds a dynamic mapping from GTM internal type keys (like `cvt_1234567_1`)
 * to human-readable template names (like 'Meta Pixel', 'Hotjar').
 *
 * This is necessary because custom templates from the GTM Community Gallery
 * are referenced by dynamically generated IDs that change per-container.
 * We resolve them by scanning the `customTemplate` array in the export.
 *
 * Pure function — takes the raw export, returns a plain map.
 */

import type { RawGTMExport, RawTag } from '../types.js';

/**
 * Builds the dynamic template type map from a GTM container export.
 *
 * Strategy:
 *   1. Map container-specific templates (cvt_{containerId}_{templateId})
 *      using the `customTemplate` array in the export.
 *   2. Scan all tags to extract community template names from their metadata
 *      fields (some tags carry their template name in parameters).
 *
 * @param data - The raw GTM container export
 * @returns A map from type key to display name
 */
export function buildTemplateMap(data: RawGTMExport): Record<string, string> {
  const map: Record<string, string> = {};
  const containerId = data.containerVersion?.container?.containerId;
  const templates = data.containerVersion?.customTemplate ?? [];
  const allTags: RawTag[] = data.containerVersion?.tag ?? [];

  // ── Strategy 1: Map container-specific custom templates ────────────────────
  for (const template of templates) {
    if (template.templateId && template.name) {
      // Container-specific key: cvt_{containerId}_{templateId}
      if (containerId) {
        const typeKey = `cvt_${containerId}_${template.templateId}`;
        map[typeKey] = template.name;
      }

      // Gallery reference key: cvt_{galleryOwner}_{galleryRepo}
      if (template.galleryReference?.owner && template.galleryReference?.repository) {
        const galleryKey = `cvt_${template.galleryReference.owner}_${template.galleryReference.repository}`;
        map[galleryKey] = template.name;
      }
    }
  }

  // ── Strategy 2: Scan tag metadata for community template names ─────────────
  // Some tags from the community gallery embed their display name in parameters
  for (const tag of allTags) {
    if (tag.type && tag.type.startsWith('cvt_') && !(tag.type in map)) {
      // Try to extract display name from tag metadata parameters
      const metaNameParam = tag.parameter?.find((p) => p.key === 'gtmTagType');
      if (metaNameParam?.value) {
        map[tag.type] = metaNameParam.value;
      }
    }
  }

  return map;
}
