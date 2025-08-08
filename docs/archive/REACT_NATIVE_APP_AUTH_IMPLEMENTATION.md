# React Native App Auth Implementation Guide

**Alternative OAuth Solution Using react-native-app-auth**  
**Date:** January 2025  
**Complexity:** High (4-6 hours implementation)  
**Status:** Alternative to Firebase Auth approach

## 🎯 Overview

React Native App Auth provides a proper OAuth 2.0 implementation using native iOS/Android OAuth flows with PKCE (Proof Key for Code Exchange) security. This approach follows OAuth 2.0 best practices but requires more complex setup.

## ⚠️ Important Considerations

### Pros
- ✅ Follows OAuth 2.0 standards properly
- ✅ Uses PKCE for enhanced security
- ✅ Native platform OAuth (no WebView)
- ✅ Supports multiple OAuth providers
- ✅ Battle-tested by major apps

### Cons
- ❌ Complex Universal Links/App Links setup required
- ❌ Still has mobile redirect URL challenges
- ❌ Requires backend redirect page setup
- ❌ Platform-specific configuration complexity
- ❌ Google/Apple moving away from custom schemes

### Why We Don't Recommend This (2024)
Based on research, even `react-native-app-auth` faces the fundamental mobile OAuth redirect problems that major platforms are solving by deprecating traditional OAuth flows in favor of native sign-in SDKs.

## 📋 Implementation Plan (If You Choose This Route)

### Phase 1: Installation & Setup (1 hour)

#### 1.1 Install Dependencies
```bash
cd mobile
npm install react-native-app-auth
# For iOS
cd ios && pod install && cd ..
```

#### 1.2 Android Configuration
**Add to `android/app/build.gradle`:**
```gradle
android {
  ...
  defaultConfig {
    ...
    manifestPlaceholders = [
      appAuthRedirectScheme: 'com.stockauditscanner'
    ]
  }
}
```

**Add to `android/app/src/main/AndroidManifest.xml`:**
```xml
<activity
    android:name="net.openid.appauth.RedirectUriReceiverActivity"
    android:exported="true">
    <intent-filter>
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data android:scheme="com.stockauditscanner" />
    </intent-filter>
</activity>
```

#### 1.3 iOS Configuration
**Add to `ios/StockAuditScanner/Info.plist`:**
```xml
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLName</key>
        <string>com.stockauditscanner</string>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>com.stockauditscanner</string>
        </array>
    </dict>
</array>
```

### Phase 2: OAuth Provider Configuration (1.5 hours)

#### 2.1 Google OAuth Setup
**In Google Cloud Console:**
1. Create OAuth 2.0 client IDs for:
   - Android: `com.stockauditscanner://oauth/callback`
   - iOS: `com.stockauditscanner://oauth/callback`
   - Web: `https://yourapp.com/auth/callback` (for fallback)

#### 2.2 Configure OAuth Config
```javascript
// mobile/src/config/authConfig.js
export const authConfig = {
  issuer: 'https://accounts.google.com',
  clientId: 'YOUR_GOOGLE_CLIENT_ID', // Different for iOS/Android
  redirectUrl: 'com.stockauditscanner://oauth/callback',
  additionalParameters: {},
  scopes: ['openid', 'profile', 'email'],
  
  // PKCE configuration
  responseType: 'code',
  codeChallenge: true,
  codeChallengeMethod: 'S256',
  
  // Custom headers
  customHeaders: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
};
```

### Phase 3: Implementation (2 hours)

