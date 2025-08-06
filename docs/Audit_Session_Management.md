# Audit Session Management

## Database Schema Addition
```sql
CREATE TABLE audit_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id INTEGER REFERENCES locations(id),
  status VARCHAR(20) DEFAULT 'setup',
  started_at TIMESTAMP,
  started_by UUID REFERENCES users(id),
  completed_at TIMESTAMP,
  completed_by UUID REFERENCES users(id),
  total_racks INTEGER DEFAULT 0,
  approved_racks INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Constraint: Only one active audit per location
CREATE UNIQUE INDEX one_active_audit_per_location 
ON audit_sessions(location_id) 
WHERE status IN ('setup', 'active');
```

## Workflow States
1. **Setup** - Admin configuring audit
2. **Active** - Scanning in progress
3. **Completing** - All racks approved, final checks
4. **Completed** - Locked, no changes

## Start Audit Screen (Admin Only)
```javascript
// screens/StartAuditScreen.js
const StartAuditScreen = () => {
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [existingAudit, setExistingAudit] = useState(null);

  const handleStartAudit = async () => {
    // Check for existing audit
    const { data: existing } = await supabase
      .from('audit_sessions')
      .select('*')
      .eq('location_id', selectedLocation)
      .in('status', ['setup', 'active'])
      .single();

    if (existing) {
      Alert.alert('Active audit exists', 'Complete it first');
      return;
    }

    // Create new audit session
    const { data: session } = await supabase
      .from('audit_sessions')
      .insert({
        location_id: selectedLocation,
        status: 'active',
        started_by: user.id,
        started_at: new Date()
      })
      .select()
      .single();

    // Store in app state
    dispatch(setActiveAudit(session));
    navigation.navigate('Main');
  };

  return (
    <View>
      <Title>Start New Audit</Title>
      <LocationPicker 
        value={selectedLocation}
        onChange={setSelectedLocation}
      />
      <Button onPress={handleStartAudit}>
        Begin Audit Session
      </Button>
    </View>
  );
};
```

## Complete Audit Screen (Supervisor/Admin)
```javascript
const CompleteAuditScreen = () => {
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    loadAuditSummary();
  }, []);

  const loadAuditSummary = async () => {
    const { data } = await supabase
      .from('racks')
      .select('id, status')
      .eq('session_id', activeSession.id);

    const pending = data.filter(r => r.status !== 'completed').length;
    setSummary({
      total: data.length,
      completed: data.length - pending,
      pending
    });
  };

  const handleCompleteAudit = async () => {
    if (summary.pending > 0) {
      Alert.alert('Cannot complete', `${summary.pending} racks pending approval`);
      return;
    }

    Alert.alert(
      'Complete Audit?',
      'This will lock all data and generate final reports',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Complete', 
          style: 'destructive',
          onPress: async () => {
            await supabase
              .from('audit_sessions')
              .update({
                status: 'completed',
                completed_at: new Date(),
                completed_by: user.id
              })
              .eq('id', activeSession.id);

            // Generate reports
            await generateFinalReports();
            
            navigation.navigate('Reports');
          }
        }
      ]
    );
  };

  return (
    <View>
      <Card>
        <Title>Audit Summary</Title>
        <Text>Total Racks: {summary?.total}</Text>
        <Text>Approved: {summary?.completed}</Text>
        <Text>Pending: {summary?.pending}</Text>
      </Card>
      
      <Button 
        mode="contained"
        disabled={summary?.pending > 0}
        onPress={handleCompleteAudit}
      >
        Complete Stock Audit
      </Button>
    </View>
  );
};
```

## Access Control
```javascript
// Prevent scanning without active session
const canScan = () => {
  return activeSession?.status === 'active';
};

// Lock all modifications after completion
const beforeScan = async (barcode) => {
  const { data: session } = await supabase
    .from('audit_sessions')
    .select('status')
    .eq('id', activeSession.id)
    .single();

  if (session.status === 'completed') {
    Alert.alert('Audit Completed', 'No further scanning allowed');
    return false;
  }
  return true;
};
```

## Benefits
1. Clear audit boundaries
2. Prevents accidental cross-location scanning
3. Formal start/end process
4. Audit trail of who started/completed
5. Can resume interrupted audits
6. Final validation before completion