-- Function to generate PO numbers with auto-increment
CREATE OR REPLACE FUNCTION generate_po_number(org_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_number INTEGER;
  prefix TEXT;
  new_po_number TEXT;
BEGIN
  -- Get current settings and lock the row
  SELECT next_po_number, po_prefix INTO current_number, prefix
  FROM settings WHERE organisation_id = org_id FOR UPDATE;
  
  -- Generate PO number with zero-padding
  new_po_number := prefix || LPAD(current_number::TEXT, 6, '0');
  
  -- Increment counter
  UPDATE settings SET next_po_number = current_number + 1 WHERE organisation_id = org_id;
  
  RETURN new_po_number;
END;
$$;

-- Add RLS policies for properties and contractors insert/update
CREATE POLICY "Admins can manage properties" ON properties FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('ADMIN', 'ACCOUNTS')));
CREATE POLICY "Admins can insert contractors" ON contractors FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('ACCOUNTS', 'ADMIN', 'MD')));

-- Update settings RLS to allow updates
CREATE POLICY "System can update settings" ON settings FOR UPDATE USING (true);