#### 3.1 Create Auth Service
```javascript
// mobile/src/services/appAuthService.js
import { authorize, refresh, revoke } from 'react-native-app-auth';
import { authConfig } from '../config/authConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

class AppAuthService {
  async signIn() {
    try {
      console.log('🔐 APP_AUTH: Starting OAuth flow');
      
      const result = await authorize(authConfig);
      
      console.log('🔐 APP_AUTH: OAuth successful:', {
        accessToken: !!result.accessToken,
        idToken: !!result.idToken,
        refreshToken: !!result.refreshToken
      });
      
      // Store tokens securely
      await AsyncStorage.multiSet([
        ['access_token', result.accessToken],
        ['id_token', result.idToken],
        ['refresh_token', result.refreshToken],
        ['token_expiry', result.accessTokenExpirationDate]
      ]);
      
      return result;
    } catch (error) {
      console.error('🔐 APP_AUTH: OAuth error:', error);
      throw error;
    }
  }

  async refreshToken() {
    try {
      const refreshToken = await AsyncStorage.getItem('refresh_token');
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const result = await refresh(authConfig, {
        refreshToken: refreshToken
      });

      // Update stored tokens
      await AsyncStorage.multiSet([
        ['access_token', result.accessToken],
        ['id_token', result.idToken || ''],
        ['token_expiry', result.accessTokenExpirationDate]
      ]);

      return result;
    } catch (error) {
      console.error('🔐 APP_AUTH: Token refresh error:', error);
      throw error;
    }
  }

  async signOut() {
    try {
      const accessToken = await AsyncStorage.getItem('access_token');
      if (accessToken) {
        await revoke(authConfig, {
          tokenToRevoke: accessToken,
          sendClientId: true
        });
      }
      
      // Clear stored tokens
      await AsyncStorage.multiRemove([
        'access_token',
        'id_token', 
        'refresh_token',
        'token_expiry'
      ]);
      
    } catch (error) {
      console.error('🔐 APP_AUTH: Sign out error:', error);
      // Clear tokens even if revoke fails
      await AsyncStorage.multiRemove([
        'access_token',
        'id_token',
        'refresh_token', 
        'token_expiry'
      ]);
    }
  }

  async getValidToken() {
    try {
      const [accessToken, expiryDate] = await AsyncStorage.multiGet([
        'access_token',
        'token_expiry'
      ]);

      if (!accessToken[1] || !expiryDate[1]) {
        return null;
      }

      // Check if token is expired
      if (new Date(expiryDate[1]) <= new Date()) {
        console.log('🔐 APP_AUTH: Token expired, refreshing...');
        const refreshResult = await this.refreshToken();
        return refreshResult.accessToken;
      }

      return accessToken[1];
    } catch (error) {
      console.error('🔐 APP_AUTH: Get valid token error:', error);
      return null;
    }
  }
}

export const appAuthService = new AppAuthService();
```

#### 3.2 Integrate with Supabase
```javascript
// mobile/src/services/supabase.js
import { createClient } from '@supabase/supabase-js';
import { appAuthService } from './appAuthService';

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        apikey: process.env.SUPABASE_ANON_KEY,
      },
    },
    accessToken: async () => {
      // Get OAuth token from App Auth
      const token = await appAuthService.getValidToken();
      return token;
    }
  }
);

// Helper to sign in with OAuth token
export const signInWithOAuthToken = async () => {
  try {
    const idToken = await AsyncStorage.getItem('id_token');
    if (!idToken) {
      throw new Error('No ID token available');
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Supabase OAuth sign-in error:', error);
    throw error;
  }
};
```

#### 3.3 Update Redux Auth Slice
```javascript
// mobile/src/store/slices/authSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { appAuthService } from '../../services/appAuthService';
import { signInWithOAuthToken } from '../../services/supabase';

export const signInWithOAuth = createAsyncThunk(
  'auth/signInWithOAuth',
  async (_, { rejectWithValue }) => {
    try {
      // Step 1: OAuth with Google
      const oauthResult = await appAuthService.signIn();
      
      // Step 2: Sign in to Supabase with ID token
      const supabaseResult = await signInWithOAuthToken();
      
      return {
        oauthTokens: oauthResult,
        supabaseSession: supabaseResult.session,
        user: supabaseResult.user
      };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const signOut = createAsyncThunk(
  'auth/signOut', 
  async (_, { rejectWithValue }) => {
    try {
      await Promise.all([
        appAuthService.signOut(),
        supabase.auth.signOut()
      ]);
      return { success: true };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    tokens: null
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(signInWithOAuth.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(signInWithOAuth.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.tokens = action.payload.oauthTokens;
        state.isAuthenticated = true;
      })
      .addCase(signInWithOAuth.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
        state.isAuthenticated = false;
      })
      .addCase(signOut.fulfilled, (state) => {
        state.user = null;
        state.tokens = null;
        state.isAuthenticated = false;
        state.isLoading = false;
        state.error = null;
      });
  }
});

export const { clearError } = authSlice.actions;
export default authSlice.reducer;
```

#### 3.4 Update Login Screen
```javascript
// mobile/src/screens/auth/LoginScreen.tsx
import React, { useState } from 'react';
import { View, Alert } from 'react-native';
import { Button } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { signInWithOAuth } from '../../store/slices/authSlice';

const LoginScreen = () => {
  const dispatch = useDispatch();
  const { isLoading, error } = useSelector(state => state.auth);

  const handleOAuthSignIn = async () => {
    try {
      await dispatch(signInWithOAuth()).unwrap();
      // User will be redirected by navigation state change
    } catch (error) {
      Alert.alert(
        'Authentication Error',
        error.message || 'Failed to sign in with Google',
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <View style={styles.container}>
      <Button
        mode="contained"
        onPress={handleOAuthSignIn}
        loading={isLoading}
        disabled={isLoading}
        style={styles.button}
      >
        Sign in with Google
      </Button>
      
      {error && (
        <Text style={styles.error}>{error}</Text>
      )}
    </View>
  );
};
```

### Phase 4: Universal Links Setup (2 hours) ⚠️ **Most Complex Part**

#### 4.1 Backend Redirect Page (Required)
You need to create a web page that handles the OAuth redirect and triggers the Universal Link:

