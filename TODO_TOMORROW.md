# TODO for Tomorrow - Stock Audit Scanner System

## Current Status (Updated)
✅ **Completed**
- Username/password authentication working (RPC function)
- Mobile app login functional with test users
- Web dashboard running (localhost:3000)
- Database schema with standalone auth
- Basic UI screens exist (Location, Rack, Scanning)
- Redux store configured
- Offline SQLite storage setup
- All major React Native issues resolved (no reanimated)
- Documentation updated with requirements and priorities

🚧 **Current Blockers**
- No test locations in database - users see "No locations assigned"
- No audit sessions - cannot test scanning workflow
- Superuser location access needs fixing

## Tomorrow's Implementation Plan

### Phase 1: Database Setup & Testing (45 minutes)
- [ ] **Create test locations in database**
  ```sql
  INSERT INTO locations (name, address, city, state, active) VALUES
  ('Downtown Store', '123 Main St', 'Dallas', 'TX', true),
  ('Warehouse A', '456 Industrial Blvd', 'Irving', 'TX', true),
  ('North Branch', '789 Commerce Way', 'Plano', 'TX', true);
  ```
- [ ] **Fix superuser location access**
  ```sql
  UPDATE users SET location_ids = ARRAY(SELECT id FROM locations) 
  WHERE username = 'saleem';
  ```
- [ ] **Create test audit session with racks**
  ```sql
  -- Create active session
  INSERT INTO audit_sessions (location_id, total_rack_count, status, started_at, started_by)
  VALUES ((SELECT id FROM locations WHERE name = 'Downtown Store'), 20, 'active', NOW(), 
          (SELECT id FROM users WHERE username = 'saleem'));
  
  -- Generate test racks
  INSERT INTO racks (audit_session_id, location_id, rack_number, status)
  SELECT 
    (SELECT id FROM audit_sessions WHERE status = 'active' LIMIT 1),
    (SELECT id FROM locations WHERE name = 'Downtown Store'),
    'A1-' || generate_series,
    'available'
  FROM generate_series(1, 20);
  ```
- [ ] **Verify mobile app can see locations and racks**
- [ ] **Test web dashboard login with supervisor1**

### Phase 2: Core Scanning Workflow (2 hours)
- [ ] **Complete rack selection screen**
  - Fix any issues with rack display
  - Ensure claim/assignment works
  - Show proper status indicators
- [ ] **Verify scanning interface**
  - Auto-focus on barcode input
  - Test with USB scanner (if available)
  - Ensure scans save to local SQLite
  - Display running count
- [ ] **Implement rack completion**
  - "Mark as Complete" button
  - Status change to "ready_for_approval"
  - Return to rack selection

### Phase 3: Session Continuity (1 hour) - PRIORITY
Based on user feedback, implement:
- [ ] **Auto-save after each scan**
  - Save to SQLite immediately
  - Queue for server sync
- [ ] **Crash recovery**
  - On app restart, check for incomplete rack
  - Offer to resume where left off
- [ ] **Abandoned rack timeout**
  - After 30 minutes inactive, release rack
  - Allow supervisor to reassign

### Phase 4: Progress Indicators (1.5 hours) - PRIORITY
Add real-time progress to mobile app:
- [ ] **Location-level progress**
  - "45% complete, 3 scanners active"
  - Progress bar visualization
- [ ] **Session-level metrics**
  - "Est. 2.5 hours remaining at current pace"
  - Based on current scanning speed
- [ ] **Scanner-level stats**
  - "Your speed: 85 items/hour (team avg: 72)"
  - Personal vs team comparison

### Phase 5: Dashboard KPIs (2 hours) - PRIORITY
Implement supervisor metrics on web:
- [ ] **Create KPI components**
  - Accuracy Rate card
  - Throughput chart
  - First-Pass Yield indicator
  - Cycle Time tracker
  - Coverage percentage (racks completed)
- [ ] **Dual status views**
  - Rack-wise status table
  - Scanner-wise performance table
- [ ] **Real-time updates**
  - Use Supabase subscriptions
  - Auto-refresh every 30 seconds as backup

