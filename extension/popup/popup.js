/**
 * GTM Container Analyzer - Tag+Pixel Debugger | Popup Script
 * 
 * Handles popup UI interactions and data display.
 * Communicates with content script and background service worker.
 */

import { DASHBOARD_LIVE_URL, ENV, STORAGE_KEYS } from '../utils/constants.js';

// Log environment for debugging
console.log(`[GTM Live Popup] Environment: ${ENV}`);

// DOM Elements
const elements = {
  pageUrl: document.getElementById('pageUrl'),
  pagePath: document.getElementById('pagePath'),
  queryCount: document.getElementById('queryCount'),
  tagCount: document.getElementById('tagCount'),
  eventCount: document.getElementById('eventCount'),
  gtmInfo: document.getElementById('gtmInfo'),
  gtmContainerId: document.getElementById('gtmContainerId'),
  tagList: document.getElementById('tagList'),
  tagListCount: document.getElementById('tagListCount'),
  eventList: document.getElementById('eventList'),
  eventListCount: document.getElementById('eventListCount'),
  analyzeBtn: document.getElementById('analyzeBtn'),
  refreshBtn: document.getElementById('refreshBtn'),
  clearBtn: document.getElementById('clearBtn'),
  captureStatus: document.getElementById('captureStatus'),
  // Tab isolation elements
  tabIsolatedToggle: document.getElementById('tabIsolatedToggle'),
  tabIsolationHint: document.getElementById('tabIsolationHint'),
  sessionInfoRow: document.getElementById('sessionInfoRow'),
  sessionBadge: document.getElementById('sessionBadge'),
  sessionModeText: document.getElementById('sessionModeText'),
  tabSessionId: document.getElementById('tabSessionId'),
};

// State
let currentData = null;
let currentTabId = null;
let captureState = {
  isCapturing: true, // Auto-capture always on
  currentDomain: null,
  isTabIsolated: false, // Tab isolation mode
};

/**
 * SECURITY: Escape HTML to prevent XSS when inserting dynamic values via innerHTML
 */
function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Initialize popup
 */
async function init() {
  // Get current tab ID
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTabId = tab?.id;

  // Load tab isolation mode setting
  await loadTabIsolationMode();

  // Get capture status first
  await loadCaptureStatus();

  // Load captured data from active tab
  await loadCapturedData();

  // Setup event listeners
  setupEventListeners();

  // Listen for updates from content script
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'CAPTURE_UPDATE') {
      updateUI(message.payload);
    }
  });
}

/**
 * Load tab isolation mode from storage
 */
async function loadTabIsolationMode() {
  try {
    const result = await chrome.storage.sync.get(STORAGE_KEYS.TAB_ISOLATED_MODE);
    captureState.isTabIsolated = result[STORAGE_KEYS.TAB_ISOLATED_MODE] || false;
    updateTabIsolationUI();
  } catch (error) {
    console.log('[GTM Live Popup] Could not load tab isolation mode:', error.message);
  }
}

/**
 * Toggle tab isolation mode
 */
async function toggleTabIsolation(enabled) {
  try {
    captureState.isTabIsolated = enabled;
    await chrome.storage.sync.set({
      [STORAGE_KEYS.TAB_ISOLATED_MODE]: enabled
    });

    // Notify content script about mode change
    if (currentTabId) {
      await chrome.tabs.sendMessage(currentTabId, {
        type: 'SET_TAB_ISOLATED_MODE',
        enabled: enabled,
        tabId: currentTabId
      }).catch(() => { });
    }

    // Notify service worker and refresh any open dashboard tabs
    await chrome.runtime.sendMessage({
      type: 'TAB_ISOLATION_MODE_CHANGED',
      payload: {
        enabled: enabled,
        sourceTabId: currentTabId,
        refreshDashboards: true  // Auto-refresh open dashboards
      }
    }).catch(() => { });

    updateTabIsolationUI();

    // Reload data with new mode
    await loadCapturedData();
  } catch (error) {
    console.error('[GTM Live Popup] Error toggling tab isolation:', error);
  }
}

/**
 * Update UI based on tab isolation mode
 */
