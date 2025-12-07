# Google OAuth Verification - Fixing "Google hasn't verified this app"

## The Problem

You're seeing: **"Google hasn't verified this app"** warning when trying to sign in.

This happens because:
1. Your OAuth app is in **"Testing"** mode
2. The user trying to sign in is **not in the test users list**
3. Google requires verification for apps requesting sensitive scopes

## Quick Fix: Add Test Users (For Staging/Demo)

**This is the fastest solution for demos and testing.**

### Steps:

1. **Go to Google Cloud Console:**
   - https://console.cloud.google.com/
   - Select your project

2. **Navigate to OAuth Consent Screen:**
   - APIs & Services → OAuth consent screen

3. **Add Test Users:**
   - Scroll down to **"Test users"** section
   - Click **"+ ADD USERS"**
   - Add email addresses of people who need to test:
     - Your email
     - Your boss's email
     - Any other test users
   - Click **"ADD"**

4. **Save:**
   - Click **"SAVE AND CONTINUE"** at the bottom

5. **Test Again:**
   - Have test users try signing in again
   - They should now be able to proceed (may still see a warning, but can click "Continue")

## Alternative: Publish Your App (For Production)

**For production, you'll need to publish and verify your app.**

### Steps:

1. **Go to OAuth Consent Screen:**
   - APIs & Services → OAuth consent screen

2. **Complete Required Fields:**
   - App name: "Meaningful"
   - User support email: Your email
   - Developer contact email: Your email
   - App logo (optional but recommended)
   - App domain (optional)
   - Authorized domains: Add your domain (e.g., `yourdomain.com`)

3. **Add Scopes:**
   Make sure these scopes are listed:
   - `openid`
   - `https://www.googleapis.com/auth/userinfo.profile`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/user.phonenumbers.read`
   - `https://www.googleapis.com/auth/calendar.events`
   - `https://www.googleapis.com/auth/calendar.readonly`
   - `https://www.googleapis.com/auth/contacts.readonly`

4. **Submit for Verification:**
   - Click **"PUBLISH APP"** or **"SUBMIT FOR VERIFICATION"**
   - Fill out the verification form:
     - **App purpose**: Describe what your app does
     - **Scopes justification**: Explain why you need each scope
     - **Video demonstration**: Show how your app uses the permissions
     - **Privacy policy URL**: Required for sensitive scopes
     - **Terms of service URL**: May be required

5. **Wait for Review:**
   - Google reviews verification requests (can take days to weeks)
   - You'll get email updates on the status

## Sensitive Scopes That Require Verification

Your app uses these **sensitive scopes** that require verification:
- ✅ `calendar.events` - Write access to calendar
- ✅ `calendar.readonly` - Read calendar
- ✅ `contacts.readonly` - Read contacts
- ✅ `user.phonenumbers.read` - Read phone numbers

**Note:** Basic scopes (`openid`, `profile`, `email`) don't require verification.

## Recommendation for Your Situation

**For staging/demo with your boss:**

1. **Add test users** (fastest, works immediately)
   - Add your email and boss's email to test users
   - They can sign in right away
   - Still shows warning but allows access

2. **Start verification process** (for later)
   - Begin the verification process in parallel
   - It takes time, so start early
   - Once verified, no more warnings for anyone

## Quick Steps Summary

**Right now (to unblock):**
1. Go to: https://console.cloud.google.com/apis/credentials/consent
2. Scroll to "Test users"
3. Click "+ ADD USERS"
4. Add your email and boss's email
5. Save
6. Try signing in again

**For production (later):**
1. Complete OAuth consent screen
2. Submit for verification
3. Wait for Google's review
4. Once approved, app is public

## Troubleshooting

**"User is not a test user" error:**
- Make sure the email is exactly the same as their Google account
- Check for typos
- Wait a few minutes after adding (propagation delay)

**Still seeing warning after adding test users:**
- This is normal - test users still see warnings
- They can click "Continue" or "Advanced → Go to [App Name]"
- The app will work, just with a warning

**Need to add more test users:**
- You can add up to 100 test users
- Just go back to OAuth consent screen and add more

