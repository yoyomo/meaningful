# Fix Frontend Redirect Issue

## Problem

After signing in, the app redirects to `localhost:3000` instead of your staging frontend URL.

## Cause

The backend `FrontendUrl` parameter is set to `localhost:3000` instead of your S3 website URL.

## Solution

Update the backend `FrontendUrl` parameter to your S3 website URL.

### Step 1: Get Your S3 Website URL

Your frontend URL should be:
```
http://meaningful-frontend-staging.s3-website-us-east-1.amazonaws.com
```

(Or check what the deployment script outputted)

### Step 2: Update Backend Parameter

```bash
cd backend

sam deploy \
  --parameter-overrides \
    FrontendUrl=http://meaningful-frontend-staging.s3-website-us-east-1.amazonaws.com \
    Stage=staging \
    GoogleClientId=your_client_id \
    GoogleClientSecret=your_client_secret
```

**Or if you have samconfig.toml configured, edit it:**

```toml
[default.deploy.parameters]
parameter_overrides = [
  "Stage=staging",
  "FrontendUrl=http://meaningful-frontend-staging.s3-website-us-east-1.amazonaws.com",
  "GoogleClientId=your_client_id",
  "GoogleClientSecret=your_client_secret"
]
```

Then just run:
```bash
sam deploy
```

### Step 3: Verify

After deployment, try signing in again. It should redirect to your S3 website URL instead of localhost.

## Quick Command

```bash
cd backend && sam deploy --parameter-overrides FrontendUrl=http://meaningful-frontend-staging.s3-website-us-east-1.amazonaws.com Stage=staging GoogleClientId=$(aws cloudformation describe-stacks --stack-name meaningful-backend-staging --query 'Stacks[0].Parameters[?ParameterKey==`GoogleClientId`].ParameterValue' --output text --region eu-south-2) GoogleClientSecret=$(aws cloudformation describe-stacks --stack-name meaningful-backend-staging --query 'Stacks[0].Parameters[?ParameterKey==`GoogleClientSecret`].ParameterValue' --output text --region eu-south-2)
```

(Note: This gets existing values from the stack, but you'll need to provide the secret manually since it's marked as NoEcho)

