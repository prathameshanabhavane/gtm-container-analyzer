import { describe, it, expect } from 'vitest';
import {
  analyze,
  auditNaming,
  auditGA4,
  auditPerformance,
  auditCleanup,
  computeHealthScore,
  correlateGTMWithGA4,
  parseGA4EventLogs,
  safeJSONMerge,
} from './index.js';

// Minimal GTM Mock JSON for unit tests
const MOCK_GTM_CONTAINER = {
  exportFormatVersion: 2,
  containerVersion: {
    accountId: '12345',
    containerId: '67890',
    containerVersionId: '1',
    name: 'Test Container',
    container: {
      publicId: 'GTM-TEST'
    },
    tag: [
      {
        tagId: '1',
        name: 'GA4 – Event – Purchase',
        type: 'gaawe',
        firingTriggerId: ['10'],
        parameter: [
          { type: 'template', key: 'eventName', value: 'purchase' }
        ]
      },
      {
        tagId: '2',
        name: 'invalid name format',
        type: 'html',
        firingTriggerId: ['10'],
        parameter: [
          { type: 'template', key: 'html', value: '<script src="https://connect.facebook.net/en_US/fbevents.js"></script>' }
        ]
      }
    ],
    trigger: [
      {
        triggerId: '10',
        name: 'TR – Custom Event – purchase',
        type: 'customEvent'
      }
    ],
    variable: [
      {
        variableId: '20',
        name: 'DLV – Transaction ID',
        type: 'v',
        parameter: [
          { type: 'template', key: 'name', value: 'transaction_id' }
        ]
      }
    ]
  }
};

describe('GTM Container Analyzer Core tests', () => {
  
  it('should successfully parse valid GTM container', () => {
    const ctx = analyze(MOCK_GTM_CONTAINER);
    expect(ctx.containerName).toBe('Test Container');
    expect(ctx.containerPublicId).toBe('GTM-TEST');
    expect(ctx.stats.tagCount).toBe(2);
    expect(ctx.stats.triggerCount).toBe(1);
    expect(ctx.stats.variableCount).toBe(1);
  });

  it('should audit naming convention violations', () => {
    const ctx = analyze(MOCK_GTM_CONTAINER);
    const result = auditNaming(ctx);
    expect(result.violationCount).toBe(1); // 'invalid name format' is a violation
    expect(result.issues[0]?.code).toBe('NAMING_TAG_PATTERN');
  });

  it('should audit performance and detect custom HTML vendor patterns', () => {
    const ctx = analyze(MOCK_GTM_CONTAINER);
    const result = auditPerformance(ctx);
    // Custom HTML script connects to facebook net, so should recommend sandboxed template
    const hasSandboxRec = result.issues.some((issue) => issue.code === 'PERF_USE_SANDBOXED_TEMPLATE');
    expect(hasSandboxRec).toBe(true);
  });

  it('should run GA4 correlation checks matching connecting counts', () => {
    const ctx = analyze(MOCK_GTM_CONTAINER);
    const liveLogs = parseGA4EventLogs('purchase: 25\npage_view: 12');
    
    expect(liveLogs).toHaveLength(2);
    expect(liveLogs[0]?.eventName).toBe('purchase');
    expect(liveLogs[0]?.count).toBe(25);

    const correlation = correlateGTMWithGA4(ctx, liveLogs);
    expect(correlation.activeCount).toBe(1);
    expect(correlation.correlations[0]?.status).toBe('active');
    expect(correlation.correlations[0]?.eventCount).toBe(25);
  });

  it('should protect against prototype pollution during config merges', () => {
    const base = {};
    const polluter = JSON.parse('{"__proto__": {"polluted": true}}');
    const result = safeJSONMerge(base, polluter);
    
    expect(result).toEqual({});
    expect((Object.prototype as any).polluted).toBeUndefined();
  });

});
