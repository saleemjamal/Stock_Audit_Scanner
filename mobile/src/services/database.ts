import { open, type DB } from '@op-engineering/op-sqlite';
import { Scan, Rack, SyncQueueItem } from '../../../shared/types';

const DATABASE_NAME = 'StockAudit.db';

class BatchManager {
  private memoryBuffer: Array<Omit<Scan, 'id' | 'created_at'> & { tempId: number }> = [];
  private db: DB;
  private insertStmt: any;
  
  // Conservative defaults for production
  private BATCH_SIZE = 50;                // Flush every 50 scans
  private BATCH_TIMEOUT_MS = 2000;        // Force flush after 2 seconds
  private flushTimer: NodeJS.Timeout | null = null;
  
  constructor(db: DB) {
    this.db = db;
  }
  
  async initialize() {
    try {
      console.log('📝 BatchManager: Preparing insert statement...');
      // Prepare statement once, reuse many times
      this.insertStmt = this.db.prepareStatement(
        `INSERT INTO local_scans (id, barcode, rack_id, audit_session_id, scanner_id, 
                                 device_id, quantity, manual_entry, notes, synced, 
                                 created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      console.log('✅ BatchManager: Insert statement prepared successfully');
    } catch (error) {
      console.error('💥 BatchManager: Failed to prepare statement:', error);
      throw error;
    }
  }
  
  async addScan(scan: Omit<Scan, 'id' | 'created_at'>): Promise<number> {
    const scanId = Date.now(); // Use timestamp as INTEGER ID
    this.memoryBuffer.push({ ...scan, tempId: scanId });
    
    if (this.memoryBuffer.length >= this.BATCH_SIZE) {
      await this.flush();
    } else {
      this.scheduleFlush();
    }
    
    return scanId; // Instant return for UI
  }
  
  private scheduleFlush() {
    if (this.flushTimer) return;
    
    this.flushTimer = setTimeout(() => {
      this.flush().catch(console.error);
    }, this.BATCH_TIMEOUT_MS);
  }
  
  async flush() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    
    if (this.memoryBuffer.length === 0) return;
    
    const batch = [...this.memoryBuffer];
    this.memoryBuffer = [];
    
    console.log(`🔄 Flushing batch of ${batch.length} scans...`);
    
    // Single transaction for entire batch
    await this.db.execute('BEGIN IMMEDIATE');
    try {
      const now = Math.floor(Date.now() / 1000); // Unix timestamp
      
      for (const scan of batch) {
        await this.insertStmt.bind([
          scan.tempId, scan.barcode, scan.rack_id, scan.audit_session_id,
          scan.scanner_id, scan.device_id || '', scan.quantity || 1, 
          scan.manual_entry ? 1 : 0, scan.notes || '', 0, null, // sync_error as NULL
          now, now // Unix timestamps for created_at, updated_at
        ]);
        await this.insertStmt.execute();
      }
      await this.db.execute('COMMIT');
      console.log(`✅ Batch committed successfully`);
    } catch (error) {
      await this.db.execute('ROLLBACK');
      console.error('❌ Batch failed, rolled back:', error);
      throw error;
    }
  }
  
  async cleanup() {
    await this.flush();
    // Note: op-sqlite prepared statements don't need explicit finalization
  }
  
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2)}`;
  }
}

class DatabaseService {
  private db: DB | null = null;
  private batchManager: BatchManager | null = null;

  async initDatabase(): Promise<void> {
    try {
      console.log('🗄️ Opening op-sqlite database...');
      console.log('Database name:', DATABASE_NAME);
      const start = performance.now();
      
      // 1. Open database with op-sqlite
      console.log('Step 1: Opening database...');
      this.db = open({ name: DATABASE_NAME });
      console.log('Database object created:', !!this.db);
      
      console.log(`✅ Database opened in ${performance.now() - start}ms`);
      
      // 2. Apply performance optimizations
      console.log('Step 2: Applying performance optimizations...');
      await this.applyPerformanceOptimizations();
      console.log('✅ Performance optimizations applied');
      
      // 3. Create simplified table structure
      console.log('Step 3: Creating tables...');
      await this.createTablesSimplified();
      console.log('✅ Tables created');
      
      // 4. Initialize batch manager
      console.log('Step 4: Initializing batch manager...');
      this.batchManager = new BatchManager(this.db);
      console.log('Batch manager created, initializing...');
      await this.batchManager.initialize();
      console.log('✅ Batch manager initialized');
      
      console.log('🎉 Database fully initialized successfully');
    } catch (error) {
      console.error('💥 Database initialization FAILED at step:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      console.error('Stack trace:', error.stack);
      throw error;
    }
  }

  private async applyPerformanceOptimizations(): Promise<void> {
    if (!this.db) {
      console.error('❌ Database is null in applyPerformanceOptimizations');
      return;
    }

    console.log('⚡ Applying production-safe SQLite optimizations...');
    
    const pragmas = [
      { name: 'journal_mode', value: 'WAL', description: 'Enable WAL mode' },
      { name: 'synchronous', value: 'NORMAL', description: 'Balance performance/safety' },
      { name: 'cache_size', value: '8000', description: '32MB cache' },
      { name: 'temp_store', value: 'MEMORY', description: 'Store temp data in memory' },
      { name: 'busy_timeout', value: '3000', description: '3 second timeout' },
      { name: 'wal_autocheckpoint', value: '2000', description: 'Prevent WAL bloat' },
      { name: 'mmap_size', value: '67108864', description: '64MB memory map' },
    ];

    for (const pragma of pragmas) {
      try {
        console.log(`Applying PRAGMA ${pragma.name}=${pragma.value} (${pragma.description})`);
        await this.db.execute(`PRAGMA ${pragma.name}=${pragma.value}`);
        console.log(`✅ ${pragma.name} applied successfully`);
      } catch (error) {
        console.error(`❌ Failed to apply PRAGMA ${pragma.name}:`, error);
        // Continue with others - these are optimizations, not requirements
      }
    }
    
    console.log('✅ Performance optimizations completed');
  }

  private async createTablesSimplified(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    console.log('🏗️ Creating optimized tables for scanning...');

    try {
      // Create only the essential scanning table
      await this.createScansTable();
      console.log('✅ Scans table created');

      // Create minimal sync queue table
      await this.createSyncQueueTable();
      console.log('✅ Sync queue table created');

      // Create racks table for offline caching
      await this.createRacksTable();
      console.log('✅ Racks table created');

      // Create device info table
      await this.createDeviceInfoTable();
      console.log('✅ Device info table created');

      // Skip indexes during scanning mode for maximum insert speed
      console.log('⚡ Skipping indexes for maximum insert performance');
      
      console.log('✅ Database schema creation completed');
    } catch (error) {
      console.error('❌ Error creating database schema:', error);
      throw error;
    }
  }

  private async createScansTable(): Promise<void> {
    console.log('📋 Creating optimized scans table...');
    
    // Optimized schema using INTEGER PRIMARY KEY (uses rowid)
    const sql = `CREATE TABLE IF NOT EXISTS local_scans (
      id INTEGER PRIMARY KEY,           -- Uses rowid for fastest performance
      barcode TEXT NOT NULL,
      rack_id INTEGER NOT NULL,         -- Keep hot columns narrow
      audit_session_id INTEGER NOT NULL,
      scanner_id INTEGER NOT NULL,
      device_id TEXT,
      quantity INTEGER DEFAULT 1,
      manual_entry INTEGER DEFAULT 0,   -- BOOLEAN as INTEGER
      notes TEXT,
      synced INTEGER DEFAULT 0,
      sync_error TEXT,
      created_at INTEGER NOT NULL,      -- Unix timestamp faster than TEXT
      updated_at INTEGER NOT NULL
    );`;
    
    try {
      await this.db!.execute(sql);
      console.log('✅ Scans table created with optimized schema');
    } catch (error) {
      console.error('❌ Failed to create scans table:', error);
      throw error;
    }
  }

  private async createSyncQueueTable(): Promise<void> {
    console.log('📦 Creating sync queue table...');
    
    const sql = `CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY,          -- Use rowid for performance
      device_id TEXT NOT NULL,
      data_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      retry_count INTEGER DEFAULT 0,
      error_message TEXT,
      created_at INTEGER NOT NULL,     -- Unix timestamp
      processed_at INTEGER
    );`;
    
    try {
      await this.db!.execute(sql);
      console.log('✅ Sync queue table created');
    } catch (error) {
      console.error('❌ Failed to create sync queue table:', error);
      throw error;
    }
  }

  // Create indexes for reading operations (after heavy inserting is done)
  async createReadingIndexes(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    console.log('🔗 Creating reading indexes...');
    
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_scans_synced ON local_scans(synced)',
      'CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status)',
    ];

    for (const sql of indexes) {
      await this.db.execute(sql);
    }
    
    console.log('✅ Reading indexes created');
  }

  private async createRacksTable(): Promise<void> {
    console.log('🗂️ Creating racks table...');
    
    const sql = `CREATE TABLE IF NOT EXISTS local_racks (
      id INTEGER PRIMARY KEY,           -- Use rowid for performance
      audit_session_id INTEGER NOT NULL,
      location_id INTEGER NOT NULL,
      rack_number TEXT NOT NULL,
      shelf_number TEXT,
      status TEXT NOT NULL,
      scanner_id INTEGER,
      assigned_at INTEGER,              -- Unix timestamp
      ready_for_approval INTEGER DEFAULT 0,
      total_scans INTEGER DEFAULT 0,
      synced INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );`;
    
    try {
      await this.db!.execute(sql);
      console.log('✅ Racks table created with optimized schema');
    } catch (error) {
      console.error('❌ Failed to create racks table:', error);
      throw error;
    }
  }

  private async createDeviceInfoTable(): Promise<void> {
    console.log('📱 Creating device info table...');
    
    const sql = `CREATE TABLE IF NOT EXISTS device_info (
      id INTEGER PRIMARY KEY,
      device_id TEXT UNIQUE NOT NULL,
      device_name TEXT,
      user_id INTEGER,
      last_sync INTEGER,               -- Unix timestamp
      total_scans INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );`;
    
    try {
      await this.db!.execute(sql);
      console.log('✅ Device info table created');
    } catch (error) {
      console.error('❌ Failed to create device info table:', error);
      throw error;
    }
  }

  // Fast scan insertion using batch manager
  async addScan(scanData: Omit<Scan, 'id' | 'created_at'>): Promise<number> {
    console.log('📝 DatabaseService.addScan called with:', scanData.barcode);
    
    if (!this.batchManager) {
      console.error('❌ Batch manager not initialized!');
      throw new Error('Batch manager not initialized');
    }

    if (!this.db) {
      console.error('❌ Database not initialized!');
      throw new Error('Database not initialized');
    }

    try {
      const start = performance.now();
      console.log('🔄 Calling batchManager.addScan...');
      const scanId = await this.batchManager.addScan(scanData);
      const elapsed = performance.now() - start;
      
      console.log(`⚡ Scan added to batch in ${elapsed.toFixed(2)}ms, ID: ${scanId}`);
      return scanId;
    } catch (error) {
      console.error('💥 addScan failed:', error);
      console.error('Error stack:', error.stack);
      throw error;
    }
  }

  async getUnsyncedScans(): Promise<Scan[]> {
    if (!this.db) throw new Error('Database not initialized');

    const results = await this.db.execute(
      'SELECT * FROM local_scans WHERE synced = 0 ORDER BY created_at ASC LIMIT 100'
    );

    return results.rows || [];
  }

  async markScansAsSynced(scanIds: number[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const placeholders = scanIds.map(() => '?').join(',');
    const now = Math.floor(Date.now() / 1000);
    
    await this.db.execute(
      `UPDATE local_scans SET synced = 1, updated_at = ? WHERE id IN (${placeholders})`,
      [now, ...scanIds]
    );
  }

  async getScanCountForRack(rackId: string): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    const results = await this.db.execute(
      'SELECT COUNT(*) as count FROM local_scans WHERE rack_id = ?',
      [rackId]
    );

    return results.rows?.[0]?.count || 0;
  }

  // Essential sync operations for the batch system
  async addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'created_at'>): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    const now = Math.floor(Date.now() / 1000);
    
    const results = await this.db.execute(
      `INSERT INTO sync_queue (
        device_id, data_type, payload, status, retry_count,
        error_message, created_at, processed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.device_id,
        item.data_type,
        JSON.stringify(item.payload),
        item.status || 'pending',
        item.retry_count || 0,
        item.error_message || '',
        now,
        item.processed_at || null,
      ]
    );

    return results.insertId;
  }

  async getPendingSyncItems(): Promise<SyncQueueItem[]> {
    if (!this.db) throw new Error('Database not initialized');

    const results = await this.db.execute(
      'SELECT * FROM sync_queue WHERE status = ? ORDER BY created_at ASC LIMIT 50',
      ['pending']
    );

    return (results.rows || []).map(row => ({
      ...row,
      payload: JSON.parse(row.payload),
    }));
  }

  async updateSyncItemStatus(itemId: number, status: string, errorMessage?: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const now = Math.floor(Date.now() / 1000);
    await this.db.execute(
      'UPDATE sync_queue SET status = ?, error_message = ?, processed_at = ? WHERE id = ?',
      [status, errorMessage || '', now, itemId]
    );
  }

  async incrementSyncRetry(itemId: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.execute(
      'UPDATE sync_queue SET retry_count = retry_count + 1 WHERE id = ?',
      [itemId]
    );
  }

  // Rack operations (restored with op-sqlite)
  async cacheRack(rack: Rack): Promise<void> {
    if (!this.db) {
      return; // Don't throw, just skip caching if database not ready
    }

    const now = Math.floor(Date.now() / 1000);

    try {
      await this.db.execute(
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
          rack.assigned_at || now,
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

    const results = await this.db.execute(
      'SELECT * FROM local_racks WHERE audit_session_id = ? ORDER BY rack_number',
      [auditSessionId]
    );

    return (results.rows || []).map(row => ({
      ...row,
      ready_for_approval: Boolean(row.ready_for_approval),
      synced: Boolean(row.synced),
    }));
  }

  async updateRackStatus(rackId: string, status: string, additionalData?: Partial<Rack>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const updateFields = ['status = ?', 'updated_at = ?'];
    const now = Math.floor(Date.now() / 1000);
    const updateValues = [status, now];

    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        if (key !== 'id' && key !== 'created_at') {
          updateFields.push(`${key} = ?`);
          updateValues.push(value);
        }
      });
    }

    updateValues.push(rackId); // for WHERE clause

    await this.db.execute(
      `UPDATE local_racks SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );
  }

