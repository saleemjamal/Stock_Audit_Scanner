'use client'

import { Suspense, useEffect, useState } from 'react'
import { Box, Grid, Typography, Card, CardContent, CircularProgress } from '@mui/material'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import AuditOverview from '@/components/AuditOverview'
import RecentActivity from '@/components/RecentActivity'
import PendingApprovals from '@/components/PendingApprovals'
import LocationStats from '@/components/LocationStats'

export default function DashboardPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    checkAuth()
  }, [])

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

      // Allow supervisors and superusers only (block scanners)
      if (userProfile.role === 'scanner') {
        await supabase.auth.signOut()
        router.push('/auth/login?error=insufficient_permissions')
        return
      }

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
        
        <Grid container spacing={3}>
          {/* Main Stats */}
          <Grid item xs={12}>
            <Suspense fallback={<CircularProgress />}>
              <AuditOverview />
            </Suspense>
          </Grid>

          {/* Location Stats */}
          <Grid item xs={12} md={8}>
            <Suspense fallback={<CircularProgress />}>
              <LocationStats />
            </Suspense>
          </Grid>

          {/* Pending Approvals */}
          <Grid item xs={12} md={4}>
            <Suspense fallback={<CircularProgress />}>
              <PendingApprovals />
            </Suspense>
          </Grid>

          {/* Recent Activity */}
          <Grid item xs={12}>
            <Suspense fallback={<CircularProgress />}>
              <RecentActivity />
            </Suspense>
          </Grid>
        </Grid>
      </Box>
    </DashboardLayout>
  )
}