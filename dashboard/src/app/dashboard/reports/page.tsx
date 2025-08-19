'use client'

import { useEffect, useState } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  CircularProgress,
  Alert,
  Container,
  Tabs,
  Tab,
  Switch,
  FormControlLabel,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  ImageList,
  ImageListItem,
  IconButton,
} from '@mui/material'
import {
  Assessment,
  CheckCircle,
  Timer,
  LocationOn,
  Download,
  FileDownload,
  Storage,
  Search,
  Person,
  Warning,
  BrokenImage,
  Add,
  Visibility,
  Close,
  PhotoCamera,
  Inventory,
} from '@mui/icons-material'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { BrandVarianceReport } from '@/components/reports/BrandVarianceReport'
import { OverallVarianceReport } from '@/components/reports/OverallVarianceReport'

interface CompletedAuditSession {
  id: string
  location_name: string
  shortname: string
  started_at: string
  completed_at: string
  total_rack_count: number
  completed_rack_count: number
  approved_rack_count: number
  total_scans: number
  started_by_username: string
}

interface UserProfile {
  id: string
  email: string
  username: string
  role: 'scanner' | 'supervisor' | 'superuser'
  location_ids: number[]
}

interface Location {
  id: number
  name: string
}

interface SessionForReports {
  session_id: string
  shortname: string
  location_name: string
  status: 'active' | 'completed'
  started_at: string
  completed_at?: string
  total_racks: number
  total_scans: number
}

interface RackInfo {
  rack_id: string
  rack_number: string
  barcode?: string
  status: 'available' | 'assigned' | 'ready_for_approval' | 'approved' | 'rejected'
  scanner_name?: string
  scanner_username?: string
  scan_count: number
  assigned_at?: string
  completed_at?: string
  approved_at?: string
  rejected_at?: string
  rejection_reason?: string
}

interface RackExportData {
  rack_number: string
  barcode?: string
  location_name: string
  session_shortname: string
  scanner_name?: string
  scanner_username?: string
  status: 'available' | 'assigned' | 'ready_for_approval' | 'approved' | 'rejected'
  assigned_at?: string
  completed_at?: string
  approved_at?: string
  rejected_at?: string
  rejection_reason?: string
  scan_count: number
  scan_barcode?: string
  scanned_at?: string
  manual_entry?: boolean
  scan_notes?: string
}

interface DamageReport {
  id: string
  barcode: string
  damage_description?: string
  damage_severity: 'minor' | 'medium' | 'severe' | 'total_loss'
  status: 'pending' | 'approved' | 'rejected' | 'removed_from_stock'
  reported_by_name: string
  reported_at: string
  approved_at?: string
  approved_by_name?: string
  rejection_reason?: string
  removed_from_stock: boolean
  estimated_loss_value?: number
  image_count: number
}

