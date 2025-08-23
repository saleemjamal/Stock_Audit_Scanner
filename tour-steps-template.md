# User Walkthrough Tour Steps Template

This template defines the guided tour steps for different user roles. Use this as a reference when implementing the interactive tours using React Joyride or similar library.

## Scanner Tour (8 Steps)

### Step 1: Welcome & Dashboard
- **Target**: `.dashboard-welcome` or main dashboard container
- **Title**: "Welcome to Stock Audit!"
- **Content**: "This is your scanning dashboard. You can see your current session and start scanning items."
- **Placement**: `center`

### Step 2: Active Session Card
- **Target**: `.session-card` or session info component
- **Title**: "Your Active Session"
- **Content**: "This shows your active scanning session. One session = one audit period for a specific location."
- **Placement**: `bottom`

### Step 3: Start Scanning
- **Target**: `[href="/dashboard/scanning"]` or scanning nav item
- **Title**: "Start Scanning Items"
- **Content**: "Click here to start scanning items. You'll scan barcodes and enter quantities for inventory tracking."
- **Placement**: `right`

### Step 4: Rack Management
- **Target**: `.rack-selector` or rack creation button
- **Title**: "Organize by Racks"
- **Content**: "Organize scans by racks. Create a new rack when you move to a different physical location in the store."
- **Placement**: `bottom`

### Step 5: Scanning Interface
- **Target**: `input[placeholder*="barcode"]` or barcode input field
- **Title**: "Scan Barcodes Here"
- **Content**: "Scan or manually enter barcodes here. Enter quantities for each item. USB scanners are supported for faster input."
- **Placement**: `bottom`

### Step 6: Complete Rack
- **Target**: `button:contains("Complete Rack")` or complete rack button
- **Title**: "Submit for Approval"
- **Content**: "When finished with a rack, mark it complete. This sends it to supervisor for review and approval."
- **Placement**: `top`

### Step 7: Navigation Menu
- **Target**: `.sidebar` or navigation drawer
- **Title**: "Your Available Features"
- **Content**: "Use the sidebar to navigate between scanning and other available features based on your role."
- **Placement**: `right`

### Step 8: Tour Complete
- **Target**: `.user-profile` or profile menu
- **Title**: "You're Ready to Scan!"
- **Content**: "You can restart this tour anytime from the Help menu in your profile dropdown. Happy scanning!"
- **Placement**: `left`

## Supervisor Tour (12 Steps)

### Steps 1-8: Same as Scanner Tour
*Include all scanner functionality*

### Step 9: Approvals Workflow
- **Target**: `[href="/dashboard/approvals"]` or approvals nav item
- **Title**: "Review and Approve Racks"
- **Content**: "Review and approve/reject completed racks from scanners. Check scan accuracy and completeness."
- **Placement**: `right`

### Step 10: Damage Reporting
- **Target**: `[href="/dashboard/damage"]` or damage nav item
- **Title**: "Report Damaged Items"
- **Content**: "Report damaged items with photos and descriptions. Take 3 photos for documentation and submit for approval."
- **Placement**: `right`

### Step 11: Add-Ons Management
- **Target**: `[href="/dashboard/add-ons"]` or add-ons nav item
- **Title**: "Manage Items Without Barcodes"
- **Content**: "Document items found without barcodes. Include photos and pricing information for manual goods inward process."
- **Placement**: `right`

### Step 12: Reports & Analytics
- **Target**: `[href="/dashboard/reports"]` or reports nav item
- **Title**: "Generate Reports"
- **Content**: "Generate comprehensive audit reports: session summaries, rack details, damage reports, and real-time variance analysis by brand."
- **Placement**: `right`

## Feature-Specific Detail Tours

### Damage Reporting Tour (8 Steps)
*For supervisors who need detailed guidance on damage reporting*

#### Step 1: Damage Reporting Overview
- **Target**: `.damage-page-header` or damage page title
- **Title**: "Damage Reporting System"
- **Content**: "This system helps you document damaged items with photos and descriptions for approval and inventory adjustments."
- **Placement**: `bottom`

#### Step 2: Barcode Input
- **Target**: `input[placeholder*="barcode"]` or barcode input field
- **Title**: "Identify the Damaged Item"
- **Content**: "Scan or manually enter the barcode of the damaged item. The system will automatically lookup item details."
- **Placement**: `bottom`

