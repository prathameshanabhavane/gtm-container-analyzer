/**
 * GTM Container Analyzer - Tag+Pixel Debugger | Background Service Worker
 * 
 * Handles extension lifecycle, message routing, and storage operations.
 * Manifest V3 compatible service worker.
 * 
 * SECURITY: All data is validated before storage and retrieval.
 */

import { DASHBOARD_LIVE_URL, ENV, STORAGE_KEYS, TAB_SESSION_LIMITS } from '../utils/constants.js';

// Log environment for debugging
console.log(`[GTM Live Service Worker] Environment: ${ENV}`);

// ============================================
// PERFORMANCE & SECURITY CONSTANTS
// ============================================
// LIGHTWEIGHT: Minimal memory and CPU footprint
// SECURITY: Object.freeze prevents runtime tampering
const SECURITY = Object.freeze({
  MAX_STORAGE_SIZE_MB: 5,          // Reduced for faster I/O
  MAX_HISTORY_ITEMS: 50,           // Reduced - keep recent only
  MAX_STRING_LENGTH: 5000,         // Reduced for memory efficiency
  MAX_REQUESTS: 300,               // Reduced - enough for typical session
  MAX_EVENTS: 150,                 // Reduced - keep it lean
  MAX_OBJECT_DEPTH: 5,             // Prevent deeply nested attacks
  STORAGE_DEBOUNCE_MS: 200,        // Debounce storage writes
  VALID_MESSAGE_TYPES: Object.freeze([
    'GET_CAPTURED_DATA',
    'SAVE_CAPTURED_DATA',
    'CLEAR_CAPTURED_DATA',
    'CAPTURE_UPDATE',
    'OPEN_DASHBOARD',
    'GET_CAPTURE_STATUS',
    'GET_ACTIVE_TAB_DATA',
    'CLEAR_ACTIVE_TAB_DATA',
    'CONTENT_SCRIPT_READY',
    // Tab isolation messages
    'TAB_ISOLATION_MODE_CHANGED',
    'GET_TAB_SESSION_DATA',
    'CLEAR_TAB_SESSION_DATA',
    'SAVE_TAB_SESSION_DATA',
    'SAVE_TO_HISTORY'
  ]),
  BLOCKED_KEYS: Object.freeze(['__proto__', 'constructor', 'prototype']),
  // SECURITY: Allowed dashboard origins (strict match, no wildcards)
  ALLOWED_DASHBOARD_ORIGINS: Object.freeze([
    'http://localhost:5173',
    'https://gtmcontaineranalyzer.com',
    'https://www.gtmcontaineranalyzer.com'
  ]),
});

// ============================================
// SENDER VERIFICATION
// ============================================
/**
 * Verify that the message sender is legitimate
 * SECURITY: Prevents spoofed messages from malicious scripts
 */
function isValidSender(sender) {
  // Messages from extension itself (popup, background) are always valid
  if (sender.id === chrome.runtime.id && !sender.tab) {
    return true;
  }

  // Messages from content scripts must have tab info
  if (!sender.tab || !sender.tab.id) {
    console.warn('[GTM Live Security] Blocked message: No tab info');
    return false;
  }

  // Verify sender URL exists
  if (!sender.url && !sender.tab.url) {
    console.warn('[GTM Live Security] Blocked message: No sender URL');
    return false;
  }

  // Extension ID must match our extension
  if (sender.id !== chrome.runtime.id) {
    console.warn('[GTM Live Security] Blocked message: Invalid extension ID');
    return false;
  }

  return true;
}

/**
 * Check if origin is an allowed dashboard origin
 * SECURITY: Strict origin matching, no subdomain wildcards
 */
function isAllowedDashboardOrigin(url) {
  if (!url) return false;
  try {
    const urlObj = new URL(url);
    const origin = urlObj.origin;
    return SECURITY.ALLOWED_DASHBOARD_ORIGINS.includes(origin);
  } catch {
    return false;
  }
}

// PERFORMANCE: Debounce storage writes
let storageWriteTimeout = null;
let pendingStorageData = null;

// Security: Validate message type
function isValidMessageType(type) {
  return SECURITY.VALID_MESSAGE_TYPES.includes(type);
}

