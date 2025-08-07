# Testing Checklist

## Unit Tests (Mobile)
- [ ] Scanner input captures barcode correctly
- [ ] Offline storage saves/retrieves scans
- [ ] Rack selection prevents duplicates
- [ ] Sync queue processes in order
- [ ] Role-based navigation works

## Integration Tests
- [ ] Supabase auth flow (email OTP + Google)
- [ ] Real-time rack status updates
- [ ] Offline-to-online sync
- [ ] RLS policies enforce access control
- [ ] File upload for reports

## End-to-End Scenarios
- [ ] Complete audit workflow start to finish
- [ ] Approval/rejection flow
- [ ] Multiple users claiming racks
- [ ] Network interruption recovery
- [ ] Session completion locks data

## Device Testing
- [ ] USB OTG scanner recognition
- [ ] Different Android versions (9-14)
- [ ] Various screen sizes
- [ ] Battery usage over 8 hours
- [ ] Memory usage with 5000+ scans

## Performance Tests
- [ ] 50 scans/minute sustained
- [ ] 10,000 offline scans
- [ ] 5 concurrent users
- [ ] Report generation <10 seconds
- [ ] App launch <3 seconds

## Security Tests
- [ ] Invalid role access attempts
- [ ] Cross-location data access
- [ ] JWT expiration handling
- [ ] SQL injection prevention
- [ ] API rate limiting