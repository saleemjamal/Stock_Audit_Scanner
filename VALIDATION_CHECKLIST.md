# Supabase Auth Migration - Validation Checklist

## ✅ Pre-Testing Database Validation

**Run in Supabase SQL Editor:** `supabase/34_validate_migration.sql`

- [ ] **Auth Users**: 3 users (saleem, supervisor1, scanner1) exist in auth.users
- [ ] **User Integration**: All users properly linked (users.id = auth.users.id)
- [ ] **Location Access**: Users have proper location_ids arrays
- [ ] **Audit Sessions**: Active session exists with proper foreign keys
- [ ] **Test Racks**: 5+ available racks (R-001 to R-005) exist
- [ ] **RLS Policies**: Updated to use `auth.uid()` instead of custom functions
- [ ] **Custom Auth Cleanup**: No remaining `login_with_username` functions

---

## 📱 Mobile App Testing

### Authentication Tests
- [ ] **saleem/password123** → Login successful
- [ ] **supervisor1/password123** → Login successful  
- [ ] **scanner1/password123** → Login successful
- [ ] **invalid/wrong** → Shows error message

### Navigation Tests  
- [ ] **saleem** → Sees multiple locations (4+ locations)
- [ ] **supervisor1** → Sees assigned locations (2 locations)
- [ ] **scanner1** → Sees assigned locations (1 location)
- [ ] **Downtown Store** → Shows available racks (R-001 to R-005)

### Session Management
- [ ] **App restart** → Remains logged in
- [ ] **Sign out** → Returns to login screen

---

## 🌐 Web Dashboard Testing

### Authentication Tests
- [ ] **saleem/password123** → Access dashboard ✅
- [ ] **supervisor1/password123** → Access dashboard ✅  
- [ ] **scanner1/password123** → Access denied ❌
- [ ] **invalid/wrong** → Shows error message

### Dashboard Features
- [ ] **Dashboard loads** → Audit overview, stats, approvals visible
- [ ] **User profile menu** → Works properly
- [ ] **Sign out** → Redirects to login
- [ ] **Direct /dashboard access** → Redirects to login when not authenticated

---

## 🔄 Cross-Platform Integration

### Same User, Multiple Platforms
- [ ] **supervisor1** → Can access both mobile app and web dashboard
- [ ] **Data consistency** → Same user profile on both platforms
- [ ] **Permissions** → Same location access on both platforms

---

## 🔍 Technical Validation

### Code Integration
- [ ] **Mobile imports** → Using `authSlice` instead of `authSliceWorkaround`
- [ ] **No console errors** → Clean application startup
- [ ] **Supabase session** → Proper session management
- [ ] **Database queries** → All helper functions work unchanged

### Performance
- [ ] **Login speed** → Comparable to previous system
- [ ] **Location loading** → Fast data retrieval
- [ ] **Dashboard loading** → Acceptable performance

---

## ✅ Success Criteria Summary

### Must Pass (Critical)
- [ ] All 3 users can login on mobile app
- [ ] Only supervisors/superusers can access web dashboard
- [ ] Scanners are properly blocked from web dashboard
- [ ] Location data loads correctly in mobile app
- [ ] Dashboard components display data properly
- [ ] Sign out works on both platforms

### Should Pass (Important)  
- [ ] Session persistence works
- [ ] Error messages are clear and helpful
- [ ] No breaking changes to user workflows
- [ ] Cross-platform data consistency
- [ ] Real-time features still functional

### Nice to Have (Optional)
- [ ] Performance improvements
- [ ] Better error handling
- [ ] Enhanced user feedback

---

## 🚨 Rollback Criteria

**Consider rollback if:**
- Any critical authentication failures
- Data access completely broken
- Multiple users cannot access system
- Security vulnerabilities introduced

**Rollback Script:** `supabase/27_emergency_rollback.sql` (if needed)

---

## 📊 Testing Results

**Date:** ___________  
**Tester:** ___________

**Overall Status:** 
- [ ] ✅ All tests passed - Migration successful
- [ ] ⚠️  Minor issues found - Fixable
- [ ] ❌ Critical failures - Rollback required

**Notes:**
```
[Add specific test results and any issues found]
```

---

**Estimated Testing Time:** 30-45 minutes  
**Required Tools:** Mobile device/emulator + web browser