/**
 * VariableDetailModal Component
 * Modal showing detailed variable information
 */

import { X, Variable, Tag, Code, Hash, Info } from 'lucide-react';
import { CopyableName } from '../common';

const VariableDetailModal = ({ variable, onClose }) => {
  if (!variable) return null;

  return (
    <div className="variable-modal-overlay" onClick={onClose}>
      <div className="variable-modal" onClick={(e) => e.stopPropagation()}>
        <div className="variable-modal-header">
          <CopyableName 
            name={variable.name} 
            icon={Variable} 
            iconSize={20}
            className="variable-modal-title"
          />
          <button className="variable-modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        
        <div className="variable-modal-badges">
          <span className="modal-type-badge">{variable.typeLabel}</span>
          <span className="modal-status-badge">Unused</span>
        </div>
        
        <div className="variable-modal-content">
          {/* Constant / Main Value */}
          {variable.content?.mainValue && (
            <div className="modal-row">
              <span className="modal-label">Value</span>
              <code className="modal-code">{variable.content.mainValue}</code>
            </div>
          )}
          
          {/* Data Layer Key */}
          {variable.content?.dataLayerKey && (
            <div className="modal-row">
              <span className="modal-label">Data Layer Key</span>
              <code className="modal-code">{variable.content.dataLayerKey}</code>
            </div>
          )}
          
          {/* Cookie Name */}
          {variable.content?.cookieName && (
            <div className="modal-row">
              <span className="modal-label">Cookie Name</span>
              <code className="modal-code">{variable.content.cookieName}</code>
            </div>
          )}
          
          {/* URL Component */}
          {variable.content?.urlComponent && (
            <div className="modal-row">
              <span className="modal-label">URL Component</span>
              <span className="modal-value">{variable.content.urlComponent}</span>
            </div>
          )}
          
          {/* CSS Selector */}
          {variable.content?.cssSelector && (
            <div className="modal-row">
              <span className="modal-label">CSS Selector</span>
              <code className="modal-code">{variable.content.cssSelector}</code>
            </div>
          )}
          
          {/* Element Attribute */}
          {variable.content?.elementAttribute && (
            <div className="modal-row">
              <span className="modal-label">Attribute</span>
              <span className="modal-value">{variable.content.elementAttribute}</span>
            </div>
          )}
          
          {/* Default Value */}
          {variable.content?.defaultValue && (
            <div className="modal-row">
              <span className="modal-label">Default Value</span>
              <code className="modal-code">{variable.content.defaultValue}</code>
            </div>
          )}
          
          {/* JavaScript Code */}
          {variable.content?.javascriptCode && (
            <div className="modal-code-section">
              <div className="modal-section-header">
                <Code size={14} />
                <span>JavaScript Code</span>
              </div>
              <pre className="modal-code-block">{variable.content.javascriptCode}</pre>
            </div>
          )}
          
          {/* Lookup Table */}
          {variable.content?.lookupTable && variable.content.lookupTable.length > 0 && (
            <div className="modal-table-section">
              <div className="modal-section-header">
                <Hash size={14} />
                <span>Lookup Table ({variable.content.lookupTable.length} entries)</span>
              </div>
              <table className="modal-table">
                <thead>
                  <tr>
                    <th>Input</th>
                    <th>Output</th>
                  </tr>
                </thead>
                <tbody>
                  {variable.content.lookupTable.map((entry, idx) => (
                    <tr key={idx}>
                      <td>{entry.key}</td>
                      <td>{entry.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {/* RegEx Table */}
          {variable.content?.regexTable && variable.content.regexTable.length > 0 && (
            <div className="modal-table-section">
              <div className="modal-section-header">
                <Hash size={14} />
                <span>RegEx Table ({variable.content.regexTable.length} patterns)</span>
              </div>
              <table className="modal-table">
                <thead>
                  <tr>
                    <th>Pattern</th>
                    <th>Output</th>
                  </tr>
                </thead>
                <tbody>
                  {variable.content.regexTable.map((entry, idx) => (
                    <tr key={idx}>
                      <td><code>{entry.pattern}</code></td>
                      <td>{entry.output}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {/* No content message */}
          {!variable.content?.mainValue && 
           !variable.content?.dataLayerKey && 
           !variable.content?.cookieName &&
           !variable.content?.javascriptCode &&
           !variable.content?.lookupTable?.length &&
           !variable.content?.regexTable?.length && (
            <div className="modal-empty">
              <Info size={16} />
              <span>No additional configuration for this variable type.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VariableDetailModal;

