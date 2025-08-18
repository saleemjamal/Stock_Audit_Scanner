# Add-Ons System Implementation Guide

## Overview

The Add-Ons system is designed to document items found at physical locations that lack barcodes. This is a **documentation-only system** that creates a paper trail for manual goods inward processes, not an automated inventory integration.

## System Architecture

### Core Concept
- **Documentation System**: Records items needing manual barcode assignment
- **Session-Scoped**: Tied to current audit session like damage reports  
- **Approval Workflow**: Supervisor creates → Super User approves/rejects
- **Manual Process**: After approval, physical barcode sticking happens outside the system

### User Roles & Access
- **Supervisor**: Can create add-on requests
- **Super User**: Can approve/reject add-on requests  
- **Scanner**: No access to add-ons functionality

## Database Schema

### Add-Ons Table
```sql
-- Add-ons for items without barcodes found during audit
CREATE TABLE add_on_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  audit_session_id UUID NOT NULL REFERENCES audit_sessions(id) ON DELETE CASCADE,
  location_id INTEGER NOT NULL REFERENCES locations(id),
  
  -- Item Details
  brand VARCHAR(255) NOT NULL,
  item_name VARCHAR(500) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  reason TEXT NOT NULL, -- Why this item needs to be added
  cost_price DECIMAL(10,2), -- Optional
  selling_price DECIMAL(10,2), -- Optional
  
  -- Image
  image_url TEXT, -- Supabase Storage URL (1 image required)
  
  -- Workflow
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  
  -- Timestamps and User Tracking
  reported_by UUID NOT NULL REFERENCES users(id),
  reported_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Approval/Rejection
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT, -- Required if status = 'rejected'
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_add_on_items_audit_session ON add_on_items(audit_session_id);
CREATE INDEX idx_add_on_items_location ON add_on_items(location_id);
CREATE INDEX idx_add_on_items_status ON add_on_items(status);
CREATE INDEX idx_add_on_items_reported_by ON add_on_items(reported_by);
CREATE INDEX idx_add_on_items_reviewed_by ON add_on_items(reviewed_by);

-- Row Level Security
ALTER TABLE add_on_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies (for production)
-- CREATE POLICY "Users can view add-ons from their assigned locations" ON add_on_items
--   FOR SELECT USING (location_id = ANY(auth.jwt() ->> 'location_ids')::int[]);
  
-- CREATE POLICY "Supervisors can create add-ons" ON add_on_items  
--   FOR INSERT WITH CHECK (auth.jwt() ->> 'role' IN ('supervisor', 'superuser'));
  
-- CREATE POLICY "Super users can update add-ons" ON add_on_items
--   FOR UPDATE USING (auth.jwt() ->> 'role' = 'superuser');
```

### Storage Bucket Updates
```sql
-- Add policies for add-on images (if not exists from damage system)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('add-on-photos', 'add-on-photos', true)
ON CONFLICT DO NOTHING;

-- Storage policies for add-on images
CREATE POLICY "Anyone can view add-on photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'add-on-photos');

CREATE POLICY "Authenticated users can upload add-on photos" ON storage.objects  
  FOR INSERT WITH CHECK (bucket_id = 'add-on-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Super users can delete add-on photos" ON storage.objects
  FOR DELETE USING (bucket_id = 'add-on-photos' AND auth.jwt() ->> 'role' = 'superuser');
```

## Component Architecture

### 1. Navigation Updates
**File**: `dashboard/src/components/DashboardLayout.tsx`

Update the expandable "Damage" section to "Damage & Add-ons":

