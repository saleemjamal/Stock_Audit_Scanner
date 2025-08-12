export interface ScanData {
  barcode: string;
  rack_id: string;
  audit_session_id: string;
  scanner_id: string;
  device_id?: string;
  quantity?: number;
  manual_entry?: boolean;
  notes?: string;
  client_scan_id?: string;  // UUID for idempotency
  timestamp?: number;       // Client timestamp
}

export interface FlushResult {
  sent: number;
  failed: number;
}

export interface ScanSink {
  flush(scans: ScanData[]): Promise<FlushResult>;
  getPendingCount(): number;
  readonly supportsPersistence: boolean;
}

export interface QueueConfig {
  batchSize: number;
  flushIntervalMs: number;
  maxQueueSize: number;
  maxRetries: number;
}