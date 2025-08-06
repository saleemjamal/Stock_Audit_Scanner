import { createClientComponentClient, createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { Database } from '../types/database'

export const createClient = () => {
  return createClientComponentClient<Database>()
}

export const createServerClient = async () => {
  const { cookies } = await import('next/headers')
  return createServerComponentClient<Database>({
    cookies,
  })
}

// Helper functions for common operations
export const supabaseHelpers = {
  // Get current user session
  async getCurrentUser() {
    const supabase = createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error) throw error
    return user
  },

  // Get user profile with role and permissions
  async getUserProfile(userId: string) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('users')
      .select(`
        *,
        locations:location_ids
      `)
      .eq('id', userId)
      .single()
    
    if (error) throw error
    return data
  },

  // Get audit sessions with statistics
  async getAuditSessions(locationIds?: number[]) {
    const supabase = createClient()
    let query = supabase
      .from('audit_sessions')
      .select(`
        *,
        location:locations(*),
        starter:users!audit_sessions_started_by_fkey(full_name, email),
        completer:users!audit_sessions_completed_by_fkey(full_name, email)
      `)
      .order('created_at', { ascending: false })

    if (locationIds && locationIds.length > 0) {
      query = query.in('location_id', locationIds)
    }

    const { data, error } = await query
    if (error) throw error
    return data
  },

  // Get real-time rack updates for dashboard
  async getRacksWithStats(auditSessionId: string) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('racks')
      .select(`
        *,
        scanner:users!racks_scanner_id_fkey(full_name, email),
        approver:users!racks_approved_by_fkey(full_name, email)
      `)
      .eq('audit_session_id', auditSessionId)
      .order('rack_number')

    if (error) throw error
    return data
  },

  // Get pending approvals for supervisors
  async getPendingApprovals(locationIds: number[]) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('racks')
      .select(`
        *,
        audit_session:audit_sessions(id, location_id),
        location:locations(name),
        scanner:users!racks_scanner_id_fkey(full_name, email)
      `)
      .eq('ready_for_approval', true)
      .in('location_id', locationIds)
      .order('ready_at', { ascending: true })

    if (error) throw error
    return data
  },

  // Approve or reject a rack
  async updateRackApproval(rackId: string, approved: boolean, reason?: string) {
    const supabase = createClient()
    const updates: any = {
      status: approved ? 'approved' : 'rejected',
      ready_for_approval: false,
    }

    if (approved) {
      updates.approved_at = new Date().toISOString()
      updates.approved_by = (await this.getCurrentUser())?.id
    } else {
      updates.rejected_at = new Date().toISOString()
      updates.rejected_by = (await this.getCurrentUser())?.id
      updates.rejection_reason = reason || 'No reason provided'
    }

    const { data, error } = await supabase
      .from('racks')
      .update(updates)
      .eq('id', rackId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Start new audit session
  async startAuditSession(locationId: number, rackCount: number) {
    const supabase = createClient()
    const user = await this.getCurrentUser()
    
    const { data, error } = await supabase
      .from('audit_sessions')
      .insert({
        location_id: locationId,
        total_rack_count: rackCount,
        status: 'active',
        started_by: user?.id,
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Complete audit session
  async completeAuditSession(sessionId: string) {
    const supabase = createClient()
    const user = await this.getCurrentUser()
    
    const { data, error } = await supabase
      .from('audit_sessions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        completed_by: user?.id,
      })
      .eq('id', sessionId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Get audit session statistics
  async getAuditSessionStats(sessionId: string) {
    const supabase = createClient()
    const { data, error } = await supabase
      .rpc('get_audit_session_stats', { p_audit_session_id: sessionId })

    if (error) throw error
    return data[0] // RPC returns array, we want the first (and only) result
  },

  // Get scan data for reports
  async getScanData(auditSessionId: string) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('scans')
      .select(`
        *,
        rack:racks(rack_number, shelf_number),
        scanner:users!scans_scanner_id_fkey(full_name, email)
      `)
      .eq('audit_session_id', auditSessionId)
      .order('created_at', { ascending: true })

    if (error) throw error
    return data
  },

  // Subscribe to real-time changes
  subscribeToRackChanges(auditSessionId: string, callback: (payload: any) => void) {
    const supabase = createClient()
    return supabase
      .channel('rack-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'racks',
          filter: `audit_session_id=eq.${auditSessionId}`,
        },
        callback
      )
      .subscribe()
  },

  subscribeToNotifications(userId: string, callback: (payload: any) => void) {
    const supabase = createClient()
    return supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        callback
      )
      .subscribe()
  },
}