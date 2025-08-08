# Mobile OAuth Authentication Issues

## Current Status (January 2025)

### What's Working ✅
- OAuth URL generation via Supabase
- Browser redirection to Google OAuth
- Google authentication flow completes successfully
- User can sign in as `saleem@poppatjamals.com` in browser
- Web dashboard OAuth works perfectly

### What's Broken ❌
- OAuth session doesn't return to mobile app
- App session check shows: `hasSession: false, email: none`
- User remains on login screen after successful browser authentication
- No automatic session detection after OAuth completion

## Root Cause Analysis

### The Core Problem
**Google OAuth requires redirect URLs with proper domains** (`.com`, `.co`, etc.) and rejects custom URL schemes like `stockauditscanner://callback`. This creates a fundamental mobile OAuth challenge:

1. **App** → Opens browser with OAuth URL ✅
2. **Browser** → User signs in with Google ✅  
3. **Browser** → OAuth callback goes to `https://lgiljudekiobysjsuepo.supabase.co/auth/v1/callback` ✅
4. **❌ Missing Link** → No mechanism to return session to mobile app

### Technical Details
- Current redirect URL: `https://lgiljudekiobysjsuepo.supabase.co/auth/v1/callback`
- Session persistence: Stored in browser, not accessible to React Native app
- Direct Supabase check: `supabase.auth.getSession()` returns `null`
- Redux state: `session: null, user: null`

## What We've Tried

### 1. Native Google Sign-in Library ❌ Failed
**Library:** `@react-native-google-signin/google-signin`
**Issue:** Module resolution errors
```
Error: Unable to resolve module ./statics.js
```
**Why We Abandoned:** Persistent build failures, unreliable library dependencies

### 2. Supabase OAuth with Browser Redirect ⚠️ Partially Working
**Current Implementation:** Uses `supabase.auth.signInWithOAuth()`
**Success:** OAuth flow initiates and completes
**Failure:** Session doesn't return to app due to domain redirect requirements

### 3. Session Detection Debugging ✅ Diagnostic Complete
- Added comprehensive session checking
- Confirmed no session exists in mobile app after OAuth
- Browser and mobile app operate in separate contexts

## Available Solutions

### Option 1: Universal Links / App Links (Production Ready)
**Approach:** Use a real domain that redirects to the mobile app
- Configure Android App Links for your domain
- Update Google OAuth to use `https://yourapp.com/auth/callback`
- When URL is accessed, Android opens your app instead of browser
- **Pros:** Production-ready, follows OAuth 2.0 best practices, seamless UX
- **Cons:** Requires domain ownership, complex setup, App Links configuration

### Option 2: React Native App Auth Library (Industry Standard)
**Library:** `react-native-app-auth`
- Handles OAuth complexity using native iOS/Android flows
- Uses PKCE (Proof Key for Code Exchange) for security
- Manages redirect URLs properly for mobile
- **Pros:** Battle-tested, used by major apps, handles Google restrictions
- **Cons:** Another library dependency, requires OAuth client reconfiguration

### Option 3: Localhost Redirect (Development Solution)
**Approach:** Use localhost redirect URL for development
- Configure Google OAuth to use `http://localhost:8081/auth/callback`
- Run local server in React Native to catch redirect
- **Pros:** Simple for development, works with Google OAuth
- **Cons:** Development-only, requires local server management

### Option 4: Session Polling / Manual Trigger (Current Setup Compatible)
**Approach:** Enhanced detection of completed browser OAuth
- User completes OAuth in browser
- App provides "I signed in" button or periodic session checking
- App queries Supabase for session after user confirmation
- **Pros:** No redirect URL changes needed, works with current setup
- **Cons:** Poor UX, manual step required, not typical OAuth flow

### Option 5: In-App WebView (Simpler but Less Secure)
**Library:** `react-native-webview`
- Handle OAuth inside app using WebView component
- Intercept callback URLs within the WebView
- **Pros:** Keeps users in app, simpler than deep linking
- **Cons:** Less secure than system browser, against OAuth 2.0 best practices

## Recommended Path Forward

### Phase 1: Development Workaround (Immediate)
Implement **Option 4 (Session Polling)** as a temporary solution:
- Add "I completed sign-in" button after browser OAuth
- Implement automatic session checking when app regains focus
- Allow testing of post-authentication features

### Phase 2: Production Solution (Long-term)
Implement **Option 2 (React Native App Auth)** for production:
- Replace Supabase OAuth with `react-native-app-auth`
- Configure proper PKCE flow for mobile
- Maintain Supabase integration for user profile lookup

### Phase 3: Fallback Option
If App Auth fails, implement **Option 5 (WebView)** as fallback:
- Use in-app browser for OAuth flow
- Sacrifice some security for working authentication

## Implementation Priority

1. **High Priority:** Get authentication working for development/testing
2. **Medium Priority:** Implement production-ready OAuth flow  
3. **Low Priority:** Optimize UX and security

## Notes for Future Implementation

- Google OAuth client may need reconfiguration for mobile flows
- Test on both Android emulator and physical devices
- Consider OAuth provider alternatives if Google continues to be problematic
- Document any library version conflicts or build issues
- Maintain compatibility with existing web dashboard OAuth

## Related Files

- `mobile/src/screens/auth/LoginScreen.tsx` - Current OAuth implementation
- `mobile/src/store/slices/authSlice.ts` - Session management
- `mobile/src/components/AuthProvider.tsx` - Authentication context
- `mobile/android/app/src/main/AndroidManifest.xml` - Deep linking configuration
- `dashboard/src/app/auth/login/page.tsx` - Working web OAuth reference

## Debug Commands

```bash
# Check current session status
cd mobile && npx react-native run-android
# Then tap "Check Session Status" button in app
```

## Status: IN PROGRESS
**Last Updated:** January 2025  
**Current Blocker:** OAuth session return mechanism  
**Next Step:** Choose and implement solution from options above