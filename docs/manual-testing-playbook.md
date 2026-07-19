# GTM Insight AI — Manual Verification Playbook

This document contains a complete list of commands and procedures to manually launch, verify, and test every component of the GTM Insight AI ecosystem.

---

## 1. Environment Preparation

Before running any test commands, create a local configuration file for the MCP server:

```bash
# Create local .env from example template
cp mcp-server/.env.example mcp-server/.env
```

Open `mcp-server/.env` and insert your API keys:
```env
GEMINI_API_KEY=your_actual_gemini_api_key_here
GROQ_API_KEY=your_groq_api_key_here # Optional - Free cloud key
OLLAMA_HOST=http://localhost:11434 # Optional - Free local model host
OLLAMA_MODEL=qwen2.5-coder:7b # Optional - Free local model name
PORT=3001
ALLOWED_ORIGINS=https://gtmcontaineranalyzer.com,http://localhost:5173
```

---

## 2. Compilation Commands

Compile all packages to ensure they are up-to-date and typecheck successfully:

```bash
# 1. Build the shared analyzer core
cd packages/core && npm run build

# 2. Build the mcp server logic
cd ../../mcp-server && npm run build

# 3. Build the React web dashboard
cd ../ && npm run build
```

---

## 3. Testing the MCP Server (Streamable HTTP & SSE)

### 3.1 Start the Server Locally
Run the server on port 3001 using the environment configurations:

```bash
cd mcp-server
npm run start:http
```

### 3.2 Verify Health Endpoint (CURL)
Verify the server is running and listening:

```bash
curl -i http://localhost:3001/health
```
**Expected Response:**
```json
HTTP/1.1 200 OK
Content-Type: application/json
...
{"status":"healthy","version":"1.0.0","mcpSessionActive":false}
```

### 3.3 Verify CORS Protection (Origin Block)
Test if the CORS Origin checks block disallowed cross-origin requests (DNS Rebinding protection):

```bash
# Request from an unauthorized origin (e.g. malicioustop.com)
curl -i -H "Origin: https://malicioustop.com" http://localhost:3001/health
```
**Expected Response:**
```json
HTTP/1.1 403 Forbidden
...
{"error":"Forbidden: Origin is not allowed.","code":"UNAUTHORIZED_ORIGIN"}
```

---

## 4. Testing the AI Streaming Chat Endpoint

You can manually trigger a chat generation session that requests tool calls using `curl`. 

Ensure the server is running, and feed it a sample user message asking for an naming convention audit on a mock container.

```bash
curl -i -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "gemini",
    "message": "Analyze this container naming convention and show any issues",
    "containerJson": {
      "containerVersion": {
        "container": {
          "name": "Manual Test Container",
          "publicId": "GTM-TEST123"
        },
        "tag": [
          { "name": "Purchase_pixel", "type": "fbpx" },
          { "name": "GA4 - pageview", "type": "gaawe" }
        ],
        "trigger": [],
        "variable": []
      }
    }
  }'
```
**Expected Response:**
An HTTP chunked stream (`text/event-stream`) returns tool executions and generated text:
```text
HTTP/1.1 200 OK
Content-Type: text/event-stream
Transfer-Encoding: chunked

data: {"type":"tool_call","content":"🔧 AI calling tool: `audit_naming`..."}
data: {"type":"tool_result","content":"✅ Tool `audit_naming` executed successfully."}
data: {"type":"text","content":"I ran the naming conventions check on your container..."}
...
data: {"type":"done","content":""}
```

---

## 5. Testing the Local Stdio Server (Cursor/Claude Desktop)

Launch the stdio server process directly in your terminal to verify that it starts, accepts JSON RPC handshakes, and logs setup metrics.

```bash
# Start Stdio server with GTM-Insight folder as base directory
cd mcp-server
node dist/index-stdio.js ../
```
**Expected Output on stderr:**
```text
GTM MCP Server running over Stdio (Base allowed directory: ../)
```

---

## 6. Testing the React Dashboard UI

Launch the React PWA dashboard locally:

```bash
# From GTM-Insight root directory
npm run dev
```

### Manual Dashboard Test Sequence:
1. Open http://localhost:5173 in Google Chrome.
2. Select a GTM container JSON file and upload it.
3. Once the dashboard graphs render, click the floating **Purple Sparkles** icon in the bottom-right corner. The chat assistant slides open.
4. If the server is offline or building, a status indicator shows *"Waking up server..."*.
5. Ask the AI: *"What is my health score?"*.
6. Watch the AI call `analyze_container` and explain the breakdown in the conversation bubbles.
7. Click the loaded **"Load Sandbox Debug Session"** button to emulate debugger log collection, and ask: *"Are my live events matching GTM?"*.
8. Verify that entity names inside the AI responses appear as clickable tags. Click a tag and confirm it navigates you and focuses/filters the dashboard tag view.
