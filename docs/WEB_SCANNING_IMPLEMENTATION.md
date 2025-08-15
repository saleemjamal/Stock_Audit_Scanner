# Web Scanning Implementation Plan

## Overview
Add web-based scanning to dashboard with role-based access and single-device enforcement.

## Role Changes
| Role | Old Access | New Access |
|------|------------|------------|
| Scanner | Mobile only | Web (limited) + Mobile |
| Supervisor | Web + Mobile | Web (full) + Mobile |
| Superuser | Web + Mobile | Web (full) + Mobile |

## Scanner Web Access (NEW)
**Limited Dashboard:**
- ✅ Scanning tab
- ✅ Simple KPI view (racks complete, active scanners)
- ❌ No approvals
- ❌ No user management
- ❌ No reports
- ❌ No session management

## Single Device Enforcement
**Approach:** Supabase session revocation (simplified approach)

```typescript
// On login (web & mobile):
1. Complete normal Google OAuth login
2. Call Edge Function to revoke all other sessions
3. User remains logged in, other devices get 401 errors

// Automatic handling:
1. Other devices detect 401 from revoked sessions
2. Show "signed in elsewhere" message
3. Redirect to login screen
```

## Implementation Tasks

### Phase 1: Session Revocation System (1 hour)
1. Create Supabase Edge Function:
   ```typescript
   // supabase/functions/single-session-login/index.ts
   import { serve } from "https://deno.land/std/http/server.ts"
   import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

   serve(async (req) => {
     const supabaseUrl = Deno.env.get("SUPABASE_URL")!
     const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
     const authHeader = req.headers.get("Authorization") || ""
     
     if (!authHeader.startsWith("Bearer ")) {
       return new Response("Missing bearer token", { status: 401 })
     }
     
     const userAccessToken = authHeader.replace("Bearer ", "").trim()
     const userClient = createClient(supabaseUrl, userAccessToken)
     const { data: user } = await userClient.auth.getUser()
     
     if (!user?.user) return new Response("Invalid user token", { status: 401 })
     
     const admin = createClient(supabaseUrl, serviceRoleKey, { 
       auth: { autoRefreshToken: false, persistSession: false } 
     })
     
     // List all sessions and revoke all except the newest
     const { data: sessions } = await admin.auth.admin.listUserSessions({ 
       user_id: user.user.id 
     })
     
     const sorted = (sessions?.sessions ?? []).sort((a,b) =>
       new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
     )
     const keep = sorted[0]?.id
     const toRevoke = sorted.filter(s => s.id !== keep).map(s => s.id)
     
     if (toRevoke.length) {
       await admin.auth.admin.revokeSessions({ session_ids: toRevoke })
     }
     
     return new Response(JSON.stringify({ 
       ok: true, kept: keep, revoked: toRevoke.length 
     }))
   })
   ```

2. Update web dashboard login:
   ```typescript
   // After successful OAuth login
   const { data: { session } } = await supabase.auth.getSession()
   if (session?.access_token) {
     await fetch(`${SUPABASE_FUNCTIONS_URL}/single-session-login`, {
       method: 'POST',
       headers: { Authorization: `Bearer ${session.access_token}` }
     })
   }
   ```

3. Update mobile app login:
   ```typescript
   // mobile/src/store/slices/authSliceWorkaround.ts
   const response = await supabase.rpc('login_with_username', { /* ... */ })
   if (response.data?.access_token) {
     try {
       await fetch(`${SUPABASE_FUNCTIONS_URL}/single-session-login`, {
         method: 'POST',
         headers: { 
           'Authorization': `Bearer ${response.data.access_token}`,
           'Content-Type': 'application/json'
         }
       })
     } catch (error) {
       console.warn('Session cleanup failed:', error)
     }
   }
   ```

4. Add session termination handling:
   ```typescript
   // Both web and mobile - handle 401 responses
   supabase.auth.onAuthStateChange((event, session) => {
     if (event === 'TOKEN_REFRESHED' && !session) {
       // Session was revoked by another device
       showMessage('Signed in on another device')
       navigateToLogin()
     }
   })
   ```

### Phase 2: Personal Stats Header (1 hour)
1. Create `PersonalStatsBar` component:
   ```typescript
   // Sticky header bar showing personal metrics
   ┌─────────────────────────────────────────────────────────┐
   │ 👤 John Doe | 📦 247 scans | 🏆 12 racks ✅ | ⏳ 3 pending │
   └─────────────────────────────────────────────────────────┘
   ```

2. Create SQL view for performance:
   ```sql
   CREATE VIEW user_personal_stats AS
   SELECT 
     s.scanner_id,
     COUNT(*) as total_scans,
     COUNT(*) FILTER (WHERE DATE(s.created_at) = CURRENT_DATE) as today_scans,
     COUNT(DISTINCT s.rack_id) as racks_worked,
     COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'approved') as racks_approved,
     COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'ready_for_approval') as racks_pending,
     COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'rejected') as racks_rejected
   FROM scans s
   LEFT JOIN racks r ON s.rack_id = r.id 
   WHERE s.audit_session_id = (SELECT id FROM audit_sessions WHERE status = 'active')
   GROUP BY s.scanner_id;
   ```

