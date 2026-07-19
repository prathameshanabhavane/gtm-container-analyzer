/**
 * SearchableSelect Component
 * Single-select dropdown with search capability
 */

import { useState, useEffect, useRef } from 'react';
import { Search, X, ChevronDown } from 'lucide-react';

const SearchableSelect = ({ 
  options, 
  value, 
  onChange, 
  placeholder = "All", 
  icon: Icon,
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef(null);
  const optionsRef = useRef(null);
  
  // Filter options based on search
  const filteredOptions = options.filter(opt => 
    opt.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // All options including the "All" placeholder option
  const allOptions = ['', ...filteredOptions];
  
  // Get display label
  const displayLabel = value || placeholder;
  
  // Reset highlighted index when search changes or dropdown opens
  useEffect(() => {
    if (isOpen) {
      // Find index of current value
      const currentIndex = allOptions.findIndex(opt => opt === value);
      setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0);
    }
  }, [isOpen, searchTerm, value, allOptions]);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearchTerm('');
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Scroll highlighted option into view
  useEffect(() => {
    if (highlightedIndex >= 0 && optionsRef.current) {
      const options = optionsRef.current.querySelectorAll('.dropdown-option');
      if (options[highlightedIndex]) {
        options[highlightedIndex].scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);
  
  const handleSelect = (opt) => {
    onChange(opt);
    setIsOpen(false);
    setSearchTerm('');
    setHighlightedIndex(-1);
  };
  
  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < allOptions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : allOptions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < allOptions.length) {
          handleSelect(allOptions[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSearchTerm('');
        setHighlightedIndex(-1);
        break;
      default:
        break;
    }
  };
  
  return (
    <div className={`searchable-select ${className}`} ref={dropdownRef}>
      <button 
        className={`searchable-select-btn ${isOpen ? 'open' : ''} ${value ? 'has-value' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
      >
        {Icon && <Icon size={16} className="select-icon" />}
        <span className="select-label">{displayLabel}</span>
        <ChevronDown size={14} className={`select-chevron ${isOpen ? 'open' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="searchable-dropdown">
          {options.length > 5 && (
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
          <div className="dropdown-options" ref={optionsRef}>
            <button 
              className={`dropdown-option ${!value ? 'selected' : ''} ${highlightedIndex === 0 ? 'highlighted' : ''}`}
              onClick={() => handleSelect('')}
              onMouseEnter={() => setHighlightedIndex(0)}
            >
              {placeholder}
            </button>
            {filteredOptions.map((opt, idx) => (
              <button 
                key={opt}
                className={`dropdown-option ${value === opt ? 'selected' : ''} ${highlightedIndex === idx + 1 ? 'highlighted' : ''}`}
                onClick={() => handleSelect(opt)}
                onMouseEnter={() => setHighlightedIndex(idx + 1)}
              >
                {opt}
              </button>
            ))}
            {filteredOptions.length === 0 && searchTerm && (
              <div className="dropdown-no-results">No results found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;

