# Supervisor User Guide
## Stock Audit System

### Your Role
As a **Supervisor**, you manage audit sessions, review scanner work, and approve or reject submissions. You have all scanner abilities plus additional management responsibilities.

---

## Getting Started

### 1. Login & Dashboard
- Login with your supervisor credentials
- Your dashboard shows overview of current audit progress
- You can see pending approvals, active scanners, and session status

### 2. Session Management
- Start new audit sessions in **"Sessions"**
- Set total rack count for the location
- Monitor session progress
- Close sessions when audit is complete

---

## Scanner Functions (You Can Do Everything Scanners Do)

### Scanning Items
1. **"Scanning"** → Select any rack
2. Scan items and enter quantities
3. Mark racks complete
4. Review scanner work if needed

### Reporting Damage
1. **"Damage"** → Use any of the 3 tabs:
   - **Single Item**: Scan → Photos → Submit
   - **CSV Import**: Upload bulk damage list
   - **Photo Queue**: Add photos to imported items

---

## Approval Workflows

### 1. Rack Approvals
**Location**: Main menu → **"Approvals"** → **"Racks"** tab

**What You See**:
- List of completed racks waiting for approval
- Scanner name, rack number, total scans, completion time

**Your Actions**:
- **View Details**: Click eye icon to see all scanned items
- **Approve**: Click green checkmark
- **Reject**: Click red X and provide reason for scanner to fix

**Bulk Operations**:
- Select multiple racks with checkboxes
- Use **"Approve Selected"** or **"Reject Selected"** buttons

### 2. Damage Approvals  
**Location**: Main menu → **"Approvals"** → **"Damage"** tab

**What You See**:
- Efficient list view showing all pending damage reports
- Inline photo thumbnails (click to enlarge)
- Barcode, severity, reporter, description

**Your Actions**:
- **Quick Approve**: Click green checkmark in actions column
- **View Full Details**: Click red X for detailed review
- **Bulk Operations**: Select multiple reports and approve/reject together

**Review Process**:
- Check if photos clearly show damage
- Verify damage level matches severity
- Approve if everything looks correct
- Reject with reason if photos are unclear or damage level wrong

### 3. Add-On Item Approvals
**Location**: Main menu → **"Approvals"** → **"Add-ons"** tab

**What You See**:
- Items without barcodes that scanners documented
- Photos, descriptions, estimated prices

**Your Actions**:
- Review each add-on item
- Approve if documentation is complete
- Reject if more information needed

---

## Reports & Analysis

### Viewing Reports
**Location**: Main menu → **"Reports"**

**Available Reports**:
1. **Audit Sessions** - Completed session overview
2. **Racks** - Individual rack details
3. **Damage Reports** - All damage tracking
4. **Add-On Reports** - Items without barcodes
5. **Partial Damages** - Partial damage flags
6. **Variance Reports** - Brand and overall variance analysis

### Variance Analysis
**Location**: Main menu → **"Variance"**

- **Brand Variance**: See which brands have the biggest differences
- **Overall Variance**: Complete item-by-item analysis
- **Live Updates**: Numbers change as scanning progresses

---

## User Management (Location-Specific)

### Managing Your Team
**Location**: Main menu → **"Users"**

**Your Capabilities**:
- View all users assigned to your locations
- See user roles and status
- Monitor scanner activity
- Cannot create/delete users (Super User only)

---

## Advanced Features

### High-Volume Damage Processing
When you have 50+ damaged items:

1. **CSV Import Method**:
   - Get damage list in CSV format (barcode, severity, description)
   - Upload via **"Damage"** → **"CSV Import"**
   - Assign scanners to add photos via **"Photo Queue"**

2. **Efficient Approval**:
   - Use list view instead of cards
   - See all photos inline without clicking
   - Select multiple items for bulk approval
   - Process 100+ items in minutes instead of hours

### Inventory Management
**Location**: Main menu → **"Settings"**

- Import expected inventory from CSV
- Set up variance tracking
- Manage location-specific settings

---

## Workflow Best Practices

### 1. Daily Operations
- **Morning**: Check session status, assign racks to scanners
- **During Audit**: Monitor progress, handle approvals promptly
- **Evening**: Review completion, approve remaining items

### 2. Quality Control
- **Reject unclear photos** - scanner needs to retake
- **Verify damage severity** - make sure it matches photos
- **Check quantities** - look for obvious errors
- **Provide clear rejection reasons** - help scanners improve

### 3. Efficiency Tips
- **Use bulk operations** when possible
- **Handle approvals regularly** - don't let them pile up
- **Guide scanners** on photo quality standards
- **Use CSV import** for high-damage scenarios

---

## Troubleshooting

### Common Issues
- **Scanner can't log in**: Check if they're assigned to your location
- **No racks available**: Make sure session is active and racks are created
- **Photos not showing**: Check if images uploaded to storage properly
- **Approval not working**: Verify you have supervisor permissions

### Getting Help
- Contact system administrator for technical issues
- Check user permissions if someone can't access features
- Review session settings if scanners can't see racks

---

## Security & Data

### Your Responsibilities
- Only approve accurate submissions
- Maintain data integrity
- Report system issues promptly
- Train scanners on proper procedures

### Data Access
- You can see all data for your assigned locations
- Cannot access other locations' data
- All actions are logged for audit trail