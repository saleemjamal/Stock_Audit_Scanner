'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card,
  CardContent,
  Typography,
  Grid,
  Box,
  Chip,
  Tooltip,
  CircularProgress,
} from '@mui/material'
import {
  CheckCircle,
  Cancel,
  Schedule,
  Assignment,
  Person,
  Visibility,
} from '@mui/icons-material'
import { createClient } from '@/lib/supabase'

interface Rack {
  id: string
  rack_number: string
  status: 'available' | 'assigned' | 'ready_for_approval' | 'approved' | 'rejected'
  scanner_id?: string
  assigned_at?: string
  ready_at?: string
  approved_at?: string
  rejected_at?: string
  scanner_name?: string
  audit_sessions?: {
    shortname?: string
  }
}

export default function RackMap() {
  const [racks, setRacks] = useState<Rack[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    loadRacks()
  }, [])

  const loadRacks = async () => {
    try {
      const supabase = createClient()
      
      // Get the single active session
      const { data: activeSession } = await supabase
        .from('audit_sessions')
        .select('id, shortname')
        .eq('status', 'active')
        .single()

      if (!activeSession) {
        setRacks([])
        setLoading(false)
        return
      }

      const { data: racksData } = await supabase
        .from('racks')
        .select(`
          id,
          rack_number,
          status,
          scanner_id,
          assigned_at,
          ready_at,
          approved_at,
          rejected_at
        `)
        .eq('audit_session_id', activeSession.id)
        .order('rack_number')

      if (racksData) {
        setRacks(racksData.map(rack => ({
          ...rack,
          scanner_name: rack.scanner_id ? 'Scanner' : undefined,
          audit_sessions: { shortname: activeSession.shortname }
        })))
      }
    } catch (error) {
      console.error('Error loading racks:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return '#e0e0e0'
      case 'assigned': return '#2196f3'
      case 'ready_for_approval': return '#ff9800'
      case 'approved': return '#4caf50'
      case 'rejected': return '#f44336'
      default: return '#e0e0e0'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'available': return <Assignment sx={{ fontSize: 16 }} />
      case 'assigned': return <Person sx={{ fontSize: 16 }} />
      case 'ready_for_approval': return <Schedule sx={{ fontSize: 16 }} />
      case 'approved': return <CheckCircle sx={{ fontSize: 16 }} />
      case 'rejected': return <Cancel sx={{ fontSize: 16 }} />
      default: return <Assignment sx={{ fontSize: 16 }} />
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'available': return 'Available'
      case 'assigned': return 'In Progress'
      case 'ready_for_approval': return 'Pending Review'
      case 'approved': return 'Approved'
      case 'rejected': return 'Rejected'
      default: return status
    }
  }

  const formatTooltipContent = (rack: Rack) => {
    const lines = [
      `Rack: ${rack.rack_number}`,
      `Status: ${getStatusLabel(rack.status)}`,
    ]
    
    if (rack.scanner_name && rack.status !== 'available') {
      lines.push(`Scanner: ${rack.scanner_name}`)
    }
    
    if (rack.assigned_at) {
      lines.push(`Started: ${new Date(rack.assigned_at).toLocaleString()}`)
    }
    
    // Add click hint for viewable racks
    if (isRackViewable(rack)) {
      lines.push('Click to view details')
    }
    
    return lines.join('\n')
  }

  const isRackViewable = (rack: Rack) => {
    // Only racks that are ready for approval, approved, or rejected have scan data to view
    return ['ready_for_approval', 'approved', 'rejected'].includes(rack.status)
  }

  const handleRackClick = (rack: Rack) => {
    if (isRackViewable(rack)) {
      router.push(`/dashboard/approvals/${rack.id}`)
    }
  }

  const statusCounts = racks.reduce((acc, rack) => {
    acc[rack.status] = (acc[rack.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

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
          <Assignment />
          Rack Status Map
        </Typography>
        
        {/* Status Legend */}
        <Box sx={{ mb: 3, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {Object.entries(statusCounts).map(([status, count]) => (
            <Chip
              key={status}
              icon={getStatusIcon(status)}
              label={`${getStatusLabel(status)} (${count})`}
              size="small"
              sx={{
                backgroundColor: getStatusColor(status),
                color: status === 'available' ? '#000' : '#fff',
                '& .MuiChip-icon': {
                  color: status === 'available' ? '#000' : '#fff'
                }
              }}
            />
          ))}
        </Box>
        
        {/* Rack Grid */}
        <Grid container spacing={1}>
          {racks.map((rack) => (
            <Grid item xs={6} sm={4} md={3} lg={2} key={rack.id}>
              <Tooltip title={formatTooltipContent(rack)} placement="top">
                <Card
                  variant="outlined"
                  onClick={() => handleRackClick(rack)}
                  sx={{
                    minHeight: 80,
                    backgroundColor: getStatusColor(rack.status),
                    color: rack.status === 'available' ? '#000' : '#fff',
                    cursor: isRackViewable(rack) ? 'pointer' : 'default',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    position: 'relative',
                    '&:hover': {
                      transform: isRackViewable(rack) ? 'scale(1.05)' : 'scale(1.02)',
                      boxShadow: isRackViewable(rack) ? 3 : 1,
                    }
                  }}
                >
                  <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2" fontWeight="bold">
                        {(rack as any).audit_sessions?.shortname ? `${(rack as any).audit_sessions.shortname}-${rack.rack_number.padStart(3, '0')}` : rack.rack_number}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {isRackViewable(rack) && (
                          <Visibility sx={{ fontSize: 14, opacity: 0.7 }} />
                        )}
                        {getStatusIcon(rack.status)}
                      </Box>
                    </Box>
                    
                    <Typography variant="caption" display="block">
                      Scans: TBD
                    </Typography>
                    
                    {rack.scanner_name && rack.status !== 'available' && (
                      <Typography variant="caption" display="block" sx={{ 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {rack.scanner_name}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Tooltip>
            </Grid>
          ))}
        </Grid>
        
        {racks.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">
              No racks found. Create an audit session to generate racks.
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  )
}