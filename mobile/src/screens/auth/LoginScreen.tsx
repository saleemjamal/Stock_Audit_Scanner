import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { 
  Button, 
  Card, 
  Title, 
  Paragraph,
  Divider,
  HelperText,
  ActivityIndicator,
} from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';

import { signInWithGoogle, signInWithSupabaseOAuth, clearError, initializeAuth } from '../../store/slices/authSlice';
import { RootState, AppDispatch } from '../../store';
import { supabase } from '../../services/supabase';
import { GoogleSigninButton } from '@react-native-google-signin/google-signin';

const LoginScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { isLoading, error } = useSelector((state: RootState) => state.auth);
  
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    try {
      setIsGoogleLoading(true);
      dispatch(clearError());

      console.log('🔐 NATIVE_GOOGLE: Starting native Google Sign-In');
      
      // Use native Google Sign-In
      await dispatch(signInWithGoogle()).unwrap();
      
      console.log('🔐 NATIVE_GOOGLE: Sign-in successful');
      // Navigation will happen automatically when auth state changes
    } catch (error: any) {
      console.error('🔐 NATIVE_GOOGLE: Sign-in Error:', error);
      Alert.alert(
        'Sign-in Error',
        error.message || 'Failed to sign in with Google',
        [{ text: 'OK' }]
      );
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // Removed old WebView OAuth handlers - using native Google Sign-In now

  const handleTestSignIn = (email: string) => {
    Alert.alert(
      'Development Testing',
      `This would test user lookup for: ${email}\n\nIn production, users would sign in with their actual Google accounts.`,
      [{ text: 'OK' }]
    );
  };

  const handleCheckSession = async () => {
    console.log('🔐 BUTTON: Check Session button pressed');
    try {
      // Direct Supabase check first
      console.log('🔐 BUTTON: Checking Supabase session directly...');
      const { data: { session }, error } = await supabase.auth.getSession();
      console.log('🔐 BUTTON: Direct Supabase session:', { 
        hasSession: !!session, 
        email: session?.user?.email,
        error: error?.message 
      });

      // Then try Redux
      console.log('🔐 BUTTON: About to dispatch initializeAuth...');
      const result = await dispatch(initializeAuth()).unwrap();
      console.log('🔐 BUTTON: Redux result:', result);
      
      Alert.alert('Session Check', 
        `Direct Supabase: ${!!session}\n` +
        `Session Email: ${session?.user?.email || 'None'}\n` +
        `Redux Result: ${!!result.session}\n` +
        `User: ${result.user?.email || 'None'}`
      );
    } catch (error: any) {
      console.log('🔐 BUTTON: Got error:', error);
      Alert.alert('Session Check', `Error: ${error.message}`);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <Title style={styles.title}>Stock Audit Scanner</Title>
            <Paragraph style={styles.subtitle}>
              Sign in with Google to start scanning inventory
            </Paragraph>

            <View style={styles.form}>
              {/* Native Google Sign In Button */}
              <View style={styles.googleButtonContainer}>
                <GoogleSigninButton
                  style={styles.googleSignInButton}
                  size={GoogleSigninButton.Size.Wide}
                  color={GoogleSigninButton.Color.Dark}
                  onPress={handleGoogleSignIn}
                  disabled={isGoogleLoading || isLoading}
                />
                {isGoogleLoading && (
                  <ActivityIndicator 
                    style={styles.loadingOverlay} 
                    color="#4285f4" 
                  />
                )}
              </View>

              {error && (
                <HelperText type="error" style={styles.errorText}>
                  {error}
                </HelperText>
              )}

              <Divider style={styles.divider} />

              {/* Development Test Buttons */}
              <View style={styles.testSection}>
                <Paragraph style={styles.testHeader}>Development Testing</Paragraph>
                
                <Button
                  mode="outlined"
                  onPress={handleCheckSession}
                  style={styles.testButton}
                  compact
                  buttonColor="#ff9800"
                >
                  Check Session Status
                </Button>
                
                <Button
                  mode="outlined"
                  onPress={() => handleTestSignIn('saleem@poppatjamals.com')}
                  style={styles.testButton}
                  compact
                >
                  Test: Saleem (Superuser)
                </Button>
                
                <Button
                  mode="outlined"
                  onPress={() => handleTestSignIn('supervisor1@poppatjamals.com')}
                  style={styles.testButton}
                  compact
                >
                  Test: Supervisor 1
                </Button>
                
                <Button
                  mode="outlined"
                  onPress={() => handleTestSignIn('scanner1@poppatjamals.com')}
                  style={styles.testButton}
                  compact
                >
                  Test: Scanner 1
                </Button>
              </View>
            </View>
          </Card.Content>
        </Card>

        <View style={styles.footer}>
          <Paragraph style={styles.footerText}>
            All user roles can use the mobile app
          </Paragraph>
          <Paragraph style={styles.footerText}>
            Scanner • Supervisor • Superuser
          </Paragraph>
        </View>
      </ScrollView>

      {/* Native Google Sign-In - No WebView needed */}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    elevation: 4,
    borderRadius: 12,
  },
  cardContent: {
    padding: 32,
  },
  title: {
    textAlign: 'center',
    marginBottom: 8,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1976d2',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 32,
    color: '#666666',
  },
  form: {
    width: '100%',
  },
  googleButton: {
    marginTop: 16,
  },
  loginButton: {
    marginBottom: 16,
  },
  buttonContent: {
    height: 48,
  },
  googleButtonContainer: {
    alignItems: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  googleSignInButton: {
    width: '100%',
    height: 48,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  divider: {
    marginVertical: 16,
  },
  testSection: {
    marginTop: 8,
    alignItems: 'center',
  },
  testHeader: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 12,
    fontWeight: '600',
  },
  testButton: {
    marginVertical: 4,
    width: '100%',
  },
  errorText: {
    marginTop: 16,
    textAlign: 'center',
  },
  footer: {
    marginTop: 32,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'center',
    marginBottom: 4,
  },
});

export default LoginScreen;