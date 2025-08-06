import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Config from 'react-native-config';

const supabaseUrl = Config.SUPABASE_URL || '';
const supabaseAnonKey = Config.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Helper functions for common database operations
export const supabaseHelpers = {
  // Get current user
  async getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  },

  // Get user profile
  async getUserProfile(userId: string) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) throw error;
    return data;
  },

  // Get locations for user
  async getUserLocations(userId: string) {
    const profile = await this.getUserProfile(userId);
    
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .in('id', profile.location_ids)
      .eq('active', true);
    
    if (error) throw error;
    return data;
  },

  // Get active audit session for location
  async getActiveAuditSession(locationId: number) {
    const { data, error } = await supabase
      .from('audit_sessions')
      .select('*')
      .eq('location_id', locationId)
      .eq('status', 'active')
      .single();
    
    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
    return data;
  },

  // Get available racks for audit session
  async getAvailableRacks(auditSessionId: string) {
    const { data, error } = await supabase
      .from('racks')
      .select('*')
      .eq('audit_session_id', auditSessionId)
      .eq('status', 'available')
      .order('rack_number');
    
    if (error) throw error;
    return data;
  },

  // Get user's assigned racks
  async getUserRacks(auditSessionId: string, userId: string) {
    const { data, error } = await supabase
      .from('racks')
      .select('*')
      .eq('audit_session_id', auditSessionId)
      .eq('scanner_id', userId)
      .order('assigned_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  // Assign rack to user
  async assignRack(rackId: string, userId: string) {
    const { data, error } = await supabase
      .from('racks')
      .update({
        status: 'assigned',
        scanner_id: userId,
        assigned_at: new Date().toISOString(),
      })
      .eq('id', rackId)
      .eq('status', 'available') // Only assign if still available
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Add scan to database
  async addScan(scanData: {
    barcode: string;
    rack_id: string;
    audit_session_id: string;
    scanner_id: string;
    device_id?: string;
    quantity?: number;
    manual_entry?: boolean;
    notes?: string;
  }) {
    const { data, error } = await supabase
      .from('scans')
      .insert(scanData)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Mark rack as ready for approval
  async markRackReady(rackId: string) {
    const { data, error } = await supabase
      .from('racks')
      .update({
        status: 'ready_for_approval',
        ready_for_approval: true,
      })
      .eq('id', rackId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Get rack scans
  async getRackScans(rackId: string) {
    const { data, error } = await supabase
      .from('scans')
      .select('*')
      .eq('rack_id', rackId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  // Get notifications for user
  async getNotifications(userId: string) {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('read', false)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  // Mark notification as read
  async markNotificationRead(notificationId: string) {
    const { data, error } = await supabase
      .from('notifications')
      .update({ 
        read: true, 
        read_at: new Date().toISOString() 
      })
      .eq('id', notificationId);
    
    if (error) throw error;
    return data;
  },

  // Subscribe to real-time changes
  subscribeToRacks(auditSessionId: string, callback: (payload: any) => void) {
    return supabase
      .channel('racks-changes')
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
      .subscribe();
  },

  subscribeToNotifications(userId: string, callback: (payload: any) => void) {
    return supabase
      .channel('notifications-changes')
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
      .subscribe();
  },
};