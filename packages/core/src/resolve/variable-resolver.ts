/**
 * @gtm-analyzer/core — GTM Variable Resolver
 *
 * Resolves references like `{{Page URL}}` or nested variable calls
 * using variable definition rules stored in the container context.
 *
 * Pure function, zero side effects.
 */

import type { ContainerContext } from '../types.js';

/**
 * Resolves a GTM string pattern containing variables (e.g. "User-{{DLV - User ID}}")
 * by lookup map inside the context.
 *
 * @param template - The string containing GTM curly bracket references
 * @param ctx - The container context holding variable registries
 * @returns Fully resolved string or original if unresolvable
 */
export function resolveVariableString(
  template: string,
  ctx: ContainerContext,
): string {
  if (!template.includes('{{')) return template;

  const pattern = /\{\{([^}]+)\}\}/g;
  return template.replace(pattern, (match, varName) => {
    const trimmed = varName.trim();
    const variable = Array.from(ctx.variableById.values()).find((v) => v.name === trimmed);
    if (!variable) return match; // Fallback to raw match

    // Resolve based on variable types
    if (variable.type === 'c') {
      // Constant variable
      return String(variable.parameters['value'] ?? match);
    }
    
    // For other types, return the variable type label as fallback
    return `[${variable.typeLabel}]`;
  });
}
