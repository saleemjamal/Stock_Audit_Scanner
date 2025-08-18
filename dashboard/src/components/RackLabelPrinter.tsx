'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Checkbox,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  TextField,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
} from '@mui/material'
import {
  Print,
  Close,
  CheckBox,
  CheckBoxOutlineBlank,
  Search,
} from '@mui/icons-material'
import Barcode from 'react-barcode'
import jsPDF from 'jspdf'
import { createClient } from '@/lib/supabase'

interface Rack {
  id: string
  rack_number: string
  barcode: string
  location_name?: string
  display_name: string
}

interface RackLabelPrinterProps {
  open: boolean
  onClose: () => void
  sessionId: string
  sessionName?: string
}

export default function RackLabelPrinter({
  open,
  onClose,
  sessionId,
  sessionName = 'Audit'
}: RackLabelPrinterProps) {
  const [racks, setRacks] = useState<Rack[]>([])
  const [selectedRacks, setSelectedRacks] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const barcodeRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})
  const supabase = createClient()

  useEffect(() => {
    if (open && sessionId) {
      loadRacks()
    }
  }, [open, sessionId])

  const loadRacks = async () => {
    setLoading(true)
    setError(null)
    
    try {
      // First, ensure barcodes are generated for this session
      const { data: genData, error: genError } = await supabase
        .rpc('generate_rack_barcodes', { p_audit_session_id: sessionId })
      
      if (genError) {
        console.error('Error generating barcodes:', genError)
      }
      
      // Load racks with barcodes
      const { data, error } = await supabase
        .from('rack_barcodes_for_printing')
        .select('*')
        .eq('session_id', sessionId)
        .order('rack_number')
      
      if (error) throw error
      
      const formattedRacks = (data || []).map((rack: any) => ({
        id: rack.rack_id,
        rack_number: rack.rack_number,
        barcode: rack.barcode,
        location_name: rack.location_name,
        display_name: rack.display_name || `${sessionName}-${rack.rack_number.padStart(3, '0')}`
      }))
      
      setRacks(formattedRacks)
      // Select all by default
      setSelectedRacks(new Set(formattedRacks.map((r: Rack) => r.id)))
    } catch (err: any) {
      console.error('Error loading racks:', err)
      setError('Failed to load racks. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleRack = (rackId: string) => {
    const newSelected = new Set(selectedRacks)
    if (newSelected.has(rackId)) {
      newSelected.delete(rackId)
    } else {
      newSelected.add(rackId)
    }
    setSelectedRacks(newSelected)
  }

  const handleSelectAll = () => {
    setSelectedRacks(new Set(filteredRacks.map(r => r.id)))
  }

  const handleDeselectAll = () => {
    setSelectedRacks(new Set())
  }

  const filteredRacks = racks.filter(rack =>
    rack.rack_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rack.barcode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rack.display_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const generatePDF = async () => {
    if (selectedRacks.size === 0) {
      setError('Please select at least one rack to print')
      return
    }

    setGenerating(true)
    setError(null)

    try {
      // Create PDF document (Letter size)
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'in',
        format: 'letter'
      })

      // Label dimensions for 21 per page (3 columns x 7 rows)
      const labelWidth = 2.625
      const labelHeight = 1.43
      const marginLeft = 0.19
      const marginTop = 0.5
      const horizontalGap = 0.125
      const verticalGap = 0

      // Get selected racks in order
      const selectedRacksList = racks.filter(r => selectedRacks.has(r.id))
      
      // Generate barcodes as images
      const barcodeImages: { [key: string]: string } = {}
      
      // Wait for all barcode canvases to be ready
      await new Promise(resolve => setTimeout(resolve, 100))
      
      for (const rack of selectedRacksList) {
        const barcodeDiv = barcodeRefs.current[rack.id]
        if (barcodeDiv) {
          const svg = barcodeDiv.querySelector('svg')
          if (svg) {
            // Convert SVG to data URL
            const svgData = new XMLSerializer().serializeToString(svg)
            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d')
            const img = new Image()
            
            await new Promise((resolve, reject) => {
              img.onload = () => {
                canvas.width = img.width
                canvas.height = img.height
                ctx?.drawImage(img, 0, 0)
                barcodeImages[rack.id] = canvas.toDataURL('image/png')
                resolve(null)
              }
              img.onerror = reject
              img.src = 'data:image/svg+xml;base64,' + btoa(svgData)
            })
          }
        }
      }

      // Add labels to PDF
      let currentPage = 0
      selectedRacksList.forEach((rack, index) => {
        // Calculate position on page
        const position = index % 21 // 21 labels per page
        const col = position % 3
        const row = Math.floor(position / 3)
        
        // Add new page if needed
        if (index > 0 && position === 0) {
          pdf.addPage()
          currentPage++
        }

        // Calculate label position
        const x = marginLeft + (col * (labelWidth + horizontalGap))
        const y = marginTop + (row * (labelHeight + verticalGap))

        // Add border for label (optional - for testing alignment)
        // pdf.setDrawColor(200)
        // pdf.rect(x, y, labelWidth, labelHeight)

        // Add rack display name (top of label)
        pdf.setFontSize(11)
        pdf.setFont('helvetica', 'bold')
        pdf.text(rack.display_name, x + labelWidth / 2, y + 0.25, { align: 'center' })

        // Add barcode image
        if (barcodeImages[rack.id]) {
          const barcodeWidth = labelWidth * 0.8
          const barcodeHeight = labelHeight * 0.5
          const barcodeX = x + (labelWidth - barcodeWidth) / 2
          const barcodeY = y + 0.35
          
          pdf.addImage(
            barcodeImages[rack.id],
            'PNG',
            barcodeX,
            barcodeY,
            barcodeWidth,
            barcodeHeight
          )
        }

        // Add barcode text below (for manual entry if needed)
        pdf.setFontSize(9)
        pdf.setFont('helvetica', 'normal')
        pdf.text(rack.barcode, x + labelWidth / 2, y + labelHeight - 0.15, { align: 'center' })
      })

      // Save the PDF
      pdf.save(`rack-labels-${sessionName}-${new Date().toISOString().split('T')[0]}.pdf`)
      
      // Success message
      setError(null)
      onClose()
    } catch (err: any) {
      console.error('Error generating PDF:', err)
      setError('Failed to generate PDF. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { height: '80vh', display: 'flex', flexDirection: 'column' }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Print />
            <Typography variant="h6">Print Rack Labels</Typography>
            <Chip label={`${sessionName} Session`} size="small" color="primary" />
          </Box>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', pb: 1 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Search and Actions Bar */}
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <TextField
            size="small"
            placeholder="Search racks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />
            }}
            sx={{ flexGrow: 1 }}
          />
          <Button
            startIcon={<CheckBox />}
            onClick={handleSelectAll}
            size="small"
            variant="outlined"
          >
            Select All
          </Button>
          <Button
            startIcon={<CheckBoxOutlineBlank />}
            onClick={handleDeselectAll}
            size="small"
            variant="outlined"
          >
            Clear All
          </Button>
        </Box>

        {/* Selected count */}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {selectedRacks.size} of {filteredRacks.length} racks selected for printing
        </Typography>

        {/* Rack List */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <List sx={{ flex: 1, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
            {filteredRacks.map((rack) => (
              <ListItem key={rack.id} disablePadding>
                <ListItemButton onClick={() => handleToggleRack(rack.id)}>
                  <ListItemIcon>
                    <Checkbox
                      edge="start"
                      checked={selectedRacks.has(rack.id)}
                      tabIndex={-1}
                      disableRipple
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={rack.display_name}
                    secondary={`Barcode: ${rack.barcode}`}
                  />
                  {/* Hidden barcode for PDF generation */}
                  <div
                    ref={(el) => {
                      if (el) barcodeRefs.current[rack.id] = el
                    }}
                    style={{ display: 'none' }}
                  >
                    <Barcode
                      value={rack.barcode}
                      format="CODE128"
                      width={2}
                      height={50}
                      displayValue={false}
                    />
                  </div>
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}

        {/* Info text */}
        <Typography variant="caption" color="text.secondary" sx={{ mt: 2 }}>
          Labels will be generated in PDF format (21 per page) optimized for standard label sheets.
          Print on Avery 5160 or compatible label sheets.
        </Typography>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          startIcon={generating ? <CircularProgress size={20} /> : <Print />}
          onClick={generatePDF}
          disabled={selectedRacks.size === 0 || generating}
        >
          {generating ? 'Generating PDF...' : `Print ${selectedRacks.size} Label${selectedRacks.size !== 1 ? 's' : ''}`}
        </Button>
      </DialogActions>
    </Dialog>
  )
}