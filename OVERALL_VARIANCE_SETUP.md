# Overall Variance Report - Installation Guide

## Overview
This feature adds comprehensive, brand-agnostic variance reporting functionality to the Stock Audit system.

## Installation Steps

### 1. Install SQL Functions
Run the SQL functions in your Supabase database:
```sql
-- Copy and paste the contents of: supabase/overall_variance_function.sql
```

### 2. Verify Installation
Test the functions work correctly:
```sql
-- Replace with your actual session ID
SELECT * FROM get_variance_report_metadata('your-session-id-here') LIMIT 1;
SELECT * FROM get_overall_variance_report('your-session-id-here') LIMIT 10;
```

### 3. Frontend Files
The following files have been created/modified:
- **NEW**: `dashboard/src/app/api/variance-report/route.ts` - API endpoint
- **NEW**: `dashboard/src/components/reports/OverallVarianceReport.tsx` - React component
- **MODIFIED**: `dashboard/src/app/dashboard/reports/page.tsx` - Added new tab

## Features

### SQL Functions
1. **`get_overall_variance_report(session_id)`**: Returns item-level variance data for all inventory items
2. **`get_variance_report_metadata(session_id)`**: Returns summary statistics and metadata

### API Endpoint
- **URL**: `/api/variance-report?sessionId={uuid}`
- **Method**: GET
- **Response**: CSV file download
- **Access**: Supervisors and Super Users only

### Frontend Component
- **Location**: Reports page → "Overall Variance" tab
- **Features**:
  - Session selection dropdown
  - Inventory validation
  - Summary metrics display
  - Preview table with pagination
  - CSV download functionality

## CSV Report Structure
```
Overall Variance Report
Session: [Name] - [Location]
Generated: [Timestamp]
Total Items: [Count] | Expected Value: ₹[Amount] | Actual Value: ₹[Amount]
Variance: ₹[Amount] ([%]%)

SUMMARY BY STATUS:
Missing: [Count] | Shortage: [Count] | Overage: [Count] | Match: [Count]

QUANTITY SUMMARY:
Expected Quantity: [Count]
Actual Quantity: [Count] 
Variance Quantity: [Count]

Item Code,Item Name,Brand,Expected Qty,Actual Qty,Variance Qty,Unit Cost,Expected Value,Actual Value,Variance Value,Status
[Item data rows...]
```

## Key Benefits
- **Complete Coverage**: Shows ALL inventory items (not limited to top brands)
- **Brand-Agnostic**: No artificial brand filtering
- **Comprehensive Data**: Includes quantities, values, and variance calculations
- **Professional Format**: Business-ready CSV exports with summaries
- **Role-Based Access**: Supervisors and Super Users only
- **Session Support**: Works with active and completed sessions

## Usage
1. Navigate to Reports page
2. Click "Overall Variance" tab
3. Select an audit session from dropdown
4. Wait for inventory validation
5. Click "Download CSV Report" to get complete report
6. Preview table shows top variance items

## Requirements
- Inventory data must be imported for the session's location
- User must have Supervisor or Super User role
- Session must exist and user must have access to its location