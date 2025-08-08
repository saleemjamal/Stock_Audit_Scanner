'use client'

import { useEffect, useState } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Switch,
  FormControlLabel,
  Alert,
  Snackbar,
} from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  LocationOn,
} from '@mui/icons-material'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

interface Location {
  id: string
  name: string
  address: string
  city: string
  state: string
  active: boolean
  created_at: string
}

interface LocationFormData {
  name: string
  address: string
  city: string
  state: string
  active: boolean
}

const initialFormData: LocationFormData = {
  name: '',
  address: '',
  city: '',
  state: '',
  active: true,
}

export default function LocationsPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingLocation, setEditingLocation] = useState<Location | null>(null)
  const [formData, setFormData] = useState<LocationFormData>(initialFormData)
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' })
  const supabase = createClient()

  useEffect(() => {
    checkAuthAndLoadData()
  }, [])

  const checkAuthAndLoadData = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error || !session) {
        router.push('/auth/login')
        return
      }

      // Get user profile
      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('email', session.user.email)
        .single()

      if (profileError || !userProfile) {
        router.push('/auth/login')
        return
      }

      // Only allow superusers
      if (userProfile.role !== 'superuser') {
        router.push('/dashboard?error=insufficient_permissions')
        return
      }

      setCurrentUser(userProfile)
      await loadLocations()
    } catch (error) {
      console.error('Auth check error:', error)
      router.push('/auth/login')
    } finally {
      setLoading(false)
    }
  }

  const loadLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .order('name')

      if (error) throw error
      setLocations(data || [])
    } catch (error) {
      console.error('Error loading locations:', error)
      setSnackbar({ open: true, message: 'Error loading locations', severity: 'error' })
    }
  }

  const handleOpenDialog = (location?: Location) => {
    if (location) {
      setEditingLocation(location)
      setFormData({
        name: location.name,
        address: location.address,
        city: location.city,
        state: location.state,
        active: location.active,
      })
    } else {
      setEditingLocation(null)
      setFormData(initialFormData)
    }
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingLocation(null)
    setFormData(initialFormData)
  }

  const handleFormChange = (field: keyof LocationFormData) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = field === 'active' ? event.target.checked : event.target.value
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    try {
      if (!formData.name.trim() || !formData.address.trim() || !formData.city.trim() || !formData.state.trim()) {
        setSnackbar({ open: true, message: 'All fields are required', severity: 'error' })
        return
      }

      if (editingLocation) {
        // Update existing location
        const { error } = await supabase
          .from('locations')
          .update(formData)
          .eq('id', editingLocation.id)

        if (error) throw error
        setSnackbar({ open: true, message: 'Location updated successfully', severity: 'success' })
      } else {
        // Create new location
        const { error } = await supabase
          .from('locations')
          .insert([formData])

        if (error) throw error
        setSnackbar({ open: true, message: 'Location created successfully', severity: 'success' })
      }

      handleCloseDialog()
      await loadLocations()
    } catch (error) {
      console.error('Error saving location:', error)
      setSnackbar({ open: true, message: 'Error saving location', severity: 'error' })
    }
  }

  const handleDelete = async (locationId: string, locationName: string) => {
    if (!confirm(`Are you sure you want to delete "${locationName}"?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('locations')
        .delete()
        .eq('id', locationId)

      if (error) throw error
      
      setSnackbar({ open: true, message: 'Location deleted successfully', severity: 'success' })
      await loadLocations()
    } catch (error) {
      console.error('Error deleting location:', error)
      setSnackbar({ open: true, message: 'Error deleting location', severity: 'error' })
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
          <Typography>Loading...</Typography>
        </Box>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" gutterBottom>
            Location Management
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Add Location
          </Button>
        </Box>

        <Card>
          <CardContent>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Address</TableCell>
                    <TableCell>City</TableCell>
                    <TableCell>State</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {locations.map((location) => (
                    <TableRow key={location.id}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <LocationOn sx={{ mr: 1, color: 'primary.main' }} />
                          {location.name}
                        </Box>
                      </TableCell>
                      <TableCell>{location.address}</TableCell>
                      <TableCell>{location.city}</TableCell>
                      <TableCell>{location.state}</TableCell>
                      <TableCell>
                        <Chip
                          label={location.active ? 'Active' : 'Inactive'}
                          color={location.active ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {new Date(location.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          onClick={() => handleOpenDialog(location)}
                          color="primary"
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          onClick={() => handleDelete(location.id, location.name)}
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {locations.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        <Typography color="text.secondary">
                          No locations found. Click "Add Location" to create your first location.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>

        {/* Add/Edit Location Dialog */}
        <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
          <DialogTitle>
            {editingLocation ? 'Edit Location' : 'Add New Location'}
          </DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="Location Name"
              fullWidth
              variant="outlined"
              value={formData.name}
              onChange={handleFormChange('name')}
              sx={{ mb: 2 }}
            />
            <TextField
              margin="dense"
              label="Address"
              fullWidth
              variant="outlined"
              value={formData.address}
              onChange={handleFormChange('address')}
              sx={{ mb: 2 }}
            />
            <TextField
              margin="dense"
              label="City"
              fullWidth
              variant="outlined"
              value={formData.city}
              onChange={handleFormChange('city')}
              sx={{ mb: 2 }}
            />
            <TextField
              margin="dense"
              label="State"
              fullWidth
              variant="outlined"
              value={formData.state}
              onChange={handleFormChange('state')}
              sx={{ mb: 2 }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.active}
                  onChange={handleFormChange('active')}
                />
              }
              label="Active"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button onClick={handleSubmit} variant="contained">
              {editingLocation ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar for notifications */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
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
      </Box>
    </DashboardLayout>
  )
}