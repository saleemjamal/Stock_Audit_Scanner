import { AppState, AppStateStatus } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { NativeEventEmitter, NativeModules } from 'react-native';
// Removed UUID import - using timestamp-based IDs instead

// Zero-dependency throttle implementation
function throttle<T extends (...a:any[])=>void>(fn:T, wait:number) {
  let last = 0, t:any;
  return (...args:Parameters<T>) => {
    const now = Date.now();
    const remaining = wait - (now - last);
    if (remaining <= 0) { last = now; fn(...args); }
    else { clearTimeout(t); t = setTimeout(() => { last = Date.now(); fn(...args); }, remaining); }
  };
}

// Simple EventEmitter implementation for React Native
class SimpleEventEmitter {
  private listeners: { [event: string]: Function[] } = {};

  on(event: string, listener: Function): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(listener);
  }

  off(event: string, listener: Function): void {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(l => l !== listener);
    }
  }

  emit(event: string, ...args: any[]): void {
    if (this.listeners[event]) {
      this.listeners[event].forEach(listener => {
        try {
          listener(...args);
        } catch (error) {
          console.error(`EventEmitter error in ${event} listener:`, error);
        }
      });
    }
  }
}

import { ScanSink, ScanData, FlushResult } from '../scanSink/types';
import { PersistentQueue } from './PersistentQueue';
import { config } from '../../config/features';

export interface QueueStatus {
  pendingCount: number;
  fillPercentage: number;
  isOnline: boolean;
  isFlushInProgress: boolean;
  lastFlushResult?: FlushResult & { timestamp: number };
}

export interface TelemetryEvent {
  type: 'flush_started' | 'flush_completed' | 'flush_failed' | 'queue_warning' | 'queue_full';
  data: any;
  timestamp: number;
}

export class ScanQueueManager extends SimpleEventEmitter {
  private memoryQueue: ScanData[] = [];
  private flushInProgress = false;
  private flushTimer: NodeJS.Timeout | null = null;
  
  private readonly sink: ScanSink;
  private persistentQueue: PersistentQueue | null;
  
  private isOnline = true;
  private currentAppState: AppStateStatus = 'active';
  private lastFlushResult?: FlushResult & { timestamp: number };
  
  // Network and app state listeners (for cleanup)
  private networkUnsubscribe: (() => void) | null = null;
  private appStateListener: ((state: AppStateStatus) => void) | null = null;
  
  // AbortController for canceling in-flight requests
  private abortController: AbortController | null = null;
  
  // Throttled status emission with change detection
  private lastStatusEmitted: QueueStatus | null = null;
  private emitStatusThrottled = throttle((status: QueueStatus) => {
    if (!this.lastStatusEmitted || 
        this.lastStatusEmitted.pendingCount !== status.pendingCount ||
        this.lastStatusEmitted.isFlushInProgress !== status.isFlushInProgress ||
        this.lastStatusEmitted.isOnline !== status.isOnline ||
        Math.abs(this.lastStatusEmitted.fillPercentage - status.fillPercentage) > 1) {
      this.emit('statusUpdate', status);
      this.lastStatusEmitted = { ...status };
    }
  }, 300);
  
  constructor(sink: ScanSink) {
    super();
    this.sink = sink;
    
    // Initialize PersistentQueue lazily to avoid blocking app startup
    this.persistentQueue = null;
    
    this.setupNetworkListener();
    this.setupAppStateListener();
    
    // Start async initialization but don't wait for it
    this.initializeAsync();
  }

  private async initializeAsync(): Promise<void> {
    try {
      console.log('📊 ScanQueueManager: Starting async initialization...');
      
      // Only initialize persistence if enabled
      if (config.USE_ASYNC_STORAGE) {
        console.log('📊 ScanQueueManager: Initializing AsyncStorage persistence...');
        this.persistentQueue = new PersistentQueue();
        await this.restoreFromPersistence();
      } else {
        console.log('📊 ScanQueueManager: AsyncStorage disabled - memory-only mode');
        this.persistentQueue = null;
      }
      
      console.log('✅ ScanQueueManager: Async initialization completed');
    } catch (error) {
      console.warn('⚠️ ScanQueueManager: Async initialization failed, continuing without persistence:', error);
      this.persistentQueue = null;
    }
  }

  private async ensurePersistentQueue(): Promise<PersistentQueue | null> {
    if (!config.USE_ASYNC_STORAGE) {
      return null; // Persistence disabled
    }
    
    if (!this.persistentQueue) {
      try {
        this.persistentQueue = new PersistentQueue();
      } catch (error) {
        console.warn('⚠️ ScanQueueManager: Cannot initialize persistent queue:', error);
        return null;
      }
    }
    return this.persistentQueue;
  }

