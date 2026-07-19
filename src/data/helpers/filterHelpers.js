/**
 * Filter Helpers Module
 * 
 * Pure functions for extracting unique filter values from GTM data.
 * All functions receive required state as parameters for testability.
 */

// Get all unique tag types for filtering - grouped by Native vs Community
// Returns grouped structure with section headers for better UX
export const getUniqueTagTypes = (processedTags) => {
  const nativeTypes = [];
  const communityTypes = [];
  
  // Separate tags into native and community
  processedTags.forEach(tag => {
    if (tag.isCommunityTemplate) {
      if (!communityTypes.includes(tag.typeLabel)) {
        communityTypes.push(tag.typeLabel);
      }
    } else {
      if (!nativeTypes.includes(tag.typeLabel)) {
        nativeTypes.push(tag.typeLabel);
      }
    }
  });
  
  // Sort each group
  nativeTypes.sort();
  communityTypes.sort();
  
  // Return grouped structure with section headers
  const result = [];
  
  if (nativeTypes.length > 0) {
    result.push({ type: 'header', label: '📦 Native Tags (Google Built-in)' });
    nativeTypes.forEach(t => result.push({ type: 'option', label: t }));
  }
  
  if (communityTypes.length > 0) {
    result.push({ type: 'header', label: '🔌 Community Templates (Third-party)' });
    communityTypes.forEach(t => result.push({ type: 'option', label: t }));
  }
  
  return result;
};

// Get flat list of tag types (for backward compatibility)
export const getUniqueTagTypesFlat = (processedTags) => {
  const types = new Set(processedTags.map(tag => tag.typeLabel));
  return Array.from(types).sort();
};

// Get all unique trigger types
export const getUniqueTriggerTypes = (processedTags) => {
  if (!processedTags || !Array.isArray(processedTags)) return [];
  const types = new Set(processedTags.map(tag => tag && tag.triggerType).filter(Boolean));
  return Array.from(types).sort();
};

// Get all unique trigger type labels (for triggers page filter)
// Receives allTriggersWithDetails as parameter
export const getUniqueTriggerTypeLabels = (allTriggersWithDetails) => {
  const types = new Set(allTriggersWithDetails.map(t => t.typeLabel).filter(Boolean));
  return Array.from(types).sort();
};

// Get all unique page paths from conditions
export const getUniquePagePaths = (processedTags) => {
  const paths = new Set();
  processedTags.forEach(tag => {
    tag.pagePaths.forEach(p => {
      if (p.value) paths.add(p.value);
    });
  });
  return Array.from(paths).sort();
};

// Get all unique page URLs from conditions
export const getUniquePageUrls = (processedTags) => {
  const urls = new Set();
  processedTags.forEach(tag => {
    tag.pageUrls.forEach(p => {
      if (p.value) urls.add(p.value);
    });
  });
  return Array.from(urls).sort();
};

// Get all unique query params from conditions
export const getUniqueQueryParams = (processedTags) => {
  const params = new Set();
  processedTags.forEach(tag => {
    tag.queryParams.forEach(p => {
      if (p.value) params.add(p.value);
    });
  });
  return Array.from(params).sort();
};

// Get all unique condition types (from data)
export const getUniqueConditionTypes = (processedTags) => {
  if (!processedTags || !Array.isArray(processedTags)) return [];
  const types = new Set();
  processedTags.forEach(tag => {
    if (!tag || !tag.conditions || !Array.isArray(tag.conditions)) return;
    tag.conditions.forEach(c => {
      if (c && c.typeLabel) types.add(c.typeLabel);
    });
  });
  return Array.from(types).sort();
};

// Get ALL possible condition types (for filter dropdown)
// Pure function - no dependencies
export const getAllConditionTypes = () => {
  return [
    // Positive matches
    'Equals',
    'Contains',
    'Starts With',
    'Ends With',
    'Matches CSS Selector',
    'Matches RegEx',
    'Matches RegEx (ignore case)',
    // Negative matches
    'Does Not Equal',
    'Does Not Contain',
    'Does Not Start With',
    'Does Not End With',
    'Does Not Match CSS Selector',
    'Does Not Match RegEx',
    'Does Not Match RegEx (ignore case)',
    // Comparison
    'Less Than',
    'Less Than or Equal To',
    'Greater Than',
    'Greater Than or Equal To',
  ];
};

// Get all unique condition categories
export const getUniqueConditionCategories = (processedTags) => {
  const categories = new Set();
  processedTags.forEach(tag => {
    tag.conditions.forEach(c => {
      if (c.category) categories.add(c.category);
    });
  });
  return Array.from(categories).sort();
};

