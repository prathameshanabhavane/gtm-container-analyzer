import React, { useState, useMemo } from 'react';
import { 
  Variable, 
  Tag, 
  Zap,
  Filter, 
  ChevronDown, 
  ChevronRight,
  AlertCircle,
  Code,
  Database,
  Cookie,
  Globe,
  FileCode,
  Hash,
  Layers,
  Settings,
  Copy,
  Check,
  Minus,
  Plus,
  Users,
  Box
} from 'lucide-react';
import './VariablesList.css';

// Variable type icon mapping
const getVariableIcon = (type) => {
  const iconMap = {
    'v': Database,      // Data Layer Variable
    'c': Hash,          // Constant
    'k': Cookie,        // First Party Cookie
    'j': Code,          // JavaScript Variable
    'jsm': FileCode,    // Custom JavaScript
    'u': Globe,         // URL
    'f': Globe,         // HTTP Referrer
    'e': Zap,           // Auto-Event Variable
    'd': Box,           // DOM Element
    'vis': Box,         // Element Visibility
    'smm': Layers,      // Lookup Table
    'remm': Layers,     // RegEx Table
    'gas': Settings,    // Google Analytics Settings
    'gtes': Settings,   // Google Tag: Event Settings
    'gtcs': Settings,   // Google Tag: Configuration Settings
    'aev': Zap,         // Auto-Event Variable
  };
  return iconMap[type] || Variable;
};

