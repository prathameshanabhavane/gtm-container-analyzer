/**
 * FiltersSection Component
 * Reusable filters bar for different views
 */

import { useState } from 'react';
import { 
  Search, X, Filter, Power, MapPin, HelpCircle, 
  GitCompare, RotateCcw, Activity, Variable, Repeat, ChevronUp, ChevronDown, SlidersHorizontal
} from 'lucide-react';
import MultiSelectFilter from './MultiSelectFilter';
import SearchableSelect from './SearchableSelect';
import ExportDropdown from './ExportDropdown';

const FiltersSection = ({
  // Search
  searchQuery,
  onSearchChange,
  searchPlaceholder = "Search...",
  
  // Tag filters (optional)
  tagTypes,
  typeFilter,
  onTypeFilterChange,
  conditionTypes,
  conditionTypeFilter,
  onConditionTypeFilterChange,
  tagTriggerTypes,
  tagTriggerTypeFilter,
  onTagTriggerTypeFilterChange,
  firingOptions,
  firingOptionFilter,
  onFiringOptionFilterChange,
  statusFilter,
  onStatusFilterChange,
  
  // Trigger filters (optional)
  triggerTypeLabels,
  triggerTypeFilter,
  onTriggerTypeFilterChange,
  triggerUsageFilter,
  onTriggerUsageFilterChange,
  
  // Variable filters (optional)
  variableTypeLabels,
  variableTypeFilter,
  onVariableTypeFilterChange,
  variableUsageFilter,
  onVariableUsageFilterChange,
  variableNames,
  variableNameFilter,
  onVariableNameFilterChange,
  
  // Dynamic condition filters
  dynamicFilters,
  dynamicConditionFilters,
  updateDynamicConditionFilter,
  
  // Common
  hasActiveFilters,
  onResetFilters,
  
  // Export (optional)
  showExport = false,
  allTags,
  filteredTags,
  
  // View type
  viewType = 'tags' // 'tags', 'triggers', 'variables'
}) => {
  const [showAllFilters, setShowAllFilters] = useState(false); // Show all filters or only active
  
  // Determine which advanced filters are active
  const hasActiveTriggerTypeFilter = tagTriggerTypes && tagTriggerTypeFilter && tagTriggerTypeFilter.length > 0;
  const hasActiveConditionTypeFilter = conditionTypeFilter && conditionTypeFilter.length > 0;
  const hasActiveFiringOptionFilter = firingOptions && firingOptionFilter && firingOptionFilter.length > 0;
  const hasActiveVariableNameFilter = variableNames && variableNameFilter && variableNameFilter.length > 0;
  // Exclude "Page Path & URL" and "All Query Params" from advanced filters check
  // since these are essential filters (always visible), not advanced filters
  const hasActiveDynamicFilters = dynamicConditionFilters && 
    Object.keys(dynamicConditionFilters)
      .filter(key => key !== 'Page Path & URL' && key !== 'All Query Params')
      .some(key => dynamicConditionFilters[key] && dynamicConditionFilters[key].length > 0);
  
  // Check if any advanced filter is active
  const hasActiveAdvancedFilters = hasActiveTriggerTypeFilter || hasActiveConditionTypeFilter || hasActiveFiringOptionFilter || 
    hasActiveVariableNameFilter || hasActiveDynamicFilters;
  
  // Show advanced filters if: showAllFilters is true OR any advanced filter is active
  const shouldShowAdvancedFilters = showAllFilters || hasActiveAdvancedFilters;
  
  // Calculate count of available advanced filters
  const getAdvancedFiltersCount = () => {
    let count = 0;
    if (tagTriggerTypes && tagTriggerTypes.length > 0) count++;
    if (conditionTypes && conditionTypes.length > 0) count++;
    if (firingOptions && firingOptions.length > 0) count++;
    if (variableNames && variableNames.length > 0) count++;
    if (dynamicFilters && dynamicFilters.length > 0) {
      const otherDynamicFilters = dynamicFilters.filter(
        filter => filter.variable !== 'Page Path & URL' && filter.variable !== 'All Query Params'
      );
      count += otherDynamicFilters.length;
    }
    return count;
  };
  
  const advancedFiltersCount = getAdvancedFiltersCount();
  
  return (
    <div className="filters-section">
      <div className="search-input global-search">
        <Search />
        <input
          type="text"
          placeholder={searchPlaceholder}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        {searchQuery && (
          <button 
            className="search-clear" 
            onClick={() => onSearchChange('')}
            title="Clear search"
          >
            <X size={16} />
          </button>
        )}
      </div>
      
      {/* Tag-specific filters */}
      {viewType === 'tags' && (
        <>
          {/* Essential Filters - Most commonly used for daily analysis (Always visible) */}
          {/* 1. Tag Types - Filter by tag type (GA4, Meta Pixel, etc.) */}
          {tagTypes && tagTypes.length > 0 && (
            <MultiSelectFilter
              options={tagTypes}
              values={typeFilter}
              onChange={onTypeFilterChange}
              placeholder="All Tag Types"
              icon={Filter}
            />
          )}
          
          {/* 2. Page Path & URL - Filter by page paths and URLs (most common analysis) */}
          {dynamicFilters && dynamicFilters.length > 0 && dynamicFilters
            .filter(filter => filter.variable === 'Page Path & URL')
            .map(filter => {
              const selectedValues = dynamicConditionFilters[filter.variable] || [];
              const options = filter.values.map(v => v.value);
              const optionMeta = filter.values.map(v => {
                let tooltip = `${filter.variableDisplay}\n\nValue: ${v.value}\nCondition Type: ${v.type}${v.count > 1 ? `\nUsed ${v.count} times` : ''}`;
                let badgeVariableName = '';
                if (v.variableNames && v.variableNames.length > 0) {
                  badgeVariableName = v.variableNames.length === 1 ? v.variableNames[0] : v.variableNames.join(', ');
                } else {
                  badgeVariableName = filter.variableDisplay;
                }
                return {
                  value: v.value,
                  badgeText: badgeVariableName,
                  tooltip: tooltip,
                  source: v.source || filter.category.toLowerCase(),
                  displayLabel: v.value,
                  variableNames: v.variableNames || [],
                };
              });
              return (
                <MultiSelectFilter
                  key={filter.variable}
                  options={options}
                  values={selectedValues}
                  onChange={(values) => updateDynamicConditionFilter(filter.variable, values)}
                  placeholder={filter.variableDisplay}
                  icon={MapPin}
                  optionMeta={optionMeta}
                />
              );
            })}
          
          {/* 4. All Query Params - Filter by query parameters (UTM, custom params, etc.) */}
          {dynamicFilters && dynamicFilters.length > 0 && dynamicFilters
            .filter(filter => filter.variable === 'All Query Params')
            .map(filter => {
              const selectedValues = dynamicConditionFilters[filter.variable] || [];
              const options = filter.values.map(v => v.value);
              const optionMeta = filter.values.map(v => {
                let tooltip = `${filter.variableDisplay}\n\nValue: ${v.value}\nCondition Type: ${v.type}${v.count > 1 ? `\nUsed ${v.count} times` : ''}`;
                let badgeVariableName = '';
                if (v.variableNames && v.variableNames.length > 0) {
                  badgeVariableName = v.variableNames.length === 1 ? v.variableNames[0] : v.variableNames.join(', ');
                } else {
                  badgeVariableName = filter.variableDisplay;
                }
                return {
                  value: v.value,
                  badgeText: badgeVariableName,
                  tooltip: tooltip,
                  source: v.source || filter.category.toLowerCase(),
                  displayLabel: v.value,
                  variableNames: v.variableNames || [],
                };
              });
              return (
                <MultiSelectFilter
                  key={filter.variable}
                  options={options}
                  values={selectedValues}
                  onChange={(values) => updateDynamicConditionFilter(filter.variable, values)}
                  placeholder={filter.variableDisplay}
                  icon={HelpCircle}
                  optionMeta={optionMeta}
                />
              );
            })}
          
          {/* 5. Status - Filter by Active/Paused status */}
          <SearchableSelect
            options={['Active', 'Paused']}
            value={statusFilter ? statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1) : ''}
            onChange={(val) => onStatusFilterChange(val ? val.toLowerCase() : '')}
            placeholder="All Status"
            icon={Power}
          />
          
          {/* Advanced Filters - Show if showAllFilters is true OR any advanced filter is active */}
          {shouldShowAdvancedFilters && (
            <>
              {/* Trigger Types - Filter by trigger type (Page View, Click, Custom Event, etc.) - Moved to advanced */}
              {tagTriggerTypes && tagTriggerTypes.length > 0 && (
                <MultiSelectFilter
                  options={tagTriggerTypes.map(t => t.value)}
                  values={tagTriggerTypeFilter}
                  onChange={onTagTriggerTypeFilterChange}
                  placeholder="All Trigger Types"
                  icon={Activity}
                  optionMeta={tagTriggerTypes.map(t => ({
                    value: t.value,
                    displayLabel: t.label,
                  }))}
                />
              )}
              {conditionTypes && conditionTypes.length > 0 && (
                <MultiSelectFilter
                  options={conditionTypes}
                  values={conditionTypeFilter}
                  onChange={onConditionTypeFilterChange}
                  placeholder="All Condition Types"
                  icon={GitCompare}
                />
              )}
              
              {/* Other Dynamic Condition Filters (excluding Page Path & URL and Query Params) */}
              {dynamicFilters && dynamicFilters.length > 0 && dynamicFilters
                .filter(filter => filter.variable !== 'Page Path & URL' && filter.variable !== 'All Query Params')
                .map(filter => {
                  const selectedValues = dynamicConditionFilters[filter.variable] || [];
                  const options = filter.values.map(v => v.value);
                  const optionMeta = filter.values.map(v => {
                    let tooltip = `${filter.variableDisplay}\n\nValue: ${v.value}\nCondition Type: ${v.type}${v.count > 1 ? `\nUsed ${v.count} times` : ''}`;
                    let badgeVariableName = '';
                    if (v.variableNames && v.variableNames.length > 0) {
                      badgeVariableName = v.variableNames.length === 1 ? v.variableNames[0] : v.variableNames.join(', ');
                    } else {
                      badgeVariableName = filter.variableDisplay;
                    }
                    return {
                      value: v.value,
                      badgeText: badgeVariableName,
                      tooltip: tooltip,
                      source: v.source || filter.category.toLowerCase(),
                      displayLabel: v.value,
                      variableNames: v.variableNames || [],
                    };
                  });
                  const categoryIconMap = {
                    'Page Path & URL': MapPin,
                    'Page Path': MapPin,
                    'Page URL': MapPin,
                    'Query Params': HelpCircle,
                    'Click': Activity,
                    'Event': Activity,
                    'Hostname': MapPin,
                    'Referrer': MapPin,
                    'Element': Activity,
                  };
                  let FilterIcon = categoryIconMap[filter.category] || Variable;
                  return (
                    <MultiSelectFilter
                      key={filter.variable}
                      options={options}
                      values={selectedValues}
                      onChange={(values) => updateDynamicConditionFilter(filter.variable, values)}
                      placeholder={filter.variableDisplay}
                      icon={FilterIcon}
                      optionMeta={optionMeta}
                    />
                  );
                })}
              
              {/* Firing Options - Moved to last position */}
              {firingOptions && firingOptions.length > 0 && (
                <MultiSelectFilter
                  options={firingOptions.map(f => f.value)}
                  values={firingOptionFilter}
                  onChange={onFiringOptionFilterChange}
                  placeholder="All Firing Options"
                  icon={Repeat}
                  optionMeta={firingOptions.map(f => ({
                    value: f.value,
                    displayLabel: f.label,
                  }))}
                />
              )}
              
              {/* Variables - Moved to last position */}
              {variableNames && variableNames.length > 0 && (
                <MultiSelectFilter
                  options={variableNames.map(v => v.name)}
                  values={variableNameFilter}
                  onChange={onVariableNameFilterChange}
                  placeholder="All Variables"
                  icon={Variable}
                  optionMeta={variableNames.map(v => ({
                    value: v.name,
                    badgeText: v.badgeText,
                    tooltip: v.tooltip,
                    source: v.isBuiltIn ? 'builtin' : 'custom'
                  }))}
                />
              )}
            </>
          )}
          
          {/* Show All Filters / Show Less Button - Toggleable */}
          {!hasActiveAdvancedFilters && advancedFiltersCount > 0 && (
            <button 
              className={`show-all-filters-btn ${showAllFilters ? 'active' : ''}`}
              onClick={() => setShowAllFilters(!showAllFilters)}
              title={showAllFilters ? "Hide advanced filters" : "Show advanced filters"}
            >
              <SlidersHorizontal size={16} />
              {showAllFilters ? (
                <ChevronUp size={14} className="chevron-icon" />
              ) : (
                <ChevronDown size={14} className="chevron-icon" />
              )}
            </button>
          )}
        </>
      )}
      
      {/* Trigger-specific filters */}
      {viewType === 'triggers' && (
        <>
          {triggerTypeLabels && triggerTypeLabels.length > 0 && (
            <MultiSelectFilter
              options={triggerTypeLabels}
              values={triggerTypeFilter}
              onChange={onTriggerTypeFilterChange}
              placeholder="All Trigger Types"
              icon={Filter}
            />
          )}
          <SearchableSelect
            options={['Used', 'Unused']}
            value={triggerUsageFilter ? triggerUsageFilter.charAt(0).toUpperCase() + triggerUsageFilter.slice(1) : ''}
            onChange={(val) => onTriggerUsageFilterChange(val ? val.toLowerCase() : '')}
            placeholder="All Usage"
            icon={Activity}
          />
        </>
      )}
      
      {/* Variable-specific filters */}
      {viewType === 'variables' && (
        <>
          {variableTypeLabels && variableTypeLabels.length > 0 && (
            <MultiSelectFilter
              options={variableTypeLabels}
              values={variableTypeFilter}
              onChange={onVariableTypeFilterChange}
              placeholder="All Variable Types"
              icon={Filter}
            />
          )}
          <SearchableSelect
            options={['Used', 'Unused']}
            value={variableUsageFilter ? variableUsageFilter.charAt(0).toUpperCase() + variableUsageFilter.slice(1) : ''}
            onChange={(val) => onVariableUsageFilterChange(val ? val.toLowerCase() : '')}
            placeholder="All Usage"
            icon={Activity}
          />
        </>
      )}
      
      {/* Reset Filters and Export - Always visible */}
      {hasActiveFilters && (
        <button 
          className="reset-filters-btn"
          onClick={onResetFilters}
          title="Reset all filters"
        >
          <RotateCcw size={16} />
          Reset Filters
        </button>
      )}
      
      {/* Export Dropdown */}
      {showExport && allTags && filteredTags && (
        <ExportDropdown 
          allTags={allTags}
          filteredTags={filteredTags}
          hasFilters={hasActiveFilters}
        />
      )}
    </div>
  );
};

export default FiltersSection;

