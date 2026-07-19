/**
 * MCP Server — Rate Limiting Protection
 *
 * Implements client rate limiting to prevent Denial of Service (DoS)
 * and API token exhaustion on backend generative models.
 */

import rateLimit from 'express-rate-limit';

/**
 * Standard HTTP endpoint rate limiter (30 requests/minute per IP)
 */
export const globalRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    error: 'Too many requests. Please try again after 60 seconds.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});

/**
 * Heavy AI Agent chat endpoint rate limiter (10 requests/minute per IP)
 */
export const chatRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 heavy chat generations per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'AI chat request limit reached. Please wait a minute before sending another query.',
    code: 'CHAT_LIMIT_EXCEEDED',
  },
});
