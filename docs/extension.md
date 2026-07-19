# Chrome Extension Debugger Architecture & Communication Protocol

This document describes how the Chrome Extension intercepts GTM dataLayer pushes and network tag beacons, and how it communicates with the GTM Container Analyzer dashboard.

---

## 1. Extension Runtime Components

The extension uses the standard **Manifest V3** architecture:
*   **Injected Script (`gtm-interceptor.js`)**: Runs in the main page context. Intercepts native `window.dataLayer.push` methods and reports them using DOM CustomEvents.
*   **Content Script (`capture.js`)**: Runs in an isolated context on matching tabs. Listens for the interceptor's CustomEvents and relays them to the background service worker.
*   **Service Worker (`service-worker.js`)**: Coordinates telemetry storage across tabs. Intercepts network headers to monitor ad pixels and GA4 measurement requests.
*   **Popup UI (`popup.html` / `popup.js`)**: Renders captured session metrics for quick checks.

```
┌────────────────────────────────────────────────────────┐
│ Page Context (Target Website)                          │
│                                                        │
│ dataLayer.push() ──> [gtm-interceptor.js] (intercept)  │
└──────────────────────────┬─────────────────────────────┘
                           │ CustomEvent("gtm_data_layer")
                           ▼
┌────────────────────────────────────────────────────────┐
│ Content Script Context (capture.js)                    │
│                                                        │
│ listens CustomEvent ──> chrome.runtime.sendMessage()   │
└──────────────────────────┬─────────────────────────────┘
                           │ message channel
                           ▼
┌────────────────────────────────────────────────────────┐
│ Extension Service Worker (service-worker.js)           │
│                                                        │
│ buffers logs, listens to chrome.webRequest             │
└──────────────────────────┬─────────────────────────────┘
                           │ chrome.tabs.sendMessage()
                           ▼
┌────────────────────────────────────────────────────────┐
│ Dashboard Tab Context (dashboard-bridge.js)            │
│                                                        │
│ listens runtime message ──> window.postMessage()        │
└──────────────────────────┬─────────────────────────────┘
                           │ DOM message channel
                           ▼
┌────────────────────────────────────────────────────────┐
│ GTM Dashboard Web App (LiveAnalyze.jsx / AIChat.jsx)   │
│                                                        │
│ window.addEventListener("message", ...)                │
└────────────────────────────────────────────────────────┘
```

---

## 2. Communication Bridge & postMessage Protocol

To pass data layer updates to the dashboard, the content script running on the dashboard page acts as a bridge.

### 2.1 Message Frame Structure
Messages passed through the `window.postMessage` API are serialized JSON frames:

```typescript
interface ExtensionBridgeMessage {
  source: 'gtm-live-analyzer-extension';
  type: 'LIVE_DATA_UPDATE';
  events: Array<{
    eventName: string;
    count: number;
    timestamp: string;
    payload?: Record<string, any>;
  }>;
}
```

### 2.2 Dashboard Listener Implementation
The React app registers a global listener inside `App.jsx` and `LiveAnalyze.jsx`:

```javascript
useEffect(() => {
  const handleBridgeMessages = (event) => {
    // Safety check: Validate message origin/source
    if (event.data && event.data.source === 'gtm-live-analyzer-extension') {
      if (event.data.type === 'LIVE_DATA_UPDATE' && Array.isArray(event.data.events)) {
        setLiveEvents(event.data.events);
      }
    }
  };
  window.addEventListener('message', handleBridgeMessages);
  return () => window.removeEventListener('message', handleBridgeMessages);
}, []);
```

---

## 3. Data Privacy Design

The extension is strictly **privacy-first**:
1. **100% Local Storage**: Intercepted event payloads are stored in memory or local Chrome session storage (`chrome.storage.session`).
2. **Zero Transmissions**: Data is never sent to external servers or databases. The bridge is strictly browser-local via `postMessage`.
3. **Automatic Cleanup**: Buffered tab event logs are destroyed instantly when the target tab is closed.
