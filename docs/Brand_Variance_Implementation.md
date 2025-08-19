# Brand Variance Reporting Implementation Guide

## Overview
This document outlines the implementation of brand-based variance reporting for the Stock Audit system, enabling comparison between expected inventory and actual scan counts.

### Access Control
- **Variance Reports**: Visible to Supervisor and Super User roles only
- **Inventory Import**: Super User only
- **Scanner Role**: No access to variance features

## Phase 1: Database Schema (1 hour)

### 1.1 Create Inventory Items Table
```sql
-- File: supabase/migrations/create_inventory_items.sql
CREATE TABLE inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  item_code TEXT NOT NULL,  -- 5-digit code
  brand TEXT NOT NULL,
  item_name TEXT NOT NULL,
  expected_quantity INTEGER NOT NULL DEFAULT 0,
  unit_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(location_id, item_code)
);

-- Index for performance
CREATE INDEX idx_inventory_items_location ON inventory_items(location_id);
CREATE INDEX idx_inventory_items_item_code ON inventory_items(item_code);
CREATE INDEX idx_inventory_items_brand ON inventory_items(brand);
```

### 1.2 Create Variance Calculation Function
```sql
-- File: supabase/migrations/brand_variance_functions.sql
CREATE OR REPLACE FUNCTION get_live_brand_variance(session_id UUID)
RETURNS TABLE (
  brand TEXT,
  expected_value DECIMAL,
  actual_value DECIMAL,
  variance_value DECIMAL,
  variance_percent DECIMAL,
  item_count INTEGER,
  scanned_count INTEGER
) AS $$
SELECT 
  i.brand,
  SUM(i.expected_quantity * i.unit_cost)::DECIMAL as expected_value,
  SUM(COALESCE(s.scan_count, 0) * i.unit_cost)::DECIMAL as actual_value,
  SUM((COALESCE(s.scan_count, 0) - i.expected_quantity) * i.unit_cost)::DECIMAL as variance_value,
  ROUND(((SUM(COALESCE(s.scan_count, 0) * i.unit_cost) - SUM(i.expected_quantity * i.unit_cost)) / 
    NULLIF(SUM(i.expected_quantity * i.unit_cost), 0)) * 100, 2) as variance_percent,
  COUNT(DISTINCT i.item_code)::INTEGER as item_count,
  COUNT(DISTINCT s.item_code)::INTEGER as scanned_count
FROM inventory_items i
LEFT JOIN (
  SELECT 
    SUBSTRING(barcode, 1, 5) as item_code,
    COUNT(*) as scan_count
  FROM scans
  WHERE audit_session_id = session_id
  GROUP BY SUBSTRING(barcode, 1, 5)
) s ON i.item_code = s.item_code
WHERE i.location_id = (SELECT location_id FROM audit_sessions WHERE id = session_id)
GROUP BY i.brand
ORDER BY ABS(SUM((COALESCE(s.scan_count, 0) - i.expected_quantity) * i.unit_cost)) DESC
LIMIT 15;
$$ LANGUAGE SQL;
```

### 1.3 Create Brand Detail Function
```sql
CREATE OR REPLACE FUNCTION get_brand_detail_variance(session_id UUID, brand_name TEXT)
RETURNS TABLE (
  item_code TEXT,
  item_name TEXT,
  expected_quantity INTEGER,
  actual_quantity INTEGER,
  variance_quantity INTEGER,
  unit_cost DECIMAL,
  variance_value DECIMAL,
  status TEXT
) AS $$
SELECT 
  i.item_code,
  i.item_name,
  i.expected_quantity,
  COALESCE(s.scan_count, 0)::INTEGER as actual_quantity,
  (COALESCE(s.scan_count, 0) - i.expected_quantity)::INTEGER as variance_quantity,
  i.unit_cost,
  ((COALESCE(s.scan_count, 0) - i.expected_quantity) * i.unit_cost)::DECIMAL as variance_value,
  CASE 
    WHEN s.scan_count IS NULL THEN 'Missing'
    WHEN s.scan_count > i.expected_quantity THEN 'Overage'
    WHEN s.scan_count < i.expected_quantity THEN 'Shortage'
    ELSE 'Match'
  END as status
FROM inventory_items i
LEFT JOIN (
  SELECT 
    SUBSTRING(barcode, 1, 5) as item_code,
    COUNT(*) as scan_count
  FROM scans
  WHERE audit_session_id = session_id
  GROUP BY SUBSTRING(barcode, 1, 5)
) s ON i.item_code = s.item_code
WHERE i.location_id = (SELECT location_id FROM audit_sessions WHERE id = session_id)
  AND i.brand = brand_name
ORDER BY ABS((COALESCE(s.scan_count, 0) - i.expected_quantity) * i.unit_cost) DESC;
$$ LANGUAGE SQL;
```

