'use client'

import { Suspense, useEffect, useState } from 'react'
import { Box, Grid, Typography, Card, CardContent, CircularProgress } from '@mui/material'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import KPIOverview from '@/components/KPIOverview'
import RackMap from '@/components/RackMap'
import ScannerStatus from '@/components/ScannerStatus'
import PendingApprovals from '@/components/PendingApprovals'

export default function DashboardPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    checkAuth()
  }, [])

  const enforceSessionSingleton = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/single-session-login`, {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        })
        
        const result = await response.json()
        console.log('Session cleanup:', result)
      }
    } catch (error) {
      console.warn('Session cleanup failed:', error)
      // Continue anyway - not critical for functionality
    }
  }

  const checkAuth = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error) throw error
      
      if (!session) {
        router.push('/auth/login')
        return
      }

      // Get user profile by email (Google OAuth uses email)
      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('email', session.user.email)
        .single()

      if (profileError) {
        console.error('Error loading user profile:', profileError)
        // If user doesn't exist, they need to be added to the system
        if (profileError.code === 'PGRST116') {
          router.push('/auth/login?error=user_not_in_system')
        } else {
          router.push('/auth/login')
        }
        return
      }

      // All authenticated users can access the dashboard
      // Scanners can use the web scanning feature
      // Role-based restrictions are handled in individual features

      // Enforce single session - revoke other sessions
      await enforceSessionSingleton()

      setCurrentUser(userProfile)
    } catch (error) {
      console.error('Auth check error:', error)
      router.push('/auth/login')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!currentUser) {
    return null // Will redirect in useEffect
  }

  return (
    <DashboardLayout>
      <Box sx={{ flexGrow: 1, p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Dashboard Overview
        </Typography>
        
        {/* Streamlined KPI Bar */}
        <Box sx={{ mb: 3 }}>
          <Suspense fallback={<CircularProgress />}>
            <KPIOverview />
          </Suspense>
        </Box>

        <Grid container spacing={3}>
          {/* Action Row - Scanner Status and Pending Approvals */}
          <Grid item xs={12} lg={6}>
            <Suspense fallback={<CircularProgress />}>
              <ScannerStatus />
            </Suspense>
          </Grid>
          
          <Grid item xs={12} lg={6}>
            <Suspense fallback={<CircularProgress />}>
              <PendingApprovals />
            </Suspense>
          </Grid>

          {/* Rack Map - Full Width Below */}
          <Grid item xs={12}>
            <Suspense fallback={<CircularProgress />}>
              <RackMap />
            </Suspense>
          </Grid>
        </Grid>
      </Box>
    </DashboardLayout>
  )
}