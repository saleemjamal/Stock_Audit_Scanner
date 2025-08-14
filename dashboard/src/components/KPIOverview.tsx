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
      
      // Get rack statistics from active sessions only
      const { data: racks } = await supabase
        .from('racks')
        .select(`
          status,
          assigned_at,
          ready_at,
          approved_at,
          rejected_at,
          audit_sessions!inner(status)
        `)
        .eq('audit_sessions.status', 'active')
      
      // Get scan count for throughput calculation from active sessions only
      const { data: scans } = await supabase
        .from('scans')
        .select('created_at, scanner_id, audit_sessions!inner(status)')
        .eq('audit_sessions.status', 'active')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
      
      // Get active scanners (who have scanned in last 2 hours) from active sessions only
      const { data: activeUsers } = await supabase
        .from('scans')
        .select('scanner_id, audit_sessions!inner(status)')
        .eq('audit_sessions.status', 'active')
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

  const kpiCards = [
    {
      title: 'Accuracy Rate',
      value: `${stats.accuracyRate.toFixed(1)}%`,
      subtitle: `${stats.approvedRacks}/${stats.approvedRacks + stats.rejectedRacks} approved`,
      icon: <CheckCircle />,
      color: stats.accuracyRate >= 95 ? 'success.main' : stats.accuracyRate >= 85 ? 'warning.main' : 'error.main',
      progress: stats.accuracyRate,
    },
    {
      title: 'Throughput',
      value: `${stats.throughputPerHour.toFixed(1)}/hr`,
      subtitle: `${stats.totalScans} scans (24h)`,
      icon: <Speed />,
      color: 'primary.main',
      progress: Math.min((stats.throughputPerHour / 100) * 100, 100), // Assuming 100/hr is excellent
    },
    {
      title: 'First-Pass Yield',
      value: `${stats.firstPassYield.toFixed(1)}%`,
      subtitle: 'No rework needed',
      icon: <TrendingUp />,
      color: stats.firstPassYield >= 90 ? 'success.main' : stats.firstPassYield >= 75 ? 'warning.main' : 'error.main',
      progress: stats.firstPassYield,
    },
    {
      title: 'Active Scanners',
      value: stats.activeScannersCount,
      subtitle: 'Currently working',
      icon: <People />,
      color: 'info.main',
      progress: (stats.activeScannersCount / 10) * 100, // Assuming 10 is max capacity
    },
    {
      title: 'Avg Rack Time',
      value: `${stats.avgRackTime.toFixed(0)}min`,
      subtitle: 'Per rack completion',
      icon: <Timer />,
      color: 'secondary.main',
      progress: Math.max(100 - (stats.avgRackTime / 60) * 100, 0), // Lower time = higher progress
    },
    {
      title: 'Pending Review',
      value: stats.pendingRacks,
      subtitle: 'Awaiting approval',
      icon: <Assignment />,
      color: stats.pendingRacks > 20 ? 'error.main' : stats.pendingRacks > 10 ? 'warning.main' : 'success.main',
      progress: Math.max(100 - (stats.pendingRacks / 50) * 100, 0), // Lower pending = higher progress
    },
  ]

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TrendingUp />
          Key Performance Indicators
        </Typography>
        
        <Grid container spacing={3}>
          {kpiCards.map((kpi, index) => (
            <Grid item xs={12} sm={6} md={4} key={index}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Box sx={{ color: kpi.color }}>
                      {kpi.icon}
                    </Box>
                    <Typography variant="h5" sx={{ color: kpi.color, fontWeight: 'bold' }}>
                      {kpi.value}
                    </Typography>
                  </Box>
                  
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    {kpi.title}
                  </Typography>
                  
                  <Typography variant="caption" color="text.secondary">
                    {kpi.subtitle}
                  </Typography>
                  
                  <Box sx={{ mt: 2 }}>
                    <LinearProgress 
                      variant="determinate" 
                      value={Math.min(kpi.progress, 100)} 
                      sx={{ 
                        height: 4, 
                        borderRadius: 2,
                        backgroundColor: 'grey.200',
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: kpi.color,
                        }
                      }} 
                    />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  )
}