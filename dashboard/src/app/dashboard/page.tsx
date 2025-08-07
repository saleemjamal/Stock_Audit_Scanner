'use client'

import { Suspense, useEffect, useState } from 'react'
import { Box, Grid, Typography, Card, CardContent, CircularProgress } from '@mui/material'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import AuditOverview from '@/components/AuditOverview'
import RecentActivity from '@/components/RecentActivity'
import PendingApprovals from '@/components/PendingApprovals'
import LocationStats from '@/components/LocationStats'

export default function DashboardPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check if user is logged in using our custom auth
    const userData = localStorage.getItem('currentUser')
    
    if (!userData) {
      router.push('/auth/login')
      return
    }

    try {
      const user = JSON.parse(userData)
      
      // Allow supervisors and superusers only (block scanners)
      if (user.role === 'scanner') {
        router.push('/auth/login?error=insufficient_permissions')
        return
      }

      setCurrentUser(user)
    } catch (error) {
      console.error('Error parsing user data:', error)
      router.push('/auth/login')
      return
    } finally {
      setIsLoading(false)
    }
  }, [router])

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