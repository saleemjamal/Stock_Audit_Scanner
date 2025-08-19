import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { CapturedPhoto } from '@/services/DamageCameraService';

interface PartialDamageRequest {
  barcode: string;
  damageType: string;
  affectedUnits?: number;
  totalUnits?: number;
  severity: string;
  remarks: string;
  photos: CapturedPhoto[];
  rackId: string;
  auditSessionId: string;
  scannerId: string;
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  
  try {
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: PartialDamageRequest = await request.json();
    
    // Validate required fields
    if (!body.barcode || !body.damageType || !body.severity || !body.remarks) {
      return NextResponse.json(
        { error: 'Missing required fields: barcode, damageType, severity, remarks' },
        { status: 400 }
      );
    }

    // Validate barcode format
    if (!/^\d{10,12}$/.test(body.barcode.trim())) {
      return NextResponse.json(
        { error: 'Invalid barcode format. Must be 10-12 digits.' },
        { status: 400 }
      );
    }

    // Validate photos
    if (!body.photos || body.photos.length !== 3) {
      return NextResponse.json(
        { error: '3 photos are required for partial damage documentation' },
        { status: 400 }
      );
    }

    // Get user profile to verify they have access to this session
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('id, role, location_ids')
      .eq('email', user.email)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 403 });
    }

    // Verify session access
    const { data: session, error: sessionError } = await supabase
      .from('audit_sessions')
      .select('location_id')
      .eq('id', body.auditSessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Audit session not found' }, { status: 404 });
    }

    // Check if user has access to this location
    if (!userProfile.location_ids.includes(session.location_id)) {
      return NextResponse.json({ error: 'Access denied to this location' }, { status: 403 });
    }

    // Upload photos to Supabase Storage
    const photoUrls: string[] = [];
    
    for (let i = 0; i < body.photos.length; i++) {
      const photo = body.photos[i];
      
      // Convert data URL to blob
      const response = await fetch(photo.dataUrl);
      const blob = await response.blob();
      
      // Generate unique filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${body.auditSessionId}/${body.rackId}/${body.barcode}-${timestamp}-${i + 1}.jpg`;
      
      // Upload to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('partial-damage-photos')
        .upload(filename, blob, {
          contentType: 'image/jpeg',
          upsert: false
        });

      if (uploadError) {
        console.error('Photo upload error:', uploadError);
        return NextResponse.json(
          { error: `Failed to upload photo ${i + 1}: ${uploadError.message}` },
          { status: 500 }
        );
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('partial-damage-photos')
        .getPublicUrl(uploadData.path);

      photoUrls.push(publicUrl);
    }

    // Find the scan record for this barcode (if it exists)
    const { data: scanData } = await supabase
      .from('scans')
      .select('id')
      .eq('barcode', body.barcode.trim())
      .eq('audit_session_id', body.auditSessionId)
      .eq('rack_id', body.rackId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Insert partial damage record
    const partialDamageData = {
      scan_id: scanData?.id || null,
      audit_session_id: body.auditSessionId,
      rack_id: body.rackId,
      barcode: body.barcode.trim(),
      damage_type: body.damageType,
      affected_units: body.affectedUnits || null,
      total_units: body.totalUnits || null,
      severity: body.severity,
      remarks: body.remarks.trim(),
      photo_urls: photoUrls,
      created_by: userProfile.id
    };

    const { data: partialDamage, error: insertError } = await supabase
      .from('partial_damages')
      .insert([partialDamageData])
      .select()
      .single();

    if (insertError) {
      console.error('Partial damage insert error:', insertError);
      
      // Clean up uploaded photos if database insert fails
      for (const photoUrl of photoUrls) {
        const path = photoUrl.split('/').pop();
        if (path) {
          await supabase.storage
            .from('partial-damage-photos')
            .remove([path]);
        }
      }
      
      return NextResponse.json(
        { error: 'Failed to save partial damage record' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      id: partialDamage.id,
      message: 'Partial damage record saved successfully'
    });

  } catch (error) {
    console.error('Partial damage API error:', error);
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
    const sessionId = searchParams.get('sessionId');
    const rackId = searchParams.get('rackId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId parameter is required' },
        { status: 400 }
      );
    }

    // Get partial damages with photo URLs and user details
    let query = supabase
      .from('partial_damages')
      .select(`
        id,
        barcode,
        damage_type,
        severity,
        affected_units,
        total_units,
        remarks,
        photo_urls,
        rack_id,
        created_at,
        created_by:users(username)
      `)
      .eq('audit_session_id', sessionId)
      .order('created_at', { ascending: false });

    if (rackId) {
      query = query.eq('rack_id', rackId);
    }

    const { data: partialDamages, error } = await query;

    if (error) {
      console.error('Failed to fetch partial damages:', error);
      return NextResponse.json(
        { error: 'Failed to fetch partial damages' },
        { status: 500 }
      );
    }

    // Transform data to match expected format
    const filteredData = partialDamages?.map((pd: any) => ({
      id: pd.id,
      barcode: pd.barcode,
      damage_type: pd.damage_type,
      severity: pd.severity,
      unit_ratio: pd.total_units > 0 
        ? `${pd.affected_units || '?'}/${pd.total_units}` 
        : 'N/A',
      remarks: pd.remarks,
      photo_count: pd.photo_urls?.length || 0,
      photo_urls: pd.photo_urls || [],
      created_by_name: pd.created_by?.username || 'Unknown',
      created_at: pd.created_at
    }));

    return NextResponse.json({
      success: true,
      data: filteredData || []
    });

  } catch (error) {
    console.error('Partial damage GET API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}