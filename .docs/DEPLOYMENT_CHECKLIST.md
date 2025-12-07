# Deployment Checklist

This document outlines all the steps required to deploy the Meaningful app to AWS.

## Prerequisites

### 1. AWS Setup
- [ ] **AWS CLI installed and configured**
  ```bash
  aws configure
  # You'll need: Access Key ID, Secret Access Key, Region (us-east-1), Output format (json)
  ```
- [ ] **AWS SAM CLI installed**
  ```bash
  brew install aws-sam-cli  # macOS
  # Or: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html
  ```
- [ ] **Verify AWS credentials have sufficient permissions**
  - CloudFormation (create/update/delete stacks)
  - Lambda (create/update functions)
  - API Gateway (create/update APIs)
  - DynamoDB (create tables)
  - IAM (create roles/policies - SAM handles this with `CAPABILITY_IAM`)
  - S3 (for SAM artifacts - SAM handles this automatically)

### 2. Google Cloud Console Setup

⚠️ **CRITICAL: This must be done BEFORE deployment**

- [ ] **Create/Select Google Cloud Project**
  1. Go to https://console.cloud.google.com/
  2. Create a new project or select existing one
  3. Note your project ID

- [ ] **Enable Required APIs**
  - Google Calendar API
  - Google People API
  - Google+ API (for user info)

- [ ] **Create OAuth 2.0 Credentials**
  1. Go to: APIs & Services → Credentials
  2. Click "Create Credentials" → "OAuth client ID"
  3. Application type: **Web application**
  4. Name: "Meaningful App" (or your choice)
  5. **Authorized redirect URIs** - You'll need to add these:
     - **Local dev**: `http://localhost:3001/auth/callback`
     - **Production**: `https://{api-id}.execute-api.{region}.amazonaws.com/{stage}/auth/callback`
     - ⚠️ **Note**: You'll get the production URL after first deployment, so you may need to update this later

- [ ] **OAuth Consent Screen**
  1. Configure OAuth consent screen
  2. User type: External (for production) or Internal (for G Suite)
  3. Fill in required fields:
     - App name: "Meaningful"
     - User support email
     - Developer contact email
  4. **Scopes** (add these):
     - `openid`
     - `https://www.googleapis.com/auth/userinfo.profile`
     - `https://www.googleapis.com/auth/userinfo.email`
     - `https://www.googleapis.com/auth/user.phonenumbers.read`
     - `https://www.googleapis.com/auth/calendar.events`
     - `https://www.googleapis.com/auth/calendar.readonly`
     - `https://www.googleapis.com/auth/contacts.readonly`
  5. **Test users** (if app is in Testing mode):
     - Add your email and any test user emails
     - ⚠️ **Important**: Refresh tokens only work for test users in Testing mode

- [ ] **Save Credentials**
  - Copy the **Client ID** and **Client Secret**
  - You'll need these for SAM deployment parameters

## Deployment Steps

### Step 1: First-Time Deployment (Guided)

```bash
cd backend
sam deploy --guided
```

**Parameters you'll be prompted for:**
- **Stack Name**: `meaningful-backend` (or your choice)
- **AWS Region**: `us-east-1` (or your preferred region)
- **Parameter Stage**: `dev`, `staging`, or `prod`
- **Parameter GoogleClientId**: Your Google OAuth Client ID
- **Parameter GoogleClientSecret**: Your Google OAuth Client Secret
- **Parameter FrontendUrl**: 
  - **For now (S3 website)**: `http://meaningful-frontend-staging.s3-website-us-east-1.amazonaws.com`
  - **Later (GoDaddy domain)**: `http://staging.yourdomain.com` or `https://staging.yourdomain.com` (with CloudFront)
  - **Note**: You can update this later after setting up your domain
- **Parameter DynamoDbEndpoint**: Press Enter (leave empty for AWS DynamoDB)
- **Confirm changes before deploy**: `Y`
- **Allow SAM CLI IAM role creation**: `Y` (required)
- **Disable rollback**: `N` (keep rollback enabled)
- **Save arguments to configuration file**: `Y` (saves to `samconfig.toml`)

### Step 2: Get Your API Endpoint

After deployment, SAM will output:
```
ApiEndpoint: https://{api-id}.execute-api.{region}.amazonaws.com/{stage}/
```

**Save this URL** - you'll need it for:
1. Updating Google OAuth redirect URI
2. Configuring frontend environment variable

### Step 3: Update Google OAuth Redirect URI

1. Go back to Google Cloud Console → Credentials
2. Edit your OAuth 2.0 Client ID
3. Add the production redirect URI:
   ```
   https://{api-id}.execute-api.{region}.amazonaws.com/{stage}/auth/callback
   ```
   (Replace `{api-id}`, `{region}`, and `{stage}` with your actual values)

