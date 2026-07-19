/**
 * @gtm-analyzer/core — Central Type Definitions
 *
 * ContainerContext is the single, immutable data contract passed to every
 * auditor, scorer, and exporter in the system. No module stores mutable
 * global state — all functions receive and return explicit typed values.
 */

// ─── Raw GTM JSON Shape (from GTM export) ───────────────────────────────────

export interface RawGTMExport {
  exportFormatVersion: number;
  exportTime: string;
  containerVersion: RawContainerVersion;
}

export interface RawContainerVersion {
  path?: string;
  accountId?: string;
  containerId?: string;
  containerVersionId?: string;
  name?: string;
  description?: string;
  container?: {
    path?: string;
    accountId?: string;
    containerId?: string;
    name?: string;
    usageContext?: string[];
    domainName?: string[];
    publicId?: string;
    tagManagerUrl?: string;
  };
  tag?: RawTag[];
  trigger?: RawTrigger[];
  variable?: RawVariable[];
  folder?: RawFolder[];
  builtInVariable?: RawBuiltInVariable[];
  customTemplate?: RawCustomTemplate[];
  zone?: RawZone[];
}

export interface RawTag {
  accountId?: string;
  containerId?: string;
  tagId?: string;
  name: string;
  type: string;
  parameter?: RawParameter[];
  fingerprint?: string;
  firingTriggerId?: string[];
  blockingTriggerId?: string[];
  setupTag?: Array<{ tagName: string; stopOnSetupFailure?: boolean }>;
  teardownTag?: Array<{ tagName: string; stopTeardownOnFailure?: boolean }>;
  tagFiringOption?: string;
  monitoringMetadata?: object;
  consentSettings?: {
    consentStatus?: string;
    consentType?: RawParameter[];
  };
  parentFolderId?: string;
  notes?: string;
  scheduleStartMs?: string;
  scheduleEndMs?: string;
  liveOnly?: boolean;
}

export interface RawTrigger {
  accountId?: string;
  containerId?: string;
  triggerId?: string;
  name: string;
  type: string;
  parameter?: RawParameter[];
  customEventFilter?: RawCondition[];
  filter?: RawCondition[];
  autoEventFilter?: RawCondition[];
  waitForTags?: RawParameter;
  checkValidation?: RawParameter;
  waitForTagsTimeout?: RawParameter;
  uniqueTriggerId?: RawParameter;
  parentFolderId?: string;
  fingerprint?: string;
  notes?: string;
}

export interface RawVariable {
  accountId?: string;
  containerId?: string;
  variableId?: string;
  name: string;
  type: string;
  parameter?: RawParameter[];
  enablingTriggerId?: string[];
  disablingTriggerId?: string[];
  formatValue?: object;
  parentFolderId?: string;
  fingerprint?: string;
  notes?: string;
}

export interface RawFolder {
  accountId?: string;
  containerId?: string;
  folderId?: string;
  name: string;
  fingerprint?: string;
  tagManagerUrl?: string;
  notes?: string;
}

export interface RawBuiltInVariable {
  accountId?: string;
  containerId?: string;
  type: string;
  name: string;
}

export interface RawCustomTemplate {
  accountId?: string;
  containerId?: string;
  templateId?: string;
  name: string;
  templateData?: string;
  fingerprint?: string;
  tagManagerUrl?: string;
  galleryReference?: {
    host?: string;
    repository?: string;
    version?: string;
    owner?: string;
    signature?: string;
    isModified?: boolean;
  };
}

export interface RawZone {
  accountId?: string;
  containerId?: string;
  zoneId?: string;
  name: string;
  childContainer?: object[];
  boundary?: object;
  typeRestriction?: object;
  fingerprint?: string;
  tagManagerUrl?: string;
}

export interface RawParameter {
  type: string;
  key?: string;
  value?: string;
  list?: RawParameter[];
  map?: RawParameter[];
  isWeakReference?: boolean;
}

export interface RawCondition {
  type: string;
  parameter?: RawParameter[];
}

// ─── Processed / Normalized Types ──────────────────────────────────────────