export default function ReportsPage() {
  const router = useRouter()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [locations, setLocations] = useState<Location[]>([])
  const [completedSessions, setCompletedSessions] = useState<CompletedAuditSession[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<string>('all')
  const [selectedSession, setSelectedSession] = useState<string>('all')
  
  // New state for rack reports
  const [activeTab, setActiveTab] = useState<number>(0)
  const [sessionsForReports, setSessionsForReports] = useState<SessionForReports[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string>('')
  const [includeActiveRacks, setIncludeActiveRacks] = useState<boolean>(false)
  const [sessionRacks, setSessionRacks] = useState<RackInfo[]>([])
  const [rackSearchTerm, setRackSearchTerm] = useState<string>('')
  const [loadingRacks, setLoadingRacks] = useState<boolean>(false)
  
  // State for damage reports
  const [damageReports, setDamageReports] = useState<DamageReport[]>([])
  const [selectedDamageSessionId, setSelectedDamageSessionId] = useState<string>('')
  const [loadingDamageReports, setLoadingDamageReports] = useState<boolean>(false)
  
  // State for add-on reports
  const [addOnReports, setAddOnReports] = useState<any[]>([])
  const [selectedAddOnSessionId, setSelectedAddOnSessionId] = useState<string>('')
  const [loadingAddOnReports, setLoadingAddOnReports] = useState<boolean>(false)
  const [addOnStatusFilter, setAddOnStatusFilter] = useState<string>('all')
  
  // State for partial damage reports
  const [partialDamageReports, setPartialDamageReports] = useState<any[]>([])
  const [selectedPartialDamageSessionId, setSelectedPartialDamageSessionId] = useState<string>('')
  const [loadingPartialDamageReports, setLoadingPartialDamageReports] = useState<boolean>(false)
  const [partialDamageSeverityFilter, setPartialDamageSeverityFilter] = useState<string>('all')
  
  // State for photo viewing modal
  const [photoModalOpen, setPhotoModalOpen] = useState<boolean>(false)
  const [selectedPartialDamagePhotos, setSelectedPartialDamagePhotos] = useState<{
    barcode: string;
    damageType: string;
    severity: string;
    photoUrls: string[];
  } | null>(null)
  
  const supabase = createClient()

  useEffect(() => {
    checkAuthAndLoadData()
  }, [])

  useEffect(() => {
    if (userProfile) {
      loadCompletedSessions()
    }
  }, [selectedLocation, userProfile])

  const checkAuthAndLoadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }

      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('email', user.email)
        .single()

      if (!profile || profile.role === 'scanner') {
        router.push('/dashboard?error=insufficient_permissions')
        return
      }

      setUserProfile(profile)
      await loadLocations(profile)
    } catch (error) {
      console.error('Auth check error:', error)
      router.push('/auth/login')
    } finally {
      setLoading(false)
    }
  }

  const loadLocations = async (profile: UserProfile) => {
    try {
      let query = supabase
        .from('locations')
        .select('id, name')
        .eq('active', true)
        .order('name')

      // Filter by user's locations if not superuser
      if (profile.role !== 'superuser' && profile.location_ids?.length > 0) {
        query = query.in('id', profile.location_ids)
      }

      const { data, error } = await query
      if (error) throw error
      setLocations(data || [])
    } catch (error) {
      console.error('Error loading locations:', error)
    }
  }

  const loadCompletedSessions = async () => {
    try {
      console.log('Loading completed audit sessions...')
      
      // Build query for completed sessions only
      let query = supabase
        .from('audit_sessions')
        .select(`
          id,
          location_id,
          shortname,
          started_at,
          completed_at,
          total_rack_count,
          locations!inner(name),
          users!audit_sessions_started_by_fkey(username)
        `)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })

      // Filter by location if not "all"
      if (selectedLocation !== 'all') {
        query = query.eq('location_id', parseInt(selectedLocation))
      }

      // Filter by user's locations if not superuser
      if (userProfile?.role !== 'superuser' && userProfile?.location_ids?.length) {
        query = query.in('location_id', userProfile.location_ids)
      }

      const { data: sessions, error } = await query
      if (error) throw error

      console.log('Completed sessions:', sessions)

      // Get additional statistics for each session
      const sessionsWithStats = await Promise.all(
        (sessions || []).map(async (session) => {
          // Get rack statistics
          const { data: racks } = await supabase
            .from('racks')
            .select('status')
            .eq('audit_session_id', session.id)

          const completedRackCount = racks?.filter(r => 
            r.status === 'approved' || r.status === 'ready_for_approval'
          ).length || 0
          
          const approvedRackCount = racks?.filter(r => r.status === 'approved').length || 0

          // Get total scan count
          const { data: scans } = await supabase
            .from('scans')
            .select('id')
            .eq('audit_session_id', session.id)

          const totalScans = scans?.length || 0

          return {
            id: session.id,
            location_name: (session as any).locations.name,
            shortname: session.shortname || 'N/A',
            started_at: session.started_at,
            completed_at: session.completed_at,
            total_rack_count: session.total_rack_count,
            completed_rack_count: completedRackCount,
            approved_rack_count: approvedRackCount,
            total_scans: totalScans,
            started_by_username: (session as any).users?.username || 'Unknown',
          }
        })
      )

      setCompletedSessions(sessionsWithStats)
    } catch (error) {
      console.error('Error loading completed sessions:', error)
    }
  }

  const exportSessionCSV = async (sessionId: string) => {
    setExporting(true)
    try {
      console.log('Exporting CSV for session:', sessionId)
      
      const { data: scans, error } = await supabase
        .from('scans')
        .select('barcode')
        .eq('audit_session_id', sessionId)
        .order('created_at')
        
      console.log('Query result for session', sessionId, ':', scans)

      if (error) throw error
      if (!scans || scans.length === 0) {
        alert('No scans found for this session')
        return
      }

      // Create CSV content with single column of barcodes
      const csvContent = [
        'barcode', // Header
        ...scans.map(scan => scan.barcode)
      ].join('\n')

      // Find session info for filename
      const session = completedSessions.find(s => s.id === sessionId)
      const filename = session ? 
        `${session.shortname}-${session.location_name}-scans.csv`.replace(/[^a-zA-Z0-9-_]/g, '_') :
        `audit-session-${sessionId}-scans.csv`

      // Download the file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', filename)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      console.log(`Exported ${scans.length} barcodes to ${filename}`)
    } catch (error) {
      console.error('Error exporting CSV:', error)
      alert('Failed to export CSV. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  // Load sessions for rack reports
  const loadSessionsForReports = async () => {
    try {
      console.log('Loading sessions for reports...')
      const { data, error } = await supabase.rpc('get_sessions_for_reports')
      console.log('Sessions query result:', { data, error })
      if (error) throw error
      console.log(`Found ${data?.length || 0} sessions`)
      setSessionsForReports(data || [])
    } catch (error) {
      console.error('Error loading sessions for reports:', error)
    }
  }

  // Load racks for selected session
  const loadRacksForSession = async (sessionId: string) => {
    if (!sessionId) {
      setSessionRacks([])
      return
    }
    
    setLoadingRacks(true)
    try {
      console.log('Loading racks for session:', sessionId, 'includeActive:', includeActiveRacks)
      const { data, error } = await supabase.rpc('get_racks_by_session', {
        p_session_id: sessionId,
        p_include_active: includeActiveRacks
      })
      console.log('Racks query result:', { data, error })
      if (error) throw error
      console.log(`Found ${data?.length || 0} racks`)
      setSessionRacks(data || [])
    } catch (error) {
      console.error('Error loading racks:', error)
    } finally {
      setLoadingRacks(false)
    }
  }

  // Export rack CSV
  const exportRackCSV = async (rackId: string) => {
    setExporting(true)
    try {
      const { data, error } = await supabase.rpc('get_rack_export_data', {
        p_rack_id: rackId
      })
      
      if (error) throw error
      if (!data || data.length === 0) {
        alert('No data found for this rack')
        return
      }

      const rackInfo = data[0]
      const isActive = rackInfo.status === 'assigned'
      
      // Create CSV header
      const csvLines = [
        `Rack Report: ${rackInfo.rack_number} - ${rackInfo.location_name} - ${rackInfo.session_shortname}`,
        `Scanner: ${rackInfo.scanner_name || 'Unassigned'}`,
        `Status: ${rackInfo.status}${isActive ? ' (Active - In Progress)' : ''}`,
        `Total Scans: ${rackInfo.scan_count}`,
        ''
      ]

      // Add timestamps if available
      if (rackInfo.assigned_at) {
        csvLines.push(`Assigned: ${new Date(rackInfo.assigned_at).toLocaleString()}`)
      }
      if (rackInfo.completed_at) {
        csvLines.push(`Completed: ${new Date(rackInfo.completed_at).toLocaleString()}`)
      }
      if (rackInfo.approved_at) {
        csvLines.push(`Approved: ${new Date(rackInfo.approved_at).toLocaleString()}`)
      }
      if (rackInfo.rejected_at) {
        csvLines.push(`Rejected: ${new Date(rackInfo.rejected_at).toLocaleString()}`)
        if (rackInfo.rejection_reason) {
          csvLines.push(`Reason: ${rackInfo.rejection_reason}`)
        }
      }
      
      csvLines.push('')
      
      // Add scan header and data
      csvLines.push('Barcode,Scanned At,Type,Notes')
      
      data.forEach((row: RackExportData) => {
        if (row.scan_barcode && row.scanned_at) {
          csvLines.push([
            row.scan_barcode,
            new Date(row.scanned_at).toLocaleString(),
            row.manual_entry ? 'Manual' : 'Scanner',
            row.scan_notes || ''
          ].join(','))
        }
      })

      // Add warning for active racks
      if (isActive) {
        csvLines.push('')
        csvLines.push('WARNING: This rack is still active - data may be incomplete')
      }

      const csvContent = csvLines.join('\n')
      
      // Create filename
      const filename = `Rack-${rackInfo.rack_number}-${rackInfo.session_shortname}-${rackInfo.location_name}.csv`
        .replace(/[^a-zA-Z0-9-_.]/g, '_')

      // Download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', filename)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      console.log(`Exported rack ${rackInfo.rack_number} to ${filename}`)
    } catch (error) {
      console.error('Error exporting rack CSV:', error)
      alert('Failed to export rack CSV. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  // Load damage reports for selected session
  const loadDamageReports = async (sessionId: string) => {
    if (!sessionId) {
      setDamageReports([])
      return
    }

    setLoadingDamageReports(true)
    try {
      // Get damage reports for the session
      const { data: damages, error } = await supabase
        .from('damaged_items')
        .select(`
          id,
          barcode,
          damage_description,
          damage_severity,
          status,
          reported_at,
          approved_at,
          rejection_reason,
          removed_from_stock,
          estimated_loss_value,
          reported_by:users!damaged_items_reported_by_fkey(full_name, username),
          approved_by:users!damaged_items_approved_by_fkey(full_name, username)
        `)
        .eq('audit_session_id', sessionId)
        .order('reported_at', { ascending: false })

      if (error) throw error

      // Get image counts for each damage report
      const damagesWithImages = await Promise.all(
        (damages || []).map(async (damage) => {
          const { count } = await supabase
            .from('damage_images')
            .select('*', { count: 'exact', head: true })
            .eq('damaged_item_id', damage.id)

          return {
            id: damage.id,
            barcode: damage.barcode,
            damage_description: damage.damage_description,
            damage_severity: damage.damage_severity,
            status: damage.status,
            reported_by_name: (damage.reported_by as any)?.full_name || (damage.reported_by as any)?.username || 'Unknown',
            reported_at: damage.reported_at,
            approved_at: damage.approved_at,
            approved_by_name: (damage.approved_by as any)?.full_name || (damage.approved_by as any)?.username,
            rejection_reason: damage.rejection_reason,
            removed_from_stock: damage.removed_from_stock,
            estimated_loss_value: damage.estimated_loss_value,
            image_count: count || 0
          }
        })
      )

      setDamageReports(damagesWithImages)
    } catch (error) {
      console.error('Error loading damage reports:', error)
    } finally {
      setLoadingDamageReports(false)
    }
  }

  // Export damage report CSV
  const exportDamageCSV = async (sessionId: string) => {
    setExporting(true)
    try {
      const session = sessionsForReports.find(s => s.session_id === sessionId)
      
      // Create CSV content
      const csvLines = [
        'Damage Report Summary',
        `Session: ${session?.shortname || 'Unknown'}`,
        `Location: ${session?.location_name || 'Unknown'}`,
        `Generated: ${new Date().toLocaleString()}`,
        '',
        'Barcode,Severity,Status,Reported By,Reported Date,Approved/Rejected By,Decision Date,Removed From Stock,Estimated Loss,Photos,Description,Rejection Reason'
      ]

      damageReports.forEach(report => {
        csvLines.push([
          report.barcode,
          report.damage_severity,
          report.status,
          report.reported_by_name,
          new Date(report.reported_at).toLocaleDateString(),
          report.approved_by_name || '',
          report.approved_at ? new Date(report.approved_at).toLocaleDateString() : '',
          report.removed_from_stock ? 'Yes' : 'No',
          report.estimated_loss_value || '',
          report.image_count,
          `"${report.damage_description || ''}"`,
          `"${report.rejection_reason || ''}"`
        ].join(','))
      })

      // Add summary
      const pendingCount = damageReports.filter(r => r.status === 'pending').length
      const approvedCount = damageReports.filter(r => r.status === 'approved').length
      const rejectedCount = damageReports.filter(r => r.status === 'rejected').length
      const removedCount = damageReports.filter(r => r.removed_from_stock).length
      const totalLoss = damageReports.reduce((sum, r) => sum + (r.estimated_loss_value || 0), 0)

      csvLines.push('')
      csvLines.push('Summary')
      csvLines.push(`Total Reports: ${damageReports.length}`)
      csvLines.push(`Pending: ${pendingCount}`)
      csvLines.push(`Approved: ${approvedCount}`)
      csvLines.push(`Rejected: ${rejectedCount}`)
      csvLines.push(`Removed from Stock: ${removedCount}`)
      csvLines.push(`Total Estimated Loss: ₹${totalLoss.toFixed(2)}`)

      const csvContent = csvLines.join('\n')
      const filename = `damage-report-${session?.shortname || sessionId}-${new Date().toISOString().split('T')[0]}.csv`

      // Download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', filename)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

    } catch (error) {
      console.error('Error exporting damage CSV:', error)
      alert('Failed to export damage report')
    } finally {
      setExporting(false)
    }
  }

  // Export Add-On CSV
  const exportAddOnCSV = async () => {
    setExporting(true)
    try {
      const session = sessionsForReports.find(s => s.session_id === selectedAddOnSessionId)
      
      const filteredAddOns = addOnReports.filter(addOn => 
        addOnStatusFilter === 'all' || addOn.status === addOnStatusFilter
      )

      // Create CSV content
      const csvLines = []
      
      // Header info
      csvLines.push(`Add-On Report`)
      csvLines.push(`Session: ${session?.shortname} - ${session?.location_name}`)
      csvLines.push(`Generated: ${new Date().toLocaleString()}`)
      csvLines.push(`Status Filter: ${addOnStatusFilter === 'all' ? 'All Statuses' : addOnStatusFilter.charAt(0).toUpperCase() + addOnStatusFilter.slice(1)}`)
      csvLines.push(`Total Items: ${filteredAddOns.length}`)
      csvLines.push('')
      
      // Summary stats
      const pendingCount = filteredAddOns.filter(a => a.status === 'pending').length
      const approvedCount = filteredAddOns.filter(a => a.status === 'approved').length  
      const rejectedCount = filteredAddOns.filter(a => a.status === 'rejected').length
      const totalCostValue = filteredAddOns.reduce((sum, a) => sum + (a.cost_price || 0), 0)
      const totalSellingValue = filteredAddOns.reduce((sum, a) => sum + (a.selling_price || 0), 0)

      csvLines.push(`SUMMARY:`)
      csvLines.push(`Pending: ${pendingCount}`)
      csvLines.push(`Approved: ${approvedCount}`)
      csvLines.push(`Rejected: ${rejectedCount}`)
      csvLines.push(`Total Cost Value: ₹${totalCostValue.toFixed(2)}`)
      csvLines.push(`Total Selling Value: ₹${totalSellingValue.toFixed(2)}`)
      csvLines.push('')

      // Column headers
      csvLines.push('Brand,Item Name,Quantity,Cost Price,Selling Price,Reason,Reporter,Status,Reported Date,Reviewed By,Reviewed Date,Rejection Reason')
      
      // Data rows
      filteredAddOns.forEach(addOn => {
        const row = [
          addOn.brand || '',
          addOn.item_name || '',
          addOn.quantity || 0,
          addOn.cost_price ? `₹${addOn.cost_price.toFixed(2)}` : '',
          addOn.selling_price ? `₹${addOn.selling_price.toFixed(2)}` : '',
          `"${(addOn.reason || '').replace(/"/g, '""')}"`, // Escape quotes
          addOn.reported_by?.full_name || addOn.reported_by?.username || '',
          addOn.status || '',
          new Date(addOn.reported_at).toLocaleDateString(),
          addOn.reviewed_by ? (addOn.reviewed_by.full_name || addOn.reviewed_by.username) : '',
          addOn.reviewed_at ? new Date(addOn.reviewed_at).toLocaleDateString() : '',
          addOn.rejection_reason ? `"${addOn.rejection_reason.replace(/"/g, '""')}"` : ''
        ]
        csvLines.push(row.join(','))
      })

      const csvContent = csvLines.join('\n')
      const filename = `add-on-report-${session?.shortname || selectedAddOnSessionId}-${new Date().toISOString().split('T')[0]}.csv`

      // Download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', filename)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

    } catch (error) {
      console.error('Error exporting add-on CSV:', error)
      alert('Failed to export add-on report')
    } finally {
      setExporting(false)
    }
  }

  // Export Partial Damage CSV
  const exportPartialDamageCSV = async () => {
    setExporting(true)
    try {
      const session = sessionsForReports.find(s => s.session_id === selectedPartialDamageSessionId)
      
      const filteredReports = partialDamageReports.filter(report => 
        partialDamageSeverityFilter === 'all' || report.severity === partialDamageSeverityFilter
      )

      // Create CSV content
      const csvLines = []
      
      // Header info
      csvLines.push(`Partial Damage Report`)
      csvLines.push(`Session: ${session?.shortname} - ${session?.location_name}`)
      csvLines.push(`Generated: ${new Date().toLocaleString()}`)
      csvLines.push(`Severity Filter: ${partialDamageSeverityFilter === 'all' ? 'All Severities' : partialDamageSeverityFilter.charAt(0).toUpperCase() + partialDamageSeverityFilter.slice(1)}`)
      csvLines.push(`Total Items: ${filteredReports.length}`)
      csvLines.push('')
      
      // Summary stats
      const severeCount = filteredReports.filter(r => r.severity === 'severe').length
      const moderateCount = filteredReports.filter(r => r.severity === 'moderate').length  
      const minorCount = filteredReports.filter(r => r.severity === 'minor').length

      csvLines.push(`SUMMARY BY SEVERITY:`)
      csvLines.push(`Severe: ${severeCount}`)
      csvLines.push(`Moderate: ${moderateCount}`)
      csvLines.push(`Minor: ${minorCount}`)
      csvLines.push('')

      // Summary by damage type
      const typeGroups = filteredReports.reduce((acc, report) => {
        const type = report.damage_type || 'unknown'
        acc[type] = (acc[type] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      csvLines.push(`SUMMARY BY TYPE:`)
      Object.entries(typeGroups).forEach(([type, count]) => {
        csvLines.push(`${type}: ${count}`)
      })
      csvLines.push('')

      // Column headers
      csvLines.push('Barcode,Damage Type,Severity,Units Affected,Remarks,Photos,Reported By,Date')
      
      // Data rows
      filteredReports.forEach(report => {
        const row = [
          report.barcode || '',
          report.damage_type || '',
          report.severity || '',
          report.unit_ratio || '',
          `"${(report.remarks || '').replace(/"/g, '""')}"`, // Escape quotes
          report.photo_count || 0,
          report.created_by_name || '',
          new Date(report.created_at).toLocaleDateString()
        ]
        csvLines.push(row.join(','))
      })

      const csvContent = csvLines.join('\n')
      const filename = `partial-damage-report-${session?.shortname || selectedPartialDamageSessionId}-${new Date().toISOString().split('T')[0]}.csv`

      // Download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', filename)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

    } catch (error) {
      console.error('Error exporting partial damage CSV:', error)
      alert('Failed to export partial damage report')
    } finally {
      setExporting(false)
    }
  }

  // Load sessions when switching to Racks, Damages, Add-Ons, Partial Damages, or Variance tabs
  useEffect(() => {
    if (activeTab === 1 || activeTab === 2 || activeTab === 3 || activeTab === 4 || activeTab === 5 || activeTab === 6) {
      loadSessionsForReports()
    }
  }, [activeTab])

  // Load racks when session or filter changes
  useEffect(() => {
    if (selectedSessionId) {
      loadRacksForSession(selectedSessionId)
    }
  }, [selectedSessionId, includeActiveRacks])

  // Load damage reports when session changes
  useEffect(() => {
    if (selectedDamageSessionId) {
      loadDamageReports(selectedDamageSessionId)
    }
  }, [selectedDamageSessionId])

  // Load add-on reports when session changes
  useEffect(() => {
    if (selectedAddOnSessionId) {
      loadAddOnReports(selectedAddOnSessionId)
    }
  }, [selectedAddOnSessionId])

  // Load partial damage reports when session changes
  useEffect(() => {
    if (selectedPartialDamageSessionId) {
      loadPartialDamageReports(selectedPartialDamageSessionId)
    }
  }, [selectedPartialDamageSessionId])


  // Load add-on reports function
  const loadAddOnReports = async (sessionId: string) => {
    setLoadingAddOnReports(true)
    try {
      const { data, error } = await supabase
        .from('add_on_items')
        .select(`
          *,
          reported_by:users!add_on_items_reported_by_fkey(username, full_name),
          reviewed_by:users!add_on_items_reviewed_by_fkey(username, full_name)
        `)
        .eq('audit_session_id', sessionId)
        .order('reported_at', { ascending: false })

      if (error) throw error
      setAddOnReports(data || [])
    } catch (error) {
      console.error('Error loading add-on reports:', error)
    } finally {
      setLoadingAddOnReports(false)
    }
  }

  // Load partial damage reports function
  const loadPartialDamageReports = async (sessionId: string) => {
    setLoadingPartialDamageReports(true)
    try {
      const response = await fetch(`/api/partial-damage?sessionId=${sessionId}`)
      const result = await response.json()
      
      if (result.success) {
        setPartialDamageReports(result.data || [])
      } else {
        console.error('Failed to load partial damage reports:', result.error)
        setPartialDamageReports([])
      }
    } catch (error) {
      console.error('Error loading partial damage reports:', error)
      setPartialDamageReports([])
    } finally {
      setLoadingPartialDamageReports(false)
    }
  }

  // Get status color for rack chips
  const getRackStatusColor = (status: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    switch (status) {
      case 'available': return 'default'
      case 'assigned': return 'info'
      case 'ready_for_approval': return 'warning'
      case 'approved': return 'success'
      case 'rejected': return 'error'
      default: return 'default'
    }
  }

  // Get status icon
  const getRackStatusIcon = (status: string) => {
    switch (status) {
      case 'available': return '🔵'
      case 'assigned': return '🔄'
      case 'ready_for_approval': return '⏳'
      case 'approved': return '✅'
      case 'rejected': return '❌'
      default: return '❓'
    }
  }

  // Get damage severity color
  const getDamageSeverityColor = (severity: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    switch (severity) {
      case 'minor': return 'info'
      case 'medium': return 'warning'
      case 'severe': return 'error'
      case 'total_loss': return 'error'
      default: return 'default'
    }
  }

  // Get damage status color
  const getDamageStatusColor = (status: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    switch (status) {
      case 'pending': return 'warning'
      case 'approved': return 'success'
      case 'rejected': return 'error'
      case 'removed_from_stock': return 'secondary'
      default: return 'default'
    }
  }

  // Handle opening photo modal
  const handleViewPhotos = (report: any) => {
    setSelectedPartialDamagePhotos({
      barcode: report.barcode,
      damageType: report.damage_type,
      severity: report.severity,
      photoUrls: report.photo_urls || []
    })
    setPhotoModalOpen(true)
  }

  // Handle closing photo modal
  const handleClosePhotoModal = () => {
    setPhotoModalOpen(false)
    setSelectedPartialDamagePhotos(null)
  }


  if (loading) {
    return (
      <DashboardLayout>
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
          <Box display="flex" justifyContent="center" p={4}>
            <CircularProgress />
          </Box>
        </Container>
      </DashboardLayout>
    )
  }

  const totalScans = completedSessions.reduce((sum, session) => sum + session.total_scans, 0)
  const totalRacks = completedSessions.reduce((sum, session) => sum + session.total_rack_count, 0)
  const approvedRacks = completedSessions.reduce((sum, session) => sum + session.approved_rack_count, 0)

  // Filter racks by search term
  const filteredRacks = sessionRacks.filter(rack => 
    rack.rack_number.toLowerCase().includes(rackSearchTerm.toLowerCase()) ||
    rack.scanner_name?.toLowerCase().includes(rackSearchTerm.toLowerCase()) ||
    rack.scanner_username?.toLowerCase().includes(rackSearchTerm.toLowerCase())
  )

  return (
    <DashboardLayout>
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1">
            Reports & Data Export
          </Typography>
        </Box>

        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
            <Tab 
              label="Audit Sessions" 
              icon={<Assessment />} 
              iconPosition="start"
            />
            <Tab 
              label="Racks" 
              icon={<Storage />} 
              iconPosition="start"
            />
            <Tab 
              label="Damages" 
              icon={<BrokenImage />} 
              iconPosition="start"
            />
            <Tab 
              label="Add-Ons" 
              icon={<Add />} 
              iconPosition="start"
            />
            <Tab 
              label="Partial Damages" 
              icon={<Warning />} 
              iconPosition="start"
            />
            <Tab 
              label="Brand Variance" 
              icon={<Assessment />} 
              iconPosition="start"
              disabled={userProfile?.role !== 'supervisor' && userProfile?.role !== 'superuser'}
              sx={{ 
                display: (userProfile?.role !== 'supervisor' && userProfile?.role !== 'superuser') ? 'none' : 'flex' 
              }}
            />
            <Tab 
              label="Overall Variance" 
              icon={<Inventory />} 
              iconPosition="start"
              disabled={userProfile?.role !== 'supervisor' && userProfile?.role !== 'superuser'}
              sx={{ 
                display: (userProfile?.role !== 'supervisor' && userProfile?.role !== 'superuser') ? 'none' : 'flex' 
              }}
            />
          </Tabs>
        </Box>

        {/* Tab Panel 1: Audit Sessions (existing content) */}
        {activeTab === 0 && (
          <>
            {/* Info Alert */}
            <Alert severity="info" sx={{ mb: 3 }}>
              This page shows completed audit sessions only. Active sessions are managed on the dashboard.
            </Alert>

        {/* Summary Stats */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Box sx={{ p: 1, borderRadius: 1, backgroundColor: 'primary.main', color: 'white', mr: 2 }}>
                    <Timer />
                  </Box>
                  <Box>
                    <Typography variant="h4" component="div">
                      {completedSessions.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Completed Sessions
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Box sx={{ p: 1, borderRadius: 1, backgroundColor: 'success.main', color: 'white', mr: 2 }}>
                    <Assessment />
                  </Box>
                  <Box>
                    <Typography variant="h4" component="div">
                      {totalScans.toLocaleString()}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Scans
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Box sx={{ p: 1, borderRadius: 1, backgroundColor: 'info.main', color: 'white', mr: 2 }}>
                    <CheckCircle />
                  </Box>
                  <Box>
                    <Typography variant="h4" component="div">
                      {totalRacks}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Racks
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Box sx={{ p: 1, borderRadius: 1, backgroundColor: 'warning.main', color: 'white', mr: 2 }}>
                    <LocationOn />
                  </Box>
                  <Box>
                    <Typography variant="h4" component="div">
                      {approvedRacks}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Approved Racks
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Filters and Export */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel>Location Filter</InputLabel>
                  <Select
                    value={selectedLocation}
                    onChange={(e) => setSelectedLocation(e.target.value)}
                    label="Location Filter"
                  >
                    <MenuItem value="all">All Locations</MenuItem>
                    {locations.map((location) => (
                      <MenuItem key={location.id} value={location.id.toString()}>
                        {location.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                
              </Box>
              
            </Box>
          </CardContent>
        </Card>

        {/* Completed Sessions Table */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
              <CheckCircle sx={{ mr: 1 }} />
              Completed Audit Sessions
            </Typography>
            
            <TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'auto' }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Session</TableCell>
                    <TableCell>Location</TableCell>
                    <TableCell>Started By</TableCell>
                    <TableCell>Completed</TableCell>
                    <TableCell align="right">Racks</TableCell>
                    <TableCell align="right">Scans</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {completedSessions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        <Typography color="text.secondary" sx={{ py: 4 }}>
                          No completed sessions found. Complete an active session to see reports here.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    completedSessions.map((session) => (
                      <TableRow key={session.id}>
                        <TableCell>
                          <Box>
                            <Typography variant="body2" fontWeight="bold">
                              {session.shortname}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              ID: {session.id.slice(0, 8)}...
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>{session.location_name}</TableCell>
                        <TableCell>{session.started_by_username}</TableCell>
                        <TableCell>
                          {new Date(session.completed_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell align="right">
                          <Box>
                            <Typography variant="body2">
                              {session.approved_rack_count}/{session.total_rack_count}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {session.total_rack_count > 0 ? 
                                `${((session.approved_rack_count / session.total_rack_count) * 100).toFixed(1)}%` : 
                                '0%'
                              }
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight="bold">
                            {session.total_scans.toLocaleString()}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<FileDownload />}
                            onClick={() => exportSessionCSV(session.id)}
                            disabled={exporting || session.total_scans === 0}
                          >
                            CSV
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
          </>
        )}

        {/* Tab Panel 2: Racks */}
        {activeTab === 1 && (
          <>
            {/* Session Selection */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Storage />
                  Rack Reports
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Select an audit session to view and export individual rack reports for physical verification.
                </Typography>
                
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Select Audit Session</InputLabel>
                  <Select
                    value={selectedSessionId}
                    onChange={(e) => setSelectedSessionId(e.target.value)}
                    label="Select Audit Session"
                  >
                    {sessionsForReports.map((session) => (
                      <MenuItem key={session.session_id} value={session.session_id}>
                        <Box>
                          <Typography variant="body2" fontWeight="bold">
                            {session.shortname} - {session.location_name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {session.status === 'active' ? '🔴 Active' : '✅ Completed'} • 
                            {session.total_racks} racks • {session.total_scans} scans
                          </Typography>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {selectedSessionId && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={includeActiveRacks}
                          onChange={(e) => setIncludeActiveRacks(e.target.checked)}
                        />
                      }
                      label="Include active racks (currently being scanned)"
                    />
                    <TextField
                      size="small"
                      placeholder="Search racks or scanners..."
                      value={rackSearchTerm}
                      onChange={(e) => setRackSearchTerm(e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Search />
                          </InputAdornment>
                        )
                      }}
                      sx={{ minWidth: 250 }}
                    />
                  </Box>
                )}
              </CardContent>
            </Card>

            {/* Racks Table */}
            {selectedSessionId && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Racks in Selected Session ({filteredRacks.length} of {sessionRacks.length})
                  </Typography>
                  
                  {includeActiveRacks && (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Warning />
                        Active racks are included. Data for in-progress racks may be incomplete.
                      </Box>
                    </Alert>
                  )}

                  {loadingRacks ? (
                    <Box display="flex" justifyContent="center" p={4}>
                      <CircularProgress />
                    </Box>
                  ) : (
                    <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>Rack #</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Scanner</TableCell>
                            <TableCell align="right">Scans</TableCell>
                            <TableCell>Last Activity</TableCell>
                            <TableCell align="right">Actions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {filteredRacks.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} align="center">
                                <Typography color="text.secondary" sx={{ py: 4 }}>
                                  {rackSearchTerm 
                                    ? 'No racks match your search criteria' 
                                    : includeActiveRacks 
                                      ? 'No racks found in this session'
                                      : 'No completed racks found. Toggle "Include active racks" to see work in progress.'
                                  }
                                </Typography>
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredRacks.map((rack) => (
                              <TableRow key={rack.rack_id} hover>
                                <TableCell>
                                  <Typography variant="body2" fontWeight="bold" fontFamily="monospace">
                                    {rack.rack_number}
                                  </Typography>
                                  {rack.barcode && (
                                    <Typography variant="caption" color="text.secondary">
                                      {rack.barcode}
                                    </Typography>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Chip
                                    label={`${getRackStatusIcon(rack.status)} ${rack.status.replace('_', ' ')}`}
                                    color={getRackStatusColor(rack.status)}
                                    size="small"
                                    sx={{ textTransform: 'capitalize' }}
                                  />
                                </TableCell>
                                <TableCell>
                                  {rack.scanner_name ? (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      <Person sx={{ fontSize: 16 }} />
                                      <Box>
                                        <Typography variant="body2">
                                          {rack.scanner_name}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                          @{rack.scanner_username}
                                        </Typography>
                                      </Box>
                                    </Box>
                                  ) : (
                                    <Typography variant="body2" color="text.secondary">
                                      Unassigned
                                    </Typography>
                                  )}
                                </TableCell>
                                <TableCell align="right">
                                  <Typography variant="body2" fontWeight="bold">
                                    {rack.scan_count}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  {rack.approved_at && (
                                    <Typography variant="caption" color="success.main">
                                      Approved {new Date(rack.approved_at).toLocaleDateString()}
                                    </Typography>
                                  )}
                                  {rack.rejected_at && (
                                    <Typography variant="caption" color="error.main">
                                      Rejected {new Date(rack.rejected_at).toLocaleDateString()}
                                    </Typography>
                                  )}
                                  {rack.completed_at && !rack.approved_at && !rack.rejected_at && (
                                    <Typography variant="caption" color="warning.main">
                                      Completed {new Date(rack.completed_at).toLocaleDateString()}
                                    </Typography>
                                  )}
                                  {rack.assigned_at && rack.status === 'assigned' && (
                                    <Typography variant="caption" color="info.main">
                                      Started {new Date(rack.assigned_at).toLocaleDateString()}
                                    </Typography>
                                  )}
                                </TableCell>
                                <TableCell align="right">
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    startIcon={<FileDownload />}
                                    onClick={() => exportRackCSV(rack.rack_id)}
                                    disabled={exporting || rack.scan_count === 0}
                                  >
                                    CSV
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Tab Panel 3: Damages */}
        {activeTab === 2 && (
          <>
            {/* Session Selection */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <BrokenImage />
                  Damage Reports
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Select an audit session to view and export damage reports with all status types.
                </Typography>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                  <FormControl sx={{ minWidth: 300 }}>
                    <InputLabel>Select Audit Session</InputLabel>
                    <Select
                      value={selectedDamageSessionId}
                      onChange={(e) => setSelectedDamageSessionId(e.target.value)}
                      label="Select Audit Session"
                    >
                      {sessionsForReports.map((session) => (
                        <MenuItem key={session.session_id} value={session.session_id}>
                          <Box>
                            <Typography variant="body2" fontWeight="bold">
                              {session.shortname} - {session.location_name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {session.status === 'active' ? '🔴 Active' : '✅ Completed'} • 
                              {session.total_racks} racks • {session.total_scans} scans
                            </Typography>
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  {selectedDamageSessionId && (
                    <Button
                      variant="contained"
                      startIcon={<FileDownload />}
                      onClick={() => exportDamageCSV(selectedDamageSessionId)}
                      disabled={exporting || damageReports.length === 0}
                    >
                      Export CSV
                    </Button>
                  )}
                </Box>
              </CardContent>
            </Card>

            {/* Damage Reports Table */}
            {selectedDamageSessionId && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Damage Reports ({damageReports.length})
                  </Typography>
                  
                  {damageReports.length > 0 && (
                    <Box sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      <Chip 
                        label={`Pending: ${damageReports.filter(r => r.status === 'pending').length}`}
                        color="warning"
                        size="small"
                      />
                      <Chip 
                        label={`Approved: ${damageReports.filter(r => r.status === 'approved').length}`}
                        color="success"
                        size="small"
                      />
                      <Chip 
                        label={`Rejected: ${damageReports.filter(r => r.status === 'rejected').length}`}
                        color="error"
                        size="small"
                      />
                      <Chip 
                        label={`Removed: ${damageReports.filter(r => r.removed_from_stock).length}`}
                        color="secondary"
                        size="small"
                      />
                    </Box>
                  )}

                  {loadingDamageReports ? (
                    <Box display="flex" justifyContent="center" p={4}>
                      <CircularProgress />
                    </Box>
                  ) : (
                    <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>Barcode</TableCell>
                            <TableCell>Severity</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Reported By</TableCell>
                            <TableCell>Date</TableCell>
                            <TableCell align="right">Photos</TableCell>
                            <TableCell>Description</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {damageReports.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={7} align="center">
                                <Typography color="text.secondary" sx={{ py: 4 }}>
                                  No damage reports found for this session
                                </Typography>
                              </TableCell>
                            </TableRow>
                          ) : (
                            damageReports.map((report) => (
                              <TableRow key={report.id} hover>
                                <TableCell>
                                  <Typography variant="body2" fontWeight="bold" fontFamily="monospace">
                                    {report.barcode}
                                  </Typography>
                                  {report.removed_from_stock && (
                                    <Chip label="Removed" color="secondary" size="small" />
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Chip
                                    label={report.damage_severity}
                                    color={getDamageSeverityColor(report.damage_severity)}
                                    size="small"
                                    sx={{ textTransform: 'capitalize' }}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Chip
                                    label={report.status.replace('_', ' ')}
                                    color={getDamageStatusColor(report.status)}
                                    size="small"
                                    sx={{ textTransform: 'capitalize' }}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Person sx={{ fontSize: 16 }} />
                                    <Typography variant="body2">
                                      {report.reported_by_name}
                                    </Typography>
                                  </Box>
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2">
                                    {new Date(report.reported_at).toLocaleDateString()}
                                  </Typography>
                                  {report.approved_at && (
                                    <Typography variant="caption" color="text.secondary" display="block">
                                      Processed: {new Date(report.approved_at).toLocaleDateString()}
                                    </Typography>
                                  )}
                                </TableCell>
                                <TableCell align="right">
                                  <Typography variant="body2" fontWeight="bold">
                                    {report.image_count}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  {report.damage_description ? (
                                    <Typography variant="body2" sx={{ maxWidth: 200 }}>
                                      {report.damage_description.length > 50 
                                        ? `${report.damage_description.substring(0, 50)}...`
                                        : report.damage_description
                                      }
                                    </Typography>
                                  ) : (
                                    <Typography variant="body2" color="text.secondary" fontStyle="italic">
                                      No description
                                    </Typography>
                                  )}
                                  {report.rejection_reason && (
                                    <Alert severity="error" sx={{ mt: 1, maxWidth: 250 }}>
                                      <Typography variant="caption">
                                        <strong>Rejected:</strong> {report.rejection_reason}
                                      </Typography>
                                    </Alert>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Tab Panel 4: Add-Ons */}
        {activeTab === 3 && (
          <>
            {/* Session Selection */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Add />
                  Add-On Reports
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Select an audit session to view and export add-on requests with status filtering.
                </Typography>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                  <FormControl sx={{ minWidth: 300 }}>
                    <InputLabel>Select Audit Session</InputLabel>
                    <Select
                      value={selectedAddOnSessionId}
                      onChange={(e) => setSelectedAddOnSessionId(e.target.value)}
                      label="Select Audit Session"
                    >
                      {sessionsForReports.map((session) => (
                        <MenuItem key={session.session_id} value={session.session_id}>
                          <Box>
                            <Typography variant="body2" fontWeight="bold">
                              {session.shortname} - {session.location_name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {session.status === 'active' ? '🔴 Active' : '✅ Completed'} • 
                              {session.total_racks} racks • {session.total_scans} scans
                            </Typography>
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl sx={{ minWidth: 120 }}>
                    <InputLabel>Status Filter</InputLabel>
                    <Select
                      value={addOnStatusFilter}
                      onChange={(e) => setAddOnStatusFilter(e.target.value)}
                      label="Status Filter"
                    >
                      <MenuItem value="all">All</MenuItem>
                      <MenuItem value="pending">Pending</MenuItem>
                      <MenuItem value="approved">Approved</MenuItem>
                      <MenuItem value="rejected">Rejected</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
              </CardContent>
            </Card>

            {/* Add-On Reports Table */}
            {selectedAddOnSessionId && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Add-On Requests ({addOnReports.filter(addOn => 
                      addOnStatusFilter === 'all' || addOn.status === addOnStatusFilter
                    ).length} of {addOnReports.length})
                  </Typography>
                  
                  {/* Export Button */}
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                    <Button
                      variant="contained"
                      startIcon={<FileDownload />}
                      onClick={() => exportAddOnCSV()}
                      disabled={loadingAddOnReports || addOnReports.length === 0}
                    >
                      Export CSV
                    </Button>
                  </Box>

                  {loadingAddOnReports ? (
                    <Box display="flex" justifyContent="center" p={4}>
                      <CircularProgress />
                    </Box>
                  ) : (
                    <TableContainer component={Paper} variant="outlined">
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>Brand</TableCell>
                            <TableCell>Item Name</TableCell>
                            <TableCell>Quantity</TableCell>
                            <TableCell>Pricing</TableCell>
                            <TableCell>Reporter</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Reported At</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {addOnReports.filter(addOn => 
                            addOnStatusFilter === 'all' || addOn.status === addOnStatusFilter
                          ).length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={7} align="center">
                                <Typography color="text.secondary" sx={{ py: 4 }}>
                                  No add-on requests found
                                </Typography>
                              </TableCell>
                            </TableRow>
                          ) : (
                            addOnReports
                              .filter(addOn => addOnStatusFilter === 'all' || addOn.status === addOnStatusFilter)
                              .map((addOn) => (
                                <TableRow key={addOn.id} hover>
                                  <TableCell>
                                    <Typography variant="body2" fontWeight="medium">
                                      {addOn.brand}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="body2">
                                      {addOn.item_name}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" display="block">
                                      {addOn.reason}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>
                                    <Chip label={addOn.quantity} size="small" />
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="body2">
                                      CP: {addOn.cost_price ? `₹${addOn.cost_price.toFixed(2)}` : 'N/A'}
                                    </Typography>
                                    <Typography variant="body2">
                                      SP: {addOn.selling_price ? `₹${addOn.selling_price.toFixed(2)}` : 'N/A'}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="body2">
                                      {addOn.reported_by?.full_name || addOn.reported_by?.username}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>
                                    <Chip
                                      label={addOn.status.toUpperCase()}
                                      size="small"
                                      color={
                                        addOn.status === 'pending' ? 'warning' :
                                        addOn.status === 'approved' ? 'success' : 'error'
                                      }
                                    />
                                    {addOn.status === 'rejected' && addOn.rejection_reason && (
                                      <Typography variant="caption" display="block" color="error">
                                        {addOn.rejection_reason}
                                      </Typography>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="body2">
                                      {new Date(addOn.reported_at).toLocaleDateString()}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {new Date(addOn.reported_at).toLocaleTimeString()}
                                    </Typography>
                                  </TableCell>
                                </TableRow>
                              ))
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Tab Panel 5: Partial Damages */}
        {activeTab === 4 && (
          <>
            {/* Session Selection */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Warning />
                  Partial Damage Reports
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Select an audit session to view partial damage flags with severity filtering.
                </Typography>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                  <FormControl sx={{ minWidth: 300 }}>
                    <InputLabel>Select Audit Session</InputLabel>
                    <Select
                      value={selectedPartialDamageSessionId}
                      onChange={(e) => setSelectedPartialDamageSessionId(e.target.value)}
                      label="Select Audit Session"
                    >
                      {sessionsForReports.map((session) => (
                        <MenuItem key={session.session_id} value={session.session_id}>
                          <Box>
                            <Typography variant="body2" fontWeight="bold">
                              {session.shortname} - {session.location_name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {session.status === 'active' ? '🔴 Active' : '✅ Completed'} • 
                              {session.total_racks} racks • {session.total_scans} scans
                            </Typography>
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl sx={{ minWidth: 120 }}>
                    <InputLabel>Severity Filter</InputLabel>
                    <Select
                      value={partialDamageSeverityFilter}
                      onChange={(e) => setPartialDamageSeverityFilter(e.target.value)}
                      label="Severity Filter"
                    >
                      <MenuItem value="all">All</MenuItem>
                      <MenuItem value="severe">Severe</MenuItem>
                      <MenuItem value="moderate">Moderate</MenuItem>
                      <MenuItem value="minor">Minor</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
              </CardContent>
            </Card>

            {/* Partial Damage Reports Table */}
            {selectedPartialDamageSessionId && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Partial Damage Flags ({partialDamageReports.filter(report => 
                      partialDamageSeverityFilter === 'all' || report.severity === partialDamageSeverityFilter
                    ).length} of {partialDamageReports.length})
                  </Typography>
                  
                  {/* Export Button */}
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                    <Button
                      variant="contained"
                      startIcon={<FileDownload />}
                      onClick={() => exportPartialDamageCSV()}
                      disabled={loadingPartialDamageReports || partialDamageReports.length === 0}
                    >
                      Export CSV
                    </Button>
                  </Box>

                  {loadingPartialDamageReports ? (
                    <Box display="flex" justifyContent="center" p={4}>
                      <CircularProgress />
                    </Box>
                  ) : (
                    <TableContainer component={Paper} variant="outlined">
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>Barcode</TableCell>
                            <TableCell>Damage Type</TableCell>
                            <TableCell>Severity</TableCell>
                            <TableCell>Units</TableCell>
                            <TableCell>Remarks</TableCell>
                            <TableCell>Photos</TableCell>
                            <TableCell>Reporter</TableCell>
                            <TableCell>Date</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {partialDamageReports.filter(report => 
                            partialDamageSeverityFilter === 'all' || report.severity === partialDamageSeverityFilter
                          ).length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={8} align="center">
                                <Typography color="text.secondary" sx={{ py: 4 }}>
                                  No partial damage flags found
                                </Typography>
                              </TableCell>
                            </TableRow>
                          ) : (
                            partialDamageReports
                              .filter(report => partialDamageSeverityFilter === 'all' || report.severity === partialDamageSeverityFilter)
                              .map((report) => (
                                <TableRow key={report.id} hover>
                                  <TableCell>
                                    <Typography variant="body2" fontFamily="monospace">
                                      {report.barcode}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>
                                    <Chip 
                                      label={report.damage_type.replace('_', ' ')} 
                                      size="small" 
                                      variant="outlined"
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Chip
                                      label={report.severity.toUpperCase()}
                                      size="small"
                                      color={
                                        report.severity === 'severe' ? 'error' :
                                        report.severity === 'moderate' ? 'warning' : 'info'
                                      }
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="body2">
                                      {report.unit_ratio || 'N/A'}
                                    </Typography>
                                  </TableCell>
                                  <TableCell sx={{ maxWidth: 200 }}>
                                    <Typography 
                                      variant="body2" 
                                      sx={{ 
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                      }}
                                      title={report.remarks} // Show full text on hover
                                    >
                                      {report.remarks && report.remarks.length > 50 
                                        ? `${report.remarks.substring(0, 50)}...` 
                                        : report.remarks || 'No remarks'
                                      }
                                    </Typography>
                                  </TableCell>
                                  <TableCell>
                                    {report.photo_count > 0 ? (
                                      <Button
                                        size="small"
                                        variant="outlined"
                                        startIcon={<Visibility />}
                                        onClick={() => handleViewPhotos(report)}
                                      >
                                        {report.photo_count} {report.photo_count === 1 ? 'photo' : 'photos'}
                                      </Button>
                                    ) : (
                                      <Typography variant="body2" color="text.secondary">
                                        No photos
                                      </Typography>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="body2">
                                      {report.created_by_name}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="body2">
                                      {new Date(report.created_at).toLocaleDateString()}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {new Date(report.created_at).toLocaleTimeString()}
                                    </Typography>
                                  </TableCell>
                                </TableRow>
                              ))
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Tab Panel 5: Brand Variance - Only for Supervisor and Super User */}
        {(userProfile?.role === 'supervisor' || userProfile?.role === 'superuser') && activeTab === 5 && (
          <BrandVarianceReport userRole={userProfile?.role || ''} />
        )}

        {/* Tab Panel 6: Overall Variance - Only for Supervisor and Super User */}
        {(userProfile?.role === 'supervisor' || userProfile?.role === 'superuser') && activeTab === 6 && (
          <OverallVarianceReport userRole={userProfile?.role || ''} />
        )}

        {/* Photo Viewing Modal */}
        <Dialog 
          open={photoModalOpen} 
          onClose={handleClosePhotoModal}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="h6">
                  Partial Damage Photos
                </Typography>
                {selectedPartialDamagePhotos && (
                  <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Chip 
                      icon={<PhotoCamera />}
                      label={selectedPartialDamagePhotos.barcode} 
                      size="small" 
                      variant="outlined"
                    />
                    <Chip 
                      label={selectedPartialDamagePhotos.damageType.replace('_', ' ')} 
                      size="small" 
                      variant="outlined"
                    />
                    <Chip
                      label={selectedPartialDamagePhotos.severity.toUpperCase()}
                      size="small"
                      color={
                        selectedPartialDamagePhotos.severity === 'severe' ? 'error' :
                        selectedPartialDamagePhotos.severity === 'moderate' ? 'warning' : 'info'
                      }
                    />
                  </Box>
                )}
              </Box>
              <IconButton onClick={handleClosePhotoModal}>
                <Close />
              </IconButton>
            </Box>
          </DialogTitle>
          <DialogContent>
            {selectedPartialDamagePhotos?.photoUrls && selectedPartialDamagePhotos.photoUrls.length > 0 ? (
              <ImageList cols={2} rowHeight={200} gap={8}>
                {selectedPartialDamagePhotos.photoUrls.map((url, index) => (
                  <ImageListItem key={index}>
                    <img
                      src={url}
                      alt={`Partial damage photo ${index + 1}`}
                      loading="lazy"
                      style={{ 
                        cursor: 'pointer',
                        objectFit: 'cover',
                        borderRadius: '8px',
                        transition: 'transform 0.2s',
                      }}
                      onClick={() => window.open(url, '_blank')}
                      onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                      onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    />
                  </ImageListItem>
                ))}
              </ImageList>
            ) : (
              <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                No photos available
              </Typography>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClosePhotoModal}>
              Close
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </DashboardLayout>
  )
}