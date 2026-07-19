# GTM Container Analyzer — MCP Integration Guide

This guide explains how to connect the GTM Container Analyzer Model Context Protocol (MCP) server to your local development environments (such as Cursor IDE or Claude Desktop) using:
1. **Local Stdio Mode (Command)**: High-performance local CLI-based execution.
2. **Local SSE Mode (HTTP)**: Testing your local Express HTTP server over Server-Sent Events.
3. **Hosted Live SSE Mode (Cloud)**: Connecting to your production-deployed cloud service.

---

## 1. Local Stdio Integration (Command Mode)

When running locally, the MCP server communicates with your IDE via standard input/output streams (stdio). This transport is highly optimized, zero-latency, and runs as a local subprocess.

### Step 1.1: Build the Code
1. Open a terminal in the root of the `gtm-container-analyzer` directory.
2. Build the shared packages and server:
   ```bash
   cd packages/core && npm run build
   cd ../../mcp-server && npm run build
   ```
3. Locate the absolute path of your compiled stdio file: `/Users/YOUR_USERNAME/YOUR_PATH/gtm-container-analyzer/mcp-server/dist/index-stdio.js`.

### Step 1.2: Connecting to Cursor (Local Stdio)
1. Open Cursor and go to **Settings** (Gear icon in top right) > **Features** > **MCP**.
2. Click **+ Add New MCP Server**.
3. Configure the following fields:
   * **Name**: `gtm-container-analyzer-local`
   * **Type**: `command`
   * **Command**: 
     ```bash
     node /Users/YOUR_USERNAME/YOUR_PATH/gtm-container-analyzer/mcp-server/dist/index-stdio.js "/Users/YOUR_USERNAME/YOUR_PATH/gtm-container-analyzer"
     ```
     *(Be sure to replace the paths with your actual project location).*
4. Click **Save**. The status indicator will turn **Green (Connected)**.

### Step 1.3: Connecting to Claude Desktop (Local Stdio)
1. Open your Claude Desktop configuration file:
   * Path: `~/Library/Application Support/Claude/claude_desktop_config.json`
2. Add the `gtm-analyzer-local` configuration:
   ```json
   {
     "mcpServers": {
       "gtm-analyzer-local": {
         "command": "node",
         "args": [
           "/Users/YOUR_USERNAME/YOUR_PATH/gtm-container-analyzer/mcp-server/dist/index-stdio.js",
           "/Users/YOUR_USERNAME/YOUR_PATH/gtm-container-analyzer"
         ]
       }
     }
   }
   ```
3. Restart the Claude Desktop application.

---

## 2. Local SSE Integration (HTTP Mode)

If you are running the Express server locally on your machine (e.g. for testing the HTTP/SSE server implementation before pushing changes to production), you can connect to it using the SSE transport.

### Step 2.1: Start the Local HTTP Server
1. In your terminal, navigate to the `mcp-server` directory.
2. Start the HTTP server:
   ```bash
   npm run start:http
   ```
   *The server will start listening on port `3001`.*

### Step 2.2: Connecting to Cursor (Local SSE)
1. Open Cursor and go to **Settings** > **Features** > **MCP**.
2. Click **+ Add New MCP Server**.
3. Configure the following fields:
   * **Name**: `gtm-analyzer-local-sse`
   * **Type**: `SSE`
   * **URL**: `http://localhost:3001/mcp` *(Alternative fallback: `http://localhost:3001/sse`)*
4. Click **Save**.

### Step 2.3: Connecting to Claude Desktop (Local SSE)
1. Open your Claude Desktop configuration file: `~/Library/Application Support/Claude/claude_desktop_config.json`
2. Add the local SSE configuration to `mcpServers`:
   ```json
   {
     "mcpServers": {
       "gtm-analyzer-local-sse": {
         "url": "http://localhost:3001/mcp"
       }
     }
   }
   ```
3. Restart the Claude Desktop application.

---

## 3. Remote Hosted Integration (SSE Mode)

When deployed to a cloud platform like Render, your GTM Container Analyzer MCP Server runs over HTTP via Server-Sent Events (SSE). Anyone can connect directly to your hosted API endpoints without running a local node script!

