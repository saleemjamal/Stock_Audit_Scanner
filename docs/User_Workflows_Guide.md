# User Workflows Guide

## Overview

This document outlines the complete workflows for each user role in the Stock Audit Scanner system. Understanding these workflows is crucial for building the right features and user interfaces.

## Core Business Process

### **The Stock Audit Cycle**
```
1. Admin creates audit session for a location
2. Scanners select racks and scan items
3. Scanners mark racks complete (ready for approval)
4. Supervisors review and approve/reject racks  
5. Approved racks contribute to final audit report
6. Audit session is completed when all racks are approved
```

---

## Scanner/Auditor Workflow (Mobile App)

### **Primary Users**: Warehouse staff, inventory counters, temporary workers
### **Platform**: Mobile app ONLY
### **Key Goal**: Accurately scan and count inventory items

### **Complete Mobile Workflow:**

#### **1. App Launch & Authentication**
```
📱 Open Stock Audit Scanner app
📱 Enter username and password  
📱 Tap "Login"
📱 See location selection screen
```

#### **2. Location Selection** 
```
📱 View list of assigned locations
📱 See location names (e.g., "Downtown Store", "Warehouse A")
📱 Tap desired location
📱 See "Active Audit Session" or "No Active Session" status
```

**If No Active Session:**
```
📱 See message: "No audit session active for this location"
📱 Contact supervisor to start audit session
📱 Cannot proceed with scanning
```

**If Active Session Exists:**
```
📱 See session details (started date, total racks)
📱 Tap "Continue" to proceed to rack selection
```

#### **3. Rack Selection**
```
📱 View available racks in a list/grid
📱 See rack status:
   🟢 Available - can be selected
   🟡 Assigned to me - continue scanning  
   🟠 Ready for approval - waiting for supervisor
   ✅ Approved - completed
   ❌ Rejected - needs recount
📱 Tap an available rack to claim it
📱 Confirm: "Start scanning Rack #A1-5?"
```

#### **4. Scanning Process**
```
📱 See scanning interface:
   - Current rack: "A1-5"
   - Scan count: "0 items"
   - Barcode input field (auto-focus)
   - Manual entry button
   - History of recent scans

📱 Scan barcode (USB scanner or camera)
📱 Barcode appears in input field automatically
📱 Adjust quantity if needed (default: 1)
📱 Tap "Add" or press Enter
📱 Item appears in scan history
📱 Repeat for all items in rack
```

**Special Cases:**
```
📱 **No Barcode**: Tap "Manual Entry" → Enter description
📱 **Recount**: Tap existing scan → Choose "Recount" → Scan again
📱 **Damaged Items**: Enter notes: "2 damaged, 3 sellable"
📱 **Empty Rack**: Still submit as complete (0 items is valid)
```

#### **5. Completing Rack**
```
📱 When finished scanning rack:
📱 Review scan summary (total items, unique SKUs)
📱 Tap "Mark Complete" 
📱 Confirm: "Submit 47 scans for approval?"
📱 Rack status changes to "Ready for Approval"
📱 Return to rack selection screen
```

#### **6. Continue or Logout**
```
📱 **Continue Auditing**: Select another available rack
📱 **Take Break**: App saves progress, can close safely
📱 **End Shift**: Tap profile → "Logout"
📱 **View My Progress**: See completed racks and stats
```

### **Scanner Error Scenarios**

**Lost Connection:**
```
📱 App shows "Offline Mode" indicator
📱 Can continue scanning (saved locally)
📱 When reconnected, data syncs automatically
📱 See sync status: "3 racks pending sync"
```

**Assigned Rack Disappears:**
```
📱 Rack was reassigned by supervisor
📱 See message: "This rack is no longer available"
📱 Scans are saved, return to rack selection
```

**App Crash/Battery Dies:**
```
📱 All scans saved automatically
📱 On restart, can resume exact same rack
📱 See message: "Resume scanning Rack A1-5?"
```

---

## Supervisor Workflow (Web Dashboard + Mobile App)

### **Primary Users**: Warehouse managers, shift supervisors, department heads
### **Platform**: Web dashboard AND mobile app  
### **Key Goal**: Quality control, audit approval, and hands-on scanning

