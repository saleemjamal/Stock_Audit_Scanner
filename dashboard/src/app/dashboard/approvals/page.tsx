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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  useTheme,
  useMediaQuery,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Avatar,
  Stack,
} from '@mui/material'
import {
  CheckCircle,
  Cancel,
  Schedule,
  Person,
  LocationOn,
  Search,
  Visibility,
  Gavel,
  Warning,
  Add,
} from '@mui/icons-material'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import DamageApprovalPage from '@/components/damage/DamageApprovalPage'
import AddOnApprovalPage from '@/components/add-ons/AddOnApprovalPage'
import { useRouter, useSearchParams } from 'next/navigation'

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
  // Tab and user management
  const [currentTab, setCurrentTab] = useState(0)
  const [currentUser, setCurrentUser] = useState<any>(null)
  
  // Mobile responsiveness
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  
  // Rack approvals states
  const [pendingRacks, setPendingRacks] = useState<PendingRack[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [processingAction, setProcessingAction] = useState<string | null>(null)
  const [snackbar, setSnackbar] = useState({ 
    open: false, 
    message: '', 
    severity: 'success' as 'success' | 'error' 
  })
  const [rejectionDialog, setRejectionDialog] = useState({
    open: false,
    rackId: '',
    rackNumber: ''
  })
  const [rejectionReason, setRejectionReason] = useState('')
  
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    loadCurrentUser()
    loadPendingApprovals()
    
    // Handle URL tab parameter
    const tabParam = searchParams.get('tab')
    if (tabParam) {
      switch (tabParam) {
        case 'damage':
          setCurrentTab(1)
          break
        case 'add-ons':
          setCurrentTab(2)
          break
        default:
          setCurrentTab(0)
      }
    }
  }, [searchParams])

  const loadCurrentUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: userProfile } = await supabase
        .from('users')
        .select('*')
        .eq('email', session.user.email)
        .single()

      setCurrentUser(userProfile)
    } catch (error) {
      console.error('Error loading user:', error)
    }
  }

  // Tour code removed

  useEffect(() => {
    // Set up real-time subscription only after we know the active session
    const setupSubscription = async () => {
      const { data: activeSession } = await supabase
        .from('audit_sessions')
        .select('id')
        .eq('status', 'active')
        .single()

      if (!activeSession) return

      const subscription = supabase
        .channel('pending_approvals_page')
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'racks', 
            filter: `audit_session_id=eq.${activeSession.id}` 
          },
          () => loadPendingApprovals()
        )
        .subscribe()

      return () => {
        subscription.unsubscribe()
      }
    }

    setupSubscription()
  }, [])

  const loadPendingApprovals = async () => {
    try {
      setLoading(true)
      console.log('Loading pending approvals...')
      
      // First get the active audit session
      const { data: activeSession, error: sessionError } = await supabase
        .from('audit_sessions')
        .select('id')
        .eq('status', 'active')
        .single()

      if (sessionError || !activeSession) {
        console.log('No active audit session found')
        setPendingRacks([])
        setLoading(false)
        return
      }

      console.log('Active session ID:', activeSession.id)
      
      // Get current user profile for location access control
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data: userProfile } = await supabase
        .from('users')
        .select('role, location_ids')
        .eq('email', user.email)
        .single()

      console.log('User profile:', userProfile)

      // Build base query - filter by active session AND status
      let query = supabase
        .from('racks')
        .select('*')
        .eq('status', 'ready_for_approval')
        .eq('audit_session_id', activeSession.id)  // Only from current active session

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
      const locationIds = Array.from(new Set(racks.map(r => r.location_id)))
      const { data: locations } = await supabase
        .from('locations')
        .select('id, name')
        .in('id', locationIds)

      // Get scanner usernames  
      const scannerIds = Array.from(new Set(racks.map(r => r.scanner_id).filter(Boolean)))
      const { data: scanners } = await supabase
        .from('users')
        .select('id, username, email')
        .in('id', scannerIds)

      console.log('Locations:', locations?.length || 0)
      console.log('Scanners:', scanners?.length || 0)

      // Get scan counts for each rack
      const rackIds = racks.map(r => r.id)
      const { data: scans } = await supabase
        .from('scans')
        .select('rack_id')
        .in('rack_id', rackIds)
      
      // Count scans per rack
      const scanCountMap = new Map<string, number>()
      scans?.forEach(scan => {
        const count = scanCountMap.get(scan.rack_id) || 0
        scanCountMap.set(scan.rack_id, count + 1)
      })

      // Transform data
      const transformedRacks = racks.map(rack => {
        const location = locations?.find(l => l.id === rack.location_id)
        const scanner = scanners?.find(s => s.id === rack.scanner_id)
        
        return {
          id: rack.id,
          rack_number: rack.rack_number,
          location_name: location?.name || 'Unknown Location',
          scanner_username: scanner?.username || scanner?.email || 'Unknown Scanner',
          total_scans: scanCountMap.get(rack.id) || 0,
          completed_at: rack.completed_at || rack.created_at,
          status: rack.status,
        }
      })

      console.log('Transformed racks:', transformedRacks)
      setPendingRacks(transformedRacks)
    } catch (error: any) {
      console.error('Error loading pending approvals:', error)
      setSnackbar({ 
        open: true, 
        message: `Failed to load pending approvals: ${error.message || 'Unknown error'}`, 
        severity: 'error' 
      })
    } finally {
      setLoading(false)
    }
  }


  const handleViewDetails = (rack: PendingRack) => {
    router.push(`/dashboard/approvals/${rack.id}`)
  }

  const handleRackAction = async (rackId: string, action: 'approve') => {
    try {
      setProcessingAction(rackId)
      const timestamp = new Date().toISOString()
      
      const { error } = await supabase
        .from('racks')
        .update({ 
          status: 'approved',
          approved_at: timestamp,
        })
        .eq('id', rackId)

      if (error) throw error

      // Remove the rack from the list
      setPendingRacks(prev => prev.filter(rack => rack.id !== rackId))
      
      setSnackbar({ 
        open: true, 
        message: 'Rack approved successfully', 
        severity: 'success' 
      })
    } catch (error) {
      console.error('Error approving rack:', error)
      setSnackbar({ 
        open: true, 
        message: 'Failed to approve rack', 
        severity: 'error' 
      })
    } finally {
      setProcessingAction(null)
    }
  }

  const handleRejectClick = (rack: PendingRack) => {
    setRejectionDialog({
      open: true,
      rackId: rack.id,
      rackNumber: rack.rack_number
    })
    setRejectionReason('')
  }

  const handleRejectionWithReason = async () => {
    try {
      setProcessingAction(rejectionDialog.rackId)
      const timestamp = new Date().toISOString()
      
      const { error } = await supabase
        .from('racks')
        .update({ 
          status: 'rejected',
          rejection_reason: rejectionReason.trim(),
          rejected_at: timestamp,
        })
        .eq('id', rejectionDialog.rackId)

      if (error) throw error

      // Remove the rack from the list
      setPendingRacks(prev => prev.filter(rack => rack.id !== rejectionDialog.rackId))
      
      // Close dialog
      setRejectionDialog({ open: false, rackId: '', rackNumber: '' })
      setRejectionReason('')
      
      setSnackbar({ 
        open: true, 
        message: 'Rack rejected successfully', 
        severity: 'success' 
      })
    } catch (error) {
      console.error('Error rejecting rack:', error)
      setSnackbar({ 
        open: true, 
        message: 'Failed to reject rack', 
        severity: 'error' 
      })
    } finally {
      setProcessingAction(null)
    }
  }

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue)
  }

  const getTabsForUser = () => {
    const tabs = [
      { label: 'Racks', icon: <Gavel />, value: 0 }
    ]
    
    // Super users see all tabs
    if (currentUser?.role === 'superuser') {
      tabs.push(
        { label: 'Damage', icon: <Warning />, value: 1 },
        { label: 'Add-ons', icon: <Add />, value: 2 }
      )
    }
    
    return tabs
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

  const renderTabContent = () => {
    switch (currentTab) {
      case 0: // Racks tab
        return (
          <Box>
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

            {/* Racks Table/Cards */}
            <Card>
              <CardContent>
                {loading ? (
                  <Box display="flex" justifyContent="center" p={4}>
                    <CircularProgress />
                  </Box>
                ) : isMobile ? (
                  // Mobile Card View
                  <Box>
                    {filteredRacks.length === 0 ? (
                      <Box textAlign="center" py={4}>
                        <Typography variant="body2" color="text.secondary">
                          {searchTerm ? 'No racks match your search' : 'No pending approvals'}
                        </Typography>
                      </Box>
                    ) : (
                      <Stack spacing={2}>
                        {filteredRacks.map((rack) => (
                          <Card key={rack.id} variant="outlined" sx={{ p: 2 }}>
                            <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                              <Box>
                                <Typography variant="h6" fontWeight="bold" color="primary">
                                  Rack {rack.rack_number}
                                </Typography>
                                <Box display="flex" alignItems="center" gap={1} mt={0.5}>
                                  <Chip 
                                    label={rack.total_scans} 
                                    size="small" 
                                    color="primary" 
                                    variant="filled"
                                  />
                                  <Typography variant="caption" color="text.secondary">
                                    scans
                                  </Typography>
                                </Box>
                              </Box>
                              <Box display="flex" gap={1}>
                                <IconButton
                                  size="small"
                                  onClick={() => handleViewDetails(rack)}
                                  title="View details"
                                >
                                  <Visibility />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  color="success"
                                  onClick={() => handleRackAction(rack.id, 'approve')}
                                  disabled={processingAction === rack.id}
                                  title="Approve"
                                >
                                  {processingAction === rack.id ? (
                                    <CircularProgress size={16} />
                                  ) : (
                                    <CheckCircle />
                                  )}
                                </IconButton>
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => handleRejectClick(rack)}
                                  disabled={processingAction === rack.id}
                                  title="Reject"
                                >
                                  <Cancel />
                                </IconButton>
                              </Box>
                            </Box>
                            
                            <Box display="flex" flexDirection="column" gap={1}>
                              <Box display="flex" alignItems="center" gap={1}>
                                <LocationOn fontSize="small" color="action" />
                                <Typography variant="body2">
                                  {rack.location_name}
                                </Typography>
                              </Box>
                              <Box display="flex" alignItems="center" gap={1}>
                                <Person fontSize="small" color="action" />
                                <Typography variant="body2">
                                  {rack.scanner_username}
                                </Typography>
                              </Box>
                              <Box display="flex" alignItems="center" gap={1}>
                                <Schedule fontSize="small" color="action" />
                                <Typography variant="body2" color="text.secondary">
                                  {formatTimeAgo(rack.completed_at)}
                                </Typography>
                              </Box>
                            </Box>
                          </Card>
                        ))}
                      </Stack>
                    )}
                  </Box>
                ) : (
                  // Desktop Table View
                  <TableContainer component={Paper} elevation={0} sx={{ overflowX: 'auto' }}>
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
                                    onClick={() => handleRejectClick(rack)}
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
          </Box>
        )
      case 1: // Damage tab
        return <DamageApprovalPage />
      case 2: // Add-ons tab
        return <AddOnApprovalPage currentUser={currentUser} />
      default:
        return null
    }
  }

  if (!currentUser) {
    return (
      <DashboardLayout>
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
          <Box display="flex" justifyContent="center" p={4}>
            <CircularProgress />
          </Box>
        </Container>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Approvals
        </Typography>
        
        {/* Tabs */}
        <Card sx={{ mb: 3 }}>
          <Tabs 
            value={currentTab} 
            onChange={handleTabChange}
            variant="fullWidth"
            sx={{ 
              borderBottom: 1, 
              borderColor: 'divider',
              '& .MuiTab-root': {
                minHeight: 60,
                textTransform: 'none',
                fontSize: '1rem',
              }
            }}
          >
            {getTabsForUser().map((tab) => (
              <Tab 
                key={tab.value}
                label={tab.label}
                icon={tab.icon}
                iconPosition="start"
                value={tab.value}
              />
            ))}
          </Tabs>
        </Card>

        {/* Tab Content */}
        {renderTabContent()}


      {/* Rejection Dialog */}
      <Dialog 
        open={rejectionDialog.open} 
        onClose={() => setRejectionDialog({ open: false, rackId: '', rackNumber: '' })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Reject Rack {rejectionDialog.rackNumber}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Please specify what needs to be corrected so the scanner knows how to fix it.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            multiline
            rows={3}
            label="Rejection Reason"
            placeholder="e.g., Missing items from back shelf, incorrect quantities, damaged items not noted..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            required
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectionDialog({ open: false, rackId: '', rackNumber: '' })}>
            Cancel
          </Button>
          <Button 
            onClick={handleRejectionWithReason}
            color="error" 
            variant="contained"
            disabled={!rejectionReason.trim()}
          >
            Reject Rack
          </Button>
        </DialogActions>
      </Dialog>

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