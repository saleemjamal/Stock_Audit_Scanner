import React, { useEffect, ReactNode } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { View, StyleSheet } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';

import { supabase } from '../services/supabase';
import { initializeAuth, setSession, setUser, setLoading } from '../store/slices/authSliceWorkaround';
import { showErrorMessage, setInitialized } from '../store/slices/appSlice';
import { RootState, AppDispatch } from '../store';

interface AuthProviderProps {
  children: ReactNode;
}

const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { isLoading } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    // Initialize auth state
    dispatch(initializeAuth())
      .unwrap()
      .then(() => {
        dispatch(setInitialized(true));
      })
      .catch((error) => {
        console.error('Auth initialization failed:', error);
        dispatch(setInitialized(true)); // Continue anyway
      });

    // Since we're not using Supabase Auth, we don't need auth state change listener
    // The auth state is managed through our custom login flow
  }, [dispatch]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Initializing...</Text>
      </View>
    );
  }

  return <>{children}</>;
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
  },
});

export default AuthProvider;