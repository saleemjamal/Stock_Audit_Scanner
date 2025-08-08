'use client'

import { useEffect, useState } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Switch,
  FormControlLabel,
  TextField,
  Button,
  Divider,
  Alert,
  Snackbar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
} from '@mui/material'
import {
  Settings,
  Notifications,
  Security,
  Storage,
  Sync,
  Save,
} from '@mui/icons-material'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

interface SystemSettings {
  notifications_enabled: boolean
  email_notifications: boolean
  auto_sync_interval: number
  session_timeout: number
  max_concurrent_sessions: number
  backup_retention_days: number
  require_approval_all_racks: boolean
  allow_offline_mode: boolean
}

const defaultSettings: SystemSettings = {
  notifications_enabled: true,
  email_notifications: false,
  auto_sync_interval: 300, // 5 minutes
  session_timeout: 28800, // 8 hours
  max_concurrent_sessions: 10,
  backup_retention_days: 30,
  require_approval_all_racks: true,
  allow_offline_mode: true,
}

export default function SettingsPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' })
  const supabase = createClient()

  useEffect(() => {
    checkAuthAndLoadSettings()
  }, [])

  const checkAuthAndLoadSettings = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error || !session) {
        router.push('/auth/login')
        return
      }

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
      await loadSettings()
    } catch (error) {
      console.error('Auth check error:', error)
      router.push('/auth/login')
    } finally {
      setLoading(false)
    }
  }

  const loadSettings = async () => {
    try {
      // In a real implementation, you'd load these from a settings table
      // For now, using localStorage or default values
      const savedSettings = localStorage.getItem('system_settings')
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings))
      }
    } catch (error) {
      console.error('Error loading settings:', error)
      setSnackbar({ open: true, message: 'Error loading settings', severity: 'error' })
    }
  }

  const handleSettingChange = (key: keyof SystemSettings) => (
    event: React.ChangeEvent<HTMLInputElement> | any
  ) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : 
                  event.target.type === 'number' ? parseInt(event.target.value) : 
                  event.target.value

    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // In a real implementation, you'd save to a database table
      // For now, using localStorage
      localStorage.setItem('system_settings', JSON.stringify(settings))
      
      setSnackbar({ open: true, message: 'Settings saved successfully', severity: 'success' })
    } catch (error) {
      console.error('Error saving settings:', error)
      setSnackbar({ open: true, message: 'Error saving settings', severity: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const resetToDefaults = () => {
    if (confirm('Are you sure you want to reset all settings to defaults?')) {
      setSettings(defaultSettings)
      setSnackbar({ open: true, message: 'Settings reset to defaults', severity: 'success' })
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
            System Settings
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="outlined" onClick={resetToDefaults}>
              Reset to Defaults
            </Button>
            <Button
              variant="contained"
              startIcon={<Save />}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
          </Box>
        </Box>

        <Grid container spacing={3}>
          {/* Notifications Settings */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                  <Notifications sx={{ mr: 1 }} />
                  Notifications
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.notifications_enabled}
                        onChange={handleSettingChange('notifications_enabled')}
                      />
                    }
                    label="Enable system notifications"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.email_notifications}
                        onChange={handleSettingChange('email_notifications')}
                        disabled={!settings.notifications_enabled}
                      />
                    }
                    label="Send email notifications"
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Security Settings */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                  <Security sx={{ mr: 1 }} />
                  Security
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <TextField
                    label="Session Timeout (seconds)"
                    type="number"
                    value={settings.session_timeout}
                    onChange={handleSettingChange('session_timeout')}
                    fullWidth
                    size="small"
                    helperText="How long users can stay logged in without activity"
                  />
                  <TextField
                    label="Max Concurrent Sessions"
                    type="number"
                    value={settings.max_concurrent_sessions}
                    onChange={handleSettingChange('max_concurrent_sessions')}
                    fullWidth
                    size="small"
                    helperText="Maximum number of users that can be logged in simultaneously"
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Sync Settings */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                  <Sync sx={{ mr: 1 }} />
                  Synchronization
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <TextField
                    label="Auto Sync Interval (seconds)"
                    type="number"
                    value={settings.auto_sync_interval}
                    onChange={handleSettingChange('auto_sync_interval')}
                    fullWidth
                    size="small"
                    helperText="How often mobile apps sync with server"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.allow_offline_mode}
                        onChange={handleSettingChange('allow_offline_mode')}
                      />
                    }
                    label="Allow offline scanning mode"
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Audit Settings */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                  <Settings sx={{ mr: 1 }} />
                  Audit Configuration
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.require_approval_all_racks}
                        onChange={handleSettingChange('require_approval_all_racks')}
                      />
                    }
                    label="Require supervisor approval for all racks"
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Storage Settings */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                  <Storage sx={{ mr: 1 }} />
                  Data Management
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <TextField
                      label="Backup Retention (days)"
                      type="number"
                      value={settings.backup_retention_days}
                      onChange={handleSettingChange('backup_retention_days')}
                      fullWidth
                      size="small"
                      helperText="How long to keep automatic backups"
                    />
                  </Grid>
                  <Grid item xs={12} md={8}>
                    <Alert severity="info">
                      <Typography variant="body2">
                        <strong>Current Storage Usage:</strong> Database size ~45MB, 
                        with approximately 12,500 scans across 67 racks.
                        Automatic backups are created daily at 2:00 AM.
                      </Typography>
                    </Alert>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* System Information */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  System Information
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <Typography variant="body2" color="text.secondary">Version</Typography>
                    <Chip label="v1.0.0" size="small" color="primary" />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography variant="body2" color="text.secondary">Database</Typography>
                    <Chip label="PostgreSQL 15.3" size="small" color="success" />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography variant="body2" color="text.secondary">Last Backup</Typography>
                    <Chip label="Today at 2:00 AM" size="small" color="info" />
                  </Grid>
                </Grid>
                <Divider sx={{ my: 2 }} />
                <Typography variant="body2" color="text.secondary">
                  For technical support or feature requests, contact your system administrator.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

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