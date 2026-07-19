/**
 * @gtm-analyzer/core — GA4 Correlation Engine
 *
 * Stitches GTM tag configurations together with live GA4 event counts
 * to detect tracking gaps and silent failures (e.g., tag is live but GA4 gets 0 events).
 *
 * Pure function, zero side effects.
 */

import type { ContainerContext, ProcessedTag } from '../types.js';

export interface GA4LiveEvent {
  eventName: string;
  count: number;
}

export interface TagCorrelationResult {
  tagId: string;
  tagName: string;
  eventName: string | null;
  measurementId: string | null;
  eventCount: number | null;
  status: 'active' | 'zero_data' | 'no_ga4_match' | 'no_live_data';
  message: string;
}

export interface CorrelationSummary {
  correlations: TagCorrelationResult[];
  activeCount: number;
  zeroDataCount: number;
  untrackedCount: number;
}

/**
 * Compares tag event configuration definitions with actual GA4 counts.
 *
 * @param ctx - The container context
 * @param liveEvents - Array of live GA4 events with counts (optional)
 */
export function correlateGTMWithGA4(
  ctx: ContainerContext,
  liveEvents?: GA4LiveEvent[],
): CorrelationSummary {
  const correlations: TagCorrelationResult[] = [];
  
  let activeCount = 0;
  let zeroDataCount = 0;
  let untrackedCount = 0;

  // Build a lookup map for live GA4 event counts (case-insensitive keys)
  const liveMap = new Map<string, number>();
  if (liveEvents) {
    for (const ev of liveEvents) {
      liveMap.set(ev.eventName.toLowerCase().trim(), ev.count);
    }
  }

  // Scan for GA4 Event tags ('gaawe')
  const ga4Tags = ctx.tags.filter((t) => t.type === 'gaawe');

  for (const tag of ga4Tags) {
    const eventName = (tag.parameters['eventName'] as string) || '';
    const measurementId = (tag.parameters['measurementId'] as string) || null;

    if (!eventName) {
      correlations.push({
        tagId: tag.id,
        tagName: tag.name,
        eventName: null,
        measurementId,
        eventCount: null,
        status: 'no_ga4_match',
        message: 'No event name configured on this tag.',
      });
      untrackedCount++;
      continue;
    }

    const lowerEvent = eventName.toLowerCase().trim();

    if (!liveEvents) {
      // No live data supplied
      correlations.push({
        tagId: tag.id,
        tagName: tag.name,
        eventName,
        measurementId,
        eventCount: null,
        status: 'no_live_data',
        message: 'No live GA4 data connected. Connect Google Analytics or paste logs to verify.',
      });
      continue;
    }

    const count = liveMap.get(lowerEvent);

    if (count === undefined) {
      // Event exists in GTM config but is completely missing from GA4 logs
      correlations.push({
        tagId: tag.id,
        tagName: tag.name,
        eventName,
        measurementId,
        eventCount: 0,
        status: 'zero_data',
        message: `Tag is live, but "${eventName}" was not recorded in GA4. Check your GTM triggers.`,
      });
      zeroDataCount++;
    } else if (count === 0) {
      correlations.push({
        tagId: tag.id,
        tagName: tag.name,
        eventName,
        measurementId,
        eventCount: 0,
        status: 'zero_data',
        message: `Tag is active, but event count is 0 in GA4. Potential silent trigger failure.`,
      });
      zeroDataCount++;
    } else {
      // Success correlation!
      correlations.push({
        tagId: tag.id,
        tagName: tag.name,
        eventName,
        measurementId,
        eventCount: count,
        status: 'active',
        message: `Active tracking: GA4 recorded ${count} events.`,
      });
      activeCount++;
    }
  }

  return {
    correlations,
    activeCount,
    zeroDataCount,
    untrackedCount,
  };
}

/**
 * Parses manual event logs pasted by users for the Offline Fallback Mode.
 * Accepts formats:
 *   1. JSON arrays: `[{"eventName": "purchase", "count": 12}, ...]`
 *   2. Simple CSV: `eventName,count\npurchase,12\n...`
 *   3. Text listings: "purchase: 12\npage_view: 54"
 */
export function parseGA4EventLogs(rawInput: string): GA4LiveEvent[] {
  const cleaned = rawInput.trim();
  if (!cleaned) return [];

  // Try JSON parsing
  if (cleaned.startsWith('[') || cleaned.startsWith('{')) {
    try {
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item: any) => {
            const name = item.eventName || item.event_name || item.name;
            const count = Number(item.count || item.event_count || item.value || 0);
            return { eventName: String(name), count };
          })
          .filter((item) => item.eventName);
      }
    } catch {
      // Fall back to line-by-line regex if JSON parse fails
    }
  }

  // Fall back to line-by-line parsing (regex matches "name,count" or "name:count" or "name=count")
  const lines = cleaned.split(/[\n\r]+/);
  const events: GA4LiveEvent[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('//') || trimmedLine.startsWith('#')) continue;

    // Matches: "purchase, 15" or "page_view:54" or "click = 10"
    const match = trimmedLine.match(/^([^,:=]+)[,:=]\s*(\d+)$/);
    if (match && match[1]) {
      events.push({
        eventName: match[1].trim(),
        count: parseInt(match[2] || '0', 10),
      });
    }
  }

  return events;
}
