import { serve } from "https://deno.land/std/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const authHeader = req.headers.get("Authorization") || ""
    
    if (!authHeader.startsWith("Bearer ")) {
      return new Response("Missing bearer token", { status: 401 })
    }
    
    const userAccessToken = authHeader.replace("Bearer ", "").trim()
    const userClient = createClient(supabaseUrl, userAccessToken)
    const { data: user } = await userClient.auth.getUser()
    
    if (!user?.user) {
      return new Response("Invalid user token", { status: 401 })
    }
    
    const admin = createClient(supabaseUrl, serviceRoleKey, { 
      auth: { autoRefreshToken: false, persistSession: false } 
    })
    
    // List all sessions and revoke all except the newest
    const { data: sessions, error } = await admin.auth.admin.listUserSessions({ 
      user_id: user.user.id 
    })
    
    if (error) {
      console.error('Error listing sessions:', error)
      return new Response(`Error listing sessions: ${error.message}`, { status: 500 })
    }
    
    const allSessions = sessions?.sessions ?? []
    
    // Sort sessions by creation date (newest first)
    const sorted = allSessions.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    
    // Keep the newest session, revoke all others
    const keep = sorted[0]?.id
    const toRevoke = sorted.filter(s => s.id !== keep).map(s => s.id)
    
    if (toRevoke.length > 0) {
      const { error: revokeError } = await admin.auth.admin.revokeSessions({ 
        session_ids: toRevoke 
      })
      
      if (revokeError) {
        console.error('Error revoking sessions:', revokeError)
        return new Response(`Error revoking sessions: ${revokeError.message}`, { status: 500 })
      }
    }
    
    return new Response(JSON.stringify({ 
      success: true,
      kept_session: keep,
      revoked_count: toRevoke.length,
      total_sessions: allSessions.length
    }), {
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
      status: 200
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(`Internal server error: ${error.message}`, { status: 500 })
  }
})