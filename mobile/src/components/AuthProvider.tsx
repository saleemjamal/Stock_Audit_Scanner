import React, { useEffect, ReactNode } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { View, StyleSheet } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';

import { supabase } from '../services/supabase';
import { initializeAuth, setSession, setUser, setLoading } from '../store/slices/authSlice';
import { showErrorMessage, setInitialized } from '../store/slices/appSlice';
import { RootState, AppDispatch } from '../store';

interface AuthProviderProps {
  children: ReactNode;
}

const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { isLoading } = useSelector((state: RootState) => state.auth);


  useEffect(() => {
    // Initialize auth state with Supabase Auth
    dispatch(initializeAuth())
      .unwrap()
      .then(() => {
        dispatch(setInitialized(true));
      })
      .catch((error) => {
        console.error('Auth initialization failed:', error);
        dispatch(setInitialized(true)); // Continue anyway, user can still login
      });

    // Set up auth state change listener for Supabase Auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔐 AUTH: Auth state changed:', event, session?.user?.email);
      dispatch(setSession(session));
      
      if (session?.user) {
        // Get user profile by email (for Google OAuth users)
        console.log('🔐 AUTH: Looking up user profile for:', session.user.email);
        supabase
          .from('users')
          .select('*')
          .eq('email', session.user.email)
          .single()
          .then(({ data, error }) => {
            if (error) {
              console.error('🔐 AUTH: Error fetching user profile:', error);
              if (error.code === 'PGRST116') {
                console.error('🔐 AUTH: User not found in database:', session.user.email);
              }
            } else {
              console.log('🔐 AUTH: User profile found:', data);
              dispatch(setUser(data));
            }
          });
      } else {
        console.log('🔐 AUTH: No session, clearing user');
        dispatch(setUser(null));
      }
    });

    return () => {
      subscription.unsubscribe();
    };
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