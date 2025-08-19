import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface VarianceReportItem {
  item_code: string;
  item_name: string;
  brand: string;
  expected_quantity: number;
  actual_quantity: number;
  variance_quantity: number;
  unit_cost: number;
  expected_value: number;
  actual_value: number;
  variance_value: number;
  status: string;
}

interface VarianceReportMetadata {
  session_shortname: string;
  location_name: string;
  session_status: string;
  total_inventory_items: number;
  total_expected_quantity: number;
  total_actual_quantity: number;
  total_expected_value: number;
  total_actual_value: number;
  total_variance_value: number;
  total_variance_percent: number;
  missing_items: number;
  overage_items: number;
  shortage_items: number;
  match_items: number;
  generated_at: string;
}

export async function GET(request: NextRequest) {
  const supabase = await createServerClient();
  
  try {
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check user role (only supervisors and superusers can access variance reports)
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('role')
      .eq('email', user.email)
      .single();
      
    if (profileError || !profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 403 });
    }
    
    if (profile.role !== 'supervisor' && profile.role !== 'superuser') {
      return NextResponse.json({ error: 'Access denied. Variance reports are only available to supervisors and super users.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId parameter is required' }, { status: 400 });
    }

    // Validate session exists and user has access
    const { data: session, error: sessionError } = await supabase
      .from('audit_sessions')
      .select('id, location_id, shortname, status')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Check if user has access to this location (for non-superusers)
    if (profile.role !== 'superuser') {
      const { data: userProfile } = await supabase
        .from('users')
        .select('location_ids')
        .eq('email', user.email)
        .single();
      
      if (userProfile?.location_ids && !userProfile.location_ids.includes(session.location_id)) {
        return NextResponse.json({ error: 'Access denied to this location' }, { status: 403 });
      }
    }

    // Check if inventory exists for this location
    const { count: inventoryCount } = await supabase
      .from('inventory_items')
      .select('*', { count: 'exact', head: true })
      .eq('location_id', session.location_id);

    if (!inventoryCount || inventoryCount === 0) {
      return NextResponse.json({ 
        error: 'No inventory data found for this session location. Please import inventory data first.' 
      }, { status: 400 });
    }

    // Get variance report metadata
    const { data: metadata, error: metadataError } = await supabase
      .rpc('get_variance_report_metadata', { session_id: sessionId });
    
    if (metadataError) {
      console.error('Error fetching variance metadata:', metadataError);
      return NextResponse.json({ error: 'Failed to fetch variance metadata' }, { status: 500 });
    }

    // Get variance report data
    const { data: varianceData, error: varianceError } = await supabase
      .rpc('get_overall_variance_report', { session_id: sessionId });
    
    if (varianceError) {
      console.error('Error fetching variance data:', varianceError);
      return NextResponse.json({ error: 'Failed to fetch variance data' }, { status: 500 });
    }

    if (!varianceData || varianceData.length === 0) {
      return NextResponse.json({ 
        error: 'No variance data found for this session' 
      }, { status: 404 });
    }

    const meta: VarianceReportMetadata = metadata[0];
    const items: VarianceReportItem[] = varianceData;

    // Format numbers for CSV (no currency symbol to avoid encoding issues)
    const formatNumber = (value: number) => value.toFixed(2);

    // Generate CSV content
    const csvLines: string[] = [];
    
    // Header information
    csvLines.push(`Overall Variance Report`);
    csvLines.push(`Session: ${meta.session_shortname} - ${meta.location_name}`);
    csvLines.push(`Status: ${meta.session_status === 'active' ? 'Active Session' : 'Completed Session'}`);
    csvLines.push(`Generated: ${new Date(meta.generated_at).toLocaleString()}`);
    csvLines.push(`Total Items: ${meta.total_inventory_items} | Expected Value: ${formatNumber(meta.total_expected_value)} | Actual Value: ${formatNumber(meta.total_actual_value)}`);
    csvLines.push(`Variance: ${formatNumber(meta.total_variance_value)} (${meta.total_variance_percent > 0 ? '+' : ''}${meta.total_variance_percent}%)`);
    csvLines.push('');
    
    // Summary by status
    csvLines.push('SUMMARY BY STATUS:');
    csvLines.push(`Missing: ${meta.missing_items} | Shortage: ${meta.shortage_items} | Overage: ${meta.overage_items} | Match: ${meta.match_items}`);
    csvLines.push('');
    
    // Summary by quantities
    csvLines.push('QUANTITY SUMMARY:');
    csvLines.push(`Expected Quantity: ${meta.total_expected_quantity.toLocaleString()}`);
    csvLines.push(`Actual Quantity: ${meta.total_actual_quantity.toLocaleString()}`);
    csvLines.push(`Variance Quantity: ${(meta.total_actual_quantity - meta.total_expected_quantity).toLocaleString()}`);
    csvLines.push('');

    // Column headers for detailed data
    csvLines.push('Item Code,Item Name,Brand,Expected Qty,Actual Qty,Variance Qty,Unit Cost,Expected Value,Actual Value,Variance Value,Status');
    
    // Data rows
    items.forEach(item => {
      const row = [
        item.item_code,
        `"${item.item_name.replace(/"/g, '""')}"`, // Escape quotes in item names
        `"${item.brand.replace(/"/g, '""')}"`, // Escape quotes in brand names
        item.expected_quantity.toString(),
        item.actual_quantity.toString(),
        item.variance_quantity.toString(),
        formatNumber(item.unit_cost),
        formatNumber(item.expected_value),
        formatNumber(item.actual_value),
        formatNumber(item.variance_value),
        item.status
      ];
      csvLines.push(row.join(','));
    });

    // Add footer note if session is active
    if (meta.session_status === 'active') {
      csvLines.push('');
      csvLines.push('NOTE: This is an active session - data may change as scanning continues');
    }

    const csvContent = csvLines.join('\n');
    
    // Create safe filename
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const safeName = `${meta.session_shortname}-${meta.location_name}`.replace(/[^a-zA-Z0-9-_]/g, '_');
    const filename = `overall-variance-${safeName}-${timestamp}.csv`;

    // Return CSV file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache'
      }
    });

  } catch (error) {
    console.error('Variance report API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}