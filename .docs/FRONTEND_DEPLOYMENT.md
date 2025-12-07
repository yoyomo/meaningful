# Frontend Deployment Guide

This guide covers deploying the Meaningful frontend to various hosting platforms.

## Quick Start

### 1. Build Frontend

```bash
cd frontend

# Set API URL (get from backend deployment)
export VITE_API_URL=https://{api-id}.execute-api.{region}.amazonaws.com/{stage}

# Build for production
pnpm build
```

This creates a `dist/` directory with static files ready to deploy.

### 2. Deploy to Hosting Service

Choose one of the options below.

## Deployment Options

### Option 1: Vercel (Recommended - Easiest)

**Why Vercel:**
- ✅ Zero configuration
- ✅ Automatic HTTPS
- ✅ Free tier is generous
- ✅ Great for React/Vite apps
- ✅ Environment variables in dashboard
- ✅ Automatic deployments from Git

**Steps:**

1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Deploy:**
   ```bash
   cd frontend
   vercel
   ```

3. **Set Environment Variable:**
   - During deployment, Vercel will prompt for environment variables
   - Or set in dashboard: Project → Settings → Environment Variables
   - Add: `VITE_API_URL` = `https://{api-id}.execute-api.{region}.amazonaws.com/{stage}`

4. **Redeploy after setting env var:**
   ```bash
   vercel --prod
   ```

**Continuous Deployment:**
- Connect your GitHub repo to Vercel
- Vercel automatically deploys on push to main
- Environment variables persist across deployments

### Option 2: Netlify

**Why Netlify:**
- ✅ Similar to Vercel
- ✅ Free tier available
- ✅ Easy static site hosting
- ✅ Environment variables support

**Steps:**

1. **Install Netlify CLI:**
   ```bash
   npm i -g netlify-cli
   ```

2. **Deploy:**
   ```bash
   cd frontend
   netlify deploy --prod
   ```

3. **Set Environment Variable:**
   - In Netlify dashboard: Site settings → Environment variables
   - Add: `VITE_API_URL` = `https://{api-id}.execute-api.{region}.amazonaws.com/{stage}`

4. **Redeploy:**
   ```bash
   netlify deploy --prod
   ```

**Build Settings (if using Git integration):**
- Build command: `pnpm build`
- Publish directory: `dist`
- Environment variables: Set in dashboard

### Option 3: AWS S3 + CloudFront (Recommended for AWS-only setup)

**Why AWS S3:**
- ✅ Same AWS account as backend (consistent tooling)
- ✅ Simple static hosting
- ✅ Very cheap (essentially free for low traffic)
- ✅ Can add CloudFront later for HTTPS/custom domain
- ✅ No new tools to learn

**Quick Deploy (Automated Script):**

We have a deployment script that handles everything:

```bash
# Get your API URL from backend deployment
API_URL=$(aws cloudformation describe-stacks \
  --stack-name meaningful-backend-staging \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text)

# Deploy frontend
./scripts/deploy-frontend-s3.sh staging "$API_URL"
```

That's it! The script will:
1. Create S3 bucket if it doesn't exist
2. Configure static website hosting
3. Set up public read access
4. Build frontend with API URL
5. Upload to S3

**Manual Steps (if you prefer):**

1. **Create S3 Bucket:**
   ```bash
   aws s3 mb s3://meaningful-frontend-staging --region us-east-1
   ```

2. **Enable Static Website Hosting:**
   ```bash
   aws s3 website s3://meaningful-frontend-staging \
     --index-document index.html \
     --error-document index.html
   ```

3. **Set Bucket Policy (Public Read):**
   ```bash
   cat > bucket-policy.json << 'EOF'
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "PublicReadGetObject",
         "Effect": "Allow",
         "Principal": "*",
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::meaningful-frontend-staging/*"
       }
     ]
   }
   EOF
   
   aws s3api put-bucket-policy \
     --bucket meaningful-frontend-staging \
     --policy file://bucket-policy.json
   ```

4. **Build with Environment Variable:**
   ```bash
   cd frontend
   export VITE_API_URL=https://{api-id}.execute-api.{region}.amazonaws.com/{stage}
   pnpm build
   ```

5. **Upload to S3:**
   ```bash
   aws s3 sync dist/ s3://meaningful-frontend-staging --delete
   ```

6. **Get Website URL:**
   ```bash
   # Your frontend will be available at:
   http://meaningful-frontend-staging.s3-website-us-east-1.amazonaws.com
   ```

**Adding CloudFront Later (for HTTPS):**

When you're ready for HTTPS and custom domain:

1. **Request SSL Certificate:**
   ```bash
   # In AWS Certificate Manager (ACM)
   # Request certificate for your domain (e.g., staging.meaningful.app)
   # Must be in us-east-1 region for CloudFront
   ```

