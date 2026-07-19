/**
 * Container Comparison Logic
 * 
 * Compares two GTM containers and identifies:
 * - Added items (in B but not in A)
 * - Removed items (in A but not in B)
 * - Modified items (different between A and B)
 * - Identical items (same in both)
 */

/**
 * Extract container info from GTM data
 */
export const extractContainerInfo = (data) => {
  if (!data?.containerVersion) {
    return null;
  }
  
  const cv = data.containerVersion;
  const container = cv.container || {};
  
  return {
    name: container.name || 'Unknown Container',
    publicId: container.publicId || '',
    containerId: cv.containerId || '',
    containerVersionId: cv.containerVersionId || '',
    // Account info for validation
    accountId: cv.accountId || container.accountId || '',
    accountName: container.accountName || '',
    tags: cv.tag || [],
    triggers: cv.trigger || [],
    variables: cv.variable || [],
    stats: {
      tagCount: (cv.tag || []).length,
      triggerCount: (cv.trigger || []).length,
      variableCount: (cv.variable || []).length,
    }
  };
};

/**
 * Create a normalized key for matching items
 * Uses name + type since IDs can differ between containers
 */
const createMatchKey = (item, type) => {
  const name = item.name || '';
  const itemType = type === 'tag' ? item.type : 
                   type === 'trigger' ? item.type :
                   type === 'variable' ? item.type : '';
  return `${name}::${itemType}`.toLowerCase();
};

/**
 * Create a simplified version of an item for comparison
 * Removes volatile fields like IDs and fingerprints
 * Converts trigger IDs to names for meaningful comparison
 */
const normalizeForComparison = (item, type, triggerLookup = null) => {
  const copy = { ...item };
  
  // Remove volatile fields (these change on import even if content is same)
  delete copy.tagId;
  delete copy.triggerId;
  delete copy.variableId;
  delete copy.fingerprint;
  delete copy.tagManagerUrl;
  delete copy.parentFolderId;
  delete copy.workspaceId;
  delete copy.accountId;
  delete copy.containerId;
  delete copy.path;
  delete copy.notes;
  
  // Normalize arrays (remove order-sensitivity where appropriate)
  if (copy.parameter) {
    copy.parameter = sortParameters(copy.parameter);
  }
  
  // CRITICAL: Convert trigger IDs to trigger NAMES for comparison
  // This prevents false "modified" detection when same triggers have different IDs
  if (copy.firingTriggerId && triggerLookup) {
    copy.firingTriggerId = [...copy.firingTriggerId]
      .map(id => triggerLookup.get(id) || id)
      .sort();
  } else if (copy.firingTriggerId) {
    copy.firingTriggerId = [...copy.firingTriggerId].sort();
  }
  
  if (copy.blockingTriggerId && triggerLookup) {
    copy.blockingTriggerId = [...copy.blockingTriggerId]
      .map(id => triggerLookup.get(id) || id)
      .sort();
  } else if (copy.blockingTriggerId) {
    copy.blockingTriggerId = [...copy.blockingTriggerId].sort();
  }
  
  return copy;
};

/**
 * Sort parameters for consistent comparison
 */
const sortParameters = (params) => {
  if (!Array.isArray(params)) return params;
  
  return [...params].sort((a, b) => {
    const keyA = a.key || '';
    const keyB = b.key || '';
    return keyA.localeCompare(keyB);
  }).map(p => {
    // Recursively sort nested parameters
    if (p.list) {
      return { ...p, list: sortParameters(p.list) };
    }
    if (p.map) {
      return { ...p, map: sortParameters(p.map) };
    }
    return p;
  });
};

/**
 * Deep compare two objects
 */
