import SQLite from 'react-native-sqlite-storage';
import { Scan, Rack, SyncQueueItem } from '../../../shared/types';

// Disable debug mode to reduce SQLite logging
SQLite.DEBUG(false);
SQLite.enablePromise(true);

const DATABASE_NAME = 'StockAudit.db';
const DATABASE_VERSION = '1.0';
const DATABASE_DISPLAYNAME = 'Stock Audit Local Database';
const DATABASE_SIZE = 200000;

class DatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;

  async initDatabase(): Promise<void> {
    try {
      this.db = await SQLite.openDatabase({
        name: DATABASE_NAME,
        version: DATABASE_VERSION,
        displayName: DATABASE_DISPLAYNAME,
        size: DATABASE_SIZE,
      });

      await this.createTables();
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Database initialization failed:', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    console.log('Creating database tables...');

    try {
      // Create tables one by one with progress logging
      await this.createScansTable();
      console.log('✅ Scans table created');

      await this.createRacksTable();
      console.log('✅ Racks table created');

      await this.createSyncQueueTable();
      console.log('✅ Sync queue table created');

      await this.createDeviceInfoTable();
      console.log('✅ Device info table created');

      await this.createUserPreferencesTable();
      console.log('✅ User preferences table created');

      // Create essential indexes only
      await this.createEssentialIndexes();
      console.log('✅ Essential indexes created');

      console.log('Database schema creation completed');
    } catch (error) {
      console.error('Error creating database schema:', error);
      throw error;
    }
  }

  private async createScansTable(): Promise<void> {
    const sql = `CREATE TABLE IF NOT EXISTS local_scans (
      id TEXT PRIMARY KEY,
      barcode TEXT NOT NULL,
      rack_id TEXT NOT NULL,
      audit_session_id TEXT NOT NULL,
      scanner_id TEXT NOT NULL,
      device_id TEXT,
      quantity INTEGER DEFAULT 1,
      is_recount BOOLEAN DEFAULT 0,
      recount_of TEXT,
      manual_entry BOOLEAN DEFAULT 0,
      notes TEXT,
      synced BOOLEAN DEFAULT 0,
      sync_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );`;
    await this.db!.executeSql(sql);
  }

  private async createRacksTable(): Promise<void> {
    const sql = `CREATE TABLE IF NOT EXISTS local_racks (
      id TEXT PRIMARY KEY,
      audit_session_id TEXT NOT NULL,
      location_id INTEGER NOT NULL,
      rack_number TEXT NOT NULL,
      shelf_number TEXT,
      status TEXT NOT NULL,
      scanner_id TEXT,
      assigned_at TEXT,
      ready_for_approval BOOLEAN DEFAULT 0,
      total_scans INTEGER DEFAULT 0,
      synced BOOLEAN DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );`;
    await this.db!.executeSql(sql);
  }

  private async createSyncQueueTable(): Promise<void> {
    const sql = `CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      data_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      retry_count INTEGER DEFAULT 0,
      error_message TEXT,
      created_at TEXT NOT NULL,
      processed_at TEXT
    );`;
    await this.db!.executeSql(sql);
  }

  private async createDeviceInfoTable(): Promise<void> {
    const sql = `CREATE TABLE IF NOT EXISTS device_info (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT UNIQUE NOT NULL,
      device_name TEXT,
      user_id TEXT,
      last_sync TEXT,
      total_scans INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );`;
    await this.db!.executeSql(sql);
  }

  private async createUserPreferencesTable(): Promise<void> {
    const sql = `CREATE TABLE IF NOT EXISTS user_preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT UNIQUE NOT NULL,
      scanner_config TEXT,
      ui_preferences TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );`;
    await this.db!.executeSql(sql);
  }

  private async createEssentialIndexes(): Promise<void> {
    // Only create the most essential indexes for performance
    const essentialIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_local_scans_rack ON local_scans(rack_id);',
      'CREATE INDEX IF NOT EXISTS idx_local_scans_synced ON local_scans(synced);',
      'CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);',
    ];

    for (const sql of essentialIndexes) {
      await this.db!.executeSql(sql);
    }
  }

  // Method to create additional indexes later if needed
  async createAdditionalIndexes(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const additionalIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_local_scans_barcode ON local_scans(barcode);',
      'CREATE INDEX IF NOT EXISTS idx_local_scans_created ON local_scans(created_at);',
      'CREATE INDEX IF NOT EXISTS idx_local_racks_session ON local_racks(audit_session_id);',
      'CREATE INDEX IF NOT EXISTS idx_local_racks_status ON local_racks(status);',
      'CREATE INDEX IF NOT EXISTS idx_sync_queue_device ON sync_queue(device_id);',
    ];

    for (const sql of additionalIndexes) {
      await this.db.executeSql(sql);
    }
  }

  // Scan operations
  async addScan(scanData: Omit<Scan, 'id' | 'created_at'>): Promise<string> {
    if (!this.db) throw new Error('Database not initialized');

    const id = this.generateId();
    const now = new Date().toISOString();

    await this.db.executeSql(
      `INSERT INTO local_scans (
        id, barcode, rack_id, audit_session_id, scanner_id, device_id,
        quantity, is_recount, recount_of, manual_entry, notes, synced,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        scanData.barcode,
        scanData.rack_id,
        scanData.audit_session_id,
        scanData.scanner_id,
        scanData.device_id || '',
        scanData.quantity || 1,
        scanData.is_recount ? 1 : 0,
        scanData.recount_of || '',
        scanData.manual_entry ? 1 : 0,
        scanData.notes || '',
        0, // not synced initially
        now,
        now,
      ]
    );

    return id;
  }

  async getScansForRack(rackId: string): Promise<Scan[]> {
    if (!this.db) throw new Error('Database not initialized');

    const [results] = await this.db.executeSql(
      'SELECT * FROM local_scans WHERE rack_id = ? ORDER BY created_at DESC',
      [rackId]
    );

    const scans: Scan[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      const row = results.rows.item(i);
      scans.push({
        ...row,
        is_recount: Boolean(row.is_recount),
        manual_entry: Boolean(row.manual_entry),
      });
    }

    return scans;
  }

  async getUnsyncedScans(): Promise<Scan[]> {
    if (!this.db) throw new Error('Database not initialized');

    const [results] = await this.db.executeSql(
      'SELECT * FROM local_scans WHERE synced = 0 ORDER BY created_at ASC LIMIT 100'
    );

    const scans: Scan[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      const row = results.rows.item(i);
      scans.push({
        ...row,
        is_recount: Boolean(row.is_recount),
        manual_entry: Boolean(row.manual_entry),
      });
    }

    return scans;
  }

  async markScansAsSynced(scanIds: string[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const placeholders = scanIds.map(() => '?').join(',');
    await this.db.executeSql(
      `UPDATE local_scans SET synced = 1, updated_at = ? WHERE id IN (${placeholders})`,
      [new Date().toISOString(), ...scanIds]
    );
  }

  async markScanSyncError(scanId: string, error: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.executeSql(
      'UPDATE local_scans SET sync_error = ?, updated_at = ? WHERE id = ?',
      [error, new Date().toISOString(), scanId]
    );
  }

  // Rack operations
  async cacheRack(rack: Rack): Promise<void> {
    if (!this.db) {
      return; // Don't throw, just skip caching if database not ready
    }

    const now = new Date().toISOString();

    try {
      await this.db.executeSql(
        `INSERT OR REPLACE INTO local_racks (
          id, audit_session_id, location_id, rack_number, shelf_number,
          status, scanner_id, assigned_at, ready_for_approval, total_scans,
          synced, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          rack.id,
          rack.audit_session_id,
          rack.location_id,
          rack.rack_number,
          rack.shelf_number || '',
          rack.status,
          rack.scanner_id || '',
          rack.assigned_at || '',
          rack.ready_for_approval ? 1 : 0,
          rack.total_scans || 0,
          1, // cached from server
          rack.created_at || now,
          now,
        ]
      );
    } catch (error) {
      // Don't throw - caching is optional for offline support
      console.warn('Background rack caching failed:', rack.rack_number);
    }
  }

  async getCachedRacks(auditSessionId: string): Promise<Rack[]> {
    if (!this.db) throw new Error('Database not initialized');

    const [results] = await this.db.executeSql(
      'SELECT * FROM local_racks WHERE audit_session_id = ? ORDER BY rack_number',
      [auditSessionId]
    );

    const racks: Rack[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      const row = results.rows.item(i);
      racks.push({
        ...row,
        ready_for_approval: Boolean(row.ready_for_approval),
      });
    }

    return racks;
  }

  async updateRackStatus(rackId: string, status: string, additionalData?: Partial<Rack>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const updateFields = ['status = ?', 'updated_at = ?'];
    const updateValues = [status, new Date().toISOString()];

    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        if (key !== 'id' && key !== 'created_at') {
          updateFields.push(`${key} = ?`);
          updateValues.push(value);
        }
      });
    }

    updateValues.push(rackId); // for WHERE clause

    await this.db.executeSql(
      `UPDATE local_racks SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );
  }

  // Sync queue operations
  async addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'created_at'>): Promise<string> {
    if (!this.db) throw new Error('Database not initialized');

    const id = this.generateId();
    const now = new Date().toISOString();

    await this.db.executeSql(
      `INSERT INTO sync_queue (
        id, device_id, data_type, payload, status, retry_count,
        error_message, created_at, processed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        item.device_id,
        item.data_type,
        JSON.stringify(item.payload),
        item.status || 'pending',
        item.retry_count || 0,
        item.error_message || '',
        now,
        item.processed_at || '',
      ]
    );

    return id;
  }

  async getPendingSyncItems(): Promise<SyncQueueItem[]> {
    if (!this.db) throw new Error('Database not initialized');

    const [results] = await this.db.executeSql(
      'SELECT * FROM sync_queue WHERE status = ? ORDER BY created_at ASC LIMIT 50',
      ['pending']
    );

    const items: SyncQueueItem[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      const row = results.rows.item(i);
      items.push({
        ...row,
        payload: JSON.parse(row.payload),
      });
    }

    return items;
  }

  async updateSyncItemStatus(itemId: string, status: string, errorMessage?: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();
    await this.db.executeSql(
      'UPDATE sync_queue SET status = ?, error_message = ?, processed_at = ? WHERE id = ?',
      [status, errorMessage || '', now, itemId]
    );
  }

  async incrementSyncRetry(itemId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.executeSql(
      'UPDATE sync_queue SET retry_count = retry_count + 1 WHERE id = ?',
      [itemId]
    );
  }

  // Device info operations
  async updateDeviceInfo(deviceId: string, info: any): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();

    await this.db.executeSql(
      `INSERT OR REPLACE INTO device_info (
        device_id, device_name, user_id, last_sync, total_scans, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        deviceId,
        info.device_name || '',
        info.user_id || '',
        info.last_sync || '',
        info.total_scans || 0,
        now,
        now,
      ]
    );
  }

  async getDeviceInfo(deviceId: string): Promise<any> {
    if (!this.db) throw new Error('Database not initialized');

    const [results] = await this.db.executeSql(
      'SELECT * FROM device_info WHERE device_id = ?',
      [deviceId]
    );

    if (results.rows.length > 0) {
      return results.rows.item(0);
    }

    return null;
  }

  // Utility methods
  async getScanCountForRack(rackId: string): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    const [results] = await this.db.executeSql(
      'SELECT COUNT(*) as count FROM local_scans WHERE rack_id = ?',
      [rackId]
    );

    return results.rows.item(0).count;
  }

  async clearOldData(daysOld: number = 30): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    const cutoffISO = cutoffDate.toISOString();

    // Clear old synced scans
    await this.db.executeSql(
      'DELETE FROM local_scans WHERE synced = 1 AND created_at < ?',
      [cutoffISO]
    );

    // Clear old completed sync queue items
    await this.db.executeSql(
      'DELETE FROM sync_queue WHERE status = ? AND processed_at < ?',
      ['completed', cutoffISO]
    );
  }

  async closeDatabase(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2)}`;
  }
}

export default new DatabaseService();