// Get dynamic condition filters - groups conditions by variable/category with their values
// Returns array of filter objects: [{ category, variable, values: [{value, type, count, source, variableNames}] }]
// Special handling: 
// 1. Merges Page Path and Page URL into one combined filter
// 2. Dynamically groups variables by category when multiple variables exist - works for ANY category
//    This is fully dynamic and handles any GTM container structure automatically (no hardcoded categories)
export const getDynamicConditionFilters = (processedTags) => {
  if (!processedTags || !Array.isArray(processedTags) || processedTags.length === 0) {
    return [];
  }
  
  const filterMap = new Map(); // Map<variableName, { category, variable, values: Map }>
  const pagePathUrlMap = new Map(); // Special map for merged Page Path & URL filter
  const categoryGroupMap = new Map(); // Map<category, { values: Map, variables: Set }> for grouping by category
  
  processedTags.forEach(tag => {
    if (!tag || !tag.conditions || !Array.isArray(tag.conditions)) return;
    tag.conditions.forEach(condition => {
      if (!condition || typeof condition !== 'object') return;
      if (!condition.variable || !condition.value) return;
      
      // Clean variable name (remove {{ }})
      const varName = condition.variable.replace(/\{\{|\}\}/g, '').trim();
      const category = condition.category || 'Other';
      
      // Special handling: Merge Page Path and Page URL into one filter
      if (category === 'Page Path' || category === 'Page URL') {
        const value = condition.value;
        const source = category === 'Page Path' ? 'path' : 'url';
        
        if (!pagePathUrlMap.has(value)) {
          pagePathUrlMap.set(value, {
            value: value,
            type: condition.typeLabel || condition.type,
            count: 1,
            sources: new Set([source]),
            variableNames: new Set([varName]),
          });
        } else {
          const existing = pagePathUrlMap.get(value);
          existing.count = (existing.count || 1) + 1;
          existing.sources.add(source);
          existing.variableNames.add(varName);
          if (condition.typeLabel && !existing.type) {
            existing.type = condition.typeLabel;
          }
        }
        return;
      }
      
      // Track individual variable filters (for non-grouped categories)
      const key = varName;
      
      if (!filterMap.has(key)) {
        filterMap.set(key, {
          category: category,
          variable: varName,
          variableDisplay: varName,
          values: new Map(),
        });
      }
      
      const filter = filterMap.get(key);
      const value = condition.value;
      
      // Track values with their condition types and count occurrences
      if (filter.values.has(value)) {
        const existing = filter.values.get(value);
        existing.count = (existing.count || 1) + 1;
        if (condition.typeLabel && !existing.type) {
          existing.type = condition.typeLabel;
        }
      } else {
        filter.values.set(value, {
          value: value,
          type: condition.typeLabel || condition.type,
          count: 1,
          source: category.toLowerCase(),
          variableName: varName,
        });
      }
      
      // Dynamically track ALL categories for grouping - any category with multiple variables will be grouped
      // This makes it work for any GTM container structure, not just hardcoded categories
      if (!categoryGroupMap.has(category)) {
        categoryGroupMap.set(category, {
          values: new Map(),
          variables: new Set(),
        });
      }
      
      const group = categoryGroupMap.get(category);
      group.variables.add(varName);
      
      if (!group.values.has(value)) {
        group.values.set(value, {
          value: value,
          type: condition.typeLabel || condition.type,
          count: 1,
          variableNames: new Set([varName]),
        });
      } else {
        const existing = group.values.get(value);
        existing.count = (existing.count || 1) + 1;
        existing.variableNames.add(varName);
        if (condition.typeLabel && !existing.type) {
          existing.type = condition.typeLabel;
        }
      }
    });
  });
  
  // Create grouped category filters dynamically - any category with multiple variables gets grouped
  // Special cases: Query Params, Data Layer Variables, and Custom JavaScript Variables are ALWAYS grouped (even with single variable) for better UX
  // This works for ANY category in ANY GTM container structure (fully dynamic)
  const groupedFilters = [];
  categoryGroupMap.forEach((group, category) => {
    // Always group Query Params, Data Layer Variables, and Custom JavaScript Variables (even with single variable), or group any category with multiple variables
    const shouldGroup = category === 'Query Params' || 
                        category === 'Data Layer Variables' || 
                        category === 'Custom JavaScript Variables' || 
                        group.variables.size > 1;
    
    if (shouldGroup && group.variables.size > 0) {
      const values = Array.from(group.values.values())
        .map(v => ({
          value: v.value,
          type: v.type,
          count: v.count,
          variableNames: Array.from(v.variableNames),
          source: category.toLowerCase(),
        }))
        .sort((a, b) => a.value.localeCompare(b.value));
      
      groupedFilters.push({
        category: category,
        variable: `All ${category}`, // e.g., "All Query Params"
        variableDisplay: `All ${category}`,
        values: values,
        totalValues: values.length,
        isGrouped: true,
        contributingVariables: Array.from(group.variables),
      });
    }
  });
  
  // Get individual variable filters (exclude variables that are part of grouped filters)
  const groupedVariableNames = new Set();
  groupedFilters.forEach(gf => {
    gf.contributingVariables.forEach(v => groupedVariableNames.add(v));
  });
  
  const individualFilters = Array.from(filterMap.values())
    .filter(filter => !groupedVariableNames.has(filter.variable))
    .map(filter => ({
      category: filter.category,
      variable: filter.variable,
      variableDisplay: filter.variableDisplay,
      values: Array.from(filter.values.values())
        .map(v => ({
          ...v,
          variableNames: [v.variableName],
        }))
        .sort((a, b) => a.value.localeCompare(b.value)),
      totalValues: filter.values.size,
    }))
    .filter(filter => filter.values.length > 0);
  
  // Create merged Page Path & URL filter if we have any page conditions
  const pageFilters = [];
  if (pagePathUrlMap.size > 0) {
    const pageValues = Array.from(pagePathUrlMap.values())
      .map(v => ({
        value: v.value,
        type: v.type,
        count: v.count,
        source: v.sources.size > 1 ? 'both' : (v.sources.has('path') ? 'path' : 'url'),
        variableNames: Array.from(v.variableNames || []),
      }))
      .sort((a, b) => a.value.localeCompare(b.value));
    
    pageFilters.push({
      category: 'Page Path & URL',
      variable: 'Page Path & URL',
      variableDisplay: 'Page Path & URL',
      values: pageValues,
      totalValues: pageValues.length,
      isMerged: true, // Flag to indicate this is a merged filter
    });
  }
  
  // Combine all filters
  const allFilters = [...pageFilters, ...groupedFilters, ...individualFilters];
  
  // Dynamically determine category order based on what exists in the container
  // Known categories get priority, unknown categories are sorted alphabetically at the end
  const allCategories = new Set(allFilters.map(f => f.category));
  const knownCategoryPriority = {
    'Page Path & URL': 1,
    'Query Params': 2,
    'Hostname': 3,
    'Click': 4,
    'Event': 5,
    'Referrer': 6,
    'Element': 7,
    'Other': 8,
  };
  
  // Build dynamic category order: known categories first, then unknown categories alphabetically
  const unknownCategories = Array.from(allCategories)
    .filter(cat => !knownCategoryPriority.hasOwnProperty(cat))
    .sort();
  
  const maxKnownPriority = Math.max(...Object.values(knownCategoryPriority));
  const dynamicCategoryOrder = { ...knownCategoryPriority };
  unknownCategories.forEach((cat, idx) => {
    dynamicCategoryOrder[cat] = maxKnownPriority + 1 + idx;
  });
  
  return allFilters.sort((a, b) => {
    // Sort by dynamic category priority, then variable name
    const aOrder = dynamicCategoryOrder[a.category] || (maxKnownPriority + 1000);
    const bOrder = dynamicCategoryOrder[b.category] || (maxKnownPriority + 1000);
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.variable.localeCompare(b.variable);
  });
};