// Security: Sanitize string
function sanitizeString(value, maxLength = SECURITY.MAX_STRING_LENGTH) {
  if (typeof value !== 'string') return String(value || '').substring(0, maxLength);
  return value.substring(0, maxLength);
}

// Security: Sanitize object (deep clone with validation)
// SECURITY: Deep sanitization with prototype pollution prevention
function sanitizeData(data, depth = 0) {
  if (depth > SECURITY.MAX_OBJECT_DEPTH) return '[MAX_DEPTH]';
  if (data === null || data === undefined) return null;
  if (typeof data === 'string') return sanitizeString(data);
  if (typeof data === 'number') return isFinite(data) ? data : null;
  if (typeof data === 'boolean') return data;
  if (Array.isArray(data)) {
    return data.slice(0, 1000).map(item => sanitizeData(item, depth + 1));
  }
  if (typeof data === 'object') {
    const result = {};
    for (const key of Object.keys(data).slice(0, 100)) {
      // SECURITY: Block prototype pollution keys
      if (SECURITY.BLOCKED_KEYS.includes(key)) continue;
      const safeKey = sanitizeString(key, 100);
      if (!safeKey) continue;
      result[safeKey] = sanitizeData(data[key], depth + 1);
    }
    return result;
  }
  return null;
}

// Security: Validate captured data structure
function validateCapturedData(data) {
  if (!data || typeof data !== 'object') return false;
  if (data.networkRequests && data.networkRequests.length > SECURITY.MAX_REQUESTS) return false;
  if (data.dataLayerEvents && data.dataLayerEvents.length > SECURITY.MAX_EVENTS) return false;
  return true;
}

// Security: Check storage quota
async function checkStorageQuota() {
  try {
    const bytesInUse = await chrome.storage.local.getBytesInUse();
    const maxBytes = SECURITY.MAX_STORAGE_SIZE_MB * 1024 * 1024;
    return bytesInUse < maxBytes;
  } catch {
    return true; // Allow if check fails
  }
}

// Storage helper functions with security
async function saveCapturedData(data) {
  try {
    // SECURITY: Validate data before saving
    if (!validateCapturedData(data)) {
      console.warn('[GTM Live Security] Invalid data structure, not saving');
      return false;
    }

    // SECURITY: Check storage quota
    if (!await checkStorageQuota()) {
      console.warn('[GTM Live Security] Storage quota exceeded');
      return false;
    }

    // SECURITY: Sanitize data before storage
    const sanitizedData = sanitizeData(data);

    await chrome.storage.local.set({
      [STORAGE_KEYS.CAPTURED_DATA]: {
        ...sanitizedData,
        capturedAt: new Date().toISOString(),
      }
    });
    return true;
  } catch (error) {
    console.error('GTM Container Analyzer - Tag+Pixel Debugger Error saving captured data:', error);
    return false;
  }
}

async function getCapturedData() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.CAPTURED_DATA);
    const data = result[STORAGE_KEYS.CAPTURED_DATA] || null;

    // SECURITY: Validate retrieved data
    if (data && !validateCapturedData(data)) {
      console.warn('[GTM Live Security] Retrieved invalid data, clearing');
      await chrome.storage.local.remove(STORAGE_KEYS.CAPTURED_DATA);
      return null;
    }

    return data;
  } catch (error) {
    console.error('GTM Container Analyzer - Tag+Pixel Debugger Error getting captured data:', error);
    return null;
  }
}

async function addToHistory(capture) {
  try {
    // SECURITY: Check storage quota
    if (!await checkStorageQuota()) {
      console.warn('[GTM Live Security] Storage quota exceeded for history');
      return false;
    }

    const result = await chrome.storage.local.get(STORAGE_KEYS.CAPTURE_HISTORY);
    const history = result[STORAGE_KEYS.CAPTURE_HISTORY] || [];

    // SECURITY: Sanitize capture before adding
    const sanitizedCapture = sanitizeData(capture);

    history.unshift({
      ...sanitizedCapture,
      id: Date.now().toString(),
      savedAt: new Date().toISOString(),
    });

    // SECURITY: Limit history size
    while (history.length > SECURITY.MAX_HISTORY_ITEMS) {
      history.pop();
    }

    await chrome.storage.local.set({ [STORAGE_KEYS.CAPTURE_HISTORY]: history });
    return true;
  } catch (error) {
    console.error('GTM Container Analyzer - Tag+Pixel Debugger Error adding to history:', error);
    return false;
  }
}

