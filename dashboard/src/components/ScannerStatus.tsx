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
} from '@mui/icons-material'
import { createClient } from '@/lib/supabase'

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
}

export default function ScannerStatus() {
  const [scanners, setScanners] = useState<ScannerInfo[]>([])
  const [loading, setLoading] = useState(true)
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
        setLoading(false)
        return
      }

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
        })
      }

      // Sort by most recent activity first
      scannerData.sort((a, b) => {
        if (!a.last_scan_at && !b.last_scan_at) return 0
        if (!a.last_scan_at) return 1
        if (!b.last_scan_at) return -1
        return new Date(b.last_scan_at).getTime() - new Date(a.last_scan_at).getTime()
      })

      setScanners(scannerData)
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
          <Person />
          Scanner Status
        </Typography>
        
        {scanners.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
            No active scanners found
          </Typography>
        ) : (
          <List dense>
            {scanners.map((scanner, index) => (
              <ListItem key={scanner.id} divider={index < scanners.length - 1}>
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
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  )
}