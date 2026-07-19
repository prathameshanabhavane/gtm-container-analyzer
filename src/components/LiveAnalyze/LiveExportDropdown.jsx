/**
 * LiveExportDropdown Component
 * Dropdown menu for exporting live captured tags and events to CSV/JSON
 * Includes session import for loading saved sessions
 */

import { useState, useRef, useEffect } from 'react';
import { Download, Tags, Zap, FileText, Check, ChevronRight, Link2, Upload, Database } from 'lucide-react';
import {
  exportLiveTagsToCSV,
  exportDataLayerEventsToCSV,
  exportFullLiveCaptureToCSV,
  exportURLParamsToCSV
} from '../../utils/liveExport';

const LiveExportDropdown = ({
  allTags,
  filteredTags,
  dataLayerEvents,
  pageContext,
  hasFilters,
  liveData,
  onImportSession
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [exported, setExported] = useState(null);
  const dropdownRef = useRef(null);
  const fileInputRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleExport = (type) => {
    const hostname = pageContext.hostname?.replace(/\./g, '_') || 'live';
    const timestamp = new Date().toISOString().split('T')[0];

    switch (type) {
      case 'all-tags':
        exportLiveTagsToCSV(
          allTags,
          pageContext,
          `gtm_live_tags_${hostname}_${timestamp}.csv`
        );
        break;
      case 'filtered-tags':
        exportLiveTagsToCSV(
          filteredTags,
          pageContext,
          `gtm_live_tags_filtered_${hostname}_${timestamp}.csv`
        );
        break;
      case 'events':
        exportDataLayerEventsToCSV(
          dataLayerEvents,
          pageContext,
          `gtm_live_events_${hostname}_${timestamp}.csv`
        );
        break;
      case 'full':
        exportFullLiveCaptureToCSV(
          allTags,
          dataLayerEvents,
          pageContext,
          `gtm_live_full_${hostname}_${timestamp}.csv`
        );
        break;
      case 'params':
        exportURLParamsToCSV(
          pageContext.queryParams,
          pageContext,
          `gtm_live_url_params_${hostname}_${timestamp}.csv`
        );
        break;
      case 'session-json':
        exportSessionJSON(hostname, timestamp);
        break;
    }

    setExported(type);
    setTimeout(() => {
      setExported(null);
      if (type !== 'session-json') setIsOpen(false);
    }, 1500);
  };

  const exportSessionJSON = (hostname, timestamp) => {
    const sessionData = {
      _gtm_session_version: 1,
      _exported_at: new Date().toISOString(),
      _exported_from: 'GTM Container Analyzer',
      ...liveData,
    };

    const blob = new Blob([JSON.stringify(sessionData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gtm_session_${hostname}_${timestamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        // Validate structure
        if (!data.networkRequests && !data.dataLayerEvents) {
          alert('Invalid session file. Expected a GTM Container Analyzer session export.');
          return;
        }
        if (onImportSession) {
          onImportSession(data);
        }
        setIsOpen(false);
      } catch (err) {
        alert('Could not parse session file. Please ensure it is a valid JSON file.');
      }
    };
    reader.readAsText(file);
    // Reset so the same file can be re-imported
    event.target.value = '';
  };

  return (
    <div className="live-export-dropdown-wrapper" ref={dropdownRef}>
      <button
        className={`live-export-dropdown-btn ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <Download size={16} />
        Export
        <ChevronRight size={14} className={`chevron ${isOpen ? 'open' : ''}`} />
      </button>

      {isOpen && (
        <div className="live-export-dropdown-menu">
          {/* Session JSON Export */}
          <button
            className={`live-export-option highlight ${exported === 'session-json' ? 'exported' : ''}`}
            onClick={() => handleExport('session-json')}
          >
            <Database size={16} />
            <div className="live-export-option-info">
              <span className="live-export-option-title">Download Session (JSON)</span>
              <span className="live-export-option-count">
                Full session — share with teammates
              </span>
            </div>
            {exported === 'session-json' ? <Check size={16} className="check-icon" /> : <Download size={16} />}
          </button>

          {/* Session Import */}
          <button
            className="live-export-option highlight"
            onClick={handleImportClick}
          >
            <Upload size={16} />
            <div className="live-export-option-info">
              <span className="live-export-option-title">Import Session (JSON)</span>
              <span className="live-export-option-count">
                Load a saved session file
              </span>
            </div>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleFileImport}
          />

          <div className="live-export-divider" />

          {/* Full Export */}
          <button
            className={`live-export-option ${exported === 'full' ? 'exported' : ''}`}
            onClick={() => handleExport('full')}
          >
            <FileText size={16} />
            <div className="live-export-option-info">
              <span className="live-export-option-title">Full Capture Report</span>
              <span className="live-export-option-count">
                {allTags.length} tags + {dataLayerEvents.length} events
              </span>
            </div>
            {exported === 'full' ? <Check size={16} className="check-icon" /> : <Download size={16} />}
          </button>

          {/* All Tags */}
          <button
            className={`live-export-option ${exported === 'all-tags' ? 'exported' : ''}`}
            onClick={() => handleExport('all-tags')}
          >
            <Tags size={16} />
            <div className="live-export-option-info">
              <span className="live-export-option-title">All Tags</span>
              <span className="live-export-option-count">{allTags.length} tags</span>
            </div>
            {exported === 'all-tags' ? <Check size={16} className="check-icon" /> : <Download size={16} />}
          </button>

          {/* Filtered Tags */}
          <button
            className={`live-export-option ${exported === 'filtered-tags' ? 'exported' : ''} ${!hasFilters ? 'disabled' : ''}`}
            onClick={() => hasFilters && handleExport('filtered-tags')}
            disabled={!hasFilters}
          >
            <Tags size={16} />
            <div className="live-export-option-info">
              <span className="live-export-option-title">Filtered Tags</span>
              <span className="live-export-option-count">
                {hasFilters ? `${filteredTags.length} tags` : 'No filters applied'}
              </span>
            </div>
            {exported === 'filtered-tags' ? <Check size={16} className="check-icon" /> : <Download size={16} />}
          </button>

          {/* DataLayer Events */}
          <button
            className={`live-export-option ${exported === 'events' ? 'exported' : ''} ${dataLayerEvents.length === 0 ? 'disabled' : ''}`}
            onClick={() => dataLayerEvents.length > 0 && handleExport('events')}
            disabled={dataLayerEvents.length === 0}
          >
            <Zap size={16} />
            <div className="live-export-option-info">
              <span className="live-export-option-title">DataLayer Events</span>
              <span className="live-export-option-count">
                {dataLayerEvents.length > 0 ? `${dataLayerEvents.length} events` : 'No events captured'}
              </span>
            </div>
            {exported === 'events' ? <Check size={16} className="check-icon" /> : <Download size={16} />}
          </button>

          {/* URL Parameters */}
          <button
            className={`live-export-option ${exported === 'params' ? 'exported' : ''} ${!pageContext.queryParams || Object.keys(pageContext.queryParams).length === 0 ? 'disabled' : ''}`}
            onClick={() => pageContext.queryParams && Object.keys(pageContext.queryParams).length > 0 && handleExport('params')}
            disabled={!pageContext.queryParams || Object.keys(pageContext.queryParams).length === 0}
          >
            <Link2 size={16} />
            <div className="live-export-option-info">
              <span className="live-export-option-title">URL Parameters</span>
              <span className="live-export-option-count">
                {pageContext.queryParams && Object.keys(pageContext.queryParams).length > 0
                  ? `${Object.keys(pageContext.queryParams).length} parameters`
                  : 'No parameters'}
              </span>
            </div>
            {exported === 'params' ? <Check size={16} className="check-icon" /> : <Download size={16} />}
          </button>
        </div>
      )}
    </div>
  );
};

export default LiveExportDropdown;