const deepEqual = (a, b) => {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;
  
  if (typeof a !== 'object') return a === b;
  
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  
  const keysA = Object.keys(a).sort();
  const keysB = Object.keys(b).sort();
  
  if (keysA.length !== keysB.length) return false;
  if (keysA.join(',') !== keysB.join(',')) return false;
  
  for (const key of keysA) {
    if (!deepEqual(a[key], b[key])) return false;
  }
  
  return true;
};

/**
 * Find specific differences between two objects
 * Returns array of {field, oldValue, newValue} changes
 */
const findDifferences = (objA, objB, prefix = '', lookups = {}) => {
  const differences = [];
  const { triggerLookup } = lookups;
  
  // Get all unique keys
  const allKeys = new Set([
    ...Object.keys(objA || {}),
    ...Object.keys(objB || {})
  ]);
  
  // Fields to skip (not meaningful for users)
  const skipFields = ['tagId', 'triggerId', 'variableId', 'fingerprint', 
    'tagManagerUrl', 'parentFolderId', 'workspaceId', 'accountId', 
    'containerId', 'path', 'notes'];
  
  for (const key of allKeys) {
    if (skipFields.includes(key)) continue;
    
    const fieldPath = prefix ? `${prefix}.${key}` : key;
    const valA = objA?.[key];
    const valB = objB?.[key];
    
    // Both undefined - skip
    if (valA === undefined && valB === undefined) continue;
    
    // One is undefined
    if (valA === undefined) {
      differences.push({
        field: fieldPath,
        oldValue: null,
        newValue: formatValue(valB, fieldPath),
        type: 'added'
      });
      continue;
    }
    
    if (valB === undefined) {
      differences.push({
        field: fieldPath,
        oldValue: formatValue(valA, fieldPath),
        newValue: null,
        type: 'removed'
      });
      continue;
    }
    
    // Both exist - compare
    if (typeof valA === 'object' && typeof valB === 'object') {
      if (Array.isArray(valA) && Array.isArray(valB)) {
        // Compare arrays
        if (!deepEqual(valA, valB)) {
          // For trigger fields, values are already resolved to names by normalizeForComparison
          // Just display them directly
          differences.push({
            field: fieldPath,
            oldValue: formatValue(valA, fieldPath),
            newValue: formatValue(valB, fieldPath),
            type: 'changed'
          });
        }
      } else if (!Array.isArray(valA) && !Array.isArray(valB)) {
        // Recurse into objects (but limit depth for readability)
        if (prefix.split('.').length < 2) {
          const nestedDiffs = findDifferences(valA, valB, fieldPath, lookups);
          differences.push(...nestedDiffs);
        } else if (!deepEqual(valA, valB)) {
          differences.push({
            field: fieldPath,
            oldValue: formatValue(valA, fieldPath),
            newValue: formatValue(valB, fieldPath),
            type: 'changed'
          });
        }
      }
    } else if (valA !== valB) {
      differences.push({
        field: fieldPath,
        oldValue: formatValue(valA, fieldPath),
        newValue: formatValue(valB, fieldPath),
        type: 'changed'
      });
    }
  }
  
  return differences;
};

/**
 * =====================================================
 * HUMAN-READABLE GTM DATA FORMATTING
 * Matches the display style of existing Tags/Triggers/Variables pages
 * =====================================================
 */

/**
 * Condition/operator type mappings for human-readable display
 */
const OPERATOR_LABELS = {
  'EQUALS': 'equals',
  'CONTAINS': 'contains',
  'STARTS_WITH': 'starts with',
  'ENDS_WITH': 'ends with',
  'MATCHES_REGEX': 'matches regex',
  'MATCHES_CSS_SELECTOR': 'matches CSS selector',
  'GREATER': 'greater than',
  'GREATER_OR_EQUALS': '≥',
  'LESS': 'less than',
  'LESS_OR_EQUALS': '≤',
  'CSS_SELECTOR': 'CSS selector',
  'URL_MATCHES': 'URL matches',
  'DOES_NOT_EQUAL': 'does not equal',
  'DOES_NOT_CONTAIN': 'does not contain',
  'DOES_NOT_START_WITH': 'does not start with',
  'DOES_NOT_END_WITH': 'does not end with',
  'DOES_NOT_MATCH_REGEX': 'does not match regex',
};

