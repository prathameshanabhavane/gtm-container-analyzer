# GTM Analyzer MCP — Quick Test Prompts Guide

Use this guide to quickly test the Model Context Protocol (MCP) server tools directly inside your AI Assistant chat panel (Cursor, Claude Desktop, etc.).

---

## ⚡ Prompts Cheat Sheet

Simply copy and paste any of these prompts into your Cursor chat:

### 1. Recommendations & General Audit
Audits naming, GA4 specifications, performance, and cleanup metrics.
*   **Prompt:** `Audit my active GTM container and give me recommendations`
*   **Alternative:** `What are the setup recommendations for my container?`

### 2. Clean-Up & Unused Variables
Scans for variables that are not used by any tags, triggers, or custom HTML blocks.
*   **Prompt:** `Find unused variables in my GTM container`
*   **Alternative:** `Help me identify unused items in GTM`

### 3. Performance & Duplicate Tags
Scans Custom HTML scripts and tags to detect duplication or bloating issues affecting page performance.
*   **Prompt:** `Check my container for duplicate tags or script bloat`
*   **Alternative:** `Find duplicate scripts in my active container`

### 4. Naming Convention Audit
Validates tags, triggers, and variables against standard naming conventions.
*   **Prompt:** `Check the naming conventions in my active GTM container`

### 5. GA4 Specification & Event Limits
Checks event names and parameters for GA4 limits and custom event conflicts.
*   **Prompt:** `Audit my GA4 tag configurations and limits`

### 6. Changing or Switching GTM Containers
Asks for guidance on how to switch active container context or link a new one.
*   **Prompt:** `How do I change GTM containers?`
*   **Alternative:** `I want to connect a new GTM container`

---

## 📂 Testing Custom Files Directly (Stdio Mode)

In **Stdio mode**, you can audit any GTM export JSON file located anywhere in your workspace by passing the file path.

*   **Prompt:** `Audit naming conventions for public/sample-gtm-container.json`
*   **Prompt:** `Find duplicate tags in public/sample-gtm-container.json`

---

## 🔗 Sync & Management Quick Links
*   **Open Sync Dashboard:** [http://localhost:5173](http://localhost:5173) (to log in, change account, or select another GTM container).
*   **Server Config Port:** `3001`
