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
- `damage_drafts` - CSV import workflow for high-volume damage processing
- `add_on_items` - Items without barcodes
- `inventory_items` - Expected inventory for variance analysis (now with barcode field)
- `partial_damages` - Partial damage tracking with photos
- `delivery_challans` - Track items temporarily out of stock
- `dc_items` - Individual items on delivery challans

### User Roles
| Role | Capabilities |
|------|-------------|
| **Scanner** | Scan items, mark racks complete |
| **Supervisor** | Scanner features + approve/reject + variance reports + brand analysis + damage reporting + add-ons management |
| **Super User** | All features + user/location management + inventory import + DC management + damage/add-on approvals |

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
- **Damage Reporting** - 3-photo capture system with approval workflow + mobile camera support
- **High-Volume Damage Processing** - CSV import + photo queue + bulk operations + list view
- **Partial Damage System** - Flag items with unit ratios and severity levels
- **Add-Ons System** - Document items without barcodes
- **Brand Variance Analysis** - Real-time variance by brand (top 20)
- **Overall Variance Reports** - Comprehensive item-level variance analysis
- **Advanced Reports** - 6 report types with CSV export
- **Inventory Management** - CSV import for expected quantities and costs
- **Single Rack Focus** - One rack at a time
- **Role-Based Access** - Platform restrictions
- **Delivery Challan (DC)** - Track items temporarily out of stock during audit

## Development Guidelines
1. **Authentication** - Only pre-authorized users
2. **Performance** - Optimize for warehouse devices
3. **Session Scoping** - All data per audit session
4. **Error Handling** - Clear user feedback
5. **Responsive UI** - Collapsible sidebar design
6. **Access Control** - Role-based feature restrictions with page-level guards

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
- ✅ **High-volume damage processing** - Mobile camera fix, list view, bulk operations, CSV import
- ✅ **Restart Rack** - Scanners can clear all scans and restart on same rack
- ✅ **Rejected Damage Workflow** - Simplified process, no auto-conversion to partial damage
- ✅ **Delivery Challan System** - DC entry with item code to barcode mapping

## Advanced Features

### Delivery Challan (DC) System
- **Purpose**: Track items temporarily out of stock (samples, vendor returns)
- **DC Entry**: Manual DC number, 1-3 photos, item codes with quantities
- **Item Code Mapping**: Automatic barcode lookup from inventory_items
- **Variance Integration**: DC quantities excluded from shortage calculations
- **Formula**: Variance = Expected - (Scanned + DC Quantity)
- **Reporting**: DC adjustments shown separately in variance reports

### Variance Analysis System
- **Brand Variance**: Real-time analysis by brand with top 20 by variance value
- **Overall Variance**: Complete item-level variance for all inventory
- **Inventory Import**: CSV upload for expected quantities and unit costs
- **Live Calculations**: Real-time variance as scanning progresses
- **DC Adjustments**: Automatic inclusion of DC items in variance calculations

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

### Damage Rejection Workflow (Updated)
- **Rejection Process**: Super user rejects damage report with reason
- **No Auto-Conversion**: Rejected damages are NOT automatically converted to partial damages
- **Manual Re-scan Required**: Scanner must physically scan rejected items into final rack as partial damages
- **View Rejected Items**: Reports page has filter to show rejected damages for re-scanning
- **Final Rack**: Create a final rack (e.g., rack 101) specifically for rejected damage items
- **Benefits**: Ensures physical verification and accurate inventory count

### High-Volume Damage Processing System
- **Mobile Camera Support**: Native file input for mobile browsers (no getUserMedia issues)
- **CSV Import Workflow**: Bulk import damage reports → photo collection queue
- **List View**: Efficient table view with inline image thumbnails for 150+ items
- **Bulk Operations**: Select multiple reports, bulk approve/reject functionality
- **Photo Collection Queue**: Mobile-optimized interface for adding photos to imported items

