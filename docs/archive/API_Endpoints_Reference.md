# API Endpoints Reference

## Authentication
```
POST   /auth/login/email     - Scanner email OTP login
POST   /auth/login/google    - Supervisor/Admin Google SSO
GET    /auth/verify          - Verify JWT token
POST   /auth/logout          - Logout
```

## Audit Sessions
```
GET    /audit/active         - Get active audit for location
POST   /audit/start          - Start new audit (admin only)
POST   /audit/complete       - Complete audit (supervisor/admin)
GET    /audit/:id/summary    - Get audit summary
```

## Racks
```
GET    /racks/available/:sessionId  - Get unclaimed racks
POST   /racks/claim                 - Claim a rack
GET    /racks/my-active            - User's active racks
POST   /racks/:id/ready            - Mark ready for approval
GET    /racks/pending              - Pending approvals (supervisor)
POST   /racks/:id/approve          - Approve rack
POST   /racks/:id/reject           - Reject with reason
```

## Scans
```
POST   /scans                - Create scan
GET    /scans/rack/:rackId   - Get scans for rack
DELETE /scans/:id            - Delete scan (before approval)
```

## Reports
```
GET    /reports/sku-list/:locationId     - Raw SKU list
GET    /reports/detailed/:locationId     - Detailed audit
GET    /reports/summary/:sessionId       - Session summary
GET    /reports/productivity/:sessionId  - User metrics
```

## Real-time Events (Supabase Subscriptions)
```
channel: 'racks'
- INSERT: New rack claimed
- UPDATE: Rack status changed

channel: 'scans' 
- INSERT: New item scanned

channel: 'notifications'
- INSERT: Approval needed
```