### Step 4: Deploy Frontend

The frontend needs to be built and deployed to a hosting service. Here are the steps:

#### 4a. Build Frontend

First, build the frontend with the correct API URL:

```bash
cd frontend

# Create .env.production file
cat > .env.production << EOF
VITE_API_URL=https://{api-id}.execute-api.{region}.amazonaws.com/{stage}
EOF

# Build for production
pnpm build
```

This creates a `dist/` directory with the production build.

#### 4b. Choose Frontend Hosting

**Option 1: Vercel (Recommended - Easiest)**
1. Install Vercel CLI: `npm i -g vercel`
2. Deploy: `cd frontend && vercel`
3. Set environment variable during deployment:
   - `VITE_API_URL`: `https://{api-id}.execute-api.{region}.amazonaws.com/{stage}`
4. Or set in Vercel dashboard: Project → Settings → Environment Variables

**Option 2: Netlify**
1. Install Netlify CLI: `npm i -g netlify-cli`
2. Deploy: `cd frontend && netlify deploy --prod`
3. Set environment variable:
   - `VITE_API_URL`: `https://{api-id}.execute-api.{region}.amazonaws.com/{stage}`
4. Or set in Netlify dashboard: Site settings → Environment variables

**Option 3: AWS S3 + CloudFront (Static Hosting)**
1. Create S3 bucket: `aws s3 mb s3://meaningful-frontend-{stage}`
2. Upload build: `aws s3 sync frontend/dist s3://meaningful-frontend-{stage} --delete`
3. Enable static website hosting
4. Create CloudFront distribution (optional, for HTTPS)
5. Set environment variable: Build with `VITE_API_URL` before uploading

**Option 4: GitHub Pages / Other Static Hosting**
1. Build with environment variable set
2. Upload `dist/` contents to your hosting service
3. Configure custom domain if needed

#### 4c. Environment Variables

The frontend only needs one environment variable:
- `VITE_API_URL`: Your backend API endpoint URL

**Note**: `VITE_GOOGLE_CLIENT_ID` is defined in types but not currently used - the frontend gets auth URLs from the backend API.

### Step 5: Update Frontend After Backend Changes

If you redeploy the backend and the API URL changes:

1. **Get new API URL** from CloudFormation outputs:
   ```bash
   aws cloudformation describe-stacks \
     --stack-name meaningful-backend-staging \
     --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
     --output text
   ```

2. **Update frontend environment variable** in your hosting platform:
   - Vercel: Dashboard → Project → Settings → Environment Variables
   - Netlify: Site settings → Environment variables
   - Or rebuild and redeploy with new `.env.production`

3. **Redeploy frontend** (if needed):
   ```bash
   cd frontend
   # Update .env.production with new API URL
   pnpm build
   # Redeploy to your hosting service
   ```

### Step 6: Subsequent Backend Deployments

After the first deployment, you can deploy with:

```bash
cd backend
sam deploy
```

SAM will use the saved configuration from `samconfig.toml`.

**To update parameters**, either:
- Edit `samconfig.toml` directly, or
- Use `sam deploy --parameter-overrides ParameterKey=GoogleClientId,ParameterValue=new_value`

## Important Notes

### API URL Auto-Detection
The API URL for OAuth redirects is now **automatically detected** from the API Gateway request context. You don't need to set an `API_URL` environment variable - it's computed at runtime from the Lambda event.

This means:
- ✅ No manual configuration needed after deployment
- ✅ Works automatically in all environments (dev/staging/prod)
- ✅ Falls back to localhost for local development

## Post-Deployment Verification

- [ ] **Test API Endpoint**
  ```bash
  curl https://{api-id}.execute-api.{region}.amazonaws.com/{stage}/auth/google
  # Should return a JSON response with auth_url
  ```

- [ ] **Check CloudFormation Stack**
  ```bash
  aws cloudformation describe-stacks --stack-name meaningful-backend
  ```

- [ ] **View Logs**
  ```bash
  sam logs -n AuthFunction --stack-name meaningful-backend --tail
  ```

- [ ] **Test OAuth Flow**
  1. Visit your frontend
  2. Click "Sign in with Google"
  3. Complete OAuth flow
  4. Verify user is created in DynamoDB

- [ ] **Verify DynamoDB Tables**
  ```bash
  aws dynamodb list-tables --region us-east-1
  # Should see: meaningful-{stage}-users, meaningful-{stage}-calendars, etc.
  ```

## Environment-Specific Deployments

### Recommended Strategy: Staging for Customer-Facing Demos