3. Add to DashboardLayout for scanners/supervisors

### Phase 2a: Scanner Dashboard (30 mins)
1. Create `/dashboard/scanner` route for scanner role
2. Basic layout with scanning focus
3. Update navigation based on role

### Phase 3: Web Scanner Component (2 hours)
1. Create `WebScanner.tsx`:
   ```typescript
   // Core features:
   - Auto-focus input
   - Rapid input detection (< 50ms between chars = scanner)
   - Barcode validation (10-11 digits only)
   - Rate limiting (1 scan per second)
   - Visual feedback
   - Recent scans list
   - Queue with 5-second flush
   ```

2. Implement barcode validation:
   ```typescript
   function validateBarcode(code: string): boolean {
     // Only allow 10-11 digit barcodes
     if (!/^\d{10,11}$/.test(code)) {
       showError('Invalid barcode format (must be 10-11 digits)')
       return false
     }
     return true
   }
   ```

3. Implement rate limiting:
   ```typescript
   const [lastScanTime, setLastScanTime] = useState(0)
   
   const handleScan = (barcode: string) => {
     const now = Date.now()
     if (now - lastScanTime < 1000) {
       showWarning('Please wait 1 second between scans')
       return
     }
     
     if (!validateBarcode(barcode)) return
     
     setLastScanTime(now)
     addScanToQueue({
       barcode,
       rack_id: selectedRack.id,
       audit_session_id: activeSession.id,
       scanner_id: currentUser.id
     })
   }
   ```

4. Implement scan queue:
   ```typescript
   class WebScanQueue {
     private queue: ScanData[] = []
     private flushInterval: NodeJS.Timer
     
     constructor() {
       // Flush every 5 seconds
       this.flushInterval = setInterval(() => {
         this.flush()
       }, 5000)
       
       // Flush on page unload
       window.addEventListener('beforeunload', () => {
         this.flush()
       })
     }
     
     add(scan: ScanData) {
       // Generate client-side ID for idempotency
       const scanWithId = {
         ...scan,
         id: crypto.randomUUID(),
         client_scan_id: `web-${Date.now()}-${Math.random()}`,
         created_at: new Date().toISOString(),
         quantity: 1,
         manual_entry: false,
         device_id: getDeviceId()
       }
       
       this.queue.push(scanWithId)
       if (this.queue.length >= 10) {
         this.flush()
       }
     }
     
     async flush() {
       if (this.queue.length === 0) return
       const batch = [...this.queue]
       this.queue = []
       
       try {
         await supabase.from('scans').insert(batch)
         console.log(`Flushed ${batch.length} scans`)
       } catch (error) {
         console.error('Flush failed:', error)
         // Re-queue failed scans
         this.queue.unshift(...batch)
       }
     }
   }
   ```

### Phase 4: Scanning Page (1 hour)
1. Create `/dashboard/scanning/page.tsx`
2. Components:
   - **Location selector** - Filter racks by user's assigned locations
   - **Rack selector** - Show available racks (status: 'available' or 'assigned' to current user)
   - **Scanner input** - Auto-focus text field with validation
   - **Stats display** - Real-time scan count, session progress
   - **Recent scans** - Last 10 scans with delete option

3. Rack workflow:
   ```typescript
   // Rack selection and scanning flow
   const handleRackSelection = async (rackId: string) => {
     // Update rack status to 'scanning' and assign to current user
     await supabase
       .from('racks')
       .update({ 
         status: 'scanning',
         scanner_id: currentUser.id,
         assigned_at: new Date().toISOString()
       })
       .eq('id', rackId)
     
     setSelectedRack(rackId)
   }
   
   const handleCompleteRack = async () => {
     // Flush any pending scans first
     await scanQueue.flush()
     
     // Update rack status to ready for approval
     await supabase
       .from('racks')
       .update({ 
         status: 'ready_for_approval',
         ready_at: new Date().toISOString()
       })
       .eq('id', selectedRack.id)
     
     // Navigate back to rack selection
     setSelectedRack(null)
   }
   ```

4. Data relationships:
   ```sql
   -- Each scan links to a rack
   scans.rack_id → racks.id
   
   -- Both tied to same audit session  
   scans.audit_session_id = racks.audit_session_id
   
   -- Rack status progression:
   'available' → 'scanning' → 'ready_for_approval' → 'approved'/'rejected'
   ```

### Phase 5: Testing & Polish (1 hour)
1. Test USB scanner input
2. Test session termination
3. Add loading states
4. Add error handling
5. Test role-based routing

## Database Changes

### Schema Updates
```sql
-- Only need index for personal stats performance
CREATE INDEX idx_scans_created_desc ON scans(created_at DESC);
CREATE INDEX idx_scans_scanner_session ON scans(scanner_id, audit_session_id);
```

### Updated RLS Policies
```sql
-- Scanners can only see their own scans
CREATE POLICY scanner_own_scans ON scans
  FOR SELECT
  USING (auth.uid() = scanner_id);
```

## API Endpoints

