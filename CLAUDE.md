# CLAUDE.md

## Project Overview
Stock Audit Scanner System - Inventory audit system with role-based access:
- **Next.js web dashboard** for monitoring and approvals
- **React Native mobile app** for barcode scanning  
- **Supabase backend** (PostgreSQL + Auth + Realtime)
- **Three roles**: Scanner → Supervisor → Super User (saleem@poppatjamals.com)

## Web Dashboard Commands
```bash
cd dashboard
npm install         # Install dependencies
npm run dev         # Development server
npm run build       # Production build
npm run lint        # ESLint
npm run type-check  # TypeScript checking
```

## Architecture

### Dashboard Structure
```
dashboard/src/
├── app/            # Next.js 14 App Router
│   ├── dashboard/  # Protected pages
│   └── auth/       # Authentication
├── components/     # Reusable UI
├── lib/           # Supabase client
├── hooks/         # Data fetching
└── types/         # TypeScript types
```

### Database Tables
- `users` - Google OAuth authentication
- `locations` - Store locations
- `audit_sessions` - Session management
- `racks` - Approval workflow
- `scans` - Barcode data
- `damaged_items` - Damage reporting
- `add_on_items` - Items without barcodes

### User Roles
| Role | Capabilities |
|------|-------------|
| **Scanner** | Scan items, mark racks complete, damage reporting |
| **Supervisor** | Scanner features + approve/reject + reports |
| **Super User** | All features + user/location management |

## Environment Setup (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Key Features
- **Google OAuth** with email whitelisting
- **USB Scanner Support** for web scanning
- **Real-time Updates** via Supabase subscriptions
- **Approval Workflow** - Scan → Review → Approve/Reject
- **Damage Reporting** - 3-photo capture system
- **Add-Ons System** - Document items without barcodes
- **Session Reports** - 4 tabs with CSV export
- **Single Rack Focus** - One rack at a time
- **Role-Based Access** - Platform restrictions

## Development Guidelines
1. **Authentication** - Only pre-authorized users
2. **Performance** - Optimize for warehouse devices
3. **Session Scoping** - All data per audit session
4. **Error Handling** - Clear user feedback
5. **Responsive UI** - Collapsible sidebar design

## Current Status
**PRODUCTION READY** - All core features implemented:
- ✅ Web scanning with USB support
- ✅ Approval workflow (racks/damage/add-ons)
- ✅ Real-time dashboard updates
- ✅ Role-based access control
- ✅ Session management
- ✅ Reporting system with exports
- ✅ Rack barcode scanning (DDMM-###)

## Quick SQL Scripts

### Create Test Location
```sql
INSERT INTO locations (name, address, city, state, active) 
VALUES ('Downtown Store', '123 Main St', 'Dallas', 'TX', true);
```

### Create Audit Session
```sql
INSERT INTO audit_sessions (location_id, total_rack_count, status, started_at, started_by)
VALUES (
  (SELECT id FROM locations WHERE name = 'Downtown Store'),
  20, 'active', NOW(),
  (SELECT id FROM users WHERE username = 'saleem')
);
```

## Important Files
- `docs/User_Workflows_Guide.md` - User workflows
- `docs/Authentication_and_Roles_Guide.md` - Auth guide
- `supabase/` - Database migrations

## Notes
- Focus on web dashboard development only
- Be concise in responses
- Check existing code conventions before editing