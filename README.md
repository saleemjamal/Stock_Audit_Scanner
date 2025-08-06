# Stock Audit Scanner System

A comprehensive mobile-based inventory audit system with rack management, supervisor approval workflow, and real-time monitoring.

## 🏗️ Project Structure

```
stock_audit_system/
├── mobile/                    # React Native Android App
│   ├── src/
│   ├── android/
│   ├── package.json
│   └── README.md
├── dashboard/                 # Next.js Web Dashboard
│   ├── src/
│   ├── package.json
│   └── README.md
├── supabase/                  # Database schema and functions
│   ├── migrations/
│   ├── seed.sql
│   └── README.md
├── shared/                    # Shared utilities and types
│   ├── types/
│   └── utils/
└── docs/                      # Documentation
```

## 🚀 Quick Start

### 1. Supabase Setup
```bash
# Create project at supabase.com
# Copy environment variables
# Run database migrations
```

### 2. Mobile App (Android)
```bash
cd mobile
npm install
npm run android
```

### 3. Web Dashboard
```bash
cd dashboard
npm install
npm run dev
```

## 📱 Key Features

- **Mobile Scanner App**: USB barcode scanner integration, offline capability
- **Web Dashboard**: Real-time monitoring, supervisor approvals
- **Rack Management**: Dropdown selection, approval workflow
- **Authentication**: Email OTP for scanners, Google OAuth for supervisors
- **Offline-First**: SQLite local storage with background sync
- **Real-time Updates**: Supabase realtime subscriptions

## 🛠️ Tech Stack

- **Mobile**: React Native, Redux Toolkit, SQLite
- **Web**: Next.js 14, Material-UI, TypeScript
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **Deployment**: Firebase (mobile), Vercel (web)

## 📊 Architecture

```
Mobile App (React Native) ──┐
                           ├──► Supabase Platform
Web Dashboard (Next.js) ────┘    ├─ PostgreSQL
                                 ├─ Authentication  
                                 ├─ Realtime
                                 └─ Auto APIs
```

## 🔧 Development

See individual README files in `/mobile` and `/dashboard` directories for specific setup instructions.

## 📖 Documentation

- **Complete PRD**: `/docs/PRD_Complete.md`
- **Supabase Guide**: `/docs/Supabase_Implementation.md`
- **Quick Start**: `/docs/Quick_Start_Guide.md`