/**
 * Unused Variables Detection Module
 * 
 * Pure functions for detecting unused variables in GTM containers.
 * All functions receive required state as parameters for testability.
 */

import { VARIABLE_TYPE_MAP } from '../constants';

// Helper: Extract all variable references from a string ({{Variable Name}})
export const extractVariableReferences = (str) => {
  if (!str || typeof str !== 'string') return [];
  const matches = str.match(/\{\{([^}]+)\}\}/g) || [];
  return matches.map(m => m.replace(/\{\{|\}\}/g, '').trim());
};

// Helper: Recursively extract variable references from any value
export const extractVariablesFromValue = (value, found = new Set()) => {
  if (!value) return found;
  
  if (typeof value === 'string') {
    extractVariableReferences(value).forEach(v => found.add(v));
  } else if (Array.isArray(value)) {
    value.forEach(item => extractVariablesFromValue(item, found));
  } else if (typeof value === 'object') {
    Object.values(value).forEach(v => extractVariablesFromValue(v, found));
  }
  
  return found;
};

// Helper: Extract all variable references from a parameter array
export const extractVariablesFromParams = (params) => {
  const found = new Set();
  if (!params || !Array.isArray(params)) return found;
  
  params.forEach(param => {
    // Check value
    if (param.value) {
      extractVariablesFromValue(param.value, found);
    }
    // Check list (for lookup tables, field mappings, etc.)
    if (param.list && Array.isArray(param.list)) {
      param.list.forEach(item => {
        if (item.map && Array.isArray(item.map)) {
          item.map.forEach(mapItem => {
            if (mapItem.value) {
              extractVariablesFromValue(mapItem.value, found);
            }
          });
        }
        if (item.value) {
          extractVariablesFromValue(item.value, found);
        }
      });
    }
    // Check map directly on param
    if (param.map && Array.isArray(param.map)) {
      param.map.forEach(mapItem => {
        if (mapItem.value) {
          extractVariablesFromValue(mapItem.value, found);
        }
      });
    }
  });
  
  return found;
};

// Get mapping of variable names to their query keys (for URL type variables)
// Example: "UTM Source" → "utm_source"
export const getVariableQueryKeyMap = (variables) => {
  const map = new Map();
  
  variables.forEach(v => {
    if (v.name && Array.isArray(v.parameter)) {
      // Look for queryKey parameter in URL type variables
      v.parameter.forEach(param => {
        if (param.key === 'queryKey' && param.value) {
          map.set(v.name, param.value);
        }
      });
    }
  });
  
  return map;
};

// Helper: Extract the actual content/value of a variable
export const extractVariableContent = (variable) => {
  const content = {
    mainValue: null,
    lookupTable: null,
    regexTable: null,
    javascriptCode: null,
    dataLayerKey: null,
    cookieName: null,
    urlComponent: null,
    cssSelector: null,
    elementAttribute: null,
    defaultValue: null,
    formatValue: null,
    allParams: {},
  };
  
  const params = variable.parameter || [];
  
  params.forEach(param => {
    const key = param.key;
    const value = param.value;
    
    // Store all params for reference
    content.allParams[key] = value;
    
    // Extract specific values based on param key
    switch (key) {
      // Constant value
      case 'value':
        content.mainValue = value;
        break;
      
      // Data Layer Variable
      case 'name':
      case 'dataLayerVersion':
        if (key === 'name') content.dataLayerKey = value;
        break;
      
      // JavaScript Variable
      case 'jsVariableName':
        content.mainValue = value;
        break;
      
      // Custom JavaScript
      case 'javascript':
        content.javascriptCode = value;
        break;
      
      // Cookie
      case 'cookieName':
        content.cookieName = value;
        break;
      
      // URL Component
      case 'component':
        content.urlComponent = value;
        break;
      
      // DOM Element
      case 'selector':
      case 'selectorType':
        if (key === 'selector') content.cssSelector = value;
        break;
      case 'attribute':
        content.elementAttribute = value;
        break;
      
      // Default value
      case 'defaultValue':
        content.defaultValue = value;
        break;
      
      // Format
      case 'formatValue':
        content.formatValue = value === 'true';
        break;
    }
    
    // Lookup Table (smm)
    if (key === 'map' && param.list && Array.isArray(param.list)) {
      content.lookupTable = param.list.map(item => {
        const entry = { key: '', value: '' };
        if (item.map && Array.isArray(item.map)) {
          item.map.forEach(m => {
            if (m.key === 'key') entry.key = m.value;
            if (m.key === 'value') entry.value = m.value;
          });
        }
        return entry;
      }).filter(e => e.key || e.value);
    }
    
    // RegEx Table (remm)
    if (key === 'map' && param.list && Array.isArray(param.list) && variable.type === 'remm') {
      content.regexTable = param.list.map(item => {
        const entry = { pattern: '', output: '' };
        if (item.map && Array.isArray(item.map)) {
          item.map.forEach(m => {
            if (m.key === 'key' || m.key === 'pattern') entry.pattern = m.value;
            if (m.key === 'value' || m.key === 'output') entry.output = m.value;
          });
        }
        return entry;
      }).filter(e => e.pattern || e.output);
    }
  });
  
  return content;
};

