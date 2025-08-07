-- Restore Constraints After Auth User Creation
-- Run this AFTER successfully creating auth users

-- Re-add the foreign key constraint
ALTER TABLE users ADD CONSTRAINT users_id_fkey 
    FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Re-enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Verify constraints are restored
SELECT 'Constraints restored successfully' as status;

-- Show restored constraints
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    tc.constraint_type
FROM information_schema.table_constraints tc
WHERE tc.table_name = 'users' 
  AND tc.table_schema = 'public';

-- Now you can safely add users to the users table
SELECT 'Ready to add users with real UUIDs' as next_step;