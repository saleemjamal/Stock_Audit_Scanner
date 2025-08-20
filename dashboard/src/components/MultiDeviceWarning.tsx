'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  IconButton,
} from '@mui/material'
import {
  Warning,
  Devices,
  Close,
} from '@mui/icons-material'

interface MultiDeviceWarningProps {
  open: boolean
  onClose: () => void
  otherDeviceInfo: string
  onContinueHere: () => void
  onSwitchBack?: () => void
}

export function MultiDeviceWarning({
  open,
  onClose,
  otherDeviceInfo,
  onContinueHere,
  onSwitchBack
}: MultiDeviceWarningProps) {
  const [dismissed, setDismissed] = useState(false)

  const handleContinueHere = () => {
    setDismissed(true)
    onContinueHere()
    onClose()
  }

  const handleSwitchBack = () => {
    if (onSwitchBack) {
      onSwitchBack()
    }
    onClose()
  }

  if (dismissed) return null

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          bgcolor: 'background.paper'
        }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
        <Warning color="warning" />
        Multiple Device Access Detected
        <Box sx={{ flex: 1 }} />
        <IconButton onClick={onClose} size="small">
          <Close />
        </IconButton>
      </DialogTitle>
      
      <DialogContent>
        <Alert 
          severity="warning" 
          icon={<Devices />}
          sx={{ mb: 2 }}
        >
          You appear to be logged in on another device
        </Alert>
        
        <Box sx={{ mb: 2 }}>
          <Typography variant="body1" gutterBottom>
            <strong>Other device:</strong> {otherDeviceInfo}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Using the same account on multiple devices simultaneously may cause 
            sync issues or unexpected behavior during scanning operations.
          </Typography>
        </Box>

        <Box 
          sx={{ 
            p: 2, 
            bgcolor: 'action.hover', 
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'divider'
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
            Recommended Actions:
          </Typography>
          <Typography variant="body2" component="ul" sx={{ m: 0, pl: 2 }}>
            <li>Close the other session before continuing</li>
            <li>Use only one device at a time for scanning</li>
            <li>Log out properly when switching devices</li>
          </Typography>
        </Box>
      </DialogContent>
      
      <DialogActions sx={{ p: 3, pt: 1 }}>
        <Button 
          onClick={handleSwitchBack}
          variant="outlined"
          color="inherit"
        >
          Go Back
        </Button>
        <Button 
          onClick={handleContinueHere}
          variant="contained"
          color="warning"
          sx={{ ml: 1 }}
        >
          Continue Here Anyway
        </Button>
      </DialogActions>
    </Dialog>
  )
}