// Build variable value index - maps values to variable names
export const buildVariableValueIndex = (variables) => {
  const index = []; // Array of { value, variableName }
  
  variables.forEach(variable => {
    const varName = variable.name;
    
    if (!Array.isArray(variable.parameter)) return;
    
    variable.parameter.forEach(param => {
      // Direct value parameters
      if (param.key === 'value' && param.value) {
        index.push({ value: param.value.toLowerCase(), variableName: varName });
      }
      
      // Default value
      if (param.key === 'defaultValue' && param.value) {
        index.push({ value: param.value.toLowerCase(), variableName: varName });
      }
      
      // Lookup table / RegEx table values
      if (param.key === 'map' && Array.isArray(param.list)) {
        param.list.forEach(item => {
          if (item.map && Array.isArray(item.map)) {
            item.map.forEach(mapItem => {
              if (mapItem.value) {
                index.push({ value: mapItem.value.toLowerCase(), variableName: varName });
              }
            });
          }
        });
      }
      
      // Constant value
      if (param.key === 'constantValue' && param.value) {
        index.push({ value: param.value.toLowerCase(), variableName: varName });
      }
    });
  });
  
  return index;
};

// Find variables containing a search term
export const findVariablesWithValue = (searchTerm, variableValueIndex) => {
  const matchingVars = new Set();
  const term = searchTerm.toLowerCase();
  
  variableValueIndex.forEach(({ value, variableName }) => {
    if (value.includes(term)) {
      matchingVars.add(variableName);
    }
  });
  
  return matchingVars;
};