```typescript
const getDamageItems = () => {
  const items = []
  
  // Damage functionality
  if (currentUser && ['scanner', 'supervisor', 'superuser'].includes(currentUser.role)) {
    items.push({ text: 'Report Damage', icon: <Warning />, href: '/dashboard/damage' })
  }
  
  // Add-ons functionality (Supervisor+ only)  
  if (currentUser && ['supervisor', 'superuser'].includes(currentUser.role)) {
    items.push({ text: 'Add-ons', icon: <Add />, href: '/dashboard/add-ons' })
  }
  
  // Approvals (Super User only)
  if (currentUser?.role === 'superuser') {
    items.push({ text: 'Damage Approvals', icon: <Gavel />, href: '/dashboard/damage-approvals' })
    items.push({ text: 'Add-on Approvals', icon: <Gavel />, href: '/dashboard/add-on-approvals' })
  }
  
  return items
}

// Update section title
<ExpansionNavItem
  title="Damage & Add-ons"
  icon={<ReportProblem />}
  items={getDamageItems()}
/>
```

### 2. Add-On Creation Form
**File**: `dashboard/src/app/dashboard/add-ons/page.tsx`

```typescript
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
} from '@mui/material'
import {
  Add,
  CameraAlt,
  AttachMoney,
  Inventory,
  Description,
} from '@mui/icons-material'
import DashboardLayout from '@/components/DashboardLayout'
import AddOnCameraCapture from '@/components/add-ons/AddOnCameraCapture'
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
  const [formData, setFormData] = useState<AddOnFormData>({
    brand: '',
    item_name: '',
    quantity: 1,
    reason: '',
    cost_price: '',
    selling_price: ''
  })
  const [imageFile, setImageFile] = useState<File | null>(null)
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
      if (!session) return

      const { data: userProfile } = await supabase
        .from('users')
        .select('*')
        .eq('email', session.user.email)
        .single()

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
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.brand.trim()) newErrors.brand = 'Brand is required'
    if (!formData.item_name.trim()) newErrors.item_name = 'Item name is required'
    if (formData.quantity < 1) newErrors.quantity = 'Quantity must be at least 1'
    if (!formData.reason.trim()) newErrors.reason = 'Reason is required'
    if (!imageFile) newErrors.image = 'Product image is required'

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
      let imageUrl = ''
      
      // Upload image to Supabase Storage
      if (imageFile) {
        const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('add-on-photos')
          .upload(fileName, imageFile)

        if (uploadError) throw uploadError
        
        const { data: { publicUrl } } = supabase.storage
          .from('add-on-photos')
          .getPublicUrl(fileName)
        
        imageUrl = publicUrl
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
          image_url: imageUrl,
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
      setImageFile(null)

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

  if (!currentUser || currentUser.role === 'scanner') {
    return (
      <DashboardLayout>
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
          <Alert severity="warning">
            Only supervisors and super users can create add-on requests.
          </Alert>
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
                  Product Image *
                </Typography>
                
                {!imageFile ? (
                  <Box>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<CameraAlt />}
                      onClick={() => setShowCamera(true)}
                      sx={{ mb: 2 }}
                    >
                      Take Photo
                    </Button>
                    {errors.image && (
                      <FormHelperText error>{errors.image}</FormHelperText>
                    )}
                  </Box>
                ) : (
                  <Box>
                    <img 
                      src={URL.createObjectURL(imageFile)} 
                      alt="Product preview"
                      style={{ width: '100%', maxHeight: '300px', objectFit: 'cover' }}
                    />
                    <Button
                      fullWidth
                      variant="outlined"
                      onClick={() => setShowCamera(true)}
                      sx={{ mt: 1 }}
                    >
                      Retake Photo
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
          <AddOnCameraCapture
            onCapture={setImageFile}
            onClose={() => setShowCamera(false)}
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
```

### 3. Add-On Camera Component  
**File**: `dashboard/src/components/add-ons/AddOnCameraCapture.tsx`

