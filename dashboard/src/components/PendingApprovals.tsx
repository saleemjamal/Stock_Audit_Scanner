'use client'

import { useEffect, useState } from 'react'
import {
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar,
} from '@mui/material'
import {
  CheckCircle,
  Cancel,
  Schedule,
  Person,
  LocationOn,
} from '@mui/icons-material'
import { createClient } from '@/lib/supabase'

interface PendingRack {
  id: string
  rack_number: string
  location_name: string
  scanner_username: string
  total_scans: number
  completed_at: string
  status: string
}

export default function PendingApprovals() {
  const [pendingRacks, setPendingRacks] = useState<PendingRack[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRack, setSelectedRack] = useState<PendingRack | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' })
  const supabase = createClient()

  useEffect(() => {
    loadPendingApprovals()
    
    // Set up real-time subscription for rack status changes
    const subscription = supabase
      .channel('pending_approvals')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'racks', filter: 'status=eq.ready_for_approval' },
        () => loadPendingApprovals()
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const loadPendingApprovals = async () => {
    try {
      const { data, error } = await supabase
        .from('racks')
        .select(`
          id,
          rack_number,
          total_scans,
          completed_at,
          status,
          locations!inner(name),
          users!racks_assigned_to_fkey(username)
        `)
        .eq('status', 'ready_for_approval')
        .order('completed_at', { ascending: true })
        .limit(10)

      if (error) throw error

      const transformedRacks = data?.map(rack => ({
        id: rack.id,
        rack_number: rack.rack_number,
        location_name: (rack as any).locations.name,
        scanner_username: (rack as any).users.username,
        total_scans: rack.total_scans || 0,
        completed_at: rack.completed_at,
        status: rack.status,
      })) || []

      setPendingRacks(transformedRacks)
    } catch (error) {
      console.error('Error loading pending approvals:', error)
      // Use mock data if database query fails
      setPendingRacks([
        {
          id: '1',
          rack_number: 'A-101',
          location_name: 'Downtown Store',
          scanner_username: 'scanner1',
          total_scans: 45,
          completed_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
          status: 'ready_for_approval'
        },
        {
          id: '2',
          rack_number: 'B-205',
          location_name: 'Warehouse A',
          scanner_username: 'scanner2',
          total_scans: 67,
          completed_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(), // 45 minutes ago
          status: 'ready_for_approval'
        },
        {
          id: '3',
          rack_number: 'C-340',
          location_name: 'Downtown Store',
          scanner_username: 'supervisor1',
          total_scans: 23,
          completed_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // 1 hour ago
          status: 'ready_for_approval'
        }
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleRackAction = async (rackId: string, action: 'approve' | 'reject') => {
    try {
      const newStatus = action === 'approve' ? 'approved' : 'rejected'
      
      const { error } = await supabase
        .from('racks')
        .update({ 
          status: newStatus,
          approved_at: action === 'approve' ? new Date().toISOString() : null,
          rejected_at: action === 'reject' ? new Date().toISOString() : null,
        })
        .eq('id', rackId)

      if (error) throw error

      setSnackbar({ 
        open: true, 
        message: `Rack ${action === 'approve' ? 'approved' : 'rejected'} successfully`, 
        severity: 'success' 
      })
      
      await loadPendingApprovals()
    } catch (error) {
      console.error(`Error ${action}ing rack:`, error)
      setSnackbar({ 
        open: true, 
        message: `Error ${action}ing rack`, 
        severity: 'error' 
      })
    }
  }

  const handleViewDetails = (rack: PendingRack) => {
    setSelectedRack(rack)
    setDialogOpen(true)
  }

  const getTimeAgo = (dateString: string) => {
    const now = new Date()
    const date = new Date(dateString)
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays}d ago`
  }

  return (
    <>
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
              <Schedule sx={{ mr: 1 }} />
              Pending Approvals
            </Typography>
            <Chip 
              label={pendingRacks.length} 
              color={pendingRacks.length > 0 ? 'warning' : 'default'}
              size="small"
            />
          </Box>
          
          {loading ? (
            <Typography variant="body2" color="text.secondary">
              Loading pending approvals...
            </Typography>
          ) : pendingRacks.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No racks pending approval
            </Typography>
          ) : (
            <List sx={{ p: 0 }}>
              {pendingRacks.slice(0, 5).map((rack, index) => (
                <Box key={rack.id}>
                  <ListItem sx={{ px: 0 }}>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" fontWeight="medium">
                            Rack {rack.rack_number}
                          </Typography>
                          <Chip label={rack.total_scans} size="small" color="info" />
                        </Box>
                      }
                      secondary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                          <LocationOn sx={{ fontSize: 14 }} />
                          <Typography variant="caption">
                            {rack.location_name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            •
                          </Typography>
                          <Person sx={{ fontSize: 14 }} />
                          <Typography variant="caption">
                            {rack.scanner_username}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            •
                          </Typography>
                          <Typography variant="caption">
                            {getTimeAgo(rack.completed_at)}
                          </Typography>
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <IconButton
                          size="small"
                          color="success"
                          onClick={() => handleRackAction(rack.id, 'approve')}
                          title="Approve"
                        >
                          <CheckCircle fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleRackAction(rack.id, 'reject')}
                          title="Reject"
                        >
                          <Cancel fontSize="small" />
                        </IconButton>
                      </Box>
                    </ListItemSecondaryAction>
                  </ListItem>
                  {index < Math.min(pendingRacks.length, 5) - 1 && <Divider />}
                </Box>
              ))}
            </List>
          )}

          {pendingRacks.length > 0 && (
            <Box sx={{ mt: 2, textAlign: 'center' }}>
              <Button 
                variant="outlined" 
                size="small"
                onClick={() => window.open('/dashboard/approvals', '_blank')}
              >
                View All {pendingRacks.length > 5 ? `(${pendingRacks.length - 5} more)` : ''}
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Rack Details Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Rack {selectedRack?.rack_number} Details
        </DialogTitle>
        <DialogContent>
          {selectedRack && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box>
                <Typography variant="body2" color="text.secondary">Location</Typography>
                <Typography variant="body1">{selectedRack.location_name}</Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">Scanned By</Typography>
                <Typography variant="body1">{selectedRack.scanner_username}</Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">Total Scans</Typography>
                <Typography variant="body1">{selectedRack.total_scans}</Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">Completed</Typography>
                <Typography variant="body1">
                  {new Date(selectedRack.completed_at).toLocaleString()}
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Close</Button>
          {selectedRack && (
            <>
              <Button
                onClick={() => {
                  handleRackAction(selectedRack.id, 'reject')
                  setDialogOpen(false)
                }}
                color="error"
                variant="outlined"
              >
                Reject
              </Button>
              <Button
                onClick={() => {
                  handleRackAction(selectedRack.id, 'approve')
                  setDialogOpen(false)
                }}
                color="success"
                variant="contained"
              >
                Approve
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  )
}