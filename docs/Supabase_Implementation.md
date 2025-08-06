# Supabase Implementation Guide

## Why Supabase is Perfect for This Project

1. **Built-in Features We Need**:
   - PostgreSQL database (same schema works)
   - Authentication (replaces Passport.js)
   - Real-time subscriptions (replaces Socket.io)
   - Row Level Security (RLS)
   - Auto-generated APIs

2. **Simplified Architecture**:
```
Before: Mobile App → Node.js Backend → PostgreSQL → Socket.io
After:  Mobile App → Supabase Client → Supabase (all-in-one)
```

## 1. Supabase Project Setup

### Create Tables with Supabase Dashboard
```sql
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE racks ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;

-- Audit sessions table
CREATE TABLE audit_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id INTEGER REFERENCES locations(id),
  total_rack_count INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'setup',
  started_at TIMESTAMP,
  started_by UUID REFERENCES users(id),
  completed_at TIMESTAMP,
  completed_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Racks table (auto-generated)
CREATE TABLE racks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_session_id UUID REFERENCES audit_sessions(id),
  location_id INTEGER REFERENCES locations(id),
  rack_number VARCHAR(50) NOT NULL,
  shelf_number VARCHAR(50),
  status VARCHAR(50) DEFAULT 'available',
  scanner_id UUID REFERENCES users(id),
  ready_for_approval BOOLEAN DEFAULT FALSE,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Auto-generate racks when audit starts
CREATE OR REPLACE FUNCTION generate_racks()
RETURNS TRIGGER AS $$
BEGIN
  FOR i IN 1..NEW.total_rack_count LOOP
    INSERT INTO racks (audit_session_id, location_id, rack_number)
    VALUES (NEW.id, NEW.location_id, i::TEXT);
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_racks_on_audit_start
AFTER INSERT ON audit_sessions
FOR EACH ROW
WHEN (NEW.status = 'active')
EXECUTE FUNCTION generate_racks();
```

## 2. Mobile App Integration

### Install Supabase Client
```bash
npm install @supabase/supabase-js @react-native-async-storage/async-storage
```

### Initialize Supabase
```javascript
// lib/supabase.js
import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'

const supabaseUrl = 'YOUR_SUPABASE_URL'
const supabaseAnonKey = 'YOUR_SUPABASE_ANON_KEY'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
```
### Authentication Implementation
```javascript
// screens/LoginScreen.js
import { supabase } from '../lib/supabase';

const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  // Simple email login for scanners
  const handleScannerLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email,
      options: {
        emailRedirectTo: 'stockaudit://login-callback'
      }
    });
    
    if (error) Alert.alert('Error', error.message);
    else Alert.alert('Success', 'Check your email for login link');
    setLoading(false);
  };

  // Google SSO for supervisors/admins
  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'stockaudit://login-callback'
      }
    });
    
    if (error) Alert.alert('Error', error.message);
  };
}
```

### Real-time Subscriptions
```javascript
// hooks/useRealtimeRacks.js
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function useRealtimeRacks(locationId) {
  const [racks, setRacks] = useState([]);

  useEffect(() => {
    // Initial fetch
    fetchRacks();

    // Subscribe to changes
    const subscription = supabase
      .channel('racks-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'racks',
          filter: `location_id=eq.${locationId}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setRacks(prev => [...prev, payload.new]);
          } else if (payload.eventType === 'UPDATE') {
            setRacks(prev => 
              prev.map(rack => 
                rack.id === payload.new.id ? payload.new : rack
              )
            );
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [locationId]);

  const fetchRacks = async () => {
    const { data } = await supabase
      .from('racks')
      .select('*')
      .eq('location_id', locationId)
      .order('created_at', { ascending: false });
    
    setRacks(data || []);
  };

  return racks;
}
```
### CRUD Operations
```javascript
// services/rackService.js
import { supabase } from '../lib/supabase';

