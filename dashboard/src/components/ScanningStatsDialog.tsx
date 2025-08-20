'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  CircularProgress,
  Alert,
  IconButton,
} from '@mui/material'
import { Close, TrendingUp } from '@mui/icons-material'
import { LineChart } from '@mui/x-charts/LineChart'
import { createClient } from '@/lib/supabase'

interface HourlyStats {
  hour: string
  total_scans_per_hour: number
  average_scans_per_hour: number
}

interface ScanningStatsDialogProps {
  open: boolean
  onClose: () => void
  sessionId: string | null
}

export function ScanningStatsDialog({ open, onClose, sessionId }: ScanningStatsDialogProps) {
  const [hourlyStats, setHourlyStats] = useState<HourlyStats[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    if (open && sessionId) {
      fetchHourlyStats()
    }
  }, [open, sessionId])

  const fetchHourlyStats = async () => {
    if (!sessionId) return

    setLoading(true)
    setError(null)

    try {
      // Get all scans for the session grouped by hour
      const { data: scans, error } = await supabase
        .from('scans')
        .select('created_at, scanner_id')
        .eq('audit_session_id', sessionId)
        .order('created_at', { ascending: true })

      if (error) throw error

      // Group scans by hour and calculate stats
      const hourlyData: { [key: string]: { total: number; scanners: Set<string> } } = {}
      
      scans?.forEach(scan => {
        const hour = new Date(scan.created_at).toISOString().slice(0, 13) + ':00:00'
        if (!hourlyData[hour]) {
          hourlyData[hour] = { total: 0, scanners: new Set() }
        }
        hourlyData[hour].total++
        hourlyData[hour].scanners.add(scan.scanner_id)
      })

      // Convert to chart data
      const stats: HourlyStats[] = Object.entries(hourlyData).map(([hour, data]) => ({
        hour: new Date(hour).toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          hour12: true 
        }),
        total_scans_per_hour: data.total,
        average_scans_per_hour: data.scanners.size > 0 ? Math.round(data.total / data.scanners.size) : 0
      }))

      setHourlyStats(stats)
    } catch (error) {
      console.error('Error fetching hourly stats:', error)
      setError('Failed to load scanning statistics')
    } finally {
      setLoading(false)
    }
  }

  const hours = hourlyStats.map(stat => stat.hour)
  const totalScansData = hourlyStats.map(stat => stat.total_scans_per_hour)
  const avgScansData = hourlyStats.map(stat => stat.average_scans_per_hour)

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <TrendingUp />
        Scanning Performance Over Time
        <Box sx={{ flex: 1 }} />
        <IconButton onClick={onClose} size="small">
          <Close />
        </IconButton>
      </DialogTitle>
      
      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : hourlyStats.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
            No scanning data available for this session
          </Typography>
        ) : (
          <Box sx={{ width: '100%', height: 400 }}>
            <Typography variant="h6" gutterBottom>
              Scans Per Hour Trends
            </Typography>
            <LineChart
              width={800}
              height={350}
              series={[
                {
                  data: totalScansData,
                  label: 'Total Scans/Hour',
                  color: '#1976d2'
                },
                {
                  data: avgScansData,
                  label: 'Average Scans/Hour',
                  color: '#dc004e'
                }
              ]}
              xAxis={[{
                scaleType: 'point',
                data: hours,
                label: 'Time'
              }]}
              yAxis={[{
                label: 'Scans per Hour'
              }]}
              margin={{ left: 80, right: 80, top: 50, bottom: 80 }}
            />
          </Box>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}