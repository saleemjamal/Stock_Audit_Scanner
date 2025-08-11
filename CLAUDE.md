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
├── components/          # Reusable UI components (ScannerInput, SyncManager)
├── screens/            # Screen components organized by feature
│   ├── auth/          # Login, OAuth callback
│   └── main/          # Location, Rack, Scanning screens
├── navigation/         # React Navigation setup
├── store/             # Redux Toolkit store and slices
├── services/          # Supabase client, database operations
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
| **Scanner** | ✅ | ❌ | Scan items, mark racks complete |
| **Supervisor** | ✅ | ✅ | All scanner features + approve/reject + reports |
| **Super User** | ✅ | ✅ | All features + user management + location management |

### Key Features
1. **Google OAuth + Whitelisting**: Only pre-authorized users can access the system
2. **Offline-First Mobile**: SQLite local storage with background sync
3. **USB Scanner Support**: Direct barcode input via USB OTG
4. **Rack Approval Workflow**: Scanner → Ready for Approval → Supervisor Review
5. **Real-time Updates**: Supabase subscriptions for live dashboard
6. **Role-Based Access**: Platform restrictions based on user role
7. **Dual-Platform Supervisors**: Can use both mobile and web for flexibility

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
2. **Role-Based Access**: Enforce platform restrictions (scanners mobile-only, supervisors both)
3. **Offline Sync**: Mobile app must handle offline scanning and sync when online
4. **Real-time Updates**: Dashboard should show live scanning activity
5. **Permissions**: Respect Row Level Security (RLS) policies in Supabase
6. **Scanner Hardware**: Support USB OTG barcode scanners in HID keyboard mode
7. **Performance**: Optimize for older Android devices used in warehouse environments
8. **Super User Flexibility**: saleem@poppatjamals.com needs full system access
9. **Supervisor Dual-Access**: Supervisors use web for approvals, mobile for hands-on work

## Business Requirements (Clarified)

### Core Workflow
- **Blind Counting Only**: No expected quantities shown (reduces bias)
- **Full Audit Mode**: Primary use case for twice-yearly complete inventory counts
- **Manual Rack Selection**: Scanners choose their own racks (no auto-assignment)
- **Universal Approval**: Every rack requires supervisor approval (no exceptions)
- **Individual Scanning**: One scan per item (no batch/quantity entry)

### Must-Have Features
1. **Real-time Progress Indicators** (Mobile): Show completion %, speed, time estimates
2. **Session Continuity**: Auto-save each scan, crash recovery, rack reassignment
3. **Dashboard KPIs** (Web): Accuracy, throughput, first-pass yield, cycle time
4. **Swipe to Undo** (Mobile): Quick error correction for last scan
5. **Dual Status Views** (Web): Rack-wise and scanner-wise monitoring

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

🚨 **CRITICAL Performance Issue Identified (Aug 8, 2025)**:
- **SQLite Performance Crisis**: Local database saves taking **60+ seconds per scan**
- **System Impact**: Scanning workflow completely unusable for warehouse operations  
- **Immediate Priority**: op-sqlite migration + batch operations (Enhancement #1 + #4)
- **Status**: URGENT implementation required - current system blocked

🔄 **Current Testing Status**: 
- **Mobile App**: Successfully installed and running on physical Android device ✅
- **Authentication**: Google OAuth working with proper whitelisting on both platforms ✅
- **Scanning**: Barcode scanning reads correctly but **CRITICAL PERFORMANCE ISSUE** ❌
- **Database**: SQLite saves taking 60+ seconds - **SYSTEM BLOCKED** ❌
- **UI/UX**: Optimistic UI and visual feedback working properly ✅
- **Background Sync**: Server sync and retry queue working ✅

📋 **URGENT Next Steps**: 
1. **🔴 CRITICAL: Fix SQLite Performance** - 60+ second saves make system unusable
   - Investigate database corruption/locks immediately
   - Implement op-sqlite migration (Enhancement #1)
   - Implement batch operations (Enhancement #4)
2. **Emergency Fallback**: True optimistic UI (clear input regardless of DB performance)
3. **USB Scanner Testing** - Test physical USB barcode scanner (once DB performance fixed)
4. **Complete Dashboard Components** - Finish LocationStats and RecentActivity components

📋 **Future Enhancements Documented**: 
1. **User-Controlled Duplicate Handling** - Last 5 scans with swipe-to-delete (see `docs/Future Enhancements/0808_Duplicate_Handling.md`)
2. **Legacy Code Refactoring** - Cleanup plan documented (see `docs/Future Enhancements/0808Code_Refactor.md`)
3. **Firebase App Distribution** - Team testing deployment strategy (see `docs/Future Enhancements/0808deployment.md`)

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

### 9. SQLite Performance Crisis (CRITICAL - URGENT)
- **Problem**: Local database saves taking **60+ seconds per scan** - completely unusable for warehouse operations
- **Suspected Causes**: 
  - Database corruption or file system locks
  - `react-native-sqlite-storage` performance limitations
  - No WAL mode or transaction optimization
  - Potential Android storage permissions issues
- **Impact**: Scanning workflow completely blocked, system unusable
- **Solution**: Immediate implementation of Enhancement #1 (op-sqlite) + #4 (batch operations)
- **Status**: **CRITICAL BLOCKER** - requires immediate attention before further testing

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