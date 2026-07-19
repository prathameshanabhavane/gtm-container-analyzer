/**
 * ExportDropdown Component
 * Dropdown menu for exporting tags to CSV
 */

import { useState } from 'react';
import { Download, Tags, Filter, Check, FileDown, ChevronRight } from 'lucide-react';
import { exportToCSV } from '../../utils/csvExport';

const ExportDropdown = ({ allTags, filteredTags, hasFilters }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [exported, setExported] = useState(null);
  
  const handleExport = (type) => {
    if (type === 'all') {
      exportToCSV(allTags, 'gtm_all_tags.csv');
      setExported('all');
    } else {
      exportToCSV(filteredTags, 'gtm_filtered_tags.csv');
      setExported('filtered');
    }
    setTimeout(() => {
      setExported(null);
      setIsOpen(false);
    }, 1500);
  };
  
  return (
    <div className="export-dropdown-wrapper">
      <button 
        className={`export-dropdown-btn ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <Download size={16} />
        Export CSV
        <ChevronRight size={14} className={`chevron ${isOpen ? 'open' : ''}`} />
      </button>
      
      {isOpen && (
        <>
          <div className="export-dropdown-overlay" onClick={() => setIsOpen(false)} />
          <div className="export-dropdown-menu">
            <button 
              className={`export-option ${exported === 'all' ? 'exported' : ''}`}
              onClick={() => handleExport('all')}
            >
              <Tags size={16} />
              <div className="export-option-info">
                <span className="export-option-title">Export All Tags</span>
                <span className="export-option-count">{allTags.length} tags</span>
              </div>
              {exported === 'all' ? <Check size={16} className="check-icon" /> : <Download size={16} />}
            </button>
            
            <button 
              className={`export-option ${exported === 'filtered' ? 'exported' : ''} ${!hasFilters ? 'disabled' : ''}`}
              onClick={() => hasFilters && handleExport('filtered')}
              disabled={!hasFilters}
            >
              <Filter size={16} />
              <div className="export-option-info">
                <span className="export-option-title">Export Filtered</span>
                <span className="export-option-count">
                  {hasFilters ? `${filteredTags.length} tags` : 'No filters applied'}
                </span>
              </div>
              {exported === 'filtered' ? <Check size={16} className="check-icon" /> : <FileDown size={16} />}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default ExportDropdown;

