# Database Migration Instructions

## Required Migration for Audit Session Management

To use the new Audit Session Management feature from the dashboard, you need to add a `notes` column to the `audit_sessions` table.

### Option 1: Using Supabase SQL Editor (Recommended)

1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Run the following SQL command:

```sql
-- Add notes column to audit_sessions table
ALTER TABLE audit_sessions 
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add comment for documentation
COMMENT ON COLUMN audit_sessions.notes IS 'Optional instructions or notes for scanners working on this audit session';
```

### Option 2: Using the Migration File

Run the migration file `05_add_notes_column.sql` in your Supabase SQL Editor.

### What This Adds

- **notes** (TEXT): Optional field for supervisors to add instructions when creating an audit session
- This field is displayed to scanners in the mobile app
- It's optional - existing sessions without notes will continue to work

### Verification

After running the migration, you can verify it worked by:
1. Going to Table Editor in Supabase
2. Opening the `audit_sessions` table
3. Confirming the `notes` column exists

The dashboard will work with or without this column, but having it allows supervisors to provide helpful context to their scanning teams.