### **Complete Web Workflow:**

#### **1. Login & Dashboard**
```
💻 Navigate to dashboard URL
💻 Enter username and password
💻 See dashboard overview:
   - Pending approvals count
   - Active audit sessions
   - Scanner activity feed
   - Location statistics
```

#### **2. Audit Session Management**
```
💻 **Start New Audit Session**:
   - Click "New Audit Session"
   - Select location
   - Set total rack count (e.g., 150 racks)
   - Click "Start Session"
   - System generates numbered racks automatically

💻 **Monitor Active Sessions**:
   - View progress: "45/150 racks completed"
   - See scanner assignments
   - Real-time updates as scanners work
```

#### **3. Approval Queue Management**
```
💻 Navigate to "Pending Approvals" section
💻 See list of racks ready for approval:
   - Rack number (A1-5)
   - Scanner name (John Smith)
   - Scan count (47 items)
   - Completed time (2 hours ago)
   - Priority/age indicator

💻 Click on a rack to review
```

#### **4. Rack Review Process**
```
💻 **Review Screen Shows**:
   - Rack details (location, scanner, timing)
   - Complete scan list with timestamps
   - Item quantities and any notes
   - Photos if available
   - Scanner performance indicators

💻 **Quality Check**:
   - Look for unusual patterns (too fast, too slow)
   - Check for obvious errors (negative quantities)
   - Review any manual entries or notes
   - Compare against expected inventory if available
```

#### **5. Approval Decision**
```
💻 **Approve Rack**:
   - Click "Approve" button
   - Optional: Add approval notes
   - Rack status changes to "Approved"
   - Scanner gets notification (if online)
   - Rack data included in final audit

💻 **Reject Rack**:
   - Click "Reject" button  
   - Required: Add rejection reason
   - Select specific issues:
     ☐ Items missed
     ☐ Incorrect quantities  
     ☐ Wrong rack scanned
     ☐ Poor quality data
   - Rack returns to "Available" status
   - Scanner gets notification to recount
```

#### **6. Bulk Operations**
```
💻 **Approve Multiple Racks**:
   - Select checkboxes for high-quality racks
   - Click "Bulk Approve" (for trusted scanners)
   - Confirm bulk action

💻 **Priority Queue Management**:
   - Sort by completion time (oldest first)
   - Filter by scanner (check specific person's work)
   - Filter by rack location (focus on problem areas)
```

#### **7. Reporting and Analysis**
```
💻 **Progress Monitoring**:
   - Real-time dashboard updates
   - Scanner productivity metrics
   - Error rate tracking per scanner
   - Location completion status

💻 **Generate Reports**:
   - Interim reports (current progress)
   - Final audit reports (when session complete)
   - Exception reports (rejected racks, errors)
   - Scanner performance reports
```

#### **8. Session Completion**
```
💻 When all racks approved:
   - Review final statistics
   - Generate comprehensive audit report
   - Export to Excel/PDF
   - Mark audit session as "Completed"
   - Archive session data
```

### **Supervisor Error Scenarios**

**Scanner Needs Help:**
```
💻 See "Help Request" notification
💻 View scanner's current rack and issue
💻 Can reassign rack to another scanner
💻 Or provide guidance via messaging
```

**System Issues:**
```
💻 If offline: Show "Connection Lost" warning
💻 Continue reviewing cached data
💻 Queue approval decisions for sync
💻 Warn about potential data delays
```

### **Mobile App Workflow for Supervisors**

Supervisors can also use the mobile app for hands-on work:

#### **When to Use Mobile App:**
```
📱 **Quality Spot Checks**: Personally verify problem areas
📱 **Training New Scanners**: Demonstrate proper technique
📱 **Filling Staff Gaps**: Cover when scanners are absent
📱 **Complex Items**: Handle unusual inventory personally
📱 **Problem Resolution**: Test reported scanning issues
```

#### **Supervisor Mobile Workflow:**
```
📱 Login with supervisor credentials
📱 See ALL locations (not just assigned ones)
📱 Choose location to inspect/assist
📱 Select any available rack or help with assigned racks
📱 Scan items using same interface as scanners
📱 Add supervisor notes (visible to other supervisors)
📱 Can immediately approve own scans (bypass approval queue)
```