// Store active tab captures (survives service worker suspension via chrome.storage.session or falls back to local)
const sessionStore = chrome.storage.session || chrome.storage.local;

async function getSessionCapture(tabId) {
  if (!tabId) return null;
  try {
    const key = `tab_capture_${tabId}`;
    const result = await sessionStore.get(key);
    return result[key] || null;
  } catch (error) {
    console.error('[GTM Live Session] Error reading session capture:', error);
    return null;
  }
}

async function setSessionCapture(tabId, data) {
  if (!tabId) return;
  try {
    const key = `tab_capture_${tabId}`;
    await sessionStore.set({ [key]: data });
  } catch (error) {
    console.error('[GTM Live Session] Error writing session capture:', error);
  }
}

async function deleteSessionCapture(tabId) {
  if (!tabId) return;
  try {
    const key = `tab_capture_${tabId}`;
    await sessionStore.remove(key);
  } catch (error) {
    console.error('[GTM Live Session] Error deleting session capture:', error);
  }
}

// ============================================
// TAB SESSION STORAGE FUNCTIONS
// ============================================

/**
 * Save tab session data to storage (for tab isolation mode)
 * @param {number} tabId - Tab ID
 * @param {Object} data - Session data
 */
async function saveTabSessionData(tabId, data) {
  try {
    if (!tabId || !data) return false;

    // SECURITY: Validate and sanitize data
    if (!validateCapturedData(data)) {
      console.warn('[GTM Live Security] Invalid tab session data, not saving');
      return false;
    }

    const sanitizedData = sanitizeData(data);

    // Enforce limits
    if (sanitizedData.networkRequests) {
      sanitizedData.networkRequests = sanitizedData.networkRequests.slice(
        -TAB_SESSION_LIMITS.MAX_REQUESTS_PER_TAB
      );
    }
    if (sanitizedData.dataLayerEvents) {
      sanitizedData.dataLayerEvents = sanitizedData.dataLayerEvents.slice(
        -TAB_SESSION_LIMITS.MAX_EVENTS_PER_TAB
      );
    }

    // Get existing sessions
    const result = await chrome.storage.local.get(STORAGE_KEYS.TAB_SESSIONS);
    const sessions = result[STORAGE_KEYS.TAB_SESSIONS] || {};

    // Add/update this tab's session
    sessions[tabId] = {
      ...sanitizedData,
      tabId: tabId,
      lastUpdated: new Date().toISOString(),
    };

    // Cleanup old sessions
    await cleanupOldTabSessions(sessions);

    // Save
    await chrome.storage.local.set({
      [STORAGE_KEYS.TAB_SESSIONS]: sessions
    });

    return true;
  } catch (error) {
    console.error('[GTM Live] Error saving tab session:', error);
    return false;
  }
}

/**
 * Get tab session data
 * @param {number} tabId - Tab ID
 */
async function getTabSessionData(tabId) {
  try {
    if (!tabId) return null;

    // First check in-memory cache
    const cachedData = await getSessionCapture(tabId);
    if (cachedData) {
      return cachedData;
    }

    // Then check storage
    const result = await chrome.storage.local.get(STORAGE_KEYS.TAB_SESSIONS);
    const sessions = result[STORAGE_KEYS.TAB_SESSIONS] || {};

    return sessions[tabId] || null;
  } catch (error) {
    console.error('[GTM Live] Error getting tab session:', error);
    return null;
  }
}

/**
 * Clear tab session data
 * @param {number} tabId - Tab ID
 */
async function clearTabSessionData(tabId) {
  try {
    if (!tabId) return false;

    // Clear from memory
    await deleteSessionCapture(tabId);

    // Clear from storage
    const result = await chrome.storage.local.get(STORAGE_KEYS.TAB_SESSIONS);
    const sessions = result[STORAGE_KEYS.TAB_SESSIONS] || {};

    if (sessions[tabId]) {
      delete sessions[tabId];
      await chrome.storage.local.set({
        [STORAGE_KEYS.TAB_SESSIONS]: sessions
      });
    }

    return true;
  } catch (error) {
    console.error('[GTM Live] Error clearing tab session:', error);
    return false;
  }
}

