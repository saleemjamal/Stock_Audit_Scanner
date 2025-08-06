# Updated PRD - Stock Audit System v2.0
## With Rack/Shelf Management & Approval Workflow

### Key Changes from v1.0:
- Added rack/shelf location tracking
- Supervisor approval workflow
- Web admin dashboard
- PostgreSQL backend instead of Google Sheets
- Google SSO for supervisor/admin roles

---

## System Architecture

### 1. Backend API (Node.js + Express)
```
├── /auth
│   ├── POST /login (Gmail for scanners)
│   ├── POST /google-auth (OAuth for supervisors/admins)
│   └── GET /verify-token
├── /racks
│   ├── GET /active (racks in progress)
│   ├── POST /ready-for-approval
│   ├── POST /approve
│   ├── POST /reject
│   └── GET /status/:locationId
├── /scans
│   ├── POST /create
│   ├── GET /by-rack/:rackId
│   └── DELETE /delete/:scanId
├── /locations
│   ├── GET /all
│   ├── POST /create
│   └── PUT /update/:id
├── /users
│   ├── GET /all
│   ├── POST /assign-role
│   └── PUT /assign-location
└── /reports
    ├── GET /audit-summary
    ├── GET /user-metrics
    └── GET /export/:format
```

### 2. Database Schema (PostgreSQL)

```sql
-- Locations table
CREATE TABLE locations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(10) UNIQUE NOT NULL,
  address TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'scanner',
  location_ids INTEGER[],
  created_at TIMESTAMP DEFAULT NOW()
);
-- Racks table
CREATE TABLE racks (
  id SERIAL PRIMARY KEY,
  location_id INTEGER REFERENCES locations(id),
  rack_number VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  scanner_id INTEGER REFERENCES users(id),
  ready_for_approval BOOLEAN DEFAULT FALSE,
  approved_by INTEGER REFERENCES users(id),
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(location_id, rack_number)
);

-- Scans table
CREATE TABLE scans (
  id SERIAL PRIMARY KEY,
  barcode VARCHAR(255) NOT NULL,
  rack_id INTEGER REFERENCES racks(id),
  shelf_number VARCHAR(50),
  user_id INTEGER REFERENCES users(id),
  device_id VARCHAR(100),
  quantity INTEGER DEFAULT 1,
  recount_of INTEGER REFERENCES scans(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Audit trail table
CREATE TABLE audit_log (
  id SERIAL PRIMARY KEY,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id INTEGER,
  user_id INTEGER REFERENCES users(id),
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Products table (for future use)
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  barcode VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  description TEXT,
  category VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 3. Mobile App Updates

#### New Screens:
1. **Rack Selection Screen**
   - Manual rack number entry (keypad)
   - Optional shelf number
   - Shows current location prefix
   - "Continue Scanning" button

2. **Rack Management Screen**
   - List of user's active racks
   - Status indicators (scanning/ready/approved/rejected)
   - "Ready for Approval" button
   - Quick switch between racks
3. **Supervisor Approval Screen** (Mobile)
   - Pending approvals list
   - Rack details view
   - Item count summary
   - Approve/Reject buttons
   - Rejection reason text field

#### Updated Workflow:
```
1. Login → Location Selection → Main Menu
2. Start Scanning → Enter Rack # → Enter Shelf # (optional)
3. Scan Items → Items tagged with Location-Rack-Shelf
4. "Ready for Approval" → Notification to Supervisors
5. Supervisor Reviews → Approve/Reject
6. If Rejected → Original scanner notified for recount
```

### 4. Web Dashboard (Next.js)

#### Pages Structure:
```
├── /auth
│   └── login (Google SSO)
├── /dashboard
│   ├── Overview (real-time metrics)
│   ├── Live scanning activity
│   └── Pending approvals
├── /approvals
│   ├── Pending racks list
│   ├── Rack detail view
│   └── Approval history
├── /locations
│   ├── List all locations
│   ├── Add/edit location
│   └── Location analytics
├── /users
│   ├── User management
│   ├── Role assignment
│   └── Performance metrics
├── /reports
│   ├── Audit summary
│   ├── Export options
│   └── Historical data
└── /settings
    ├── System configuration
    └── Product master upload
