# GTM Container Analyzer — Architecture Documentation

This document describes the high-level system architecture, data routing flows, and component responsibilities of the GTM Container Analyzer analytics auditing system.

---

## 1. System Topology

GTM Container Analyzer consists of four primary components designed to collaborate securely:
1. **Chrome Extension Debugger**: Monitors client-side user pages, intercepts GTM events (`dataLayer.push`), monitors tag network requests, and bridges events via a DOM channel.
2. **React Web Dashboard**: Provides a client-side interface for parsing GTM JSON export files and visualizes container execution flows. Implements the streaming chat assistant UI.
3. **Core Analysis Library (`@gtm-analyzer/core`)**: Zero-dependency library containing GTM schemas, auditing algorithms (naming, GA4 specifications, consent rules), and security sanitizers.
4. **MCP Server**: Operates as a stateless Node.js endpoint exposing tools via stdio (for local IDE integrations like Cursor) and Streamable HTTP (for the web dashboard).

```mermaid
graph TB
    subgraph "Browser Context"
        EXT["Chrome Extension Popup/Interceptors"]
        DASH["React Web Dashboard"]
        CHAT["AI Chat Widget Panel"]
    end

    subgraph "Server Environment"
        HTTP["MCP HTTP Endpoint (/mcp)"]
        GEMINI["Gemini 2.0 Flash LLM"]
    end

    subgraph "Local Developer Environment"
        CURSOR["Cursor / Claude Desktop"]
        STDIO["MCP Stdio Transport"]
    end

    subgraph "Shared Library"
        CORE["@gtm-analyzer/core Engine"]
    end

    EXT -->|"window.postMessage"| DASH
    DASH -->|"State Props"| CHAT
    CHAT -->|"HTTP POST /mcp"| HTTP
    HTTP -->|"Calls local functions"| CORE
    HTTP -->|"Function declarations / calls"| GEMINI
    CURSOR -->|"Stdio streams"| STDIO
    STDIO -->|"Calls local functions"| CORE
```

---

## 2. Component Directory Layout

```
gtm-container-analyzer/
├── extension/                  # Chrome Extension source
├── packages/
│   └── core/                   # Shared TypeScript analysis engine
│       ├── src/
│       │   ├── parser/         # GTM JSON container parser
│       │   ├── audit/          # Naming conventions, GA4 event rules, consent mode
│       │   └── security/       # Input sanitizer, credential redactor
│       └── dist/               # Compiled ES module library
│
├── mcp-server/                 # Express-based dual mcp server
│   ├── src/
│   │   ├── index-http.ts       # Streamable HTTP (MCP 2025-03-26 spec)
│   │   ├── index-stdio.ts      # Local Stdio Transport (Cursor, Claude)
│   │   ├── tools/              # Tools registration schema definitions
│   │   ├── ai/                 # Multi-model orchestrator and prompt templates
│   │   └── security/           # Path guards, origin checkers, and rate limiters
│   └── dist/                   # Compiled server distribution
```

---

## 3. Data Flow Sequences

### 3.1 Live Event Correlation Flow

When checking tag fire triggers against live browser session telemetry, data executes along this route:

```mermaid
sequenceDiagram
    participant WebPage as Browser Page Context
    participant Ext as Chrome Extension
    participant Dash as Web Dashboard
    participant Server as MCP Server (Render)
    participant LLM as Gemini Model

    WebPage->>WebPage: dataLayer.push({ event: 'purchase' })
    Ext->>Ext: Intercepts push event
    Ext->>Dash: postMessage("LIVE_DATA_UPDATE", events)
    Note over Dash: Dashboard buffers and caches events
    
    Dash->>Server: POST /api/chat { message, containerJson, liveEvents }
    Server->>Server: Run static audits via @gtm-analyzer/core
    Server->>Server: Correlate events using correlateGTMWithGA4()
    Server->>LLM: Pass audit results & user message
    LLM-->>Server: Return generated response tokens & tool requests
    Server-->>Dash: Stream tokens via Server-Sent Events (SSE)
    Dash-->>Dash: Update chat widget bubble in real-time
```

---

## 4. Security Architecture

### 4.1 DNS Rebinding & Cross-Site Requests
Per the **MCP 2025-03-26 Specification Warning #1**, the hosted server validates the HTTP `Origin` header of every incoming request. Only allowed domains (e.g. `gtmcontaineranalyzer.com` or local dev hosts) can establish Streamable HTTP connections, mitigating DNS rebinding vulnerabilities.

### 4.2 Credential Redaction & Prompt Safety
User containers often contain embedded third-party API keys (like Facebook Pixel IDs or AWS access keys). The `@gtm-analyzer/core` security sanitizer parses raw JSON configurations and automatically redacts strings matching sensitive credential signatures using regex patterns *before* passing payload context to external generative models.