/**
 * Cleanup old tab sessions to prevent storage bloat
 * @param {Object} sessions - Current sessions object
 */
async function cleanupOldTabSessions(sessions) {
  const now = Date.now();
  const expiryMs = TAB_SESSION_LIMITS.SESSION_EXPIRY_HOURS * 60 * 60 * 1000;

  const tabIds = Object.keys(sessions);

  // Remove expired sessions
  for (const tabId of tabIds) {
    const session = sessions[tabId];
    if (session.lastUpdated) {
      const sessionAge = now - new Date(session.lastUpdated).getTime();
      if (sessionAge > expiryMs) {
        delete sessions[tabId];
        console.log(`[GTM Live] Cleaned up expired session for tab ${tabId}`);
      }
    }
  }

  // If still too many sessions, remove oldest
  const remainingTabIds = Object.keys(sessions);
  if (remainingTabIds.length > TAB_SESSION_LIMITS.MAX_TOTAL_SESSIONS) {
    // Sort by lastUpdated (oldest first)
    const sorted = remainingTabIds.sort((a, b) => {
      const aTime = new Date(sessions[a].lastUpdated || 0).getTime();
      const bTime = new Date(sessions[b].lastUpdated || 0).getTime();
      return aTime - bTime;
    });

    // Remove oldest sessions
    const toRemove = sorted.slice(0, remainingTabIds.length - TAB_SESSION_LIMITS.MAX_TOTAL_SESSIONS);
    for (const tabId of toRemove) {
      delete sessions[tabId];
      console.log(`[GTM Live] Removed oldest session for tab ${tabId}`);
    }
  }
}

/**
 * Check if tab isolation mode is enabled
 */
async function isTabIsolationEnabled() {
  try {
    const result = await chrome.storage.sync.get(STORAGE_KEYS.TAB_ISOLATED_MODE);
    return result[STORAGE_KEYS.TAB_ISOLATED_MODE] || false;
  } catch {
    return false;
  }
}

