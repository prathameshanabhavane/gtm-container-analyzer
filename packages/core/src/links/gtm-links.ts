/**
 * @gtm-analyzer/core — GTM Link Builder
 *
 * Constructs deep links into the Google Tag Manager UI console.
 * Helps users navigate directly from audit issues in our dashboard
 * to the exact item edit page inside GTM admin workspace.
 *
 * Pure function, zero side effects.
 */

export interface GTMLinkParams {
  accountId: string;
  containerId: string;
  entityId: string;
  entityType: 'tag' | 'trigger' | 'variable' | 'folder';
}

/**
 * Builds a direct edit link into the GTM console UI.
 *
 * @returns Direct edit URL string
 * @example
 *   const link = buildGTMEditLink({
 *     accountId: '12345',
 *     containerId: '67890',
 *     entityId: '1',
 *     entityType: 'tag'
 *   });
 *   // → "https://tagmanager.google.com/#/container/accounts/12345/containers/67890/workspaces/1/tags/1"
 */
export function buildGTMEditLink(params: GTMLinkParams): string {
  const { accountId, containerId, entityId, entityType } = params;
  const base = 'https://tagmanager.google.com/#/container/accounts';

  // Map internal entity types to path segments used by GTM console UI
  let pathSegment = 'tags';
  if (entityType === 'trigger') pathSegment = 'triggers';
  if (entityType === 'variable') pathSegment = 'variables';
  if (entityType === 'folder') pathSegment = 'folders';

  // Workspace ID default to "1" (default workspace) if not specified in export metadata
  return `${base}/${accountId}/containers/${containerId}/workspaces/1/${pathSegment}/${entityId}`;
}
