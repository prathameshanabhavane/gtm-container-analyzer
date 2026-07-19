/**
 * Orphan Triggers Detection Module
 * 
 * Pure functions for detecting orphan triggers (not used by any tag) in GTM containers.
 * All functions receive required state as parameters for testability.
 */

// Helper: Extract trigger conditions for display
export const extractTriggerConditions = (trigger) => {
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
        conditions.push({
          filterType,
          variable,
          type,
          value,
        });
      }
    });
  };
  
  processFilterArray(trigger.filter, 'Page Filter');
  processFilterArray(trigger.customEventFilter, 'Event Filter');
  processFilterArray(trigger.autoEventFilter, 'Auto Event Filter');
  
  return conditions;
};

// Helper: Extract full trigger details from parameters
// Receives triggers array for trigger group lookups
export const extractTriggerDetails = (trigger, triggers) => {
  const details = {
    eventName: null,
    waitForTags: false,
    waitForTagsTimeout: null,
    checkValidation: false,
    uniqueTriggerId: null,
    // Timer trigger
    timerInterval: null,
    timerLimit: null,
    timerEventName: null,
    // Scroll depth
    scrollUnits: null, // PERCENT or PIXELS
    scrollThresholds: [],
    scrollDirection: null, // VERTICAL or HORIZONTAL
    // Element visibility
    visibilitySelector: null,
    visibilityMinPercentVisible: null,
    visibilityMinDuration: null,
    visibilityFireOn: null, // ONCE_PER_PAGE, ONCE_PER_ELEMENT, EVERY_TIME
    // Click/link trigger
    clickTargetSelector: null,
    clickMatchSelector: null,
    onlyLinks: false,
    waitForLinksTimeout: null,
    // Form submission
    formSelector: null,
    waitForFormTimeout: null,
    // YouTube
    youTubeVideoTriggers: [], // start, complete, pause, progress, etc.
    youTubeProgressThresholds: [],
    // History change
    historySource: null, // pushState, popState, replaceState, etc.
    // Custom event
    customEventName: null,
    useRegexMatching: false,
    // Trigger Group
    triggerGroupConditions: [],
    // Raw parameters for reference
    allParameters: {},
  };
  
  const params = trigger.parameter || [];
  
  params.forEach(param => {
    const key = param.key;
    const value = param.value;
    
    // Store all params
    details.allParameters[key] = value;
    
    // Event name
    if (key === 'eventName') {
      details.eventName = value;
      details.customEventName = value;
    }
    
    // Wait for tags
    if (key === 'waitForTags' && value === 'true') {
      details.waitForTags = true;
    }
    if (key === 'waitForTagsTimeout') {
      details.waitForTagsTimeout = value;
    }
    
    // Check validation
    if (key === 'checkValidation' && value === 'true') {
      details.checkValidation = true;
    }
    
    // Unique trigger ID
    if (key === 'uniqueTriggerId') {
      details.uniqueTriggerId = value;
    }
    
    // Timer settings
    if (key === 'interval') {
      details.timerInterval = value;
    }
    if (key === 'limit') {
      details.timerLimit = value;
    }
    if (key === 'timerEventName') {
      details.timerEventName = value;
    }
    
    // Scroll depth
    if (key === 'verticalThresholdUnits' || key === 'horizontalThresholdUnits') {
      details.scrollUnits = value; // PERCENT or PIXELS
    }
    if (key === 'verticalThresholdsPercent' || key === 'horizontalThresholdsPercent') {
      details.scrollThresholds = value.split(',').map(t => t.trim());
      details.scrollUnits = 'PERCENT';
    }
    if (key === 'verticalThresholdsPixels' || key === 'horizontalThresholdsPixels') {
      details.scrollThresholds = value.split(',').map(t => t.trim());
      details.scrollUnits = 'PIXELS';
    }
    if (key === 'triggerStartOption') {
      details.scrollDirection = value === 'VERTICAL' ? 'Vertical' : 'Horizontal';
    }
    
    // Element visibility
    if (key === 'elementSelector') {
      details.visibilitySelector = value;
    }
    if (key === 'minPercentVisible') {
      details.visibilityMinPercentVisible = value;
    }
    if (key === 'minOnScreenDuration') {
      details.visibilityMinDuration = value;
    }
    if (key === 'firingFrequency') {
      const freqMap = {
        'ONCE': 'Once per page',
        'ONCE_PER_ELEMENT': 'Once per element',
        'MANY_PER_ELEMENT': 'Every time',
      };
      details.visibilityFireOn = freqMap[value] || value;
    }
    
    // Click triggers
    if (key === 'targetSelector' || key === 'clickTargetSelector') {
      details.clickTargetSelector = value;
    }
    if (key === 'matchSelector' || key === 'clickMatchesSelector') {
      details.clickMatchSelector = value;
    }
    if (key === 'waitForLinks' && value === 'true') {
      details.onlyLinks = true;
    }
    if (key === 'waitForLinksTimeout') {
      details.waitForLinksTimeout = value;
    }
    
    // Form submission
    if (key === 'formSelector') {
      details.formSelector = value;
    }
    if (key === 'waitForForm' && value === 'true') {
      details.waitForFormTimeout = true;
    }
    
    // YouTube
    if (key === 'triggerType' && param.list) {
      details.youTubeVideoTriggers = param.list.map(item => {
        const typeMap = {
          'START': 'Video Start',
          'COMPLETE': 'Video Complete',
          'PAUSE': 'Video Pause',
          'PROGRESS': 'Progress',
          'SEEK': 'Video Seek',
          'BUFFERING': 'Video Buffering',
          'CUE': 'Video Cued',
        };
        return typeMap[item.value] || item.value;
      });
    }
    if (key === 'progressThresholdsPercent') {
      details.youTubeProgressThresholds = value.split(',').map(t => t.trim() + '%');
    }
    
    // History change
    if (key === 'historySource') {
      const sourceMap = {
        'pushState': 'pushState',
        'popState': 'popState',
        'replaceState': 'replaceState',
      };
      details.historySource = sourceMap[value] || value;
    }
    
    // Regex matching for custom events
    if (key === 'useRegexMatching' && value === 'true') {
      details.useRegexMatching = true;
    }
  });
  
  // Trigger group conditions
  if (trigger.type === 'triggerGroup' && trigger.parameter) {
    const triggerRefs = trigger.parameter.find(p => p.key === 'triggerIds');
    if (triggerRefs && triggerRefs.list) {
      details.triggerGroupConditions = triggerRefs.list.map(item => {
        const refTriggerId = item.value;
        const refTrigger = triggers.find(t => t.triggerId === refTriggerId);
        return refTrigger ? refTrigger.name : refTriggerId;
      });
    }
  }
  
  return details;
};

