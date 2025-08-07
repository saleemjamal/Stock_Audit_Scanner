# Product Requirements Document (PRD)
# Stock Audit Mobile System with Approval Workflow

**Version:** 2.0  
**Date:** January 2025  
**Status:** Complete Architecture with Supabase

---

## 1. Executive Summary

### 1.1 Purpose
Mobile-based barcode scanning application for stock audits in retail stores, replacing laptop-based systems with an efficient Android solution. Features rack-based inventory tracking, supervisor approval workflow, and real-time synchronization.

### 1.2 Scope
- Android mobile application (React Native)
- 5+ concurrent devices support
- USB OTG barcode scanner integration
- Rack/shelf location tracking
- Supervisor approval workflow
- Real-time dashboard (Next.js)
- Supabase backend (PostgreSQL + Auth + Realtime)
- 15,000 items across 4,000-8,000 SKUs

---

## 2. Problem Statement

### Current Challenges:
- Laptop-based scanning is cumbersome
- No location-based organization (rack/shelf)
- No approval workflow for accuracy
- Manual data consolidation
- Risk of data loss

### Proposed Solution:
Mobile-first system with:
- Rack-based scanning workflow
- Supervisor approval process
- Real-time synchronization
- Centralized web dashboard
- Offline capability

---

## 3. User Personas & Roles

### 3.1 Scanner/Auditor
- **Auth**: Gmail login (Email OTP)
- **Access**: Mobile app only
- **Actions**: Scan items, mark rack ready
- **Pain Points**: Repetitive scanning, recount requests

### 3.2 Supervisor
- **Auth**: Google SSO
- **Access**: Mobile app + Web dashboard
- **Actions**: Approve/reject racks (own locations only)
- **Visibility**: Only assigned locations
- **Pain Points**: Tracking completion, ensuring accuracy

### 3.3 Admin
- **Auth**: Google SSO
- **Access**: Full system access
- **Actions**: User management, reports, settings
- **Pain Points**: Multi-location coordination
---

## 4. Product Requirements

### 4.1 Functional Requirements

#### 4.1.1 Rack Management Workflow
- **Rack Entry**
  - Admin sets total rack count during audit setup
  - Users select from dropdown of available racks
  - Automatic assignment on selection
  - Optional shelf number
  - No manual entry errors
  
- **Scanning Process**
  - Admin starts audit session (sets location + rack count)
  - System auto-generates numbered racks (1 to N)
  - Users select available rack from dropdown
  - All scans tagged with selected rack
  - Can return to rack until approved
  - "Ready for Approval" button when complete

- **Approval Workflow**
  - Supervisor notified via in-app bell icon
  - Review total count per rack
  - Approve: Rack locked/completed
  - Reject: Request recount with reason
  - Blind recount (no previous count shown)
  - Audit trail for all actions

#### 4.1.2 Barcode Scanning
- **USB Scanner Support**
  - USB OTG connection (wired)
  - HID keyboard mode
  - Support UPC, EAN, Code128, QR
  - <100ms scan response
  
- **Manual Entry**
  - Fallback for damaged barcodes
  - Numeric keypad interface

#### 4.1.3 Data Management
- **Scan Record Structure**
  ```json
  {
    "id": "uuid",
    "barcode": "123456789012",
    "rack_id": "rack_uuid",
    "shelf_number": "A1",
    "user_id": "user_uuid",
    "device_id": "DEVICE_001",
    "quantity": 1,
    "recount_of": null,
    "created_at": "2025-01-15T10:30:00Z"
  }
  ```

#### 4.1.4 User Interface

**Mobile App Screens:**
1. **Login** - Email OTP or Google SSO
2. **Location Selection** - Choose store
3. **Start Audit** - Admin sets rack count
4. **Rack Selection** - Dropdown of available racks
5. **Main Scan** - Active scanning interface
5. **Rack List** - User's active/pending racks
6. **Approvals** - Supervisor approval queue

**Web Dashboard Pages:**
1. **Overview** - Real-time metrics
2. **Approvals** - Pending rack reviews
3. **Locations** - Multi-store management
4. **Users** - Role assignments
5. **Reports** - Export audit data
   - **Raw SKU List**: Single column, each scan as row
   - **Detailed Audit**: SKU | Timestamp | Scanner | Rack
   - **Summary Report**: Aggregated counts by SKU
   - **Location Report**: Filtered by supervisor's locations
#### 4.1.5 Synchronization & Real-time
- **Supabase Realtime**
  - Instant rack status updates
  - Live scanning feed
  - Approval notifications
  - No manual sync needed
  
- **Offline Support**
  - Local SQLite database for offline operation
  - Automatic background sync when connected
  - Visual indicators for offline mode
  - No data loss even during crashes
  - Seamless scanner experience online/offline

### 4.2 Non-Functional Requirements

#### 4.2.1 Performance
- Scanner response: <100ms
- App launch: <3 seconds
- Database queries: <50ms
- Real-time updates: <500ms

#### 4.2.2 Reliability
- 24+ hour offline operation
- Local SQLite database for scan storage
- Background sync when reconnected
- 99.9% data persistence
- Automatic crash recovery
- 8+ hour battery life

