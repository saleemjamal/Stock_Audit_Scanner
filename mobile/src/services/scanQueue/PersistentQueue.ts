import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScanData } from '../scanSink/types';
import { config } from '../../config/features';

interface QueuePointers {
  head: number;
  tail: number;
}

export class PersistentQueue {
  private readonly MAX_SIZE = config.PERSISTENT_QUEUE_SIZE;
  private readonly PREFIX = '@scan_queue:';
  private readonly HEAD_KEY = `${this.PREFIX}head`;
  private readonly TAIL_KEY = `${this.PREFIX}tail`;

  async push(scan: ScanData): Promise<void> {
    console.log('💾 PersistentQueue: Pushing scan to AsyncStorage');
    
    const pointers = await this.getPointers();
    const newTail = (pointers.tail + 1) % this.MAX_SIZE;

    // Check if the ring buffer is full
    if (newTail === pointers.head) {
      throw new Error('Persistent queue full - cannot store more scans');
    }

    try {
      // Write the scan data first (crash-safe: data before pointer)
      const itemKey = `${this.PREFIX}item:${pointers.tail}`;
      await AsyncStorage.setItem(itemKey, JSON.stringify({
        ...scan,
        persistedAt: Date.now() // Track when it was persisted
      }));

      // Then update the tail pointer
      await AsyncStorage.setItem(this.TAIL_KEY, String(newTail));
      
      console.log(`✅ PersistentQueue: Scan persisted at index ${pointers.tail}`);
    } catch (error) {
      console.error('💥 PersistentQueue: Failed to persist scan:', error);
      throw error;
    }
  }

  async popBatch(size: number): Promise<ScanData[]> {
    console.log(`📤 PersistentQueue: Popping batch of ${size} from AsyncStorage`);
    
    const pointers = await this.getPointers();
    const items: ScanData[] = [];
    const keysToRemove: string[] = [];

    let current = pointers.head;
    let processed = 0;

    // Collect items from head towards tail
    while (processed < size && current !== pointers.tail) {
      const itemKey = `${this.PREFIX}item:${current}`;
      
      try {
        const itemData = await AsyncStorage.getItem(itemKey);
        if (itemData) {
          const scan = JSON.parse(itemData) as ScanData;
          items.push(scan);
          keysToRemove.push(itemKey);
        }
      } catch (error) {
        console.warn(`⚠️ PersistentQueue: Failed to read item at ${current}:`, error);
      }

      current = (current + 1) % this.MAX_SIZE;
      processed++;
    }

    // Batch remove items and update head pointer
    if (keysToRemove.length > 0) {
      try {
        await AsyncStorage.multiRemove(keysToRemove);
        await AsyncStorage.setItem(this.HEAD_KEY, String(current));
        
        console.log(`✅ PersistentQueue: Removed ${keysToRemove.length} items from storage`);
      } catch (error) {
        console.error('💥 PersistentQueue: Failed to remove items:', error);
        throw error;
      }
    }

    return items;
  }

  async removeBatch(count: number): Promise<void> {
    console.log(`🗑️ PersistentQueue: Removing ${count} items from front of queue`);
    
    const pointers = await this.getPointers();
    const keysToRemove: string[] = [];
    let current = pointers.head;

    // Collect keys to remove
    for (let i = 0; i < count && current !== pointers.tail; i++) {
      keysToRemove.push(`${this.PREFIX}item:${current}`);
      current = (current + 1) % this.MAX_SIZE;
    }

    // Batch remove
    if (keysToRemove.length > 0) {
      try {
        await AsyncStorage.multiRemove(keysToRemove);
        await AsyncStorage.setItem(this.HEAD_KEY, String(current));
        
        console.log(`✅ PersistentQueue: Removed ${keysToRemove.length} items`);
      } catch (error) {
        console.error('💥 PersistentQueue: Failed to remove batch:', error);
        throw error;
      }
    }
  }

  async restoreAll(): Promise<ScanData[]> {
    console.log('🔄 PersistentQueue: Restoring all persisted scans');
    
    const pointers = await this.getPointers();
    const items: ScanData[] = [];
    let current = pointers.head;

    // Collect all items from head to tail
    while (current !== pointers.tail) {
      const itemKey = `${this.PREFIX}item:${current}`;
      
      try {
        const itemData = await AsyncStorage.getItem(itemKey);
        if (itemData) {
          const scan = JSON.parse(itemData) as ScanData;
          items.push(scan);
        }
      } catch (error) {
        console.warn(`⚠️ PersistentQueue: Failed to restore item at ${current}:`, error);
      }

      current = (current + 1) % this.MAX_SIZE;
    }

    console.log(`✅ PersistentQueue: Restored ${items.length} scans from storage`);
    return items;
  }

  async getSize(): Promise<number> {
    const pointers = await this.getPointers();
    
    if (pointers.tail >= pointers.head) {
      return pointers.tail - pointers.head;
    } else {
      // Wrapped around
      return this.MAX_SIZE - pointers.head + pointers.tail;
    }
  }

  async clear(): Promise<void> {
    console.log('🧹 PersistentQueue: Clearing all persisted data');
    
    try {
      // Get all keys that match our prefix
      const allKeys = await AsyncStorage.getAllKeys();
      const ourKeys = allKeys.filter(key => key.startsWith(this.PREFIX));
      
      if (ourKeys.length > 0) {
        await AsyncStorage.multiRemove(ourKeys);
      }
      
      // Reset pointers
      await AsyncStorage.multiSet([
        [this.HEAD_KEY, '0'],
        [this.TAIL_KEY, '0']
      ]);
      
      console.log(`✅ PersistentQueue: Cleared ${ourKeys.length} keys`);
    } catch (error) {
      console.error('💥 PersistentQueue: Failed to clear:', error);
      throw error;
    }
  }

  private async getPointers(): Promise<QueuePointers> {
    try {
      const [headResult, tailResult] = await AsyncStorage.multiGet([
        this.HEAD_KEY,
        this.TAIL_KEY
      ]);

      const head = headResult[1] ? parseInt(headResult[1], 10) : 0;
      const tail = tailResult[1] ? parseInt(tailResult[1], 10) : 0;

      // Validate pointers
      if (isNaN(head) || isNaN(tail) || head < 0 || tail < 0 || 
          head >= this.MAX_SIZE || tail >= this.MAX_SIZE) {
        console.warn('⚠️ PersistentQueue: Invalid pointers, resetting to 0,0');
        await AsyncStorage.multiSet([
          [this.HEAD_KEY, '0'],
          [this.TAIL_KEY, '0']
        ]);
        return { head: 0, tail: 0 };
      }

      return { head, tail };
    } catch (error) {
      console.error('💥 PersistentQueue: Failed to get pointers:', error);
      // Return safe defaults
      return { head: 0, tail: 0 };
    }
  }
}