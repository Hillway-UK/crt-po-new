-- Update RLS policies for contractors to allow Property Managers to insert

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Admins can insert contractors" ON public.contractors;
DROP POLICY IF EXISTS "Accounts can manage contractors" ON public.contractors;

-- Allow all authenticated users in the org to insert contractors
CREATE POLICY "Org users can insert contractors" ON public.contractors
FOR INSERT
WITH CHECK (
  organisation_id = public.get_user_organisation_id()
);

-- Only ACCOUNTS, ADMIN, MD can update contractors
CREATE POLICY "Managers can update contractors" ON public.contractors
FOR UPDATE
USING (organisation_id = public.get_user_organisation_id())
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('ACCOUNTS', 'ADMIN', 'MD')
  )
);