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

// Analytics loader disabled on non-Vercel deployments
const AnalyticsLoader = () => {
  return null
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
