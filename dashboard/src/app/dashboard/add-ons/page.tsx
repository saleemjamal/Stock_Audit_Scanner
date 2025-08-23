'use client'

import { useState, useEffect } from 'react'
import {
  Container,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Box,
  Grid,
  Alert,
  Snackbar,
  InputAdornment,
  FormHelperText,
  CircularProgress,
} from '@mui/material'
import {
  Add,
  CameraAlt,
  AttachMoney,
  Inventory,
  Description,
} from '@mui/icons-material'
import DashboardLayout from '@/components/DashboardLayout'
import DamageCameraCapture from '@/components/damage/DamageCameraCapture'
import { DamageCameraService, CapturedPhoto } from '@/services/DamageCameraService'
import { createClient } from '@/lib/supabase'

interface AddOnFormData {
  brand: string
  item_name: string
  quantity: number
  reason: string
  cost_price: string
  selling_price: string
}

export default function AddOnsPage() {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [activeSession, setActiveSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [accessError, setAccessError] = useState<string | null>(null)
  const [formData, setFormData] = useState<AddOnFormData>({
    brand: '',
    item_name: '',
    quantity: 1,
    reason: '',
    cost_price: '',
    selling_price: ''
  })
  const [capturedPhotos, setCapturedPhotos] = useState<CapturedPhoto[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error'
  })

  const supabase = createClient()

  useEffect(() => {
    loadUserAndSession()
  }, [])

  const loadUserAndSession = async () => {
    try {
      // Get current user
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setAccessError('Authentication required')
        return
      }

      const { data: userProfile } = await supabase
        .from('users')
        .select('*')
        .eq('email', session.user.email)
        .single()

      // Check if user has supervisor+ access
      if (!['supervisor', 'superuser'].includes(userProfile?.role)) {
        setAccessError('Access denied. Add-ons management is only available to supervisors and super users.')
        return
      }

      setCurrentUser(userProfile)

      // Get active session
      const { data: session_data } = await supabase
        .from('audit_sessions')
        .select('*, locations(name)')
        .eq('status', 'active')
        .single()

      setActiveSession(session_data)
    } catch (error) {
      console.error('Error loading user/session:', error)
      setAccessError('Error loading user data')
    } finally {
      setLoading(false)
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.brand.trim()) newErrors.brand = 'Brand is required'
    if (!formData.item_name.trim()) newErrors.item_name = 'Item name is required'
    if (formData.quantity < 1) newErrors.quantity = 'Quantity must be at least 1'
    if (!formData.reason.trim()) newErrors.reason = 'Reason is required'
    if (capturedPhotos.length === 0) newErrors.image = 'Product images are required (3 photos)'
    else if (capturedPhotos.length < 3) newErrors.image = `Need ${3 - capturedPhotos.length} more photos`

    // Validate optional price fields
    if (formData.cost_price && isNaN(parseFloat(formData.cost_price))) {
      newErrors.cost_price = 'Invalid price format'
    }
    if (formData.selling_price && isNaN(parseFloat(formData.selling_price))) {
      newErrors.selling_price = 'Invalid price format'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validateForm() || !currentUser || !activeSession) return

    setSubmitting(true)
    try {
      let imageUrls: string[] = []
      
      // Upload all images to Supabase Storage
      if (capturedPhotos.length > 0) {
        const cameraService = new DamageCameraService()
        
        for (let i = 0; i < capturedPhotos.length; i++) {
          const photo = capturedPhotos[i]
          const blob = cameraService.dataURLtoBlob(photo.dataUrl)
          const fileName = `${Date.now()}-${i + 1}-${Math.random().toString(36).substr(2, 9)}.jpg`
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('add-on-photos')
            .upload(fileName, blob, {
              contentType: 'image/jpeg'
            })

          if (uploadError) throw uploadError
          
          const { data: { publicUrl } } = supabase.storage
            .from('add-on-photos')
            .getPublicUrl(fileName)
          
          imageUrls.push(publicUrl)
        }
      }

      // Create add-on record
      const { error } = await supabase
        .from('add_on_items')
        .insert([{
          audit_session_id: activeSession.id,
          location_id: activeSession.location_id,
          brand: formData.brand.trim(),
          item_name: formData.item_name.trim(),
          quantity: formData.quantity,
          reason: formData.reason.trim(),
          cost_price: formData.cost_price ? parseFloat(formData.cost_price) : null,
          selling_price: formData.selling_price ? parseFloat(formData.selling_price) : null,
          image_url: imageUrls.length > 0 ? imageUrls[0] : null, // Store first image for compatibility
          reported_by: currentUser.id
        }])

      if (error) throw error

      setSnackbar({
        open: true,
        message: 'Add-on request submitted successfully!',
        severity: 'success'
      })

      // Reset form
      setFormData({
        brand: '',
        item_name: '',
        quantity: 1,
        reason: '',
        cost_price: '',
        selling_price: ''
      })
      setCapturedPhotos([])

    } catch (error: any) {
      console.error('Error submitting add-on:', error)
      setSnackbar({
        open: true,
        message: `Failed to submit add-on: ${error.message}`,
        severity: 'error'
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handlePhotoCapture = (photos: CapturedPhoto[]) => {
    // Store all 3 photos for add-ons documentation
    setCapturedPhotos(photos)
    setShowCamera(false)
  }

  const handleCameraCancel = () => {
    setShowCamera(false)
  }

  if (loading) {
    return (
      <DashboardLayout>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
          <CircularProgress />
        </Box>
      </DashboardLayout>
    )
  }

  if (accessError) {
    return (
      <DashboardLayout>
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
          <Alert severity="error">{accessError}</Alert>
        </Container>
      </DashboardLayout>
    )
  }

  if (!activeSession) {
    return (
      <DashboardLayout>
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
          <Alert severity="info">
            No active audit session found. Add-ons can only be created during an active audit.
          </Alert>
        </Container>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Add />
          Add-On Request
        </Typography>
        
        <Typography variant="body1" color="text.secondary" gutterBottom>
          Document items found at location that don't have barcodes assigned yet
        </Typography>

        <Grid container spacing={3}>
          {/* Session Info */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Current Session
                </Typography>
                <Typography variant="body2">
                  <strong>Location:</strong> {activeSession.locations?.name}
                </Typography>
                <Typography variant="body2">
                  <strong>Session Started:</strong> {new Date(activeSession.started_at).toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Add-On Form */}
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Item Details
                </Typography>

                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Brand *"
                      value={formData.brand}
                      onChange={(e) => setFormData({...formData, brand: e.target.value})}
                      error={!!errors.brand}
                      helperText={errors.brand}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Inventory />
                          </InputAdornment>
                        )
                      }}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Item Name *"
                      value={formData.item_name}
                      onChange={(e) => setFormData({...formData, item_name: e.target.value})}
                      error={!!errors.item_name}
                      helperText={errors.item_name}
                    />
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      label="Quantity *"
                      type="number"
                      inputProps={{ min: 1 }}
                      value={formData.quantity}
                      onChange={(e) => setFormData({...formData, quantity: parseInt(e.target.value) || 1})}
                      error={!!errors.quantity}
                      helperText={errors.quantity}
                    />
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      label="Cost Price (Optional)"
                      type="number"
                      inputProps={{ min: 0, step: 0.01 }}
                      value={formData.cost_price}
                      onChange={(e) => setFormData({...formData, cost_price: e.target.value})}
                      error={!!errors.cost_price}
                      helperText={errors.cost_price}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <AttachMoney />
                          </InputAdornment>
                        )
                      }}
                    />
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      label="Selling Price (Optional)"
                      type="number"
                      inputProps={{ min: 0, step: 0.01 }}
                      value={formData.selling_price}
                      onChange={(e) => setFormData({...formData, selling_price: e.target.value})}
                      error={!!errors.selling_price}
                      helperText={errors.selling_price}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <AttachMoney />
                          </InputAdornment>
                        )
                      }}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Reason for Add-on *"
                      multiline
                      rows={3}
                      value={formData.reason}
                      onChange={(e) => setFormData({...formData, reason: e.target.value})}
                      error={!!errors.reason}
                      helperText={errors.reason || 'Explain why this item needs to be added (e.g., new product, missing barcode, etc.)'}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Description />
                          </InputAdornment>
                        )
                      }}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Image Capture */}
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Product Images * (3 photos required)
                </Typography>
                
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Take 3 photos: Overall view, close-up details, and side angle
                </Typography>
                
                {capturedPhotos.length === 0 ? (
                  <Box>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<CameraAlt />}
                      onClick={() => setShowCamera(true)}
                      sx={{ mb: 2 }}
                    >
                      Take 3 Photos
                    </Button>
                    {errors.image && (
                      <FormHelperText error>{errors.image}</FormHelperText>
                    )}
                  </Box>
                ) : (
                  <Box>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                      {capturedPhotos.map((photo, index) => (
                        <Box key={index} sx={{ flex: '1 1 calc(50% - 4px)', maxWidth: '120px' }}>
                          <img 
                            src={photo.dataUrl} 
                            alt={`Product view ${index + 1}`}
                            style={{ 
                              width: '100%', 
                              height: '80px', 
                              objectFit: 'cover',
                              borderRadius: '4px',
                              border: '1px solid #ddd'
                            }}
                          />
                          <Typography variant="caption" color="text.secondary" display="block" align="center">
                            Photo {index + 1} ({photo.sizeKB} KB)
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                    
                    <Typography variant="body2" color={capturedPhotos.length === 3 ? 'success.main' : 'warning.main'} sx={{ mb: 1 }}>
                      {capturedPhotos.length}/3 photos captured
                      {capturedPhotos.length === 3 && ' ✓'}
                    </Typography>
                    
                    <Button
                      fullWidth
                      variant="outlined"
                      onClick={() => setShowCamera(true)}
                      sx={{ mt: 1 }}
                    >
                      {capturedPhotos.length < 3 ? 'Continue Taking Photos' : 'Retake All Photos'}
                    </Button>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Submit Button */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Button
                variant="contained"
                size="large"
                onClick={handleSubmit}
                disabled={submitting}
                startIcon={<Add />}
              >
                {submitting ? 'Submitting...' : 'Submit Add-on Request'}
              </Button>
            </Box>
          </Grid>
        </Grid>

        {/* Camera Dialog */}
        {showCamera && (
          <DamageCameraCapture
            onPhotosCapture={handlePhotoCapture}
            onCancel={handleCameraCancel}
          />
        )}

        {/* Success/Error Snackbar */}
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
      </Container>
    </DashboardLayout>
  )
}