```

#### Key Features:
1. **Real-time Dashboard**
   - Live scan feed
   - Racks pending approval
   - User activity status
   - Progress by location

2. **Approval Management**
   - Bulk approval options
   - Detailed rack view
   - Recount tracking
   - Audit trail

3. **Reporting**
   - Export to Excel/CSV
   - Variance reports
   - User productivity
   - Location comparisons
### 5. User Roles & Permissions

| Role | Mobile App Access | Web Dashboard | Permissions |
|------|------------------|---------------|-------------|
| Scanner | ✓ | ✗ | Scan items, mark rack ready |
| Supervisor | ✓ | ✓ | All scanner permissions + approve/reject racks |
| Admin | ✓ | ✓ | All permissions + user management, settings |

### 6. Real-time Updates (Socket.io)

#### Events:
```javascript
// Client → Server
socket.emit('scan:new', { barcode, rackId, userId })
socket.emit('rack:ready', { rackId })
socket.emit('rack:approve', { rackId, approverId })
socket.emit('rack:reject', { rackId, reason })

// Server → Clients
socket.emit('rack:updated', { rackId, status })
socket.emit('scan:added', { scanData })
socket.emit('notification:new', { type, message })
```

### 7. Implementation Phases

#### Phase 1: Core Backend & Database (Week 1-2)
- PostgreSQL setup
- API endpoints
- Authentication (Gmail + Google OAuth)
- Basic CRUD operations

#### Phase 2: Mobile App - Scanner Features (Week 3-4)
- Login flow
- Rack/shelf entry
- Scanning with location tagging
- "Ready for Approval" functionality
- Real-time sync

#### Phase 3: Mobile App - Supervisor Features (Week 5)
- Approval interface
- Dual role support
- Push notifications setup

#### Phase 4: Web Dashboard - MVP (Week 6-7)
- Next.js setup
- Live dashboard
- Approval management
- Basic reporting

#### Phase 5: Web Dashboard - Full Features (Week 8-9)
- User management
- Location management
- Advanced reporting
- Export functionality

#### Phase 6: Testing & Deployment (Week 10)
- End-to-end testing
- Performance optimization
- Deployment setup
- User training
### 8. Security Considerations

- JWT tokens with 24-hour expiry
- Role-based API middleware
- Rack locking during approval process
- Audit trail for all actions
- HTTPS only deployment
- Rate limiting on API endpoints

### 9. Success Metrics

- **Efficiency**: 50% reduction in audit completion time
- **Accuracy**: <0.1% variance after approval
- **Adoption**: 100% user adoption within first week
- **Reliability**: 99.9% uptime during audits
- **Approval Time**: <5 minutes average per rack

---

## Technical Stack Summary

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL 14+
- **Real-time**: Socket.io
- **Auth**: Passport.js (Google OAuth + JWT)
- **ORM**: Prisma or TypeORM

### Mobile App
- **Framework**: React Native 0.72+
- **State**: Redux Toolkit + RTK Query
- **Navigation**: React Navigation 6
- **UI**: React Native Paper
- **Real-time**: Socket.io Client
- **Scanner**: USB OTG (HID Mode)

### Web Dashboard
- **Framework**: Next.js 14+
- **UI Library**: Material-UI (MUI) v5
- **State**: Redux Toolkit + RTK Query
- **Charts**: Recharts
- **Tables**: MUI DataGrid
- **Real-time**: Socket.io Client

### DevOps
- **Backend Hosting**: AWS EC2 or Google Cloud Run
- **Database**: AWS RDS or Google Cloud SQL
- **Web Hosting**: Vercel (Next.js)
- **Mobile**: Google Play Store
- **Monitoring**: Sentry + CloudWatch

---

This complete system provides a robust, scalable solution for multi-location stock audits with proper approval workflows and real-time monitoring capabilities.