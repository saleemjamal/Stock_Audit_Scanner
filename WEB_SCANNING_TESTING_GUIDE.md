# Web Scanning Testing Guide

## Implementation Status ✅
All core components have been implemented:

1. ✅ **Supabase Edge Function** - `supabase/functions/single-session-login/index.ts`
2. ✅ **Personal Stats SQL View** - `supabase/personal_stats_view.sql`
3. ✅ **PersonalStatsBar Component** - Shows real-time user stats
4. ✅ **WebScanner Component** - Barcode input with validation and queue
5. ✅ **Scanning Page** - Complete workflow with rack selection
6. ✅ **Session Revocation** - Web and mobile login updates
7. ✅ **Role-Based Navigation** - Scanning tab for appropriate users

## Testing Steps

### 1. Deploy Edge Function
```bash
cd supabase
supabase functions deploy single-session-login
```

### 2. Create Database Views
Run in Supabase SQL Editor:
```sql
-- Execute contents of supabase/personal_stats_view.sql
```

### 3. Build and Test Dashboard
```bash
cd dashboard
npm run build
npm run dev
```

### 4. Testing Checklist

#### Authentication & Session Management
- [ ] Login on web → logout on mobile automatically
- [ ] Login on mobile → logout on web automatically
- [ ] Multiple browser tabs → only latest session works
- [ ] Session cleanup function works without errors

#### Role-Based Access
- [ ] **Scanner role**: Can see Scanning tab, personal stats bar
- [ ] **Supervisor role**: Can see Scanning + Approvals + Reports tabs
- [ ] **Superuser role**: Can see all tabs including Users/Locations

#### Personal Stats Bar
- [ ] Shows current user name
- [ ] Displays today's scan count
- [ ] Shows approved/pending rack counts
- [ ] Updates in real-time during scanning
- [ ] Responsive on mobile vs desktop

#### Scanning Workflow
- [ ] Location selector works (filters by user permissions)
- [ ] Rack selector shows available racks
- [ ] Rack assignment updates status correctly
- [ ] Scanner input auto-focuses
- [ ] Barcode validation (10-11 digits only)
- [ ] Rate limiting (1 scan per second)
- [ ] Recent scans list updates
- [ ] Queue system batches uploads (5 seconds or 10 scans)
- [ ] Complete rack button works
- [ ] Rack status updates to 'ready_for_approval'

#### USB Scanner Testing
- [ ] USB scanner input detected (rapid typing)
- [ ] Scanner suffix handled (Enter/Return stripped)
- [ ] No duplicate scans from double-trigger
- [ ] Auto-focus maintained after scans
- [ ] Multiple rapid scans processed correctly

#### Data Integration
- [ ] Scans appear in database with correct rack_id
- [ ] Rack status progression works
- [ ] Personal stats update correctly
- [ ] Dashboard shows new data
- [ ] Supervisor can see racks for approval

### 5. Known Issues to Watch For

#### Edge Function Issues
- **CORS errors**: Check function deployment
- **Authentication errors**: Verify SERVICE_ROLE_KEY
- **Session listing fails**: Check Supabase permissions

#### Scanner Input Issues
- **Focus lost**: Auto-focus should recover within 1 second
- **Double scans**: Rate limiting should prevent duplicates
- **Invalid barcodes**: Should show error message

#### Queue Issues
- **Stale data**: Queue should flush on page unload
- **Failed uploads**: Should retry failed batches
- **Network errors**: Should show queue count badge

### 6. Performance Expectations

- **Scan processing**: < 100ms per barcode
- **Queue flush**: < 500ms for 10 scans
- **Page load**: < 2 seconds
- **USB scanner**: 30+ scans/minute supported
- **Real-time updates**: Stats refresh within 30 seconds

### 7. Success Criteria

- ✅ **Single device enforcement** works reliably
- ✅ **Role-based access** properly restricts features
- ✅ **USB scanning** achieves target rate (30+ scans/min)
- ✅ **Data integrity** - no duplicate or lost scans
- ✅ **User experience** - intuitive and responsive
- ✅ **Error handling** - graceful degradation

### 8. Production Deployment

Once testing passes:
1. Deploy Edge Function to production Supabase
2. Run SQL view creation in production database
3. Deploy dashboard to Vercel
4. Update mobile app with session revocation
5. Test end-to-end workflow with real users

### 9. Rollback Plan

If issues arise:
1. Disable scanning navigation (role-based)
2. Revert session revocation changes
3. Fall back to mobile-only scanning
4. Fix issues in development before redeploying

## Next Steps

1. **Run `npm run build`** to verify no compilation errors
2. **Deploy Edge Function** and test authentication
3. **Create SQL views** and test personal stats
4. **Test USB scanner** with physical device
5. **Validate complete workflow** end-to-end