# Meaningful Backend

This is the serverless backend for the Meaningful app, built with AWS Lambda, DynamoDB, and AWS SAM.

## Features
- Google OAuth authentication
- Google Calendar sync
- Serverless architecture with AWS Lambda
- DynamoDB for data storage
- AWS SAM for infrastructure as code

## Prerequisites

1. Install AWS SAM CLI:
```bash
# macOS
brew install aws-sam-cli

# Or download from: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html
```

2. Install AWS CLI and configure:
```bash
aws configure
```

3. Install Python dependencies:
```bash
pip install -r requirements.txt
```

## Development

### Local Development
```bash
# 1. Start DynamoDB Local (runs in its own terminal)
make db-local

# 2. Bootstrap tables defined in template.yaml (uses aws + yq)
make bootstrap-db

# 3. In a separate terminal build and start the API
sam build
sam local start-api --port 3001 --env-vars locals.json
```

> **Prerequisites:** The bootstrap step relies on the AWS CLI and [`yq`](https://mikefarah.gitbook.io/yq/).

You can also run `make dev-backend` if you prefer the one-liner experience—the Makefile will not start DynamoDB for you, so ensure step 1 above is running first.

### Deploy to AWS
```bash
# Deploy with guided prompts (first time)
sam deploy --guided

# Deploy with saved config
sam deploy
```

### Project Structure
- `template.yaml` - SAM template (CloudFormation)
- `samconfig.toml` - SAM configuration
- `src/handlers/` - Lambda function handlers
- `src/services/` - Business logic and external service integrations
- `requirements.txt` - Python dependencies

### Environment Variables

The following environment variables are automatically set by SAM:
- `USERS_TABLE` - DynamoDB users table name
- `CALENDARS_TABLE` - DynamoDB calendars table name
- `STAGE` - Deployment stage (dev, staging, prod)

### Useful Commands
```bash
# Validate template
sam validate

# Build and test locally
sam build && sam local start-api

# View logs
sam logs -n AuthFunction --stack-name meaningful-backend --tail

# Delete stack
sam delete
```

## TODO

- [ ] Implement Google OAuth flow
- [ ] Implement Google Calendar API integration
- [ ] Add JWT token management
- [ ] Add user management endpoints
- [ ] Add calendar event CRUD operations
- [ ] Add local testing events