'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { Container, Typography, Box, CircularProgress } from '@mui/material'

export default function AddOnApprovalsPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to unified approvals page with add-ons tab
    router.replace('/dashboard/approvals?tab=add-ons')
  }, [router])

  return (
    <DashboardLayout>
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
          <CircularProgress />
          <Typography color="text.secondary">
            Redirecting to unified approvals page...
          </Typography>
        </Box>
      </Container>
    </DashboardLayout>
  )
}