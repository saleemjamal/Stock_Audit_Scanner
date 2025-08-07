# Technical Implementation Guide
## Stock Audit Scanner App - Android

### 1. Project Setup

#### 1.1 Initialize React Native Project
```bash
npx react-native init StockAuditApp
cd StockAuditApp
```

#### 1.2 Required Dependencies
```bash
# Core dependencies
npm install @react-navigation/native @react-navigation/stack
npm install react-native-screens react-native-safe-area-context
npm install @reduxjs/toolkit react-redux
npm install react-native-sqlite-storage
npm install react-native-vector-icons
npm install react-native-uuid
npm install @react-native-async-storage/async-storage
npm install react-native-permissions

# Google Sheets integration
npm install googleapis
npm install react-native-fs

# USB Serial communication (for advanced scanner integration)
npm install react-native-usb-serialport-for-android

# UI components
npm install react-native-paper
npm install react-native-modal
npm install react-native-progress
```

### 2. Android Configuration

#### 2.1 AndroidManifest.xml Permissions
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.VIBRATE" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-feature android:name="android.hardware.usb.host" />
```

#### 2.2 USB OTG Configuration
Add to `android/app/src/main/AndroidManifest.xml`:
```xml
<intent-filter>
    <action android:name="android.hardware.usb.action.USB_DEVICE_ATTACHED" />
</intent-filter>
<meta-data 
    android:name="android.hardware.usb.action.USB_DEVICE_ATTACHED"
    android:resource="@xml/device_filter" />
```

### 3. Core Components Implementation

#### 3.1 Scanner Input Handler
```javascript
// components/ScannerInput.js
import React, { useState, useEffect, useRef } from 'react';
import { TextInput, View, Alert } from 'react-native';
import { useDispatch } from 'react-redux';
import { addScan } from '../store/scanSlice';

