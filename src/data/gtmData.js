// GTM Data Processing Module
// Dynamically processes GTM container export data
// NO STATIC FALLBACK - requires user to upload GTM JSON file

import {
  BASE_TAG_TYPE_MAP,
  CONDITION_TYPE_MAP,
  CONDITION_STYLE_MAP,
  TRIGGER_TYPE_MAP,
  VARIABLE_TYPE_MAP,
} from './constants';

import {
  detectDuplicateTags as detectDuplicatesCore,
  getDuplicateStats as getDuplicateStatsCore,
} from './cleanup/duplicates';

import {
  detectUnusedVariables as detectUnusedVariablesCore,
  getUnusedVariableStats as getUnusedVariableStatsCore,
  getAllVariablesWithDetails as getAllVariablesWithDetailsCore,
  getUniqueVariableTypeLabels as getUniqueVariableTypeLabelsCore,
  getVariableQueryKeyMap as getVariableQueryKeyMapCore,
  extractVariableReferences,
  extractVariablesFromParams,
} from './cleanup/unusedVariables';

import {
  detectOrphanTriggers as detectOrphanTriggersCore,
  getOrphanTriggerStats as getOrphanTriggerStatsCore,
} from './cleanup/orphanTriggers';

import {
  getUniqueTagTypes as getUniqueTagTypesCore,
  getUniqueTagTypesFlat as getUniqueTagTypesFlatCore,
  getUniqueTriggerTypes as getUniqueTriggerTypesCore,
  getUniqueTriggerTypeLabels as getUniqueTriggerTypeLabelsCore,
  getUniquePagePaths as getUniquePagePathsCore,
  getUniquePageUrls as getUniquePageUrlsCore,
  getUniqueQueryParams as getUniqueQueryParamsCore,
  getUniqueConditionTypes as getUniqueConditionTypesCore,
  getAllConditionTypes,
  getUniqueConditionCategories as getUniqueConditionCategoriesCore,
  buildVariableValueIndex as buildVariableValueIndexCore,
  getUniqueVariableNames as getUniqueVariableNamesCore,
  getDynamicConditionFilters as getDynamicConditionFiltersCore,
} from './helpers/filterHelpers';

import {
  globalSearch as globalSearchCore,
} from './helpers/search';

import {
  getVariableLookupTable,
  getVariableValues,
  getTriggerEventName as getTriggerEventNameCore,
  resolveNestedVariables as resolveNestedVariablesCore,
  resolveVariableWithContext as resolveVariableWithContextCore,
  resolveVariable as resolveVariableCore,
} from './helpers/variableResolver';

// State holder for current data (starts empty)
let currentData = null;
let tags = [];
let triggers = [];
let variables = [];
let customTemplates = [];
let DYNAMIC_TEMPLATE_MAP = {};
let TAG_TYPE_MAP = {};
let processedTags = [];

// Initialize with uploaded data
const initializeData = (data) => {
  currentData = data;
  tags = data?.containerVersion?.tag || [];
  triggers = data?.containerVersion?.trigger || [];
  variables = data?.containerVersion?.variable || [];
  customTemplates = data?.containerVersion?.customTemplate || [];
  DYNAMIC_TEMPLATE_MAP = buildTemplateMap(data);
  TAG_TYPE_MAP = { ...BASE_TAG_TYPE_MAP, ...DYNAMIC_TEMPLATE_MAP };
};

// Build dynamic template mapping from customTemplate array and tag metadata
// Handles both container-specific templates (cvt_{containerId}_{templateId})
// and global community templates (cvt_XXXXX)
const buildTemplateMap = (data) => {
  const map = {};
  const containerId = data?.containerVersion?.container?.containerId;
  const templates = data?.containerVersion?.customTemplate || [];
  const allTags = data?.containerVersion?.tag || [];
  
  // 1. Map container-specific custom templates
  templates.forEach(template => {
    if (template.templateId && template.name) {
      const typeKey = `cvt_${containerId}_${template.templateId}`;
      map[typeKey] = template.name;
    }
  });
  
  // 2. Scan all tags to extract community template names from metadata
  allTags.forEach(tag => {
    if (tag.type && tag.type.startsWith('cvt_') && !map[tag.type]) {
      const templateName = extractTemplateNameFromTag(tag);
      if (templateName) {
        map[tag.type] = templateName;
      }
    }
  });
  
  return map;
};

// Extract template name from tag metadata only (not tag name)
const extractTemplateNameFromTag = (tag) => {
  // Method 1: Check metadata parameter (most reliable)
  const metadataParam = tag.parameter?.find(p => p.key === 'metadata');
  if (metadataParam?.value) {
    // metadata can be string (JSON) or object
    try {
      const metadata = typeof metadataParam.value === 'string' 
        ? JSON.parse(metadataParam.value) 
        : metadataParam.value;
      if (metadata.templateName) {
        return metadata.templateName;
      }
    } catch (e) {
      // Not valid JSON, continue to other methods
    }
  }
  
  // Method 2: Check for templateName directly in parameters
  const templateNameParam = tag.parameter?.find(p => p.key === 'templateName');
  if (templateNameParam?.value) {
    return templateNameParam.value;
  }
  
  // No tag name parsing - only use metadata
  return null;
};

