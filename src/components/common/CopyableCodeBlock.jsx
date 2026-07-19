/**
 * CopyableCodeBlock Component
 * Code block with copy-to-clipboard button
 */

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

const CopyableCodeBlock = ({ content, label }) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };
  
  return (
    <div className="code-block-wrapper">
      <button 
        className={`copy-btn ${copied ? 'copied' : ''}`}
        onClick={handleCopy}
        title={copied ? 'Copied!' : `Copy ${label}`}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
        <span>{copied ? 'Copied!' : 'Copy'}</span>
      </button>
      <div className="code-block">{content}</div>
    </div>
  );
};

export default CopyableCodeBlock;

