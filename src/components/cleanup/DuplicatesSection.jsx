/**
 * DuplicatesSection Component
 * Section showing duplicate tags detection results
 */

import { 
  AlertTriangle, AlertCircle, Users, ChevronDown, 
  PauseCircle, Eye 
} from 'lucide-react';
import { CopyableName } from '../common';

const DuplicatesSection = ({ 
  duplicateTags, 
  showDuplicates, 
  setShowDuplicates,
  processedTags,
  onSelectTag,
  selectedTags,
  onToggleTag
}) => {
  if (duplicateTags.length === 0) return null;

  return (
    <div className="cleanup-item duplicates-alert-section">
      <div 
        className={`duplicates-alert ${showDuplicates ? 'expanded' : ''}`}
        onClick={() => setShowDuplicates(!showDuplicates)}
      >
        <div className="duplicates-alert-header">
          <div className="duplicates-alert-icon">
            <AlertTriangle size={20} />
          </div>
          <div className="duplicates-alert-info">
            <span className="duplicates-alert-title">
              {duplicateTags.length} Exact Duplicate Group{duplicateTags.length > 1 ? 's' : ''} Found
            </span>
            <span className="duplicates-alert-subtitle">
              {duplicateTags.reduce((sum, g) => sum + g.tags.length, 0)} tags with identical configuration
            </span>
          </div>
          <ChevronDown size={20} className={`duplicates-chevron ${showDuplicates ? 'open' : ''}`} />
        </div>
      </div>
      
      {showDuplicates && (
        <div className="duplicates-panel">
          <div className="duplicates-grid">
            {duplicateTags.map((group) => (
              <div key={group.id} className="duplicate-group-card">
                <div className="duplicate-group-header">
                  <div className="duplicate-group-type">
                    <Users size={16} />
                    <span>{group.type}</span>
                  </div>
                  <div className="similarity-badge exact">
                    🔴 Exact Duplicate
                  </div>
                </div>
                <div className="duplicate-reason">
                  <AlertCircle size={14} />
                  <span>{group.reason}</span>
                </div>
                <div className="duplicate-tags-list">
                  {group.tags.map((tag, idx) => (
                    <div key={tag.id} className={`duplicate-tag-item ${tag.paused ? 'paused' : ''} ${selectedTags.has(tag.id) ? 'selected-for-removal' : ''}`}>
                      <div className="cleanup-checkbox-wrapper" onClick={(e) => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          checked={selectedTags.has(tag.id)} 
                          onChange={() => onToggleTag(tag.id)}
                          className="cleanup-checkbox"
                          id={`tag-checkbox-${tag.id}`}
                        />
                      </div>
                      <span className="duplicate-tag-num">{idx + 1}</span>
                      <CopyableName 
                        name={tag.name} 
                        className="duplicate-tag-name"
                      />
                      {tag.paused && (
                        <span className="duplicate-tag-paused">
                          <PauseCircle size={12} />
                        </span>
                      )}
                      <button 
                        className="duplicate-tag-view"
                        onClick={(e) => {
                          e.stopPropagation();
                          const fullTag = processedTags.find(t => t.id === tag.id);
                          if (fullTag) onSelectTag(fullTag);
                        }}
                      >
                        <Eye size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DuplicatesSection;

