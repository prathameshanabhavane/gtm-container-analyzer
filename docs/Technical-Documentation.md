# GTM Container Analyzer - Technical Documentation

Complete technical breakdown of all features, implementation logic, and architecture.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [File Upload & Parsing](#2-file-upload--parsing)
3. [Data Processing Engine](#3-data-processing-engine)
4. [Dashboard Overview](#4-dashboard-overview)
5. [Tags Page](#5-tags-page)
6. [Triggers Page](#6-triggers-page)
7. [Variables Page](#7-variables-page)
8. [Filtering System](#8-filtering-system)
9. [Search Functionality](#9-search-functionality)
10. [CSV Export](#10-csv-export)
11. [Duplicate Detection](#11-duplicate-detection)
12. [Unused Detection](#12-unused-detection)
13. [Security Implementation](#13-security-implementation)
14. [PWA Features](#14-pwa-features)
15. [Theming System](#15-theming-system)
16. [Routing](#16-routing)
17. [Data Persistence](#17-data-persistence)

---

## 1. Architecture Overview

### Tech Stack
- **Frontend:** React 18 + Vite
- **Styling:** CSS with CSS Variables (no framework)
- **Storage:** IndexedDB via localforage
- **PWA:** vite-plugin-pwa (Workbox)
- **Routing:** React Router v6
- **Deployment:** Vercel

### Data Flow
```
[GTM JSON File] → [File Upload] → [Validation] → [IndexedDB Storage]
                                                        ↓
[UI Components] ← [useMemo Processing] ← [gtmData.js Functions]
```

### Key Principle
**100% Client-Side Processing** - No data ever leaves the browser. All parsing, analysis, and storage happens locally.

---

## 2. File Upload & Parsing

### Location
`App.jsx` → `FileUpload` component

### Flow
```
1. User drags/drops or selects JSON file
2. FileReader reads file as text
3. JSON.parse() converts to object
4. validateGTMJson() validates structure
5. Data stored in IndexedDB
6. Navigate to /analyze
```

### Implementation Logic

```jsx
// File reading
const reader = new FileReader();
reader.onload = (e) => {
  const jsonData = JSON.parse(e.target.result);
  // Validation happens here
  onFileUpload(jsonData);
};
reader.readAsText(file);
```

### Validation Checks
| Check | Purpose |
|-------|---------|
| File extension | Must be .json |
| File size | Max 50MB |
| JSON structure | Must have containerVersion |
| Prototype pollution | Block __proto__, constructor |
| Depth limit | Max 50 levels nested |

---

## 3. Data Processing Engine

### Location
`src/data/gtmData.js`

### Core Functions

#### `processGTMData(jsonData)`
Entry point - extracts container metadata.

```js
// Returns:
{
  containerName: "My Container",
  containerId: "GTM-XXXXX",
  exportTime: "2024-01-15",
  tags: [...],
  triggers: [...],
  variables: [...]
}
```

#### `extractTagDetails(tag, allTriggers, allVariables)`
Extracts comprehensive tag information.

```js
// Logic:
1. Get basic info (name, type, id)
2. Find firing triggers by ID matching
3. Extract parameters from tag.parameter array
4. Find variables used (regex: {{variableName}})
5. Determine status (paused/active)
6. Extract conditions from triggers
```

#### `extractTriggerDetails(trigger)`
Processes trigger configuration.

```js
// Logic:
1. Get trigger type and map to readable label
2. Extract filter conditions
3. For each condition:
   - Get variable name (arg0)
   - Get condition type (EQUALS, CONTAINS, etc.)
   - Get comparison value (arg1)
   - Check for negate flag
4. Extract type-specific params (timer, scroll, etc.)
```

#### `extractConditions(filters)`
Parses trigger filter conditions.

```js
// Input: trigger.filter array
// Output:
[
  {
    variable: "Page URL",
    type: "contains",
    value: "/checkout",
    ignoreCase: true,
    negate: false
  }
]

// Logic:
for each filter:
  1. Find arg0 param → variable name
  2. Find arg1 param → comparison value
  3. Map filter.type to readable format
  4. Check for negate in parameter array
```

#### Condition Type Mapping
```js
const conditionTypeMap = {
  'EQUALS': 'equals',
  'CONTAINS': 'contains',
  'STARTS_WITH': 'starts with',
  'ENDS_WITH': 'ends with',
  'MATCH_REGEX': 'matches regex',
  'LESS_THAN': 'less than',
  'GREATER_THAN': 'greater than',
  'CSS_SELECTOR': 'CSS selector'
};
```

---

## 4. Dashboard Overview

### Location
`App.jsx` → Dashboard view

### Components
- **Header:** Container info, upload/clear buttons
- **Stats Cards:** Clickable navigation to filtered views
- **Filter Bar:** Multi-select filters, search, export
- **Tags Table:** Sortable, filterable data grid

### Stats Calculation

```js
// Total tags
const totalTags = processedTags.length;

// Active/Paused
const activeTags = processedTags.filter(t => t.status === 'active').length;
const pausedTags = processedTags.filter(t => t.status === 'paused').length;

// Triggers count
const totalTriggers = containerData.containerVersion.trigger?.length || 0;

// Variables count
const totalVariables = containerData.containerVersion.variable?.length || 0;
```

### Click Navigation Logic
```jsx
// Stat card click handlers
onClick={() => navigate('/tags')}                    // Total tags
onClick={() => navigate('/tags?status=active')}     // Active only
onClick={() => navigate('/tags?status=paused')}     // Paused only
onClick={() => navigate('/triggers')}                // Triggers
onClick={() => navigate('/variables')}               // Variables
```

---

## 5. Tags Page

### Location
`src/components/DependencyTree.jsx`

### Purpose
Visual representation of each tag with its:
- Firing triggers
- Conditions
- Variables used
- Configuration parameters

### Structure
```
Tag Card
├── Header (name, type, status, copy button)
└── Expanded Content
    ├── Triggers Branch
    │   └── Conditions (variable, type, value)
    ├── Variables Branch
    │   └── Variable chips
    └── Parameters Branch
        └── Key-value pairs
```

### Expand/Collapse Logic
```jsx
const [expandedTags, setExpandedTags] = useState(new Set());

const toggleTag = (tagId) => {
  setExpandedTags(prev => {
    const newSet = new Set(prev);
    if (newSet.has(tagId)) {
      newSet.delete(tagId);
    } else {
      newSet.add(tagId);
    }
    return newSet;
  });
};

// Global expand all
const expandAll = () => {
  setExpandedTags(new Set(tags.map(t => t.tagId)));
};
```

### Copy Functionality
```jsx
const CopyableName = ({ name, format }) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    const textToCopy = format ? `{{${name}}}` : name;
    await navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  
  return (
    <span className="copyable" onClick={handleCopy}>
      {name}
      {copied && <span className="copied-indicator">Copied!</span>}
    </span>
  );
};
```

---

## 6. Triggers Page

### Location
`src/components/TriggersList.jsx`

### Data Source
```js
// In gtmData.js
const getAllTriggersWithDetails = (containerData) => {
  const triggers = containerData.containerVersion.trigger || [];
  const tags = containerData.containerVersion.tag || [];
  
  return triggers.map(trigger => {
    // Find tags using this trigger
    const usedByTags = tags.filter(tag => 
      tag.firingTriggerId?.includes(trigger.triggerId) ||
      tag.blockingTriggerId?.includes(trigger.triggerId)
    );
    
    return {
      ...extractTriggerDetails(trigger),
      usedByTags: usedByTags.map(t => t.name),
      isUnused: usedByTags.length === 0
    };
  });
};
```

### Trigger Type Detection
```js
const triggerTypeLabels = {
  'PAGEVIEW': 'Page View',
  'DOM_READY': 'DOM Ready',
  'WINDOW_LOADED': 'Window Loaded',
  'CLICK': 'All Clicks',
  'LINK_CLICK': 'Link Click',
  'FORM_SUBMIT': 'Form Submit',
  'CUSTOM_EVENT': 'Custom Event',
  'TIMER': 'Timer',
  'SCROLL': 'Scroll Depth',
  'ELEMENT_VISIBILITY': 'Element Visibility',
  'YOUTUBE_VIDEO': 'YouTube Video',
  'HISTORY_CHANGE': 'History Change'
};
```

### Custom Event Name Extraction
```js
// Custom events store event name in customEventFilter
if (trigger.type === 'CUSTOM_EVENT' && trigger.customEventFilter) {
  const eventFilter = trigger.customEventFilter[0];
  const eventNameParam = eventFilter?.parameter?.find(p => p.key === 'arg1');
  customEventName = eventNameParam?.value;
}
```

---

## 7. Variables Page

### Location
`src/components/VariablesList.jsx`

### Data Source
```js
// In gtmData.js
const getAllVariablesWithDetails = (containerData) => {
  const variables = containerData.containerVersion.variable || [];
  const tags = containerData.containerVersion.tag || [];
  const triggers = containerData.containerVersion.trigger || [];
  
  return variables.map(variable => {
    // Check usage in tags and triggers
    const variablePattern = `{{${variable.name}}}`;
    
    const usedInTags = tags.filter(tag => 
      JSON.stringify(tag).includes(variablePattern)
    ).map(t => t.name);
    
    const usedInTriggers = triggers.filter(trigger =>
      JSON.stringify(trigger).includes(variablePattern)
    ).map(t => t.name);
    
    return {
      ...variable,
      content: extractVariableContent(variable),
      usedIn: [...usedInTags, ...usedInTriggers],
      isUnused: usedInTags.length === 0 && usedInTriggers.length === 0
    };
  });
};
```

### Variable Content Extraction
```js
const extractVariableContent = (variable) => {
  const params = variable.parameter || [];
  
  // Different variables store value differently
  const valueParam = params.find(p => 
    p.key === 'value' || 
    p.key === 'defaultValue' ||
    p.key === 'name'  // for dataLayer variables
  );
  
  return valueParam?.value || null;
};
```

---

## 8. Filtering System

### Location
`App.jsx` → Filter states and handlers

### Filter State Structure
```jsx
// Tag filters
const [tagTypeFilter, setTagTypeFilter] = useState([]);
const [triggerTypeFilter, setTriggerTypeFilter] = useState([]);
const [conditionTypeFilter, setConditionTypeFilter] = useState([]);
const [statusFilter, setStatusFilter] = useState('all');

// Condition detail filters
const [urlFilter, setUrlFilter] = useState([]);
const [pathFilter, setPathFilter] = useState([]);
const [queryParamFilter, setQueryParamFilter] = useState([]);
```

### Filter Logic (useMemo)
```jsx
const filteredTags = useMemo(() => {
  return processedTags.filter(tag => {
    // Tag type filter
    if (tagTypeFilter.length > 0) {
      if (!tagTypeFilter.includes(tag.type)) return false;
    }
    
    // Trigger type filter
    if (triggerTypeFilter.length > 0) {
      const tagTriggerTypes = tag.triggers?.map(t => t.type) || [];
      if (!triggerTypeFilter.some(t => tagTriggerTypes.includes(t))) return false;
    }
    
    // Condition type filter
    if (conditionTypeFilter.length > 0) {
      const tagConditionTypes = tag.triggers?.flatMap(t => 
        t.conditions?.map(c => c.type) || []
      ) || [];
      if (!conditionTypeFilter.some(c => tagConditionTypes.includes(c))) return false;
    }
    
    // URL filter
    if (urlFilter.length > 0) {
      const tagUrls = extractUrlsFromConditions(tag);
      if (!urlFilter.some(u => tagUrls.includes(u))) return false;
    }
    
    // Status filter
    if (statusFilter !== 'all') {
      if (tag.status !== statusFilter) return false;
    }
    
    return true;
  });
}, [processedTags, tagTypeFilter, triggerTypeFilter, conditionTypeFilter, 
    urlFilter, pathFilter, queryParamFilter, statusFilter]);
```

### Multi-Select Filter Component
```jsx
const MultiSelectFilter = ({ options, selected, onChange, label }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const toggleOption = (option) => {
    if (selected.includes(option)) {
      onChange(selected.filter(o => o !== option));
    } else {
      onChange([...selected, option]);
    }
  };
  
  return (
    <div className="multi-select">
      <button onClick={() => setIsOpen(!isOpen)}>
        {label} {selected.length > 0 && `(${selected.length})`}
      </button>
      {isOpen && (
        <div className="dropdown">
          {options.map(option => (
            <label key={option}>
              <input
                type="checkbox"
                checked={selected.includes(option)}
                onChange={() => toggleOption(option)}
              />
              {option}
            </label>
          ))}
        </div>
      )}
    </div>
  );
};
```

---

## 9. Search Functionality

### Implementation
```jsx
const [searchTerm, setSearchTerm] = useState('');

const searchedTags = useMemo(() => {
  if (!searchTerm.trim()) return filteredTags;
  
  const term = searchTerm.toLowerCase();
  
  return filteredTags.filter(tag => {
    // Search in tag name
    if (tag.name.toLowerCase().includes(term)) return true;
    
    // Search in tag type
    if (tag.type.toLowerCase().includes(term)) return true;
    
    // Search in trigger names
    if (tag.triggers?.some(t => t.name.toLowerCase().includes(term))) return true;
    
    // Search in variable names
    if (tag.variables?.some(v => v.toLowerCase().includes(term))) return true;
    
    // Search in condition values
    if (tag.triggers?.some(t => 
      t.conditions?.some(c => c.value.toLowerCase().includes(term))
    )) return true;
    
    return false;
  });
}, [filteredTags, searchTerm]);
```

### Debounced Search (Performance)
```jsx
const [debouncedSearch, setDebouncedSearch] = useState('');

useEffect(() => {
  const timer = setTimeout(() => {
    setDebouncedSearch(searchTerm);
  }, 300);
  
  return () => clearTimeout(timer);
}, [searchTerm]);
```

---

## 10. CSV Export

### Location
`src/components/ExportDropdown.jsx`

### Export Logic
```jsx
const exportToCSV = (data, filename) => {
  // Define columns
  const columns = [
    'Tag Name',
    'Tag Type', 
    'Status',
    'Triggers',
    'Conditions',
    'Variables'
  ];
  
  // Build rows
  const rows = data.map(tag => [
    tag.name,
    tag.type,
    tag.status,
    tag.triggers?.map(t => t.name).join('; ') || '',
    tag.triggers?.flatMap(t => 
      t.conditions?.map(c => `${c.variable} ${c.type} ${c.value}`) || []
    ).join('; ') || '',
    tag.variables?.join('; ') || ''
  ]);
  
  // Convert to CSV string
  const csvContent = [
    columns.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');
  
  // Download
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
};
```

### Export Options
| Option | Data |
|--------|------|
| Export All | All tags regardless of filters |
| Export Filtered | Only currently filtered tags |

---

## 11. Duplicate Detection

### Location
`src/data/gtmData.js` → `findDuplicateTags()`

### Detection Logic
```js
const findDuplicateTags = (tags) => {
  const duplicateGroups = [];
  const checked = new Set();
  
  tags.forEach((tag, i) => {
    if (checked.has(tag.tagId)) return;
    
    const duplicates = tags.filter((other, j) => {
      if (i === j) return false;
      return compareTagsStrict(tag, other);
    });
    
    if (duplicates.length > 0) {
      duplicateGroups.push({
        original: tag,
        duplicates: duplicates,
        count: duplicates.length + 1
      });
      duplicates.forEach(d => checked.add(d.tagId));
    }
    
    checked.add(tag.tagId);
  });
  
  return duplicateGroups;
};
```

### Strict Comparison
```js
const compareTagsStrict = (tag1, tag2) => {
  // Must be same type
  if (tag1.type !== tag2.type) return false;
  
  // Compare configuration hash
  const config1 = extractTagIdentifiers(tag1);
  const config2 = extractTagIdentifiers(tag2);
  
  return config1.configHash === config2.configHash &&
         config1.conditionHash === config2.conditionHash;
};

const extractTagIdentifiers = (tag) => {
  // Create hash from parameters
  const configHash = JSON.stringify(
    tag.parameter?.sort((a, b) => a.key.localeCompare(b.key))
  );
  
  // Create hash from trigger conditions
  const conditionHash = JSON.stringify(
    tag.firingTriggerId?.sort()
  );
  
  return { configHash, conditionHash };
};
```

---

## 12. Unused Detection

### Unused Triggers
```js
const findUnusedTriggers = (containerData) => {
  const triggers = containerData.containerVersion.trigger || [];
  const tags = containerData.containerVersion.tag || [];
  
  return triggers.filter(trigger => {
    const isUsed = tags.some(tag =>
      tag.firingTriggerId?.includes(trigger.triggerId) ||
      tag.blockingTriggerId?.includes(trigger.triggerId)
    );
    return !isUsed;
  });
};
```

### Unused Variables
```js
const findUnusedVariables = (containerData) => {
  const variables = containerData.containerVersion.variable || [];
  const allContent = JSON.stringify(containerData.containerVersion);
  
  return variables.filter(variable => {
    const pattern = `{{${variable.name}}}`;
    // Count occurrences (excluding the variable definition itself)
    const matches = allContent.match(new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'));
    // Variable appears once = only in its own definition = unused
    return !matches || matches.length <= 1;
  });
};
```

---

## 13. Security Implementation

### Input Sanitization
```js
// Query parameter sanitization
const sanitizeQueryParam = (value, paramName) => {
  const ALLOWED_PARAMS = ['status', 'type', 'trigger'];
  const ALLOWED_VALUES = {
    status: ['active', 'paused', 'all'],
    type: /^[a-zA-Z0-9_-]+$/,
    trigger: /^[a-zA-Z0-9_-]+$/
  };
  
  // Whitelist check
  if (!ALLOWED_PARAMS.includes(paramName)) return null;
  
  // Value validation
  const validator = ALLOWED_VALUES[paramName];
  if (Array.isArray(validator)) {
    return validator.includes(value) ? value : null;
  }
  if (validator instanceof RegExp) {
    return validator.test(value) ? value : null;
  }
  
  return null;
};
```

### JSON Validation
```js
const validateGTMJson = (data, file) => {
  // File checks
  if (!file.name.endsWith('.json')) {
    throw new Error('Invalid file type');
  }
  if (file.size > 50 * 1024 * 1024) {
    throw new Error('File too large');
  }
  
  // Structure checks
  if (!data.containerVersion) {
    throw new Error('Invalid GTM format');
  }
  
  // Prototype pollution check
  const checkPrototypePollution = (obj, depth = 0) => {
    if (depth > 50) throw new Error('Object too deep');
    if (obj === null || typeof obj !== 'object') return;
    
    for (const key of Object.keys(obj)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        throw new Error('Invalid object key detected');
      }
      checkPrototypePollution(obj[key], depth + 1);
    }
  };
  
  checkPrototypePollution(data);
  return true;
};
```

### HTTP Security Headers
```json
// vercel.json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" }
      ]
    }
  ]
}
```

### Content Security Policy
```html
<!-- index.html -->
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data:;
  connect-src 'self';
">
```

---

## 14. PWA Features

### Configuration
```js
// vite.config.js
VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['favicon.svg', 'pwa-192x192.png', 'pwa-512x512.png'],
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'google-fonts-cache',
          expiration: { maxEntries: 10, maxAgeSeconds: 31536000 }
        }
      }
    ]
  },
  manifest: {
    name: 'GTM Container Analyzer',
    short_name: 'GTM Analyzer',
    theme_color: '#0f1117',
    display: 'standalone',
    start_url: '/',
    scope: '/'
  }
})
```

### Offline Capability
- All app assets cached by service worker
- User data persists in IndexedDB
- Full functionality without network
- Auto-update when online

---

## 15. Theming System

### CSS Variables
```css
/* Dark theme (default) */
:root {
  --bg-primary: #0f1117;
  --bg-secondary: #1a1d24;
  --bg-tertiary: #252830;
  --text-primary: #f1f5f9;
  --text-secondary: #94a3b8;
  --text-muted: #64748b;
  --border-primary: rgba(255, 255, 255, 0.1);
  --accent-blue: #38bdf8;
  --accent-green: #4ade80;
  --accent-purple: #a78bfa;
}

/* Light theme */
[data-theme="light"] {
  --bg-primary: #ffffff;
  --bg-secondary: #f8fafc;
  --bg-tertiary: #f1f5f9;
  --text-primary: #1e293b;
  --text-secondary: #475569;
  --text-muted: #94a3b8;
  --border-primary: rgba(0, 0, 0, 0.1);
}
```

### Theme Toggle
```jsx
const [theme, setTheme] = useState(() => {
  return localStorage.getItem('theme') || 'dark';
});

useEffect(() => {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
}, [theme]);

const toggleTheme = () => {
  setTheme(prev => prev === 'dark' ? 'light' : 'dark');
};
```

---

## 16. Routing

### Setup
```jsx
// main.jsx
import { BrowserRouter } from 'react-router-dom';

<BrowserRouter>
  <App />
</BrowserRouter>
```

### Route Structure
```
/                → Upload screen (no data) or redirect to /analyze
/analyze         → Main dashboard with table
/tags            → Tags dependency tree view
/triggers        → Triggers list view
/variables       → Variables list view
```

### Navigation Logic
```jsx
const navigate = useNavigate();
const location = useLocation();

// Derive current view from path
const currentView = useMemo(() => {
  switch (location.pathname) {
    case '/': return dataLoaded ? 'dashboard' : 'upload';
    case '/analyze': return 'dashboard';
    case '/tags': return 'tags';
    case '/triggers': return 'triggers';
    case '/variables': return 'variables';
    default: return 'upload';
  }
}, [location.pathname, dataLoaded]);

// Protected route redirect
useEffect(() => {
  const protectedRoutes = ['/analyze', '/tags', '/triggers', '/variables'];
  if (protectedRoutes.includes(location.pathname) && !dataLoaded) {
    navigate('/');
  }
}, [location.pathname, dataLoaded]);
```

---

## 17. Data Persistence

### Storage Library
Using `localforage` - wraps IndexedDB with fallbacks.

```jsx
import localforage from 'localforage';

// Configure
localforage.config({
  name: 'GTMContainerAnalyzer',
  storeName: 'container_data'
});
```

### Save Data
```jsx
const saveData = async (data) => {
  await localforage.setItem('containerData', data);
  await localforage.setItem('lastUpdated', new Date().toISOString());
};
```

### Load Data
```jsx
const loadData = async () => {
  const data = await localforage.getItem('containerData');
  if (data) {
    setContainerData(data);
    setDataLoaded(true);
  }
};

// Load on mount
useEffect(() => {
  loadData();
}, []);
```

### Clear Data
```jsx
const clearData = async () => {
  await localforage.clear();
  setContainerData(null);
  setDataLoaded(false);
  navigate('/');
};
```

---

## Summary

| Feature | Implementation |
|---------|----------------|
| Data Processing | Pure functions in gtmData.js |
| Filtering | useMemo with multiple filter states |
| Search | Case-insensitive across all fields |
| Export | Client-side CSV generation |
| Security | Multi-layer validation + headers |
| Persistence | IndexedDB via localforage |
| Theming | CSS variables + data-theme attribute |
| PWA | Workbox service worker |
| Routing | React Router v6 |

**Core Principle:** Everything runs in the browser. No servers, no APIs, no data transmission. True privacy-first architecture.

---

*GTM Container Analyzer - Technical Documentation v1.0*