/**
 * Tag type mappings
 */
const TAG_TYPE_LABELS = {
  'html': 'Custom HTML',
  'img': 'Custom Image',
  'ua': 'Google Analytics UA',
  'gaawc': 'GA4 Configuration',
  'gaawe': 'GA4 Event',
  'googtag': 'Google Tag',
  'gclidw': 'Conversion Linker',
  'awct': 'Google Ads Conversion',
  'sp': 'Google Ads Remarketing',
  'flc': 'Floodlight Counter',
  'fls': 'Floodlight Sales',
  'opt': 'Google Optimize',
};

/**
 * Trigger type mappings
 */
const TRIGGER_TYPE_LABELS = {
  'PAGEVIEW': 'Page View',
  'DOM_READY': 'DOM Ready',
  'WINDOW_LOADED': 'Window Loaded',
  'CLICK': 'Click - All Elements',
  'LINK_CLICK': 'Click - Just Links',
  'FORM_SUBMISSION': 'Form Submission',
  'HISTORY_CHANGE': 'History Change',
  'JAVASCRIPT_ERROR': 'JavaScript Error',
  'SCROLL_DEPTH': 'Scroll Depth',
  'ELEMENT_VISIBILITY': 'Element Visibility',
  'YOUTUBE_VIDEO': 'YouTube Video',
  'CUSTOM_EVENT': 'Custom Event',
  'TIMER': 'Timer',
  'TRIGGER_GROUP': 'Trigger Group',
  'INIT': 'Initialization',
  'CONSENT_INIT': 'Consent Initialization',
};

/**
 * Variable type mappings
 */
const VARIABLE_TYPE_LABELS = {
  'k': 'First Party Cookie',
  'v': 'Data Layer Variable',
  'j': 'JavaScript Variable',
  'jsm': 'Custom JavaScript',
  'c': 'Constant',
  'r': 'HTTP Referrer',
  'u': 'URL',
  'f': 'URL Fragment',
  'e': 'Event',
  'd': 'DOM Element',
  'vis': 'Element Visibility',
  'gas': 'Google Analytics Settings',
  'gtes': 'Google Tag Event Settings',
  'gtcs': 'Google Tag Config Settings',
  'remm': 'Regex Table',
  'smm': 'Lookup Table',
  'ctv': 'Container Version',
};

/**
 * Parameter key mappings for better labels
 */
const PARAM_KEY_LABELS = {
  'html': 'HTML Code',
  'trackingId': 'Tracking ID',
  'measurementId': 'Measurement ID',
  'eventName': 'Event Name',
  'conversionId': 'Conversion ID',
  'conversionLabel': 'Conversion Label',
  'value': 'Value',
  'currency': 'Currency',
  'transactionId': 'Transaction ID',
  'sendPageView': 'Send Page View',
  'enableLinkId': 'Enable Link ID',
  'anonymizeIp': 'Anonymize IP',
  'enableEcommerce': 'Enhanced Ecommerce',
  'useDebugVersion': 'Debug Mode',
  'waitForUpdate': 'Wait for Update',
  'waitForUpdateTimeout': 'Timeout (ms)',
  'name': 'Variable Name',
  'dataLayerVersion': 'Data Layer Version',
  'setDefaultValue': 'Default Value Set',
  'defaultValue': 'Default Value',
  'input': 'Input Variable',
  'output': 'Output Variable',
  'map': 'Lookup Table',
};

/**
 * Check if value is a variable reference
 */
const isVariableRef = (val) => {
  if (typeof val !== 'string') return false;
  return val.startsWith('{{') && val.endsWith('}}');
};

/**
 * Format variable reference - keep {{ }} to show it's a variable
 */