// Get human-readable tag type label with smart fallback
// Priority: 1. TAG_TYPE_MAP (includes dynamic templates)
//           2. Try extracting from tag metadata
//           3. Format the raw type code
const getTagTypeLabel = (tag) => {
  // 1. Check the combined map (base + dynamic templates)
  if (TAG_TYPE_MAP[tag.type]) {
    return TAG_TYPE_MAP[tag.type];
  }
  
  // 2. For community templates not in map, try dynamic extraction
  if (tag.type && tag.type.startsWith('cvt_')) {
    const dynamicName = extractTemplateNameFromTag(tag);
    if (dynamicName) {
      // Cache it for future lookups
      TAG_TYPE_MAP[tag.type] = dynamicName;
      return dynamicName;
    }
    
    // 3. Format the code nicely as fallback
    // cvt_ABC123 → "Community Template"
    return 'Community Template';
  }
  
  // 4. For unknown native types, format nicely
  // some_type → "Some Type"
  if (!tag.type || typeof tag.type !== 'string') return 'Unknown Type';
  return tag.type
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, c => c.toUpperCase());
};

// ============================================
// VARIABLE RESOLUTION
// ============================================
// Logic extracted to ./helpers/variableResolver.js for maintainability

// Wrapper functions that pass internal state to pure resolver functions
const getTriggerEventName = (triggerId) => {
  return getTriggerEventNameCore(triggerId, triggers);
};

const resolveNestedVariables = (value, maxDepth = 5, currentDepth = 0) => {
  return resolveNestedVariablesCore(value, variables, maxDepth, currentDepth);
};

const resolveVariableWithContext = (value, triggerIds) => {
  return resolveVariableWithContextCore(value, triggerIds, variables, triggers);
};

const resolveVariable = (value) => {
  return resolveVariableCore(value, variables);
};

// Extract tag-specific ID or info
const extractTagSpecificInfo = (tag, triggerIds = []) => {
  if (!Array.isArray(tag.parameter)) return '';
  
  // Use context-aware resolver for lookup table variables
  const resolve = (value) => resolveVariableWithContext(value, triggerIds);
  
  switch(tag.type) {
    case 'html': {
      const htmlParam = tag.parameter.find(p => p.key === 'html');
      return htmlParam ? htmlParam.value : '';
    }
    case 'baut': {
      const uetTagId = tag.parameter.find(p => p.key === 'uetqTag');
      return uetTagId ? `UET Tag ID: ${resolve(uetTagId.value)}` : '';
    }
    case 'googtag': {
      const tagId = tag.parameter.find(p => p.key === 'tagId');
      return tagId ? `Tag ID: ${resolve(tagId.value)}` : '';
    }
    case 'gaawe': {
      const measurementId = tag.parameter.find(p => p.key === 'measurementId');
      const eventName = tag.parameter.find(p => p.key === 'eventName');
      let info = '';
      if (measurementId) info += `Measurement ID: ${resolve(measurementId.value)}`;
      if (eventName) info += (info ? ' | ' : '') + `Event: ${resolve(eventName.value)}`;
      return info;
    }
    case 'awct': {
      const conversionId = tag.parameter.find(p => p.key === 'conversionId');
      const conversionLabel = tag.parameter.find(p => p.key === 'conversionLabel');
      const idValue = conversionId ? resolve(conversionId.value) : '';
      const labelValue = conversionLabel ? resolve(conversionLabel.value) : '';
      return `Conversion ID: ${idValue} | Label: ${labelValue}`;
    }
    case 'cvt_K4VXG': { // Snap Pixel
      const snapPixelId = tag.parameter.find(p => p.key === 'pixel_id');
      const snapEventType = tag.parameter.find(p => p.key === 'event_type');
      let snapInfo = '';
      if (snapPixelId) snapInfo += `Snapchat Pixel ID: ${resolve(snapPixelId.value)}`;
      if (snapEventType) snapInfo += (snapInfo ? ' | ' : '') + `Event: ${resolve(snapEventType.value)}`;
      return snapInfo;
    }
    case 'cvt_5RM3Q': { // Facebook Pixel
      const fbPixelId = tag.parameter.find(p => p.key === 'pixelId');
      return fbPixelId ? `Facebook Pixel ID: ${resolve(fbPixelId.value)}` : '';
    }
    case 'cvt_196861550_435': { // TikTok Pixel
      const tiktokPixelCode = tag.parameter.find(p => p.key === 'pixel_code');
      const tiktokEvent = tag.parameter.find(p => p.key === 'event');
      let tiktokInfo = '';
      if (tiktokPixelCode) tiktokInfo += `TikTok Pixel ID: ${resolve(tiktokPixelCode.value)}`;
      if (tiktokEvent) tiktokInfo += (tiktokInfo ? ' | ' : '') + `Event: ${resolve(tiktokEvent.value)}`;
      return tiktokInfo;
    }
    case 'cvt_NNQ8S': { // Outbrain Pixel
      const marketerId = tag.parameter.find(p => p.key === 'MarketerId');
      const obEvent = tag.parameter.find(p => p.key === 'EventName');
      const pixelType = tag.parameter.find(p => p.key === 'pixelType');
      let outbrainInfo = '';
      if (marketerId) outbrainInfo += `Outbrain Marketer ID (OB_ADV_ID): ${resolve(marketerId.value)}`;
      if (pixelType) outbrainInfo += (outbrainInfo ? ' | ' : '') + `Pixel Type: ${resolve(pixelType.value)}`;
      if (obEvent) outbrainInfo += (outbrainInfo ? ' | ' : '') + `Event: ${resolve(obEvent.value)}`;
      return outbrainInfo;
    }
    case 'awud': { // Google Ads User Provided Data
      const conversionId = tag.parameter.find(p => p.key === 'conversionId');
      const userDataVar = tag.parameter.find(p => p.key === 'userDataVariable');
      let awudInfo = '';
      if (conversionId) awudInfo += `Conversion ID: ${resolve(conversionId.value)}`;
      if (userDataVar) awudInfo += (awudInfo ? ' | ' : '') + `User Data Variable: ${resolve(userDataVar.value)}`;
      return awudInfo;
    }
    default: {
      // Dynamic extraction for community templates (cvt_*)
      if (tag.type && tag.type.startsWith('cvt_')) {
        return extractDynamicTemplateInfo(tag, triggerIds);
      }
      return '';
    }
  }
};

