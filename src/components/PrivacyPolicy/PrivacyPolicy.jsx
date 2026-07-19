/**
 * Privacy Policy Page
 * Professional, elegant design for Google OAuth verification
 */

import { 
  Shield, 
  Eye, 
  Database, 
  Lock, 
  Globe, 
  Mail,
  FileText,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  X
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Navbar from '../Navbar';
import Footer from '../Footer';
import './PrivacyPolicy.css';

const PrivacyPolicy = ({ theme, onThemeToggle }) => {
  const lastUpdated = "December 19, 2024";
  
  return (
    <div className="privacy-page has-navbar">
      {/* Premium Navbar */}
      <Navbar theme={theme} onThemeToggle={onThemeToggle} />
      
      {/* Header */}
      <header className="privacy-page-header">
        <div className="privacy-page-header-content">
          <Link to="/" className="back-home">
            <ArrowLeft size={18} />
            <span>Back to App</span>
          </Link>
          <div className="privacy-title-wrap">
            <Shield size={32} />
            <div>
              <h1>Privacy Policy</h1>
              <p className="last-updated">Last updated: {lastUpdated}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="privacy-page-content">
        <div className="privacy-container">
          
          {/* Introduction */}
          <section className="policy-section intro-section">
            <div className="intro-highlight">
              <CheckCircle size={24} />
              <div>
                <strong>Your Privacy is Our Priority</strong>
                <p>GTM Container Analyzer is designed with privacy at its core. All data processing happens locally in your browser — we never see, store, or transmit your Google Tag Manager data.</p>
              </div>
            </div>
          </section>

          {/* Section 1: Information We Access */}
          <section className="policy-section">
            <div className="section-header">
              <div className="section-icon blue">
                <Eye size={22} />
              </div>
              <h2>1. Information We Access</h2>
            </div>
            <p>When you connect your Google account, we request access to:</p>
            
            <div className="info-card">
              <h4>Google Tag Manager Data (Read-Only)</h4>
              <div className="access-list">
                <div className="access-item">
                  <CheckCircle size={16} />
                  <span>GTM Account names and IDs</span>
                </div>
                <div className="access-item">
                  <CheckCircle size={16} />
                  <span>Container names and IDs</span>
                </div>
                <div className="access-item">
                  <CheckCircle size={16} />
                  <span>Tags, Triggers, and Variables within containers</span>
                </div>
                <div className="access-item">
                  <CheckCircle size={16} />
                  <span>Container version information</span>
                </div>
              </div>
              <div className="scope-badge">
                <Lock size={14} />
                <code>tagmanager.readonly</code>
                <span>— Read-only access, no modifications possible</span>
              </div>
            </div>

            <div className="info-card not-access">
              <div className="not-access-header">
                <Shield size={20} />
                <h4>What We Do NOT Access</h4>
              </div>
              <div className="not-access-grid">
                <div className="not-access-item">
                  <X size={16} />
                  <span>Your email address</span>
                </div>
                <div className="not-access-item">
                  <X size={16} />
                  <span>Your name or profile</span>
                </div>
                <div className="not-access-item">
                  <X size={16} />
                  <span>Google Analytics data</span>
                </div>
                <div className="not-access-item">
                  <X size={16} />
                  <span>Other Google services</span>
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: How We Use Your Data */}
          <section className="policy-section">
            <div className="section-header">
              <div className="section-icon blue">
                <Database size={22} />
              </div>
              <h2>2. How We Use Your Data</h2>
            </div>
            <p>Your GTM data is used exclusively for:</p>
            
            <div className="use-grid">
              <div className="use-item">
                <CheckCircle size={18} />
                <span>Displaying your container structure</span>
              </div>
              <div className="use-item">
                <CheckCircle size={18} />
                <span>Analyzing tag dependencies</span>
              </div>
              <div className="use-item">
                <CheckCircle size={18} />
                <span>Identifying duplicate tags</span>
              </div>
              <div className="use-item">
                <CheckCircle size={18} />
                <span>Finding unused variables</span>
              </div>
              <div className="use-item">
                <CheckCircle size={18} />
                <span>Detecting orphan triggers</span>
              </div>
              <div className="use-item">
                <CheckCircle size={18} />
                <span>Generating reports locally</span>
              </div>
            </div>
          </section>

          {/* Section 3: Data Storage */}
          <section className="policy-section">
            <div className="section-header">
              <div className="section-icon blue">
                <Lock size={22} />
              </div>
              <h2>3. Data Storage & Security</h2>
            </div>
            
            <div className="storage-info">
              <div className="storage-card local">
                <h4>✓ Local Browser Storage</h4>
                <p>Your GTM data is stored in your browser's IndexedDB — a secure, local database that only you can access.</p>
              </div>
              <div className="storage-card memory">
                <h4>✓ Memory-Only Tokens</h4>
                <p>Google OAuth tokens are stored in memory only and are cleared when you close the browser tab.</p>
              </div>
              <div className="storage-card server">
                <h4>✗ No Server Storage</h4>
                <p>We do not have servers that store your data. Everything runs client-side in your browser.</p>
              </div>
            </div>

            <div className="verify-box">
              <h4>🔍 Verify It Yourself</h4>
              <p>Open your browser's Developer Tools (F12) → Network tab → Upload a file → See zero outgoing requests. Your data never leaves your computer.</p>
            </div>
          </section>

          {/* Section 4: Data Sharing */}
          <section className="policy-section">
            <div className="section-header">
              <div className="section-icon blue">
                <Globe size={22} />
              </div>
              <h2>4. Data Sharing & Third-Party Services</h2>
            </div>
            
            <div className="sharing-statement">
              <strong>We do not share, sell, or transmit your GTM data to any third party.</strong>
              <p>Your GTM configurations are processed locally and remain completely private.</p>
            </div>

            <div className="third-party-services">
              <h4>Third-Party Services We Use</h4>
              
              <div className="service-card">
                <div className="service-header">
                  <div className="service-icon google">G</div>
                  <div>
                    <strong>Google OAuth 2.0</strong>
                    <span>Authentication</span>
                  </div>
                </div>
                <p>Handles secure sign-in. We only receive an access token to read your GTM data. Google's privacy policy applies to the authentication process.</p>
              </div>

              <div className="service-card">
                <div className="service-header">
                  <div className="service-icon vercel">▲</div>
                  <div>
                    <strong>Vercel Analytics</strong>
                    <span>Usage Analytics</span>
                  </div>
                </div>
                <p>We use Vercel Analytics to understand how users interact with our application. This service is privacy-focused and GDPR compliant:</p>
                <ul className="analytics-details">
                  <li><CheckCircle size={14} /> No cookies used</li>
                  <li><CheckCircle size={14} /> No personal data collected</li>
                  <li><CheckCircle size={14} /> No cross-site tracking</li>
                  <li><CheckCircle size={14} /> Only aggregated, anonymous metrics (page views, country, device type)</li>
                </ul>
                <p className="analytics-note">Vercel Analytics does NOT have access to your GTM data — only general usage patterns.</p>
              </div>
            </div>
          </section>

          {/* Section 5: Your Rights */}
          <section className="policy-section">
            <div className="section-header">
              <div className="section-icon blue">
                <FileText size={22} />
              </div>
              <h2>5. Your Rights & Controls</h2>
            </div>
            
            <div className="rights-grid">
              <div className="right-item">
                <h4>Disconnect Anytime</h4>
                <p>Click "Sign out" to disconnect your Google account instantly.</p>
              </div>
              <div className="right-item">
                <h4>Clear Local Data</h4>
                <p>Use the "Clear" button to remove all stored GTM data from your browser.</p>
              </div>
              <div className="right-item">
                <h4>Revoke Access</h4>
                <p>Remove app access in your <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">Google Account Settings</a>.</p>
              </div>
              <div className="right-item">
                <h4>No Account Required</h4>
                <p>Upload JSON files directly without connecting Google at all.</p>
              </div>
            </div>
          </section>

          {/* Section 6: Children's Privacy */}
          <section className="policy-section">
            <h2>6. Children's Privacy</h2>
            <p>This application is designed for professional use and is not intended for children under 13. We do not knowingly collect any information from children.</p>
          </section>

          {/* Section 7: Changes to Policy */}
          <section className="policy-section">
            <h2>7. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. Any changes will be reflected on this page with an updated "Last updated" date. Continued use of the application after changes constitutes acceptance of the revised policy.</p>
          </section>

          {/* Section 8: Contact */}
          <section className="policy-section contact-section">
            <div className="section-header">
              <div className="section-icon blue">
                <Mail size={22} />
              </div>
              <h2>8. Contact Us</h2>
            </div>
            <p>If you have any questions about this Privacy Policy or our practices, please contact us:</p>
            
            <div className="contact-info">
              <div className="contact-item">
                <Mail size={18} />
                <a href="mailto:gtmcontaineranalyzer@gmail.com">gtmcontaineranalyzer@gmail.com</a>
              </div>
            </div>
          </section>

          {/* Summary Box */}
          <section className="policy-summary">
            <div className="summary-badge">
              <Shield size={20} />
              <span>Privacy First</span>
            </div>
            <h3>In Summary</h3>
            <p className="summary-intro">Your GTM data never leaves your browser. Here's our commitment:</p>
            <div className="summary-grid">
              <div className="summary-item good">
                <CheckCircle size={18} />
                <span>100% client-side processing</span>
              </div>
              <div className="summary-item good">
                <CheckCircle size={18} />
                <span>GTM data stays local</span>
              </div>
              <div className="summary-item good">
                <CheckCircle size={18} />
                <span>Read-only Google access</span>
              </div>
              <div className="summary-item good">
                <CheckCircle size={18} />
                <span>Privacy-focused analytics</span>
              </div>
              <div className="summary-item good">
                <CheckCircle size={18} />
                <span>You control your data</span>
              </div>
              <div className="summary-item good">
                <CheckCircle size={18} />
                <span>Disconnect anytime</span>
              </div>
            </div>
          </section>

        </div>
      </main>

      {/* Premium Footer */}
      <Footer />
    </div>
  );
};

export default PrivacyPolicy;