const formatVariableRef = (val) => {
  if (typeof val !== 'string') return val;
  // Keep the {{ }} format so users know it's a variable
  if (isVariableRef(val)) {
    return val; // Keep as {{Variable Name}}
  }
  return val;
};

/**
 * Format a single condition/filter into readable string
 */
const formatSingleCondition = (filter) => {
  if (!filter || !filter.parameter) return null;
  
  const params = filter.parameter;
  let variable = '';
  let value = '';
  const operator = OPERATOR_LABELS[filter.type] || filter.type?.toLowerCase() || 'matches';
  
  for (const param of params) {
    if (param.key === 'arg0') {
      // Keep {{Variable}} format to show it's a variable
      variable = formatVariableRef(param.value) || '';
    } else if (param.key === 'arg1') {
      value = param.value || '';
    }
  }
  
  if (variable && value) {
    return `${variable} ${operator} "${value}"`;
  } else if (variable) {
    return `${variable} ${operator}`;
  }
  
  return null;
};

/**
 * Format filter/condition array into readable string
 */
const formatConditions = (filters) => {
  if (!Array.isArray(filters) || filters.length === 0) return null;
  
  const conditions = filters
    .map(f => formatSingleCondition(f))
    .filter(Boolean);
  
  if (conditions.length === 0) return null;
  if (conditions.length === 1) return conditions[0];
  
  return conditions.join(' AND ');
};

/**
 * Format a single parameter into readable key: value
 */
const formatSingleParameter = (param) => {
  if (!param || !param.key) return null;
  
  const label = PARAM_KEY_LABELS[param.key] || param.key;
  
  if (param.value !== undefined) {
    let value = param.value;
    // Keep {{Variable}} format to show it's a variable reference
    value = formatVariableRef(value);
    return `${label}: ${value}`;
  }
  
  if (param.list && Array.isArray(param.list)) {
    const items = param.list.slice(0, 2).map(item => {
      if (item.map) {
        const mapItems = item.map.slice(0, 2).map(m => 
          `${m.key || ''}=${formatVariableRef(m.value) || ''}`
        ).join(', ');
        return `{${mapItems}${item.map.length > 2 ? '...' : ''}}`;
      }
      return formatVariableRef(item.value) || JSON.stringify(item);
    });
    return `${label}: [${items.join(', ')}${param.list.length > 2 ? ` +${param.list.length - 2} more` : ''}]`;
  }
  
  if (param.map && Array.isArray(param.map)) {
    const entries = param.map.slice(0, 2).map(m => 
      `${m.key || '?'}: ${formatVariableRef(m.value) || '?'}`
    ).join(', ');
    return `${label}: {${entries}${param.map.length > 2 ? '...' : ''}}`;
  }
  
  return `${label}: (configured)`;
};

/**
 * Format parameters array into readable string
 */
const formatParameters = (params) => {
  if (!Array.isArray(params) || params.length === 0) return null;
  
  // Important parameters to show first
  const importantKeys = ['trackingId', 'measurementId', 'eventName', 'conversionId', 'html', 'name', 'value'];
  
  const sorted = [...params].sort((a, b) => {
    const aIdx = importantKeys.indexOf(a.key);
    const bIdx = importantKeys.indexOf(b.key);
    if (aIdx >= 0 && bIdx >= 0) return aIdx - bIdx;
    if (aIdx >= 0) return -1;
    if (bIdx >= 0) return 1;
    return 0;
  });
  
  const formatted = sorted.slice(0, 3).map(p => formatSingleParameter(p)).filter(Boolean);
  
  if (formatted.length === 0) return null;
  
  const result = formatted.join(' | ');
  if (params.length > 3) {
    return `${result} (+${params.length - 3} more)`;
  }
  return result;
};

/**
 * Get human-readable type label
 */
