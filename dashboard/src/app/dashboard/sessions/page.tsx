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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Snackbar,
  CircularProgress,
  IconButton,
  Grid,
} from '@mui/material'
import {
  Add,
  Close,
  CheckCircle,
  Cancel,
  LocationOn,
  Schedule,
  Storage,
  Refresh,
  AddCircle,
  Warning,
  AssignmentTurnedIn,
  ReportProblem,
  TrendingUp,
  TrendingDown,
} from '@mui/icons-material'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'

interface Location {
  id: number
  name: string
  address: string
  city: string
  state: string
}

interface AuditSession {
  id: string
  location_id: number
  location_name?: string
  total_rack_count: number
  completed_rack_count?: number
  status: 'active' | 'completed' | 'cancelled'
  started_at: string
  started_by: string
  started_by_name?: string
  completed_at?: string
  completed_by?: string
  notes?: string
}

interface PendingValidation {
  racks: number
  damageReports: number
  addOnItems: number
  assignedRacks: number
  canClose: boolean
  warnings: string[]
  brandVariance?: {
    hasInventory: boolean
    totalVarianceValue: number
    topBrand: string
    topBrandVariance: number
    brandsWithVariance: number
  }
}

interface UserProfile {
  id: string
  email: string
  username: string
  role: 'scanner' | 'supervisor' | 'superuser'
  location_ids: number[]
}