```html
<!-- https://yourapp.com/auth/callback -->
<!DOCTYPE html>
<html>
<head>
    <title>Authentication Success</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
    <div id="status">Processing authentication...</div>
    
    <script>
        // Extract OAuth parameters from URL
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const error = urlParams.get('error');
        
        if (error) {
            document.getElementById('status').textContent = 'Authentication failed: ' + error;
        } else if (code) {
            // Construct Universal Link to open app
            const appUrl = `https://stockauditscanner.app/auth/callback?code=${code}&state=${state}`;
            
            // Try to open app
            window.location.href = appUrl;
            
            // Fallback message
            setTimeout(() => {
                document.getElementById('status').innerHTML = `
                    <p>Authentication successful!</p>
                    <p>If the app didn't open automatically, <a href="${appUrl}">click here</a></p>
                `;
            }, 2000);
        }
    </script>
</body>
</html>
```

#### 4.2 Configure Universal Links (iOS)
**Add to `ios/StockAuditScanner/StockAuditScanner.entitlements`:**
```xml
<key>com.apple.developer.associated-domains</key>
<array>
    <string>applinks:stockauditscanner.app</string>
</array>
```

**Host Apple App Site Association file at `https://stockauditscanner.app/.well-known/apple-app-site-association`:**
```json
{
    "applinks": {
        "apps": [],
        "details": [
            {
                "appID": "TEAM_ID.com.stockauditscanner",
                "paths": ["/auth/callback"]
            }
        ]
    }
}
```

#### 4.3 Configure App Links (Android)
**Add to `android/app/src/main/AndroidManifest.xml`:**
```xml
<activity android:name=".MainActivity">
    <intent-filter android:autoVerify="true">
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data android:scheme="https"
              android:host="stockauditscanner.app"
              android:path="/auth/callback" />
    </intent-filter>
</activity>
```

**Host Digital Asset Links file at `https://stockauditscanner.app/.well-known/assetlinks.json`:**
```json
[{
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
        "namespace": "android_app",
        "package_name": "com.stockauditscanner",
        "sha256_cert_fingerprints": ["YOUR_SHA256_FINGERPRINT"]
    }
}]
```

### Phase 5: Testing & Debugging (30 minutes)

#### 5.1 Test Checklist
- [ ] OAuth flow starts correctly on both platforms
- [ ] Google OAuth completes successfully  
- [ ] App receives OAuth callback via Universal Link/App Link
- [ ] Tokens are stored and retrieved correctly
- [ ] Token refresh works automatically
- [ ] Sign out clears all tokens
- [ ] Error handling works for network issues
- [ ] Works on both Android emulator and iOS simulator
- [ ] Works on physical devices

#### 5.2 Common Issues & Solutions

**Issue: Universal Link doesn't open app**
- Verify `.well-known` files are accessible
- Check domain verification in platform consoles
- Test Universal Link in Safari/Chrome first

**Issue: OAuth callback not received**
- Verify redirect URLs match exactly
- Check manifest/plist configurations
- Ensure OAuth client IDs are correct

**Issue: Token refresh fails**
- Verify refresh token storage
- Check OAuth client configuration
- Implement proper error handling

## 🚨 Why This Approach is Problematic

### 1. Universal Links Issues
- **Doesn't work reliably** with OAuth redirects
- **iOS Safari behavior** - redirects don't trigger Universal Links
- **User gesture requirement** - needs user interaction to open app
- **Fallback complexity** - requires interstitial web page

### 2. Platform Deprecation
- **Google moving away** from custom URL schemes
- **Apple limiting** OAuth redirects to Universal Links
- **Security concerns** about app impersonation
- **Future compatibility** uncertain

### 3. Setup Complexity
- **Backend infrastructure** required for redirect pages
- **Domain ownership** needed for Universal Links/App Links
- **Platform-specific configurations** for each OAuth provider
- **SSL certificates** and domain verification required

## 📊 Comparison: App Auth vs Firebase Auth

| Factor | React Native App Auth | Firebase Auth |
|--------|----------------------|---------------|
| Setup Time | 4-6 hours | 2-3 hours |
| Complexity | High | Low |
| Future-Proof | Uncertain | Very High |
| Universal Link Setup | Required | Not Required |
| Backend Changes | Required | Minimal |
| Platform Support | Good | Excellent |
| Security | Very Good | Excellent |
| Maintenance | High | Low |

## 🎯 Recommendation

**We strongly recommend the Firebase Auth approach instead** because:
1. Much simpler implementation (2-3 hours vs 4-6 hours)
2. No Universal Links complexity
3. Better future compatibility
4. Lower maintenance burden
5. More reliable across devices and OS versions

This React Native App Auth guide is provided for completeness, but the Firebase Auth + Supabase solution is the better choice for your project.

---

**Bottom Line**: While React Native App Auth is technically superior from an OAuth 2.0 standards perspective, the practical implementation challenges and platform changes make Firebase Auth the more pragmatic choice for mobile apps in 2024.