const getTypeLabel = (type, category = 'tag') => {
  if (!type) return 'Unknown';
  
  if (category === 'tag') {
    return TAG_TYPE_LABELS[type] || type;
  } else if (category === 'trigger') {
    return TRIGGER_TYPE_LABELS[type] || type;
  } else if (category === 'variable') {
    return VARIABLE_TYPE_LABELS[type] || type;
  }
  
  return type;
};

/**
 * Main formatting function - makes any GTM value human-readable
 */
const formatValue = (val, fieldName = '') => {
  if (val === null || val === undefined) return null;
  if (typeof val === 'string') {
    // Keep {{Variable}} format so users know it's a variable reference
    return formatVariableRef(val);
  }
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'number') return String(val);
  
  if (Array.isArray(val)) {
    if (val.length === 0) return '(none)';
    
    const fieldLower = fieldName.toLowerCase();
    
    // Filter/condition arrays
    if (fieldLower.includes('filter')) {
      const formatted = formatConditions(val);
      if (formatted) return formatted;
    }
    
    // Trigger IDs (already resolved to names)
    if (fieldLower.includes('trigger') && val.every(v => typeof v === 'string')) {
      return val.join(', ');
    }
    
    // Parameters array
    if (fieldLower.includes('parameter') && val[0]?.key !== undefined) {
      const formatted = formatParameters(val);
      if (formatted) return formatted;
    }
    
    // Generic array of objects with key/value
    if (val[0]?.key !== undefined) {
      const formatted = val.slice(0, 3).map(p => formatSingleParameter(p)).filter(Boolean);
      if (formatted.length > 0) {
        return formatted.join(' | ') + (val.length > 3 ? ` (+${val.length - 3})` : '');
      }
    }
    
    // Simple array of strings
    if (val.every(v => typeof v === 'string')) {
      if (val.length <= 3) return val.join(', ');
      return `${val.slice(0, 3).join(', ')} (+${val.length - 3})`;
    }
    
    return `${val.length} items`;
  }
  
  if (typeof val === 'object') {
    // Single parameter object
    if (val.key !== undefined) {
      const formatted = formatSingleParameter(val);
      if (formatted) return formatted;
    }
    
    // Consent settings
    if (val.consentStatus !== undefined) {
      return val.consentStatus === 'NEEDED' ? 'Consent needed' : 
             val.consentStatus === 'NOT_NEEDED' ? 'No consent needed' : val.consentStatus;
    }
    
    const keys = Object.keys(val);
    if (keys.length === 0) return '(empty)';
    if (keys.length <= 2) {
      return keys.map(k => `${k}: ${val[k]}`).join(', ');
    }
    return `${keys.length} settings`;
  }
  
  return String(val);
};

/**
 * Get human-readable field name
 */