function updateTabIsolationUI() {
  const { isTabIsolated } = captureState;

  // Update toggle
  if (elements.tabIsolatedToggle) {
    elements.tabIsolatedToggle.checked = isTabIsolated;
  }

  // Update session mode text and badge
  if (elements.sessionModeText) {
    elements.sessionModeText.textContent = isTabIsolated
      ? 'This tab\'s session'
      : 'All tabs share data';
  }

  if (elements.sessionBadge) {
    elements.sessionBadge.classList.toggle('active', isTabIsolated);
  }

  // Show/hide tab session ID
  if (elements.tabSessionId) {
    elements.tabSessionId.style.display = isTabIsolated ? 'inline-block' : 'none';
    if (currentTabId) {
      elements.tabSessionId.textContent = `Tab #${currentTabId}`;
    }
  }

  // Update hint text
  if (elements.tabIsolationHint) {
    elements.tabIsolationHint.textContent = isTabIsolated
      ? 'Each tab has its own data'
      : 'Compare multiple tabs side-by-side';
  }

  // Update status indicator (with null check)
  if (elements.captureStatus) {
    elements.captureStatus.innerHTML = isTabIsolated
      ? `<span class="status-dot active"></span><span class="status-text">Tab Session</span>`
      : `<span class="status-dot active"></span><span class="status-text">Capturing</span>`;
  }
}

/**
 * Load capture status from active tab
 */
async function loadCaptureStatus() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    // Check if it's a valid page (not chrome://, about:, etc.)
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('about:') || tab.url.startsWith('chrome-extension://')) {
      showRefreshNeeded('Cannot capture on this page');
      return;
    }

    const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_CAPTURE_STATUS' });
    if (response) {
      captureState = {
        ...captureState,
        isCapturing: response.isCapturing,
        currentDomain: response.currentDomain,
      };
      updateCaptureUI();
    }
  } catch (error) {
    console.log('[GTM Live Popup] Could not get capture status:', error.message);
    // Content script not loaded - ask user to refresh
    showRefreshNeeded('Please refresh the page to start capturing');
  }
}

/**
 * Show refresh needed message
 */
function showRefreshNeeded(message) {
  // Update status to show refresh needed (with null check)
  if (elements.captureStatus) {
    elements.captureStatus.innerHTML = `
      <span class="status-dot warning"></span>
      <span class="status-text">Refresh needed</span>
    `;
  }

  // Update session mode text to show error
  if (elements.sessionModeText) {
    elements.sessionModeText.textContent = message;
  }
}

/**
 * Update capture control UI - Simplified (no lock domain)
 */
function updateCaptureUI() {
  // Tab isolation UI is handled by updateTabIsolationUI
  // This function now just ensures the status indicator is correct
  if (!captureState.isTabIsolated && elements.captureStatus) {
    elements.captureStatus.innerHTML = `
      <span class="status-dot active"></span>
      <span class="status-text">Capturing</span>
    `;
  }
}

/* Lock domain feature removed - Tab isolation provides better UX */

/**
 * Load captured data from active tab
 */
async function loadCapturedData() {
  try {
    // If tab isolated mode, request tab-specific data
    const messageType = captureState.isTabIsolated ? 'GET_TAB_SESSION_DATA' : 'GET_ACTIVE_TAB_DATA';
    const response = await chrome.runtime.sendMessage({
      type: messageType,
      tabId: currentTabId
    });
    if (response) {
      currentData = response;
      updateUI(response);
    } else {
      showNoDataState();
    }
  } catch (error) {
    console.error('[GTM Live Popup] Error loading data:', error);
    showNoDataState();
  }
}

/**
 * Update UI with captured data
 */
function updateUI(data) {
  if (!data) {
    showNoDataState();
    return;
  }

  currentData = data;

  // Page Info
  elements.pageUrl.textContent = truncateUrl(data.url);
  elements.pageUrl.title = data.url;
  elements.pagePath.textContent = data.pathname || '/';

  const queryParamCount = Object.keys(data.queryParams || {}).length;
  elements.queryCount.textContent = `${queryParamCount} param${queryParamCount !== 1 ? 's' : ''}`;

  // Stats
  const tagCount = countUniqueTags(data.networkRequests || []);
  const eventCount = (data.dataLayerEvents || []).length;

  elements.tagCount.textContent = tagCount;
  elements.eventCount.textContent = eventCount;

  // GTM Container ID
  if (data.gtmContainerId) {
    elements.gtmInfo.style.display = 'block';
    elements.gtmContainerId.textContent = data.gtmContainerId;
  } else {
    elements.gtmInfo.style.display = 'none';
  }

  // Tag List
  renderTagList(data.networkRequests || []);

  // Event List
  renderEventList(data.dataLayerEvents || []);
}

/**
 * Count unique tags from network requests
 */
function countUniqueTags(requests) {
  const tagTypes = new Set();
  requests.forEach(req => {
    if (req.tag?.type) {
      tagTypes.add(req.tag.type);
    }
  });
  return tagTypes.size;
}

/**
 * Render tag list
 */
