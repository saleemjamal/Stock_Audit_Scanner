# Rack Management System

## Rack Number Entry & Persistence

### Wrong Rack Prevention
```javascript
// Confirmation before first scan
const RackConfirmation = ({ rackNumber, onConfirm, onEdit }) => (
  <Dialog visible={true}>
    <Dialog.Title>Confirm Rack</Dialog.Title>
    <Dialog.Content>
      <Text style={{ fontSize: 20 }}>
        Starting Rack: {rackNumber}
      </Text>
      <Text>You cannot change this after scanning begins</Text>
    </Dialog.Content>
    <Dialog.Actions>
      <Button onPress={onEdit}>Change</Button>
      <Button onPress={onConfirm}>Confirm & Start</Button>
    </Dialog.Actions>
  </Dialog>
);

// Change rack with supervisor PIN
const changeRackWithAuth = async () => {
  const pin = await promptForPIN();
  const isValid = await validateSupervisorPIN(pin);
  
  if (isValid) {
    navigation.navigate('RackEntry');
  } else {
    Alert.alert('Invalid PIN');
  }
};
```

### Persistent Rack Display
```javascript
// Always visible rack header
const PersistentRackHeader = ({ rack, scanCount }) => (
  <View style={styles.stickyHeader}>
    <Text style={styles.rackText}>
      📍 {rack.location}-{rack.number}
    </Text>
    <Text style={styles.countText}>
      {scanCount} items
    </Text>
    <TouchableOpacity onPress={changeRackWithAuth}>
      <Text style={styles.changeLink}>Change</Text>
    </TouchableOpacity>
  </View>
);
```

## Rack Assignment Options

### Option 1: Pre-Assignment (Recommended)
```javascript
// Admin assigns racks before audit
const RackAssignment = () => {
  const assignments = [
    { user: 'John', racks: ['A-1', 'A-2', 'A-3'] },
    { user: 'Mary', racks: ['B-1', 'B-2'] }
  ];
  
  // Users only see their assigned racks
  const myRacks = assignments.find(a => a.user === currentUser);
};
```

### Option 2: Claim System
```javascript
// First come, first served with visual status
const RackStatus = {
  AVAILABLE: 'green',
  IN_PROGRESS: 'yellow',
  READY: 'orange',
  COMPLETED: 'gray'
};

// Visual rack map
const RackMap = () => (
  <Grid>
    {racks.map(rack => (
      <RackTile
        key={rack.id}
        color={RackStatus[rack.status]}
        number={rack.number}
        scanner={rack.scanner_name}
      />
    ))}
  </Grid>
);
```

## Best Practices
1. Show rack number prominently at ALL times
2. Require confirmation before starting
3. Allow supervisors to reassign if needed
4. Visual rack map shows progress
5. Prevent duplicate rack claims
6. Log all rack changes in audit trail