#### **Supervisor Mobile Advantages:**
```
📱 **Immediate Problem Resolution**: Fix issues on the spot
📱 **Training Efficiency**: Show don't tell approach
📱 **Quality Assurance**: Random spot checks in person
📱 **Flexible Coverage**: Work wherever needed most
📱 **Fast Approvals**: Self-approve when doing personal scans
```

---

## Super User Workflow (Admin)

### **Primary User**: saleem@poppatjamals.com  
### **Platform**: BOTH web dashboard AND mobile app
### **Key Goal**: System administration and oversight

### **Dual-Platform Access**

#### **As Web Admin (All Supervisor Features PLUS)**:

##### **User Management**
```
💻 Navigate to "User Management"
💻 **Create New Users**:
   - Add username, email, password
   - Assign role (scanner/supervisor)
   - Assign locations
   - Set active/inactive status

💻 **Manage Existing Users**:
   - Edit user profiles
   - Change roles and permissions
   - Reset passwords  
   - Deactivate accounts
   - View login history
```

##### **Location Management**  
```
💻 Navigate to "Location Management"
💻 **Create New Locations**:
   - Location name (Downtown Store)
   - Address details
   - Contact information
   - Set active/inactive status

💻 **Manage Locations**:
   - Edit location details
   - Assign supervisors to locations
   - View location audit history
   - Deactivate closed locations
```

##### **System-Wide Oversight**
```
💻 **Cross-Location Reporting**:
   - View all locations simultaneously
   - Compare performance across stores
   - Identify best practices and issues
   - Generate company-wide reports

💻 **System Administration**:
   - Configure system settings
   - Monitor system performance
   - Manage integrations
   - Review audit logs
```

#### **As Mobile Scanner (All Scanner Features)**:
```
📱 **Training and Quality Assurance**:
   - Test scanning workflows personally
   - Train new scanners hands-on
   - Spot-check audit quality in person
   - Verify mobile app functionality

📱 **Emergency Coverage**:
   - Fill in when scanners are absent
   - Handle special inventory situations
   - Test problem areas personally
   - Validate reported issues
```

### **Platform Decision Matrix**

| Task | Platform | Who Can Do It |
|------|----------|---------------|
| Create users | Web | Super user only |
| Train new scanner | Mobile | Supervisor or Super user |  
| Approve racks | Web | Supervisor or Super user |
| Test problem rack | Mobile | Supervisor or Super user |
| Generate reports | Web | Supervisor or Super user |
| Emergency scanning | Mobile | Supervisor or Super user |
| System administration | Web | Super user only |
| Quality spot checks | Mobile | Supervisor or Super user |

---

## Workflow Integration Points

### **Real-Time Communications**
```
Scanner marks rack complete → Supervisor gets notification
Supervisor rejects rack → Scanner gets notification  
Scanner requests help → Supervisor gets alert
Session completes → All users get summary
```

### **Data Synchronization**  
```
Mobile scans → Sync to server → Appear in web dashboard
Web approvals → Push to mobile → Update scanner status
Offline scans → Queue locally → Sync when connected
```

### **Quality Control Triggers**
```
Scanner too fast → Flag for supervisor review
Scanner accuracy drops → Require supervisor approval
Unusual patterns → Automatic quality alerts
Multiple rejections → Scanner requires retraining
```

---

## Success Metrics by Role

### **Scanner Success**
- **Productivity**: Racks completed per hour
- **Accuracy**: Approval rate from supervisors  
- **Quality**: Low rejection rate, good notes
- **Reliability**: Consistent scanning over time

### **Supervisor Success**
- **Efficiency**: Fast, accurate approval decisions
- **Quality Control**: Catching errors before final report
- **Team Management**: Keeping scanners productive
- **Reporting**: Clear, actionable audit reports

### **Super User Success**
- **System Health**: All workflows operating smoothly
- **User Satisfaction**: Minimal support requests
- **Data Quality**: Accurate, complete audit results
- **Business Impact**: Actionable inventory insights

---

This workflow guide ensures every user understands exactly what they need to do, when to do it, and what happens next in the process.