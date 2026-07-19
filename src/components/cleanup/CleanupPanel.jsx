/**
 * CleanupPanel Component
 * Collapsible panel showing container cleanup suggestions
 */

import { useState } from 'react';
import { Sparkles, X, ChevronUp, ChevronDown, Download } from 'lucide-react';
import DuplicatesSection from './DuplicatesSection';
import UnusedVariablesSection from './UnusedVariablesSection';
import OrphanTriggersSection from './OrphanTriggersSection';
import VariableDetailModal from './VariableDetailModal';
import TriggerDetailModal from './TriggerDetailModal';
import { generateCleanContainer, downloadJSON } from '../../utils';

const CleanupPanel = ({ 
  rawGTMData,
  duplicateTags, 
  unusedVariables, 
  orphanTriggers,
  processedTags,
  showCleanupPanel,
  setShowCleanupPanel,
  onSelectTag,
}) => {
  const [cleanupExpanded, setCleanupExpanded] = useState(true);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [showUnusedVars, setShowUnusedVars] = useState(false);
  const [showOrphanTriggers, setShowOrphanTriggers] = useState(false);
  const [selectedVariable, setSelectedVariable] = useState(null);
  const [selectedTrigger, setSelectedTrigger] = useState(null);

  // Selections state
  const [selectedTags, setSelectedTags] = useState(new Set());
  const [selectedVariables, setSelectedVariables] = useState(new Set());
  const [selectedTriggers, setSelectedTriggers] = useState(new Set());
  const [prevContainerId, setPrevContainerId] = useState(null);

  const containerId = rawGTMData?.containerVersion?.container?.publicId || null;

  // Initialize/reset default selections reactive to data load
  if (containerId !== prevContainerId) {
    const initialTags = new Set();
    duplicateTags.forEach(group => {
      // By default, keep the first/original tag, select other duplicates for deletion
      group.tags.slice(1).forEach(tag => {
        initialTags.add(tag.id);
      });
    });

    const initialVars = new Set();
    if (unusedVariables?.unused) {
      unusedVariables.unused.forEach(v => {
        initialVars.add(v.variableId);
      });
    }

    const initialTriggers = new Set();
    if (orphanTriggers?.orphan) {
      orphanTriggers.orphan.forEach(t => {
        initialTriggers.add(t.id);
      });
    }

    setSelectedTags(initialTags);
    setSelectedVariables(initialVars);
    setSelectedTriggers(initialTriggers);
    setPrevContainerId(containerId);
  }

  const handleToggleTag = (tagId) => {
    setSelectedTags(prev => {
      const next = new Set(prev);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return next;
    });
  };

  const handleToggleVariable = (varId) => {
    setSelectedVariables(prev => {
      const next = new Set(prev);
      if (next.has(varId)) {
        next.delete(varId);
      } else {
        next.add(varId);
      }
      return next;
    });
  };

  const handleToggleTrigger = (triggerId) => {
    setSelectedTriggers(prev => {
      const next = new Set(prev);
      if (next.has(triggerId)) {
        next.delete(triggerId);
      } else {
        next.add(triggerId);
      }
      return next;
    });
  };

  const handleExport = () => {
    if (!rawGTMData) return;
    
    const cleaned = generateCleanContainer(
      rawGTMData,
      selectedTags,
      selectedTriggers,
      selectedVariables
    );
    
    const containerIdName = rawGTMData.containerVersion?.container?.publicId || 'GTM-XXXXXX';
    const filename = `${containerIdName}_optimized.json`;
    downloadJSON(cleaned, filename);
  };

  const hasIssues = duplicateTags.length > 0 || 
                   unusedVariables.stats.unusedCount > 0 || 
                   orphanTriggers.stats.orphanCount > 0;

  const totalSelectedCount = selectedTags.size + selectedVariables.size + selectedTriggers.size;

  if (!showCleanupPanel || !hasIssues) return null;

  return (
    <>
      <div id="cleanup-section" className="cleanup-panel-floating">
        <button 
          className={`cleanup-panel-header ${cleanupExpanded ? 'expanded' : 'collapsed'}`}
          onClick={() => setCleanupExpanded(!cleanupExpanded)}
        >
          <Sparkles size={16} />
          <span className="cleanup-panel-title">Container Cleanup</span>
          <div className="cleanup-header-stats">
            {duplicateTags.length > 0 && <span className="mini-stat">{duplicateTags.length} Duplicates</span>}
            {unusedVariables.stats.unusedCount > 0 && <span className="mini-stat">{unusedVariables.stats.unusedCount} Variables</span>}
            {orphanTriggers.stats.orphanCount > 0 && <span className="mini-stat">{orphanTriggers.stats.orphanCount} Triggers</span>}
          </div>
          <div className="cleanup-header-actions">
            <span 
              className="cleanup-panel-close" 
              onClick={(e) => { e.stopPropagation(); setShowCleanupPanel(false); }}
              title="Close panel"
            >
              <X size={16} />
            </span>
            <span className="cleanup-chevron">
              {cleanupExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </span>
          </div>
        </button>
        
        {cleanupExpanded && (
          <div className="cleanup-panel">
            <DuplicatesSection 
              duplicateTags={duplicateTags}
              showDuplicates={showDuplicates}
              setShowDuplicates={setShowDuplicates}
              processedTags={processedTags}
              onSelectTag={onSelectTag}
              selectedTags={selectedTags}
              onToggleTag={handleToggleTag}
            />
            
            <UnusedVariablesSection 
              unusedVariables={unusedVariables}
              showUnusedVars={showUnusedVars}
              setShowUnusedVars={setShowUnusedVars}
              onSelectVariable={setSelectedVariable}
              selectedVariables={selectedVariables}
              onToggleVariable={handleToggleVariable}
            />
            
            <OrphanTriggersSection 
              orphanTriggers={orphanTriggers}
              showOrphanTriggers={showOrphanTriggers}
              setShowOrphanTriggers={setShowOrphanTriggers}
              onSelectTrigger={setSelectedTrigger}
              selectedTriggers={selectedTriggers}
              onToggleTrigger={handleToggleTrigger}
            />

            <div className="cleanup-panel-footer">
              <div className="cleanup-footer-summary">
                Selected for removal: <strong className="cleanup-count-badge">{totalSelectedCount} items</strong>
              </div>
              <button 
                onClick={handleExport}
                className="cleanup-export-btn"
                disabled={totalSelectedCount === 0}
              >
                <Download size={14} />
                <span>Export Cleaned GTM Container</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Variable Detail Modal */}
      <VariableDetailModal 
        variable={selectedVariable} 
        onClose={() => setSelectedVariable(null)} 
      />

      {/* Trigger Detail Modal */}
      <TriggerDetailModal 
        trigger={selectedTrigger} 
        onClose={() => setSelectedTrigger(null)} 
      />
    </>
  );
};

export default CleanupPanel;

