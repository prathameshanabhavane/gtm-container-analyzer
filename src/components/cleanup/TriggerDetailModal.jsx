/**
 * TriggerDetailModal Component
 * Modal showing detailed trigger information
 */

import { X, Target, Settings, Info, AlertCircle } from 'lucide-react';
import { CopyableName } from '../common';

const TriggerDetailModal = ({ trigger, onClose }) => {
  if (!trigger) return null;

  return (
    <div className="trigger-modal-overlay" onClick={onClose}>
      <div className="trigger-modal" onClick={(e) => e.stopPropagation()}>
        <div className="trigger-modal-header">
          <CopyableName 
            name={trigger.name} 
            icon={Target} 
            iconSize={20}
            className="trigger-modal-title"
          />
          <button className="trigger-modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        
        <div className="trigger-modal-badges">
          <span className="modal-type-badge">{trigger.typeLabel}</span>
          <span className="modal-status-badge unused">Unused</span>
        </div>
        
        <div className="trigger-modal-content">
          {/* Trigger ID */}
          <div className="modal-row">
            <span className="modal-label">Trigger ID</span>
            <code className="modal-code">{trigger.id}</code>
          </div>
          
          {/* Trigger-specific Details */}
          {trigger.details && (
            <div className="trigger-details-section">
              {/* Custom Event Name */}
              {trigger.details.eventName && (
                <div className="modal-row">
                  <span className="modal-label">Event Name</span>
                  <code className="modal-code">{trigger.details.eventName}</code>
                  {trigger.details.useRegexMatching && (
                    <span className="detail-badge regex">RegEx</span>
                  )}
                </div>
              )}
              
              {/* Timer Settings */}
              {trigger.details.timerInterval && (
                <div className="modal-row">
                  <span className="modal-label">Timer Interval</span>
                  <span className="modal-value">{trigger.details.timerInterval} ms</span>
                </div>
              )}
              {trigger.details.timerLimit && (
                <div className="modal-row">
                  <span className="modal-label">Timer Limit</span>
                  <span className="modal-value">{trigger.details.timerLimit} times</span>
                </div>
              )}
              
              {/* Scroll Depth Settings */}
              {trigger.details.scrollThresholds.length > 0 && (
                <div className="modal-row">
                  <span className="modal-label">Scroll Thresholds</span>
                  <div className="threshold-chips">
                    {trigger.details.scrollThresholds.map((t, i) => (
                      <span key={i} className="threshold-chip">
                        {t}{trigger.details.scrollUnits === 'PERCENT' ? '%' : 'px'}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {trigger.details.scrollDirection && (
                <div className="modal-row">
                  <span className="modal-label">Scroll Direction</span>
                  <span className="modal-value">{trigger.details.scrollDirection}</span>
                </div>
              )}
              
              {/* Element Visibility Settings */}
              {trigger.details.visibilitySelector && (
                <div className="modal-row">
                  <span className="modal-label">Element Selector</span>
                  <code className="modal-code">{trigger.details.visibilitySelector}</code>
                </div>
              )}
              {trigger.details.visibilityMinPercentVisible && (
                <div className="modal-row">
                  <span className="modal-label">Min % Visible</span>
                  <span className="modal-value">{trigger.details.visibilityMinPercentVisible}%</span>
                </div>
              )}
              {trigger.details.visibilityMinDuration && (
                <div className="modal-row">
                  <span className="modal-label">Min Duration</span>
                  <span className="modal-value">{trigger.details.visibilityMinDuration} ms</span>
                </div>
              )}
              {trigger.details.visibilityFireOn && (
                <div className="modal-row">
                  <span className="modal-label">Fire On</span>
                  <span className="modal-value">{trigger.details.visibilityFireOn}</span>
                </div>
              )}
              
              {/* Click/Link Settings */}
              {trigger.details.clickTargetSelector && (
                <div className="modal-row">
                  <span className="modal-label">Target Selector</span>
                  <code className="modal-code">{trigger.details.clickTargetSelector}</code>
                </div>
              )}
              {trigger.details.clickMatchSelector && (
                <div className="modal-row">
                  <span className="modal-label">Match Selector</span>
                  <code className="modal-code">{trigger.details.clickMatchSelector}</code>
                </div>
              )}
              
              {/* Form Settings */}
              {trigger.details.formSelector && (
                <div className="modal-row">
                  <span className="modal-label">Form Selector</span>
                  <code className="modal-code">{trigger.details.formSelector}</code>
                </div>
              )}
              
              {/* YouTube Settings */}
              {trigger.details.youTubeVideoTriggers.length > 0 && (
                <div className="modal-row">
                  <span className="modal-label">Video Events</span>
                  <div className="detail-chips">
                    {trigger.details.youTubeVideoTriggers.map((t, i) => (
                      <span key={i} className="detail-chip">{t}</span>
                    ))}
                  </div>
                </div>
              )}
              {trigger.details.youTubeProgressThresholds.length > 0 && (
                <div className="modal-row">
                  <span className="modal-label">Progress Thresholds</span>
                  <div className="threshold-chips">
                    {trigger.details.youTubeProgressThresholds.map((t, i) => (
                      <span key={i} className="threshold-chip">{t}</span>
                    ))}
                  </div>
                </div>
              )}
              
              {/* History Change */}
              {trigger.details.historySource && (
                <div className="modal-row">
                  <span className="modal-label">History Source</span>
                  <code className="modal-code">{trigger.details.historySource}</code>
                </div>
              )}
              
              {/* Trigger Group */}
              {trigger.details.triggerGroupConditions.length > 0 && (
                <div className="modal-row">
                  <span className="modal-label">Trigger Group</span>
                  <div className="detail-chips">
                    {trigger.details.triggerGroupConditions.map((t, i) => (
                      <span key={i} className="detail-chip trigger-ref">{t}</span>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Wait for Tags */}
              {trigger.details.waitForTags && (
                <div className="modal-row">
                  <span className="modal-label">Wait for Tags</span>
                  <span className="modal-value">
                    Yes{trigger.details.waitForTagsTimeout && ` (${trigger.details.waitForTagsTimeout}ms timeout)`}
                  </span>
                </div>
              )}
              
              {/* Check Validation */}
              {trigger.details.checkValidation && (
                <div className="modal-row">
                  <span className="modal-label">Check Validation</span>
                  <span className="modal-value">Enabled</span>
                </div>
              )}
            </div>
          )}
          
          {/* Conditions */}
          {trigger.conditions.length > 0 ? (
            <div className="modal-table-section">
              <div className="modal-section-header">
                <Settings size={14} />
                <span>Filter Conditions ({trigger.conditions.length})</span>
              </div>
              <table className="modal-table">
                <thead>
                  <tr>
                    <th>Filter Type</th>
                    <th>Variable</th>
                    <th>Condition</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {trigger.conditions.map((cond, idx) => (
                    <tr key={idx}>
                      <td><span className="filter-type-badge">{cond.filterType}</span></td>
                      <td><code>{cond.variable}</code></td>
                      <td><span className="condition-type-chip">{cond.type}</span></td>
                      <td><code>{cond.value}</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="modal-empty">
              <Info size={16} />
              <span>No specific filter conditions configured for this trigger.</span>
            </div>
          )}
          
          {/* Action Hint */}
          <div className="modal-action-hint">
            <AlertCircle size={14} />
            <span>This trigger is not used by any tag. Safe to remove from your container.</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TriggerDetailModal;