**For showing to your boss/customers before full production:**
- Use **staging** as your "demo" environment
- It's customer-facing but separate from production
- Easy to iterate and fix issues without affecting production
- Can promote to production later when ready

### Development (Local Testing)
```bash
# Local development only - uses localhost
make dev  # Runs both frontend and backend locally
```

### Staging (Customer-Facing Demo)

**Backend:**
```bash
cd backend
sam deploy --guided
# When prompted:
# - Stack Name: meaningful-backend-staging
# - Parameter Stage: staging
# - Parameter FrontendUrl: https://staging.yourdomain.com (or your demo URL)
# - Parameter GoogleClientId: (your Google OAuth client ID)
# - Parameter GoogleClientSecret: (your Google OAuth client secret)
```

Or with saved config:
```bash
sam deploy \
  --stack-name meaningful-backend-staging \
  --parameter-overrides \
    Stage=staging \
    FrontendUrl=https://staging.yourdomain.com \
    GoogleClientId=your_client_id \
    GoogleClientSecret=your_client_secret
```

**Frontend (AWS S3):**
```bash
# Get API URL from backend deployment
API_URL=$(aws cloudformation describe-stacks \
  --stack-name meaningful-backend-staging \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text)

# Deploy to S3 (automated script)
./scripts/deploy-frontend-s3.sh staging "$API_URL"
```

Or manually:
```bash
cd frontend
export VITE_API_URL=$API_URL
pnpm build
aws s3 sync dist/ s3://meaningful-frontend-staging --delete
```

### Production (When Ready)

**Backend:**
```bash
sam deploy \
  --stack-name meaningful-backend-prod \
  --parameter-overrides \
    Stage=prod \
    FrontendUrl=https://yourdomain.com \
    GoogleClientId=your_client_id \
    GoogleClientSecret=your_client_secret
```

**Frontend (AWS S3):**
```bash
# Get API URL from backend deployment
API_URL=$(aws cloudformation describe-stacks \
  --stack-name meaningful-backend-prod \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text)

# Deploy to S3
./scripts/deploy-frontend-s3.sh prod "$API_URL"
```

**Note**: Each stage creates separate:
- DynamoDB tables (`meaningful-staging-users` vs `meaningful-prod-users`)
- Lambda functions (isolated)
- API Gateway endpoints (different URLs)
- IAM roles (isolated permissions)
- Frontend deployments (separate URLs/environments)

## Common Issues

### Issue: "No refresh token received"
- **Cause**: OAuth app is in "Testing" mode and user is not a test user
- **Solution**: 
  1. Add user as test user in OAuth consent screen, OR
  2. Publish the OAuth app (requires verification for sensitive scopes)

### Issue: "Redirect URI mismatch"
- **Cause**: Redirect URI in Google Console doesn't match deployed API endpoint
- **Solution**: Update Google OAuth redirect URI with exact production URL

### Issue: "Access denied" or CORS errors
- **Cause**: Frontend URL not configured correctly
- **Solution**: Verify `FrontendUrl` parameter matches your actual frontend URL

### Issue: "Insufficient permissions"
- **Cause**: AWS credentials don't have required permissions
- **Solution**: Ensure IAM user/role has CloudFormation, Lambda, API Gateway, DynamoDB permissions

## Terraform Alternative

You mentioned Terraform for Google sign-in setup. While you can't directly manage Google OAuth credentials in Terraform (they're created in Google Cloud Console), you could:

1. **Use Terraform for AWS infrastructure** instead of SAM
   - Migrate `template.yaml` to Terraform
   - Manage DynamoDB, Lambda, API Gateway with Terraform
   - Store secrets in AWS Secrets Manager or Parameter Store

2. **Use Terraform for Google Cloud resources** (if you want to manage Google side)
   - Create OAuth credentials via Terraform (though this is less common)
   - Manage Google Cloud project and APIs

However, **SAM is already handling your AWS infrastructure well**, and Google OAuth setup is a one-time manual step that doesn't need automation. The current SAM approach is simpler and more standard for serverless apps.

## Cost Estimation

- **Lambda**: Free tier includes 1M requests/month
- **API Gateway**: Free tier includes 1M requests/month
- **DynamoDB**: Free tier includes 25GB storage and 25 RCU/WCU
- **Total**: Should be **free or very low cost** for development/testing

## Next Steps After Deployment

1. Set up custom domain for API Gateway (optional)
2. Configure CloudWatch alarms for monitoring
3. Set up CI/CD pipeline (GitHub Actions, etc.)
4. Configure frontend deployment (Vercel, Netlify, etc.)
5. Set up environment-specific configurations (dev/staging/prod)

