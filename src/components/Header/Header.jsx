import React, { useState } from 'react';
import { 
  Box, 
  Calendar, 
  Upload, 
  Trash2, 
  Database
} from 'lucide-react';
import { ConnectGTM } from '../ConnectGTM/ConnectGTM';
import { FormatChangeModal } from '../FormatChangeModal';
import { ClearConfirmModal } from '../ClearConfirmModal';
import { validateGTMStructure, safeJSONParse, extractMJSExport } from '../../utils/gtmValidator';

/**
 * Shared Header Component
 * Used across all pages for consistent navigation and actions
 * Header is IDENTICAL on all pages for consistency
 * 
 * @param {Object} props
 * @param {Object} props.containerInfo - Container information (name, publicId)
 * @param {Object} props.stats - Statistics (containerId, containerName, exportTime)
 * @param {string} props.savedAt - Timestamp when data was last saved
 * @param {Function} props.onFileUpload - Handler for file upload
 * @param {Function} props.onClearData - Handler for clearing data
 * @param {Function} props.onContainerChange - Handler for container change via Google
 * @param {React.ReactNode} props.children - Additional elements like Cleanup button
 */
const Header = ({ 
  containerInfo = {}, 
  stats = {}, 
  savedAt,
  onFileUpload,
  onClearData,
  onContainerChange,
  children 
}) => {
  const [formatError, setFormatError] = useState(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  
  const handleClearClick = () => {
    setShowClearConfirm(true);
  };
  
  const handleClearConfirm = () => {
    setShowClearConfirm(false);
    if (onClearData) onClearData();
  };

  // Container name for display
  const containerName = containerInfo.name || stats.containerName || '';
  const displayName = containerName.length > 21 ? `${containerName.slice(0, 21)}...` : containerName;
  
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Clear any previous errors at the start
    setFormatError(null);
    
    try {
      const text = await file.text();
      let jsonData;
      let parseResult;
      
      // Handle .mjs/.js with graceful error handling
      if (file.name.endsWith('.mjs') || file.name.endsWith('.js')) {
        parseResult = extractMJSExport(text, file.name);
        if (!parseResult.success) {
          setFormatError(parseResult.error);
          e.target.value = ''; // Reset input
          return;
        }
        jsonData = parseResult.data;
      } else {
        parseResult = safeJSONParse(text, file.name);
        if (!parseResult.success) {
          setFormatError(parseResult.error);
          e.target.value = ''; // Reset input
          return;
        }
        jsonData = parseResult.data;
      }
      
      // Validate GTM structure
      const validation = validateGTMStructure(jsonData);
      if (!validation.valid) {
        setFormatError(validation);
        e.target.value = ''; // Reset input
        return;
      }
      
      if (onFileUpload) onFileUpload(jsonData);
    } catch (err) {
      setFormatError({
        errorType: 'parse_error',
        errorCode: 'UNEXPECTED_ERROR',
        errorDetails: err.message
      });
    }
    
    e.target.value = ''; // Reset input
  };

  return (
    <>
      {/* Graceful Error Modal for Format Changes */}
      <FormatChangeModal 
        isOpen={!!formatError}
        onClose={() => setFormatError(null)}
        errorType={formatError?.errorType}
        errorDetails={formatError?.errorDetails}
        errorCode={formatError?.errorCode}
      />
      
      {/* Clear Data Confirmation Modal */}
      <ClearConfirmModal
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={handleClearConfirm}
        containerName={containerName}
      />
      
      <header className="header">
        <div className="header-title">
        <h1>GTM Container Analyzer</h1>
        <span className="header-divider"></span>
        <span className="header-badge">{containerInfo.publicId || stats.containerId}</span>
      </div>
      <div className="header-right">
        <div className="header-meta">
          <div className="meta-item">
            <Box size={16} />
            <span title={containerName}>
              {displayName}
            </span>
          </div>
          <div className="meta-item">
            <Calendar size={16} />
            <span>{stats.exportTime}</span>
          </div>
        </div>
        <div className="header-actions">
          {/* Switch Container via Google */}
          {import.meta.env.VITE_GOOGLE_CLIENT_ID && onContainerChange && (
            <div className="header-switch-container">
              <ConnectGTM onContainerLoaded={onContainerChange} autoOpenAfterLogin={true} />
            </div>
          )}
          <label className="upload-new-btn" title="Upload JSON file">
            <input 
              type="file" 
              accept=".json,.mjs,.js"
              onChange={handleFileChange}
              hidden
            />
            <Upload size={16} />
            <span>Upload</span>
          </label>
          <button 
            className="clear-data-btn"
            onClick={handleClearClick}
            title="Clear stored data"
          >
            <Trash2 size={16} />
            <span>Clear</span>
          </button>
          {savedAt && (
            <div className="saved-indicator" title={`Data saved locally: ${new Date(savedAt).toLocaleString()}`}>
              <Database size={14} />
              <span>Saved</span>
            </div>
          )}
          {/* Additional elements like Cleanup button passed as children */}
          {children}
        </div>
      </div>
      </header>
    </>
  );
};

export default Header;

