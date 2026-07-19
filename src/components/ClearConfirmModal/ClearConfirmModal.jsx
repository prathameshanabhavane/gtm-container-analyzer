import React, { useEffect } from 'react';
import { AlertTriangle, X, Trash2 } from 'lucide-react';

/**
 * Clear Confirmation Modal Component
 * Shows when user clicks the Clear button to prevent accidental data loss
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Handler for closing the modal
 * @param {Function} props.onConfirm - Handler for confirming the clear action
 * @param {string} props.containerName - Name of the container being cleared
 */
const ClearConfirmModal = ({ isOpen, onClose, onConfirm, containerName }) => {
  // Handle Escape key and body scroll lock
  useEffect(() => {
    if (!isOpen) return;
    
    // Lock body scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);
  
  if (!isOpen) return null;
  
  return (
    <div 
      className="clear-confirm-overlay" 
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="clear-confirm-title"
    >
      <div className="clear-confirm-modal" onClick={(e) => e.stopPropagation()}>
        <button 
          type="button"
          className="clear-confirm-close" 
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
        
        <div className="clear-confirm-icon">
          <AlertTriangle size={32} />
        </div>
        
        <h3 id="clear-confirm-title" className="clear-confirm-title">
          Clear Container Data?
        </h3>
        
        <p className="clear-confirm-message">
          This will remove <strong>{containerName || 'the current container'}</strong> from your browser's local storage. 
          You'll be redirected to the home page where you can upload a new file or sign in with Google to connect to GTM.
        </p>
        
        <div className="clear-confirm-info">
          <span>💡</span>
          <span>Your original GTM container is not affected — this only clears the local copy.</span>
        </div>
        
        <div className="clear-confirm-actions">
          <button type="button" className="clear-confirm-cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="clear-confirm-submit" onClick={onConfirm}>
            <Trash2 size={16} />
            Clear & Go Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClearConfirmModal;