### New Endpoints
- `POST /functions/v1/single-session-login` - Revoke other sessions (Edge Function)
- `GET /api/user/personal-stats` - Get user's scanning statistics

### Modified Endpoints
- `/auth/login` pages - Add session revocation call after OAuth
- Mobile auth flow - Add session revocation call after login

## Security Considerations

1. **Session Hijacking**: Use secure, httpOnly cookies
2. **CSRF**: Implement CSRF tokens
3. **Rate Limiting**: Max 100 scans/minute per user
4. **Input Validation**: Sanitize all barcode inputs

## Performance Targets

- Scan processing: < 100ms
- Queue flush: < 500ms
- Page load: < 2 seconds
- USB scanner: 30+ scans/minute

## Rollback Plan

If issues arise:
1. Disable scanner web access (role check)
2. Keep supervisor/superuser access
3. Fall back to mobile-only for scanners

## Success Metrics

- ✅ 50% reduction in mobile battery usage
- ✅ 30+ scans/minute throughput
- ✅ Zero duplicate scans
- ✅ Single device enforcement working
- ✅ Clean session management

## Timeline

**Day 1:** Session revocation system + personal stats header (2 hours)
**Day 2:** Scanner component + queue + validation (3 hours) 
**Day 3:** Scanning page + rack workflow + testing (2 hours)

**Total: 7 hours of development**

### Key Features Added:
- ✅ **Barcode validation** (10-11 digits only)
- ✅ **Rate limiting** (1 scan per second)
- ✅ **Rack workflow** (selection → scanning → completion)
- ✅ **Data relationships** (scans.rack_id → racks.id)
- ✅ **Error handling** (failed flush re-queuing)
- ✅ **Session enforcement** (single device login)

## Session Revocation Implementation Details

### Edge Function Deployment
```bash
# Deploy the single-session-login function
supabase functions deploy single-session-login
```

### Mobile App Changes
```typescript
// mobile/src/services/supabase.ts
// Add after successful login
export async function enforceSessionSingleton() {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    try {
      const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/single-session-login`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      })
      const result = await response.json()
      console.log('Session cleanup:', result)
    } catch (error) {
      console.warn('Session cleanup failed:', error)
      // Continue anyway - not critical for functionality
    }
  }
}

// Handle session termination
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED' && !session) {
    Alert.alert(
      'Session Expired',
      'You have been signed in on another device.',
      [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
    )
  }
})
```

### Web Dashboard Changes
```typescript
// dashboard/src/app/auth/login/page.tsx
// Add after successful OAuth
const handleLoginSuccess = async () => {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL}/single-session-login`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` }
      })
    } catch (error) {
      console.warn('Session cleanup failed:', error)
    }
  }
  
  router.push('/dashboard')
}
```

### Benefits of Session Revocation Approach
- **No database schema changes** required
- **Automatic token invalidation** by Supabase
- **Works with existing RLS policies**
- **Simpler testing** - just login on two devices
- **Bulletproof security** - uses Supabase's built-in session management
- **Less code to maintain** - single Edge Function vs multiple middleware

## Personal Stats Implementation Details

### PersonalStatsBar Component
```typescript
interface PersonalStats {
  // Scanning metrics
  totalScans: number
  todayScans: number
  
  // Rack progress
  racksCompleted: number
  racksApproved: number
  racksPending: number
  racksRejected: number
  
  // Performance
  accuracyRate: number
  currentStreak: number
}

// Compact header layout
function PersonalStatsBar({ userId }: { userId: string }) {
  const [stats, setStats] = useState<PersonalStats>()
  
  // Mobile layout
  if (isMobile) {
    return (
      <Box sx={{ p: 1, bgcolor: 'primary.main', color: 'white' }}>
        👤 {userName} | 📦 {stats.todayScans} | 🏆 {stats.racksApproved} ✅
      </Box>
    )
  }
  
  // Desktop layout
  return (
    <Box sx={{ p: 1, bgcolor: 'primary.main', color: 'white', display: 'flex', gap: 3 }}>
      <Chip icon={<Person />} label={userName} />
      <Chip icon={<QrCode />} label={`${stats.todayScans} scans today`} />
      <Chip icon={<CheckCircle />} label={`${stats.racksApproved} approved`} />
      {stats.racksPending > 0 && (
        <Chip icon={<Schedule />} label={`${stats.racksPending} pending`} color="warning" />
      )}
    </Box>
  )
}
```

### Stats Update Strategy
```typescript
// Real-time updates during scanning
export const usePersonalStats = (userId: string) => {
  const [stats, setStats] = useState<PersonalStats>()
  
  useEffect(() => {
    // Initial load
    loadStats()
    
    // Refresh every 30 seconds
    const interval = setInterval(loadStats, 30000)
    
    // Real-time updates via Supabase subscription
    const subscription = supabase
      .channel('personal-stats')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'scans',
        filter: `scanner_id=eq.${userId}`
      }, () => {
        loadStats() // Refresh on new scan
      })
      .subscribe()
    
    return () => {
      clearInterval(interval)
      subscription.unsubscribe()
    }
  }, [userId])
  
  return stats
}
```