  async addScan(scan: Omit<ScanData, 'client_scan_id' | 'timestamp'>): Promise<string> {
    // Check backpressure - prevent queue overflow
    if (this.memoryQueue.length >= config.QUEUE_MAX_SIZE) {
      this.emitTelemetry({
        type: 'queue_full',
        data: { queueLength: this.memoryQueue.length },
        timestamp: Date.now()
      });
      
      throw new Error('QUEUE_FULL: Cannot add scan, queue at maximum capacity. Please connect to internet.');
    }

    // Create scan with client-side metadata  
    const scanWithId: ScanData = {
      ...scan,
      client_scan_id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Timestamp-based ID for idempotency
      timestamp: Date.now()
    };

    console.log(`📝 ScanQueueManager: Adding scan ${scanWithId.client_scan_id.substring(0, 8)}...`);

    try {
      // Add to memory queue first (fastest)
      this.memoryQueue.push(scanWithId);

      // Persist to AsyncStorage for crash safety (async, non-blocking)
      if (this.sink.supportsPersistence) {
        // Local DB sink handles its own persistence
      } else {
        // For DirectApiSink, use AsyncStorage backup
        const persistentQueue = await this.ensurePersistentQueue();
        if (persistentQueue) {
            persistentQueue.push(scanWithId).catch(error => {
            console.warn('⚠️ ScanQueueManager: Failed to persist scan (non-critical):', error);
          });
        }
      }

      // Emit queue status update
      this.emitQueueStatus();

      // Check if we should flush now
      this.checkFlushTriggers();

      console.log(`✅ ScanQueueManager: Scan added, queue size: ${this.memoryQueue.length}`);
      return scanWithId.client_scan_id;

    } catch (error) {
      console.error('💥 ScanQueueManager: Failed to add scan:', error);
      throw error;
    }
  }

  async forceFlush(): Promise<FlushResult | null> {
    console.log('🔄 ScanQueueManager: Force flush requested');
    return this.flush();
  }

  getStatus(): QueueStatus {
    return {
      pendingCount: this.memoryQueue.length,
      fillPercentage: (this.memoryQueue.length / config.QUEUE_MAX_SIZE) * 100,
      isOnline: this.isOnline,
      isFlushInProgress: this.flushInProgress,
      lastFlushResult: this.lastFlushResult
    };
  }

  private async flush(): Promise<FlushResult | null> {
    // Single-flight pattern - prevent overlapping flushes
    if (this.flushInProgress) {
      console.log('⏳ ScanQueueManager: Flush already in progress, skipping');
      return null;
    }

    if (this.memoryQueue.length === 0) {
      console.log('📭 ScanQueueManager: Queue is empty, nothing to flush');
      return null;
    }

    try {
      this.flushInProgress = true;
      
      // Clear any pending timer
      if (this.flushTimer) {
        clearTimeout(this.flushTimer);
        this.flushTimer = null;
      }

      console.log(`🚀 ScanQueueManager: Starting flush of ${this.memoryQueue.length} scans`);
      
      this.emitTelemetry({
        type: 'flush_started',
        data: { queueLength: this.memoryQueue.length },
        timestamp: Date.now()
      });

      // Take a batch from the front of the queue
      const batchSize = Math.min(config.BATCH_SIZE, this.memoryQueue.length);
      const batch = this.memoryQueue.splice(0, batchSize);

      console.log(`📦 ScanQueueManager: Processing batch of ${batch.length} scans`);

      // Try to flush the batch
      const result = await this.sink.flush(batch);
      
      // Handle partial failures - put failed scans back at the front
      if (result.failed > 0) {
        console.warn(`⚠️ ScanQueueManager: ${result.failed} scans failed, requeueing`);
        const failedScans = batch.slice(batch.length - result.failed);
        this.memoryQueue.unshift(...failedScans);
      } else {
        // Complete success - remove from persistent storage
        if (!this.sink.supportsPersistence) {
          try {
            const persistentQueue = await this.ensurePersistentQueue();
            if (persistentQueue) {
              await persistentQueue.removeBatch(result.sent);
            }
          } catch (error) {
            console.warn('⚠️ ScanQueueManager: Failed to remove from persistent queue:', error);
          }
        }
      }

      // Update last flush result
      this.lastFlushResult = {
        ...result,
        timestamp: Date.now()
      };

      // Emit telemetry
      this.emitTelemetry({
        type: result.failed > 0 ? 'flush_failed' : 'flush_completed',
        data: { result, queueLength: this.memoryQueue.length },
        timestamp: Date.now()
      });

      console.log(`✅ ScanQueueManager: Flush completed. Sent: ${result.sent}, Failed: ${result.failed}, Queue: ${this.memoryQueue.length}`);

      return result;

    } catch (error) {
      console.error('💥 ScanQueueManager: Flush failed with error:', error);
      
      this.emitTelemetry({
        type: 'flush_failed',
        data: { error: error.message, queueLength: this.memoryQueue.length },
        timestamp: Date.now()
      });

      return { sent: 0, failed: this.memoryQueue.length };

    } finally {
      this.flushInProgress = false;
      
      // Emit updated status
      this.emitQueueStatus();
      
      // Check if we need to flush again
      this.checkFlushTriggers();
    }
  }

