# Rack Rejection Workflow - Implementation Guide

## Overview

This document outlines the implementation of a rack rejection workflow that allows supervisors to reject racks with reasons and enables original scanners to re-work their rejected racks.

## Business Logic

### Current Workflow
1. Scanner scans rack → Submits for approval
2. Supervisor approves/rejects → End

### New Workflow  
1. Scanner scans rack → Submits for approval
2. Supervisor approves ✅ → End
3. Supervisor rejects ❌ → Provides reason → Rack becomes available to original scanner
4. **Original scanner only** can re-select rejected rack → Add/remove scans → Re-submit
5. **Other scanners** see rejected rack but get blocked with ownership message

## Database Schema Changes

### Add Rejection Reason Column

```sql
-- Migration: Add rejection reason to racks table
ALTER TABLE racks ADD COLUMN rejection_reason TEXT;

-- Optional: Add index for better query performance  
CREATE INDEX idx_racks_status_scanner ON racks(status, scanner_id);
```

**Column Details:**
- **Name**: `rejection_reason`
- **Type**: `TEXT` (allows long rejection explanations)
- **Nullable**: `YES` (NULL for non-rejected racks)
- **Usage**: Stores supervisor's reason for rejection

## Supervisor UI Changes

### 1. Approval List Page (`/dashboard/approvals/page.tsx`)

**Current Reject Button:**
```tsx
<IconButton onClick={() => handleRackAction(rack.id, 'reject')}>
  <Cancel />
</IconButton>
```

**New Reject Button with Dialog:**
```tsx
// Add state for rejection dialog
const [rejectionDialog, setRejectionDialog] = useState({
  open: false,
  rackId: '',
  rackNumber: ''
})
const [rejectionReason, setRejectionReason] = useState('')

// Update button click handler
<IconButton onClick={() => setRejectionDialog({
  open: true, 
  rackId: rack.id, 
  rackNumber: rack.rack_number
})}>
  <Cancel />
</IconButton>

// Add rejection dialog component
<Dialog open={rejectionDialog.open} onClose={() => setRejectionDialog({...rejectionDialog, open: false})}>
  <DialogTitle>Reject Rack {rejectionDialog.rackNumber}</DialogTitle>
  <DialogContent>
    <TextField
      autoFocus
      fullWidth
      multiline
      rows={3}
      label="Rejection Reason"
      placeholder="Please specify what needs to be corrected..."
      value={rejectionReason}
      onChange={(e) => setRejectionReason(e.target.value)}
      required
    />
  </DialogContent>
  <DialogActions>
    <Button onClick={() => setRejectionDialog({...rejectionDialog, open: false})}>
      Cancel
    </Button>
    <Button 
      onClick={() => handleRejectionWithReason(rejectionDialog.rackId)} 
      color="error" 
      variant="contained"
      disabled={!rejectionReason.trim()}
    >
      Reject Rack
    </Button>
  </DialogActions>
</Dialog>
```

**Updated Rejection Handler:**
```tsx
const handleRejectionWithReason = async (rackId: string) => {
  try {
    const { error } = await supabase
      .from('racks')
      .update({ 
        status: 'rejected',
        rejection_reason: rejectionReason.trim(),
        rejected_at: new Date().toISOString()
      })
      .eq('id', rackId)

    if (error) throw error

    // Close dialog and refresh
    setRejectionDialog({ open: false, rackId: '', rackNumber: '' })
    setRejectionReason('')
    loadPendingApprovals()
    
    setSnackbar({ 
      open: true, 
      message: 'Rack rejected successfully', 
      severity: 'success' 
    })
  } catch (error) {
    setSnackbar({ 
      open: true, 
      message: 'Failed to reject rack', 
      severity: 'error' 
    })
  }
}
```

### 2. Approval Details Page (`/dashboard/approvals/[rackId]/page.tsx`)

**Apply identical dialog logic:**
- Same rejection dialog component
- Same state management
- Same rejection handler with reason

## Scanner UI Changes

### 1. Rack Loading Logic (`/dashboard/scanning/page.tsx`)

**Updated Query to Include Rejected Racks:**
```tsx
// Current query
.in('status', ['available', 'assigned'])

// New query  
.in('status', ['available', 'assigned', 'rejected'])
```

**Smart Sorting Logic:**
```tsx
const sortRacks = (racks: Rack[]) => {
  return racks.sort((a, b) => {
    // Priority 1: Rejected racks first (for visibility)
    if (a.status === 'rejected' && b.status !== 'rejected') return -1
    if (b.status === 'rejected' && a.status !== 'rejected') return 1
    
    // Priority 2: Numerical sorting within same status
    const aNum = parseInt(a.rack_number) || 0
    const bNum = parseInt(b.rack_number) || 0
    return aNum - bNum
  })
}

// Apply sorting after loading racks
const sortedRacks = sortRacks(data || [])
setRacks(sortedRacks)
```

