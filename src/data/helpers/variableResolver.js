/**
 * Variable Resolver Module
 * 
 * Pure functions for resolving GTM variable references.
 * All functions that need state receive it as parameters for testability.
 */

// Get lookup table map from a variable
// Pure function - no external state needed
export const getVariableLookupTable = (variable) => {
  if (!variable || !Array.isArray(variable.parameter)) return null;
  
  const lookupTable = [];
  let inputVar = null;
  
  variable.parameter.forEach(param => {
    // Get the input variable (e.g., {{Event}})
    if (param.key === 'input' && param.value) {
      inputVar = param.value;
    }
    
    // Lookup table / RegEx table values
    if (param.key === 'map' && Array.isArray(param.list)) {
      param.list.forEach(item => {
        if (item.map && Array.isArray(item.map)) {
          const mapEntry = {};
          item.map.forEach(mapItem => {
            if (mapItem.key === 'key') mapEntry.key = mapItem.value;
            if (mapItem.key === 'value') mapEntry.value = mapItem.value;
          });
          if (mapEntry.key && mapEntry.value) {
            lookupTable.push(mapEntry);
          }
        }
      });
    }
  });
  
  return { inputVar, lookupTable };
};

// Get all values from a variable (including lookup tables)
// Pure function - no external state needed
export const getVariableValues = (variable) => {
  if (!variable || !Array.isArray(variable.parameter)) return null;
  
  const values = [];
  
  variable.parameter.forEach(param => {
    // Direct value
    if (param.key === 'value' && param.value) {
      values.push(param.value);
    }
    
    // Constant value
    if (param.key === 'constantValue' && param.value) {
      values.push(param.value);
    }
    
    // Default value
    if (param.key === 'defaultValue' && param.value) {
      values.push(`Default: ${param.value}`);
    }
    
    // Lookup table / RegEx table values
    if (param.key === 'map' && Array.isArray(param.list)) {
      param.list.forEach(item => {
        if (item.map && Array.isArray(item.map)) {
          const mapEntry = {};
          item.map.forEach(mapItem => {
            if (mapItem.key === 'key') mapEntry.key = mapItem.value;
            if (mapItem.key === 'value') mapEntry.value = mapItem.value;
          });
          if (mapEntry.value) {
            if (mapEntry.key) {
              values.push(`[${mapEntry.key}] → ${mapEntry.value}`);
            } else {
              values.push(mapEntry.value);
            }
          }
        }
      });
    }
  });
  
  return values.length > 0 ? values : null;
};

// Get event name from trigger
// Receives triggers array as parameter
export const getTriggerEventName = (triggerId, triggers) => {
  const trigger = triggers.find(t => t.triggerId === triggerId);
  if (!trigger) return null;
  
  // Check customEventFilter for event name
  if (trigger.customEventFilter && Array.isArray(trigger.customEventFilter)) {
    for (const filter of trigger.customEventFilter) {
      if (filter.parameter && Array.isArray(filter.parameter)) {
        const arg0 = filter.parameter.find(p => p.key === 'arg0');
        const arg1 = filter.parameter.find(p => p.key === 'arg1');
        // If arg0 is {{_event}} or {{Event}}, arg1 is the event name
        if (arg0 && arg0.value && (arg0.value.includes('_event') || arg0.value.toLowerCase().includes('event'))) {
          if (arg1 && arg1.value) {
            return arg1.value;
          }
        }
      }
    }
  }
  
  return null;
};

// Recursively resolve nested variable references
// Receives variables array as parameter
export const resolveNestedVariables = (value, variables, maxDepth = 5, currentDepth = 0) => {
  if (!value || typeof value !== 'string' || currentDepth >= maxDepth) return value;
  
  // Check if value contains variable references
  const variableRegex = /\{\{(.+?)\}\}/g;
  if (!variableRegex.test(value)) return value;
  
  // Reset regex
  variableRegex.lastIndex = 0;
  
  let resolvedValue = value;
  let match;
  
  while ((match = variableRegex.exec(value)) !== null) {
    const variableName = match[1];
    const variable = variables.find(v => v.name === variableName);
    
    if (variable) {
      const varValues = getVariableValues(variable);
      if (varValues && varValues.length === 1 && !varValues[0].includes('→')) {
        // Single direct value - recursively resolve if it contains more variables
        const nestedResolved = resolveNestedVariables(varValues[0], variables, maxDepth, currentDepth + 1);
        resolvedValue = resolvedValue.replace(`{{${variableName}}}`, nestedResolved);
      }
    }
  }
  
  return resolvedValue;
};