// Extract info dynamically from community template tags
const extractDynamicTemplateInfo = (tag, triggerIds = []) => {
  if (!Array.isArray(tag.parameter)) return '';
  
  const resolve = (value) => resolveVariableWithContext(value, triggerIds);
  const infoItems = [];
  
  // Common parameter keys to look for in community templates
  const keyLabels = {
    'projectId': 'Project ID',
    'pixel_id': 'Pixel ID',
    'pixelId': 'Pixel ID',
    'pixel_code': 'Pixel Code',
    'account_id': 'Account ID',
    'accountId': 'Account ID',
    'tracking_id': 'Tracking ID',
    'trackingId': 'Tracking ID',
    'measurement_id': 'Measurement ID',
    'measurementId': 'Measurement ID',
    'container_id': 'Container ID',
    'containerId': 'Container ID',
    'api_key': 'API Key',
    'apiKey': 'API Key',
    'client_id': 'Client ID',
    'clientId': 'Client ID',
    'site_id': 'Site ID',
    'siteId': 'Site ID',
    'property_id': 'Property ID',
    'propertyId': 'Property ID',
    'event': 'Event',
    'event_type': 'Event Type',
    'eventType': 'Event Type',
    'eventName': 'Event Name',
    'EventName': 'Event Name',
    'MarketerId': 'Marketer ID',
    'marketerId': 'Marketer ID',
    // Consentmanager CMP
    'consentmanager_id': 'Consentmanager ID',
    'consentmanager_host': 'CMP Host',
    'consentmanager_cdn': 'CMP CDN',
  };
  
  tag.parameter.forEach(param => {
    if (keyLabels[param.key] && param.value) {
      const label = keyLabels[param.key];
      const value = resolve(param.value);
      // Avoid duplicates
      if (!infoItems.some(item => item.startsWith(label))) {
        infoItems.push(`${label}: ${value}`);
      }
    }
  });
  
  return infoItems.join(' | ');
};

// Helper: Check if a variable is a query parameter variable by checking its configuration
const isQueryParamVariable = (variableName) => {
  if (!variableName || typeof variableName !== 'string') return false;
  
  // Remove {{ }} wrapper if present
  const cleanVarName = variableName.replace(/\{\{|\}\}/g, '').trim();
  if (!cleanVarName) return false;
  
  // Find the variable in the variables array
  if (!variables || !Array.isArray(variables)) return false;
  const variable = variables.find(v => v && v.name === cleanVarName);
  
  if (!variable || !variable.type) return false;
  
  // Check if variable type is URL
  if (variable.type !== 'u') return false;
  
  // Check if component is Query
  if (!Array.isArray(variable.parameter)) return false;
  const componentParam = variable.parameter.find(p => p && p.key === 'component');
  if (componentParam && (
    componentParam.value === 'QUERY' || 
    componentParam.value === 'query' ||
    componentParam.value === 'QUERY_STRING'
  )) {
    return true;
  }
  
  return false;
};

// Check variable type and return appropriate category
const getVariableTypeCategory = (variableName) => {
  if (!variableName || typeof variableName !== 'string') return null;
  
  // Remove {{ }} wrapper if present
  const cleanVarName = variableName.replace(/\{\{|\}\}/g, '').trim();
  if (!cleanVarName) return null;
  
  // Find the variable in the variables array
  if (!variables || !Array.isArray(variables)) return null;
  const variable = variables.find(v => v && v.name === cleanVarName);
  
  if (!variable || !variable.type) return null;
  
  // Check if variable type is Data Layer Variable
  if (variable.type === 'v') {
    return 'Data Layer Variables';
  }
  
  // Check if variable type is Custom JavaScript
  if (variable.type === 'jsm') {
    // First, try to categorize by purpose (Element, Click, Page URL, etc.)
    if (Array.isArray(variable.parameter)) {
      const jsCodeParam = variable.parameter.find(p => p.key === 'javascript');
      if (jsCodeParam && jsCodeParam.value) {
        const jsCode = jsCodeParam.value.toLowerCase();
        
        // Check for CSS class/selector operations (Element category)
        if (jsCode.includes('classlist') || jsCode.includes('class list') || 
            jsCode.includes('contains') || jsCode.includes('queryselector') ||
            jsCode.includes('getelement') || jsCode.includes('body') ||
            jsCode.includes('document.body') || jsCode.includes('element')) {
          return 'Element';
        }
        
        // Check for click-related operations
        if (jsCode.includes('click') || jsCode.includes('event.target')) {
          return 'Click';
        }
        
        // Check for URL/page-related operations
        if (jsCode.includes('location') || jsCode.includes('window.location') ||
            jsCode.includes('url') || jsCode.includes('pathname')) {
          return 'Page URL';
        }
      }
      
      // Also check variable name patterns as fallback
      const varLower = cleanVarName.toLowerCase();
      if (varLower.includes('class') || varLower.includes('body') || 
          varLower.includes('element') || varLower.includes('check')) {
        return 'Element';
      }
    }
    
    // If can't determine specific purpose, categorize as Custom JavaScript Variables
    return 'Custom JavaScript Variables';
  }
  
  return null;
};

