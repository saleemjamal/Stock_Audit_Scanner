'use client'

import { useEffect, useState } from 'react'
import {
  Box,
  Chip,
  Typography,
  useTheme,
  useMediaQuery,
} from '@mui/material'
import {
  Person,
  QrCode,
  CheckCircle,
  Schedule,
  Speed,
} from '@mui/icons-material'
import { createClient } from '@/lib/supabase'

interface PersonalStats {
  scanner_id: string
  total_scans: number
  today_scans: number
  last_hour_scans: number
  racks_worked: number
  racks_approved: number
  racks_pending: number
  racks_rejected: number
  accuracy_rate: number
  last_scan_at: string | null
  audit_session_id: string
}

interface PersonalStatsBarProps {
  userId: string
  userName: string
}

export default function PersonalStatsBar({ userId, userName }: PersonalStatsBarProps) {
  const [stats, setStats] = useState<PersonalStats | null>(null)
  const [loading, setLoading] = useState(true)
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  
  const supabase = createClient()

  useEffect(() => {
    loadStats()
    
    // Refresh stats every 30 seconds
    const interval = setInterval(loadStats, 30000)
    
    // Real-time updates via Supabase subscription
    const subscription = supabase
      .channel('personal-stats')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'scans',
        filter: `scanner_id=eq.${userId}`
      }, () => {
        loadStats() // Refresh on new scan
      })
      .subscribe()
    
    return () => {
      clearInterval(interval)
      subscription.unsubscribe()
    }
  }, [userId])

  const loadStats = async () => {
    try {
      const { data, error } = await supabase
        .from('user_personal_stats')
        .select('*')
        .eq('scanner_id', userId)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading personal stats:', error)
        return
      }

      setStats(data || null)
    } catch (error) {
      console.error('Error loading personal stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatLastScanTime = (lastScanAt: string | null) => {
    if (!lastScanAt) return 'No scans yet'
    
    const now = new Date()
    const scanTime = new Date(lastScanAt)
    const diffMs = now.getTime() - scanTime.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    
    return scanTime.toLocaleDateString()
  }

  const getScansPerHour = () => {
    if (!stats || stats.last_hour_scans === 0) return 0
    return stats.last_hour_scans
  }

  if (loading) {
    return (
      <Box sx={{ 
        p: 1, 
        bgcolor: 'background.paper', 
        color: 'text.primary',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        borderBottom: '1px solid',
        borderColor: 'divider'
      }}>
        <Typography variant="body2">Loading stats...</Typography>
      </Box>
    )
  }

  if (!stats) {
    return (
      <Box sx={{ 
        p: 1, 
        bgcolor: 'background.paper', 
        color: 'text.primary',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        borderBottom: '1px solid',
        borderColor: 'divider'
      }}>
        <Chip 
          icon={<Person />} 
          label={userName}
          sx={{ 
            bgcolor: 'action.hover', 
            color: 'text.primary',
            '& .MuiChip-icon': { color: 'text.primary' }
          }} 
        />
        <Typography variant="body2">No active scanning session</Typography>
      </Box>
    )
  }

  if (isMobile) {
    // Compact mobile layout
    return (
      <Box sx={{ 
        p: 1, 
        bgcolor: 'background.paper', 
        color: 'text.primary',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 1,
        borderBottom: '1px solid',
        borderColor: 'divider'
      }}>
        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
          👤 {userName}
        </Typography>
        <Typography variant="body2">
          📦 {stats.today_scans} | 🏆 {stats.racks_approved} ✅
        </Typography>
        {stats.racks_pending > 0 && (
          <Typography variant="body2" sx={{ color: 'warning.main' }}>
            ⏳ {stats.racks_pending}
          </Typography>
        )}
      </Box>
    )
  }

  // Desktop layout with chips
  return (
    <Box sx={{ 
      p: 1, 
      bgcolor: 'background.paper', 
      color: 'text.primary',
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      flexWrap: 'wrap',
      borderBottom: '1px solid',
      borderColor: 'divider'
    }}>
      <Chip 
        icon={<Person />} 
        label={userName}
        sx={{ 
          bgcolor: 'action.hover', 
          color: 'text.primary',
          '& .MuiChip-icon': { color: 'text.primary' }
        }} 
      />
      
      <Chip 
        icon={<QrCode />} 
        label={`${stats.today_scans} scans today`}
        sx={{ 
          bgcolor: 'action.hover', 
          color: 'text.primary',
          '& .MuiChip-icon': { color: 'text.primary' }
        }} 
      />
      
      <Chip 
        icon={<CheckCircle />} 
        label={`${stats.racks_approved} approved (${stats.accuracy_rate}%)`}
        sx={{ 
          bgcolor: 'success.main', 
          color: 'success.contrastText',
          '& .MuiChip-icon': { color: 'success.contrastText' }
        }} 
      />
      
      {stats.racks_pending > 0 && (
        <Chip 
          icon={<Schedule />} 
          label={`${stats.racks_pending} pending review`}
          sx={{ 
            bgcolor: 'warning.main', 
            color: 'warning.contrastText',
            '& .MuiChip-icon': { color: 'warning.contrastText' }
          }} 
        />
      )}
      
      {getScansPerHour() > 0 && (
        <Chip 
          icon={<Speed />} 
          label={`${getScansPerHour()}/hr`}
          size="small"
          sx={{ 
            bgcolor: 'info.main', 
            color: 'info.contrastText',
            '& .MuiChip-icon': { color: 'info.contrastText' }
          }} 
        />
      )}
      
      <Typography variant="caption" sx={{ opacity: 0.8, ml: 'auto' }}>
        Last scan: {formatLastScanTime(stats.last_scan_at)}
      </Typography>
    </Box>
  )
}