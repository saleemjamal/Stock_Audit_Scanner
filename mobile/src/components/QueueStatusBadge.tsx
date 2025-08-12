import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Badge, ProgressBar, IconButton } from 'react-native-paper';
import { useQueueStatus, useScanQueue } from './ScanQueueProvider';
import { config } from '../config/features';

interface QueueStatusBadgeProps {
  style?: any;
  showDetails?: boolean; // Show detailed info vs just the badge
}

export const QueueStatusBadge: React.FC<QueueStatusBadgeProps> = ({ 
  style, 
  showDetails = false 
}) => {
  const queueStatus = useQueueStatus();
  const { forceFlush } = useScanQueue();

  // Don't render if no pending scans
  if (queueStatus.pendingCount === 0 && !queueStatus.isFlushInProgress) {
    return null;
  }

  const handleForceFlush = async () => {
    try {
      await forceFlush();
    } catch (error: any) {
      console.error('Force flush failed:', error);
      // Could show a toast here
    }
  };

  const getStatusColor = () => {
    if (queueStatus.fillPercentage >= 80) return '#f44336'; // Red - warning
    if (queueStatus.fillPercentage >= 50) return '#ff9800'; // Orange - caution
    return '#4caf50'; // Green - good
  };

  const getStatusText = () => {
    if (queueStatus.isFlushInProgress) {
      return 'Syncing...';
    }
    
    if (!queueStatus.isOnline) {
      return `Offline: ${queueStatus.pendingCount}`;
    }
    
    return `Pending: ${queueStatus.pendingCount}`;
  };

  const renderSimpleBadge = () => (
    <View style={[styles.badgeContainer, style]}>
      <Badge 
        style={[styles.badge, { backgroundColor: getStatusColor() }]}
        visible={true}
      >
        {getStatusText()}
      </Badge>
      
      {queueStatus.isFlushInProgress && (
        <View style={styles.progressContainer}>
          <ProgressBar 
            indeterminate 
            style={styles.progressBar}
            color={getStatusColor()}
          />
        </View>
      )}
    </View>
  );

  const renderDetailedStatus = () => (
    <View style={[styles.detailedContainer, style]}>
      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>{getStatusText()}</Text>
        
        {config.ENABLE_FLUSH_BUTTON && queueStatus.pendingCount > 0 && (
          <TouchableOpacity 
            onPress={handleForceFlush}
            disabled={queueStatus.isFlushInProgress}
            style={styles.flushButton}
          >
            <Text style={styles.flushButtonText}>Sync Now</Text>
          </TouchableOpacity>
        )}
      </View>

      {queueStatus.pendingCount > 0 && (
        <View style={styles.progressSection}>
          <Text style={styles.fillText}>
            Queue: {queueStatus.fillPercentage.toFixed(0)}% full
          </Text>
          <ProgressBar 
            progress={queueStatus.fillPercentage / 100}
            style={styles.fillProgressBar}
            color={getStatusColor()}
          />
        </View>
      )}

      {queueStatus.isFlushInProgress && (
        <View style={styles.syncingSection}>
          <ProgressBar 
            indeterminate 
            style={styles.syncProgressBar}
            color="#2196f3"
          />
          <Text style={styles.syncingText}>Syncing to server...</Text>
        </View>
      )}

      {queueStatus.fillPercentage >= 80 && (
        <Text style={styles.warningText}>
          ⚠️ Queue filling up! {queueStatus.isOnline ? 'Syncing...' : 'Connect to internet'}
        </Text>
      )}

      {!queueStatus.isOnline && (
        <Text style={styles.offlineText}>
          📱 Offline mode - scans will sync when online
        </Text>
      )}

      {queueStatus.lastFlushResult && (
        <Text style={styles.lastFlushText}>
          Last sync: {queueStatus.lastFlushResult.sent} sent
          {queueStatus.lastFlushResult.failed > 0 && 
            `, ${queueStatus.lastFlushResult.failed} failed`
          }
        </Text>
      )}
    </View>
  );

  return showDetails ? renderDetailedStatus() : renderSimpleBadge();
};

const styles = StyleSheet.create({
  badgeContainer: {
    alignItems: 'flex-end',
    marginHorizontal: 8,
  },
  badge: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  progressContainer: {
    width: 60,
    marginTop: 4,
  },
  progressBar: {
    height: 2,
    borderRadius: 1,
  },
  
  // Detailed view styles
  detailedContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    margin: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4caf50',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  flushButton: {
    backgroundColor: '#2196f3',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  flushButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  
  progressSection: {
    marginVertical: 8,
  },
  fillText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  fillProgressBar: {
    height: 4,
    borderRadius: 2,
  },
  
  syncingSection: {
    marginVertical: 8,
  },
  syncProgressBar: {
    height: 3,
    borderRadius: 2,
    marginBottom: 4,
  },
  syncingText: {
    fontSize: 12,
    color: '#2196f3',
    fontStyle: 'italic',
  },
  
  warningText: {
    fontSize: 12,
    color: '#f44336',
    fontWeight: '600',
    marginTop: 4,
  },
  offlineText: {
    fontSize: 12,
    color: '#ff9800',
    marginTop: 4,
  },
  lastFlushText: {
    fontSize: 10,
    color: '#999',
    marginTop: 4,
  },
});