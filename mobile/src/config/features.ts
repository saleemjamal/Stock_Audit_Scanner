export const config = {
  // Feature flags
  USE_LOCAL_DB: false,          // Start with false - online-only mode
  USE_ASYNC_STORAGE: true,      // Enable AsyncStorage persistence for offline backup
  
  // Queue configuration
  BATCH_SIZE: 50,               // Scans per batch
  FLUSH_INTERVAL_MS: 15000,     // Max time before forcing flush (15s)
  QUEUE_MAX_SIZE: 2000,         // Max scans in memory queue
  QUEUE_WARNING_THRESHOLD: 0.8, // Warn when queue 80% full
  
  // Network configuration
  MAX_RETRIES: 3,               // Max retry attempts per chunk
  CHUNK_SIZE: 50,               // Scans per API call
  MAX_BACKOFF_MS: 10000,        // Max backoff delay (10s)
  
  // Database configuration
  DB_INIT_TIMEOUT_MS: 2000,     // Give up on DB init after 2s
  
  // AsyncStorage ring buffer
  PERSISTENT_QUEUE_SIZE: 500,   // Max scans in AsyncStorage
  
  // Telemetry
  ENABLE_TELEMETRY: true,       // Track performance metrics
  
  // Development
  ENABLE_FLUSH_BUTTON: __DEV__, // Show manual flush button in dev
} as const;

export type Config = typeof config;