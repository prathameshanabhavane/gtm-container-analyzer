/**
 * Terms of Service Page
 * Professional, elegant design for Google OAuth verification
 */

import { 
  FileText, 
  Shield, 
  Users, 
  AlertTriangle,
  CheckCircle,
  Scale,
  Ban,
  RefreshCw,
  Mail,
  ArrowLeft,
  Globe,
  Zap
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Navbar from '../Navbar';
import Footer from '../Footer';
import './TermsOfService.css';

const TermsOfService = ({ theme, onThemeToggle }) => {
  const lastUpdated = "December 19, 2024";
  const effectiveDate = "December 19, 2024";
  
  return (
    <div className="terms-page has-navbar">
      {/* Premium Navbar */}
      <Navbar theme={theme} onThemeToggle={onThemeToggle} />
      
      {/* Header */}
      <header className="terms-header">
        <div className="terms-header-content">
          <Link to="/" className="back-home">
            <ArrowLeft size={18} />
            <span>Back to App</span>
          </Link>
          <div className="terms-title-wrap">
            <FileText size={32} />
            <div>
              <h1>Terms of Service</h1>
              <p className="last-updated">Last updated: {lastUpdated}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="terms-content">
        <div className="terms-container">
          
          {/* Introduction */}
          <section className="terms-section intro-section">
            <div className="intro-box">
              <p>Welcome to GTM Container Analyzer. By using our service, you agree to these terms. Please read them carefully.</p>
              <div className="effective-date">
                <CheckCircle size={16} />
                <span>Effective Date: {effectiveDate}</span>
              </div>
            </div>
          </section>

          {/* Section 1: Acceptance */}
          <section className="terms-section">
            <div className="section-header">
              <div className="section-icon blue">
                <CheckCircle size={22} />
              </div>
              <h2>1. Acceptance of Terms</h2>
            </div>
            <div className="section-content">
              <p>By accessing or using GTM Container Analyzer ("the Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, please do not use the Service.</p>
              <div className="highlight-box">
                <p>These Terms apply to all users of the Service, including users who connect their Google Tag Manager accounts.</p>
              </div>
            </div>
          </section>

          {/* Section 2: Description */}
          <section className="terms-section">
            <div className="section-header">
              <div className="section-icon purple">
                <Zap size={22} />
              </div>
              <h2>2. Description of Service</h2>
            </div>
            <div className="section-content">
              <p>GTM Container Analyzer is a web-based tool that helps users analyze their Google Tag Manager containers. The Service provides:</p>
              <div className="features-list">
                <div className="feature-item">
                  <CheckCircle size={16} />
                  <span>Container structure visualization</span>
                </div>
                <div className="feature-item">
                  <CheckCircle size={16} />
                  <span>Tag dependency analysis</span>
                </div>
                <div className="feature-item">
                  <CheckCircle size={16} />
                  <span>Duplicate tag detection</span>
                </div>
                <div className="feature-item">
                  <CheckCircle size={16} />
                  <span>Unused variable identification</span>
                </div>
                <div className="feature-item">
                  <CheckCircle size={16} />
                  <span>Orphan trigger detection</span>
                </div>
                <div className="feature-item">
                  <CheckCircle size={16} />
                  <span>Local data export capabilities</span>
                </div>
              </div>
            </div>
          </section>

          {/* Section 3: Google Account Access */}
          <section className="terms-section">
            <div className="section-header">
              <div className="section-icon green">
                <Shield size={22} />
              </div>
              <h2>3. Google Account Access</h2>
            </div>
            <div className="section-content">
              <p>When you connect your Google account, you grant us limited, read-only access to your Google Tag Manager data. By connecting, you acknowledge that:</p>
              <div className="terms-grid">
                <div className="term-card">
                  <h4>Read-Only Access</h4>
                  <p>We only request read-only permission. We cannot modify, delete, or publish changes to your GTM containers.</p>
                </div>
                <div className="term-card">
                  <h4>Local Processing</h4>
                  <p>Your GTM data is processed entirely in your browser. We do not store your container data on any server.</p>
                </div>
                <div className="term-card">
                  <h4>Revoke Anytime</h4>
                  <p>You can revoke access at any time through your Google Account settings or by signing out of our Service.</p>
                </div>
                <div className="term-card">
                  <h4>Google's Terms Apply</h4>
                  <p>Your use of Google services is also subject to Google's Terms of Service and Privacy Policy.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 4: User Responsibilities */}
          <section className="terms-section">
            <div className="section-header">
              <div className="section-icon cyan">
                <Users size={22} />
              </div>
              <h2>4. User Responsibilities</h2>
            </div>
            <div className="section-content">
              <p>As a user of the Service, you agree to:</p>
              <div className="responsibilities-list">
                <div className="responsibility-item">
                  <CheckCircle size={16} />
                  <div>
                    <strong>Authorized Access</strong>
                    <p>Only connect Google accounts and access GTM containers you are authorized to use.</p>
                  </div>
                </div>
                <div className="responsibility-item">
                  <CheckCircle size={16} />
                  <div>
                    <strong>Lawful Use</strong>
                    <p>Use the Service only for lawful purposes and in compliance with all applicable laws.</p>
                  </div>
                </div>
                <div className="responsibility-item">
                  <CheckCircle size={16} />
                  <div>
                    <strong>Accurate Information</strong>
                    <p>Provide accurate information when using the Service.</p>
                  </div>
                </div>
                <div className="responsibility-item">
                  <CheckCircle size={16} />
                  <div>
                    <strong>Security</strong>
                    <p>Maintain the security of your Google account credentials.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 5: Prohibited Uses */}
          <section className="terms-section">
            <div className="section-header">
              <div className="section-icon red">
                <Ban size={22} />
              </div>
              <h2>5. Prohibited Uses</h2>
            </div>
            <div className="section-content">
              <p>You agree NOT to use the Service to:</p>
              <div className="prohibited-grid">
                <div className="prohibited-item">
                  <AlertTriangle size={16} />
                  <span>Access accounts without authorization</span>
                </div>
                <div className="prohibited-item">
                  <AlertTriangle size={16} />
                  <span>Attempt to breach security measures</span>
                </div>
                <div className="prohibited-item">
                  <AlertTriangle size={16} />
                  <span>Reverse engineer the Service</span>
                </div>
                <div className="prohibited-item">
                  <AlertTriangle size={16} />
                  <span>Use automated systems to access the Service</span>
                </div>
                <div className="prohibited-item">
                  <AlertTriangle size={16} />
                  <span>Interfere with the Service's operation</span>
                </div>
                <div className="prohibited-item">
                  <AlertTriangle size={16} />
                  <span>Violate any applicable laws or regulations</span>
                </div>
              </div>
            </div>
          </section>

          {/* Section 6: Intellectual Property */}
          <section className="terms-section">
            <div className="section-header">
              <div className="section-icon orange">
                <Scale size={22} />
              </div>
              <h2>6. Intellectual Property</h2>
            </div>
            <div className="section-content">
              <p>The Service and its original content, features, and functionality are owned by GTM Container Analyzer and are protected by international copyright, trademark, and other intellectual property laws.</p>
              <div className="ip-info">
                <div className="ip-item">
                  <strong>Your Data</strong>
                  <p>You retain all rights to your GTM container data. We claim no ownership over your content.</p>
                </div>
                <div className="ip-item">
                  <strong>Our Service</strong>
                  <p>The application code, design, and branding remain our intellectual property.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 7: Disclaimers */}
          <section className="terms-section">
            <div className="section-header">
              <div className="section-icon yellow">
                <AlertTriangle size={22} />
              </div>
              <h2>7. Disclaimers</h2>
            </div>
            <div className="section-content">
              <div className="disclaimer-box">
                <p><strong>THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND.</strong></p>
                <p>We do not warrant that:</p>
                <ul>
                  <li>The Service will be uninterrupted or error-free</li>
                  <li>Results obtained will be accurate or reliable</li>
                  <li>The Service will meet your specific requirements</li>
                </ul>
                <p>You use the Service at your own risk. We recommend verifying any analysis results before making changes to your GTM containers.</p>
              </div>
            </div>
          </section>

          {/* Section 8: Limitation of Liability */}
          <section className="terms-section">
            <div className="section-header">
              <div className="section-icon gray">
                <Shield size={22} />
              </div>
              <h2>8. Limitation of Liability</h2>
            </div>
            <div className="section-content">
              <p>To the maximum extent permitted by law, GTM Container Analyzer shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from:</p>
              <div className="liability-list">
                <div className="liability-item">Your use or inability to use the Service</div>
                <div className="liability-item">Any unauthorized access to your data</div>
                <div className="liability-item">Any errors or omissions in the Service</div>
                <div className="liability-item">Any third-party content or conduct</div>
              </div>
            </div>
          </section>

          {/* Section 9: Changes to Terms */}
          <section className="terms-section">
            <div className="section-header">
              <div className="section-icon blue">
                <RefreshCw size={22} />
              </div>
              <h2>9. Changes to Terms</h2>
            </div>
            <div className="section-content">
              <p>We reserve the right to modify these Terms at any time. Changes will be effective immediately upon posting to this page. Your continued use of the Service after changes constitutes acceptance of the modified Terms.</p>
              <div className="notice-box">
                <CheckCircle size={18} />
                <p>We encourage you to review these Terms periodically for any updates.</p>
              </div>
            </div>
          </section>

          {/* Section 10: Termination */}
          <section className="terms-section">
            <div className="section-header">
              <div className="section-icon purple">
                <Ban size={22} />
              </div>
              <h2>10. Termination</h2>
            </div>
            <div className="section-content">
              <p>We may terminate or suspend your access to the Service immediately, without prior notice, for any reason, including breach of these Terms. Upon termination:</p>
              <div className="termination-info">
                <div className="term-item">
                  <CheckCircle size={16} />
                  <span>Your right to use the Service will cease immediately</span>
                </div>
                <div className="term-item">
                  <CheckCircle size={16} />
                  <span>Any locally stored data remains on your device</span>
                </div>
                <div className="term-item">
                  <CheckCircle size={16} />
                  <span>You can revoke Google access through your account settings</span>
                </div>
              </div>
            </div>
          </section>

          {/* Section 11: Governing Law */}
          <section className="terms-section">
            <div className="section-header">
              <div className="section-icon green">
                <Globe size={22} />
              </div>
              <h2>11. Governing Law</h2>
            </div>
            <div className="section-content">
              <p>These Terms shall be governed by and construed in accordance with applicable laws, without regard to conflict of law principles. Any disputes arising from these Terms will be resolved in the appropriate courts.</p>
            </div>
          </section>

          {/* Section 12: Contact */}
          <section className="terms-section contact-section">
            <div className="section-header">
              <div className="section-icon cyan">
                <Mail size={22} />
              </div>
              <h2>12. Contact Us</h2>
            </div>
            <div className="section-content">
              <p>If you have any questions about these Terms of Service, please contact us:</p>
              <div className="contact-info">
                <div className="contact-item">
                  <Mail size={18} />
                  <a href="mailto:gtmcontaineranalyzer@gmail.com">gtmcontaineranalyzer@gmail.com</a>
                </div>
              </div>
            </div>
          </section>

          {/* Summary Box */}
          <section className="terms-summary">
            <div className="summary-badge">
              <FileText size={20} />
              <span>Quick Summary</span>
            </div>
            <h3>Key Points</h3>
            <p className="summary-intro">Here's what you need to know:</p>
            <div className="summary-grid">
              <div className="summary-item">
                <CheckCircle size={18} />
                <span>Free to use for GTM analysis</span>
              </div>
              <div className="summary-item">
                <CheckCircle size={18} />
                <span>Read-only access to your GTM</span>
              </div>
              <div className="summary-item">
                <CheckCircle size={18} />
                <span>Your data stays in your browser</span>
              </div>
              <div className="summary-item">
                <CheckCircle size={18} />
                <span>Revoke access anytime</span>
              </div>
              <div className="summary-item">
                <CheckCircle size={18} />
                <span>Use responsibly and lawfully</span>
              </div>
              <div className="summary-item">
                <CheckCircle size={18} />
                <span>Service provided "as is"</span>
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

export default TermsOfService;

