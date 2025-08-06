import React, { useEffect, ReactNode } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppState } from 'react-native';

import { 
  initializeNetworkListener, 
  syncAllPendingData,
  setPendingItemsCount 
} from '../store/slices/syncSlice';
import { updateLastActivity } from '../store/slices/appSlice';
import DatabaseService from '../services/database';
import { RootState, AppDispatch } from '../store';

interface SyncManagerProps {
  children: ReactNode;
}

const SyncManager: React.FC<SyncManagerProps> = ({ children }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { isOnline, isSyncing, pendingItems } = useSelector((state: RootState) => state.sync);
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const { database_ready } = useSelector((state: RootState) => state.app.appStatus);

  // Auto-sync interval (5 minutes)
  const SYNC_INTERVAL = 5 * 60 * 1000;

  useEffect(() => {
    // Initialize network listener
    dispatch(initializeNetworkListener());

    // Set up app state change listener
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        dispatch(updateLastActivity());
        
        // Sync when app becomes active
        if (isOnline && isAuthenticated && database_ready && !isSyncing) {
          dispatch(syncAllPendingData());
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, [dispatch, isOnline, isAuthenticated, database_ready, isSyncing]);

  useEffect(() => {
    // Set up periodic sync
    if (!isAuthenticated || !database_ready) return;

    const syncInterval = setInterval(() => {
      if (isOnline && !isSyncing) {
        dispatch(syncAllPendingData());
      }
    }, SYNC_INTERVAL);

    return () => {
      clearInterval(syncInterval);
    };
  }, [dispatch, isOnline, isSyncing, isAuthenticated, database_ready]);

  useEffect(() => {
    // Update pending items count periodically
    if (!database_ready) return;

    const updatePendingCount = async () => {
      try {
        const pendingItems = await DatabaseService.getPendingSyncItems();
        dispatch(setPendingItemsCount(pendingItems.length));
      } catch (error) {
        console.error('Error updating pending count:', error);
      }
    };

    // Update immediately
    updatePendingCount();

    // Update every 30 seconds
    const countInterval = setInterval(updatePendingCount, 30000);

    return () => {
      clearInterval(countInterval);
    };
  }, [dispatch, database_ready]);

  useEffect(() => {
    // Perform initial sync when conditions are met
    if (isOnline && isAuthenticated && database_ready && !isSyncing && pendingItems > 0) {
      // Delay initial sync by 2 seconds to allow UI to settle
      const timer = setTimeout(() => {
        dispatch(syncAllPendingData());
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [dispatch, isOnline, isAuthenticated, database_ready, isSyncing, pendingItems]);

  return <>{children}</>;
};

export default SyncManager;