### Step 3.1: Exposed Cloud Endpoints
Once your unified deployment is active (e.g. at `https://gtm-container-analyzer-mcp.onrender.com`), you get the following public paths:
* **Showcase Dashboard**: `https://gtm-container-analyzer-mcp.onrender.com/`
* **Remote MCP SSE Endpoint**: `https://gtm-container-analyzer-mcp.onrender.com/mcp` *(Alternative fallback: `/sse`)*

### Step 3.2: Connecting to Cursor (Remote SSE)
1. Open Cursor and go to **Settings** > **Features** > **MCP**.
2. Click **+ Add New MCP Server**.
3. Configure the following fields:
   * **Name**: `gtm-container-analyzer-remote`
   * **Type**: `SSE`
   * **URL**: `https://gtm-container-analyzer-mcp.onrender.com/mcp`
4. Click **Save**. The status indicator will turn **Green (Connected)**.

### Step 3.3: Connecting to Claude Desktop (Remote SSE)
1. Open your Claude Desktop configuration file: `~/Library/Application Support/Claude/claude_desktop_config.json`
2. Add the remote configuration to `mcpServers`:
   ```json
   {
     "mcpServers": {
       "gtm-analyzer-remote": {
         "url": "https://gtm-container-analyzer-mcp.onrender.com/mcp"
       }
     }
   }
   ```
3. Restart the Claude Desktop application.

### Step 3.4: Connecting to VS Code (via Cline / Roo Code)
If you use popular AI coding extensions in VS Code like **Cline** or **Roo Code**, they support remote SSE connections directly via their local settings file.

1. Open your extension's MCP configuration settings JSON file:
   - **Cline**: `~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`
   - **Roo Code**: `~/Library/Application Support/Code/User/globalStorage/rooloodev.roo-cline/settings/cline_mcp_settings.json`
2. Add the server definition inside the `mcpServers` object:
   ```json
   {
     "mcpServers": {
       "gtm-analyzer-remote": {
         "url": "https://gtm-container-analyzer-mcp.onrender.com/mcp",
         "disabled": false
       }
     }
   }
   ```
3. Save the file. The extension will automatically connect to your live Render endpoint.

### Step 3.5: Connecting to Windsurf IDE (Remote SSE)
Windsurf supports MCP servers natively.

1. Open the configuration file:
   - **macOS / Linux**: `~/.codeium/windsurf/mcp_config.json`
   - **Windows**: `%USERPROFILE%\.codeium\windsurf\mcp_config.json`
   *(Tip: You can also open this via Windsurf settings under **Settings** > **Cascade** > **MCP Servers** > **View Raw Config**)*.
2. Add the following config to `mcpServers`:
   ```json
   {
     "mcpServers": {
       "gtm-analyzer-remote": {
         "serverUrl": "https://gtm-container-analyzer-mcp.onrender.com/mcp",
         "transport": "sse"
       }
     }
   }
   ```
3. Completely **restart Windsurf** for the configuration to take effect.

### Step 3.6: Connecting to Zed Editor (Remote SSE)
Because Zed expects stdio frames, it does not support raw SSE URLs natively in `settings.json`. Instead, use the global NPM `mcp-remote` proxy bridge.

1. Open your terminal and install `mcp-remote` globally:
   ```bash
   npm install -g mcp-remote
   ```
2. Open Zed settings (`zed: open settings` via the Command Palette / `Cmd+Shift+P`).
3. Add the server under `context_servers` using the proxy bridge command:
   ```json
   {
     "context_servers": {
       "gtm-analyzer-remote": {
         "command": "npx",
         "args": [
           "-y",
           "mcp-remote",
           "https://gtm-container-analyzer-mcp.onrender.com/mcp"
         ]
       }
     }
   }
   ```
4. Save the file. Verify connection status in Zed under **Settings** > **AI** > **MCP Servers**.

---

## 4. Example Prompts to Try in your IDE
Once connected, you can ask Cursor or Claude:
* *"Analyze my GTM container at ./sample-container.json"*
* *"Check the naming conventions in my active GTM container"*
* *"Validate my GA4 events and parameters against Google rules inside public/sample-gtm-container.json"*
