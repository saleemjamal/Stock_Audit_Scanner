# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Stock Audit Scanner System - A mobile-first inventory audit system with simplified authentication and role-based access:
- **React Native Android app** for barcode scanning with offline capability
- **Next.js web dashboard** for real-time monitoring and supervisor approvals  
- **Supabase backend** (PostgreSQL + Auth + Realtime)
- **Google OAuth authentication** with pre-authorized user whitelisting
- **Three-role system**: Scanner (mobile only) → Supervisor (both platforms) → Super User (admin)
- **Super User**: saleem@poppatjamals.com has full system access

## Development Commands

### Mobile App (React Native)
```bash
cd mobile
npm install                    # Install dependencies
npx react-native start         # Start Metro bundler
npx react-native run-android   # Run on Android device/emulator
npm test                       # Run unit tests
npm run lint                   # Run ESLint
npm run build:android          # Build release APK
npm run build:android-debug    # Build debug APK
npm run clean                  # Clean React Native cache
```

### Web Dashboard (Next.js)
```bash
cd dashboard
npm install                    # Install dependencies
npm run dev                    # Start development server
npm run build                  # Build for production
npm run start                  # Start production server
npm run lint                   # Run ESLint
npm run type-check             # TypeScript type checking
```

### Database (Supabase)
```bash
# Run migrations in order within Supabase SQL Editor:
# 1. supabase/01_schema.sql
# 2. supabase/02_rls_policies.sql
# 3. supabase/03_functions.sql
# 4. supabase/04_seed.sql (for test data)
```

## Architecture

### Mobile App Structure
```
mobile/src/
├── components/          # Reusable UI components (ScannerInput, QueueStatusBadge)
├── screens/            # Screen components organized by feature
│   ├── auth/          # Login, OAuth callback
│   └── main/          # Location, Rack, Scanning, ReviewScans screens
├── navigation/         # React Navigation setup
├── store/             # Redux Toolkit store and slices
├── services/          # Supabase client, scan queue system
│   └── scanQueue/     # Queue-based architecture (no SQLite)
├── hooks/             # Custom React hooks
└── utils/             # Utilities and constants
```

### Dashboard Structure
```
dashboard/src/
├── app/               # Next.js 14 App Router
│   ├── dashboard/     # Protected dashboard pages
│   ├── auth/          # Authentication pages
│   └── api/           # API routes
├── components/        # UI components (AuditOverview, PendingApprovals)
├── lib/              # Supabase client, theme configuration
├── hooks/            # Custom hooks for data fetching
└── types/            # TypeScript types (shared with mobile)
```

### Database Schema
- **users**: Google OAuth with email-based authentication and roles (scanner, supervisor, superuser)
- **locations**: Physical store locations
- **audit_sessions**: Audit session management
- **racks**: Auto-generated racks with approval workflow
- **scans**: Individual barcode scans with offline sync support

### User Roles & Platform Access
| Role | Mobile App | Web Dashboard | Capabilities |
|------|------------|---------------|--------------|
| **Scanner** | ✅ | ✅ (Limited) | Scan items, mark racks complete, web scanning |
| **Supervisor** | ✅ | ✅ | All scanner features + approve/reject + reports |
| **Super User** | ✅ | ✅ | All features + user management + location management |

### Key Features
1. **Google OAuth + Whitelisting**: Only pre-authorized users can access the system
2. **AsyncStorage Queue System**: Replaced SQLite with in-memory queue + AsyncStorage ring buffer for persistence
3. **USB Scanner Support**: Direct barcode input via USB OTG (mobile and web)
4. **Scanner Self-Review Workflow**: Scan → Review & Delete → Submit → Supervisor Approval
5. **Real-time Updates**: Supabase subscriptions for live dashboard
6. **Role-Based Access**: Scanner web access for scanning, full supervisor/admin access
7. **Dual-Platform Operation**: Mobile app + web dashboard with cross-platform compatibility
8. **Optimized Performance**: 15-second sync intervals, instant scan feedback, no database bottlenecks
9. **Single Rack Focus**: Both mobile and web enforce one rack at a time to prevent confusion
10. **Smart Duplicate Detection**: One-time warnings instead of blocking scans
11. **Collapsible UI**: Responsive dashboard with mini sidebar mode
12. **Real-time Data**: Live scanner names and scan counts in rack maps

## Environment Setup

