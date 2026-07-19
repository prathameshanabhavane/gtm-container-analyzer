/**
 * OrphanTriggersSection Component
 * Section showing orphan triggers (not used by any tag)
 */

import { Target, ChevronDown, Layers, Settings, Check } from 'lucide-react';
import { CopyableName } from '../common';

const OrphanTriggersSection = ({ 
  orphanTriggers, 
  showOrphanTriggers, 
  setShowOrphanTriggers,
  onSelectTrigger,
  selectedTriggers,
  onToggleTrigger
}) => {
  if (orphanTriggers.stats.orphanCount === 0) return null;

  return (
    <div className="cleanup-item orphan-triggers-alert-section">
      <div 
        className={`orphan-triggers-alert ${showOrphanTriggers ? 'expanded' : ''}`}
        onClick={() => setShowOrphanTriggers(!showOrphanTriggers)}
      >
        <div className="orphan-triggers-alert-header">
          <div className="orphan-triggers-alert-icon">
            <Target size={20} />
          </div>
          <div className="orphan-triggers-alert-info">
            <span className="orphan-triggers-alert-title">
              {orphanTriggers.stats.orphanCount} Unused Trigger{orphanTriggers.stats.orphanCount > 1 ? 's' : ''} Found
            </span>
            <span className="orphan-triggers-alert-subtitle">
              {orphanTriggers.stats.orphanPercentage}% of triggers are not used by any tag • Safe to remove
            </span>
          </div>
          <ChevronDown size={20} className={`orphan-triggers-chevron ${showOrphanTriggers ? 'open' : ''}`} />
        </div>
      </div>
      
      {showOrphanTriggers && (
        <div className="orphan-triggers-panel">
          <div className="orphan-triggers-grid">
            {orphanTriggers.orphan.map((trigger) => (
              <div 
                key={trigger.id} 
                className={`orphan-trigger-card ${selectedTriggers.has(trigger.id) ? 'selected-for-removal' : ''}`}
                onClick={() => onSelectTrigger(trigger)}
              >
                <div className="orphan-trigger-header">
                  <div className="cleanup-checkbox-wrapper" onClick={(e) => e.stopPropagation()}>
                    <input 
                      type="checkbox" 
                      checked={selectedTriggers.has(trigger.id)} 
                      onChange={() => onToggleTrigger(trigger.id)}
                      className="cleanup-checkbox"
                      id={`trigger-checkbox-${trigger.id}`}
                    />
                  </div>
                  <CopyableName 
                    name={trigger.name} 
                    icon={Target} 
                    iconSize={14}
                    className="orphan-trigger-name"
                  />
                  <div className="orphan-trigger-badge">
                    Unused
                  </div>
                </div>
                <div className="orphan-trigger-type">
                  <Layers size={12} />
                  <span>{trigger.typeLabel}</span>
                </div>
                {trigger.conditions.length > 0 && (
                  <div className="orphan-trigger-conditions-count">
                    <Settings size={12} />
                    <span>{trigger.conditions.length} condition{trigger.conditions.length > 1 ? 's' : ''}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {/* Summary */}
          {orphanTriggers.used.length > 0 && (
            <div className="orphan-triggers-summary">
              <div className="summary-label">
                <Check size={14} />
                <span>Active Triggers ({orphanTriggers.used.length}):</span>
              </div>
              <div className="used-triggers-chips">
                {orphanTriggers.used.slice(0, 5).map(t => (
                  <span key={t.id} className="used-trigger-chip" title={`Used by ${t.usedByTags.length} tag${t.usedByTags.length > 1 ? 's' : ''}`}>
                    {t.name} ({t.usedByTags.length})
                  </span>
                ))}
                {orphanTriggers.used.length > 5 && (
                  <span className="used-trigger-more">+{orphanTriggers.used.length - 5} more</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OrphanTriggersSection;

