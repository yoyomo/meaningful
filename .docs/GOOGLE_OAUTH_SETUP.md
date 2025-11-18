# Google OAuth Setup Guide

## 🔑 Setting Up Google OAuth for Meaningful

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Name it: "Meaningful" or similar

### 2. Enable APIs

1. Go to **APIs & Services > Library**
2. Enable these APIs:
   - **Google Calendar API**
   - **People API** (for contacts and phone numbers)
   - **Google+ API** (for basic profile)

### 3. Create OAuth Credentials

1. Go to **APIs & Services > Credentials**
2. Click **"Create Credentials" > "OAuth client ID"**
3. Choose **"Web application"**
4. Configure:
   - **Name**: "Meaningful Web App"
   - **Authorized JavaScript origins**: 
     - `http://localhost:3000` (development)
     - `https://yourdomain.com` (production)
   - **Authorized redirect URIs**:
     - `http://localhost:3001/auth/callback` (development)
     - `https://api.yourdomain.com/auth/callback` (production)

### 4. Get Your Credentials

After creating, you'll get:
- **Client ID**: `123456789-abc123def456.apps.googleusercontent.com`
- **Client Secret**: `GOCSPX-abc123def456`

### 5. Configure Environment Variables

#### Frontend (.env.local):
```
VITE_API_URL=http://localhost:3001
VITE_GOOGLE_CLIENT_ID=your_client_id_here
```

#### Backend (for local development):
```bash
# Set environment variables
export GOOGLE_CLIENT_ID="your_client_id_here"
export GOOGLE_CLIENT_SECRET="your_client_secret_here" 
export FRONTEND_URL="http://localhost:3000"
```

#### For SAM deployment:
```bash
sam deploy --parameter-overrides \
  GoogleClientId="your_client_id_here" \
  GoogleClientSecret="your_client_secret_here" \
  FrontendUrl="http://localhost:3000"
```

### 6. Test the Flow

1. Start backend: `make dev-backend`
2. Start frontend: `make dev-frontend`
3. Click "Sign up with Google"
4. Should redirect to Google → authorize → redirect back with success

### 7. What Permissions We Request

- **openid, email, profile**: Basic user information
- **user.phonenumbers.read**: Access to user's phone number
- **calendar.readonly**: Read calendar events and free/busy
- **contacts.readonly**: Access to contacts (for finding friends)

### 🔒 Security Notes

- Client Secret should NEVER be in frontend code
- Use environment variables for all secrets
- Different credentials for dev/staging/production
- Regularly rotate secrets

### 🛠️ Troubleshooting

**"redirect_uri_mismatch" error:**
- Check that your redirect URI in Google Console exactly matches the one being used
- Make sure it includes the correct port (3001 for local API)

**"invalid_client" error:**
- Double-check Client ID and Secret
- Ensure they're properly set in environment variables

**CORS errors:**
- Check that your frontend URL is in "Authorized JavaScript origins"