```typescript
'use client'

import { useState, useRef, useCallback } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material'
import {
  CameraAlt,
  Refresh,
  Check,
  Close,
} from '@mui/icons-material'
import { AddOnCameraService } from '@/services/AddOnCameraService'

interface AddOnCameraCaptureProps {
  onCapture: (file: File) => void
  onClose: () => void
}

export default function AddOnCameraCapture({ onCapture, onClose }: AddOnCameraCaptureProps) {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cameraService = new AddOnCameraService()

  const initializeCamera = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      const mediaStream = await cameraService.initializeCamera()
      setStream(mediaStream)
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
    } catch (error: any) {
      console.error('Camera initialization failed:', error)
      setError(error.message || 'Failed to access camera')
    } finally {
      setLoading(false)
    }
  }, [cameraService])

  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !stream) {
      setError('Camera not ready')
      return
    }

    try {
      setProcessing(true)
      
      const imageBlob = await cameraService.capturePhoto(videoRef.current, canvasRef.current)
      
      // Create preview URL
      const imageUrl = URL.createObjectURL(imageBlob)
      setCapturedImage(imageUrl)
      
    } catch (error: any) {
      console.error('Photo capture failed:', error)
      setError(error.message || 'Failed to capture photo')
    } finally {
      setProcessing(false)
    }
  }, [stream, cameraService])

  const confirmPhoto = useCallback(async () => {
    if (!capturedImage) return

    try {
      // Convert blob URL back to File
      const response = await fetch(capturedImage)
      const blob = await response.blob()
      const file = new File([blob], `add-on-${Date.now()}.jpg`, { type: 'image/jpeg' })
      
      onCapture(file)
      handleClose()
    } catch (error: any) {
      console.error('Failed to confirm photo:', error)
      setError('Failed to process photo')
    }
  }, [capturedImage, onCapture])

  const retakePhoto = useCallback(() => {
    setCapturedImage(null)
    setError(null)
  }, [])

  const handleClose = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
    if (capturedImage) {
      URL.revokeObjectURL(capturedImage)
    }
    onClose()
  }, [stream, capturedImage, onClose])

  // Initialize camera when dialog opens
  React.useEffect(() => {
    initializeCamera()
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [initializeCamera])

  return (
    <Dialog 
      open={true} 
      onClose={handleClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: { bgcolor: 'black', color: 'white' }
      }}
    >
      <DialogTitle sx={{ color: 'white' }}>
        Capture Product Image
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          {error && (
            <Alert severity="error" sx={{ width: '100%' }}>
              {error}
            </Alert>
          )}

          {loading && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={20} sx={{ color: 'white' }} />
              <Typography sx={{ color: 'white' }}>Starting camera...</Typography>
            </Box>
          )}

          {/* Camera View */}
          {!capturedImage && stream && (
            <Box sx={{ position: 'relative', width: '100%', maxWidth: 500 }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                style={{ 
                  width: '100%', 
                  height: 'auto',
                  borderRadius: '8px',
                  backgroundColor: 'black'
                }}
              />
              
              <Typography variant="body2" sx={{ 
                color: 'white', 
                textAlign: 'center', 
                mt: 1,
                opacity: 0.8 
              }}>
                Position the product clearly in frame
              </Typography>
            </Box>
          )}

          {/* Captured Image Preview */}
          {capturedImage && (
            <Box sx={{ width: '100%', maxWidth: 500 }}>
              <img
                src={capturedImage}
                alt="Captured product"
                style={{ 
                  width: '100%', 
                  height: 'auto',
                  borderRadius: '8px'
                }}
              />
            </Box>
          )}

          {/* Hidden canvas for photo processing */}
          <canvas
            ref={canvasRef}
            style={{ display: 'none' }}
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ justifyContent: 'space-between', px: 3, pb: 3 }}>
        <Button
          onClick={handleClose}
          startIcon={<Close />}
          sx={{ color: 'white' }}
        >
          Cancel
        </Button>

        <Box sx={{ display: 'flex', gap: 1 }}>
          {!capturedImage ? (
            <Button
              variant="contained"
              onClick={capturePhoto}
              disabled={!stream || processing}
              startIcon={processing ? <CircularProgress size={16} /> : <CameraAlt />}
              sx={{ bgcolor: 'primary.main' }}
            >
              {processing ? 'Capturing...' : 'Capture'}
            </Button>
          ) : (
            <>
              <Button
                variant="outlined"
                onClick={retakePhoto}
                startIcon={<Refresh />}
                sx={{ color: 'white', borderColor: 'white' }}
              >
                Retake
              </Button>
              <Button
                variant="contained"
                onClick={confirmPhoto}
                startIcon={<Check />}
                sx={{ bgcolor: 'success.main' }}
              >
                Use Photo
              </Button>
            </>
          )}
        </Box>
      </DialogActions>
    </Dialog>
  )
}
```

