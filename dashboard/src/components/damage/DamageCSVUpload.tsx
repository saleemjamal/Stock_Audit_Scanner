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
import Papa from 'papaparse'

interface CSVRow {
  barcode: string
  severity: string
  description: string
}

interface DamageCSVUploadProps {
  sessionId: string
  onComplete: () => void
}

export default function DamageCSVUpload({ sessionId, onComplete }: DamageCSVUploadProps) {
  const [csvData, setCsvData] = useState<CSVRow[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setError(null)
    
    Papa.parse(file, {
      header: true,
      complete: (results) => {
        try {
          const rows = results.data as any[]
          console.log('Parsed CSV data:', rows)
          
          // Validate and clean data
          const validRows: CSVRow[] = rows
            .filter(row => row.barcode && row.severity) // Must have barcode and severity
            .map(row => ({
              barcode: String(row.barcode).trim(),
              severity: String(row.severity).trim().toLowerCase(),
              description: row.description ? String(row.description).trim() : ''
            }))
            .filter(row => ['minor', 'medium', 'severe', 'total_loss'].includes(row.severity))

          if (validRows.length === 0) {
            setError('No valid rows found. Please ensure CSV has columns: barcode, severity, description')
            return
          }

          setCsvData(validRows)
          
          if (validRows.length < rows.length) {
            setError(`Warning: ${rows.length - validRows.length} rows were skipped due to missing or invalid data`)
          }
        } catch (err) {
          setError('Failed to process CSV data: ' + String(err))
        }
      },
      error: (err) => {
        setError('Failed to parse CSV: ' + err.message)
      }
    })
  }

  const handleImport = async () => {
    setUploading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/damage-csv-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          damages: csvData
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Import failed: ${errorText}`)
      }
      
      const result = await response.json()
      console.log('Import result:', result)
      
      onComplete()
    } catch (err) {
      setError('Import failed: ' + String(err))
    } finally {
      setUploading(false)
    }
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Import Damage Reports from CSV
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        CSV should have columns: <strong>barcode</strong>, <strong>severity</strong> (minor/medium/severe/total_loss), <strong>description</strong>
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
                  <TableCell sx={{ fontFamily: 'monospace' }}>{row.barcode}</TableCell>
                  <TableCell sx={{ textTransform: 'capitalize' }}>{row.severity}</TableCell>
                  <TableCell>{row.description || '-'}</TableCell>
                </TableRow>
              ))}
              {csvData.length > 5 && (
                <TableRow>
                  <TableCell colSpan={3} align="center" sx={{ color: 'text.secondary' }}>
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
            size="large"
          >
            {uploading ? 'Importing...' : `Import ${csvData.length} Items`}
          </Button>
        </>
      )}
    </Paper>
  )
}