// Extract conditions from filter array
const extractConditions = (filterArray) => {
  if (!Array.isArray(filterArray)) return [];
  
  return filterArray.map(filter => {
    // Check for negate and ignore_case flags to properly identify condition types
    let effectiveType = filter.type;
    let ignoreCase = false;
    let isNegated = false;
    
    if (Array.isArray(filter.parameter)) {
      const ignoreCaseParam = filter.parameter.find(p => p.key === 'ignore_case');
      const negateParam = filter.parameter.find(p => p.key === 'negate');
      
      if (ignoreCaseParam && ignoreCaseParam.value === 'true') {
        ignoreCase = true;
      }
      
      if (negateParam && negateParam.value === 'true') {
        isNegated = true;
      }
      
      // First handle negation - convert to DOES_NOT variant
      if (isNegated) {
        switch (filter.type) {
          case 'EQUALS': effectiveType = 'DOES_NOT_EQUAL'; break;
          case 'CONTAINS': effectiveType = 'DOES_NOT_CONTAIN'; break;
          case 'STARTS_WITH': effectiveType = 'DOES_NOT_START_WITH'; break;
          case 'ENDS_WITH': effectiveType = 'DOES_NOT_END_WITH'; break;
          case 'CSS_SELECTOR': effectiveType = 'DOES_NOT_MATCH_CSS_SELECTOR'; break;
          case 'MATCH_REGEX': effectiveType = 'DOES_NOT_MATCH_REGEX'; break;
          default: break;
        }
      }
      
      // Then handle ignore_case for regex types
      if (ignoreCase) {
        if (effectiveType === 'MATCH_REGEX') {
          effectiveType = 'MATCH_REGEX_IGNORE_CASE';
        } else if (effectiveType === 'DOES_NOT_MATCH_REGEX') {
          effectiveType = 'DOES_NOT_MATCH_REGEX_IGNORE_CASE';
        }
      }
    }
    
    const condition = {
      type: effectiveType,
      typeLabel: CONDITION_TYPE_MAP[effectiveType] || effectiveType,
      typeStyle: CONDITION_STYLE_MAP[effectiveType] || 'default',
      variable: '',
      value: '',
      category: 'Other',
      ignoreCase: ignoreCase,
    };
    
    if (Array.isArray(filter.parameter)) {
      filter.parameter.forEach(param => {
        if (!param || typeof param !== 'object') return;
        if (param.key === 'arg0') {
          condition.variable = (param.value && typeof param.value === 'string') ? param.value : '';
          if (!condition.variable) return;
          // Categorize by variable type - Order matters! More specific matches first
          const varLower = condition.variable.toLowerCase();
          const varClean = condition.variable; // Keep original for exact matching
          
          // FIRST: Check variable configuration (type + component) for query params
          // This catches custom variables like "Make", "Model" configured as URL → Query
          if (isQueryParamVariable(condition.variable)) {
            condition.category = 'Query Params';
          }
          // SECOND: Check variable type (Data Layer Variables, Custom JavaScript Variables)
          else {
            const variableTypeCategory = getVariableTypeCategory(condition.variable);
            if (variableTypeCategory) {
              condition.category = variableTypeCategory;
            }
            // THIRD: Check for exact GTM built-in variables (only if not already categorized by custom JS)
            else if (varClean === '{{Page URL}}' || varLower === '{{page url}}') {
              condition.category = 'Page URL';
            } else if (varClean === '{{Page Path}}' || varLower === '{{page path}}') {
              condition.category = 'Page Path';
            } else if (varClean === '{{Page Hostname}}' || varLower === '{{page hostname}}') {
              condition.category = 'Hostname';
            } else if (varClean === '{{Query String}}' || varLower.includes('query')) {
              condition.category = 'Query Params';
            } else if (varLower.includes('utm_') || varLower.includes('utm ')) {
              condition.category = 'Query Params';
            } else if (varLower.includes('referrer')) {
              condition.category = 'Referrer';
            } else if (varLower.includes('click id') || varLower.includes('click classes') || 
                       varLower.includes('click element') || varLower.includes('click text') ||
                       varLower.includes('click url') || varLower.includes('click target')) {
              condition.category = 'Click';
            } else if (varLower.includes('_event') || varClean === '{{Event}}') {
              condition.category = 'Event';
            } else if (varLower.includes('form') || varLower.includes('element') || 
                       varLower.includes('class') || varLower.includes('css selector') ||
                       varLower.includes('visibility') || varLower.includes('body') ||
                       varLower.includes('check') || varLower.includes('selector')) {
              condition.category = 'Element';
            } else if (varLower.includes('url')) {
              condition.category = 'Page URL';
            } else if (varLower.includes('path')) {
              condition.category = 'Page Path';
            } else if (varLower.includes('host')) {
              condition.category = 'Hostname';
            }
          }
        }
        if (param.key === 'arg1') {
          condition.value = (param.value && typeof param.value === 'string') ? param.value : '';
        }
      });
    }
    
    return condition;
  });
};

