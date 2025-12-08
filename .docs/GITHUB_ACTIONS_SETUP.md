# GitHub Actions Deployment Setup

This guide explains how to set up automated deployments via GitHub Actions.

## Overview

The workflow automatically deploys both backend and frontend when code is pushed to `main` branch.

## Required GitHub Secrets

You need to add these secrets to your GitHub repository:

1. **Go to:** Your repo → Settings → Secrets and variables → Actions → New repository secret

2. **Add these secrets:**

### AWS Credentials
- `AWS_ACCESS_KEY_ID` - Your AWS access key ID
- `AWS_SECRET_ACCESS_KEY` - Your AWS secret access key

### Google OAuth
- `GOOGLE_CLIENT_ID` - Your Google OAuth Client ID
- `GOOGLE_CLIENT_SECRET` - Your Google OAuth Client Secret

## How to Get AWS Credentials

1. **Create IAM User:**
   ```bash
   # In AWS Console → IAM → Users → Create user
   # Name: github-actions-deploy
   ```

2. **Attach Policies:**
   The user needs these permissions:
   - `AWSLambda_FullAccess`
   - `AmazonAPIGatewayAdministrator`
   - `AmazonDynamoDBFullAccess`
   - `AmazonS3FullAccess`
   - `IAMFullAccess` (for SAM to create roles)
   - `CloudFormationFullAccess`

   Or create a custom policy with these permissions.

3. **Create Access Key:**
   - Go to IAM → Users → Your user → Security credentials
   - Create access key
   - Copy Access Key ID and Secret Access Key
   - Add to GitHub Secrets

## Workflow Details

### What It Does

1. **Deploy Backend:**
   - Builds SAM application
   - Deploys to AWS Lambda/API Gateway
   - Gets API URL from CloudFormation outputs

2. **Deploy Frontend:**
   - Installs dependencies
   - Builds with API URL from backend
   - Sets up S3 bucket (if needed)
   - Uploads to S3

3. **Deployment Summary:**
   - Shows deployment status in GitHub Actions UI

### When It Runs

- **Automatic:** On every push to `main` branch
- **Manual:** Can be triggered manually from Actions tab

### Workflow File

Located at: `.github/workflows/deploy.yml`

## Customization

### Change Stage/Environment

Edit `.github/workflows/deploy.yml`:

```yaml
env:
  STAGE: staging  # Change to 'prod' for production
  STACK_NAME: meaningful-backend-staging
  FRONTEND_BUCKET: meaningful-frontend-staging
```

### Deploy to Production

Create a separate workflow file (e.g., `.github/workflows/deploy-prod.yml`) or add a condition:

```yaml
on:
  push:
    branches:
      - main
      - production  # Add production branch
```

Then use different secrets or environment variables for production.

### Different Regions

If your S3 bucket is in a different region, update:

```yaml
- name: Configure AWS credentials
  uses: aws-actions/configure-aws-credentials@v4
  with:
    aws-region: us-east-1 # Change to your S3 bucket region
```

## Testing the Workflow

1. **Push to main branch:**
   ```bash
   git push origin main
   ```

2. **Check Actions tab:**
   - Go to your repo → Actions tab
   - Watch the workflow run
   - Check for any errors

3. **Verify deployment:**
   - Check CloudFormation stack in AWS Console
   - Check S3 bucket for frontend files
   - Test the deployed app

## Troubleshooting

### "Access Denied" Errors

- Check IAM user has correct permissions
- Verify AWS credentials in GitHub Secrets
- Check region matches your resources

### "Stack not found" Errors

- Make sure stack name matches your deployment
- Check region is correct

### Frontend Build Fails

- Check Node.js version compatibility
- Verify pnpm lockfile is committed
- Check for TypeScript errors

### API URL Not Found

- Backend deployment must complete first
- Check CloudFormation outputs exist
- Verify stack name is correct

## Security Best Practices

1. **Never commit secrets** - Always use GitHub Secrets
2. **Use least privilege** - IAM user should only have needed permissions
3. **Rotate credentials** - Regularly rotate AWS access keys
4. **Review deployments** - Check Actions logs regularly
5. **Use separate credentials** - Different AWS users for staging/prod

## Manual Deployment

If you need to deploy manually (without GitHub Actions):

```bash
# Backend
cd backend
sam deploy

# Frontend
API_URL=$(aws cloudformation describe-stacks \
  --stack-name meaningful-backend-staging \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text)
.docs/scripts/deploy-frontend-s3.sh staging "$API_URL"
```

