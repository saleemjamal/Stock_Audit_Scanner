'use client'

import { useState, useEffect } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  LinearProgress,
  Alert,
  Chip,
  Grid,
  IconButton,
  Paper
} from '@mui/material'
import { NavigateNext, SkipNext, CameraAlt, Delete } from '@mui/icons-material'
import { createClient } from '@/lib/supabase'

interface DamageDraft {
  id: string
  barcode: string
  damage_severity: string
  damage_description: string
}

interface PhotoCollectionQueueProps {
  sessionId: string
}

export default function PhotoCollectionQueue({ sessionId }: PhotoCollectionQueueProps) {
  const [drafts, setDrafts] = useState<DamageDraft[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [photos, setPhotos] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  
  const supabase = createClient()

  useEffect(() => {
    // Detect mobile device
    const checkMobile = () => {
      const isTouchDevice = 'ontouchstart' in window
      const isSmallScreen = window.innerWidth <= 768
      const mobileUA = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
      setIsMobile((isTouchDevice && isSmallScreen) || mobileUA)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    loadDrafts()
  }, [sessionId])

  const loadDrafts = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('damage_drafts')
        .select('*')
        .eq('audit_session_id', sessionId)
        .eq('photos_completed', false)
        .order('imported_at')

      if (error) throw error
      
      setDrafts(data || [])
    } catch (err) {
      setError('Failed to load damage items: ' + String(err))
    } finally {
      setLoading(false)
    }
  }

  const currentDraft = drafts[currentIndex]
  const progress = drafts.length > 0 ? ((currentIndex + 1) / drafts.length) * 100 : 0

  const handlePhotoAdd = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      setPhotos(prev => [...prev, dataUrl])
    }
    reader.readAsDataURL(file)
  }

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index))
  }

  const dataURLtoBlob = (dataurl: string): Blob => {
    const arr = dataurl.split(',')
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg'
    const bstr = atob(arr[1])
    let n = bstr.length
    const u8arr = new Uint8Array(n)
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n)
    }
    return new Blob([u8arr], { type: mime })
  }

  const handleSaveAndNext = async () => {
    if (!currentDraft || photos.length === 0) return

    setSaving(true)
    setError(null)

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Create damage report with photos
      const { data: damageItem, error: damageError } = await supabase
        .from('damaged_items')
        .insert({
          audit_session_id: sessionId,
          barcode: currentDraft.barcode,
          damage_severity: currentDraft.damage_severity,
          damage_description: currentDraft.damage_description,
          reported_by: user.id,
          status: 'pending'
        })
        .select()
        .single()

      if (damageError) throw damageError

      // Upload photos to storage and create image records
      const uploadPromises = photos.map(async (photo, index) => {
        const fileName = `damage-${damageItem.id}-${index + 1}-${Date.now()}.jpg`
        const blob = dataURLtoBlob(photo)

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('damage-photos')
          .upload(fileName, blob, {
            contentType: 'image/jpeg',
            upsert: false
          })

        if (uploadError) throw uploadError

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('damage-photos')
          .getPublicUrl(fileName)

        // Save image record
        return supabase
          .from('damage_images')
          .insert({
            damaged_item_id: damageItem.id,
            image_url: publicUrl,
            image_filename: fileName,
            image_order: index + 1,
            file_size_bytes: blob.size,
            mime_type: 'image/jpeg'
          })
      })

      await Promise.all(uploadPromises)

      // Mark draft as completed
      await supabase
        .from('damage_drafts')
        .update({
          photos_completed: true,
          completed_at: new Date().toISOString(),
          converted_to_damage_id: damageItem.id
        })
        .eq('id', currentDraft.id)

      // Move to next item
      setPhotos([])
      setCurrentIndex(prev => prev + 1)
      
      // Remove completed draft from list
      setDrafts(prev => prev.filter(d => d.id !== currentDraft.id))
      
    } catch (err) {
      setError('Failed to save photos: ' + String(err))
    } finally {
      setSaving(false)
    }
  }

  const handleSkip = () => {
    setPhotos([])
    setCurrentIndex(prev => prev + 1)
  }

  if (loading) {
    return (
      <Card>
        <CardContent sx={{ textAlign: 'center', py: 4 }}>
          <Typography>Loading damage items...</Typography>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
        <Button onClick={loadDrafts} sx={{ ml: 2 }}>
          Retry
        </Button>
      </Alert>
    )
  }

  if (!currentDraft || drafts.length === 0) {
    return (
      <Alert severity="success">
        All photos collected! All imported damage reports have been processed.
      </Alert>
    )
  }

  return (
    <Card>
      <LinearProgress variant="determinate" value={progress} />
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6">
            Item {currentIndex + 1} of {drafts.length}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {Math.round(progress)}% Complete
          </Typography>
        </Box>

        <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
          <Typography variant="body1" sx={{ fontFamily: 'monospace', mb: 1 }}>
            {currentDraft.barcode}
          </Typography>
          <Chip 
            label={currentDraft.damage_severity} 
            size="small" 
            color="warning"
            sx={{ mb: 1, textTransform: 'capitalize' }}
          />
          <Typography variant="body2" color="text.secondary">
            {currentDraft.damage_description || 'No description provided'}
          </Typography>
        </Box>

        <Typography variant="subtitle2" gutterBottom>
          Photos ({photos.length}/3):
        </Typography>
        
        <Grid container spacing={1} sx={{ mb: 2 }}>
          {[0, 1, 2].map((idx) => (
            <Grid item xs={4} key={idx}>
              {photos[idx] ? (
                <Paper sx={{ position: 'relative', p: 0.5 }}>
                  <img 
                    src={photos[idx]} 
                    style={{ width: '100%', height: 100, objectFit: 'cover' }}
                    alt={`Photo ${idx + 1}`}
                  />
                  <IconButton
                    size="small"
                    sx={{ position: 'absolute', top: 0, right: 0, bgcolor: 'rgba(255,255,255,0.8)' }}
                    onClick={() => removePhoto(idx)}
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                </Paper>
              ) : (
                <Button
                  component="label"
                  variant="outlined"
                  sx={{ 
                    width: '100%', 
                    height: 100,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1
                  }}
                >
                  <CameraAlt />
                  <Typography variant="caption">Add Photo</Typography>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    hidden
                    onChange={handlePhotoAdd}
                  />
                </Button>
              )}
            </Grid>
          ))}
        </Grid>

        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            onClick={handleSkip}
            startIcon={<SkipNext />}
            disabled={saving}
          >
            Skip
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveAndNext}
            disabled={photos.length === 0 || saving}
            startIcon={<NavigateNext />}
            fullWidth
          >
            {saving ? 'Saving...' : 'Save & Next'}
          </Button>
        </Box>
      </CardContent>
    </Card>
  )
}