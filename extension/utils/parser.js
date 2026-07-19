/**
 * GTM Container Analyzer - Tag+Pixel Debugger | Data Parser
 * 
 * Parses and structures captured data for display.
 * Extracts meaningful information from raw captures.
 */

import { TAG_PATTERNS, DATALAYER_EVENTS } from './constants.js';

/**
 * Parse URL into components
 * @param {string} url - Full URL
 * @returns {Object} Parsed URL components
 */
export function parseUrl(url) {
  try {
    const urlObj = new URL(url);
    const queryParams = {};

    urlObj.searchParams.forEach((value, key) => {
      queryParams[key] = value;
    });

    return {
      full: url,
      protocol: urlObj.protocol,
      hostname: urlObj.hostname,
      pathname: urlObj.pathname,
      search: urlObj.search,
      hash: urlObj.hash,
      queryParams,
    };
  } catch (error) {
    return {
      full: url,
      protocol: '',
      hostname: '',
      pathname: '',
      search: '',
      hash: '',
      queryParams: {},
    };
  }
}

/**
 * Identify tag type from URL
 * @param {string} url - Request URL
 * @returns {Object|null} Tag info or null
 */
export function identifyTagFromUrl(url) {
  for (const [key, config] of Object.entries(TAG_PATTERNS)) {
    for (const pattern of config.patterns) {
      if (pattern.test(url)) {
        return {
          type: key,
          name: config.name,
          icon: config.icon,
        };
      }
    }
  }
  return null;
}

/**
 * Parse network request into tag info
 * @param {Object} request - Network request object
 * @returns {Object} Parsed tag info
 */
export function parseNetworkRequest(request) {
  const tagInfo = identifyTagFromUrl(request.url);
  const urlParts = parseUrl(request.url);

  return {
    id: request.id || Date.now().toString(),
    url: request.url,
    method: request.method || 'GET',
    timestamp: request.timestamp || new Date().toISOString(),
    tag: tagInfo,
    urlParts,
    // Extract common parameters
    params: extractRequestParams(request.url, tagInfo?.type),
  };
}

/**
 * Extract parameters from request URL based on tag type
 * @param {string} url - Request URL
 * @param {string} tagType - Identified tag type
 * @returns {Object} Extracted parameters
 */
function extractRequestParams(url, tagType) {
  const urlObj = new URL(url);
  const params = {};

  urlObj.searchParams.forEach((value, key) => {
    params[key] = value;
  });

  // Tag-specific parameter extraction
  switch (tagType) {
    case 'GA4':
      return {
        measurementId: params.tid || params.id,
        eventName: params.en,
        clientId: params.cid,
        sessionId: params.sid,
        ...params,
      };

    case 'META_PIXEL':
      return {
        pixelId: params.id,
        event: params.ev,
        ...params,
      };

    case 'GOOGLE_ADS':
      return {
        conversionId: params.id || extractFromPath(url, 'conversion'),
        conversionLabel: params.label,
        ...params,
      };

    default:
      return params;
  }
}

/**
 * Extract value from URL path
 * SECURITY: Uses string manipulation instead of dynamic RegExp to prevent ReDoS
 */
function extractFromPath(url, segment) {
  const searchStr = segment + '/';
  const idx = url.indexOf(searchStr);
  if (idx === -1) return null;
  const rest = url.substring(idx + searchStr.length);
  const end = rest.search(/[/?#]/);
  return end === -1 ? rest : rest.substring(0, end);
}

/**
 * Categorize dataLayer event
 * @param {Object} event - DataLayer event
 * @returns {string} Event category
 */
export function categorizeDataLayerEvent(event) {
  const eventName = event?.event || event?.[0]?.event || '';

  if (DATALAYER_EVENTS.PAGE_VIEW.includes(eventName)) {
    return 'Page View';
  }
  if (DATALAYER_EVENTS.ECOMMERCE.includes(eventName)) {
    return 'Ecommerce';
  }
  if (DATALAYER_EVENTS.USER.includes(eventName)) {
    return 'User';
  }
  return 'Custom';
}

/**
 * Parse dataLayer push event
 * @param {*} data - DataLayer push data
 * @returns {Object} Parsed event
 */
export function parseDataLayerEvent(data) {
  // Handle different dataLayer.push formats
  let eventData = data;

  // If it's an array (from push arguments)
  if (Array.isArray(data)) {
    eventData = data[0];
  }

  // If it's a function (callback), skip
  if (typeof eventData === 'function') {
    return null;
  }

  const eventName = eventData?.event || 'data_push';

  return {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    event: eventName,
    category: categorizeDataLayerEvent(eventData),
    data: eventData,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Extract GTM container ID from GTM script URL
 * @param {string} url - GTM script URL
 * @returns {string|null} Container ID
 */
export function extractGTMContainerId(url) {
  // Match GTM-XXXXXX pattern
  const match = url.match(/[?&]id=(GTM-[A-Z0-9]+)/i);
  return match ? match[1] : null;
}

/**
 * Summarize captured data for display
 * @param {Object} capturedData - Full captured data
 * @returns {Object} Summary statistics
 */
export function summarizeCapturedData(capturedData) {
  const { networkRequests = [], dataLayerEvents = [] } = capturedData;

  // Count tags by type
  const tagCounts = {};
  const tagDetails = [];

  networkRequests.forEach(req => {
    if (req.tag) {
      tagCounts[req.tag.type] = (tagCounts[req.tag.type] || 0) + 1;

      // Add unique tag details
      if (!tagDetails.find(t => t.type === req.tag.type)) {
        tagDetails.push({
          type: req.tag.type,
          name: req.tag.name,
          icon: req.tag.icon,
        });
      }
    }
  });

  // Count events by category
  const eventCounts = {};
  dataLayerEvents.forEach(evt => {
    const category = evt.category || 'Other';
    eventCounts[category] = (eventCounts[category] || 0) + 1;
  });

  return {
    totalRequests: networkRequests.length,
    totalEvents: dataLayerEvents.length,
    tagCounts,
    tagDetails,
    eventCounts,
    gtmContainerId: capturedData.gtmContainerId,
  };
}

