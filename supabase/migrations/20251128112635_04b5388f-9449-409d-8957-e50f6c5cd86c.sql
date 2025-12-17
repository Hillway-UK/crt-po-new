-- Add UPDATE policy on organisations table for ADMIN users
CREATE POLICY "Admins can update org"
ON public.organisations
FOR UPDATE
USING (id = get_user_organisation_id())
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'ADMIN'
  )
);

-- Drop the existing overly permissive settings policy
DROP POLICY IF EXISTS "System can update settings" ON public.settings;

-- Create a more restrictive policy for ADMIN users
CREATE POLICY "Admins can update settings"
ON public.settings
FOR UPDATE
USING (organisation_id = get_user_organisation_id())
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'ADMIN'
  )
);