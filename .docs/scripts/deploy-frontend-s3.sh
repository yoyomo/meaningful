#!/bin/bash
# Deploy frontend to AWS S3
# Usage: ./scripts/deploy-frontend-s3.sh [stage] [api-url]

set -e

STAGE=${1:-staging}
API_URL=${2:-""}
BUCKET_NAME="meaningful-frontend-${STAGE}"

echo "🚀 Deploying frontend to S3 (stage: ${STAGE})"
echo ""

# Check if API_URL is provided
if [ -z "$API_URL" ]; then
  echo "❌ API URL is required"
  echo "Usage: $0 [stage] [api-url]"
  echo ""
  echo "Example:"
  echo "  $0 staging https://abc123.execute-api.us-east-1.amazonaws.com/staging"
  echo ""
  echo "Or get API URL from CloudFormation:"
  echo "  aws cloudformation describe-stacks \\"
  echo "    --stack-name meaningful-backend-${STAGE} \\"
  echo "    --query 'Stacks[0].Outputs[?OutputKey==\`ApiUrl\`].OutputValue' \\"
  echo "    --output text"
  exit 1
fi

# Check if bucket exists, create if not
echo "📦 Checking S3 bucket..."
if ! aws s3 ls "s3://${BUCKET_NAME}" 2>&1 | grep -q 'NoSuchBucket'; then
  echo "✅ Bucket ${BUCKET_NAME} already exists"
  # Ensure Block Public Access is disabled (required for static website hosting)
  echo "🔓 Ensuring Block Public Access is disabled..."
  aws s3api put-public-access-block \
    --bucket "${BUCKET_NAME}" \
    --public-access-block-configuration \
      "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false" || true
  
  # Ensure static website hosting is enabled
  echo "🌐 Ensuring static website hosting is enabled..."
  aws s3 website "s3://${BUCKET_NAME}" \
    --index-document index.html \
    --error-document index.html || true
else
  echo "📦 Creating bucket ${BUCKET_NAME}..."
  aws s3 mb "s3://${BUCKET_NAME}" --region us-east-1
  
  # Disable Block Public Access (required for static website hosting)
  echo "🔓 Disabling Block Public Access (required for static website)..."
  aws s3api put-public-access-block \
    --bucket "${BUCKET_NAME}" \
    --public-access-block-configuration \
      "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false" || true
  
  # Enable static website hosting
  echo "🌐 Enabling static website hosting..."
  aws s3 website "s3://${BUCKET_NAME}" \
    --index-document index.html \
    --error-document index.html
fi

# Always set bucket policy for public read (required for website access)
echo "🔓 Setting bucket policy for public read access..."
cat > /tmp/bucket-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::${BUCKET_NAME}/*"
    }
  ]
}
EOF

aws s3api put-bucket-policy \
  --bucket "${BUCKET_NAME}" \
  --policy file:///tmp/bucket-policy.json

rm /tmp/bucket-policy.json

if aws s3 ls "s3://${BUCKET_NAME}" 2>&1 | grep -q 'NoSuchBucket'; then
  echo "✅ Bucket created and configured"
else
  echo "✅ Bucket configuration updated"
fi

# Build frontend
echo ""
echo "🔨 Building frontend..."
cd frontend

# Create .env.production.local (gitignored, for local builds)
echo "VITE_API_URL=${API_URL}" > .env.production.local
echo "✅ Created .env.production.local with API_URL=${API_URL}"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  pnpm install
fi

# Build
echo "🔨 Building production bundle..."
pnpm build

if [ ! -d "dist" ]; then
  echo "❌ Build failed - dist/ directory not found"
  exit 1
fi

echo "✅ Build complete"

# Upload to S3
echo ""
echo "📤 Uploading to S3..."
aws s3 sync dist/ "s3://${BUCKET_NAME}" --delete

# Get website URL
WEBSITE_URL=$(aws s3api get-bucket-website --bucket "${BUCKET_NAME}" --query 'WebsiteConfiguration.RedirectAllRequestsTo.HostName' --output text 2>/dev/null || echo "")
if [ -z "$WEBSITE_URL" ]; then
  WEBSITE_URL="http://${BUCKET_NAME}.s3-website-us-east-1.amazonaws.com"
fi

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📍 Frontend URL: ${WEBSITE_URL}"
echo ""
echo "⚠️  Note: This is HTTP only. For HTTPS and custom domain, set up CloudFront."
echo ""
echo "📝 Next steps:"
echo "  1. Test the frontend: ${WEBSITE_URL}"
echo "  2. Set up CloudFront for HTTPS (optional):"
echo "     See: .docs/FRONTEND_DEPLOYMENT.md (CloudFront section)"
echo "  3. Configure custom domain (optional)"