### Mobile (.env in mobile/)
```
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

### Dashboard (.env.local in dashboard/)
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Testing Approach

### Mobile Testing
- Unit tests with Jest (`npm test`)
- Component testing with React Native Testing Library
- E2E tests with Detox (configured but requires device)
- Test offline sync scenarios

### Dashboard Testing
- TypeScript for type safety
- Manual testing of real-time features
- Test supervisor approval workflow
- Verify location-based filtering

## Key Development Considerations

1. **Google OAuth Security**: Only pre-authorized users (added by superuser) can access system
2. **Role-Based Access**: Scanner web access for scanning only, full supervisor/admin access
3. **Offline Sync**: Mobile app must handle offline scanning and sync when online
4. **Real-time Updates**: Dashboard should show live scanning activity with actual data
5. **Permissions**: Respect Row Level Security (RLS) policies in Supabase
6. **Scanner Hardware**: Support USB OTG barcode scanners in HID keyboard mode (mobile and web)
7. **Performance**: Optimize for older Android devices used in warehouse environments
8. **Super User Flexibility**: saleem@poppatjamals.com needs full system access
9. **Cross-Platform Compatibility**: Both platforms support scanning with single rack focus
10. **UI Responsiveness**: Collapsible sidebar and responsive design for different screen sizes

## Business Requirements (Clarified)

### Core Workflow
- **Blind Counting Only**: No expected quantities shown (reduces bias)
- **Full Audit Mode**: Primary use case for twice-yearly complete inventory counts
- **Manual Rack Selection**: Scanners choose their own racks (no auto-assignment)
- **Universal Approval**: Every rack requires supervisor approval (no exceptions)
- **Individual Scanning**: One scan per item (no batch/quantity entry)

### Must-Have Features (IMPLEMENTED ✅)
1. **Scanner Self-Review** (Mobile): Review and delete scans before supervisor approval ✅
2. **Session Continuity**: Auto-save each scan, crash recovery, queue-based persistence ✅
3. **Real-time Sync**: Background queue processing with offline capability ✅
4. **Delete Functionality** (Mobile): Remove incorrect scans during review phase ✅
5. **Complete Approval Workflow**: End-to-end scan → review → submit → approve ✅
6. **Web Scanning Interface**: Role-based dashboard scanning with USB scanner support ✅
7. **Single-Device Enforcement**: Session revocation prevents concurrent logins ✅
8. **Personal Stats Display**: Real-time scanning metrics for user motivation ✅
9. **Rejection Workflow**: Supervisor rejection with reasons, scanner rework capability ✅
10. **Cross-Platform Scanning**: Both mobile and web support barcode scanning ✅
11. **Single Rack Focus**: Prevents confusion by enforcing one rack at a time ✅
12. **Smart Duplicate Handling**: Informational warnings instead of blocking scans ✅
13. **Responsive UI**: Collapsible sidebar and real-time data updates ✅
14. **Barcode Search**: Find specific items in scan lists ✅

### NOT Implementing (Per User Feedback)
- Auto-rack assignment (keep manual selection)
- Variance tracking (no inventory system yet)
- Bulk approval (individual approval required)
- Voice feedback (unnecessary complexity)
- Batch scanning with quantities (one scan per item)
- Exception-based approval (all racks need review)

## Implementation Approach

Follow the **phased development** approach documented in `/docs/Implementation_Simplification_Guide.md`:

### Phase 1: MVP (2 hours)
- Username/password authentication
- Basic mobile scanning
- Database connection

### Phase 2: Core Workflow (4 hours)  
- Rack selection and management
- Supervisor approval workflow
- Complete audit cycle

### Phase 3: Polish (6 hours)
- User management interface
- Location management
- UI/UX improvements

### Phase 4: Advanced (8 hours)
- Reporting and analytics
- Advanced admin features
- Performance optimizations

## Current Status

✅ **Completed**: 
- Google OAuth authentication working on both web dashboard and mobile app with user whitelisting
- Mobile app successfully deployed to physical device via wireless debugging
- Database schema designed for email-based authentication 
- Role-based access control implemented with platform restrictions
- Test users created with Google emails (@poppatjamals.com domain)
- Complete dashboard with location management, user management, reports, settings
- Web dashboard running with proper authorization checks
- User management interface with required email validation
- PendingApprovals component with real-time approval workflow
- SQLite local database working with simplified initialization
- Barcode scanning functionality working end-to-end
- Performance optimizations: removed duplicate checking, optimized scan flow

🎯 **Recently Completed (Aug 8, 2025)**:
- ✅ **Mobile Authentication Security** - Removed auto-user creation, implemented proper Google OAuth whitelisting
- ✅ **SQLite Database Issues** - Fixed initialization timeout, created fallback to online-only mode
- ✅ **Barcode Scanning Performance** - Removed duplicate checking (50-100ms delay eliminated)
- ✅ **Schema Alignment** - Fixed mobile/server data model mismatch (`is_recount` fields removed)
- ✅ **Physical Device Testing** - App successfully running on Android device with wireless debugging
- ✅ **Scan Flow Optimization** - Streamlined scan process: create → save locally → sync to server
- ✅ **Optimistic UI Phase 1** - Input clears after local database save (not server sync)
- ✅ **Scanner Input Visibility** - Shows scanned barcode with ✅/❌ indicators before auto-clearing
- ✅ **Background Server Sync** - Non-blocking server operations with automatic retry queue

✅ **Complete Architecture Redesign (Aug 11, 2025)**:
- **Problem Solved**: Eliminated cascading database performance issues from op-sqlite/SQLite
- **New Architecture**: Queue-based system with direct API calls replacing complex local caching
- **Key Components**:
  - ScanQueueManager with in-memory queue and AsyncStorage ring buffer
  - DirectApiSink for batch uploads with exponential backoff
  - Client-side scan IDs (UUIDs) for idempotency
  - Feature flag system for runtime switching (USE_LOCAL_DB)
- **Performance**: Instant scan processing, 2-second or 50-scan batch uploads
- **Reliability**: Crash-safe persistence, network-aware flushing, automatic retries

🎯 **Queue System Features Implemented (Aug 11, 2025)**:
- ✅ **ScanSink Interface** - Pluggable data persistence strategies
- ✅ **DirectApiSink** - Direct Supabase uploads with chunking and retry logic
- ✅ **PersistentQueue** - AsyncStorage ring buffer for crash recovery
- ✅ **ScanQueueManager** - Central coordinator with single-flight flush pattern
- ✅ **QueueStatusBadge** - Real-time UI feedback for queue status
- ✅ **Optimistic UI** - Immediate visual feedback with background sync
- ✅ **Network Awareness** - Auto-flush when connectivity restored
- ✅ **AppState Integration** - Flush on app foreground/background
- ✅ **Backpressure Handling** - Queue size limits with warnings

🔄 **Current System Status** (Aug 15, 2025): 
- **Architecture**: Queue-based scanning with direct API calls - Production Ready ✅
- **Mobile App**: Running on physical device with instant scan response ✅
- **Web Dashboard**: Full scanning interface with role-based access ✅
- **Queue System**: Batch processing every 15 seconds or 50 scans (optimized) ✅
- **Persistence**: AsyncStorage ring buffer for offline capability ✅
- **UI Feedback**: Real-time queue status and visual indicators ✅
- **Error Handling**: Exponential backoff with automatic retries ✅
- **Database Sync**: WORKING - scans successfully syncing to Supabase ✅
- **Scanner Self-Review**: Complete implementation with delete functionality ✅
- **Audit Session Management**: Dashboard-based creation/closure (no more SQL scripts) ✅
- **Rack Generation**: Automated with simple numbering (1, 2, 3...) ✅
- **Role-Based Rack Addition**: Only super users can add more racks to sessions ✅
- **Approval Workflow**: End-to-end working from scan to supervisor approval ✅
- **Rejection Workflow**: Complete feedback loop with reason tracking and rework ✅
- **Single-Device Enforcement**: Session revocation prevents concurrent access ✅
- **System Stability**: All major performance bottlenecks resolved ✅
- **Code Quality**: Clean architecture with proper error handling ✅

📋 **System Status** (Aug 15, 2025): 
**PRODUCTION READY** - All core features implemented and tested

✅ **Latest Completed Features (Aug 15, 2025)**:
1. **Dashboard UX Overhaul** - Streamlined KPIs (4 focused metrics vs 6 cards), modern navigation design
2. **Admin Section Organization** - Collapsible admin navigation (Audit Sessions, Locations, Users) 
3. **Help & Support System** - Comprehensive FAQ with 7 sections accessible from profile menu
4. **PendingApprovals Bug Fix** - Widget now correctly filters to active audit session only
5. **Modern Theme Implementation** - Enhanced color palette, better contrast, professional styling
6. **Custom Dual-Theme System** - User-defined light/dark palettes optimized for warehouse environments
7. **Collapsible Sidebar** - Dashboard layout with 240px/60px mini mode and navigation highlighting
8. **Web Scanner Access Control** - Removed scanner role blocking for web dashboard access
9. **Single Rack Focus Pattern** - Web scanning enforces one rack at a time to prevent confusion
10. **Smart Duplicate Detection** - Changed from blocking to one-time informational warnings
11. **Real Data in Rack Map** - Shows actual scanner usernames and scan counts instead of placeholders
12. **Mobile Barcode Search** - Added search functionality to ReviewScansScreen for finding specific items

✅ **Core System Features (Completed)**:
1. **Complete Web Scanning System** - Dashboard scanning with USB scanner support and role-based access
2. **Personal Stats Integration** - Real-time scanning metrics and performance tracking
3. **Single-Device Enforcement** - Session revocation system prevents concurrent logins
4. **Rejection Workflow Implementation** - Complete feedback loop with supervisor reasons and scanner rework
5. **Scanner Self-Review Screen** - Scanners can review and delete scans before supervisor approval
6. **Auto-Flush on Review** - Queue automatically flushes when entering review screen
7. **Audit Session Management** - Web-based session lifecycle (start, add racks, close)
8. **Automated Rack Generation** - Bulk creation with simple sequential numbering
9. **Role-Based Controls** - Super users can add racks, supervisors manage sessions
10. **Emoji-Based Delete Buttons** - Reliable delete functionality using 🗑️ emoji (no icon font dependencies)
11. **Complete Approval Workflow** - Working end-to-end: Scan → Review → Submit → Supervisor Approval
12. **RLS Resolution** - Row Level Security issues resolved (RLS disabled for development)
13. **Performance Optimization** - Flush interval increased to 15 seconds for better battery life
14. **Database Architecture Cleanup** - Removed old DatabaseService dependencies

📋 **Production Ready Features**: 
1. **Multi-Platform Scanning** - Mobile app + web dashboard with role-based access
2. **Complete Scanning Workflow** - Scan → Review → Delete mistakes → Submit for approval
3. **Queue-Based Sync** - 15-second intervals with auto-flush triggers and offline support
4. **Supervisor Management** - Web dashboard approval/rejection with feedback system
5. **Role-Based Access Control** - Scanners (mobile+web limited), Supervisors/Super Users (full access)
6. **Location-Based Filtering** - Users restricted to assigned locations
7. **Crash-Safe Data Persistence** - AsyncStorage backup with network recovery
8. **Single-Device Security** - Session revocation prevents concurrent access
9. **USB Scanner Support** - Physical barcode scanners work on web dashboard
10. **Real-Time Stats** - Personal metrics and performance tracking

📋 **Ready for Deployment**: 
1. **Edge Functions** - Deploy single-session-login function to Supabase
2. **Database Views** - Create personal_stats_view for performance
3. **Firebase App Distribution** - Team testing deployment ready
4. **Production Testing** - USB scanner integration and volume stress testing
5. **User Training** - Scanner and supervisor workflow documentation

## Known Issues & Workarounds

### 1. React Native Reanimated & Gesture Handler Issue (RESOLVED)
- **Problem**: `react-native-gesture-handler` requires `react-native-reanimated` which causes build failures
- **Solution**: Migrated from `@react-navigation/stack` to `@react-navigation/native-stack`
- **Benefits**: No reanimated dependency, native performance, simpler dependency tree
- **Files Changed**: All navigation files use `createNativeStackNavigator` instead of `createStackNavigator`

### 2. Authentication Workaround
- **Issue**: Supabase Auth complexity with OAuth requirements
- **Solution**: Custom RPC function (`login_with_username`) with standalone auth
- **Files**: `mobile/src/store/slices/authSliceWorkaround.ts`, `supabase/15_standalone_auth_fixed.sql`

### 3. Missing Java Bootstrap Files (RESOLVED)
- **Problem**: React Native project missing `MainActivity.java` and `MainApplication.java`
- **Solution**: Manually created required Java files in `android/app/src/main/java/com/stockauditscanner/`
- **Note**: These should auto-generate but didn't - manual creation fixed app crashes

### 4. SQLite Performance Issue (RESOLVED)
- **Problem**: Database initialization taking 30+ seconds, causing app timeout
- **Solution**: 
  - Simplified database creation to essential tables only
  - Reduced timeout from 30s to 10s with graceful fallback
  - Added online-only mode when SQLite initialization fails
  - Created hybrid approach: local storage when available, direct server sync as backup
- **Result**: App starts quickly regardless of SQLite status, maintains offline capability when possible

### 5. Metro Bundler Shared Folder Access (RESOLVED)
- **Problem**: Cannot import from `shared/` folder outside React Native directory
- **Solution**: Updated `metro.config.js` to include shared folder in watchFolders
- **File**: `mobile/metro.config.js`

### 6. Environment Variables Loading (RESOLVED)
- **Problem**: `react-native-config` returning undefined, causing Supabase init to fail
- **Solution**: Added optional chaining and hardcoded fallbacks for Supabase URL/key
- **File**: `mobile/src/services/supabase.ts`

### 7. Barcode Scanning Performance Issue (RESOLVED)
- **Problem**: Duplicate checking logic adding 50-100ms delay per scan, blocking rapid scanning workflow
- **Solution**: 
  - Removed automatic duplicate checking and `is_recount`/`recount_of` fields
  - Eliminated schema mismatch between mobile and server (no more PGRST204 errors)
  - Streamlined scan flow to direct save without validation delays
  - Documented user-controlled duplicate handling for future enhancement
- **Result**: 3x faster scanning, supports multiple items per minute, cleaner code architecture

### 8. Wireless Debugging Setup (RESOLVED)
- **Problem**: USB port needed for barcode scanner testing, preventing wired debugging
- **Solution**: 
  - Configured Android wireless debugging (adb pair + adb connect)
  - Manual Metro bundler host configuration on device
  - Proper network setup for React Native development
- **Result**: Mobile app running on physical device while keeping USB port available for scanner testing

### 9. SQLite to AsyncStorage Migration (COMPLETED - Aug 11, 2025)
- **Original Problem**: SQLite/op-sqlite taking 60+ seconds per scan, causing app to be unusable
- **Final Solution**: Complete architecture redesign - replaced SQLite with AsyncStorage queue system
  - Removed all SQLite/op-sqlite dependencies
  - Implemented in-memory queue with AsyncStorage ring buffer for persistence
  - Direct Supabase API calls with batch uploads (50 scans or 15 seconds)
  - Client-side scan IDs (timestamps) for idempotency
- **Architecture Components**:
  - `ScanQueueManager`: Central coordinator with single-flight flush pattern
  - `DirectApiSink`: Batch uploads with exponential backoff
  - `PersistentQueue`: AsyncStorage ring buffer for crash recovery
  - `QueueStatusBadge`: Real-time UI feedback
- **Result**: Instant scan processing (<10ms), no database bottlenecks, crash-safe persistence
- **Status**: **PRODUCTION READY** - AsyncStorage queue system fully operational

### 10. Node.js Module Dependencies (RESOLVED - Aug 11, 2025)
- **Problem**: React Native missing Node.js modules (`events`, `uuid`)
- **Solution**:
  - Installed `uuid` package for React Native
  - Created custom SimpleEventEmitter for React Native (replaced Node.js EventEmitter)
- **Files Modified**: `mobile/src/services/scanQueue/ScanQueueManager.ts`

### 11. SyncManager Performance Issue (DISABLED - Aug 13, 2025)
- **Problem**: SyncManager component causing massive delays in scan processing
- **Current Status**: Component is commented out in App.tsx (lines 89, 104)
- **Impact**: The old SyncManager is not being used; sync is handled by ScanQueueProvider with DirectApiSink
- **Solution**: Using queue-based system with ScanQueueManager and DirectApiSink for syncing
- **Note**: Do NOT re-enable SyncManager - it causes performance issues

### 12. Client Scan ID UUID Type Mismatch (RESOLVED - Aug 13, 2025)
- **Problem**: Database column `client_scan_id` was type `uuid` but app was sending timestamp-based strings
- **Error**: `invalid input syntax for type uuid: "1754990423730-doly25p53"`
- **Solution**: 
  - Changed database column from `uuid` to `text` type
  - SQL command: `ALTER TABLE scans ALTER COLUMN client_scan_id TYPE text;`
  - Kept timestamp-based IDs in code (avoiding React Native uuid package issues)
- **Result**: Sync working correctly, scans successfully saved to database

### 13. Row Level Security (RLS) Causing Silent Failures (RESOLVED - Aug 13, 2025)
- **Problem**: RLS policies causing scan deletions and other operations to fail silently
- **Error**: Operations appeared successful in logs but data remained unchanged in database
- **Root Cause**: Complex RLS policies blocking legitimate operations during development
- **Solution**: Disabled RLS on most tables during development phase
- **Alternative Security**: Using Google OAuth whitelisting + application-level role restrictions
- **Result**: All CRUD operations now work reliably, clear error messages when things fail

### 14. React Native Vector Icons Not Rendering (RESOLVED - Aug 13, 2025)
- **Problem**: IconButton components not showing any icons (delete buttons invisible)
- **Root Cause**: MaterialIcons font not properly linked in React Native
- **Solution**: Replaced IconButton with emoji-based buttons using TouchableOpacity + Text
- **Implementation**: Used 🗑️ emoji for delete buttons with proper styling and touch targets
- **Benefits**: No font dependencies, works on all devices, universally understood symbols
- **Result**: Delete buttons now clearly visible and functional

### 15. Legacy DatabaseService Dependencies (RESOLVED - Aug 13, 2025)
- **Problem**: `markRackReady` function still calling old DatabaseService methods
- **Error**: `DatabaseService.getScanCountForRack` causing crashes in approval workflow
- **Root Cause**: Queue system migration didn't update all Redux actions
- **Solution**: 
  - Updated `markRackReady` to use Redux state instead of local database
  - Removed all DatabaseService calls from rack operations
  - Simplified flow to direct Supabase API calls
- **Result**: Complete approval workflow now functional end-to-end

### 16. Vercel Dynamic Route 404 Error (RESOLVED - Aug 15, 2025)
- **Problem**: `/dashboard/approvals/[rackId]` returning 404 in production (Vercel) but working locally
- **Error**: Dynamic routes not being handled properly by Vercel deployment
- **Root Cause**: Incorrect `vercel.json` rewrites interfering with Next.js App Router
- **Solution**:
  - Removed problematic rewrites from `vercel.json` (was rewriting all routes to `/src/app/...`)
  - Removed `export const runtime = 'nodejs'` from dynamic route page
  - Reset `next.config.js` to let Vercel auto-detect output format
  - Added `export const dynamic = 'force-dynamic'` to ensure runtime rendering
- **Key Learning**: Next.js 14 App Router doesn't need manual rewrites in vercel.json
- **Result**: Dynamic routes now working perfectly in production

### 17. Web Scanning Implementation (COMPLETED - Aug 15, 2025)
- **Achievement**: Full web-based scanning system implemented for dashboard
- **Components Added**:
  - `WebScanner.tsx`: Auto-focus barcode input with USB scanner support
  - `PersonalStatsBar.tsx`: Real-time user stats display
  - `/dashboard/scanning/page.tsx`: Complete scanning workflow
- **Features Implemented**:
  - Role-based access (scanners get limited web dashboard access)
  - Barcode validation (10-11 digits only) with rate limiting
  - Queue system with 5-second batch uploads
  - Location and rack selection with availability filtering
  - USB scanner auto-detection and rapid input handling
- **Database Changes**: Created `personal_stats_view.sql` for performance
- **Session Management**: Single-device enforcement via Edge Function
- **Result**: Scanners can now use web interface for scanning, reducing mobile battery usage

### 18. Rejection Workflow System (COMPLETED - Aug 15, 2025)
- **Problem**: No way for supervisors to reject racks with feedback for corrections
- **Solution**: Complete rejection workflow with reason tracking and rework capability
- **Database Changes**: Added `rejection_reason` column to racks table
- **Supervisor Features**:
  - Rejection dialog with required reason field
  - Updated approval pages with rejection capability
- **Scanner Features**:
  - Rejected racks show in available list with visual indicators
  - Ownership validation (only original scanner can rework rejected racks)
  - Existing scans preserved during rework process
- **Workflow**: Scan → Submit → Reject with reason → Original scanner reworks → Re-submit
- **Files**: Migration in `supabase/rejection_reason_migration.sql`
- **Result**: Complete feedback loop for quality control and rack corrections

### Platform Considerations
- **Windows Development**: Use `cd android && gradlew` (without ./)
- **React Native**: Using v0.73.2 (stable version without reanimated)
- **Android SDK Path**: Must set ANDROID_HOME environment variable

### Database Constraints
- **No Foreign Key to auth.users**: Using standalone users table
- **Manual Password Hashing**: Using pgcrypto extension for bcrypt

## Important Files

- **Tomorrow's Tasks**: `TODO_TOMORROW.md`
- **Immediate Priorities**: `docs/IMMEDIATE_PRIORITIES.md` (features to build now)
- **Future Enhancements**: `docs/future_enhancement_opportunities.md` (nice-to-haves)
- **Troubleshooting Guide**: `docs/archive/TROUBLESHOOTING.md` (detailed issue history)
- **Authentication Guide**: `docs/Authentication_and_Roles_Guide.md`
- **User Workflows**: `docs/User_Workflows_Guide.md`
- **Implementation Plan**: `docs/Implementation_Simplification_Guide.md`
- **Auth Migration**: `supabase/15_standalone_auth_fixed.sql`
- **Auth Workaround**: `mobile/src/store/slices/authSliceWorkaround.ts`

## Quick SQL Scripts

### Create Test Locations
```sql
INSERT INTO locations (name, address, city, state, active) VALUES
('Downtown Store', '123 Main St', 'Dallas', 'TX', true),
('Warehouse A', '456 Industrial Blvd', 'Irving', 'TX', true),
('North Branch', '789 Commerce Way', 'Plano', 'TX', true);
```

### Fix Superuser Access
```sql
UPDATE users SET location_ids = ARRAY(SELECT id FROM locations) 
WHERE username = 'saleem';
```

### Create Test Audit Session
```sql
INSERT INTO audit_sessions (location_id, total_rack_count, status, started_at, started_by)
VALUES (
  (SELECT id FROM locations WHERE name = 'Downtown Store'),
  20, 'active', NOW(),
  (SELECT id FROM users WHERE username = 'saleem')
);
```

## Production Deployment Guide

### App Signing & Keystore Management

#### What is a Keystore?
A keystore is a digital certificate file that proves app authenticity:
- **Digital signature** for your app (like a company seal)
- **Proves identity** - shows the app came from legitimate developer
- **Security** - prevents others from uploading fake updates
- **Required by Android** for all release builds
- **Critical**: Same keystore must be used for all future updates

#### Keystore Details
- **File**: `mobile/android/app/release-keystore.jks`
- **Alias**: `stock-audit-key`
- **Password**: `StockAudit2024!` (stored in gradle.properties)
- **Validity**: 10,000 days (until ~2051)
- **Organization**: PJ Stock Audit, Dallas, TX

#### Keystore Backup (CRITICAL)
**MUST backup immediately** - losing keystore = can never update app!
Backup to:
1. **Google Drive/Cloud Storage** - Store in secure folder
2. **USB Drive** - Physical backup
3. **Password Manager** - Attach file + credentials
4. **Email to yourself** - Subject: "Stock Audit Keystore - DO NOT DELETE"

#### Regenerating Keystore (if lost)
If keystore is lost, you CANNOT update existing app installations:
- Must create new app with different package name
- All users must uninstall old app and install new one
- Lose all user data and preferences
- **Prevention is critical!**

### Firebase App Distribution

#### Setup Requirements
1. **Firebase Project**: `pj-stock-audit-scanner`
2. **Firebase CLI**: `npm install -g firebase-tools`
3. **Login**: `firebase login`
4. **Gradle Plugin**: Already configured in build.gradle

#### Distribution Process
```bash
cd mobile
npm run distribute
```

This process:
1. **Builds** signed release APK with keystore
2. **Uploads** to Firebase App Distribution
3. **Sends invitations** to tester group: `internal-testers`

#### Tester Management
**Two-Layer Access Control Required**:

1. **Firebase App Distribution** (App Download):
   - Add emails to `internal-testers` group
   - Controls who can download the app
   - Go to Firebase Console → App Distribution → Testers & Groups

2. **Supabase Database** (App Login):
   - Add same emails in Dashboard → User Management
   - Set role (scanner/supervisor/superuser)
   - Assign location permissions
   - Controls who can actually use the app

#### Tester Experience
**First Time**:
1. Receive email invitation from Firebase
2. Install **Firebase App Tester** app from email link
3. Download Stock Audit Scanner through App Tester
4. Login with Google OAuth (must be whitelisted in database)

**Updates**:
1. Get notification in App Tester app
2. Download and install new version
3. Existing data preserved

### Android Device Setup for USB Scanners

#### Enable USB OTG (On-The-Go)
**Android 13+ Requirements**:
1. **Settings → Connected Devices → USB** (varies by manufacturer)
2. Look for "USB OTG" or "USB Host Mode"
3. **Enable USB OTG**

#### Battery Optimization (Critical for Android 13)
Android 13 has aggressive power management that cuts USB power:
1. **Settings → Apps → Stock Audit Scanner**
2. **Battery → Unrestricted**
3. This prevents system from cutting USB power to scanner

#### Developer Options Workaround
If scanner still not getting power:
1. **Settings → About Phone**
2. **Tap Build Number 7 times** (enables Developer Options)
3. **Settings → Developer Options**
4. **Enable USB Debugging**
5. This forces USB to stay powered

#### Scanner Configuration
Many USB scanners send barcode + Enter key, causing duplicate entries:
- Check scanner manual for "suffix" or "terminator" settings
- Disable Enter/Return suffix
- Set to send barcode only

### Release Build vs Debug Build Issues

#### Google OAuth SHA-1 Fingerprints
Debug and release builds use different SHA-1 fingerprints for Google OAuth:

**Get Release SHA-1**:
```bash
cd mobile/android/app
keytool -list -v -keystore release-keystore.jks -alias stock-audit-key
```

**Add to Firebase**:
1. Firebase Console → Project Settings → Your Android App
2. Add SHA-1 fingerprint from above
3. Download updated `google-services.json`
4. Replace in `mobile/android/app/google-services.json`
5. Rebuild and redistribute

#### Double-Scan Prevention
Release builds have timing differences that cause USB scanners to create duplicate database entries:

**Solution Implemented**:
- Added 1-second debounce in `ScannerInput.tsx`
- Prevents multiple rapid submissions from same scan event
- Allows legitimate re-scans after 1 second
- Only blocks rapid duplicates (within 1 second)

#### USB Permissions
Release builds need explicit USB permissions in `AndroidManifest.xml`:
```xml
<uses-feature android:name="android.hardware.usb.host" android:required="false" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
```

### Distribution Workflow

#### Pre-Distribution Checklist
1. **Test on physical device** first
2. **Verify Google OAuth** works with test accounts
3. **Test USB scanner** functionality
4. **Check for console errors** in release build
5. **Confirm keystore backup** exists

#### Build Commands
```bash
# Debug build (development)
npm run android

