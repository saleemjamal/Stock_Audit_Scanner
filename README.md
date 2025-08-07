# Stock Audit Scanner System

A comprehensive mobile-based inventory audit system with simple authentication, role-based access, and supervisor approval workflow.

## 🏗️ Project Structure

```
Stock_Audit/
├── mobile/                    # React Native Android App
│   ├── src/                   # App source code
│   ├── android/              # Android-specific files
│   └── package.json
├── dashboard/                 # Next.js Web Dashboard  
│   ├── src/                   # Dashboard source code
│   └── package.json
├── supabase/                  # Database schema and migrations
│   ├── 01_schema.sql         # Database tables
│   ├── 02_rls_policies.sql   # Row Level Security
│   ├── 03_functions.sql      # Database functions
│   └── 04_seed.sql           # Test data
├── shared/                    # Shared utilities and types
│   ├── types/                # TypeScript definitions
│   └── utils/                # Common functions
└── docs/                      # Complete documentation
    ├── Authentication_and_Roles_Guide.md
    ├── User_Workflows_Guide.md
    ├── Implementation_Simplification_Guide.md
    ├── TROUBLESHOOTING.md
    └── [other guides...]
```

## 🎯 System Overview

**Purpose**: Mobile-first inventory audit system for warehouse/retail environments

**Key Features**:
- **Simple Authentication**: Username/password for all users
- **Role-Based Access**: Scanner (mobile) → Supervisor (both) → Super User (admin)
- **Mobile Scanning**: USB barcode scanner support with offline capability
- **Web Dashboard**: Real-time monitoring, approval workflow, user management
- **Rack Management**: Structured audit workflow with supervisor approval
- **Offline-First**: SQLite local storage with automatic sync

## 👥 User Roles & Access

| Role | Mobile App | Web Dashboard | Capabilities |
|------|------------|---------------|--------------|
| **Scanner** | ✅ | ❌ | Scan items, mark racks complete |
| **Supervisor** | ✅ | ✅ | All scanner features + approve/reject + reports |
| **Super User** | ✅ | ✅ | All features + user management + location management |

**Super User**: saleem@poppatjamals.com (full system access)

## 🚀 Quick Start

### 1. Prerequisites
- Node.js 18+ installed
- Android Studio with SDK
- Supabase account

### 2. Database Setup
```bash
# 1. Create project at supabase.com
# 2. Run SQL files in order:
#    - supabase/01_schema.sql
#    - supabase/02_rls_policies.sql  
#    - supabase/03_functions.sql
#    - supabase/04_seed.sql (optional test data)
```

### 3. Environment Configuration
```bash
# mobile/.env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# dashboard/.env.local  
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Mobile App (Android)
```bash
cd mobile
npm install
npx react-native start          # Terminal 1: Metro bundler
npx react-native run-android    # Terminal 2: Run on device/emulator
```

### 5. Web Dashboard
```bash
cd dashboard
npm install
npm run dev                     # Runs on http://localhost:3000
```

## 📱 Core Workflows

### **Scanner Workflow (Mobile)**
1. Login with username/password
2. Select location from assigned locations
3. Choose available rack from list
4. Scan barcodes (USB scanner or camera)
5. Mark rack complete for approval
6. Repeat with next rack

### **Supervisor Workflow**
**Web Dashboard:**
1. Login to dashboard
2. Review pending rack approvals
3. Approve or reject with notes
4. Generate audit reports

**Mobile App:**
1. Login to mobile (same as scanners)
2. Perform quality spot checks
3. Train new scanners hands-on
4. Fill staffing gaps when needed

### **Super User Workflow**
- **All supervisor capabilities** (web + mobile)
- **User Management**: Create accounts, assign roles
- **Location Management**: Create/edit store locations
- **System Administration**: Full oversight and control

## 🛠️ Tech Stack

- **Mobile**: React Native, Redux Toolkit, SQLite, React Navigation
- **Web**: Next.js 14, Material-UI, TypeScript
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **Authentication**: Simple username/password (no OAuth)
- **Deployment**: Vercel (web), Firebase App Distribution (mobile)

## 📊 Architecture

```
Mobile App (React Native) ──┐
                           ├──► Supabase Platform
Web Dashboard (Next.js) ────┘    ├─ PostgreSQL Database
                                 ├─ Authentication  
                                 ├─ Realtime Subscriptions
                                 ├─ Row Level Security
                                 └─ Auto-generated APIs
```

## 📖 Documentation

### **Core Documentation**
- **[Authentication & Roles Guide](docs/Authentication_and_Roles_Guide.md)**: Complete role system and security
- **[User Workflows Guide](docs/User_Workflows_Guide.md)**: Step-by-step workflows for each role
- **[Implementation Guide](docs/Implementation_Simplification_Guide.md)**: Phased development approach
- **[Troubleshooting Guide](docs/TROUBLESHOOTING.md)**: React Native setup and common issues

### **Additional Guides**
- **[PRD Complete](docs/PRD_Complete.md)**: Full product requirements
- **[Supabase Implementation](docs/Supabase_Implementation.md)**: Database setup details
- **[Performance Optimization](docs/Performance_Optimization_Guide.md)**: Optimization for older devices
- **[Native Android Guide](docs/Native_Android_Implementation_Guide.md)**: Alternative native approach

## 🚦 Implementation Status

### ✅ **Completed**
- React Native app builds and runs
- Database schema and types defined
- Authentication system designed
- User workflows documented
- SQLite optimization implemented
- Login screen functional

### 🔄 **In Progress**
- Username/password authentication implementation
- Role-based access control
- Basic scanning workflow

### 📋 **Next Phase**
- Rack selection and management
- Supervisor approval workflow
- Web dashboard development
- User management interface

## 🔧 Development Commands

### Mobile App
```bash
cd mobile
npm install                    # Install dependencies
npx react-native start         # Start Metro bundler
npx react-native run-android   # Run on Android
npm test                       # Run tests
npm run lint                   # Run linting
npm run clean                  # Clean cache
```

### Web Dashboard
```bash
cd dashboard
npm install                    # Install dependencies
npm run dev                    # Start development server
npm run build                  # Build for production
npm run start                  # Start production server
npm run lint                   # Run linting
npm run type-check             # TypeScript checking
```

## 🤝 Contributing

1. Follow the phased implementation approach in the Implementation Guide
2. Test each change thoroughly before proceeding
3. Update documentation when adding features
4. Maintain the simple authentication approach

## 📄 License

Private project for internal company use.

---

For detailed implementation instructions, refer to the documentation in the `/docs` directory.