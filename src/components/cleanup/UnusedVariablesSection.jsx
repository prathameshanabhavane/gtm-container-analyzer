/**
 * UnusedVariablesSection Component
 * Section showing unused variables detection results
 */

import { Variable, ChevronDown, Tag, Check } from 'lucide-react';
import { CopyableName } from '../common';

const UnusedVariablesSection = ({ 
  unusedVariables, 
  showUnusedVars, 
  setShowUnusedVars,
  onSelectVariable,
  selectedVariables,
  onToggleVariable
}) => {
  if (unusedVariables.stats.unusedCount === 0) return null;

  return (
    <div className="cleanup-item unused-vars-alert-section">
      <div 
        className={`unused-vars-alert ${showUnusedVars ? 'expanded' : ''}`}
        onClick={() => setShowUnusedVars(!showUnusedVars)}
      >
        <div className="unused-vars-alert-header">
          <div className="unused-vars-alert-icon">
            <Variable size={20} />
          </div>
          <div className="unused-vars-alert-info">
            <span className="unused-vars-alert-title">
              {unusedVariables.stats.unusedCount} Unused Variable{unusedVariables.stats.unusedCount > 1 ? 's' : ''} Found
            </span>
            <span className="unused-vars-alert-subtitle">
              {unusedVariables.stats.unusedPercentage}% of variables are not used • Consider cleanup
            </span>
          </div>
          <ChevronDown size={20} className={`unused-vars-chevron ${showUnusedVars ? 'open' : ''}`} />
        </div>
      </div>
      
      {showUnusedVars && (
        <div className="unused-vars-panel">
          <div className="unused-vars-grid">
            {unusedVariables.unused.map((variable) => (
              <div 
                key={variable.variableId} 
                className={`unused-var-card ${selectedVariables.has(variable.variableId) ? 'selected-for-removal' : ''}`}
                onClick={() => onSelectVariable(variable)}
              >
                <div className="unused-var-header">
                  <div className="cleanup-checkbox-wrapper" onClick={(e) => e.stopPropagation()}>
                    <input 
                      type="checkbox" 
                      checked={selectedVariables.has(variable.variableId)} 
                      onChange={() => onToggleVariable(variable.variableId)}
                      className="cleanup-checkbox"
                      id={`var-checkbox-${variable.variableId}`}
                    />
                  </div>
                  <CopyableName 
                    name={variable.name} 
                    icon={Variable} 
                    iconSize={14}
                    className="unused-var-name"
                  />
                  <div className="unused-var-badge">
                    Unused
                  </div>
                </div>
                <div className="unused-var-type">
                  <Tag size={12} />
                  <span>{variable.typeLabel}</span>
                </div>
              </div>
            ))}
          </div>
          
          {unusedVariables.used.length > 0 && (
            <div className="used-vars-summary">
              <div className="used-vars-header">
                <Check size={14} />
                <span>{unusedVariables.stats.usedCount} variables are in use</span>
              </div>
              <div className="used-vars-top">
                {unusedVariables.used.slice(0, 5).map((v) => (
                  <span key={v.variableId} className="used-var-chip" title={`Used ${v.usageCount} time${v.usageCount > 1 ? 's' : ''}`}>
                    {v.name} ({v.usageCount})
                  </span>
                ))}
                {unusedVariables.used.length > 5 && (
                  <span className="used-var-more">+{unusedVariables.used.length - 5} more</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UnusedVariablesSection;

