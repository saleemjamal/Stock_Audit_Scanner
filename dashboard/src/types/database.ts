// This file should be generated using: supabase gen types typescript --local > types/database.ts
// For now, we'll create a basic interface to prevent TypeScript errors

export interface Database {
  public: {
    Tables: {
      locations: {
        Row: {
          id: number
          name: string
          address: string | null
          city: string | null
          state: string | null
          zip_code: string | null
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          name: string
          address?: string | null
          city?: string | null
          state?: string | null
          zip_code?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          name?: string
          address?: string | null
          city?: string | null
          state?: string | null
          zip_code?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      users: {
        Row: {
          id: string
          email: string
          full_name: string | null
          role: string
          location_ids: number[]
          device_id: string | null
          active: boolean
          last_login: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          role?: string
          location_ids?: number[]
          device_id?: string | null
          active?: boolean
          last_login?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          role?: string
          location_ids?: number[]
          device_id?: string | null
          active?: boolean
          last_login?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      audit_sessions: {
        Row: {
          id: string
          location_id: number
          total_rack_count: number
          status: string
          started_at: string | null
          started_by: string | null
          completed_at: string | null
          completed_by: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          location_id: number
          total_rack_count: number
          status?: string
          started_at?: string | null
          started_by?: string | null
          completed_at?: string | null
          completed_by?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          location_id?: number
          total_rack_count?: number
          status?: string
          started_at?: string | null
          started_by?: string | null
          completed_at?: string | null
          completed_by?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      racks: {
        Row: {
          id: string
          audit_session_id: string
          location_id: number
          rack_number: string
          shelf_number: string | null
          status: string
          scanner_id: string | null
          assigned_at: string | null
          ready_for_approval: boolean
          ready_at: string | null
          approved_by: string | null
          approved_at: string | null
          rejected_by: string | null
          rejected_at: string | null
          rejection_reason: string | null
          total_scans: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          audit_session_id: string
          location_id: number
          rack_number: string
          shelf_number?: string | null
          status?: string
          scanner_id?: string | null
          assigned_at?: string | null
          ready_for_approval?: boolean
          ready_at?: string | null
          approved_by?: string | null
          approved_at?: string | null
          rejected_by?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          total_scans?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          audit_session_id?: string
          location_id?: number
          rack_number?: string
          shelf_number?: string | null
          status?: string
          scanner_id?: string | null
          assigned_at?: string | null
          ready_for_approval?: boolean
          ready_at?: string | null
          approved_by?: string | null
          approved_at?: string | null
          rejected_by?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          total_scans?: number
          created_at?: string
          updated_at?: string
        }
      }
      scans: {
        Row: {
          id: string
          barcode: string
          rack_id: string
          audit_session_id: string
          scanner_id: string
          device_id: string | null
          quantity: number
          is_recount: boolean
          recount_of: string | null
          manual_entry: boolean
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          barcode: string
          rack_id: string
          audit_session_id: string
          scanner_id: string
          device_id?: string | null
          quantity?: number
          is_recount?: boolean
          recount_of?: string | null
          manual_entry?: boolean
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          barcode?: string
          rack_id?: string
          audit_session_id?: string
          scanner_id?: string
          device_id?: string | null
          quantity?: number
          is_recount?: boolean
          recount_of?: string | null
          manual_entry?: boolean
          notes?: string | null
          created_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: string
          title: string
          message: string | null
          rack_id: string | null
          audit_session_id: string | null
          read: boolean
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          title: string
          message?: string | null
          rack_id?: string | null
          audit_session_id?: string | null
          read?: boolean
          read_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          title?: string
          message?: string | null
          rack_id?: string | null
          audit_session_id?: string | null
          read?: boolean
          read_at?: string | null
          created_at?: string
        }
      }
      audit_log: {
        Row: {
          id: string
          user_id: string | null
          action: string
          entity_type: string
          entity_id: string | null
          old_values: any | null
          new_values: any | null
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          action: string
          entity_type: string
          entity_id?: string | null
          old_values?: any | null
          new_values?: any | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          action?: string
          entity_type?: string
          entity_id?: string | null
          old_values?: any | null
          new_values?: any | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
      }
      sync_queue: {
        Row: {
          id: string
          device_id: string
          data_type: string
          payload: any
          status: string
          retry_count: number
          error_message: string | null
          created_at: string
          processed_at: string | null
        }
        Insert: {
          id?: string
          device_id: string
          data_type: string
          payload: any
          status?: string
          retry_count?: number
          error_message?: string | null
          created_at?: string
          processed_at?: string | null
        }
        Update: {
          id?: string
          device_id?: string
          data_type?: string
          payload?: any
          status?: string
          retry_count?: number
          error_message?: string | null
          created_at?: string
          processed_at?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_audit_session_stats: {
        Args: {
          p_audit_session_id: string
        }
        Returns: {
          total_racks: number
          available_racks: number
          assigned_racks: number
          ready_racks: number
          approved_racks: number
          rejected_racks: number
          total_scans: number
        }[]
      }
      user_can_access_location: {
        Args: {
          user_id: string
          location_id: number
        }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}