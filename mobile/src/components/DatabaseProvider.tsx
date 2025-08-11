import React, { useEffect, ReactNode } from 'react';
import { useDispatch } from 'react-redux';
import { View, StyleSheet } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';

import DatabaseService from '../services/database';
import { setDatabaseReady, showErrorMessage } from '../store/slices/appSlice';
import { AppDispatch } from '../store';

interface DatabaseProviderProps {
  children: ReactNode;
}

const DatabaseProvider: React.FC<DatabaseProviderProps> = ({ children }) => {
  const dispatch = useDispatch<AppDispatch>();
  const [isInitializing, setIsInitializing] = React.useState(true);

  useEffect(() => {
    const initializeDatabase = async () => {
      console.log('📊 DatabaseProvider: Starting database initialization...');
      
      try {
        console.log('📊 DatabaseProvider: Setting up timeout protection...');
        
        // Add timeout to prevent infinite loading (reduced to 10 seconds)
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            console.error('⏰ DatabaseProvider: TIMEOUT after 10 seconds');
            reject(new Error('Database initialization timeout after 10 seconds'));
          }, 10000);
        });
        
        console.log('📊 DatabaseProvider: Calling DatabaseService.initDatabase()...');
        await Promise.race([
          DatabaseService.initDatabase(),
          timeoutPromise
        ]);
        
        console.log('🎉 DatabaseProvider: Database initialized successfully');
        dispatch(setDatabaseReady(true));
        setIsInitializing(false);
      } catch (error: any) {
        console.error('💥 DatabaseProvider: Database initialization FAILED:', error);
        console.error('💥 DatabaseProvider: Error details:', JSON.stringify(error, null, 2));
        console.error('💥 DatabaseProvider: Error stack:', error.stack);
        
        // Continue without database but log the error
        console.warn('Continuing without local database. App will work with online-only mode.');
        dispatch(setDatabaseReady(false));
        setIsInitializing(false);
        
        // Show user-friendly error message
        if (error.message.includes('timeout')) {
          console.warn('Database setup is taking longer than expected. You can still use the app.');
        }
      }
    };

    initializeDatabase();

    // Cleanup on unmount
    return () => {
      DatabaseService.closeDatabase().catch(console.error);
    };
  }, [dispatch]);

  if (isInitializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Setting up local database...</Text>
        <Text style={styles.subText}>This may take a few moments on first launch</Text>
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
    fontWeight: '600',
  },
  subText: {
    marginTop: 8,
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
  },
});

export default DatabaseProvider;