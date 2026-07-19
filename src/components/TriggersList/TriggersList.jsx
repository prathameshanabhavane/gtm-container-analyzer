import React, { useState, useMemo } from 'react';
import { 
  Zap, 
  Tag, 
  Filter, 
  ChevronDown, 
  ChevronRight,
  AlertCircle,
  MousePointer,
  FileText,
  Clock,
  Eye,
  Scroll,
  Play,
  History,
  Users,
  Globe,
  Code,
  Layers,
  Copy,
  Check,
  Minus,
  Plus
} from 'lucide-react';
import './TriggersList.css';

// Trigger type icon mapping
const getTriggerIcon = (type) => {
  const iconMap = {
    'PAGEVIEW': Globe,
    'CLICK': MousePointer,
    'LINK_CLICK': MousePointer,
    'FORM_SUBMIT': FileText,
    'CUSTOM_EVENT': Code,
    'HISTORY_CHANGE': History,
    'SCROLL_DEPTH': Scroll,
    'ELEMENT_VISIBILITY': Eye,
    'TIMER': Clock,
    'YOUTUBE_VIDEO': Play,
    'TRIGGER_GROUP': Layers,
    'WINDOW_LOADED': Globe,
    'DOM_READY': Globe,
  };
  return iconMap[type] || Zap;
};

// Condition type display
const getConditionOperator = (type) => {
  const operators = {
    'EQUALS': '=',
    'CONTAINS': 'contains',
    'STARTS_WITH': 'starts with',
    'ENDS_WITH': 'ends with',
    'MATCHES_REGEX': 'matches regex',
    'MATCHES_CSS_SELECTOR': 'matches CSS',
    'LESS_THAN': '<',
    'LESS_THAN_OR_EQUALS': '≤',
    'GREATER_THAN': '>',
    'GREATER_THAN_OR_EQUALS': '≥',
    'DOES_NOT_EQUAL': '≠',
    'DOES_NOT_CONTAIN': 'not contains',
  };
  return operators[type] || type;
};

