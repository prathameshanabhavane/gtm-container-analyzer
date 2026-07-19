# GTM Container Analyzer

### *Clarity for your Google Tag Manager*

A powerful React-based dashboard for visualizing, analyzing, and understanding your Google Tag Manager (GTM) container exports. GTM Container Analyzer dynamically processes GTM JSON data and reveals hidden insights about your tags, triggers, and variables.

![GTM Container Analyzer](https://img.shields.io/badge/GTM-Analyzer-38bdf8?style=for-the-badge)
![React](https://img.shields.io/badge/React-18-61dafb?style=flat-square)
![Vite](https://img.shields.io/badge/Vite-5-646cff?style=flat-square)
![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8?style=flat-square)

---

## 🚀 Quick Start

```bash
# Navigate to dashboard directory
cd dashboard

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

Open http://localhost:5173 in your browser.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 📊 **Dashboard** | Overview stats, pie chart, tag distribution |
| 🏷️ **Tags View** | Dependency tree, all tags with filters |
| ⚡ **Triggers Page** | All triggers with conditions & usage |
| 📦 **Variables Page** | All variables with usage tracking |
| 🧹 **Cleanup Panel** | Detect duplicates, unused vars, orphan triggers |
| 🔍 **Global Search** | Deep search across tags, triggers, variables |
| 🔗 **Connect GTM** | OAuth integration to fetch directly from GTM |
| 🌓 **Dark/Light Theme** | Toggle between themes |
| 📱 **PWA Support** | Install as desktop/mobile app |
| 📥 **CSV Export** | Export filtered or all tags |

---

## 📤 How It Works

**Two ways to load data:**

### Option 1: Upload JSON File
```
1. Open GTM → tagmanager.google.com
2. Admin → Export Container
3. Download JSON file
4. Upload to GTM Container Analyzer
```

### Option 2: Connect GTM (OAuth)
```
1. Click "Connect GTM" button
2. Sign in with Google
3. Select Account → Container → Version
4. Data loads automatically
```

### Data Flow
```
┌─────────────────────────────────────────────────────────────┐
│   Upload JSON  OR  Connect GTM (OAuth)                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Security Validation (XSS Protection)            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Process GTM Data                          │
│              (Tags, Triggers, Variables)                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│            Save to IndexedDB (Local Persistence)             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Render Dashboard                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 🏗️ Architecture

### Design Pattern: Feature-Based Modular

```
┌─────────────────────────────────────────────────────────────┐
│                        App.jsx                               │
│                    (Router + Layout)                         │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
   ┌─────────┐  ┌─────────┐  ┌─────────┐
   │  Hooks  │  │  Data   │  │Components│
   │ (State) │  │ (Logic) │  │  (UI)   │
   └────┬────┘  └────┬────┘  └────┬────┘
        │            │            │
        └────────────┼────────────┘
                     ▼
              ┌───────────┐
              │  Utils    │
              │(Helpers)  │
              └───────────┘
```

---

## 📁 Project Structure

```
dashboard/
├── public/
│   ├── favicon.svg
│   ├── robots.txt
│   └── sitemap.xml
│
├── src/
│   ├── components/                    # UI Components (Feature folders)
│   │   ├── Header/
│   │   │   ├── Header.jsx
│   │   │   └── index.js
│   │   ├── HomePage/
│   │   │   ├── HomePage.jsx
│   │   │   ├── HomePage.css
│   │   │   └── index.js
│   │   ├── ConnectGTM/                # GTM OAuth connection
│   │   ├── DependencyTree/            # Tag dependency visualization
│   │   ├── TriggersList/              # Triggers page
│   │   ├── VariablesList/             # Variables page
│   │   ├── cleanup/                   # Cleanup panel components
│   │   │   ├── CleanupPanel.jsx
│   │   │   ├── DuplicatesSection.jsx
│   │   │   ├── UnusedVariablesSection.jsx
│   │   │   ├── OrphanTriggersSection.jsx
│   │   │   └── index.js
│   │   ├── filters/                   # Filter components
│   │   │   ├── FiltersSection.jsx
│   │   │   ├── MultiSelectFilter.jsx
│   │   │   ├── SearchableSelect.jsx
│   │   │   ├── ExportDropdown.jsx
│   │   │   └── index.js
│   │   ├── tags/                      # Tag components
│   │   │   ├── TagsTable.jsx
│   │   │   ├── TagDetailPanel.jsx
│   │   │   └── index.js
│   │   ├── overview/                  # Dashboard overview
│   │   │   ├── OverviewSection.jsx
│   │   │   ├── CustomTooltip.jsx
│   │   │   └── index.js
│   │   ├── common/                    # Reusable components
│   │   │   ├── StatCard.jsx
│   │   │   ├── CopyableName.jsx
│   │   │   ├── CopyableCodeBlock.jsx
│   │   │   └── index.js
│   │   ├── ThemeToggle/
│   │   ├── PrivacyPolicy/
│   │   ├── TermsOfService/
│   │   ├── Footer/
│   │   └── Donation/
│   │
│   ├── hooks/                         # Custom React Hooks
│   │   ├── useGTMData.js              # GTM data management
│   │   ├── useGTMAuth.js              # Google OAuth
│   │   ├── useFilters.js              # Filter state management
│   │   ├── usePagination.js           # Pagination logic
│   │   ├── useTheme.js                # Theme toggle
│   │   └── index.js                   # Barrel export
│   │
│   ├── data/                          # Business Logic (Pure Functions)
│   │   ├── gtmData.js                 # Core data orchestrator
│   │   ├── constants.js               # Tag/Trigger/Variable type maps
│   │   ├── cleanup/                   # Detection modules
│   │   │   ├── duplicates.js          # Duplicate tag detection
│   │   │   ├── unusedVariables.js     # Unused variable detection
│   │   │   ├── orphanTriggers.js      # Orphan trigger detection
│   │   │   └── index.js
│   │   ├── helpers/                   # Utility functions
│   │   │   ├── filterHelpers.js       # Unique value extraction
│   │   │   ├── search.js              # Global search
│   │   │   ├── variableResolver.js    # Variable resolution
│   │   │   └── index.js
│   │   └── index.js
│   │
│   ├── utils/                         # Generic Utilities
│   │   ├── security.js                # XSS protection, validation
│   │   ├── csvExport.js               # CSV export logic
│   │   ├── indexedDB.js               # Local storage
│   │   ├── tagHelpers.js              # Tag utilities
│   │   └── index.js
│   │
│   ├── constants/                     # App-wide constants
│   │   ├── chartColors.js
│   │   ├── securityPatterns.js
│   │   └── index.js
│   │
│   ├── App.jsx                        # Main app (routing)
│   ├── main.jsx                       # Entry point
│   └── index.css                      # Global styles + Theme
│
├── index.html                         # HTML template + CSP
├── vite.config.js                     # Vite + PWA config
├── vercel.json                        # Vercel deployment config
└── package.json
```

---

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| **React 18** | UI Framework (Functional Components + Hooks) |
| **Vite 5** | Build Tool & Dev Server |
| **React Router v6** | Client-side Routing |
| **Recharts** | Data Visualization (Pie Chart) |
| **Lucide React** | Icon Library |
| **IndexedDB** | Client-side Data Persistence |
| **Google OAuth 2.0** | GTM API Authentication |
| **vite-plugin-pwa** | Progressive Web App Support |
| **CSS Variables** | Theming (Dark/Light) |
| **Vercel** | Hosting & Deployment |

---

## 🔒 Security

| Layer | Implementation |
|-------|----------------|
| **Content Security Policy** | Strict CSP headers in `index.html` |
| **Input Validation** | `validateGTMJson()` in `security.js` |
| **XSS Protection** | `deepSanitize()` for all inputs |
| **File Validation** | Type, size, and name checks |
| **OAuth Tokens** | Memory-only (never stored) |
| **No Server Storage** | 100% client-side processing |

---

## 📊 Pages & Views

### 1. Home Page (Upload)
- Drag & drop JSON upload
- Connect GTM button (OAuth)
- Privacy proof modal
- Export help guide

### 2. Dashboard (/analyze)
- Overview stats (Tags, Triggers, Variables)
- Tag distribution pie chart
- Cleanup panel (Duplicates, Unused, Orphans)
- Filters & Global search
- Tags table with pagination
- Tag detail side panel

### 3. Tags View (/tags)
- Full dependency tree
- All filters available
- CSV export

### 4. Triggers View (/triggers)
- All triggers with details
- Filter by type & usage
- Shows which tags use each trigger

### 5. Variables View (/variables)
- All variables with details
- Filter by type & usage
- Shows where each variable is used

---

## 🧹 Cleanup Detection

### Duplicate Tags
- Detects tags with identical configuration
- Compares: type, triggers, conditions, parameters
- 100% exact match required

### Unused Variables
- Finds variables not referenced anywhere
- Checks: tags, triggers, other variables
- Shows variable content & type

### Orphan Triggers
- Finds triggers not used by any tag
- Shows trigger conditions
- Identifies cleanup opportunities

---

## 🎨 Theming

### Dark Theme (Default)
| Element | Color |
|---------|-------|
| Background | `#0f1117` |
| Cards | `#181b23` |
| Primary Accent | `#38bdf8` (Cyan) |
| Secondary | `#a78bfa` (Purple) |

### Light Theme
| Element | Color |
|---------|-------|
| Background | `#fafbfc` |
| Cards | `#ffffff` |
| Primary Accent | `#0ea5e9` |
| Secondary | `#8b5cf6` |

Toggle via sun/moon button in header.

---

## 📝 Key Modules

### Hooks

```javascript
// GTM data management
useGTMData()
  → processedTags, stats, duplicateTags, unusedVariables, orphanTriggers

// Google OAuth
useGTMAuth()
  → login, logout, accounts, fetchContainers, fetchContainerVersion

// Filter state
useFilters(processedTags)
  → searchQuery, typeFilter, filteredTags, resetAllFilters

// Theme toggle
useTheme()
  → theme, toggleTheme
```

### Data Functions

```javascript
// Core processing
processGTMData(data)              // Parse & transform GTM JSON
getStats()                        // Get tag/trigger/variable counts
getContainerInfo()                // Get container metadata

// Cleanup detection
detectDuplicateTags()             // Find duplicate tags
detectUnusedVariables()           // Find unused variables
detectOrphanTriggers()            // Find orphan triggers

// Search & filters
globalSearch(query)               // Deep search all data
getUniqueTagTypes()               // Get tag types for filter
getAllConditionTypes()            // Get condition types

// Variable resolution
resolveVariableWithContext()      // Resolve with trigger context
resolveVariable()                 // Simple resolution
```

---

## 📱 Responsive Design

| Breakpoint | Devices |
|------------|---------|
| 1400px+ | Large Desktop |
| 1024-1399px | Desktop |
| 768-1023px | Tablet |
| 600-767px | Large Phone |
| 480-599px | Phone |
| <480px | Small Phone |

PWA installable on desktop and mobile.

---

## 📥 CSV Export

| Option | Description |
|--------|-------------|
| **Export All** | All tags regardless of filters |
| **Export Filtered** | Only currently filtered tags |

**Columns:** Tag Name, Type, Status, Trigger, Conditions, Info, Parameters

---

## 🔒 Privacy

- **100% Client-side** - No data sent to any server
- **Local Storage** - Data stored in browser's IndexedDB
- **No Analytics** - No tracking or telemetry
- **OAuth Tokens** - Stored in memory only, never persisted
- **Open Source** - Audit the code yourself

---

## 🚀 Deployment

### Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### Manual Build
```bash
npm run build
# Output in dist/ folder
```

---

## 📄 License

MIT License

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing`)
5. Open a Pull Request

---

## 📊 Code Quality

| Metric | Value |
|--------|-------|
| Components | 18 feature folders |
| Hooks | 5 custom hooks |
| Data Modules | 8 files |
| Avg File Size | 200-400 lines |
| Architecture | Feature-Based Modular |
| Maintainability | ⭐⭐⭐⭐⭐ |

---

**Made with 💙 for GTM community**
# gmt-container-analyzer
