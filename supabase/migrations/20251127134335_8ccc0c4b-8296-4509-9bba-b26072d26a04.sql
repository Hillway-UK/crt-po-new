-- Create user_invitations table
CREATE TABLE public.user_invitations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  full_name text NOT NULL,
  role user_role NOT NULL,
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  invited_by_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can insert invitations"
ON public.user_invitations
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
      AND users.role IN ('ADMIN', 'MD')
      AND users.organisation_id = user_invitations.organisation_id
  )
);

CREATE POLICY "Admins can view org invitations"
ON public.user_invitations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
      AND users.role IN ('ADMIN', 'MD')
      AND users.organisation_id = user_invitations.organisation_id
  )
);

CREATE POLICY "System can update invitations"
ON public.user_invitations
FOR UPDATE
TO authenticated
USING (true);

-- Update handle_new_user() trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  invited_role user_role;
  invited_org_id uuid;
  invited_name text;
  invitation_id uuid;
BEGIN
  -- Check for pending invitation by email
  SELECT id, role, organisation_id, full_name INTO invitation_id, invited_role, invited_org_id, invited_name
  FROM public.user_invitations
  WHERE email = NEW.email
    AND accepted_at IS NULL
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- If invitation exists, use invited role and org
  IF invitation_id IS NOT NULL THEN
    INSERT INTO public.users (id, email, full_name, role, organisation_id, is_active)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', invited_name, 'User'),
      invited_role,
      invited_org_id,
      true
    )
    ON CONFLICT (id) DO NOTHING;
    
    -- Mark invitation as accepted
    UPDATE public.user_invitations SET accepted_at = now() WHERE id = invitation_id;
  ELSE
    -- No invitation - use default role
    INSERT INTO public.users (id, email, full_name, role, organisation_id, is_active)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1), 'User'),
      'PROPERTY_MANAGER',
      '00000000-0000-0000-0000-000000000001',
      true
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;