// Resolve variable with context (trigger info for dynamic lookup)
// Receives variables and triggers arrays as parameters
export const resolveVariableWithContext = (value, triggerIds, variables, triggers) => {
  if (!value) return value;
  
  const variableRegex = /\{\{(.+?)\}\}/g;
  let resolvedValue = value;
  let match;
  
  // Get event names from triggers
  const eventNames = [];
  if (triggerIds && Array.isArray(triggerIds)) {
    triggerIds.forEach(triggerId => {
      const eventName = getTriggerEventName(triggerId, triggers);
      if (eventName) eventNames.push(eventName);
    });
  }
  
  // Reset regex
  variableRegex.lastIndex = 0;
  
  while ((match = variableRegex.exec(value)) !== null) {
    const variableName = match[1];
    const variable = variables.find(v => v.name === variableName);
    
    if (variable) {
      // Check if it's a lookup table variable (remm = RegEx Match, smm = Lookup Table)
      if (variable.type === 'remm' || variable.type === 'smm') {
        const { inputVar, lookupTable } = getVariableLookupTable(variable) || {};
        
        // If lookup table uses {{Event}} as input and we have event names from trigger
        if (inputVar && (inputVar.includes('Event') || inputVar.includes('_event')) && eventNames.length > 0 && lookupTable) {
          // Find matching value in lookup table
          for (const eventName of eventNames) {
            const matchedEntry = lookupTable.find(entry => 
              entry.key.toLowerCase() === eventName.toLowerCase()
            );
            if (matchedEntry) {
              // Recursively resolve nested variables in the matched value
              const nestedResolved = resolveNestedVariables(matchedEntry.value, variables);
              resolvedValue = resolvedValue.replace(`{{${variableName}}}`, nestedResolved);
              break;
            }
          }
        } else {
          // No context match, show all possible values with nested resolution
          const varValues = getVariableValues(variable);
          if (varValues && varValues.length > 0) {
            // Resolve nested variables in each value
            const resolvedVarValues = varValues.map(v => {
              if (v.includes('→')) {
                // It's a lookup entry like "[key] → {{Nested Var}}"
                const parts = v.split(' → ');
                if (parts.length === 2) {
                  const resolvedNested = resolveNestedVariables(parts[1], variables);
                  return `${parts[0]} → ${resolvedNested}`;
                }
              }
              return resolveNestedVariables(v, variables);
            });
            const valuesStr = resolvedVarValues.join(', ');
            resolvedValue = resolvedValue.replace(
              `{{${variableName}}}`, 
              `{{${variableName}}} [Values: ${valuesStr}]`
            );
          }
        }
      } else {
        // Simple variable - get direct value and resolve nested
        const varValues = getVariableValues(variable);
        if (varValues && varValues.length > 0 && varValues.length === 1) {
          const nestedResolved = resolveNestedVariables(varValues[0], variables);
          resolvedValue = resolvedValue.replace(`{{${variableName}}}`, nestedResolved);
        }
      }
    }
  }
  
  return resolvedValue;
};

// Simple variable resolution (no trigger context)
// Receives variables array as parameter
export const resolveVariable = (value, variables) => {
  if (!value) return value;
  
  const variableRegex = /\{\{(.+?)\}\}/g;
  let resolvedValue = value;
  let match;
  
  while ((match = variableRegex.exec(value)) !== null) {
    const variableName = match[1];
    const variable = variables.find(v => v.name === variableName);
    
    if (variable) {
      const varValues = getVariableValues(variable);
      if (varValues && varValues.length > 0) {
        // If single value, replace directly and resolve nested
        if (varValues.length === 1 && !varValues[0].includes('→')) {
          const nestedResolved = resolveNestedVariables(varValues[0], variables);
          resolvedValue = resolvedValue.replace(`{{${variableName}}}`, nestedResolved);
        } else {
          // For lookup tables, resolve nested in each value
          const resolvedVarValues = varValues.map(v => {
            if (v.includes('→')) {
              const parts = v.split(' → ');
              if (parts.length === 2) {
                const resolvedNested = resolveNestedVariables(parts[1], variables);
                return `${parts[0]} → ${resolvedNested}`;
              }
            }
            return resolveNestedVariables(v, variables);
          });
          const valuesStr = resolvedVarValues.join(', ');
          resolvedValue = resolvedValue.replace(
            `{{${variableName}}}`, 
            `{{${variableName}}} [Values: ${valuesStr}]`
          );
        }
      }
    }
  }
  
  return resolvedValue;
};

