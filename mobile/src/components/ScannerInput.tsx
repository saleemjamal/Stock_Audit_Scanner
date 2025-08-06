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

import { addScan, clearDuplicateWarning } from '../store/slices/scanSlice';
import { showSuccessMessage, showWarningMessage, updateLastActivity } from '../store/slices/appSlice';
import { RootState, AppDispatch } from '../store';
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
  const { duplicateWarning, isLoading } = useSelector((state: RootState) => state.scans);
  const { scanner_connected } = useSelector((state: RootState) => state.app.appStatus);
  const { vibration_enabled, sound_enabled } = useSelector((state: RootState) => state.app.userPreferences);
  
  const [inputValue, setInputValue] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [lastInputTime, setLastInputTime] = useState(Date.now());
  
  const inputRef = useRef<RNTextInput>(null);
  const scanTimeoutRef = useRef<NodeJS.Timeout>();

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
    };
  }, [manualMode]);

  useEffect(() => {
    // Clear duplicate warning after 3 seconds
    if (duplicateWarning) {
      const timer = setTimeout(() => {
        dispatch(clearDuplicateWarning());
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [duplicateWarning, dispatch]);

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
    
    // Set timeout to process scan after brief pause
    scanTimeoutRef.current = setTimeout(() => {
      processPotentialScan(text);
    }, 50);
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
    if (!isValidBarcode(barcode)) {
      dispatch(showWarningMessage('Invalid barcode format'));
      clearInput();
      return;
    }

    dispatch(updateLastActivity());

    try {
      const result = await dispatch(addScan({
        barcode,
        rackId,
        auditSessionId,
        deviceId: 'device_' + Date.now(), // This should come from device info
        manualEntry: manual,
      })).unwrap();

      // Provide feedback
      if (vibration_enabled && Platform.OS === 'android') {
        Vibration.vibrate(100);
      }

      if (result.isDuplicate) {
        dispatch(showWarningMessage(`Duplicate scan: ${barcode}`));
      } else {
        dispatch(showSuccessMessage(`Scanned: ${barcode}`));
      }

      // Callback
      if (onScanAdded) {
        onScanAdded(barcode);
      }

    } catch (error: any) {
      dispatch(showWarningMessage(`Scan failed: ${error.message}`));
    } finally {
      clearInput();
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

        {duplicateWarning && (
          <Text style={styles.warningText}>{duplicateWarning}</Text>
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
  warningText: {
    color: '#f57c00',
    fontSize: 14,
    marginBottom: 8,
    textAlign: 'center',
  },
  helpText: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default ScannerInput;