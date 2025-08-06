# Location-Based Supervisor Access

## Database Implementation

### RLS Policies for Location Filtering
```sql
-- Supervisors only see racks from their locations
CREATE POLICY "Supervisors see own location racks" ON racks
  FOR SELECT USING (
    location_id = ANY(
      SELECT location_ids FROM users 
      WHERE id = auth.uid()
    )
  );

-- Approval restricted to own locations
CREATE POLICY "Supervisors approve own locations only" ON racks
  FOR UPDATE USING (
    location_id = ANY(
      SELECT location_ids FROM users 
      WHERE id = auth.uid() 
      AND role IN ('supervisor', 'admin')
    )
  );
```

## Report Queries

### Raw SKU List (Single Column)
```sql
-- Simple SKU list for upload
SELECT DISTINCT s.barcode as sku
FROM scans s
JOIN racks r ON s.rack_id = r.id
WHERE r.status = 'completed'
  AND r.location_id = $1
  AND r.approved_at >= CURRENT_DATE - INTERVAL '2 days'
ORDER BY s.barcode;
```

### Detailed Audit Report
```sql
-- Full details with rack info
SELECT 
  s.barcode as sku,
  s.created_at as timestamp,
  u.name as scanner,
  CONCAT(l.code, '-', r.rack_number) as rack,
  r.shelf_number as shelf
FROM scans s
JOIN racks r ON s.rack_id = r.id
JOIN users u ON s.user_id = u.id
JOIN locations l ON r.location_id = l.id
WHERE r.status = 'completed'
  AND r.location_id = $1
ORDER BY s.created_at;
```

## Implementation in Next.js
```typescript
// app/(dashboard)/reports/page.tsx
const exportRawSKU = async (locationId: string) => {
  const { data } = await supabase
    .from('scans')
    .select('barcode')
    .eq('location_id', locationId)
    .csv(); // Export as CSV
    
  downloadFile(data, `sku-list-${locationId}.csv`);
};
```