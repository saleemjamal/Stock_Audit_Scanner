# Offline Mode Implementation

## Local Database Setup

### 1. Install SQLite for React Native
```bash
npm install react-native-sqlite-storage
```

### 2. Local Database Schema
```javascript
// database/offlineDb.js
import SQLite from 'react-native-sqlite-storage';

export const initOfflineDB = async () => {
  const db = await SQLite.openDatabase({ name: 'stockaudit.db' });
  
  db.transaction((tx) => {
    tx.executeSql(`
      CREATE TABLE IF NOT EXISTS offline_scans (
        id TEXT PRIMARY KEY,
        barcode TEXT NOT NULL,
        rack_id TEXT,
        rack_number TEXT,
        shelf_number TEXT,
        user_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        synced INTEGER DEFAULT 0
      )
    `);
  });
  
  return db;
};
```

### 3. Scan Processing with Offline Support
```javascript
// services/scanService.js
import { supabase } from '../lib/supabase';
import NetInfo from '@react-native-community/netinfo';
import uuid from 'react-native-uuid';

export const processScan = async (barcode, rackInfo, db) => {
  const scanData = {
    id: uuid.v4(),
    barcode,
    rack_id: rackInfo.id,
    rack_number: rackInfo.number,
    shelf_number: rackInfo.shelf,
    user_id: global.userId,
    created_at: new Date().toISOString()
  };

  // Check connectivity
  const netState = await NetInfo.fetch();
  
  if (netState.isConnected) {
    try {
      // Try online first
      await supabase.from('scans').insert(scanData);
    } catch (error) {
      // Fallback to offline
      await saveOffline(db, scanData);
    }
  } else {
    // Save offline
    await saveOffline(db, scanData);
  }
};

const saveOffline = (db, scanData) => {
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        `INSERT INTO offline_scans (id, barcode, rack_id, rack_number, shelf_number, user_id) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [scanData.id, scanData.barcode, scanData.rack_id, scanData.rack_number, 
         scanData.shelf_number, scanData.user_id],
        (tx, results) => resolve(results),
        (tx, error) => reject(error)
      );
    });
  });
};
```

### 4. Background Sync
```javascript
// services/syncService.js
export const syncOfflineScans = async (db) => {
  const unsyncedScans = await getUnsyncedScans(db);
  
  for (const batch of chunk(unsyncedScans, 100)) {
    try {
      await supabase.from('scans').insert(batch);
      await markAsSynced(db, batch.map(s => s.id));
    } catch (error) {
      console.log('Sync failed, will retry later');
    }
  }
};

// Run sync when network restored
NetInfo.addEventListener(state => {
  if (state.isConnected) {
    syncOfflineScans(db);
  }
});
```

### 5. Complete Scan Screen with Offline
```javascript
const ScanScreen = () => {
  const [db, setDb] = useState(null);
  const [isOnline, setIsOnline] = useState(true);
  const [localCount, setLocalCount] = useState(0);
  
  useEffect(() => {
    initOfflineDB().then(setDb);
    
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected);
    });
    
    return () => unsubscribe();
  }, []);

  const handleScan = async (barcode) => {
    await processScan(barcode, currentRack, db);
    setLocalCount(prev => prev + 1);
    
    // Visual/audio feedback
    Vibration.vibrate(100);
  };

  return (
    <View>
      <Banner visible={!isOnline} style={{ backgroundColor: '#FFA500' }}>
        Offline Mode - Scans will sync when connected
      </Banner>
      
      {/* Scanner input and UI */}
    </View>
  );
};
```