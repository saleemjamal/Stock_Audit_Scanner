// Shared constants across mobile and web applications

export const USER_ROLES = {
  SCANNER: 'scanner',
  SUPERVISOR: 'supervisor',
  ADMIN: 'admin',
} as const;

export const AUDIT_SESSION_STATUS = {
  SETUP: 'setup',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export const RACK_STATUS = {
  AVAILABLE: 'available',
  ASSIGNED: 'assigned',
  SCANNING: 'scanning',
  READY_FOR_APPROVAL: 'ready_for_approval',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export const NOTIFICATION_TYPES = {
  APPROVAL_NEEDED: 'approval_needed',
  RACK_APPROVED: 'rack_approved',
  RACK_REJECTED: 'rack_rejected',
  AUDIT_COMPLETED: 'audit_completed',
} as const;

export const SYNC_QUEUE_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export const DATA_TYPES = {
  SCAN: 'scan',
  RACK_UPDATE: 'rack_update',
  USER_ACTION: 'user_action',
} as const;

// Scanner configuration defaults
export const SCANNER_DEFAULTS = {
  AUTO_FOCUS: true,
  VIBRATION_ENABLED: true,
  SOUND_ENABLED: true,
  SCAN_DELAY: 100, // milliseconds
  BATCH_SIZE: 100,
  SYNC_INTERVAL: 5, // minutes
  MAX_RETRY_COUNT: 3,
  CONNECTION_TIMEOUT: 30000, // 30 seconds
} as const;

// UI Constants
export const COLORS = {
  PRIMARY: '#1976d2',
  SECONDARY: '#dc004e',
  SUCCESS: '#388e3c',
  WARNING: '#f57c00',
  ERROR: '#d32f2f',
  INFO: '#0288d1',
  BACKGROUND: '#f5f5f5',
  SURFACE: '#ffffff',
  TEXT_PRIMARY: '#212121',
  TEXT_SECONDARY: '#757575',
} as const;

export const SPACING = {
  XS: 4,
  SM: 8,
  MD: 16,
  LG: 24,
  XL: 32,
  XXL: 48,
} as const;

// Database table names
export const TABLES = {
  LOCATIONS: 'locations',
  USERS: 'users',
  AUDIT_SESSIONS: 'audit_sessions',
  RACKS: 'racks',
  SCANS: 'scans',
  NOTIFICATIONS: 'notifications',
  AUDIT_LOG: 'audit_log',
  SYNC_QUEUE: 'sync_queue',
} as const;

// Supabase channels
export const REALTIME_CHANNELS = {
  RACKS: 'racks-changes',
  NOTIFICATIONS: 'notifications-changes',
  AUDIT_SESSIONS: 'audit-sessions-changes',
  SCANS: 'scans-changes',
} as const;

// Error messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network connection error. Please check your internet connection.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  FORBIDDEN: 'Access denied. Please contact your administrator.',
  NOT_FOUND: 'The requested resource was not found.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  SERVER_ERROR: 'Server error occurred. Please try again later.',
  SYNC_FAILED: 'Failed to sync data. Will retry automatically.',
  SCANNER_ERROR: 'Scanner connection error. Please check USB connection.',
  BARCODE_INVALID: 'Invalid barcode format.',
  RACK_NOT_ASSIGNED: 'Please select a rack before scanning.',
  ALREADY_APPROVED: 'This rack has already been approved.',
  INSUFFICIENT_PERMISSIONS: 'You do not have permission to perform this action.',
} as const;

// Success messages
export const SUCCESS_MESSAGES = {
  SCAN_ADDED: 'Barcode scanned successfully',
  RACK_READY: 'Rack marked as ready for approval',
  RACK_APPROVED: 'Rack approved successfully',
  RACK_REJECTED: 'Rack rejected successfully',
  AUDIT_COMPLETED: 'Audit session completed successfully',
  SYNC_COMPLETED: 'Data synchronized successfully',
  PROFILE_UPDATED: 'Profile updated successfully',
  NOTIFICATION_READ: 'Notification marked as read',
} as const;

// File and storage
export const STORAGE = {
  BUCKETS: {
    REPORTS: 'reports',
    TEMP: 'temp',
  },
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  ALLOWED_TYPES: ['text/csv', 'application/json'],
} as const;

// Report constants
export const REPORT_TYPES = {
  RAW_SKU: 'raw_sku',
  DETAILED_AUDIT: 'detailed_audit',
  SUMMARY_REPORT: 'summary_report',
} as const;

// Validation rules
export const VALIDATION = {
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  BARCODE_MIN_LENGTH: 8,
  BARCODE_MAX_LENGTH: 50,
  RACK_NUMBER_REGEX: /^[A-Z0-9-]+$/i,
  PASSWORD_MIN_LENGTH: 8,
  MAX_RETRY_ATTEMPTS: 3,
} as const;

// Local storage keys
export const STORAGE_KEYS = {
  USER_PREFERENCES: 'user_preferences',
  SCANNER_CONFIG: 'scanner_config',
  DEVICE_INFO: 'device_info',
  LAST_SYNC: 'last_sync',
  OFFLINE_QUEUE: 'offline_queue',
  AUTH_TOKEN: 'auth_token',
} as const;

// Time constants
export const TIME = {
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
} as const;