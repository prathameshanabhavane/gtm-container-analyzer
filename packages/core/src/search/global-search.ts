/**
 * @gtm-analyzer/core — Global Search Utility
 *
 * Implements standard, fast multi-filter search queries across tags, triggers,
 * and variables in a container context.
 *
 * Pure function, zero side effects.
 */

import type { ContainerContext, ProcessedTag, ProcessedTrigger, ProcessedVariable } from '../types.js';

export interface SearchFilters {
  query?: string;
  type?: string;
  folderId?: string;
}

export interface SearchResults {
  tags: ProcessedTag[];
  triggers: ProcessedTrigger[];
  variables: ProcessedVariable[];
}

/**
 * Searches the GTM container context based on a query and filter criteria.
 */
export function globalSearch(
  ctx: ContainerContext,
  filters: SearchFilters,
): SearchResults {
  const query = filters.query?.toLowerCase().trim() || '';
  const typeFilter = filters.type || '';
  const folderFilter = filters.folderId || '';

  const matchesText = (name: string, notes: string | null, typeLabel: string) => {
    if (!query) return true;
    return (
      name.toLowerCase().includes(query) ||
      typeLabel.toLowerCase().includes(query) ||
      (notes?.toLowerCase().includes(query) ?? false)
    );
  };

  const matchesFolder = (itemFolderId: string | null) => {
    if (!folderFilter) return true;
    return itemFolderId === folderFilter;
  };

  const matchesType = (itemType: string, itemTypeLabel: string) => {
    if (!typeFilter) return true;
    return (
      itemType === typeFilter ||
      itemTypeLabel.toLowerCase().includes(typeFilter.toLowerCase())
    );
  };

  return {
    tags: ctx.tags.filter(
      (t) =>
        matchesText(t.name, t.notes, t.typeLabel) &&
        matchesFolder(t.folderId) &&
        matchesType(t.type, t.typeLabel),
    ),
    triggers: ctx.triggers.filter(
      (trig) =>
        matchesText(trig.name, trig.notes, trig.typeLabel) &&
        matchesFolder(trig.folderId) &&
        matchesType(trig.type, trig.typeLabel),
    ),
    variables: ctx.variables.filter(
      (v) =>
        matchesText(v.name, v.notes, v.typeLabel) &&
        matchesFolder(v.folderId) &&
        matchesType(v.type, v.typeLabel),
    ),
  };
}