// Trigger type mapping for display
const TRIGGER_TYPE_DISPLAY_MAP = {
  'pageview': 'Page View',
  'customEvent': 'Custom Event',
  'click': 'All Clicks',
  'linkClick': 'Just Links',
  'formSubmit': 'Form Submission',
  'domReady': 'DOM Ready',
  'windowLoaded': 'Window Loaded',
  'timer': 'Timer',
  'scrollDepth': 'Scroll Depth',
  'elementVisibility': 'Element Visibility',
  'youTubeVideo': 'YouTube Video',
  'historyChange': 'History Change',
  'jsError': 'JavaScript Error',
  'triggerGroup': 'Trigger Group',
};

// Detect orphan triggers (triggers not used by any tag)
// Receives required state as parameters for purity
export const detectOrphanTriggers = (triggers, tags) => {
  if (!triggers || triggers.length === 0) return { orphan: [], used: [], stats: {} };
  
  // Collect all trigger IDs used by tags
  const usedTriggerIds = new Set();
  
  tags.forEach(tag => {
    // Firing triggers
    if (tag.firingTriggerId && Array.isArray(tag.firingTriggerId)) {
      tag.firingTriggerId.forEach(id => usedTriggerIds.add(id));
    }
    // Blocking triggers
    if (tag.blockingTriggerId && Array.isArray(tag.blockingTriggerId)) {
      tag.blockingTriggerId.forEach(id => usedTriggerIds.add(id));
    }
  });
  
  // Separate orphan and used triggers
  const orphan = [];
  const used = [];
  
  triggers.forEach(trigger => {
    const triggerInfo = {
      id: trigger.triggerId,
      name: trigger.name,
      type: trigger.type,
      typeLabel: TRIGGER_TYPE_DISPLAY_MAP[trigger.type] || trigger.type,
      conditions: extractTriggerConditions(trigger),
      details: extractTriggerDetails(trigger, triggers),
      usedByTags: [],
    };
    
    if (usedTriggerIds.has(trigger.triggerId)) {
      // Find which tags use this trigger
      tags.forEach(tag => {
        const isFiring = tag.firingTriggerId?.includes(trigger.triggerId);
        const isBlocking = tag.blockingTriggerId?.includes(trigger.triggerId);
        
        if (isFiring || isBlocking) {
          triggerInfo.usedByTags.push({
            name: tag.name,
            id: tag.tagId,
            usage: isFiring ? 'Firing' : 'Blocking',
          });
        }
      });
      used.push(triggerInfo);
    } else {
      orphan.push(triggerInfo);
    }
  });
  
  // Sort orphan by name
  orphan.sort((a, b) => a.name.localeCompare(b.name));
  used.sort((a, b) => b.usedByTags.length - a.usedByTags.length);
  
  return {
    orphan,
    used,
    stats: {
      total: triggers.length,
      orphanCount: orphan.length,
      usedCount: used.length,
      orphanPercentage: triggers.length > 0 
        ? Math.round((orphan.length / triggers.length) * 100) 
        : 0,
    },
  };
};

// Get orphan trigger stats (quick summary)
export const getOrphanTriggerStats = (triggers, tags) => {
  const result = detectOrphanTriggers(triggers, tags);
  return result.stats;
};