// Check if a tag uses any of the given variables
export const tagUsesVariables = (tag, variableNames) => {
  if (variableNames.size === 0) return false;
  
  for (const varName of variableNames) {
    const varRef = `{{${varName}}}`.toLowerCase();
    // Check in parameters
    if (tag.parameters.toLowerCase().includes(varRef)) return true;
    // Check in searchable text
    if (tag.searchableText.includes(varRef.toLowerCase())) return true;
    // Check in tag specific info
    if (tag.tagSpecificInfo.toLowerCase().includes(varRef)) return true;
  }
  
  return false;
};

// Get all unique variable names used in tags (from conditions and parameters)
// Returns both built-in and custom variables with their values
// Structure: [{ name: "Variable Name", value: "variable value or null", badgeText: "...", tooltip: "..." }]
export const getUniqueVariableNames = (processedTags, allVariables, builtInVariables) => {
  const variableMap = new Map(); // Map<variableName, { name, value, type, isBuiltIn }>
  
  // Add all custom variables with their values
  if (allVariables && Array.isArray(allVariables)) {
    allVariables.forEach(v => {
      if (v.name) {
        const content = v.content || {};
        const value = content.mainValue || content.dataLayerKey || content.cookieName || 
                      content.cssSelector || content.urlComponent || null;
        const displayValue = value ? (value.length > 30 ? value.substring(0, 30) + '...' : value) : null;
        
        variableMap.set(v.name, {
          name: v.name,
          value: displayValue,
          type: v.typeLabel || 'Custom',
          isBuiltIn: false
        });
      }
    });
  }
  
  // Add all built-in variables (no values - they're dynamic)
  if (builtInVariables && Array.isArray(builtInVariables)) {
    builtInVariables.forEach(v => {
      if (v.name && !variableMap.has(v.name)) {
        variableMap.set(v.name, {
          name: v.name,
          value: null,
          type: 'Built-in',
          isBuiltIn: true
        });
      }
    });
  }
  
  // Extract variable names from tag conditions (add if not already in map)
  processedTags.forEach(tag => {
    tag.conditions.forEach(condition => {
      if (condition.variable) {
        // Remove {{ }} wrapper if present
        const varName = condition.variable.replace(/\{\{|\}\}/g, '').trim();
        if (varName && !variableMap.has(varName)) {
          variableMap.set(varName, {
            name: varName,
            value: null,
            type: 'Used in Conditions',
            isBuiltIn: false
          });
        }
      }
    });
  });
  
  // Extract variable names from tag parameters (add if not already in map)
  processedTags.forEach(tag => {
    if (tag.allParams) {
      const matches = tag.allParams.match(/\{\{([^}]+)\}\}/g) || [];
      matches.forEach(match => {
        const varName = match.replace(/\{\{|\}\}/g, '').trim();
        if (varName && !variableMap.has(varName)) {
          variableMap.set(varName, {
            name: varName,
            value: null,
            type: 'Used in Parameters',
            isBuiltIn: false
          });
        }
      });
    }
  });
  
  // Convert to array with badgeText and tooltip (similar to queryParamConditions structure)
  return Array.from(variableMap.values())
    .map(v => ({
      name: v.name,
      value: v.value,
      badgeText: v.value ? v.value : (v.isBuiltIn ? 'Built-in' : v.type),
      tooltip: v.value 
        ? `${v.name}\nValue: ${v.value}\nType: ${v.type}`
        : `${v.name}\nType: ${v.type}${v.isBuiltIn ? ' (Dynamic)' : ''}`,
      isBuiltIn: v.isBuiltIn
    }))
    .sort((a, b) => {
      // Built-in variables first, then custom, then alphabetically
      if (a.isBuiltIn && !b.isBuiltIn) return -1;
      if (!a.isBuiltIn && b.isBuiltIn) return 1;
      return a.name.localeCompare(b.name);
    });
};

