# AsyncStorage Optimization Strategy

## Overview

This document outlines the optimization strategy for re-enabling AsyncStorage persistence in the ScanQueue system. The current implementation uses `USE_ASYNC_STORAGE: false` for performance reasons, but can be optimized for production use.

## Current Performance Issues

### Problems with Naive AsyncStorage Implementation
1. **Sequential I/O**: Reading head → tail → item1 → item2... creates cumulative latency
2. **Bridge Overhead**: Each AsyncStorage call crosses the JavaScript→Native bridge
3. **Startup Blocking**: Restoration during app bootstrap blocks UI rendering
4. **Memory Pressure**: Large queues create thousands of individual keys
5. **No Batching**: Individual `getItem`/`setItem` calls instead of bulk operations

### Measured Impact
- Simple `getItem()`: 1-5ms per call
- Complex restoration: 50-500ms for moderate queues
- App startup delay: 100-2000ms with cold storage access
- Memory overhead: ~100 keys for 100 scans

## Optimization Strategy

### 1. Segmented Storage Architecture

Replace individual scan storage with segmented approach:

```typescript
// Current (inefficient):
// @scan_queue:item:0 → {scan1}
// @scan_queue:item:1 → {scan2}
// @scan_queue:item:N → {scanN}

// Optimized (segmented):
// @scan_queue:meta → { headSeg: 0, tailSeg: 2, totalScans: 150 }
// @scan_queue:seg:0 → [scan1, scan2, ..., scan100]  // 100 scans per segment
// @scan_queue:seg:1 → [scan101, scan102, ..., scan200]
// @scan_queue:seg:2 → [scan201, scan202, ..., scan250]
```

**Benefits**:
- 100x reduction in AsyncStorage keys
- Bulk read/write operations
- Natural pagination for large queues
- Efficient segment-based cleanup

### 2. Deferred Hydration Pattern

```typescript
// Bad: Blocking initialization
useEffect(() => {
  const manager = new ScanQueueManager();
  await manager.restoreFromStorage(); // BLOCKS RENDER
  setManager(manager);
}, []);

// Good: Deferred restoration
useEffect(() => {
  const manager = new ScanQueueManager();
  setManager(manager); // IMMEDIATE RENDER
  
  // Defer storage restoration
  InteractionManager.runAfterInteractions(() => {
    manager.hydrateFromStorage();
  });
}, []);
```

**Implementation**:
- App starts with empty queue (instant UI)
- Storage restoration happens after first paint
- Queue accepts new scans immediately
- Hydration merges with live queue when complete

### 3. Batch I/O Operations

```typescript
class OptimizedPersistentQueue {
  async restoreAll(): Promise<ScanData[]> {
    // Single batch read instead of sequential reads
    const [metaJson, ...segmentJsons] = await AsyncStorage.multiGet([
      '@scan_queue:meta',
      '@scan_queue:seg:0',
      '@scan_queue:seg:1',
      // ... more segments
    ]);
    
    // Parse and flatten segments
    return segmentJsons
      .filter(([_, value]) => value !== null)
      .flatMap(([_, json]) => JSON.parse(json!));
  }
  
  async flush(scans: ScanData[]): Promise<void> {
    const segments = chunkArray(scans, 100);
    const entries: [string, string][] = segments.map((segment, i) => [
      `@scan_queue:seg:${i}`,
      JSON.stringify(segment)
    ]);
    
    // Single batch write
    await AsyncStorage.multiSet(entries);
  }
}
```

### 4. Smart Change Detection

```typescript
class OptimizedQueue {
  private lastPersistedCount = 0;
  
  async persistIfNeeded(): Promise<void> {
    const currentCount = this.memoryQueue.length;
    
    // Only persist on significant changes
    if (Math.abs(currentCount - this.lastPersistedCount) >= 10) {
      await this.persistToStorage();
      this.lastPersistedCount = currentCount;
    }
  }
}
```

## Migration Path

### Phase 1: Implement Segmented Storage
- Create `SegmentedPersistentQueue` class
- 100 scans per segment
- Batch multiGet/multiSet operations
- Test with existing queue system