// Get full trigger info including conditions
const getFullTriggerInfo = (triggerIds) => {
  if (!Array.isArray(triggerIds) || triggerIds.length === 0) {
    return { 
      name: 'All Pages', 
      type: 'PAGEVIEW', // Normalize to uppercase to match TRIGGER_TYPE_MAP
      conditions: [],
      pagePaths: [],
      pageUrls: [],
      queryParams: [],
      events: [],
    };
  }
  
  const triggerNames = [];
  const triggerTypes = [];
  const allConditions = [];
  const pagePaths = [];
  const pageUrls = [];
  const queryParams = [];
  const events = [];
  
  triggerIds.forEach(triggerId => {
    const trigger = triggers.find(t => t.triggerId === triggerId);
    if (trigger) {
      triggerNames.push(trigger.name);
      // Normalize trigger type to uppercase for consistency
      triggerTypes.push(trigger.type ? trigger.type.toUpperCase() : trigger.type);
      
      // Extract filter conditions
      const filterConditions = extractConditions(trigger.filter);
      allConditions.push(...filterConditions);
      
      // Extract custom event filter conditions
      const eventConditions = extractConditions(trigger.customEventFilter);
      allConditions.push(...eventConditions);
      
      // Categorize conditions
      filterConditions.forEach(c => {
        if (c.category === 'Page Path' && c.value) {
          pagePaths.push({ value: c.value, type: c.typeLabel, variable: c.variable });
        }
        if (c.category === 'Page URL' && c.value) {
          pageUrls.push({ value: c.value, type: c.typeLabel, variable: c.variable });
        }
        if (c.category === 'Query Params' && c.value) {
          queryParams.push({ value: c.value, type: c.typeLabel, variable: c.variable });
        }
      });
      
      eventConditions.forEach(c => {
        if (c.value) {
          events.push({ value: c.value, type: c.typeLabel });
        }
      });
      
    } else if (triggerId === '2147479553') {
      triggerNames.push('All Pages');
      triggerTypes.push('PAGEVIEW'); // Normalize to uppercase
    }
  });
  
  return {
    name: triggerNames.join(', ') || 'All Pages',
    type: triggerTypes.join(', ') || 'PAGEVIEW', // Normalize to uppercase
    conditions: allConditions,
    pagePaths: pagePaths,
    pageUrls: pageUrls,
    queryParams: queryParams,
    events: events,
  };
};

// Get trigger info by ID (simplified version for backward compatibility)
const getTriggerInfo = (triggerIds) => {
  const fullInfo = getFullTriggerInfo(triggerIds);
  return {
    name: fullInfo.name,
    type: fullInfo.type,
  };
};

// Get parameters string
const getParameters = (tag) => {
  let params = [];
  
  if (Array.isArray(tag.parameter)) {
    tag.parameter.forEach(param => {
      if (Array.isArray(param.list)) {
        param.list.forEach(listItem => {
          if (Array.isArray(listItem.map)) {
            listItem.map.forEach(mapItem => {
              if (mapItem.key === 'parameter') {
                params.push(mapItem.value);
              }
            });
          }
        });
      }
    });
  }
  
  return params.join(', ');
};

// Get tag parameters with keys (for Query Params filter)
// Extracts parameter keys like utm_adname, utm_source from tag configuration
const getTagParamKeys = (tag) => {
  const paramKeys = [];
  
  if (Array.isArray(tag.parameter)) {
    tag.parameter.forEach(param => {
      if (Array.isArray(param.list)) {
        param.list.forEach(listItem => {
          if (Array.isArray(listItem.map)) {
            let paramKey = null;
            let paramValue = null;
            
            listItem.map.forEach(mapItem => {
              if (mapItem.key === 'parameter') {
                paramKey = mapItem.value; // e.g., "utm_adname"
              }
              if (mapItem.key === 'parameterValue') {
                paramValue = mapItem.value; // e.g., "{{UTM Adname}}"
              }
            });
            
            if (paramKey) {
              paramKeys.push({
                key: paramKey,
                value: paramValue || '',
                type: 'tagParam'
              });
            }
          }
        });
      }
    });
  }
  
  return paramKeys;
};

// Get full trigger details for searchability
const getFullTriggerDetails = (triggerIds) => {
  if (!Array.isArray(triggerIds)) return '';
  
  const details = [];
  triggerIds.forEach(triggerId => {
    const trigger = triggers.find(t => t.triggerId === triggerId);
    if (trigger) {
      details.push(trigger.name || '');
      details.push(trigger.type || '');
      
      // Add filter conditions
      if (Array.isArray(trigger.filter)) {
        trigger.filter.forEach(f => {
          if (Array.isArray(f.parameter)) {
            f.parameter.forEach(p => {
              if (p.value) details.push(p.value);
            });
          }
        });
      }
      
      // Add custom event filter
      if (Array.isArray(trigger.customEventFilter)) {
        trigger.customEventFilter.forEach(f => {
          if (Array.isArray(f.parameter)) {
            f.parameter.forEach(p => {
              if (p.value) details.push(p.value);
            });
          }
        });
      }
    }
  });
  
  return details.join(' ');
};

// Get all parameter values recursively for search
const getAllParameterValues = (tag) => {
  const values = [];
  
  const extractValues = (obj) => {
    if (!obj) return;
    if (typeof obj === 'string') {
      values.push(obj);
      return;
    }
    if (Array.isArray(obj)) {
      obj.forEach(item => extractValues(item));
      return;
    }
    if (typeof obj === 'object') {
      Object.values(obj).forEach(val => extractValues(val));
    }
  };
  
  if (Array.isArray(tag.parameter)) {
    extractValues(tag.parameter);
  }
  
  return values.join(' ');
};

