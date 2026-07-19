/**
 * MCP Server — Global Error Handling Middleware
 *
 * Implements centralized exception catching and filters implementation-level detail leakage
 * in production contexts (OWASP A05 Alignment).
 */

import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) {
  const isProd = env.NODE_ENV === 'production';

  console.error(`[Error Boundary Log] Caught unhandled exception: ${err.message}`, err.stack);

  // Return standard JSON response
  res.status(500).json({
    error: 'An internal server error occurred while processing your request.',
    code: 'INTERNAL_SERVER_ERROR',
    // Only return stack traces in development mode
    details: isProd ? undefined : err.stack,
    message: isProd ? undefined : err.message,
  });
}
