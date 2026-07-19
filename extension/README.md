# GTM Container Analyzer - Tag+Pixel Debugger (Browser Extension)

Debug GA4, GTM, Google Ads, Meta Pixel, LinkedIn, TikTok & 70+ marketing tags in real-time. Works with GTM Container Analyzer dashboard.

## 🔒 Privacy First

- **100% Local**: All data stays in your browser
- **No Server**: Zero data transmission to external servers
- **User Control**: Clear data anytime

## Features

- **Live Tag Detection**: Captures GA4, Meta Pixel, TikTok, Google Ads, and more
- **DataLayer Events**: Intercepts all dataLayer.push events
- **Network Monitoring**: Tracks tag fire network requests
- **Dashboard Integration**: One-click analysis in the full dashboard

## Installation (Development)

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `extension` folder
5. The extension icon should appear in your toolbar

## How to Use

1. **Browse any website** with GTM installed
2. **Click the extension icon** to see captured data
3. **Click "Analyze in Dashboard"** to view detailed analysis

## File Structure

```
extension/
├── manifest.json           # Extension configuration (Manifest V3)
├── background/
│   └── service-worker.js   # Background service worker
├── content/
│   └── capture.js          # Content script (runs on pages)
├── injected/
│   └── gtm-interceptor.js  # Injected script for dataLayer
├── popup/
│   ├── popup.html          # Popup UI
│   ├── popup.css           # Popup styles
│   └── popup.js            # Popup logic
├── utils/
│   ├── constants.js        # Configuration constants
│   ├── storage.js          # Chrome storage utilities
│   └── parser.js           # Data parsing utilities
└── icons/                  # Extension icons
```

## Detected Tags

| Tag | Detection |
|-----|-----------|
| Google Analytics 4 | ✅ |
| Google Ads | ✅ |
| Google Tag Manager | ✅ |
| Meta Pixel (Facebook) | ✅ |
| TikTok Pixel | ✅ |
| Snapchat Pixel | ✅ |
| LinkedIn Insight | ✅ |
| Twitter/X Pixel | ✅ |
| Pinterest Tag | ✅ |
| Microsoft UET | ✅ |
| Hotjar | ✅ |
| Microsoft Clarity | ✅ |

## Development

### Build for Production

The extension is ready to use as-is for development. For production:

1. Create icons in the `icons/` folder (16x16, 32x32, 48x48, 128x128)
2. Test thoroughly
3. Package as .zip for Chrome Web Store

### Adding New Tag Patterns

Edit `content/capture.js` or `utils/constants.js` to add new tag detection patterns:

```javascript
NEW_TAG: {
  name: 'New Tag Name',
  patterns: [/pattern-to-match\.com/],
  icon: 'newtag',
}
```

## Security

- Content scripts run in isolated context
- Injected scripts only intercept dataLayer (read-only)
- No external API calls
- All permissions are minimal and necessary

## License

MIT License - Part of GTM Container Analyzer

