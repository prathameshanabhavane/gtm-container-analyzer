/**
 * Duplicate Tag Detection Module
 * 
 * Pure functions for detecting duplicate tags in GTM containers.
 * All functions receive required state as parameters for testability.
 */

// Extract key identifiers from a tag for comparison
export const extractTagIdentifiers = (tag, triggers) => {
  const identifiers = {
    type: tag.type,
    trackingId: null,
    pixelId: null,
    conversionId: null,
    measurementId: null,
    eventName: null,
    scriptContent: null,  // For Custom HTML tags
    triggers: [],
    triggerNames: [],     // Trigger names for display
    triggerTypes: [],     // Trigger types (pageview, click, custom event, etc.)
    triggerConditions: {
      pagePaths: [],
      pageUrls: [],
      queryParams: [],
      events: [],
      allConditions: [],  // Store ALL conditions for exact matching
      conditionHash: '',
    },
    configHash: '',
    fullHash: '',         // Complete hash for exact duplicate detection
  };
  
  // Get trigger info
  if (tag.firingTriggerId) {
    identifiers.triggers = [...tag.firingTriggerId].sort();
    
    // Extract trigger types, names, and ALL conditions
    tag.firingTriggerId.forEach(triggerId => {
      const trigger = triggers.find(t => t.triggerId === triggerId);
      if (!trigger) return;
      
      // Store trigger name
      if (trigger.name) {
        identifiers.triggerNames.push(trigger.name);
      }
      
      // Store trigger type
      if (trigger.type && !identifiers.triggerTypes.includes(trigger.type)) {
        identifiers.triggerTypes.push(trigger.type);
      }
      
      // Extract ALL conditions from ALL filter arrays
      const filterArrays = [
        trigger.filter, 
        trigger.customEventFilter, 
        trigger.autoEventFilter
      ].filter(Boolean);
      
      filterArrays.forEach((filterArray, filterIndex) => {
        if (!Array.isArray(filterArray)) return;
        
        filterArray.forEach((condition) => {
          if (!condition.parameter) return;
          
          let arg0 = '';
          let arg1 = '';
          let condType = condition.type || '';
          let ignoreCase = false;
          let negate = false;
          
          // Extract ALL parameters from condition
          condition.parameter.forEach(param => {
            if (param.key === 'arg0') arg0 = param.value || '';
            if (param.key === 'arg1') arg1 = param.value || '';
            if (param.key === 'ignore_case') ignoreCase = param.value === 'true';
            if (param.key === 'negate') negate = param.value === 'true';
          });
          
          // Store COMPLETE condition with trigger context
          const fullCondition = {
            triggerId: triggerId,
            triggerName: trigger.name || '',
            filterType: filterIndex === 0 ? 'filter' : filterIndex === 1 ? 'customEventFilter' : 'autoEventFilter',
            variable: arg0,       // e.g., {{Make}}, {{Page Path}}
            type: condType,       // e.g., MATCH_REGEX, CONTAINS
            value: arg1,          // e.g., ^chrysler$, /deals
            ignoreCase,
            negate,
          };
          identifiers.triggerConditions.allConditions.push(fullCondition);
          
          // Categorize for UI display (optional)
          const arg0Lower = arg0.toLowerCase();
          if (arg0Lower.includes('path')) {
            identifiers.triggerConditions.pagePaths.push({ variable: arg0, type: condType, value: arg1, negate, ignoreCase });
          } else if (arg0Lower.includes('url') && !arg0Lower.includes('referrer')) {
            identifiers.triggerConditions.pageUrls.push({ variable: arg0, type: condType, value: arg1, negate, ignoreCase });
          } else if (arg0Lower.includes('query')) {
            identifiers.triggerConditions.queryParams.push({ variable: arg0, type: condType, value: arg1, negate, ignoreCase });
          } else if (arg0Lower.includes('event') || arg0 === '_event') {
            identifiers.triggerConditions.events.push({ variable: arg0, type: condType, value: arg1, negate, ignoreCase });
          }
        });
      });
    });
    
    // Sort trigger types and names for consistent comparison
    identifiers.triggerTypes.sort();
    identifiers.triggerNames.sort();
    
    // Create COMPREHENSIVE condition hash including ALL details
    // This ensures conditions like {{Make}} MATCH_REGEX ^chrysler$ vs {{Make}} MATCH_REGEX ^ford$ are DIFFERENT
    const allConditionsStr = identifiers.triggerConditions.allConditions
      .map(c => `${c.triggerName}|${c.filterType}|${c.variable}|${c.type}|${c.value}|${c.ignoreCase}|${c.negate}`)
      .sort()
      .join('||');
    identifiers.triggerConditions.conditionHash = allConditionsStr;
  }
  
  // Extract ALL parameters including nested structures (list, map, lookup tables)
  const params = tag.parameter || [];
  const allParamsForHash = []; // Store ALL params for strict comparison
  const usedVariables = [];    // Track all variables used in this tag
  
  // Helper to extract ALL values recursively (handles nested list/map structures)
  const extractAllValues = (param, prefix = '') => {
    const result = { key: prefix + (param.key || ''), values: [] };
    
    // Simple value
    if (param.value !== undefined) {
      result.values.push(param.value);
      // Track variable references
      if (typeof param.value === 'string' && param.value.includes('{{')) {
        usedVariables.push(param.value);
      }
    }
    
    // List of items (e.g., field mappings, lookup tables)
    if (param.list && Array.isArray(param.list)) {
      param.list.forEach((item) => {
        if (item.map && Array.isArray(item.map)) {
          // Map entries (key-value pairs in lookup tables)
          item.map.forEach(mapItem => {
            const mapKey = mapItem.key || '';
            const mapValue = mapItem.value || '';
            result.values.push(`${mapKey}=${mapValue}`);
            if (typeof mapValue === 'string' && mapValue.includes('{{')) {
              usedVariables.push(mapValue);
            }
          });
        } else if (item.value !== undefined) {
          result.values.push(item.value);
          if (typeof item.value === 'string' && item.value.includes('{{')) {
            usedVariables.push(item.value);
          }
        }
      });
    }
    
    // Map structure directly on param
    if (param.map && Array.isArray(param.map)) {
      param.map.forEach(mapItem => {
        const mapKey = mapItem.key || '';
        const mapValue = mapItem.value || '';
        result.values.push(`${mapKey}=${mapValue}`);
        if (typeof mapValue === 'string' && mapValue.includes('{{')) {
          usedVariables.push(mapValue);
        }
      });
    }
    
    return result;
  };
  
  params.forEach(param => {
    const key = param.key?.toLowerCase() || '';
    const value = param.value || '';
    
    // Extract ALL values for hash (including nested)
    const extracted = extractAllValues(param);
    allParamsForHash.push({
      key: param.key,
      values: extracted.values,
      fullParam: JSON.stringify(param), // Keep full structure for exact comparison
    });
    
    // Tracking IDs
    if (key === 'trackingid' || key === 'tagid' || key === 'measurementid') {
      identifiers.trackingId = value;
    }
    if (key === 'measurement_id' || key === 'measurementidoverride') {
      identifiers.measurementId = value;
    }
    // Pixel IDs
    if (key === 'pixelid' || key === 'pixel_id' || key === 'pixel_code') {
      identifiers.pixelId = value;
    }
    // Conversion IDs
    if (key === 'conversionid') {
      identifiers.conversionId = value;
    }
    // Event names
    if (key === 'eventname' || key === 'event_name' || key === 'event') {
      identifiers.eventName = value;
    }
    // Script content for Custom HTML
    if (key === 'html') {
      // Normalize script: remove whitespace, comments for comparison
      identifiers.scriptContent = (value || '')
        .replace(/\s+/g, ' ')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .trim();
    }
  });
  
  // Store used variables for reference
  identifiers.usedVariables = [...new Set(usedVariables)].sort();
  
  // Create COMPREHENSIVE config hash including ALL params with full structure
  // This ensures lookup tables, field mappings, etc. are strictly compared
  const configParts = allParamsForHash
    .filter(p => !['name', 'tagId'].includes(p.key))
    .map(p => `${p.key}:${p.fullParam}`) // Use FULL JSON structure for comparison
    .sort()
    .join('|||');
  identifiers.configHash = configParts;
  
  // Create FULL hash combining EVERYTHING for exact duplicate detection
  // This ensures tags are only duplicates if ALL of these match EXACTLY:
  // - Tag type
  // - Trigger names (sorted)
  // - Trigger types (sorted)
  // - ALL trigger conditions (variable, type, value, ignoreCase, negate)
  // - ALL tag configuration (including lookup tables, field mappings, etc.)
  // - ALL used variables ({{Variable Name}})
  // - Script content (if any)
  const fullHashParts = [
    `type:${tag.type}`,
    `triggerNames:${identifiers.triggerNames.join(',')}`,
    `triggerTypes:${identifiers.triggerTypes.join(',')}`,
    `conditions:${identifiers.triggerConditions.conditionHash}`,
    `variables:${identifiers.usedVariables.join(',')}`,
    `config:${identifiers.configHash}`,
  ];
  if (identifiers.scriptContent) {
    fullHashParts.push(`script:${identifiers.scriptContent}`);
  }
  identifiers.fullHash = fullHashParts.join('||||');
  
  return identifiers;
};

