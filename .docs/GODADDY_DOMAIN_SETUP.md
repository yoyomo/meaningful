# Setting Up GoDaddy Domain with AWS S3

## Quick Overview

Setting up your GoDaddy domain with S3 is actually pretty simple. You have two options:

1. **S3 Website Endpoint** (HTTP only, simpler)
2. **CloudFront** (HTTPS, recommended for production)

## Option 1: S3 Website Endpoint (HTTP only)

**Steps:**

1. **Deploy frontend to S3** (you'll get a URL like):
   ```
   http://meaningful-frontend-staging.s3-website-us-east-1.amazonaws.com
   ```

2. **In GoDaddy DNS Settings:**
   - Go to GoDaddy → My Products → DNS
   - Add a CNAME record:
     - **Name**: `staging` (or `www`, or leave blank for root domain)
     - **Value**: `meaningful-frontend-staging.s3-website-us-east-1.amazonaws.com`
     - **TTL**: 600 (or default)

3. **Wait for DNS propagation** (5-30 minutes)

4. **Update backend `FrontendUrl` parameter:**
   ```bash
   sam deploy \
     --parameter-overrides \
       FrontendUrl=http://staging.yourdomain.com \
       # ... other parameters
   ```

**Note:** This is HTTP only. For HTTPS, use CloudFront (Option 2).

## Option 2: CloudFront (HTTPS - Recommended)

**Steps:**

1. **Request SSL Certificate in AWS:**
   ```bash
   # In AWS Certificate Manager (ACM)
   # Must be in us-east-1 region for CloudFront
   # Request certificate for: staging.yourdomain.com (or *.yourdomain.com for wildcard)
   ```

2. **Create CloudFront Distribution:**
   - Origin: S3 website endpoint (not the bucket itself!)
   - Origin domain: `meaningful-frontend-staging.s3-website-us-east-1.amazonaws.com`
   - Default root object: `index.html`
   - SSL certificate: Select your ACM certificate
   - Custom domain: `staging.yourdomain.com`
   - Viewer protocol policy: Redirect HTTP to HTTPS

3. **In GoDaddy DNS Settings:**
   - Add a CNAME record:
     - **Name**: `staging`
     - **Value**: CloudFront distribution domain (e.g., `d1234567890.cloudfront.net`)
     - **TTL**: 600

4. **Wait for DNS propagation** (5-30 minutes)

5. **Update backend `FrontendUrl` parameter:**
   ```bash
   sam deploy \
     --parameter-overrides \
       FrontendUrl=https://staging.yourdomain.com \
       # ... other parameters
   ```

## Recommendation

**For staging/demo:**
- Start with S3 website URL (HTTP is fine for demos)
- Set up CloudFront + GoDaddy when you're ready for production

**For production:**
- Use CloudFront for HTTPS
- Set up GoDaddy domain properly

## Quick Start (S3 Website URL)

1. Deploy frontend to S3
2. Get S3 website URL: `http://meaningful-frontend-staging.s3-website-us-east-1.amazonaws.com`
3. Use this URL in backend `FrontendUrl` parameter
4. Set up GoDaddy domain later when ready

## Updating After DNS Setup

Once your GoDaddy domain is working:

1. **Update backend parameter:**
   ```bash
   sam deploy \
     --parameter-overrides \
       FrontendUrl=http://staging.yourdomain.com \
       # ... keep other parameters the same
   ```

2. **Update Google OAuth redirect URI** (if needed):
   - Add `http://staging.yourdomain.com` to authorized JavaScript origins
   - The callback still goes to backend API, so that doesn't change

