/**
 * useFilters Hook
 * Manages all filter states for tags, triggers, and variables
 */

import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { globalSearch, getUniqueVariableNames, getDynamicConditionFilters, getUniqueTriggerTypes } from '../data/gtmData';
import { TRIGGER_TYPE_MAP } from '../data/constants';
import { sanitizeQueryParam } from '../utils/security';

const useFilters = (processedTags, dataLoaded) => {
  const [searchParams] = useSearchParams();
  
  // Common filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [conditionTypeFilter, setConditionTypeFilter] = useState([]);
  
  // Trigger-specific filters (for triggers page)
  const [triggerTypeFilter, setTriggerTypeFilter] = useState([]);
  const [triggerUsageFilter, setTriggerUsageFilter] = useState('');
  
  // Tag trigger type filter (for tags page)
  const [tagTriggerTypeFilter, setTagTriggerTypeFilter] = useState([]);
  
  // Firing option filter (for tags page)
  const [firingOptionFilter, setFiringOptionFilter] = useState([]);
  
  // Variable-specific filters
  const [variableTypeFilter, setVariableTypeFilter] = useState([]);
  const [variableUsageFilter, setVariableUsageFilter] = useState('');
  const [variableNameFilter, setVariableNameFilter] = useState([]);
  
  // Dynamic condition filters - state for each variable/category
  const [dynamicConditionFilters, setDynamicConditionFilters] = useState({}); // { variableName: [selectedValues] }
  
  // Sync filters with URL query params (with strict sanitization)
  useEffect(() => {
    const rawStatus = searchParams.get('status');
    const sanitizedStatus = sanitizeQueryParam('status', rawStatus);
    
    if (sanitizedStatus) {
      setStatusFilter(sanitizedStatus);
    }
  }, [searchParams]);


  // Global search with match info
  const searchResults = useMemo(() => {
    return globalSearch(searchQuery);
  }, [searchQuery, processedTags]);

  // Get unique variable names for filter
  const variableNames = useMemo(() => {
    if (!dataLoaded) return [];
    return getUniqueVariableNames();
  }, [dataLoaded, processedTags]);

  // Get dynamic condition filters (grouped by variable)
  const dynamicFilters = useMemo(() => {
    if (!dataLoaded) return [];
    return getDynamicConditionFilters();
  }, [dataLoaded, processedTags]);

  // Get unique trigger types for tags filter (with human-readable labels)
  // Split comma-separated trigger types and get unique individual types
  // Normalize to uppercase to avoid duplicates (e.g., "pageview" vs "PAGEVIEW")
  const tagTriggerTypes = useMemo(() => {
    if (!dataLoaded) return [];
    const allTypes = getUniqueTriggerTypes();
    const uniqueTypes = new Set();
    
    // Split comma-separated trigger types and collect unique individual types
    allTypes.forEach(typeString => {
      if (typeString && typeof typeString === 'string') {
        // Split by comma and trim each type, normalize to uppercase
        const types = typeString.split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
        types.forEach(type => uniqueTypes.add(type));
      } else if (typeString) {
        // Normalize single value to uppercase
        uniqueTypes.add(String(typeString).toUpperCase());
      }
    });
    
    return Array.from(uniqueTypes)
      .map(type => ({
        value: type,
        label: TRIGGER_TYPE_MAP[type] || type,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [dataLoaded, processedTags]);

  // Get unique firing options for tags filter (with human-readable labels)
  // Note: Empty/missing tagFiringOption in GTM JSON = "Once per event" (GTM's actual default behavior)
  // We default to 'ONCE_PER_EVENT' in processTags(), so all tags will have a firingOption value
  // GTM behavior: Empty dropdown = "Once per event" (recommended), "Unlimited" must be explicitly selected
  const firingOptions = useMemo(() => {
    if (!dataLoaded || !processedTags || !Array.isArray(processedTags)) return [];
    const options = new Set();
    processedTags.forEach(tag => {
      if (!tag) return;
      // tag.firingOption will always exist (defaults to 'ONCE_PER_EVENT' if not set in GTM)
      if (tag.firingOption && typeof tag.firingOption === 'string') {
        options.add(tag.firingOption);
      }
    });
    
    // Map to human-readable labels
    // Order: Once per Event (default) first, then others
    const FIRING_OPTION_MAP = {
      'ONCE_PER_EVENT': 'Once per Event',
      'ONCE_PER_PAGE': 'Once per Page',
      'ONCE_PER_LOAD': 'Once per Load',
      'UNLIMITED': 'Unlimited',
    };
    
    // Sort with "Once per Event" first (since it's the default), then alphabetically
    const sortedOptions = Array.from(options)
      .map(option => ({
        value: option,
        label: FIRING_OPTION_MAP[option] || option,
      }))
      .sort((a, b) => {
        // Put "Once per Event" first
        if (a.value === 'ONCE_PER_EVENT') return -1;
        if (b.value === 'ONCE_PER_EVENT') return 1;
        // Then sort alphabetically
        return a.label.localeCompare(b.label);
      });
    
    return sortedOptions;
  }, [dataLoaded, processedTags]);

  // Filter tags
  const filteredTags = useMemo(() => {
    if (!processedTags || !Array.isArray(processedTags)) return [];
    
    const tagsToFilter = searchQuery && searchResults && searchResults.tags ? searchResults.tags : processedTags;
    if (!tagsToFilter || !Array.isArray(tagsToFilter)) return [];
    
    return tagsToFilter.filter(tag => {
      if (!tag || typeof tag !== 'object') return false;
      
      const matchesType = typeFilter.length === 0 || 
        (tag.typeLabel && typeFilter.includes(tag.typeLabel));
      
      const matchesStatus = !statusFilter || 
        (statusFilter === 'paused' && tag.paused === true) ||
        (statusFilter === 'active' && tag.paused !== true);
      
      const matchesConditionType = conditionTypeFilter.length === 0 ||
        (tag.conditions && Array.isArray(tag.conditions) && tag.conditions.some(c => c && c.typeLabel && conditionTypeFilter.includes(c.typeLabel)));
      
      // Filter by trigger type
      // Check if tag's triggerType (which may be comma-separated) contains any selected type
      // Normalize to uppercase for case-insensitive matching
      const matchesTriggerType = tagTriggerTypeFilter.length === 0 || (() => {
        if (!tag.triggerType || typeof tag.triggerType !== 'string') return false;
        // Split comma-separated trigger types, normalize to uppercase, and check if any selected type matches
        const tagTypes = tag.triggerType.split(',').map(t => t && typeof t === 'string' ? t.trim().toUpperCase() : '').filter(Boolean);
        return tagTriggerTypeFilter.some(selectedType => selectedType && tagTypes.includes(String(selectedType).toUpperCase()));
      })();
      
      // Filter by firing option
      const matchesFiringOption = firingOptionFilter.length === 0 ||
        (tag.firingOption && typeof tag.firingOption === 'string' && firingOptionFilter.includes(tag.firingOption));
      
      // Filter by variable names used in tag
      // variableNameFilter contains variable names (strings)
      const matchesVariableName = variableNameFilter.length === 0 || (() => {
        if (!Array.isArray(variableNameFilter)) return true;
        // Check if tag uses any of the selected variables
        for (const varName of variableNameFilter) {
          if (!varName || typeof varName !== 'string') continue;
          const varRef = `{{${varName}}}`.toLowerCase();
          // Check in conditions
          if (tag.conditions && Array.isArray(tag.conditions) && tag.conditions.some(c => c && c.variable && typeof c.variable === 'string' && c.variable.toLowerCase().includes(varRef))) {
            return true;
          }
          // Check in allParams (tag parameters)
          if (tag.allParams && typeof tag.allParams === 'string' && tag.allParams.toLowerCase().includes(varRef)) {
            return true;
          }
          // Check in tagSpecificInfo
          if (tag.tagSpecificInfo && typeof tag.tagSpecificInfo === 'string' && tag.tagSpecificInfo.toLowerCase().includes(varRef)) {
            return true;
          }
        }
        return false;
      })();
      
      // Filter by dynamic condition filters (e.g., Make filter, UTM Source filter, etc.)
      const matchesDynamicFilters = Object.keys(dynamicConditionFilters).length === 0 || (() => {
        if (!tag.conditions || !Array.isArray(tag.conditions)) return true;
        if (!dynamicFilters || !Array.isArray(dynamicFilters)) return true;
        
        for (const [varName, selectedValues] of Object.entries(dynamicConditionFilters)) {
          if (!varName || !selectedValues || !Array.isArray(selectedValues) || selectedValues.length === 0) continue;
          
          // Special handling for merged Page Path & URL filter
          if (varName === 'Page Path & URL') {
            const matchingConditions = tag.conditions.filter(c => {
              if (!c || typeof c !== 'object') return false;
              const category = c.category || 'Other';
              const value = c.value || '';
              return (category === 'Page Path' || category === 'Page URL') && 
                     value && selectedValues.includes(value);
            });
            if (matchingConditions.length === 0) {
              return false;
            }
            continue;
          }
          
          // Check if this is a grouped filter (e.g., "All Query Params")
          const groupedFilter = dynamicFilters.find(f => f && f.variable === varName && f.isGrouped);
          if (groupedFilter) {
            // For grouped filters, check if tag has conditions matching any variable in the group
            const matchingConditions = tag.conditions.filter(c => {
              if (!c || typeof c !== 'object' || !c.variable) return false;
              const cVarName = String(c.variable).replace(/\{\{|\}\}/g, '').trim();
              const cCategory = c.category || 'Other';
              const cValue = c.value || '';
              return groupedFilter.contributingVariables && Array.isArray(groupedFilter.contributingVariables) &&
                     groupedFilter.contributingVariables.includes(cVarName) &&
                     cCategory === groupedFilter.category &&
                     cValue && selectedValues.includes(cValue);
            });
            if (matchingConditions.length === 0) {
              return false;
            }
            continue;
          }
          
          // Check if tag has conditions matching this variable and any selected value
          const matchingConditions = tag.conditions.filter(c => {
            if (!c || typeof c !== 'object' || !c.variable) return false;
            const cVarName = String(c.variable).replace(/\{\{|\}\}/g, '').trim();
            const cValue = c.value || '';
            return cVarName === varName && cValue && selectedValues.includes(cValue);
          });
          
          if (matchingConditions.length === 0) {
            return false; // This filter requires a match, but tag doesn't have it
          }
        }
        return true; // All dynamic filters match
      })();
      
      return matchesType && matchesStatus && matchesConditionType && matchesTriggerType && matchesFiringOption && matchesVariableName && matchesDynamicFilters;
    });
  }, [searchQuery, searchResults, processedTags, typeFilter, statusFilter, conditionTypeFilter, tagTriggerTypeFilter, firingOptionFilter, variableNameFilter, dynamicConditionFilters]);

  // Check if any filter is active
  const hasActiveDynamicFilters = Object.values(dynamicConditionFilters).some(values => values && values.length > 0);
  const hasActiveFilters = searchQuery || typeFilter.length > 0 || statusFilter || conditionTypeFilter.length > 0 || tagTriggerTypeFilter.length > 0 || firingOptionFilter.length > 0 || variableNameFilter.length > 0 || hasActiveDynamicFilters;
  
  // Check if any trigger filter is active
  const hasActiveTriggerFilters = searchQuery || triggerTypeFilter.length > 0 || triggerUsageFilter;
  
  // Check if any variable filter is active
  const hasActiveVariableFilters = searchQuery || variableTypeFilter.length > 0 || variableUsageFilter;

  // Reset all filters
  const resetAllFilters = () => {
    setSearchQuery('');
    setTypeFilter([]);
    setStatusFilter('');
    setConditionTypeFilter([]);
    setTagTriggerTypeFilter([]);
    setFiringOptionFilter([]);
    setTriggerTypeFilter([]);
    setTriggerUsageFilter('');
    setVariableTypeFilter([]);
    setVariableUsageFilter('');
    setVariableNameFilter([]);
    setDynamicConditionFilters({});
  };
  
  // Update dynamic condition filter for a specific variable
  const updateDynamicConditionFilter = (variableName, selectedValues) => {
    setDynamicConditionFilters(prev => {
      if (!selectedValues || selectedValues.length === 0) {
        const newFilters = { ...prev };
        delete newFilters[variableName];
        return newFilters;
      }
      return { ...prev, [variableName]: selectedValues };
    });
  };

  return {
    // Search
    searchQuery,
    setSearchQuery,
    searchResults,
    
    // Tag filters
    typeFilter,
    setTypeFilter,
    statusFilter,
    setStatusFilter,
    conditionTypeFilter,
    setConditionTypeFilter,
    tagTriggerTypeFilter,
    setTagTriggerTypeFilter,
    tagTriggerTypes,
    firingOptionFilter,
    setFiringOptionFilter,
    firingOptions,
    
    // Trigger filters (for triggers page)
    triggerTypeFilter,
    setTriggerTypeFilter,
    triggerUsageFilter,
    setTriggerUsageFilter,
    
    // Variable filters
    variableTypeFilter,
    setVariableTypeFilter,
    variableUsageFilter,
    setVariableUsageFilter,
    variableNameFilter,
    setVariableNameFilter,
    variableNames,
    
    // Dynamic condition filters
    dynamicFilters,
    dynamicConditionFilters,
    updateDynamicConditionFilter,
    
    // Filtered results
    filteredTags,
    
    // Active filter checks
    hasActiveFilters,
    hasActiveTriggerFilters,
    hasActiveVariableFilters,
    
    // Reset
    resetAllFilters,
  };
};

export default useFilters;