### Phase 6: Quality of Life Features (1 hour)
- [ ] **Swipe to undo last scan (mobile)**
  - Implement swipe gesture on scan list
  - Confirmation dialog
- [ ] **Visual rack map (web)** - if time permits
  - Grid view of rack statuses
  - Color coding by status

### Phase 7: End-to-End Testing (30 minutes)
- [ ] **Complete workflow test**
  1. Scanner logs in → Sees locations
  2. Selects location → Sees available racks  
  3. Claims rack → Scans items
  4. Marks complete → Rack ready for approval
  5. Supervisor sees on dashboard → Approves
  6. Scanner sees approval notification
- [ ] **Verify all priority features working**
  - Progress indicators updating
  - Session continuity on crash
  - KPIs calculating correctly
  - Swipe to undo functional

### Phase 8: Integration Consideration (Optional)
- [ ] **Evaluate dailysales.report integration**
  - Review user/location management overlap
  - Assess authentication system compatibility
  - Consider pros/cons of unified vs separate systems
  - Make decision on integration approach

## Quick SQL Scripts Needed

### 1. Create Test Locations
```sql
INSERT INTO locations (name, address, city, state, active) VALUES
('Downtown Store', '123 Main St', 'Dallas', 'TX', true),
('Warehouse A', '456 Industrial Blvd', 'Irving', 'TX', true),
('North Branch', '789 Commerce Way', 'Plano', 'TX', true),
('Distribution Center', '321 Logistics Dr', 'Fort Worth', 'TX', true);
```

### 2. Fix Superuser Location Access
```sql
-- Update saleem to have all location IDs
UPDATE users 
SET location_ids = ARRAY(SELECT id FROM locations)
WHERE username = 'saleem';
```

### 3. Create Test Audit Session
```sql
-- Create active audit session for Downtown Store
INSERT INTO audit_sessions (location_id, total_rack_count, status, started_at, started_by)
VALUES (
  (SELECT id FROM locations WHERE name = 'Downtown Store'),
  20,
  'active',
  NOW(),
  (SELECT id FROM users WHERE username = 'saleem')
);

-- Auto-generate racks for the session
INSERT INTO racks (audit_session_id, location_id, rack_number, status)
SELECT 
  (SELECT id FROM audit_sessions WHERE status = 'active' LIMIT 1),
  (SELECT id FROM locations WHERE name = 'Downtown Store'),
  'A1-' || generate_series,
  'available'
FROM generate_series(1, 20);
```

## Testing Checklist

### Mobile App Testing
- [ ] Login with saleem/password123
- [ ] See list of locations
- [ ] Select Downtown Store
- [ ] See available racks
- [ ] Claim rack A1-1
- [ ] Scan test barcodes (or type manually)
- [ ] Mark rack complete
- [ ] Return to rack selection

### Web Dashboard Testing
- [ ] Navigate to http://localhost:3000
- [ ] Login with supervisor1/password123
- [ ] Verify redirect to dashboard
- [ ] See pending approvals
- [ ] Review rack details
- [ ] Approve/reject rack
- [ ] Check real-time updates

### Integration Testing
- [ ] Mobile scanner submits rack
- [ ] Web dashboard shows it immediately
- [ ] Approval reflects back to mobile
- [ ] Multiple scanners work simultaneously
- [ ] Offline mode handles sync correctly

## Priority Order
1. **Fix database** - Add locations and sessions (10 mins)
2. **Test what works** - Verify mobile navigation (10 mins)
3. **Build scanning** - Core feature needed (1 hour)
4. **Test web dashboard** - Verify authentication (30 mins)
5. **Complete workflow** - End-to-end functionality (2 hours)

## Success Criteria for Tomorrow
✅ Scanner can complete a full rack of items
✅ Supervisor can approve from web dashboard
✅ Data persists correctly in database
✅ Basic audit workflow is functional
✅ Both platforms working with role-based access

## Notes
- Authentication is WORKING - don't change it!
- Focus on core workflow first, polish later
- Test with real barcode scanner if available
- Keep it simple - MVP first, features later