### 4. Add-On Camera Service
**File**: `dashboard/src/services/AddOnCameraService.ts`

```typescript
export class AddOnCameraService {
  private stream: MediaStream | null = null

  async initializeCamera(): Promise<MediaStream> {
    try {
      // Request camera with high quality settings
      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          facingMode: 'environment' // Prefer rear camera on mobile
        },
        audio: false
      }

      this.stream = await navigator.mediaDevices.getUserMedia(constraints)
      return this.stream
    } catch (error: any) {
      console.error('Camera access failed:', error)
      
      if (error.name === 'NotAllowedError') {
        throw new Error('Camera access denied. Please allow camera permissions and try again.')
      } else if (error.name === 'NotFoundError') {
        throw new Error('No camera found. Please ensure your camera is connected.')
      } else if (error.name === 'NotReadableError') {
        throw new Error('Camera is busy or not accessible. Please close other apps using the camera.')
      } else {
        throw new Error('Failed to access camera. Please check your browser permissions.')
      }
    }
  }

  async capturePhoto(videoElement: HTMLVideoElement, canvasElement: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
      try {
        const context = canvasElement.getContext('2d')
        if (!context) {
          reject(new Error('Canvas context not available'))
          return
        }

        // Set canvas size to video size
        canvasElement.width = videoElement.videoWidth
        canvasElement.height = videoElement.videoHeight

        // Draw video frame to canvas
        context.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height)

        // Convert to blob with compression
        canvasElement.toBlob(
          (blob) => {
            if (blob) {
              this.compressImage(blob)
                .then(resolve)
                .catch(reject)
            } else {
              reject(new Error('Failed to create image blob'))
            }
          },
          'image/jpeg',
          0.8 // Initial quality
        )
      } catch (error) {
        reject(error)
      }
    })
  }

  private async compressImage(blob: Blob): Promise<Blob> {
    const maxSizeKB = 250 // Target 250KB like damage reports
    const maxSizeBytes = maxSizeKB * 1024

    // If already under limit, return as-is
    if (blob.size <= maxSizeBytes) {
      return blob
    }

    // Create image element for resizing
    const img = new Image()
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!

    return new Promise((resolve, reject) => {
      img.onload = () => {
        // Calculate new dimensions (maintain aspect ratio)
        let { width, height } = img
        const maxDimension = 1200

        if (width > height && width > maxDimension) {
          height = (height * maxDimension) / width
          width = maxDimension
        } else if (height > maxDimension) {
          width = (width * maxDimension) / height
          height = maxDimension
        }

        // Set canvas size and draw resized image
        canvas.width = width
        canvas.height = height
        ctx.drawImage(img, 0, 0, width, height)

        // Try different quality levels until under size limit
        const tryCompress = (quality: number) => {
          canvas.toBlob((compressedBlob) => {
            if (!compressedBlob) {
              reject(new Error('Compression failed'))
              return
            }

            if (compressedBlob.size <= maxSizeBytes || quality <= 0.1) {
              resolve(compressedBlob)
            } else {
              tryCompress(quality - 0.1)
            }
          }, 'image/jpeg', quality)
        }

        tryCompress(0.7)
      }

      img.onerror = () => reject(new Error('Image load failed'))
      img.src = URL.createObjectURL(blob)
    })
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop())
      this.stream = null
    }
  }
}
```

