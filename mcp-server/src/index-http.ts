/**
 * MCP Server — Streamable HTTP & REST Launcher
 *
 * Implements the Streamable HTTP transport (MCP Spec 2025-03-26)
 * alongside a high-performance REST chat streaming endpoint for the dashboard.
 */

import express from 'express';
import helmet from 'helmet';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { env } from './config/env.js';
import { validateOrigin, enforceOrigin } from './security/cors.js';
import { globalRateLimiter, chatRateLimiter } from './security/rate-limiter.js';
import { validateChatPayload } from './security/input-validator.js';
import { requestLogger } from './middleware/logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { executeMcpTool, mcpToolsList } from './tools/registry.js';
import { streamChatResponse } from './ai/agent.js';
import { writeFile, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const port = env.PORT;

// Initialize Core MCP Server
const mcpServer = new Server(
  {
    name: 'gtm-container-analyzer',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// Define MCP Server handlers
mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: mcpToolsList };
});

mcpServer.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: 'gtm://container/active',
        name: 'Active GTM Container Context',
        mimeType: 'application/json',
        description: 'The raw JSON configuration of the currently active/synced Google Tag Manager container version.',
      },
    ],
  };
});

mcpServer.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;
  if (uri !== 'gtm://container/active') {
    throw new Error(`Resource not found: ${uri}`);
  }

  const syncPath = join(homedir(), '.gtm-active-container.json');
  try {
    const fileContent = await readFile(syncPath, 'utf8');
    return {
      contents: [
        {
          uri: 'gtm://container/active',
          mimeType: 'application/json',
          text: fileContent,
        },
      ],
    };
  } catch (err: any) {
    throw new Error(`Failed to read GTM active container resource: ${err.message || String(err)}`);
  }
});

mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const result = await executeMcpTool(name, args);
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
});

// Configure Express Application
const app = express();

// Set basic security headers with Helmet (disabling CSP directives that block local dashboard execution).
// COOP must be "same-origin-allow-popups" so Google OAuth (useGoogleLogin popup) can return the token
// to the opener. Helmet's default "same-origin" isolates the popup and login appears to succeed
// with zero follow-up Network calls to tagmanager.googleapis.com (same as vercel.json).
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  })
);

// Intercept telemetry logs and validate CORS origin headers (DNS Rebinding protection)
app.use(requestLogger);
app.use(validateOrigin);
app.use(globalRateLimiter);

// Enforce no-index header globally for all responses
app.use((req, res, next) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  next();
});


// ─── MCP HTTP SSE Transport ──────────────────────────────────────────────────

let legacySseTransport: SSEServerTransport | null = null;

app.get(['/mcp', '/sse'], async (req, res) => {
  console.log('[SSE] Handshaking connection');
  try {
    // If the server is already connected to an active transport, close it first
    await mcpServer.close();
  } catch (e) {
    // Ignore if not connected
  }
  legacySseTransport = new SSEServerTransport('/messages', res);
  await mcpServer.connect(legacySseTransport);
});

app.post('/messages', async (req, res) => {
  try {
    if (legacySseTransport) {
      await legacySseTransport.handlePostMessage(req, res);
    } else {
      res.status(400).send('No active legacy SSE transport established.');
    }
  } catch (err: any) {
    console.error('[SSE PostMessage Error]', err.message || String(err));
    if (!res.headersSent) {
      res.status(500).send(err.message || 'Error processing message');
    }
  }
});

// ─── Dashboard AI Chat Streaming Endpoint ───────────────────────────────────

app.post(
  '/api/chat',
  express.json(),
  enforceOrigin,
  chatRateLimiter,
  validateChatPayload,
  async (req, res) => {
    // Establish Server-Sent Events headers for stream responses
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); // Pushes header configuration to client immediately

    // SSE writer callback helper
    const writeToken = (token: string, type: 'text' | 'tool_call' | 'tool_result' | 'done' = 'text') => {
      res.write(`data: ${JSON.stringify({ type, content: token })}\n\n`);
    };

    try {
      await streamChatResponse(req.body, writeToken);
      writeToken('', 'done');
      res.end();
    } catch (err: any) {
      console.error('[AI Chat Flow Crash]', err);
      res.write(`data: ${JSON.stringify({ type: 'text', content: `\n❌ AI Generation Error: ${err.message || String(err)}` })}\n\n`);
      res.end();
    }
  }
);
// ─── Dashboard Active Container Sync ─────────────────────────────────────────

app.post(
  '/api/auth/sync',
  express.json({ limit: '5mb' }),
  enforceOrigin,
  async (req, res) => {
    try {
      const { containerJson } = req.body;
      if (!containerJson) {
        return res.status(400).json({ error: 'No GTM container JSON provided.' });
      }

      const syncPath = join(homedir(), '.gtm-active-container.json');
      await writeFile(syncPath, JSON.stringify(containerJson, null, 2), {
        mode: 0o600, // POSIX permissions: owner read/write only
      });

      console.log(`[Sync] GTM container version successfully written to ${syncPath}`);
      res.status(200).json({ status: 'success', message: 'Container synced successfully' });
    } catch (err: any) {
      console.error('[Sync Failure]', err);
      res.status(500).json({ error: 'Failed to write sync configuration file.' });
    }
  }
);

// ─── Service Diagnostics ─────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    mcpSessionActive: !!legacySseTransport,
  });
});

// ─── Serve Frontend Static Assets (Unified Showcase) ─────────────────────────

const distPath = join(__dirname, '../../dist');
app.use(express.static(distPath));

// Fallback all other frontend routes to index.html (React SPA routing support)
app.get(/^(?!\/api|\/mcp|\/sse|\/messages|\/health).*/, (req, res) => {
  res.sendFile(join(distPath, 'index.html'));
});

// Enforce global error boundaries
app.use(errorHandler);

// Launch HTTP Server
app.listen(port, () => {
  console.log(`🚀 GTM Analyzer MCP Server listening on port ${port}`);
  console.log(`👉 MCP HTTP SSE endpoint:       http://localhost:${port}/sse`);
  console.log(`👉 Dashboard Chat API endpoint:   http://localhost:${port}/api/chat`);
  console.log(`👉 Allowed CORS Origins:          ${env.ALLOWED_ORIGINS.join(', ')}`);
});
