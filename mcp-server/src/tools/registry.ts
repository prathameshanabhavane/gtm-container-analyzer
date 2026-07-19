/**
 * MCP Server — Tool Registry
 *
 * Centralized registry mapping MCP tool calls to core package functions.
 * Tool schemas strictly validate argument signatures.
 *
 * Exposes:
 *   1. analyze_container    — Audits the uploaded GTM JSON and calculates stats and health score
 *   2. audit_naming         — Audits the naming conventions of all tags/triggers/variables
 *   3. audit_ga4            — Audits GA4-specific properties and limits
 *   4. audit_performance    — Scans for performance and script loading optimizations
 *   5. correlate_live_events— Correlates static container settings against live capture logs
 *   6. compare_containers   — Performs structural diff between two container contexts
 */

import {
  analyze,
  auditNaming,
  auditGA4,
  auditPerformance,
  auditCleanup,
  computeHealthScore,
  correlateGTMWithGA4,
  compareContainers,
  GTMParseError,
  GTMValidationError,
} from '@gtm-analyzer/core';
import type { ContainerContext } from '@gtm-analyzer/core';
import { logToolCall } from '../middleware/logger.js';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

/**
 * Standard list of MCP Tool definitions (exposing schemas to LLMs)
 */
export const mcpToolsList = [
  {
    name: 'analyze_container',
    description: 'Read and analyze a Google Tag Manager container JSON export. Returns a health score, composition counts, and critical issues list.',
    inputSchema: {
      type: 'object',
      properties: {
        containerJson: {
          type: 'object',
          description: 'The raw JSON object of the Google Tag Manager container export file.',
        },
      },
      required: [],
    },
  },
  {
    name: 'audit_naming',
    description: 'Audits the naming convention compliance of all tags, triggers, and variables inside a GTM container JSON.',
    inputSchema: {
      type: 'object',
      properties: {
        containerJson: {
          type: 'object',
          description: 'The raw GTM container export JSON object.',
        },
      },
      required: [],
    },
  },
  {
    name: 'audit_ga4',
    description: "Validates all GA4 event configuration names and parameters against Google's official limitations.",
    inputSchema: {
      type: 'object',
      properties: {
        containerJson: {
          type: 'object',
          description: 'The GTM container export JSON object.',
        },
      },
      required: [],
    },
  },
  {
    name: 'audit_performance',
    description: 'Scans GTM container for script deferral opportunities, sandboxed template recommendations, and size limits.',
    inputSchema: {
      type: 'object',
      properties: {
        containerJson: {
          type: 'object',
          description: 'The GTM container export JSON object.',
        },
      },
      required: [],
    },
  },
  {
    name: 'correlate_live_events',
    description: 'Compares GTM container event definitions with live extension-intercepted event logs to detect tracking gaps or failures.',
    inputSchema: {
      type: 'object',
      properties: {
        containerJson: {
          type: 'object',
          description: 'The GTM container export JSON object.',
        },
        liveEvents: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              eventName: { type: 'string' },
              count: { type: 'number' },
            },
            required: ['eventName', 'count'],
          },
          description: 'Array of live event objects intercepted by the Chrome debugger extension.',
        },
      },
      required: ['liveEvents'],
    },
  },
  {
    name: 'compare_containers',
    description: 'Compares two GTM container export JSON objects side-by-side, return structural diff analysis.',
    inputSchema: {
      type: 'object',
      properties: {
        containerA: {
          type: 'object',
          description: 'Raw GTM export JSON object for container A.',
        },
        containerB: {
          type: 'object',
          description: 'Raw GTM export JSON object for container B.',
        },
      },
      required: ['containerA', 'containerB'],
    },
  },
  {
    name: 'get_container_details',
    description: 'Retrieves clean, structured lists of all tags, triggers, and variables inside the GTM container export (useful for inspecting specific tag configurations, parameters, and firing rules).',
    inputSchema: {
      type: 'object',
      properties: {
        containerJson: {
          type: 'object',
          description: 'The raw GTM container export JSON object.',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_recommendations',
    description: 'Runs naming, performance, cleanup, and GA4 diagnostics on the container to generate a prioritized list of actionable tag/trigger setup recommendations.',
    inputSchema: {
      type: 'object',
      properties: {
        containerJson: {
          type: 'object',
          description: 'Optional GTM container JSON context. If omitted, falls back to the active synced container.',
        },
      },
      required: [],
    },
  },
  {
    name: 'find_unused_items',
    description: 'Scan variables inside the container version and return a list of all variables that are not used by any tags, triggers, or custom scripts.',
    inputSchema: {
      type: 'object',
      properties: {
        containerJson: {
          type: 'object',
          description: 'Optional GTM container JSON context. If omitted, falls back to the active synced container.',
        },
      },
      required: [],
    },
  },
  {
    name: 'find_duplicates',
    description: 'Scan Custom HTML and scripts inside the container to list duplicates or tag bloat that impacts Largest Contentful Paint (LCP) performance.',
    inputSchema: {
      type: 'object',
      properties: {
        containerJson: {
          type: 'object',
          description: 'Optional GTM container JSON context. If omitted, falls back to the active synced container.',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_connection_status',
    description: 'Retrieves details about the active GTM container connection status. The returned JSON contains a "message" field with the connection guide and HTML/Markdown badge. The assistant MUST output the "message" field content verbatim to the user to render the connect/change button.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
];

function loadSyncedContainer(): any {
  const syncPath = join(homedir(), '.gtm-active-container.json');
  if (!existsSync(syncPath)) {
    throw new Error(
      `⚡ **GTM Insight: Active GTM Container Required**\n\n` +
      `To start auditing, you need to connect your Google Tag Manager container. Please choose one of the options below:\n\n` +
      `### 🔹 Option 1: Connect via Google OAuth (Recommended)\n` +
      `Click the button below to connect your container securely using Google OAuth:\n\n` +
      `[![](https://img.shields.io/badge/Connect%20Google%20GTM-4285F4?style=for-the-badge&logo=google&logoColor=white)](http://localhost:5173)\n\n` +
      `**Simple 3-Step Setup:**\n` +
      `1. Click the **Connect Google GTM** button above (or open \`http://localhost:5173\` in your browser).\n` +
      `2. Log in securely with Google and select your GTM container.\n` +
      `3. Return to this chat and ask any auditing or GA4 questions!\n\n` +
      `### 🔹 Option 2: Audit a local JSON file directly\n` +
      `If you have a container export JSON file in your workspace, you can pass its file path directly in your prompt. For example:\n` +
      `> *\"Audit naming conventions for public/sample-gtm-container.json\"*`
    );
  }

  try {
    const fileContent = readFileSync(syncPath, 'utf8');
    const parsed = JSON.parse(fileContent);
    
    if (parsed.containerVersion) {
      return parsed;
    }
    return { containerVersion: parsed };
  } catch (err: any) {
    throw new Error(`Failed to load synced GTM container config: ${err.message || String(err)}`);
  }
}

function resolveContainer(args: any): any {
  if (args && args.containerJson) {
    return args.containerJson;
  }
  return loadSyncedContainer();
}

/**
 * Standard router to execute a tool by name with arguments.
 * Safe from exception crashes.
 */
export async function executeMcpTool(name: string, args: any): Promise<any> {
  try {
    if (name === 'analyze_container') {
      const containerJson = resolveContainer(args);
      const ctx = analyze(containerJson);
      const naming = auditNaming(ctx);
      const ga4 = auditGA4(ctx);
      const performance = auditPerformance(ctx);
      const cleanup = auditCleanup(ctx);
      const healthScore = computeHealthScore({ ctx, naming, ga4, performance, cleanup });

      const result = {
        containerName: ctx.containerName,
        containerPublicId: ctx.containerPublicId,
        stats: ctx.stats,
        healthScore,
        issues: [
          ...naming.issues,
          ...ga4.issues,
          ...performance.issues,
        ],
      };

      logToolCall(name, { containerName: ctx.containerName }, true);
      return result;
    }

    if (name === 'audit_naming') {
      const containerJson = resolveContainer(args);
      const ctx = analyze(containerJson);
      const result = auditNaming(ctx);
      logToolCall(name, { containerName: ctx.containerName }, true);
      return result;
    }

    if (name === 'audit_ga4') {
      const containerJson = resolveContainer(args);
      const ctx = analyze(containerJson);
      const result = auditGA4(ctx);
      logToolCall(name, { containerName: ctx.containerName }, true);
      return result;
    }

    if (name === 'audit_performance') {
      const containerJson = resolveContainer(args);
      const ctx = analyze(containerJson);
      const result = auditPerformance(ctx);
      logToolCall(name, { containerName: ctx.containerName }, true);
      return result;
    }

    if (name === 'correlate_live_events') {
      const containerJson = resolveContainer(args);
      const ctx = analyze(containerJson);
      const liveEvents = args.liveEvents;
      const result = correlateGTMWithGA4(ctx, liveEvents);
      logToolCall(name, { containerName: ctx.containerName, eventCount: liveEvents.length }, true);
      return result;
    }

    if (name === 'compare_containers') {
      const ctxA = analyze(args.containerA);
      const ctxB = analyze(args.containerB);
      const result = compareContainers(ctxA, ctxB);
      logToolCall(name, { containerAName: ctxA.containerName, containerBName: ctxB.containerName }, true);
      return result;
    }

    if (name === 'get_container_details') {
      const containerJson = resolveContainer(args);
      const ctx = analyze(containerJson);
      
      const tags = ctx.tags.map(t => ({
        id: t.id,
        name: t.name,
        type: t.type,
        typeLabel: t.typeLabel,
        firingTriggerIds: t.firingTriggerIds,
        blockingTriggerIds: t.blockingTriggerIds,
        parameters: t.parameters,
        consentStatus: t.consentStatus,
        consentTypes: t.consentTypes,
      }));

      const triggers = ctx.triggers.map(tr => ({
        id: tr.id,
        name: tr.name,
        type: tr.type,
        typeLabel: tr.typeLabel,
        conditions: tr.conditions,
      }));

      const variables = ctx.variables.map(v => ({
        id: v.id,
        name: v.name,
        type: v.type,
        typeLabel: v.typeLabel,
        parameters: v.parameters,
      }));

      logToolCall(name, { containerName: ctx.containerName }, true);
      return {
        containerName: ctx.containerName,
        containerPublicId: ctx.containerPublicId,
        tags,
        triggers,
        variables,
      };
    }

    if (name === 'get_recommendations') {
      const containerJson = resolveContainer(args);
      const ctx = analyze(containerJson);
      const naming = auditNaming(ctx);
      const ga4 = auditGA4(ctx);
      const performance = auditPerformance(ctx);
      const cleanup = auditCleanup(ctx);
      const healthScore = computeHealthScore({ ctx, naming, ga4, performance, cleanup });

      const allIssues = [
        ...naming.issues.map(i => ({ ...i, category: 'Naming Compliance' })),
        ...ga4.issues.map(i => ({ ...i, category: 'GA4 Setup' })),
        ...performance.issues.map(i => ({ ...i, category: 'Performance' })),
      ];

      const severityWeight: Record<string, number> = { high: 3, medium: 2, low: 1 };
      allIssues.sort((a, b) => severityWeight[b.severity] - severityWeight[a.severity]);

      const recommendations = allIssues.map((issue, idx) => {
        return `${idx + 1}. **[${issue.severity.toUpperCase()}]** (${issue.category}): ${issue.message}\n   *Fix Recommendation:* ${issue.suggestion || 'Review GTM schema documentation for best practice guidelines.'}`;
      });

      logToolCall(name, { containerName: ctx.containerName }, true);
      return {
        containerName: ctx.containerName,
        containerPublicId: ctx.containerPublicId,
        healthScore,
        totalIssues: allIssues.length,
        recommendations: (recommendations.length > 0
          ? recommendations.join('\n\n')
          : '✅ No critical issues found! Your GTM container is perfectly optimized and follows best practices.')
          + `\n\n---\n*⚡ Auditing GTM Container: **${ctx.containerName}** (${ctx.containerPublicId}). To change containers or connect a new one, click the badge below:*\n\n[![](https://img.shields.io/badge/Change%20GTM%20Container-4285F4?style=for-the-badge&logo=google&logoColor=white)](http://localhost:5173)`,
      };
    }

    if (name === 'find_unused_items') {
      const containerJson = resolveContainer(args);
      const ctx = analyze(containerJson);
      const cleanup = auditCleanup(ctx);
      logToolCall(name, { containerName: ctx.containerName, unusedCount: cleanup.unusedVariables.length }, true);
      return {
        containerName: ctx.containerName,
        containerPublicId: ctx.containerPublicId,
        unusedCount: cleanup.unusedVariables.length,
        unusedVariables: cleanup.unusedVariables.map(v => ({
          id: v.id,
          name: v.name,
          type: v.type,
        })),
        recommendation: (cleanup.unusedVariables.length > 0
          ? '💡 Delete these variables to clean up container bloat and reduce scripts compile latency.'
          : '✅ No unused variables detected in this GTM container version.')
          + `\n\n---\n*⚡ Auditing GTM Container: **${ctx.containerName}** (${ctx.containerPublicId}). [Change GTM Container](http://localhost:5173)*`,
      };
    }

    if (name === 'find_duplicates') {
      const containerJson = resolveContainer(args);
      const ctx = analyze(containerJson);
      const cleanup = auditCleanup(ctx);
      logToolCall(name, { containerName: ctx.containerName, duplicateCount: cleanup.duplicateTags.length }, true);
      return {
        containerName: ctx.containerName,
        containerPublicId: ctx.containerPublicId,
        duplicateCount: cleanup.duplicateTags.length,
        duplicateTags: cleanup.duplicateTags.map(t => ({
          name: t.reason,
          matches: t.tags.map(tag => tag.name),
        })),
        recommendation: (cleanup.duplicateTags.length > 0
          ? '💡 Merge duplicate scripts into a single firing trigger or library call to improve Core Web Vitals.'
          : '✅ No duplicate HTML scripts detected in this GTM container version.')
          + `\n\n---\n*⚡ Auditing GTM Container: **${ctx.containerName}** (${ctx.containerPublicId}). [Change GTM Container](http://localhost:5173)*`,
      };
    }

    if (name === 'get_connection_status') {
      let activeContainer = null;
      try {
        activeContainer = loadSyncedContainer();
      } catch (err) {
        // Suppress error so we can return isConnected: false
      }

      const isConnected = activeContainer !== null;
      const details = isConnected
        ? `🟢 **Connected to GTM Container:** **${activeContainer.containerVersion?.container?.name || 'Active Workspace'}** (${activeContainer.containerVersion?.container?.publicId || 'Unknown ID'})`
        : `🔴 **Not Connected:** No active GTM container is currently synced.`;

      logToolCall(name, {}, true);
      return {
        isConnected,
        activeContainerId: activeContainer?.containerVersion?.container?.publicId || null,
        activeContainerName: activeContainer?.containerVersion?.container?.name || null,
        message: `### GTM Connection Status\n\n${details}\n\n` +
          `To connect a new container or switch the active one, please choose one of the options below:\n\n` +
          `### 🔹 Option 1: Connect via Google OAuth (Recommended)\n` +
          `Click the button below to connect your container securely using Google OAuth:\n\n` +
          `[![](https://img.shields.io/badge/Connect%20Google%20GTM-4285F4?style=for-the-badge&logo=google&logoColor=white)](http://localhost:5173)\n\n` +
          `**Simple 3-Step Setup:**\n` +
          `1. Click the **Connect Google GTM** button above (or open \`http://localhost:5173\` in your browser).\n` +
          `2. Log in securely with Google and select your GTM container.\n` +
          `3. Return to this chat and ask any auditing or GA4 questions!\n\n` +
          `### 🔹 Option 2: Audit a local JSON file directly\n` +
          `If you have a container export JSON file in your workspace, you can pass its file path directly in your prompt. For example:\n` +
          `> *\"Audit naming conventions for public/sample-gtm-container.json\"*`
      };
    }

    throw new Error(`Tool not found in registry: ${name}`);
  } catch (err: any) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logToolCall(name, args, false, errorMsg);
    throw err;
  }
}
