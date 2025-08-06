'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Container,
  Alert,
  CircularProgress,
} from '@mui/material'
import { Google as GoogleIcon } from '@mui/icons-material'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true)
      setError(null)

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        throw error
      }
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Card sx={{ width: '100%', maxWidth: 400 }}>
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <Typography variant="h4" component="h1" gutterBottom>
                Stock Audit Dashboard
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Sign in to manage inventory audits
              </Typography>
            </Box>

            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            <Button
              fullWidth
              variant="contained"
              size="large"
              startIcon={loading ? <CircularProgress size={20} /> : <GoogleIcon />}
              onClick={handleGoogleSignIn}
              disabled={loading}
              sx={{ py: 1.5 }}
            >
              {loading ? 'Signing in...' : 'Sign in with Google'}
            </Button>

            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 3, textAlign: 'center' }}
            >
              Only supervisors and administrators can access the dashboard.
              <br />
              Scanners should use the mobile app.
            </Typography>
          </CardContent>
        </Card>
      </Box>
    </Container>
  )
}