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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Snackbar,
  Autocomplete,
  Switch,
  FormControlLabel,
} from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Person,
} from '@mui/icons-material'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

interface User {
  id: string
  username: string
  email: string | null
  role: 'scanner' | 'supervisor' | 'superuser'
  location_ids: string[]
  active: boolean
  created_at: string
}

interface Location {
  id: string
  name: string
  city: string
  state: string
}

interface UserFormData {
  username: string
  email: string
  role: 'scanner' | 'supervisor' | 'superuser'
  location_ids: string[]
  active: boolean
}

const initialFormData: UserFormData = {
  username: '',
  email: '',
  role: 'scanner',
  location_ids: [],
  active: true,
}

export default function UsersPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [users, setUsers] = useState<User[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [formData, setFormData] = useState<UserFormData>(initialFormData)
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
      await Promise.all([loadUsers(), loadLocations()])
    } catch (error) {
      console.error('Auth check error:', error)
      router.push('/auth/login')
    } finally {
      setLoading(false)
    }
  }

  const loadUsers = async () => {
    try {
      console.log('Loading users...')
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('username')

      console.log('Users query result:', { data, error })
      
      if (error) {
        console.error('Supabase error:', error)
        throw error
      }
      
      console.log(`Loaded ${data?.length || 0} users`)
      setUsers(data || [])
    } catch (error) {
      console.error('Error loading users:', error)
      setSnackbar({ open: true, message: 'Error loading users', severity: 'error' })
    }
  }

  const loadLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('id, name, city, state')
        .eq('active', true)
        .order('name')

      if (error) throw error
      setLocations(data || [])
    } catch (error) {
      console.error('Error loading locations:', error)
      setSnackbar({ open: true, message: 'Error loading locations', severity: 'error' })
    }
  }

  const getLocationNames = (locationIds: string[]) => {
    return locationIds
      .map(id => locations.find(loc => loc.id === id)?.name)
      .filter(Boolean)
      .join(', ')
  }

  const handleOpenDialog = (user?: User) => {
    if (user) {
      setEditingUser(user)
      setFormData({
        username: user.username,
        email: user.email || '',
        role: user.role,
        location_ids: user.location_ids || [],
        active: user.active,
      })
    } else {
      setEditingUser(null)
      setFormData(initialFormData)
    }
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingUser(null)
    setFormData(initialFormData)
  }

  const handleFormChange = (field: keyof UserFormData) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | any
  ) => {
    let value: any
    
    if (field === 'active') {
      value = event.target.checked
    } else if (field === 'location_ids') {
      value = event.map((option: Location) => option.id)
    } else {
      value = event.target.value
    }
    
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    try {
      if (!formData.username.trim()) {
        setSnackbar({ open: true, message: 'Username is required', severity: 'error' })
        return
      }

      if (!formData.email.trim()) {
        setSnackbar({ open: true, message: 'Email is required for Google authentication', severity: 'error' })
        return
      }

      // Basic email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(formData.email.trim())) {
        setSnackbar({ open: true, message: 'Please enter a valid email address', severity: 'error' })
        return
      }

      if (editingUser) {
        // Update existing user
        const updateData: any = {
          username: formData.username,
          email: formData.email.trim(),
          role: formData.role,
          location_ids: formData.location_ids,
          active: formData.active,
        }

        const { error } = await supabase
          .from('users')
          .update(updateData)
          .eq('id', editingUser.id)

        if (error) throw error
        setSnackbar({ open: true, message: 'User updated successfully', severity: 'success' })
      } else {
        // Create new user
        const { error } = await supabase
          .from('users')
          .insert([{
            username: formData.username,
            email: formData.email.trim(),
            full_name: formData.username, // Use username as full_name for now
            role: formData.role,
            location_ids: formData.location_ids,
            active: formData.active,
          }])

        if (error) throw error
        setSnackbar({ open: true, message: 'User created successfully', severity: 'success' })
      }

      handleCloseDialog()
      await loadUsers()
    } catch (error: any) {
      console.error('Error saving user:', error)
      let message = 'Error saving user'
      if (error.code === '23505') {
        message = 'Username already exists'
      }
      setSnackbar({ open: true, message, severity: 'error' })
    }
  }

  const handleDelete = async (userId: string, username: string) => {
    if (!confirm(`Are you sure you want to delete user "${username}"?`)) {
      return
    }

    try {
      // Check for active assignments before deletion
      const { data: assignments } = await supabase
        .from('racks')
        .select('id')
        .eq('scanner_id', userId)
        .in('status', ['assigned', 'ready_for_approval'])

      if (assignments && assignments.length > 0) {
        const forceDelete = confirm(
          `User "${username}" has ${assignments.length} active rack assignment(s).\n\n` +
          `Click OK to FORCE DELETE (will unassign racks and delete user - USE FOR TEST DATA ONLY)\n` +
          `Click Cancel to abort deletion.`
        )
        
        if (!forceDelete) {
          setSnackbar({ 
            open: true, 
            message: `Deletion cancelled. User "${username}" has active assignments.`, 
            severity: 'error' 
          })
          return
        }

        // Force cleanup for test data
        console.log('Force deleting user with cleanup...')
        
        // Unassign all racks
        await supabase
          .from('racks')
          .update({ 
            scanner_id: null, 
            status: 'available', 
            assigned_at: null 
          })
          .eq('scanner_id', userId)

        // Clean up notifications
        await supabase
          .from('notifications')
          .delete()
          .or(`user_id.eq.${userId},created_by.eq.${userId}`)

        // Nullify audit session references
        await supabase
          .from('audit_sessions')
          .update({ started_by: null })
          .eq('started_by', userId)
          
        await supabase
          .from('audit_sessions')
          .update({ completed_by: null })
          .eq('completed_by', userId)
      }

      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId)

      if (error) {
        console.error('Delete error details:', error)
        
        // Handle specific error types
        if (error.code === '23503') {
          setSnackbar({ 
            open: true, 
            message: `Cannot delete user "${username}" - they have associated data (scans, sessions, etc.). Contact admin to resolve dependencies.`, 
            severity: 'error' 
          })
        } else {
          throw error
        }
        return
      }
      
      setSnackbar({ open: true, message: 'User deleted successfully', severity: 'success' })
      await loadUsers()
    } catch (error: any) {
      console.error('Error deleting user:', error)
      setSnackbar({ 
        open: true, 
        message: `Error deleting user: ${error.message || 'Unknown error'}`, 
        severity: 'error' 
      })
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'superuser': return 'error'
      case 'supervisor': return 'warning'
      case 'scanner': return 'info'
      default: return 'default'
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
            User Management
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Add User
          </Button>
        </Box>

        <Card>
          <CardContent>
            <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Username</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell>Locations</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Person sx={{ mr: 1, color: 'primary.main' }} />
                          {user.username}
                        </Box>
                      </TableCell>
                      <TableCell>{user.email || '-'}</TableCell>
                      <TableCell>
                        <Chip
                          label={user.role}
                          color={getRoleColor(user.role) as any}
                          size="small"
                          sx={{ textTransform: 'capitalize' }}
                        />
                      </TableCell>
                      <TableCell>
                        {user.location_ids?.length > 0 ? getLocationNames(user.location_ids) : 'None'}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={user.active ? 'Active' : 'Inactive'}
                          color={user.active ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {new Date(user.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          onClick={() => handleOpenDialog(user)}
                          color="primary"
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          onClick={() => handleDelete(user.id, user.username)}
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {users.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        <Typography color="text.secondary">
                          No users found. Click "Add User" to create your first user.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>

        {/* Add/Edit User Dialog */}
        <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
          <DialogTitle>
            {editingUser ? 'Edit User' : 'Add New User'}
          </DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="Username"
              fullWidth
              variant="outlined"
              value={formData.username}
              onChange={handleFormChange('username')}
              sx={{ mb: 2 }}
            />
            <TextField
              margin="dense"
              label="Email (Required)"
              fullWidth
              variant="outlined"
              type="email"
              value={formData.email}
              onChange={handleFormChange('email')}
              required
              sx={{ mb: 2 }}
              helperText="Required for Google Sign-in authentication"
            />
            <FormControl fullWidth margin="dense" sx={{ mb: 2 }}>
              <InputLabel>Role</InputLabel>
              <Select
                value={formData.role}
                onChange={handleFormChange('role')}
                label="Role"
              >
                <MenuItem value="scanner">Scanner</MenuItem>
                <MenuItem value="supervisor">Supervisor</MenuItem>
                <MenuItem value="superuser">Super User</MenuItem>
              </Select>
            </FormControl>
            <Autocomplete
              multiple
              options={locations}
              getOptionLabel={(option) => `${option.name} (${option.city}, ${option.state})`}
              value={locations.filter(loc => formData.location_ids.includes(loc.id))}
              onChange={(_, newValue) => handleFormChange('location_ids')(newValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Assigned Locations"
                  placeholder="Select locations"
                  margin="dense"
                  sx={{ mb: 2 }}
                />
              )}
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
              {editingUser ? 'Update' : 'Create'}
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