const TriggersList = ({ triggers }) => {
  const [expandedTriggers, setExpandedTriggers] = useState(new Set());
  const [copiedId, setCopiedId] = useState(null);

  const toggleTrigger = (triggerId) => {
    setExpandedTriggers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(triggerId)) {
        newSet.delete(triggerId);
      } else {
        newSet.add(triggerId);
      }
      return newSet;
    });
  };

  const expandAll = () => {
    setExpandedTriggers(new Set(triggers.map(t => t.id)));
  };

  const collapseAll = () => {
    setExpandedTriggers(new Set());
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
    total: triggers.length,
    orphan: triggers.filter(t => t.isOrphan).length,
    withConditions: triggers.filter(t => t.conditions.length > 0).length,
  }), [triggers]);

  if (!triggers || triggers.length === 0) {
    return (
      <div className="triggers-list-card">
        <div className="triggers-empty">
          <Zap size={48} />
          <span>No triggers found</span>
        </div>
      </div>
    );
  }

  return (
    <div className="triggers-list-card">
      {/* Header */}
      <div className="triggers-list-header">
        <div className="triggers-list-title">
          <Zap size={20} />
          <span>All Triggers</span>
          <span className="triggers-count">{triggers.length}</span>
        </div>
        <div className="triggers-stats">
          <span className="stat-badge">
            <Users size={12} />
            {stats.total - stats.orphan} used
          </span>
          {stats.orphan > 0 && (
            <span className="stat-badge orphan">
              <AlertCircle size={12} />
              {stats.orphan} unused
            </span>
          )}
          <span className="stat-badge">
            <Filter size={12} />
            {stats.withConditions} with conditions
          </span>
        </div>
        <div className="triggers-actions">
          <button className="trigger-action-btn" onClick={expandAll} title="Expand All">
            <Plus size={14} />
          </button>
          <button className="trigger-action-btn" onClick={collapseAll} title="Collapse All">
            <Minus size={14} />
          </button>
        </div>
      </div>

      {/* Triggers List */}
      <div className="triggers-list-content">
        {triggers.map(trigger => {
          const isExpanded = expandedTriggers.has(trigger.id);
          const TriggerIcon = getTriggerIcon(trigger.type);
          const hasDetails = trigger.conditions.length > 0 || 
                            trigger.usedByTags.length > 0 || 
                            Object.keys(trigger.details).length > 0;

          return (
            <div key={trigger.id} className={`trigger-item ${trigger.isOrphan ? 'orphan' : ''}`}>
              {/* Trigger Header */}
              <div 
                className={`trigger-item-header ${isExpanded ? 'expanded' : ''}`}
                onClick={() => hasDetails && toggleTrigger(trigger.id)}
              >
                <div className="trigger-toggle">
                  {hasDetails && (
                    isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />
                  )}
                </div>
                
                <div className="trigger-icon">
                  <TriggerIcon size={18} />
                </div>
                
                <div className="trigger-info">
                  <div className="trigger-name-row">
                    <span className="trigger-name">{trigger.name}</span>
                    <button 
                      className={`trigger-copy-btn ${copiedId === trigger.id ? 'copied' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(trigger.name, trigger.id);
                      }}
                      title="Copy trigger name"
                    >
                      {copiedId === trigger.id ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                  </div>
                  <span className="trigger-type-label">{trigger.typeLabel}</span>
                </div>
                
                <div className="trigger-meta">
                  {trigger.isOrphan && (
                    <span className="trigger-orphan-badge">Unused</span>
                  )}
                  {trigger.conditions.length > 0 && (
                    <span className="trigger-condition-count">
                      <Filter size={10} />
                      {trigger.conditions.length}
                    </span>
                  )}
                  <span className="trigger-tag-count">
                    <Tag size={10} />
                    {trigger.usedByCount}
                  </span>
                  <span className="trigger-id">#{trigger.id}</span>
                </div>
              </div>

              {/* Expanded Content */}
              {isExpanded && hasDetails && (
                <div className="trigger-expanded-content">
                  {/* Trigger Details - Only show if there are actual values */}
                  {(() => {
                    const d = trigger.details;
                    const hasConfig = d.eventName || d.uniqueTriggerId || d.timerInterval || 
                      d.timerLimit || d.timerEventName || d.scrollThresholds || d.scrollDirection ||
                      d.visibilitySelector || d.visibilityMinPercent || d.visibilityMinDuration || 
                      d.visibilityFireOn || d.clickSelector || d.clickMatchSelector || d.onlyLinks ||
                      d.formSelector || d.waitForFormTimeout || 
                      (d.youTubeTriggers && d.youTubeTriggers.length > 0) || d.youTubeProgressThresholds ||
                      d.youTubeFixMissingApi || d.historySource || d.waitForTags || d.waitForTagsTimeout ||
                      d.checkValidation || d.useRegexMatching;
                    
                    return hasConfig ? (
                    <div className="trigger-section">
                      <div className="trigger-section-label">
                        <Code size={14} />
                        CONFIGURATION
                      </div>
                      <div className="trigger-details-grid">
                        {trigger.details.eventName && (
                          <div className={`detail-item ${trigger.type === 'CUSTOM_EVENT' ? 'highlight' : ''}`}>
                            <span className="detail-key">{trigger.type === 'CUSTOM_EVENT' ? 'Custom Event Name' : 'Event Name'}</span>
                            <span className="detail-value code">{trigger.details.eventName}</span>
                          </div>
                        )}
                        {trigger.details.uniqueTriggerId && (
                          <div className="detail-item">
                            <span className="detail-key">Unique Trigger ID</span>
                            <span className="detail-value code">{trigger.details.uniqueTriggerId}</span>
                          </div>
                        )}
                        
                        {/* Timer Settings */}
                        {trigger.details.timerInterval && (
                          <div className="detail-item">
                            <span className="detail-key">Timer Interval</span>
                            <span className="detail-value">{trigger.details.timerInterval}ms</span>
                          </div>
                        )}
                        {trigger.details.timerLimit && (
                          <div className="detail-item">
                            <span className="detail-key">Timer Limit</span>
                            <span className="detail-value">{trigger.details.timerLimit}</span>
                          </div>
                        )}
                        {trigger.details.timerEventName && (
                          <div className="detail-item">
                            <span className="detail-key">Timer Event Name</span>
                            <span className="detail-value code">{trigger.details.timerEventName}</span>
                          </div>
                        )}
                        
                        {/* Scroll Depth */}
                        {trigger.details.scrollThresholds && (
                          <div className="detail-item">
                            <span className="detail-key">Scroll Thresholds ({trigger.details.scrollUnits || 'PERCENT'})</span>
                            <span className="detail-value">{trigger.details.scrollThresholds}</span>
                          </div>
                        )}
                        {trigger.details.scrollDirection && (
                          <div className="detail-item">
                            <span className="detail-key">Scroll Direction</span>
                            <span className="detail-value">{trigger.details.scrollDirection}</span>
                          </div>
                        )}
                        
                        {/* Element Visibility */}
                        {trigger.details.visibilitySelector && (
                          <div className="detail-item full-width">
                            <span className="detail-key">Element Selector</span>
                            <span className="detail-value code">{trigger.details.visibilitySelector}</span>
                          </div>
                        )}
                        {trigger.details.visibilityMinPercent && (
                          <div className="detail-item">
                            <span className="detail-key">Min % Visible</span>
                            <span className="detail-value">{trigger.details.visibilityMinPercent}%</span>
                          </div>
                        )}
                        {trigger.details.visibilityMinDuration && (
                          <div className="detail-item">
                            <span className="detail-key">Min Duration</span>
                            <span className="detail-value">{trigger.details.visibilityMinDuration}ms</span>
                          </div>
                        )}
                        {trigger.details.visibilityFireOn && (
                          <div className="detail-item">
                            <span className="detail-key">Fire On</span>
                            <span className="detail-value">{trigger.details.visibilityFireOn.replace(/_/g, ' ')}</span>
                          </div>
                        )}
                        
                        {/* Click/Link */}
                        {trigger.details.clickSelector && (
                          <div className="detail-item full-width">
                            <span className="detail-key">Click Selector</span>
                            <span className="detail-value code">{trigger.details.clickSelector}</span>
                          </div>
                        )}
                        {trigger.details.clickMatchSelector && (
                          <div className="detail-item full-width">
                            <span className="detail-key">Match Selector</span>
                            <span className="detail-value code">{trigger.details.clickMatchSelector}</span>
                          </div>
                        )}
                        {trigger.details.onlyLinks && (
                          <div className="detail-item">
                            <span className="detail-key">Only Links</span>
                            <span className="detail-value">Yes</span>
                          </div>
                        )}
                        
                        {/* Form */}
                        {trigger.details.formSelector && (
                          <div className="detail-item full-width">
                            <span className="detail-key">Form Selector</span>
                            <span className="detail-value code">{trigger.details.formSelector}</span>
                          </div>
                        )}
                        {trigger.details.waitForFormTimeout && (
                          <div className="detail-item">
                            <span className="detail-key">Form Timeout</span>
                            <span className="detail-value">{trigger.details.waitForFormTimeout}ms</span>
                          </div>
                        )}
                        
                        {/* YouTube */}
                        {trigger.details.youTubeTriggers && trigger.details.youTubeTriggers.length > 0 && (
                          <div className="detail-item">
                            <span className="detail-key">YouTube Events</span>
                            <span className="detail-value">{trigger.details.youTubeTriggers.join(', ')}</span>
                          </div>
                        )}
                        {trigger.details.youTubeProgressThresholds && (
                          <div className="detail-item">
                            <span className="detail-key">Progress Thresholds</span>
                            <span className="detail-value">{trigger.details.youTubeProgressThresholds}%</span>
                          </div>
                        )}
                        {trigger.details.youTubeFixMissingApi && (
                          <div className="detail-item">
                            <span className="detail-key">Fix Missing API</span>
                            <span className="detail-value">Yes</span>
                          </div>
                        )}
                        
                        {/* History */}
                        {trigger.details.historySource && (
                          <div className="detail-item">
                            <span className="detail-key">History Source</span>
                            <span className="detail-value">{trigger.details.historySource}</span>
                          </div>
                        )}
                        
                        {/* Wait Settings */}
                        {trigger.details.waitForTags && (
                          <div className="detail-item">
                            <span className="detail-key">Wait for Tags</span>
                            <span className="detail-value">Yes</span>
                          </div>
                        )}
                        {trigger.details.waitForTagsTimeout && (
                          <div className="detail-item">
                            <span className="detail-key">Wait Timeout</span>
                            <span className="detail-value">{trigger.details.waitForTagsTimeout}ms</span>
                          </div>
                        )}
                        {trigger.details.checkValidation && (
                          <div className="detail-item">
                            <span className="detail-key">Check Validation</span>
                            <span className="detail-value">Yes</span>
                          </div>
                        )}
                        {trigger.details.useRegexMatching && (
                          <div className="detail-item">
                            <span className="detail-key">Regex Matching</span>
                            <span className="detail-value">Yes</span>
                          </div>
                        )}
                      </div>
                    </div>
                    ) : null;
                  })()}
                  
                  {/* All Parameters (Raw) */}
                  {trigger.details.allParameters && Object.keys(trigger.details.allParameters).length > 0 && (
                    <div className="trigger-section">
                      <div className="trigger-section-label">
                        <Code size={14} />
                        ALL PARAMETERS
                      </div>
                      <div className="trigger-params-list">
                        {Object.entries(trigger.details.allParameters).map(([key, value]) => (
                          <div key={key} className="param-row">
                            <span className="param-key">{key}</span>
                            <span className="param-value">{String(value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Conditions */}
                  {trigger.conditions.length > 0 && (
                    <div className="trigger-section">
                      <div className="trigger-section-label">
                        <Filter size={14} />
                        CONDITIONS ({trigger.conditions.length})
                      </div>
                      <div className="trigger-conditions-list">
                        {trigger.conditions.map((cond, idx) => (
                          <div key={idx} className="condition-row">
                            <span className="cond-filter-type">{cond.filterType}</span>
                            <span className="cond-variable">{cond.variable}</span>
                            <span className="cond-operator">{getConditionOperator(cond.type)}</span>
                            <span className="cond-value">{cond.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Used By Tags */}
                  {trigger.usedByTags.length > 0 && (
                    <div className="trigger-section">
                      <div className="trigger-section-label">
                        <Tag size={14} />
                        USED BY TAGS ({trigger.usedByTags.length})
                      </div>
                      <div className="trigger-tags-list">
                        {trigger.usedByTags.map(tag => (
                          <div key={tag.id} className={`tag-chip ${tag.paused ? 'paused' : ''}`}>
                            <Tag size={12} />
                            <span className="tag-chip-name">{tag.name}</span>
                            <span className="tag-chip-type">{tag.type}</span>
                            {tag.paused && <span className="tag-chip-paused">Paused</span>}
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

export default TriggersList;