### Phase 2: Add Deferred Hydration
- Move restoration out of constructor
- Use `InteractionManager.runAfterInteractions()`
- Add progress indicators for hydration
- Handle hydration + live queue merging

### Phase 3: Performance Validation
- Benchmark vs current memory-only approach
- Target: <50ms total hydration time
- Zero impact on app startup
- Memory efficiency testing

### Phase 4: MMKV Migration Option
- Evaluate `react-native-mmkv` for JSI performance
- Direct memory mapping (no bridge calls)
- Synchronous operations (no Promise overhead)
- Drop-in AsyncStorage replacement

## Implementation Code Snippets

### Segmented Queue Interface
```typescript
interface SegmentMeta {
  headSeg: number;
  tailSeg: number;
  totalScans: number;
  segmentSize: number;
}

class SegmentedPersistentQueue {
  private readonly SEGMENT_SIZE = 100;
  private readonly META_KEY = '@scan_queue:meta';
  
  async push(scan: ScanData): Promise<void> {
    const meta = await this.getMeta();
    const segmentIndex = Math.floor(meta.totalScans / this.SEGMENT_SIZE);
    const segment = await this.getSegment(segmentIndex);
    
    segment.push(scan);
    
    // Batch update: segment + meta
    await AsyncStorage.multiSet([
      [`@scan_queue:seg:${segmentIndex}`, JSON.stringify(segment)],
      [this.META_KEY, JSON.stringify({
        ...meta,
        totalScans: meta.totalScans + 1,
        tailSeg: segmentIndex
      })]
    ]);
  }
}
```

### Deferred Hydration Manager
```typescript
class DeferredHydrationManager {
  private isHydrated = false;
  private hydrationPromise: Promise<void> | null = null;
  
  async startHydration(): Promise<void> {
    if (this.hydrationPromise) return this.hydrationPromise;
    
    this.hydrationPromise = this.performHydration();
    return this.hydrationPromise;
  }
  
  private async performHydration(): Promise<void> {
    // Restore in background, don't block UI
    const persistedScans = await this.persistentQueue.restoreAll();
    
    // Merge with live queue atomically
    this.mergeWithLiveQueue(persistedScans);
    this.isHydrated = true;
    
    this.emit('hydrationComplete', persistedScans.length);
  }
}
```

## Performance Targets

| Metric | Current | Target | Method |
|--------|---------|--------|---------|
| App Startup | 100-2000ms delay | 0ms delay | Deferred hydration |
| Storage Keys | N scans = N keys | N scans = N/100 keys | Segmentation |
| Restoration Time | 50-500ms | <50ms | Batch I/O |
| Memory Usage | 1KB per scan | 100KB per 100 scans | Segment compression |

## Future: MMKV Migration

For ultimate performance, consider migrating to `react-native-mmkv`:

```typescript
import { MMKV } from 'react-native-mmkv';

class MMKVQueue {
  private storage = new MMKV({ id: 'scan-queue' });
  
  // Synchronous operations (no Promise overhead)
  addScan(scan: ScanData): void {
    const queue = this.storage.getString('queue');
    const scans = queue ? JSON.parse(queue) : [];
    scans.push(scan);
    this.storage.set('queue', JSON.stringify(scans));
  }
  
  // Direct memory access, 10-100x faster than AsyncStorage
  getScans(): ScanData[] {
    const queue = this.storage.getString('queue');
    return queue ? JSON.parse(queue) : [];
  }
}
```

**MMKV Benefits**:
- JSI bridge (direct memory access)
- Synchronous operations
- 10-100x faster than AsyncStorage
- Smaller bundle size
- Drop-in replacement API

## Recommendation

1. **Immediate**: Keep `USE_ASYNC_STORAGE: false` for current stability
2. **Short-term**: Implement segmented storage with deferred hydration
3. **Long-term**: Evaluate MMKV for production persistence needs

The segmented approach provides the safety and reliability needed for warehouse operations while maintaining the performance characteristics required for real-time scanning workflows.