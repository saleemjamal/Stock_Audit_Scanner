'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Box,
  TextField,
  Paper,
  Typography,
  Card,
  CardContent,
  Alert,
  Chip,
  List,
  ListItem,
  ListItemText,
  Button,
  Badge,
  LinearProgress,
} from '@mui/material'
import {
  QrCode,
  Check,
  Error as ErrorIcon,
  Delete,
  Speed,
  CloudUpload,
  Assignment,
} from '@mui/icons-material'
import { createClient } from '@/lib/supabase'

interface ScanData {
  id: string
  barcode: string
  rack_id: string
  audit_session_id: string
  scanner_id: string
  client_scan_id: string
  created_at: string
  quantity: number
  manual_entry: boolean
  device_id: string
}

interface WebScannerProps {
  rackId: string
  auditSessionId: string
  scannerId: string
  onScanAdded?: (barcode: string) => void
  onReview?: () => void
}

class WebScanQueue {
  private queue: ScanData[] = []
  private flushInterval: NodeJS.Timeout | null = null
  private onQueueUpdate: (count: number) => void
  private supabase = createClient()

  constructor(onQueueUpdate: (count: number) => void) {
    this.onQueueUpdate = onQueueUpdate
    
    // Flush every 5 seconds
    this.flushInterval = setInterval(() => {
      this.flush()
    }, 5000)
    
    // Flush on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.flush()
      })
    }
  }

  add(scan: Omit<ScanData, 'id' | 'client_scan_id' | 'created_at' | 'quantity' | 'manual_entry' | 'device_id'>, manualEntry: boolean) {
    // Generate client-side ID for idempotency
    const scanWithId: ScanData = {
      ...scan,
      id: crypto.randomUUID(),
      client_scan_id: `web-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date().toISOString(),
      quantity: 1,
      manual_entry: manualEntry,
      device_id: this.getDeviceId()
    }
    
    this.queue.push(scanWithId)
    this.onQueueUpdate(this.queue.length)
    
    if (this.queue.length >= 10) {
      this.flush()
    }
  }

  async flush(): Promise<boolean> {
    if (this.queue.length === 0) return true
    
    const batch = [...this.queue]
    this.queue = []
    this.onQueueUpdate(0)
    
    try {
      const { error } = await this.supabase.from('scans').insert(batch)
      if (error) throw error
      
      console.log(`Flushed ${batch.length} scans successfully`)
      return true
    } catch (error) {
      console.error('Flush failed:', error)
      // Re-queue failed scans
      this.queue.unshift(...batch)
      this.onQueueUpdate(this.queue.length)
      return false
    }
  }

  getQueueSize(): number {
    return this.queue.length
  }

  private getDeviceId(): string {
    if (typeof window === 'undefined') return 'web-server'
    
    let deviceId = localStorage.getItem('deviceId')
    if (!deviceId) {
      deviceId = `web-${navigator.userAgent.slice(0, 20)}-${Date.now()}`
      localStorage.setItem('deviceId', deviceId)
    }
    return deviceId
  }

  destroy() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
    }
    this.flush()
  }
}

export default function WebScanner({ 
  rackId, 
  auditSessionId, 
  scannerId, 
  onScanAdded,
  onReview 
}: WebScannerProps) {
  const [inputValue, setInputValue] = useState('')
  const [recentScans, setRecentScans] = useState<string[]>([])
  const [lastScanTime, setLastScanTime] = useState(0)
  const [isManualEntry, setIsManualEntry] = useState(false)
  const [queueSize, setQueueSize] = useState(0)
  const [sessionStats, setSessionStats] = useState({ totalScans: 0, rate: 0 })
  const [scanQueue] = useState(() => new WebScanQueue(setQueueSize))
  const [errors, setErrors] = useState<string[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [warnedBarcodes, setWarnedBarcodes] = useState<Set<string>>(new Set())
  
  const inputRef = useRef<HTMLInputElement>(null)
  const sessionStartTime = useRef(Date.now())

  useEffect(() => {
    // Auto-focus on mount and maintain focus
    const focusInput = () => {
      if (inputRef.current) {
        inputRef.current.focus()
      }
    }

    focusInput()
    
    // Re-focus periodically in case focus is lost
    const focusInterval = setInterval(focusInput, 1000)

    return () => {
      clearInterval(focusInterval)
      scanQueue.destroy()
    }
  }, [scanQueue])

  const validateBarcode = (code: string): boolean => {
    // Only allow 10-11 digit barcodes
    if (!/^\d{10,11}$/.test(code)) {
      addError(`Invalid barcode format: "${code}" (must be 10-11 digits)`)
      return false
    }
    return true
  }

  const addError = (message: string) => {
    setErrors(prev => [...prev.slice(-4), message]) // Keep last 5 errors
    setTimeout(() => {
      setErrors(prev => prev.slice(1))
    }, 5000)
  }

  const addWarning = (message: string) => {
    setWarnings(prev => [...prev.slice(-4), message]) // Keep last 5 warnings
    setTimeout(() => {
      setWarnings(prev => prev.slice(1))
    }, 4000) // Auto-dismiss after 4 seconds
  }

  const handleInputChange = (value: string) => {
    setInputValue(value)
    
    // Detect rapid input (likely from USB scanner)
    const now = Date.now()
    const timeDiff = now - lastScanTime
    
    // If typing rapidly (< 50ms between characters), mark as scanner input
    if (timeDiff < 50 && value.length > inputValue.length) {
      setIsManualEntry(false)
      return
    }
    
    // Mark as manual entry for slow typing
    setIsManualEntry(true)
    
    // Process scan when Enter is pressed
    if (value.includes('\n') || value.includes('\r')) {
      const barcode = value.replace(/[\n\r]/g, '').trim()
      if (barcode) {
        processScan(barcode, false) // Scanner input = false
        setInputValue('')
      }
    }
  }

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      // Mark as manual entry when user presses Enter
      setIsManualEntry(true)
      const barcode = inputValue.trim()
      if (barcode) {
        processScan(barcode, true) // Manual enter = true
        setInputValue('')
      }
    }
  }

  const processScan = (barcode: string, manualEntry?: boolean) => {
    const now = Date.now()
    
    // Rate limiting - 1 scan per second
    if (now - lastScanTime < 1000) {
      addError('Please wait 1 second between scans')
      return
    }
    
    // Validate barcode format
    if (!validateBarcode(barcode)) {
      return
    }
    
    // Check for duplicates and show warning ONCE per barcode
    if (recentScans.includes(barcode) && !warnedBarcodes.has(barcode)) {
      addWarning(`FYI: Multiple scans of "${barcode}" detected. This is normal for items with multiple units.`)
      setWarnedBarcodes(prev => new Set(prev).add(barcode))
    }
    
    setLastScanTime(now)
    
    // Add to queue
    scanQueue.add({
      barcode,
      rack_id: rackId,
      audit_session_id: auditSessionId,
      scanner_id: scannerId,
    }, manualEntry ?? isManualEntry)
    
    // Update UI
    setRecentScans(prev => [...prev, barcode].slice(-20)) // Keep last 20
    setSessionStats(prev => {
      const newTotal = prev.totalScans + 1
      const timeElapsed = (now - sessionStartTime.current) / 1000 / 60 / 60 // hours
      const newRate = timeElapsed > 0 ? Math.round(newTotal / timeElapsed) : 0
      return { totalScans: newTotal, rate: newRate }
    })
    
    // Callback
    onScanAdded?.(barcode)
    
    console.log(`Scanned: ${barcode}`)
  }

  const handleManualSubmit = () => {
    const barcode = inputValue.trim()
    if (barcode) {
      processScan(barcode, true) // Submit button = true
      setInputValue('')
    }
  }

  const handleReviewScans = async () => {
    // Flush all pending scans before review
    const success = await scanQueue.flush()
    if (success && queueSize === 0) {
      onReview?.()
    } else {
      addError('Please wait for all scans to upload before reviewing')
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, height: '100%' }}>
      {/* Scanner Input */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <QrCode color="primary" />
            <Typography variant="h6">Barcode Scanner</Typography>
            {queueSize > 0 && (
              <Badge badgeContent={queueSize} color="warning">
                <CloudUpload />
              </Badge>
            )}
          </Box>
          
          <TextField
            ref={inputRef}
            fullWidth
            placeholder="Scan barcode or type manually..."
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyPress={handleKeyPress}
            autoFocus
            sx={{
              '& .MuiInputBase-input': {
                fontSize: '1.2rem',
                fontFamily: 'monospace',
                textAlign: 'center',
              }
            }}
            InputProps={{
              endAdornment: inputValue && (
                <Button onClick={handleManualSubmit} size="small">
                  Submit
                </Button>
              )
            }}
          />
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Focus: Auto | Speed: {sessionStats.rate}/hr | Total: {sessionStats.totalScans}
            </Typography>
            {queueSize > 0 && (
              <Typography variant="caption" color="warning.main">
                {queueSize} pending upload
              </Typography>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Warnings */}
      {warnings.map((warning, index) => (
        <Alert key={`warning-${index}`} severity="warning" sx={{ mb: 1 }}>
          {warning}
        </Alert>
      ))}

      {/* Errors */}
      {errors.map((error, index) => (
        <Alert key={`error-${index}`} severity="error" sx={{ mb: 1 }}>
          {error}
        </Alert>
      ))}

      {/* Recent Scans */}
      <Card sx={{ flex: 1, overflow: 'hidden' }}>
        <CardContent sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="h6">Recent Scans ({recentScans.length})</Typography>
            <Button 
              onClick={handleReviewScans}
              variant="contained"
              color="primary"
              disabled={queueSize > 0}
              startIcon={<Assignment />}
            >
              Review Scans
            </Button>
          </Box>
          
          {queueSize > 0 && (
            <LinearProgress sx={{ mb: 2 }} />
          )}
          
          <Paper sx={{ maxHeight: 300, overflow: 'auto' }}>
            <List dense>
              {recentScans.slice().reverse().map((barcode, index) => (
                <ListItem key={`${barcode}-${index}`}>
                  <Check color="success" sx={{ mr: 1 }} />
                  <ListItemText 
                    primary={barcode}
                    primaryTypographyProps={{ 
                      fontFamily: 'monospace',
                      fontSize: '0.9rem'
                    }}
                    secondary={`${recentScans.length - index} of ${recentScans.length}`}
                  />
                </ListItem>
              ))}
              {recentScans.length === 0 && (
                <ListItem>
                  <Typography color="text.secondary" sx={{ textAlign: 'center', width: '100%' }}>
                    No scans yet. Start scanning to see items here.
                  </Typography>
                </ListItem>
              )}
            </List>
          </Paper>
        </CardContent>
      </Card>
    </Box>
  )
}