// Check if two tags are EXACT duplicates (strict matching)
// Returns: { isDuplicate: boolean, differences: string[] }
export const compareTagsStrict = (tag1Ids, tag2Ids) => {
  const differences = [];
  
  // 1. Tag type MUST match
  if (tag1Ids.type !== tag2Ids.type) {
    return { isDuplicate: false, differences: ['Different tag type'] };
  }
  
  // 2. Check full hash first (fastest exact match)
  if (tag1Ids.fullHash && tag2Ids.fullHash && tag1Ids.fullHash === tag2Ids.fullHash) {
    return { isDuplicate: true, differences: [] };
  }
  
  // 3. Check trigger names - MUST be identical (different triggers = different tags)
  const triggerNames1 = tag1Ids.triggerNames.sort().join(',');
  const triggerNames2 = tag2Ids.triggerNames.sort().join(',');
  if (triggerNames1 !== triggerNames2) {
    differences.push(`Different triggers: [${triggerNames1 || 'none'}] vs [${triggerNames2 || 'none'}]`);
  }
  
  // 4. Check trigger types - MUST be identical
  const triggerTypes1 = tag1Ids.triggerTypes.sort().join(',');
  const triggerTypes2 = tag2Ids.triggerTypes.sort().join(',');
  if (triggerTypes1 !== triggerTypes2) {
    differences.push(`Different trigger types: [${triggerTypes1 || 'none'}] vs [${triggerTypes2 || 'none'}]`);
  }
  
  // 5. Check ALL trigger conditions - MUST be EXACTLY identical
  // This is the KEY check - conditions include:
  // - Variable (e.g., {{Make}}, {{Page Path}})
  // - Type (e.g., MATCH_REGEX, CONTAINS)
  // - Value (e.g., ^chrysler$, /deals)
  // - ignoreCase
  // - negate
  const tc1 = tag1Ids.triggerConditions;
  const tc2 = tag2Ids.triggerConditions;
  
  if (tc1.conditionHash !== tc2.conditionHash) {
    // Condition hashes differ - find specific differences
    const conds1 = tc1.allConditions;
    const conds2 = tc2.allConditions;
    
    if (conds1.length !== conds2.length) {
      differences.push(`Different condition count: ${conds1.length} vs ${conds2.length}`);
    } else {
      // Check each condition for exact match
      const unmatchedConditions = conds1.filter(c1 => 
        !conds2.some(c2 => 
          c1.variable === c2.variable &&
          c1.type === c2.type &&
          c1.value === c2.value &&
          c1.ignoreCase === c2.ignoreCase &&
          c1.negate === c2.negate
        )
      );
      
      if (unmatchedConditions.length > 0) {
        // Show specific condition differences
        unmatchedConditions.forEach(c => {
          differences.push(`Different condition: ${c.variable} ${c.type} "${c.value}"`);
        });
      }
    }
  }
  
  // 6. Check used variables - MUST be identical
  // Variables like {{GA Measurement Id}}, {{Conversion Label}}, etc.
  const vars1 = (tag1Ids.usedVariables || []).join(',');
  const vars2 = (tag2Ids.usedVariables || []).join(',');
  if (vars1 !== vars2) {
    const uniqueToTag1 = tag1Ids.usedVariables?.filter(v => !tag2Ids.usedVariables?.includes(v)) || [];
    const uniqueToTag2 = tag2Ids.usedVariables?.filter(v => !tag1Ids.usedVariables?.includes(v)) || [];
    if (uniqueToTag1.length > 0 || uniqueToTag2.length > 0) {
      differences.push(`Different variables used: [${uniqueToTag1.join(', ')}] vs [${uniqueToTag2.join(', ')}]`);
    }
  }
  
  // 7. Check tag configuration - MUST be identical
  // This includes ALL parameters: lookup tables, field mappings, etc.
  if (tag1Ids.configHash !== tag2Ids.configHash) {
    // Find specific config differences
    if (tag1Ids.trackingId !== tag2Ids.trackingId) {
      differences.push(`Different tracking ID: ${tag1Ids.trackingId || 'none'} vs ${tag2Ids.trackingId || 'none'}`);
    }
    if (tag1Ids.pixelId !== tag2Ids.pixelId) {
      differences.push(`Different pixel ID: ${tag1Ids.pixelId || 'none'} vs ${tag2Ids.pixelId || 'none'}`);
    }
    if (tag1Ids.measurementId !== tag2Ids.measurementId) {
      differences.push(`Different measurement ID: ${tag1Ids.measurementId || 'none'} vs ${tag2Ids.measurementId || 'none'}`);
    }
    if (tag1Ids.conversionId !== tag2Ids.conversionId) {
      differences.push(`Different conversion ID: ${tag1Ids.conversionId || 'none'} vs ${tag2Ids.conversionId || 'none'}`);
    }
    if (tag1Ids.eventName !== tag2Ids.eventName) {
      differences.push(`Different event name: ${tag1Ids.eventName || 'none'} vs ${tag2Ids.eventName || 'none'}`);
    }
    // If no specific difference found but config hash differs
    // This catches lookup table differences, field mapping differences, etc.
    if (!differences.some(d => d.includes('Different'))) {
      differences.push('Different tag configuration (lookup tables, field mappings, etc.)');
    }
  }
  
  // 8. Check script content (for Custom HTML) - MUST be identical
  if (tag1Ids.scriptContent || tag2Ids.scriptContent) {
    if (tag1Ids.scriptContent !== tag2Ids.scriptContent) {
      differences.push('Different script content');
    }
  }
  
  // ONLY exact match is a duplicate - ANY difference means UNIQUE
  return { 
    isDuplicate: differences.length === 0, 
    differences 
  };
};

