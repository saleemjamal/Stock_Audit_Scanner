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
} from '@mui/material'
import {
  Inventory,
  CheckCircle,
  Schedule,
  People,
} from '@mui/icons-material'
import { createClient } from '@/lib/supabase'

interface AuditStats {
  totalRacks: number
  completedRacks: number
  pendingRacks: number
  activeUsers: number
  totalScans: number
}

export default function AuditOverview() {
  const [stats, setStats] = useState<AuditStats>({
    totalRacks: 0,
    completedRacks: 0,
    pendingRacks: 0,
    activeUsers: 0,
    totalScans: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      const supabase = createClient()
      
      // Get racks from active audit sessions only
      const { data: racks } = await supabase
        .from('racks')
        .select('status, audit_sessions!inner(status)')
        .eq('audit_sessions.status', 'active')
      
      if (racks) {
        const totalRacks = racks.length
        const completedRacks = racks.filter(r => r.status === 'approved').length
        const pendingRacks = racks.filter(r => r.status === 'ready_for_approval').length
        const totalScans = 0 // Will need separate query for scan counts
        
        setStats({
          totalRacks,
          completedRacks,
          pendingRacks,
          activeUsers: 5, // This would come from a real query
          totalScans,
        })
      }
    } catch (error) {
      console.error('Error loading stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const completionRate = stats.totalRacks > 0 ? (stats.completedRacks / stats.totalRacks) * 100 : 0

  const statCards = [
    {
      title: 'Total Racks',
      value: stats.totalRacks,
      icon: <Inventory />,
      color: 'primary.main',
    },
    {
      title: 'Completed',
      value: stats.completedRacks,
      icon: <CheckCircle />,
      color: 'success.main',
    },
    {
      title: 'Pending Approval',
      value: stats.pendingRacks,
      icon: <Schedule />,
      color: 'warning.main',
    },
    {
      title: 'Active Users',
      value: stats.activeUsers,
      icon: <People />,
      color: 'info.main',
    },
  ]

  if (loading) {
    return (
      <Card>
        <CardContent>
          <LinearProgress />
        </CardContent>
      </Card>
    )
  }

  return (
    <Grid container spacing={3}>
      {statCards.map((card, index) => (
        <Grid item xs={12} sm={6} md={3} key={index}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
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
      
      {/* Completion Rate */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Overall Completion Rate
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Box sx={{ width: '100%', mr: 1 }}>
                <LinearProgress
                  variant="determinate"
                  value={completionRate}
                  sx={{ height: 10, borderRadius: 5 }}
                />
              </Box>
              <Box sx={{ minWidth: 35 }}>
                <Typography variant="body2" color="text.secondary">
                  {`${Math.round(completionRate)}%`}
                </Typography>
              </Box>
            </Box>
            <Typography variant="body2" color="text.secondary">
              {stats.completedRacks} of {stats.totalRacks} racks completed • {stats.totalScans.toLocaleString()} total scans
            </Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}