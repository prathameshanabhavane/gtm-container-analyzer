/**
 * Navbar Component
 * Minimal, elegant navigation bar for homepage
 * Premium glassmorphism design
 */

import { Link, useLocation } from 'react-router-dom';
import { GitCompare, Moon, Sun } from 'lucide-react';
import { scrollToTop } from '../../utils';
import './Navbar.css';

const Navbar = ({ theme, onThemeToggle }) => {
  const location = useLocation();
  const isComparePage = location.pathname === '/compare';
  
  return (
    <nav className="navbar">
      <div className="navbar-container">
        {/* Logo & Brand - Always "GTM Container Analyzer" */}
        <Link to="/" className="navbar-brand" onClick={scrollToTop}>
          <div className="navbar-logo">
            <img src="/logo.png" alt="GTM Container Analyzer" />
          </div>
          <span className="navbar-title">
            <span className="navbar-title-gtm">GTM</span>
            <span className="navbar-title-rest">Container Analyzer</span>
          </span>
        </Link>
        
        {/* Navigation Links */}
        <div className="navbar-links">
          <Link 
            to="/compare" 
            className={`navbar-link ${isComparePage ? 'active' : ''}`}
            onClick={scrollToTop}
          >
            <GitCompare size={15} />
            <span>Compare</span>
          </Link>
          
          {/* Divider */}
          <div className="navbar-divider" />
          
          {/* Theme Toggle */}
          <button 
            className="navbar-theme-toggle"
            onClick={onThemeToggle}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle theme"
          >
            <span className="navbar-theme-icon sun-icon">
              <Sun size={16} />
            </span>
            <span className="navbar-theme-icon moon-icon">
              <Moon size={16} />
            </span>
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