**Enhanced Rack Data Loading:**
```tsx
// Load additional data for rejected racks
if (data?.some(r => r.status === 'rejected')) {
  // Get original scanner names for rejected racks
  const rejectedRacks = data.filter(r => r.status === 'rejected')
  const scannerIds = rejectedRacks.map(r => r.scanner_id).filter(Boolean)
  
  const { data: scanners } = await supabase
    .from('users')
    .select('id, username, email')
    .in('id', scannerIds)
  
  // Attach scanner info to rack data
  const enrichedRacks = data.map(rack => ({
    ...rack,
    original_scanner: rack.status === 'rejected' 
      ? scanners?.find(s => s.id === rack.scanner_id)
      : null
  }))
}
```

### 2. Rack Selection Validation

**Ownership Check Logic:**
```tsx
const handleRackSelection = async (rack: Rack) => {
  // Check if rejected rack belongs to current user
  if (rack.status === 'rejected' && rack.scanner_id !== currentUser.id) {
    const originalScanner = rack.original_scanner?.username || 
                           rack.original_scanner?.email || 
                           'Unknown Scanner'
    
    setError(`This rack was rejected for ${originalScanner}. Please choose an available rack.`)
    return
  }
  
  // Existing rack assignment logic continues...
  try {
    let updateData: any = {
      status: 'assigned',
      scanner_id: currentUser.id,
      assigned_at: new Date().toISOString()
    }

    // If re-selecting own rejected rack, keep existing scans
    if (rack.status === 'rejected' && rack.scanner_id === currentUser.id) {
      updateData.status = 'assigned' // Reset to assigned for scanning
      // rejection_reason stays in database for reference
    }

    const { error } = await supabase
      .from('racks')
      .update(updateData)
      .eq('id', rack.id)

    if (error) throw error
    setSelectedRack({ ...rack, ...updateData })
    setError(null)
  } catch (error: any) {
    setError('Failed to assign rack')
  }
}
```

### 3. Visual Styling for Rejected Racks

**Rejected Rack Card Styling:**
```tsx
<Card 
  variant={selectedRack?.id === rack.id ? 'elevation' : 'outlined'}
  sx={{ 
    cursor: 'pointer',
    bgcolor: rack.status === 'rejected' 
      ? 'error.light' 
      : selectedRack?.id === rack.id 
        ? 'primary.light' 
        : 'inherit',
    borderColor: rack.status === 'rejected' ? 'error.main' : 'grey.300',
    '&:hover': { 
      bgcolor: rack.status === 'rejected'
        ? 'error.light'
        : selectedRack?.id === rack.id 
          ? 'primary.light' 
          : 'grey.100' 
    }
  }}
  onClick={() => handleRackSelection(rack)}
>
  <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Typography variant="body2" fontWeight="bold">
        {activeSession?.shortname ? 
          `${activeSession.shortname}-${rack.rack_number.padStart(3, '0')}` : 
          rack.rack_number
        }
      </Typography>
      
      {rack.status === 'rejected' && (
        <WarningIcon sx={{ color: 'error.main', fontSize: 16 }} />
      )}
    </Box>
    
    <Chip 
      label={rack.status === 'rejected' ? 'Rejected' : rack.status.replace('_', ' ')}
      size="small"
      color={rack.status === 'rejected' ? 'error' : rack.status === 'available' ? 'default' : 'primary'}
    />
    
    {rack.status === 'rejected' && rack.rejection_reason && (
      <Typography variant="caption" sx={{ 
        display: 'block', 
        mt: 0.5, 
        color: 'error.dark',
        fontStyle: 'italic'
      }}>
        "{rack.rejection_reason.substring(0, 50)}{rack.rejection_reason.length > 50 ? '...' : ''}"
      </Typography>
    )}
    
    {rack.status === 'rejected' && rack.original_scanner && (
      <Typography variant="caption" sx={{ 
        display: 'block', 
        color: 'text.secondary',
        fontSize: '0.7rem'
      }}>
        Originally scanned by: {rack.original_scanner.username || rack.original_scanner.email}
      </Typography>
    )}
  </CardContent>
</Card>
```

## Workflow Diagrams

### Supervisor Rejection Flow
```
Pending Rack → Click Reject → Enter Reason → Confirm 
    ↓
Rack Status: 'rejected' + reason saved
    ↓
Rack appears in scanner's available list (with visual indicator)
```

### Scanner Selection Flow
```
Scanner sees rejected rack in list
    ↓
Is rack.scanner_id === current_user.id?
    ├── YES → Allow selection → Continue normal scanning
    └── NO → Show error message → Block selection
```

### Re-scanning Flow  
```
Scanner selects own rejected rack → Sees existing scans + rejection reason
    ↓
Scanner can add new scans (normal scanning interface)
    ↓
Scanner reviews all scans (existing + new) → Can delete unwanted scans
    ↓
Scanner re-submits → Status changes to 'ready_for_approval'
```

## Technical Implementation Details

### File Changes Required

1. **Database Migration**
   - `supabase/rejection_reason_migration.sql`

