/**
 * GTM Container Cleaner Utility
 * Generates an optimized GTM container JSON export by removing selected items
 */

/**
 * Filter out user-selected duplicate tags, orphan triggers, and unused variables from raw GTM container data
 * @param {Object} rawGTMData Original GTM container JSON data
 * @param {Set<string>} selectedTagIds Set of tag IDs selected for deletion
 * @param {Set<string>} selectedTriggerIds Set of trigger IDs selected for deletion
 * @param {Set<string>} selectedVariableIds Set of variable IDs selected for deletion
 * @returns {Object} Cleaned GTM container JSON data
 */
export const generateCleanContainer = (rawGTMData, selectedTagIds, selectedTriggerIds, selectedVariableIds) => {
  if (!rawGTMData) return null;

  // Deep clone to avoid mutating the original reference
  const cleanData = JSON.parse(JSON.stringify(rawGTMData));
  
  const version = cleanData.containerVersion;
  if (!version) return rawGTMData;

  // 1. Remove selected duplicate tags
  if (version.tag && selectedTagIds && selectedTagIds.size > 0) {
    version.tag = version.tag.filter(tag => !selectedTagIds.has(tag.tagId));
  }

  // 2. Remove selected orphan triggers
  if (version.trigger && selectedTriggerIds && selectedTriggerIds.size > 0) {
    version.trigger = version.trigger.filter(trigger => !selectedTriggerIds.has(trigger.triggerId));
  }

  // 3. Remove selected unused variables
  if (version.variable && selectedVariableIds && selectedVariableIds.size > 0) {
    version.variable = version.variable.filter(variable => !selectedVariableIds.has(variable.variableId));
  }

  return cleanData;
};

/**
 * Trigger client-side download of JSON data
 * @param {Object} data JSON data object
 * @param {string} filename Output file name
 */
export const downloadJSON = (data, filename) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
