● Damage Report System Improvements - Implementation Document

  Overview

  Enhance the damage reporting and approval system to handle high-volume scenarios (150+ items)
  efficiently while maintaining photo documentation requirements.

  Changes to Implement

  1. Mobile Camera Fix

  Problem: Camera using getUserMedia() doesn't work well on mobile browsersSolution: Use native file
  input on mobile devices while keeping video stream on desktop

  Files to Modify:

  - src/components/damage/DamageReportingPage.tsx
  - Create new: src/components/damage/MobileCameraInput.tsx

  Implementation:

  MobileCameraInput.tsx (New file):
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

  Modify DamageReportingPage.tsx:
  // Add at top
  import MobileCameraInput from './MobileCameraInput'

  // Add inside component
  const [isMobile, setIsMobile] = useState(false)

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

  // In render, replace camera component conditionally
  {currentStep === 1 && (
    isMobile ? (
      <MobileCameraInput
        onPhotosCapture={handlePhotosCapture}
        onCancel={() => setCurrentStep(0)}
      />
    ) : (
      <DamageCameraCapture
        onPhotosCapture={handlePhotosCapture}
        onCancel={() => setCurrentStep(0)}
      />
    )
  )}

  2. List View for Damage Approvals

  Problem: Card grid inefficient for 150+ itemsSolution: Table view with inline thumbnails and bulk
  operations

  Files to Modify:

  - src/components/damage/DamageApprovalPage.tsx

  Implementation:

  Replace the card grid (lines 240-295) with a table view:

  // Add these state variables
  const [selectedReports, setSelectedReports] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('list')
  const [allImages, setAllImages] = useState<Record<string, DamageImage[]>>({})

  // Add function to load all images at once
  const loadAllImages = async () => {
    const imagePromises = pendingReports.map(async (report) => {
      const { data } = await supabase
        .from('damage_images')
        .select('*')
        .eq('damaged_item_id', report.damage_id)
        .order('image_order')
      return { damageId: report.damage_id, images: data || [] }
    })

    const results = await Promise.all(imagePromises)
    const imageMap: Record<string, DamageImage[]> = {}
    results.forEach(r => {
      imageMap[r.damageId] = r.images
    })
    setAllImages(imageMap)
  }

  // Load images when reports load
  useEffect(() => {
    if (pendingReports.length > 0) {
      loadAllImages()
    }
  }, [pendingReports])

  // Add bulk operations
  const handleBulkApprove = async () => {
    setProcessing(true)
    for (const damageId of selectedReports) {
      await supabase.rpc('approve_damage_report', {
        p_damage_id: damageId,
        p_approved_by: currentUser.id,
        p_remove_from_stock: false
      })
    }
    setSelectedReports(new Set())
    await loadPendingReports(currentUser.id)
    setProcessing(false)
  }

  // Replace card grid with this table view
  <Box>
    {/* View toggle and bulk actions */}
    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
      <Box sx={{ display: 'flex', gap: 2 }}>
        <Button
          variant="contained"
          onClick={handleBulkApprove}
          disabled={selectedReports.size === 0 || processing}
        >
          Approve Selected ({selectedReports.size})
        </Button>
        <Button
          variant="outlined"
          color="error"
          onClick={handleBulkReject}
          disabled={selectedReports.size === 0 || processing}
        >
          Reject Selected
        </Button>
      </Box>
      <ToggleButtonGroup
        value={viewMode}
        exclusive
        onChange={(e, v) => v && setViewMode(v)}
      >
        <ToggleButton value="list">List</ToggleButton>
        <ToggleButton value="cards">Cards</ToggleButton>
      </ToggleButtonGroup>
    </Box>

    {viewMode === 'list' ? (
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={selectedReports.size === pendingReports.length}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedReports(new Set(pendingReports.map(r => r.damage_id)))
                    } else {
                      setSelectedReports(new Set())
                    }
                  }}
                />
              </TableCell>
              <TableCell>Barcode</TableCell>
              <TableCell>Severity</TableCell>
              <TableCell>Reporter</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Photos</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pendingReports.map((report) => (
              <TableRow key={report.damage_id}>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={selectedReports.has(report.damage_id)}
                    onChange={(e) => {
                      const newSelected = new Set(selectedReports)
                      if (e.target.checked) {
                        newSelected.add(report.damage_id)
                      } else {
                        newSelected.delete(report.damage_id)
                      }
                      setSelectedReports(newSelected)
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    {report.barcode}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={report.damage_severity}
                    color={getSeverityColor(report.damage_severity)}
                    size="small"
                  />
                </TableCell>
                <TableCell>{report.reported_by_name}</TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow:
  'ellipsis' }}>
                    {report.damage_description || '-'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    {allImages[report.damage_id]?.map((img, idx) => (
                      <img
                        key={idx}
                        src={img.image_url}
                        style={{
                          width: 40,
                          height: 40,
                          objectFit: 'cover',
                          cursor: 'pointer',
                          border: '1px solid #ddd'
                        }}
                        onClick={() => window.open(img.image_url, '_blank')}
                      />
                    )) || <Typography variant="caption">Loading...</Typography>}
                  </Box>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <IconButton
                      size="small"
                      color="success"
                      onClick={() => handleQuickApprove(report.damage_id)}
                    >
                      <CheckCircle />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleViewReport(report)}
                    >
                      <Cancel />
                    </IconButton>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    ) : (
      // Keep existing card view as option
      <Grid container spacing={3}>
        {/* Existing card code */}
      </Grid>
    )}
  </Box>

  3. CSV Upload + Photo Collection Queue

  Problem: Manual entry of 150+ damage reports is time-consumingSolution: CSV import followed by photo       
  collection queue

  New Files to Create:

  - src/components/damage/DamageCSVUpload.tsx
  - src/components/damage/PhotoCollectionQueue.tsx
  - src/app/api/damage-csv-import/route.ts

  Database Changes:

  -- Add draft damages table
  CREATE TABLE damage_drafts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    audit_session_id UUID NOT NULL REFERENCES audit_sessions(id),
    barcode VARCHAR(50) NOT NULL,
    damage_severity damage_severity_enum DEFAULT 'medium',
    damage_description TEXT,
    photos_completed BOOLEAN DEFAULT false,
    imported_by UUID REFERENCES users(id),
    imported_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    converted_to_damage_id UUID REFERENCES damaged_items(id)
  );

  CREATE INDEX idx_damage_drafts_session ON damage_drafts(audit_session_id);
  CREATE INDEX idx_damage_drafts_photos ON damage_drafts(photos_completed);

  DamageCSVUpload.tsx:

  'use client'

  import { useState } from 'react'
  import {
    Box,
    Button,
    Paper,
    Typography,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    Alert,
    CircularProgress
  } from '@mui/material'
  import { Upload, CheckCircle } from '@mui/icons-material'
  import Papa from 'papaparse' // npm install papaparse @types/papaparse

  interface CSVRow {
    barcode: string
    severity: string
    description: string
  }

  export default function DamageCSVUpload({ sessionId, onComplete }) {
    const [csvData, setCsvData] = useState<CSVRow[]>([])
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      Papa.parse(file, {
        header: true,
        complete: (results) => {
          const rows = results.data as CSVRow[]
          // Validate data
          const validRows = rows.filter(row => row.barcode && row.severity)
          setCsvData(validRows)
        },
        error: (err) => {
          setError('Failed to parse CSV: ' + err.message)
        }
      })
    }

    const handleImport = async () => {
      setUploading(true)
      try {
        const response = await fetch('/api/damage-csv-import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            damages: csvData
          })
        })

        if (!response.ok) throw new Error('Import failed')

        onComplete()
      } catch (err) {
        setError('Import failed: ' + err.message)
      } finally {
        setUploading(false)
      }
    }

    return (
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Import Damage Reports from CSV
        </Typography>

        <Box sx={{ mb: 3 }}>
          <Button
            component="label"
            variant="outlined"
            startIcon={<Upload />}
          >
            Choose CSV File
            <input
              type="file"
              accept=".csv"
              hidden
              onChange={handleFileSelect}
            />
          </Button>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {csvData.length > 0 && (
          <>
            <Typography variant="body2" sx={{ mb: 2 }}>
              Preview ({csvData.length} items):
            </Typography>

            <Table size="small" sx={{ mb: 3 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Barcode</TableCell>
                  <TableCell>Severity</TableCell>
                  <TableCell>Description</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {csvData.slice(0, 5).map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{row.barcode}</TableCell>
                    <TableCell>{row.severity}</TableCell>
                    <TableCell>{row.description}</TableCell>
                  </TableRow>
                ))}
                {csvData.length > 5 && (
                  <TableRow>
                    <TableCell colSpan={3} align="center">
                      ... and {csvData.length - 5} more items
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            <Button
              variant="contained"
              onClick={handleImport}
              disabled={uploading}
              startIcon={uploading ? <CircularProgress size={20} /> : <CheckCircle />}
            >
              {uploading ? 'Importing...' : `Import ${csvData.length} Items`}
            </Button>
          </>
        )}
      </Paper>
    )
  }

  PhotoCollectionQueue.tsx:

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
    Grid
  } from '@mui/material'
  import { NavigateNext, Skip, CameraAlt } from '@mui/icons-material'
  import { createClient } from '@/lib/supabase'

  export default function PhotoCollectionQueue({ sessionId }) {
    const [drafts, setDrafts] = useState([])
    const [currentIndex, setCurrentIndex] = useState(0)
    const [photos, setPhotos] = useState<string[]>([])
    const [saving, setSaving] = useState(false)
    const supabase = createClient()

    useEffect(() => {
      loadDrafts()
    }, [sessionId])

    const loadDrafts = async () => {
      const { data } = await supabase
        .from('damage_drafts')
        .select('*')
        .eq('audit_session_id', sessionId)
        .eq('photos_completed', false)
        .order('created_at')

      setDrafts(data || [])
    }

    const currentDraft = drafts[currentIndex]
    const progress = ((currentIndex + 1) / drafts.length) * 100

    const handlePhotoAdd = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (e) => {
        setPhotos([...photos, e.target?.result as string])
      }
      reader.readAsDataURL(file)
    }

    const handleSaveAndNext = async () => {
      setSaving(true)

      // Create damage report with photos
      const { data: damageItem } = await supabase
        .from('damaged_items')
        .insert({
          audit_session_id: sessionId,
          barcode: currentDraft.barcode,
          damage_severity: currentDraft.damage_severity,
          damage_description: currentDraft.damage_description,
          reported_by: (await supabase.auth.getUser()).data.user?.id,
          status: 'pending'
        })
        .select()
        .single()

      // Upload photos
      for (let i = 0; i < photos.length; i++) {
        const fileName = `damage-${damageItem.id}-${i + 1}-${Date.now()}.jpg`
        // Upload logic here (similar to existing)
      }

      // Mark draft as completed
      await supabase
        .from('damage_drafts')
        .update({
          photos_completed: true,
          completed_at: new Date().toISOString(),
          converted_to_damage_id: damageItem.id
        })
        .eq('id', currentDraft.id)

      // Move to next
      setPhotos([])
      setCurrentIndex(currentIndex + 1)
      setSaving(false)
    }

    if (!currentDraft) {
      return (
        <Alert severity="success">
          All photos collected! {drafts.length} items completed.
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
              sx={{ mb: 1 }}
            />
            <Typography variant="body2" color="text.secondary">
              {currentDraft.damage_description}
            </Typography>
          </Box>

          <Typography variant="subtitle2" gutterBottom>
            Photos ({photos.length}/3):
          </Typography>

          <Grid container spacing={1} sx={{ mb: 2 }}>
            {[0, 1, 2].map((idx) => (
              <Grid item xs={4} key={idx}>
                {photos[idx] ? (
                  <img
                    src={photos[idx]}
                    style={{ width: '100%', height: 100, objectFit: 'cover' }}
                  />
                ) : (
                  <Button
                    component="label"
                    variant="outlined"
                    sx={{ width: '100%', height: 100 }}
                  >
                    <CameraAlt />
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
              onClick={() => setCurrentIndex(currentIndex + 1)}
              startIcon={<Skip />}
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
              Save & Next
            </Button>
          </Box>
        </CardContent>
      </Card>
    )
  }

  Offline Support (Simplified Approach)

  Note: Full offline support requires significant complexity. Here's a simplified approach:

  Basic Queue System (No Service Worker)

  // utils/offlineQueue.ts
  class OfflineQueue {
    private queue: any[] = []

    constructor() {
      // Load any queued items from localStorage
      const saved = localStorage.getItem('damageQueue')
      if (saved) {
        this.queue = JSON.parse(saved)
      }

      // Check connection and process queue
      window.addEventListener('online', () => this.processQueue())
    }

    add(item: any) {
      this.queue.push(item)
      localStorage.setItem('damageQueue', JSON.stringify(this.queue))

      if (navigator.onLine) {
        this.processQueue()
      }
    }

    async processQueue() {
      while (this.queue.length > 0) {
        const item = this.queue[0]
        try {
          await this.uploadItem(item)
          this.queue.shift()
          localStorage.setItem('damageQueue', JSON.stringify(this.queue))
        } catch (error) {
          // Will retry next time we're online
          break
        }
      }
    }

    private async uploadItem(item: any) {
      // Upload logic here
    }
  }

  Testing Plan

  1. Test mobile camera on actual devices (iOS Safari, Android Chrome)
  2. Test CSV import with 150+ rows
  3. Test list view performance with 150+ items
  4. Test bulk operations (select all, approve multiple)
  5. Test photo collection queue workflow

  Deployment Steps

  1. Deploy mobile camera fix first (immediate improvement)
  2. Deploy list view (can toggle between card/list)
  3. Deploy CSV upload system
  4. Monitor and gather feedback