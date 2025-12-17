CREATE OR REPLACE FUNCTION public.generate_po_number(org_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_number INTEGER;
  prefix TEXT;
  new_po_number TEXT;
BEGIN
  -- Get current settings and lock the row
  SELECT next_po_number, po_prefix INTO current_number, prefix
  FROM settings WHERE organisation_id = org_id FOR UPDATE;
  
  -- Generate PO number with 5-digit zero-padding
  new_po_number := prefix || LPAD(current_number::TEXT, 5, '0');
  
  -- Increment counter
  UPDATE settings SET next_po_number = current_number + 1 WHERE organisation_id = org_id;
  
  RETURN new_po_number;
END;
$function$;