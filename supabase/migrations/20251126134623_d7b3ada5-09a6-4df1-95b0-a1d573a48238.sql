-- Allow all authenticated users in org to insert properties
CREATE POLICY "Org users can insert properties" ON properties
FOR INSERT
WITH CHECK (organisation_id = get_user_organisation_id());

-- Update managers policy to include MD role
DROP POLICY IF EXISTS "Managers can update properties" ON properties;

CREATE POLICY "Managers can update properties" ON properties
FOR UPDATE
USING (organisation_id = get_user_organisation_id())
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role IN ('ACCOUNTS', 'ADMIN', 'MD')
  )
);