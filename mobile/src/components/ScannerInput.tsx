import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  TextInput as RNTextInput, 
  Vibration, 
  Platform,
  Keyboard,
} from 'react-native';
import { TextInput, Text, Button, Card } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';

import { showSuccessMessage, showWarningMessage, updateLastActivity } from '../store/slices/appSlice';
import { addScanToState } from '../store/slices/scanSlice';
import { RootState, AppDispatch } from '../store';
import { useScanQueue } from './ScanQueueProvider';
import { isValidBarcode } from '../../../shared/utils/helpers';

interface ScannerInputProps {
  rackId: string;
  auditSessionId: string;
  onScanAdded?: (barcode: string) => void;
}

const ScannerInput: React.FC<ScannerInputProps> = ({ 
  rackId, 
  auditSessionId, 
  onScanAdded 
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const { isLoading } = useSelector((state: RootState) => state.scans);
  const { scanner_connected } = useSelector((state: RootState) => state.app.appStatus);
  const { vibration_enabled, sound_enabled } = useSelector((state: RootState) => state.app.userPreferences);
  const { addScan: addScanToQueue } = useScanQueue();
  
  const [inputValue, setInputValue] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [lastInputTime, setLastInputTime] = useState(Date.now());
  const [isProcessing, setIsProcessing] = useState(false);
  
  const inputRef = useRef<RNTextInput>(null);
  const scanTimeoutRef = useRef<NodeJS.Timeout>();
  const processingTimeoutRef = useRef<NodeJS.Timeout>();
  
  // Barcode debouncing for USB scanner double-trigger prevention
  const recentBarcodesRef = useRef<Map<string, number>>(new Map());
  const DEBOUNCE_WINDOW_MS = 1500; // Prevent same barcode within 1.5 seconds

  useEffect(() => {
    // Auto-focus on mount and when returning to screen
    const focusInput = () => {
      if (inputRef.current && !manualMode) {
        inputRef.current.focus();
      }
    };

    focusInput();

    // Focus when keyboard dismisses (for USB scanner input)
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', focusInput);

    return () => {
      keyboardDidHideListener.remove();
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }
      // Clean up debounce map on unmount
      recentBarcodesRef.current.clear();
    };
  }, [manualMode]);


  const handleInputChange = (text: string) => {
    const currentTime = Date.now();
    const timeDiff = currentTime - lastInputTime;
    
    setInputValue(text);
    setLastInputTime(currentTime);
    
    // Detect rapid input (likely from USB scanner)
    if (timeDiff < 50 && text.length > inputValue.length) {
      // This is likely scanner input
      setManualMode(false);
    }
    
    // Clear any existing timeout
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }
    
    // Only auto-process in auto mode (USB scanner)
    // In manual mode, wait for explicit submission
    if (!manualMode) {
      // Set timeout to process scan after brief pause
      scanTimeoutRef.current = setTimeout(() => {
        processPotentialScan(text);
      }, 50);
    }
  };

  const handleSubmitEditing = () => {
    processPotentialScan(inputValue);
  };

  const processPotentialScan = (text: string) => {
    // Clean the input (remove tab, newline, extra spaces)
    const cleanedText = text.replace(/[\t\n\r]/g, '').trim();
    
    if (cleanedText.length === 0) {
      return;
    }
    
    // Check if this looks like a barcode scan
    const isScannedInput = text.includes('\t') || text.includes('\n') || 
                          (cleanedText.length >= 8 && !manualMode);
    
    if (isScannedInput || manualMode) {
      processScan(cleanedText, manualMode);
    }
  };

  const processScan = async (barcode: string, manual: boolean = false) => {
    const currentTime = Date.now();
    
    // Prevent multiple rapid calls from same scan event
    if (isProcessing) {
      console.log('🚫 ScannerInput: Already processing, ignoring duplicate');
      return;
    }
    
    // Barcode debouncing - prevent same barcode within debounce window
    const lastScanTime = recentBarcodesRef.current.get(barcode);
    if (lastScanTime && (currentTime - lastScanTime) < DEBOUNCE_WINDOW_MS) {
      const timeSinceLastScan = currentTime - lastScanTime;
      console.log(`🚫 ScannerInput: Duplicate barcode "${barcode}" ignored (${timeSinceLastScan}ms since last scan)`);
      clearInput();
      return;
    }
    
    if (!isValidBarcode(barcode)) {
      dispatch(showWarningMessage('Invalid barcode format'));
      clearInput();
      return;
    }

    // Record this barcode scan time for debouncing
    recentBarcodesRef.current.set(barcode, currentTime);
    
    // Clean up old entries to prevent memory leaks (keep only last 50 scans)
    if (recentBarcodesRef.current.size > 50) {
      const entries = Array.from(recentBarcodesRef.current.entries());
      entries.sort((a, b) => b[1] - a[1]); // Sort by timestamp, newest first
      recentBarcodesRef.current.clear();
      entries.slice(0, 25).forEach(([code, time]) => {
        recentBarcodesRef.current.set(code, time);
      });
    }

    // Set processing flag to prevent duplicates (extended timeout)
    setIsProcessing(true);
    
    // Clear processing flag after 1.5 seconds (increased from 1s)
    processingTimeoutRef.current = setTimeout(() => {
      setIsProcessing(false);
    }, 1500);

    dispatch(updateLastActivity());

    try {
      console.log('🔍 ScannerInput: Processing scan:', {
        barcode,
        manual,
        timestamp: currentTime,
        previousScan: lastScanTime,
        timeSinceLastScan: lastScanTime ? currentTime - lastScanTime : 'N/A'
      });
      
      // Add to scan queue (fast, async)
      const scanId = await addScanToQueue({
        barcode,
        rack_id: rackId,
        audit_session_id: auditSessionId,
        quantity: 1,
        manual_entry: manual,
        notes: '',
      });

      console.log('✅ ScannerInput: Scan added to queue:', scanId);

      // Optimistic UI: Add scan to Redux state immediately for UI updates
      const optimisticScan = {
        id: scanId,
        barcode,
        rack_id: rackId,
        audit_session_id: auditSessionId,
        quantity: 1,
        manual_entry: manual,
        notes: '',
        created_at: new Date().toISOString(),
        scanner_id: '', // Will be filled by queue system
        device_id: '',  // Will be filled by queue system
      };
      
      dispatch(addScanToState(optimisticScan));

      // Show success indicator in input field (immediate feedback)
      setInputValue(`✅ ${barcode}`);

      // Provide feedback
      if (vibration_enabled && Platform.OS === 'android') {
        Vibration.vibrate(100);
      }

      dispatch(showSuccessMessage(`Scan added: ${barcode}`));

      // Callback
      if (onScanAdded) {
        onScanAdded(barcode);
      }

      // Clear input after showing success for 1.5 seconds
      setTimeout(() => {
        clearInput();
      }, 1500);

    } catch (error: any) {
      console.error('💥 ScannerInput: Scan failed:', error);
      
      // Show error indicator in input field
      setInputValue(`❌ ${barcode}`);
      
      // Handle specific error types
      let errorMessage = 'Scan failed';
      if (error.message.includes('QUEUE_FULL')) {
        errorMessage = 'Queue full - connect to internet';
      } else if (error.message.includes('not authenticated')) {
        errorMessage = 'Authentication required';  
      } else {
        errorMessage = `Error: ${error.message}`;
      }
      
      dispatch(showWarningMessage(errorMessage));
      
      // Clear input after showing error for 2 seconds
      setTimeout(() => {
        clearInput();
      }, 2000);
    }
  };

  const clearInput = () => {
    setInputValue('');
    if (inputRef.current && !manualMode) {
      inputRef.current.focus();
    }
  };

  const toggleManualMode = () => {
    setManualMode(!manualMode);
    setInputValue('');
    
    // Focus after mode change
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 100);
  };

  return (
    <Card style={styles.container}>
      <Card.Content>
        <View style={styles.header}>
          <Text style={styles.title}>Scanner Input</Text>
          <Button
            mode={manualMode ? 'contained' : 'outlined'}
            compact
            onPress={toggleManualMode}
            style={styles.modeButton}
          >
            {manualMode ? 'Manual' : 'Auto'}
          </Button>
        </View>

        <View style={styles.statusContainer}>
          <View style={[
            styles.statusIndicator, 
            { backgroundColor: scanner_connected ? '#4caf50' : '#f44336' }
          ]} />
          <Text style={styles.statusText}>
            {scanner_connected ? 'Scanner Connected' : 'Scanner Disconnected'}
          </Text>
        </View>

        <TextInput
          ref={inputRef}
          label={manualMode ? "Enter barcode manually" : "Barcode will appear here"}
          value={inputValue}
          onChangeText={handleInputChange}
          onSubmitEditing={handleSubmitEditing}
          mode="outlined"
          style={styles.input}
          autoFocus={!manualMode}
          showSoftInputOnFocus={manualMode}
          selectTextOnFocus={manualMode}
          blurOnSubmit={false}
          returnKeyType="done"
          autoCapitalize="none"
          autoCorrect={false}
          disabled={isLoading}
        />

        {manualMode && (
          <Button
            mode="contained"
            onPress={() => processScan(inputValue, true)}
            disabled={!isValidBarcode(inputValue) || isLoading}
            loading={isLoading}
            style={styles.submitButton}
          >
            Add Scan
          </Button>
        )}


        <Text style={styles.helpText}>
          {manualMode 
            ? "Type barcode manually and tap 'Add Scan' or press Enter"
            : "Connect USB scanner and scan barcodes automatically"
          }
        </Text>
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    margin: 16,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modeButton: {
    minWidth: 80,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#666666',
  },
  input: {
    marginBottom: 12,
    fontSize: 16,
  },
  submitButton: {
    marginTop: 8,
    marginBottom: 12,
  },
  helpText: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default ScannerInput;