// Process all tags function
const processTags = () => {
  if (!tags || !Array.isArray(tags)) return [];
  
  return tags.map(tag => {
    if (!tag) return null;
    
    const fullTriggerInfo = getFullTriggerInfo(tag.firingTriggerId);
    const humanReadableType = getTagTypeLabel(tag);
    const tagSpecificInfo = extractTagSpecificInfo(tag, tag.firingTriggerId);
    const allParams = getAllParameterValues(tag);
    const triggerDetails = getFullTriggerDetails(tag.firingTriggerId);
    
    // Create searchable text combining all fields
    const conditionsText = (fullTriggerInfo.conditions || []).map(c => {
      if (!c) return '';
      return `${c.variable || ''} ${c.value || ''}`;
    }).filter(Boolean).join(' ');
    const searchableText = [
      tag.name,
      tag.type,
      humanReadableType,
      fullTriggerInfo.name,
      fullTriggerInfo.type,
      tagSpecificInfo,
      allParams,
      triggerDetails,
      conditionsText,
      tag.tagId,
    ].filter(Boolean).join(' ').toLowerCase();
    
    // Check if this is a community template tag
    const isCommunityTemplate = tag.type && tag.type.startsWith('cvt_');
    
    return {
      id: tag.tagId,
      name: tag.name,
      type: tag.type,
      typeLabel: humanReadableType,
      isCommunityTemplate: isCommunityTemplate, // Flag for filtering community templates
      triggerName: fullTriggerInfo.name,
      triggerType: fullTriggerInfo.type,
      triggerIds: tag.firingTriggerId || [],
      parameters: getParameters(tag),
      tagSpecificInfo: tagSpecificInfo,
      allParams: allParams, // All parameter values (for variable extraction)
      // GTM default: If tagFiringOption is empty/undefined in JSON, it means "Once per event" (GTM's actual default)
      // Only when explicitly set in GTM UI will tagFiringOption have a value like "ONCE_PER_PAGE" or "UNLIMITED"
      // Empty dropdown = "Once per event" (recommended default for most tags)
      firingOption: tag.tagFiringOption || 'ONCE_PER_EVENT',
      fingerprint: tag.fingerprint,
      paused: tag.paused === true,
      searchableText: searchableText,
      // New trigger condition fields
      conditions: fullTriggerInfo.conditions,
      pagePaths: fullTriggerInfo.pagePaths,
      pageUrls: fullTriggerInfo.pageUrls,
      queryParams: fullTriggerInfo.queryParams,
      events: fullTriggerInfo.events,
      // Tag parameter keys (like utm_adname, utm_source from tag config)
      tagParamKeys: getTagParamKeys(tag),
    };
  }).filter(Boolean); // Remove any null entries
};

// Process data and update exports
export const processGTMData = (data) => {
  initializeData(data);
  processedTags = processTags();
  // Rebuild variable value index for search
  rebuildVariableValueIndex();
  return processedTags;
};

// No auto-initialization - data comes from user upload via IndexedDB

// Export processed tags getter
export const getProcessedTags = () => processedTags;

// Get stats
export const getStats = () => {
  const tagsByType = {};
  let pausedCount = 0;
  let activeCount = 0;
  
  processedTags.forEach(tag => {
    tagsByType[tag.typeLabel] = (tagsByType[tag.typeLabel] || 0) + 1;
    if (tag.paused) {
      pausedCount++;
    } else {
      activeCount++;
    }
  });
  
  // Get export time - handle both exported JSON (exportTime) and API response (fingerprint)
  let exportTime = 'Unknown';
  if (currentData?.exportTime) {
    // Exported JSON format
    exportTime = currentData.exportTime;
  } else if (currentData?.containerVersion?.fingerprint) {
    // API response - fingerprint is Unix timestamp in milliseconds
    const timestamp = parseInt(currentData.containerVersion.fingerprint, 10);
    if (!isNaN(timestamp)) {
      const date = new Date(timestamp);
      // Format as readable date
      exportTime = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  }
  
  return {
    totalTags: tags.length,
    totalTriggers: triggers.length,
    totalVariables: variables.length,
    tagsByType,
    pausedTags: pausedCount,
    activeTags: activeCount,
    containerName: currentData?.containerVersion?.container?.name || 'Unknown',
    containerId: currentData?.containerVersion?.container?.publicId || 'Unknown',
    exportTime,
  };
};

// Get chart data for tag types
export const getTagTypeChartData = () => {
  const stats = getStats();
  return Object.entries(stats.tagsByType)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
};

// ============================================
// FILTER HELPERS
// ============================================
// Logic extracted to ./helpers/filterHelpers.js for maintainability

// Variable value index - rebuilt when data changes
let variableValueIndex = [];

// Rebuild variable value index (called after data processing)
const rebuildVariableValueIndex = () => {
  variableValueIndex = buildVariableValueIndexCore(variables);
};

// Wrapper functions that pass internal state to pure filter functions
export const getUniqueTagTypes = () => {
  return getUniqueTagTypesCore(processedTags);
};

export const getUniqueTagTypesFlat = () => {
  return getUniqueTagTypesFlatCore(processedTags);
};

export const getUniqueTriggerTypes = () => {
  return getUniqueTriggerTypesCore(processedTags);
};

export const getUniqueTriggerTypeLabels = () => {
  const allTriggers = getAllTriggersWithDetails();
  return getUniqueTriggerTypeLabelsCore(allTriggers);
};

export const getUniquePagePaths = () => {
  return getUniquePagePathsCore(processedTags);
};

export const getUniquePageUrls = () => {
  return getUniquePageUrlsCore(processedTags);
};

export const getUniqueQueryParams = () => {
  return getUniqueQueryParamsCore(processedTags);
};

export const getUniqueConditionTypes = () => {
  return getUniqueConditionTypesCore(processedTags);
};

// Re-export getAllConditionTypes directly (pure function, no state needed)
export { getAllConditionTypes };

export const getUniqueConditionCategories = () => {
  return getUniqueConditionCategoriesCore(processedTags);
};

// Get dynamic condition filters (grouped by variable with values)
export const getDynamicConditionFilters = () => {
  if (!processedTags || !Array.isArray(processedTags) || processedTags.length === 0) {
    return [];
  }
  return getDynamicConditionFiltersCore(processedTags);
};

// ============================================
// SEARCH
// ============================================
// Logic extracted to ./helpers/search.js for maintainability

// Wrapper that passes internal state to pure search function
export const globalSearch = (query) => {
  return globalSearchCore(query, processedTags, variableValueIndex);
};

// Get all variables for display
export const getVariables = () => {
  return variables.map(v => ({
    id: v.variableId,
    name: v.name,
    type: v.type,
  }));
};

// Get variable values used by a tag
export const getVariableValuesForTag = (tag) => {
  const usedVariables = [];
  
  // Find all variable references in the tag ({{Variable Name}})
  const varRefPattern = /\{\{([^}]+)\}\}/g;
  const searchText = `${tag.parameters} ${tag.tagSpecificInfo} ${tag.searchableText}`;
  
  const foundVars = new Set();
  let match;
  while ((match = varRefPattern.exec(searchText)) !== null) {
    foundVars.add(match[1]);
  }
  
  // For each found variable, get its values
  foundVars.forEach(varName => {
    const variable = variables.find(v => v.name === varName);
    if (!variable || !Array.isArray(variable.parameter)) return;
    
    const varInfo = {
      name: varName,
      type: variable.type,
      values: []
    };
    
    variable.parameter.forEach(param => {
      // Direct value
      if (param.key === 'value' && param.value) {
        varInfo.values.push({ key: 'Value', value: param.value });
      }
      
      // Default value
      if (param.key === 'defaultValue' && param.value) {
        varInfo.values.push({ key: 'Default Value', value: param.value });
      }
      
      // Constant value
      if (param.key === 'constantValue' && param.value) {
        varInfo.values.push({ key: 'Constant', value: param.value });
      }
      
      // Lookup table / RegEx table
      if (param.key === 'map' && Array.isArray(param.list)) {
        param.list.forEach(item => {
          if (item.map && Array.isArray(item.map)) {
            const mapEntry = {};
            item.map.forEach(mapItem => {
              if (mapItem.key === 'key') mapEntry.key = mapItem.value;
              if (mapItem.key === 'value') mapEntry.value = mapItem.value;
            });
            if (mapEntry.key && mapEntry.value) {
              varInfo.values.push({ key: mapEntry.key, value: mapEntry.value });
            }
          }
        });
      }
    });
    
    if (varInfo.values.length > 0) {
      usedVariables.push(varInfo);
    }
  });
  
  return usedVariables;
};

