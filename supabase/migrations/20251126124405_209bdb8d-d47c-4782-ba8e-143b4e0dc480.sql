-- Helper function to safely get the current user's organisation_id without RLS recursion
CREATE OR REPLACE FUNCTION public.get_user_organisation_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organisation_id
  FROM public.users
  WHERE id = auth.uid();
$$;

-- Fix recursive/problematic policies on users table
DROP POLICY IF EXISTS "Users view own org data" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;

-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON public.users
FOR SELECT
USING (auth.uid() = id);

-- Users can view other users in the same organisation using helper function
CREATE POLICY "Users can view org members" ON public.users
FOR SELECT
USING (organisation_id = public.get_user_organisation_id());

-- Users can insert their own profile (for signup/login fallback)
CREATE POLICY "Users can insert own profile" ON public.users
FOR INSERT
WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON public.users
FOR UPDATE
USING (auth.uid() = id);

-- Update org-based policies on other tables to use the helper function

-- Contractors: users can view contractors in their organisation
DROP POLICY IF EXISTS "Users view own org contractors" ON public.contractors;
CREATE POLICY "Users view own org contractors" ON public.contractors
FOR SELECT
USING (organisation_id = public.get_user_organisation_id());

-- Properties: users can view properties in their organisation
DROP POLICY IF EXISTS "Users view own org properties" ON public.properties;
CREATE POLICY "Users view own org properties" ON public.properties
FOR SELECT
USING (organisation_id = public.get_user_organisation_id());

-- Purchase orders: users can view POs in their organisation
DROP POLICY IF EXISTS "Users view own org POs" ON public.purchase_orders;
CREATE POLICY "Users view own org POs" ON public.purchase_orders
FOR SELECT
USING (organisation_id = public.get_user_organisation_id());

-- Invoices: users can view invoices in their organisation
DROP POLICY IF EXISTS "Users view own org invoices" ON public.invoices;
CREATE POLICY "Users view own org invoices" ON public.invoices
FOR SELECT
USING (organisation_id = public.get_user_organisation_id());

-- Settings: users can view settings for their organisation
DROP POLICY IF EXISTS "Users view own org settings" ON public.settings;
CREATE POLICY "Users view own org settings" ON public.settings
FOR SELECT
USING (organisation_id = public.get_user_organisation_id());

-- Organisations: users can view their own organisation record
DROP POLICY IF EXISTS "Users view org" ON public.organisations;
CREATE POLICY "Users view org" ON public.organisations
FOR SELECT
USING (id = public.get_user_organisation_id());