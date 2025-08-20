'use client'

import { useEffect, useState } from 'react'
import {
  Card,
  CardContent,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  Chip,
  CircularProgress,
  Avatar,
  ListItemAvatar,
} from '@mui/material'
import {
  Person,
  Timer,
  Assignment,
  TrendingUp,
  CheckCircle,
  PauseCircle,
} from '@mui/icons-material'
import { createClient } from '@/lib/supabase'
import { ScanningStatsDialog } from './ScanningStatsDialog'
import { ScannerDetailDialog } from './ScannerDetailDialog'

interface ScannerInfo {
  id: string
  username: string
  full_name: string | null
  last_scan_at: string | null
  current_rack: string | null
  session_scans: number
  approved_racks: number
  total_reviewed_racks: number
  time_since_last_scan: string
  scans_per_hour: number
  total_downtime_minutes: number
}

interface ScannerStats {
  total_scans_per_hour: number
  average_scans_per_hour: number
}

export default function ScannerStatus() {
  const [scanners, setScanners] = useState<ScannerInfo[]>([])
  const [stats, setStats] = useState<ScannerStats>({ total_scans_per_hour: 0, average_scans_per_hour: 0 })
  const [loading, setLoading] = useState(true)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [overallStatsOpen, setOverallStatsOpen] = useState(false)
  const [selectedScanner, setSelectedScanner] = useState<ScannerInfo | null>(null)
  const supabase = createClient()

  useEffect(() => {
    loadScannerStatus()
    
    // Set up real-time subscriptions
    const scanSubscription = supabase
      .channel('scanner_status_scans')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'scans' },
        () => loadScannerStatus()
      )
      .subscribe()

    const rackSubscription = supabase
      .channel('scanner_status_racks')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'racks' },
        () => loadScannerStatus()
      )
      .subscribe()

    // Refresh every 30 seconds for time calculations
    const interval = setInterval(loadScannerStatus, 30000)

    return () => {
      scanSubscription.unsubscribe()
      rackSubscription.unsubscribe()
      clearInterval(interval)
    }
  }, [])

  const loadScannerStatus = async () => {
    try {
      const supabase = createClient()
      
      // Get active audit session with location
      const { data: activeSession } = await supabase
        .from('audit_sessions')
        .select('id, location_id')
        .eq('status', 'active')
        .single()

      if (!activeSession) {
        setScanners([])
        setActiveSessionId(null)
        setLoading(false)
        return
      }

      setActiveSessionId(activeSession.id)

      // Get scanners and supervisors assigned to the audit session's location
      const { data: activeUsers } = await supabase
        .from('users')
        .select('id, username, full_name')
        .in('role', ['scanner', 'supervisor'])
        .eq('active', true)
        .contains('location_ids', [activeSession.location_id])

      if (!activeUsers) {
        setScanners([])
        setLoading(false)
        return
      }

      const scannerData: ScannerInfo[] = []

      for (const user of activeUsers) {
        // Get latest scan for this user
        const { data: latestScan } = await supabase
          .from('scans')
          .select('created_at')
          .eq('scanner_id', user.id)
          .eq('audit_session_id', activeSession.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        // Get session scan count for this user
        const { count: sessionScans } = await supabase
          .from('scans')
          .select('*', { count: 'exact', head: true })
          .eq('scanner_id', user.id)
          .eq('audit_session_id', activeSession.id)

        // Get current assigned rack
        const { data: currentRack } = await supabase
          .from('racks')
          .select('rack_number')
          .eq('scanner_id', user.id)
          .eq('audit_session_id', activeSession.id)
          .eq('status', 'assigned')
          .single()

        // Get approval stats
        const { data: rackStats } = await supabase
          .from('racks')
          .select('status')
          .eq('scanner_id', user.id)
          .eq('audit_session_id', activeSession.id)
          .in('status', ['approved', 'rejected'])

        const approvedRacks = rackStats?.filter(r => r.status === 'approved').length || 0
        const totalReviewedRacks = rackStats?.length || 0

        // Calculate time since last scan
        const timeSince = latestScan?.created_at 
          ? formatTimeSince(new Date(latestScan.created_at))
          : 'No activity today'

        // Calculate scans per hour for active session
        let scansPerHour = 0
        let totalDowntimeMinutes = 0
        
        if (sessionScans && sessionScans > 0 && latestScan?.created_at) {
          // Get first scan for this session
          const { data: firstScan } = await supabase
            .from('scans')
            .select('created_at')
            .eq('scanner_id', user.id)
            .eq('audit_session_id', activeSession.id)
            .order('created_at', { ascending: true })
            .limit(1)
            .single()

          if (firstScan) {
            const firstScanTime = new Date(firstScan.created_at)
            const lastScanTime = new Date(latestScan.created_at)
            const hoursWorked = (lastScanTime.getTime() - firstScanTime.getTime()) / (1000 * 60 * 60)
            scansPerHour = hoursWorked > 0 ? Math.round(sessionScans / hoursWorked) : 0
            
            // Calculate downtime (gaps > 5 minutes between scans)
            // Allow 1x 30min break + 2x 10min breaks (50min total allowance)
            const { data: allScans } = await supabase
              .from('scans')
              .select('created_at')
              .eq('scanner_id', user.id)
              .eq('audit_session_id', activeSession.id)
              .order('created_at', { ascending: true })
            
            if (allScans && allScans.length > 1) {
              const gaps: number[] = []
              
              for (let i = 1; i < allScans.length; i++) {
                const prevScan = new Date(allScans[i-1].created_at)
                const currentScan = new Date(allScans[i].created_at)
                const gapMinutes = (currentScan.getTime() - prevScan.getTime()) / (1000 * 60)
                
                if (gapMinutes > 5) {
                  gaps.push(gapMinutes - 5) // Subtract 5min buffer for normal work gaps
                }
              }
              
              // Sort gaps largest first to apply break allowances
              gaps.sort((a, b) => b - a)
              
              let remainingBreakTime = 50 // 30min + 10min + 10min allowance
              for (const gap of gaps) {
                if (remainingBreakTime > 0) {
                  const allowedBreak = Math.min(gap, remainingBreakTime)
                  remainingBreakTime -= allowedBreak
                  totalDowntimeMinutes += gap - allowedBreak
                } else {
                  totalDowntimeMinutes += gap
                }
              }
            }
          }
        }

        scannerData.push({
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          last_scan_at: latestScan?.created_at || null,
          current_rack: currentRack?.rack_number || null,
          session_scans: sessionScans || 0,
          approved_racks: approvedRacks,
          total_reviewed_racks: totalReviewedRacks,
          time_since_last_scan: timeSince,
          scans_per_hour: scansPerHour,
          total_downtime_minutes: Math.round(totalDowntimeMinutes),
        })
      }

      // Sort by most recent activity first
      scannerData.sort((a, b) => {
        if (!a.last_scan_at && !b.last_scan_at) return 0
        if (!a.last_scan_at) return 1
        if (!b.last_scan_at) return -1
        return new Date(b.last_scan_at).getTime() - new Date(a.last_scan_at).getTime()
      })

      // Calculate aggregate stats
      const activeScannersWithScans = scannerData.filter(s => s.scans_per_hour > 0)
      const totalScansPerHour = activeScannersWithScans.reduce((sum, s) => sum + s.scans_per_hour, 0)
      const averageScansPerHour = activeScannersWithScans.length > 0 
        ? Math.round(totalScansPerHour / activeScannersWithScans.length) 
        : 0

      setScanners(scannerData)
      setStats({
        total_scans_per_hour: totalScansPerHour,
        average_scans_per_hour: averageScansPerHour
      })
    } catch (error) {
      console.error('Error loading scanner status:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatTimeSince = (date: Date): string => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    
    return `${Math.floor(diffHours / 24)}d ago`
  }

  const getActivityColor = (timeSince: string): 'success' | 'warning' | 'default' => {
    if (timeSince === 'Just now' || timeSince.includes('m ago')) {
      const mins = timeSince === 'Just now' ? 0 : parseInt(timeSince)
      if (mins <= 5) return 'success'
      if (mins <= 30) return 'warning'
    }
    return 'default'
  }

  const getApprovalRate = (approved: number, total: number): string => {
    if (total === 0) return '0 racks'
    if (approved === 0) return `0/${total}`
    return `${approved}/${total} (${Math.round((approved / total) * 100)}%)`
  }

  const formatDowntime = (minutes: number): string => {
    if (minutes === 0) return '0min'
    if (minutes < 60) return `${minutes}min`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`
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
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TrendingUp />
          Scanning Stats
        </Typography>
        
        {scanners.length > 0 && (
          <Box sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Chip
              label={`${stats.total_scans_per_hour} scans/hr total`}
              color="primary"
              variant="filled"
              icon={<TrendingUp sx={{ fontSize: '18px !important' }} />}
              sx={{ 
                fontWeight: 'bold',
                cursor: 'pointer',
                '&:hover': { 
                  bgcolor: 'primary.dark',
                  transform: 'scale(1.05)'
                },
                transition: 'all 0.2s'
              }}
              onClick={() => setOverallStatsOpen(true)}
            />
            <Chip
              label={`${stats.average_scans_per_hour} scans/hr avg`}
              color="secondary"
              variant="filled"
              icon={<TrendingUp sx={{ fontSize: '18px !important' }} />}
              sx={{ 
                fontWeight: 'bold',
                cursor: 'pointer',
                '&:hover': { 
                  bgcolor: 'secondary.dark',
                  transform: 'scale(1.05)'
                },
                transition: 'all 0.2s'
              }}
              onClick={() => setOverallStatsOpen(true)}
            />
          </Box>
        )}
        
        {scanners.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
            No active scanners found
          </Typography>
        ) : (
          <List dense>
            {scanners.map((scanner, index) => (
              <ListItem 
                key={scanner.id} 
                divider={index < scanners.length - 1}
                sx={{
                  cursor: 'pointer',
                  '&:hover': {
                    bgcolor: 'action.hover',
                    borderRadius: 1
                  },
                  transition: 'background-color 0.2s',
                  borderRadius: 1
                }}
                onClick={() => setSelectedScanner(scanner)}
              >
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: 'primary.main' }}>
                    {scanner.username.charAt(0).toUpperCase()}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="subtitle2">
                        {scanner.full_name || scanner.username}
                      </Typography>
                      <Chip
                        label={scanner.time_since_last_scan}
                        size="small"
                        color={getActivityColor(scanner.time_since_last_scan)}
                        icon={<Timer sx={{ fontSize: '14px !important' }} />}
                      />
                    </Box>
                  }
                  secondary={
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                      {scanner.current_rack && (
                        <Chip
                          label={`Rack ${scanner.current_rack}`}
                          size="small"
                          variant="outlined"
                          icon={<Assignment sx={{ fontSize: '14px !important' }} />}
                        />
                      )}
                      <Chip
                        label={`${scanner.session_scans} scans`}
                        size="small"
                        variant="outlined"
                        icon={<TrendingUp sx={{ fontSize: '14px !important' }} />}
                      />
                      <Chip
                        label={`${getApprovalRate(scanner.approved_racks, scanner.total_reviewed_racks)} approved`}
                        size="small"
                        variant="outlined"
                        icon={<CheckCircle sx={{ fontSize: '14px !important' }} />}
                      />
                      {scanner.scans_per_hour > 0 && (
                        <Chip
                          label={`${scanner.scans_per_hour}/hr`}
                          size="small"
                          variant="outlined"
                          color="info"
                          sx={{ 
                            bgcolor: 'info.light',
                            color: 'info.contrastText',
                            fontWeight: 'bold'
                          }}
                        />
                      )}
                      {scanner.total_downtime_minutes > 0 && (
                        <Chip
                          label={`${formatDowntime(scanner.total_downtime_minutes)} downtime`}
                          size="small"
                          variant="outlined"
                          color="warning"
                          icon={<PauseCircle sx={{ fontSize: '14px !important' }} />}
                        />
                      )}
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
      
      {/* Overall Stats Dialog */}
      <ScanningStatsDialog
        open={overallStatsOpen}
        onClose={() => setOverallStatsOpen(false)}
        sessionId={activeSessionId}
      />
      
      {/* Individual Scanner Dialog */}
      {selectedScanner && (
        <ScannerDetailDialog
          open={!!selectedScanner}
          onClose={() => setSelectedScanner(null)}
          sessionId={activeSessionId}
          scannerId={selectedScanner.id}
          scannerName={selectedScanner.full_name || selectedScanner.username}
          scannerUsername={selectedScanner.username}
          currentStats={{
            session_scans: selectedScanner.session_scans,
            scans_per_hour: selectedScanner.scans_per_hour,
            total_downtime_minutes: selectedScanner.total_downtime_minutes,
            time_since_last_scan: selectedScanner.time_since_last_scan
          }}
        />
      )}
    </Card>
  )
}