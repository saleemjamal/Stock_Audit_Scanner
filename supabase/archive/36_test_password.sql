-- 36. Test if password123 works for saleem
-- Manual verification of password

-- Test saleem password
SELECT 
  'Testing saleem password' as test,
  email,
  crypt('password123', encrypted_password) = encrypted_password as password_matches,
  encrypted_password
FROM auth.users 
WHERE email = 'saleem@poppatjamals.com';

-- If the above doesn't work, let's recreate saleem with fresh password
DO $$
BEGIN
    -- Delete existing saleem auth user if exists
    DELETE FROM auth.users WHERE email = 'saleem@poppatjamals.com';
    
    -- Create fresh saleem with proper password
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(), 'authenticated', 'authenticated',
      'saleem@poppatjamals.com',
      crypt('password123', gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '{"provider": "email", "providers": ["email"]}',
      '{"username": "saleem", "role": "superuser"}'
    );
    
    RAISE NOTICE 'Recreated saleem auth user with fresh password';
END $$;

-- Test the new password
SELECT 
  'Testing NEW saleem password' as test,
  email,
  crypt('password123', encrypted_password) = encrypted_password as password_matches
FROM auth.users 
WHERE email = 'saleem@poppatjamals.com';