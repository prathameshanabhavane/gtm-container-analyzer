/**
 * MultiSelectFilter Component
 * Multi-select dropdown filter with search capability
 * Supports both flat options ['a', 'b'] and grouped options [{type: 'header', label: '...'}, {type: 'option', label: '...'}]
 */

import { useState, useEffect, useRef } from 'react';
import { Search, X, Check, ChevronDown } from 'lucide-react';

const MultiSelectFilter = ({ 
  options, 
  values = [], 
  onChange, 
  placeholder = "All", 
  icon: Icon,
  className = "",
  optionMeta = null // Optional: array of { value, tooltip, source } for enhanced options
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const dropdownRef = useRef(null);
  const optionsRef = useRef(null);
  
  // Check if options are grouped (objects) or flat (strings)
  const isGrouped = options.length > 0 && typeof options[0] === 'object';
  
  // Get flat list of selectable options (excluding headers)
  const selectableOptions = isGrouped 
    ? options.filter(opt => opt.type === 'option').map(opt => opt.label)
    : options;
  
  // Filter options based on search
  const filteredOptions = isGrouped
    ? options.filter(opt => {
        if (opt.type === 'header') return true; // Keep headers
        return opt.label.toLowerCase().includes(searchTerm.toLowerCase());
      }).filter((opt, idx, arr) => {
        // Remove headers that have no options following them
        if (opt.type === 'header') {
          const nextIdx = idx + 1;
          return nextIdx < arr.length && arr[nextIdx].type === 'option';
        }
        return true;
      })
    : options.filter(opt => opt.toLowerCase().includes(searchTerm.toLowerCase()));
  
  // Get only selectable (non-header) filtered options for keyboard navigation
  const selectableFilteredOptions = isGrouped
    ? filteredOptions.filter(opt => opt.type === 'option').map(opt => opt.label)
    : filteredOptions;
  
  // Get metadata for an option if available
  const getOptionMeta = (opt) => {
    if (!optionMeta) return null;
    return optionMeta.find(m => m.value === opt);
  };
  
  // Get display label
  const getDisplayLabel = () => {
    if (values.length === 0) return placeholder;
    if (values.length === 1) return values[0];
    return `${values.length} selected`;
  };
  
  // Reset highlighted index when search changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchTerm]);
  
  // Scroll highlighted option into view
  useEffect(() => {
    if (highlightedIndex >= 0 && optionsRef.current) {
      const options = optionsRef.current.querySelectorAll('.dropdown-option-checkbox');
      if (options[highlightedIndex]) {
        options[highlightedIndex].scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearchTerm('');
        setHighlightedIndex(0);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const toggleOption = (opt) => {
    if (values.includes(opt)) {
      onChange(values.filter(v => v !== opt));
    } else {
      onChange([...values, opt]);
    }
  };
  
  const clearAll = (e) => {
    e.stopPropagation();
    onChange([]);
  };
  
  const selectAll = (e) => {
    e.stopPropagation();
    onChange([...selectableFilteredOptions]);
  };
  
  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < selectableFilteredOptions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : selectableFilteredOptions.length - 1
        );
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < selectableFilteredOptions.length) {
          toggleOption(selectableFilteredOptions[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSearchTerm('');
        setHighlightedIndex(0);
        break;
      default:
        break;
    }
  };
  
  return (
    <div className={`multi-select-filter ${className}`} ref={dropdownRef}>
      <button 
        className={`multi-select-btn ${isOpen ? 'open' : ''} ${values.length > 0 ? 'has-value' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
      >
        {Icon && <Icon size={16} className="select-icon" />}
        <span className="select-label">{getDisplayLabel()}</span>
        {values.length > 0 && (
          <span className="select-count">{values.length}</span>
        )}
        <ChevronDown size={14} className={`select-chevron ${isOpen ? 'open' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="multi-select-dropdown">
          {selectableOptions.length > 5 && (
            <div className="dropdown-search">
              <Search size={14} />
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
              {searchTerm && (
                <button 
                  className="dropdown-search-clear"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearchTerm('');
                  }}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          )}
          
          <div className="multi-select-actions">
            <button 
              className="multi-action-btn"
              onClick={selectAll}
              disabled={selectableFilteredOptions.length === values.length}
            >
              Select All
            </button>
            <button 
              className="multi-action-btn"
              onClick={clearAll}
              disabled={values.length === 0}
            >
              Clear
            </button>
          </div>
          
          <div className="dropdown-options" ref={optionsRef}>
            {isGrouped ? (
              // Grouped options with headers
              filteredOptions.map((item, idx) => {
                if (item.type === 'header') {
                  return (
                    <div key={`header-${idx}`} className="dropdown-group-header">
                      {item.label}
                    </div>
                  );
                }
                const opt = item.label;
                const selectableIdx = selectableFilteredOptions.indexOf(opt);
                const meta = getOptionMeta(opt);
                return (
                  <label 
                    key={opt}
                    className={`dropdown-option-checkbox ${values.includes(opt) ? 'selected' : ''} ${highlightedIndex === selectableIdx ? 'highlighted' : ''}`}
                    onMouseEnter={() => setHighlightedIndex(selectableIdx)}
                    title={meta?.tooltip || opt}
                  >
                    <input
                      type="checkbox"
                      checked={values.includes(opt)}
                      onChange={() => toggleOption(opt)}
                    />
                    <span className="checkbox-custom">
                      {values.includes(opt) && <Check size={12} />}
                    </span>
                    <span className="option-label">
                      {meta?.displayLabel || opt}
                    </span>
                    {meta?.badgeText && (
                      <span 
                        className={`option-source-badge ${meta.source || ''}`}
                        title={meta.tooltip}
                      >
                        {meta.badgeText}
                      </span>
                    )}
                    {meta?.source && !meta?.badgeText && (
                      <span 
                        className={`option-source-badge ${meta.source}`}
                        title={meta.tooltip}
                      >
                        {meta.source === 'both' ? 'Path & URL' : 
                         meta.source === 'path' ? 'Path' : 
                         meta.source === 'url' ? 'URL' : meta.source}
                      </span>
                    )}
                  </label>
                );
              })
            ) : (
              // Flat options (legacy)
              filteredOptions.map((opt, idx) => {
                const meta = getOptionMeta(opt);
                return (
                  <label 
                    key={opt}
                    className={`dropdown-option-checkbox ${values.includes(opt) ? 'selected' : ''} ${highlightedIndex === idx ? 'highlighted' : ''}`}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    title={meta?.tooltip || opt}
                  >
                    <input
                      type="checkbox"
                      checked={values.includes(opt)}
                      onChange={() => toggleOption(opt)}
                    />
                    <span className="checkbox-custom">
                      {values.includes(opt) && <Check size={12} />}
                    </span>
                    <span className="option-label">
                      {meta?.displayLabel || opt}
                    </span>
                    {meta?.badgeText && (
                      <span 
                        className={`option-source-badge ${meta.source || ''}`}
                        title={meta.tooltip}
                      >
                        {meta.badgeText}
                      </span>
                    )}
                    {meta?.source && !meta?.badgeText && (
                      <span 
                        className={`option-source-badge ${meta.source}`}
                        title={meta.tooltip}
                      >
                        {meta.source === 'both' ? 'Path & URL' : 
                         meta.source === 'path' ? 'Path' : 
                         meta.source === 'url' ? 'URL' : meta.source}
                      </span>
                    )}
                  </label>
                );
              })
            )}
            {selectableFilteredOptions.length === 0 && searchTerm && (
              <div className="dropdown-no-results">No results found</div>
            )}
          </div>
          
          {values.length > 0 && (
            <div className="selected-tags">
              {values.slice(0, 3).map(v => {
                const meta = getOptionMeta(v);
                return (
                  <span key={v} className="selected-tag" title={meta?.tooltip}>
                    {v.length > 20 ? v.substring(0, 20) + '...' : v}
                    <button onClick={(e) => { e.stopPropagation(); toggleOption(v); }}>
                      <X size={10} />
                    </button>
                  </span>
                );
              })}
              {values.length > 3 && (
                <span className="selected-tag more">+{values.length - 3} more</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MultiSelectFilter;

