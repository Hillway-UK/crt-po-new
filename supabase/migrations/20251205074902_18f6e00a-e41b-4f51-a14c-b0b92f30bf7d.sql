-- Update contractors INSERT policy to include ACCOUNTS
DROP POLICY "Org users can insert contractors" ON contractors;
CREATE POLICY "Org users can insert contractors" ON contractors 
FOR INSERT WITH CHECK (
  (organisation_id = get_user_organisation_id()) AND 
  (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = ANY (ARRAY['PROPERTY_MANAGER'::user_role, 'ADMIN'::user_role, 'MD'::user_role, 'ACCOUNTS'::user_role])))
);

-- Update contractors UPDATE policy to include ACCOUNTS
DROP POLICY "Managers can update contractors" ON contractors;
CREATE POLICY "Managers can update contractors" ON contractors
FOR UPDATE USING (organisation_id = get_user_organisation_id())
WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = ANY (ARRAY['PROPERTY_MANAGER'::user_role, 'ADMIN'::user_role, 'MD'::user_role, 'ACCOUNTS'::user_role])));

-- Update properties INSERT policy to include ACCOUNTS
DROP POLICY "Org users can insert properties" ON properties;
CREATE POLICY "Org users can insert properties" ON properties
FOR INSERT WITH CHECK (
  (organisation_id = get_user_organisation_id()) AND 
  (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = ANY (ARRAY['PROPERTY_MANAGER'::user_role, 'ADMIN'::user_role, 'MD'::user_role, 'ACCOUNTS'::user_role])))
);

-- Update properties UPDATE policy to include ACCOUNTS
DROP POLICY "Managers can update properties" ON properties;
CREATE POLICY "Managers can update properties" ON properties
FOR UPDATE USING (organisation_id = get_user_organisation_id())
WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = ANY (ARRAY['PROPERTY_MANAGER'::user_role, 'ADMIN'::user_role, 'MD'::user_role, 'ACCOUNTS'::user_role])));

-- Update user_invitations INSERT policy to include PROPERTY_MANAGER
DROP POLICY "Admins can insert invitations" ON user_invitations;
CREATE POLICY "Managers can insert invitations" ON user_invitations
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = ANY (ARRAY['ADMIN'::user_role, 'MD'::user_role, 'PROPERTY_MANAGER'::user_role]) AND users.organisation_id = user_invitations.organisation_id)
);

-- Update user_invitations SELECT policy to include PROPERTY_MANAGER
DROP POLICY "Admins can view org invitations" ON user_invitations;
CREATE POLICY "Managers can view org invitations" ON user_invitations
FOR SELECT USING (
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = ANY (ARRAY['ADMIN'::user_role, 'MD'::user_role, 'PROPERTY_MANAGER'::user_role]) AND users.organisation_id = user_invitations.organisation_id)
);