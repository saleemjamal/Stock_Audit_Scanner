import { Scan, Rack, User, Location, AuditSession } from '../types/database';
import { arrayToCSV } from './helpers';

export interface RawSKUReportData {
  barcode: string;
  scan_count: number;
}

export interface DetailedAuditReportData {
  barcode: string;
  rack_number: string;
  shelf_number: string;
  scanner_name: string;
  scan_timestamp: string;
  is_recount: boolean;
  manual_entry: boolean;
  notes: string;
}

export interface SummaryReportData {
  location_name: string;
  audit_session_id: string;
  started_at: string;
  completed_at: string;
  total_unique_skus: number;
  total_scan_count: number;
  total_racks: number;
  approved_racks: number;
  rejected_racks: number;
  scanners_count: number;
  audit_duration_minutes: number;
}

export class ReportsGenerator {
  
  static generateRawSKUReport(scans: Scan[]): string {
    // Group scans by barcode and count
    const barcodeCount = scans.reduce((acc, scan) => {
      acc[scan.barcode] = (acc[scan.barcode] || 0) + scan.quantity;
      return acc;
    }, {} as Record<string, number>);

    const reportData: RawSKUReportData[] = Object.entries(barcodeCount)
      .map(([barcode, count]) => ({
        barcode,
        scan_count: count,
      }))
      .sort((a, b) => a.barcode.localeCompare(b.barcode));

    const headers = ['Barcode', 'Scan Count'];
    return arrayToCSV(reportData, headers);
  }

  static generateDetailedAuditReport(
    scans: Scan[],
    racks: Rack[],
    users: User[]
  ): string {
    const rackMap = new Map(racks.map(rack => [rack.id, rack]));
    const userMap = new Map(users.map(user => [user.id, user]));

    const reportData: DetailedAuditReportData[] = scans.map(scan => {
      const rack = rackMap.get(scan.rack_id);
      const scanner = userMap.get(scan.scanner_id);

      return {
        barcode: scan.barcode,
        rack_number: rack?.rack_number || 'Unknown',
        shelf_number: rack?.shelf_number || '',
        scanner_name: scanner?.full_name || scanner?.email || 'Unknown',
        scan_timestamp: scan.created_at,
        is_recount: scan.is_recount,
        manual_entry: scan.manual_entry,
        notes: scan.notes || '',
      };
    });

    const headers = [
      'Barcode',
      'Rack Number',
      'Shelf Number', 
      'Scanner Name',
      'Scan Timestamp',
      'Is Recount',
      'Manual Entry',
      'Notes'
    ];

    return arrayToCSV(reportData, headers);
  }

  static generateSummaryReport(
    auditSession: AuditSession,
    location: Location,
    racks: Rack[],
    scans: Scan[],
    users: User[]
  ): string {
    const uniqueSkus = new Set(scans.map(scan => scan.barcode)).size;
    const totalScans = scans.reduce((sum, scan) => sum + scan.quantity, 0);
    const approvedRacks = racks.filter(rack => rack.status === 'approved').length;
    const rejectedRacks = racks.filter(rack => rack.status === 'rejected').length;
    const uniqueScanners = new Set(scans.map(scan => scan.scanner_id)).size;

    let auditDurationMinutes = 0;
    if (auditSession.started_at && auditSession.completed_at) {
      const start = new Date(auditSession.started_at);
      const end = new Date(auditSession.completed_at);
      auditDurationMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
    }

    const reportData: SummaryReportData[] = [{
      location_name: location.name,
      audit_session_id: auditSession.id,
      started_at: auditSession.started_at || '',
      completed_at: auditSession.completed_at || '',
      total_unique_skus: uniqueSkus,
      total_scan_count: totalScans,
      total_racks: racks.length,
      approved_racks: approvedRacks,
      rejected_racks: rejectedRacks,
      scanners_count: uniqueScanners,
      audit_duration_minutes: auditDurationMinutes,
    }];

    const headers = [
      'Location Name',
      'Audit Session ID',
      'Started At',
      'Completed At',
      'Total Unique SKUs',
      'Total Scan Count',
      'Total Racks',
      'Approved Racks',
      'Rejected Racks',
      'Scanners Count',
      'Audit Duration (Minutes)'
    ];

    return arrayToCSV(reportData, headers);
  }

