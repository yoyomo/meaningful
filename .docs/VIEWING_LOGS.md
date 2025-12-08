# Viewing AWS Logs for Meaningful App

## Quick Methods

### Method 1: SAM CLI (Easiest - Recommended)

**View logs for a specific function:**
```bash
cd backend
sam logs -n AuthFunction --stack-name meaningful-backend-staging --tail
```

**View logs for all functions:**
```bash
# Auth function
sam logs -n AuthFunction --stack-name meaningful-backend-staging --tail

# Calendar function
sam logs -n CalendarFunction --stack-name meaningful-backend-staging --tail

# Availability function
sam logs -n AvailabilityFunction --stack-name meaningful-backend-staging --tail

# Profile function
sam logs -n ProfileFunction --stack-name meaningful-backend-staging --tail

# Contacts function
sam logs -n ContactsFunction --stack-name meaningful-backend-staging --tail

# Friends function
sam logs -n FriendsFunction --stack-name meaningful-backend-staging --tail
```

**View logs without tailing (one-time):**
```bash
sam logs -n AuthFunction --stack-name meaningful-backend-staging
```

**View logs from last 10 minutes:**
```bash
sam logs -n AuthFunction --stack-name meaningful-backend-staging --tail --since 10m
```

### Method 2: AWS Console (CloudWatch)

1. **Go to CloudWatch Logs:**
   - https://console.aws.amazon.com/cloudwatch/home?region=eu-south-2#logsV2:log-groups
   - Or: AWS Console → CloudWatch → Logs → Log groups

2. **Find your log groups:**
   - Look for: `/aws/lambda/meaningful-backend-staging-AuthFunction-...`
   - Or search for: `meaningful-backend-staging`

3. **Your log groups will be named:**
   - `/aws/lambda/meaningful-backend-staging-AuthFunction-XXXXX`
   - `/aws/lambda/meaningful-backend-staging-CalendarFunction-XXXXX`
   - `/aws/lambda/meaningful-backend-staging-AvailabilityFunction-XXXXX`
   - `/aws/lambda/meaningful-backend-staging-ProfileFunction-XXXXX`
   - `/aws/lambda/meaningful-backend-staging-ContactsFunction-XXXXX`
   - `/aws/lambda/meaningful-backend-staging-FriendsFunction-XXXXX`

4. **Click on a log group** → Click on a log stream → View logs

### Method 3: AWS CLI

**List log groups:**
```bash
aws logs describe-log-groups \
  --log-group-name-prefix "/aws/lambda/meaningful-backend-staging" \
  --region eu-south-2
```

**View recent log events:**
```bash
# Get log group name first, then:
aws logs tail /aws/lambda/meaningful-backend-staging-AuthFunction-XXXXX \
  --follow \
  --region eu-south-2
```

## Your Lambda Functions

Based on your deployment, you have these functions:

1. **AuthFunction** - Handles OAuth (`/auth/google`, `/auth/callback`)
2. **CalendarFunction** - Calendar sync and events
3. **AvailabilityFunction** - User availability management
4. **ProfileFunction** - User profile management
5. **ContactsFunction** - Contact import and search
6. **FriendsFunction** - Friends management and matching

## Common Use Cases

### Debug OAuth Issues
```bash
sam logs -n AuthFunction --stack-name meaningful-backend-staging --tail
```

### Debug Calendar Sync
```bash
sam logs -n CalendarFunction --stack-name meaningful-backend-staging --tail
```

### Debug Friend Matching
```bash
sam logs -n FriendsFunction --stack-name meaningful-backend-staging --tail
```

### View All Recent Errors
In CloudWatch Console:
1. Go to Log groups
2. Filter by "ERROR" or search for error patterns
3. Or use Insights to query across all log groups

## CloudWatch Logs Insights (Advanced)

For complex queries across multiple functions:

1. Go to CloudWatch → Logs → Insights
2. Select log groups (all your Lambda functions)
3. Run queries like:
   ```
   fields @timestamp, @message
   | filter @message like /ERROR/
   | sort @timestamp desc
   | limit 100
   ```

## Stack Name Reference

- **Staging**: `meaningful-backend-staging`
- **Production**: `meaningful-backend-prod` (when deployed)

Replace `staging` with your actual stage name in commands.

