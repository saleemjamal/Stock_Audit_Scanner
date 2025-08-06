import React, { useEffect, ReactNode } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { View, StyleSheet } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';

import { supabase } from '../services/supabase';
import { initializeAuth, setSession, setUser } from '../store/slices/authSlice';
import { showErrorMessage } from '../store/slices/appSlice';
import { RootState, AppDispatch } from '../store';

interface AuthProviderProps {
  children: ReactNode;
}

const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { isLoading } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    // Initialize auth state
    dispatch(initializeAuth());

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.id);
        
        dispatch(setSession(session));
        
        if (session?.user) {
          try {
            // Get user profile from database
            const { data: userProfile, error } = await supabase
              .from('users')
              .select('*')
              .eq('id', session.user.id)
              .single();
            
            if (error && error.code !== 'PGRST116') {
              throw error;
            }
            
            // If user profile doesn't exist, create it
            if (!userProfile) {
              const { data: newProfile, error: createError } = await supabase
                .from('users')
                .insert({
                  id: session.user.id,
                  email: session.user.email!,
                  full_name: session.user.user_metadata?.full_name || session.user.email,
                  role: 'scanner', // Default role
                })
                .select()
                .single();
              
              if (createError) throw createError;
              dispatch(setUser(newProfile));
            } else {
              dispatch(setUser(userProfile));
            }
          } catch (error: any) {
            console.error('Error handling auth state change:', error);
            dispatch(showErrorMessage(`Authentication error: ${error.message}`));
          }
        } else {
          dispatch(setUser(null));
        }
      }
    );

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