function renderTagList(requests) {
  // Group by tag type
  const tagGroups = {};
  requests.forEach(req => {
    if (req.tag) {
      const type = req.tag.type;
      if (!tagGroups[type]) {
        tagGroups[type] = {
          name: req.tag.name,
          icon: req.tag.icon,
          count: 0,
        };
      }
      tagGroups[type].count++;
    }
  });

  const tagTypes = Object.entries(tagGroups);
  elements.tagListCount.textContent = tagTypes.length;

  if (tagTypes.length === 0) {
    elements.tagList.innerHTML = `
      <div class="empty-state">
        <p>No tags detected yet</p>
        <span class="empty-hint">Browse a page to capture tag fires</span>
      </div>
    `;
    return;
  }

  elements.tagList.innerHTML = tagTypes.map(([type, info]) => `
    <div class="tag-item">
      <div class="tag-icon ${escapeHTML(info.icon)}">${escapeHTML(getTagIconText(info.icon))}</div>
      <div class="tag-info">
        <div class="tag-name">${escapeHTML(info.name)}</div>
        <div class="tag-count">${info.count} request${info.count !== 1 ? 's' : ''}</div>
      </div>
    </div>
  `).join('');
}

/**
 * Get tag icon text abbreviation
 */
function getTagIconText(icon) {
  const iconMap = {
    'ga4': 'GA4',
    'meta': 'META',
    'tiktok': 'TT',
    'google-ads': 'ADS',
    'gtm': 'GTM',
    'snapchat': 'SC',
    'linkedin': 'LI',
    'twitter': 'X',
    'pinterest': 'PIN',
    'microsoft': 'MS',
    'hotjar': 'HJ',
    'clarity': 'CL',
  };
  return iconMap[icon] || icon?.toUpperCase().slice(0, 3) || '?';
}

/**
 * Render event list
 */
function renderEventList(events) {
  // Get last 5 events
  const recentEvents = events.slice(-5).reverse();
  elements.eventListCount.textContent = events.length;

  if (recentEvents.length === 0) {
    elements.eventList.innerHTML = `
      <div class="empty-state">
        <p>No events captured</p>
      </div>
    `;
    return;
  }

  elements.eventList.innerHTML = recentEvents.map(evt => `
    <div class="event-item">
      <span class="event-badge">${escapeHTML(evt.event || 'data_push')}</span>
      <span class="event-category">${escapeHTML(evt.category || 'Custom')}</span>
    </div>
  `).join('');
}

/**
 * Show no data state
 */
function showNoDataState() {
  elements.pageUrl.textContent = 'No page captured';
  elements.pagePath.textContent = '-';
  elements.queryCount.textContent = '0 params';
  elements.tagCount.textContent = '0';
  elements.eventCount.textContent = '0';
  elements.gtmInfo.style.display = 'none';
  elements.tagListCount.textContent = '0';
  elements.eventListCount.textContent = '0';

  elements.tagList.innerHTML = `
    <div class="empty-state">
      <p>No tags detected yet</p>
      <span class="empty-hint">Browse a page to capture tag fires</span>
    </div>
  `;

  elements.eventList.innerHTML = `
    <div class="empty-state">
      <p>No events captured</p>
    </div>
  `;
}

/**
 * Truncate URL for display
 */
function truncateUrl(url) {
  if (!url) return '';
  try {
    const urlObj = new URL(url);
    const display = urlObj.hostname + urlObj.pathname;
    return display.length > 45 ? display.slice(0, 42) + '...' : display;
  } catch {
    return url.slice(0, 45);
  }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Tab Isolation Toggle
  if (elements.tabIsolatedToggle) {
    elements.tabIsolatedToggle.addEventListener('change', async (e) => {
      await toggleTabIsolation(e.target.checked);
    });
  }

  // Analyze in Dashboard
  elements.analyzeBtn.addEventListener('click', async () => {
    if (!currentData) {
      alert('No data to analyze. Please browse a page first.');
      return;
    }

    // Save current data and open dashboard
    await chrome.runtime.sendMessage({
      type: 'OPEN_DASHBOARD',
      payload: {
        url: DASHBOARD_LIVE_URL,
        tabId: captureState.isTabIsolated ? currentTabId : null
      }
    });
  });

  // Refresh
  elements.refreshBtn.addEventListener('click', async () => {
    await loadCaptureStatus();
    await loadCapturedData();
  });

  // Clear
  elements.clearBtn.addEventListener('click', async () => {
    const messageType = captureState.isTabIsolated ? 'CLEAR_TAB_SESSION_DATA' : 'CLEAR_ACTIVE_TAB_DATA';
    await chrome.runtime.sendMessage({
      type: messageType,
      tabId: currentTabId
    });
    showNoDataState();
    currentData = null;
  });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);

