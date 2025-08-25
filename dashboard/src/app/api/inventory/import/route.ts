import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

// Increase timeout for large file processing
export const maxDuration = 300; // 5 minutes for Vercel
export const dynamic = 'force-dynamic';

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
    const fileName = file.name.toLowerCase();
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
    const isCsv = fileName.endsWith('.csv');
    
    if (!isCsv && !isExcel) {
      return NextResponse.json({ error: 'Only CSV and Excel files are allowed' }, { status: 400 });
    }
    
    let data: any[] = [];
    
    if (isExcel) {
      // Handle Excel files
      try {
        const buffer = await file.arrayBuffer();
        console.log(`Processing Excel file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
        
        const workbook = XLSX.read(buffer, { type: 'array', cellText: false, cellDates: true });
        
        // Log all sheet names
        console.log(`Found ${workbook.SheetNames.length} sheets: ${workbook.SheetNames.join(', ')}`);
        
        // Get the first sheet
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          return NextResponse.json({ error: 'Excel file has no sheets' }, { status: 400 });
        }
        
        const worksheet = workbook.Sheets[sheetName];
        console.log(`Reading sheet: "${sheetName}"`);
        
        // Get the range of the worksheet
        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
        console.log(`Sheet range: ${worksheet['!ref']} (${range.e.r + 1} rows, ${range.e.c + 1} columns)`);
        
        // Convert to JSON, preserving text format for all cells
        data = XLSX.utils.sheet_to_json(worksheet, {
          raw: false, // Get formatted text values, not raw numbers
          defval: '', // Default value for empty cells
        });
        
        console.log(`Parsed ${data.length} data rows from Excel`);
        
        // Log the column names from first row
        if (data.length > 0) {
          const columns = Object.keys(data[0]);
          console.log(`Column names found: ${columns.join(', ')}`);
          
          // Log first 3 rows for debugging
          console.log('First 3 rows of data:');
          data.slice(0, 3).forEach((row, i) => {
            console.log(`Row ${i + 1}:`, JSON.stringify(row, null, 2));
          });
        }
        
        // Transform headers to match CSV format
        data = data.map((row, index) => {
          const transformedRow: any = {};
          for (const [key, value] of Object.entries(row)) {
            const transformedKey = key.trim().toLowerCase().replace(/\s+/g, '_');
            transformedRow[transformedKey] = value;
          }
          
          // Log sample of transformed data
          if (index < 3) {
            console.log(`Transformed row ${index + 1}:`, JSON.stringify(transformedRow, null, 2));
          }
          
          return transformedRow;
        });
        
        console.log(`Excel parsing complete: ${data.length} rows ready for validation`);
        
      } catch (excelError: any) {
        console.error('Excel parsing error:', excelError);
        return NextResponse.json({ 
          error: 'Failed to parse Excel file', 
          details: excelError.message,
          hint: 'Ensure the Excel file is not corrupted and contains valid data'
        }, { status: 400 });
      }
      
    } else {
      // Handle CSV files (existing logic)
      const text = await file.text();
      const parseResult = Papa.parse(text, { 
        header: true,
        skipEmptyLines: true,
        transformHeader: (header: string) => header.trim().toLowerCase().replace(/\s+/g, '_')
      });
      
      if (parseResult.errors.length > 0) {
        return NextResponse.json({ 
          error: 'CSV parse errors', 
          details: parseResult.errors.map(e => e.message) 
        }, { status: 400 });
      }
      
      data = parseResult.data;
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'File is empty' }, { status: 400 });
    }
    
    // Validate and transform data
    const inventoryItemsMap = new Map<string, InventoryItem>(); // Use Map for O(1) duplicate handling
    const validationErrors: string[] = [];
    let duplicateCount = 0;
    
    // Track validation statistics
    const validationStats = {
      totalRows: data.length,
      missingItemCode: 0,
      missingBarcode: 0,
      missingBrand: 0,
      missingItemName: 0,
      invalidItemCodeLength: 0,
      emptyBarcode: 0,
      invalidQuantity: 0,
      invalidCost: 0,
      successfulRows: 0
    };

    console.log(`Starting validation of ${data.length} rows...`);

    (data as any[]).forEach((row: any, index: number) => {
      const rowNum = index + 2; // +2 because index starts at 0 and we have a header row

      // Check required fields
      const itemCode = row.item_code || row['item code'] || '';
      const barcode = row.barcode || '';
      const brand = row.brand || '';
      const itemName = row.item_name || row['item name'] || '';
      const expectedQty = row.expected_quantity || row['expected qty'] || row['expected_qty'] || '0';
      const unitCost = row.unit_cost || row['unit cost'] || row['unit_cost'] || '0';

      // Log first few rows being validated
      if (index < 3) {
        console.log(`Validating row ${rowNum}:`, {
          itemCode: `"${itemCode}" (length: ${itemCode.length})`,
          barcode: `"${barcode}"`,
          brand: `"${brand}"`,
          itemName: `"${itemName}"`,
          expectedQty: `"${expectedQty}"`,
          unitCost: `"${unitCost}"`
        });
      }

      if (!itemCode) {
        validationStats.missingItemCode++;
        if (validationErrors.length < 20) {
          validationErrors.push(`Row ${rowNum}: Missing item_code (found columns: ${Object.keys(row).join(', ')})`);
        }
        return;
      }
      if (!barcode) {
        validationStats.missingBarcode++;
        if (validationErrors.length < 20) {
          validationErrors.push(`Row ${rowNum}: Missing barcode (item_code: ${itemCode})`);
        }
        return;
      }
      if (!brand) {
        validationStats.missingBrand++;
        if (validationErrors.length < 20) {
          validationErrors.push(`Row ${rowNum}: Missing brand (item_code: ${itemCode})`);
        }
        return;
      }
      if (!itemName) {
        validationStats.missingItemName++;
        if (validationErrors.length < 20) {
          validationErrors.push(`Row ${rowNum}: Missing item_name (item_code: ${itemCode})`);
        }
        return;
      }

      // Validate item code is 5 characters
      if (itemCode.length !== 5) {
        validationStats.invalidItemCodeLength++;
        if (validationErrors.length < 20) {
          validationErrors.push(`Row ${rowNum}: item_code "${itemCode}" must be exactly 5 characters (found ${itemCode.length})`);
        }
        return;
      }

      // Validate barcode exists (no length requirement)
      if (!barcode.trim()) {
        validationStats.emptyBarcode++;
        if (validationErrors.length < 20) {
          validationErrors.push(`Row ${rowNum}: barcode cannot be empty (item_code: ${itemCode})`);
        }
        return;
      }

      // Parse numbers
      const parsedQty = parseInt(expectedQty);
      const parsedCost = parseFloat(unitCost);

      if (isNaN(parsedQty) || parsedQty < 0) {
        validationStats.invalidQuantity++;
        if (validationErrors.length < 20) {
          validationErrors.push(`Row ${rowNum}: expected_quantity "${expectedQty}" must be a valid non-negative number (item_code: ${itemCode})`);
        }
        return;
      }
      if (isNaN(parsedCost) || parsedCost < 0) {
        validationStats.invalidCost++;
        if (validationErrors.length < 20) {
          validationErrors.push(`Row ${rowNum}: unit_cost "${unitCost}" must be a valid non-negative number (item_code: ${itemCode})`);
        }
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
        if (index < 10) {
          console.warn(`Duplicate barcode ${barcode} found at row ${rowNum}, keeping latest`);
        }
      }
      
      // Always set/overwrite - keeps last occurrence
      inventoryItemsMap.set(barcodeKey, newItem);
      validationStats.successfulRows++;
    });

    // Log validation summary
    console.log('Validation Summary:', validationStats);
    console.log(`Valid items for import: ${inventoryItemsMap.size}`);
    console.log(`Duplicates resolved: ${duplicateCount}`);

    if (validationErrors.length > 0) {
      // Add summary message
      const summaryMessage = `Validation failed: ${validationStats.successfulRows} rows passed, ${data.length - validationStats.successfulRows} rows failed`;
      
      const errorBreakdown = [];
      if (validationStats.missingItemCode > 0) errorBreakdown.push(`${validationStats.missingItemCode} missing item_code`);
      if (validationStats.missingBarcode > 0) errorBreakdown.push(`${validationStats.missingBarcode} missing barcode`);
      if (validationStats.missingBrand > 0) errorBreakdown.push(`${validationStats.missingBrand} missing brand`);
      if (validationStats.missingItemName > 0) errorBreakdown.push(`${validationStats.missingItemName} missing item_name`);
      if (validationStats.invalidItemCodeLength > 0) errorBreakdown.push(`${validationStats.invalidItemCodeLength} invalid item_code length`);
      if (validationStats.emptyBarcode > 0) errorBreakdown.push(`${validationStats.emptyBarcode} empty barcode`);
      if (validationStats.invalidQuantity > 0) errorBreakdown.push(`${validationStats.invalidQuantity} invalid quantity`);
      if (validationStats.invalidCost > 0) errorBreakdown.push(`${validationStats.invalidCost} invalid cost`);
      
      return NextResponse.json({ 
        error: summaryMessage,
        summary: errorBreakdown.join(', '),
        details: validationErrors,
        stats: validationStats,
        hint: isExcel ? 'Check that Excel column headers match exactly: item_code, barcode, brand, item_name, expected_quantity, unit_cost' : undefined
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
    const totalBatches = Math.ceil(inventoryItems.length / batchSize);
    
    console.log(`Starting database insert: ${dataSize} items in ${totalBatches} batches of ${batchSize}`);
    
    for (let i = 0; i < inventoryItems.length; i += batchSize) {
      const batchNumber = Math.floor(i/batchSize) + 1;
      const batch = inventoryItems.slice(i, i + batchSize);
      
      console.log(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} items)...`);
      
      const { data: insertResult, error: insertError } = await supabase
        .from('inventory_items')
        .upsert(batch, { 
          onConflict: 'location_id,barcode',
          ignoreDuplicates: false 
        })
        .select('id');
        
      if (insertError) {
        console.error(`Database insert failed at batch ${batchNumber}:`, insertError);
        console.error('Failed batch sample:', JSON.stringify(batch.slice(0, 3), null, 2));
        console.error('Full error details:', JSON.stringify(insertError, null, 2));
        return NextResponse.json({ 
          error: 'Database insert failed', 
          details: insertError.message,
          errorCode: insertError.code,
          errorHint: insertError.hint,
          failedAtBatch: batchNumber,
          failedAtRow: i + 1,
          totalBatches: totalBatches,
          batchSample: batch.slice(0, 2) // First 2 items for debugging
        }, { status: 500 });
      }

      const insertedCount = insertResult?.length || batch.length;
      totalInserted += insertedCount;
      console.log(`Batch ${batchNumber} complete: ${insertedCount} items inserted/updated`);
    }
    
    console.log(`Import complete: ${totalInserted} total items processed`);
    
    return NextResponse.json({ 
      success: true, 
      imported: totalInserted,
      duplicatesFound: duplicateCount,
      batchSize: batchSize,
      totalBatches: Math.ceil(inventoryItems.length / batchSize),
      fileType: isExcel ? 'Excel' : 'CSV',
      message: `Successfully imported ${totalInserted} inventory items from ${isExcel ? 'Excel' : 'CSV'} file${duplicateCount > 0 ? ` (${duplicateCount} duplicates resolved)` : ''}`
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