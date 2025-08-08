import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import AsyncStorage from '@react-native-async-storage/async-storage';

// TODO: Replace with your Web Client ID from Firebase Console
// Go to Firebase Console > Authentication > Sign-in method > Google > Web SDK configuration
const WEB_CLIENT_ID = '318174569372-71q77m38ou4br513pl9egl3kne3a6j5s.apps.googleusercontent.com';

class GoogleSignInService {
  private configured = false;

  configure() {
    if (this.configured) return;
    
    try {
      GoogleSignin.configure({
        webClientId: WEB_CLIENT_ID,
        offlineAccess: true, // For refresh tokens
        forceCodeForRefreshToken: true,
        accountName: '', // Android only - will show email selector
      });
      this.configured = true;
      console.log('🔐 GOOGLE_SIGNIN: Configured successfully');
    } catch (error) {
      console.error('🔐 GOOGLE_SIGNIN: Configuration failed:', error);
      throw error;
    }
  }

  async signIn() {
    try {
      // Ensure configuration
      this.configure();
      
      // Check Play Services availability (Android)
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      
      // Sign in
      console.log('🔐 GOOGLE_SIGNIN: Starting sign-in flow');
      const userInfo = await GoogleSignin.signIn();
      
      // DEBUG: Log complete userInfo structure
      console.log('🔐 GOOGLE_SIGNIN: Full userInfo object:', JSON.stringify(userInfo, null, 2));
      console.log('🔐 GOOGLE_SIGNIN: userInfo keys:', Object.keys(userInfo));
      
      // Handle different response structures from Google Sign-In library
      // The library can return either direct structure or nested in 'data'
      let actualUserInfo, actualIdToken, actualServerAuthCode;
      
      if (userInfo.type === 'success' && userInfo.data) {
        // Nested structure: { type: 'success', data: { user, idToken, etc } }
        console.log('🔐 GOOGLE_SIGNIN: Detected nested structure (userInfo.data)');
        actualUserInfo = userInfo.data.user;
        actualIdToken = userInfo.data.idToken;
        actualServerAuthCode = userInfo.data.serverAuthCode;
      } else if (userInfo.user || userInfo.idToken) {
        // Direct structure: { user, idToken, serverAuthCode }
        console.log('🔐 GOOGLE_SIGNIN: Detected direct structure');
        actualUserInfo = userInfo.user;
        actualIdToken = userInfo.idToken;
        actualServerAuthCode = userInfo.serverAuthCode;
      } else {
        // Unknown structure - log and throw error
        console.error('🔐 GOOGLE_SIGNIN: Unknown response structure:', userInfo);
        throw new Error('Unexpected Google Sign-In response structure');
      }
      
      console.log('🔐 GOOGLE_SIGNIN: Extracted data:', {
        hasUser: !!actualUserInfo,
        hasIdToken: !!actualIdToken,
        userEmail: actualUserInfo?.email || 'NO EMAIL',
      });
      
      // Store tokens for offline access
      if (actualIdToken) {
        await AsyncStorage.setItem('google_id_token', actualIdToken);
      }
      
      // Store user info (with safety check)
      if (actualUserInfo) {
        await AsyncStorage.setItem('google_user_info', JSON.stringify(actualUserInfo));
        console.log('🔐 GOOGLE_SIGNIN: User info stored successfully');
      } else {
        console.log('🔐 GOOGLE_SIGNIN: No user object to store');
        throw new Error('No user information received from Google Sign-In');
      }
      
      return {
        user: actualUserInfo,
        idToken: actualIdToken,
        serverAuthCode: actualServerAuthCode,
      };
    } catch (error: any) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        console.log('🔐 GOOGLE_SIGNIN: User cancelled sign-in');
        throw new Error('Sign-in cancelled');
      } else if (error.code === statusCodes.IN_PROGRESS) {
        console.log('🔐 GOOGLE_SIGNIN: Sign-in already in progress');
        throw new Error('Sign-in already in progress');
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        console.error('🔐 GOOGLE_SIGNIN: Play Services not available');
        throw new Error('Google Play Services not available. Please update or install.');
      } else {
        console.error('🔐 GOOGLE_SIGNIN: Sign-in error:', error);
        throw error;
      }
    }
  }

  async signOut() {
    try {
      await GoogleSignin.signOut();
      await AsyncStorage.multiRemove(['google_id_token', 'google_user_info']);
      console.log('🔐 GOOGLE_SIGNIN: Sign-out successful');
    } catch (error) {
      console.error('🔐 GOOGLE_SIGNIN: Sign-out error:', error);
      throw error;
    }
  }

  async isSignedIn() {
    try {
      this.configure();
      const isSignedIn = await GoogleSignin.isSignedIn();
      return isSignedIn;
    } catch (error) {
      console.error('🔐 GOOGLE_SIGNIN: Check sign-in status error:', error);
      return false;
    }
  }

  async getCurrentUser() {
    try {
      this.configure();
      const userInfo = await GoogleSignin.getCurrentUser();
      return userInfo;
    } catch (error) {
      console.error('🔐 GOOGLE_SIGNIN: Get current user error:', error);
      return null;
    }
  }

  async getTokens() {
    try {
      this.configure();
      const tokens = await GoogleSignin.getTokens();
      return tokens;
    } catch (error) {
      console.error('🔐 GOOGLE_SIGNIN: Get tokens error:', error);
      throw error;
    }
  }

  async revokeAccess() {
    try {
      await GoogleSignin.revokeAccess();
      await this.signOut();
      console.log('🔐 GOOGLE_SIGNIN: Access revoked');
    } catch (error) {
      console.error('🔐 GOOGLE_SIGNIN: Revoke access error:', error);
      throw error;
    }
  }
}

export const googleSignIn = new GoogleSignInService();