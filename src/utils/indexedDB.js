import localforage from 'localforage';

// Configure localForage for GTM data storage
const gtmStore = localforage.createInstance({
  name: 'GTMContainerAnalyzer',
  storeName: 'gtm_data',
  description: 'Stores uploaded GTM container JSON data'
});

/**
 * Save GTM data to IndexedDB
 * @param {Object} data - The GTM container data to store
 * @returns {Promise<boolean>} - Success status
 */
export const saveGTMData = async (data) => {
  try {
    await gtmStore.setItem('containerData', data);
    await gtmStore.setItem('lastUpdated', new Date().toISOString());
    return true;
  } catch (error) {
    console.error('Error saving GTM data:', error);
    return false;
  }
};

/**
 * Load GTM data from IndexedDB
 * @returns {Promise<Object|null>} - The stored GTM data with savedAt timestamp or null
 */
export const loadGTMData = async () => {
  try {
    const data = await gtmStore.getItem('containerData');
    const savedAt = await gtmStore.getItem('lastUpdated');
    if (data) {
      return { data, savedAt };
    }
    return null;
  } catch (error) {
    console.error('Error loading GTM data:', error);
    return null;
  }
};

/**
 * Check if GTM data exists in storage
 * @returns {Promise<boolean>} - Whether data exists
 */
export const hasStoredData = async () => {
  try {
    const data = await gtmStore.getItem('containerData');
    return data !== null;
  } catch (error) {
    console.error('Error checking stored data:', error);
    return false;
  }
};

/**
 * Get the last update timestamp
 * @returns {Promise<string|null>} - ISO timestamp or null
 */
export const getLastUpdated = async () => {
  try {
    return await gtmStore.getItem('lastUpdated');
  } catch (error) {
    console.error('Error getting last updated:', error);
    return null;
  }
};

/**
 * Clear all stored GTM data
 * @returns {Promise<boolean>} - Success status
 */
export const clearGTMData = async () => {
  try {
    await gtmStore.clear();
    return true;
  } catch (error) {
    console.error('Error clearing GTM data:', error);
    return false;
  }
};

/**
 * Get storage driver info (for debugging)
 * @returns {string} - Current storage driver name
 */
export const getStorageDriver = () => {
  return gtmStore.driver();
};

// ─── CHAT HISTORY STORE (INDEXEDDB) ─────────────────────────────────────────

const chatStore = localforage.createInstance({
  name: 'GTMContainerAnalyzer',
  storeName: 'chat_history',
  description: 'Stores AI chat history messages with automatic daily cleanups'
});

/**
 * Save current chat history to IndexedDB
 * @param {Array} history - Array of chat messages
 * @returns {Promise<boolean>} - Success status
 */
export const saveChatHistory = async (history) => {
  try {
    await chatStore.setItem('messages', history);
    await chatStore.setItem('lastChatTime', new Date().toISOString());
    return true;
  } catch (error) {
    console.error('Error saving chat history:', error);
    return false;
  }
};

/**
 * Load chat history from IndexedDB
 * @returns {Promise<Array>} - Message list
 */
export const loadChatHistory = async () => {
  try {
    const messages = await chatStore.getItem('messages');
    return messages || [];
  } catch (error) {
    console.error('Error loading chat history:', error);
    return [];
  }
};

/**
 * Automatically cleans up chat history if it is older than 24 hours (daily clean)
 */
export const cleanDailyChatHistory = async () => {
  try {
    const lastChatTime = await chatStore.getItem('lastChatTime');
    if (lastChatTime) {
      const lastDate = new Date(lastChatTime);
      const currentDate = new Date();
      
      const diffHours = (currentDate - lastDate) / (1000 * 60 * 60);
      if (diffHours >= 24) {
        console.log('IndexedDB: Clearing chat history (>24h old)');
        await chatStore.removeItem('messages');
        await chatStore.removeItem('lastChatTime');
      }
    }
  } catch (error) {
    console.error('Error in daily chat cleanup:', error);
  }
};

/**
 * Clear chat history manually
 */
export const clearChatHistory = async () => {
  try {
    await chatStore.removeItem('messages');
    await chatStore.removeItem('lastChatTime');
    return true;
  } catch (error) {
    console.error('Error clearing chat history:', error);
    return false;
  }
};
