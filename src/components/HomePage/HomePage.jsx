import { useState, useEffect } from 'react';
import { 
  Upload, Play, RefreshCw, AlertCircle,
  ShieldCheck, Lock, WifiOff, Monitor, HardDrive,
  Tag, Zap, Database, Search, BarChart3,
  HelpCircle, X, ExternalLink, FileJson
} from 'lucide-react';
import { ConnectGTM } from '../ConnectGTM/ConnectGTM';
import { PrivacyProofModal } from '../PrivacyProofModal/PrivacyProofModal';
import { FormatChangeModal } from '../FormatChangeModal';
import { validateGTMStructure, safeJSONParse, extractMJSExport } from '../../utils/gtmValidator';
import Navbar from '../Navbar';
import Footer from '../Footer';
import './HomePage.css';

export const HomePage = ({ onFileUpload, theme, onThemeToggle }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formatError, setFormatError] = useState(null); // For graceful format change handling
  const [proofModal, setProofModal] = useState({ open: false, type: null });
  const [showExportHelp, setShowExportHelp] = useState(false);
  const [currentTheme, setCurrentTheme] = useState('dark');
  
  // Listen for theme changes
  useEffect(() => {
    const updateTheme = () => {
      const theme = document.documentElement.getAttribute('data-theme') || 'dark';
      setCurrentTheme(theme);
    };
    
    // Initial check
    updateTheme();
    
    // Watch for theme changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'data-theme') {
          updateTheme();
        }
      });
    });
    
    observer.observe(document.documentElement, { attributes: true });
    
    return () => observer.disconnect();
  }, []);
  
  const handleFile = async (file) => {
    if (!file) return;
    
    // Clear any previous errors at the start
    setIsLoading(true);
    setError(null);
    setFormatError(null);
    
    try {
      // Security: File type validation
      const allowedExtensions = ['.json', '.mjs', '.js'];
      const fileExt = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
      if (!allowedExtensions.includes(fileExt)) {
        throw new Error('Invalid file type. Only .json, .mjs, or .js files allowed.');
      }
      
      // Security: File size limit (50MB)
      const maxSize = 50 * 1024 * 1024;
      if (file.size > maxSize) {
        throw new Error('File too large. Maximum size is 50MB.');
      }
      
      // Security: File name validation
      if (!/^[a-zA-Z0-9_\-\.\s()]+$/.test(file.name)) {
        throw new Error('Invalid file name.');
      }
      
      const text = await file.text();
      let jsonData;
      let parseResult;
      
      // Handle both .mjs (ES module) and .json formats with graceful error handling
      if (file.name.endsWith('.mjs') || file.name.endsWith('.js')) {
        parseResult = extractMJSExport(text, file.name);
        if (!parseResult.success) {
          setFormatError(parseResult.error);
          return;
        }
        jsonData = parseResult.data;
      } else {
        parseResult = safeJSONParse(text, file.name);
        if (!parseResult.success) {
          setFormatError(parseResult.error);
          return;
        }
        jsonData = parseResult.data;
      }
      
      // Validate GTM structure with detailed error handling
      const validation = validateGTMStructure(jsonData);
      if (!validation.valid) {
        setFormatError(validation);
        return;
      }
      
      onFileUpload(jsonData);
    } catch (err) {
      // Catch any unexpected errors
      if (err.message?.includes('JSON') || err.message?.includes('parse')) {
        setFormatError({
          errorType: 'parse_error',
          errorCode: 'UNEXPECTED_PARSE_ERROR',
          errorDetails: err.message
        });
      } else {
        setError(err.message || 'Failed to process file');
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };
  
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const loadDemo = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/sample-gtm-container.json');
      if (!response.ok) throw new Error('Failed to load demo');
      const jsonData = await response.json();
      onFileUpload(jsonData);
    } catch (err) {
      setError('Failed to load demo.');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="home-page has-navbar">
      {/* Premium Navbar */}
      <Navbar theme={theme} onThemeToggle={onThemeToggle} />
      
      {/* Graceful Error Modal for Format Changes */}
      <FormatChangeModal 
        isOpen={!!formatError}
        onClose={() => setFormatError(null)}
        errorType={formatError?.errorType}
        errorDetails={formatError?.errorDetails}
        errorCode={formatError?.errorCode}
      />
      
      {/* Hero Section */}
      <section className="home-hero">
        <div className="hero-content">
          <div className="hero-badge">
            <ShieldCheck size={14} />
            <span>100% Private • Browser-Based</span>
          </div>
          <h1 className="hero-title">
            From Insight to Action, <span className="hero-gradient">Instantly</span>
          </h1>
          <p className="hero-subtitle">
            Visualize, analyze, and understand your Google Tag Manager setup. All processing happens locally in your browser.
          </p>
          
          {/* Quick Actions */}
          <div className="hero-actions">
            {import.meta.env.VITE_GOOGLE_CLIENT_ID && (
              <ConnectGTM onContainerLoaded={onFileUpload} autoOpenAfterLogin={true} />
            )}
            
            <div className="hero-or">or</div>
            
            <div className="hero-upload-row">
              <label className="hero-upload-btn" title="Accepts .json, .mjs, .js files">
                <input 
                  type="file" 
                  accept=".json,.mjs,.js"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    handleFile(file);
                    // Reset input so onChange fires again even for same file
                    e.target.value = '';
                  }}
                  hidden
                />
                <Upload size={18} />
                Upload Export
              </label>
              <button 
                className="hero-demo-btn"
                onClick={loadDemo}
                disabled={isLoading}
              >
                <Play size={16} />
                Try Demo
              </button>
            </div>
            
            <button 
              className="export-help-link"
              onClick={() => setShowExportHelp(true)}
            >
              <HelpCircle size={14} />
              How to export from GTM?
            </button>
          </div>
          
          {error && (
            <div className="hero-error">
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}
          
          {isLoading && (
            <div className="hero-loading">
              <RefreshCw size={18} className="spin" />
              <span>Analyzing container...</span>
            </div>
          )}
        </div>
        
        {/* Drop Zone Overlay */}
        <div 
          className={`hero-dropzone ${isDragging ? 'active' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <Upload size={48} />
          <span>Drop your GTM export file here</span>
        </div>
      </section>
      
      {/* Dashboard Preview Section */}
      <section className="dashboard-preview-section">
        <div className="preview-container">
          <div className="preview-badge">
            <Monitor size={14} />
            <span>Live Dashboard Preview</span>
          </div>
          <div className="preview-frame">
            <div className="preview-browser-bar">
              <div className="browser-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <div className="browser-url">
                <Lock size={10} />
                <span>gtmcontaineranalyzer.com/analyze</span>
              </div>
            </div>
            <div className="preview-image-wrapper">
              <img 
                src={currentTheme === 'light' ? '/dashboard-preview-light.png' : '/dashboard-preview-dark.png'} 
                alt="GTM Container Analyzer Dashboard Preview"
                className="preview-image"
                onError={(e) => {
                  // Fallback if image doesn't exist
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
              <div className="preview-placeholder" style={{ display: 'none' }}>
                <BarChart3 size={48} />
                <span>Dashboard Preview</span>
                <p>Add dashboard-preview-dark.png & dashboard-preview-light.png to public folder</p>
              </div>
            </div>
          </div>
          <p className="preview-caption">
            <span>✨</span> Clean, intuitive interface to analyze your GTM container
          </p>
        </div>
      </section>
      
      {/* Features Section */}
      <section className="home-features">
        <div className="features-header">
          <span className="features-label">Features</span>
          <h2>Everything You Need to Analyze GTM</h2>
          <p>Powerful tools to understand your tag management setup</p>
        </div>
        
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon blue">
              <Tag size={24} />
            </div>
            <h3>Tag Analysis</h3>
            <p>View all tags with their types, firing triggers, and configurations in a clean interface</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon purple">
              <Zap size={24} />
            </div>
            <h3>Trigger Mapping</h3>
            <p>Understand when and why your tags fire with detailed trigger breakdowns</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon cyan">
              <Database size={24} />
            </div>
            <h3>Variable Inspector</h3>
            <p>Explore all variables, their types, and how they're used across your container</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon green">
              <FileJson size={24} />
            </div>
            <h3>Export to CSV</h3>
            <p>Download your analysis as CSV for documentation or sharing with your team</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon orange">
              <Search size={24} />
            </div>
            <h3>Smart Search</h3>
            <p>Quickly find any tag, trigger, or variable with powerful filtering options</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon pink">
              <BarChart3 size={24} />
            </div>
            <h3>Visual Dashboard</h3>
            <p>Get instant insights with charts showing tag distribution and usage patterns</p>
          </div>
        </div>
      </section>
      
      {/* How It Works */}
      <section className="home-steps">
        <div className="steps-header">
          <span className="steps-label">How It Works</span>
          <h2>Get Started in Seconds</h2>
        </div>
        
        <div className="steps-timeline">
          <div className="timeline-step">
            <div className="timeline-num">1</div>
            <div className="timeline-content">
              <h3>Connect or Upload</h3>
              <p>Sign in with Google to access your containers directly, or upload your GTM export file</p>
            </div>
          </div>
          <div className="timeline-connector"></div>
          <div className="timeline-step">
            <div className="timeline-num">2</div>
            <div className="timeline-content">
              <h3>Instant Analysis</h3>
              <p>Your container is analyzed instantly in your browser — no server uploads</p>
            </div>
          </div>
          <div className="timeline-connector"></div>
          <div className="timeline-step">
            <div className="timeline-num">3</div>
            <div className="timeline-content">
              <h3>Explore & Export</h3>
              <p>Browse tags, triggers, variables and export reports for documentation</p>
            </div>
          </div>
        </div>
      </section>
      
      {/* Privacy Section */}
      <section className="home-privacy">
        <div className="privacy-content">
          <div className="privacy-icon">
            <Lock size={32} />
          </div>
          <h2>Your Data Stays Private</h2>
          <p className="privacy-desc">
            Everything runs locally in your browser. Your GTM data is never sent to any server — 
            it's processed and stored entirely on your device.
          </p>
          
          <div className="home-priv-cards">
            <div className="priv-feature">
              <div className="priv-feature-icon">
                <Monitor size={24} />
              </div>
              <span>Local Processing</span>
            </div>
            <div className="priv-feature">
              <div className="priv-feature-icon">
                <HardDrive size={24} />
              </div>
              <span>Browser Storage</span>
            </div>
            <div className="priv-feature">
              <div className="priv-feature-icon">
                <WifiOff size={24} />
              </div>
              <span>Works Offline</span>
            </div>
          </div>
          
          <div className="privacy-verify">
            <span>Don't trust us?</span>
            <button onClick={() => setProofModal({ open: true, type: 'network' })}>
              Verify It Yourself →
            </button>
          </div>
        </div>
        
        <PrivacyProofModal 
          isOpen={proofModal.open} 
          onClose={() => setProofModal({ open: false, type: null })} 
          testType={proofModal.type}
        />
      </section>

      {/* Export Help Modal */}
      {showExportHelp && (
        <div className="export-help-modal-overlay" onClick={() => setShowExportHelp(false)}>
          <div className="export-help-modal" onClick={(e) => e.stopPropagation()}>
            <button className="export-help-close" onClick={() => setShowExportHelp(false)}>
              <X size={20} />
            </button>
            
            <h3>How to Export Your GTM Container</h3>
            <p className="export-help-desc">Follow these simple steps to download your container export file:</p>
            
            <div className="export-steps">
              <div className="export-step">
                <span className="export-step-num">1</span>
                <div className="export-step-content">
                  <strong>Open Google Tag Manager</strong>
                  <p>Go to <a href="https://tagmanager.google.com" target="_blank" rel="noopener noreferrer">tagmanager.google.com <ExternalLink size={12} /></a> and sign in</p>
                </div>
              </div>
              
              <div className="export-step">
                <span className="export-step-num">2</span>
                <div className="export-step-content">
                  <strong>Select Your Container</strong>
                  <p>Click on the container you want to analyze</p>
                </div>
              </div>
              
              <div className="export-step">
                <span className="export-step-num">3</span>
                <div className="export-step-content">
                  <strong>Go to Admin</strong>
                  <p>Click "Admin" in the top navigation bar</p>
                </div>
              </div>
              
              <div className="export-step">
                <span className="export-step-num">4</span>
                <div className="export-step-content">
                  <strong>Export Container</strong>
                  <p>Under "Container" section, click "Export Container" → Choose version → Download</p>
                </div>
              </div>
            </div>
            
            <div className="export-help-tip">
              <HelpCircle size={14} />
              <span>Tip: Export the "Latest" version to analyze your current setup</span>
            </div>
          </div>
        </div>
      )}
      
      {/* CTA Section */}
      <section className="home-cta">
        <h2>Ready to Analyze Your GTM?</h2>
        <p>Connect your account or upload your container export to get started</p>
        <div className="cta-buttons">
          {import.meta.env.VITE_GOOGLE_CLIENT_ID && (
            <ConnectGTM onContainerLoaded={onFileUpload} autoOpenAfterLogin={true} />
          )}
          <label className="cta-upload">
            <input 
              type="file" 
              accept=".json,.mjs,.js"
              onChange={(e) => {
                const file = e.target.files[0];
                handleFile(file);
                // Reset input so onChange fires again even for same file
                e.target.value = '';
              }}
              hidden
            />
            <Upload size={16} />
            Upload File
          </label>
          <button 
            className="cta-demo"
            onClick={loadDemo}
            disabled={isLoading}
          >
            <Play size={16} />
            Try Demo
          </button>
        </div>
      </section>

      {/* Premium Footer */}
      <Footer />
    </div>
  );
};

export default HomePage;