// Detect unused variables in the container
// Receives required state as parameters for purity
export const detectUnusedVariables = (variables, tags, triggers) => {
  if (!variables || variables.length === 0) return { unused: [], used: [], stats: {} };
  
  // Get all defined variable names with their content
  const definedVariables = new Map();
  variables.forEach(v => {
    definedVariables.set(v.name, {
      name: v.name,
      type: v.type,
      variableId: v.variableId,
      usedIn: [],
      content: extractVariableContent(v), // Extract actual content
      rawVariable: v, // Keep raw for reference
    });
  });
  
  const allUsedVariables = new Set();
  
  // Check usage in TAGS
  tags.forEach(tag => {
    const tagVars = extractVariablesFromParams(tag.parameter);
    tagVars.forEach(varName => {
      allUsedVariables.add(varName);
      if (definedVariables.has(varName)) {
        definedVariables.get(varName).usedIn.push({
          type: 'tag',
          name: tag.name,
          id: tag.tagId,
        });
      }
    });
  });
  
  // Check usage in TRIGGERS
  triggers.forEach(trigger => {
    const checkFilterArray = (filterArray, filterType) => {
      if (!filterArray || !Array.isArray(filterArray)) return;
      filterArray.forEach(condition => {
        if (condition.parameter) {
          condition.parameter.forEach(param => {
            if (param.value) {
              extractVariableReferences(param.value).forEach(varName => {
                allUsedVariables.add(varName);
                if (definedVariables.has(varName)) {
                  definedVariables.get(varName).usedIn.push({
                    type: 'trigger',
                    name: trigger.name,
                    id: trigger.triggerId,
                    context: filterType,
                  });
                }
              });
            }
          });
        }
      });
    };
    
    checkFilterArray(trigger.filter, 'filter');
    checkFilterArray(trigger.customEventFilter, 'customEventFilter');
    checkFilterArray(trigger.autoEventFilter, 'autoEventFilter');
    
    // Check trigger parameters too
    const triggerVars = extractVariablesFromParams(trigger.parameter);
    triggerVars.forEach(varName => {
      allUsedVariables.add(varName);
      if (definedVariables.has(varName)) {
        definedVariables.get(varName).usedIn.push({
          type: 'trigger',
          name: trigger.name,
          id: trigger.triggerId,
        });
      }
    });
  });
  
  // Check usage in OTHER VARIABLES (variables referencing other variables)
  variables.forEach(variable => {
    const varVars = extractVariablesFromParams(variable.parameter);
    varVars.forEach(varName => {
      allUsedVariables.add(varName);
      if (definedVariables.has(varName)) {
        definedVariables.get(varName).usedIn.push({
          type: 'variable',
          name: variable.name,
          id: variable.variableId,
        });
      }
    });
  });
  
  // Separate unused and used variables
  const unused = [];
  const used = [];
  
  definedVariables.forEach((info) => {
    const varInfo = {
      name: info.name,
      type: info.type,
      typeLabel: VARIABLE_TYPE_MAP[info.type] || info.type,
      variableId: info.variableId,
      usedIn: info.usedIn,
      usageCount: info.usedIn.length,
      content: info.content, // Include actual content
    };
    
    if (info.usedIn.length === 0) {
      unused.push(varInfo);
    } else {
      used.push(varInfo);
    }
  });
  
  // Sort unused by name
  unused.sort((a, b) => a.name.localeCompare(b.name));
  used.sort((a, b) => b.usageCount - a.usageCount); // Most used first
  
  return {
    unused,
    used,
    stats: {
      total: variables.length,
      unusedCount: unused.length,
      usedCount: used.length,
      unusedPercentage: variables.length > 0 
        ? Math.round((unused.length / variables.length) * 100) 
        : 0,
    },
  };
};

// Get unused variable stats (quick summary)
export const getUnusedVariableStats = (variables, tags, triggers) => {
  const result = detectUnusedVariables(variables, tags, triggers);
  return result.stats;
};

// Get all variables with comprehensive details (for Variables page)
export const getAllVariablesWithDetails = (variables, tags, triggers) => {
  const result = detectUnusedVariables(variables, tags, triggers);
  // Combine used and unused, mark each with isUnused flag
  const allVars = [
    ...result.used.map(v => ({ ...v, isUnused: false })),
    ...result.unused.map(v => ({ ...v, isUnused: true })),
  ];
  // Sort by name
  return allVars.sort((a, b) => a.name.localeCompare(b.name));
};

// Get unique variable type labels (for Variables page filter)
export const getUniqueVariableTypeLabels = (variables, tags, triggers) => {
  const result = detectUnusedVariables(variables, tags, triggers);
  const allVars = [...result.used, ...result.unused];
  const types = new Set(allVars.map(v => v.typeLabel).filter(Boolean));
  return Array.from(types).sort();
};

