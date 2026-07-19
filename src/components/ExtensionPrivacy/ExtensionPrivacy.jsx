/**
 * Extension Privacy Policy Page
 * Dedicated privacy policy for GTM Container Analyzer - Tag+Pixel Debugger extension
 */

import { 
  Shield, 
  Eye, 
  Database, 
  Lock, 
  Globe, 
  Mail,
  CheckCircle,
  XCircle,
  ArrowLeft,
  Puzzle,
  HardDrive,
  Share2,
  Trash2,
  FileText
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Navbar from '../Navbar';
import Footer from '../Footer';
import './ExtensionPrivacy.css';

const ExtensionPrivacy = ({ theme, onThemeToggle }) => {
  const lastUpdated = "January 2, 2026";
  
  return (
    <div className="ext-privacy-page has-navbar">
      {/* Premium Navbar */}
      <Navbar theme={theme} onThemeToggle={onThemeToggle} />
      
      {/* Header */}
      <header className="ext-privacy-header">
        <div className="ext-privacy-header-content">
          <Link to="/" className="back-home">
            <ArrowLeft size={18} />
            <span>Back to App</span>
          </Link>
          <div className="ext-privacy-badge">
            <Puzzle size={16} />
            <span>Browser Extension</span>
          </div>
          <div className="ext-privacy-title-wrap">
            <Shield size={36} />
            <div>
              <h1>Extension Privacy Policy</h1>
              <p className="ext-name">GTM Container Analyzer - Tag+Pixel Debugger</p>
              <p className="last-updated">Last updated: {lastUpdated}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="ext-privacy-content">
        
        {/* Quick Summary */}
        <section className="ext-privacy-section summary-section">
          <div className="summary-box">
            <h2>
              <Lock size={24} />
              Privacy at a Glance
            </h2>
            <div className="summary-grid">
              <div className="summary-item positive">
                <CheckCircle size={20} />
                <span>100% Local Processing</span>
              </div>
              <div className="summary-item positive">
                <CheckCircle size={20} />
                <span>No Data Sent to Servers</span>
              </div>
              <div className="summary-item positive">
                <CheckCircle size={20} />
                <span>No Personal Info Collected</span>
              </div>
              <div className="summary-item positive">
                <CheckCircle size={20} />
                <span>No Tracking or Analytics</span>
              </div>
              <div className="summary-item positive">
                <CheckCircle size={20} />
                <span>No Data Sold to Third Parties</span>
              </div>
              <div className="summary-item positive">
                <CheckCircle size={20} />
                <span>You Control Your Data</span>
              </div>
            </div>
          </div>
        </section>

        {/* What the Extension Does */}
        <section className="ext-privacy-section">
          <h2>
            <Puzzle size={24} />
            What This Extension Does
          </h2>
          <p>
            GTM Container Analyzer - Tag+Pixel Debugger is a browser extension that helps developers 
            and marketers debug Google Tag Manager implementations by capturing tag 
            fires and dataLayer events in real-time.
          </p>
          <p>
            All data processing happens <strong>entirely within your browser</strong>. 
            We do not operate servers that receive or store your data.
          </p>
        </section>

        {/* Data Access */}
        <section className="ext-privacy-section">
          <h2>
            <Eye size={24} />
            What Data the Extension Accesses
          </h2>
          <p>To function, the extension accesses the following data on pages you visit:</p>
          <div className="data-list">
            <div className="data-item">
              <div className="data-icon">🌐</div>
              <div className="data-info">
                <strong>Network Requests</strong>
                <p>Monitors outgoing requests to detect marketing tags (Google Analytics, Facebook Pixel, etc.)</p>
              </div>
            </div>
            <div className="data-item">
              <div className="data-icon">📊</div>
              <div className="data-info">
                <strong>DataLayer Events</strong>
                <p>Captures events pushed to the GTM dataLayer for analysis</p>
              </div>
            </div>
            <div className="data-item">
              <div className="data-icon">📄</div>
              <div className="data-info">
                <strong>Page Information</strong>
                <p>Page URL, title, and query parameters (for context in your analysis)</p>
              </div>
            </div>
          </div>
        </section>

        {/* Data Storage */}
        <section className="ext-privacy-section">
          <h2>
            <HardDrive size={24} />
            How Data is Stored
          </h2>
          <div className="storage-info">
            <div className="storage-item">
              <Database size={20} />
              <div>
                <strong>Local Browser Storage Only</strong>
                <p>
                  All captured data is stored in <code>chrome.storage.local</code>, 
                  which is sandboxed to the extension and stored only on your device.
                </p>
              </div>
            </div>
            <div className="storage-item">
              <Lock size={20} />
              <div>
                <strong>Session-Based</strong>
                <p>
                  Data is captured for your current browsing session. You can clear 
                  it anytime via the extension popup.
                </p>
              </div>
            </div>
            <div className="storage-item">
              <Globe size={20} />
              <div>
                <strong>Never Transmitted</strong>
                <p>
                  Data never leaves your browser. We have no servers receiving your data.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* What We DON'T Collect */}
        <section className="ext-privacy-section">
          <h2>
            <XCircle size={24} />
            What We Do NOT Collect
          </h2>
          <div className="not-collected-grid">
            <div className="not-item">
              <XCircle size={18} />
              <span>Personal information</span>
            </div>
            <div className="not-item">
              <XCircle size={18} />
              <span>Browsing history</span>
            </div>
            <div className="not-item">
              <XCircle size={18} />
              <span>Passwords or form data</span>
            </div>
            <div className="not-item">
              <XCircle size={18} />
              <span>Cookies or session data</span>
            </div>
            <div className="not-item">
              <XCircle size={18} />
              <span>Financial information</span>
            </div>
            <div className="not-item">
              <XCircle size={18} />
              <span>Email or contact info</span>
            </div>
            <div className="not-item">
              <XCircle size={18} />
              <span>Usage analytics</span>
            </div>
            <div className="not-item">
              <XCircle size={18} />
              <span>Location data</span>
            </div>
          </div>
        </section>

        {/* Permissions Explained */}
        <section className="ext-privacy-section">
          <h2>
            <FileText size={24} />
            Extension Permissions Explained
          </h2>
          <p>Here's why the extension requests each permission:</p>
          <div className="permissions-table">
            <div className="permission-row header">
              <div className="perm-name">Permission</div>
              <div className="perm-reason">Why It's Needed</div>
            </div>
            <div className="permission-row">
              <div className="perm-name"><code>storage</code></div>
              <div className="perm-reason">To save captured tag data locally in your browser</div>
            </div>
            <div className="permission-row">
              <div className="perm-name"><code>activeTab</code></div>
              <div className="perm-reason">To read tag fires only on the tab you're currently viewing</div>
            </div>
            <div className="permission-row">
              <div className="perm-name"><code>scripting</code></div>
              <div className="perm-reason">To inject the capture script that monitors network requests and dataLayer</div>
            </div>
            <div className="permission-row">
              <div className="perm-name"><code>host_permissions</code><br/><small>(&lt;all_urls&gt;)</small></div>
              <div className="perm-reason">Required to capture tags on any website you choose to analyze. We only activate when you're debugging.</div>
            </div>
          </div>
        </section>

        {/* Data Sharing */}
        <section className="ext-privacy-section">
          <h2>
            <Share2 size={24} />
            Data Sharing
          </h2>
          <div className="no-sharing-box">
            <XCircle size={32} />
            <div>
              <strong>We Do NOT Share Your Data</strong>
              <p>
                We do not sell, rent, trade, or otherwise share your data with 
                any third parties. Ever. All processing is 100% local to your browser.
              </p>
            </div>
          </div>
        </section>

        {/* Data Retention */}
        <section className="ext-privacy-section">
          <h2>
            <Trash2 size={24} />
            Data Retention & Deletion
          </h2>
          <ul className="retention-list">
            <li>
              <strong>Local Storage Only:</strong> Data exists only in your browser's 
              local storage, not on any external servers.
            </li>
            <li>
              <strong>Automatic Cleanup:</strong> Data is cleared when you clear your 
              browser data or uninstall the extension.
            </li>
            <li>
              <strong>Manual Deletion:</strong> You can clear all captured data 
              anytime by clicking "Clear Data" in the extension popup.
            </li>
            <li>
              <strong>No Backups:</strong> We don't backup or archive your data 
              because we never receive it.
            </li>
          </ul>
        </section>

        {/* Your Rights */}
        <section className="ext-privacy-section">
          <h2>
            <Shield size={24} />
            Your Rights & Control
          </h2>
          <p>You have complete control over your data:</p>
          <ul className="rights-list">
            <li><strong>Access:</strong> View all captured data in the extension popup or dashboard</li>
            <li><strong>Delete:</strong> Clear all data with one click</li>
            <li><strong>Disable:</strong> Disable or uninstall the extension at any time</li>
            <li><strong>Lock:</strong> Lock capture to specific domains only</li>
          </ul>
        </section>

        {/* Third-Party Services */}
        <section className="ext-privacy-section">
          <h2>
            <Globe size={24} />
            Third-Party Services
          </h2>
          <p>
            The extension may open the GTM Container Analyzer dashboard at 
            <code>gtmcontaineranalyzer.com/live</code> to display your captured data. 
            This website is operated by us and follows our{' '}
            <Link to="/privacy">main privacy policy</Link>.
          </p>
          <p>
            No data is sent to any other third-party services.
          </p>
        </section>

        {/* Changes */}
        <section className="ext-privacy-section">
          <h2>
            <FileText size={24} />
            Changes to This Policy
          </h2>
          <p>
            We may update this privacy policy from time to time. Any changes will 
            be posted on this page with an updated revision date. Continued use of 
            the extension after changes constitutes acceptance of the updated policy.
          </p>
        </section>

        {/* Contact */}
        <section className="ext-privacy-section contact-section">
          <h2>
            <Mail size={24} />
            Contact Us
          </h2>
          <p>
            If you have questions about this privacy policy or the extension, 
            please contact us:
          </p>
          <div className="contact-info">
            <Mail size={18} />
            <a href="mailto:privacy@gtmcontaineranalyzer.com">privacy@gtmcontaineranalyzer.com</a>
          </div>
        </section>

        {/* Footer Note */}
        <section className="ext-privacy-footer-note">
          <p>
            This privacy policy applies specifically to the{' '}
            <strong>GTM Container Analyzer - Tag+Pixel Debugger</strong> browser extension. 
            For the website privacy policy, please see our{' '}
            <Link to="/privacy">main privacy policy</Link>.
          </p>
        </section>

      </main>

      <Footer />
    </div>
  );
};

export default ExtensionPrivacy;