/**
 * Handle messages from content scripts and popup
 * SECURITY: All messages are validated before processing
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // SECURITY: Validate sender before processing
  if (!isValidSender(sender)) {
    sendResponse({ error: 'Unauthorized sender', code: 'AUTH_FAILED' });
    return true;
  }

  handleMessage(message, sender, sendResponse);
  return true; // Keep channel open for async responses
});

async function handleMessage(message, sender, sendResponse) {
  const { type, payload } = message;

  // SECURITY: Validate message type
  if (!isValidMessageType(type)) {
    console.warn('[GTM Live Security] Blocked invalid message type:', type);
    sendResponse({ error: 'Invalid message type', code: 'INVALID_TYPE' });
    return;
  }

  switch (type) {
    case 'CONTENT_SCRIPT_READY':
      // Content script initialized on a tab
      if (sender.tab?.id) {
        await setSessionCapture(sender.tab.id, {
          url: payload.url,
          startedAt: new Date().toISOString(),
        });
      }
      sendResponse({ success: true });
      break;

    case 'CAPTURE_UPDATE':
      // Content script sending capture update
      // PERFORMANCE: Use debounced storage writes
      if (sender.tab?.id && payload) {
        const tabId = sender.tab.id;
        await setSessionCapture(tabId, payload);

        // Debounce storage writes to prevent I/O spam
        pendingStorageData = { tabId, data: payload };

        if (!storageWriteTimeout) {
          storageWriteTimeout = setTimeout(async () => {
            storageWriteTimeout = null;
            if (pendingStorageData) {
              const { tabId: saveTabId, data: dataToSave } = pendingStorageData;
              pendingStorageData = null;

              try {
                // Check if tab isolation mode is enabled
                const tabIsolated = await isTabIsolationEnabled();

                if (tabIsolated) {
                  // Save to tab-specific session
                  await saveTabSessionData(saveTabId, dataToSave);

                  // Update tab-specific dashboard data for real-time updates
                  await chrome.storage.local.set({
                    [`gtm_live_dashboard_tab_${saveTabId}`]: dataToSave
                  });
                } else {
                  // Save to global storage (original behavior)
                  await saveCapturedData(dataToSave);

                  // Update global dashboard data for real-time updates
                  await chrome.storage.local.set({
                    [STORAGE_KEYS.DASHBOARD_DATA]: dataToSave
                  });
                }
              } catch (e) {
                // Silent fail - don't break on storage errors
              }
            }
          }, SECURITY.STORAGE_DEBOUNCE_MS);
        }
      }
      sendResponse({ success: true });
      break;

    case 'GET_ACTIVE_TAB_DATA':
      // Popup requesting current tab data
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          // Request data from content script
          const data = await chrome.tabs.sendMessage(tab.id, { type: 'GET_CAPTURED_DATA' });
          sendResponse(data);
        } else {
          sendResponse(null);
        }
      } catch (error) {
        // Content script might not be loaded
        sendResponse(null);
      }
      break;

    case 'CLEAR_ACTIVE_TAB_DATA':
      // Clear data for active tab
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          await chrome.tabs.sendMessage(tab.id, { type: 'CLEAR_CAPTURED_DATA' });
          await deleteSessionCapture(tab.id);
        }
        sendResponse({ success: true });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
      break;

    case 'SAVE_TO_HISTORY':
      // Save current capture to history
      if (payload) {
        await addToHistory(payload);
        sendResponse({ success: true });
      }
      break;

    // ============================================
    // TAB ISOLATION MESSAGE HANDLERS
    // ============================================

    case 'TAB_ISOLATION_MODE_CHANGED':
      // Mode changed - log for debugging
      const modeEnabled = payload?.enabled;
      const sourceTabId = payload?.sourceTabId;
      const shouldRefreshDashboards = payload?.refreshDashboards;

      console.log(`[GTM Live] Tab isolation mode: ${modeEnabled ? 'enabled' : 'disabled'}`);

      // Auto-refresh any open dashboard tabs
      if (shouldRefreshDashboards) {
        (async () => {
          try {
            // Find all dashboard tabs (both localhost and production)
            const dashboardPatterns = [
              'http://localhost:5173/live*',
              'https://gtmcontaineranalyzer.com/live*'
            ];

            for (const pattern of dashboardPatterns) {
              const dashboardTabs = await chrome.tabs.query({ url: pattern });

              for (const tab of dashboardTabs) {
                // Build new URL based on mode
                const url = new URL(tab.url);

                if (modeEnabled && sourceTabId) {
                  // Tab isolation ON - add tabId parameter
                  url.searchParams.set('tabId', sourceTabId);
                } else {
                  // Tab isolation OFF - remove tabId parameter
                  url.searchParams.delete('tabId');
                }

                // Reload the tab with new URL
                await chrome.tabs.update(tab.id, { url: url.toString() });
                console.log(`[GTM Live] Refreshed dashboard tab ${tab.id} with URL: ${url.toString()}`);
              }
            }
          } catch (e) {
            console.error('[GTM Live] Error refreshing dashboard tabs:', e);
          }
        })();
      }

      sendResponse({ success: true });
      break;

    case 'GET_TAB_SESSION_DATA':
      // Get tab-specific session data
      try {
        let tabId = message.tabId;
        if (!tabId) {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          tabId = tab?.id;
        }

        if (tabId) {
          // First try to get from content script (most up-to-date)
          try {
            const data = await chrome.tabs.sendMessage(tabId, { type: 'GET_CAPTURED_DATA' });
            if (data) {
              sendResponse(data);
              break;
            }
          } catch (e) {
            // Content script not available, fall back to storage
          }

          // Fall back to stored session
          const sessionData = await getTabSessionData(tabId);
          sendResponse(sessionData);
        } else {
          sendResponse(null);
        }
      } catch (error) {
        console.error('[GTM Live] Error getting tab session data:', error);
        sendResponse(null);
      }
      break;

    case 'CLEAR_TAB_SESSION_DATA':
      // Clear tab-specific session data
      try {
        let tabId = message.tabId;
        if (!tabId) {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          tabId = tab?.id;
        }

        if (tabId) {
          // Clear from content script
          try {
            await chrome.tabs.sendMessage(tabId, { type: 'CLEAR_CAPTURED_DATA' });
          } catch (e) {
            // Content script not available
          }

          // Clear from storage
          await clearTabSessionData(tabId);
        }

        sendResponse({ success: true });
      } catch (error) {
        console.error('[GTM Live] Error clearing tab session data:', error);
        sendResponse({ success: false, error: error.message });
      }
      break;

    case 'SAVE_TAB_SESSION_DATA':
      // Save tab-specific session data
      try {
        const tabId = message.tabId || sender.tab?.id;
        if (tabId && payload) {
          await saveTabSessionData(tabId, payload);
        }
        sendResponse({ success: true });
      } catch (error) {
        console.error('[GTM Live] Error saving tab session data:', error);
        sendResponse({ success: false, error: error.message });
      }
      break;

    case 'OPEN_DASHBOARD':
      // Open dashboard with captured data
      try {
        // Get captured data from active tab's content script
        let capturedData = null;
        const requestedTabId = payload?.tabId;

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const sourceTabId = requestedTabId || tab?.id;

        if (sourceTabId) {
          try {
            capturedData = await chrome.tabs.sendMessage(sourceTabId, { type: 'GET_CAPTURED_DATA' });
          } catch (e) {
            // Fallback to stored data
            if (requestedTabId) {
              // Try tab-specific session first
              capturedData = await getTabSessionData(requestedTabId);
            }
            if (!capturedData) {
              capturedData = await getCapturedData();
            }
          }
        }

        // Also check tabCaptures map
        if (!capturedData && sourceTabId) {
          capturedData = await getSessionCapture(sourceTabId);
        }

        // Save data for dashboard to read (with tab ID for isolation)
        if (capturedData) {
          console.log('GTM Container Analyzer - Tag+Pixel Debugger Saving data for dashboard:', capturedData.url, 'TabId:', sourceTabId);

          // If tab isolated, save to tab-specific key
          if (requestedTabId) {
            await chrome.storage.local.set({
              [`gtm_live_dashboard_tab_${requestedTabId}`]: capturedData
            });
          } else {
            await chrome.storage.local.set({
              [STORAGE_KEYS.DASHBOARD_DATA]: capturedData
            });
          }
        } else {
          console.log('GTM Container Analyzer - Tag+Pixel Debugger No data to save');
        }

        // Open dashboard - URL from config, with tabId if isolated
        let dashboardUrl = payload?.url || DASHBOARD_LIVE_URL;
        if (requestedTabId) {
          dashboardUrl += `?tabId=${requestedTabId}`;
        }
        await chrome.tabs.create({ url: dashboardUrl });

        sendResponse({ success: true });
      } catch (error) {
        console.error('GTM Container Analyzer - Tag+Pixel Debugger Error opening dashboard:', error);
        sendResponse({ success: false, error: error.message });
      }
      break;

    default:
      sendResponse({ error: 'Unknown message type' });
  }
}

/**
 * Handle tab removal - cleanup
 */
