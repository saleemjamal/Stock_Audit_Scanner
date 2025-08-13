'use client'

import { useEffect, useState } from 'react'
import {
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Alert,
  Snackbar,
  TextField,
  InputAdornment,
  CircularProgress,
} from '@mui/material'
import {
  CheckCircle,
  Cancel,
  Schedule,
  Person,
  LocationOn,
  Search,
  Visibility,
} from '@mui/icons-material'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { useRouter } from 'next/navigation'

interface PendingRack {
  id: string
  rack_number: string
  location_name: string
  scanner_username: string
  total_scans: number
  completed_at: string
  status: string
}


export default function ApprovalsPage() {
  const [pendingRacks, setPendingRacks] = useState<PendingRack[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [processingAction, setProcessingAction] = useState<string | null>(null)
  const [snackbar, setSnackbar] = useState({ 
    open: false, 
    message: '', 
    severity: 'success' as 'success' | 'error' 
  })
  
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    loadPendingApprovals()
    
    // Set up real-time subscription for rack status changes
    const subscription = supabase
      .channel('pending_approvals_page')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'racks', filter: 'status=eq.ready_for_approval' },
        () => loadPendingApprovals()
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const loadPendingApprovals = async () => {
    try {
      setLoading(true)
      console.log('Loading pending approvals...')
      
      // Get current user profile for location access control
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data: userProfile } = await supabase
        .from('users')
        .select('role, location_ids')
        .eq('email', user.email)
        .single()

      console.log('User profile:', userProfile)

      // First, let's check all racks to see their statuses
      const { data: allRacks, error: testError } = await supabase
        .from('racks')
        .select('status')
      
      if (testError) {
        console.error('Test query error:', testError)
      } else {
        console.log('All rack statuses:', [...new Set(allRacks?.map(r => r.status) || [])])
      }

      // Build base query - simplified to avoid field name issues
      let query = supabase
        .from('racks')
        .select('*')
        .eq('status', 'ready_for_approval')

      // Apply location filtering for supervisors
      if (userProfile?.role === 'supervisor' && userProfile?.location_ids?.length > 0) {
        query = query.in('location_id', userProfile.location_ids)
      }
      // Super users see all locations (no additional filter)

      const { data: racks, error } = await query

      if (error) {
        console.error('Query error:', error)
        throw error
      }
      console.log('Racks found:', racks?.length || 0)
      console.log('Raw racks data:', racks)

      if (!racks || racks.length === 0) {
        setPendingRacks([])
        return
      }

      // Get location names
      const locationIds = [...new Set(racks.map(r => r.location_id))]
      const { data: locations } = await supabase
        .from('locations')
        .select('id, name')
        .in('id', locationIds)

      // Get scanner usernames  
      const scannerIds = [...new Set(racks.map(r => r.scanner_id).filter(Boolean))]
      const { data: scanners } = await supabase
        .from('users')
        .select('id, username, email')
        .in('id', scannerIds)

      console.log('Locations:', locations?.length || 0)
      console.log('Scanners:', scanners?.length || 0)

      // Transform data
      const transformedRacks = racks.map(rack => {
        const location = locations?.find(l => l.id === rack.location_id)
        const scanner = scanners?.find(s => s.id === rack.scanner_id)
        
        return {
          id: rack.id,
          rack_number: rack.rack_number,
          location_name: location?.name || 'Unknown Location',
          scanner_username: scanner?.username || scanner?.email || 'Unknown Scanner',
          total_scans: rack.total_scans || 0,
          completed_at: rack.completed_at || rack.created_at,
          status: rack.status,
        }
      })

      console.log('Transformed racks:', transformedRacks)
      setPendingRacks(transformedRacks)
    } catch (error) {
      console.error('Error loading pending approvals:', error)
      setSnackbar({ 
        open: true, 
        message: `Failed to load pending approvals: ${error.message}`, 
        severity: 'error' 
      })
    } finally {
      setLoading(false)
    }
  }


  const handleViewDetails = (rack: PendingRack) => {
    router.push(`/dashboard/approvals/${rack.id}`)
  }

  const handleRackAction = async (rackId: string, action: 'approve' | 'reject') => {
    try {
      setProcessingAction(rackId)
      const newStatus = action === 'approve' ? 'approved' : 'rejected'
      const timestamp = new Date().toISOString()
      
      const { error } = await supabase
        .from('racks')
        .update({ 
          status: newStatus,
          approved_at: action === 'approve' ? timestamp : null,
          rejected_at: action === 'reject' ? timestamp : null,
        })
        .eq('id', rackId)

      if (error) throw error

      // Remove the rack from the list
      setPendingRacks(prev => prev.filter(rack => rack.id !== rackId))
      
      setSnackbar({ 
        open: true, 
        message: `Rack ${action}d successfully`, 
        severity: 'success' 
      })
    } catch (error) {
      console.error(`Error ${action}ing rack:`, error)
      setSnackbar({ 
        open: true, 
        message: `Failed to ${action} rack`, 
        severity: 'error' 
      })
    } finally {
      setProcessingAction(null)
    }
  }

  const filteredRacks = pendingRacks.filter(rack =>
    rack.rack_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rack.location_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rack.scanner_username.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const formatTimeAgo = (dateString: string) => {
    const now = new Date()
    const date = new Date(dateString)
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes} min ago`
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)} hr ago`
    } else {
      return `${Math.floor(diffInMinutes / 1440)} days ago`
    }
  }

  return (
    <DashboardLayout>
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Pending Approvals
        </Typography>
      
      <Typography variant="body1" color="text.secondary" paragraph>
        Review and approve rack scans submitted by scanners. Each rack must be individually reviewed.
      </Typography>

      {/* Search */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <TextField
            fullWidth
            placeholder="Search by rack number, location, or scanner..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
          />
        </CardContent>
      </Card>

      {/* Racks Table */}
      <Card>
        <CardContent>
          {loading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer component={Paper} elevation={0}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Rack Number</TableCell>
                    <TableCell>Location</TableCell>
                    <TableCell>Scanner</TableCell>
                    <TableCell align="center">Total Scans</TableCell>
                    <TableCell>Submitted</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredRacks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                        <Typography variant="body2" color="text.secondary">
                          {searchTerm ? 'No racks match your search' : 'No pending approvals'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRacks.map((rack) => (
                      <TableRow key={rack.id} hover>
                        <TableCell>
                          <Typography variant="subtitle2" fontWeight="bold">
                            {rack.rack_number}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={1}>
                            <LocationOn fontSize="small" color="action" />
                            {rack.location_name}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={1}>
                            <Person fontSize="small" color="action" />
                            {rack.scanner_username}
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          <Chip 
                            label={rack.total_scans} 
                            size="small" 
                            color="primary" 
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={1}>
                            <Schedule fontSize="small" color="action" />
                            {formatTimeAgo(rack.completed_at)}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box display="flex" gap={1} justifyContent="center">
                            <IconButton
                              size="small"
                              onClick={() => handleViewDetails(rack)}
                              title="View scan details"
                            >
                              <Visibility />
                            </IconButton>
                            <IconButton
                              size="small"
                              color="success"
                              onClick={() => handleRackAction(rack.id, 'approve')}
                              disabled={processingAction === rack.id}
                              title="Approve rack"
                            >
                              {processingAction === rack.id ? (
                                <CircularProgress size={20} />
                              ) : (
                                <CheckCircle />
                              )}
                            </IconButton>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleRackAction(rack.id, 'reject')}
                              disabled={processingAction === rack.id}
                              title="Reject rack"
                            >
                              <Cancel />
                            </IconButton>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>


      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert 
          severity={snackbar.severity} 
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
    </DashboardLayout>
  )
}