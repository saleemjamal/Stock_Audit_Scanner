// Shared TypeScript types for the Stock Audit System

export interface Location {
  id: number;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string; // UUID
  email: string;
  full_name?: string;
  role: 'scanner' | 'supervisor' | 'admin';
  location_ids: number[];
  device_id?: string;
  active: boolean;
  last_login?: string;
  created_at: string;
  updated_at: string;
}

export interface AuditSession {
  id: string; // UUID
  location_id: number;
  total_rack_count: number;
  status: 'setup' | 'active' | 'completed' | 'cancelled';
  started_at?: string;
  started_by?: string;
  completed_at?: string;
  completed_by?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Rack {
  id: string; // UUID
  audit_session_id: string;
  location_id: number;
  rack_number: string;
  shelf_number?: string;
  status: 'available' | 'assigned' | 'scanning' | 'ready_for_approval' | 'approved' | 'rejected';
  scanner_id?: string;
  assigned_at?: string;
  ready_for_approval: boolean;
  ready_at?: string;
  approved_by?: string;
  approved_at?: string;
  rejected_by?: string;
  rejected_at?: string;
  rejection_reason?: string;
  total_scans: number;
  created_at: string;
  updated_at: string;
}

export interface Scan {
  id: string; // UUID
  barcode: string;
  rack_id: string;
  audit_session_id: string;
  scanner_id: string;
  device_id?: string;
  quantity: number;
  is_recount: boolean;
  recount_of?: string; // UUID of original scan
  manual_entry: boolean;
  notes?: string;
  created_at: string;
}

export interface Notification {
  id: string; // UUID
  user_id: string;
  type: 'approval_needed' | 'rack_approved' | 'rack_rejected' | 'audit_completed';
  title: string;
  message?: string;
  rack_id?: string;
  audit_session_id?: string;
  read: boolean;
  read_at?: string;
  created_at: string;
}

export interface AuditLogEntry {
  id: string; // UUID
  user_id?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface SyncQueueItem {
  id: string; // UUID
  device_id: string;
  data_type: 'scan' | 'rack_update' | 'user_action';
  payload: Record<string, any>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retry_count: number;
  error_message?: string;
  created_at: string;
  processed_at?: string;
}

// Utility types
export interface AuditSessionStats {
  total_racks: number;
  available_racks: number;
  assigned_racks: number;
  ready_racks: number;
  approved_racks: number;
  rejected_racks: number;
  total_scans: number;
}

export interface RackWithDetails extends Rack {
  scanner?: User;
  approver?: User;
  rejecter?: User;
  scans?: Scan[];
}

export interface AuditSessionWithDetails extends AuditSession {
  location?: Location;
  starter?: User;
  completer?: User;
  racks?: RackWithDetails[];
  stats?: AuditSessionStats;
}

// API Response types
export interface ApiResponse<T> {
  data?: T;
  error?: {
    message: string;
    code?: string;
    details?: any;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// Mobile app specific types
export interface ScannerConfig {
  autoFocus: boolean;
  vibrationEnabled: boolean;
  soundEnabled: boolean;
  scanDelay: number; // milliseconds
  batchSize: number;
  syncInterval: number; // minutes
}

export interface DeviceInfo {
  device_id: string;
  device_name: string;
  os_version: string;
  app_version: string;
  last_sync?: string;
}

// Report types
export interface ReportData {
  type: 'raw_sku' | 'detailed_audit' | 'summary_report';
  audit_session_id: string;
  location_id: number;
  generated_at: string;
  generated_by: string;
  data: any[];
}

export interface RawSKUReport {
  barcode: string;
  scan_count: number;
}

export interface DetailedAuditReport {
  barcode: string;
  rack_number: string;
  scanner_name: string;
  scan_timestamp: string;
  is_recount: boolean;
  manual_entry: boolean;
}

export interface SummaryReport {
  total_unique_skus: number;
  total_scan_count: number;
  total_racks: number;
  approved_racks: number;
  rejected_racks: number;
  scanners_count: number;
  audit_duration_minutes: number;
}