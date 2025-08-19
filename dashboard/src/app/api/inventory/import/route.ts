import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import Papa from 'papaparse';

interface InventoryItem {
  location_id: string;
  item_code: string;
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
    const inventoryItems: InventoryItem[] = [];
    const validationErrors: string[] = [];

    (data as any[]).forEach((row: any, index: number) => {
      const rowNum = index + 2; // +2 because index starts at 0 and we have a header row

      // Check required fields
      const itemCode = row.item_code || row['item code'] || '';
      const brand = row.brand || '';
      const itemName = row.item_name || row['item name'] || '';
      const expectedQty = row.expected_quantity || row['expected qty'] || row['expected_qty'] || '0';
      const unitCost = row.unit_cost || row['unit cost'] || row['unit_cost'] || '0';

      if (!itemCode) {
        validationErrors.push(`Row ${rowNum}: Missing item_code`);
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

      // Validate item code is 5 digits
      if (!/^\d{5}$/.test(itemCode)) {
        validationErrors.push(`Row ${rowNum}: item_code must be exactly 5 digits`);
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

      inventoryItems.push({
        location_id: locationId,
        item_code: itemCode,
        brand: brand.trim(),
        item_name: itemName.trim(),
        expected_quantity: parsedQty,
        unit_cost: parsedCost
      });
    });

    if (validationErrors.length > 0) {
      return NextResponse.json({ 
        error: 'Validation errors found', 
        details: validationErrors 
      }, { status: 400 });
    }

    if (inventoryItems.length === 0) {
      return NextResponse.json({ error: 'No valid inventory items found' }, { status: 400 });
    }
    
    // Upsert in batches of 500
    const batchSize = 500;
    let totalInserted = 0;
    
    for (let i = 0; i < inventoryItems.length; i += batchSize) {
      const batch = inventoryItems.slice(i, i + batchSize);
      
      const { data: insertResult, error: insertError } = await supabase
        .from('inventory_items')
        .upsert(batch, { 
          onConflict: 'location_id,item_code',
          ignoreDuplicates: false 
        })
        .select('id');
        
      if (insertError) {
        console.error('Database insert failed:', insertError);
        return NextResponse.json({ 
          error: 'Database insert failed', 
          details: insertError.message,
          failedAtRow: i + 1 
        }, { status: 500 });
      }

      totalInserted += insertResult?.length || batch.length;
    }
    
    return NextResponse.json({ 
      success: true, 
      imported: totalInserted,
      message: `Successfully imported ${totalInserted} inventory items`
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