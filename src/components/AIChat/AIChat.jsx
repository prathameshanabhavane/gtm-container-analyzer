import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Send, X, AlertTriangle, Layers, ShieldCheck, Zap, Trash2, ChevronDown } from 'lucide-react';
import { loadChatHistory, saveChatHistory, cleanDailyChatHistory, clearChatHistory } from '../../utils/indexedDB';
import './AIChat.css';

// Endpoint configurations
const SERVER_URL = import.meta.env.VITE_AI_SERVER_URL || 'http://localhost:3001';

const suggestionPrompts = [
  {
    label: '🔍 Audit Naming',
    desc: 'Verify naming pattern consistency across tags & variables.',
    prompt: 'Audit naming conventions of my container and show issues'
  },
  {
    label: '📈 GA4 Compliance',
    desc: 'Check custom event names against Google GA4 restrictions.',
    prompt: 'Validate my GA4 events and parameters against Google rules'
  },
  {
    label: '🛡️ Consent & Privacy',
    desc: 'Audit third-party pixels firing without consent settings.',
    prompt: 'Are my marketing tags firing before consent?'
  },
  {
    label: '🛒 Ecommerce Health',
    desc: 'Validate GA4 purchase tags for transaction variables.',
    prompt: "Why doesn't my GA4 ecommerce revenue match my store's sales?"
  },
  {
    label: '🧹 Find Bloat & Cleanup',
    desc: 'Scan for duplicate Custom HTML tags and unused variables.',
    prompt: 'Find duplicate, unused, or orphaned tags/triggers/variables'
  },
  {
    label: '⚡ Script Performance',
    desc: 'Identify render-blocking scripts that slow down page loads.',
    prompt: 'Which tags are slowing down page load?'
  },
  {
    label: '🔗 Live Correlation',
    desc: 'Cross-reference live debugger logs with GTM tags.',
    prompt: 'Check my live events correlation to see if they match GTM configurations'
  },
  {
    label: '🎓 Explain Setup',
    desc: 'Read a plain-English structural summary of this container.',
    prompt: 'Explain my container setup in plain English'
  }
];