## Phase 2: CSV Import Functionality (2 hours)

### 2.1 API Route for CSV Upload
```typescript
// File: dashboard/src/app/api/inventory/import/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Papa from 'papaparse';

export async function POST(request: NextRequest) {
  const supabase = createClient();
  
  // Check user is superuser (only superusers can import inventory)
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('email', user.email)
    .single();
    
  if (profile?.role !== 'superuser') {
    return NextResponse.json({ error: 'Only super users can import inventory' }, { status: 403 });
  }
  
  const formData = await request.formData();
  const file = formData.get('file') as File;
  const locationId = formData.get('locationId') as string;
  
  if (!file || !locationId) {
    return NextResponse.json({ error: 'Missing file or location' }, { status: 400 });
  }
  
  const text = await file.text();
  const { data, errors } = Papa.parse(text, { 
    header: true,
    skipEmptyLines: true
  });
  
  if (errors.length > 0) {
    return NextResponse.json({ error: 'CSV parse errors', details: errors }, { status: 400 });
  }
  
  // Validate and transform data
  const inventoryItems = data.map((row: any) => ({
    location_id: locationId,
    item_code: row.item_code || row['Item Code'],
    brand: row.brand || row['Brand'],
    item_name: row.item_name || row['Item Name'],
    expected_quantity: parseInt(row.expected_quantity || row['Expected Qty'] || '0'),
    unit_cost: parseFloat(row.unit_cost || row['Unit Cost'] || '0')
  }));
  
  // Upsert in batches
  const batchSize = 500;
  for (let i = 0; i < inventoryItems.length; i += batchSize) {
    const batch = inventoryItems.slice(i, i + batchSize);
    const { error } = await supabase
      .from('inventory_items')
      .upsert(batch, { 
        onConflict: 'location_id,item_code',
        ignoreDuplicates: false 
      });
      
    if (error) {
      return NextResponse.json({ 
        error: 'Database insert failed', 
        details: error,
        failedAtRow: i 
      }, { status: 500 });
    }
  }
  
  return NextResponse.json({ 
    success: true, 
    imported: inventoryItems.length 
  });
}
```

### 2.2 Import UI Component
```typescript
// File: dashboard/src/components/inventory/InventoryImport.tsx
'use client';

import { useState } from 'react';
import { Button, Dialog, DialogContent, DialogTitle, Alert, LinearProgress } from '@mui/material';
import { CloudUpload } from '@mui/icons-material';

// This component should only be rendered for superusers
export function InventoryImport({ locationId, userRole }: { locationId: string; userRole: string }) {
  // Early return if not superuser
  if (userRole !== 'superuser') return null;
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    setError(null);
    setSuccess(null);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('locationId', locationId);
    
    try {
      const response = await fetch('/api/inventory/import', {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      
      if (response.ok) {
        setSuccess(`Successfully imported ${result.imported} items`);
        setTimeout(() => setOpen(false), 2000);
      } else {
        setError(result.error || 'Import failed');
      }
    } catch (err) {
      setError('Network error during upload');
    } finally {
      setUploading(false);
    }
  };
  
  return (
    <>
      <Button
        variant="outlined"
        startIcon={<CloudUpload />}
        onClick={() => setOpen(true)}
      >
        Import Inventory
      </Button>
      
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Import Expected Inventory</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            CSV format: item_code, brand, item_name, expected_quantity, unit_cost
          </Alert>
          
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
          
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            disabled={uploading}
            style={{ display: 'none' }}
            id="csv-upload"
          />
          
          <label htmlFor="csv-upload">
            <Button
              variant="contained"
              component="span"
              disabled={uploading}
              fullWidth
            >
              Select CSV File
            </Button>
          </label>
          
          {uploading && <LinearProgress sx={{ mt: 2 }} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
```

## Phase 3: Live Brand Variance Dashboard (2 hours)

