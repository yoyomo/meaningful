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
# Build the application
sam build

# Start API locally
sam local start-api

# Test a specific function locally
sam local invoke AuthFunction --event events/auth-event.json
```

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