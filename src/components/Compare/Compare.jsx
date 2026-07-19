/**
 * Container Comparison Component
 * 
 * User-friendly interface to compare two GTM containers
 * and visualize the differences.
 * 
 * Supports two modes:
 * 1. Upload JSON files manually
 * 2. Sign in with Google and select containers directly
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, GitCompare, Upload, X, 
  Tag, Zap, Database, Plus, Minus, RefreshCw,
  CheckCircle2, AlertCircle, FileJson, ArrowLeftRight, AlertTriangle,
  LogIn, Building2, ChevronDown, Loader2
} from 'lucide-react';
import { compareContainers, extractContainerInfo } from '../../data/compare';
import { useGTMAuthContext } from '../../context/GTMAuthContext';
import { SEO } from '../SEO';
import { FormatChangeModal } from '../FormatChangeModal';
import { validateGTMStructure, safeJSONParse, extractMJSExport } from '../../utils/gtmValidator';
import './Compare.css';

const Compare = () => {
  const navigate = useNavigate();
  const { 
    login, 
    logout, 
    isAuthenticated, 
    accounts, 
    fetchContainers, 
    fetchContainerVersion,
    isLoading: authLoading,
    error: authError,
    clearError: clearAuthError
  } = useGTMAuthContext();
  
  // Mode: 'upload' or 'google'
  const [mode, setMode] = useState('upload');
  
  // Container states
  const [containerA, setContainerA] = useState(null);
  const [containerB, setContainerB] = useState(null);
  const [infoA, setInfoA] = useState(null);
  const [infoB, setInfoB] = useState(null);
  
  // Google mode states
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [containers, setContainers] = useState([]);
  const [selectedContainerA, setSelectedContainerA] = useState('');
  const [selectedContainerB, setSelectedContainerB] = useState('');
  const [loadingContainerA, setLoadingContainerA] = useState(false);
  const [loadingContainerB, setLoadingContainerB] = useState(false);
  
  // UI states
  const [dragA, setDragA] = useState(false);
  const [dragB, setDragB] = useState(false);
  const [error, setError] = useState(null);
  const [isComparing, setIsComparing] = useState(false);
  const [results, setResults] = useState(null);
  const [activeTab, setActiveTab] = useState('tags');
  const [swapAnimation, setSwapAnimation] = useState(false);
  const [swapCount, setSwapCount] = useState(0); // Track swap count for feedback
  const [changeFilter, setChangeFilter] = useState('all'); // 'all', 'added', 'removed', 'modified'
  const [expandedItems, setExpandedItems] = useState(new Set()); // Track expanded diff items
  const [formatError, setFormatError] = useState(null); // Graceful error for format changes
  
  // Load containers when account is selected
  useEffect(() => {
    if (selectedAccount && isAuthenticated) {
      const loadContainers = async () => {
        const containerList = await fetchContainers(selectedAccount.accountId);
        setContainers(containerList || []);
        // Reset selections when account changes
        setSelectedContainerA('');
        setSelectedContainerB('');
        setContainerA(null);
        setContainerB(null);
        setInfoA(null);
        setInfoB(null);
        setResults(null);
      };
      loadContainers();
    }
  }, [selectedAccount, isAuthenticated, fetchContainers]);
  
  // Load container A when selected (Google mode)
  const handleSelectContainerA = useCallback(async (containerPath) => {
    if (!containerPath) {
      setContainerA(null);
      setInfoA(null);
      setSelectedContainerA('');
      return;
    }
    
    setSelectedContainerA(containerPath);
    setLoadingContainerA(true);
    setError(null);
    
    try {
      const data = await fetchContainerVersion(containerPath);
      if (data) {
        // Validate the API response structure
        const containerData = { containerVersion: data };
        const validation = validateGTMStructure(containerData);
        if (!validation.valid) {
          setFormatError({
            ...validation,
            errorType: 'google_api',
            errorDetails: `Google API response format may have changed: ${validation.errorDetails}`
          });
          return;
        }
        
        const info = extractContainerInfo(containerData);
        const container = containers.find(c => c.path === containerPath);
        setContainerA(containerData);
        setInfoA({ ...info, fileName: container?.name || 'Container A' });
        setResults(null);
      }
    } catch (err) {
      // Check if it's likely an API format change
      if (err.message?.includes('undefined') || err.message?.includes('Cannot read')) {
        setFormatError({
          errorType: 'google_api',
          errorCode: 'API_RESPONSE_ERROR',
          errorDetails: err.message
        });
      } else {
        setError(`Failed to load container: ${err.message}`);
      }
    } finally {
      setLoadingContainerA(false);
    }
  }, [fetchContainerVersion, containers]);
  
  // Load container B when selected (Google mode)
  const handleSelectContainerB = useCallback(async (containerPath) => {
    if (!containerPath) {
      setContainerB(null);
      setInfoB(null);
      setSelectedContainerB('');
      return;
    }
    
    setSelectedContainerB(containerPath);
    setLoadingContainerB(true);
    setError(null);
    
    try {
      const data = await fetchContainerVersion(containerPath);
      if (data) {
        // Validate the API response structure
        const containerData = { containerVersion: data };
        const validation = validateGTMStructure(containerData);
        if (!validation.valid) {
          setFormatError({
            ...validation,
            errorType: 'google_api',
            errorDetails: `Google API response format may have changed: ${validation.errorDetails}`
          });
          return;
        }
        
        const info = extractContainerInfo(containerData);
        const container = containers.find(c => c.path === containerPath);
        setContainerB(containerData);
        setInfoB({ ...info, fileName: container?.name || 'Container B' });
        setResults(null);
      }
    } catch (err) {
      // Check if it's likely an API format change
      if (err.message?.includes('undefined') || err.message?.includes('Cannot read')) {
        setFormatError({
          errorType: 'google_api',
          errorCode: 'API_RESPONSE_ERROR',
          errorDetails: err.message
        });
      } else {
        setError(`Failed to load container: ${err.message}`);
      }
    } finally {
      setLoadingContainerB(false);
    }
  }, [fetchContainerVersion, containers]);
  
  // Handle mode change
  const handleModeChange = (newMode) => {
    setMode(newMode);
    // Clear all states when switching modes
    setContainerA(null);
    setContainerB(null);
    setInfoA(null);
    setInfoB(null);
    setResults(null);
    setError(null);
    setSelectedContainerA('');
    setSelectedContainerB('');
  };
  
  // Check if containers are from the same account
  const accountMismatch = useMemo(() => {
    if (!infoA || !infoB) return null;
    
    // If both have account IDs, check if they match
    if (infoA.accountId && infoB.accountId) {
      if (infoA.accountId !== infoB.accountId) {
        return {
          accountA: infoA.accountId,
          accountB: infoB.accountId,
          message: 'These containers are from different GTM accounts. Comparison may not be meaningful.'
        };
      }
    }
    return null;
  }, [infoA, infoB]);
  
  // Parse and validate GTM file with graceful error handling
  const parseGTMFile = async (file) => {
    const allowedExtensions = ['.json', '.mjs', '.js'];
    const fileExt = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    if (!allowedExtensions.includes(fileExt)) {
      throw new Error('Invalid file type. Only .json, .mjs, or .js files allowed.');
    }
    
    if (file.size > 50 * 1024 * 1024) {
      throw new Error('File too large. Maximum size is 50MB.');
    }
    
    const text = await file.text();
    let jsonData;
    let parseResult;
    
    // Use safe parsing with format change detection
    if (file.name.endsWith('.mjs') || file.name.endsWith('.js')) {
      parseResult = extractMJSExport(text, file.name);
      if (!parseResult.success) {
        setFormatError(parseResult.error);
        return null;
      }
      jsonData = parseResult.data;
    } else {
      parseResult = safeJSONParse(text, file.name);
      if (!parseResult.success) {
        setFormatError(parseResult.error);
        return null;
      }
      jsonData = parseResult.data;
    }
    
    // Validate GTM structure
    const validation = validateGTMStructure(jsonData);
    if (!validation.valid) {
      setFormatError(validation);
      return null;
    }
    
    return jsonData;
  };
  
  // Handle file upload for Container A
  const handleFileA = useCallback(async (file) => {
    if (!file) return;
    // Clear any previous errors at the start
    setError(null);
    setFormatError(null);
    
    try {
      const data = await parseGTMFile(file);
      // If parseGTMFile returned null, formatError modal is already shown
      if (!data) return;
      
      const info = extractContainerInfo(data);
      setContainerA(data);
      setInfoA({ ...info, fileName: file.name });
      setResults(null); // Clear previous results
    } catch (err) {
      setError(`Container A: ${err.message}`);
    }
  }, []);
  
  // Handle file upload for Container B
  const handleFileB = useCallback(async (file) => {
    if (!file) return;
    // Clear any previous errors at the start
    setError(null);
    setFormatError(null);
    
    try {
      const data = await parseGTMFile(file);
      // If parseGTMFile returned null, formatError modal is already shown
      if (!data) return;
      
      const info = extractContainerInfo(data);
      setContainerB(data);
      setInfoB({ ...info, fileName: file.name });
      setResults(null); // Clear previous results
    } catch (err) {
      setError(`Container B: ${err.message}`);
    }
  }, []);
  
  // Run comparison with graceful error handling
  const runComparison = useCallback(() => {
    if (!containerA || !containerB) return;
    
    setIsComparing(true);
    setError(null);
    
    // Use setTimeout to allow UI to update
    setTimeout(() => {
      try {
        const result = compareContainers(containerA, containerB);
        
        // Check if comparison returned null (structure issue)
        if (!result) {
          setFormatError({
            errorType: 'gtm_format',
            errorCode: 'COMPARISON_FAILED',
            errorDetails: 'Unable to compare containers. The structure may have changed.'
          });
          return;
        }
        
        setResults(result);
      } catch (err) {
        // Check if it's likely a format change
        if (err.message?.includes('undefined') || err.message?.includes('Cannot read') || err.message?.includes('is not')) {
          setFormatError({
            errorType: 'gtm_format',
            errorCode: 'COMPARISON_ERROR',
            errorDetails: `Comparison logic encountered unexpected data: ${err.message}`
          });
        } else {
          setError(`Comparison failed: ${err.message}`);
        }
      } finally {
        setIsComparing(false);
      }
    }, 100);
  }, [containerA, containerB]);
  
  // Clear a container
  const clearContainerA = () => {
    setContainerA(null);
    setInfoA(null);
    setResults(null);
  };
  
  const clearContainerB = () => {
    setContainerB(null);
    setInfoB(null);
    setResults(null);
  };
  
  // Swap containers A and B
  const swapContainers = () => {
    // Trigger swap animation
    setSwapAnimation(true);
    
    // Small delay for animation effect
    setTimeout(() => {
      const tempContainer = containerA;
      const tempInfo = infoA;
      
      setContainerA(containerB);
      setInfoA(infoB);
      setContainerB(tempContainer);
      setInfoB(tempInfo);
      setResults(null); // Clear results since comparison direction changed
      setSwapCount(prev => prev + 1); // Increment swap count
      
      // Reset animation after swap
      setTimeout(() => {
        setSwapAnimation(false);
      }, 300);
    }, 150);
  };
  
  // Handle clicking on change badge - filter and scroll
  const handleBadgeClick = (tab, filter) => {
    setActiveTab(tab);
    setChangeFilter(filter);
    
    // Scroll to details section
    setTimeout(() => {
      const detailsSection = document.querySelector('.compare-details');
      if (detailsSection) {
        detailsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  // Get changes for active tab with filtering
  const getActiveChanges = () => {
    if (!results) return [];
    
    const data = results[activeTab];
    if (!data) return [];
    
    let changes = [];
    
    // Filter based on changeFilter
    if (changeFilter === 'all') {
      changes = [...data.added, ...data.removed, ...data.modified];
    } else if (changeFilter === 'added') {
      changes = [...data.added];
    } else if (changeFilter === 'removed') {
      changes = [...data.removed];
    } else if (changeFilter === 'modified') {
      changes = [...data.modified];
    }
    
    return changes.sort((a, b) => {
      const order = { added: 0, modified: 1, removed: 2 };
      return order[a.changeType] - order[b.changeType];
    });
  };
  
  const activeChanges = getActiveChanges();
  
  // Get counts for filter buttons
  const getFilterCounts = () => {
    if (!results) return { added: 0, removed: 0, modified: 0 };
    const data = results[activeTab];
    if (!data) return { added: 0, removed: 0, modified: 0 };
    return {
      added: data.added.length,
      removed: data.removed.length,
      modified: data.modified.length
    };
  };
  
  const filterCounts = getFilterCounts();
  
  return (
    <div className="compare-page">
      <SEO 
        title="GTM Container Comparison Tool - Compare Google Tag Manager Containers"
        description="Free GTM container comparison tool. Compare two Google Tag Manager containers side-by-side to identify changes, track modifications, and find differences between versions. Supports Google Sign-In and file upload. 100% private - runs in your browser."
        keywords="GTM comparison, GTM container comparison, compare GTM containers, Google Tag Manager comparison, GTM diff tool, GTM version comparison, compare tag manager containers, GTM container diff, GTM changes tracker, GTM audit comparison, compare GTM versions, GTM migration comparison, tag manager diff, GTM export comparison, compare GTM JSON"
        canonical="/compare"
      />
      
      {/* Graceful Error Modal for Format Changes */}
      <FormatChangeModal 
        isOpen={!!formatError}
        onClose={() => setFormatError(null)}
        errorType={formatError?.errorType}
        errorDetails={formatError?.errorDetails}
        errorCode={formatError?.errorCode}
      />
      
      <div className="compare-page-content">
        {/* Header */}
        <header className="compare-header">
          <button 
            className="compare-back-btn"
            onClick={() => navigate('/')}
          >
            <ChevronLeft size={14} />
            <span>Home</span>
          </button>
          
          <div className="compare-header-divider" />
          
          <div className="compare-title-section">
            <div className="compare-title-icon">
              <GitCompare size={16} />
            </div>
            <div className="compare-title-text">
              <h1>Container Comparison</h1>
              <p>Compare two GTM containers to see what's changed</p>
            </div>
          </div>
        </header>
        
        {/* Mode Toggle */}
        <div className="compare-mode-toggle">
          <button 
            className={`compare-mode-btn ${mode === 'upload' ? 'active' : ''}`}
            onClick={() => handleModeChange('upload')}
          >
            <Upload size={16} />
            Upload Files
          </button>
          <button 
            className={`compare-mode-btn ${mode === 'google' ? 'active' : ''}`}
            onClick={() => handleModeChange('google')}
          >
            <LogIn size={16} />
            Google Sign In
          </button>
        </div>
        
        {/* Google Sign In Mode */}
        {mode === 'google' && (
          <div className="compare-google-section">
            {!isAuthenticated ? (
              <div className="compare-google-login">
                <div className="compare-google-info">
                  <Building2 size={32} />
                  <h3>Connect to Google Tag Manager</h3>
                  <p>Sign in with your Google account to select containers directly from your GTM accounts</p>
                </div>
                <button 
                  className="compare-google-btn"
                  onClick={() => login()}
                  disabled={authLoading}
                >
                  {authLoading ? (
                    <>
                      <Loader2 size={18} className="spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" width="18" height="18">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      Sign in with Google
                    </>
                  )}
                </button>
                {authError && (
                  <div className="compare-google-error">
                    <AlertCircle size={14} />
                    {authError}
                  </div>
                )}
              </div>
            ) : (
              <div className="compare-google-connected">
                {/* Header with Account & Sign Out */}
                <div className="compare-google-header">
                  <div className="compare-account-selector">
                    <Building2 size={18} />
                    <div className="compare-select-wrapper">
                      <select
                        value={selectedAccount?.accountId || ''}
                        onChange={(e) => {
                          const account = accounts.find(a => a.accountId === e.target.value);
                          setSelectedAccount(account || null);
                        }}
                        disabled={authLoading}
                      >
                        <option value="">Select GTM Account...</option>
                        {accounts.map(acc => (
                          <option key={acc.accountId} value={acc.accountId}>
                            {acc.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={16} className="select-icon" />
                    </div>
                  </div>
                  <button 
                    className="compare-logout-btn"
                    onClick={logout}
                  >
                    Sign out
                  </button>
                </div>
                
                {/* Container Selection Cards */}
                {selectedAccount && containers.length > 0 && (
                  <div className="compare-container-pickers">
                    {/* Container A Card */}
                    <div className={`compare-picker-card ${infoA ? 'selected' : ''} ${loadingContainerA ? 'loading' : ''}`}>
                      <div className="compare-picker-header">
                        <span className="compare-picker-badge base">A</span>
                        <span className="compare-picker-title">Base Container</span>
                      </div>
                      
                      {infoA ? (
                        <div className="compare-picker-loaded">
                          <div className="compare-picker-icon success">
                            <CheckCircle2 size={22} />
                          </div>
                          <div className="compare-picker-info">
                            <div className="compare-picker-name">{infoA.name}</div>
                            <div className="compare-picker-id">{infoA.publicId}</div>
                            <div className="compare-picker-stats">
                              <span><Tag size={12} /> {infoA.stats.tagCount} tags</span>
                              <span><Zap size={12} /> {infoA.stats.triggerCount} triggers</span>
                              <span><Database size={12} /> {infoA.stats.variableCount} vars</span>
                            </div>
                          </div>
                          <button 
                            className="compare-picker-change"
                            onClick={() => { setContainerA(null); setInfoA(null); setSelectedContainerA(''); }}
                          >
                            Change container
                          </button>
                        </div>
                      ) : (
                        <div className="compare-picker-empty">
                          <div className="compare-picker-icon-wrapper">
                            {loadingContainerA ? (
                              <Loader2 size={26} className="spin" />
                            ) : (
                              <FileJson size={26} />
                            )}
                          </div>
                          <div className="compare-select-wrapper full">
                            <select
                              value={selectedContainerA}
                              onChange={(e) => handleSelectContainerA(e.target.value)}
                              disabled={loadingContainerA || authLoading}
                            >
                              <option value="">Choose a container...</option>
                              {containers.map(cont => (
                                <option 
                                  key={cont.containerId} 
                                  value={cont.path}
                                  disabled={cont.path === selectedContainerB}
                                >
                                  {cont.name} ({cont.publicId})
                                </option>
                              ))}
                            </select>
                            <ChevronDown size={16} className="select-icon" />
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* VS Indicator */}
                    <div className="compare-picker-vs">
                      <div className="compare-picker-vs-line"></div>
                      <div className="compare-picker-vs-badge">VS</div>
                      <div className="compare-picker-vs-line"></div>
                    </div>
                    
                    {/* Container B Card */}
                    <div className={`compare-picker-card ${infoB ? 'selected' : ''} ${loadingContainerB ? 'loading' : ''}`}>
                      <div className="compare-picker-header">
                        <span className="compare-picker-badge compare">B</span>
                        <span className="compare-picker-title">Compare Container</span>
                      </div>
                      
                      {infoB ? (
                        <div className="compare-picker-loaded">
                          <div className="compare-picker-icon success">
                            <CheckCircle2 size={22} />
                          </div>
                          <div className="compare-picker-info">
                            <div className="compare-picker-name">{infoB.name}</div>
                            <div className="compare-picker-id">{infoB.publicId}</div>
                            <div className="compare-picker-stats">
                              <span><Tag size={12} /> {infoB.stats.tagCount} tags</span>
                              <span><Zap size={12} /> {infoB.stats.triggerCount} triggers</span>
                              <span><Database size={12} /> {infoB.stats.variableCount} vars</span>
                            </div>
                          </div>
                          <button 
                            className="compare-picker-change"
                            onClick={() => { setContainerB(null); setInfoB(null); setSelectedContainerB(''); }}
                          >
                            Change container
                          </button>
                        </div>
                      ) : (
                        <div className="compare-picker-empty">
                          <div className="compare-picker-icon-wrapper">
                            {loadingContainerB ? (
                              <Loader2 size={26} className="spin" />
                            ) : (
                              <FileJson size={26} />
                            )}
                          </div>
                          <div className="compare-select-wrapper full">
                            <select
                              value={selectedContainerB}
                              onChange={(e) => handleSelectContainerB(e.target.value)}
                              disabled={loadingContainerB || authLoading}
                            >
                              <option value="">Choose a container...</option>
                              {containers.map(cont => (
                                <option 
                                  key={cont.containerId} 
                                  value={cont.path}
                                  disabled={cont.path === selectedContainerA}
                                >
                                  {cont.name} ({cont.publicId})
                                </option>
                              ))}
                            </select>
                            <ChevronDown size={16} className="select-icon" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* No Containers Message */}
                {selectedAccount && containers.length === 0 && !authLoading && (
                  <div className="compare-no-containers">
                    <AlertCircle size={20} />
                    <div>
                      <strong>No containers found</strong>
                      <p>This account doesn't have any containers yet.</p>
                    </div>
                  </div>
                )}
                
                {/* Prompt to Select Account */}
                {!selectedAccount && (
                  <div className="compare-select-account-prompt">
                    <Building2 size={32} />
                    <p>Select a GTM account above to see available containers</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* Upload Section - Only show in upload mode */}
        {mode === 'upload' && (
        <section className="compare-upload-section">
          {/* Container A */}
          <div 
            className={`compare-upload-card container-a ${dragA ? 'dragging' : ''} ${infoA ? 'loaded' : ''} ${swapAnimation ? 'swapping' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragA(true); }}
            onDragLeave={() => setDragA(false)}
            onDrop={(e) => { e.preventDefault(); setDragA(false); handleFileA(e.dataTransfer.files[0]); }}
          >
            <div className="compare-upload-label">
              <FileJson size={12} />
              Container A (Base)
              {swapCount > 0 && swapCount % 2 === 1 && <span className="swap-indicator">← was B</span>}
            </div>
            
            {infoA ? (
              <>
                <button className="compare-clear-btn" onClick={clearContainerA} title="Remove container">
                  <X size={14} />
                </button>
                <div className="compare-upload-icon">
                  <CheckCircle2 size={26} />
                </div>
                <div className="compare-loaded-info">
                  <div className="compare-loaded-name">{infoA.name}</div>
                  {infoA.publicId && (
                    <div className="compare-loaded-id">{infoA.publicId}</div>
                  )}
                  {infoA.accountId && (
                    <div className="compare-loaded-account">Account: {infoA.accountId}</div>
                  )}
                  <div className="compare-loaded-stats">
                    <span className="compare-loaded-stat">
                      <Tag size={12} />
                      <strong>{infoA.stats.tagCount}</strong> tags
                    </span>
                    <span className="compare-loaded-stat">
                      <Zap size={12} />
                      <strong>{infoA.stats.triggerCount}</strong> triggers
                    </span>
                    <span className="compare-loaded-stat">
                      <Database size={12} />
                      <strong>{infoA.stats.variableCount}</strong> variables
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="compare-upload-icon">
                  <Upload size={26} />
                </div>
                <p className="compare-upload-text">Drop file or click to browse</p>
                <p className="compare-upload-hint">Supports .json, .mjs, .js files</p>
                <input 
                  type="file"
                  className="compare-upload-input"
                  accept=".json,.mjs,.js"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    handleFileA(file);
                    // Reset input so onChange fires again even for same file
                    e.target.value = '';
                  }}
                />
              </>
            )}
          </div>
          
          {/* VS Divider with Swap Button */}
          <div className="compare-vs-divider">
            <div className="compare-vs-badge">VS</div>
            {(containerA || containerB) && (
              <div className="compare-swap-wrapper">
                <button 
                  className={`compare-swap-btn ${swapAnimation ? 'active' : ''}`}
                  onClick={swapContainers}
                  title="Swap containers (A ↔ B)"
                  disabled={(!containerA && !containerB) || swapAnimation}
                >
                  <ArrowLeftRight size={16} />
                  <span>Swap</span>
                </button>
                {swapAnimation && (
                  <span className="swap-toast">Swapped!</span>
                )}
              </div>
            )}
          </div>
          
          {/* Container B */}
          <div 
            className={`compare-upload-card container-b ${dragB ? 'dragging' : ''} ${infoB ? 'loaded' : ''} ${swapAnimation ? 'swapping' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragB(true); }}
            onDragLeave={() => setDragB(false)}
            onDrop={(e) => { e.preventDefault(); setDragB(false); handleFileB(e.dataTransfer.files[0]); }}
          >
            <div className="compare-upload-label">
              <FileJson size={12} />
              Container B (Compare)
              {swapCount > 0 && swapCount % 2 === 1 && <span className="swap-indicator">← was A</span>}
            </div>
            
            {infoB ? (
              <>
                <button className="compare-clear-btn" onClick={clearContainerB} title="Remove container">
                  <X size={14} />
                </button>
                <div className="compare-upload-icon">
                  <CheckCircle2 size={26} />
                </div>
                <div className="compare-loaded-info">
                  <div className="compare-loaded-name">{infoB.name}</div>
                  {infoB.publicId && (
                    <div className="compare-loaded-id">{infoB.publicId}</div>
                  )}
                  {infoB.accountId && (
                    <div className="compare-loaded-account">Account: {infoB.accountId}</div>
                  )}
                  <div className="compare-loaded-stats">
                    <span className="compare-loaded-stat">
                      <Tag size={12} />
                      <strong>{infoB.stats.tagCount}</strong> tags
                    </span>
                    <span className="compare-loaded-stat">
                      <Zap size={12} />
                      <strong>{infoB.stats.triggerCount}</strong> triggers
                    </span>
                    <span className="compare-loaded-stat">
                      <Database size={12} />
                      <strong>{infoB.stats.variableCount}</strong> variables
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="compare-upload-icon">
                  <Upload size={26} />
                </div>
                <p className="compare-upload-text">Drop file or click to browse</p>
                <p className="compare-upload-hint">Supports .json, .mjs, .js files</p>
                <input 
                  type="file"
                  className="compare-upload-input"
                  accept=".json,.mjs,.js"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    handleFileB(file);
                    // Reset input so onChange fires again even for same file
                    e.target.value = '';
                  }}
                />
              </>
            )}
          </div>
        </section>
        )}
        
        {/* Account Mismatch Warning */}
        {accountMismatch && (
          <div className="compare-account-warning">
            <AlertTriangle size={16} />
            <div className="compare-warning-content">
              <strong>Different GTM Accounts</strong>
              <p>{accountMismatch.message}</p>
              <div className="compare-warning-accounts">
                <span>Container A: Account {accountMismatch.accountA}</span>
                <span>Container B: Account {accountMismatch.accountB}</span>
              </div>
            </div>
          </div>
        )}
        
        {/* Error Message */}
        {error && (
          <div className="hero-error" style={{ marginBottom: '1.5rem' }}>
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}
        
        {/* Compare Button */}
        <section className="compare-action-section">
          <button 
            className="compare-start-btn"
            disabled={!containerA || !containerB || isComparing}
            onClick={runComparison}
          >
            {isComparing ? (
              <>
                <RefreshCw size={18} className="spin" />
                Comparing...
              </>
            ) : (
              <>
                <GitCompare size={18} />
                Compare Containers
              </>
            )}
          </button>
        </section>
        
        {/* Results Section */}
        {results && (
          <div className="compare-results">
            {/* Summary Cards */}
            <div className="compare-summary">
              {/* Tags Summary */}
              <div className="compare-summary-card tags">
                <div className="compare-summary-header">
                  <div className="compare-summary-icon">
                    <Tag size={20} />
                  </div>
                  <span className="compare-summary-title">Tags</span>
                </div>
                <div className="compare-summary-counts">
                  <div className="compare-summary-count">
                    <div className="compare-summary-count-label">Container A</div>
                    <div className="compare-summary-count-value">{results.containerA.stats.tagCount}</div>
                  </div>
                  <div className="compare-summary-count">
                    <div className="compare-summary-count-label">Container B</div>
                    <div className="compare-summary-count-value">{results.containerB.stats.tagCount}</div>
                  </div>
                </div>
                <div className="compare-summary-changes">
                  {results.tags.summary.added > 0 && (
                    <button 
                      className="compare-change-badge added clickable"
                      onClick={() => handleBadgeClick('tags', 'added')}
                    >
                      <Plus size={12} /> {results.tags.summary.added} added
                    </button>
                  )}
                  {results.tags.summary.removed > 0 && (
                    <button 
                      className="compare-change-badge removed clickable"
                      onClick={() => handleBadgeClick('tags', 'removed')}
                    >
                      <Minus size={12} /> {results.tags.summary.removed} removed
                    </button>
                  )}
                  {results.tags.summary.modified > 0 && (
                    <button 
                      className="compare-change-badge modified clickable"
                      onClick={() => handleBadgeClick('tags', 'modified')}
                    >
                      <RefreshCw size={12} /> {results.tags.summary.modified} modified
                    </button>
                  )}
                  {results.tags.summary.added === 0 && results.tags.summary.removed === 0 && results.tags.summary.modified === 0 && (
                    <span className="compare-change-badge identical">No changes</span>
                  )}
                </div>
              </div>
              
              {/* Triggers Summary */}
              <div className="compare-summary-card triggers">
                <div className="compare-summary-header">
                  <div className="compare-summary-icon">
                    <Zap size={20} />
                  </div>
                  <span className="compare-summary-title">Triggers</span>
                </div>
                <div className="compare-summary-counts">
                  <div className="compare-summary-count">
                    <div className="compare-summary-count-label">Container A</div>
                    <div className="compare-summary-count-value">{results.containerA.stats.triggerCount}</div>
                  </div>
                  <div className="compare-summary-count">
                    <div className="compare-summary-count-label">Container B</div>
                    <div className="compare-summary-count-value">{results.containerB.stats.triggerCount}</div>
                  </div>
                </div>
                <div className="compare-summary-changes">
                  {results.triggers.summary.added > 0 && (
                    <button 
                      className="compare-change-badge added clickable"
                      onClick={() => handleBadgeClick('triggers', 'added')}
                    >
                      <Plus size={12} /> {results.triggers.summary.added} added
                    </button>
                  )}
                  {results.triggers.summary.removed > 0 && (
                    <button 
                      className="compare-change-badge removed clickable"
                      onClick={() => handleBadgeClick('triggers', 'removed')}
                    >
                      <Minus size={12} /> {results.triggers.summary.removed} removed
                    </button>
                  )}
                  {results.triggers.summary.modified > 0 && (
                    <button 
                      className="compare-change-badge modified clickable"
                      onClick={() => handleBadgeClick('triggers', 'modified')}
                    >
                      <RefreshCw size={12} /> {results.triggers.summary.modified} modified
                    </button>
                  )}
                  {results.triggers.summary.added === 0 && results.triggers.summary.removed === 0 && results.triggers.summary.modified === 0 && (
                    <span className="compare-change-badge identical">No changes</span>
                  )}
                </div>
              </div>
              
              {/* Variables Summary */}
              <div className="compare-summary-card variables">
                <div className="compare-summary-header">
                  <div className="compare-summary-icon">
                    <Database size={20} />
                  </div>
                  <span className="compare-summary-title">Variables</span>
                </div>
                <div className="compare-summary-counts">
                  <div className="compare-summary-count">
                    <div className="compare-summary-count-label">Container A</div>
                    <div className="compare-summary-count-value">{results.containerA.stats.variableCount}</div>
                  </div>
                  <div className="compare-summary-count">
                    <div className="compare-summary-count-label">Container B</div>
                    <div className="compare-summary-count-value">{results.containerB.stats.variableCount}</div>
                  </div>
                </div>
                <div className="compare-summary-changes">
                  {results.variables.summary.added > 0 && (
                    <button 
                      className="compare-change-badge added clickable"
                      onClick={() => handleBadgeClick('variables', 'added')}
                    >
                      <Plus size={12} /> {results.variables.summary.added} added
                    </button>
                  )}
                  {results.variables.summary.removed > 0 && (
                    <button 
                      className="compare-change-badge removed clickable"
                      onClick={() => handleBadgeClick('variables', 'removed')}
                    >
                      <Minus size={12} /> {results.variables.summary.removed} removed
                    </button>
                  )}
                  {results.variables.summary.modified > 0 && (
                    <button 
                      className="compare-change-badge modified clickable"
                      onClick={() => handleBadgeClick('variables', 'modified')}
                    >
                      <RefreshCw size={12} /> {results.variables.summary.modified} modified
                    </button>
                  )}
                  {results.variables.summary.added === 0 && results.variables.summary.removed === 0 && results.variables.summary.modified === 0 && (
                    <span className="compare-change-badge identical">No changes</span>
                  )}
                </div>
              </div>
            </div>
            
            {/* Detailed Changes */}
            <div className="compare-details">
              {/* Tabs */}
              <div className="compare-tabs">
                <button 
                  className={`compare-tab ${activeTab === 'tags' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('tags'); setChangeFilter('all'); }}
                >
                  <Tag size={16} />
                  Tags
                  <span className="compare-tab-count">
                    {results.tags.summary.added + results.tags.summary.removed + results.tags.summary.modified}
                  </span>
                </button>
                <button 
                  className={`compare-tab ${activeTab === 'triggers' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('triggers'); setChangeFilter('all'); }}
                >
                  <Zap size={16} />
                  Triggers
                  <span className="compare-tab-count">
                    {results.triggers.summary.added + results.triggers.summary.removed + results.triggers.summary.modified}
                  </span>
                </button>
                <button 
                  className={`compare-tab ${activeTab === 'variables' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('variables'); setChangeFilter('all'); }}
                >
                  <Database size={16} />
                  Variables
                  <span className="compare-tab-count">
                    {results.variables.summary.added + results.variables.summary.removed + results.variables.summary.modified}
                  </span>
                </button>
              </div>
              
              {/* Filter Buttons */}
              <div className="compare-filters">
                <button 
                  className={`compare-filter-btn ${changeFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setChangeFilter('all')}
                >
                  All ({filterCounts.added + filterCounts.removed + filterCounts.modified})
                </button>
                <button 
                  className={`compare-filter-btn added ${changeFilter === 'added' ? 'active' : ''}`}
                  onClick={() => setChangeFilter('added')}
                  disabled={filterCounts.added === 0}
                >
                  <Plus size={14} /> Added ({filterCounts.added})
                </button>
                <button 
                  className={`compare-filter-btn removed ${changeFilter === 'removed' ? 'active' : ''}`}
                  onClick={() => setChangeFilter('removed')}
                  disabled={filterCounts.removed === 0}
                >
                  <Minus size={14} /> Removed ({filterCounts.removed})
                </button>
                <button 
                  className={`compare-filter-btn modified ${changeFilter === 'modified' ? 'active' : ''}`}
                  onClick={() => setChangeFilter('modified')}
                  disabled={filterCounts.modified === 0}
                >
                  <RefreshCw size={14} /> Modified ({filterCounts.modified})
                </button>
              </div>
              
              {/* Content */}
              <div className="compare-details-content">
                {activeChanges.length > 0 ? (
                  <div className="compare-change-list">
                    {activeChanges.map((change, idx) => (
                      <div 
                        key={`${change.name}-${idx}`}
                        className={`compare-change-item ${change.changeType}`}
                      >
                        <div className="compare-change-icon">
                          {change.changeType === 'added' && <Plus size={16} />}
                          {change.changeType === 'removed' && <Minus size={16} />}
                          {change.changeType === 'modified' && <RefreshCw size={16} />}
                        </div>
                        <div className="compare-change-info">
                          <div className="compare-change-name">{change.name}</div>
                          <div className="compare-change-type">{change.type || 'Unknown type'}</div>
                          
                          {/* Show differences for modified items */}
                          {change.changeType === 'modified' && change.differences && change.differences.length > 0 && (
                            <div className="compare-diff-list">
                              <div className="compare-diff-header">
                                <span className="compare-diff-count">
                                  {change.differences.length} field{change.differences.length > 1 ? 's' : ''} changed
                                </span>
                              </div>
                              {(expandedItems.has(`${change.name}-${idx}`) 
                                ? change.differences 
                                : change.differences.slice(0, 3)
                              ).map((diff, diffIdx) => (
                                <div key={diffIdx} className="compare-diff-item">
                                  <span className="compare-diff-field">{diff.label}:</span>
                                  <div className="compare-diff-values">
                                    <span className="compare-diff-old" title={diff.oldValue || ''}>
                                      {diff.oldValue !== null ? diff.oldValue : '(none)'}
                                    </span>
                                    <span className="compare-diff-arrow">→</span>
                                    <span className="compare-diff-new" title={diff.newValue || ''}>
                                      {diff.newValue !== null ? diff.newValue : '(none)'}
                                    </span>
                                  </div>
                                </div>
                              ))}
                              {change.differences.length > 3 && (
                                <button 
                                  className="compare-diff-toggle"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const key = `${change.name}-${idx}`;
                                    setExpandedItems(prev => {
                                      const next = new Set(prev);
                                      if (next.has(key)) {
                                        next.delete(key);
                                      } else {
                                        next.add(key);
                                      }
                                      return next;
                                    });
                                  }}
                                >
                                  {expandedItems.has(`${change.name}-${idx}`) 
                                    ? '▲ Show less' 
                                    : `▼ Show ${change.differences.length - 3} more changes`
                                  }
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        <span className="compare-change-status">
                          {change.changeType}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="compare-no-changes">
                    <CheckCircle2 size={48} />
                    {changeFilter === 'all' ? (
                      <>
                        <h4>No Changes Detected</h4>
                        <p>All {activeTab} are identical between the two containers.</p>
                      </>
                    ) : (
                      <>
                        <h4>No {changeFilter} {activeTab}</h4>
                        <p>There are no {changeFilter} {activeTab} in this comparison.</p>
                        <button 
                          className="compare-filter-reset"
                          onClick={() => setChangeFilter('all')}
                        >
                          Show all changes
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Empty State - No Results Yet */}
        {!results && containerA && containerB && (
          <div className="compare-empty-state">
            <GitCompare size={48} />
            <p>Click "Compare Containers" to see the differences</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Compare;

