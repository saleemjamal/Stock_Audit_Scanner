# Authentication and Roles Guide

## Overview

The Stock Audit Scanner system uses a simple, unified authentication approach with role-based access control. This document outlines the authentication strategy and role hierarchy for both web and mobile applications.

## Authentication Strategy

### **Single Authentication Method**
- **Username/Password ONLY** for both web and mobile
- **No OAuth, no magic links, no external dependencies**  
- **Same credentials work on both platforms**
- **Simple and reliable for warehouse environments**

### **Why This Approach?**
- **Warehouse Reality**: Workers often don't have personal Google accounts
- **Shared Devices**: Multiple users may use the same tablet/phone
- **IT Control**: Admin controls all access, no external dependencies
- **Offline Friendly**: Works without internet for cached logins
- **Support Simplicity**: Fewer things that can go wrong

## Role Hierarchy

### **Three-Tier Role System**

```
superuser (highest privileges)
    ↓
supervisor (web dashboard only)
    ↓  
scanner (mobile app only)
```

## Role Definitions

### **1. Scanner/Auditor Role**
- **Platform Access**: Mobile app ONLY
- **Primary Function**: Inventory scanning and data collection
- **Typical Users**: Warehouse staff, inventory counters, temporary workers

**Capabilities**:
- ✅ Login to mobile app
- ✅ Select assigned location(s)  
- ✅ Choose available racks to audit
- ✅ Scan barcodes and enter quantities
- ✅ Mark racks as complete for approval
- ✅ View their own scan history
- ❌ Access web dashboard
- ❌ Approve other people's work
- ❌ Manage users or locations

### **2. Supervisor Role**  
- **Platform Access**: BOTH web dashboard AND mobile app
- **Primary Function**: Quality control, audit approval, and hands-on scanning
- **Typical Users**: Warehouse managers, shift supervisors, department heads

**Capabilities**:
- ✅ Login to web dashboard
- ✅ Login to mobile app for scanning
- ✅ View pending racks awaiting approval
- ✅ Review scan details and quality
- ✅ Approve or reject completed racks
- ✅ Generate audit reports for their location(s)
- ✅ View real-time scanning progress
- ✅ Send racks back for recount if needed
- ✅ Scan items directly (quality checks, fill gaps, training)
- ✅ Access both supervisor and scanner workflows
- ❌ Manage other users
- ❌ Create/edit locations

### **3. Super User (Admin) Role**
- **Platform Access**: BOTH web dashboard AND mobile app
- **Primary Function**: System administration and oversight
- **Specific User**: saleem@poppatjamals.com (you)

**Capabilities**:
- ✅ **ALL supervisor capabilities** (web dashboard)
- ✅ **ALL scanner capabilities** (mobile app)
- ✅ Create and manage user accounts
- ✅ Create and manage locations
- ✅ Access all locations (not location-restricted)
- ✅ View system-wide reports and analytics
- ✅ Reset passwords and manage permissions
- ✅ Configure system settings

## Super User Implementation Pattern

### **Best Practice: Role Inheritance**
```javascript
// Permission checking logic
const hasPermission = (user, action) => {
  if (user.role === 'superuser') return true; // Can do everything
  if (user.role === 'supervisor') return supervisorPermissions.includes(action);
  if (user.role === 'scanner') return scannerPermissions.includes(action);
  return false;
};
```

### **Platform Access Control**
```javascript
// Mobile app access
const canAccessMobile = (user) => {
  return user.role === 'scanner' || user.role === 'supervisor' || user.role === 'superuser';
};

// Web dashboard access  
const canAccessDashboard = (user) => {
  return user.role === 'supervisor' || user.role === 'superuser';
};
```

## Registration Strategy

### **Recommended: Self-Registration with Admin Approval**

**Why This Approach?**
- **Easier to implement** - standard registration form
- **Reduces admin burden** - users create their own accounts
- **Better user experience** - immediate access with default permissions
- **Scalable** - works as the team grows

**How It Works:**
1. **New users register** with username/password
2. **Default role assigned**: "scanner" (safe default)
3. **Admin receives notification** of new registration
4. **Admin promotes to supervisor** if needed
5. **Admin assigns locations** based on user's role

### **Alternative: Admin-Only Creation**
- **More secure** but requires admin to create every account
- **Higher maintenance** - admin becomes bottleneck
- **Better for small, controlled teams**

## Database Schema Requirements

### **Users Table**
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,  -- Simple username
  email VARCHAR(255) UNIQUE NOT NULL,    -- For notifications
  password_hash VARCHAR(255) NOT NULL,   -- Hashed password
  full_name VARCHAR(100),
  role VARCHAR(20) NOT NULL DEFAULT 'scanner', -- scanner|supervisor|superuser
  location_ids INTEGER[] DEFAULT '{}',   -- Array of assigned location IDs
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### **Row Level Security (RLS) Policies**
```sql
-- Scanners can only see their own record
CREATE POLICY "Users can view own profile" ON users 
  FOR SELECT USING (auth.uid() = id OR 
    (SELECT role FROM users WHERE auth.uid() = id) IN ('supervisor', 'superuser'));

-- Only superusers can manage other users
CREATE POLICY "Only superuser can manage users" ON users 
  FOR ALL USING (
    (SELECT role FROM users WHERE auth.uid() = id) = 'superuser'
  );
```

## Security Considerations

### **Password Requirements**
- **Minimum 8 characters**
- **Include numbers and letters**
- **Store as bcrypt hash**
- **Password reset via email**

### **Session Management**
- **JWT tokens for stateless auth**
- **24-hour expiration** (reasonable for shift work)
- **Refresh token for mobile app** (avoid constant re-login)
- **Logout on role change** (security measure)

### **Location-Based Security**
- **Users only see data for their assigned locations**
- **Exception: superuser sees all locations**
- **API endpoints filter by location_ids automatically**

## Implementation Checklist

### **Phase 1: Basic Authentication**
- [ ] Username/password login forms (web + mobile)
- [ ] User registration form
- [ ] Password hashing and verification
- [ ] JWT token generation and validation
- [ ] Basic role checking

### **Phase 2: Role-Based Access**
- [ ] Permission middleware for web dashboard
- [ ] Mobile app role checking
- [ ] Super user dual-platform access
- [ ] Location-based data filtering

### **Phase 3: User Management**
- [ ] Super user can create/edit users
- [ ] Role promotion/demotion
- [ ] Location assignment interface
- [ ] Password reset functionality

## Testing Strategy

### **Role Testing Scenarios**
1. **Scanner Login**: Can access mobile only, cannot access web
2. **Supervisor Login**: Can access both web and mobile  
3. **Super User Login**: Can access both platforms with all permissions
4. **Permission Boundaries**: Each role only sees permitted data
5. **Location Filtering**: Users only see their assigned locations

### **Security Testing**
1. **Password Requirements**: Enforce minimum standards
2. **Session Security**: JWT tokens expire correctly
3. **Role Escalation**: Cannot access higher-privilege features
4. **Location Isolation**: Cannot access other locations' data

---

This simple, three-role system provides clear boundaries while keeping the super user flexible enough to handle any situation that arises during implementation or daily operations.