# Supabase Setup Guide

## 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Choose region and set database password
4. Wait for project initialization (~2-3 minutes)

## 2. Get Project Credentials

From your Supabase dashboard:
- **Project URL**: `https://your-project-id.supabase.co`
- **Anon Key**: Found in Settings → API
- **Service Role Key**: Found in Settings → API (keep secure!)

## 3. Run Database Migrations

Execute the SQL scripts in this order:
1. `01_schema.sql` - Create tables and relationships
2. `02_rls_policies.sql` - Set up Row Level Security
3. `03_functions.sql` - Create database functions and triggers
4. `04_seed.sql` - Insert sample data (optional)

## 4. Enable Authentication Providers

### Google OAuth Setup:
1. Go to Authentication → Providers
2. Enable Google provider
3. Add your OAuth credentials:
   - **Client ID**: From Google Cloud Console
   - **Client Secret**: From Google Cloud Console
4. Set redirect URLs:
   - Web: `https://your-project-id.supabase.co/auth/v1/callback`
   - Mobile: `com.stockaudit://oauth/callback`

### Email Authentication:
- Already enabled by default
- Configure email templates in Authentication → Templates

## 5. Environment Variables

Copy these to your applications:

```env
# React Native Mobile App
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# Next.js Dashboard
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## 6. Test Connection

Use the Supabase SQL editor to verify:
```sql
SELECT * FROM locations;
SELECT * FROM users;
```