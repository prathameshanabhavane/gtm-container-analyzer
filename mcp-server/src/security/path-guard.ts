/**
 * MCP Server — Path Guard
 *
 * Prevents directory traversal attacks in MCP tool file operations.
 * All file paths provided by AI assistants are validated against
 * an allowed base directory before any read/write is performed.
 *
 * OWASP 2025 A01 — Broken Access Control
 * OWASP 2025 A05 — Security Misconfiguration
 */

import { resolve, normalize } from 'node:path';
import { GTMSecurityError } from '@gtm-analyzer/core';

/**
 * Validates that a user-provided path resolves within the allowed base directory.
 *
 * @param baseDir - The allowed root directory (absolute path)
 * @param userInput - The path provided by the AI assistant or user
 * @returns The resolved, safe absolute path
 * @throws GTMSecurityError if the path resolves outside the base directory
 */
export function validateSafePath(baseDir: string, userInput: string): string {
  const normalizedBase = normalize(resolve(baseDir));
  const resolvedPath = normalize(resolve(baseDir, userInput));

  // The resolved path MUST start with the normalized base directory
  // Add a path separator to prevent "prefix attacks" like:
  //   baseDir = /safe/dir, resolvedPath = /safe/directory-traversal
  const safePrefix = normalizedBase.endsWith('/') ? normalizedBase : `${normalizedBase}/`;

  if (!resolvedPath.startsWith(safePrefix) && resolvedPath !== normalizedBase) {
    throw new GTMSecurityError(
      `Access Denied: Path "${userInput}" resolves outside the allowed directory "${normalizedBase}".`
    );
  }

  return resolvedPath;
}
