import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// PWA Configuration - Easy to maintain, all settings in one place
const pwaConfig = {
  registerType: 'autoUpdate',
  includeAssets: ['favicon.svg', 'pwa-192x192.png', 'pwa-512x512.png'],
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
    cleanupOutdatedCaches: true,
    navigateFallbackDenylist: [
      /^\/api/,
      /^\/mcp/,
      /^\/sse/,
      /^\/messages/,
      /^\/health/
    ],
    // Cache Google Fonts for offline use
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'google-fonts-cache',
          expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }
        }
      },
      {
        urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'gstatic-fonts-cache',
          expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }
        }
      }
    ]
  },
  manifest: {
    id: '/',
    name: 'GTM Container Analyzer',
    short_name: 'GTM Analyzer',
    description: 'Analyze your Google Tag Manager containers with clarity. 100% private - all processing happens in your browser.',
    theme_color: '#0f1117',
    background_color: '#0f1117',
    display: 'standalone',
    start_url: '/',
    scope: '/',
    orientation: 'portrait',
    categories: ['utilities', 'productivity', 'developer'],
    icons: [
      {
        src: '/pwa-192x192.png',
        sizes: '192x192',
        type: 'image/png'
      },
      {
        src: '/pwa-512x512.png',
        sizes: '512x512',
        type: 'image/png'
      },
      {
        src: '/pwa-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable'
      },
      {
        src: '/favicon.svg',
        sizes: 'any',
        type: 'image/svg+xml'
      }
    ]
  }
}

export default defineConfig({
  plugins: [
    react(),
    VitePWA(pwaConfig)
  ],
  server: {
    headers: {
      // Disable COOP/COEP in development to allow Google OAuth popup
      // These are enabled in production via vercel.json
    }
  }
})
