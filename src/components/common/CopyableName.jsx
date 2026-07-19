/**
 * CopyableName Component
 * Generic copyable name component with optional icon (for variables, duplicates, etc.)
 */

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

const CopyableName = ({ name, icon: Icon, iconSize = 14, className = '' }) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(name);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };
  
  return (
    <div className={`copyable-name ${className}`}>
      {Icon && <Icon size={iconSize} className="copyable-name-icon" />}
      <span className="copyable-name-text" title={name}>{name}</span>
      <button 
        className={`copyable-name-btn ${copied ? 'copied' : ''}`}
        onClick={handleCopy}
        title={copied ? 'Copied!' : 'Copy name'}
      >
        {copied ? <Check size={11} /> : <Copy size={11} />}
      </button>
      {copied && <span className="copyable-name-tooltip">Copied!</span>}
    </div>
  );
};

export default CopyableName;

