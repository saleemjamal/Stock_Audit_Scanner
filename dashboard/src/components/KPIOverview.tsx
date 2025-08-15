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
} from '@mui/material'
import {
  TrendingUp,
  Speed,
  CheckCircle,
  Assignment,
  Timer,
  People,
} from '@mui/icons-material'
import { createClient } from '@/lib/supabase'

interface KPIStats {
  // Core metrics
  accuracyRate: number
  throughputPerHour: number
  firstPassYield: number
  
  // Operational metrics
  totalScans: number
  avgRackTime: number
  activeScannersCount: number
  
  // Supporting data
  totalRacks: number
  approvedRacks: number
  rejectedRacks: number
  pendingRacks: number
}

export default function KPIOverview() {
  const [stats, setStats] = useState<KPIStats>({
    accuracyRate: 0,
    throughputPerHour: 0,
    firstPassYield: 0,
    totalScans: 0,
    avgRackTime: 0,
    activeScannersCount: 0,
    totalRacks: 0,
    approvedRacks: 0,
    rejectedRacks: 0,
    pendingRacks: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadKPIStats()
  }, [])

  const loadKPIStats = async () => {
    try {
      const supabase = createClient()
      
      // Get the single active session
      const { data: activeSession } = await supabase
        .from('audit_sessions')
        .select('id')
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
          activeScannersCount: 0,
          totalRacks: 0,
          approvedRacks: 0,
          rejectedRacks: 0,
          pendingRacks: 0,
        })
        setLoading(false)
        return
      }

      // Get rack statistics from the single active session
      const { data: racks } = await supabase
        .from('racks')
        .select(`
          status,
          assigned_at,
          ready_at,
          approved_at,
          rejected_at
        `)
        .eq('audit_session_id', activeSession.id)
      
      // Get scan count for throughput calculation from the active session
      const { data: scans } = await supabase
        .from('scans')
        .select('created_at, scanner_id')
        .eq('audit_session_id', activeSession.id)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
      
      // Get active scanners (who have scanned in last 2 hours) from the active session
      const { data: activeUsers } = await supabase
        .from('scans')
        .select('scanner_id')
        .eq('audit_session_id', activeSession.id)
        .gte('created_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
      
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
        const totalScans = scans.length
        const throughputPerHour = totalScans / 24
        
        // Average rack completion time
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
        
        // Active scanners count
        const uniqueActiveScanners = activeUsers 
          ? new Set(activeUsers.map(u => u.scanner_id)).size 
          : 0
        
        setStats({
          accuracyRate,
          throughputPerHour,
          firstPassYield,
          totalScans,
          avgRackTime,
          activeScannersCount: uniqueActiveScanners,
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
      title: 'Active Scanners',
      value: stats.activeScannersCount,
      subtitle: 'Working Now',
      icon: <People />,
      color: 'info.main',
      progress: (stats.activeScannersCount / 8) * 100, // Assuming 8 is good capacity
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
    <Card>
      <CardContent sx={{ py: 2 }}>
        <Grid container spacing={3} alignItems="center">
          {streamlinedKPIs.map((kpi, index) => (
            <Grid item xs={6} md={3} key={index}>
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
  )
}