// Calculate similarity score - only 100 (exact duplicate) or 0 (unique)
export const calculateSimilarity = (tag1Ids, tag2Ids) => {
  const result = compareTagsStrict(tag1Ids, tag2Ids);
  return result.isDuplicate ? 100 : 0;
};

// Get what makes these tags identical (for exact duplicates)
export const getExactMatchDetails = (ids, TAG_TYPE_MAP) => {
  const details = [];
  
  // Tag type
  details.push(`Type: ${TAG_TYPE_MAP[ids.type] || ids.type}`);
  
  // Trigger types
  if (ids.triggerTypes.length > 0) {
    const typeMap = {
      'pageview': 'Page View',
      'customEvent': 'Custom Event',
      'click': 'Click',
      'linkClick': 'Link Click',
      'formSubmit': 'Form Submit',
      'domReady': 'DOM Ready',
      'windowLoaded': 'Window Loaded',
      'timer': 'Timer',
      'scrollDepth': 'Scroll Depth',
      'elementVisibility': 'Element Visibility',
    };
    const typeNames = ids.triggerTypes.map(t => typeMap[t] || t);
    details.push(`Trigger: ${typeNames.join(', ')}`);
  }
  
  // Key IDs
  if (ids.trackingId) details.push(`Tracking ID: ${ids.trackingId}`);
  if (ids.pixelId) details.push(`Pixel ID: ${ids.pixelId}`);
  if (ids.measurementId) details.push(`Measurement ID: ${ids.measurementId}`);
  if (ids.conversionId) details.push(`Conversion ID: ${ids.conversionId}`);
  
  // Conditions count
  const tc = ids.triggerConditions;
  const conditionCount = tc.pagePaths.length + tc.pageUrls.length + tc.queryParams.length + tc.events.length;
  if (conditionCount > 0) {
    details.push(`${conditionCount} condition${conditionCount > 1 ? 's' : ''}`);
  }
  
  // Script
  if (ids.scriptContent) {
    details.push('Custom script');
  }
  
  return details.join(' • ');
};

