/**
 * TagDetailPanel Component
 * Side panel showing detailed tag information
 */

import { 
  X, Tag, Layers, Target, Activity, Route, Link2, 
  HelpCircle, Sparkles, Settings, FileCode, Power,
  PauseCircle, PlayCircle, Play, Hash
} from 'lucide-react';
import { CopyableCodeBlock } from '../common';
import { getTagBadgeClass } from '../../utils/tagHelpers';

const TagDetailPanel = ({ tag, onClose }) => {
  if (!tag) return null;
  
  return (
    <>
      <div className="side-panel-overlay" onClick={onClose} />
      <div className="side-panel">
        <div className="side-panel-header">
          <h3 className="side-panel-title">
            <Tag size={18} style={{ color: 'var(--accent-cyan)', flexShrink: 0 }} />
            {tag.name}
          </h3>
          <button className="side-panel-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="side-panel-body">
          <div className="detail-section">
            <div className="detail-label">
              <Layers size={14} />
              Tag Type
            </div>
            <div className="detail-value">
              <span className={`tag-type-badge ${getTagBadgeClass(tag.typeLabel)}`}>
                {tag.typeLabel}
              </span>
            </div>
          </div>
          
          <div className="detail-section">
            <div className="detail-label">
              <Target size={14} />
              Trigger
            </div>
            <div className="detail-value">{tag.triggerName}</div>
          </div>
          
          <div className="detail-section">
            <div className="detail-label">
              <Activity size={14} />
              Trigger Type
            </div>
            <div className="detail-value">{tag.triggerType}</div>
          </div>
          
          {/* Trigger Conditions Section */}
          {tag.conditions.length > 0 && (
            <div className="detail-section">
              <div className="detail-label">
                <Route size={14} />
                Trigger Conditions ({tag.conditions.length})
              </div>
              <div className="conditions-list">
                {tag.conditions.map((condition, idx) => (
                  <div key={idx} className={`condition-card ${condition.category.toLowerCase().replace(' ', '-')}`}>
                    <div className="condition-header">
                      <span className="condition-category">{condition.category}</span>
                      <span className={`condition-type ${condition.typeStyle}`}>{condition.typeLabel}</span>
                    </div>
                    <div className="condition-details">
                      <div className="condition-variable">{condition.variable}</div>
                      <div className="condition-operator">{condition.typeLabel}</div>
                      <div className="condition-value">{condition.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Page Paths */}
          {tag.pagePaths.length > 0 && (
            <div className="detail-section">
              <div className="detail-label">
                <Route size={14} />
                Page Paths
              </div>
              <div className="paths-list">
                {tag.pagePaths.map((path, idx) => (
                  <div key={idx} className="path-item">
                    <span className="path-value">{path.value}</span>
                    <span className="path-type">{path.type}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Page URLs */}
          {tag.pageUrls.length > 0 && (
            <div className="detail-section">
              <div className="detail-label">
                <Link2 size={14} />
                Page URLs
              </div>
              <div className="paths-list">
                {tag.pageUrls.map((url, idx) => (
                  <div key={idx} className="path-item page-url">
                    <span className="path-value">{url.value}</span>
                    <span className="path-type">{url.type}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Query Params */}
          {tag.queryParams.length > 0 && (
            <div className="detail-section">
              <div className="detail-label">
                <HelpCircle size={14} />
                Query Parameters
              </div>
              <div className="paths-list">
                {tag.queryParams.map((param, idx) => (
                  <div key={idx} className="path-item query-param">
                    <span className="path-value">{param.value}</span>
                    <span className="path-type">{param.type}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Custom Events */}
          {tag.events.length > 0 && (
            <div className="detail-section">
              <div className="detail-label">
                <Sparkles size={14} />
                Custom Events
              </div>
              <div className="events-list">
                {tag.events.map((event, idx) => (
                  <div key={idx} className="event-item">
                    <span className="event-value">{event.value}</span>
                    <span className="event-type">{event.type}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {tag.parameters && (
            <div className="detail-section">
              <div className="detail-label">
                <Settings size={14} />
                Parameters
              </div>
              <CopyableCodeBlock content={tag.parameters} label="parameters" />
            </div>
          )}
          
          {tag.tagSpecificInfo && (
            <div className="detail-section">
              <div className="detail-label">
                <FileCode size={14} />
                Tag Information / Script
              </div>
              <CopyableCodeBlock content={tag.tagSpecificInfo} label="script" />
            </div>
          )}
          
          <div className="detail-section">
            <div className="detail-label">
              <Power size={14} />
              Status
            </div>
            <div className="detail-value">
              <span className={`status-badge ${tag.paused ? 'paused' : 'active'}`}>
                {tag.paused ? <PauseCircle size={14} /> : <PlayCircle size={14} />}
                {tag.paused ? 'Paused' : 'Active'}
              </span>
            </div>
          </div>
          
          <div className="detail-section">
            <div className="detail-label">
              <Play size={14} />
              Firing Option
            </div>
            <div className="detail-value">{tag.firingOption}</div>
          </div>
          
          <div className="detail-section">
            <div className="detail-label">
              <Hash size={14} />
              Tag ID
            </div>
            <div className="detail-value" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              {tag.id}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default TagDetailPanel;

