# Google Tag Manager API Integration Guide

This guide covers how to implement direct GTM container fetching via Google OAuth, eliminating the need for manual JSON file uploads.

---

## Overview

Instead of users downloading and uploading GTM JSON files, they can:
1. Click "Connect GTM Account"
2. Sign in with Google
3. Select their container
4. Data loads automatically

---

## Prerequisites

- Google Cloud Console account
- GTM Container Analyzer app (current setup)
- Basic understanding of OAuth 2.0

---

## Implementation Steps

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "New Project"
3. Name it (e.g., "GTM Container Analyzer")
4. Click "Create"

### Step 2: Enable Tag Manager API

1. In Cloud Console, go to "APIs & Services" → "Library"
2. Search for "Tag Manager API"
3. Click "Enable"

### Step 3: Create OAuth Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Select "Web application"
4. Add authorized origins:
   - `http://localhost:5173` (development)
   - `https://gtmcontaineranalyzer.com` (production)
5. Add authorized redirect URIs (same as above)
6. Copy the **Client ID**

### Step 4: Configure OAuth Consent Screen

1. Go to "APIs & Services" → "OAuth consent screen"
2. Choose "External" (for public use)
3. Fill in:
   - App name: GTM Container Analyzer
   - User support email: your email
   - Developer contact: your email
4. Add scopes:
   - `https://www.googleapis.com/auth/tagmanager.readonly`
5. Save

> ⚠️ **Note:** For production, Google requires verification which can take days/weeks.

---

## Code Implementation

### Install Dependencies

```bash
npm install @react-oauth/google
```

### Environment Variables

Create `.env` file:

```env
VITE_GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
```

### Wrap App with Provider

```jsx
// main.jsx
import { GoogleOAuthProvider } from '@react-oauth/google';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </GoogleOAuthProvider>
  </React.StrictMode>
);
```

### Create GTM Auth Hook

```jsx
// src/hooks/useGTMAuth.js
import { useGoogleLogin } from '@react-oauth/google';
import { useState } from 'react';

const GTM_API_BASE = 'https://tagmanager.googleapis.com/tagmanager/v2';

export const useGTMAuth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [accessToken, setAccessToken] = useState(null);

  const login = useGoogleLogin({
    scope: 'https://www.googleapis.com/auth/tagmanager.readonly',
    onSuccess: async (tokenResponse) => {
      setAccessToken(tokenResponse.access_token);
      await fetchAccounts(tokenResponse.access_token);
    },
    onError: (error) => {
      setError('Failed to connect to Google');
      console.error(error);
    }
  });

  const fetchAccounts = async (token) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${GTM_API_BASE}/accounts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setAccounts(data.account || []);
    } catch (err) {
      setError('Failed to fetch GTM accounts');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchContainers = async (accountId) => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `${GTM_API_BASE}/accounts/${accountId}/containers`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const data = await response.json();
      return data.container || [];
    } catch (err) {
      setError('Failed to fetch containers');
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const fetchContainerVersion = async (containerPath) => {
    setIsLoading(true);
    try {
      // Get latest version
      const response = await fetch(
        `${GTM_API_BASE}/${containerPath}/versions:live`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const data = await response.json();
      return data;
    } catch (err) {
      setError('Failed to fetch container data');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    login,
    isLoading,
    error,
    accounts,
    fetchContainers,
    fetchContainerVersion,
    isAuthenticated: !!accessToken
  };
};
```

### Create Connect Button Component

```jsx
// src/components/ConnectGTM.jsx
import { useState } from 'react';
import { useGTMAuth } from '../hooks/useGTMAuth';
import { Cloud } from 'lucide-react';

export const ConnectGTM = ({ onContainerLoaded }) => {
  const {
    login,
    isLoading,
    error,
    accounts,
    fetchContainers,
    fetchContainerVersion,
    isAuthenticated
  } = useGTMAuth();

  const [containers, setContainers] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);

  const handleAccountSelect = async (accountId) => {
    setSelectedAccount(accountId);
    const containerList = await fetchContainers(accountId);
    setContainers(containerList);
  };

  const handleContainerSelect = async (container) => {
    const data = await fetchContainerVersion(container.path);
    if (data) {
      // Transform to match your existing data structure
      const containerData = {
        exportFormatVersion: 2,
        containerVersion: data
      };
      onContainerLoaded(containerData);
    }
  };

  if (!isAuthenticated) {
    return (
      <button className="connect-gtm-btn" onClick={login} disabled={isLoading}>
        <Cloud size={18} />
        {isLoading ? 'Connecting...' : 'Connect GTM Account'}
      </button>
    );
  }

  return (
    <div className="gtm-selector">
      {error && <p className="error">{error}</p>}
      
      {accounts.length > 0 && !selectedAccount && (
        <div className="account-list">
          <h4>Select Account</h4>
          {accounts.map((account) => (
            <button
              key={account.accountId}
              onClick={() => handleAccountSelect(account.accountId)}
            >
              {account.name}
            </button>
          ))}
        </div>
      )}

      {containers.length > 0 && (
        <div className="container-list">
          <h4>Select Container</h4>
          {containers.map((container) => (
            <button
              key={container.containerId}
              onClick={() => handleContainerSelect(container)}
            >
              {container.name} ({container.publicId})
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
```

### Add to Upload Screen

```jsx
// In your FileUpload component, add alongside existing upload:

<div className="upload-options">
  <div className="upload-divider">
    <span>or</span>
  </div>
  
  <ConnectGTM onContainerLoaded={handleFileUpload} />
  
  <p className="connect-hint">
    Connect your Google account to load containers directly
  </p>
</div>
```

---

## API Reference

### Key Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /accounts` | List all GTM accounts user has access to |
| `GET /accounts/{accountId}/containers` | List containers in an account |
| `GET /{containerPath}/versions:live` | Get live/published version |
| `GET /{containerPath}/versions/{versionId}` | Get specific version |

### Required OAuth Scope

```
https://www.googleapis.com/auth/tagmanager.readonly
```

This scope provides read-only access to GTM data (safest option).

---

## Security Considerations

1. **Never store access tokens** - Keep them in memory only
2. **Use readonly scope** - No need for write access
3. **Validate responses** - Check data structure before processing
4. **Handle token expiry** - Tokens expire after 1 hour, prompt re-login

---

## Official Documentation Links

1. **Tag Manager API v2**
   - https://developers.google.com/tag-platform/tag-manager/api/v2

2. **OAuth 2.0 for JavaScript**
   - https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow

3. **React OAuth Library**
   - https://www.npmjs.com/package/@react-oauth/google

4. **API Reference - Containers**
   - https://developers.google.com/tag-platform/tag-manager/api/v2/reference/accounts/containers

5. **API Reference - Container Versions**
   - https://developers.google.com/tag-platform/tag-manager/api/v2/reference/accounts/containers/versions

6. **Google Cloud Console**
   - https://console.cloud.google.com/

---

## Estimated Implementation Time

| Task | Time |
|------|------|
| Google Cloud setup | 30 min |
| OAuth implementation | 2-3 hours |
| Container selector UI | 1-2 hours |
| Testing & polish | 1-2 hours |
| **Total** | **5-8 hours** |

---

## Notes

- The API returns the same data structure as the exported JSON file
- Your existing parsing logic (`gtmData.js`) will work with minor adjustments
- Consider keeping file upload as primary option (privacy-focused users)
- API connection can be an optional "power user" feature

---

*Created for GTM Container Analyzer - Future Enhancement Reference*



