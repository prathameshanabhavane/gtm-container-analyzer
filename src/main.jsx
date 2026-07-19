import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { GTMAuthProvider } from './context'
import App from './App.jsx'
import './index.css'

// Check if running in production (Vercel) vs development (localhost)
const isProduction = import.meta.env.PROD

// Google OAuth Client ID from environment variable
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

// Analytics component that only loads in production (avoids CSP eval errors in dev)
const AnalyticsLoader = () => {
  const [AnalyticsComponent, setAnalyticsComponent] = React.useState(null)
  
  React.useEffect(() => {
    if (isProduction) {
      // Dynamic import only in production to avoid CSP unsafe-eval errors in development
      import('@vercel/analytics/react').then((module) => {
        setAnalyticsComponent(() => module.Analytics)
      }).catch(() => {
        // Silently fail if Analytics can't be loaded
        console.warn('Vercel Analytics could not be loaded')
      })
    }
  }, [])
  
  if (!AnalyticsComponent) return null
  return <AnalyticsComponent />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider>
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID || ''}>
        <GTMAuthProvider>
          <BrowserRouter>
            <App />
            <AnalyticsLoader />
          </BrowserRouter>
        </GTMAuthProvider>
      </GoogleOAuthProvider>
    </HelmetProvider>
  </React.StrictMode>,
)