2. **Type Definitions**
   - Update `Rack` interface to include `rejection_reason?: string`
   - Update `Rack` interface to include `original_scanner?: User`

3. **Supervisor Pages**
   - `dashboard/src/app/dashboard/approvals/page.tsx`
   - `dashboard/src/app/dashboard/approvals/[rackId]/page.tsx`

4. **Scanner Pages**  
   - `dashboard/src/app/dashboard/scanning/page.tsx`

### Database Query Examples

**Load Racks with Rejection Info:**
```sql
SELECT 
  r.*,
  u.username as original_scanner_username,
  u.email as original_scanner_email
FROM racks r
LEFT JOIN users u ON r.scanner_id = u.id
WHERE r.audit_session_id = $1 
  AND r.location_id = $2
  AND r.status IN ('available', 'assigned', 'rejected')
ORDER BY 
  CASE WHEN r.status = 'rejected' THEN 0 ELSE 1 END,
  CAST(r.rack_number AS INTEGER)
```

**Update Rack with Rejection:**
```sql
UPDATE racks 
SET 
  status = 'rejected',
  rejection_reason = $1,
  rejected_at = NOW()
WHERE id = $2
```

## Testing Scenarios

### 1. Supervisor Rejection
- [ ] Supervisor can reject rack with reason
- [ ] Rejection reason is saved to database
- [ ] Rack disappears from pending approvals list
- [ ] Rejected rack appears in scanner's available list

### 2. Scanner Ownership Validation
- [ ] Original scanner can select and work on their rejected rack
- [ ] Other scanners get blocked with ownership message
- [ ] Error message shows original scanner's name

### 3. Re-scanning Flow
- [ ] Rejected rack shows existing scans when selected
- [ ] Scanner can add new scans to existing ones
- [ ] Scanner can review and delete unwanted scans
- [ ] Re-submission works and changes status to 'ready_for_approval'

### 4. Visual Feedback
- [ ] Rejected racks have distinct styling (red border, warning icon)
- [ ] Rejection reason is visible in rack card
- [ ] Original scanner name is shown
- [ ] Sorting works correctly (rejected first, then numerical)

## Edge Cases & Error Handling

### 1. Missing Scanner ID
**Scenario**: Rejected rack has NULL scanner_id  
**Handling**: Treat as available rack (anyone can select)
```tsx
if (rack.status === 'rejected' && rack.scanner_id && rack.scanner_id !== currentUser.id) {
  // Block selection
}
```

### 2. Scanner Account Deleted
**Scenario**: Original scanner user account is deleted  
**Handling**: Show "Unknown Scanner" and allow any scanner to take it
```tsx
const originalScanner = rack.original_scanner?.username || 'Unknown Scanner'
```

### 3. Multiple Rejected Racks
**Scenario**: Same scanner has multiple rejected racks  
**Handling**: Show all their rejected racks, let them choose which to work on first

### 4. Empty Rejection Reason
**Scenario**: Supervisor tries to reject without reason  
**Handling**: Disable reject button until reason is entered
```tsx
disabled={!rejectionReason.trim()}
```

### 5. Concurrent Rejection/Selection
**Scenario**: Rack gets rejected while scanner is selecting it  
**Handling**: Show error message and refresh rack list

## Performance Considerations

### 1. Database Queries
- Added index on `(status, scanner_id)` for faster filtering
- Single query loads racks with scanner info via LEFT JOIN
- Minimal additional queries for rejected rack metadata

### 2. UI Performance  
- Sorting happens client-side after data load
- Visual styling uses CSS classes, not inline styles
- Rejection dialog only loads when needed

### 3. Real-time Updates
- Existing Supabase subscriptions will handle rejected rack updates
- No additional subscription channels needed

## Security Considerations

### 1. Authorization
- Only supervisors and superusers can reject racks (existing RLS)
- Scanner ownership validation prevents unauthorized access
- Rejection reasons are visible to all authorized users

### 2. Data Validation
- Rejection reason is trimmed and validated client-side
- Database column allows NULL values for non-rejected racks
- Input sanitization prevents XSS in rejection reasons

## Deployment Strategy

### 1. Database Migration
```bash
# Run in Supabase SQL Editor
ALTER TABLE racks ADD COLUMN rejection_reason TEXT;
CREATE INDEX idx_racks_status_scanner ON racks(status, scanner_id);
```

### 2. Code Deployment
- Deploy supervisor UI changes first (backwards compatible)
- Deploy scanner UI changes second (uses new rejection_reason column)
- Test end-to-end workflow in production

### 3. Rollback Plan
- Remove rejection_reason column if needed
- Revert UI changes to previous version
- Convert rejected racks back to available if necessary

## Success Metrics

- [ ] Supervisors can reject racks with meaningful reasons
- [ ] Original scanners can identify and re-work their rejected racks
- [ ] Other scanners cannot interfere with rejected racks
- [ ] Rejection workflow reduces approval cycle time
- [ ] Visual feedback improves user understanding

---

*This implementation maintains simplicity while providing clear ownership and accountability for rejected racks.*