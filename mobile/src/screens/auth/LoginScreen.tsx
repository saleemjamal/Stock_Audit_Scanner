import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { 
  Text, 
  TextInput, 
  Button, 
  Card, 
  Title, 
  Paragraph,
  Divider,
  HelperText,
} from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';

import { signInWithEmail, signInWithGoogle, clearError } from '../../store/slices/authSlice';
import { RootState, AppDispatch } from '../../store';
import { isValidEmail } from '../../../../shared/utils/helpers';

const LoginScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { isLoading, error } = useSelector((state: RootState) => state.auth);
  
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);

  const handleEmailLogin = async () => {
    if (!isValidEmail(email)) {
      return;
    }

    dispatch(clearError());
    
    try {
      await dispatch(signInWithEmail(email)).unwrap();
      setEmailSent(true);
    } catch (error) {
      // Error is handled by the slice
    }
  };

  const handleGoogleLogin = async () => {
    dispatch(clearError());
    
    try {
      await dispatch(signInWithGoogle()).unwrap();
    } catch (error) {
      // Error is handled by the slice
    }
  };

  const resetEmailForm = () => {
    setEmailSent(false);
    setEmail('');
    dispatch(clearError());
  };

  if (emailSent) {
    return (
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Card style={styles.card}>
            <Card.Content style={styles.cardContent}>
              <Title style={styles.title}>Check Your Email</Title>
              
              <Paragraph style={styles.subtitle}>
                We've sent a login link to:
              </Paragraph>
              
              <Text style={styles.emailText}>{email}</Text>
              
              <Paragraph style={styles.instructions}>
                Tap the link in your email to sign in to the Stock Audit Scanner app.
              </Paragraph>
              
              <Button
                mode="outlined"
                onPress={resetEmailForm}
                style={styles.backButton}
              >
                Back to Login
              </Button>
            </Card.Content>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

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
              Sign in to start scanning inventory
            </Paragraph>

            <View style={styles.form}>
              <TextInput
                label="Email Address"
                value={email}
                onChangeText={setEmail}
                mode="outlined"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
                error={email.length > 0 && !isValidEmail(email)}
              />
              
              <HelperText 
                type="error" 
                visible={email.length > 0 && !isValidEmail(email)}
              >
                Please enter a valid email address
              </HelperText>

              <Button
                mode="contained"
                onPress={handleEmailLogin}
                loading={isLoading}
                disabled={!isValidEmail(email) || isLoading}
                style={styles.loginButton}
                contentStyle={styles.buttonContent}
              >
                Send Login Link
              </Button>

              <Divider style={styles.divider} />

              <Button
                mode="outlined"
                onPress={handleGoogleLogin}
                loading={isLoading}
                disabled={isLoading}
                style={styles.googleButton}
                contentStyle={styles.buttonContent}
                icon="google"
              >
                Sign in with Google
              </Button>

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
            For supervisors and admins: Use Google sign-in
          </Paragraph>
          <Paragraph style={styles.footerText}>
            For scanners: Use email login
          </Paragraph>
        </View>
      </ScrollView>
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
  input: {
    marginBottom: 8,
  },
  loginButton: {
    marginTop: 16,
    marginBottom: 24,
  },
  googleButton: {
    marginTop: 8,
  },
  buttonContent: {
    height: 48,
  },
  divider: {
    marginVertical: 16,
  },
  errorText: {
    marginTop: 16,
    textAlign: 'center',
  },
  emailText: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976d2',
    marginVertical: 16,
  },
  instructions: {
    textAlign: 'center',
    marginBottom: 24,
    color: '#666666',
    lineHeight: 20,
  },
  backButton: {
    marginTop: 16,
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