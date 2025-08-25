'use client'

import React, { createContext, useContext, useState, ReactNode } from 'react'

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

interface FilterContextType {
  filters: FilterState
  setFilters: (filters: FilterState) => void
  updateFilters: (updates: Partial<FilterState>) => void
  clearFilters: () => void
  hasActiveFilters: boolean
}

const defaultFilters: FilterState = {
  rackStatus: [],
  scannerActivity: 'all',
  brandFilter: [],
  searchQuery: '',
  dateRange: { start: '', end: '' },
}

const FilterContext = createContext<FilterContextType | undefined>(undefined)

export function FilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<FilterState>(defaultFilters)

  const updateFilters = (updates: Partial<FilterState>) => {
    setFilters(prev => ({ ...prev, ...updates }))
  }

  const clearFilters = () => {
    setFilters(defaultFilters)
  }

  const hasActiveFilters = 
    filters.rackStatus.length > 0 ||
    filters.scannerActivity !== 'all' ||
    filters.brandFilter.length > 0 ||
    filters.searchQuery.length > 0 ||
    Boolean(filters.dateRange.start) ||
    Boolean(filters.dateRange.end)

  return (
    <FilterContext.Provider value={{
      filters,
      setFilters,
      updateFilters,
      clearFilters,
      hasActiveFilters,
    }}>
      {children}
    </FilterContext.Provider>
  )
}

export function useFilters() {
  const context = useContext(FilterContext)
  if (context === undefined) {
    throw new Error('useFilters must be used within a FilterProvider')
  }
  return context
}

// Filtering utility functions
export function filterRacks(racks: any[], filters: FilterState) {
  return racks.filter(rack => {
    // Status filter
    if (filters.rackStatus.length > 0 && !filters.rackStatus.includes(rack.status)) {
      return false
    }

    // Search query filter
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase()
      const searchableText = [
        rack.rack_number,
        rack.scanner_username,
        rack.status,
      ].filter(Boolean).join(' ').toLowerCase()
      
      if (!searchableText.includes(query)) {
        return false
      }
    }

    return true
  })
}

export function filterScanners(scanners: any[], filters: FilterState) {
  return scanners.filter(scanner => {
    // Activity filter
    if (filters.scannerActivity !== 'all') {
      const timeSince = scanner.time_since_last_scan || ''
      
      if (filters.scannerActivity === 'active') {
        const isActive = timeSince === 'Just now' || 
          (timeSince.includes('m ago') && parseInt(timeSince) <= 30)
        if (!isActive) return false
      }
      
      if (filters.scannerActivity === 'idle') {
        const isIdle = timeSince.includes('30m') || timeSince.includes('1h') || timeSince.includes('2h')
        if (!isIdle) return false
      }
      
      if (filters.scannerActivity === 'inactive') {
        const isInactive = (timeSince.includes('h ago') && parseInt(timeSince) > 2) || 
                          timeSince.includes('d ago')
        if (!isInactive) return false
      }
    }

    // Search query filter
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase()
      const searchableText = [
        scanner.username,
        scanner.full_name,
        scanner.current_rack,
      ].filter(Boolean).join(' ').toLowerCase()
      
      if (!searchableText.includes(query)) {
        return false
      }
    }

    return true
  })
}

export function filterBrandVariance(brandData: any[], filters: FilterState) {
  return brandData.filter(brand => {
    // Brand filter
    if (filters.brandFilter.length > 0 && !filters.brandFilter.includes(brand.brand)) {
      return false
    }

    // Search query filter
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase()
      if (!brand.brand.toLowerCase().includes(query)) {
        return false
      }
    }

    return true
  })
}