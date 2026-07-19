/**
 * MCP Server — CORS & DNS Rebinding Protection
 *
 * Validates request origins and protects the Streamable HTTP transport
 * from DNS rebinding and Cross-Origin request attacks.
 *
 * MCP Specification 2025-03-26 Security Warning #1:
 * "Servers MUST validate the Origin header on all incoming connections
 * to prevent DNS rebinding attacks."
 */

import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';
import { GTMSecurityError } from '@gtm-analyzer/core';

/**
 * Checks if the given origin is present in the list of allowed CORS origins.
 */
export function isOriginAllowed(origin: string): boolean {
  const normalizedOrigin = origin.trim().toLowerCase();

  return env.ALLOWED_ORIGINS.some((allowed) => {
    // Direct match
    if (allowed === normalizedOrigin) return true;
    // Handle local development matches (e.g. localhost variations)
    if (allowed.startsWith('http://localhost') && normalizedOrigin.startsWith('http://localhost')) {
      return true;
    }
    // Allow IDE extensions and webviews (Cursor, VS Code, Chrome Extensions)
    if (
      normalizedOrigin.startsWith('vscode-webview://') ||
      normalizedOrigin.startsWith('vscode-file://') ||
      normalizedOrigin.startsWith('chrome-extension://')
    ) {
      return true;
    }
    return false;
  });
}

/**
 * Validates the Origin header against the allowed CORS origins.
 * Throws GTMSecurityError for disallowed cross-origin requests.
 */
export function validateOrigin(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;

  // In standard browser HTTP clients, cross-origin requests carry the Origin header.
  // Same-origin browser requests or non-browser/local command-line clients (e.g. curl) may omit it.
  if (origin) {
    if (!isOriginAllowed(origin)) {
      console.warn(`[Security Warning] Blocked unauthorized request from origin: ${origin}`);
      return res.status(403).json({
        error: 'Forbidden: Origin is not allowed.',
        code: 'UNAUTHORIZED_ORIGIN',
      });
    }
  }

  // Set standard CORS response headers
  const reqOrigin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', reqOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Mcp-Session-Id');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
}

/**
 * Strict origin validator for dashboard REST API routes.
 * Enforces that a valid Origin header MUST be present and authorized.
 * Prevents non-browser clients (like curl) from hitting LLM endpoints.
 */
export function enforceOrigin(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;

  if (!origin) {
    console.warn(`[Security Warning] Blocked request to ${req.path} without Origin header.`);
    return res.status(403).json({
      error: 'Forbidden: Origin header is required.',
      code: 'ORIGIN_REQUIRED',
    });
  }

  if (!isOriginAllowed(origin)) {
    console.warn(`[Security Warning] Blocked unauthorized request to ${req.path} from origin: ${origin}`);
    return res.status(403).json({
      error: 'Forbidden: Origin is not allowed.',
      code: 'UNAUTHORIZED_ORIGIN',
    });
  }

  next();
}

