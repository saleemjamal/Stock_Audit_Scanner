'use client'

import { useState } from 'react'
import {
  Box,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Chip,
  Autocomplete,
  Typography,
  IconButton,
  Collapse,
  Grid,
} from '@mui/material'
import {
  FilterList,
  Clear,
  ExpandMore,
  ExpandLess,
} from '@mui/icons-material'

export interface FilterState {
  rackStatus: string[]
  scannerActivity: string
  brandFilter: string[]
  searchQuery: string
  dateRange: {
    start: string
    end: string
  }
}

interface FilterBarProps {
  filters: FilterState
  onFiltersChange: (filters: FilterState) => void
  availableBrands?: string[]
  showRackFilters?: boolean
  showScannerFilters?: boolean
  showBrandFilters?: boolean
  showDateFilters?: boolean
  showSearch?: boolean
}

const rackStatusOptions = [
  { value: 'available', label: 'Available', color: '#9e9e9e' },
  { value: 'assigned', label: 'Assigned', color: '#2196f3' },
  { value: 'ready_for_approval', label: 'Ready for Approval', color: '#ff9800' },
  { value: 'approved', label: 'Approved', color: '#4caf50' },
  { value: 'rejected', label: 'Rejected', color: '#f44336' },
]

const scannerActivityOptions = [
  { value: 'all', label: 'All Scanners' },
  { value: 'active', label: 'Active (< 30min)' },
  { value: 'idle', label: 'Idle (30min - 2hr)' },
  { value: 'inactive', label: 'Inactive (> 2hr)' },
]

export default function FilterBar({
  filters,
  onFiltersChange,
  availableBrands = [],
  showRackFilters = true,
  showScannerFilters = true,
  showBrandFilters = true,
  showDateFilters = false,
  showSearch = true,
}: FilterBarProps) {
  const [expanded, setExpanded] = useState(false)

  const updateFilters = (updates: Partial<FilterState>) => {
    onFiltersChange({ ...filters, ...updates })
  }

  const clearAllFilters = () => {
    onFiltersChange({
      rackStatus: [],
      scannerActivity: 'all',
      brandFilter: [],
      searchQuery: '',
      dateRange: { start: '', end: '' },
    })
  }

  const hasActiveFilters = 
    filters.rackStatus.length > 0 ||
    filters.scannerActivity !== 'all' ||
    filters.brandFilter.length > 0 ||
    filters.searchQuery.length > 0 ||
    filters.dateRange.start ||
    filters.dateRange.end

  return (
    <Card elevation={1} sx={{ mb: 3 }}>
      <CardContent sx={{ pb: expanded ? 2 : 1 }}>
        {/* Compact Filter Row */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FilterList color="action" />
            <Typography variant="subtitle2" color="text.secondary">
              Filters
            </Typography>
            {hasActiveFilters && (
              <Chip
                size="small"
                label={`${filters.rackStatus.length + filters.brandFilter.length + (filters.scannerActivity !== 'all' ? 1 : 0) + (filters.searchQuery ? 1 : 0)} active`}
                color="primary"
                variant="filled"
                sx={{ fontSize: '0.75rem', height: 20 }}
              />
            )}
          </Box>

          {showSearch && (
            <TextField
              size="small"
              placeholder="Search racks, scanners..."
              value={filters.searchQuery}
              onChange={(e) => updateFilters({ searchQuery: e.target.value })}
              sx={{ minWidth: 200 }}
            />
          )}

          {showRackFilters && (
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Rack Status</InputLabel>
              <Select
                multiple
                value={filters.rackStatus}
                onChange={(e) => updateFilters({ rackStatus: e.target.value as string[] })}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => {
                      const option = rackStatusOptions.find(opt => opt.value === value)
                      return (
                        <Chip 
                          key={value} 
                          label={option?.label} 
                          size="small"
                          sx={{ 
                            height: 20, 
                            fontSize: '0.75rem',
                            bgcolor: option?.color,
                            color: 'white'
                          }}
                        />
                      )
                    })}
                  </Box>
                )}
              >
                {rackStatusOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    <Chip
                      label={option.label}
                      size="small"
                      sx={{ bgcolor: option.color, color: 'white' }}
                    />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {showScannerFilters && (
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Activity</InputLabel>
              <Select
                value={filters.scannerActivity}
                onChange={(e) => updateFilters({ scannerActivity: e.target.value })}
              >
                {scannerActivityOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {hasActiveFilters && (
            <IconButton
              size="small"
              onClick={clearAllFilters}
              color="secondary"
              title="Clear all filters"
            >
              <Clear />
            </IconButton>
          )}

          {(showBrandFilters || showDateFilters) && (
            <IconButton
              size="small"
              onClick={() => setExpanded(!expanded)}
              title="More filters"
            >
              {expanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          )}
        </Box>

        {/* Expanded Filters */}
        <Collapse in={expanded}>
          <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
            <Grid container spacing={2}>
              {showBrandFilters && (
                <Grid item xs={12} sm={6} md={4}>
                  <Autocomplete
                    multiple
                    size="small"
                    options={availableBrands}
                    value={filters.brandFilter}
                    onChange={(_, value) => updateFilters({ brandFilter: value })}
                    renderTags={(value, getTagProps) =>
                      value.map((option, index) => (
                        <Chip
                          variant="outlined"
                          label={option}
                          size="small"
                          {...getTagProps({ index })}
                          key={option}
                        />
                      ))
                    }
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Brand Filter"
                        placeholder="Select brands..."
                      />
                    )}
                  />
                </Grid>
              )}

              {showDateFilters && (
                <>
                  <Grid item xs={12} sm={6} md={4}>
                    <TextField
                      size="small"
                      type="date"
                      label="Start Date"
                      value={filters.dateRange.start}
                      onChange={(e) => updateFilters({ 
                        dateRange: { ...filters.dateRange, start: e.target.value }
                      })}
                      InputLabelProps={{ shrink: true }}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <TextField
                      size="small"
                      type="date"
                      label="End Date"
                      value={filters.dateRange.end}
                      onChange={(e) => updateFilters({ 
                        dateRange: { ...filters.dateRange, end: e.target.value }
                      })}
                      InputLabelProps={{ shrink: true }}
                      fullWidth
                    />
                  </Grid>
                </>
              )}
            </Grid>
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  )
}