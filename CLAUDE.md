# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Stock Audit Scanner System - A comprehensive mobile-based inventory audit system with:
- React Native Android app for barcode scanning with offline capability
- Next.js web dashboard for real-time monitoring and supervisor approvals
- Supabase backend (PostgreSQL + Auth + Realtime)
- Rack-based inventory management with approval workflow

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
- **locations**: Physical store locations
- **users**: Extended auth.users with roles (scanner, supervisor, admin)
- **audit_sessions**: Audit session management
- **racks**: Auto-generated racks with approval workflow
- **scans**: Individual barcode scans with offline sync support
- **notifications**: Real-time notification system

### Key Features
1. **Offline-First Mobile**: SQLite local storage with background sync
2. **USB Scanner Support**: Direct barcode input via USB OTG
3. **Rack Approval Workflow**: Scanner → Ready for Approval → Supervisor Review
4. **Real-time Updates**: Supabase subscriptions for live dashboard
5. **Location-Based Access**: Users assigned to specific locations
6. **Role-Based Authentication**: Different interfaces for scanners vs supervisors

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

1. **Offline Sync**: Mobile app must handle offline scanning and sync when online
2. **Real-time Updates**: Dashboard should show live scanning activity
3. **Permissions**: Respect Row Level Security (RLS) policies in Supabase
4. **Scanner Hardware**: Support USB OTG barcode scanners in HID keyboard mode
5. **Performance**: Optimize for 8+ hour scanning sessions on mobile devices
6. **Multi-location**: Users can be assigned to multiple locations
7. **Approval States**: Track rack status through complete workflow