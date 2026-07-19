/**
 * TagsTable Component
 * Table displaying tags with pagination
 */

import { 
  Tags, Tag, Search, Layers, Target, Route, 
  Link2, HelpCircle, Sparkles, Power, Info,
  PauseCircle, PlayCircle, ExternalLink,
  ChevronLeft, ChevronRight, CircleDot
} from 'lucide-react';
import { CopyableTagName } from '../common';
import { getTagBadgeClass } from '../../utils/tagHelpers';

const TagsTable = ({ 
  tags, 
  paginatedTags,
  totalTags,
  searchQuery,
  matchInfo,
  onSelectTag,
  // Pagination props
  currentPage,
  setCurrentPage,
  itemsPerPage,
  itemsPerPageInput,
  handleItemsPerPageChange,
  totalPages,
  showingFrom,
  showingTo,
}) => {
  return (
    <div className="table-card">
      <div className="table-header">
        <h3 className="table-title">
          <Tags size={20} style={{ color: 'var(--accent-cyan)' }} />
          Tags
        </h3>
        <span className="table-count">
          <CircleDot size={14} />
          {tags.length} of {totalTags} tags
        </span>
      </div>
      
      <div className="table-wrapper">
        <table className="tags-table">
          <thead>
            <tr>
              <th><Tag size={14} /> Tag Name</th>
              {searchQuery && <th><Search size={14} /> Match Found In</th>}
              <th><Layers size={14} /> Type</th>
              <th><Target size={14} /> Trigger</th>
              <th><Route size={14} /> Conditions</th>
              <th><Power size={14} /> Status</th>
              <th><Info size={14} /> Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedTags.length > 0 ? (
              paginatedTags.map((tag) => (
                <tr key={tag.id} className={tag.paused ? 'paused-row' : ''}>
                  <td>
                    <CopyableTagName name={tag.name} />
                  </td>
                  {searchQuery && (
                    <td>
                      <div className="match-badges">
                        {matchInfo[tag.id]?.map((match, idx) => (
                          <span key={idx} className="match-badge">{match}</span>
                        ))}
                      </div>
                    </td>
                  )}
                  <td>
                    <div className="type-cell">
                      <span className={`tag-type-badge ${getTagBadgeClass(tag.typeLabel)}`}>
                        {tag.typeLabel}
                      </span>
                      {tag.tagSpecificInfo && !tag.tagSpecificInfo.includes('<script') && !tag.tagSpecificInfo.includes('<') && (
                        <div className="type-id-wrapper">
                          <span className="type-id">
                            {tag.tagSpecificInfo.length > 50 
                              ? tag.tagSpecificInfo.substring(0, 50) + '...' 
                              : tag.tagSpecificInfo}
                          </span>
                          <div className="type-id-tooltip">
                            {tag.tagSpecificInfo.split(' | ').map((item, i) => (
                              <div key={i}>{item}</div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="trigger-info">
                      <span className="trigger-name">{tag.triggerName}</span>
                      <span className="trigger-type">{tag.triggerType}</span>
                    </div>
                  </td>
                  <td>
                    <div className="conditions-cell">
                      {tag.pagePaths.length > 0 && (
                        <div className="condition-item page-path">
                          <Route size={12} />
                          <span title={tag.pagePaths.map(p => `${p.value} (${p.type})`).join(', ')}>
                            {tag.pagePaths.map(p => p.value).join(', ')}
                          </span>
                        </div>
                      )}
                      {tag.pageUrls.length > 0 && (
                        <div className="condition-item page-url">
                          <Link2 size={12} />
                          <span title={tag.pageUrls.map(p => `${p.value} (${p.type})`).join(', ')}>
                            {tag.pageUrls.map(p => p.value).join(', ')}
                          </span>
                        </div>
                      )}
                      {tag.queryParams.length > 0 && (
                        <div className="condition-item query-param">
                          <HelpCircle size={12} />
                          <span title={tag.queryParams.map(p => `${p.value} (${p.type})`).join(', ')}>
                            {tag.queryParams.map(p => p.value).join(', ')}
                          </span>
                        </div>
                      )}
                      {tag.events.length > 0 && (
                        <div className="condition-item event">
                          <Sparkles size={12} />
                          <span title={tag.events.map(e => `${e.value} (${e.type})`).join(', ')}>
                            {tag.events.map(e => e.value).join(', ')}
                          </span>
                        </div>
                      )}
                      {tag.conditions.length === 0 && tag.pagePaths.length === 0 && tag.pageUrls.length === 0 && tag.events.length === 0 && (
                        <span className="no-conditions">All Pages</span>
                      )}
                      {tag.conditions.length > 0 && tag.pagePaths.length === 0 && tag.pageUrls.length === 0 && tag.queryParams.length === 0 && tag.events.length === 0 && (
                        <span className="has-conditions">{tag.conditions.length} condition(s)</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className={`status-badge ${tag.paused ? 'paused' : 'active'}`}>
                      {tag.paused ? <PauseCircle size={14} /> : <PlayCircle size={14} />}
                      {tag.paused ? 'Paused' : 'Active'}
                    </span>
                  </td>
                  <td>
                    <button 
                      className="view-btn"
                      onClick={() => onSelectTag(tag)}
                      title="View Details"
                    >
                      <ExternalLink size={14} />
                      <span>Details</span>
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={searchQuery ? 7 : 6}>
                  <div className="empty-state">
                    <Search size={48} />
                    <p>No tags found matching your criteria</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {/* Pagination */}
      <div className="pagination">
        <div className="pagination-info">
          Showing {showingFrom} to {showingTo} of {tags.length}
        </div>
        <div className="items-per-page">
          <label>Show:</label>
          <input
            type="text"
            value={itemsPerPageInput}
            onChange={(e) => handleItemsPerPageChange(e.target.value)}
            placeholder="15 or all"
            className="items-per-page-input"
          />
          <span className="items-per-page-hint">items</span>
        </div>
        {totalPages > 1 && (
          <div className="pagination-buttons">
            <button 
              className="pagination-btn"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
            >
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  className={`pagination-btn ${currentPage === pageNum ? 'active' : ''}`}
                  onClick={() => setCurrentPage(pageNum)}
                >
                  {pageNum}
                </button>
              );
            })}
            <button 
              className="pagination-btn"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => p + 1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TagsTable;

