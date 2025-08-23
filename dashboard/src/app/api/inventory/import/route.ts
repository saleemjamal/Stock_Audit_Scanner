import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import Papa from 'papaparse';

interface InventoryItem {
  location_id: string;
  item_code: string;
  barcode: string;
  brand: string;
  item_name: string;
  expected_quantity: number;
  unit_cost: number;
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  
  try {
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check user is superuser (only superusers can import inventory)
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('role')
      .eq('email', user.email)
      .single();
      
    if (profileError || !profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 403 });
    }
    
    if (profile.role !== 'superuser') {
      return NextResponse.json({ error: 'Only super users can import inventory' }, { status: 403 });
    }
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const locationId = formData.get('locationId') as string;
    
    if (!file || !locationId) {
      return NextResponse.json({ error: 'Missing file or location' }, { status: 400 });
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Maximum size is 10MB' }, { status: 400 });
    }

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.csv')) {
      return NextResponse.json({ error: 'Only CSV files are allowed' }, { status: 400 });
    }
    
    const text = await file.text();
    const { data, errors } = Papa.parse(text, { 
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim().toLowerCase().replace(/\s+/g, '_')
    });
    
    if (errors.length > 0) {
      return NextResponse.json({ 
        error: 'CSV parse errors', 
        details: errors.map(e => e.message) 
      }, { status: 400 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'CSV file is empty' }, { status: 400 });
    }
    
    // Validate and transform data
    const inventoryItemsMap = new Map<string, InventoryItem>(); // Use Map for O(1) duplicate handling
    const validationErrors: string[] = [];
    let duplicateCount = 0;

    (data as any[]).forEach((row: any, index: number) => {
      const rowNum = index + 2; // +2 because index starts at 0 and we have a header row

      // Check required fields
      const itemCode = row.item_code || row['item code'] || '';
      const barcode = row.barcode || '';
      const brand = row.brand || '';
      const itemName = row.item_name || row['item name'] || '';
      const expectedQty = row.expected_quantity || row['expected qty'] || row['expected_qty'] || '0';
      const unitCost = row.unit_cost || row['unit cost'] || row['unit_cost'] || '0';

      if (!itemCode) {
        validationErrors.push(`Row ${rowNum}: Missing item_code`);
        return;
      }
      if (!barcode) {
        validationErrors.push(`Row ${rowNum}: Missing barcode`);
        return;
      }
      if (!brand) {
        validationErrors.push(`Row ${rowNum}: Missing brand`);
        return;
      }
      if (!itemName) {
        validationErrors.push(`Row ${rowNum}: Missing item_name`);
        return;
      }

      // Validate item code is 5 characters
      if (itemCode.length !== 5) {
        validationErrors.push(`Row ${rowNum}: item_code must be exactly 5 characters`);
        return;
      }

      // Validate barcode exists (no length requirement)
      if (!barcode.trim()) {
        validationErrors.push(`Row ${rowNum}: barcode cannot be empty`);
        return;
      }

      // Parse numbers
      const parsedQty = parseInt(expectedQty);
      const parsedCost = parseFloat(unitCost);

      if (isNaN(parsedQty) || parsedQty < 0) {
        validationErrors.push(`Row ${rowNum}: expected_quantity must be a valid non-negative number`);
        return;
      }
      if (isNaN(parsedCost) || parsedCost < 0) {
        validationErrors.push(`Row ${rowNum}: unit_cost must be a valid non-negative number`);
        return;
      }

      // Handle duplicates efficiently with Map
      const barcodeKey = `${locationId}-${barcode.trim()}`;
      const newItem: InventoryItem = {
        location_id: locationId,
        item_code: itemCode.trim(),
        barcode: barcode.trim(),
        brand: brand.trim(),
        item_name: itemName.trim(),
        expected_quantity: parsedQty,
        unit_cost: parsedCost
      };

      if (inventoryItemsMap.has(barcodeKey)) {
        duplicateCount++;
        console.warn(`Duplicate barcode ${barcode} found at row ${rowNum}, keeping latest`);
      }
      
      // Always set/overwrite - keeps last occurrence
      inventoryItemsMap.set(barcodeKey, newItem);
    });

    if (validationErrors.length > 0) {
      return NextResponse.json({ 
        error: 'Validation errors found', 
        details: validationErrors 
      }, { status: 400 });
    }

    // Convert Map to Array
    const inventoryItems = Array.from(inventoryItemsMap.values());
    
    if (inventoryItems.length === 0) {
      return NextResponse.json({ error: 'No valid inventory items found' }, { status: 400 });
    }
    
    // Dynamic batch size based on data size
    const dataSize = inventoryItems.length;
    const batchSize = dataSize > 10000 ? 5000 : dataSize > 5000 ? 2000 : 1000;
    let totalInserted = 0;
    
    console.log(`Processing ${dataSize} items in batches of ${batchSize}`);
    
    for (let i = 0; i < inventoryItems.length; i += batchSize) {
      const batch = inventoryItems.slice(i, i + batchSize);
      
      const { data: insertResult, error: insertError } = await supabase
        .from('inventory_items')
        .upsert(batch, { 
          onConflict: 'location_id,barcode',
          ignoreDuplicates: false 
        })
        .select('id');
        
      if (insertError) {
        console.error(`Database insert failed at batch ${Math.floor(i/batchSize) + 1}:`, insertError);
        console.error('Failed batch sample:', JSON.stringify(batch.slice(0, 3), null, 2));
        console.error('Full error details:', JSON.stringify(insertError, null, 2));
        return NextResponse.json({ 
          error: 'Database insert failed', 
          details: insertError.message,
          errorCode: insertError.code,
          errorHint: insertError.hint,
          failedAtBatch: Math.floor(i/batchSize) + 1,
          failedAtRow: i + 1,
          totalBatches: Math.ceil(inventoryItems.length / batchSize),
          batchSample: batch.slice(0, 2) // First 2 items for debugging
        }, { status: 500 });
      }

      totalInserted += insertResult?.length || batch.length;
    }
    
    return NextResponse.json({ 
      success: true, 
      imported: totalInserted,
      duplicatesFound: duplicateCount,
      batchSize: batchSize,
      totalBatches: Math.ceil(inventoryItems.length / batchSize),
      message: `Successfully imported ${totalInserted} inventory items${duplicateCount > 0 ? ` (${duplicateCount} duplicates resolved)` : ''}`
    });

  } catch (error) {
    console.error('Inventory import error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const supabase = await createServerClient();
  
  try {
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const locationId = searchParams.get('locationId');

    if (!locationId) {
      return NextResponse.json(
        { error: 'locationId parameter is required' },
        { status: 400 }
      );
    }

    // Get inventory count for location
    const { count, error } = await supabase
      .from('inventory_items')
      .select('*', { count: 'exact', head: true })
      .eq('location_id', locationId);

    if (error) {
      console.error('Failed to fetch inventory count:', error);
      return NextResponse.json(
        { error: 'Failed to fetch inventory data' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      count: count || 0
    });

  } catch (error) {
    console.error('Inventory GET API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}