const getFieldLabel = (field) => {
  const labels = {
    // Common fields
    'name': 'Name',
    'type': 'Type',
    'paused': 'Paused',
    
    // Tag fields
    'parameter': 'Configuration',
    'firingTriggerId': 'Firing Triggers',
    'blockingTriggerId': 'Blocking Triggers',
    'tagFiringOption': 'Firing Option',
    'monitoringMetadata': 'Monitoring',
    'monitoringMetadataTagNameKey': 'Monitoring Tag Name',
    'consentSettings': 'Consent Settings',
    'priority': 'Priority',
    'teardownTag': 'Cleanup Tag',
    'setupTag': 'Setup Tag',
    'tagSequencing': 'Tag Sequencing',
    'liveOnly': 'Live Only',
    
    // Trigger fields
    'filter': 'Conditions',
    'autoEventFilter': 'Auto-Event Conditions',
    'customEventFilter': 'Event Conditions',
    'waitForTags': 'Wait for Tags',
    'checkValidation': 'Check Validation',
    'waitForTagsTimeout': 'Wait Timeout',
    'uniqueTriggerId': 'Fire Once Per',
    'maxTimerLengthSeconds': 'Timer Limit',
    'interval': 'Timer Interval',
    'eventName': 'Event Name',
    'limit': 'Limit',
    
    // Variable fields
    'formatValue': 'Format Value',
    'scheduleStartMs': 'Schedule Start',
    'scheduleEndMs': 'Schedule End',
    'defaultValue': 'Default Value',
    
    // Scroll Depth
    'verticalThresholdUnits': 'Threshold Units',
    'verticalThresholdsPercent': 'Vertical %',
    'verticalThresholdsPixels': 'Vertical Pixels',
    'horizontalThresholdUnits': 'Horizontal Units',
    'horizontalThresholdsPercent': 'Horizontal %',
    'horizontalThresholdsPixels': 'Horizontal Pixels',
    
    // Element Visibility
    'visibilitySelector': 'CSS Selector',
    'visiblePercentageMin': 'Min % Visible',
    'visiblePercentageMax': 'Max % Visible',
    'continuousTimeMinMilliseconds': 'Min Time Visible',
    'onScreenRatio': 'On Screen Ratio',
    
    // YouTube
    'triggerStartOption': 'Trigger On',
    'captureComplete': 'Capture Complete',
    'capturePause': 'Capture Pause',
    'captureStart': 'Capture Start',
    'captureProgress': 'Capture Progress',
    'progressThresholdsPercent': 'Progress Thresholds',
    'fixMissingApi': 'Fix Missing API',
    
    // Form
    'waitForTagsTimeout': 'Tag Wait Timeout',
    'checkValidation': 'Check Validation',
    
    // Click
    'targetSelector': 'Click Selector',
    'matchSelector': 'Match Selector',
    'onlyLinks': 'Only Links',
    'waitForTags': 'Wait For Tags',
  };
  
  // Handle nested fields
  const parts = field.split('.');
  const lastPart = parts[parts.length - 1];
  
  return labels[lastPart] || lastPart.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
};

/**
 * Create trigger ID to name lookup map
 */
const createTriggerLookup = (triggersA, triggersB) => {
  const lookup = new Map();
  
  [...(triggersA || []), ...(triggersB || [])].forEach(trigger => {
    if (trigger.triggerId) {
      lookup.set(trigger.triggerId, trigger.name || `Trigger ${trigger.triggerId}`);
    }
  });
  
  return lookup;
};

/**
 * Create variable ID to name lookup map
 */
const createVariableLookup = (variablesA, variablesB) => {
  const lookup = new Map();
  
  [...(variablesA || []), ...(variablesB || [])].forEach(variable => {
    if (variable.variableId) {
      lookup.set(variable.variableId, variable.name || `Variable ${variable.variableId}`);
    }
  });
  
  return lookup;
};

/**
 * Resolve trigger IDs to names
 */
const resolveTriggerIds = (ids, lookup) => {
  if (!Array.isArray(ids)) return ids;
  return ids.map(id => lookup.get(id) || `Unknown (${id})`);
};

/**
 * Compare items of a specific type between two containers
 */