const ScannerInput = ({ onScan }) => {
  const [inputValue, setInputValue] = useState('');
  const [lastInputTime, setLastInputTime] = useState(Date.now());
  const inputRef = useRef(null);
  const dispatch = useDispatch();

  useEffect(() => {
    // Auto-focus on mount
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleChangeText = (text) => {
    const currentTime = Date.now();
    const timeDiff = currentTime - lastInputTime;
    
    // Detect scanner input (rapid character entry)
    if (timeDiff < 50) {
      setInputValue(text);
    } else {
      // Manual input
      setInputValue(text);
    }
    
    setLastInputTime(currentTime);
    
    // Check for scan completion (tab or newline)
    if (text.includes('\t') || text.includes('\n')) {
      const barcode = text.replace(/[\t\n]/g, '').trim();
      if (barcode) {
        processScan(barcode);
      }
    }
  };

  const processScan = (barcode) => {
    // Dispatch to Redux store
    dispatch(addScan({
      barcode,
      timestamp: new Date().toISOString(),
      deviceId: DeviceInfo.getDeviceId(),
    }));
    
    // Clear input
    setInputValue('');
    
    // Haptic feedback
    if (Platform.OS === 'android') {
      Vibration.vibrate(100);
    }
    
    // Keep focus
    if (inputRef.current) {
      inputRef.current.focus();
    }
    
    // Callback
    if (onScan) {
      onScan(barcode);
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        ref={inputRef}
        value={inputValue}
        onChangeText={handleChangeText}
        style={styles.hiddenInput}
        autoFocus={true}
        showSoftInputOnFocus={false}
        caretHidden={true}
      />
    </View>
  );
};

export default ScannerInput;
```

#### 3.2 Database Schema
```javascript
// database/schema.js
export const createTables = (db) => {
  // Scans table
  db.transaction((tx) => {
    tx.executeSql(
      `CREATE TABLE IF NOT EXISTS scans (
        id TEXT PRIMARY KEY,
        barcode TEXT NOT NULL,
        sku TEXT,
        timestamp TEXT NOT NULL,
        device_id TEXT NOT NULL,
        user_id TEXT,
        location TEXT,
        quantity INTEGER DEFAULT 1,
        synced INTEGER DEFAULT 0,
        sync_timestamp TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );`
    );

    // Create indexes for performance
    tx.executeSql(
      'CREATE INDEX IF NOT EXISTS idx_barcode ON scans(barcode);'
    );
    tx.executeSql(
      'CREATE INDEX IF NOT EXISTS idx_synced ON scans(synced);'
    );
    tx.executeSql(
      'CREATE INDEX IF NOT EXISTS idx_timestamp ON scans(timestamp);'
    );
    
    // Device info table
    tx.executeSql(
      `CREATE TABLE IF NOT EXISTS device_info (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT UNIQUE NOT NULL,
        device_name TEXT,
        user_id TEXT,
        last_sync TEXT,
        total_scans INTEGER DEFAULT 0
      );`
    );
    
    // Sync queue table
    tx.executeSql(
      `CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_data TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        retry_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );`
    );
  });
};
```

#### 3.3 Google Sheets Integration
```javascript
// services/GoogleSheetsService.js
import { google } from 'googleapis';
import RNFS from 'react-native-fs';

class GoogleSheetsService {
  constructor() {
    this.sheets = null;
    this.spreadsheetId = 'YOUR_SPREADSHEET_ID';
    this.initialized = false;
  }

  async initialize() {
    try {
      // Load service account credentials
      const credentialsPath = `${RNFS.DocumentDirectoryPath}/credentials.json`;
      const credentials = JSON.parse(await RNFS.readFile(credentialsPath));
      
      // Create JWT client
      const jwtClient = new google.auth.JWT(
        credentials.client_email,
        null,
        credentials.private_key,
        ['https://www.googleapis.com/auth/spreadsheets']
      );

      await jwtClient.authorize();
      
      this.sheets = google.sheets({ version: 'v4', auth: jwtClient });
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize Google Sheets:', error);
      throw error;
    }
  }

  async batchUpload(scans) {
    if (!this.initialized) {
      await this.initialize();
    }

    const values = scans.map(scan => [
      scan.timestamp,
      scan.device_id,
      scan.user_id || '',
      scan.barcode,
      scan.sku || '',
      scan.location || '',
      scan.quantity,
      new Date().toISOString()
    ]);

    try {
      const response = await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'Scans!A:H',
        valueInputOption: 'USER_ENTERED',
        resource: { values }
      });
      
      return response.data;
    } catch (error) {
      console.error('Upload failed:', error);
      throw error;
    }
  }
}

export default new GoogleSheetsService();
```

### 4. Redux Store Configuration
```javascript
// store/index.js
import { configureStore } from '@reduxjs/toolkit';
import scanReducer from './scanSlice';
import syncReducer from './syncSlice';
import deviceReducer from './deviceSlice';

export const store = configureStore({
  reducer: {
    scans: scanReducer,
    sync: syncReducer,
    device: deviceReducer,
  },
});
```

### 5. Sync Manager Implementation
```javascript
// services/SyncManager.js
import SQLite from 'react-native-sqlite-storage';
import GoogleSheetsService from './GoogleSheetsService';
import NetInfo from '@react-native-community/netinfo';

class SyncManager {
  constructor() {
    this.syncInProgress = false;
    this.syncInterval = null;
    this.db = null;
  }

  async initialize(database) {
    this.db = database;
    this.startAutoSync();
  }

  startAutoSync() {
    // Sync every 5 minutes
    this.syncInterval = setInterval(() => {
      this.syncPendingScans();
    }, 5 * 60 * 1000);
  }

  async syncPendingScans() {
    if (this.syncInProgress) return;
    
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) return;
    
    this.syncInProgress = true;
    
    try {
      // Get unsynced scans
      const unsyncedScans = await this.getUnsyncedScans();
      
      if (unsyncedScans.length === 0) {
        this.syncInProgress = false;
        return;
      }
      
      // Process in batches of 100
      const batchSize = 100;
      for (let i = 0; i < unsyncedScans.length; i += batchSize) {
        const batch = unsyncedScans.slice(i, i + batchSize);
        
        try {
          await GoogleSheetsService.batchUpload(batch);
          await this.markAsSynced(batch.map(s => s.id));
        } catch (error) {
          console.error('Batch sync failed:', error);
          // Continue with next batch
        }
      }
    } finally {
      this.syncInProgress = false;
    }
  }

  async getUnsyncedScans() {
    return new Promise((resolve, reject) => {
      this.db.transaction((tx) => {
        tx.executeSql(
          'SELECT * FROM scans WHERE synced = 0 ORDER BY timestamp ASC LIMIT 500',
          [],
          (tx, results) => {
            const scans = [];
            for (let i = 0; i < results.rows.length; i++) {
              scans.push(results.rows.item(i));
            }
            resolve(scans);
          },
          (tx, error) => reject(error)
        );
      });
    });
  }

  async markAsSynced(scanIds) {
    return new Promise((resolve, reject) => {
      this.db.transaction((tx) => {
        const placeholders = scanIds.map(() => '?').join(',');
        tx.executeSql(
          `UPDATE scans SET synced = 1, sync_timestamp = ? WHERE id IN (${placeholders})`,
          [new Date().toISOString(), ...scanIds],
          (tx, results) => resolve(results),
          (tx, error) => reject(error)
        );
      });
    });
  }
}

export default new SyncManager();
```

### 6. Performance Optimizations

#### 6.1 Scanner Input Optimization
- Disable auto-correct and predictive text
- Use hardware acceleration for UI updates
- Implement debouncing for rapid scans

#### 6.2 Database Optimization
- Use transactions for bulk operations
- Implement proper indexing
- Regular vacuum operations
- Limit query result sets

#### 6.3 Memory Management
- Implement list virtualization for large datasets
- Clear unused data from Redux store
- Proper cleanup in useEffect hooks
- Limit in-memory cache size

### 7. Testing Strategy

#### 7.1 Unit Tests
```javascript
// __tests__/ScannerInput.test.js
import { processScan } from '../utils/scannerUtils';

describe('Scanner Input Processing', () => {
  test('should detect valid barcode', () => {
    const result = processScan('123456789012\t');
    expect(result.barcode).toBe('123456789012');
    expect(result.isValid).toBe(true);
  });
});
```