chrome.tabs.onRemoved.addListener(async (tabId) => {
  // Clear from memory
  await deleteSessionCapture(tabId);

  // Clear tab session from storage (automatic cleanup)
  try {
    await clearTabSessionData(tabId);
    console.log(`[GTM Live] Cleaned up session for closed tab ${tabId}`);
  } catch (e) {
    // Silent fail
  }
});

/**
 * Handle tab update - reset capture on navigation
 */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && changeInfo.url) {
    // Page is navigating, content script will reinitialize
    await deleteSessionCapture(tabId);
  }
});

/**
 * Set badge text to show capture status
 */
async function updateBadge(tabId, data) {
  if (!data) {
    await chrome.action.setBadgeText({ text: '', tabId });
    return;
  }

  const tagCount = data.networkRequests?.length || 0;
  const eventCount = data.dataLayerEvents?.length || 0;
  const total = tagCount + eventCount;

  if (total > 0) {
    await chrome.action.setBadgeText({
      text: total > 99 ? '99+' : total.toString(),
      tabId
    });
    await chrome.action.setBadgeBackgroundColor({
      color: '#38bdf8', // Cyan color matching dashboard
      tabId
    });
  } else {
    await chrome.action.setBadgeText({ text: '', tabId });
  }
}

/**
 * Extension install/update handler
 */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // First install - could open welcome page
    console.log('GTM Container Analyzer - Tag+Pixel Debugger Extension installed');
  } else if (details.reason === 'update') {
    console.log('GTM Container Analyzer - Tag+Pixel Debugger Extension updated to', chrome.runtime.getManifest().version);
  }
});

