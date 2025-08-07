# Phase 5: Testing & Validation Guide

## Pre-Testing: Run Validation Script

**First, run the validation script in Supabase SQL Editor:**
- Execute `supabase/34_validate_migration.sql`
- Verify all checks pass before testing applications

---

## Mobile App Testing

### Prerequisites
```bash
cd mobile
npx react-native run-android
```

### Test 1: Authentication with All Users

**Test saleem (superuser):**
- Username: `saleem`
- Password: `password123`
- ✅ Expected: Login successful
- ✅ Expected: See location selection screen

**Test supervisor1 (supervisor):**
- Username: `supervisor1` 
- Password: `password123`
- ✅ Expected: Login successful
- ✅ Expected: See location selection screen

**Test scanner1 (scanner):**
- Username: `scanner1`
- Password: `password123` 
- ✅ Expected: Login successful
- ✅ Expected: See location selection screen

**Test invalid credentials:**
- Username: `invalid`
- Password: `wrong`
- ✅ Expected: "Invalid username or password" error

### Test 2: Location Loading & Navigation

**Login as saleem:**
- ✅ Expected: Should see multiple locations (Downtown Store, Warehouse A, North Branch, etc.)
- ✅ Click "Downtown Store"
- ✅ Expected: Should see rack selection screen
- ✅ Expected: Should see available racks (R-001, R-002, R-003, R-004, R-005)

**Login as supervisor1:**
- ✅ Expected: Should see assigned locations (2 locations)
- ✅ Should be able to navigate to rack selection

**Login as scanner1:**
- ✅ Expected: Should see assigned locations (1 location)
- ✅ Should be able to navigate to rack selection

### Test 3: Session Management
- ✅ Force close app and reopen
- ✅ Expected: Should remain logged in
- ✅ Sign out from app
- ✅ Expected: Should return to login screen

---

## Web Dashboard Testing

### Prerequisites
```bash
cd dashboard
npm run dev
# Navigate to http://localhost:3000/auth/login
```

### Test 4: Dashboard Authentication

**Test saleem (superuser):**
- Username: `saleem`
- Password: `password123`
- ✅ Expected: Login successful
- ✅ Expected: Redirect to dashboard
- ✅ Expected: See audit overview, location stats, pending approvals

**Test supervisor1 (supervisor):**
- Username: `supervisor1`
- Password: `password123` 
- ✅ Expected: Login successful
- ✅ Expected: Access dashboard
- ✅ Expected: See supervisor-level features

**Test scanner1 (scanner) - Should be BLOCKED:**
- Username: `scanner1`
- Password: `password123`
- ❌ Expected: "Access denied. Scanners should use the mobile app." error
- ✅ Expected: Remain on login page

**Test invalid credentials:**
- Username: `invalid`
- Password: `wrong`
- ❌ Expected: "Invalid username or password" error

### Test 5: Dashboard Navigation & Sign Out

**After successful login as saleem:**
- ✅ Expected: Dashboard loads with overview data
- ✅ Click user profile menu (top right)
- ✅ Click "Sign Out"
- ✅ Expected: Redirect to login page
- ✅ Try accessing `/dashboard` directly
- ✅ Expected: Redirect to login page (not authenticated)

---

## Cross-Platform Integration Testing

### Test 6: Same User, Multiple Platforms

**Login as supervisor1 on mobile app:**
- ✅ Expected: Successful login and location access

**Login as supervisor1 on web dashboard:**  
- ✅ Expected: Successful login and dashboard access
- ✅ Expected: Both platforms should work simultaneously

**Data consistency check:**
- ✅ Expected: Same user profile data visible on both platforms
- ✅ Expected: Same location access permissions

---

## Error Handling & Edge Cases

### Test 7: Session Timeout & Refresh
- ✅ Login to web dashboard
- ✅ Wait or manually clear session
- ✅ Refresh page
- ✅ Expected: Redirect to login

### Test 8: Network Connectivity
- ✅ Login to mobile app
- ✅ Disconnect internet
- ✅ Expected: Offline capabilities still work
- ✅ Reconnect internet  
- ✅ Expected: Data syncs properly

---

## Success Criteria Checklist

### ✅ Authentication Requirements
- [ ] All three users can log in on mobile app with username/password
- [ ] Only supervisors and superusers can access web dashboard  
- [ ] Scanners are blocked from web dashboard with clear error message
- [ ] Invalid credentials show appropriate error messages
- [ ] Session management works correctly (persistence and sign out)

### ✅ Data Access Requirements  
- [ ] Location loading works in mobile app without modification
- [ ] User roles and permissions are properly enforced
- [ ] Dashboard components load data correctly
- [ ] Cross-platform data consistency maintained

### ✅ User Experience Requirements
- [ ] Username/password login experience unchanged for users
- [ ] No breaking changes to existing UI workflows
- [ ] Error messages are clear and helpful
- [ ] Performance is acceptable (no significant slowdowns)

### ✅ Technical Requirements
- [ ] Supabase Auth sessions work correctly
- [ ] RLS policies updated and functional
- [ ] No console errors during normal operations
- [ ] All helper functions work without modification
- [ ] Real-time features still functional

---

## Troubleshooting Common Issues

### Mobile App Issues
- **"Network Error"**: Check Supabase URL/keys in .env file
- **"Invalid username or password"**: Verify auth users exist in database
- **App crashes**: Check React Native logs with `npx react-native log-android`

### Web Dashboard Issues  
- **"Unable to load user profile"**: Check RLS policies allow user access
- **Redirect loops**: Clear browser localStorage and cookies
- **Session not persisting**: Verify Supabase client configuration

### Database Issues
- **Users not found**: Run validation script to check auth.users table
- **RLS policy errors**: Check policies use `auth.uid()` instead of custom functions
- **Foreign key violations**: Verify user IDs match between users and auth.users

---

## Post-Testing Actions

### If All Tests Pass ✅
1. Document successful test results
2. Proceed to Phase 6 (Cleanup & Documentation)
3. Consider the migration successful

### If Tests Fail ❌  
1. Document specific failures
2. Check troubleshooting guide
3. Fix issues and re-test
4. Consider rollback if critical issues persist

---

**Total Testing Time Estimate: 30-45 minutes**
**Required: Both mobile device/emulator and web browser**