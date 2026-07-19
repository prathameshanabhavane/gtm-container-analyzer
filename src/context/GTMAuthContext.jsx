/**
 * GTM Authentication Context
 * Provides shared authentication state across the entire app
 * 
 * ============================================
 * SECURITY HARDENING (Anti-Hack Measures)
 * ============================================
 * 
 * 1. TOKEN PROTECTION:
 *    - Stored in useRef (hidden from React DevTools)
 *    - Never exposed in context value
 *    - Never logged to console
 *    - Cleared on logout/expiry/page refresh
 *    - Object.freeze on sensitive data
 * 
 * 2. INPUT VALIDATION:
 *    - All user inputs validated before use
 *    - URL encoding on path parameters
 *    - Type checking on all parameters
 *    - Path traversal prevention
 * 
 * 3. REQUEST SECURITY:
 *    - Request timeouts (30s) prevent DoS
 *    - HTTPS only (enforced by Google API)
 *    - Credentials never sent in URL
 *    - Rate limit awareness
 * 
 * 4. ERROR HANDLING:
 *    - Internal errors never exposed to user
 *    - Generic user-friendly messages
 *    - No stack traces in production
 * 
 * 5. DATA SAFETY:
 *    - 100% client-side processing
 *    - No data sent to external servers
 *    - Read-only OAuth scope
 *    - No data persisted without consent
 */

import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useGoogleLogin, googleLogout } from '@react-oauth/google';

// API Configuration - HTTPS only, no HTTP fallback
const GTM_API_BASE = 'https://tagmanager.googleapis.com/tagmanager/v2';

// Security: Request timeout to prevent hanging/DoS
const REQUEST_TIMEOUT = 30000;

// Create the context
const GTMAuthContext = createContext(null);

// Security: Freeze error messages object to prevent tampering
const ERROR_MESSAGES = Object.freeze({
  NETWORK: 'Network error. Please check your internet connection.',
  TIMEOUT: 'Request timed out. Please try again.',
  AUTH_FAILED: 'Authentication failed. Please sign in again.',
  SESSION_EXPIRED: 'Your session has expired. Please sign in again.',
  NO_PERMISSION: 'You don\'t have permission to access this resource.',
  SERVER_ERROR: 'Google servers are temporarily unavailable. Please try again later.',
  RATE_LIMITED: 'Too many requests. Please wait a moment and try again.',
  INVALID_INPUT: 'Invalid input provided.',
  UNKNOWN: 'Something went wrong. Please try again.',
});

// Security: Validate path to prevent path traversal attacks
const isValidPath = (path) => {
  if (!path || typeof path !== 'string') return false;
  // Block path traversal attempts
  if (path.includes('..') || path.includes('//')) return false;
  // Only allow alphanumeric, forward slash, and hyphen
  if (!/^[a-zA-Z0-9\-\/]+$/.test(path)) return false;
  return true;
};

// Security: Validate account/container ID
const isValidId = (id) => {
  if (!id || typeof id !== 'string') return false;
  // IDs should only contain numbers
  if (!/^\d+$/.test(id)) return false;
  return true;
};

// Security: Fetch with timeout and abort controller
const fetchWithTimeout = async (url, options, timeout = REQUEST_TIMEOUT) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      // Security: Never send credentials in URL
      credentials: 'omit',
    });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(ERROR_MESSAGES.TIMEOUT);
    }
    // Security: Don't expose internal error details
    if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
      throw new Error(ERROR_MESSAGES.NETWORK);
    }
    throw new Error(ERROR_MESSAGES.UNKNOWN);
  }
};

// Security: Get user-friendly error (never expose internal details)
const getUserFriendlyError = (status, originalMessage) => {
  // Never return original message that might contain sensitive info
  if (status === 401) return ERROR_MESSAGES.SESSION_EXPIRED;
  if (status === 403) return ERROR_MESSAGES.NO_PERMISSION;
  if (status === 429) return ERROR_MESSAGES.RATE_LIMITED;
  if (status >= 500) return ERROR_MESSAGES.SERVER_ERROR;
  
  // Check for known safe messages
  const safeMessages = Object.values(ERROR_MESSAGES);
  if (safeMessages.includes(originalMessage)) {
    return originalMessage;
  }
  
  return ERROR_MESSAGES.UNKNOWN;
};

