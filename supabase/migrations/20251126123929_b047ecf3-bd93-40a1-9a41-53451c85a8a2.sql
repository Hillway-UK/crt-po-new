-- Add RLS policies for users to insert their own profile (fallback for trigger)
CREATE POLICY "Users can insert own profile" ON users 
FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Add policy for users to update their own profile
CREATE POLICY "Users can update own profile" ON users 
FOR UPDATE 
USING (auth.uid() = id);

-- Recreate the trigger function with better error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role, organisation_id, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1), 'User'),
    'PROPERTY_MANAGER',
    '00000000-0000-0000-0000-000000000001',
    true
  )
  ON CONFLICT (id) DO NOTHING;  -- Prevent errors if profile already exists
  
  RETURN NEW;
END;
$$;

-- Make sure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();