export default function AuditSessionsPage() {
  const router = useRouter()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [locations, setLocations] = useState<Location[]>([])
  const [sessions, setSessions] = useState<AuditSession[]>([])
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [addRacksDialogOpen, setAddRacksDialogOpen] = useState(false)
  const [selectedSession, setSelectedSession] = useState<AuditSession | null>(null)
  const [closeSessionDialog, setCloseSessionDialog] = useState({
    open: false,
    sessionId: '',
    sessionName: '',
    validating: false,
    validation: null as PendingValidation | null
  })
  
  // Form state
  const [selectedLocation, setSelectedLocation] = useState<number | ''>('')
  const [rackCount, setRackCount] = useState<number>(50)
  const [sessionNotes, setSessionNotes] = useState('')
  const [additionalRacks, setAdditionalRacks] = useState<number>(10)
  
  const [processing, setProcessing] = useState(false)
  const [snackbar, setSnackbar] = useState({ 
    open: false, 
    message: '', 
    severity: 'success' as 'success' | 'error' 
  })
  
  const supabase = createClient()

  useEffect(() => {
    checkAuthAndLoadData()
    
    // Set up real-time subscription for session changes
    const subscription = supabase
      .channel('audit_sessions_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'audit_sessions' },
        () => loadSessions()
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const checkAuthAndLoadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }

      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('email', user.email)
        .single()

      if (!profile || profile.role === 'scanner') {
        router.push('/dashboard?error=insufficient_permissions')
        return
      }

      setUserProfile(profile)
      await loadLocations(profile)
      await loadSessions()
    } catch (error) {
      console.error('Auth check error:', error)
      router.push('/auth/login')
    } finally {
      setLoading(false)
    }
  }

  const loadLocations = async (profile: UserProfile) => {
    try {
      let query = supabase
        .from('locations')
        .select('*')
        .eq('active', true)
        .order('name')

      // Filter by user's locations if not superuser
      if (profile.role !== 'superuser' && profile.location_ids?.length > 0) {
        query = query.in('id', profile.location_ids)
      }

      const { data, error } = await query
      if (error) throw error
      setLocations(data || [])
    } catch (error) {
      console.error('Error loading locations:', error)
    }
  }

  const loadSessions = async () => {
    try {
      console.log('Loading audit sessions...')
      
      // Simplified query - just get sessions first
      const { data: sessionsData, error } = await supabase
        .from('audit_sessions')
        .select('*')
        .order('started_at', { ascending: false })

      console.log('Sessions data:', sessionsData)
      
      if (error) {
        console.error('Error loading sessions:', error)
        throw error
      }

      if (!sessionsData || sessionsData.length === 0) {
        console.log('No sessions found')
        setSessions([])
        return
      }

      // Get location names
      const locationIds = Array.from(new Set(sessionsData.map(s => s.location_id)))
      const { data: locations } = await supabase
        .from('locations')
        .select('id, name')
        .in('id', locationIds)
      
      console.log('Locations:', locations)

      // Get user names
      const userIds = Array.from(new Set(sessionsData.map(s => s.started_by).filter(Boolean)))
      let users: any[] = []
      if (userIds.length > 0) {
        const { data: userData } = await supabase
          .from('users')
          .select('id, username, email')
          .in('id', userIds)
        users = userData || []
      }
      
      console.log('Users:', users)

      // Get rack counts for each session
      const sessionsWithCounts = await Promise.all(
        sessionsData.map(async (session) => {
          const { data: rackData } = await supabase
            .from('racks')
            .select('status')
            .eq('audit_session_id', session.id)

          const completedCount = rackData?.filter(r => 
            r.status === 'approved' || r.status === 'ready_for_approval'
          ).length || 0

          const location = locations?.find(l => l.id === session.location_id)
          const user = users?.find(u => u.id === session.started_by)

          return {
            ...session,
            location_name: location?.name || 'Unknown Location',
            started_by_name: user?.username || user?.email || 'Unknown User',
            completed_rack_count: completedCount,
          }
        })
      )

      console.log('Sessions with counts:', sessionsWithCounts)

      // Filter by user's locations if not superuser
      if (userProfile?.role !== 'superuser' && userProfile?.location_ids?.length) {
        console.log('Filtering for user locations:', userProfile.location_ids)
        const filtered = sessionsWithCounts.filter(s => 
          userProfile.location_ids.includes(s.location_id)
        )
        console.log('Filtered sessions:', filtered)
        setSessions(filtered)
      } else {
        console.log('Setting all sessions (superuser or no location filter)')
        setSessions(sessionsWithCounts)
      }
    } catch (error) {
      console.error('Error in loadSessions:', error)
    }
  }

  const handleCreateSession = async () => {
    if (!selectedLocation) {
      setSnackbar({ 
        open: true, 
        message: 'Please select a location', 
        severity: 'error' 
      })
      return
    }

    setProcessing(true)
    try {
      // Check for existing active session anywhere (enforce single active session globally)
      const { data: existingSession } = await supabase
        .from('audit_sessions')
        .select('id, location_id, locations!inner(name)')
        .eq('status', 'active')
        .single()

      if (existingSession) {
        const locationName = (existingSession as any).locations?.name || 'Unknown Location'
        setSnackbar({ 
          open: true, 
          message: `Please complete the current audit session at ${locationName} before starting a new one`, 
          severity: 'error' 
        })
        setProcessing(false)
        return
      }

      // Generate shortname for session
      const location = locations.find(l => l.id === selectedLocation)
      const locationCode = location?.name.replace(/[^A-Za-z0-9]/g, '').substring(0, 2).toUpperCase() || 'AU'
      const dateSuffix = new Date().toISOString().slice(2, 10).replace(/-/g, '') // YYMMDD
      const shortname = `${locationCode}${dateSuffix}`

      // Create new session
      const sessionData: any = {
        location_id: selectedLocation,
        total_rack_count: rackCount,
        status: 'active',
        started_by: userProfile?.id,
        shortname: shortname,
      }
      
      // Only add notes if field is provided (to handle schemas without notes column)
      if (sessionNotes) {
        sessionData.notes = sessionNotes
      }

      const { data: session, error: sessionError } = await supabase
        .from('audit_sessions')
        .insert(sessionData)
        .select()
        .single()

      if (sessionError) throw sessionError

      // Generate racks
      const racks = Array.from({ length: rackCount }, (_, i) => ({
        audit_session_id: session.id,
        location_id: selectedLocation,
        rack_number: String(i + 1),
        status: 'available',
      }))

      const { error: racksError } = await supabase
        .from('racks')
        .insert(racks)

      if (racksError) throw racksError

      setSnackbar({ 
        open: true, 
        message: `Session created with ${rackCount} racks`, 
        severity: 'success' 
      })
      
      setCreateDialogOpen(false)
      resetForm()
      await loadSessions()
    } catch (error: any) {
      console.error('Error creating session:', error)
      setSnackbar({ 
        open: true, 
        message: error.message || 'Failed to create session', 
        severity: 'error' 
      })
    } finally {
      setProcessing(false)
    }
  }

  const validateSessionClosure = async (sessionId: string): Promise<PendingValidation> => {
    try {
      // Check all pending approval types for this session and get variance data
      const [
        { data: pendingRacks },
        { data: pendingDamage },
        { data: pendingAddOns },
        { data: assignedRacks },
        { data: sessionInfo }
      ] = await Promise.all([
        supabase
          .from('racks')
          .select('id')
          .eq('audit_session_id', sessionId)
          .eq('status', 'ready_for_approval'),
        supabase
          .from('damaged_items')
          .select('id')
          .eq('audit_session_id', sessionId)
          .eq('status', 'pending'),
        supabase
          .from('add_on_items')
          .select('id')
          .eq('audit_session_id', sessionId)
          .eq('status', 'pending'),
        supabase
          .from('racks')
          .select('id')
          .eq('audit_session_id', sessionId)
          .eq('status', 'assigned'),
        supabase
          .from('audit_sessions')
          .select('location_id')
          .eq('id', sessionId)
          .single()
      ])

      const rackCount = pendingRacks?.length || 0
      const damageCount = pendingDamage?.length || 0
      const addOnCount = pendingAddOns?.length || 0
      const assignedCount = assignedRacks?.length || 0

      // Check for inventory and variance data
      let brandVariance = undefined
      if (sessionInfo?.location_id) {
        try {
          // Check if inventory exists for this location
          const { count: inventoryCount } = await supabase
            .from('inventory_items')
            .select('*', { count: 'exact', head: true })
            .eq('location_id', sessionInfo.location_id)

          if (inventoryCount && inventoryCount > 0) {
            // Get variance summary
            const { data: varianceData } = await supabase
              .rpc('get_live_brand_variance', { session_id: sessionId })

            if (varianceData && varianceData.length > 0) {
              const totalVarianceValue = varianceData.reduce((sum: number, item: any) => 
                sum + (item.variance_value || 0), 0)
              
              const brandsWithVariance = varianceData.filter((item: any) => 
                Math.abs(item.variance_value) > 100).length // Brands with >₹100 variance
              
              // Find brand with highest absolute variance
              const topVarianceBrand = varianceData.reduce((max: any, item: any) => 
                Math.abs(item.variance_value) > Math.abs(max?.variance_value || 0) ? item : max, null)

              brandVariance = {
                hasInventory: true,
                totalVarianceValue: totalVarianceValue,
                topBrand: topVarianceBrand?.brand || '',
                topBrandVariance: topVarianceBrand?.variance_value || 0,
                brandsWithVariance: brandsWithVariance
              }
            } else {
              brandVariance = {
                hasInventory: true,
                totalVarianceValue: 0,
                topBrand: '',
                topBrandVariance: 0,
                brandsWithVariance: 0
              }
            }
          } else {
            brandVariance = {
              hasInventory: false,
              totalVarianceValue: 0,
              topBrand: '',
              topBrandVariance: 0,
              brandsWithVariance: 0
            }
          }
        } catch (error) {
          console.error('Error fetching variance data:', error)
          // Continue without variance data
        }
      }

      const warnings: string[] = []
      
      if (rackCount > 0) {
        warnings.push(`${rackCount} rack${rackCount > 1 ? 's' : ''} pending supervisor approval`)
      }
      if (damageCount > 0) {
        warnings.push(`${damageCount} damage report${damageCount > 1 ? 's' : ''} pending super user approval`)
      }
      if (addOnCount > 0) {
        warnings.push(`${addOnCount} add-on request${addOnCount > 1 ? 's' : ''} pending super user approval`)
      }
      if (assignedCount > 0) {
        warnings.push(`${assignedCount} rack${assignedCount > 1 ? 's are' : ' is'} still assigned to scanners`)
      }

      return {
        racks: rackCount,
        damageReports: damageCount,
        addOnItems: addOnCount,
        assignedRacks: assignedCount,
        canClose: warnings.length === 0,
        warnings,
        brandVariance
      }
    } catch (error) {
      console.error('Error validating session closure:', error)
      return {
        racks: 0,
        damageReports: 0,
        addOnItems: 0,
        assignedRacks: 0,
        canClose: false,
        warnings: ['Unable to validate session status. Please try again.']
      }
    }
  }

  const handleAddRacks = async () => {
    if (!selectedSession || additionalRacks < 1) return

    setProcessing(true)
    try {
      // Refresh session data to avoid stale cache issues
      await loadSessions()
      // Get ALL existing rack numbers to avoid duplicates
      const { data: existingRacks, error: rackQueryError } = await supabase
        .from('racks')
        .select('rack_number')
        .eq('audit_session_id', selectedSession.id)
        .order('rack_number', { ascending: false })

      if (rackQueryError) {
        console.error('Error querying existing racks:', rackQueryError)
        throw new Error('Failed to check existing racks')
      }

      console.log('Existing racks found:', existingRacks)

      let startNumber = 1
      if (existingRacks && existingRacks.length > 0) {
        // Start from the next number after the highest existing rack
        const maxRackNumber = Math.max(...existingRacks.map(r => parseInt(r.rack_number) || 0))
        startNumber = maxRackNumber + 1
        console.log(`Found ${existingRacks.length} existing racks, max rack number: ${maxRackNumber}, starting from: ${startNumber}`)
      } else {
        // No existing racks, start from 1
        startNumber = 1
        console.log('No existing racks found, starting from: 1')
      }

      // Generate new racks with safety check
      const existingNumbers = new Set((existingRacks || []).map(r => r.rack_number))
      const newRacks = Array.from({ length: additionalRacks }, (_, i) => {
        const rackNumber = String(startNumber + i)
        if (existingNumbers.has(rackNumber)) {
          throw new Error(`Conflict detected: Rack ${rackNumber} already exists. Please refresh and try again.`)
        }
        return {
          audit_session_id: selectedSession.id,
          location_id: selectedSession.location_id,
          rack_number: rackNumber,
          status: 'available',
        }
      })

      console.log(`Adding racks ${startNumber} to ${startNumber + additionalRacks - 1} for session ${selectedSession.id}`)
      console.log('New racks to be inserted:', newRacks.map(r => r.rack_number))

      const { error: racksError } = await supabase
        .from('racks')
        .insert(newRacks)

      if (racksError) {
        console.error('Racks insert error:', racksError)
        if (racksError.code === '23505') {
          // Extract the conflicting rack number from the error details
          const match = racksError.details?.match(/rack_number\)=\([^,]+, ([^)]+)\)/)
          const conflictingRack = match ? match[1] : 'unknown'
          throw new Error(`Rack ${conflictingRack} already exists. Please refresh the page and try again.`)
        }
        throw racksError
      }

      // Update total rack count
      const { error: updateError } = await supabase
        .from('audit_sessions')
        .update({ 
          total_rack_count: selectedSession.total_rack_count + additionalRacks 
        })
        .eq('id', selectedSession.id)

      if (updateError) throw updateError

      setSnackbar({ 
        open: true, 
        message: `Added ${additionalRacks} racks (${startNumber}-${startNumber + additionalRacks - 1})`, 
        severity: 'success' 
      })
      
      setAddRacksDialogOpen(false)
      setAdditionalRacks(10)
      await loadSessions()
    } catch (error: any) {
      console.error('Error adding racks:', error)
      setSnackbar({ 
        open: true, 
        message: error.message || 'Failed to add racks', 
        severity: 'error' 
      })
    } finally {
      setProcessing(false)
    }
  }

  const handleCloseSessionClick = async (session: AuditSession) => {
    // Start validation process
    setCloseSessionDialog({
      open: true,
      sessionId: session.id,
      sessionName: session.location_name || 'Session',
      validating: true,
      validation: null
    })

    // Perform validation
    const validation = await validateSessionClosure(session.id)
    
    setCloseSessionDialog(prev => ({
      ...prev,
      validating: false,
      validation
    }))
  }

  const handleCloseSessionConfirm = async () => {
    const { sessionId } = closeSessionDialog
    if (!sessionId) return

    setProcessing(true)
    try {
      const { error } = await supabase
        .from('audit_sessions')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: userProfile?.id,
        })
        .eq('id', sessionId)

      if (error) throw error

      setSnackbar({ 
        open: true, 
        message: 'Session closed successfully', 
        severity: 'success' 
      })
      
      // Close dialog and reload
      setCloseSessionDialog({ open: false, sessionId: '', sessionName: '', validating: false, validation: null })
      await loadSessions()
    } catch (error: any) {
      console.error('Error closing session:', error)
      setSnackbar({ 
        open: true, 
        message: error.message || 'Failed to close session', 
        severity: 'error' 
      })
    } finally {
      setProcessing(false)
    }
  }

  const handleCloseSessionCancel = () => {
    setCloseSessionDialog({ 
      open: false, 
      sessionId: '', 
      sessionName: '', 
      validating: false, 
      validation: null 
    })
  }

  const resetForm = () => {
    setSelectedLocation('')
    setRackCount(50)
    setSessionNotes('')
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const getSessionProgress = (session: AuditSession) => {
    if (!session.total_rack_count) return 0
    return Math.round((session.completed_rack_count || 0) / session.total_rack_count * 100)
  }

  if (loading) {
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

  const activeSessions = sessions.filter(s => s.status === 'active')
  const completedSessions = sessions.filter(s => s.status !== 'active')

  return (
    <DashboardLayout>
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1">
            Audit Sessions
          </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setCreateDialogOpen(true)}
        >
          Start New Session
        </Button>
      </Box>

      {/* Active Sessions */}
      <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
        <Schedule sx={{ mr: 1 }} />
        Active Sessions ({activeSessions.length})
      </Typography>
      
      {activeSessions.length === 0 ? (
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Typography color="text.secondary" align="center">
              No active audit sessions. Click "Start New Session" to begin.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {activeSessions.map((session) => (
            <Grid item xs={12} md={6} key={session.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="h6" component="div">
                      {session.location_name}
                    </Typography>
                    <Chip 
                      label="Active" 
                      color="success" 
                      size="small" 
                    />
                  </Box>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Started: {formatDate(session.started_at)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      By: {session.started_by_name}
                    </Typography>
                    {session.notes && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Notes: {session.notes}
                      </Typography>
                    )}
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">
                        Progress: {session.completed_rack_count || 0} / {session.total_rack_count} racks
                      </Typography>
                      <Typography variant="body2">
                        {getSessionProgress(session)}%
                      </Typography>
                    </Box>
                    <Box sx={{ width: '100%', bgcolor: 'grey.200', borderRadius: 1, height: 8 }}>
                      <Box 
                        sx={{ 
                          width: `${getSessionProgress(session)}%`, 
                          bgcolor: 'primary.main', 
                          borderRadius: 1, 
                          height: 8 
                        }} 
                      />
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {userProfile?.role === 'superuser' && (
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<AddCircle />}
                        onClick={() => {
                          setSelectedSession(session)
                          setAddRacksDialogOpen(true)
                        }}
                      >
                        Add Racks
                      </Button>
                    )}
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      onClick={() => handleCloseSessionClick(session)}
                    >
                      Close Session
                    </Button>
                  </Box>
                  
                  {userProfile?.role !== 'superuser' && (
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                      Need more racks? Contact super user
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Completed Sessions */}
      <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
        <CheckCircle sx={{ mr: 1 }} />
        Completed Sessions
      </Typography>
      
      <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Location</TableCell>
              <TableCell>Started</TableCell>
              <TableCell>Completed</TableCell>
              <TableCell>Total Racks</TableCell>
              <TableCell>Started By</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {completedSessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    No completed sessions yet
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              completedSessions.map((session) => (
                <TableRow key={session.id}>
                  <TableCell>{session.location_name}</TableCell>
                  <TableCell>{new Date(session.started_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {session.completed_at ? new Date(session.completed_at).toLocaleDateString() : '-'}
                  </TableCell>
                  <TableCell>{session.total_rack_count}</TableCell>
                  <TableCell>{session.started_by_name}</TableCell>
                  <TableCell>
                    <Chip 
                      label={session.status} 
                      color={session.status === 'completed' ? 'default' : 'error'}
                      size="small"
                      sx={{ textTransform: 'capitalize' }}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create Session Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Start New Audit Session</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <FormControl fullWidth required>
              <InputLabel>Location</InputLabel>
              <Select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value as number)}
                label="Location"
              >
                {locations.map((location) => (
                  <MenuItem key={location.id} value={location.id}>
                    {location.name} - {location.city}, {location.state}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Number of Racks"
              type="number"
              value={rackCount}
              onChange={(e) => setRackCount(Math.max(1, parseInt(e.target.value) || 1))}
              fullWidth
              required
              helperText="Racks will be numbered 1, 2, 3..."
              inputProps={{ min: 1, max: 1000 }}
            />

            <TextField
              label="Session Notes (Optional)"
              multiline
              rows={3}
              value={sessionNotes}
              onChange={(e) => setSessionNotes(e.target.value)}
              fullWidth
              helperText="Instructions or notes for scanners"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleCreateSession} 
            variant="contained"
            disabled={processing || !selectedLocation}
          >
            {processing ? 'Creating...' : 'Start Session'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Racks Dialog (Super Users Only) */}
      <Dialog open={addRacksDialogOpen} onClose={() => setAddRacksDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add More Racks to Session</DialogTitle>
        <DialogContent>
          {selectedSession && (
            <Box sx={{ mb: 3, mt: 2 }}>
              <Alert severity="info">
                <Typography variant="body2">
                  <strong>Current Session:</strong> {selectedSession.location_name}
                </Typography>
                <Typography variant="body2">
                  <strong>Current Racks:</strong> {selectedSession.total_rack_count}
                </Typography>
              </Alert>
            </Box>
          )}
          
          <TextField
            label="Add How Many Racks"
            type="number"
            value={additionalRacks}
            onChange={(e) => setAdditionalRacks(Math.max(1, parseInt(e.target.value) || 1))}
            fullWidth
            required
            helperText={`New racks will be numbered ${(selectedSession?.total_rack_count || 0) + 1}, ${(selectedSession?.total_rack_count || 0) + 2}, ${(selectedSession?.total_rack_count || 0) + 3}...`}
            inputProps={{ min: 1, max: 500 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddRacksDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleAddRacks} 
            variant="contained"
            disabled={processing || additionalRacks < 1}
          >
            {processing ? 'Adding...' : 'Add Racks'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Close Session Validation Dialog */}
      <Dialog 
        open={closeSessionDialog.open} 
        onClose={handleCloseSessionCancel}
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Warning color="warning" />
            Close Audit Session: {closeSessionDialog.sessionName}
          </Box>
        </DialogTitle>
        <DialogContent>
          {closeSessionDialog.validating ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 3 }}>
              <CircularProgress size={24} />
              <Typography>Checking for pending approvals...</Typography>
            </Box>
          ) : closeSessionDialog.validation ? (
            <Box sx={{ mt: 2 }}>
              {closeSessionDialog.validation.canClose ? (
                <Alert severity="success" sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    ✅ Ready to Close
                  </Typography>
                  <Typography variant="body2">
                    All approvals are complete. This session can be safely closed.
                  </Typography>
                </Alert>
              ) : (
                <Alert severity="error" sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    ⚠️ Cannot Close Session
                  </Typography>
                  <Typography variant="body2">
                    Please complete all pending approvals before closing this session.
                  </Typography>
                </Alert>
              )}

              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                Current Status:
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <AssignmentTurnedIn color={closeSessionDialog.validation.racks > 0 ? 'error' : 'success'} />
                        <Typography variant="subtitle2">
                          Rack Approvals
                        </Typography>
                      </Box>
                      <Typography variant="h4" color={closeSessionDialog.validation.racks > 0 ? 'error.main' : 'success.main'}>
                        {closeSessionDialog.validation.racks}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {closeSessionDialog.validation.racks > 0 ? 'Pending approval' : 'All approved'}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <ReportProblem color={closeSessionDialog.validation.damageReports > 0 ? 'error' : 'success'} />
                        <Typography variant="subtitle2">
                          Damage Reports
                        </Typography>
                      </Box>
                      <Typography variant="h4" color={closeSessionDialog.validation.damageReports > 0 ? 'error.main' : 'success.main'}>
                        {closeSessionDialog.validation.damageReports}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {closeSessionDialog.validation.damageReports > 0 ? 'Pending approval' : 'All approved'}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Add color={closeSessionDialog.validation.addOnItems > 0 ? 'error' : 'success'} />
                        <Typography variant="subtitle2">
                          Add-on Requests
                        </Typography>
                      </Box>
                      <Typography variant="h4" color={closeSessionDialog.validation.addOnItems > 0 ? 'error.main' : 'success.main'}>
                        {closeSessionDialog.validation.addOnItems}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {closeSessionDialog.validation.addOnItems > 0 ? 'Pending approval' : 'All approved'}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Storage color={closeSessionDialog.validation.assignedRacks > 0 ? 'error' : 'success'} />
                        <Typography variant="subtitle2">
                          Active Racks
                        </Typography>
                      </Box>
                      <Typography variant="h4" color={closeSessionDialog.validation.assignedRacks > 0 ? 'error.main' : 'success.main'}>
                        {closeSessionDialog.validation.assignedRacks}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {closeSessionDialog.validation.assignedRacks > 0 ? 'Still assigned' : 'All available'}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Brand Variance Summary Card */}
                {closeSessionDialog.validation?.brandVariance && (
                  <Grid item xs={12}>
                    <Card variant="outlined" sx={{ 
                      backgroundColor: closeSessionDialog.validation.brandVariance.hasInventory 
                        ? 'action.hover' 
                        : 'grey.50',
                      border: closeSessionDialog.validation.brandVariance.hasInventory
                        ? '1px solid'
                        : '1px dashed',
                      borderColor: closeSessionDialog.validation.brandVariance.hasInventory
                        ? 'primary.main'
                        : 'grey.400'
                    }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                          {closeSessionDialog.validation.brandVariance.totalVarianceValue >= 0 ? (
                            <TrendingUp color="success" />
                          ) : (
                            <TrendingDown color="error" />
                          )}
                          <Typography variant="subtitle2">
                            Brand Variance Summary
                          </Typography>
                        </Box>
                        
                        {closeSessionDialog.validation.brandVariance.hasInventory ? (
                          <Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                              <Typography variant="h4" color={
                                closeSessionDialog.validation.brandVariance.totalVarianceValue >= 0 
                                  ? 'success.main' 
                                  : 'error.main'
                              }>
                                {new Intl.NumberFormat('en-IN', { 
                                  style: 'currency', 
                                  currency: 'INR',
                                  maximumFractionDigits: 0
                                }).format(closeSessionDialog.validation.brandVariance.totalVarianceValue)}
                              </Typography>
                              <Box textAlign="right">
                                <Typography variant="body2" color="text.secondary">
                                  Total Variance
                                </Typography>
                                {closeSessionDialog.validation.brandVariance.brandsWithVariance > 0 && (
                                  <Typography variant="caption" color="warning.main">
                                    {closeSessionDialog.validation.brandVariance.brandsWithVariance} brands with significant variance
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                            
                            {closeSessionDialog.validation.brandVariance.topBrand && (
                              <Box sx={{ 
                                p: 1.5, 
                                backgroundColor: 'rgba(0,0,0,0.03)', 
                                borderRadius: 1,
                                mb: 2
                              }}>
                                <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                                  Highest Variance Brand
                                </Typography>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <Typography variant="body2" fontWeight="bold">
                                    {closeSessionDialog.validation.brandVariance.topBrand}
                                  </Typography>
                                  <Typography 
                                    variant="body2" 
                                    fontWeight="bold"
                                    color={closeSessionDialog.validation.brandVariance.topBrandVariance >= 0 ? 'success.main' : 'error.main'}
                                  >
                                    {new Intl.NumberFormat('en-IN', { 
                                      style: 'currency', 
                                      currency: 'INR',
                                      maximumFractionDigits: 0
                                    }).format(closeSessionDialog.validation.brandVariance.topBrandVariance)}
                                  </Typography>
                                </Box>
                              </Box>
                            )}
                            
                            <Typography variant="body2" color="text.secondary">
                              💡 <strong>Tip:</strong> Visit{' '}
                              <Button
                                variant="text"
                                size="small"
                                onClick={() => {
                                  handleCloseSessionCancel()
                                  router.push('/dashboard/variance')
                                }}
                                sx={{ textDecoration: 'underline', p: 0, minWidth: 'unset' }}
                              >
                                Brand Variance
                              </Button>
                              {' '}for detailed analysis and export options.
                            </Typography>
                          </Box>
                        ) : (
                          <Box>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                              No inventory data available for variance analysis.
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Import expected inventory to enable variance tracking for future sessions.
                            </Typography>
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                )}
              </Grid>

              {closeSessionDialog.validation.warnings.length > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Issues to resolve:
                  </Typography>
                  {closeSessionDialog.validation.warnings.map((warning, index) => (
                    <Alert key={index} severity="warning" sx={{ mb: 1 }}>
                      {warning}
                    </Alert>
                  ))}
                </Box>
              )}

              {!closeSessionDialog.validation.canClose && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    💡 <strong>Next Steps:</strong> Visit the{' '}
                    <Button
                      variant="text"
                      size="small"
                      onClick={() => {
                        handleCloseSessionCancel()
                        router.push('/dashboard/approvals')
                      }}
                      sx={{ textDecoration: 'underline', p: 0, minWidth: 'unset' }}
                    >
                      Approvals page
                    </Button>
                    {' '}to complete pending reviews, then try closing the session again.
                  </Typography>
                </Box>
              )}
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseSessionCancel}>
            Cancel
          </Button>
          {closeSessionDialog.validation?.canClose && (
            <Button 
              onClick={handleCloseSessionConfirm}
              variant="contained"
              color="error"
              disabled={processing}
            >
              {processing ? 'Closing...' : 'Close Session'}
            </Button>
          )}
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