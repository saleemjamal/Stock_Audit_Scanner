import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

interface CSVRow {
  barcode: string
  severity: string
  description: string
}

interface ImportRequest {
  sessionId: string
  damages: CSVRow[]
}

export async function POST(request: NextRequest) {
  try {
    const body: ImportRequest = await request.json()
    const { sessionId, damages } = body

    if (!sessionId || !damages || !Array.isArray(damages)) {
      return NextResponse.json(
        { error: 'Missing sessionId or damages array' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Verify session exists and is active
    const { data: session, error: sessionError } = await supabase
      .from('audit_sessions')
      .select('id, status')
      .eq('id', sessionId)
      .eq('status', 'active')
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Invalid or inactive audit session' },
        { status: 400 }
      )
    }

    // Prepare draft records for bulk insert
    const draftRecords = damages.map(damage => ({
      audit_session_id: sessionId,
      barcode: damage.barcode,
      damage_severity: damage.severity,
      damage_description: damage.description || null,
      photos_completed: false,
      imported_by: user.id
    }))

    // Insert all drafts in a single query
    const { data: insertedDrafts, error: insertError } = await supabase
      .from('damage_drafts')
      .insert(draftRecords)
      .select('id')

    if (insertError) {
      console.error('Insert error:', insertError)
      return NextResponse.json(
        { error: 'Failed to import damage drafts: ' + insertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      imported: insertedDrafts?.length || 0,
      message: `Successfully imported ${insertedDrafts?.length || 0} damage reports`
    })

  } catch (error) {
    console.error('CSV import error:', error)
    return NextResponse.json(
      { error: 'Internal server error: ' + String(error) },
      { status: 500 }
    )
  }
}