  static generateInventoryDiscrepancyReport(
    expectedInventory: Array<{ barcode: string; expectedCount: number }>,
    scans: Scan[]
  ): string {
    const actualCounts = scans.reduce((acc, scan) => {
      acc[scan.barcode] = (acc[scan.barcode] || 0) + scan.quantity;
      return acc;
    }, {} as Record<string, number>);

    const discrepancies = expectedInventory.map(expected => {
      const actualCount = actualCounts[expected.barcode] || 0;
      const variance = actualCount - expected.expectedCount;
      const variancePercent = expected.expectedCount > 0 
        ? ((variance / expected.expectedCount) * 100).toFixed(2)
        : 'N/A';

      return {
        barcode: expected.barcode,
        expected_count: expected.expectedCount,
        actual_count: actualCount,
        variance: variance,
        variance_percent: variancePercent,
        status: variance === 0 ? 'Match' : variance > 0 ? 'Overage' : 'Shortage',
      };
    });

    // Also check for items scanned but not in expected inventory
    const expectedBarcodes = new Set(expectedInventory.map(item => item.barcode));
    const unexpectedItems = Object.entries(actualCounts)
      .filter(([barcode]) => !expectedBarcodes.has(barcode))
      .map(([barcode, count]) => ({
        barcode,
        expected_count: 0,
        actual_count: count,
        variance: count,
        variance_percent: 'N/A',
        status: 'Unexpected Item',
      }));

    const allDiscrepancies = [...discrepancies, ...unexpectedItems]
      .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));

    const headers = [
      'Barcode',
      'Expected Count',
      'Actual Count',
      'Variance',
      'Variance %',
      'Status'
    ];

    return arrayToCSV(allDiscrepancies, headers);
  }

  static generateLocationComparisonReport(
    locations: Location[],
    auditSessions: AuditSession[],
    allScans: Scan[]
  ): string {
    const reportData = locations.map(location => {
      const locationSessions = auditSessions.filter(session => session.location_id === location.id);
      const locationScans = allScans.filter(scan => 
        locationSessions.some(session => session.id === scan.audit_session_id)
      );

      const completedSessions = locationSessions.filter(session => session.status === 'completed');
      const totalItems = locationScans.reduce((sum, scan) => sum + scan.quantity, 0);
      const uniqueSkus = new Set(locationScans.map(scan => scan.barcode)).size;

      let avgSessionDuration = 0;
      if (completedSessions.length > 0) {
        const totalDuration = completedSessions.reduce((sum, session) => {
          if (session.started_at && session.completed_at) {
            const start = new Date(session.started_at);
            const end = new Date(session.completed_at);
            return sum + (end.getTime() - start.getTime());
          }
          return sum;
        }, 0);
        avgSessionDuration = Math.round(totalDuration / (completedSessions.length * 1000 * 60));
      }

      return {
        location_name: location.name,
        city: location.city || '',
        state: location.state || '',
        total_audit_sessions: locationSessions.length,
        completed_sessions: completedSessions.length,
        total_items_scanned: totalItems,
        unique_skus: uniqueSkus,
        avg_session_duration_minutes: avgSessionDuration,
        last_audit_date: locationSessions.length > 0 
          ? Math.max(...locationSessions.map(s => new Date(s.created_at).getTime()))
          : null,
      };
    });

    const headers = [
      'Location Name',
      'City',
      'State',
      'Total Audit Sessions',
      'Completed Sessions',
      'Total Items Scanned',
      'Unique SKUs',
      'Avg Session Duration (Minutes)',
      'Last Audit Date'
    ];

    return arrayToCSV(reportData, headers);
  }

  static downloadCSV(csvContent: string, filename: string): void {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }
}