import { Suspense } from 'react'
import { Box, Grid, Typography, Card, CardContent, CircularProgress } from '@mui/material'
import { createServerClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import AuditOverview from '@/components/AuditOverview'
import RecentActivity from '@/components/RecentActivity'
import PendingApprovals from '@/components/PendingApprovals'
import LocationStats from '@/components/LocationStats'

export default async function DashboardPage() {
  const supabase = await createServerClient()
  
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect('/auth/login')
  }

  // Get user profile to check role
  const { data: userProfile } = await supabase
    .from('users')
    .select('*')
    .eq('id', session.user.id)
    .single()

  if (!userProfile || userProfile.role === 'scanner') {
    redirect('/auth/login?error=insufficient_permissions')
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