// Provider component
export const GTMAuthProvider = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [accounts, setAccounts] = useState([]);
  
  // Security: Token stored in ref to prevent exposure in React DevTools
  // The ref is never directly accessible outside this component
  const tokenRef = useRef(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Security: Track request count for rate limiting awareness
  const requestCountRef = useRef(0);
  const lastRequestTimeRef = useRef(0);

  // Security: Rate limiting check
  const checkRateLimit = useCallback(() => {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTimeRef.current;
    
    // Reset counter after 1 minute
    if (timeSinceLastRequest > 60000) {
      requestCountRef.current = 0;
    }
    
    // Allow max 30 requests per minute
    if (requestCountRef.current >= 30) {
      return false;
    }
    
    requestCountRef.current++;
    lastRequestTimeRef.current = now;
    return true;
  }, []);

  // Security: Securely set token (never log)
  const setToken = useCallback((token) => {
    // Validate token format (basic check)
    if (token && typeof token !== 'string') {
      return;
    }
    tokenRef.current = token;
    setIsAuthenticated(!!token);
  }, []);

  // Security: Get token (internal use only)
  const getToken = useCallback(() => tokenRef.current, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Security: Secure token cleanup
  const handleTokenExpiry = useCallback(() => {
    // Revoke Google session
    try {
      googleLogout();
    } catch (e) {
      // Silent fail - don't expose logout errors
    }
    
    // Clear all sensitive data
    tokenRef.current = null;
    setIsAuthenticated(false);
    setAccounts([]);
    setError(ERROR_MESSAGES.SESSION_EXPIRED);
  }, []);

  // Security: Build headers securely
  const getAuthHeaders = useCallback(() => {
    const token = getToken();
    if (!token) return null;
    // Security: Only return Authorization header, nothing else
    return Object.freeze({ Authorization: `Bearer ${token}` });
  }, [getToken]);

  // Fetch GTM accounts
  const fetchAccounts = useCallback(async (token) => {
    // Security: Validate token exists
    if (!token || typeof token !== 'string') {
      setError(ERROR_MESSAGES.AUTH_FAILED);
      return [];
    }
    
    // Security: Rate limit check
    if (!checkRateLimit()) {
      setError(ERROR_MESSAGES.RATE_LIMITED);
      return [];
    }
    
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchWithTimeout(
        `${GTM_API_BASE}/accounts`,
        { 
          headers: Object.freeze({ Authorization: `Bearer ${token}` }),
          method: 'GET',
        }
      );
      
      if (response.status === 401) {
        handleTokenExpiry();
        return [];
      }
      
      if (response.status === 403) {
        setError(ERROR_MESSAGES.NO_PERMISSION);
        return [];
      }
      
      if (response.status === 429) {
        setError(ERROR_MESSAGES.RATE_LIMITED);
        return [];
      }
      
      if (!response.ok) {
        throw new Error(getUserFriendlyError(response.status));
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(ERROR_MESSAGES.UNKNOWN);
      }
      
      // Security: Validate response structure
      const accountList = Array.isArray(data.account) ? data.account : [];
      
      // Security: Freeze account data to prevent tampering
      const frozenAccounts = Object.freeze(accountList.map(acc => Object.freeze({
        accountId: String(acc.accountId || ''),
        name: String(acc.name || ''),
        path: String(acc.path || ''),
      })));
      
      setAccounts(frozenAccounts);
      return frozenAccounts;
    } catch (err) {
      setError(getUserFriendlyError(null, err.message));
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [handleTokenExpiry, checkRateLimit]);

  // Google OAuth login
  const login = useGoogleLogin({
    scope: 'https://www.googleapis.com/auth/tagmanager.readonly',
    onSuccess: async (tokenResponse) => {
      // Security: Validate token exists
      if (!tokenResponse?.access_token) {
        setError(ERROR_MESSAGES.AUTH_FAILED);
        return;
      }
      
      setToken(tokenResponse.access_token);
      setError(null);
      await fetchAccounts(tokenResponse.access_token);
    },
    onError: () => {
      // Security: Never expose OAuth error details
      setError(ERROR_MESSAGES.AUTH_FAILED);
    }
  });

  // Fetch containers for an account
  const fetchContainers = useCallback(async (accountId) => {
    // Security: Rate limit check
    if (!checkRateLimit()) {
      setError(ERROR_MESSAGES.RATE_LIMITED);
      return [];
    }
    
    const headers = getAuthHeaders();
    if (!headers) {
      setError('Please sign in to continue.');
      return [];
    }
    
    // Security: Validate accountId
    if (!isValidId(accountId)) {
      setError(ERROR_MESSAGES.INVALID_INPUT);
      return [];
    }
    
    setIsLoading(true);
    setError(null);
    try {
      // Security: Encode path parameter
      const response = await fetchWithTimeout(
        `${GTM_API_BASE}/accounts/${encodeURIComponent(accountId)}/containers`,
        { 
          headers,
          method: 'GET',
        }
      );
      
      if (response.status === 401) {
        handleTokenExpiry();
        return [];
      }
      
      if (response.status === 403) {
        setError(ERROR_MESSAGES.NO_PERMISSION);
        return [];
      }
      
      if (response.status === 429) {
        setError(ERROR_MESSAGES.RATE_LIMITED);
        return [];
      }
      
      if (!response.ok) {
        throw new Error(getUserFriendlyError(response.status));
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(ERROR_MESSAGES.UNKNOWN);
      }
      
      // Security: Validate and freeze response
      const containerList = Array.isArray(data.container) ? data.container : [];
      return Object.freeze(containerList.map(cont => Object.freeze({
        containerId: String(cont.containerId || ''),
        name: String(cont.name || ''),
        publicId: String(cont.publicId || ''),
        path: String(cont.path || ''),
      })));
    } catch (err) {
      setError(getUserFriendlyError(null, err.message));
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [getAuthHeaders, handleTokenExpiry, checkRateLimit]);

  // Fetch latest workspace version (fallback)
  const fetchLatestWorkspaceVersion = useCallback(async (containerPath) => {
    const headers = getAuthHeaders();
    if (!headers) throw new Error(ERROR_MESSAGES.SESSION_EXPIRED);
    
    // Security: Validate path
    if (!isValidPath(containerPath)) {
      throw new Error(ERROR_MESSAGES.INVALID_INPUT);
    }
    
    try {
      const response = await fetchWithTimeout(
        `${GTM_API_BASE}/${containerPath}/version_headers`,
        { headers, method: 'GET' }
      );
      
      if (response.status === 401) {
        handleTokenExpiry();
        throw new Error(ERROR_MESSAGES.SESSION_EXPIRED);
      }
      
      if (response.status === 429) {
        throw new Error(ERROR_MESSAGES.RATE_LIMITED);
      }
      
      if (!response.ok) {
        throw new Error('No published versions available. Please publish a version in GTM first.');
      }
      
      const data = await response.json();
      const versions = Array.isArray(data.containerVersionHeader) ? data.containerVersionHeader : [];
      
      if (versions.length === 0) {
        throw new Error('No versions found. Please create and publish a version in GTM.');
      }
      
      const latestVersion = versions[0];
      
      // Security: Validate version ID
      if (!latestVersion?.containerVersionId) {
        throw new Error(ERROR_MESSAGES.UNKNOWN);
      }
      
      const versionResponse = await fetchWithTimeout(
        `${GTM_API_BASE}/${containerPath}/versions/${encodeURIComponent(latestVersion.containerVersionId)}`,
        { headers, method: 'GET' }
      );
      
      if (versionResponse.status === 401) {
        handleTokenExpiry();
        throw new Error(ERROR_MESSAGES.SESSION_EXPIRED);
      }
      
      if (!versionResponse.ok) {
        throw new Error('Failed to load container version. Please try again.');
      }
      
      return await versionResponse.json();
    } catch (err) {
      throw err;
    }
  }, [getAuthHeaders, handleTokenExpiry]);

  // Fetch live container version
  const fetchContainerVersion = useCallback(async (containerPath) => {
    // Security: Rate limit check
    if (!checkRateLimit()) {
      setError(ERROR_MESSAGES.RATE_LIMITED);
      return null;
    }
    
    const headers = getAuthHeaders();
    if (!headers) {
      setError('Please sign in to continue.');
      return null;
    }
    
    // Security: Validate containerPath
    if (!isValidPath(containerPath)) {
      setError(ERROR_MESSAGES.INVALID_INPUT);
      return null;
    }
    
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchWithTimeout(
        `${GTM_API_BASE}/${containerPath}/versions:live`,
        { headers, method: 'GET' }
      );
      
      if (response.status === 401) {
        handleTokenExpiry();
        return null;
      }
      
      if (response.status === 403) {
        setError(ERROR_MESSAGES.NO_PERMISSION);
        return null;
      }
      
      if (response.status === 429) {
        setError(ERROR_MESSAGES.RATE_LIMITED);
        return null;
      }
      
      if (!response.ok) {
        if (response.status === 404) {
          return await fetchLatestWorkspaceVersion(containerPath);
        }
        throw new Error(getUserFriendlyError(response.status));
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(ERROR_MESSAGES.UNKNOWN);
      }
      
      return data;
    } catch (err) {
      setError(getUserFriendlyError(null, err.message));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [getAuthHeaders, handleTokenExpiry, fetchLatestWorkspaceVersion, checkRateLimit]);

  // Security: Complete secure logout
  const logout = useCallback(() => {
    try {
      googleLogout();
    } catch (e) {
      // Silent fail
    }
    
    // Clear ALL sensitive data
    tokenRef.current = null;
    requestCountRef.current = 0;
    lastRequestTimeRef.current = 0;
    setIsAuthenticated(false);
    setAccounts([]);
    setError(null);
    setIsLoading(false);
  }, []);

  // Reset state
  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
  }, []);

  // Security: Context value - token is NEVER exposed
  const value = Object.freeze({
    login,
    logout,
    reset,
    clearError,
    fetchContainers,
    fetchContainerVersion,
    isLoading,
    error,
    accounts,
    isAuthenticated,
    // SECURITY: accessToken is intentionally NOT exposed
    // SECURITY: getToken is intentionally NOT exposed
    // SECURITY: tokenRef is intentionally NOT exposed
  });

  return (
    <GTMAuthContext.Provider value={value}>
      {children}
    </GTMAuthContext.Provider>
  );
};

// Custom hook with error boundary
export const useGTMAuthContext = () => {
  const context = useContext(GTMAuthContext);
  if (!context) {
    throw new Error('useGTMAuthContext must be used within a GTMAuthProvider');
  }
  return context;
};

export default GTMAuthContext;
