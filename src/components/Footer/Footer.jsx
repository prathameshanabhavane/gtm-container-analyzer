/**
 * Premium Footer Component
 * Elegant design with trademark disclaimer
 * Used across all pages: Home, Privacy, Terms
 */

import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Heart, Shield } from 'lucide-react';
import { DonationLink } from '../Donation';
import { scrollToTop } from '../../utils';
import './Footer.css';

const Footer = () => {
  const [isSupport, setIsSupport] = useState(false);
  const location = useLocation();
  const currentYear = new Date().getFullYear();
  
  // Navigation links - easy to maintain
  const navLinks = [
    { path: '/', label: 'Home' },
    // { path: '/compare', label: 'Compare' },
    { path: '/privacy', label: 'Privacy' },
    { path: '/terms', label: 'Terms' },
  ];
  
  return (
    <footer className="premium-footer">
      {/* Decorative top border */}
      <div className="footer-glow-line" />
      
      <div className="footer-container">
        {/* Brand Section */}
        <div className="footer-brand">
          <Link to="/" className="footer-logo" onClick={scrollToTop}>
            <img src="/favicon.svg" alt="GTM Container Analyzer" className="logo-icon" />
            <span className="logo-text">GTM Container Analyzer</span>
          </Link>
          <p className="footer-tagline">Clarity for your Google Tag Manager</p>
        </div>
        
        {/* Navigation */}
        <nav className="footer-nav">
          {navLinks.map((link, index) => (
            <span key={link.path}>
              {location.pathname === link.path ? (
                <span className="footer-link active">{link.label}</span>
              ) : (
                <Link to={link.path} className="footer-link" onClick={scrollToTop}>{link.label}</Link>
              )}
              {index < navLinks.length - 1 && (
                <span className="footer-divider">·</span>
              )}
            </span>
          ))}
        </nav>
        
        {/* Trust Badges */}
        <div className="footer-trust">
          <div className="trust-badge">
            <Shield size={14} />
            <span>100% Private</span>
          </div>
          <div className="trust-badge">
            <span className="pulse-dot" />
            <span>Client-Side Only</span>
          </div>
        </div>
        
        {/* Copyright */}
        <div className="footer-bottom">
          <p className="footer-copyright">
            © {currentYear} GTM Container Analyzer
            <span className="made-with">
              <span className="dot-separator">·</span>
              Built with <Heart size={12} className="heart-icon" /> for the GTM community
            </span>
          </p>
          
          {/* Donation - Standalone, after "Built with love" */}
          {isSupport && 
            <div className="footer-support">
              <DonationLink />
            </div>
          }
          
          
          {/* Disclaimer */}
          <div className="footer-disclaimer">
            <p>
              <span className="trademark">Google Tag Manager™</span> is a trademark of Google LLC.
              <br />
              This tool is independently developed and not affiliated with or endorsed by Google.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