# Release build only
npm run build:release

# Build and distribute
npm run distribute

# Distribution with custom release notes
echo "Version X.X - Bug fixes and improvements" > release-notes.txt
npm run distribute:notes
```

#### Version Management
Update version before each release in `android/app/build.gradle`:
```gradle
defaultConfig {
    versionCode 2    // Increment for each release
    versionName "1.1" // User-visible version
}
```

#### Release Notes Best Practices
- Keep concise but descriptive
- Mention major fixes/features
- Include test focus areas
- Example: "Version 1.1 - Fixed double-scan issue, improved USB scanner compatibility"

### Troubleshooting Common Issues

#### Build Failures
```bash
# Clean build
cd mobile/android
gradlew clean
cd ..
npm run distribute
```

#### Firebase Upload Failures
- Check Firebase CLI login: `firebase login:list`
- Verify project access in Firebase Console
- Ensure internet connection stable

#### Scanner Not Working on Release
1. **Enable USB OTG** on device
2. **Set app battery to Unrestricted**
3. **Check scanner power requirements** (some need external power)
4. **Try developer options USB debugging**

#### Google Sign-In Failures
- **Wrong SHA-1 fingerprint** - most common issue
- Update SHA-1 in Firebase Console
- Download new google-services.json
- Rebuild and redistribute

#### No Email Notifications
- Check Firebase Console → App Distribution → Releases
- Click "Notify testers" manually
- Verify email addresses in tester group
- Check spam folders

### Security Considerations

#### Never Commit
- `*.jks` (keystore files)
- `gradle.properties` with passwords
- `google-services.json` changes (already in repo for reference)

#### Access Control
- Only authorized emails in Firebase tester group
- Same emails must be whitelisted in Supabase database
- Regular audit of user access
- Remove departed team members from both systems

#### Keystore Security
- Change default password (`StockAudit2024!`) to something more secure
- Store in encrypted location
- Limit access to essential team members only
- Never share over unsecured channels

### Performance Considerations

#### Release Build Optimizations
- ProGuard/R8 minification enabled
- Hermes JavaScript engine enabled
- Optimized APK size (~15MB)
- Removed debug symbols and logging

#### USB Scanner Performance
- 1-second debounce prevents duplicate entries
- Instant visual feedback with optimistic UI
- Queue system processes scans in background
- 15-second batch uploads to server

#### Battery Life
- Background queue optimized for battery
- USB OTG power management handled by Android
- App uses minimal background processing
- Automatic sync when app becomes active

- please give very concise answers going forward
- be very concise unless requested.