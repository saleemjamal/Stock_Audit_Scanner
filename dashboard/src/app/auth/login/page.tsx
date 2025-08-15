'use client'

import { useState, useEffect } from 'react'
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
  Divider,
} from '@mui/material'
import { Google as GoogleIcon } from '@mui/icons-material'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  // Check if user is already authenticated and handle URL params
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.push('/dashboard')
      }
    }
    
    // Check for error in URL params
    const urlParams = new URLSearchParams(window.location.search)
    const errorParam = urlParams.get('error')
    if (errorParam === 'user_not_in_system') {
      setError('Your Google account is not authorized for this system. Only pre-approved users can access the dashboard. Please contact a system administrator (saleem@poppatjamals.com) to be added to the authorized user list.')
    } else if (errorParam === 'insufficient_permissions') {
      setError('Access denied. You do not have permission to access this page.')
    }
    
    checkAuth()
  }, [router, supabase])

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`
        }
      })

      if (error) {
        throw error
      }

      // OAuth will redirect automatically, but just in case:
      if (data.url) {
        window.location.href = data.url
      }
    } catch (error: any) {
      console.error('Google sign in error:', error)
      setError(error.message || 'Failed to sign in with Google')
      setLoading(false)
    }
  }

  const handleTestSignIn = async (email: string) => {
    try {
      setLoading(true)
      setError(null)

      // For testing - check if user exists in our system
      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single()

      if (profileError) {
        throw new Error(`User ${email} not found in system. This email would be denied access - only pre-authorized users can sign in.`)
      }

      // All roles can access the dashboard (scanners can use web scanning feature)
      // Role-based restrictions are handled within individual pages

      setError(`✅ Test user ${email} found with role: ${userProfile.role}. This user would be granted dashboard access. Use Google Sign-in above to authenticate.`)
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
                Sign in with Google to manage inventory audits
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontStyle: 'italic' }}>
                Only pre-authorized users can access this system
              </Typography>
            </Box>

            {error && (
              <Alert 
                severity={error.includes('found with role') ? 'info' : 'error'} 
                sx={{ mb: 3 }}
              >
                {error}
              </Alert>
            )}

            {/* Google Sign In Button */}
            <Button
              fullWidth
              variant="contained"
              size="large"
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <GoogleIcon />}
              onClick={handleGoogleSignIn}
              disabled={loading}
              sx={{ 
                mt: 2, 
                mb: 3, 
                py: 1.5,
                backgroundColor: '#4285f4',
                '&:hover': {
                  backgroundColor: '#357ae8',
                },
                '&:disabled': {
                  backgroundColor: '#cccccc',
                }
              }}
            >
              {loading ? 'Signing in...' : 'Sign in with Google'}
            </Button>

            <Divider sx={{ my: 3 }}>
              <Typography variant="body2" color="text.secondary">
                Development Testing
              </Typography>
            </Divider>

            {/* Test User Buttons */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Button
                variant="outlined"
                size="small"
                onClick={() => handleTestSignIn('saleem@poppatjamals.com')}
                disabled={loading}
              >
                Test: Saleem (Superuser)
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={() => handleTestSignIn('supervisor1@poppatjamals.com')}
                disabled={loading}
              >
                Test: Supervisor 1
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={() => handleTestSignIn('scanner1@poppatjamals.com')}
                disabled={loading}
              >
                Test: Scanner 1
              </Button>
            </Box>

            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 3, textAlign: 'center' }}
            >
              <strong>Access Policy:</strong>
              <br />
              • Only pre-authorized users can sign in
              <br />
              • All roles can access the web dashboard
              <br />
              • Role-specific features are restricted within the app
            </Typography>
          </CardContent>
        </Card>
      </Box>
    </Container>
  )
}