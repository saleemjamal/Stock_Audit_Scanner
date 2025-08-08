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
  LinearProgress,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  DatePicker,
} from '@mui/material'
import {
  Assessment,
  Speed,
  CheckCircle,
  Timer,
  TrendingUp,
  People,
  LocationOn,
} from '@mui/icons-material'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

interface AuditSession {
  id: string
  location_name: string
  started_at: string
  completed_at: string | null
  status: 'active' | 'completed' | 'paused'
  total_rack_count: number
  completed_rack_count: number
  total_scans: number
  started_by_username: string
}

interface ScannerPerformance {
  username: string
  role: string
  total_scans: number
  racks_completed: number
  avg_scans_per_hour: number
  accuracy_rate: number
  last_active: string
}

interface LocationMetrics {
  location_name: string
  total_racks: number
  completed_racks: number
  pending_racks: number
  total_scans: number
  completion_rate: number
}

export default function ReportsPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [auditSessions, setAuditSessions] = useState<AuditSession[]>([])
  const [scannerPerformance, setScannerPerformance] = useState<ScannerPerformance[]>([])
  const [locationMetrics, setLocationMetrics] = useState<LocationMetrics[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLocation, setSelectedLocation] = useState<string>('all')
  const [dateRange, setDateRange] = useState<string>('7')
  const supabase = createClient()

  useEffect(() => {
    checkAuthAndLoadData()
  }, [])

  useEffect(() => {
    if (currentUser) {
      loadReportData()
    }
  }, [selectedLocation, dateRange, currentUser])

  const checkAuthAndLoadData = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error || !session) {
        router.push('/auth/login')
        return
      }

      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('email', session.user.email)
        .single()

      if (profileError || !userProfile) {
        router.push('/auth/login')
        return
      }

      if (userProfile.role === 'scanner') {
        router.push('/dashboard?error=insufficient_permissions')
        return
      }

      setCurrentUser(userProfile)
    } catch (error) {
      console.error('Auth check error:', error)
      router.push('/auth/login')
    } finally {
      setLoading(false)
    }
  }

  const loadReportData = async () => {
    try {
      const dateFilter = new Date()
      dateFilter.setDate(dateFilter.getDate() - parseInt(dateRange))

      // Load audit sessions
      let auditQuery = supabase
        .from('audit_sessions')
        .select(`
          id,
          location_id,
          started_at,
          completed_at,
          status,
          total_rack_count,
          locations!inner(name),
          users!audit_sessions_started_by_fkey(username)
        `)
        .gte('started_at', dateFilter.toISOString())

      if (selectedLocation !== 'all') {
        auditQuery = auditQuery.eq('location_id', selectedLocation)
      }

      const { data: sessions, error: sessionsError } = await auditQuery

      if (sessionsError) throw sessionsError

      // Transform audit sessions data
      const transformedSessions = sessions?.map(session => ({
        id: session.id,
        location_name: (session as any).locations.name,
        started_at: session.started_at,
        completed_at: session.completed_at,
        status: session.status,
        total_rack_count: session.total_rack_count,
        completed_rack_count: 0, // Would need to calculate from racks table
        total_scans: 0, // Would need to calculate from scans table
        started_by_username: (session as any).users.username,
      })) || []

      setAuditSessions(transformedSessions)

      // Load scanner performance (mock data for now - would need complex queries)
      const mockScannerPerformance = [
        {
          username: 'scanner1',
          role: 'scanner',
          total_scans: 1250,
          racks_completed: 15,
          avg_scans_per_hour: 156,
          accuracy_rate: 98.5,
          last_active: '2025-01-08T10:30:00Z'
        },
        {
          username: 'supervisor1',
          role: 'supervisor',
          total_scans: 890,
          racks_completed: 12,
          avg_scans_per_hour: 134,
          accuracy_rate: 99.2,
          last_active: '2025-01-08T09:15:00Z'
        }
      ]
      setScannerPerformance(mockScannerPerformance)

      // Load location metrics (mock data for now)
      const mockLocationMetrics = [
        {
          location_name: 'Downtown Store',
          total_racks: 45,
          completed_racks: 32,
          pending_racks: 8,
          total_scans: 2340,
          completion_rate: 71.1
        },
        {
          location_name: 'Warehouse A',
          total_racks: 120,
          completed_racks: 89,
          pending_racks: 15,
          total_scans: 5670,
          completion_rate: 74.2
        }
      ]
      setLocationMetrics(mockLocationMetrics)

    } catch (error) {
      console.error('Error loading report data:', error)
    }
  }

  const calculateOverallStats = () => {
    const totalRacks = locationMetrics.reduce((sum, loc) => sum + loc.total_racks, 0)
    const completedRacks = locationMetrics.reduce((sum, loc) => sum + loc.completed_racks, 0)
    const totalScans = scannerPerformance.reduce((sum, scanner) => sum + scanner.total_scans, 0)
    const avgAccuracy = scannerPerformance.reduce((sum, scanner) => sum + scanner.accuracy_rate, 0) / scannerPerformance.length

    return {
      totalRacks,
      completedRacks,
      totalScans,
      avgAccuracy: avgAccuracy || 0,
      completionRate: totalRacks > 0 ? (completedRacks / totalRacks) * 100 : 0
    }
  }

  const overallStats = calculateOverallStats()

  const statCards = [
    {
      title: 'Total Scans',
      value: overallStats.totalScans.toLocaleString(),
      icon: <Assessment />,
      color: 'primary.main',
    },
    {
      title: 'Completion Rate',
      value: `${overallStats.completionRate.toFixed(1)}%`,
      icon: <CheckCircle />,
      color: 'success.main',
    },
    {
      title: 'Avg Accuracy',
      value: `${overallStats.avgAccuracy.toFixed(1)}%`,
      icon: <TrendingUp />,
      color: 'info.main',
    },
    {
      title: 'Active Scanners',
      value: scannerPerformance.length.toString(),
      icon: <People />,
      color: 'warning.main',
    },
  ]

  if (loading) {
    return (
      <DashboardLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
          <Typography>Loading...</Typography>
        </Box>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Audit Reports & Analytics
        </Typography>

        {/* Filters */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Location</InputLabel>
            <Select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              label="Location"
            >
              <MenuItem value="all">All Locations</MenuItem>
              {locationMetrics.map((location) => (
                <MenuItem key={location.location_name} value={location.location_name}>
                  {location.location_name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Period</InputLabel>
            <Select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              label="Period"
            >
              <MenuItem value="1">Last Day</MenuItem>
              <MenuItem value="7">Last 7 Days</MenuItem>
              <MenuItem value="30">Last 30 Days</MenuItem>
              <MenuItem value="90">Last 90 Days</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {/* Overview Stats */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          {statCards.map((card, index) => (
            <Grid item xs={12} sm={6} md={3} key={index}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Box
                      sx={{
                        p: 1,
                        borderRadius: 1,
                        backgroundColor: card.color,
                        color: 'white',
                        mr: 2,
                      }}
                    >
                      {card.icon}
                    </Box>
                    <Box>
                      <Typography variant="h4" component="div">
                        {card.value}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {card.title}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        <Grid container spacing={3}>
          {/* Scanner Performance */}
          <Grid item xs={12} lg={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                  <People sx={{ mr: 1 }} />
                  Scanner Performance
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Scanner</TableCell>
                        <TableCell align="right">Total Scans</TableCell>
                        <TableCell align="right">Racks Done</TableCell>
                        <TableCell align="right">Scans/Hour</TableCell>
                        <TableCell align="right">Accuracy</TableCell>
                        <TableCell align="right">Last Active</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {scannerPerformance.map((scanner) => (
                        <TableRow key={scanner.username}>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              {scanner.username}
                              <Chip
                                label={scanner.role}
                                size="small"
                                color={scanner.role === 'supervisor' ? 'warning' : 'info'}
                                sx={{ ml: 1, textTransform: 'capitalize' }}
                              />
                            </Box>
                          </TableCell>
                          <TableCell align="right">{scanner.total_scans.toLocaleString()}</TableCell>
                          <TableCell align="right">{scanner.racks_completed}</TableCell>
                          <TableCell align="right">{scanner.avg_scans_per_hour}</TableCell>
                          <TableCell align="right">
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                              {scanner.accuracy_rate.toFixed(1)}%
                              <Box sx={{ width: 60, ml: 1 }}>
                                <LinearProgress
                                  variant="determinate"
                                  value={scanner.accuracy_rate}
                                  color={scanner.accuracy_rate > 98 ? 'success' : scanner.accuracy_rate > 95 ? 'warning' : 'error'}
                                />
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell align="right">
                            {new Date(scanner.last_active).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* Location Metrics */}
          <Grid item xs={12} lg={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                  <LocationOn sx={{ mr: 1 }} />
                  Location Progress
                </Typography>
                {locationMetrics.map((location) => (
                  <Box key={location.location_name} sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" fontWeight="medium">
                        {location.location_name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {location.completion_rate.toFixed(1)}%
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={location.completion_rate}
                      sx={{ height: 8, borderRadius: 4, mb: 1 }}
                      color={location.completion_rate > 80 ? 'success' : location.completion_rate > 60 ? 'warning' : 'error'}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {location.completed_racks}/{location.total_racks} racks • {location.total_scans.toLocaleString()} scans
                    </Typography>
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>

          {/* Recent Audit Sessions */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                  <Timer sx={{ mr: 1 }} />
                  Recent Audit Sessions
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Location</TableCell>
                        <TableCell>Started By</TableCell>
                        <TableCell>Started</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell align="right">Total Racks</TableCell>
                        <TableCell align="right">Completed</TableCell>
                        <TableCell align="right">Progress</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {auditSessions.map((session) => (
                        <TableRow key={session.id}>
                          <TableCell>{session.location_name}</TableCell>
                          <TableCell>{session.started_by_username}</TableCell>
                          <TableCell>
                            {new Date(session.started_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={session.status}
                              color={
                                session.status === 'completed' ? 'success' :
                                session.status === 'active' ? 'primary' : 'default'
                              }
                              size="small"
                              sx={{ textTransform: 'capitalize' }}
                            />
                          </TableCell>
                          <TableCell align="right">{session.total_rack_count}</TableCell>
                          <TableCell align="right">{session.completed_rack_count}</TableCell>
                          <TableCell align="right">
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                              {session.total_rack_count > 0 ? 
                                `${((session.completed_rack_count / session.total_rack_count) * 100).toFixed(1)}%` : 
                                '0%'
                              }
                              <Box sx={{ width: 60, ml: 1 }}>
                                <LinearProgress
                                  variant="determinate"
                                  value={session.total_rack_count > 0 ? (session.completed_rack_count / session.total_rack_count) * 100 : 0}
                                />
                              </Box>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))}
                      {auditSessions.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} align="center">
                            <Typography color="text.secondary">
                              No audit sessions found for the selected period.
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </DashboardLayout>
  )
}