#### Step 3: Damage Details Form
- **Target**: `.damage-form` or form container
- **Title**: "Describe the Damage"
- **Content**: "Select damage severity (Minor/Moderate/Severe) and provide a detailed description of the damage for accurate assessment."
- **Placement**: `right`

#### Step 4: Photo Requirements
- **Target**: `.camera-section` or photo capture area
- **Title**: "Document with Photos"
- **Content**: "Take exactly 3 photos: Overall view, close-up details, and side angle. All photos are required for submission."
- **Placement**: `top`

#### Step 5: Camera Interface
- **Target**: `.camera-capture` or camera component
- **Title**: "Camera Capture"
- **Content**: "Use your device camera to capture high-quality photos. Each photo is compressed to 250KB automatically for optimal storage."
- **Placement**: `center`

#### Step 6: Loss Value Estimation
- **Target**: `input[name="estimated_loss"]` or loss value field
- **Title**: "Estimate Financial Impact" 
- **Content**: "Optionally estimate the monetary loss value. This helps with insurance claims and inventory valuation."
- **Placement**: `bottom`

#### Step 7: Review Before Submit
- **Target**: `.damage-review` or review section
- **Title**: "Review Your Report"
- **Content**: "Review all details, photos, and descriptions before submitting. Once submitted, the report goes to super users for approval."
- **Placement**: `top`

#### Step 8: Submission Complete
- **Target**: `.submit-button` or submit button
- **Title**: "Submit for Approval"
- **Content**: "Submit your damage report. You can track its status in the Reports section and will be notified of approval/rejection decisions."
- **Placement**: `top`

### Delivery Challan (DC) Creation Tour (10 Steps)
*For super users who manage DC creation and barcode mapping*

#### Step 1: DC System Overview
- **Target**: `.dc-page-header` or DC page title
- **Title**: "Delivery Challan Management"
- **Content**: "DCs track items temporarily out of stock (samples to customers, replacements to vendors) to ensure accurate variance calculations."
- **Placement**: `bottom`

#### Step 2: Session Selection
- **Target**: `.session-selector` or session dropdown
- **Title**: "Choose Active Session"
- **Content**: "Select the audit session for this DC. DCs are tied to specific audit sessions for proper variance tracking."
- **Placement**: `bottom`

#### Step 3: DC Details Form
- **Target**: `.dc-form` or DC form container
- **Title**: "DC Information"
- **Content**: "Enter DC number, date, and select type: Sample (sent to customers) or Replacement (sent to vendors for repair/replacement)."
- **Placement**: `right`

#### Step 4: DC Type Selection
- **Target**: `.dc-type-selector` or type dropdown
- **Title**: "Choose DC Type"
- **Content**: "Sample: Items sent to customers for evaluation. Replacement: Items sent back to vendors for replacement or repair."
- **Placement**: `bottom`

#### Step 5: Adding Items
- **Target**: `.item-entry` or item input section
- **Title**: "Add Items to DC"
- **Content**: "Enter item code (5 characters) and quantity. The system will lookup item details from your inventory database."
- **Placement**: `right`

#### Step 6: Barcode Selection
- **Target**: `.barcode-selector` or barcode dropdown
- **Title**: "Select Specific Barcode"
- **Content**: "CRITICAL: Choose the exact barcode for each item. This barcode will be included in stock audit reports for proper variance calculation."
- **Placement**: `bottom`

#### Step 7: Items Review Table
- **Target**: `.items-table` or items display table
- **Title**: "Review Added Items"
- **Content**: "Review all items and their selected barcodes. You can add multiple items before creating the DC. Remove items if needed."
- **Placement**: `top`

#### Step 8: Photo Documentation
- **Target**: `.image-upload` or photo upload section
- **Title**: "Optional Documentation"
- **Content**: "Upload up to 3 photos of the DC for additional documentation. This helps with audit trails and verification."
- **Placement**: `right`

#### Step 9: Validation Check
- **Target**: `.validation-status` or validation indicators
- **Title**: "Ensure Complete Information"
- **Content**: "All items must have selected barcodes before submission. The Create DC button is disabled until all requirements are met."
- **Placement**: `top`

