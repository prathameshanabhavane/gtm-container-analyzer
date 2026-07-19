/**
 * GTM Container Analyzer - Tag+Pixel Debugger | Storage Utilities
 * 
 * Handles all chrome.storage operations.
 * Provides a clean API for saving and retrieving captured data.
 */

import { STORAGE_KEYS, MAX_HISTORY_ITEMS } from './constants.js';

/**
 * Save captured data for current page
 * @param {Object} data - Captured GTM data
 */
export async function saveCapturedData(data) {
  try {
    await chrome.storage.local.set({
      [STORAGE_KEYS.CAPTURED_DATA]: {
        ...data,
        capturedAt: new Date().toISOString(),
      }
    });
    return true;
  } catch (error) {
    console.error('GTM Container Analyzer - Tag+Pixel Debugger Error saving captured data:', error);
    return false;
  }
}

/**
 * Get captured data
 * @returns {Object|null} Captured data or null
 */
export async function getCapturedData() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.CAPTURED_DATA);
    return result[STORAGE_KEYS.CAPTURED_DATA] || null;
  } catch (error) {
    console.error('GTM Container Analyzer - Tag+Pixel Debugger Error getting captured data:', error);
    return null;
  }
}

/**
 * Clear captured data
 */
export async function clearCapturedData() {
  try {
    await chrome.storage.local.remove(STORAGE_KEYS.CAPTURED_DATA);
    return true;
  } catch (error) {
    console.error('GTM Container Analyzer - Tag+Pixel Debugger Error clearing captured data:', error);
    return false;
  }
}

/**
 * Add to capture history
 * @param {Object} capture - Capture data to add to history
 */
export async function addToHistory(capture) {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.CAPTURE_HISTORY);
    const history = result[STORAGE_KEYS.CAPTURE_HISTORY] || [];
    
    // Add new capture at the beginning
    history.unshift({
      ...capture,
      id: Date.now().toString(),
      savedAt: new Date().toISOString(),
    });
    
    // Limit history size
    if (history.length > MAX_HISTORY_ITEMS) {
      history.pop();
    }
    
    await chrome.storage.local.set({
      [STORAGE_KEYS.CAPTURE_HISTORY]: history
    });
    
    return true;
  } catch (error) {
    console.error('GTM Container Analyzer - Tag+Pixel Debugger Error adding to history:', error);
    return false;
  }
}

/**
 * Get capture history
 * @returns {Array} History array
 */
export async function getHistory() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.CAPTURE_HISTORY);
    return result[STORAGE_KEYS.CAPTURE_HISTORY] || [];
  } catch (error) {
    console.error('GTM Container Analyzer - Tag+Pixel Debugger Error getting history:', error);
    return [];
  }
}

/**
 * Clear capture history
 */
export async function clearHistory() {
  try {
    await chrome.storage.local.remove(STORAGE_KEYS.CAPTURE_HISTORY);
    return true;
  } catch (error) {
    console.error('GTM Container Analyzer - Tag+Pixel Debugger Error clearing history:', error);
    return false;
  }
}

/**
 * Get/set capture enabled state
 */
export async function isCaptureEnabled() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.CAPTURE_ENABLED);
    // Default to true if not set
    return result[STORAGE_KEYS.CAPTURE_ENABLED] !== false;
  } catch (error) {
    return true;
  }
}

export async function setCaptureEnabled(enabled) {
  try {
    await chrome.storage.local.set({
      [STORAGE_KEYS.CAPTURE_ENABLED]: enabled
    });
    return true;
  } catch (error) {
    console.error('GTM Container Analyzer - Tag+Pixel Debugger Error setting capture enabled:', error);
    return false;
  }
}

/**
 * Get/set settings
 */
export async function getSettings() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
    return result[STORAGE_KEYS.SETTINGS] || {
      captureDataLayer: true,
      captureNetworkRequests: true,
      captureGTMEvents: true,
      autoCapture: true,
    };
  } catch (error) {
    return {
      captureDataLayer: true,
      captureNetworkRequests: true,
      captureGTMEvents: true,
      autoCapture: true,
    };
  }
}

export async function saveSettings(settings) {
  try {
    await chrome.storage.local.set({
      [STORAGE_KEYS.SETTINGS]: settings
    });
    return true;
  } catch (error) {
    console.error('GTM Container Analyzer - Tag+Pixel Debugger Error saving settings:', error);
    return false;
  }
}

