'use client'

// Force dynamic rendering at runtime - this is a client component
// These exports ensure the page is never statically generated
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const revalidate = 0

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Alert,
  Snackbar,
  TextField,
  InputAdornment,
  CircularProgress,
  Divider,
  Grid,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material'
import {
  CheckCircle,
  Cancel,
  ArrowBack,
  Search,
  Schedule,
  Person,
  LocationOn,
  Storage,
  GridView,
  ViewList,
  FilterList,
} from '@mui/icons-material'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

interface RackDetail {
  id: string
  rack_number: string
  location_id: number
  location_name: string
  scanner_id: string
  scanner_username: string
  total_scans: number
  status: string
  created_at: string
  completed_at?: string
  audit_session_id: string
}

interface ScanDetail {
  id: string
  barcode: string
  created_at: string
  manual_entry: boolean
  quantity: number
  notes?: string
}

type ViewMode = 'list' | 'grid' | 'compact'

function RackDetailPageContent() {
  const params = useParams()
  const router = useRouter()
  const rackId = params.rackId as string
  
  const [rack, setRack] = useState<RackDetail | null>(null)
  const [scans, setScans] = useState<ScanDetail[]>([])
  const [filteredScans, setFilteredScans] = useState<ScanDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('compact')
  const [showManualOnly, setShowManualOnly] = useState(false)
  
  const [snackbar, setSnackbar] = useState({ 
    open: false, 
    message: '', 
    severity: 'success' as 'success' | 'error' 
  })
  const [rejectionDialog, setRejectionDialog] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  
  const supabase = createClient()

  useEffect(() => {
    if (rackId) {
      loadRackDetails()
    }
  }, [rackId])

  useEffect(() => {
    // Filter scans based on search term and filters
    let filtered = scans.filter(scan => 
      scan.barcode.toLowerCase().includes(searchTerm.toLowerCase())
    )

    if (showManualOnly) {
      filtered = filtered.filter(scan => scan.manual_entry)
    }

    setFilteredScans(filtered)
  }, [scans, searchTerm, showManualOnly])

  const loadRackDetails = async () => {
    try {
      setLoading(true)

      // Get rack details
      const { data: rackData, error: rackError } = await supabase
        .from('racks')
        .select('*')
        .eq('id', rackId)
        .single()

      if (rackError) throw rackError
      if (!rackData) throw new Error('Rack not found')

      // Get location name
      const { data: location } = await supabase
        .from('locations')
        .select('name')
        .eq('id', rackData.location_id)
        .single()

      // Get scanner details
      const { data: scanner } = await supabase
        .from('users')
        .select('username, email')
        .eq('id', rackData.scanner_id)
        .single()

      // Combine rack details
      const rackDetail: RackDetail = {
        ...rackData,
        location_name: location?.name || 'Unknown Location',
        scanner_username: scanner?.username || scanner?.email || 'Unknown Scanner',
      }

      setRack(rackDetail)

      // Get all scans for this rack
      const { data: scansData, error: scansError } = await supabase
        .from('scans')
        .select('*')
        .eq('rack_id', rackId)
        .order('created_at', { ascending: false })

      if (scansError) throw scansError

      setScans(scansData || [])
    } catch (error: any) {
      console.error('Error loading rack details:', error)
      setSnackbar({ 
        open: true, 
        message: error.message || 'Failed to load rack details', 
        severity: 'error' 
      })
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async () => {
    if (!rack) return

    const confirmed = confirm(
      `Are you sure you want to approve rack ${rack.rack_number} with ${rack.total_scans} scans?`
    )
    if (!confirmed) return

    setProcessing(true)
    try {
      const timestamp = new Date().toISOString()
      
      const { error } = await supabase
        .from('racks')
        .update({ 
          status: 'approved',
          approved_at: timestamp,
        })
        .eq('id', rackId)

      if (error) throw error

      setSnackbar({ 
        open: true, 
        message: 'Rack approved successfully', 
        severity: 'success' 
      })
      
      // Navigate back to approvals list after a brief delay
      setTimeout(() => {
        router.push('/dashboard/approvals')
      }, 1000)

    } catch (error: any) {
      console.error('Error approving rack:', error)
      setSnackbar({ 
        open: true, 
        message: 'Failed to approve rack', 
        severity: 'error' 
      })
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = () => {
    setRejectionDialog(true)
    setRejectionReason('')
  }

  const handleRejectionWithReason = async () => {
    if (!rack) return

    setProcessing(true)
    try {
      const timestamp = new Date().toISOString()
      
      const { error } = await supabase
        .from('racks')
        .update({ 
          status: 'rejected',
          rejection_reason: rejectionReason.trim(),
          rejected_at: timestamp,
        })
        .eq('id', rackId)

      if (error) throw error

      setSnackbar({ 
        open: true, 
        message: 'Rack rejected successfully', 
        severity: 'success' 
      })
      
      // Close dialog
      setRejectionDialog(false)
      setRejectionReason('')
      
      // Navigate back to approvals list after a brief delay
      setTimeout(() => {
        router.push('/dashboard/approvals')
      }, 1000)

    } catch (error: any) {
      console.error('Error rejecting rack:', error)
      setSnackbar({ 
        open: true, 
        message: 'Failed to reject rack', 
        severity: 'error' 
      })
    } finally {
      setProcessing(false)
    }
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const getScanStats = () => {
    const totalScans = scans.length
    const manualScans = scans.filter(s => s.manual_entry).length
    const autoScans = totalScans - manualScans
    
    if (totalScans === 0) return null

    const firstScan = scans[scans.length - 1]
    const lastScan = scans[0]
    const duration = new Date(lastScan.created_at).getTime() - new Date(firstScan.created_at).getTime()
    const hours = duration / (1000 * 60 * 60)
    const scansPerHour = hours > 0 ? Math.round(totalScans / hours) : 0

    return {
      totalScans,
      manualScans,
      autoScans,
      scansPerHour,
      timeRange: `${formatDateTime(firstScan.created_at)} - ${formatDateTime(lastScan.created_at)}`
    }
  }

  const stats = getScanStats()

  if (loading) {
    return (
      <DashboardLayout>
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
          <Box display="flex" justifyContent="center" p={4}>
            <CircularProgress />
          </Box>
        </Container>
      </DashboardLayout>
    )
  }

  if (!rack) {
    return (
      <DashboardLayout>
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
          <Alert severity="error">
            Rack not found or you don't have permission to view it.
          </Alert>
          <Box sx={{ mt: 2 }}>
            <Button
              startIcon={<ArrowBack />}
              onClick={() => router.push('/dashboard/approvals')}
            >
              Back to Approvals
            </Button>
          </Box>
        </Container>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={() => router.push('/dashboard/approvals')} sx={{ mr: 1 }}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h4" component="h1" sx={{ flexGrow: 1 }}>
            Rack {rack.rack_number} Details
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              color="error"
              startIcon={<Cancel />}
              onClick={handleReject}
              disabled={processing}
            >
              Reject
            </Button>
            <Button
              variant="contained"
              color="success"
              startIcon={<CheckCircle />}
              onClick={handleApprove}
              disabled={processing}
            >
              Approve
            </Button>
          </Box>
        </Box>

        <Grid container spacing={3}>
          {/* Rack Information */}
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Rack Information
                </Typography>
                <Divider sx={{ mb: 2 }} />
                
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Storage sx={{ mr: 1, color: 'action.active' }} />
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Rack Number
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {rack.rack_number}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <LocationOn sx={{ mr: 1, color: 'action.active' }} />
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Location
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {rack.location_name}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Person sx={{ mr: 1, color: 'action.active' }} />
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Scanned By
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {rack.scanner_username}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Schedule sx={{ mr: 1, color: 'action.active' }} />
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Completed
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {formatDateTime(rack.completed_at || rack.created_at)}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ mt: 2 }}>
                  <Chip 
                    label={rack.status.replace('_', ' ').toUpperCase()}
                    color="warning"
                    sx={{ textTransform: 'capitalize' }}
                  />
                </Box>
              </CardContent>
            </Card>

            {/* Statistics */}
            {stats && (
              <Card sx={{ mt: 2 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Scan Statistics
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  
                  <Box sx={{ mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Total Scans
                    </Typography>
                    <Typography variant="h5" color="primary.main" fontWeight="bold">
                      {stats.totalScans}
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Auto Scanned
                      </Typography>
                      <Typography variant="body1" fontWeight="medium">
                        {stats.autoScans}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Manual Entry
                      </Typography>
                      <Typography variant="body1" fontWeight="medium" color="warning.main">
                        {stats.manualScans}
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Scanning Speed
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {stats.scansPerHour} items/hour
                    </Typography>
                  </Box>

                  <Typography variant="caption" color="text.secondary">
                    Time Range: {stats.timeRange}
                  </Typography>
                </CardContent>
              </Card>
            )}
          </Grid>

          {/* Scans List */}
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">
                    Scanned Items ({filteredScans.length} of {scans.length})
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <IconButton
                      size="small"
                      color={viewMode === 'compact' ? 'primary' : 'default'}
                      onClick={() => setViewMode('compact')}
                    >
                      <ViewList />
                    </IconButton>
                    <IconButton
                      size="small"
                      color={viewMode === 'list' ? 'primary' : 'default'}
                      onClick={() => setViewMode('list')}
                    >
                      <GridView />
                    </IconButton>
                  </Box>
                </Box>

                {/* Search and Filters */}
                <Box sx={{ mb: 3 }}>
                  <TextField
                    fullWidth
                    placeholder="Search barcodes..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    size="small"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Search />
                        </InputAdornment>
                      ),
                    }}
                    sx={{ mb: 2 }}
                  />
                  
                  <Button
                    size="small"
                    variant={showManualOnly ? 'contained' : 'outlined'}
                    startIcon={<FilterList />}
                    onClick={() => setShowManualOnly(!showManualOnly)}
                  >
                    Manual Entry Only ({scans.filter(s => s.manual_entry).length})
                  </Button>
                </Box>

                {/* Scans Display */}
                {filteredScans.length === 0 ? (
                  <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                    {searchTerm || showManualOnly ? 'No scans match your filters' : 'No scans found'}
                  </Typography>
                ) : viewMode === 'compact' ? (
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Barcode</TableCell>
                          <TableCell>Scanned At</TableCell>
                          <TableCell align="center">Type</TableCell>
                          <TableCell align="center">Qty</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filteredScans.map((scan) => (
                          <TableRow key={scan.id} hover>
                            <TableCell>
                              <Typography variant="body2" fontFamily="monospace">
                                {scan.barcode}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="caption">
                                {formatDateTime(scan.created_at)}
                              </Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Chip 
                                label={scan.manual_entry ? 'Manual' : 'Scanned'}
                                size="small"
                                color={scan.manual_entry ? 'warning' : 'default'}
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell align="center">
                              {scan.quantity || 1}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <List>
                    {filteredScans.map((scan, index) => (
                      <ListItem
                        key={scan.id}
                        divider={index < filteredScans.length - 1}
                        sx={{ px: 0 }}
                      >
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body1" fontFamily="monospace" fontWeight="medium">
                                {scan.barcode}
                              </Typography>
                              <Chip 
                                label={scan.manual_entry ? 'Manual' : 'Scanned'}
                                size="small"
                                color={scan.manual_entry ? 'warning' : 'default'}
                                variant="outlined"
                              />
                            </Box>
                          }
                          secondary={
                            <Box sx={{ mt: 0.5 }}>
                              <Typography variant="caption" color="text.secondary">
                                {formatDateTime(scan.created_at)} • Qty: {scan.quantity || 1}
                              </Typography>
                              {scan.notes && (
                                <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                                  Notes: {scan.notes}
                                </Typography>
                              )}
                            </Box>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Sticky Action Bar for Mobile */}
        <Box sx={{ 
          display: { xs: 'flex', md: 'none' }, 
          position: 'fixed', 
          bottom: 16, 
          left: 16, 
          right: 16, 
          gap: 1,
          zIndex: 1000 
        }}>
          <Button
            fullWidth
            variant="outlined"
            color="error"
            startIcon={<Cancel />}
            onClick={handleReject}
            disabled={processing}
            sx={{ bgcolor: 'background.paper' }}
          >
            Reject
          </Button>
          <Button
            fullWidth
            variant="contained"
            color="success"
            startIcon={<CheckCircle />}
            onClick={handleApprove}
            disabled={processing}
          >
            Approve
          </Button>
        </Box>

        {/* Rejection Dialog */}
        <Dialog 
          open={rejectionDialog} 
          onClose={() => setRejectionDialog(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Reject Rack {rack?.rack_number}</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Please specify what needs to be corrected so the scanner knows how to fix it.
            </Typography>
            <TextField
              autoFocus
              fullWidth
              multiline
              rows={3}
              label="Rejection Reason"
              placeholder="e.g., Missing items from back shelf, incorrect quantities, damaged items not noted..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              required
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRejectionDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleRejectionWithReason}
              color="error" 
              variant="contained"
              disabled={!rejectionReason.trim()}
            >
              Reject Rack
            </Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          <Alert 
            severity={snackbar.severity} 
            onClose={() => setSnackbar({ ...snackbar, open: false })}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Container>
    </DashboardLayout>
  )
}

// Error boundary wrapper and default export
export default function RackDetailPage() {
  try {
    return <RackDetailPageContent />
  } catch (error) {
    console.error('Error rendering rack details:', error)
    return (
      <DashboardLayout>
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
          <Alert severity="error">
            <Typography variant="h6">Error Loading Rack Details</Typography>
            <Typography variant="body2">
              An error occurred while loading the rack details. Please try refreshing the page or contact support if the issue persists.
            </Typography>
          </Alert>
          <Box sx={{ mt: 2 }}>
            <Button
              startIcon={<ArrowBack />}
              onClick={() => window.location.href = '/dashboard/approvals'}
              variant="contained"
            >
              Back to Approvals
            </Button>
          </Box>
        </Container>
      </DashboardLayout>
    )
  }
}