2. **Create CloudFront Distribution:**
   - Origin: S3 bucket website endpoint (not the bucket itself)
   - Origin domain: `meaningful-frontend-staging.s3-website-us-east-1.amazonaws.com`
   - Default root object: `index.html`
   - SSL certificate: Select your ACM certificate
   - Custom domain: Add your domain (e.g., `staging.meaningful.app`)

3. **Configure DNS:**
   - Point your domain to CloudFront distribution
   - CloudFront will provide a CNAME target

4. **Update Backend CORS:**
   - Update `FrontendUrl` parameter in backend to use HTTPS URL
   - Redeploy backend

**Note:** S3 website endpoints are HTTP only. For HTTPS, you need CloudFront (or use S3 bucket directly with CloudFront, but website endpoint is simpler for SPAs).

### Option 4: GitHub Pages

**Why GitHub Pages:**
- ✅ Free for public repos
- ✅ Simple setup
- ⚠️ No environment variables (need to build before commit)

**Steps:**

1. **Build with API URL:**
   ```bash
   cd frontend
   export VITE_API_URL=https://{api-id}.execute-api.{region}.amazonaws.com/{stage}
   pnpm build
   ```

2. **Deploy `dist/` to GitHub Pages:**
   - Use GitHub Actions or manual upload
   - Or use `gh-pages` package

3. **Configure in GitHub:**
   - Settings → Pages
   - Source: `gh-pages` branch or `dist/` folder

## Environment Variables

### Required Variables

- `VITE_API_URL`: Your backend API endpoint
  - Example: `https://abc123.execute-api.us-east-1.amazonaws.com/staging`

### How Vite Environment Variables Work

- Variables must start with `VITE_` to be exposed to the frontend
- Set during build time (not runtime)
- Embedded in the built JavaScript bundle
- **Important**: If you change the API URL, you must rebuild and redeploy

### Setting Environment Variables

**Option 1: `.env.production` file (Local Build)**
```bash
# frontend/.env.production
VITE_API_URL=https://abc123.execute-api.us-east-1.amazonaws.com/staging
```

**Option 2: Hosting Platform Dashboard**
- Vercel: Project → Settings → Environment Variables
- Netlify: Site settings → Environment variables
- AWS: Set in build script or use Parameter Store

**Option 3: Build Command**
```bash
VITE_API_URL=https://... pnpm build
```

## Getting Your Backend API URL

After deploying the backend, get the API URL:

```bash
# Using AWS CLI
aws cloudformation describe-stacks \
  --stack-name meaningful-backend-staging \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text

# Or check SAM deploy output
# Look for: ApiUrl: https://...
```

## Updating Frontend After Backend Changes

If you redeploy the backend and the API URL changes:

1. **Get new API URL** (see above)

2. **Update environment variable** in your hosting platform

3. **Redeploy frontend:**
   - Vercel: Automatically redeploys if connected to Git, or run `vercel --prod`
   - Netlify: Run `netlify deploy --prod` or trigger via Git
   - AWS S3: Rebuild and sync again

## Custom Domain Setup

### Vercel
1. Add domain in Vercel dashboard: Project → Settings → Domains
2. Follow DNS configuration instructions
3. SSL certificate is automatic

### Netlify
1. Add domain in Netlify dashboard: Site settings → Domain management
2. Configure DNS as instructed
3. SSL certificate is automatic

### AWS CloudFront
1. Request SSL certificate in AWS Certificate Manager
2. Add certificate to CloudFront distribution
3. Configure DNS to point to CloudFront

## Troubleshooting

### Issue: "API_URL is undefined"
- **Cause**: Environment variable not set during build
- **Solution**: Rebuild with `VITE_API_URL` set, or set in hosting platform

### Issue: CORS errors
- **Cause**: Frontend URL not in backend CORS allowlist
- **Solution**: Update `FrontendUrl` parameter in backend deployment

### Issue: OAuth redirect fails
- **Cause**: Frontend URL doesn't match Google OAuth redirect URI
- **Solution**: Update Google OAuth redirect URI in Google Cloud Console

### Issue: Build fails
- **Cause**: Missing dependencies or TypeScript errors
- **Solution**: Run `pnpm install` and check for lint errors

## Best Practices

1. **Never commit `.env.production`** - Use hosting platform environment variables
2. **Use different environments** - Staging and production should have separate frontend deployments
3. **Set up CI/CD** - Automate deployments from Git
4. **Monitor builds** - Check build logs for errors
5. **Test after deployment** - Verify API connection works

## Quick Reference

```bash
# Build locally
cd frontend
export VITE_API_URL=https://your-api-url
pnpm build

# Deploy to Vercel
vercel --prod

# Deploy to Netlify
netlify deploy --prod

# Deploy to AWS S3
aws s3 sync dist/ s3://your-bucket-name --delete
```

