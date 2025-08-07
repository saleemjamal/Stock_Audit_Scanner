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

import { signInWithPassword, clearError } from '../../store/slices/authSlice';
import { RootState, AppDispatch } from '../../store';
import { isValidUsername } from '../../../../shared/utils/helpers';

const LoginScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { isLoading, error } = useSelector((state: RootState) => state.auth);
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!isValidUsername(username) || password.length < 6) {
      return;
    }

    dispatch(clearError());
    
    try {
      await dispatch(signInWithPassword({ username, password })).unwrap();
      // Navigation handled by auth state change
    } catch (error) {
      // Error is handled by the slice
    }
  };

  const resetForm = () => {
    setUsername('');
    setPassword('');
    setShowPassword(false);
    dispatch(clearError());
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
              Sign in to start scanning inventory
            </Paragraph>

            <View style={styles.form}>
              <TextInput
                label="Username"
                value={username}
                onChangeText={setUsername}
                mode="outlined"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
                error={username.length > 0 && !isValidUsername(username)}
              />
              
              <HelperText 
                type="error" 
                visible={username.length > 0 && !isValidUsername(username)}
              >
                Username must be 3-20 characters (letters, numbers, - _)
              </HelperText>

              <TextInput
                label="Password"
                value={password}
                onChangeText={setPassword}
                mode="outlined"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
                error={password.length > 0 && password.length < 6}
                right={
                  <TextInput.Icon
                    icon={showPassword ? 'eye-off' : 'eye'}
                    onPress={() => setShowPassword(!showPassword)}
                  />
                }
              />
              
              <HelperText 
                type="error" 
                visible={password.length > 0 && password.length < 6}
              >
                Password must be at least 6 characters
              </HelperText>

              <Button
                mode="contained"
                onPress={handleLogin}
                loading={isLoading}
                disabled={!isValidUsername(username) || password.length < 6 || isLoading}
                style={styles.loginButton}
                contentStyle={styles.buttonContent}
              >
                Sign In
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
            Contact your supervisor for login credentials
          </Paragraph>
          <Paragraph style={styles.footerText}>
            Scanner • Supervisor • Superuser
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