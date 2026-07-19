/**
 * CopyableTagName Component
 * Tag name with copy-to-clipboard functionality (for table rows)
 */

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

const CopyableTagName = ({ name }) => {
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
    <div className="tag-name-wrapper">
      <span className="tag-name-text" title={name}>{name}</span>
      <button 
        className={`tag-copy-btn ${copied ? 'copied' : ''}`}
        onClick={handleCopy}
        title={copied ? 'Copied!' : 'Copy tag name for GTM search'}
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
        {copied && <span className="copy-tooltip">Copied!</span>}
      </button>
    </div>
  );
};

export default CopyableTagName;