export const rackService = {
  // Create rack
  async createRack(locationId, rackNumber, shelfNumber) {
    const { data: user } = await supabase.auth.getUser();
    
    const { data, error } = await supabase
      .from('racks')
      .insert({
        location_id: locationId,
        rack_number: rackNumber,
        shelf_number: shelfNumber,
        scanner_id: user.user.id,
        status: 'active'
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Mark ready for approval
  async markReady(rackId) {
    const { error } = await supabase
      .from('racks')
      .update({ ready_for_approval: true })
      .eq('id', rackId);
    
    if (error) throw error;
  },

  // Approve rack (supervisor only)
  async approveRack(rackId) {
    const { data: user } = await supabase.auth.getUser();
    
    const { error } = await supabase
      .from('racks')
      .update({
        status: 'completed',
        approved_by: user.user.id,
        approved_at: new Date().toISOString()
      })
      .eq('id', rackId);
    
    if (error) throw error;
  }
};
```

## 3. Next.js Dashboard Integration

### Setup Supabase in Next.js
```bash
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs
```

### Create Supabase Client
```javascript
// lib/supabase.js
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### Server-Side Authentication
```javascript
// app/api/auth/callback/route.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.set({ name, value: '', ...options })
          },
        },
      }
    )

    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(requestUrl.origin)
}
```
### Real-time Dashboard Component
```typescript
// components/LiveRackUpdates.tsx
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

export function LiveRackUpdates() {
  const [updates, setUpdates] = useState<any[]>([])
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase
      .channel('rack-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'racks',
          filter: 'ready_for_approval=eq.true'
        },
        (payload) => {
          setUpdates(prev => [payload.new, ...prev].slice(0, 10))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return (
    <div>
      {updates.map(update => (
        <div key={update.id}>
          Rack {update.rack_number} ready for approval
        </div>
      ))}
    </div>
  )
}
```

## 4. Database Functions & Triggers

### Create Database Functions
```sql
-- Function to notify supervisors
CREATE OR REPLACE FUNCTION notify_supervisors()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ready_for_approval = true AND OLD.ready_for_approval = false THEN
    INSERT INTO notifications (user_id, type, message, rack_id)
    SELECT id, 'approval_needed', 'Rack ' || NEW.rack_number || ' ready', NEW.id
    FROM users
    WHERE role IN ('supervisor', 'admin')
    AND NEW.location_id = ANY(location_ids);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rack_ready_trigger
AFTER UPDATE ON racks
FOR EACH ROW
EXECUTE FUNCTION notify_supervisors();

-- Function for audit trail
CREATE OR REPLACE FUNCTION create_audit_log()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (action, entity_type, entity_id, user_id, details)
  VALUES (
    TG_OP,
    TG_TABLE_NAME,
    NEW.id,
    auth.uid(),
    row_to_json(NEW)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

## 5. Simplified Backend (Optional Edge Functions)

For complex business logic, use Supabase Edge Functions:

```typescript
// supabase/functions/approve-rack/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const { rackId } = await req.json()
  
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Complex approval logic here
  const { data: rack } = await supabase
    .from('racks')
    .select('*')
    .eq('id', rackId)
    .single()

  // Update rack
  await supabase
    .from('racks')
    .update({ 
      status: 'completed',
      approved_at: new Date().toISOString()
    })
    .eq('id', rackId)

  // Send notifications, update metrics, etc.

  return new Response(JSON.stringify({ success: true }))
})
```
## 6. Environment Setup

### Supabase Project Configuration
```env
# .env.local (Next.js)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# .env (React Native)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

### Enable Google OAuth in Supabase
1. Go to Authentication → Providers
2. Enable Google
3. Add your OAuth credentials
4. Set redirect URLs:
   - Web: `https://your-domain.com/auth/callback`
   - Mobile: `stockaudit://login-callback`

## 7. Key Advantages of Using Supabase

1. **No Backend Needed**: Supabase handles all backend logic
2. **Built-in Auth**: Email OTP for scanners, Google OAuth for supervisors
3. **Real-time**: Automatic subscriptions replace Socket.io
4. **Row Level Security**: Database-level security policies
5. **Auto-generated APIs**: RESTful and GraphQL APIs out of the box
6. **File Storage**: Built-in storage for future product images

## 8. Migration Summary

### What Changes:
- Remove Node.js backend entirely
- Replace Socket.io with Supabase Realtime
- Use Supabase Auth instead of Passport.js
- Direct database access from clients

### What Stays the Same:
- Database schema (PostgreSQL)
- React Native mobile app structure
- Next.js dashboard structure
- Business logic and workflows

## Cost Comparison

### Previous Architecture:
- AWS EC2: ~$50/month
- RDS PostgreSQL: ~$30/month
- Load Balancer: ~$20/month
- **Total: ~$100/month**

### Supabase:
- Free tier: 500MB database, 50K auth users
- Pro tier: $25/month (8GB database, 100K users)
- **Total: $0-25/month**

## Quick Start Commands

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Create new project
supabase init

# Link to remote project
supabase link --project-ref your-project-ref

# Push database schema
supabase db push

# Generate TypeScript types
supabase gen types typescript --local > types/supabase.ts
```

---

This Supabase implementation significantly simplifies your architecture while providing all the same features plus additional benefits like built-in auth and real-time subscriptions.