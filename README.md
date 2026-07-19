# GTM Container Analyzer 2.0

### *Clarity for your Google Tag Manager*

Analyze containers in one place, verify what tags fire live with a Chrome extension, and ask an AI agent (or MCP tools in Cursor/Claude) what’s wrong and how to fix it — with full GTM context.

**Live app:** [gtmcontaineranalyzer.com](https://gtmcontaineranalyzer.com/)  
**AI + MCP (hosted):** [gtm-container-analyzer-mcp.onrender.com](https://gtm-container-analyzer-mcp.onrender.com/)  
**Remote MCP:** `https://gtm-container-analyzer-mcp.onrender.com/mcp`

![GTM](https://img.shields.io/badge/GTM-Analyzer-38bdf8?style=for-the-badge)
![React](https://img.shields.io/badge/React-18-61dafb?style=flat-square)
![MCP](https://img.shields.io/badge/MCP-Ready-black?style=flat-square)
![Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?style=flat-square)

---

## What it is

One product, three surfaces:

| Surface | What it does |
|---------|----------------|
| **Web dashboard** | Upload/connect a GTM container — overview, search, cleanup, compare, CSV export |
| **Chrome extension** | Live `dataLayer` + marketing pixel capture (per tab). See what fires and when |
| **AI agent + MCP** | Ask why / what / how with real audits — in the app chat or from Cursor/Claude/Codex |

Flow: **analyze → verify live → ask & fix with AI + MCP**

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser                                  │
│  Chrome Extension          React Dashboard         AI Chat UI    │
│  (dataLayer + pixels)  →   (analyze /live)    →   (SSE stream)   │
└──────────────┬─────────────────────┬──────────────────┬─────────┘
               │ postMessage         │ IndexedDB        │ POST /api/chat
               │                     │ optional sync    │
               ▼                     ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                     MCP Server (Node / Express)                   │
│  HTTP: /mcp · /api/chat · /api/auth/sync · /health                │
│  Stdio: Cursor / Claude Desktop / Codex (local)                   │
│  AI: Gemini (default), OpenAI, Groq, OpenRouter, Ollama           │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│              @gtm-analyzer/core (shared TypeScript engine)        │
│  parse → audit (naming, GA4, performance, cleanup) → health score │
│  compare · search · correlate live events · CSV · sanitizer       │
└─────────────────────────────────────────────────────────────────┘
```

### Components

1. **`src/`** — React + Vite PWA dashboard (client-side GTM analysis UI)
2. **`extension/`** — Manifest V3 Chrome extension (live capture + dashboard bridge)
3. **`packages/core/`** — Pure TypeScript analysis library used by the MCP/AI layer
4. **`mcp-server/`** — Dual MCP transport (stdio + HTTP/SSE) + multi-provider AI agent

More detail: [`docs/architecture.md`](docs/architecture.md)

---

## Features

### Dashboard
- Overview stats & tag distribution
- Tags / triggers / variables views with filters
- Dependency tree, global search, CSV export
- Cleanup: duplicates, unused variables, orphan triggers
- Container compare (two exports or two GTM API versions)
- Connect GTM via Google OAuth (readonly)
- Dark / light theme, PWA install

### Chrome extension
- Intercepts `dataLayer.push` and marketing network requests
- Supports GA4, Google Ads, Meta, LinkedIn, TikTok, Clarity, Hotjar, and many more
- **Per-tab isolation** so live data doesn’t mix across tabs
- One-click open into dashboard `/live` for deeper analysis
- Capture stays local in `chrome.storage` (no remote upload of live telemetry)

### AI agent
- In-app chat with full container JSON context
- Tool-calling loop over the same audits as MCP
- Step-by-step GTM fix guidance (what / why / how)
- Offline rules fallback if the model provider fails

### MCP server
Tools available to IDEs and the agent:

| Tool | Purpose |
|------|---------|
| `analyze_container` | Health score + aggregated issues |
| `audit_naming` | Naming convention checks |
| `audit_ga4` | GA4 event name / param rules |
| `audit_performance` | Size, early-firing HTML, templates, CMP |
| `find_unused_items` | Unused variables |
| `find_duplicates` | Duplicate tags |
| `get_recommendations` | Prioritized fix list |
| `get_container_details` | Structured tags / triggers / variables |
| `compare_containers` | Diff two exports |
| `correlate_live_events` | Configured events vs live extension counts |
| `get_connection_status` | Synced container status + connect guide |

---

## How it works

### 1. Load a container (dashboard)

**Option A — Upload JSON**
1. GTM → Admin → Export Container
2. Upload the JSON on the home page

**Option B — Connect GTM (OAuth)**
1. Click **Connect GTM**
2. Sign in with Google
3. Pick Account → Container → live version

Data is validated/sanitized, processed, saved to **IndexedDB**, and (optionally) synced to the MCP server via `POST /api/auth/sync` so Cursor tools see the same container.

### 2. Analyze in the UI

Routes:

| Path | View |
|------|------|
| `/` | Upload / connect |
| `/analyze` | Dashboard overview + cleanup + tags table |
| `/tags` | Dependency tree |
| `/triggers` | Triggers list |
| `/variables` | Variables list |
| `/compare` | Diff two containers |
| `/live` | Live extension capture UI |

### 3. Verify live (extension)

```
Page (main world)          Content script           Service worker
gtm-interceptor.js    →    capture.js          →    chrome.storage
  patch dataLayer            classify events          per-tab / session keys
  patch fetch/XHR            domain / tab lock
        │
        ▼
dashboard-bridge.js  →  postMessage  →  /live page
```

### 4. Ask & fix (AI + MCP)

- **In app:** AI Chat → `POST /api/chat` (SSE) with `containerJson` + optional `liveEvents`
- **In Cursor / Claude:** connect MCP (remote URL or local stdio) → call audit tools
- Analysis logic runs in `@gtm-analyzer/core` — models don’t invent container facts without tools

---

## Project structure

```
gtm-container-analyzer/
├── src/                      # React dashboard (Vite)
│   ├── components/           # UI: Home, overview, tags, cleanup, Compare, Live, AIChat…
│   ├── hooks/                # useGTMData, useGTMAuth, useFilters, useTheme…
│   ├── data/                 # Client-side GTM processing & cleanup
│   ├── utils/                # Security, IndexedDB, CSV export
│   └── App.jsx
├── extension/                # Chrome extension (MV3)
│   ├── background/           # Service worker + storage
│   ├── content/              # capture.js, dashboard-bridge.js
│   ├── injected/             # gtm-interceptor.js
│   └── popup/
├── packages/core/            # @gtm-analyzer/core — shared analysis engine
│   └── src/
│       ├── parser/           # analyze() → ContainerContext
│       ├── audit/            # naming, GA4, performance, cleanup
│       ├── analysis/         # health score, live correlation
│       ├── compare/          # container diff
│       └── security/         # validate + redact credentials
├── mcp-server/               # MCP + AI HTTP server
│   └── src/
│       ├── index-stdio.ts    # IDE transport
│       ├── index-http.ts     # SSE MCP + /api/chat + static SPA
│       ├── tools/registry.ts
│       ├── ai/               # agent + prompts
│       └── security/         # CORS, rate limit, path guard
├── docs/                     # Architecture, MCP, extension, deployment guides
├── public/                   # PWA assets + sample container JSON
├── render.yaml               # Render blueprint (unified MCP + dashboard)
└── vercel.json               # Vercel dashboard deploy
```

---

## Quick start

### Dashboard (local)

```bash
npm install
npm run dev
```

Open http://localhost:5173

Copy `.env.example` → `.env` and set:

```bash
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id
VITE_AI_SERVER_URL=http://localhost:3001
```

### Core + MCP server (local)

```bash
# Build shared engine
cd packages/core && npm install && npm run build

# Build & run MCP HTTP (AI chat + remote MCP)
cd ../../mcp-server && npm install && npm run build
npm run start:http
```

MCP HTTP defaults to http://localhost:3001  
Stdio entry: `node mcp-server/dist/index-stdio.js`

Create `mcp-server/.env` (see `mcp-server/.env.example`). **`GEMINI_API_KEY` is required** at startup.

### Chrome extension

1. Chrome → `chrome://extensions/` → Developer mode
2. **Load unpacked** → select the `extension/` folder
3. Browse a site with GTM → open the popup → **Analyze** to open `/live`

Details: [`extension/README.md`](extension/README.md) · [`docs/extension.md`](docs/extension.md)

---

## Connect MCP (Cursor)

### Remote (hosted)

```json
{
  "mcpServers": {
    "gtm-container-analyzer": {
      "url": "https://gtm-container-analyzer-mcp.onrender.com/mcp"
    }
  }
}
```

### Local stdio

```json
{
  "mcpServers": {
    "gtm-container-analyzer-local": {
      "command": "node",
      "args": [
        "/ABSOLUTE/PATH/gtm-container-analyzer/mcp-server/dist/index-stdio.js",
        "/ABSOLUTE/PATH/gtm-container-analyzer"
      ]
    }
  }
}
```

Full client matrix (Claude, Codex, VS Code, etc.): [`docs/mcp-server-guide.md`](docs/mcp-server-guide.md)

---

## Tech stack

| Layer | Stack |
|-------|--------|
| Dashboard | React 18, Vite 5, React Router, Recharts, IndexedDB (localforage), PWA |
| Extension | Chrome Manifest V3, content scripts, service worker |
| Core | TypeScript, Zod |
| MCP / AI | Express, MCP SDK, Gemini / OpenAI / Groq / OpenRouter / Ollama |
| Auth | Google OAuth 2.0 + Tag Manager API (readonly) |
| Hosting | Vercel (dashboard), Render (MCP + AI + unified SPA) |

---

## Security & privacy

- Dashboard analysis is **client-side**; container JSON is stored in **IndexedDB**
- OAuth tokens stay in memory (not persisted)
- Extension capture stays in **browser storage** (no remote upload of live events)
- AI chat sends container context to your configured AI server (required for answers)
- MCP HTTP: origin allowlist, rate limits, path sandbox (stdio), credential redaction in logs
- Input validation & XSS-oriented sanitization on uploads

---

## Deployment

- **Dashboard (Vercel):** `npm run build` → deploy `dist/` (see `vercel.json`)
- **MCP + AI (Render):** use `render.yaml` or build core → mcp-server → `node mcp-server/dist/index-http.js`
- Free-tier tip: ping `/health` periodically so the service stays awake

See [`docs/deployment.md`](docs/deployment.md)

---

## Documentation

| Doc | Topic |
|-----|--------|
| [`docs/architecture.md`](docs/architecture.md) | System topology & flows |
| [`docs/mcp-server-guide.md`](docs/mcp-server-guide.md) | MCP client setup |
| [`docs/mcp-gtm-oauth-flow.md`](docs/mcp-gtm-oauth-flow.md) | OAuth → container sync |
| [`docs/ai-agent-design.md`](docs/ai-agent-design.md) | Agent / tool loop |
| [`docs/extension.md`](docs/extension.md) | Live capture bridge |
| [`docs/GTM-API-Setup.md`](docs/GTM-API-Setup.md) | Google API credentials |

---

## License

MIT

---

**Built for people who work with GTM** — analysts, marketers, freelancers, and teams who want clarity without endless tab-switching.