  private checkFlushTriggers(): void {
    // Don't trigger if already flushing
    if (this.flushInProgress) return;

    const queueLength = this.memoryQueue.length;

    // Size trigger - immediate flush if batch size reached
    if (queueLength >= config.BATCH_SIZE) {
      console.log('🎯 ScanQueueManager: Size trigger - flushing immediately');
      this.flush();
      return;
    }

    // Network trigger - flush when coming online
    if (this.isOnline && queueLength > 0) {
      // Time trigger - schedule flush if not already scheduled
      if (!this.flushTimer && queueLength > 0) {
        console.log(`⏰ ScanQueueManager: Time trigger - scheduling flush in ${config.FLUSH_INTERVAL_MS}ms`);
        this.flushTimer = setTimeout(() => {
          console.log('⏰ ScanQueueManager: Time trigger fired');
          this.flush();
        }, config.FLUSH_INTERVAL_MS);
      }
    }

    // Backpressure warning
    const fillPercentage = (queueLength / config.QUEUE_MAX_SIZE) * 100;
    if (fillPercentage >= config.QUEUE_WARNING_THRESHOLD * 100) {
      console.warn(`⚠️ ScanQueueManager: Queue ${fillPercentage.toFixed(1)}% full (${queueLength}/${config.QUEUE_MAX_SIZE})`);
      
      this.emitTelemetry({
        type: 'queue_warning',
        data: { queueLength, fillPercentage },
        timestamp: Date.now()
      });
    }
  }

  private setupNetworkListener(): void {
    this.networkUnsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const wasOnline = this.isOnline;
      this.isOnline = state.isConnected ?? false;

      console.log(`🌐 ScanQueueManager: Network state changed - Online: ${this.isOnline}`);

      // Trigger flush when coming back online
      if (!wasOnline && this.isOnline && this.memoryQueue.length > 0) {
        console.log('🌐 ScanQueueManager: Back online - triggering flush');
        this.flush();
      }

      this.emitQueueStatus();
    });
  }

  private setupAppStateListener(): void {
    this.appStateListener = (nextAppState: AppStateStatus) => {
      const previousState = this.currentAppState;
      this.currentAppState = nextAppState;

      console.log(`📱 ScanQueueManager: App state changed from ${previousState} to ${nextAppState}`);

      // Flush when going to background
      if (previousState === 'active' && nextAppState === 'background') {
        if (this.memoryQueue.length > 0) {
          console.log('📱 ScanQueueManager: Going to background - flushing queue');
          this.flush();
        }
      }
    };
    
    AppState.addEventListener('change', this.appStateListener);
  }

  private async restoreFromPersistence(): Promise<void> {
    if (this.sink.supportsPersistence) {
      console.log('🔄 ScanQueueManager: Sink supports persistence, skipping AsyncStorage restore');
      return;
    }

    try {
      console.log('🔄 ScanQueueManager: Restoring queue from AsyncStorage...');
      
      const persistentQueue = await this.ensurePersistentQueue();
      if (!persistentQueue) {
        console.log('⚠️ ScanQueueManager: No persistent queue available for restore');
        return;
      }
      
      const persistedScans = await persistentQueue.restoreAll();
      
      if (persistedScans.length > 0) {
        console.log(`📦 ScanQueueManager: Restored ${persistedScans.length} scans from persistence`);
        
        // Add to front of queue (older scans first)
        this.memoryQueue.unshift(...persistedScans);
        
        // Trigger flush if we have scans and are online
        if (this.isOnline) {
          this.checkFlushTriggers();
        }
      }
    } catch (error) {
      console.error('💥 ScanQueueManager: Failed to restore from persistence:', error);
    }
  }

  getStatus(): QueueStatus {
    const pendingCount = this.memoryQueue.length;
    const fillPercentage = (pendingCount / config.QUEUE_MAX_SIZE) * 100;
    
    return {
      pendingCount,
      fillPercentage,
      isOnline: this.isOnline,
      isFlushInProgress: this.flushInProgress,
      lastFlushResult: this.lastFlushResult,
    };
  }

  private emitQueueStatus(): void {
    const status = this.getStatus();
    this.emitStatusThrottled(status);
  }

  private emitTelemetry(event: TelemetryEvent): void {
    this.emit('telemetry', event);
  }

  // Cleanup method
  async destroy(): Promise<void> {
    console.log('🧹 ScanQueueManager: Complete destruction...');
    
    // 1. Clear all timers
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    
    // 2. Cancel in-flight requests
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    
    // 3. Remove system listeners
    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
      this.networkUnsubscribe = null;
    }
    
    if (this.appStateListener) {
      AppState.removeEventListener('change', this.appStateListener);
      this.appStateListener = null;
    }
    
    // 4. Final flush without blocking (silent fail on destroy)
    if (this.memoryQueue.length > 0) {
      try {
        await this.flush();
      } catch (error) {
        console.warn('⚠️ ScanQueueManager: Final flush failed during destroy (non-critical):', error);
      }
    }
    
    // 5. Clear state
    this.memoryQueue = [];
    this.flushInProgress = false;
    this.lastStatusEmitted = null;
    
    // 6. Remove event listeners
    this.removeAllListeners();
    
    console.log('✅ ScanQueueManager: Complete destruction finished');
  }
}