### 3.1 Brand Variance Widget
```typescript
// File: dashboard/src/components/dashboard/BrandVarianceLive.tsx
'use client';

import { useState } from 'react';
import { Card, CardContent, Typography, IconButton, Box, Chip, CircularProgress } from '@mui/material';
import { Refresh, TrendingUp, TrendingDown } from '@mui/icons-material';
import { supabase } from '@/lib/supabase';

interface BrandVariance {
  brand: string;
  expected_value: number;
  actual_value: number;
  variance_value: number;
  variance_percent: number;
  item_count: number;
  scanned_count: number;
}

export function BrandVarianceLive({ sessionId }: { sessionId: string }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<BrandVariance[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  const fetchVariance = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .rpc('get_live_brand_variance', { session_id: sessionId });
      
      if (error) throw error;
      setData(data || []);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch variance:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD' 
    }).format(value);
  
  const getVarianceColor = (variance: number) => {
    if (variance > 0) return 'success.main';
    if (variance < -100) return 'error.main';
    return 'warning.main';
  };
  
  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Brand Variance (Top 15)</Typography>
          <Box display="flex" alignItems="center" gap={1}>
            {lastUpdated && (
              <Typography variant="caption" color="text.secondary">
                Updated: {lastUpdated.toLocaleTimeString()}
              </Typography>
            )}
            <IconButton onClick={fetchVariance} disabled={loading} size="small">
              <Refresh />
            </IconButton>
          </Box>
        </Box>
        
        {loading && (
          <Box display="flex" justifyContent="center" p={3}>
            <CircularProgress />
          </Box>
        )}
        
        {!loading && data.length === 0 && (
          <Typography color="text.secondary" align="center">
            Click refresh to calculate variance
          </Typography>
        )}
        
        {!loading && data.map((item) => (
          <Box 
            key={item.brand} 
            sx={{ 
              py: 1, 
              borderBottom: '1px solid',
              borderColor: 'divider',
              '&:last-child': { borderBottom: 'none' }
            }}
          >
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Box flex={1}>
                <Typography variant="subtitle2">{item.brand}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {item.scanned_count}/{item.item_count} items scanned
                </Typography>
              </Box>
              
              <Box textAlign="right">
                <Typography 
                  variant="body2" 
                  sx={{ color: getVarianceColor(item.variance_value) }}
                  fontWeight="bold"
                >
                  {formatCurrency(item.variance_value)}
                </Typography>
                <Chip
                  size="small"
                  label={`${item.variance_percent > 0 ? '+' : ''}${item.variance_percent}%`}
                  color={item.variance_percent > 0 ? 'success' : 'error'}
                  icon={item.variance_percent > 0 ? <TrendingUp /> : <TrendingDown />}
                />
              </Box>
            </Box>
          </Box>
        ))}
      </CardContent>
    </Card>
  );
}
```

### 3.2 Integration with Dashboard
```typescript
// File: dashboard/src/app/dashboard/page.tsx (addition)
import { BrandVarianceLive } from '@/components/dashboard/BrandVarianceLive';

// Add to dashboard grid (only for supervisor and superuser)
{(userRole === 'supervisor' || userRole === 'superuser') && (
  <Grid item xs={12} lg={6}>
    <BrandVarianceLive sessionId={activeSession?.id} />
  </Grid>
)}
```

## Phase 4: Detailed Brand Reports (3 hours)

