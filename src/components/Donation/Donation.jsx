/**
 * Donation Component
 * Buy Me a Coffee integration for supporting the project
 * 
 * Easy to manage:
 * - Toggle DONATION_ENABLED to show/hide
 * - Update DONATION_URL to change link
 * - Self-contained - no conflicts when merging
 */

import { Coffee, Heart, ExternalLink } from 'lucide-react';
import './Donation.css';

// ============================================
// CONFIGURATION - Easy to manage
// ============================================
const DONATION_CONFIG = {
  enabled: true, // Set to false to hide donation button
  url: 'https://buymeacoffee.com/prathamesh_dev',
  buttonText: 'Buy me a coffee',
  tooltipText: 'Support this free tool',
};

/**
 * Donation Button Component
 * Renders a stylish "Buy Me a Coffee" button
 * 
 * @param {Object} props
 * @param {'default' | 'compact' | 'inline'} props.variant - Button style variant
 * @param {string} props.className - Additional CSS classes
 * @returns {JSX.Element | null}
 */
const Donation = ({ variant = 'default', className = '' }) => {
  // Don't render if donations are disabled
  if (!DONATION_CONFIG.enabled) {
    return null;
  }

  const handleClick = () => {
    // Open in new tab with security best practices
    window.open(DONATION_CONFIG.url, '_blank', 'noopener,noreferrer');
  };

  // Compact variant - just an icon
  if (variant === 'compact') {
    return (
      <button
        className={`donation-btn donation-compact ${className}`}
        onClick={handleClick}
        title={DONATION_CONFIG.tooltipText}
        aria-label={DONATION_CONFIG.buttonText}
      >
        <Coffee size={18} />
      </button>
    );
  }

  // Inline variant - text link style
  if (variant === 'inline') {
    return (
      <button
        className={`donation-btn donation-inline ${className}`}
        onClick={handleClick}
        title={DONATION_CONFIG.tooltipText}
      >
        <Coffee size={14} />
        <span>Support</span>
      </button>
    );
  }

  // Default variant - full button with animation
  return (
    <button
      className={`donation-btn donation-default ${className}`}
      onClick={handleClick}
      title={DONATION_CONFIG.tooltipText}
    >
      <span className="donation-icon-wrapper">
        <Coffee size={16} className="coffee-icon" />
      </span>
      <span className="donation-text">{DONATION_CONFIG.buttonText}</span>
      <ExternalLink size={12} className="external-icon" />
    </button>
  );
};

/**
 * Donation Link Component
 * For use in navigation or footer
 * Data-backed: Clear text (recognized) + Subtle styling (respectful)
 */
export const DonationLink = ({ className = '' }) => {
  if (!DONATION_CONFIG.enabled) {
    return null;
  }

  return (
    <a
      href={DONATION_CONFIG.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`donation-link ${className}`}
      title="Your support helps keep this tool free for everyone ☕"
    >
      <Coffee size={14} className="coffee-icon" />
      <span>Buy me a coffee</span>
    </a>
  );
};

// Export config for external access if needed
export const isDonationEnabled = () => DONATION_CONFIG.enabled;
export const getDonationUrl = () => DONATION_CONFIG.url;

export default Donation;

