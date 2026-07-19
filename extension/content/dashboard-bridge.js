/**
 * GTM Container Analyzer - Tag+Pixel Debugger | Dashboard Bridge
 * 
 * This content script runs on the dashboard page (localhost:5173 or gtmcontaineranalyzer.com)
 * It bridges data from chrome.storage.local to the webpage via postMessage.
 * 
 * PRIVACY: Data only flows from extension storage to the local dashboard page.
 * SECURITY: All data is validated and only trusted origins are accepted.
 */

(function () {
  'use strict';

  // ============================================
  // SECURITY CONSTANTS
  // ============================================
  // SECURITY: Object.freeze prevents runtime tampering
  const SECURITY = Object.freeze({
    EXTENSION_SOURCE: 'gtm-live-analyzer-extension',
    DASHBOARD_SOURCE: 'gtm-live-dashboard',
    VALID_REQUEST_TYPES: Object.freeze(['GTM_LIVE_REQUEST_DATA', 'GTM_LIVE_CLEAR_DATA']),
    // SECURITY: Strict origin matching - NO wildcards, NO subdomains
    ALLOWED_ORIGINS: Object.freeze([
      'http://localhost:5173',
      'https://gtmcontaineranalyzer.com',
      'https://www.gtmcontaineranalyzer.com',
      'https://gtm-container-analyzer-mcp.onrender.com'
    ]),
    // SECURITY: Block any origin containing these suspicious patterns
    BLOCKED_PATTERNS: Object.freeze([
      'javascript:',
      'data:',
      'blob:',
      'file:',
      '.gtmcontaineranalyzer.com.', // subdomain spoofing attempt
      'gtmcontaineranalyzer.com.evil', // domain spoofing
    ])
  });

  /**
   * Check if extension context is still valid
   * Returns false if extension was reloaded/unloaded
   */
  function isExtensionValid() {
    try {
      // Check if chrome.runtime is still connected
      return !!(chrome && chrome.runtime && chrome.runtime.id);
    } catch (e) {
      return false;
    }
  }

  // Security: Check if origin is allowed
  // SECURITY: Strict exact match only - no partial matches or wildcards
  function isAllowedOrigin() {
    const origin = window.location.origin;
    const href = window.location.href.toLowerCase();

    // SECURITY: Check for blocked patterns first
    for (const blocked of SECURITY.BLOCKED_PATTERNS) {
      if (href.includes(blocked)) {
        console.warn('[GTM Live Bridge] Security: Blocked suspicious pattern:', blocked);
        return false;
      }
    }

    // SECURITY: Strict exact origin match only
    return SECURITY.ALLOWED_ORIGINS.includes(origin);
  }

  // SECURITY: Additional URL validation
  function isSecureContext() {
    // Only allow secure contexts (HTTPS) except for localhost
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return true;
    }
    return window.isSecureContext === true;
  }

  // Security: Validate request type
  function isValidRequestType(type) {
    return SECURITY.VALID_REQUEST_TYPES.includes(type);
  }

  // Security: Sanitize data before sending
  function sanitizeData(data, depth = 0) {
    if (depth > 5) return null;
    if (data === null || data === undefined) return null;
    if (typeof data === 'string') return data.substring(0, 10000);
    if (typeof data === 'number') return isFinite(data) ? data : null;
    if (typeof data === 'boolean') return data;
    if (Array.isArray(data)) {
      return data.slice(0, 1000).map(item => sanitizeData(item, depth + 1));
    }
    if (typeof data === 'object') {
      const result = {};
      for (const key of Object.keys(data).slice(0, 100)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
        result[key] = sanitizeData(data[key], depth + 1);
      }
      return result;
    }
    return null;
  }

  // SECURITY: Verify we're on an allowed origin AND secure context
  if (!isAllowedOrigin()) {
    console.warn('[GTM Live Bridge] Security: Blocked on unauthorized origin:', window.location.origin);
    return;
  }

  if (!isSecureContext()) {
    console.warn('[GTM Live Bridge] Security: Blocked on insecure context');
    return;
  }

  const STORAGE_KEY = 'gtm_live_dashboard_data';

  /**
   * Get tabId from URL query parameter (for tab-isolated mode)
   */
  function getTabIdFromUrl() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const tabId = urlParams.get('tabId');
      return tabId ? parseInt(tabId, 10) : null;
    } catch {
      return null;
    }
  }

  /**
   * Get the appropriate storage key based on tabId
   */
  function getStorageKey() {
    const tabId = getTabIdFromUrl();
    if (tabId) {
      return `gtm_live_dashboard_tab_${tabId}`;
    }
    return STORAGE_KEY;
  }

  /**
   * Send captured data to the page
   * SECURITY: Data is sanitized before sending
   */
  async function sendDataToPage() {
    // Check if extension is still valid (not reloaded)
    if (!isExtensionValid()) {
      console.log('[GTM Live Bridge] Extension reloaded - refresh page to reconnect');
      window.postMessage({
        type: 'GTM_LIVE_EXTENSION_DISCONNECTED',
        source: SECURITY.EXTENSION_SOURCE
      }, window.location.origin);
      return;
    }

    try {
      const storageKey = getStorageKey();
      const tabId = getTabIdFromUrl();

      const result = await chrome.storage.local.get(storageKey);
      const data = result[storageKey] || null;

      // SECURITY: Sanitize data before sending to page
      const sanitizedData = data ? sanitizeData(data) : null;

      // Send data to page via postMessage (only to same origin)
      window.postMessage({
        type: 'GTM_LIVE_DATA_FROM_EXTENSION',
        payload: sanitizedData,
        tabId: tabId,  // Include tabId so dashboard knows it's tab-specific
        source: SECURITY.EXTENSION_SOURCE
      }, window.location.origin); // SECURITY: Restrict to same origin

      console.log('[GTM Live Bridge] Sent data to dashboard:', sanitizedData ? 'Data found' : 'No data', tabId ? `(Tab #${tabId})` : '(Global)');
    } catch (error) {
      // Handle extension context invalidated gracefully
      if (error.message && error.message.includes('Extension context invalidated')) {
        console.log('[GTM Live Bridge] Extension reloaded - refresh page to reconnect');
        window.postMessage({
          type: 'GTM_LIVE_EXTENSION_DISCONNECTED',
          source: SECURITY.EXTENSION_SOURCE
        }, window.location.origin);
        return;
      }

      console.error('[GTM Live Bridge] Error reading storage:', error.message || error);
      window.postMessage({
        type: 'GTM_LIVE_DATA_FROM_EXTENSION',
        payload: null,
        error: 'Storage read error', // SECURITY: Don't expose detailed error
        source: SECURITY.EXTENSION_SOURCE
      }, window.location.origin);
    }
  }

  /**
   * Listen for requests from the page
   * SECURITY: Validates source, origin, and request type
   */
  window.addEventListener('message', async (event) => {
    // SECURITY: Verify data is an object first
    if (!event.data || typeof event.data !== 'object') return;

    const { type, source } = event.data;

    // SECURITY: Only process messages from our expected source (dashboard)
    // Silently ignore messages from other sources (other extensions, etc.)
    if (source !== SECURITY.DASHBOARD_SOURCE) return;

    // SECURITY: For messages from our dashboard, require same origin
    // Allow chrome-extension:// origins from our extension (same isolated world)
    const isPageOrigin = event.origin === window.location.origin;
    const isExtensionOrigin = event.origin === `chrome-extension://${chrome.runtime.id}`;

    if (!isPageOrigin && !isExtensionOrigin) {
      console.warn('[GTM Live Bridge] Security: Blocked message from unknown origin:', event.origin);
      return;
    }

    // SECURITY: Only accept messages from same window (not iframes)
    if (event.source !== window) {
      console.warn('[GTM Live Bridge] Security: Blocked message from different window/frame');
      return;
    }

    // SECURITY: Validate request type (whitelist only)
    if (!isValidRequestType(type)) {
      console.warn('[GTM Live Bridge] Security: Blocked invalid request type:', type);
      return;
    }

    // SECURITY: Double-check origin hasn't changed (race condition protection)
    if (!isAllowedOrigin()) {
      console.warn('[GTM Live Bridge] Security: Origin changed mid-request');
      return;
    }

    if (type === 'GTM_LIVE_REQUEST_DATA') {
      await sendDataToPage();
    } else if (type === 'GTM_LIVE_CLEAR_DATA') {
      // Check if extension is still valid
      if (!isExtensionValid()) {
        console.log('[GTM Live Bridge] Extension reloaded - refresh page to reconnect');
        window.postMessage({
          type: 'GTM_LIVE_EXTENSION_DISCONNECTED',
          source: SECURITY.EXTENSION_SOURCE
        }, window.location.origin);
        return;
      }

      try {
        await chrome.storage.local.remove(STORAGE_KEY);
        window.postMessage({
          type: 'GTM_LIVE_DATA_CLEARED',
          source: SECURITY.EXTENSION_SOURCE
        }, window.location.origin);
      } catch (error) {
        // Handle extension context invalidated gracefully
        if (error.message && error.message.includes('Extension context invalidated')) {
          console.log('[GTM Live Bridge] Extension reloaded - refresh page to reconnect');
          window.postMessage({
            type: 'GTM_LIVE_EXTENSION_DISCONNECTED',
            source: SECURITY.EXTENSION_SOURCE
          }, window.location.origin);
        } else {
          console.warn('[GTM Live Bridge] Error clearing data:', error.message || error);
        }
      }
    }
  });

  /**
   * Notify page that extension is available
   * SECURITY: Only sends to same origin
   */
  function notifyExtensionReady() {
    window.postMessage({
      type: 'GTM_LIVE_EXTENSION_READY',
      source: SECURITY.EXTENSION_SOURCE
    }, window.location.origin); // SECURITY: Restrict to same origin
  }

  /**
   * Listen for storage changes and notify page
   * SECURITY: Data is sanitized and only sent to same origin
   */
  try {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      // Check if extension is still valid
      if (!isExtensionValid()) return;

      if (areaName !== 'local') return;

      // Get the appropriate storage key for this dashboard instance
      const storageKey = getStorageKey();
      const tabId = getTabIdFromUrl();

      // Check if the change is for our storage key (global or tab-specific)
      if (changes[storageKey]) {
        // SECURITY: Sanitize data before sending
        const sanitizedData = changes[storageKey].newValue
          ? sanitizeData(changes[storageKey].newValue)
          : null;

        window.postMessage({
          type: 'GTM_LIVE_DATA_UPDATED',
          payload: sanitizedData,
          tabId: tabId,
          source: SECURITY.EXTENSION_SOURCE
        }, window.location.origin); // SECURITY: Restrict to same origin

        console.log('[GTM Live Bridge] Storage updated:', tabId ? `Tab #${tabId}` : 'Global');
      }
    });
  } catch (e) {
    // Extension might be invalidated during setup
    console.log('[GTM Live Bridge] Could not add storage listener');
  }

  // Initialize - notify page and send initial data
  notifyExtensionReady();

  // Also send data on page load (after small delay to ensure page is ready)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(sendDataToPage, 100);
    });
  } else {
    setTimeout(sendDataToPage, 100);
  }

  console.log('[GTM Live Bridge] Security: Initialized on allowed origin');

})();