// Detect duplicate tags
// Receives required state as parameters for purity
export const detectDuplicateTags = (tags, triggers, processedTags, TAG_TYPE_MAP) => {
  if (!processedTags || processedTags.length === 0) return [];
  
  const duplicateGroups = [];
  const processedPairs = new Set();
  
  // Extract identifiers for all tags
  const tagsWithIds = tags.map(tag => ({
    tag,
    processed: processedTags.find(p => p.id === tag.tagId),
    identifiers: extractTagIdentifiers(tag, triggers),
  }));
  
  // Group by type first
  const tagsByType = {};
  tagsWithIds.forEach(item => {
    const type = item.identifiers.type;
    if (!tagsByType[type]) tagsByType[type] = [];
    tagsByType[type].push(item);
  });
  
  // Check for EXACT duplicates within each type group
  Object.entries(tagsByType).forEach(([type, typeTags]) => {
    if (typeTags.length < 2) return;
    
    for (let i = 0; i < typeTags.length; i++) {
      for (let j = i + 1; j < typeTags.length; j++) {
        const tag1 = typeTags[i];
        const tag2 = typeTags[j];
        const pairKey = [tag1.tag.tagId, tag2.tag.tagId].sort().join('-');
        
        if (processedPairs.has(pairKey)) continue;
        processedPairs.add(pairKey);
        
        // STRICT comparison - only exact matches are duplicates
        const comparison = compareTagsStrict(tag1.identifiers, tag2.identifiers);
        
        if (comparison.isDuplicate) {
          // Find or create a group for this duplicate set
          let foundGroup = duplicateGroups.find(g => 
            g.tags.some(t => t.id === tag1.tag.tagId || t.id === tag2.tag.tagId)
          );
          
          if (foundGroup) {
            // Add to existing group
            if (!foundGroup.tags.some(t => t.id === tag1.tag.tagId)) {
              foundGroup.tags.push({
                id: tag1.tag.tagId,
                name: tag1.processed?.name || tag1.tag.name,
                type: tag1.processed?.typeLabel || TAG_TYPE_MAP[type] || type,
                paused: tag1.processed?.paused || false,
              });
            }
            if (!foundGroup.tags.some(t => t.id === tag2.tag.tagId)) {
              foundGroup.tags.push({
                id: tag2.tag.tagId,
                name: tag2.processed?.name || tag2.tag.name,
                type: tag2.processed?.typeLabel || TAG_TYPE_MAP[type] || type,
                paused: tag2.processed?.paused || false,
              });
            }
          } else {
            // Create new group - these are EXACT duplicates
            duplicateGroups.push({
              id: `dup-${duplicateGroups.length + 1}`,
              type: TAG_TYPE_MAP[type] || type,
              maxSimilarity: 100, // Always 100 for exact duplicates
              reason: getExactMatchDetails(tag1.identifiers, TAG_TYPE_MAP),
              tags: [
                {
                  id: tag1.tag.tagId,
                  name: tag1.processed?.name || tag1.tag.name,
                  type: tag1.processed?.typeLabel || TAG_TYPE_MAP[type] || type,
                  paused: tag1.processed?.paused || false,
                },
                {
                  id: tag2.tag.tagId,
                  name: tag2.processed?.name || tag2.tag.name,
                  type: tag2.processed?.typeLabel || TAG_TYPE_MAP[type] || type,
                  paused: tag2.processed?.paused || false,
                },
              ],
            });
          }
        }
      }
    }
  });
  
  // Sort groups by similarity (highest first)
  duplicateGroups.sort((a, b) => b.maxSimilarity - a.maxSimilarity);
  
  return duplicateGroups;
};

// Get duplicate stats
export const getDuplicateStats = (tags, triggers, processedTags, TAG_TYPE_MAP) => {
  const duplicates = detectDuplicateTags(tags, triggers, processedTags, TAG_TYPE_MAP);
  return {
    totalGroups: duplicates.length,
    totalDuplicateTags: duplicates.reduce((sum, g) => sum + g.tags.length, 0),
    // All duplicates are exact matches (100%) - strict comparison only
    exactMatches: duplicates.length,
  };
};