#### Step 10: DC Creation Complete
- **Target**: `.create-dc-button` or submit button
- **Title**: "Create Delivery Challan"
- **Content**: "Create the DC. Items will be tracked separately and their barcodes can be exported for inclusion in stock audit reports."
- **Placement**: `top`

### DC Items Report Tour (6 Steps)
*For understanding how to export DC items for stock audit integration*

#### Step 1: DC Report Overview
- **Target**: `.dc-report-header` or report page title
- **Title**: "DC Items Report"
- **Content**: "Generate barcode lists from Delivery Challans for manual inclusion in stock audit reports. This ensures proper variance calculation."
- **Placement**: `bottom`

#### Step 2: Session Selection for Report
- **Target**: `.report-session-selector` or session dropdown
- **Title**: "Select Session for Report"
- **Content**: "Choose the audit session to generate DC items report. You'll see all DCs created for that specific session."
- **Placement**: `bottom`

#### Step 3: DC Summary Statistics
- **Target**: `.dc-stats` or statistics cards
- **Title**: "DC Overview Statistics"
- **Content**: "View total DCs, barcodes to add, and breakdown by type (Sample vs Replacement) for the selected session."
- **Placement**: `top`

#### Step 4: Items Detail Table
- **Target**: `.dc-items-table` or items table
- **Title**: "Review DC Items"
- **Content**: "See all DC items with their selected barcodes. Only items with selected barcodes will be included in the export."
- **Placement**: `top`

#### Step 5: Export Process
- **Target**: `.export-button` or export button
- **Title**: "Export Barcodes CSV"
- **Content**: "Export a single-column CSV file containing all barcodes from DCs. This file can be manually added to your stock audit scanner."
- **Placement**: `top`

#### Step 6: Manual Integration
- **Target**: `.integration-info` or info alert
- **Title**: "Stock Audit Integration"
- **Content**: "Import the exported barcodes into your stock audit system manually. This ensures DC items are counted as 'found' inventory."
- **Placement**: `center`

## Tour Configuration Options

### Global Settings
```javascript
const tourConfig = {
  continuous: true,
  run: true,
  scrollToFirstStep: true,
  showProgress: true,
  showSkipButton: true,
  styles: {
    options: {
      primaryColor: '#1976d2', // Material-UI primary color
      textColor: '#333',
      backgroundColor: '#fff',
      overlayColor: 'rgba(0, 0, 0, 0.5)',
      arrowColor: '#fff',
      zIndex: 10000,
    }
  },
  locale: {
    back: 'Previous',
    close: 'Close',
    last: 'Finish',
    next: 'Next',
    skip: 'Skip Tour',
  }
}
```

### Step Template Structure
```javascript
{
  target: '.css-selector-or-element',
  title: 'Step Title',
  content: 'Step description with helpful information',
  placement: 'top' | 'bottom' | 'left' | 'right' | 'center',
  disableBeacon: false, // Show animated beacon
  spotlightPadding: 10, // Padding around highlighted element
  hideCloseButton: false,
  hideFooter: false,
  isFixed: false, // For fixed position elements
  offset: 0, // Distance from target
}
```

## Implementation Notes

### Storage Keys
- `tour_completed_scanner` - Track scanner tour completion
- `tour_completed_supervisor` - Track supervisor tour completion
- `tour_version` - Track tour version for updates

### Triggering Tours
- **First Login**: Auto-start appropriate role tour
- **Manual Trigger**: Help menu → "Take Tour" option
- **Feature Updates**: Show specific feature tours when new features are added

### Role Detection
```javascript
const getUserRole = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()
  return profile.role
}
```

### Best Practices
1. **Wait for elements**: Ensure target elements are rendered before starting tour
2. **Responsive design**: Test tours on mobile and desktop
3. **Skip validation**: Allow users to skip tours without breaking functionality
4. **Update handling**: Increment tour version when adding new steps
5. **Error handling**: Gracefully handle missing target elements

### Custom Styling
- Match Material-UI theme colors
- Use consistent spacing and typography
- Ensure good contrast for accessibility
- Test in both light and dark modes

## Testing Checklist
- [ ] All target elements exist and are selectable
- [ ] Tour works on different screen sizes
- [ ] Skip functionality works properly
- [ ] Tour completion is saved correctly
- [ ] Manual restart works from Help menu
- [ ] Tours are role-appropriate (no unauthorized features shown)
- [ ] Navigation during tour doesn't break flow