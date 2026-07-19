/**
 * Format Change Modal
 * 
 * Graceful error handling when GTM format or Google API changes.
 * Shows a user-friendly message instead of crashing.
 * Helps developers identify what needs updating.
 * 
 * DEVELOPER NOTE:
 * If you see this modal appearing for users, check:
 * - GTM export format changes in compareContainers.js
 * - Google API response changes in GTMAuthContext.jsx
 */

import { AlertTriangle, RefreshCw, ExternalLink, X, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import './FormatChangeModal.css';

const FormatChangeModal = ({ 
  isOpen, 
  onClose, 
  errorType = 'unknown',
  errorDetails = null,
  errorCode = null
}) => {
  const [copied, setCopied] = useState(false);
  
  if (!isOpen) return null;

  const errorConfig = {
    gtm_format: {
      title: 'GTM Format May Have Changed',
      icon: '📦',
      message: 'The GTM container structure looks different than expected. Google may have updated their export format.',
      suggestion: 'Try exporting your container again from GTM. If the issue persists, the tool may need an update.',
      showDetails: true
    },
    google_api: {
      title: 'Google API Response Changed',
      icon: '🔌',
      message: 'The response from Google Tag Manager API is different than expected.',
      suggestion: 'Try signing out and back in. If the issue persists, the tool may need an update.',
      showDetails: true
    },
    parse_error: {
      title: 'Unable to Parse Container',
      icon: '📄',
      message: 'The file could not be parsed correctly. It may be corrupted or in an unexpected format.',
      suggestion: 'Make sure you\'re uploading a valid GTM container export (.json file from GTM Admin > Export Container).',
      showDetails: true
    },
    network_error: {
      title: 'Connection Issue',
      icon: '🌐',
      message: 'Unable to connect to Google services.',
      suggestion: 'Check your internet connection and try again.',
      showDetails: false
    },
    auth_error: {
      title: 'Authentication Issue',
      icon: '🔐',
      message: 'There was a problem with Google authentication.',
      suggestion: 'Try signing out and signing back in with the correct Google account.',
      showDetails: true
    },
    unknown: {
      title: 'Something Went Wrong',
      icon: '⚠️',
      message: 'An unexpected error occurred while processing your request.',
      suggestion: 'Please try again. If the issue persists, the tool may need an update.',
      showDetails: true
    }
  };

  const config = errorConfig[errorType] || errorConfig.unknown;

  const handleCopyError = () => {
    const errorInfo = `
Error Type: ${errorType}
Error Code: ${errorCode || 'N/A'}
Details: ${errorDetails || 'N/A'}
Timestamp: ${new Date().toISOString()}
URL: ${window.location.href}
    `.trim();
    
    navigator.clipboard.writeText(errorInfo);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="format-modal-overlay" onClick={onClose}>
      <div className="format-modal" onClick={e => e.stopPropagation()}>
        <button className="format-modal-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
        
        <div className="format-modal-icon">{config.icon}</div>
        
        <h2 className="format-modal-title">{config.title}</h2>
        
        <p className="format-modal-message">{config.message}</p>
        
        <div className="format-modal-suggestion">
          <AlertTriangle size={14} />
          <span>{config.suggestion}</span>
        </div>
        
        {config.showDetails && errorDetails && (
          <div className="format-modal-details">
            <div className="format-modal-details-header">
              <span>Technical Details</span>
              <button 
                className="format-modal-copy"
                onClick={handleCopyError}
                title="Copy error details"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <code className="format-modal-code">
              {errorCode && <div>Code: {errorCode}</div>}
              <div>{typeof errorDetails === 'string' ? errorDetails : JSON.stringify(errorDetails, null, 2)}</div>
            </code>
          </div>
        )}
        
        <div className="format-modal-actions">
          <button className="format-modal-btn primary" onClick={onClose}>
            <RefreshCw size={16} />
            Try Again
          </button>
        </div>
        
        <p className="format-modal-footer">
          If this issue persists, please report it so we can update the tool.
        </p>
      </div>
    </div>
  );
};

export default FormatChangeModal;
