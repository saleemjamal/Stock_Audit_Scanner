# Simplified Rack Management with Dropdown

## Database Changes
```sql
-- Add to audit_sessions table
ALTER TABLE audit_sessions 
ADD COLUMN total_rack_count INTEGER DEFAULT 0;

-- Auto-generate racks when audit starts
CREATE OR REPLACE FUNCTION generate_racks_for_audit()
RETURNS TRIGGER AS $$
BEGIN
  FOR i IN 1..NEW.total_rack_count LOOP
    INSERT INTO racks (audit_session_id, location_id, rack_number, status)
    VALUES (NEW.id, NEW.location_id, i::TEXT, 'available');
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

## Start Audit Screen (Admin)
```javascript
const StartAuditScreen = () => {
  const [location, setLocation] = useState(null);
  const [rackCount, setRackCount] = useState('');

  const handleStartAudit = async () => {
    const { data: session } = await supabase
      .from('audit_sessions')
      .insert({
        location_id: location,
        total_rack_count: parseInt(rackCount),
        status: 'active'
      })
      .select()
      .single();

    Alert.alert('Success', `Created ${rackCount} racks for auditing`);
    navigation.navigate('Dashboard');
  };

  return (
    <View>
      <Title>Start New Audit</Title>
      
      <Picker
        selectedValue={location}
        onValueChange={setLocation}>
        <Picker.Item label="Select Location" value={null} />
        {locations.map(loc => (
          <Picker.Item label={loc.name} value={loc.id} />
        ))}
      </Picker>

      <TextInput
        label="Number of Racks"
        value={rackCount}
        onChangeText={setRackCount}
        keyboardType="numeric"
        placeholder="e.g., 50"
      />

      <Button onPress={handleStartAudit}>
        Start Audit
      </Button>
    </View>
  );
};
```

## Rack Selection for Users
```javascript
const RackSelectionScreen = ({ navigation }) => {
  const [availableRacks, setAvailableRacks] = useState([]);
  const [selectedRack, setSelectedRack] = useState(null);

  useEffect(() => {
    loadAvailableRacks();
  }, []);

  const loadAvailableRacks = async () => {
    const { data } = await supabase
      .from('racks')
      .select('*')
      .eq('audit_session_id', activeSession.id)
      .eq('status', 'available')
      .order('rack_number');
    
    setAvailableRacks(data);
  };

  const claimRack = async () => {
    // Assign rack to user
    const { error } = await supabase
      .from('racks')
      .update({ 
        scanner_id: user.id,
        status: 'active'
      })
      .eq('id', selectedRack)
      .eq('status', 'available'); // Prevent race condition

    if (error) {
      Alert.alert('Rack already taken');
      loadAvailableRacks();
    } else {
      navigation.navigate('Scan', { rack: selectedRack });
    }
  };

  return (
    <View>
      <Title>Select Rack to Scan</Title>
      
      <Picker
        selectedValue={selectedRack}
        onValueChange={setSelectedRack}>
        <Picker.Item label="Choose Rack" value={null} />
        {availableRacks.map(rack => (
          <Picker.Item 
            label={`Rack ${rack.rack_number}`} 
            value={rack.id} 
          />
        ))}
      </Picker>

      <Text>{availableRacks.length} racks available</Text>

      <Button 
        onPress={claimRack}
        disabled={!selectedRack}>
        Start Scanning
      </Button>
    </View>
  );
};
```

## Visual Rack Status
```javascript
const RackStatusGrid = () => {
  const [racks, setRacks] = useState([]);

  const getRackColor = (status) => ({
    'available': '#4CAF50',
    'active': '#FFC107',
    'ready_for_approval': '#FF9800',
    'completed': '#9E9E9E',
    'rejected': '#F44336'
  }[status]);

  return (
    <Grid>
      {racks.map(rack => (
        <View
          key={rack.id}
          style={{
            backgroundColor: getRackColor(rack.status),
            padding: 10,
            margin: 2
          }}>
          <Text>#{rack.rack_number}</Text>
          <Text>{rack.scanner_name || 'Available'}</Text>
        </View>
      ))}
    </Grid>
  );
};
```

## Benefits
1. Admin just enters total rack count
2. System auto-generates numbered racks (1, 2, 3...)
3. Users pick from dropdown of available racks
4. First-come-first-served assignment
5. Visual grid shows rack status
6. No typos or wrong rack numbers