// Get all triggers for display
export const getTriggers = () => {
  return triggers.map(t => ({
    id: t.triggerId,
    name: t.name,
    type: t.type,
  }));
};

// Get all triggers with full details for Triggers page
export const getAllTriggersWithDetails = () => {
  return triggers.map(trigger => {
    // Get tags that use this trigger
    const usedByTags = processedTags.filter(tag => 
      tag.triggerIds && tag.triggerIds.includes(trigger.triggerId)
    ).map(tag => ({
      id: tag.id,
      name: tag.name,
      type: tag.typeLabel,
      paused: tag.paused,
    }));
    
    // Extract conditions from all filter arrays
    const conditions = [];
    const processFilterArray = (filterArray, filterType) => {
      if (!filterArray || !Array.isArray(filterArray)) return;
      filterArray.forEach(condition => {
        if (!condition.parameter) return;
        let variable = '';
        let value = '';
        let type = condition.type || '';
        condition.parameter.forEach(param => {
          if (param.key === 'arg0') variable = param.value || '';
          if (param.key === 'arg1') value = param.value || '';
        });
        if (variable || value) {
          conditions.push({ filterType, variable, type, value });
        }
      });
    };
    
    processFilterArray(trigger.filter, 'Page Filter');
    processFilterArray(trigger.customEventFilter, 'Event Filter');
    processFilterArray(trigger.autoEventFilter, 'Auto Event Filter');
    
    // Extract ALL trigger details from parameters
    const details = {
      // Common
      eventName: null,
      uniqueTriggerId: null,
      // Wait settings
      waitForTags: false,
      waitForTagsTimeout: null,
      checkValidation: false,
      // Timer
      timerInterval: null,
      timerLimit: null,
      timerEventName: null,
      // Scroll depth
      scrollThresholds: null,
      scrollUnits: null,
      scrollDirection: null,
      // Element visibility
      visibilitySelector: null,
      visibilityMinPercent: null,
      visibilityMinDuration: null,
      visibilityFireOn: null,
      // Click/link
      clickSelector: null,
      clickMatchSelector: null,
      onlyLinks: false,
      // Form
      formSelector: null,
      waitForFormTimeout: null,
      // YouTube
      youTubeTriggers: [],
      youTubeProgressThresholds: null,
      youTubeFixMissingApi: false,
      // History
      historySource: null,
      // Regex matching
      useRegexMatching: false,
      // All raw parameters
      allParameters: {},
    };
    
    const params = trigger.parameter || [];
    params.forEach(param => {
      const key = param.key;
      const value = param.value;
      
      // Store all params for reference
      details.allParameters[key] = value;
      
      // Event name - multiple possible keys
      if (key === 'eventName' || key === 'customEventName') details.eventName = value;
      if (key === 'uniqueTriggerId') details.uniqueTriggerId = value;
      
      // Wait settings
      if (key === 'waitForTags' && value === 'true') details.waitForTags = true;
      if (key === 'waitForTagsTimeout') details.waitForTagsTimeout = value;
      if (key === 'checkValidation' && value === 'true') details.checkValidation = true;
      
      // Timer
      if (key === 'interval') details.timerInterval = value;
      if (key === 'limit') details.timerLimit = value;
      if (key === 'timerEventName') details.timerEventName = value;
      
      // Scroll depth
      if (key === 'verticalThresholdsPercent' || key === 'horizontalThresholdsPercent') {
        details.scrollThresholds = value;
        details.scrollUnits = 'PERCENT';
      }
      if (key === 'verticalThresholdsPixels' || key === 'horizontalThresholdsPixels') {
        details.scrollThresholds = value;
        details.scrollUnits = 'PIXELS';
      }
      if (key === 'triggerStartOption') {
        details.scrollDirection = value === 'VERTICAL' ? 'Vertical' : 'Horizontal';
      }
      
      // Element visibility
      if (key === 'elementSelector' || key === 'selectorType') details.visibilitySelector = value;
      if (key === 'minPercentVisible') details.visibilityMinPercent = value;
      if (key === 'minOnScreenDuration') details.visibilityMinDuration = value;
      if (key === 'observeType') details.visibilityFireOn = value;
      
      // Click/link
      if (key === 'targetSelector') details.clickSelector = value;
      if (key === 'matchSelector') details.clickMatchSelector = value;
      if (key === 'onlyLinks' && value === 'true') details.onlyLinks = true;
      
      // Form
      if (key === 'formId' || key === 'formClasses' || key === 'formSelector') details.formSelector = value;
      if (key === 'waitForFormTimeout') details.waitForFormTimeout = value;
      
      // YouTube
      if (key === 'fixMissingApi' && value === 'true') details.youTubeFixMissingApi = true;
      if (key === 'captureStart' && value === 'true') details.youTubeTriggers.push('Start');
      if (key === 'captureComplete' && value === 'true') details.youTubeTriggers.push('Complete');
      if (key === 'capturePause' && value === 'true') details.youTubeTriggers.push('Pause');
      if (key === 'captureProgress' && value === 'true') details.youTubeTriggers.push('Progress');
      if (key === 'progressThresholdsPercent') details.youTubeProgressThresholds = value;
      
      // History
      if (key === 'historySource') details.historySource = value;
      
      // Regex
      if (key === 'useRegexMatching' && value === 'true') details.useRegexMatching = true;
    });
    
    // For Custom Event triggers, extract event name from conditions if not already set
    if (trigger.type === 'CUSTOM_EVENT' && !details.eventName) {
      // Check customEventFilter for the event name
      const eventFilter = trigger.customEventFilter;
      if (eventFilter && Array.isArray(eventFilter)) {
        eventFilter.forEach(condition => {
          if (condition.parameter) {
            let variable = '';
            let value = '';
            condition.parameter.forEach(param => {
              if (param.key === 'arg0') variable = param.value || '';
              if (param.key === 'arg1') value = param.value || '';
            });
            // If variable is {{_event}}, the value is the custom event name
            if (variable === '{{_event}}' && value) {
              details.eventName = value;
            }
          }
        });
      }
    }
    
    // Clean up empty values
    Object.keys(details).forEach(key => {
      if (details[key] === null || 
          (Array.isArray(details[key]) && details[key].length === 0) ||
          (key === 'allParameters' && Object.keys(details[key]).length === 0)) {
        // Keep allParameters even if empty for reference
        if (key !== 'allParameters') delete details[key];
      }
    });
    
    return {
      id: trigger.triggerId,
      name: trigger.name,
      type: trigger.type,
      typeLabel: TRIGGER_TYPE_MAP[trigger.type] || trigger.type,
      conditions,
      details,
      usedByTags,
      usedByCount: usedByTags.length,
      isOrphan: usedByTags.length === 0,
      fingerprint: trigger.fingerprint,
      // Include raw trigger for any additional data
      rawParameters: trigger.parameter || [],
    };
  });
};