const compareItems = (itemsA, itemsB, type, lookups = {}) => {
  const { triggerLookupA, triggerLookupB, triggerLookup } = lookups;
  
  const mapA = new Map();
  const mapB = new Map();
  
  // Build maps with match keys
  itemsA.forEach(item => {
    const key = createMatchKey(item, type);
    mapA.set(key, item);
  });
  
  itemsB.forEach(item => {
    const key = createMatchKey(item, type);
    mapB.set(key, item);
  });
  
  const added = [];
  const removed = [];
  const modified = [];
  const identical = [];
  
  // Find removed and modified/identical
  mapA.forEach((itemA, key) => {
    if (!mapB.has(key)) {
      removed.push({
        name: itemA.name,
        type: itemA.type,
        item: itemA,
        changeType: 'removed'
      });
    } else {
      const itemB = mapB.get(key);
      
      // Normalize with container-specific trigger lookups
      // This converts trigger IDs to names so same triggers with different IDs match
      const normalizedA = normalizeForComparison(itemA, type, triggerLookupA);
      const normalizedB = normalizeForComparison(itemB, type, triggerLookupB);
      
      if (deepEqual(normalizedA, normalizedB)) {
        identical.push({
          name: itemA.name,
          type: itemA.type,
          itemA,
          itemB,
          changeType: 'identical'
        });
      } else {
        // Find specific differences with lookups for resolving IDs (for display)
        const differences = findDifferences(normalizedA, normalizedB, '', { triggerLookup });
        modified.push({
          name: itemA.name,
          type: itemA.type,
          itemA,
          itemB,
          changeType: 'modified',
          differences: differences.map(d => ({
            ...d,
            label: getFieldLabel(d.field)
          }))
        });
      }
    }
  });
  
  // Find added
  mapB.forEach((itemB, key) => {
    if (!mapA.has(key)) {
      added.push({
        name: itemB.name,
        type: itemB.type,
        item: itemB,
        changeType: 'added'
      });
    }
  });
  
  return {
    added,
    removed,
    modified,
    identical,
    summary: {
      added: added.length,
      removed: removed.length,
      modified: modified.length,
      identical: identical.length,
      total: itemsA.length + added.length - removed.length
    }
  };
};

/**
 * Create trigger lookup for a single container (ID -> Name)
 */
const createContainerTriggerLookup = (triggers) => {
  const lookup = new Map();
  (triggers || []).forEach(trigger => {
    if (trigger.triggerId) {
      lookup.set(trigger.triggerId, trigger.name || `Trigger ${trigger.triggerId}`);
    }
  });
  return lookup;
};

/**
 * Main comparison function
 * Compares two GTM containers and returns detailed diff
 */
export const compareContainers = (containerA, containerB) => {
  if (!containerA || !containerB) {
    return null;
  }
  
  const infoA = extractContainerInfo(containerA);
  const infoB = extractContainerInfo(containerB);
  
  if (!infoA || !infoB) {
    return null;
  }
  
  // Create SEPARATE lookups for each container
  // This is crucial: each container has its own trigger IDs
  // We convert IDs to NAMES before comparison so same triggers match
  const triggerLookupA = createContainerTriggerLookup(infoA.triggers);
  const triggerLookupB = createContainerTriggerLookup(infoB.triggers);
  
  // Combined lookup for display purposes (resolving IDs in diff output)
  const triggerLookup = createTriggerLookup(infoA.triggers, infoB.triggers);
  const variableLookup = createVariableLookup(infoA.variables, infoB.variables);
  
  const lookups = {
    triggerLookupA,  // For normalizing Container A items
    triggerLookupB,  // For normalizing Container B items
    triggerLookup,   // Combined, for display
    variableLookup
  };
  
  // Compare each type
  const tags = compareItems(infoA.tags, infoB.tags, 'tag', lookups);
  const triggers = compareItems(infoA.triggers, infoB.triggers, 'trigger', lookups);
  const variables = compareItems(infoA.variables, infoB.variables, 'variable', lookups);
  
  return {
    containerA: infoA,
    containerB: infoB,
    tags,
    triggers,
    variables,
    summary: {
      totalChanges: 
        tags.summary.added + tags.summary.removed + tags.summary.modified +
        triggers.summary.added + triggers.summary.removed + triggers.summary.modified +
        variables.summary.added + variables.summary.removed + variables.summary.modified,
      hasChanges: 
        tags.summary.added > 0 || tags.summary.removed > 0 || tags.summary.modified > 0 ||
        triggers.summary.added > 0 || triggers.summary.removed > 0 || triggers.summary.modified > 0 ||
        variables.summary.added > 0 || variables.summary.removed > 0 || variables.summary.modified > 0
    }
  };
};

export default compareContainers;

