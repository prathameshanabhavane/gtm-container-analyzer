import { useState } from 'react';
import { 
  ChevronDown, ChevronRight,
  Tag, Zap, Variable, Filter, Settings,
  GitBranch, Plus, Minus, Search, Copy, Check
} from 'lucide-react';
import './DependencyTree.css';

// Copyable Name Component for Tree
const CopyableName = ({ name, className = '' }) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(name);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };
  
  return (
    <div className={`tree-copyable-name ${className}`}>
      <span className="tree-copyable-text" title={name}>{name}</span>
      <button 
        className={`tree-copy-btn ${copied ? 'copied' : ''}`}
        onClick={handleCopy}
        title={copied ? 'Copied!' : 'Copy tag name'}
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </button>
    </div>
  );
};

// Dependency Tree Component
// Receives pre-filtered tags from parent - no local filtering needed
const DependencyTree = ({ tags }) => {
  const [expandedTags, setExpandedTags] = useState(new Set());

  const toggleTag = (tagId) => {
    setExpandedTags(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tagId)) {
        newSet.delete(tagId);
      } else {
        newSet.add(tagId);
      }
      return newSet;
    });
  };

  const expandAll = () => {
    const allTagIds = new Set(tags.map(t => t.id));
    setExpandedTags(allTagIds);
  };

  const collapseAll = () => {
    setExpandedTags(new Set());
  };

  // Get variables used by a tag
  const getTagVariables = (tag) => {
    if (!tag) return [];
    const variables = new Set();
    
    try {
      const extractVars = (str) => {
        if (typeof str !== 'string') return;
        const matches = str.match(/\{\{([^}]+)\}\}/g) || [];
        matches.forEach(m => variables.add(m.replace(/\{\{|\}\}/g, '')));
      };
      
      if (tag.parameters) extractVars(tag.parameters);
      if (tag.allParams) extractVars(tag.allParams);
      if (tag.tagSpecificInfo) extractVars(tag.tagSpecificInfo);
      
      if (tag.queryParams && Array.isArray(tag.queryParams)) {
        tag.queryParams.forEach(qp => {
          if (qp && qp.variable) variables.add(qp.variable.replace(/\{\{|\}\}/g, ''));
          if (qp && qp.value) extractVars(qp.value);
        });
      }
      
      if (tag.conditions && Array.isArray(tag.conditions)) {
        tag.conditions.forEach(cond => {
          if (cond.variable) extractVars(cond.variable);
          if (cond.value) extractVars(cond.value);
        });
      }
    } catch (e) {
      console.warn('Error extracting variables from tag:', tag.name, e);
    }
    
    return Array.from(variables).filter(v => v && v.trim());
  };

  return (
    <div className="dependency-tree-card">
      <div className="dependency-tree-header">
        <div className="dependency-tree-title">
          <GitBranch size={18} />
          <span>Tag Dependency Tree</span>
          <span className="tree-count">{tags.length} tags</span>
        </div>
        <div className="dependency-tree-actions">
          <button className="tree-action-btn" onClick={expandAll} title="Expand All">
            <Plus size={14} />
          </button>
          <button className="tree-action-btn" onClick={collapseAll} title="Collapse All">
            <Minus size={14} />
          </button>
        </div>
      </div>
      
      <div className="dependency-tree-content">
        {tags.map(tag => {
          const isExpanded = expandedTags.has(tag.id);
          const variables = getTagVariables(tag);
          const hasConditions = tag.conditions && tag.conditions.length > 0;
          const hasVariables = variables.length > 0;
          // Every tag has at least trigger info, so always expandable
          const hasInfo = true;
          
          return (
            <div key={tag.id} className="tree-node tag-node">
              <div 
                className={`tree-node-header ${isExpanded ? 'expanded' : ''} ${tag.paused ? 'paused' : ''}`}
                onClick={() => toggleTag(tag.id)}
              >
                <span className="tree-toggle">
                  {hasInfo && (
                    isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                  )}
                </span>
                <Tag size={14} className="tree-icon tag-icon" />
                <CopyableName name={tag.name} className="tree-node-name" />
                <div className="tree-node-meta">
                  <span className="tree-node-type">{tag.typeLabel || tag.type}</span>
                  {tag.paused && <span className="tree-paused-badge">Paused</span>}
                  {hasConditions && <span className="tree-condition-count">{tag.conditions.length} conditions</span>}
                  {hasVariables && <span className="tree-var-count">{variables.length} vars</span>}
                </div>
              </div>
              
              {isExpanded && hasInfo && (
                <div className="tree-expanded-content">
                  {/* Tag Configuration */}
                  {tag.tagSpecificInfo && (
                    <div className="tree-branch">
                      <div className="tree-branch-line"></div>
                      <div className="tree-branch-content config-branch">
                        <Settings size={14} className="branch-icon config-icon" />
                        <div className="branch-details">
                          <span className="branch-label">Configuration</span>
                          <span className="branch-value">{tag.tagSpecificInfo}</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Trigger Branch */}
                  <div className="tree-branch">
                    <div className="tree-branch-line"></div>
                    <div className="tree-branch-content trigger-branch">
                      <Zap size={14} className="branch-icon trigger-icon" />
                      <div className="branch-details">
                        <span className="branch-label">Trigger</span>
                        <div className="branch-value-row">
                          <strong>{tag.triggerName || 'All Pages'}</strong>
                          <span className="trigger-type-badge">{tag.triggerType}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Filter Conditions as sub-branches */}
                    {hasConditions && (
                      <div className="tree-sub-branches">
                        <div className="sub-branch-label">
                          <Filter size={10} />
                          <span>Filter Conditions</span>
                        </div>
                        {tag.conditions.map((cond, cIdx) => (
                          <div key={cIdx} className="tree-sub-branch">
                            <div className="sub-branch-line"></div>
                            <div className="sub-branch-content">
                              <span className="cond-var">{cond.variable}</span>
                              <span className="cond-op">{cond.operator}</span>
                              <span className="cond-val">{cond.value}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Variables Branch */}
                  {hasVariables && (
                    <div className="tree-branch last-branch">
                      <div className="tree-branch-line"></div>
                      <div className="tree-branch-content variable-branch">
                        <Variable size={14} className="branch-icon variable-icon" />
                        <div className="branch-details">
                          <span className="branch-label">Variables <span className="var-count">({variables.length})</span></span>
                        </div>
                      </div>
                      <div className="tree-sub-branches variables-list">
                        {variables.map((varName, idx) => (
                          <div key={idx} className="tree-sub-branch var-sub-branch">
                            <div className="sub-branch-line"></div>
                            <span className="tree-var-chip">
                              {`{{${varName}}}`}
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
        
        {tags.length === 0 && (
          <div className="tree-empty">
            <Search size={20} />
            <span>No tags found matching your filters</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default DependencyTree;