### Key SQL Functions
```sql
-- Brand variance analysis with DC support
get_live_brand_variance(session_id UUID)
get_brand_variance_summary(session_id UUID)
get_live_brand_variance_widget(session_id UUID)

-- Overall variance reporting (comprehensive item-level analysis)
get_overall_variance_report(session_id UUID)
get_variance_report_metadata(session_id UUID)

-- DC specific functions
map_item_code_to_barcodes(item_code TEXT, location_id INT)
get_dc_summary(session_id UUID)
get_dc_quantity_for_barcode(session_id UUID, barcode TEXT)

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

### Import Sample Inventory with Barcodes
```sql
INSERT INTO inventory_items (location_id, item_code, barcode, brand, item_name, expected_quantity, unit_cost)
VALUES 
  (1, '12345', '123456789012', 'TestBrand', 'Sample Item 1', 10, 25.50),
  (1, '12345', '123456789013', 'TestBrand', 'Sample Item 1 - Box', 5, 255.00),
  (1, '12346', '123466789012', 'TestBrand', 'Sample Item 2', 15, 30.00);
```

## Important Files
- `docs/User_Workflows_Guide.md` - User workflows
- `docs/Authentication_and_Roles_Guide.md` - Auth guide
- `supabase/` - Database migrations and functions
- `supabase/delivery_challan_schema.sql` - DC tables and functions
- `supabase/update_variance_functions_with_dc.sql` - Variance functions with DC support
- `supabase/overall_variance_function.sql` - Overall variance SQL functions
- `supabase/brand_variance_summary_function.sql` - Brand variance summary function
- `supabase/create_inventory_items.sql` - Brand variance functions
- `supabase/partial_damages_migration.sql` - Partial damage system
- `dashboard/src/components/reports/` - Advanced reporting components
- `dashboard/src/components/dc/` - Delivery Challan components
- `dashboard/src/app/api/variance-report/` - Variance report API endpoint
- `dashboard/src/app/dashboard/delivery-challans/` - DC management page
- `OVERALL_VARIANCE_SETUP.md` - Setup guide for overall variance feature

## Development Notes
- Focus on web dashboard development only
- Be concise in responses
- Check existing code conventions before editing
- Brand variance calculations corrected to use database totals (not client-side aggregation)
- Overall variance provides comprehensive item-level analysis for all inventory
- Partial damage system integrated with photo upload and severity tracking
- CSV exports available for all report types with professional formatting
- DC system integrated with variance calculations for accurate reporting

## Technical Fixes Applied
- **Tab Navigation Fix**: Used `display: none` instead of conditional rendering for consistent Material-UI tab indices
- **Rack Numbering Fix**: Improved rack number calculation using `ORDER BY rack_number::integer` for proper numerical sorting
- **API Route Configuration**: Added `dynamic = 'force-dynamic'` to variance report API for proper Supabase authentication
- **TypeScript Fixes**: Resolved Chip component icon prop issues in variance reports
- **Error Handling**: Added specific handling for duplicate key constraints (23505 errors)
- **Barcode Join**: Updated variance functions to use direct barcode join instead of SUBSTRING extraction

## Recent Updates
- ✅ **Mobile Responsive Tables** - All tables now mobile-friendly with card layouts
- ✅ **Fixed IST Time Display** - Corrected hourly graphs to show proper Indian Standard Time
- ✅ **Enhanced Approval Metrics** - Added approval throughput rate (time per rack)
- ✅ **Damage Rejection Workflow** - Rejected damage converts to partial damage (sellable items)
- ✅ **Prominent Scan Counter** - Large badge showing current session scan count
- ✅ **Dynamic Scan Counts** - Real-time rack scan counts in approval interfaces
- ✅ **Fixed Current Hour Display** - Hourly graphs exclude incomplete hours to prevent misleading trends
- ✅ **Delivery Challan System** - Complete DC management with variance integration
# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.