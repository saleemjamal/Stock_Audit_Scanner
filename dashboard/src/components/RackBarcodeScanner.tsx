'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Box,
  TextField,
  Typography,
  Card,
  CardContent,
  Alert,
  Button,
} from '@mui/material'
import { QrCode, CheckCircle } from '@mui/icons-material'

interface RackBarcodeScannerProps {
  onRackScanned: (rackBarcode: string) => void
  disabled?: boolean
}

export default function RackBarcodeScanner({ onRackScanned, disabled = false }: RackBarcodeScannerProps) {
  const [inputValue, setInputValue] = useState('')
  const [lastScanTime, setLastScanTime] = useState(0)
  const [isManualEntry, setIsManualEntry] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Auto-focus on mount
    if (!disabled && inputRef.current) {
      inputRef.current.focus()
    }
  }, [disabled])

  const validateRackBarcode = (barcode: string): boolean => {
    // Rack barcodes follow pattern: DDMM-### (e.g., 1808-001, 1808-002)
    return /^\d{4}-\d{3}$/.test(barcode)
  }

  const handleInputChange = (value: string) => {
    setInputValue(value)
    
    // Detect rapid input (likely from USB scanner)
    const now = Date.now()
    const timeDiff = now - lastScanTime
    
    // If typing rapidly (< 50ms between characters), mark as scanner input
    if (timeDiff < 50 && value.length > inputValue.length) {
      setIsManualEntry(false)
    } else {
      // Mark as manual entry for slow typing
      setIsManualEntry(true)
    }
    
    // Process scan when Enter is pressed (from scanner)
    if (value.includes('\n') || value.includes('\r')) {
      const barcode = value.replace(/[\n\r]/g, '').trim().toUpperCase()
      if (barcode) {
        processScan(barcode, false) // Scanner input = false (not manual)
        setInputValue('')
      }
    }
  }

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      const barcode = inputValue.trim().toUpperCase()
      if (barcode) {
        processScan(barcode, true) // Manual enter = true
        setInputValue('')
      }
    }
  }

  const processScan = (barcode: string, manualEntry: boolean) => {
    // Clear previous messages
    setSuccessMessage(null)
    setErrorMessage(null)
    
    // Validate rack barcode format
    if (!validateRackBarcode(barcode)) {
      setErrorMessage(`Invalid rack barcode: "${barcode}". Expected format: DDMM-### (e.g., 1808-001)`)
      setTimeout(() => setErrorMessage(null), 3000)
      return
    }
    
    // Extract rack number from barcode (remove date prefix and leading zeros)
    const rackNumber = barcode.substring(5).replace(/^0+/, '')
    
    // Show success message
    setSuccessMessage(`Rack ${rackNumber} scanned successfully`)
    setTimeout(() => setSuccessMessage(null), 2000)
    
    // Update last scan time
    setLastScanTime(Date.now())
    
    // Notify parent component
    onRackScanned(barcode)
    
    console.log(`Rack barcode scanned: ${barcode}, Manual: ${manualEntry}`)
  }

  const handleManualSubmit = () => {
    const barcode = inputValue.trim().toUpperCase()
    if (barcode) {
      processScan(barcode, true) // Submit button = true
      setInputValue('')
    }
  }

  return (
    <Card variant="outlined">
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <QrCode color="primary" />
          <Typography variant="h6">Scan Rack Barcode</Typography>
        </Box>
        
        <TextField
          ref={inputRef}
          fullWidth
          placeholder="Scan rack barcode (e.g., 1808-001)"
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={disabled}
          autoFocus={!disabled}
          sx={{
            '& .MuiInputBase-input': {
              fontSize: '1.1rem',
              fontFamily: 'monospace',
              textAlign: 'center',
            }
          }}
          InputProps={{
            endAdornment: inputValue && (
              <Button onClick={handleManualSubmit} size="small">
                Select
              </Button>
            )
          }}
        />
        
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, textAlign: 'center' }}>
          Scan the barcode on the rack label to select it automatically
        </Typography>
        
        {successMessage && (
          <Alert 
            severity="success" 
            icon={<CheckCircle />}
            sx={{ mt: 2 }}
          >
            {successMessage}
          </Alert>
        )}
        
        {errorMessage && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {errorMessage}
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}