  // UI query methods (restored)
  async getScansForRack(rackId: string): Promise<Scan[]> {
    if (!this.db) throw new Error('Database not initialized');

    const results = await this.db.execute(
      'SELECT * FROM local_scans WHERE rack_id = ? ORDER BY created_at DESC',
      [rackId]
    );

    return (results.rows || []).map(row => ({
      ...row,
      manual_entry: Boolean(row.manual_entry),
      synced: Boolean(row.synced),
    }));
  }

  async markScanSyncError(scanId: number, error: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const now = Math.floor(Date.now() / 1000);
    await this.db.execute(
      'UPDATE local_scans SET sync_error = ?, updated_at = ? WHERE id = ?',
      [error, now, scanId]
    );
  }

  // Device info operations (restored)
  async updateDeviceInfo(deviceId: string, info: any): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const now = Math.floor(Date.now() / 1000);

    await this.db.execute(
      `INSERT OR REPLACE INTO device_info (
        device_id, device_name, user_id, last_sync, total_scans, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        deviceId,
        info.device_name || '',
        info.user_id || '',
        info.last_sync || now,
        info.total_scans || 0,
        now,
        now,
      ]
    );
  }

  async getDeviceInfo(deviceId: string): Promise<any> {
    if (!this.db) throw new Error('Database not initialized');

    const results = await this.db.execute(
      'SELECT * FROM device_info WHERE device_id = ?',
      [deviceId]
    );

    return results.rows?.[0] || null;
  }

  // Utility methods (restored)
  async clearOldData(daysOld: number = 30): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const cutoffDate = Math.floor((Date.now() - (daysOld * 24 * 60 * 60 * 1000)) / 1000);

    // Clear old synced scans
    await this.db.execute(
      'DELETE FROM local_scans WHERE synced = 1 AND created_at < ?',
      [cutoffDate]
    );

    // Clear old completed sync queue items
    await this.db.execute(
      'DELETE FROM sync_queue WHERE status = ? AND processed_at < ?',
      ['completed', cutoffDate]
    );
  }

  // Lifecycle management for performance optimization
  async onAppBackground(): Promise<void> {
    console.log('📱 App backgrounding - switching to safe mode');
    
    if (this.batchManager) {
      await this.batchManager.flush();
    }
    
    if (this.db) {
      // Switch to maximum safety mode
      await this.db.execute('PRAGMA synchronous=FULL');
      await this.db.execute('PRAGMA wal_checkpoint(TRUNCATE)');
    }
  }
  
  async onAppForeground(): Promise<void> {
    console.log('📱 App foregrounding - switching to scan mode');
    
    if (this.db) {
      // Switch back to performance mode
      await this.db.execute('PRAGMA synchronous=NORMAL');
    }
  }
  
  async closeDatabase(): Promise<void> {
    if (this.batchManager) {
      await this.batchManager.cleanup();
      this.batchManager = null;
    }
    
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

export default new DatabaseService();