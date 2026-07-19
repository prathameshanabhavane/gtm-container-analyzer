/**
 * GTM Container Analyzer - Main App Component
 * 
 * This is the main application component that handles routing and view management.
 * All UI components and business logic have been extracted into separate modules
 * for better maintainability.
 */

import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Database, ShieldCheck, ChevronLeft, Sparkles } from 'lucide-react';

// Hooks
import { useTheme, useFilters, usePagination, useGTMData } from './hooks';

// Utils
import { scrollToTop } from './utils';

// Components - Common
import Header from './components/Header';
import ThemeToggle from './components/ThemeToggle';
import { PrivacyProofModal } from './components/PrivacyProofModal';
import HomePage from './components/HomePage';
import PrivacyPolicy from './components/PrivacyPolicy/PrivacyPolicy';
import ExtensionPrivacy from './components/ExtensionPrivacy';
import TermsOfService from './components/TermsOfService/TermsOfService';
import DependencyTree from './components/DependencyTree';
import TriggersList from './components/TriggersList';
import VariablesList from './components/VariablesList';
import Compare from './components/Compare';
import LiveAnalyze from './components/LiveAnalyze';

// Components - Feature-specific
import { FiltersSection } from './components/filters';
import { TagDetailPanel, TagsTable } from './components/tags';
import { OverviewSection } from './components/overview';
import { CleanupPanel } from './components/cleanup';
import AIChat from './components/AIChat';

