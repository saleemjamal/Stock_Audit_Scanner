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
  Avatar,
  Chip,
} from '@mui/material'
import { Close, Person, TrendingUp, Timer, PauseCircle } from '@mui/icons-material'
import { LineChart } from '@mui/x-charts/LineChart'
import { createClient } from '@/lib/supabase'

interface PersonalHourlyStats {
  hour: string
  scans_count: number
}

interface ScannerDetailDialogProps {
  open: boolean
  onClose: () => void
  sessionId: string | null
  scannerId: string | null
  scannerName: string
  scannerUsername: string
  currentStats: {
    session_scans: number
    scans_per_hour: number
    total_downtime_minutes: number
    time_since_last_scan: string
  }
}

export function ScannerDetailDialog({ 
  open, 
  onClose, 
  sessionId, 
  scannerId, 
  scannerName, 
  scannerUsername,
  currentStats 
}: ScannerDetailDialogProps) {
  const [hourlyStats, setHourlyStats] = useState<PersonalHourlyStats[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    if (open && sessionId && scannerId) {
      fetchPersonalHourlyStats()
    }
  }, [open, sessionId, scannerId])

  const fetchPersonalHourlyStats = async () => {
    if (!sessionId || !scannerId) return

    setLoading(true)
    setError(null)

    try {
      // Get all scans for this specific scanner grouped by hour
      const { data: scans, error } = await supabase
        .from('scans')
        .select('created_at')
        .eq('audit_session_id', sessionId)
        .eq('scanner_id', scannerId)
        .order('created_at', { ascending: true })

      if (error) throw error

      // Group scans by hour (in IST)
      const hourlyData: { [key: string]: number } = {}
      
      scans?.forEach(scan => {
        // Convert to IST more directly
        const scanDate = new Date(scan.created_at)
        // Add 5.5 hours to UTC to get IST
        const istDate = new Date(scanDate.getTime() + (5.5 * 60 * 60 * 1000))
        const hour = istDate.getUTCHours() // Use UTC methods on the adjusted date
        const date = istDate.toISOString().slice(0, 10) // YYYY-MM-DD
        const hourKey = `${date} ${hour.toString().padStart(2, '0')}:00`
        
        hourlyData[hourKey] = (hourlyData[hourKey] || 0) + 1
      })

      // Filter out current incomplete hour to avoid misleading downward trend
      const now = new Date()
      const currentISTDate = new Date(now.getTime() + (5.5 * 60 * 60 * 1000))
      const currentIncompleteHourKey = `${currentISTDate.toISOString().slice(0, 10)} ${currentISTDate.getUTCHours().toString().padStart(2, '0')}:00`
      
      // Convert to chart data
      const stats: PersonalHourlyStats[] = Object.entries(hourlyData)
        .filter(([hourKey]) => hourKey !== currentIncompleteHourKey) // Exclude current incomplete hour
        .sort(([a], [b]) => a.localeCompare(b)) // Simple string sort for YYYY-MM-DD HH:00 format
        .map(([hourKey, count]) => {
          // Extract hour from key like "2025-08-21 14:00"
          const hourPart = parseInt(hourKey.split(' ')[1].split(':')[0])
          const hour12 = hourPart % 12 || 12
          const ampm = hourPart >= 12 ? 'PM' : 'AM'
          
          return {
            hour: `${hour12} ${ampm}`,
            scans_count: count
          }
        })

      setHourlyStats(stats)
    } catch (error) {
      console.error('Error fetching personal hourly stats:', error)
      setError('Failed to load scanner statistics')
    } finally {
      setLoading(false)
    }
  }

  const formatDowntime = (minutes: number): string => {
    if (minutes === 0) return '0min'
    if (minutes < 60) return `${minutes}min`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`
  }

  const hours = hourlyStats.map(stat => stat.hour)
  const scansData = hourlyStats.map(stat => stat.scans_count)

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Avatar sx={{ bgcolor: 'primary.main' }}>
          {scannerUsername.charAt(0).toUpperCase()}
        </Avatar>
        <Box>
          <Typography variant="h6">
            {scannerName || scannerUsername}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Personal Scanning Performance
          </Typography>
        </Box>
        <Box sx={{ flex: 1 }} />
        <IconButton onClick={onClose} size="small">
          <Close />
        </IconButton>
      </DialogTitle>
      
      <DialogContent>
        {/* Current Stats Summary */}
        <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Chip
            label={`${currentStats.session_scans} total scans`}
            icon={<TrendingUp sx={{ fontSize: '18px !important' }} />}
            variant="filled"
            color="primary"
          />
          <Chip
            label={`${currentStats.scans_per_hour}/hr current rate`}
            icon={<TrendingUp sx={{ fontSize: '18px !important' }} />}
            variant="filled"
            color="secondary"
          />
          <Chip
            label={`Last scan: ${currentStats.time_since_last_scan}`}
            icon={<Timer sx={{ fontSize: '18px !important' }} />}
            variant="outlined"
          />
          {currentStats.total_downtime_minutes > 0 && (
            <Chip
              label={`${formatDowntime(currentStats.total_downtime_minutes)} downtime`}
              icon={<PauseCircle sx={{ fontSize: '18px !important' }} />}
              variant="outlined"
              color="warning"
            />
          )}
        </Box>

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
            No scanning activity found for this scanner in the current session
          </Typography>
        ) : (
          <Box sx={{ width: '100%', height: 350 }}>
            <Typography variant="h6" gutterBottom>
              Hourly Scanning Activity
            </Typography>
            <LineChart
              width={600}
              height={300}
              series={[
                {
                  data: scansData,
                  label: 'Scans per Hour',
                  color: '#1976d2'
                }
              ]}
              xAxis={[{
                scaleType: 'point',
                data: hours,
                label: 'Time'
              }]}
              yAxis={[{
                label: 'Number of Scans'
              }]}
              margin={{ left: 60, right: 60, top: 30, bottom: 60 }}
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