'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  Container,
  Typography,
  Card,
  CardContent,
  Grid,
  Box,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Alert,
  CircularProgress,
  Paper,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  TextField,
  InputAdornment,
} from '@mui/material'
import {
  ArrowBack,
  Check,
  Delete,
  Refresh,
  Assignment,
  QrCode,
  Schedule,
  LocationOn,
  Search,
  Warning,
  PhotoCamera,
} from '@mui/icons-material'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

interface Scan {
  id: string
  barcode: string
  created_at: string
  manual_entry: boolean
  scanner_id: string
  rack_id: string
}

interface PartialDamage {
  id: string
  barcode: string
  damage_type: string
  severity: string
  remarks: string
  photo_count: number
  unit_ratio: string
}

interface Rack {
  id: string
  rack_number: string
  status: string
  location_id: number
  audit_session_id: string
}

interface Location {
  id: number
  name: string
  city: string
  state: string
}

export default function ReviewScansPage() {
  const router = useRouter()
  const params = useParams()
  const rackId = params.rackId as string
  
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [rack, setRack] = useState<Rack | null>(null)
  const [location, setLocation] = useState<Location | null>(null)
  const [scans, setScans] = useState<Scan[]>([])
  const [filteredScans, setFilteredScans] = useState<Scan[]>([])
  const [partialDamages, setPartialDamages] = useState<PartialDamage[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Dialog states
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; scan: Scan | null }>({
    open: false,
    scan: null
  })
  const [confirmDialog, setConfirmDialog] = useState(false)
  
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [rackId])

  // Filter scans based on search query
  useEffect(() => {
    const filtered = searchQuery.trim() === ''
      ? scans
      : scans.filter(scan => 
          scan.barcode.toLowerCase().includes(searchQuery.toLowerCase())
        )
    setFilteredScans(filtered)
  }, [scans, searchQuery])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Check authentication
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/auth/login')
        return
      }

      // Get user profile
      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('email', session.user.email)
        .single()

      if (profileError) throw profileError
      setCurrentUser(userProfile)

      // Load rack details
      const { data: rackData, error: rackError } = await supabase
        .from('racks')
        .select('*')
        .eq('id', rackId)
        .single()

      if (rackError) throw rackError
      setRack(rackData)

      // Load location details
      const { data: locationData, error: locationError } = await supabase
        .from('locations')
        .select('*')
        .eq('id', rackData.location_id)
        .single()

      if (locationError) throw locationError
      setLocation(locationData)

      // Load scans for this rack
      await loadScans()
      
      // Load partial damages for this rack
      await loadPartialDamages()
      
    } catch (error: any) {
      console.error('Error loading review data:', error)
      setError(error.message || 'Failed to load review data')
    } finally {
      setLoading(false)
    }
  }

  const loadScans = async () => {
    try {
      const { data, error } = await supabase
        .from('scans')
        .select('*')
        .eq('rack_id', rackId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setScans(data || [])
    } catch (error: any) {
      console.error('Error loading scans:', error)
      setError('Failed to load scans')
    }
  }

  const loadPartialDamages = async () => {
    try {
      const response = await fetch(`/api/partial-damage?sessionId=${rack?.audit_session_id}&rackId=${rackId}`)
      const result = await response.json()
      
      if (result.success) {
        setPartialDamages(result.data || [])
      } else {
        console.error('Failed to load partial damages:', result.error)
      }
    } catch (error: any) {
      console.error('Error loading partial damages:', error)
      // Don't set error state for partial damages as it's not critical
    }
  }

  const getPartialDamageForBarcode = (barcode: string): PartialDamage | undefined => {
    return partialDamages.find(pd => pd.barcode === barcode)
  }

  const handleDeleteClick = (scan: Scan) => {
    setDeleteDialog({ open: true, scan })
  }

  const handleDeleteConfirm = async () => {
    const scan = deleteDialog.scan
    if (!scan) return

    setDeleteDialog({ open: false, scan: null })
    setDeleting(prev => new Set(prev).add(scan.id))

    try {
      // Optimistic UI: remove from state immediately
      setScans(prev => prev.filter(s => s.id !== scan.id))

      // Delete from database
      const { error } = await supabase
        .from('scans')
        .delete()
        .eq('id', scan.id)
        .eq('scanner_id', currentUser.id) // Security: only delete own scans

      if (error) throw error

      console.log('Scan deleted successfully:', scan.id)
    } catch (error: any) {
      console.error('Delete failed:', error)
      // Restore scan to state on error
      loadScans()
      setError(`Failed to delete scan: ${error.message}`)
    } finally {
      setDeleting(prev => {
        const next = new Set(prev)
        next.delete(scan.id)
        return next
      })
    }
  }

  const handleSubmitForApproval = () => {
    if (scans.length === 0) {
      setError('You need to scan at least one item before submitting for approval.')
      return
    }
    setConfirmDialog(true)
  }

  const handleFinalSubmit = async () => {
    setConfirmDialog(false)
    setSubmitting(true)

    try {
      // Update rack status to ready_for_approval and clear scanner assignment
      const { error } = await supabase
        .from('racks')
        .update({ 
          status: 'ready_for_approval',
          ready_at: new Date().toISOString(),
          completed_at: new Date().toISOString()
        })
        .eq('id', rackId)

      if (error) throw error

      // Navigate back to scanning page - user can now select a new rack
      router.push('/dashboard/scanning')
    } catch (error: any) {
      console.error('Failed to submit for approval:', error)
      setError(`Failed to submit for approval: ${error.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  if (loading) {
    return (
      <DashboardLayout>
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
            <CircularProgress />
          </Box>
        </Container>
      </DashboardLayout>
    )
  }

  if (error && !rack) {
    return (
      <DashboardLayout>
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
          <Button
            startIcon={<ArrowBack />}
            onClick={() => router.push('/dashboard/scanning')}
          >
            Back to Scanning
          </Button>
        </Container>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Assignment sx={{ mr: 2, fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h4" component="h1">
            Review Your Scans
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* Header Info Card */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom color="primary">
                  Review Your Scans
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Last chance to make changes before sending to supervisor
                </Typography>
                
                <TableContainer sx={{ overflowX: 'auto' }}>
                  <Table size="small">
                    <TableBody>
                      <TableRow>
                        <TableCell><strong>Location:</strong></TableCell>
                        <TableCell>{location?.name}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell><strong>Rack:</strong></TableCell>
                        <TableCell>{rack?.rack_number}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell><strong>Total Scans:</strong></TableCell>
                        <TableCell>
                          <Chip 
                            label={scans.length} 
                            color="primary" 
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                      {partialDamages.length > 0 && (
                        <TableRow>
                          <TableCell><strong>Partial Damages:</strong></TableCell>
                          <TableCell>
                            <Chip 
                              label={partialDamages.length} 
                              color="warning" 
                              size="small"
                              icon={<Warning />}
                            />
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* Scans List Card */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">
                    Scanned Items ({filteredScans.length} of {scans.length})
                  </Typography>
                  <Button
                    startIcon={<Refresh />}
                    onClick={loadScans}
                    size="small"
                  >
                    Refresh
                  </Button>
                </Box>

                {/* Search Bar */}
                <Box sx={{ mb: 3 }}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Search by barcode..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Search />
                        </InputAdornment>
                      ),
                    }}
                  />
                  {searchQuery && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      Showing {filteredScans.length} of {scans.length} scans
                    </Typography>
                  )}
                </Box>

                {filteredScans.length === 0 ? (
                  <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'grey.50' }}>
                    <QrCode sx={{ fontSize: 48, color: 'grey.400', mb: 2 }} />
                    <Typography color="text.secondary">
                      {searchQuery ? `No scans matching "${searchQuery}"` : 'No scans yet'}
                    </Typography>
                  </Paper>
                ) : (
                  <List>
                    {filteredScans.map((scan, index) => {
                      const partialDamage = getPartialDamageForBarcode(scan.barcode)
                      return (
                        <Box key={scan.id}>
                          <ListItem
                            sx={{ 
                              bgcolor: index === 0 ? 'action.hover' : 'transparent',
                              borderRadius: 1,
                              mb: 0.5,
                              borderLeft: partialDamage ? '4px solid' : 'none',
                              borderLeftColor: partialDamage ? 'warning.main' : 'transparent'
                            }}
                          >
                            <Box sx={{ mr: 2 }}>
                              {scan.manual_entry ? (
                                <Typography sx={{ fontSize: 20 }}>⌨️</Typography>
                              ) : (
                                <QrCode color="success" />
                              )}
                            </Box>
                            <ListItemText
                              primary={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                  <Typography variant="body1" fontWeight="medium">
                                    {scan.barcode}
                                  </Typography>
                                  {partialDamage && (
                                    <Chip
                                      label="Partial Damage"
                                      color="warning"
                                      size="small"
                                      icon={<Warning />}
                                      title={`${partialDamage.damage_type} - ${partialDamage.severity}`}
                                    />
                                  )}
                                  {partialDamage && partialDamage.photo_count > 0 && (
                                    <Chip
                                      label={`${partialDamage.photo_count} photos`}
                                      color="info"
                                      size="small"
                                      icon={<PhotoCamera />}
                                    />
                                  )}
                                </Box>
                              }
                              secondary={
                                <Box>
                                  <Typography variant="caption" color="text.secondary">
                                    {formatDateTime(scan.created_at)}
                                  </Typography>
                                  {partialDamage && (
                                    <Typography variant="caption" color="warning.main" sx={{ display: 'block' }}>
                                      {partialDamage.remarks}
                                      {partialDamage.unit_ratio !== 'N/A' && ` (${partialDamage.unit_ratio})`}
                                    </Typography>
                                  )}
                                </Box>
                              }
                            />
                            <ListItemSecondaryAction>
                              <IconButton
                                edge="end"
                                onClick={() => handleDeleteClick(scan)}
                                disabled={deleting.has(scan.id)}
                                sx={{ 
                                  bgcolor: 'error.light',
                                  color: 'error.contrastText',
                                  '&:hover': { bgcolor: 'error.main' },
                                  '&:disabled': { opacity: 0.5 }
                                }}
                              >
                                <Typography sx={{ fontSize: 20 }}>🗑️</Typography>
                              </IconButton>
                            </ListItemSecondaryAction>
                          </ListItem>
                          {index < filteredScans.length - 1 && <Divider />}
                        </Box>
                      )
                    })}
                  </List>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Action Buttons */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button
                variant="outlined"
                startIcon={<ArrowBack />}
                onClick={() => router.push('/dashboard/scanning')}
                size="large"
              >
                Back to Scanning
              </Button>
              <Button
                variant="contained"
                startIcon={submitting ? <CircularProgress size={20} color="inherit" /> : <Check />}
                onClick={handleSubmitForApproval}
                disabled={scans.length === 0 || submitting}
                size="large"
                sx={{ minWidth: 200 }}
              >
                {submitting ? 'Submitting...' : 'Confirm Ready for Approval'}
              </Button>
            </Box>
          </Grid>
        </Grid>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, scan: null })}>
          <DialogTitle>Delete Scan</DialogTitle>
          <DialogContent>
            <Typography>
              Remove scan: <strong>{deleteDialog.scan?.barcode}</strong>?
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialog({ open: false, scan: null })}>
              Cancel
            </Button>
            <Button onClick={handleDeleteConfirm} color="error" variant="contained">
              Delete
            </Button>
          </DialogActions>
        </Dialog>

        {/* Final Confirmation Dialog */}
        <Dialog open={confirmDialog} onClose={() => setConfirmDialog(false)}>
          <DialogTitle>Confirm Ready for Approval</DialogTitle>
          <DialogContent>
            <Typography gutterBottom>
              Send rack <strong>{rack?.rack_number}</strong> with <strong>{scans.length}</strong> scans to supervisor for approval?
            </Typography>
            <Typography variant="body2" color="warning.main">
              Once submitted, you cannot make further changes.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleFinalSubmit} variant="contained" color="primary">
              Confirm
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </DashboardLayout>
  )
}