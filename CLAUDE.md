# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Stock Audit Scanner System - A mobile-first inventory audit system with simplified authentication and role-based access:
- **React Native Android app** for barcode scanning with offline capability
- **Next.js web dashboard** for real-time monitoring and supervisor approvals  
- **Supabase backend** (PostgreSQL + Auth + Realtime)
- **Simple authentication** using username/password (no OAuth complexity)
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
- **users**: Username/password auth with roles (scanner, supervisor, superuser)
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
1. **Simple Authentication**: Username/password only (no OAuth complexity)
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

1. **Simple Authentication**: Use username/password only - avoid OAuth complexity
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
- Username/password authentication working (using RPC function `login_with_username`)
- Mobile app login functional with test users
- Database schema with standalone auth (no Supabase Auth dependency)
- Role-based access control implemented
- Test users created (saleem/password123, supervisor1/password123, scanner1/password123)
- Basic UI screens exist (LocationSelection, RackSelection, Scanning)
- Web dashboard running with authentication check
- Redux store configured with auth, app, rack, scan, and sync slices
- Offline SQLite storage setup for mobile

🚧 **Current Blockers**: 
- **No test locations in database** - Users see "No locations assigned"
- **No audit sessions** - Cannot test scanning workflow
- **Superuser location access** - saleem should automatically see all locations

🔄 **In Progress**: 
- Adding test locations and audit sessions to database
- Testing complete scanning workflow
- Verifying web dashboard supervisor features

📋 **Next Steps**: 
1. Create test locations (Downtown Store, Warehouse A, etc.)
2. Fix superuser location access (should see all locations)
3. Create active audit session with test racks
4. Test end-to-end scanning workflow
5. Verify supervisor approval interface works
6. Complete full audit cycle testing

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
- **Problem**: Database initialization taking 10-30 seconds, app appeared to hang
- **Solution**: 
  - Reduced indexes from 8 to 3 essential ones on first launch
  - Added progress logging and timeout protection (30 seconds)
  - Split table creation into individual operations
- **Result**: 60-70% faster initialization (3-10 seconds vs 10-30 seconds)

### 5. Metro Bundler Shared Folder Access (RESOLVED)
- **Problem**: Cannot import from `shared/` folder outside React Native directory
- **Solution**: Updated `metro.config.js` to include shared folder in watchFolders
- **File**: `mobile/metro.config.js`

### 6. Environment Variables Loading (RESOLVED)
- **Problem**: `react-native-config` returning undefined, causing Supabase init to fail
- **Solution**: Added optional chaining and hardcoded fallbacks for Supabase URL/key
- **File**: `mobile/src/services/supabase.ts`

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