#### 4.2.3 Compatibility
- Android 9.0+ (API 28)
- Screen sizes: 5" to 10"
- USB OTG required
- 2GB RAM minimum

---

## 5. Technical Architecture

### 5.1 Supabase Architecture
```
┌─────────────┐     ┌─────────────────────────────┐
│ Mobile App  │────▶│         SUPABASE           │
│  (React     │     │  • PostgreSQL Database     │
│   Native)   │     │  • Authentication          │
└─────────────┘     │  • Realtime Subscriptions  │
                    │  • Row Level Security      │
┌─────────────┐     │  • Auto-generated APIs     │
│ Web Dashboard│────▶│  • Edge Functions          │
│  (Next.js)  │     │  • File Storage            │
└─────────────┘     └─────────────────────────────┘
```

### 5.2 Technology Stack
- **Mobile**: React Native 0.72+
- **Web**: Next.js 14+ with Material-UI
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **State**: Redux Toolkit + RTK Query
- **Scanner**: USB OTG (HID mode)

### 5.3 Database Schema
```sql
-- Core tables with RLS enabled
- users (extends auth.users)
- locations 
- racks (with approval workflow)
- scans (barcode records)
- audit_log (all actions)
- notifications (pending approvals)
---

## 6. User Interface Mockups

### 6.1 Mobile App - Main Scan Screen
```
┌─────────────────────────┐
│ Stock Audit Scanner     │
│ ═══════════════════════ │
│ 📍 A-12 | Shelf: B3    │
│                         │
│    📊 Total: 1,234     │
│                         │
│ ┌─────────────────────┐ │
│ │   [Scanner Input]   │ │
│ └─────────────────────┘ │
│                         │
│ Last: 123456789012     │
│ Time: 10:30:25 AM      │
│                         │
│ ┌──────────────────┐   │
│ │ Ready for Approval│   │
│ └──────────────────┘   │
└─────────────────────────┘
```

### 6.2 Web Dashboard - Overview
```
┌────────────────────────────────────────┐
│ Active: 12 | Scanned: 4,521 | Pending: 8│
├────────────────────────────────────────┤
│ Live Activity          │ Pending Racks │
│ • User1 → A-12 scan   │ • A-5 (234)  │
│ • User2 → B-3 scan    │ • B-1 (567)  │
│ • User3 → A-7 ready   │ • C-2 (189)  │
└────────────────────────────────────────┘
```

---

## 7. Implementation Phases

### Phase 1: Foundation (Week 1-2)
- Supabase project setup
- Database schema with RLS
- Authentication (Email OTP + Google)
- Basic CRUD operations

### Phase 2: Mobile Scanner Features (Week 3-4)
- Rack entry workflow
- USB scanner integration
- Offline capability
- "Ready for Approval" flow

### Phase 3: Approval System (Week 5)
- Mobile approval interface
- Real-time notifications
- Recount workflow

### Phase 4: Web Dashboard (Week 6-7)
- Next.js setup with Supabase
- Live monitoring dashboard
- Approval management
- User/location admin

### Phase 5: Polish & Deploy (Week 8)
- Performance optimization
- Testing & bug fixes
- Play Store deployment
- Training materials
---

## 8. Success Metrics

- **Efficiency**: 50% reduction in audit time
- **Accuracy**: <0.1% error after approval
- **Adoption**: 100% within first week
- **Approval Time**: <5 minutes per rack
- **System Uptime**: 99.9%

---

## 9. Security & Compliance

- Supabase Row Level Security (RLS)
- Role-based access control
- Audit trail for all actions
- HTTPS only
- No sensitive data in logs

---

## 10. Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Scanner incompatibility | High | Test multiple models early |
| Offline sync conflicts | Medium | Last-write-wins + audit log |
| User adoption | Medium | Simple UI, training videos |
| Multi-location confusion | Low | Clear location prefixes |

---

## 11. Hardware Requirements

### Recommended Setup (per location):
- 5x Android devices (tablets/phones)
- 5x USB barcode scanners (Honeywell Voyager 1470g or TVS BS-L100)
- 5x USB OTG adapters
- Backup scanner + device

### Device Requirements:
- Android 9.0+
- USB OTG support
- 2GB+ RAM
- 5"+ screen

---

## 12. Cost Analysis

### Supabase Costs:
- **Free Tier**: 0-500MB, 50K users
- **Pro Tier**: $25/month (8GB, 100K users)
- **Estimated**: $0-25/month total

### Hardware (one-time):
- Scanners: 5 × $150 = $750
- OTG Adapters: 5 × $10 = $50
- **Total**: $800 per location

### Development:
- 8 weeks × $X developer rate

---

## Appendices

### A. Scanner Configuration
- Set to USB HID mode
- Add Tab/Enter suffix
- Enable beep feedback

### B. Future Enhancements
- Product master integration
- Expected vs actual quantities
- Multi-language support
- Barcode printing for racks

### C. Support Resources
- Video tutorials
- FAQ documentation
- In-app help
- Email support channel