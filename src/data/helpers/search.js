/**
 * Search Module
 * 
 * Pure functions for searching GTM data.
 * All functions receive required state as parameters for testability.
 */

import { findVariablesWithValue, tagUsesVariables } from './filterHelpers';

/**
 * Global search function - searches tags by query
 * 
 * @param {string} query - Search query string
 * @param {Array} processedTags - Array of processed tag objects
 * @param {Array} variableValueIndex - Index of variable values for searching
 * @returns {Object} - { tags: matchingTags[], matchInfo: {} }
 */
export const globalSearch = (query, processedTags, variableValueIndex) => {
  if (!query || query.trim() === '') return { tags: processedTags, matchInfo: {} };
  
  const searchTerms = query.toLowerCase().trim().split(/\s+/);
  const matchInfo = {};
  
  // Find variables that contain search terms
  const matchingVariables = new Set();
  searchTerms.forEach(term => {
    findVariablesWithValue(term, variableValueIndex).forEach(v => matchingVariables.add(v));
  });
  
  const matchingTags = processedTags.filter(tag => {
    const matches = [];
    
    // Check if tag uses variables that contain the search term
    if (matchingVariables.size > 0 && tagUsesVariables(tag, matchingVariables)) {
      const usedVars = [...matchingVariables].filter(varName => {
        const varRef = `{{${varName}}}`.toLowerCase();
        return tag.parameters.toLowerCase().includes(varRef) || 
               tag.searchableText.includes(varRef) ||
               tag.tagSpecificInfo.toLowerCase().includes(varRef);
      });
      if (usedVars.length > 0) {
        matches.push(`Variable Value (${usedVars.join(', ')})`);
      }
    }
    
    // Check each search term
    const allTermsMatch = searchTerms.every(term => {
      let termMatches = false;
      
      // Check tag name
      if (tag.name.toLowerCase().includes(term)) {
        matches.push('Tag Name');
        termMatches = true;
      }
      
      // Check tag type
      if (tag.typeLabel.toLowerCase().includes(term) || tag.type.toLowerCase().includes(term)) {
        matches.push('Tag Type');
        termMatches = true;
      }
      
      // Check trigger
      if (tag.triggerName.toLowerCase().includes(term) || tag.triggerType.toLowerCase().includes(term)) {
        matches.push('Trigger');
        termMatches = true;
      }
      
      // Check parameters
      if (tag.parameters.toLowerCase().includes(term)) {
        matches.push('Parameters');
        termMatches = true;
      }
      
      // Check script/tag info
      if (tag.tagSpecificInfo.toLowerCase().includes(term)) {
        matches.push('Script/Config');
        termMatches = true;
      }
      
      // Check full searchable text for anything else
      if (!termMatches && tag.searchableText.includes(term)) {
        matches.push('Content');
        termMatches = true;
      }
      
      // If matched via variable value, count as match
      if (!termMatches && matchingVariables.size > 0 && tagUsesVariables(tag, matchingVariables)) {
        termMatches = true;
      }
      
      return termMatches;
    });
    
    if (allTermsMatch && matches.length > 0) {
      matchInfo[tag.id] = [...new Set(matches)];
      return true;
    }
    
    return false;
  });
  
  return { tags: matchingTags, matchInfo };
};

