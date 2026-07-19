/**
 * MCP Server — Input Validation
 *
 * Enforces schema-level validation on incoming REST payloads
 * to protect against Injection and Prototype Pollution (OWASP A03 / A04).
 */

import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';

// Schema for the REST /api/chat payload
export const chatRequestSchema = z.object({
  message: z.string().min(1, 'Message content must not be empty.').max(5000, 'Message exceeds length limit.'),
  containerJson: z.record(z.unknown()).optional(),
  liveEvents: z.array(
    z.object({
      eventName: z.string(),
      count: z.number().int().nonnegative(),
    })
  ).optional(),
  history: z.array(
    z.object({
      role: z.enum(['user', 'model']),
      parts: z.array(
        z.object({
          text: z.string(),
        })
      ),
    })
  ).optional(),
  provider: z.enum(['gemini', 'openai', 'anthropic', 'groq', 'ollama', 'openrouter']).default('gemini'),
  model: z.string().optional(),
});

/**
 * Middleware validating that the REST chat endpoint request matches the chatRequestSchema.
 */
export function validateChatPayload(req: Request, res: Response, next: NextFunction) {
  // Guard: Reject payloads larger than 10MB to prevent DoS via large JSON payloads
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  if (contentLength > 10 * 1024 * 1024) {
    return res.status(413).json({
      error: 'Payload Too Large: Maximum allowed request size is 10MB.',
      code: 'PAYLOAD_TOO_LARGE',
    });
  }

  const result = chatRequestSchema.safeParse(req.body);

  if (!result.success) {
    const issues = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
    return res.status(400).json({
      error: 'Invalid request parameters.',
      code: 'VALIDATION_ERROR',
      details: issues,
    });
  }

  // Override body with parsed and structured content
  req.body = result.data;
  next();
}
