# GTM API Integration Setup

## Quick Setup Guide

### Step 1: Create `.env` file

Create a `.env` file in the `dashboard/` directory:

```env
VITE_GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
```

### Step 2: Get Google OAuth Client ID

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable "Tag Manager API"
4. Go to "Credentials" → "Create Credentials" → "OAuth client ID"
5. Select "Web application"
6. Add authorized origins:
   - `http://localhost:5173` (development)
   - `https://gtmcontaineranalyzer.com` (production)
7. Copy the Client ID to your `.env` file

### Step 3: Install Dependencies

```bash
npm install @react-oauth/google
```

### Step 4: Update `main.jsx`

Wrap your app with `GoogleOAuthProvider`:

```jsx
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

### Step 5: Add ConnectGTM Component

In your upload screen, add:

```jsx
import { ConnectGTM } from './components/ConnectGTM';

// In your JSX:
<ConnectGTM onContainerLoaded={handleFileUpload} />
```

## Files Created

| File | Purpose |
|------|---------|
| `src/hooks/useGTMAuth.js` | OAuth & API logic |
| `src/components/ConnectGTM/ConnectGTM.jsx` | UI component |
| `src/components/ConnectGTM/ConnectGTM.css` | Styles |
| `src/components/ConnectGTM/index.js` | Clean exports |

## Security Notes

- Access tokens are kept in memory only (not persisted)
- Uses `readonly` scope (no write access)
- Tokens expire after 1 hour
- No data is sent to any server

## Troubleshooting

### "Failed to connect to Google"
- Check that your Client ID is correct
- Verify authorized origins include your domain

### "No containers found"
- User may not have access to any GTM containers
- Check permissions in GTM

### Token expired
- User will need to reconnect after 1 hour
- The hook handles this gracefully



