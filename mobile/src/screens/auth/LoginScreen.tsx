import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { 
  Card, 
  Title, 
  Paragraph,
  HelperText,
  ActivityIndicator,
} from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';

import { signInWithGoogle, clearError } from '../../store/slices/authSlice';
import { RootState, AppDispatch } from '../../store';
import { GoogleSigninButton } from '@react-native-google-signin/google-signin';

const LoginScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { isLoading, error } = useSelector((state: RootState) => state.auth);
  
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    try {
      setIsGoogleLoading(true);
      dispatch(clearError());
      
      // Use native Google Sign-In
      await dispatch(signInWithGoogle()).unwrap();
      
      // Navigation will happen automatically when auth state changes
    } catch (error: any) {
      Alert.alert(
        'Sign-in Error',
        error.message || 'Failed to sign in with Google',
        [{ text: 'OK' }]
      );
    } finally {
      setIsGoogleLoading(false);
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