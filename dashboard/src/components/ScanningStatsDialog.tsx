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

      // Group scans by hour and calculate stats (in IST)
      const hourlyData: { [key: string]: { total: number; scanners: Set<string> } } = {}
      
      scans?.forEach(scan => {
        // Convert to IST more directly
        const scanDate = new Date(scan.created_at)
        // Add 5.5 hours to UTC to get IST
        const istDate = new Date(scanDate.getTime() + (5.5 * 60 * 60 * 1000))
        const hour = istDate.getUTCHours() // Use UTC methods on the adjusted date
        const date = istDate.toISOString().slice(0, 10) // YYYY-MM-DD
        const hourKey = `${date} ${hour.toString().padStart(2, '0')}:00`
        
        if (!hourlyData[hourKey]) {
          hourlyData[hourKey] = { total: 0, scanners: new Set() }
        }
        hourlyData[hourKey].total++
        hourlyData[hourKey].scanners.add(scan.scanner_id)
      })

      // Filter out current incomplete hour to avoid misleading downward trend
      const now = new Date()
      const currentISTDate = new Date(now.getTime() + (5.5 * 60 * 60 * 1000))
      const currentIncompleteHourKey = `${currentISTDate.toISOString().slice(0, 10)} ${currentISTDate.getUTCHours().toString().padStart(2, '0')}:00`
      
      // Convert to chart data - extract just the hour for display
      const stats: HourlyStats[] = Object.entries(hourlyData)
        .filter(([hourKey]) => hourKey !== currentIncompleteHourKey) // Exclude current incomplete hour
        .sort(([a], [b]) => a.localeCompare(b)) // Simple string sort for YYYY-MM-DD HH:00 format
        .map(([hourKey, data]) => {
          // Extract hour from key like "2025-08-21 14:00"
          const hourPart = parseInt(hourKey.split(' ')[1].split(':')[0])
          const hour12 = hourPart % 12 || 12
          const ampm = hourPart >= 12 ? 'PM' : 'AM'
          
          return {
            hour: `${hour12} ${ampm}`,
            total_scans_per_hour: data.total,
            average_scans_per_hour: data.scanners.size > 0 ? Math.round(data.total / data.scanners.size) : 0
          }
        })

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