/**
 * MCP Server — Structured Logging Middleware
 *
 * Implements standard telemetry audit logging for tool executions (OWASP MCP08).
 * Fully scrubs credentials and private parameter keys from console logs.
 */

import type { Request, Response, NextFunction } from 'express';
import { redactCredentials } from '@gtm-analyzer/core';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  const path = req.path;
  const method = req.method;
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';

  // Log incoming request
  console.log(`[HTTP Request] ${method} ${path} from ${ip}`);

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    // Log complete response
    console.log(`[HTTP Response] ${method} ${path} Status ${statusCode} (${duration}ms)`);
  });

  next();
}

/**
 * Utility function to log tool execution telemetry safely.
 */
export function logToolCall(toolName: string, args: unknown, success: boolean, error?: string) {
  const serializedArgs = JSON.stringify(args);
  const safeArgs = redactCredentials(serializedArgs);

  if (success) {
    console.log(`[Telemetry - Tool Call Success] Tool: "${toolName}" Arguments: ${safeArgs}`);
  } else {
    console.error(
      `[Telemetry - Tool Call Failure] Tool: "${toolName}" Arguments: ${safeArgs} Error: ${error || 'Unknown'}`
    );
  }
}