const VariablesList = ({ variables }) => {
  const [expandedVariables, setExpandedVariables] = useState(new Set());
  const [copiedId, setCopiedId] = useState(null);

  const toggleVariable = (variableId) => {
    setExpandedVariables(prev => {
      const newSet = new Set(prev);
      if (newSet.has(variableId)) {
        newSet.delete(variableId);
      } else {
        newSet.add(variableId);
      }
      return newSet;
    });
  };

  const expandAll = () => {
    setExpandedVariables(new Set(variables.map(v => v.variableId)));
  };

  const collapseAll = () => {
    setExpandedVariables(new Set());
  };

  const copyToClipboard = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Stats
  const stats = useMemo(() => ({
    total: variables.length,
    unused: variables.filter(v => v.isUnused).length,
    used: variables.filter(v => !v.isUnused).length,
  }), [variables]);

  if (!variables || variables.length === 0) {
    return (
      <div className="variables-list-card">
        <div className="variables-empty">
          <Variable size={48} />
          <span>No variables found</span>
        </div>
      </div>
    );
  }

  return (
    <div className="variables-list-card">
      {/* Header */}
      <div className="variables-list-header">
        <div className="variables-list-title">
          <Variable size={20} />
          <span>All Variables</span>
          <span className="variables-count">{variables.length}</span>
        </div>
        <div className="variables-stats">
          <span className="stat-badge">
            <Users size={12} />
            {stats.used} used
          </span>
          {stats.unused > 0 && (
            <span className="stat-badge unused">
              <AlertCircle size={12} />
              {stats.unused} unused
            </span>
          )}
        </div>
        <div className="variables-actions">
          <button className="variable-action-btn" onClick={expandAll} title="Expand All">
            <Plus size={14} />
          </button>
          <button className="variable-action-btn" onClick={collapseAll} title="Collapse All">
            <Minus size={14} />
          </button>
        </div>
      </div>

      {/* Variables List */}
      <div className="variables-list-content">
        {variables.map(variable => {
          const isExpanded = expandedVariables.has(variable.variableId);
          const VariableIcon = getVariableIcon(variable.type);
          const hasDetails = variable.usedIn.length > 0 || 
                            (variable.content && Object.keys(variable.content).some(k => 
                              k !== 'allParams' && variable.content[k] !== null
                            ));

          return (
            <div key={variable.variableId} className={`variable-item ${variable.isUnused ? 'unused' : ''}`}>
              {/* Variable Header */}
              <div 
                className={`variable-item-header ${isExpanded ? 'expanded' : ''}`}
                onClick={() => hasDetails && toggleVariable(variable.variableId)}
              >
                <div className="variable-toggle">
                  {hasDetails && (
                    isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />
                  )}
                </div>
                
                <div className="variable-icon">
                  <VariableIcon size={18} />
                </div>
                
                <div className="variable-info">
                  <div className="variable-name-row">
                    <span className="variable-name">{variable.name}</span>
                    <button 
                      className={`variable-copy-btn ${copiedId === variable.variableId ? 'copied' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(`{{${variable.name}}}`, variable.variableId);
                      }}
                      title="Copy variable reference"
                    >
                      {copiedId === variable.variableId ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                  </div>
                  <span className="variable-type-label">{variable.typeLabel}</span>
                </div>
                
                <div className="variable-meta">
                  {variable.isUnused && (
                    <span className="variable-unused-badge">Unused</span>
                  )}
                  <span className="variable-usage-count">
                    <Tag size={10} />
                    {variable.usageCount}
                  </span>
                  <span className="variable-id">#{variable.variableId}</span>
                </div>
              </div>

              {/* Expanded Content */}
              {isExpanded && hasDetails && (
                <div className="variable-expanded-content">
                  {/* Variable Value/Content */}
                  {variable.content && (
                    <div className="variable-section">
                      <div className="variable-section-label">
                        <Code size={14} />
                        VALUE / CONFIGURATION
                      </div>
                      <div className="variable-details-grid">
                        {/* Data Layer Key */}
                        {variable.content.dataLayerKey && (
                          <div className="detail-item highlight">
                            <span className="detail-key">Data Layer Key</span>
                            <span className="detail-value code">{variable.content.dataLayerKey}</span>
                          </div>
                        )}
                        
                        {/* Constant/Main Value */}
                        {variable.content.mainValue && (
                          <div className="detail-item highlight">
                            <span className="detail-key">Value</span>
                            <span className="detail-value code">{variable.content.mainValue}</span>
                          </div>
                        )}
                        
                        {/* Cookie Name */}
                        {variable.content.cookieName && (
                          <div className="detail-item">
                            <span className="detail-key">Cookie Name</span>
                            <span className="detail-value code">{variable.content.cookieName}</span>
                          </div>
                        )}
                        
                        {/* URL Component */}
                        {variable.content.urlComponent && (
                          <div className="detail-item">
                            <span className="detail-key">URL Component</span>
                            <span className="detail-value">{variable.content.urlComponent}</span>
                          </div>
                        )}
                        
                        {/* CSS Selector */}
                        {variable.content.cssSelector && (
                          <div className="detail-item full-width">
                            <span className="detail-key">CSS Selector</span>
                            <span className="detail-value code">{variable.content.cssSelector}</span>
                          </div>
                        )}
                        
                        {/* Element Attribute */}
                        {variable.content.elementAttribute && (
                          <div className="detail-item">
                            <span className="detail-key">Attribute</span>
                            <span className="detail-value code">{variable.content.elementAttribute}</span>
                          </div>
                        )}
                        
                        {/* Default Value */}
                        {variable.content.defaultValue && (
                          <div className="detail-item">
                            <span className="detail-key">Default Value</span>
                            <span className="detail-value code">{variable.content.defaultValue}</span>
                          </div>
                        )}
                        
                        {/* JavaScript Code */}
                        {variable.content.javascriptCode && (
                          <div className="detail-item full-width">
                            <span className="detail-key">JavaScript Code</span>
                            <pre className="detail-value code-block">
                              {variable.content.javascriptCode}
                            </pre>
                          </div>
                        )}
                        
                        {/* Lookup Table */}
                        {variable.content.lookupTable && variable.content.lookupTable.length > 0 && (
                          <div className="detail-item full-width">
                            <span className="detail-key">Lookup Table ({variable.content.lookupTable.length} entries)</span>
                            <div className="lookup-table">
                              <div className="lookup-table-header">
                                <span>Input</span>
                                <span>Output</span>
                              </div>
                              {variable.content.lookupTable.slice(0, 10).map((entry, idx) => (
                                <div key={idx} className="lookup-table-row">
                                  <span className="lookup-key">{entry.key || '(empty)'}</span>
                                  <span className="lookup-value">{entry.value || '(empty)'}</span>
                                </div>
                              ))}
                              {variable.content.lookupTable.length > 10 && (
                                <div className="lookup-table-more">
                                  +{variable.content.lookupTable.length - 10} more entries
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Regex Table */}
                        {variable.content.regexTable && variable.content.regexTable.length > 0 && (
                          <div className="detail-item full-width">
                            <span className="detail-key">RegEx Table ({variable.content.regexTable.length} patterns)</span>
                            <div className="lookup-table regex-table">
                              <div className="lookup-table-header">
                                <span>Pattern</span>
                                <span>Output</span>
                              </div>
                              {variable.content.regexTable.slice(0, 10).map((entry, idx) => (
                                <div key={idx} className="lookup-table-row">
                                  <span className="lookup-key regex">{entry.pattern || '(empty)'}</span>
                                  <span className="lookup-value">{entry.output || '(empty)'}</span>
                                </div>
                              ))}
                              {variable.content.regexTable.length > 10 && (
                                <div className="lookup-table-more">
                                  +{variable.content.regexTable.length - 10} more patterns
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Used In Section */}
                  {variable.usedIn.length > 0 && (
                    <div className="variable-section">
                      <div className="variable-section-label">
                        <Users size={14} />
                        USED IN ({variable.usedIn.length})
                      </div>
                      <div className="variable-usage-list">
                        {variable.usedIn.map((usage, idx) => (
                          <div key={idx} className={`usage-chip ${usage.type}`}>
                            {usage.type === 'tag' && <Tag size={12} />}
                            {usage.type === 'trigger' && <Zap size={12} />}
                            {usage.type === 'variable' && <Variable size={12} />}
                            <span className="usage-name">{usage.name}</span>
                            <span className="usage-type">{usage.type}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* All Parameters (collapsible) */}
                  {variable.content && variable.content.allParams && Object.keys(variable.content.allParams).length > 0 && (
                    <div className="variable-section">
                      <div className="variable-section-label">
                        <Settings size={14} />
                        ALL PARAMETERS
                      </div>
                      <div className="variable-params-list">
                        {Object.entries(variable.content.allParams).map(([key, value]) => (
                          <div key={key} className="param-row">
                            <span className="param-key">{key}</span>
                            <span className="param-value">
                              {typeof value === 'string' && value.length > 100 
                                ? value.substring(0, 100) + '...' 
                                : String(value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VariablesList;

