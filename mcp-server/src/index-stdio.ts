/**
 * MCP Server — Stdio Launcher (Local IDE Integration)
 *
 * Launches the GTM Container Analyzer MCP server running over Standard I/O (stdio).
 * Exposes container auditing tools to IDE environments (such as Cursor or Claude Desktop).
 *
 * Usage:
 *   node dist/index-stdio.js [allowed/base/directory]
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { validateSafePath } from './security/path-guard.js';
import { executeMcpTool, mcpToolsList } from './tools/registry.js';
import { env } from './config/env.js';

const baseDir = process.argv[2] ? process.argv[2] : env.ALLOWED_BASE_DIR;

const server = new Server(
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

// ─── Register Resources ───────────────────────────────────────────────────────

server.setRequestHandler(ListResourcesRequestSchema, async () => {
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

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
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

// ─── Register Tools List ──────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => {
  // Translate schemas to stdio (using filePath instead of raw JSON objects)
  const stdioTools = mcpToolsList.map((tool) => {
    if (tool.name === 'compare_containers') {
      return {
        ...tool,
        inputSchema: {
          type: 'object',
          properties: {
            filePathA: { type: 'string', description: 'Path to GTM export A.' },
            filePathB: { type: 'string', description: 'Path to GTM export B.' },
          },
          required: ['filePathA', 'filePathB'],
        },
      };
    }

    return {
      ...tool,
      inputSchema: {
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description: 'Optional relative or absolute file path to the GTM export JSON file. If omitted, falls back to the synced active container.',
          },
          liveEvents: tool.inputSchema.properties.liveEvents,
        },
        required: [...(tool.name === 'correlate_live_events' ? ['liveEvents'] : [])],
      },
    };
  });

  return { tools: stdioTools };
});

// ─── Handle Tool Invocations ──────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let toolArgs: Record<string, any> = {};

    if (name === 'compare_containers') {
      const { filePathA, filePathB } = (args ?? {}) as { filePathA: string; filePathB: string };
      const safePathA = validateSafePath(baseDir, filePathA);
      const safePathB = validateSafePath(baseDir, filePathB);

      const contentA = await readFile(safePathA, 'utf-8');
      const contentB = await readFile(safePathB, 'utf-8');

      toolArgs = {
        containerA: JSON.parse(contentA),
        containerB: JSON.parse(contentB),
      };
    } else {
      const { filePath, liveEvents } = (args ?? {}) as { filePath?: string; liveEvents?: any[] };
      
      if (filePath) {
        const safePath = validateSafePath(baseDir, filePath);
        const content = await readFile(safePath, 'utf-8');
        toolArgs = {
          containerJson: JSON.parse(content),
          liveEvents,
        };
      } else {
        // Fall back to synced GTM active container (.gtm-active-container.json)
        toolArgs = {
          liveEvents,
        };
      }
    }

    // Call shared tool registry router
    const result = await executeMcpTool(name, toolArgs);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (err) {
    return {
      content: [
        {
          type: 'text',
          text: `Error executing tool "${name}": ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
      isError: true,
    };
  }
});

// ─── Run Server ──────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`GTM MCP Server running over Stdio (Base allowed directory: ${baseDir})`);
}

main().catch((err) => {
  console.error('Fatal stdio MCP crash:', err);
  process.exit(1);
});
