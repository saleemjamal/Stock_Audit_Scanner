import { ScanSink, ScanData, FlushResult } from './types';
import { supabase } from '../supabase';
// Removed UUID import - using timestamp-based IDs instead

export class DirectApiSink implements ScanSink {
  private readonly CHUNK_SIZE = 50;
  private readonly MAX_RETRIES = 3;
  private readonly MAX_BACKOFF_MS = 10000;

  readonly supportsPersistence = false;

  async flush(scans: ScanData[]): Promise<FlushResult> {
    console.log(`🔄 DirectApiSink: Flushing ${scans.length} scans...`);
    
    // Add client_scan_id to each scan if not present
    const scansWithIds = scans.map(scan => ({
      ...scan,
      client_scan_id: scan.client_scan_id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      // Note: removed created_at and updated_at - database handles these automatically
    }));

    // Split into chunks for better reliability
    const chunks = this.chunkArray(scansWithIds, this.CHUNK_SIZE);
    let totalSent = 0;
    let totalFailed = 0;

    for (const chunk of chunks) {
      const result = await this.sendChunkWithRetry(chunk);
      totalSent += result.sent;
      totalFailed += result.failed;
    }

    console.log(`✅ DirectApiSink: Sent ${totalSent}, Failed ${totalFailed}`);
    return { sent: totalSent, failed: totalFailed };
  }

  getPendingCount(): number {
    return 0; // DirectApiSink doesn't queue, sends immediately
  }

  private async sendChunkWithRetry(
    chunk: ScanData[], 
    attempt = 0
  ): Promise<FlushResult> {
    try {
      console.log(`📤 DirectApiSink: Sending chunk of ${chunk.length} scans (attempt ${attempt + 1})`);
      
      // Convert to format expected by Supabase
      const supabaseScans = chunk.map(scan => ({
        client_scan_id: scan.client_scan_id,
        barcode: scan.barcode,
        rack_id: scan.rack_id,
        audit_session_id: scan.audit_session_id,
        scanner_id: scan.scanner_id,
        device_id: scan.device_id || '',
        quantity: scan.quantity || 1,
        manual_entry: scan.manual_entry || false,
        notes: scan.notes || ''
        // Note: removed created_at and updated_at - database handles these with DEFAULT NOW()
      }));

      console.log('📤 DirectApiSink: Preparing to send to Supabase:', {
        table: 'scans',
        recordCount: supabaseScans.length,
        firstRecord: JSON.stringify(supabaseScans[0], null, 2),
        supabaseUrl: supabase.rest ? supabase.rest.url : 'URL not available'
      });

      // Check authentication
      const { data: { session } } = await supabase.auth.getSession();
      console.log('🔐 DirectApiSink: Auth check:', {
        hasSession: !!session,
        hasToken: !!session?.access_token,
        userId: session?.user?.id
      });

      const startTime = Date.now();
      let data: any = null;
      let error: any = null;
      
      try {
        console.log('📤 DirectApiSink: Calling Supabase upsert...');
        const result = await supabase
          .from('scans')
          .upsert(supabaseScans, { 
            onConflict: 'client_scan_id',
            ignoreDuplicates: true 
          });
        
        data = result.data;
        error = result.error;
        
        if (error) {
          console.error('❌ DirectApiSink: Supabase returned error:', {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
            fullError: JSON.stringify(error, null, 2)
          });
        }
      } catch (catchError: any) {
        console.error('💥 DirectApiSink: Exception during Supabase call:', {
          name: catchError.name,
          message: catchError.message,
          stack: catchError.stack,
          fullError: JSON.stringify(catchError, null, 2)
        });
        error = catchError;
      }

      const elapsed = Date.now() - startTime;

      console.log(`📤 DirectApiSink: Supabase call completed in ${elapsed}ms:`, {
        hasData: !!data,
        dataLength: data ? data.length : 0,
        hasError: !!error
      });

      // Handle rate limiting and server errors with retry
      if (error) {
        if (this.shouldRetry(error, attempt)) {
          const delay = this.calculateBackoffDelay(attempt);
          console.warn(`⚠️ DirectApiSink: Retrying chunk in ${delay}ms. Error:`, error.message);
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.sendChunkWithRetry(chunk, attempt + 1);
        }
        
        console.error('💥 DirectApiSink: Chunk failed permanently:', error);
        return { sent: 0, failed: chunk.length };
      }

      console.log(`✅ DirectApiSink: Chunk sent successfully`);
      return { sent: chunk.length, failed: 0 };

    } catch (error: any) {
      console.error('💥 DirectApiSink: Unexpected error:', error);
      
      if (this.shouldRetry(error, attempt)) {
        const delay = this.calculateBackoffDelay(attempt);
        console.warn(`⚠️ DirectApiSink: Retrying chunk in ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.sendChunkWithRetry(chunk, attempt + 1);
      }
      
      return { sent: 0, failed: chunk.length };
    }
  }

  private shouldRetry(error: any, attempt: number): boolean {
    if (attempt >= this.MAX_RETRIES) return false;
    
    // Retry on rate limiting, network errors, and 5xx server errors
    if (error?.code === '429') return true;
    if (error?.code === 'PGRST301') return true; // Network error
    if (error?.message?.includes('fetch')) return true; // Network fetch error
    if (error?.status >= 500 && error?.status < 600) return true; // 5xx errors
    
    return false;
  }

  private calculateBackoffDelay(attempt: number): number {
    // Exponential backoff with jitter: base_delay * 2^attempt + random jitter
    const baseDelay = 1000; // 1 second
    const exponentialDelay = baseDelay * Math.pow(2, attempt);
    const jitter = Math.random() * 1000; // 0-1 second jitter
    
    return Math.min(exponentialDelay + jitter, this.MAX_BACKOFF_MS);
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}