// Get container info
export const getContainerInfo = () => {
  const container = currentData?.containerVersion?.container;
  return {
    name: container?.name || 'Unknown Container',
    containerId: container?.containerId || '',
    publicId: container?.publicId || '',
    accountId: currentData?.containerVersion?.accountId || '',
  };
};

// Check if data is loaded
export const hasData = () => tags.length > 0;

// ============================================
// DUPLICATE TAG DETECTION
// ============================================
// Logic extracted to ./cleanup/duplicates.js for maintainability

// Wrapper that passes internal state to pure detection functions
export const detectDuplicateTags = () => {
  return detectDuplicatesCore(tags, triggers, processedTags, TAG_TYPE_MAP);
};

// Wrapper for duplicate stats
export const getDuplicateStats = () => {
  return getDuplicateStatsCore(tags, triggers, processedTags, TAG_TYPE_MAP);
};

// ============================================
// UNUSED VARIABLES DETECTION
// ============================================
// Logic extracted to ./cleanup/unusedVariables.js for maintainability
// Re-export helpers that may be used elsewhere
export { extractVariableReferences, extractVariablesFromParams };

// Wrapper that passes internal state to pure detection functions
export const getVariableQueryKeyMap = () => {
  return getVariableQueryKeyMapCore(variables);
};

export const detectUnusedVariables = () => {
  return detectUnusedVariablesCore(variables, tags, triggers);
};

export const getUnusedVariableStats = () => {
  return getUnusedVariableStatsCore(variables, tags, triggers);
};

export const getAllVariablesWithDetails = () => {
  return getAllVariablesWithDetailsCore(variables, tags, triggers);
};

export const getUniqueVariableTypeLabels = () => {
  return getUniqueVariableTypeLabelsCore(variables, tags, triggers);
};

// Get all unique variable names (built-in + custom) used in tags
export const getUniqueVariableNames = () => {
  const allVariables = getAllVariablesWithDetails();
  const builtInVariables = currentData?.containerVersion?.builtInVariable || [];
  return getUniqueVariableNamesCore(processedTags, allVariables, builtInVariables);
};

// ============================================
// ORPHAN TRIGGERS DETECTION
// ============================================
// Logic extracted to ./cleanup/orphanTriggers.js for maintainability

// Wrapper that passes internal state to pure detection functions
export const detectOrphanTriggers = () => {
  return detectOrphanTriggersCore(triggers, tags);
};

export const getOrphanTriggerStats = () => {
  return getOrphanTriggerStatsCore(triggers, tags);
};

export { tags, triggers, variables, processedTags };

