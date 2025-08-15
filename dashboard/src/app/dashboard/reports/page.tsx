'use client'

import { useEffect, useState } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  CircularProgress,
  Alert,
  Container,
} from '@mui/material'
import {
  Assessment,
  CheckCircle,
  Timer,
  LocationOn,
  Download,
  FileDownload,
} from '@mui/icons-material'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

interface CompletedAuditSession {
  id: string
  location_name: string
  shortname: string
  started_at: string
  completed_at: string
  total_rack_count: number
  completed_rack_count: number
  approved_rack_count: number
  total_scans: number
  started_by_username: string
}

interface UserProfile {
  id: string
  email: string
  username: string
  role: 'scanner' | 'supervisor' | 'superuser'
  location_ids: number[]
}

interface Location {
  id: number
  name: string
}

export default function ReportsPage() {
  const router = useRouter()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [locations, setLocations] = useState<Location[]>([])
  const [completedSessions, setCompletedSessions] = useState<CompletedAuditSession[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<string>('all')
  const [selectedSession, setSelectedSession] = useState<string>('all')
  const supabase = createClient()

  useEffect(() => {
    checkAuthAndLoadData()
  }, [])

  useEffect(() => {
    if (userProfile) {
      loadCompletedSessions()
    }
  }, [selectedLocation, userProfile])

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
        .select('id, name')
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

  const loadCompletedSessions = async () => {
    try {
      console.log('Loading completed audit sessions...')
      
      // Build query for completed sessions only
      let query = supabase
        .from('audit_sessions')
        .select(`
          id,
          location_id,
          shortname,
          started_at,
          completed_at,
          total_rack_count,
          locations!inner(name),
          users!audit_sessions_started_by_fkey(username)
        `)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })

      // Filter by location if not "all"
      if (selectedLocation !== 'all') {
        query = query.eq('location_id', parseInt(selectedLocation))
      }

      // Filter by user's locations if not superuser
      if (userProfile?.role !== 'superuser' && userProfile?.location_ids?.length) {
        query = query.in('location_id', userProfile.location_ids)
      }

      const { data: sessions, error } = await query
      if (error) throw error

      console.log('Completed sessions:', sessions)

      // Get additional statistics for each session
      const sessionsWithStats = await Promise.all(
        (sessions || []).map(async (session) => {
          // Get rack statistics
          const { data: racks } = await supabase
            .from('racks')
            .select('status')
            .eq('audit_session_id', session.id)

          const completedRackCount = racks?.filter(r => 
            r.status === 'approved' || r.status === 'ready_for_approval'
          ).length || 0
          
          const approvedRackCount = racks?.filter(r => r.status === 'approved').length || 0

          // Get total scan count
          const { data: scans } = await supabase
            .from('scans')
            .select('id')
            .eq('audit_session_id', session.id)

          const totalScans = scans?.length || 0

          return {
            id: session.id,
            location_name: (session as any).locations.name,
            shortname: session.shortname || 'N/A',
            started_at: session.started_at,
            completed_at: session.completed_at,
            total_rack_count: session.total_rack_count,
            completed_rack_count: completedRackCount,
            approved_rack_count: approvedRackCount,
            total_scans: totalScans,
            started_by_username: (session as any).users?.username || 'Unknown',
          }
        })
      )

      setCompletedSessions(sessionsWithStats)
    } catch (error) {
      console.error('Error loading completed sessions:', error)
    }
  }

  const exportSessionCSV = async (sessionId: string) => {
    setExporting(true)
    try {
      console.log('Exporting CSV for session:', sessionId)
      
      const { data: scans, error } = await supabase
        .from('scans')
        .select('barcode')
        .eq('audit_session_id', sessionId)
        .order('created_at')
        
      console.log('Query result for session', sessionId, ':', scans)

      if (error) throw error
      if (!scans || scans.length === 0) {
        alert('No scans found for this session')
        return
      }

      // Create CSV content with single column of barcodes
      const csvContent = [
        'barcode', // Header
        ...scans.map(scan => scan.barcode)
      ].join('\n')

      // Find session info for filename
      const session = completedSessions.find(s => s.id === sessionId)
      const filename = session ? 
        `${session.shortname}-${session.location_name}-scans.csv`.replace(/[^a-zA-Z0-9-_]/g, '_') :
        `audit-session-${sessionId}-scans.csv`

      // Download the file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', filename)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      console.log(`Exported ${scans.length} barcodes to ${filename}`)
    } catch (error) {
      console.error('Error exporting CSV:', error)
      alert('Failed to export CSV. Please try again.')
    } finally {
      setExporting(false)
    }
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

  const totalScans = completedSessions.reduce((sum, session) => sum + session.total_scans, 0)
  const totalRacks = completedSessions.reduce((sum, session) => sum + session.total_rack_count, 0)
  const approvedRacks = completedSessions.reduce((sum, session) => sum + session.approved_rack_count, 0)

  return (
    <DashboardLayout>
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1">
            Reports & Data Export
          </Typography>
        </Box>

        {/* Info Alert */}
        <Alert severity="info" sx={{ mb: 3 }}>
          This page shows completed audit sessions only. Active sessions are managed on the dashboard.
        </Alert>

        {/* Summary Stats */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Box sx={{ p: 1, borderRadius: 1, backgroundColor: 'primary.main', color: 'white', mr: 2 }}>
                    <Timer />
                  </Box>
                  <Box>
                    <Typography variant="h4" component="div">
                      {completedSessions.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Completed Sessions
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Box sx={{ p: 1, borderRadius: 1, backgroundColor: 'success.main', color: 'white', mr: 2 }}>
                    <Assessment />
                  </Box>
                  <Box>
                    <Typography variant="h4" component="div">
                      {totalScans.toLocaleString()}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Scans
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Box sx={{ p: 1, borderRadius: 1, backgroundColor: 'info.main', color: 'white', mr: 2 }}>
                    <CheckCircle />
                  </Box>
                  <Box>
                    <Typography variant="h4" component="div">
                      {totalRacks}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Racks
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Box sx={{ p: 1, borderRadius: 1, backgroundColor: 'warning.main', color: 'white', mr: 2 }}>
                    <LocationOn />
                  </Box>
                  <Box>
                    <Typography variant="h4" component="div">
                      {approvedRacks}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Approved Racks
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Filters and Export */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel>Location Filter</InputLabel>
                  <Select
                    value={selectedLocation}
                    onChange={(e) => setSelectedLocation(e.target.value)}
                    label="Location Filter"
                  >
                    <MenuItem value="all">All Locations</MenuItem>
                    {locations.map((location) => (
                      <MenuItem key={location.id} value={location.id.toString()}>
                        {location.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                
              </Box>
              
            </Box>
          </CardContent>
        </Card>

        {/* Completed Sessions Table */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
              <CheckCircle sx={{ mr: 1 }} />
              Completed Audit Sessions
            </Typography>
            
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Session</TableCell>
                    <TableCell>Location</TableCell>
                    <TableCell>Started By</TableCell>
                    <TableCell>Completed</TableCell>
                    <TableCell align="right">Racks</TableCell>
                    <TableCell align="right">Scans</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {completedSessions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        <Typography color="text.secondary" sx={{ py: 4 }}>
                          No completed sessions found. Complete an active session to see reports here.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    completedSessions.map((session) => (
                      <TableRow key={session.id}>
                        <TableCell>
                          <Box>
                            <Typography variant="body2" fontWeight="bold">
                              {session.shortname}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              ID: {session.id.slice(0, 8)}...
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>{session.location_name}</TableCell>
                        <TableCell>{session.started_by_username}</TableCell>
                        <TableCell>
                          {new Date(session.completed_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell align="right">
                          <Box>
                            <Typography variant="body2">
                              {session.approved_rack_count}/{session.total_rack_count}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {session.total_rack_count > 0 ? 
                                `${((session.approved_rack_count / session.total_rack_count) * 100).toFixed(1)}%` : 
                                '0%'
                              }
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight="bold">
                            {session.total_scans.toLocaleString()}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<FileDownload />}
                            onClick={() => exportSessionCSV(session.id)}
                            disabled={exporting || session.total_scans === 0}
                          >
                            CSV
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Container>
    </DashboardLayout>
  )
}