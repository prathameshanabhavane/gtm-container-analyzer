import { createPortal } from 'react-dom';
import { Monitor, HardDrive, WifiOff, ShieldCheck, X, Sparkles } from 'lucide-react';
import './PrivacyProofModal.css';

export const PrivacyProofModal = ({ isOpen, onClose, testType }) => {
  if (!isOpen) return null;
  
  const testContent = {
    network: {
      icon: <Monitor size={32} />,
      title: "Check Network Tab",
      subtitle: "See zero server requests",
      steps: [
        { num: 1, text: "Press F12 to open DevTools" },
        { num: 2, text: 'Click the "Network" tab' },
        { num: 3, text: "Clear existing requests (🚫 button)" },
        { num: 4, text: "Upload your GTM JSON file" },
        { num: 5, text: "Check the request list" },
      ],
      result: "0 Requests Made!",
      conclusion: "If we sent your data anywhere, you'd see requests here. Zero requests = Your data stays in your browser!"
    },
    storage: {
      icon: <HardDrive size={32} />,
      title: "Find Your Data",
      subtitle: "See where your data is stored",
      steps: [
        { num: 1, text: "Press F12 to open DevTools" },
        { num: 2, text: 'Go to "Application" tab' },
        { num: 3, text: 'Expand "IndexedDB" in left sidebar' },
        { num: 4, text: 'Click "GTMAnalyzer"' },
        { num: 5, text: "See your GTM data stored here" },
      ],
      result: "Data Found Locally!",
      conclusion: "Your data is stored in YOUR browser's IndexedDB, not on any server. You own it completely!"
    },
    offline: {
      icon: <WifiOff size={32} />,
      title: "Go Offline",
      subtitle: "Test offline functionality",
      steps: [
        { num: 1, text: "Keep this page open" },
        { num: 2, text: "Turn OFF your WiFi or Internet" },
        { num: 3, text: "Upload a new GTM file" },
        { num: 4, text: "Use search, filters, export" },
        { num: 5, text: "Everything still works!" },
      ],
      result: "Works Offline!",
      conclusion: "The page needs internet to load initially, but all data processing works offline. This proves no server communication!"
    },
    header: {
      icon: <ShieldCheck size={32} />,
      title: "100% Private",
      subtitle: "Your data never leaves your browser",
      steps: [
        { num: "✓", text: "All processing happens in YOUR browser" },
        { num: "✓", text: "Data stored in YOUR browser's IndexedDB" },
        { num: "✓", text: "Zero network requests for your data" },
        { num: "✓", text: "No accounts needed, your GTM data stays local" },
      ],
      result: "Complete Privacy",
      conclusion: "Press F12 → Network tab → Upload a file → See zero requests. Your GTM data never leaves your computer."
    }
  };
  
  const content = testContent[testType] || testContent.header;
  
  return createPortal(
    <div className="proof-modal-overlay" onClick={onClose}>
      <div className="proof-modal" onClick={e => e.stopPropagation()}>
        <button className="proof-modal-close" onClick={onClose}>
          <X size={20} />
        </button>
        
        <div className="proof-modal-header">
          <div className="proof-modal-icon">{content.icon}</div>
          <h2>{content.title}</h2>
          <p>{content.subtitle}</p>
        </div>
        
        <div className="proof-modal-steps">
          {content.steps.map((step, i) => (
            <div key={i} className="proof-step">
              <span className="proof-step-num">{step.num}</span>
              <span className="proof-step-text">{step.text}</span>
            </div>
          ))}
        </div>
        
        <div className="proof-modal-result">
          <Sparkles size={20} />
          <span>{content.result}</span>
        </div>
        
        <div className="proof-modal-conclusion">
          <p>{content.conclusion}</p>
        </div>
        
        <button className="proof-modal-btn" onClick={onClose}>
          Got It
        </button>
      </div>
    </div>,
    document.body
  );
};

export default PrivacyProofModal;


