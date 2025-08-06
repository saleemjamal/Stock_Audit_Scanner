# Stock Audit Dashboard

Next.js web dashboard for real-time monitoring and management of stock audit operations.

## 🏗️ Setup

### Prerequisites
- Node.js 18+
- Supabase project configured (see `/supabase` directory)

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Run development server
npm run dev
```

### Environment Setup

Create `.env.local` file:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## 📊 Features

### Dashboard Overview
- **Real-time Metrics**: Live scan counts, rack status, user activity
- **Location Monitoring**: Multi-location audit progress tracking
- **Performance Charts**: Audit completion rates, scanning velocity

### Supervisor Features
- **Approval Workflow**: Review and approve/reject racks
- **Real-time Notifications**: Instant alerts for approval requests
- **Location Filtering**: Access only assigned locations

### Admin Features
- **Audit Management**: Start/stop audit sessions, set rack counts
- **User Management**: Assign users to locations, manage roles
- **Reports**: Export detailed audit data in multiple formats

### Real-time Updates
- **Live Activity Feed**: See scanning activity as it happens
- **Status Changes**: Instant updates when racks change status
- **Notification System**: Browser notifications for important events

## 🏗️ Architecture

```
dashboard/
├── src/
│   ├── app/               # Next.js 14 App Router
│   │   ├── dashboard/     # Dashboard pages
│   │   ├── auth/          # Authentication pages
│   │   └── api/           # API routes
│   ├── components/        # Reusable components
│   ├── lib/              # Utilities and configurations
│   ├── hooks/            # Custom React hooks
│   └── types/            # TypeScript types
├── public/               # Static assets
└── docs/                 # Documentation
```

### Key Components
- **DashboardLayout**: Main layout with navigation and real-time updates
- **AuditOverview**: Real-time metrics and progress tracking
- **ApprovalQueue**: Supervisor rack approval interface
- **LocationManager**: Multi-location monitoring
- **ReportGenerator**: CSV export functionality

## 🔐 Authentication

- **Google OAuth**: For supervisors and admins
- **Role-based Access**: Different views based on user role
- **Row Level Security**: Supabase RLS for data protection

## 📊 Data Management

### Real-time Subscriptions
- **Rack Changes**: Live updates when racks change status
- **Scan Activity**: Real-time scan feed
- **Notifications**: Instant approval request alerts

### Caching Strategy
- **SWR**: Client-side caching for frequently accessed data
- **Revalidation**: Smart cache invalidation on data changes
- **Offline Support**: Graceful degradation when offline

## 🧪 Development

### Code Structure
- **TypeScript**: Full type safety with shared types
- **Material-UI**: Consistent design system
- **Responsive**: Mobile-first responsive design
- **Accessibility**: WCAG 2.1 AA compliance

### Available Scripts
```bash
npm run dev          # Development server
npm run build        # Production build
npm run start        # Production server
npm run lint         # ESLint check
npm run type-check   # TypeScript check
```

## 🚀 Deployment

### Vercel (Recommended)
1. Connect GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main

### Manual Deployment
```bash
npm run build
npm run start
```

## 📈 Monitoring

- **Real-time Metrics**: Built-in performance monitoring
- **Error Tracking**: Client and server error logging
- **User Analytics**: Audit session completion tracking

## 🔧 Configuration

### Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key (server-side only)

### Customization
- **Themes**: Material-UI theme customization
- **Charts**: Recharts configuration for metrics
- **Reports**: Custom report formats and filtering