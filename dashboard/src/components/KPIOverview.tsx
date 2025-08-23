'use client'

import { useEffect, useState } from 'react'
import {
  Card,
  CardContent,
  Typography,
  Grid,
  Box,
  Chip,
  LinearProgress,
  CircularProgress,
  Button,
} from '@mui/material'
import {
  TrendingUp,
  Speed,
  CheckCircle,
  Assignment,
  Timer,
  Print,
} from '@mui/icons-material'
import { createClient } from '@/lib/supabase'
import RackLabelPrinter from './RackLabelPrinter'

interface KPIStats {
  // Core metrics
  accuracyRate: number
  throughputPerHour: number
  firstPassYield: number
  
  // Operational metrics
  totalScans: number
  avgRackTime: number
  avgApprovalTime: number
  
  // Supporting data
  totalRacks: number
  approvedRacks: number
  rejectedRacks: number
  pendingRacks: number
}

interface SessionInfo {
  id: string
  shortname: string
  locationName: string
  startedAt: string
}

export default function KPIOverview() {
  const [stats, setStats] = useState<KPIStats>({
    accuracyRate: 0,
    throughputPerHour: 0,
    firstPassYield: 0,
    totalScans: 0,
    avgRackTime: 0,
    avgApprovalTime: 0,
    totalRacks: 0,
    approvedRacks: 0,
    rejectedRacks: 0,
    pendingRacks: 0,
  })
  const [loading, setLoading] = useState(true)
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null)
  const [showLabelPrinter, setShowLabelPrinter] = useState(false)

  useEffect(() => {
    loadKPIStats()
  }, [])

  const loadKPIStats = async () => {
    try {
      const supabase = createClient()
      
      // Get the single active session
      const { data: activeSession } = await supabase
        .from('audit_sessions')
        .select(`
          id, 
          shortname,
          started_at,
          location_id
        `)
        .eq('status', 'active')
        .single()

      if (!activeSession) {
        // No active session - show empty state
        setStats({
          accuracyRate: 0,
          throughputPerHour: 0,
          firstPassYield: 0,
          totalScans: 0,
          avgRackTime: 0,
          avgApprovalTime: 0,
          totalRacks: 0,
          approvedRacks: 0,
          rejectedRacks: 0,
          pendingRacks: 0,
        })
        setSessionInfo(null)
        setLoading(false)
        return
      }

      // Get location name separately to avoid TypeScript issues
      let locationName = 'Unknown Location'
      if (activeSession.location_id) {
        const { data: location } = await supabase
          .from('locations')
          .select('name')
          .eq('id', activeSession.location_id)
          .single()
        
        if (location) {
          locationName = location.name
        }
      }

      // Store active session info
      setSessionInfo({
        id: activeSession.id,
        shortname: activeSession.shortname || 'Audit',
        locationName: locationName,
        startedAt: activeSession.started_at
      })

      // Get rack statistics from the single active session
      const { data: racks } = await supabase
        .from('racks')
        .select(`
          status,
          assigned_at,
          completed_at,
          ready_at,
          approved_at,
          rejected_at
        `)
        .eq('audit_session_id', activeSession.id)
      
      // Get scan count for throughput calculation from the active session (last 24 hours)
      const { data: scans } = await supabase
        .from('scans')
        .select('created_at, scanner_id')
        .eq('audit_session_id', activeSession.id)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
      
      // Get total scan count for the entire audit session
      const { count: totalScansCount } = await supabase
        .from('scans')
        .select('*', { count: 'exact', head: true })
        .eq('audit_session_id', activeSession.id)
      
      
      if (racks && scans) {
        // Calculate KPIs
        const totalRacks = racks.length
        const approvedRacks = racks.filter(r => r.status === 'approved').length
        const rejectedRacks = racks.filter(r => r.status === 'rejected').length
        const pendingRacks = racks.filter(r => r.status === 'ready_for_approval').length
        const completedRacks = approvedRacks + rejectedRacks
        
        // Accuracy Rate: Approved / Total Completed
        const accuracyRate = completedRacks > 0 ? (approvedRacks / completedRacks) * 100 : 0
        
        // First-Pass Yield: Approved / Total Completed (same as accuracy in this simple model)
        const firstPassYield = accuracyRate
        
        // Throughput: Scans per hour (last 24 hours)
        const throughputPerHour = scans ? scans.length / 24 : 0
        
        // Total scans for the entire audit session
        const totalScans = totalScansCount || 0
        
        // Average rack completion time (assigned to approved/rejected)
        const completedRacksWithTimes = racks.filter(r => 
          r.assigned_at && (r.approved_at || r.rejected_at)
        )
        const avgRackTime = completedRacksWithTimes.length > 0 
          ? completedRacksWithTimes.reduce((sum, rack) => {
              const startTime = new Date(rack.assigned_at).getTime()
              const endTime = new Date(rack.approved_at || rack.rejected_at).getTime()
              return sum + (endTime - startTime)
            }, 0) / completedRacksWithTimes.length / (1000 * 60) // Convert to minutes
          : 0
        
        // Approval throughput rate (time since first submission / approved count)
        const racksWithCompletedTime = racks.filter(r => r.completed_at)
        const firstCompletedTime = racksWithCompletedTime.length > 0 
          ? Math.min(...racksWithCompletedTime.map(r => new Date(r.completed_at).getTime()))
          : null
        
        const avgApprovalTime = firstCompletedTime && approvedRacks > 0
          ? (Date.now() - firstCompletedTime) / approvedRacks / (1000 * 60) // Minutes per approval
          : 0
        
        setStats({
          accuracyRate,
          throughputPerHour,
          firstPassYield,
          totalScans,
          avgRackTime,
          avgApprovalTime,
          totalRacks,
          approvedRacks,
          rejectedRacks,
          pendingRacks,
        })
      }
    } catch (error) {
      console.error('Error loading KPI stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatStartTime = (startedAt: string): string => {
    const startDate = new Date(startedAt)
    const now = new Date()
    const diffMs = now.getTime() - startDate.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffHours / 24)
    
    if (diffHours < 1) {
      return 'Started less than an hour ago'
    } else if (diffHours === 1) {
      return 'Started 1 hour ago'
    } else if (diffHours < 24) {
      return `Started ${diffHours} hours ago`
    } else if (diffDays === 1) {
      return 'Started yesterday'
    } else {
      return `Started ${diffDays} days ago`
    }
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

  // Streamlined KPIs for supervisor/superuser workflow
  const streamlinedKPIs = [
    {
      title: 'Session Progress',
      value: `${stats.approvedRacks + stats.rejectedRacks}/${stats.totalRacks}`,
      subtitle: 'Racks Completed',
      icon: <Assignment />,
      color: 'primary.main',
      progress: stats.totalRacks > 0 ? ((stats.approvedRacks + stats.rejectedRacks) / stats.totalRacks) * 100 : 0,
    },
    {
      title: 'Pending Approvals',
      value: stats.pendingRacks,
      subtitle: 'Need Review',
      icon: <CheckCircle />,
      color: stats.pendingRacks > 10 ? 'error.main' : stats.pendingRacks > 5 ? 'warning.main' : 'success.main',
      progress: Math.max(100 - (stats.pendingRacks / 20) * 100, 0),
      clickable: true,
    },
    {
      title: 'Approval Rate',
      value: stats.avgApprovalTime > 0 ? `${stats.avgApprovalTime.toFixed(1)}m` : '—',
      subtitle: 'Per Rack',
      icon: <Timer />,
      color: stats.avgApprovalTime <= 2 ? 'success.main' : stats.avgApprovalTime <= 5 ? 'warning.main' : 'error.main',
      progress: stats.avgApprovalTime > 0 ? Math.max(100 - (stats.avgApprovalTime / 10) * 100, 0) : 0,
    },
    {
      title: 'Total Items Scanned',
      value: stats.totalScans.toLocaleString(),
      subtitle: 'Items',
      icon: <Speed />,
      color: 'info.main',
      progress: Math.min((stats.totalScans / 1000) * 100, 100), // Assuming 1000 is a good target
    },
    {
      title: 'Quality Rate',
      value: `${stats.accuracyRate.toFixed(0)}%`,
      subtitle: `${stats.approvedRacks}/${stats.approvedRacks + stats.rejectedRacks} Approved`,
      icon: <TrendingUp />,
      color: stats.accuracyRate >= 95 ? 'success.main' : stats.accuracyRate >= 85 ? 'warning.main' : 'error.main',
      progress: stats.accuracyRate,
    },
  ]

  return (
    <>
      <Card>
        <CardContent sx={{ py: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box>
              {sessionInfo ? (
                <>
                  <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 'medium' }}>
                    Active Session: {sessionInfo.shortname}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                    {sessionInfo.locationName} • {formatStartTime(sessionInfo.startedAt)}
                  </Typography>
                </>
              ) : (
                <Typography variant="h6" sx={{ color: 'text.secondary' }}>
                  No Active Session
                </Typography>
              )}
            </Box>
            {sessionInfo && (
              <Button
                variant="outlined"
                startIcon={<Print />}
                onClick={() => setShowLabelPrinter(true)}
                size="small"
              >
                Print Rack Labels
              </Button>
            )}
          </Box>
          <Grid container spacing={2} alignItems="center">
            {streamlinedKPIs.map((kpi, index) => (
              <Grid item xs={12} sm={6} md={2.4} key={index}>
              <Box 
                sx={{ 
                  textAlign: 'center',
                  cursor: kpi.clickable ? 'pointer' : 'default',
                  '&:hover': kpi.clickable ? { opacity: 0.8 } : {},
                  transition: 'opacity 0.2s'
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                  <Box sx={{ mr: 1, color: 'inherit' }}>
                    {kpi.icon}
                  </Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                    {kpi.value}
                  </Typography>
                </Box>
                
                <Typography variant="subtitle2" sx={{ color: 'text.primary', mb: 0.5 }}>
                  {kpi.title}
                </Typography>
                
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {kpi.subtitle}
                </Typography>
                
                <Box sx={{ mt: 1, mx: 2 }}>
                  <LinearProgress 
                    variant="determinate" 
                    value={Math.min(kpi.progress, 100)} 
                    sx={{ 
                      height: 4, 
                      borderRadius: 2,
                    }} 
                  />
                </Box>
              </Box>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
    
    {/* Rack Label Printer Dialog */}
    {sessionInfo && (
      <RackLabelPrinter
        open={showLabelPrinter}
        onClose={() => setShowLabelPrinter(false)}
        sessionId={sessionInfo.id}
        sessionName={sessionInfo.shortname}
      />
    )}
    </>
  )
}