function App() {
  // React Router hooks
  const navigate = useNavigate();
  const location = useLocation();
  
  // Custom hooks
  const { theme, overlayActive, targetTheme, toggleTheme } = useTheme();
  
  const {
    processedTags,
    rawGTMData,
    containerInfo,
    dataLoaded,
    isLoadingFromDB,
    savedAt,
    stats,
    chartData,
    tagTypes,
    conditionTypes,
    duplicateTags,
    unusedVariables,
    orphanTriggers,
    allTriggers,
    triggerTypeLabels,
    allVariables,
    variableTypeLabels,
    handleFileUpload,
    handleClearData,
  } = useGTMData();
  
  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    typeFilter,
    setTypeFilter,
    statusFilter,
    setStatusFilter,
    conditionTypeFilter,
    setConditionTypeFilter,
    tagTriggerTypeFilter,
    setTagTriggerTypeFilter,
    tagTriggerTypes,
    firingOptionFilter,
    setFiringOptionFilter,
    firingOptions,
    triggerTypeFilter,
    setTriggerTypeFilter,
    triggerUsageFilter,
    setTriggerUsageFilter,
    variableTypeFilter,
    setVariableTypeFilter,
    variableUsageFilter,
    setVariableUsageFilter,
    variableNameFilter,
    setVariableNameFilter,
    variableNames,
    dynamicFilters,
    dynamicConditionFilters,
    updateDynamicConditionFilter,
    filteredTags,
    hasActiveFilters,
    hasActiveTriggerFilters,
    hasActiveVariableFilters,
    resetAllFilters,
  } = useFilters(processedTags, dataLoaded);

  // Pagination
  const pagination = usePagination(filteredTags, 15);
  
  // Local state
  const [selectedTag, setSelectedTag] = useState(null);
  const [showOverview, setShowOverview] = useState(true);
  const [showCleanupPanel, setShowCleanupPanel] = useState(false);
  const [headerProofModal, setHeaderProofModal] = useState({ open: false, type: null });

  // AI Chat and Live Events States
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [liveEvents, setLiveEvents] = useState([]);

  // Listen to Chrome Extension postMessage events
  useEffect(() => {
    const handleBridgeMessages = (event) => {
      if (event.data && event.data.source === 'gtm-live-analyzer-extension') {
        if (event.data.type === 'LIVE_DATA_UPDATE' && Array.isArray(event.data.events)) {
          setLiveEvents(event.data.events);
        }
      }
    };
    window.addEventListener('message', handleBridgeMessages);
    return () => window.removeEventListener('message', handleBridgeMessages);
  }, []);

  // Handle clickable tool node highlighting
  const handleNodeHighlight = (nodeName) => {
    setSearchQuery(nodeName);
    navigateTo('tags');
    setIsChatOpen(false); // Close chat to let user see visual highlight
  };

  // Derive current view from URL path
  const currentView = useMemo(() => {
    const path = location.pathname;
    if (path === '/analyze') return 'analyze';
    if (path === '/tags') return 'tags';
    if (path === '/triggers') return 'triggers';
    if (path === '/variables') return 'variables';
    if (path === '/compare') return 'compare';
    if (path === '/live') return 'live';
    if (path === '/privacy') return 'privacy';
    if (path === '/privacy/extension') return 'extension-privacy';
    if (path === '/terms') return 'terms';
    return 'upload';
  }, [location.pathname]);

  // Navigation helper
  const navigateTo = (view, params = {}) => {
    const urlSearchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) urlSearchParams.set(key, value);
    });
    const queryString = urlSearchParams.toString();
    const suffix = queryString ? `?${queryString}` : '';
    
    if (view === 'upload') {
      navigate('/');
    } else if (view === 'analyze') {
      navigate(`/analyze${suffix}`);
    } else if (view === 'tags') {
      navigate(`/tags${suffix}`);
    } else if (view === 'triggers') {
      navigate(`/triggers${suffix}`);
    } else if (view === 'variables') {
      navigate(`/variables${suffix}`);
    }
    
    // Scroll to top after navigation
    scrollToTop();
  };

  // Handle file upload and navigate
  const onFileUpload = async (data) => {
    const success = await handleFileUpload(data);
    if (success) {
      resetAllFilters();
      pagination.resetPage();
      navigate('/analyze', { replace: true });
      scrollToTop();
    }
  };

  // Filter triggers based on search and filters
  const filteredTriggers = useMemo(() => {
    let results = allTriggers;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      results = results.filter(trigger => 
        trigger.name.toLowerCase().includes(query) ||
        trigger.typeLabel.toLowerCase().includes(query) ||
        trigger.conditions.some(c => 
          c.variable.toLowerCase().includes(query) ||
          c.value.toLowerCase().includes(query)
        ) ||
        trigger.usedByTags.some(t => 
          t.name.toLowerCase().includes(query) ||
          t.type.toLowerCase().includes(query)
        ) ||
        (trigger.details.eventName && trigger.details.eventName.toLowerCase().includes(query))
      );
    }
    
    if (triggerTypeFilter.length > 0) {
      results = results.filter(trigger => 
        triggerTypeFilter.includes(trigger.typeLabel)
      );
    }
    
    if (triggerUsageFilter === 'used') {
      results = results.filter(trigger => !trigger.isOrphan);
    } else if (triggerUsageFilter === 'unused') {
      results = results.filter(trigger => trigger.isOrphan);
    }
    
    return results;
  }, [allTriggers, searchQuery, triggerTypeFilter, triggerUsageFilter]);

  // Filter variables based on search and filters
  const filteredVariables = useMemo(() => {
    let results = allVariables;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      results = results.filter(variable => 
        variable.name.toLowerCase().includes(query) ||
        variable.typeLabel.toLowerCase().includes(query) ||
        (variable.content?.dataLayerKey && variable.content.dataLayerKey.toLowerCase().includes(query)) ||
        (variable.content?.mainValue && variable.content.mainValue.toLowerCase().includes(query)) ||
        (variable.content?.cookieName && variable.content.cookieName.toLowerCase().includes(query)) ||
        variable.usedIn.some(u => 
          u.name.toLowerCase().includes(query)
        )
      );
    }
    
    if (variableTypeFilter.length > 0) {
      results = results.filter(variable => 
        variableTypeFilter.includes(variable.typeLabel)
      );
    }
    
    if (variableUsageFilter === 'used') {
      results = results.filter(variable => !variable.isUnused);
    } else if (variableUsageFilter === 'unused') {
      results = results.filter(variable => variable.isUnused);
    }
    
    return results;
  }, [allVariables, searchQuery, variableTypeFilter, variableUsageFilter]);

  // Reset pagination when filters change
  useEffect(() => {
    pagination.resetPage();
  }, [searchQuery, typeFilter, statusFilter, conditionTypeFilter]);

  // Get match info for display
  const matchInfo = searchResults.matchInfo;

  // Check for cleanup issues
  const hasCleanupIssues = duplicateTags.length > 0 || 
                          unusedVariables.stats.unusedCount > 0 || 
                          orphanTriggers.stats.orphanCount > 0;

  // ============================================
  // RENDER: Loading State
  // ============================================
  if (isLoadingFromDB) {
    return (
      <div className="dashboard upload-screen">
        <div className="loading-container">
          <Database size={48} className="spin" />
          <p>Loading saved data...</p>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: Tags View (Dependency Tree)
  // ============================================
  if (currentView === 'tags' && dataLoaded) {
    return (
      <>
        <div className={`theme-overlay ${overlayActive ? 'active' : ''} ${targetTheme ? `to-${targetTheme}` : ''}`} />
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
        <div className="dashboard dependency-tree-page">
          <Header
            containerInfo={containerInfo}
            stats={stats}
            savedAt={savedAt}
            onFileUpload={onFileUpload}
            onClearData={handleClearData}
            onContainerChange={onFileUpload}
          />
          
          <main className="main-content tree-page-content">
            <div className="page-nav-bar">
              <button 
                className="back-to-dashboard"
                onClick={() => navigateTo('analyze')}
                title="Back to Dashboard"
              >
                <ChevronLeft size={18} />
                <span>Back</span>
              </button>
              <div className="page-nav-info">
                <h2 className="page-nav-title">All Tags</h2>
                <span className="page-nav-subtitle">{filteredTags.length} of {processedTags.length} tags</span>
              </div>
            </div>
            
            <FiltersSection
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="Search tags, triggers, variables..."
              tagTypes={tagTypes}
              typeFilter={typeFilter}
              onTypeFilterChange={setTypeFilter}
              conditionTypes={conditionTypes}
              conditionTypeFilter={conditionTypeFilter}
              onConditionTypeFilterChange={setConditionTypeFilter}
              tagTriggerTypes={tagTriggerTypes}
              tagTriggerTypeFilter={tagTriggerTypeFilter}
              onTagTriggerTypeFilterChange={setTagTriggerTypeFilter}
              firingOptions={firingOptions}
              firingOptionFilter={firingOptionFilter}
              onFiringOptionFilterChange={setFiringOptionFilter}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              variableNames={variableNames}
              variableNameFilter={variableNameFilter}
              onVariableNameFilterChange={setVariableNameFilter}
              dynamicFilters={dynamicFilters}
              dynamicConditionFilters={dynamicConditionFilters}
              updateDynamicConditionFilter={updateDynamicConditionFilter}
              hasActiveFilters={hasActiveFilters}
              onResetFilters={resetAllFilters}
              showExport={true}
              allTags={processedTags}
              filteredTags={filteredTags}
              viewType="tags"
            />
            
            <DependencyTree tags={filteredTags} />
          </main>
        </div>
        
        <div 
          className="floating-privacy-badge" 
          title="Click to learn how to verify your privacy"
          onClick={() => setHeaderProofModal({ open: true, type: 'header' })}
        >
          <ShieldCheck size={14} />
          <span>100% Private</span>
        </div>
        
        <PrivacyProofModal 
          isOpen={headerProofModal.open} 
          onClose={() => setHeaderProofModal({ open: false, type: null })} 
          testType={headerProofModal.type}
        />
        
        {/* Global AI Chat Assistant */}
        <button 
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="ai-chat-toggle-btn"
          title="Open GTM Container Analyzer Assistant"
        >
          <Sparkles size={22} />
        </button>
        
        <AIChat 
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          containerData={rawGTMData}
          liveEvents={liveEvents}
          setLiveEvents={setLiveEvents}
          onNodeHighlight={handleNodeHighlight}
        />
      </>
    );
  }

  // ============================================
  // RENDER: Triggers View
  // ============================================
  if (currentView === 'triggers' && dataLoaded) {
    return (
      <>
        <div className={`theme-overlay ${overlayActive ? 'active' : ''} ${targetTheme ? `to-${targetTheme}` : ''}`} />
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
        <div className="dashboard triggers-page">
          <Header
            containerInfo={containerInfo}
            stats={stats}
            savedAt={savedAt}
            onFileUpload={onFileUpload}
            onClearData={handleClearData}
            onContainerChange={onFileUpload}
          />
          
          <main className="main-content triggers-page-content">
            <div className="page-nav-bar">
              <button 
                className="back-to-dashboard"
                onClick={() => navigateTo('analyze')}
                title="Back to Dashboard"
              >
                <ChevronLeft size={18} />
                <span>Back</span>
              </button>
              <div className="page-nav-info">
                <h2 className="page-nav-title">All Triggers</h2>
                <span className="page-nav-subtitle">
                  {filteredTriggers.length === allTriggers.length 
                    ? `${allTriggers.length} triggers` 
                    : `${filteredTriggers.length} of ${allTriggers.length} triggers`}
                </span>
              </div>
            </div>
            
            <FiltersSection
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="Search triggers, conditions, tags..."
              triggerTypeLabels={triggerTypeLabels}
              triggerTypeFilter={triggerTypeFilter}
              onTriggerTypeFilterChange={setTriggerTypeFilter}
              triggerUsageFilter={triggerUsageFilter}
              onTriggerUsageFilterChange={setTriggerUsageFilter}
              hasActiveFilters={hasActiveTriggerFilters}
              onResetFilters={resetAllFilters}
              viewType="triggers"
            />
            
            <TriggersList triggers={filteredTriggers} />
          </main>
        </div>
        
        <div 
          className="floating-privacy-badge" 
          title="Click to learn how to verify your privacy"
          onClick={() => setHeaderProofModal({ open: true, type: 'header' })}
        >
          <ShieldCheck size={14} />
          <span>100% Private</span>
        </div>
        
        <PrivacyProofModal 
          isOpen={headerProofModal.open} 
          onClose={() => setHeaderProofModal({ open: false, type: null })} 
          testType={headerProofModal.type}
        />
        
        {/* Global AI Chat Assistant */}
        <button 
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="ai-chat-toggle-btn"
          title="Open GTM Container Analyzer Assistant"
        >
          <Sparkles size={22} />
        </button>
        
        <AIChat 
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          containerData={rawGTMData}
          liveEvents={liveEvents}
          setLiveEvents={setLiveEvents}
          onNodeHighlight={handleNodeHighlight}
        />
      </>
    );
  }

  // ============================================
  // RENDER: Variables View
  // ============================================
  if (currentView === 'variables' && dataLoaded) {
    return (
      <>
        <div className={`theme-overlay ${overlayActive ? 'active' : ''} ${targetTheme ? `to-${targetTheme}` : ''}`} />
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
        <div className="dashboard variables-page">
          <Header
            containerInfo={containerInfo}
            stats={stats}
            savedAt={savedAt}
            onFileUpload={onFileUpload}
            onClearData={handleClearData}
            onContainerChange={onFileUpload}
          />
          
          <main className="main-content variables-page-content">
            <div className="page-nav-bar">
              <button 
                className="back-to-dashboard"
                onClick={() => navigateTo('analyze')}
                title="Back to Dashboard"
              >
                <ChevronLeft size={18} />
                <span>Back</span>
              </button>
              <div className="page-nav-info">
                <h2 className="page-nav-title">All Variables</h2>
                <span className="page-nav-subtitle">
                  {filteredVariables.length === allVariables.length 
                    ? `${allVariables.length} variables` 
                    : `${filteredVariables.length} of ${allVariables.length} variables`}
                </span>
              </div>
            </div>
            
            <FiltersSection
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="Search variables, values, usage..."
              variableTypeLabels={variableTypeLabels}
              variableTypeFilter={variableTypeFilter}
              onVariableTypeFilterChange={setVariableTypeFilter}
              variableUsageFilter={variableUsageFilter}
              onVariableUsageFilterChange={setVariableUsageFilter}
              hasActiveFilters={hasActiveVariableFilters}
              onResetFilters={resetAllFilters}
              viewType="variables"
            />
            
            <VariablesList variables={filteredVariables} />
          </main>
        </div>
        
        <div 
          className="floating-privacy-badge" 
          title="Click to learn how to verify your privacy"
          onClick={() => setHeaderProofModal({ open: true, type: 'header' })}
        >
          <ShieldCheck size={14} />
          <span>100% Private</span>
        </div>
        
        <PrivacyProofModal 
          isOpen={headerProofModal.open} 
          onClose={() => setHeaderProofModal({ open: false, type: null })} 
          testType={headerProofModal.type}
        />
        
        {/* Global AI Chat Assistant */}
        <button 
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="ai-chat-toggle-btn"
          title="Open GTM Container Analyzer Assistant"
        >
          <Sparkles size={22} />
        </button>
        
        <AIChat 
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          containerData={rawGTMData}
          liveEvents={liveEvents}
          setLiveEvents={setLiveEvents}
          onNodeHighlight={handleNodeHighlight}
        />
      </>
    );
  }

  // ============================================
  // RENDER: Compare View
  // ============================================
  if (currentView === 'compare') {
    return (
      <>
        <div className={`theme-overlay ${overlayActive ? 'active' : ''} ${targetTheme ? `to-${targetTheme}` : ''}`} />
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
        <Compare />
      </>
    );
  }

  // ============================================
  // RENDER: Live Analyze View
  // ============================================
  if (currentView === 'live') {
    return (
      <>
        <div className={`theme-overlay ${overlayActive ? 'active' : ''} ${targetTheme ? `to-${targetTheme}` : ''}`} />
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
        <LiveAnalyze />
      </>
    );
  }

  // ============================================
  // RENDER: Privacy Policy
  // ============================================
  if (currentView === 'privacy') {
    return (
      <>
        <div className={`theme-overlay ${overlayActive ? 'active' : ''} ${targetTheme ? `to-${targetTheme}` : ''}`} />
        {/* ThemeToggle is now inside the Navbar */}
        <PrivacyPolicy theme={theme} onThemeToggle={toggleTheme} />
      </>
    );
  }

  // ============================================
  // RENDER: Extension Privacy Policy
  // ============================================
  if (currentView === 'extension-privacy') {
    return (
      <>
        <div className={`theme-overlay ${overlayActive ? 'active' : ''} ${targetTheme ? `to-${targetTheme}` : ''}`} />
        {/* ThemeToggle is now inside the Navbar */}
        <ExtensionPrivacy theme={theme} onThemeToggle={toggleTheme} />
      </>
    );
  }

  // ============================================
  // RENDER: Terms of Service
  // ============================================
  if (currentView === 'terms') {
    return (
      <>
        <div className={`theme-overlay ${overlayActive ? 'active' : ''} ${targetTheme ? `to-${targetTheme}` : ''}`} />
        {/* ThemeToggle is now inside the Navbar */}
        <TermsOfService theme={theme} onThemeToggle={toggleTheme} />
      </>
    );
  }

  // ============================================
  // RENDER: Upload/Home Page
  // ============================================
  if (currentView === 'upload' || !dataLoaded) {
    return (
      <>
        <div className={`theme-overlay ${overlayActive ? 'active' : ''} ${targetTheme ? `to-${targetTheme}` : ''}`} />
        {/* ThemeToggle is now inside the Navbar on HomePage */}
        <HomePage 
          onFileUpload={onFileUpload} 
          theme={theme} 
          onThemeToggle={toggleTheme} 
        />
      </>
    );
  }

  // ============================================
  // RENDER: Main Dashboard (Analyze View)
  // ============================================
  if (currentView === 'analyze' && dataLoaded) {
    return (
      <>
        <div className={`theme-overlay ${overlayActive ? 'active' : ''} ${targetTheme ? `to-${targetTheme}` : ''}`} />
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
        <div className="dashboard">
          
          {/* Header */}
          <Header
            containerInfo={containerInfo}
            stats={stats}
            savedAt={savedAt}
            onFileUpload={onFileUpload}
            onClearData={handleClearData}
            onContainerChange={onFileUpload}
          >
            {/* Cleanup Button */}
            {hasCleanupIssues && (
              <button 
                className={`cleanup-header-btn ${showCleanupPanel ? 'active' : ''}`}
                onClick={() => {
                  const newState = !showCleanupPanel;
                  setShowCleanupPanel(newState);
                  if (newState) {
                    setTimeout(() => {
                      const section = document.getElementById('cleanup-section');
                      if (section) {
                        const rect = section.getBoundingClientRect();
                        const isVisible = rect.top >= 0 && rect.top <= window.innerHeight * 0.5;
                        if (!isVisible) {
                          section.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                      }
                    }, 100);
                  }
                }}
                title="Container Cleanup"
              >
                <Sparkles size={14} />
                <span>Cleanup</span>
                <span className="cleanup-header-count">
                  {duplicateTags.length + 
                   (unusedVariables.stats.unusedCount || 0) + 
                   (orphanTriggers.stats.orphanCount || 0)}
                </span>
              </button>
            )}
          </Header>
          
          {/* Overview Section */}
          <OverviewSection 
            stats={stats}
            chartData={chartData}
            showOverview={showOverview}
            setShowOverview={setShowOverview}
            onNavigate={navigateTo}
          />
          
          {/* Cleanup Panel */}
          <CleanupPanel 
            rawGTMData={rawGTMData}
            duplicateTags={duplicateTags}
            unusedVariables={unusedVariables}
            orphanTriggers={orphanTriggers}
            processedTags={processedTags}
            showCleanupPanel={showCleanupPanel}
            setShowCleanupPanel={setShowCleanupPanel}
            onSelectTag={setSelectedTag}
          />
          
          {/* Filters */}
          <FiltersSection
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Global search: tags, triggers, variables, scripts..."
            tagTypes={tagTypes}
            typeFilter={typeFilter}
            onTypeFilterChange={setTypeFilter}
            conditionTypes={conditionTypes}
            conditionTypeFilter={conditionTypeFilter}
            onConditionTypeFilterChange={setConditionTypeFilter}
            tagTriggerTypes={tagTriggerTypes}
            tagTriggerTypeFilter={tagTriggerTypeFilter}
            onTagTriggerTypeFilterChange={setTagTriggerTypeFilter}
            firingOptions={firingOptions}
            firingOptionFilter={firingOptionFilter}
            onFiringOptionFilterChange={setFiringOptionFilter}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            variableNames={variableNames}
            variableNameFilter={variableNameFilter}
            onVariableNameFilterChange={setVariableNameFilter}
            dynamicFilters={dynamicFilters}
            dynamicConditionFilters={dynamicConditionFilters}
            updateDynamicConditionFilter={updateDynamicConditionFilter}
            hasActiveFilters={hasActiveFilters}
            onResetFilters={resetAllFilters}
            showExport={true}
            allTags={processedTags}
            filteredTags={filteredTags}
            viewType="tags"
          />
          
          {/* Tags Table */}
          <TagsTable 
            tags={filteredTags}
            paginatedTags={pagination.paginatedItems}
            totalTags={processedTags.length}
            searchQuery={searchQuery}
            matchInfo={matchInfo}
            onSelectTag={setSelectedTag}
            currentPage={pagination.currentPage}
            setCurrentPage={pagination.setCurrentPage}
            itemsPerPage={pagination.itemsPerPage}
            itemsPerPageInput={pagination.itemsPerPageInput}
            handleItemsPerPageChange={pagination.handleItemsPerPageChange}
            totalPages={pagination.totalPages}
            showingFrom={pagination.showingFrom}
            showingTo={pagination.showingTo}
          />
          
          {/* Tag Detail Side Panel */}
          <TagDetailPanel 
            tag={selectedTag} 
            onClose={() => setSelectedTag(null)} 
          />
          
          {/* Floating Privacy Badge */}
          <div 
            className="floating-privacy-badge" 
            title="Click to learn how to verify your privacy"
            onClick={() => setHeaderProofModal({ open: true, type: 'header' })}
          >
            <ShieldCheck size={14} />
            <span>100% Private</span>
          </div>

          {/* Privacy Proof Modal */}
          <PrivacyProofModal 
            isOpen={headerProofModal.open} 
            onClose={() => setHeaderProofModal({ open: false, type: null })} 
            testType={headerProofModal.type}
          />
        </div>
        
        {/* Global AI Chat Assistant */}
        <button 
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="ai-chat-toggle-btn"
          title="Open GTM Container Analyzer Assistant"
        >
          <Sparkles size={22} />
        </button>
        
        <AIChat 
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          containerData={rawGTMData}
          liveEvents={liveEvents}
          setLiveEvents={setLiveEvents}
          onNodeHighlight={handleNodeHighlight}
        />
      </>
    );
  }

  // Fallback
  return null;
}

export default App;
