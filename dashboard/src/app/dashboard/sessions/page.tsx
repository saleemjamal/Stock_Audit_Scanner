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
} from '@mui/icons-material'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

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
      const { data: sessionsData, error } = await supabase
        .from('audit_sessions')
        .select(`
          *,
          locations!inner(name),
          users!audit_sessions_started_by_fkey(username, email)
        `)
        .order('started_at', { ascending: false })

      if (error) throw error

      // Get rack counts for each session
      const sessionsWithCounts = await Promise.all(
        (sessionsData || []).map(async (session) => {
          const { data: rackData } = await supabase
            .from('racks')
            .select('status')
            .eq('audit_session_id', session.id)

          const completedCount = rackData?.filter(r => 
            r.status === 'approved' || r.status === 'ready_for_approval'
          ).length || 0

          return {
            ...session,
            location_name: (session as any).locations?.name,
            started_by_name: (session as any).users?.username || (session as any).users?.email,
            completed_rack_count: completedCount,
          }
        })
      )

      // Filter by user's locations if not superuser
      if (userProfile?.role !== 'superuser' && userProfile?.location_ids?.length) {
        const filtered = sessionsWithCounts.filter(s => 
          userProfile.location_ids.includes(s.location_id)
        )
        setSessions(filtered)
      } else {
        setSessions(sessionsWithCounts)
      }
    } catch (error) {
      console.error('Error loading sessions:', error)
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
      // Check for existing active session at this location
      const { data: existingSession } = await supabase
        .from('audit_sessions')
        .select('*')
        .eq('location_id', selectedLocation)
        .eq('status', 'active')
        .single()

      if (existingSession) {
        setSnackbar({ 
          open: true, 
          message: 'An active session already exists for this location', 
          severity: 'error' 
        })
        setProcessing(false)
        return
      }

      // Create new session (notes field is optional - may not exist in older schemas)
      const sessionData: any = {
        location_id: selectedLocation,
        total_rack_count: rackCount,
        status: 'active',
        started_by: userProfile?.id,
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

  const handleAddRacks = async () => {
    if (!selectedSession || additionalRacks < 1) return

    setProcessing(true)
    try {
      // Get current max rack number
      const { data: existingRacks } = await supabase
        .from('racks')
        .select('rack_number')
        .eq('audit_session_id', selectedSession.id)
        .order('rack_number', { ascending: false })
        .limit(1)

      const startNumber = existingRacks?.length ? 
        parseInt(existingRacks[0].rack_number) + 1 : 
        selectedSession.total_rack_count + 1

      // Generate new racks
      const newRacks = Array.from({ length: additionalRacks }, (_, i) => ({
        audit_session_id: selectedSession.id,
        location_id: selectedSession.location_id,
        rack_number: String(startNumber + i),
        status: 'available',
      }))

      const { error: racksError } = await supabase
        .from('racks')
        .insert(newRacks)

      if (racksError) throw racksError

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

  const handleCloseSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to close this session? This action cannot be undone.')) {
      return
    }

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
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      </Container>
    )
  }

  const activeSessions = sessions.filter(s => s.status === 'active')
  const completedSessions = sessions.filter(s => s.status !== 'active')

  return (
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
                      onClick={() => handleCloseSession(session.id)}
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
      
      <TableContainer component={Paper}>
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
  )
}