'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Container,
  Typography,
  Card,
  CardContent,
  Grid,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Alert,
  CircularProgress,
  Chip,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
} from '@mui/material'
import {
  QrCodeScanner,
  LocationOn,
  Assignment,
  CheckCircle,
  ArrowBack,
  Warning as WarningIcon,
} from '@mui/icons-material'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import WebScanner from '@/components/WebScanner'
import PersonalStatsBar from '@/components/PersonalStatsBar'

interface Location {
  id: number
  name: string
  city: string
  state: string
}

interface Rack {
  id: string
  rack_number: string
  status: 'available' | 'assigned' | 'ready_for_approval' | 'approved' | 'rejected'
  scanner_id?: string
  location_id: number
  rejection_reason?: string
  original_scanner?: {
    id: string
    username?: string
    email: string
  }
}

interface AuditSession {
  id: string
  location_id: number
  status: 'active' | 'completed'
  shortname?: string
}

export default function ScanningPage() {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [locations, setLocations] = useState<Location[]>([])
  const [selectedLocation, setSelectedLocation] = useState<number | null>(null)
  const [racks, setRacks] = useState<Rack[]>([])
  const [selectedRack, setSelectedRack] = useState<Rack | null>(null)
  const [activeSession, setActiveSession] = useState<AuditSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rejectionInfoDialog, setRejectionInfoDialog] = useState<{
    open: boolean
    rack: Rack | null
  }>({ open: false, rack: null })
  
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkAuthAndLoad()
  }, [])

  // Warn user if they try to leave with an active rack
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (selectedRack && racks.length === 1) {
        e.preventDefault()
        e.returnValue = 'You have an active rack. Leaving this page will not unassign you from the rack.'
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [selectedRack, racks])

  // Load racks when user and location are both available
  useEffect(() => {
    if (currentUser && selectedLocation && activeSession) {
      console.log('Loading racks with user and location ready:', { 
        userId: currentUser.id, 
        locationId: selectedLocation, 
        sessionId: activeSession.id 
      })
      loadRacks(selectedLocation, activeSession.id)
    }
  }, [currentUser, selectedLocation, activeSession])

  const checkAuthAndLoad = async () => {
    try {
      // Check authentication
      const { data: { session }, error: authError } = await supabase.auth.getSession()
      
      if (authError) throw authError
      
      if (!session) {
        router.push('/auth/login')
        return
      }

      // Get user profile
      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('email', session.user.email)
        .single()

      if (profileError) {
        if (profileError.code === 'PGRST116') {
          router.push('/auth/login?error=user_not_in_system')
        } else {
          router.push('/auth/login')
        }
        return
      }

      // Check role access - scanners, supervisors, and superusers can scan
      if (!['scanner', 'supervisor', 'superuser'].includes(userProfile.role)) {
        setError('Access denied. Only scanners, supervisors, and superusers can access scanning.')
        return
      }

      setCurrentUser(userProfile)

      // Load locations and active session
      await Promise.all([
        loadLocations(userProfile),
        loadActiveSession()
      ])
    } catch (error: any) {
      console.error('Auth/load error:', error)
      setError(error.message || 'Failed to load scanning page')
    } finally {
      setLoading(false)
    }
  }

  const loadLocations = async (user: any) => {
    try {
      let query = supabase.from('locations').select('*').eq('active', true)
      
      // Filter by user's assigned locations (unless superuser)
      if (user.role !== 'superuser' && user.location_ids?.length > 0) {
        query = query.in('id', user.location_ids)
      }
      
      const { data, error } = await query.order('name')
      
      if (error) throw error
      setLocations(data || [])
      
      // Auto-select location if user has only one
      if (data?.length === 1) {
        setSelectedLocation(data[0].id)
      }
    } catch (error: any) {
      console.error('Error loading locations:', error)
      setError('Failed to load locations')
    }
  }

  const loadActiveSession = async () => {
    try {
      const { data, error } = await supabase
        .from('audit_sessions')
        .select('*')
        .eq('status', 'active')
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // No active session found
          setActiveSession(null)
          setError('No active audit session found. Contact a supervisor to start a new session.')
        } else {
          throw error
        }
        return
      }

      setActiveSession(data)
      
      // Auto-select the session's location
      if (data?.location_id) {
        setSelectedLocation(data.location_id)
        // Don't load racks here - will be loaded after user is set
      }
      
    } catch (error: any) {
      console.error('Error loading active session:', error)
      setError('Failed to load active audit session.')
    }
  }

  const loadRacks = async (locationId: number, sessionId?: string) => {
    // Use provided sessionId or fall back to activeSession
    const sessionToUse = sessionId || activeSession?.id
    
    console.log('loadRacks called with:', { 
      locationId, 
      sessionId, 
      sessionToUse, 
      activeSession: activeSession?.id, 
      currentUser: currentUser?.id,
      hasCurrentUser: !!currentUser
    })
    
    if (!sessionToUse) {
      console.log('No session ID available, skipping rack load')
      return
    }

    if (!currentUser) {
      console.log('No current user available, skipping rack load')
      return
    }

    try {
      // First, check if user already has an assigned rack
      const { data: userRacks, error: userRackError } = await supabase
        .from('racks')
        .select('*')
        .eq('audit_session_id', sessionToUse)
        .eq('scanner_id', currentUser?.id)
        .in('status', ['assigned'])

      if (userRackError) {
        console.error('Error checking user racks:', userRackError)
      }

      const hasAssignedRack = userRacks && userRacks.length > 0

      console.log('User assigned racks check:', { hasAssignedRack, userRacks })

      let query = supabase
        .from('racks')
        .select('*')
        .eq('audit_session_id', sessionToUse)
        .eq('location_id', locationId)
        .order('rack_number')

      if (hasAssignedRack) {
        // User has assigned rack - only show their assigned rack
        query = query.eq('scanner_id', currentUser?.id).in('status', ['assigned'])
      } else {
        // User has no assigned rack - show available and rejected racks
        query = query.in('status', ['available', 'rejected'])
      }

      const { data, error } = await query

      if (error) {
        console.error('Supabase error loading racks:', {
          error,
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          query: `audit_session_id=${sessionToUse}, location_id=${locationId}, hasAssignedRack=${hasAssignedRack}`
        })
        throw error
      }
      
      console.log('Loaded racks successfully:', { data, hasAssignedRack })
      
      if (!data) {
        setRacks([])
        return
      }

      // Load original scanner info for rejected racks
      let enrichedRacks = data
      const rejectedRacks = data.filter(r => r.status === 'rejected')
      
      if (rejectedRacks.length > 0) {
        const scannerIds = rejectedRacks.map(r => r.scanner_id).filter(Boolean)
        
        if (scannerIds.length > 0) {
          const { data: scanners } = await supabase
            .from('users')
            .select('id, username, email')
            .in('id', scannerIds)
          
          // Attach scanner info to rejected racks
          enrichedRacks = data.map(rack => ({
            ...rack,
            original_scanner: rack.status === 'rejected' 
              ? scanners?.find(s => s.id === rack.scanner_id)
              : null
          }))
        }
      }

      // Smart sorting: rejected racks first, then numerical
      const sortedRacks = enrichedRacks.sort((a, b) => {
        // Priority 1: Rejected racks first (for visibility)
        if (a.status === 'rejected' && b.status !== 'rejected') return -1
        if (b.status === 'rejected' && a.status !== 'rejected') return 1
        
        // Priority 2: Numerical sorting within same status
        const aNum = parseInt(a.rack_number) || 0
        const bNum = parseInt(b.rack_number) || 0
        return aNum - bNum
      })

      setRacks(sortedRacks)
      
      // Auto-select user's assigned rack if they have one
      if (hasAssignedRack && sortedRacks.length > 0) {
        console.log('Auto-selecting assigned rack:', sortedRacks[0])
        setSelectedRack(sortedRacks[0])
      }
    } catch (error: any) {
      console.error('Error loading racks full object:', error)
      setError(`Failed to load racks: ${error.message || error.code || 'Unknown error'}`)
    }
  }

  const handleLocationChange = (locationId: number) => {
    setSelectedLocation(locationId)
    setSelectedRack(null)
    loadRacks(locationId)
  }

  const handleRackSelection = async (rack: Rack) => {
    // Check if rejected rack belongs to current user
    if (rack.status === 'rejected' && rack.scanner_id && rack.scanner_id !== currentUser.id) {
      // Show rejection info dialog instead of error message
      setRejectionInfoDialog({ open: true, rack })
      return
    }

    try {
      let updateData: any = {
        status: 'assigned',
        scanner_id: currentUser.id,
        assigned_at: new Date().toISOString()
      }

      // If rack is already assigned to current user, keep it assigned
      if (rack.scanner_id === currentUser.id && rack.status === 'assigned') {
        // Already assigned to this user, just continue
        setSelectedRack(rack)
        setError(null)
        // Single rack focus: only show selected rack
        setRacks([rack])
        return
      }

      // If re-selecting own rejected rack, keep existing scans but reset to assigned
      if (rack.status === 'rejected' && rack.scanner_id === currentUser.id) {
        updateData.status = 'assigned' // Reset to assigned for scanning
        // rejection_reason stays in database for reference
      }

      const { error } = await supabase
        .from('racks')
        .update(updateData)
        .eq('id', rack.id)

      if (error) throw error

      const updatedRack = { ...rack, ...updateData }
      setSelectedRack(updatedRack)
      setError(null)
      
      // Single rack focus: only show selected rack after assignment
      setRacks([updatedRack])
    } catch (error: any) {
      console.error('Error selecting rack:', error)
      setError('Failed to assign rack. It may already be assigned to another scanner.')
    }
  }

  const handleReviewScans = () => {
    if (!selectedRack) return
    
    // Navigate to review page
    router.push(`/dashboard/scanning/review/${selectedRack.id}`)
  }

  const handleAbandonRack = async () => {
    if (!selectedRack) return
    
    // Confirm abandonment
    if (!window.confirm('Are you sure you want to abandon this rack? You will lose your assignment and need to select a new rack.')) {
      return
    }

    try {
      // Update rack status back to available
      const { error } = await supabase
        .from('racks')
        .update({
          status: 'available',
          scanner_id: null,
          assigned_at: null
        })
        .eq('id', selectedRack.id)

      if (error) throw error

      // Reset state
      setSelectedRack(null)
      setError(null)
      
      // Reload available racks
      if (selectedLocation && activeSession) {
        loadRacks(selectedLocation, activeSession.id)
      }
    } catch (error: any) {
      console.error('Error abandoning rack:', error)
      setError('Failed to abandon rack. Please try again.')
    }
  }

  const handleScanAdded = (barcode: string) => {
    // Optional: Add visual feedback or update counters
    console.log('Scan added:', barcode)
  }

  if (loading) {
    return (
      <DashboardLayout>
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
            <CircularProgress />
          </Box>
        </Container>
      </DashboardLayout>
    )
  }

  if (error) {
    return (
      <DashboardLayout>
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
          <Button
            startIcon={<ArrowBack />}
            onClick={() => router.push('/dashboard')}
          >
            Back to Dashboard
          </Button>
        </Container>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      {/* Personal Stats Bar */}
      {currentUser && (
        <PersonalStatsBar 
          userId={currentUser.id} 
          userName={currentUser.username || currentUser.email}
        />
      )}
      
      <Container maxWidth="lg" sx={{ mt: 2, mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <QrCodeScanner sx={{ mr: 2, fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h4" component="h1">
            Barcode Scanning Station
          </Typography>
        </Box>

        {!activeSession && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            No active audit session. Contact a supervisor to start a new session.
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* Location and Rack Selection */}
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <LocationOn sx={{ mr: 1, verticalAlign: 'middle' }} />
                  {activeSession ? 'Select Rack' : 'Select Location & Rack'}
                </Typography>

                {/* Location Selector - only show if no active session */}
                {!activeSession && (
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Location</InputLabel>
                    <Select
                      value={selectedLocation || ''}
                      onChange={(e) => handleLocationChange(e.target.value as number)}
                      disabled={!activeSession}
                    >
                      {locations.map((location) => (
                        <MenuItem key={location.id} value={location.id}>
                          {location.name} - {location.city}, {location.state}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}

                {/* Show current location for active session */}
                {activeSession && selectedLocation && (
                  <Typography variant="subtitle2" sx={{ mb: 2, color: 'text.secondary' }}>
                    Location: {locations.find(l => l.id === selectedLocation)?.name || 'Loading...'}
                  </Typography>
                )}

                {/* Rack Selector / Single Rack Focus */}
                {selectedLocation && (
                  <Box>
                    {selectedRack && racks.length === 1 ? (
                      // Single rack focus mode
                      <Box>
                        <Alert severity="info" sx={{ mb: 2 }}>
                          You are working on this rack. Complete it before selecting another.
                        </Alert>
                        <Card variant="outlined" sx={{ p: 2, bgcolor: 'primary.light' }}>
                          <Typography variant="h6" gutterBottom>
                            Current Rack: {activeSession?.shortname ? 
                              `${activeSession.shortname}-${selectedRack.rack_number.padStart(3, '0')}` : 
                              selectedRack.rack_number
                            }
                          </Typography>
                          <Chip 
                            label="Assigned to you"
                            color="primary"
                            size="small"
                            sx={{ mb: 2 }}
                          />
                          <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column' }}>
                            <Button
                              variant="contained"
                              color="primary"
                              startIcon={<Assignment />}
                              onClick={handleReviewScans}
                              fullWidth
                            >
                              Review & Submit
                            </Button>
                            <Button
                              variant="outlined"
                              color="error"
                              onClick={handleAbandonRack}
                              size="small"
                              fullWidth
                            >
                              Abandon Rack
                            </Button>
                          </Box>
                        </Card>
                      </Box>
                    ) : (
                      // Normal rack selection mode
                      <>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>
                          Available Racks ({racks.length})
                        </Typography>
                        <Paper sx={{ maxHeight: 300, overflow: 'auto', p: 1 }}>
                          {racks.length === 0 ? (
                            <Typography color="text.secondary" sx={{ textAlign: 'center', p: 2 }}>
                              No available racks
                            </Typography>
                          ) : (
                            <Grid container spacing={1}>
                              {racks.map((rack) => (
                            <Grid item xs={6} key={rack.id}>
                              <Card 
                                variant={selectedRack?.id === rack.id ? 'elevation' : 'outlined'}
                                sx={{ 
                                  cursor: 'pointer',
                                  bgcolor: rack.status === 'rejected' 
                                    ? 'error.light' 
                                    : selectedRack?.id === rack.id 
                                      ? 'primary.light' 
                                      : 'inherit',
                                  borderColor: rack.status === 'rejected' ? 'error.main' : 'grey.300',
                                  '&:hover': { 
                                    bgcolor: rack.status === 'rejected'
                                      ? 'error.light'
                                      : selectedRack?.id === rack.id 
                                        ? 'primary.light' 
                                        : 'grey.100' 
                                  }
                                }}
                                onClick={() => handleRackSelection(rack)}
                              >
                                <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Typography variant="body2" fontWeight="bold">
                                      {activeSession?.shortname ? 
                                        `${activeSession.shortname}-${rack.rack_number.padStart(3, '0')}` : 
                                        rack.rack_number
                                      }
                                    </Typography>
                                    
                                    {rack.status === 'rejected' && (
                                      <WarningIcon sx={{ color: 'error.main', fontSize: 16 }} />
                                    )}
                                  </Box>
                                  
                                  <Chip 
                                    label={rack.status === 'rejected' ? 'Rejected' : rack.status.replace('_', ' ')}
                                    size="small"
                                    color={rack.status === 'rejected' ? 'error' : rack.status === 'available' ? 'default' : 'primary'}
                                  />
                                  
                                  {rack.status === 'rejected' && rack.rejection_reason && (
                                    <Typography variant="caption" sx={{ 
                                      display: 'block', 
                                      mt: 0.5, 
                                      color: 'error.dark',
                                      fontStyle: 'italic'
                                    }}>
                                      "{rack.rejection_reason.substring(0, 50)}{rack.rejection_reason.length > 50 ? '...' : ''}"
                                    </Typography>
                                  )}
                                  
                                  {rack.status === 'rejected' && rack.original_scanner && (
                                    <Typography variant="caption" sx={{ 
                                      display: 'block', 
                                      color: 'text.secondary',
                                      fontSize: '0.7rem'
                                    }}>
                                      Originally scanned by: {rack.original_scanner.username || rack.original_scanner.email}
                                    </Typography>
                                  )}
                                </CardContent>
                              </Card>
                            </Grid>
                              ))}
                            </Grid>
                          )}
                        </Paper>
                      </>
                    )}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Scanner Interface */}
          <Grid item xs={12} md={8}>
            {selectedRack && activeSession ? (
              <WebScanner
                rackId={selectedRack.id}
                auditSessionId={activeSession.id}
                scannerId={currentUser.id}
                onScanAdded={handleScanAdded}
                onReview={handleReviewScans}
              />
            ) : (
              <Card>
                <CardContent sx={{ textAlign: 'center', py: 8 }}>
                  <Assignment sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    Select a rack to start scanning
                  </Typography>
                  <Typography color="text.secondary">
                    Choose a location and available rack from the left panel
                  </Typography>
                </CardContent>
              </Card>
            )}
          </Grid>
        </Grid>
      </Container>

      {/* Rejection Info Dialog */}
      <Dialog 
        open={rejectionInfoDialog.open} 
        onClose={() => setRejectionInfoDialog({ open: false, rack: null })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <WarningIcon color="error" />
            <Typography variant="h6">
              Rack Already Assigned
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            This rack was rejected and is assigned to another scanner for corrections.
          </Typography>
          
          <Divider sx={{ my: 2 }} />
          
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">
              Rack Number
            </Typography>
            <Typography variant="body1" fontWeight="medium">
              {rejectionInfoDialog.rack?.rack_number}
            </Typography>
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">
              Originally Scanned By
            </Typography>
            <Typography variant="body1" fontWeight="medium">
              {rejectionInfoDialog.rack?.original_scanner?.username || 
               rejectionInfoDialog.rack?.original_scanner?.email || 
               'Unknown Scanner'}
            </Typography>
          </Box>

          {rejectionInfoDialog.rack?.rejection_reason && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Rejection Reason
              </Typography>
              <Typography 
                variant="body2" 
                sx={{ 
                  p: 2, 
                  bgcolor: 'error.light', 
                  borderRadius: 1, 
                  fontStyle: 'italic',
                  color: 'error.dark'
                }}
              >
                "{rejectionInfoDialog.rack.rejection_reason}"
              </Typography>
            </Box>
          )}

          <Typography variant="body2" color="text.secondary">
            Please choose an available rack to start scanning.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setRejectionInfoDialog({ open: false, rack: null })}
            variant="contained"
            fullWidth
          >
            OK, Choose Another Rack
          </Button>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  )
}