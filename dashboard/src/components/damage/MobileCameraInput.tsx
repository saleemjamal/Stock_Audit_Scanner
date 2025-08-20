'use client'

import React, { useState } from 'react'
import {
  Box,
  Button,
  Typography,
  Alert,
  Grid,
  IconButton,
  Paper
} from '@mui/material'
import { CameraAlt, Delete, CheckCircle } from '@mui/icons-material'
import { CapturedPhoto } from '@/services/DamageCameraService'

interface MobileCameraInputProps {
  onPhotosCapture: (photos: CapturedPhoto[]) => void;
  onCancel: () => void;
}

export default function MobileCameraInput({ onPhotosCapture, onCancel }: MobileCameraInputProps) {
  const [photos, setPhotos] = useState<CapturedPhoto[]>([])
  const [error, setError] = useState<string | null>(null)

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      // Convert to base64
      const reader = new FileReader()
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string
        const newPhoto: CapturedPhoto = {
          dataUrl,
          order: photos.length + 1,
          sizeKB: Math.round(file.size / 1024),
          timestamp: new Date().toISOString()
        }
        
        const updatedPhotos = [...photos, newPhoto]
        setPhotos(updatedPhotos)
        
        // Auto-submit when we have 3 photos
        if (updatedPhotos.length === 3) {
          onPhotosCapture(updatedPhotos)
        }
      }
      reader.readAsDataURL(file)
    } catch (err) {
      setError('Failed to process photo')
    }
  }

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index))
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Damage Photos ({photos.length}/3)
      </Typography>
      
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      
      <Grid container spacing={2}>
        {photos.map((photo, index) => (
          <Grid item xs={4} key={index}>
            <Paper sx={{ position: 'relative', p: 1 }}>
              <img 
                src={photo.dataUrl} 
                style={{ width: '100%', height: 'auto' }}
                alt={`Damage ${index + 1}`}
              />
              <IconButton
                size="small"
                sx={{ position: 'absolute', top: 0, right: 0 }}
                onClick={() => removePhoto(index)}
              >
                <Delete />
              </IconButton>
            </Paper>
          </Grid>
        ))}
        
        {photos.length < 3 && (
          <Grid item xs={4}>
            <Button
              component="label"
              variant="outlined"
              sx={{ 
                height: 120, 
                width: '100%',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <CameraAlt sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="caption">Add Photo</Typography>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={handleFileSelect}
              />
            </Button>
          </Grid>
        )}
      </Grid>
      
      <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
        <Button onClick={onCancel} variant="outlined">
          Cancel
        </Button>
        {photos.length === 3 && (
          <Button 
            variant="contained" 
            onClick={() => onPhotosCapture(photos)}
            startIcon={<CheckCircle />}
          >
            Submit Photos
          </Button>
        )}
      </Box>
    </Box>
  )
}