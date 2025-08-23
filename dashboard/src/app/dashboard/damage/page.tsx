'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Box, CircularProgress, Alert } from '@mui/material'
import DashboardLayout from '@/components/DashboardLayout'
import DamageReportingPage from '@/components/damage/DamageReportingPage'

export default function DamagePage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkUserAccess()
  }, [])

  const checkUserAccess = async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError
      if (!user) {
        router.push('/auth/login')
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('email', user.email)
        .single()
      
      if (profileError) throw profileError
      
      // Check if user has supervisor+ access
      if (!['supervisor', 'superuser'].includes(profile.role)) {
        setError('Access denied. Damage reporting is only available to supervisors and super users.')
        return
      }

      setUser(profile)
    } catch (err: any) {
      console.error('Error checking user access:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Tour code removed

  if (loading) {
    return (
      <DashboardLayout>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
          <CircularProgress />
        </Box>
      </DashboardLayout>
    )
  }

  if (error) {
    return (
      <DashboardLayout>
        <Box p={3}>
          <Alert severity="error">{error}</Alert>
        </Box>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <DamageReportingPage />
    </DashboardLayout>
  )
}