### 4.1 Brand Detail Dialog
```typescript
// File: dashboard/src/components/reports/BrandDetailDialog.tsx
'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  Box
} from '@mui/material';
import { Download } from '@mui/icons-material';
import { supabase } from '@/lib/supabase';

interface BrandDetailProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  brand: string;
}

export function BrandDetailDialog({ open, onClose, sessionId, brand }: BrandDetailProps) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    if (open && brand) {
      fetchBrandDetail();
    }
  }, [open, brand]);
  
  const fetchBrandDetail = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .rpc('get_brand_detail_variance', { 
          session_id: sessionId,
          brand_name: brand 
        });
      
      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Failed to fetch brand detail:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const exportToCSV = () => {
    const csv = [
      ['Item Code', 'Item Name', 'Expected', 'Actual', 'Variance', 'Unit Cost', 'Variance Value', 'Status'],
      ...items.map(item => [
        item.item_code,
        item.item_name,
        item.expected_quantity,
        item.actual_quantity,
        item.variance_quantity,
        item.unit_cost,
        item.variance_value,
        item.status
      ])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${brand}_variance_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };
  
  const getStatusColor = (status: string) => {
    switch(status) {
      case 'Match': return 'success';
      case 'Overage': return 'info';
      case 'Shortage': return 'warning';
      case 'Missing': return 'error';
      default: return 'default';
    }
  };
  
  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <span>{brand} - Variance Detail</span>
          <Button startIcon={<Download />} onClick={exportToCSV}>
            Export CSV
          </Button>
        </Box>
      </DialogTitle>
      <DialogContent>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Item Code</TableCell>
                <TableCell>Item Name</TableCell>
                <TableCell align="right">Expected</TableCell>
                <TableCell align="right">Actual</TableCell>
                <TableCell align="right">Variance</TableCell>
                <TableCell align="right">Unit Cost</TableCell>
                <TableCell align="right">Variance Value</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.item_code}>
                  <TableCell>{item.item_code}</TableCell>
                  <TableCell>{item.item_name}</TableCell>
                  <TableCell align="right">{item.expected_quantity}</TableCell>
                  <TableCell align="right">{item.actual_quantity}</TableCell>
                  <TableCell align="right">
                    <Typography color={item.variance_quantity < 0 ? 'error' : 'success'}>
                      {item.variance_quantity > 0 ? '+' : ''}{item.variance_quantity}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">${item.unit_cost}</TableCell>
                  <TableCell align="right">
                    <Typography color={item.variance_value < 0 ? 'error' : 'success'}>
                      ${item.variance_value.toFixed(2)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={item.status} 
                      color={getStatusColor(item.status)}
                      size="small"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>
    </Dialog>
  );
}
```

### 4.2 Add Variance Tab to Reports Page
```typescript
// File: dashboard/src/app/dashboard/reports/page.tsx (addition)
import { BrandVarianceReport } from '@/components/reports/BrandVarianceReport';

// Add new tab (only visible to supervisor and superuser)
{(userRole === 'supervisor' || userRole === 'superuser') && (
  <Tab label="Variance" value={4} />
)}

// Add tab panel (only render for authorized roles)
{(userRole === 'supervisor' || userRole === 'superuser') && (
  <TabPanel value={value} index={4}>
    <BrandVarianceReport sessionId={selectedSession} />
  </TabPanel>
)}
```

## Phase 5: Session Closure Integration (1 hour)

### 5.1 Add Variance Check to Session Closure
```typescript
// File: dashboard/src/components/sessions/SessionClosure.tsx (modification)
const handleCloseSession = async () => {
  // Check if inventory data exists
  const { count } = await supabase
    .from('inventory_items')
    .select('*', { count: 'exact', head: true })
    .eq('location_id', session.location_id);
  
  if (count > 0) {
    // Show variance summary before closing
    const { data: variance } = await supabase
      .rpc('get_live_brand_variance', { session_id: session.id });
    
    // Display variance summary dialog
    setVarianceSummary(variance);
    setShowVarianceDialog(true);
  } else {
    // Proceed with normal closure
    proceedWithClosure();
  }
};
```

## Testing Plan

### 1. Sample CSV Format
```csv
item_code,brand,item_name,expected_quantity,unit_cost
12345,Nike,Air Max 90,25,89.99
12346,Nike,Air Force 1,30,79.99
23456,Adidas,Stan Smith,20,69.99
23457,Adidas,Superstar,15,74.99
34567,Puma,Suede Classic,10,59.99
```

### 2. Test Scenarios
1. Import inventory CSV for location
2. Start audit session
3. Scan items with barcodes starting with item codes
4. View live brand variance
5. Export brand detail reports
6. Close session with variance summary

## Performance Considerations

1. **Index Strategy**: Indexes on item_code and brand for fast joins
2. **Query Optimization**: Use SUBSTRING index for barcode matching
3. **Caching**: Consider caching variance calculations for 30 seconds
4. **Batch Processing**: Import CSV in 500-item batches
5. **Pagination**: Add pagination for brand detail views with 100+ items

## Security Considerations

1. **CSV Upload**: Validate file size (<10MB) and format
2. **SQL Injection**: Use parameterized queries
3. **Access Control**: Only superusers can import inventory
4. **Data Validation**: Validate numeric fields and required columns

## Rollback Plan

If issues arise:
1. Drop inventory_items table
2. Remove variance functions
3. Revert UI components
4. System continues working with existing features

## Timeline

- **Phase 1**: 1 hour - Database setup
- **Phase 2**: 2 hours - CSV import
- **Phase 3**: 2 hours - Live dashboard
- **Phase 4**: 3 hours - Detailed reports
- **Phase 5**: 1 hour - Session integration
- **Testing**: 1 hour

**Total**: ~10 hours