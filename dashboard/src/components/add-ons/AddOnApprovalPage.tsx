'use client'

import { useState, useEffect } from 'react'
import {
  Typography,
  Card,
  CardContent,
  Grid,
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Snackbar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material'
import {
  Gavel,
  CheckCircle,
  Cancel,
  Visibility,
  FilterList,
  Refresh,
} from '@mui/icons-material'
import { createClient } from '@/lib/supabase'

interface AddOnItem {
  id: string
  brand: string
  item_name: string
  quantity: number
  reason: string
  cost_price: number | null
  selling_price: number | null
  image_url: string | null
  status: 'pending' | 'approved' | 'rejected'
  reported_by: {
    username: string
    full_name: string | null
  }
  reported_at: string
  reviewed_by: {
    username: string
    full_name: string | null
  } | null
  reviewed_at: string | null
  rejection_reason: string | null
  audit_sessions: {
    id: string
    shortname: string | null
    locations: {
      name: string
    }
  }
}

interface AddOnApprovalPageProps {
  currentUser: any
}

export default function AddOnApprovalPage({ currentUser }: AddOnApprovalPageProps) {
  const [addOns, setAddOns] = useState<AddOnItem[]>([])
  const [filteredAddOns, setFilteredAddOns] = useState<AddOnItem[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('pending')
  
  // Dialog states
  const [imageDialog, setImageDialog] = useState<{ open: boolean; url: string | null }>({
    open: false,
    url: null
  })
  const [approvalDialog, setApprovalDialog] = useState<{ open: boolean; addOn: AddOnItem | null }>({
    open: false,
    addOn: null
  })
  const [rejectionDialog, setRejectionDialog] = useState<{ 
    open: boolean 
    addOn: AddOnItem | null
    reason: string 
  }>({
    open: false,
    addOn: null,
    reason: ''
  })
  
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error'
  })

  const supabase = createClient()

  useEffect(() => {
    loadAddOns()
  }, [])

  useEffect(() => {
    filterAddOns()
  }, [addOns, statusFilter])

  const loadAddOns = async () => {
    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('add_on_items')
        .select(`
          *,
          reported_by:users!add_on_items_reported_by_fkey(username, full_name),
          reviewed_by:users!add_on_items_reviewed_by_fkey(username, full_name),
          audit_sessions(
            id,
            shortname,
            locations(name)
          )
        `)
        .order('reported_at', { ascending: false })

      if (error) throw error
      
      setAddOns(data || [])
    } catch (error: any) {
      console.error('Error loading add-ons:', error)
      setSnackbar({
        open: true,
        message: `Failed to load add-ons: ${error.message}`,
        severity: 'error'
      })
    } finally {
      setLoading(false)
    }
  }

  const filterAddOns = () => {
    let filtered = addOns
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(addOn => addOn.status === statusFilter)
    }
    
    setFilteredAddOns(filtered)
  }

  const handleApprove = async () => {
    const addOn = approvalDialog.addOn
    if (!addOn || !currentUser) return

    try {
      const { error } = await supabase
        .from('add_on_items')
        .update({
          status: 'approved',
          reviewed_by: currentUser.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', addOn.id)

      if (error) throw error

      setSnackbar({
        open: true,
        message: 'Add-on approved successfully',
        severity: 'success'
      })

      setApprovalDialog({ open: false, addOn: null })
      loadAddOns() // Refresh data

    } catch (error: any) {
      console.error('Error approving add-on:', error)
      setSnackbar({
        open: true,
        message: `Failed to approve add-on: ${error.message}`,
        severity: 'error'
      })
    }
  }

  const handleReject = async () => {
    const { addOn, reason } = rejectionDialog
    if (!addOn || !currentUser || !reason.trim()) return

    try {
      const { error } = await supabase
        .from('add_on_items')
        .update({
          status: 'rejected',
          reviewed_by: currentUser.id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: reason.trim()
        })
        .eq('id', addOn.id)

      if (error) throw error

      setSnackbar({
        open: true,
        message: 'Add-on rejected successfully',
        severity: 'success'
      })

      setRejectionDialog({ open: false, addOn: null, reason: '' })
      loadAddOns() // Refresh data

    } catch (error: any) {
      console.error('Error rejecting add-on:', error)
      setSnackbar({
        open: true,
        message: `Failed to reject add-on: ${error.message}`,
        severity: 'error'
      })
    }
  }

  const formatCurrency = (amount: number | null) => {
    return amount ? `₹${amount.toFixed(2)}` : 'N/A'
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'warning'
      case 'approved': return 'success' 
      case 'rejected': return 'error'
      default: return 'default'
    }
  }

  if (!currentUser || currentUser.role !== 'superuser') {
    return (
      <Alert severity="warning">
        Only super users can approve add-on requests.
      </Alert>
    )
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Gavel />
          Add-On Approvals
        </Typography>
        
        <Button
          startIcon={<Refresh />}
          onClick={loadAddOns}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <FilterList />
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="approved">Approved</MenuItem>
                <MenuItem value="rejected">Rejected</MenuItem>
                <MenuItem value="all">All</MenuItem>
              </Select>
            </FormControl>
            
            <Typography variant="body2" color="text.secondary">
              Showing {filteredAddOns.length} of {addOns.length} add-ons
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* Add-Ons Table */}
      <Card>
        <CardContent>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Item Details</TableCell>
                  <TableCell>Quantity</TableCell>
                  <TableCell>Pricing</TableCell>
                  <TableCell>Reporter</TableCell>
                  <TableCell>Session</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredAddOns.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Typography color="text.secondary" sx={{ py: 4 }}>
                        {loading ? 'Loading add-ons...' : 'No add-ons found'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAddOns.map((addOn) => (
                    <TableRow key={addOn.id} hover>
                      <TableCell>
                        <Box>
                          <Typography variant="subtitle2" fontWeight="bold">
                            {addOn.brand} - {addOn.item_name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" noWrap>
                            {addOn.reason}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Reported: {new Date(addOn.reported_at).toLocaleDateString()}
                          </Typography>
                        </Box>
                      </TableCell>
                      
                      <TableCell>
                        <Chip label={addOn.quantity} size="small" />
                      </TableCell>
                      
                      <TableCell>
                        <Typography variant="body2">
                          CP: {formatCurrency(addOn.cost_price)}
                        </Typography>
                        <Typography variant="body2">
                          SP: {formatCurrency(addOn.selling_price)}
                        </Typography>
                      </TableCell>
                      
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ width: 24, height: 24, fontSize: '0.75rem' }}>
                            {(addOn.reported_by.full_name || addOn.reported_by.username).charAt(0)}
                          </Avatar>
                          <Typography variant="body2">
                            {addOn.reported_by.full_name || addOn.reported_by.username}
                          </Typography>
                        </Box>
                      </TableCell>
                      
                      <TableCell>
                        <Typography variant="body2">
                          {addOn.audit_sessions.shortname || 'N/A'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {addOn.audit_sessions.locations.name}
                        </Typography>
                      </TableCell>
                      
                      <TableCell>
                        <Chip
                          label={addOn.status.toUpperCase()}
                          size="small"
                          color={getStatusColor(addOn.status) as any}
                        />
                        {addOn.status === 'rejected' && addOn.rejection_reason && (
                          <Typography variant="caption" display="block" color="error">
                            {addOn.rejection_reason}
                          </Typography>
                        )}
                      </TableCell>
                      
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          {addOn.image_url && (
                            <Button
                              size="small"
                              startIcon={<Visibility />}
                              onClick={() => setImageDialog({ open: true, url: addOn.image_url })}
                            >
                              Image
                            </Button>
                          )}
                          
                          {addOn.status === 'pending' && (
                            <>
                              <Button
                                size="small"
                                color="success"
                                startIcon={<CheckCircle />}
                                onClick={() => setApprovalDialog({ open: true, addOn })}
                              >
                                Approve
                              </Button>
                              <Button
                                size="small"
                                color="error"
                                startIcon={<Cancel />}
                                onClick={() => setRejectionDialog({ open: true, addOn, reason: '' })}
                              >
                                Reject
                              </Button>
                            </>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Image Preview Dialog */}
      <Dialog 
        open={imageDialog.open} 
        onClose={() => setImageDialog({ open: false, url: null })}
        maxWidth="md"
      >
        <DialogTitle>Product Image</DialogTitle>
        <DialogContent>
          {imageDialog.url && (
            <img
              src={imageDialog.url}
              alt="Product"
              style={{ width: '100%', height: 'auto' }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImageDialog({ open: false, url: null })}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Approval Confirmation Dialog */}
      <Dialog 
        open={approvalDialog.open} 
        onClose={() => setApprovalDialog({ open: false, addOn: null })}
      >
        <DialogTitle>Approve Add-On</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Approve add-on for <strong>{approvalDialog.addOn?.brand} - {approvalDialog.addOn?.item_name}</strong>?
          </Typography>
          <Typography variant="body2" color="text.secondary">
            This will mark the add-on as approved for manual processing.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApprovalDialog({ open: false, addOn: null })}>
            Cancel
          </Button>
          <Button onClick={handleApprove} variant="contained" color="success">
            Approve
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rejection Dialog */}
      <Dialog 
        open={rejectionDialog.open} 
        onClose={() => setRejectionDialog({ open: false, addOn: null, reason: '' })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Reject Add-On</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Reject add-on for <strong>{rejectionDialog.addOn?.brand} - {rejectionDialog.addOn?.item_name}</strong>?
          </Typography>
          <TextField
            autoFocus
            fullWidth
            multiline
            rows={3}
            label="Rejection Reason"
            placeholder="Explain why this add-on is being rejected..."
            value={rejectionDialog.reason}
            onChange={(e) => setRejectionDialog({...rejectionDialog, reason: e.target.value})}
            required
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectionDialog({ open: false, addOn: null, reason: '' })}>
            Cancel
          </Button>
          <Button 
            onClick={handleReject}
            variant="contained" 
            color="error"
            disabled={!rejectionDialog.reason.trim()}
          >
            Reject
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({...snackbar, open: false})}
      >
        <Alert 
          severity={snackbar.severity}
          onClose={() => setSnackbar({...snackbar, open: false})}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}