export interface ProcessedTag {
  id: string;
  name: string;
  type: string;
  typeLabel: string;
  firingTriggerIds: string[];
  blockingTriggerIds: string[];
  parameters: Record<string, unknown>;
  consentStatus: string | null;
  consentTypes: string[];
  folderId: string | null;
  notes: string | null;
  isLiveOnly: boolean;
  raw: RawTag;
}

export interface ProcessedTrigger {
  id: string;
  name: string;
  type: string;
  typeLabel: string;
  parameters: Record<string, unknown>;
  conditions: ProcessedCondition[];
  folderId: string | null;
  notes: string | null;
  raw: RawTrigger;
}

export interface ProcessedVariable {
  id: string;
  name: string;
  type: string;
  typeLabel: string;
  parameters: Record<string, unknown>;
  folderId: string | null;
  notes: string | null;
  raw: RawVariable;
}

export interface ProcessedCondition {
  type: string;
  parameter: string;
  operator: string;
  value: string;
}

export interface ProcessedFolder {
  id: string;
  name: string;
}

// ─── Audit Result Types ──────────────────────────────────────────────────────

export type IssueSeverity = 'critical' | 'warning' | 'info' | 'success';

export interface AuditIssue {
  /** Unique identifier for this issue type, used for deduplication and docs links */
  code: string;
  severity: IssueSeverity;
  message: string;
  /** Human-readable suggestion on how to fix the issue */
  suggestion: string;
  /** The item name (tag/trigger/variable) this issue applies to */
  affectedItem?: string;
  /** The item ID for deep-linking to GTM */
  affectedId?: string;
}

export interface NamingAuditResult {
  compliantCount: number;
  violationCount: number;
  issues: AuditIssue[];
  compliancePercent: number;
}

export interface GA4AuditResult {
  validCount: number;
  violationCount: number;
  issues: AuditIssue[];
}

export interface PerformanceAuditResult {
  score: number;
  containerSizeBytes: number;
  containerSizeWarning: 'ok' | 'warning' | 'critical';
  issues: AuditIssue[];
}

export interface CleanupAuditResult {
  duplicateTags: DuplicateGroup[];
  orphanTriggers: ProcessedTrigger[];
  unusedVariables: ProcessedVariable[];
}

export interface DuplicateGroup {
  reason: string;
  tags: ProcessedTag[];
}

export interface HealthScore {
  total: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  breakdown: {
    naming: number;
    performance: number;
    cleanup: number;
    security: number;
    ga4: number;
  };
}

// ─── The Central Contract ─────────────────────────────────────────────────────

/**
 * ContainerContext — The single immutable output of analyze().
 * Every auditor, scorer, and UI component reads from this object.
 * Never mutated after creation.
 */
export interface ContainerContext {
  /** ISO timestamp of when the analysis was run */
  readonly analyzedAt: string;

  // Container metadata
  readonly containerName: string;
  readonly containerPublicId: string;
  readonly accountId: string;
  readonly containerId: string;
  readonly exportTime: string;
  readonly exportFormatVersion: number;

  // Processed entity collections
  readonly tags: readonly ProcessedTag[];
  readonly triggers: readonly ProcessedTrigger[];
  readonly variables: readonly ProcessedVariable[];
  readonly folders: readonly ProcessedFolder[];
  readonly builtInVariables: readonly RawBuiltInVariable[];
  readonly customTemplates: readonly RawCustomTemplate[];

  // Lookup maps for O(1) access — critical for performance with large containers
  readonly tagById: ReadonlyMap<string, ProcessedTag>;
  readonly triggerById: ReadonlyMap<string, ProcessedTrigger>;
  readonly variableById: ReadonlyMap<string, ProcessedVariable>;
  readonly folderById: ReadonlyMap<string, ProcessedFolder>;

  // Pre-computed stats used by the health score engine
  readonly stats: {
    readonly tagCount: number;
    readonly triggerCount: number;
    readonly variableCount: number;
    readonly folderCount: number;
    readonly customTemplateCount: number;
    readonly containerSizeBytes: number;
  };
}

// ─── Parser Options ──────────────────────────────────────────────────────────

export interface ParseOptions {
  /** If true, throws on unknown tag/trigger types instead of using 'Unknown' label */
  strictTypes?: boolean;
}
