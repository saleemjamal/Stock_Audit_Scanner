'use client'

import { useEffect, useState } from 'react'
import {
  Card,
  CardContent,
  Typography,
  Grid,
  Box,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  LinearProgress,
  CircularProgress,
} from '@mui/material'
import {
  ViewList,
  People,
  ExpandMore,
  Assignment,
  Person,
  AccessTime,
  Speed,
  CheckCircle,
  Schedule,
  Cancel,
} from '@mui/icons-material'
import { createClient } from '@/lib/supabase'

interface RackData {
  id: string
  rack_number: string
  status: string
  scanner_id?: string
  scanner_name?: string
  assigned_at?: string
  ready_at?: string
  scan_count: number
  audit_sessions?: {
    shortname?: string
  }
}

interface ScannerData {
  id: string
  username: string
  email: string
  current_rack?: string
  current_rack_status?: string
  scans_today: number
  last_activity?: string
  avg_scan_rate: number
  racks_completed: number
}

export default function StatusViews() {
  const [viewMode, setViewMode] = useState<'rack' | 'scanner'>('rack')
  const [racks, setRacks] = useState<RackData[]>([])
  const [scanners, setScanners] = useState<ScannerData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const supabase = createClient()
      
      // Load racks from active sessions
      const { data: racksData } = await supabase
        .from('racks')
        .select(`
          id,
          rack_number,
          status,
          scanner_id,
          assigned_at,
          ready_at,
          audit_sessions!inner(
            status,
            shortname
          ),
          users:scanner_id(username)
        `)
        .eq('audit_sessions.status', 'active')
        .order('rack_number')

      // Get scan counts for each rack
      const rackIds = racksData?.map(r => r.id) || []
      const { data: scanCounts } = await supabase
        .from('scans')
        .select('rack_id')
        .in('rack_id', rackIds)

      // Process rack data with scan counts
      const racksWithCounts = racksData?.map(rack => {
        const scanCount = scanCounts?.filter(s => s.rack_id === rack.id).length || 0
        return {
          ...rack,
          scanner_name: rack.users?.username,
          scan_count: scanCount
        }
      }) || []

      setRacks(racksWithCounts)

      // Load scanner data
      const { data: activeScans } = await supabase
        .from('scans')
        .select(`
          scanner_id,
          created_at,
          racks!inner(
            rack_number,
            status,
            audit_sessions!inner(
              status,
              shortname
            )
          )
        `)
        .eq('racks.audit_sessions.status', 'active')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

      // Get unique scanners
      const scannerIds = [...new Set(activeScans?.map(s => s.scanner_id) || [])]
      
      const { data: scannerUsers } = await supabase
        .from('users')
        .select('id, username, email')
        .in('id', scannerIds)

      // Get current rack assignments
      const { data: currentAssignments } = await supabase
        .from('racks')
        .select(`
          scanner_id,
          rack_number,
          status,
          audit_sessions!inner(shortname)
        `)
        .eq('status', 'assigned')
        .in('scanner_id', scannerIds)

      // Process scanner data
      const scannerData: ScannerData[] = scannerUsers?.map(user => {
        const userScans = activeScans?.filter(s => s.scanner_id === user.id) || []
        const todayScans = userScans.filter(s => 
          new Date(s.created_at).toDateString() === new Date().toDateString()
        )
        const currentRack = currentAssignments?.find(a => a.scanner_id === user.id)
        
        // Calculate scan rate (scans per hour)
        const firstScan = userScans[userScans.length - 1]
        const lastScan = userScans[0]
        let avgRate = 0
        if (firstScan && lastScan) {
          const timeDiff = new Date(lastScan.created_at).getTime() - new Date(firstScan.created_at).getTime()
          const hours = timeDiff / (1000 * 60 * 60)
          avgRate = hours > 0 ? userScans.length / hours : 0
        }

        const completedRacks = racksWithCounts.filter(
          r => r.scanner_id === user.id && (r.status === 'approved' || r.status === 'ready_for_approval')
        ).length

        return {
          id: user.id,
          username: user.username,
          email: user.email,
          current_rack: currentRack ? `${currentRack.audit_sessions?.shortname}-${currentRack.rack_number.padStart(3, '0')}` : undefined,
          current_rack_status: currentRack?.status,
          scans_today: todayScans.length,
          last_activity: userScans[0]?.created_at,
          avg_scan_rate: Math.round(avgRate),
          racks_completed: completedRacks
        }
      }) || []

      setScanners(scannerData)
    } catch (error) {
      console.error('Error loading status views data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleViewChange = (event: React.MouseEvent<HTMLElement>, newView: 'rack' | 'scanner' | null) => {
    if (newView !== null) {
      setViewMode(newView)
    }
  }

  const groupRacksByStatus = () => {
    const groups: Record<string, RackData[]> = {
      'available': [],
      'assigned': [],
      'ready_for_approval': [],
      'approved': [],
      'rejected': []
    }

    racks.forEach(rack => {
      if (groups[rack.status]) {
        groups[rack.status].push(rack)
      }
    })

    return groups
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'default'
      case 'assigned': return 'info'
      case 'ready_for_approval': return 'warning'
      case 'approved': return 'success'
      case 'rejected': return 'error'
      default: return 'default'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'available': return <Assignment />
      case 'assigned': return <Person />
      case 'ready_for_approval': return <Schedule />
      case 'approved': return <CheckCircle />
      case 'rejected': return <Cancel />
      default: return <Assignment />
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'available': return 'Available'
      case 'assigned': return 'In Progress'
      case 'ready_for_approval': return 'Pending Approval'
      case 'approved': return 'Approved'
      case 'rejected': return 'Rejected'
      default: return status
    }
  }

  const formatTimeSince = (dateString?: string) => {
    if (!dateString) return 'Never'
    const diff = Date.now() - new Date(dateString).getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6">
            Status Views
          </Typography>
          
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={handleViewChange}
            size="small"
          >
            <ToggleButton value="rack">
              <ViewList sx={{ mr: 1 }} />
              Rack View
            </ToggleButton>
            <ToggleButton value="scanner">
              <People sx={{ mr: 1 }} />
              Scanner View
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {viewMode === 'rack' ? (
          // Rack View
          <Box>
            {Object.entries(groupRacksByStatus()).map(([status, statusRacks]) => (
              <Accordion key={status} defaultExpanded={status === 'ready_for_approval'}>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                    {getStatusIcon(status)}
                    <Typography sx={{ flexGrow: 1 }}>
                      {getStatusLabel(status)}
                    </Typography>
                    <Chip 
                      label={statusRacks.length} 
                      size="small" 
                      color={getStatusColor(status) as any}
                    />
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  {statusRacks.length === 0 ? (
                    <Typography color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      No racks in this status
                    </Typography>
                  ) : (
                    <List dense>
                      {statusRacks.map(rack => (
                        <ListItem key={rack.id}>
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="body2" fontWeight="bold">
                                  {rack.audit_sessions?.shortname ? 
                                    `${rack.audit_sessions.shortname}-${rack.rack_number.padStart(3, '0')}` : 
                                    rack.rack_number}
                                </Typography>
                                {rack.scan_count > 0 && (
                                  <Chip label={`${rack.scan_count} scans`} size="small" />
                                )}
                              </Box>
                            }
                            secondary={
                              <Box sx={{ display: 'flex', gap: 2, mt: 0.5 }}>
                                {rack.scanner_name && (
                                  <Typography variant="caption">
                                    Scanner: {rack.scanner_name}
                                  </Typography>
                                )}
                                {rack.assigned_at && (
                                  <Typography variant="caption">
                                    Started: {formatTimeSince(rack.assigned_at)}
                                  </Typography>
                                )}
                              </Box>
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  )}
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        ) : (
          // Scanner View
          <Grid container spacing={2}>
            {scanners.length === 0 ? (
              <Grid item xs={12}>
                <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                  No active scanners in the last 24 hours
                </Typography>
              </Grid>
            ) : (
              scanners.map(scanner => (
                <Grid item xs={12} md={6} lg={4} key={scanner.id}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                          {scanner.username.charAt(0).toUpperCase()}
                        </Avatar>
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography variant="subtitle1" fontWeight="bold">
                            {scanner.username}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Last active: {formatTimeSince(scanner.last_activity)}
                          </Typography>
                        </Box>
                      </Box>

                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {scanner.current_rack && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Assignment fontSize="small" color="action" />
                            <Typography variant="body2">
                              Current: {scanner.current_rack}
                            </Typography>
                          </Box>
                        )}
                        
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Speed fontSize="small" color="action" />
                          <Typography variant="body2">
                            Rate: {scanner.avg_scan_rate}/hr
                          </Typography>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <CheckCircle fontSize="small" color="action" />
                          <Typography variant="body2">
                            Today: {scanner.scans_today} scans
                          </Typography>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Assignment fontSize="small" color="action" />
                          <Typography variant="body2">
                            Completed: {scanner.racks_completed} racks
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))
            )}
          </Grid>
        )}
      </CardContent>
    </Card>
  )
}