import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Config from 'react-native-config';

const supabaseUrl = Config?.SUPABASE_URL || 'https://lgiljudekiobysjsuepo.supabase.co';
const supabaseAnonKey = Config?.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxnaWxqdWRla2lvYnlzanN1ZXBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzMDMxODYsImV4cCI6MjA2OTg3OTE4Nn0.kFv_SZ71_ryWvlowbvBb9sWc2wPXmyLChZbijMfgQZM';

console.log('Supabase Config:', { 
  hasUrl: !!supabaseUrl, 
  hasKey: !!supabaseAnonKey,
  configObject: Config
});

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
  global: {
    fetch: (url: RequestInfo | URL, options: RequestInit = {}) => {
      // Add timeout to all Supabase fetch requests
      const timeoutMs = 15000; // 15 second timeout to allow for slow network
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log('🚨 Supabase fetch timeout after', timeoutMs, 'ms for URL:', url);
        controller.abort();
      }, timeoutMs);

      console.log('🌐 Supabase fetch starting for:', url);
      const startTime = Date.now();

      return fetch(url, {
        ...options,
        signal: controller.signal,
      }).then(response => {
        clearTimeout(timeoutId);
        const elapsed = Date.now() - startTime;
        console.log(`✅ Supabase fetch completed in ${elapsed}ms for:`, url);
        return response;
      }).catch(error => {
        clearTimeout(timeoutId);
        const elapsed = Date.now() - startTime;
        console.error(`❌ Supabase fetch failed after ${elapsed}ms:`, error.message);
        throw error;
      });
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

  // Test Supabase connection
  async testConnection() {
    console.log('🏥 SupabaseHelper: Testing connection...');
    console.log('🏥 Supabase URL:', supabaseUrl);
    console.log('🏥 Supabase Key length:', supabaseAnonKey?.length || 0);
    
    const start = Date.now();
    
    try {
      console.log('🏥 Making test query to locations table...');
      const { data, error } = await supabase
        .from('locations')
        .select('id')
        .limit(1);
      
      const elapsed = Date.now() - start;
      
      if (error) {
        console.error(`🏥 SupabaseHelper: Connection test failed in ${elapsed}ms:`, {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
        throw error;
      }
      
      console.log(`🏥 SupabaseHelper: Connection test successful in ${elapsed}ms, found ${data?.length || 0} locations`);
      return true;
    } catch (error: any) {
      const elapsed = Date.now() - start;
      console.error(`🏥 SupabaseHelper: Connection test failed in ${elapsed}ms:`, {
        message: error.message,
        stack: error.stack?.substring(0, 200),
        name: error.name
      });
      throw error;
    }
  },

  // Get user profile
  async getUserProfile(userId: string) {
    console.log('👤 SupabaseHelper: Getting user profile for:', userId);
    const start = Date.now();
    
    const queryPromise = supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
      
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('getUserProfile query timeout')), 5000);
    });
    
    const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as any;
    
    const elapsed = Date.now() - start;
    
    if (error) {
      console.error(`👤 SupabaseHelper: getUserProfile failed in ${elapsed}ms:`, error);
      throw error;
    }
    
    console.log(`👤 SupabaseHelper: getUserProfile successful in ${elapsed}ms:`, {
      hasData: !!data,
      hasLocationIds: !!(data?.location_ids),
      locationIdsCount: data?.location_ids?.length || 0
    });
    
    return data;
  },

  // Get locations for user
  async getUserLocations(userId: string) {
    console.log('📍 SupabaseHelper: Getting locations for user:', userId);
    const overallStart = Date.now();
    
    try {
      // Step 1: Get user profile
      console.log('📍 Step 1: Getting user profile...');
      const profileStart = Date.now();
      const profile = await this.getUserProfile(userId);
      console.log(`📍 Step 1 completed in ${Date.now() - profileStart}ms`);
      
      if (!profile.location_ids || profile.location_ids.length === 0) {
        console.warn('📍 User has no location_ids assigned');
        return [];
      }
      
      // Step 2: Get locations
      console.log('📍 Step 2: Getting locations for IDs:', profile.location_ids);
      const locationsStart = Date.now();
      
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .in('id', profile.location_ids)
        .eq('active', true);
      
      const locationsElapsed = Date.now() - locationsStart;
      
      if (error) {
        console.error(`📍 Step 2 failed in ${locationsElapsed}ms:`, error);
        throw error;
      }
      
      const totalElapsed = Date.now() - overallStart;
      console.log(`📍 getUserLocations completed successfully in ${totalElapsed}ms:`, {
        locationsFound: data?.length || 0,
        locations: data?.map(l => ({ id: l.id, name: l.name })) || []
      });
      
      return data;
    } catch (error) {
      const totalElapsed = Date.now() - overallStart;
      console.error(`📍 getUserLocations failed in ${totalElapsed}ms:`, error);
      throw error;
    }
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