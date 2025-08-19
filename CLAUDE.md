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
- `scans` - Barcode data with quantity field
- `damaged_items` - Damage reporting with approval workflow
- `add_on_items` - Items without barcodes
- `inventory_items` - Expected inventory for variance analysis
- `partial_damages` - Partial damage tracking with photos

### User Roles
| Role | Capabilities |
|------|-------------|
| **Scanner** | Scan items, mark racks complete, damage reporting, partial damage flags |
| **Supervisor** | Scanner features + approve/reject + variance reports + brand analysis |
| **Super User** | All features + user/location management + inventory import |

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
- **Damage Reporting** - 3-photo capture system with approval workflow
- **Partial Damage System** - Flag items with unit ratios and severity levels
- **Add-Ons System** - Document items without barcodes
- **Brand Variance Analysis** - Real-time variance by brand (top 20)
- **Overall Variance Reports** - Comprehensive item-level variance analysis
- **Advanced Reports** - 6 report types with CSV export
- **Inventory Management** - CSV import for expected quantities and costs
- **Single Rack Focus** - One rack at a time
- **Role-Based Access** - Platform restrictions

## Development Guidelines
1. **Authentication** - Only pre-authorized users
2. **Performance** - Optimize for warehouse devices
3. **Session Scoping** - All data per audit session
4. **Error Handling** - Clear user feedback
5. **Responsive UI** - Collapsible sidebar design

## Current Status
**PRODUCTION READY** - All core features implemented and tested:
- ✅ Web scanning with USB support
- ✅ Approval workflow (racks/damage/add-ons)
- ✅ Real-time dashboard updates
- ✅ Role-based access control
- ✅ Session management with robust rack creation
- ✅ Advanced reporting system (6 report types)
- ✅ Variance analysis (brand-level and overall) - **Navigation Fixed**
- ✅ Partial damage tracking with photos
- ✅ Inventory management with CSV import
- ✅ Rack barcode scanning (DDMM-###)
- ✅ Error handling and user feedback improvements

## Advanced Features

### Variance Analysis System
- **Brand Variance**: Real-time analysis by brand with top 20 by variance value
- **Overall Variance**: Complete item-level variance for all inventory
- **Inventory Import**: CSV upload for expected quantities and unit costs
- **Live Calculations**: Real-time variance as scanning progresses

### Reporting System (6 Report Types)
1. **Audit Sessions** - Completed session overview with barcode exports
2. **Racks** - Individual rack reports with scan details
3. **Damage Reports** - Full damage tracking with approval workflow
4. **Add-On Reports** - Items without barcodes with pricing
5. **Partial Damages** - Partial damage flags with photos and severity
6. **Brand/Overall Variance** - Complete variance analysis with CSV export

### Partial Damage System
- **Severity Levels**: Minor, Moderate, Severe
- **Unit Ratios**: Track affected quantity (e.g., "2/12 damaged")
- **Photo Documentation**: Multiple photos per damage report
- **Damage Types**: Configurable damage categories

### Key SQL Functions
```sql
-- Brand variance analysis (fixed client-side aggregation issues)
get_live_brand_variance(session_id UUID)
get_brand_variance_summary(session_id UUID)
get_live_brand_variance_widget(session_id UUID)

-- Overall variance reporting (comprehensive item-level analysis)
get_overall_variance_report(session_id UUID)
get_variance_report_metadata(session_id UUID)

-- Reporting functions
get_sessions_for_reports()
get_racks_by_session(session_id UUID, include_active BOOLEAN)
get_rack_export_data(rack_id UUID)
```

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

### Import Sample Inventory
```sql
INSERT INTO inventory_items (location_id, item_code, brand, item_name, expected_quantity, unit_cost)
VALUES 
  (1, '12345', 'TestBrand', 'Sample Item 1', 10, 25.50),
  (1, '12346', 'TestBrand', 'Sample Item 2', 15, 30.00);
```

## Important Files
- `docs/User_Workflows_Guide.md` - User workflows
- `docs/Authentication_and_Roles_Guide.md` - Auth guide
- `supabase/` - Database migrations and functions
- `supabase/overall_variance_function.sql` - Overall variance SQL functions
- `supabase/brand_variance_summary_function.sql` - Brand variance summary function
- `supabase/create_inventory_items.sql` - Brand variance functions
- `supabase/partial_damages_migration.sql` - Partial damage system
- `dashboard/src/components/reports/` - Advanced reporting components
- `dashboard/src/app/api/variance-report/` - Variance report API endpoint
- `OVERALL_VARIANCE_SETUP.md` - Setup guide for overall variance feature

## Development Notes
- Focus on web dashboard development only
- Be concise in responses
- Check existing code conventions before editing
- Brand variance calculations corrected to use database totals (not client-side aggregation)
- Overall variance provides comprehensive item-level analysis for all inventory
- Partial damage system integrated with photo upload and severity tracking
- CSV exports available for all report types with professional formatting

## Technical Fixes Applied
- **Tab Navigation Fix**: Used `display: none` instead of conditional rendering for consistent Material-UI tab indices
- **Rack Numbering Fix**: Improved rack number calculation using `ORDER BY rack_number::integer` for proper numerical sorting
- **API Route Configuration**: Added `dynamic = 'force-dynamic'` to variance report API for proper Supabase authentication
- **TypeScript Fixes**: Resolved Chip component icon prop issues in variance reports
- **Error Handling**: Added specific handling for duplicate key constraints (23505 errors)

## Recent Updates
- ✅ **Fixed Brand Variance Calculations** - Resolved client-side aggregation issues
- ✅ **Added Overall Variance Reports** - Comprehensive item-level variance analysis
- ✅ **Enhanced Partial Damage System** - Full photo documentation and severity levels
- ✅ **Improved Reporting System** - 6 report types with advanced CSV exports
- ✅ **Inventory Management** - CSV import system for expected quantities and costs
- ✅ **Fixed Tab Navigation** - Brand and Overall Variance tabs now properly accessible
- ✅ **Fixed Duplicate Rack Issue** - Resolved rack number conflicts in session management
- ✅ **Enhanced Error Handling** - Better user feedback for rack creation and API errors