### 5. Add-On Approvals Page
**File**: `dashboard/src/app/dashboard/add-on-approvals/page.tsx`

```typescript
'use client'

import { useState, useEffect } from 'react'
import {
  Container,
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
import DashboardLayout from '@/components/DashboardLayout'
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

export default function AddOnApprovalsPage() {
  const [addOns, setAddOns] = useState<AddOnItem[]>([])
  const [filteredAddOns, setFilteredAddOns] = useState<AddOnItem[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
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
    loadCurrentUser()
    loadAddOns()
  }, [])

  useEffect(() => {
    filterAddOns()
  }, [addOns, statusFilter])

  const loadCurrentUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: userProfile } = await supabase
        .from('users')
        .select('*')
        .eq('email', session.user.email)
        .single()

      setCurrentUser(userProfile)
    } catch (error) {
      console.error('Error loading user:', error)
    }
  }

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
    return amount ? `$${amount.toFixed(2)}` : 'N/A'
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
      <DashboardLayout>
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
          <Alert severity="warning">
            Only super users can approve add-on requests.
          </Alert>
        </Container>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
      </Container>
    </DashboardLayout>
  )
}
```

### 6. Reports Integration
Update `dashboard/src/app/dashboard/reports/page.tsx` to add a fourth "Add-Ons" tab:

```typescript
// Add to the tabs array
const tabs = ['Sessions', 'Racks', 'Damages', 'Add-Ons']

// Add Add-Ons tab content with similar structure to Damages tab
// Include session filtering, status filtering, and CSV export
// Show brand, item_name, quantity, status, reporter, prices, etc.
```

## Implementation Checklist

### Phase 1: Database & Core Setup
- [ ] Create `add_on_items` table with proper schema
- [ ] Set up storage bucket policies for add-on photos  
- [ ] Create database indexes for performance
- [ ] Set up RLS policies (disabled for development)

### Phase 2: UI Components
- [ ] Update navigation menu to "Damage & Add-ons"
- [ ] Create AddOnCameraService for image capture
- [ ] Build AddOnCameraCapture component
- [ ] Create add-on creation form page

### Phase 3: Approval System
- [ ] Build add-on approvals page for super users
- [ ] Implement approval/rejection workflow
- [ ] Add image preview functionality
- [ ] Test rejection reasons and feedback

### Phase 4: Reporting Integration
- [ ] Add "Add-Ons" tab to Reports page
- [ ] Implement session-scoped filtering
- [ ] Add CSV export for add-ons
- [ ] Create summary statistics

### Phase 5: Testing & Polish
- [ ] Test image compression (250KB target)
- [ ] Verify session scoping works correctly
- [ ] Test supervisor vs super user permissions
- [ ] End-to-end workflow testing

## Technical Considerations

### Image Handling
- Same compression pipeline as damage reports (250KB target)
- Single image requirement (simpler than damage's 3-photo system)
- Supabase Storage with public read access
- Browser camera API with error handling

### Session Scoping
- All add-ons tied to `audit_session_id` like damage reports
- Location filtering based on session location
- Proper cleanup when sessions are closed

### Security
- Supervisor+ can create add-ons (not scanners)
- Only super users can approve/reject
- RLS policies match existing damage system patterns
- Proper user validation on all endpoints

### Performance
- Database indexes on session, location, status, user fields
- Lazy loading for images
- Efficient filtering and sorting
- Proper error handling and loading states

## Business Workflow

1. **Supervisor Discovery**: During audit, supervisor finds item without barcode
2. **Documentation**: Supervisor fills form with item details and takes photo
3. **Submission**: Add-on request created and awaits super user review
4. **Review**: Super user approves/rejects with reasons
5. **Manual Process**: If approved, physical barcode creation and goods inward happens outside system
6. **Reporting**: Reports show add-on requests for inventory planning

This system creates a complete digital paper trail for manual inventory additions while integrating seamlessly with the existing audit workflow.