export default function AIChat({ 
  isOpen, 
  onClose, 
  containerData, 
  liveEvents, 
  setLiveEvents, // To inject sandbox mock data
  onNodeHighlight 
}) {
  const [message, setMessage] = useState('');
  const [provider, setProvider] = useState('gemini');
  const [chatHistory, setChatHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [toolCalls, setToolCalls] = useState([]);
  const [serverWaking, setServerWaking] = useState(false);
  
  // Custom dropdown state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Model select options mapping
  const modelOptions = [
    { id: 'gemini', label: 'Gemini 2.0 (Free)', provider: 'gemini' },
    { id: 'groq', label: 'Llama 3.3 (Groq - Free)', provider: 'groq' },
    { id: 'openrouter:auto', label: 'Auto Free Model (OpenRouter)', provider: 'openrouter', model: 'auto' },
    { id: 'openrouter:llama', label: 'Llama 3.3 (OpenRouter - Free)', provider: 'openrouter', model: 'llama' },
    { id: 'openrouter:qwen', label: 'Qwen 2.5 (OpenRouter - Free)', provider: 'openrouter', model: 'qwen' },
    { id: 'ollama', label: 'Local Qwen (Ollama - Free)', provider: 'ollama' },
    { id: 'openai', label: 'GPT-4o-mini (OpenAI)', provider: 'openai' },
    { id: 'anthropic', label: 'Claude 3.5 (Anthropic)', provider: 'anthropic' }
  ];

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, toolCalls, isLoading]);

  // Load chat history from IndexedDB on mount
  useEffect(() => {
    const initializeChatHistory = async () => {
      await cleanDailyChatHistory(); // Clear chat history if older than 24h
      const storedHistory = await loadChatHistory();
      if (storedHistory && storedHistory.length > 0) {
        setChatHistory(storedHistory);
      }
    };
    
    if (isOpen) {
      initializeChatHistory();
    }
  }, [isOpen]);

  // Save chat history to IndexedDB when updated
  useEffect(() => {
    if (chatHistory.length > 0) {
      saveChatHistory(chatHistory);
    }
  }, [chatHistory]);

  // Wake up check for Render free tier sleep mode
  useEffect(() => {
    if (isOpen && chatHistory.length === 0) {
      setServerWaking(true);
      fetch(`${SERVER_URL}/health`)
        .then(res => res.json())
        .then(() => setServerWaking(false))
        .catch(() => {
          // Silent catch - will show warning if first request fails
          setServerWaking(false);
        });
    }
  }, [isOpen, chatHistory.length]);

  if (!isOpen) return null;

  // Handle manual clearing of chat database
  const handleClearChat = async () => {
    if (window.confirm("Are you sure you want to clear your chat history?")) {
      await clearChatHistory();
      setChatHistory([]);
    }
  };

  // Handle mock sandbox loading
  const loadSandboxData = () => {
    const mockLogs = [
      { eventName: 'page_view', count: 18 },
      { eventName: 'click', count: 5 },
      { eventName: 'view_item', count: 8 },
      { eventName: 'purchase', count: 0 } // Intentional mismatch: GTM has purchase tag, but count is 0
    ];
    setLiveEvents(mockLogs);
    setChatHistory(prev => [
      ...prev,
      {
        role: 'model',
        parts: [{ text: '📥 **Sandbox Debug Session Loaded**: Simulated 4 live events. You can now ask: *"Check my live events correlation"* to see if they match GTM configurations.' }]
      }
    ]);
  };

  // Helper to format/link nodes in AI message text
  const formatAiMessage = (text) => {
    if (!text) return '';
    
    // Find GTM entity names (tags, triggers, variables) that match user's container
    if (!containerData?.containerVersion) {
      return text;
    }

    const tags = containerData.containerVersion.tag || [];
    const triggers = containerData.containerVersion.trigger || [];
    const variables = containerData.containerVersion.variable || [];

    const allNames = [
      ...tags.map(t => ({ name: t.name, type: 'tag' })),
      ...triggers.map(t => ({ name: t.name, type: 'trigger' })),
      ...variables.map(t => ({ name: t.name, type: 'variable' }))
    ].sort((a, b) => b.name.length - a.name.length); // Longest names first to prevent partial overlaps

    let html = text;
    
    // Escape standard regex characters
    const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    allNames.forEach(({ name, type }) => {
      // Find full-word matches or quoted text
      const regex = new RegExp(`(?<=^|\\s|["'\`\\[\\(])${escapeRegExp(name)}(?=$|\\s|["'\`\\]\\),\\.])`, 'g');
      
      // We will replace with a placeholder token that doesn't get messed up by concurrent replacements
      // and map to onClick highlighting
      html = html.replace(regex, `##NODE:${type}:${name}##`);
    });

    // Translate markdown bold/italic/lists roughly
    // Simple inline Markdown parser
    let formattedText = html
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br/>');

    // Restore node badges with interactive links
    allNames.forEach(({ name, type }) => {
      const token = `##NODE:${type}:${name}##`;
      const badgeHtml = `<span class="ai-chat-node-badge" title="Click to view on Visual Flow Canvas" onclick="window.__aiChatHighlightNode('${name}')">🔍 ${name}</span>`;
      formattedText = formattedText.replaceAll(token, badgeHtml);
    });

    // Inject global window handler for badge clicks
    window.__aiChatHighlightNode = (name) => {
      if (onNodeHighlight) {
        onNodeHighlight(name);
      }
    };

    return <div dangerouslySetInnerHTML={{ __html: formattedText }} />;
  };

  const handleSend = async (e, customQuery = null) => {
    if (e) e.preventDefault();
    const userQuery = customQuery || message;
    if (!userQuery.trim() || isLoading) return;

    if (!customQuery) {
      setMessage('');
    }
    setIsLoading(true);
    setToolCalls([]);

    // Add user message to history
    const newUserMsg = { role: 'user', parts: [{ text: userQuery }] };
    
    // We construct the updated history locally so that it is passed to the fetch body instantly
    // instead of waiting for React state batching
    const currentHistory = [...chatHistory];
    setChatHistory(prev => [...prev, newUserMsg]);

    try {
      const activeModel = modelOptions.find(opt => opt.id === provider) || modelOptions[0];
      const response = await fetch(`${SERVER_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userQuery,
          containerJson: containerData,
          liveEvents: liveEvents,
          history: currentHistory,
          provider: activeModel.provider,
          model: activeModel.model
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');

      // Initialize AI bubble state placeholder in history list
      setChatHistory(prev => [...prev, { role: 'model', parts: [{ text: '' }] }]);

      let accumulatedText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6).trim());
              
              if (data.type === 'text') {
                accumulatedText += data.content;
                // Update final index message in history
                setChatHistory(prev => {
                  const updated = [...prev];
                  const lastIndex = updated.length - 1;
                  updated[lastIndex] = {
                    role: 'model',
                    parts: [{ text: accumulatedText }]
                  };
                  return updated;
                });
              } else if (data.type === 'tool_call') {
                setToolCalls(prev => [...prev, { name: data.content, status: 'running' }]);
              } else if (data.type === 'tool_result') {
                setToolCalls(prev => {
                  const updated = [...prev];
                  const idx = updated.findIndex(c => c.status === 'running');
                  if (idx !== -1) {
                    updated[idx].status = 'success';
                  }
                  return updated;
                });
              }
            } catch (err) {
              // Ignore invalid JSON lines
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setChatHistory(prev => [
        ...prev,
        { role: 'model', parts: [{ text: `❌ **Error connecting to AI Server**: ${error.message || String(error)}. Make sure the backend server is running and configured.` }] }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="ai-chat-container">
      {/* Header */}
      <div className="ai-chat-header">
        <div className="ai-chat-title-group">
          <div className="ai-chat-avatar">
            <Sparkles size={18} />
          </div>
          <div>
            <h4 className="ai-chat-title">GTM Insight AI</h4>
            <p className="ai-chat-subtitle">GTM & GA4 Verification Agent</p>
          </div>
        </div>

        <div className="ai-chat-controls">
          <div className="ai-chat-dropdown-wrapper" ref={dropdownRef}>
            <button 
              className={`ai-chat-dropdown-btn ${isDropdownOpen ? 'open' : ''}`}
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              type="button"
            >
              <span className="ai-chat-dropdown-label">
                {modelOptions.find(opt => opt.id === provider)?.label || 'Gemini 2.0 (Free)'}
              </span>
              <ChevronDown size={14} className={`select-chevron ${isDropdownOpen ? 'open' : ''}`} />
            </button>
            
            {isDropdownOpen && (
              <div className="ai-chat-dropdown-menu">
                {modelOptions.map((opt) => (
                  <button
                    key={opt.id}
                    className={`ai-chat-dropdown-item ${provider === opt.id ? 'selected' : ''}`}
                    onClick={() => {
                      setProvider(opt.id);
                      setIsDropdownOpen(false);
                    }}
                    type="button"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <button 
            onClick={handleClearChat} 
            className="ai-chat-close-btn"
            title="Clear Chat History"
            style={{ color: 'var(--text-secondary)' }}
          >
            <Trash2 size={16} />
          </button>
          
          <button onClick={onClose} className="ai-chat-close-btn" title="Close Panel">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Render sleep wake alert */}
      {serverWaking && (
        <div className="ai-chat-status-bar">
          <div className="ai-chat-status-dot"></div>
          <span>Waking up free Render.com server. Please wait...</span>
        </div>
      )}

      {/* Chat Messages */}
      <div className="ai-chat-messages">
        {chatHistory.length === 0 && (
          <div className="ai-chat-welcome-panel">
            <Sparkles size={32} className="ai-chat-welcome-icon" />
            <h5 className="ai-chat-welcome-title">Welcome to GTM Insight AI</h5>
            <p className="ai-chat-welcome-desc">
              I can audit your container setup, validate naming convention compliance, GA4 configurations, and crosscheck live debugger logs.
            </p>
            
            {containerData ? (
              <div className="ai-chat-status-card success">
                <ShieldCheck size={16} className="ai-chat-status-card-icon" />
                <div className="ai-chat-status-card-content">
                  <span className="ai-chat-status-card-title">GTM Container Linked!</span>
                  <div className="ai-chat-status-card-meta">
                    <span className="ai-chat-status-card-detail">
                      <strong>Active ID:</strong> {containerData.containerVersion?.container?.publicId || containerData.containerVersion?.containerId || 'GTM-XXXXXX'}
                    </span>
                    <span className="ai-chat-status-card-detail">
                      <strong>Version Name:</strong> {containerData.containerVersion?.container?.name || containerData.containerVersion?.name || 'Latest'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="ai-chat-status-card warning">
                <AlertTriangle size={16} className="ai-chat-status-card-icon" />
                <div className="ai-chat-status-card-content">
                  <span className="ai-chat-status-card-title">No Container Active</span>
                  <span className="ai-chat-status-card-detail">
                    Please upload a container JSON file or link one via OAuth to run live AI audits.
                  </span>
                </div>
              </div>
            )}
            
            <div className="ai-chat-welcome-actions">
              <button 
                onClick={loadSandboxData}
                className="ai-chat-sandbox-btn"
              >
                📥 Load Sandbox Debug Session
              </button>
              
              <div className="ai-chat-suggestions-container">
                <p className="ai-chat-suggestions-title">Quick Audit Prompts</p>
                <div className="ai-chat-suggestions-grid">
                  {suggestionPrompts.map((s, idx) => (
                    <button 
                      key={idx}
                      onClick={() => handleSend(null, s.prompt)}
                      className="ai-chat-suggestion-chip"
                      title={s.prompt}
                    >
                      <div className="ai-chat-suggestion-chip-content">
                        <span className="ai-chat-suggestion-chip-label">{s.label}</span>
                        <span className="ai-chat-suggestion-chip-desc">{s.desc}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {chatHistory.map((msg, index) => {
          const isEmptyModel = msg.role === 'model' && !msg.parts[0]?.text;
          return (
            <div key={index} className={`ai-chat-message-row ${msg.role}`}>
              <div className="ai-chat-bubble">
                {isEmptyModel ? (
                  <div className="ai-chat-thinking-dots">
                    <span className="ai-chat-thinking-dot"></span>
                    <span className="ai-chat-thinking-dot"></span>
                    <span className="ai-chat-thinking-dot"></span>
                  </div>
                ) : (
                  msg.role === 'model' ? formatAiMessage(msg.parts[0]?.text) : msg.parts[0]?.text
                )}
              </div>
            </div>
          );
        })}

        {/* Display active running tool logs */}
        {toolCalls.map((call, idx) => (
          <div key={`tool-${idx}`} className="ai-chat-tool-card">
            <Zap size={12} className={call.status === 'running' ? 'ai-chat-tool-spinner' : ''} />
            <span>
              {call.status === 'running' ? `Running tool: ${call.name}...` : `Completed tool call: ${call.name}`}
            </span>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSend} className="ai-chat-input-area">
        <input 
          type="text" 
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={isLoading ? "Analyzing GTM container..." : "Ask AI about tags, GA4 settings, or triggers..."}
          className="ai-chat-input"
          disabled={isLoading}
        />
        <button 
          type="submit" 
          disabled={isLoading || !message.trim()}
          className="ai-chat-send-btn"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
