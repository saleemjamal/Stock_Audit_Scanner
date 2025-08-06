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
      try {
        console.log('Initializing local database...');
        await DatabaseService.initDatabase();
        
        console.log('Database initialized successfully');
        dispatch(setDatabaseReady(true));
        setIsInitializing(false);
      } catch (error: any) {
        console.error('Database initialization failed:', error);
        dispatch(showErrorMessage(`Database error: ${error.message}`));
        dispatch(setDatabaseReady(false));
        setIsInitializing(false);
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
        <Text style={styles.loadingText}>Setting up database...</Text>
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

export default DatabaseProvider;