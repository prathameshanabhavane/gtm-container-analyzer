/**
 * useGTMData Hook
 * Manages GTM data loading, processing, and storage
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  processGTMData, 
  getContainerInfo, 
  getStats,
  getTagTypeChartData,
  getUniqueTagTypes,
  getAllConditionTypes,
  detectDuplicateTags,
  detectUnusedVariables,
  detectOrphanTriggers,
  getAllTriggersWithDetails,
  getUniqueTriggerTypeLabels,
  getAllVariablesWithDetails,
  getUniqueVariableTypeLabels,
} from '../data/gtmData';
import { saveGTMData, loadGTMData, clearGTMData, clearChatHistory } from '../utils/indexedDB';
import { validateGTMJson } from '../utils/security';

const useGTMData = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Data state
  const [processedTags, setProcessedTags] = useState([]);
  const [rawGTMData, setRawGTMData] = useState(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [containerInfo, setContainerInfo] = useState({});
  const [isLoadingFromDB, setIsLoadingFromDB] = useState(true);
  const [savedAt, setSavedAt] = useState(null);

  // Sync container with local MCP Server (for Cursor/Claude Desktop connection)
  const syncWithLocalMCPServer = useCallback((data) => {
    if (!data) return;
    const serverUrl = import.meta.env.VITE_AI_SERVER_URL || 'http://localhost:3001';
    fetch(`${serverUrl}/api/auth/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ containerJson: data }),
    }).catch((err) => {
      console.warn('[Sync Warning] Local MCP server sync failed:', err.message);
    });
  }, []);

  // Load data from IndexedDB on mount
  useEffect(() => {
    const loadFromDB = async () => {
      try {
        const storedData = await loadGTMData();
        if (storedData && storedData.data) {
          const newProcessedTags = processGTMData(storedData.data);
          setProcessedTags(newProcessedTags);
          setRawGTMData(storedData.data);
          setContainerInfo(getContainerInfo());
          setDataLoaded(true);
          setSavedAt(storedData.savedAt);
          syncWithLocalMCPServer(storedData.data);
        }
      } catch (error) {
        console.error('Error loading from IndexedDB:', error);
      } finally {
        setIsLoadingFromDB(false);
      }
    };
    
    loadFromDB();
  }, []);

  // Redirect to upload page if no data and trying to access protected routes
  useEffect(() => {
    if (!isLoadingFromDB && !dataLoaded) {
      const protectedRoutes = ['/analyze', '/tags', '/triggers', '/variables'];
      if (protectedRoutes.includes(location.pathname)) {
        navigate('/', { replace: true });
      }
    }
  }, [isLoadingFromDB, dataLoaded, location.pathname, navigate]);

  // Handle file upload with security validation
  const handleFileUpload = useCallback(async (data) => {
    // Security: Validate JSON structure before processing
    const validation = validateGTMJson(data);
    if (!validation.valid) {
      console.error('Security: Invalid GTM data rejected -', validation.error);
      return false;
    }
    
    const newProcessedTags = processGTMData(data);
    setProcessedTags(newProcessedTags);
    setRawGTMData(data);
    setContainerInfo(getContainerInfo());
    setDataLoaded(true);
    
    // Save to IndexedDB
    await saveGTMData(data);
    setSavedAt(new Date().toISOString());
    
    // Sync with local MCP Server in background
    syncWithLocalMCPServer(data);
    
    return true;
  }, [syncWithLocalMCPServer]);

  // Clear stored data
  const handleClearData = useCallback(async () => {
    await clearGTMData();
    await clearChatHistory();
    setDataLoaded(false);
    setSavedAt(null);
    setProcessedTags([]);
    setRawGTMData(null);
    setContainerInfo({});
  }, []);

  // Memoized computed values
  const stats = useMemo(() => getStats(), [processedTags]);
  const chartData = useMemo(() => getTagTypeChartData(), [processedTags]);
  const tagTypes = useMemo(() => getUniqueTagTypes(), [processedTags]);
  const conditionTypes = useMemo(() => getAllConditionTypes(), [processedTags]);
  const duplicateTags = useMemo(() => detectDuplicateTags(), [processedTags]);
  const unusedVariables = useMemo(() => detectUnusedVariables(), [processedTags]);
  const orphanTriggers = useMemo(() => detectOrphanTriggers(), [processedTags]);

  // Get all triggers with details
  const allTriggers = useMemo(() => {
    if (!dataLoaded) return [];
    return getAllTriggersWithDetails();
  }, [dataLoaded, processedTags]);

  // Get unique trigger type labels for filter
  const triggerTypeLabels = useMemo(() => {
    if (!dataLoaded) return [];
    return getUniqueTriggerTypeLabels();
  }, [dataLoaded, allTriggers]);

  // Get all variables with details
  const allVariables = useMemo(() => {
    if (!dataLoaded) return [];
    return getAllVariablesWithDetails();
  }, [dataLoaded, processedTags]);

  // Get unique variable type labels for filter
  const variableTypeLabels = useMemo(() => {
    if (!dataLoaded) return [];
    return getUniqueVariableTypeLabels();
  }, [dataLoaded, allVariables]);

  return {
    // Data
    processedTags,
    rawGTMData,
    containerInfo,
    dataLoaded,
    isLoadingFromDB,
    savedAt,
    
    // Computed
    stats,
    chartData,
    tagTypes,
    conditionTypes,
    duplicateTags,
    unusedVariables,
    orphanTriggers,
    allTriggers,
    triggerTypeLabels,
    allVariables,
    variableTypeLabels,
    
    // Actions
    handleFileUpload,
    handleClearData,
  };
};

export default useGTMData;

