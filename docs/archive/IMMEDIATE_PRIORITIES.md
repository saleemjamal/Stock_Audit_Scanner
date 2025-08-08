# Immediate Priorities - Stock Audit Scanner System

Based on user feedback, these are the features to implement NOW in the core system.

## ✅ Core Requirements (Keep As-Is)

1. **Blind Count Only** - System already does blind counts (no expected quantities shown)
2. **Full Audit Mode** - Primary functionality for twice-yearly stock audits
3. **Manual Rack Selection** - Scanners choose their own racks (no auto-assignment)
4. **Every Rack Needs Approval** - No exceptions or auto-approval
5. **Simple Scanning** - One scan per item (no batch mode with quantities)

## 🎯 Features to Implement Now

### 1. Real-time Progress Indicators (Mobile App)
Show scanners their progress and performance:
- **Location-level**: "45% complete, 3 scanners active"
- **Session-level**: "Est. 2.5 hours remaining at current pace"
- **Scanner-level**: "Your speed: 85 items/hour (team avg: 72)"

### 2. Session Continuity Features
Robust recovery and continuation:
- **Auto-save every scan** (not just on rack completion)
- **Resume exactly where left off** after app crash
- **Supervisor can reassign abandoned racks** after timeout (e.g., 30 minutes)

Implementation notes:
- Already have SQLite for offline storage
- Minimal complexity: just more frequent saves
- Storage impact: negligible (scan records are small)
- Processing: background save after each scan

### 3. Dashboard KPIs (Web Dashboard)
Essential metrics for supervisors:
1. **Accuracy Rate**: (Approved racks / Total completed racks)
2. **Throughput**: Items/hour per scanner
3. **First-Pass Yield**: Racks approved without rejection
4. **Cycle Time**: Hours from session start to current
5. **Coverage**: % of racks completed (completed/total racks)

### 4. Swipe to Undo Last Scan (Mobile)
Simple gesture for error correction:
- Swipe left on last scan to remove it
- Confirmation dialog: "Remove scan for [barcode]?"
- Only works for current session's scans

### 5. Visual Rack Map (Web Dashboard)
Show rack locations spatially for supervisors:
- Grid/map view of warehouse layout
- Color coding: Available (green), In Progress (yellow), Complete (blue), Rejected (red)
- Click rack for details and scanner assignment

### 6. Status Views for Supervisors
Both rack-wise and user-wise status on dashboard:
- **Rack View**: List all racks with status, scanner, time elapsed
- **Scanner View**: List all scanners with current rack, items/hour, racks completed

## 📊 Implementation Priority Order

1. **Session Continuity** (Critical for reliability)
2. **Dashboard KPIs** (Essential for supervision)
3. **Progress Indicators** (Motivates scanners)
4. **Status Views** (Better oversight)
5. **Swipe to Undo** (Quality of life)
6. **Visual Rack Map** (Nice to have)

## 🚫 NOT Implementing Now

These were suggested but rejected or deferred:

- **Auto-rack assignment** - Keep manual selection
- **Variance tracking** - No inventory system integration yet
- **Bulk approval** - Every rack needs individual approval
- **Voice feedback** - Unnecessary complexity
- **Quick actions bar** - Not needed
- **Batch scanning with quantities** - Keep one scan per item
- **Exception-based approval** - All racks need approval

## 💾 Technical Implementation Notes

### Session Continuity
```javascript
// Save after each scan
const addScan = async (scanData) => {
  await saveToLocalDB(scanData);  // Immediate local save
  await syncQueue.add(scanData);   // Queue for server sync
};

// Resume on app restart
const resumeSession = async () => {
  const lastRack = await getLastActiveRack();
  if (lastRack && !lastRack.completed) {
    return { resume: true, rack: lastRack };
  }
};
```

### Progress Indicators
```javascript
// Calculate in real-time
const getProgress = () => ({
  locationProgress: (completedRacks / totalRacks) * 100,
  scannerSpeed: scansLastHour / 1,
  estimatedCompletion: calculateETA(currentSpeed, remainingRacks),
  activeScannersCount: getActiveScannersInLocation()
});
```

### Dashboard KPIs
```sql
-- Accuracy Rate
SELECT 
  (COUNT(*) FILTER (WHERE status = 'approved')::float / 
   COUNT(*) FILTER (WHERE status IN ('approved', 'rejected'))) * 100 as accuracy_rate
FROM racks WHERE audit_session_id = ?;

-- Throughput
SELECT 
  scanner_id,
  COUNT(*) / EXTRACT(HOUR FROM (NOW() - MIN(created_at))) as items_per_hour
FROM scans 
WHERE audit_session_id = ? 
GROUP BY scanner_id;
```

## 🎯 Success Criteria

The system is ready when:
1. ✅ Scanners see their real-time progress
2. ✅ App recovers gracefully from crashes
3. ✅ Supervisors have KPI dashboard
4. ✅ Quick error correction with swipe
5. ✅ Clear visibility of all rack and scanner status
6. ✅ Full audit workflow works end-to-end