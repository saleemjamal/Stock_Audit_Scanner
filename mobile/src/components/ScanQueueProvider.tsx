import React, { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { useSelector } from 'react-redux';

import { ScanQueueManager, QueueStatus, TelemetryEvent } from '../services/scanQueue/ScanQueueManager';
import { DirectApiSink } from '../services/scanSink/DirectApiSink';
import { ScanData } from '../services/scanSink/types';
import { RootState } from '../store';
import { config } from '../config/features';

// Bulletproof singleton - survives Fast Refresh, StrictMode, navigator resets
const getManager = (): ScanQueueManager => {
  if (!(globalThis as any).__scanQueueManager) {
    console.log('🔒 Creating TRUE singleton ScanQueueManager');
    const sink = new DirectApiSink();
    (globalThis as any).__scanQueueManager = new ScanQueueManager(sink);
  } else {
    console.log('🔒 Reusing existing singleton ScanQueueManager');
  }
  return (globalThis as any).__scanQueueManager as ScanQueueManager;
};

interface ScanQueueContextType {
  queueManager: ScanQueueManager | null;
  queueStatus: QueueStatus;
  addScan: (scan: Omit<ScanData, 'client_scan_id' | 'timestamp'>) => Promise<string>;
  forceFlush: () => Promise<void>;
}

const ScanQueueContext = createContext<ScanQueueContextType | null>(null);

interface ScanQueueProviderProps {
  children: ReactNode;
}

export const ScanQueueProvider: React.FC<ScanQueueProviderProps> = ({ children }) => {
  const managerRef = useRef<ScanQueueManager | null>(null);
  const [queueStatus, setQueueStatus] = useState<QueueStatus>({
    pendingCount: 0,
    fillPercentage: 0,
    isOnline: true,
    isFlushInProgress: false,
  });

  const { user } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    const startTime = Date.now();
    console.log('📊 ScanQueueProvider: Initializing scan queue system...');

    // Get true singleton manager
    managerRef.current = getManager();
    const manager = managerRef.current;
    
    // Set up event listeners
    const handleStatusUpdate = (status: QueueStatus) => {
      setQueueStatus(status);
    };

    const handleTelemetry = (event: TelemetryEvent) => {
      if (config.ENABLE_TELEMETRY) {
        console.log('📊 ScanQueue Telemetry:', event);
        
        // Log important events
        switch (event.type) {
          case 'flush_completed':
            const { result } = event.data;
            console.log(`✅ Queue flush completed: ${result.sent} sent, ${result.failed} failed`);
            break;
            
          case 'flush_failed':
            console.error('💥 Queue flush failed:', event.data);
            break;
            
          case 'queue_warning':
            console.warn(`⚠️ Queue warning: ${event.data.fillPercentage.toFixed(1)}% full`);
            break;
            
          case 'queue_full':
            console.error('🚨 Queue full! Cannot accept more scans.');
            break;
        }
      }
    };

    // Attach listeners to singleton
    manager.on('statusUpdate', handleStatusUpdate);
    manager.on('telemetry', handleTelemetry);
    
    // Set initial status
    setQueueStatus(manager.getStatus());
    
    const endTime = Date.now();
    console.log(`✅ ScanQueueProvider: Queue system initialized in ${endTime - startTime}ms`);

    // Cleanup on unmount - detach listeners only (keep singleton alive)
    return () => {
      console.log('🧹 ScanQueueProvider: Detaching listeners from singleton...');
      
      manager.off('statusUpdate', handleStatusUpdate);
      manager.off('telemetry', handleTelemetry);
      
      // Note: Don't destroy singleton on remount - only on app exit
    };
  }, []);

  const addScan = async (scan: Omit<ScanData, 'client_scan_id' | 'timestamp'>): Promise<string> => {
    if (!managerRef.current) {
      throw new Error('Queue manager not initialized');
    }

    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    // Add user ID to scan data
    const scanWithUser: Omit<ScanData, 'client_scan_id' | 'timestamp'> = {
      ...scan,
      scanner_id: user.id,
      device_id: user.device_id || 'unknown'
    };

    console.log('📝 ScanQueueProvider: Adding scan to queue:', scan.barcode);
    
    try {
      const scanId = await managerRef.current.addScan(scanWithUser);
      console.log('✅ ScanQueueProvider: Scan added successfully:', scanId);
      return scanId;
    } catch (error: any) {
      console.error('💥 ScanQueueProvider: Failed to add scan:', error);
      throw error;
    }
  };

  const forceFlush = async (): Promise<void> => {
    if (!managerRef.current) {
      console.warn('⚠️ ScanQueueProvider: Cannot flush - queue manager not initialized');
      return;
    }

    console.log('🔄 ScanQueueProvider: Force flushing queue...');
    
    try {
      const result = await managerRef.current.forceFlush();
      if (result) {
        console.log('✅ ScanQueueProvider: Force flush completed:', result);
      } else {
        console.log('📭 ScanQueueProvider: Nothing to flush');
      }
    } catch (error) {
      console.error('💥 ScanQueueProvider: Force flush failed:', error);
      throw error;
    }
  };

  const contextValue: ScanQueueContextType = {
    queueManager: managerRef.current,
    queueStatus,
    addScan,
    forceFlush,
  };

  return (
    <ScanQueueContext.Provider value={contextValue}>
      {children}
    </ScanQueueContext.Provider>
  );
};

export const useScanQueue = (): ScanQueueContextType => {
  const context = useContext(ScanQueueContext);
  
  if (!context) {
    throw new Error('useScanQueue must be used within a ScanQueueProvider');
  }
  
  return context;
};

// Hook for just getting queue status (lighter)
export const useQueueStatus = (): QueueStatus => {
  const { queueStatus } = useScanQueue();
  return queueStatus;
};