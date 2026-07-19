/**
 * LiveAnalyze Component
 * 
 * Displays live captured data from the browser extension.
 * All CSS classes are prefixed with 'live-' to prevent conflicts
 * with the main dashboard styles.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import {
  Tag, Zap, Activity, ChevronLeft, RefreshCw,
  ExternalLink, Globe, Clock, BarChart3,
  Shield, Trash2, Copy, Check, AlertCircle, ChevronDown,
  ChevronUp, Eye, Filter, Code, Play, Layers, Radio,
  Search, X, Database, Link2, CheckCircle, XCircle, AlertTriangle, Upload
} from 'lucide-react';
import { SEO } from '../SEO';
import { StatCard } from '../common';
import { MultiSelectFilter } from '../filters';
import { CHART_COLORS } from '../../constants';
import { validateTag, getValidationStatus, getValidationSummary } from '../../utils/tagValidationRules';
import LiveExportDropdown from './LiveExportDropdown';
import './LiveAnalyze.css';

// Storage key must match extension
const STORAGE_KEY = 'gtm_live_dashboard_data';

// Message source identifiers
const DASHBOARD_SOURCE = 'gtm-live-dashboard';
const EXTENSION_SOURCE = 'gtm-live-analyzer-extension';

// Custom tooltip for pie chart
const LiveChartTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="live-chart-tooltip">
        <p className="tooltip-name">{data.name}</p>
        <p className="tooltip-value">{data.value} requests</p>
      </div>
    );
  }
  return null;
};

// Helper: Check if a pixel/measurement ID is valid (not placeholder)
const isValidPixelId = (id) => {
  if (!id) return false;
  const strId = String(id).trim().toUpperCase();
  // Filter out common placeholders and test values
  const invalidValues = [
    'DUMMY', 'TEST', 'PLACEHOLDER', 'SAMPLE', 'EXAMPLE', 'XXX', 'XXXXX',
    'YOUR_ID', 'YOUR-ID', 'YOURID', 'PIXEL_ID', 'PIXEL-ID', 'PIXELID',
    'TAG_ID', 'TAG-ID', 'TAGID', 'ID', 'NULL', 'UNDEFINED', 'NONE', 'NA', 'N/A',
    '0', '00000', '000000', '123456', '1234567', '12345678', 'XXXXXXXX'
  ];
  if (invalidValues.includes(strId)) return false;
  // Check for empty or very short IDs
  if (strId.length < 2) return false;
  return true;
};

// Helper: Check if GA4 measurement ID is valid (should start with G-)
const isValidGA4Id = (id) => {
  if (!id) return false;
  const strId = String(id).trim();
  // GA4 IDs start with G- followed by alphanumeric
  return /^G-[A-Z0-9]+$/i.test(strId);
};

// Helper: Generate smart abbreviation for tag types
const getTagAbbreviation = (tagType) => {
  if (!tagType) return '??';

  let name = String(tagType).trim();

  // Handle slash cases like "Twitter/X Pixel" - use the newer name (after slash)
  if (name.includes('/')) {
    const parts = name.split('/');
    name = parts[parts.length - 1].trim();
  }

  // Split by spaces, hyphens, underscores ONLY (don't split camelCase - breaks brand names like LinkedIn)
  const words = name
    .split(/[\s\-_]+/)
    .filter(w => w.length > 0);

  if (words.length === 0) return tagType.slice(0, 2).toUpperCase();

  if (words.length === 1) {
    // Single word: check if it's camelCase like "PageView"
    const camelWords = words[0].replace(/([a-z])([A-Z])/g, '$1 $2').split(' ');
    if (camelWords.length > 1) {
      // CamelCase: take initials (e.g., PageView → PV)
      return camelWords.slice(0, 3).map(w => w.charAt(0).toUpperCase()).join('');
    }
    // True single word: take first 2 letters
    return words[0].slice(0, 2).toUpperCase();
  }

  // Multi-word: take initials (up to 3 chars)
  const initials = words
    .slice(0, 3)
    .map(w => w.charAt(0).toUpperCase())
    .join('');

  // Special cases for well-known abbreviations
  const specialCases = {
    'GTM': 'GTM',  // Google Tag Manager
    'GA4': 'GA4',  // Google Analytics 4
  };

  return specialCases[initials] || initials;
};

// Icon mapping: tag type keywords → local icon file (in /public/icons/)
// All icons are stored locally for reliability - no external dependencies
const TAG_ICONS = {
  // Google - all variations
  'google': 'google',
  'google tag manager': 'googletagmanager',
  'googletagmanager': 'googletagmanager',
  'google tag': 'gtag',
  'google tag (gtag.js)': 'gtag',
  'gtag': 'gtag',
  'gtag.js': 'gtag',
  'gtm_gtag': 'gtag',
  'google analytics': 'googleanalytics',
  'google analytics 4': 'googleanalytics',
  'googleanalytics': 'googleanalytics',
  'google ads': 'googleads',
  'googleads': 'googleads',
  'ga4': 'googleanalytics',
  'gtm': 'googletagmanager',
  'floodlight': 'floodlight',
  'doubleclick': 'floodlight',

  // Meta / Facebook - all variations
  'meta': 'meta',
  'meta pixel': 'meta',
  'metapixel': 'meta',
  'facebook': 'facebook',
  'facebook pixel': 'facebook',
  'fb': 'facebook',
  'instagram': 'instagram',

  // LinkedIn - all variations
  'linkedin': 'linkedin',
  'linkedin ads': 'linkedin',
  'linkedinads': 'linkedin',
  'linkedin insight': 'linkedin',
  'linkedin tag': 'linkedin',

  // Twitter / X - all variations
  'twitter': 'x',
  'twitter ads': 'x',
  'x': 'x',
  'x pixel': 'x',
  'twitter/x': 'x',
  'twitter/x pixel': 'x',

  // TikTok - all variations
  'tiktok': 'tiktok',
  'tiktok ads': 'tiktok',
  'tiktok pixel': 'tiktok',

  // Snapchat - all variations
  'snapchat': 'snapchat',
  'snap': 'snapchat',
  'snap ads': 'snapchat',
  'snapchat ads': 'snapchat',

  // Pinterest - all variations
  'pinterest': 'pinterest',
  'pinterest ads': 'pinterest',
  'pinterest tag': 'pinterest',

  // Reddit - all variations
  'reddit': 'reddit',
  'reddit ads': 'reddit',
  'reddit pixel': 'reddit',

  // Quora - all variations
  'quora': 'quora',
  'quora ads': 'quora',
  'quora pixel': 'quora',

  // Taboola - all variations
  'taboola': 'taboola',
  'taboola ads': 'taboola',
  'taboola pixel': 'taboola',

  // Outbrain - all variations
  'outbrain': 'outbrain',
  'outbrain ads': 'outbrain',
  'outbrain pixel': 'outbrain',

  // Criteo
  'criteo': 'criteo',

  // Microsoft / Bing - all variations
  'microsoft': 'microsoft',
  'microsoft ads': 'microsoft',
  'bing': 'bing',
  'bing ads': 'bing',
  'uet': 'microsoft',

  // Analytics platforms
  'amplitude': 'amplitude',
  'mixpanel': 'mixpanel',
  'segment': 'segment',
  'hotjar': 'hotjar',
  'heap': 'heap',
  'plausible': 'plausible',
  'fullstory': 'fullstory',
  'posthog': 'posthog',

  // Marketing platforms
  'hubspot': 'hubspot',
  'marketo': 'marketo',
  'klaviyo': 'klaviyo',
  'mailchimp': 'mailchimp',
  'intercom': 'intercom',
  'drift': 'drift',

  // Dev/Error tracking
  'sentry': 'sentry',
  'datadog': 'datadog',
  'newrelic': 'newrelic',
  'new relic': 'newrelic',

  // Mobile attribution
  'appsflyer': 'appsflyer',
  'adjust': 'adjust',

  // A/B Testing
  'optimizely': 'optimizely',

  // E-commerce / Other
  'adobe': 'adobe',
  'adobe analytics': 'adobe',
  'salesforce': 'salesforce',
  'shopify': 'shopify',
  'stripe': 'stripe',
  'paypal': 'paypal',
  'cloudflare': 'cloudflare',
  'yandex': 'yandex',
  'yandex metrica': 'yandex',
  'baidu': 'baidu',
  'baidu analytics': 'baidu',

  // Session Recording & Heatmaps
  'clarity': 'clarity',
  'microsoft clarity': 'clarity',
  'logrocket': 'logrocket',
  'crazyegg': 'crazyegg',
  'crazy egg': 'crazyegg',
  'luckyorange': 'luckyorange',
  'lucky orange': 'luckyorange',

  // A/B Testing (additional)
  'abtasty': 'abtasty',
  'ab tasty': 'abtasty',
  'vwo': 'vwo',

  // Analytics (additional)
  'umami': 'umami',
  'matomo': 'matomo',
  'piwik': 'matomo',

  // Chat & Support (additional)
  'zendesk': 'zendesk',
  'tawkto': 'tawkto',
  'tawk.to': 'tawkto',
  'tawk': 'tawkto',
  'crisp': 'crisp',
  'freshworks': 'freshworks',
  'freshchat': 'freshworks',

  // Marketing (additional)
  'pardot': 'pardot',

  // Regional - China
  'bytedance': 'bytedance',
  'ocean engine': 'bytedance',
  'douyin': 'bytedance',

  // Regional - Russia
  'vk': 'vk',
  'vk pixel': 'vk',
  'vkontakte': 'vk',

  // Regional - Japan
  'yahoojapan': 'yahoojapan',
  'yahoo japan': 'yahoojapan',
  'line': 'line',
  'line tag': 'line',

  // Regional - Korea
  'naver': 'naver',
  'kakao': 'kakao',
  'kakao pixel': 'kakao',

  // Common generic names
  'datalayer': 'googletagmanager',
  'analytics': 'googleanalytics',

  // MediaAlpha (use initials "MA")
  'mediaalpha': null,
};

// Get icon filename for a tag type
const getTagIcon = (tagType) => {
  if (!tagType) return null;
  const lower = tagType.toLowerCase().trim();

  // Try exact match first (check if key exists, including explicit null)
  if (lower in TAG_ICONS) return TAG_ICONS[lower];

  // Try matching first word (e.g., "LinkedIn Ads" → "linkedin")
  const firstWord = lower.split(/[\s\-_\/]+/)[0];
  if (firstWord in TAG_ICONS) return TAG_ICONS[firstWord];

  // Try partial match - check if any key is contained in tagType
  // Skip single-char keys to avoid false matches (e.g., 'x' matching 'max')
  for (const [key, value] of Object.entries(TAG_ICONS)) {
    if (key.length > 1 && lower.includes(key) && value !== null) {
      return value;
    }
  }

  // Try reverse partial match - check if tagType is contained in any key
  for (const [key, value] of Object.entries(TAG_ICONS)) {
    if (key.includes(lower) && value !== null) {
      return value;
    }
  }

  return null;
};

// TagIcon component with fallback to initials
// Uses local icons from /public/icons/ for reliability
const TagIcon = ({ tagType, size = 'normal', className = '' }) => {
  const [iconError, setIconError] = React.useState(false);
  const iconName = getTagIcon(tagType);
  const abbreviation = getTagAbbreviation(tagType);
  const sizeClass = size === 'large' ? 'live-tag-icon-large' : 'live-tag-icon';
  const tagClass = tagType?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';

  // Reset error state when tagType changes
  React.useEffect(() => {
    setIconError(false);
  }, [tagType]);

  if (iconName && !iconError) {
    // Use local icons from /public/icons/
    const iconUrl = `/icons/${iconName}.svg`;
    return (
      <span className={`${sizeClass} ${tagClass} ${className} has-icon`}>
        <img
          src={iconUrl}
          alt={tagType}
          onError={() => setIconError(true)}
          loading="lazy"
        />
      </span>
    );
  }

  // Fallback to initials
  return (
    <span className={`${sizeClass} ${tagClass} ${className}`}>
      {abbreviation}
    </span>
  );
};

const LiveAnalyze = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Get tabId from URL (for tab-isolated mode)
  const tabId = searchParams.get('tabId');
  const isTabIsolated = !!tabId;

  // State
  const [liveData, setLiveData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  // UI state
  const [extensionReady, setExtensionReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState([]);
  const [showOverview, setShowOverview] = useState(true);
  const [selectedTag, setSelectedTag] = useState(null);
  const [expandedEvents, setExpandedEvents] = useState({});
  const [isLive, setIsLive] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState(null);
  const [newEventCount, setNewEventCount] = useState(0);
  const [showUrlDetails, setShowUrlDetails] = useState(true);
  const [showUrlParams, setShowUrlParams] = useState(false);  // Hidden by default
  const [urlCopied, setUrlCopied] = useState(false);
  const [importedSession, setImportedSession] = useState(null);

  // Handler for importing a saved session
  const handleImportSession = (sessionData) => {
    setImportedSession(sessionData);
    setLiveData(sessionData);
    setIsLive(false);
    setIsLoading(false);
  };

  // Clear imported session and return to live
  const clearImportedSession = () => {
    setImportedSession(null);
    // Will trigger re-fetch of live data on next interval
  };

  // Track if data was received
  const dataReceivedRef = useRef(false);
  const prevEventCountRef = useRef(0);

  // Debug: log selected tag data
  useEffect(() => {
    if (selectedTag) {
      console.log('[Live Analyze] Selected tag:', {
        tagType: selectedTag.tagType,
        eventName: selectedTag.eventName,
        measurementId: selectedTag.measurementId,
        isSDKCall: selectedTag.isSDKCall,
        allParams: selectedTag.allParams,
        hasPixelId: !!selectedTag.allParams?._pixel_id,
      });
    }
  }, [selectedTag]);

  // Listen for messages from extension
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.source !== window) return;

      const { type, payload, source } = event.data || {};

      if (source !== EXTENSION_SOURCE) return;

      console.log('[Live Analyze] Received message:', type);

      switch (type) {
        case 'GTM_LIVE_EXTENSION_READY':
          setExtensionReady(true);
          requestDataFromExtension();
          break;

        case 'GTM_LIVE_DATA_FROM_EXTENSION':
          dataReceivedRef.current = true;
          setIsLoading(false);
          if (payload) {
            setLiveData(payload);
            setError(null);
          } else {
            setError('no_data');
          }
          break;

        case 'GTM_LIVE_DATA_UPDATED':
          if (payload) {
            // Track new events
            const newCount = payload.networkRequests?.length || 0;
            const prevCount = prevEventCountRef.current;
            if (newCount > prevCount) {
              setNewEventCount(prev => prev + (newCount - prevCount));
              // Reset new event indicator after 3 seconds
              setTimeout(() => setNewEventCount(0), 3000);
            }
            prevEventCountRef.current = newCount;

            setLiveData(payload);
            setError(null);
            setIsLive(true);
            setLastUpdateTime(new Date());
          }
          break;

        case 'GTM_LIVE_DATA_CLEARED':
          setLiveData(null);
          setError('no_data');
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    loadLiveData();

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const requestDataFromExtension = () => {
    window.postMessage({
      type: 'GTM_LIVE_REQUEST_DATA',
      source: DASHBOARD_SOURCE
    }, '*');
  };

  const loadLiveData = async () => {
    setIsLoading(true);
    setError(null);
    dataReceivedRef.current = false;

    // Check localStorage first (for development)
    const localData = localStorage.getItem(STORAGE_KEY);
    if (localData) {
      try {
        const parsed = JSON.parse(localData);
        setLiveData(parsed);
        setIsLoading(false);
        dataReceivedRef.current = true;
        return;
      } catch (e) {
        console.error('[Live Analyze] Error parsing localStorage:', e);
      }
    }

    requestDataFromExtension();

    setTimeout(() => {
      if (!dataReceivedRef.current) {
        setIsLoading(false);
        setError('no_extension');
      }
    }, 2000);
  };

  const clearData = () => {
    window.postMessage({
      type: 'GTM_LIVE_CLEAR_DATA',
      source: DASHBOARD_SOURCE
    }, '*');
    localStorage.removeItem(STORAGE_KEY);
    setLiveData(null);
    setSelectedTag(null);
    setError('no_data');
  };

  const copyToClipboard = (text, type = 'url') => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(false), 2000);
  };

  // Transform live data - deduplicated and grouped by event type
  const transformedData = useMemo(() => {
    if (!liveData) return null;

    // Helper: Get clean ID with proper prefix
    const getCleanId = (params) => {
      if (!params) return null;

      // Check for various ID fields
      let id = params._pixel_id || params._measurement_id || params._container_id;

      // Handle conversion_id (add AW- prefix if missing)
      if (!id && params._conversion_id) {
        id = params._conversion_id.toString().startsWith('AW-')
          ? params._conversion_id
          : `AW-${params._conversion_id}`;
      }

      // Filter out placeholder/dummy values
      if (id) {
        const idLower = id.toString().toLowerCase();
        if (idLower === 'dummy' || idLower === 'placeholder' || idLower === 'test' || idLower === 'undefined' || idLower === 'null') {
          return null;
        }
      }

      return id;
    };

    // Helper: Clean event name
    const cleanEventName = (name, tagType) => {
      if (!name || typeof name !== 'string') return tagType;

      let clean = name;

      // Remove URL artifacts
      if (clean.includes(' en=')) clean = clean.split(' en=')[0];
      if (clean.includes('&')) clean = clean.split('&')[0];

      // Decode URL encoding
      try { clean = decodeURIComponent(clean); } catch (e) { }

      // Filter out internal/noise events
      const noiseEvents = ['gtm.js', 'gtm.dom', 'gtm.init', 'gtm.init_consent'];
      if (noiseEvents.includes(clean)) return null;

      return clean;
    };

    // Step 1: Process all requests into clean entries
    const allEntries = (liveData.networkRequests || [])
      .filter(req => req.tag)
      .map((req, index) => {
        const tagType = req.tag.name || req.tag.type || 'Unknown';
        let eventName = req.eventParams?._event_name || tagType;

        // Handle object event names
        if (typeof eventName === 'object' && eventName !== null) {
          eventName = eventName.name || eventName.event || eventName.action ||
            eventName.type || eventName.eventName || eventName.n ||
            JSON.stringify(eventName).slice(0, 50);
        }
        if (typeof eventName !== 'string') eventName = tagType;

        // Clean the event name
        eventName = cleanEventName(eventName, tagType);
        if (!eventName) return null; // Skip noise events

        const allParams = req.eventParams ? { ...req.eventParams } : {};
        const cleanId = getCleanId(allParams);

        return {
          tagType,
          eventName,
          cleanId,
          timestamp: req.timestamp,
          allParams,
          request: req,
        };
      })
      .filter(Boolean); // Remove null entries

    // Step 2: Deduplicate by unique key (tagType + eventName + ID)
    // Like Tag Assistant: group same events, show count
    const dedupeMap = new Map();

    allEntries.forEach((entry, index) => {
      // Create unique key for deduplication
      const key = `${entry.tagType}::${entry.eventName}::${entry.cleanId || 'no-id'}`;

      if (dedupeMap.has(key)) {
        // Increment count for existing entry
        const existing = dedupeMap.get(key);
        existing.hitCount += 1;
        existing.requests.push(entry.request);
        // Keep the latest timestamp
        if (entry.timestamp > existing.firstSeen) {
          existing.latestSeen = entry.timestamp;
        }
      } else {
        // Create new entry
        dedupeMap.set(key, {
          id: `${key}::${index}`.replace(/\s+/g, '_').toLowerCase(),
          tagId: `live_${index + 1}`,
          eventName: entry.eventName,
          tagType: entry.tagType,
          name: entry.eventName,
          type: entry.tagType,
          requests: [entry.request],
          requestCount: 1,
          hitCount: 1,
          firstSeen: entry.timestamp,
          latestSeen: entry.timestamp,
          status: 'fired',
          measurementId: entry.cleanId,
          pageUrl: entry.request.pageUrl || null,
          pagePath: entry.request.pagePath || null,
          pageHostname: entry.request.pageHostname || null,
          isSDKCall: entry.request.isSDKCall || false,
          sdkName: entry.request.sdkName || null,
          allParams: entry.allParams,
        });
      }
    });

    // Step 3: Convert to array, run validation, and sort by latest activity (newest first)
    const processedTags = Array.from(dedupeMap.values())
      .map(tag => {
        // Run validation rules against each tag
        const validation = validateTag(tag.tagType, tag.allParams);
        return { ...tag, validation };
      })
      .sort((a, b) => {
        const timeA = new Date(a.latestSeen || a.firstSeen || 0).getTime();
        const timeB = new Date(b.latestSeen || b.firstSeen || 0).getTime();
        return timeB - timeA; // Descending (newest first)
      });

    // Keep tag type groups for the chart (aggregate counts)
    const tagTypeGroups = {};
    processedTags.forEach(tag => {
      if (!tagTypeGroups[tag.tagType]) {
        tagTypeGroups[tag.tagType] = { name: tag.tagType, count: 0 };
      }
      tagTypeGroups[tag.tagType].count += tag.hitCount; // Use hitCount for accurate totals
    });

    // Validation summary across all tags
    const validationSummary = getValidationSummary(processedTags);

    // Stats
    const stats = {
      totalTags: processedTags.length,
      firedTags: processedTags.length,
      totalRequests: liveData.networkRequests?.length || 0,
      totalEvents: liveData.dataLayerEvents?.length || 0,
      gtmContainers: liveData.gtmContainerId ? 1 : 0,
      tagsByType: tagTypeGroups,
      validationSummary,
    };

    const chartData = Object.values(tagTypeGroups)
      .map(group => ({
        name: group.name,
        value: group.count,
      }))
      .sort((a, b) => b.value - a.value);

    // Get unique tag types for filter
    const tagTypes = [...new Set(processedTags.map(t => t.type))];

    return {
      processedTags,
      stats,
      chartData,
      tagTypes,
      dataLayerEvents: liveData.dataLayerEvents || [],
      consentEvents: liveData.consentEvents || [],
      pageContext: {
        url: liveData.url,
        hostname: liveData.hostname,
        pathname: liveData.pathname,
        queryParams: liveData.queryParams,
        gtmContainerId: liveData.gtmContainerId,
        captureStarted: liveData.captureStarted,
        captureDuration: liveData.captureDuration,
        lockedDomain: liveData.lockedDomain || liveData.hostname,
      }
    };
  }, [liveData]);


  // Filter tags
  const filteredTags = useMemo(() => {
    if (!transformedData) return [];

    let tags = transformedData.processedTags;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      tags = tags.filter(tag =>
        tag.name.toLowerCase().includes(query) ||
        tag.type.toLowerCase().includes(query) ||
        tag.requests.some(r => r.url.toLowerCase().includes(query))
      );
    }

    if (typeFilter.length > 0) {
      tags = tags.filter(tag => typeFilter.includes(tag.type));
    }

    return tags;
  }, [transformedData, searchQuery, typeFilter]);

  const toggleEventExpanded = (index) => {
    setExpandedEvents(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="live-analyze-page">
        <div className="live-loading">
          <RefreshCw size={32} className="spin" />
          <p>Loading live capture data...</p>
        </div>
      </div>
    );
  }

  // Empty/error state
  if (error || !liveData) {
    return (
      <div className="live-analyze-page">
        <SEO
          title="Live Tag Analyzer - GTM Container Analyzer"
          description="View live captured GTM tag fires from any website."
          canonical="/live"
        />

        <header className="live-header-simple">
          <button className="back-to-dashboard" onClick={() => navigate('/')}>
            <ChevronLeft size={18} />
            <span>Home</span>
          </button>
          <div className="live-header-divider" />
          <div className="live-title-section">
            <div className="live-title-icon">
              <Activity size={18} />
            </div>
            <div className="live-title-text">
              <h1>Live Tag Analyzer</h1>
              <p>View captured tag fires from any website</p>
            </div>
          </div>
        </header>

        <div className="live-empty-state">
          <div className="live-empty-icon">
            {error === 'no_extension' ? <AlertCircle size={48} /> : <Activity size={48} />}
          </div>

          {error === 'no_extension' ? (
            <>
              <h2>Extension Required</h2>
              <p>Install the GTM Container Analyzer - Tag+Pixel Debugger extension to capture live tag fires.</p>
              <div className="live-empty-steps">
                <div className="live-empty-step">
                  <span className="live-step-num">1</span>
                  <span>Install the GTM Container Analyzer - Tag+Pixel Debugger extension</span>
                </div>
                <div className="live-empty-step">
                  <span className="live-step-num">2</span>
                  <span>Browse any website with GTM</span>
                </div>
                <div className="live-empty-step">
                  <span className="live-step-num">3</span>
                  <span>Click "Analyze in Dashboard" in the extension</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <h2>No Captured Data</h2>
              <p>Use the GTM Container Analyzer - Tag+Pixel Debugger extension to capture tag fires, then click "Analyze in Dashboard".</p>
              <button className="live-retry-btn" onClick={loadLiveData}>
                <RefreshCw size={16} />
                Retry
              </button>
            </>
          )}
        </div>

        <div className="live-privacy-notice">
          <Shield size={16} />
          <span>100% Private - All data stays in your browser</span>
        </div>
      </div>
    );
  }

  const { stats, chartData, tagTypes, dataLayerEvents, consentEvents, pageContext } = transformedData;

  // Compute current consent state from consent event timeline
  let currentConsent = null;
  if (consentEvents && consentEvents.length > 0) {
    // Build the state by applying default then updates in order
    const state = {};
    const consentKeys = ['ad_storage', 'analytics_storage', 'ad_user_data', 'ad_personalization', 'functionality_storage', 'personalization_storage', 'security_storage'];
    for (const evt of consentEvents) {
      if (evt.consentState) {
        for (const key of consentKeys) {
          if (evt.consentState[key]) {
            state[key] = evt.consentState[key];
          }
        }
      }
    }
    if (Object.keys(state).length > 0) {
      currentConsent = state;
    }
  }

  // Main dashboard view
  return (
    <div className="live-analyze-page dashboard-mode">
      <SEO
        title={`Live Analysis: ${pageContext.hostname} - GTM Container Analyzer`}
        description="View live captured GTM tag fires and dataLayer events."
        canonical="/live"
      />

      {/* Simplified Header */}
      <header className="live-dashboard-header">
        <div className="header-brand">
          <div className="brand-text">
            <h1 className="brand-title">GTM Container Analyzer</h1>
            <span className="brand-subtitle">Tag+Pixel Debugger</span>
          </div>
          <div className={`live-badge ${isLive ? 'active' : ''}`}>
            <Radio size={12} className={isLive ? 'pulse' : ''} />
            <span>LIVE</span>
          </div>
        </div>

        <div className="header-meta">
          {/* Tab Isolation Badge */}
          {isTabIsolated && (
            <div className="meta-item tab-isolated-badge" title={`Tab-isolated session for Tab #${tabId}`}>
              <Layers size={14} />
              <span>Tab #{tabId}</span>
            </div>
          )}
          {/* Source URL Display */}
          {/* Domain Badge - Simple, just domain name */}
          <div
            className="meta-item source-url-badge"
            title={`Analyzing: ${pageContext.hostname}`}
          >
            <Globe size={14} />
            <span className="source-url-text">{pageContext.hostname}</span>
          </div>
          <div className="meta-item live-stats-mini">
            <span>{stats.totalTags} events</span>
          </div>
          {importedSession && (
            <div className="meta-item tab-isolated-badge" style={{ borderColor: 'rgba(167, 139, 250, 0.4)', color: '#a78bfa', background: 'linear-gradient(135deg, rgba(167, 139, 250, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%)' }}>
              <Upload size={14} />
              <span>Imported Session</span>
            </div>
          )}
        </div>

        <div className="header-actions">
          <LiveExportDropdown
            allTags={transformedData?.processedTags || []}
            filteredTags={filteredTags}
            dataLayerEvents={dataLayerEvents}
            pageContext={pageContext}
            hasFilters={searchQuery || typeFilter.length > 0}
            liveData={liveData}
            onImportSession={handleImportSession}
          />
          {importedSession && (
            <button className="header-btn" onClick={clearImportedSession} title="Return to live">
              <Radio size={16} />
              Go Live
            </button>
          )}
          <button className="header-btn" onClick={loadLiveData} title="Refresh">
            <RefreshCw size={16} />
          </button>
          <button className="header-btn danger" onClick={clearData} title="Clear">
            <Trash2 size={16} />
          </button>
        </div>
      </header>

      {/* Quick Stats Bar - Simple summary */}
      <div className="live-quick-stats">
        {chartData.slice(0, 6).map((item, index) => (
          <div key={item.name} className="live-quick-stat-item">
            <span
              className="live-quick-stat-dot"
              style={{ background: CHART_COLORS[index % CHART_COLORS.length] }}
            />
            <span className="live-quick-stat-name">{item.name}</span>
            <span className="live-quick-stat-count">{item.value}</span>
          </div>
        ))}
      </div>

      {/* Consent Mode Card - Only shown when consent signals detected */}
      {currentConsent && (
        <div className="live-consent-card">
          <div className="live-consent-header">
            <Shield size={16} />
            <span className="live-consent-title">Consent Mode v2</span>
            <span className="live-consent-badge">{consentEvents.length} signal{consentEvents.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="live-consent-grid">
            {Object.entries(currentConsent).map(([key, value]) => {
              const isGranted = value === 'granted';
              const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
              return (
                <div key={key} className={`live-consent-item ${isGranted ? 'granted' : 'denied'}`}>
                  <span className="live-consent-status-icon">
                    {isGranted ? <CheckCircle size={14} /> : <XCircle size={14} />}
                  </span>
                  <span className="live-consent-label">{label}</span>
                  <span className={`live-consent-value ${isGranted ? 'granted' : 'denied'}`}>
                    {value}
                  </span>
                </div>
              );
            })}
          </div>
          {/* Consent timeline */}
          {consentEvents.length > 1 && (
            <details className="live-consent-timeline">
              <summary>Consent Timeline ({consentEvents.length} events)</summary>
              <div className="live-consent-timeline-list">
                {consentEvents.map((evt, idx) => (
                  <div key={idx} className="live-consent-timeline-item">
                    <span className={`live-consent-type-badge ${evt.consentType}`}>
                      {evt.consentType}
                    </span>
                    <span className="live-consent-timeline-state">
                      {Object.entries(evt.consentState || {}).map(([k, v]) =>
                        `${k.replace(/_/g, ' ')}: ${v}`
                      ).join(', ')}
                    </span>
                    <span className="live-consent-timeline-time">
                      {new Date(evt.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* URL Details Section - For easy comparison */}
      <div className="live-url-details-section">
        <div
          className="live-url-details-header"
          onClick={() => setShowUrlDetails(!showUrlDetails)}
        >
          <div className="live-url-details-title">
            <Link2 size={16} />
            <span>URL Details</span>
            {isTabIsolated && <span className="live-url-tab-badge">Tab #{tabId}</span>}
          </div>
          <div className="live-url-details-actions">
            <button
              className="live-url-copy-btn"
              onClick={(e) => {
                e.stopPropagation();
                const fullUrl = pageContext.url || `https://${pageContext.hostname}${pageContext.pathname}`;
                navigator.clipboard.writeText(fullUrl);
                setUrlCopied(true);
                setTimeout(() => setUrlCopied(false), 2000);
              }}
              title="Copy full URL"
            >
              {urlCopied ? <Check size={14} /> : <Copy size={14} />}
              <span>{urlCopied ? 'Copied!' : 'Copy URL'}</span>
            </button>
            {showUrlDetails ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </div>

        {showUrlDetails && (
          <div className="live-url-details-content">
            <div className="live-url-details-grid">
              <div className="live-url-detail-item">
                <span className="live-url-detail-label">
                  <Globe size={14} />
                  Domain
                </span>
                <span className="live-url-detail-value domain">{pageContext.hostname}</span>
              </div>

              <div className="live-url-detail-item">
                <span className="live-url-detail-label">
                  <Code size={14} />
                  Path
                </span>
                <span className="live-url-detail-value path">{pageContext.pathname || '/'}</span>
              </div>

              <div className="live-url-detail-item full-width">
                <span className="live-url-detail-label">
                  <Link2 size={14} />
                  Full URL
                </span>
                <span className="live-url-detail-value url">
                  {pageContext.url || `https://${pageContext.hostname}${pageContext.pathname}`}
                </span>
              </div>
            </div>

            {/* URL Parameters - Collapsible (hidden by default) */}
            {pageContext.queryParams && Object.keys(pageContext.queryParams).length > 0 && (
              <div className="live-url-params-section">
                <div
                  className="live-url-params-header clickable"
                  onClick={() => setShowUrlParams(!showUrlParams)}
                >
                  <Database size={14} />
                  <span>URL Parameters</span>
                  <span className="live-url-params-badge">{Object.keys(pageContext.queryParams).length}</span>
                  <span className="live-url-params-toggle-icon">
                    {showUrlParams ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </span>
                </div>
                {showUrlParams && (
                  <div className="live-url-params-grid">
                    {Object.entries(pageContext.queryParams).map(([key, value]) => (
                      <div key={key} className="live-url-param-item">
                        <span className="live-url-param-key">{key}</span>
                        <span className="live-url-param-value" title={value}>{value || '(empty)'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Simple Search */}
      <div className="live-filters-section">
        <div className="live-search-filter">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="live-clear-search" onClick={() => setSearchQuery('')}>
              <X size={16} />
            </button>
          )}
        </div>

        {tagTypes.length > 1 && (
          <MultiSelectFilter
            options={tagTypes}
            values={typeFilter}
            onChange={setTypeFilter}
            placeholder="All Tags"
            icon={Filter}
          />
        )}
      </div>

      {/* Events List - Clean cards, click for sidebar details */}
      <div className="live-events-list-section">
        {filteredTags.length === 0 ? (
          <div className="live-no-results">
            <Zap size={32} />
            <p>No events captured yet</p>
            <span>Browse a website to see tag fires</span>
          </div>
        ) : (
          <div className="live-events-cards">
            {filteredTags.map((tag) => {
              const paramCount = Object.keys(tag.allParams || {}).length;
              const isSelected = selectedTag?.tagId === tag.tagId;

              const validationStatus = getValidationStatus(tag.validation);

              return (
                <div
                  key={tag.tagId}
                  className={`live-event-card-simple ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedTag(tag)}
                >
                  <div className="live-event-card-main">
                    <div className="live-tag-icon-wrapper">
                      <TagIcon tagType={tag.tagType} size="normal" />
                      {validationStatus !== 'pass' && (
                        <span className={`live-validation-dot ${validationStatus}`} title={
                          validationStatus === 'error' ? `${tag.validation.summary.errors} error(s)` :
                            validationStatus === 'warning' ? `${tag.validation.summary.warnings} warning(s)` :
                              `${tag.validation.summary.infos} info(s)`
                        } />
                      )}
                    </div>
                    <div className="live-event-card-info">
                      <span className="live-event-card-name">
                        {(() => { try { return decodeURIComponent(tag.eventName); } catch (e) { return tag.eventName; } })()}
                        {tag.hitCount > 1 && (
                          <span className="live-hit-count-badge">×{tag.hitCount}</span>
                        )}
                      </span>
                      <span className="live-event-card-type">{tag.tagType}</span>
                    </div>
                    <div className="live-event-card-meta">
                      {tag.isSDKCall && (
                        <span className="live-event-card-sdk">SDK</span>
                      )}
                      {/* Show Measurement ID, Container ID, Conversion ID, or Pixel ID - only if valid */}
                      {(isValidGA4Id(tag.measurementId) ||
                        isValidPixelId(tag.allParams?._pixel_id) ||
                        String(tag.allParams?._pixel_id || '').startsWith('AW-') ||
                        String(tag.allParams?._pixel_id || '').startsWith('GTM-') ||
                        tag.allParams?._container_id ||
                        tag.allParams?._conversion_id) && (
                          <span className="live-event-card-mid">
                            {isValidGA4Id(tag.measurementId) ? tag.measurementId :
                              (tag.allParams?._container_id ||
                                (tag.allParams?._conversion_id ? `AW-${tag.allParams._conversion_id}` : null) ||
                                tag.allParams?._pixel_id)}
                          </span>
                        )}
                      {/* Always show params count if > 0 */}
                      {paramCount > 0 && (
                        <span className="live-event-card-params">{paramCount} params</span>
                      )}
                      <Eye size={16} className="live-event-card-arrow" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* DataLayer Events - Collapsed by default */}
      {dataLayerEvents.length > 0 && (
        <details className="live-datalayer-section">
          <summary className="live-datalayer-toggle">
            <Database size={16} />
            <span>DataLayer Pushes</span>
            <span className="live-datalayer-count">{dataLayerEvents.length}</span>
          </summary>
          <div className="live-datalayer-list">
            {dataLayerEvents.slice(0, 10).map((evt, index) => (
              <div key={index} className="live-datalayer-item">
                <span className="live-datalayer-event">{evt.event || 'push'}</span>
                <span className="live-datalayer-time">
                  {new Date(evt.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Trademark Disclaimer */}
      <div className="live-trademark-disclaimer">
        All logos and trademarks are property of their respective owners.
      </div>

      {/* Detail Panel Sidebar */}
      {selectedTag && (
        <div className="live-detail-panel-simple">
          <div className="live-detail-header-simple">
            <div className="live-detail-title-simple">
              <TagIcon tagType={selectedTag.tagType} size="large" />
              <div>
                <h3>{(() => { try { return decodeURIComponent(selectedTag.eventName); } catch (e) { return selectedTag.eventName; } })()}</h3>
                <span className="live-detail-subtitle">{selectedTag.tagType}</span>
              </div>
            </div>
            <button className="live-close-btn-simple" onClick={() => setSelectedTag(null)}>
              <X size={20} />
            </button>
          </div>

          <div className="live-detail-body-simple">
            {/* Validation Results */}
            {selectedTag.validation && selectedTag.validation.results.length > 0 && (
              <div className="live-validation-section">
                <div className="live-validation-header">
                  {selectedTag.validation.summary.errors > 0 ? (
                    <XCircle size={16} className="live-validation-icon error" />
                  ) : selectedTag.validation.summary.warnings > 0 ? (
                    <AlertTriangle size={16} className="live-validation-icon warning" />
                  ) : (
                    <AlertCircle size={16} className="live-validation-icon info" />
                  )}
                  <span>Validation ({selectedTag.validation.results.length} issue{selectedTag.validation.results.length !== 1 ? 's' : ''})</span>
                </div>
                <div className="live-validation-list">
                  {selectedTag.validation.results.map((result, idx) => (
                    <div key={idx} className={`live-validation-item ${result.severity}`}>
                      <span className={`live-validation-severity ${result.severity}`}>
                        {result.severity === 'error' ? '✕' : result.severity === 'warning' ? '⚠' : 'ℹ'}
                      </span>
                      <span className="live-validation-message">{result.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {selectedTag.validation && selectedTag.validation.summary.passed && (
              <div className="live-validation-section passed">
                <div className="live-validation-header">
                  <CheckCircle size={16} className="live-validation-icon pass" />
                  <span>All validation checks passed</span>
                </div>
              </div>
            )}

            {/* Event Info - Useful for devs/analysts */}
            <div className="live-event-info-section">
              {/* Event Name */}
              <div className="live-info-badge event-name full-width">
                <Zap size={14} />
                <span className="live-info-label">Event</span>
                <span className="live-info-main">{(() => { try { return decodeURIComponent(selectedTag.eventName); } catch (e) { return selectedTag.eventName; } })()}</span>
              </div>

              {/* SDK Indicator - Shows when captured from JS SDK method */}
              {selectedTag.isSDKCall && (
                <div className="live-info-badge sdk-call full-width">
                  <Code size={14} />
                  <span className="live-info-label">Source</span>
                  <span className="live-info-value">SDK Call ({selectedTag.sdkName || selectedTag.tagType})</span>
                </div>
              )}

              {/* GTM Container ID */}
              {pageContext.gtmContainerId && (
                <div className="live-info-badge gtm">
                  <span className="live-info-label">GTM</span>
                  <span className="live-info-value">{pageContext.gtmContainerId}</span>
                </div>
              )}

              {/* GA4 Measurement ID - Only show if valid G-XXXXXXX format */}
              {isValidGA4Id(selectedTag.measurementId) && (
                <div className="live-info-badge ga4">
                  <span className="live-info-label">GA4</span>
                  <span className="live-info-value">{selectedTag.measurementId}</span>
                </div>
              )}

              {/* Meta Pixel ID */}
              {isValidPixelId(selectedTag.allParams?._pixel_id) && selectedTag.tagType === 'Meta Pixel' && (
                <div className="live-info-badge meta">
                  <span className="live-info-label">Meta Pixel</span>
                  <span className="live-info-value">{selectedTag.allParams._pixel_id}</span>
                </div>
              )}

              {/* TikTok Pixel ID */}
              {isValidPixelId(selectedTag.allParams?._pixel_id) && selectedTag.tagType === 'TikTok Pixel' && (
                <div className="live-info-badge tiktok">
                  <span className="live-info-label">TikTok</span>
                  <span className="live-info-value">{selectedTag.allParams._pixel_id}</span>
                </div>
              )}

              {/* Taboola Pixel ID */}
              {isValidPixelId(selectedTag.allParams?._pixel_id || selectedTag.measurementId) && selectedTag.tagType === 'Taboola' && (
                <div className="live-info-badge taboola">
                  <span className="live-info-label">Taboola</span>
                  <span className="live-info-value">{selectedTag.allParams?._pixel_id || selectedTag.measurementId}</span>
                </div>
              )}

              {/* Outbrain Pixel ID */}
              {isValidPixelId(selectedTag.allParams?._pixel_id || selectedTag.measurementId) && selectedTag.tagType === 'Outbrain' && (
                <div className="live-info-badge outbrain">
                  <span className="live-info-label">Outbrain</span>
                  <span className="live-info-value">{selectedTag.allParams?._pixel_id || selectedTag.measurementId}</span>
                </div>
              )}

              {/* Generic Pixel ID for other tags (not GA4, not specific pixel types) */}
              {isValidPixelId(selectedTag.allParams?._pixel_id || selectedTag.measurementId) &&
                !isValidGA4Id(selectedTag.measurementId) &&
                !['Meta Pixel', 'TikTok Pixel', 'Taboola', 'Outbrain', 'GA4', 'Google Analytics 4'].includes(selectedTag.tagType) &&
                !selectedTag.tagType?.includes('Google Analytics') && (
                  <div className="live-info-badge pixel">
                    <span className="live-info-label">Pixel ID</span>
                    <span className="live-info-value">{selectedTag.allParams?._pixel_id || selectedTag.measurementId}</span>
                  </div>
                )}

              {/* GTM Container ID (GTM-XXXXXXX) */}
              {(String(selectedTag.allParams?._container_id || '').startsWith('GTM-') || String(selectedTag.allParams?._pixel_id || '').startsWith('GTM-')) && (
                <div className="live-info-badge gtm">
                  <span className="live-info-label">GTM</span>
                  <span className="live-info-value">{selectedTag.allParams._container_id || selectedTag.allParams._pixel_id}</span>
                </div>
              )}

              {/* Google Ads Conversion ID (AW-XXXXXXXXX) */}
              {(String(selectedTag.allParams?._pixel_id || '').startsWith('AW-') || selectedTag.allParams?._conversion_id) && (
                <div className="live-info-badge gads">
                  <span className="live-info-label">Google Ads</span>
                  <span className="live-info-value">
                    {String(selectedTag.allParams._pixel_id || '').startsWith('AW-')
                      ? selectedTag.allParams._pixel_id
                      : `AW-${selectedTag.allParams._conversion_id}`}
                  </span>
                </div>
              )}

              {/* Google Ads Conversion Label */}
              {isValidPixelId(selectedTag.allParams?._conversion_label) && (
                <div className="live-info-badge gads-label">
                  <span className="live-info-label">Conv. Label</span>
                  <span className="live-info-value">{selectedTag.allParams._conversion_label}</span>
                </div>
              )}

              {/* LinkedIn Partner ID */}
              {isValidPixelId(selectedTag.allParams?._partner_id) && (
                <div className="live-info-badge linkedin">
                  <span className="live-info-label">LinkedIn</span>
                  <span className="live-info-value">{selectedTag.allParams._partner_id}</span>
                </div>
              )}

              {/* Microsoft UET Tag ID */}
              {isValidPixelId(selectedTag.allParams?._tag_id) && (
                <div className="live-info-badge microsoft">
                  <span className="live-info-label">MS Ads</span>
                  <span className="live-info-value">{selectedTag.allParams._tag_id}</span>
                </div>
              )}
            </div>

            {/* Additional Details Row */}
            <div className="live-event-details-row">
              {selectedTag.allParams?._client_id && (
                <div className="live-detail-chip">
                  <span className="live-chip-label">Client</span>
                  <span className="live-chip-value">{selectedTag.allParams._client_id}</span>
                </div>
              )}
              {selectedTag.allParams?._session_id && (
                <div className="live-detail-chip">
                  <span className="live-chip-label">Session</span>
                  <span className="live-chip-value">{selectedTag.allParams._session_id}</span>
                </div>
              )}
              {selectedTag.pageHostname && (
                <div className="live-detail-chip">
                  <Globe size={12} />
                  <span className="live-chip-value">{selectedTag.pageHostname}</span>
                </div>
              )}
              <div className="live-detail-chip">
                <Clock size={12} />
                <span className="live-chip-value">{selectedTag.requests?.[0]?.timestamp ? new Date(selectedTag.requests[0].timestamp).toLocaleTimeString() : 'N/A'}</span>
              </div>
            </div>

            {/* Parameters - Only show if there are non-system params with real values */}
            {(() => {
              // Filter out system params AND placeholder values
              const nonSystemParams = Object.entries(selectedTag.allParams || {}).filter(([k, v]) => {
                if (k.startsWith('_')) return false;
                // Filter out placeholder/dummy values
                const strValue = String(v).toLowerCase();
                if (strValue === 'dummy' || strValue === 'placeholder' || strValue === 'test' || strValue === 'undefined' || strValue === 'null' || strValue === '') return false;
                return true;
              });
              const validSystemParams = Object.entries(selectedTag.allParams || {}).filter(([k, v]) => k.startsWith('_') && isValidPixelId(v));
              const hasParams = nonSystemParams.length > 0;
              const hasValidSystem = validSystemParams.length > 0;

              if (!hasParams && !hasValidSystem) return null; // Hide entire section if nothing to show

              return (
                <>
                  {/* Regular Parameters */}
                  {hasParams && (
                    <>
                      <div className="live-params-header-simple">
                        <span>Parameters ({nonSystemParams.length})</span>
                        <button
                          className="live-copy-all-simple"
                          onClick={() => copyToClipboard(JSON.stringify(selectedTag.allParams, null, 2), 'all-params')}
                        >
                          {copied === 'all-params' ? <Check size={14} /> : <Copy size={14} />}
                          Copy All
                        </button>
                      </div>
                      <div className="live-params-list-simple">
                        {nonSystemParams.map(([param, value]) => (
                          <div key={param} className="live-param-item-simple">
                            <span className="live-param-key-simple">{param}</span>
                            <span className="live-param-value-simple">
                              {typeof value === 'object' ? JSON.stringify(value) : String(value) || '(empty)'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {/* System params collapsed - only show valid ones */}
                  {hasValidSystem && (
                    <details className="live-system-params">
                      <summary>System Parameters ({validSystemParams.length})</summary>
                      <div className="live-params-list-simple">
                        {validSystemParams.map(([param, value]) => (
                          <div key={param} className="live-param-item-simple system">
                            <span className="live-param-key-simple">{param}</span>
                            <span className="live-param-value-simple">
                              {typeof value === 'object' ? JSON.stringify(value) : String(value) || '(empty)'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Privacy Notice */}
      <div className="live-floating-privacy-badge">
        <Shield size={10} />
        <span>100% Private</span>
      </div>
    </div>
  );
};

export default LiveAnalyze;
