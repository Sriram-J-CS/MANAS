-- ==============================================================================
-- Migration: 002_profiles_trigger.sql
-- Trigger on auth.users insert to maintain public.profiles with RLS
-- ==============================================================================

-- 1. Ensure columns exist on public.profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Trigger function to automatically create profile on new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  extracted_name TEXT;
BEGIN
  extracted_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'user_name',
    'Friend'
  );

  INSERT INTO public.profiles (
    id,
    user_id,
    name,
    phone,
    email,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.id,
    extracted_name,
    NEW.phone,
    NEW.email,
    COALESCE(NEW.created_at, now()),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    name = CASE 
      WHEN public.profiles.name IS NULL OR public.profiles.name = '' OR public.profiles.name = 'Friend' 
      THEN EXCLUDED.name 
      ELSE public.profiles.name 
    END,
    updated_at = now();

  RETURN NEW;
END;
$$;

-- 3. Attach trigger to auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Ensure RLS policies on public.profiles allow users to only see and update their own row
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles 
  FOR SELECT USING (user_id = auth.uid() OR id = auth.uid());

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles 
  FOR INSERT WITH CHECK (user_id = auth.uid() OR id = auth.uid());

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles 
  FOR UPDATE USING (user_id = auth.uid() OR id = auth.uid()) 
  WITH CHECK (user_id = auth.uid() OR id = auth.uid());

DROP POLICY IF EXISTS "profiles_delete_own" ON public.profiles;
CREATE POLICY "profiles_delete_own" ON public.profiles 
  FOR DELETE USING (user_id = auth.uid() OR id = auth.uid());
