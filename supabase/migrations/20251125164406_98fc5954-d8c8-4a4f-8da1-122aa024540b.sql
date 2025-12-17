-- 1. ENUMS (create first)
CREATE TYPE user_role AS ENUM ('PROPERTY_MANAGER', 'MD', 'ACCOUNTS', 'ADMIN');
CREATE TYPE po_status AS ENUM ('DRAFT', 'PENDING_MD_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED');
CREATE TYPE invoice_status AS ENUM ('UPLOADED', 'MATCHED', 'PENDING_MD_APPROVAL', 'APPROVED_FOR_PAYMENT', 'PAID', 'REJECTED');
CREATE TYPE approval_action AS ENUM ('SENT_FOR_APPROVAL', 'APPROVED', 'REJECTED');
CREATE TYPE invoice_action AS ENUM ('UPLOADED', 'MATCHED', 'SENT_FOR_MD_APPROVAL', 'APPROVED', 'REJECTED', 'MARKED_PAID');

-- 2. ORGANISATION TABLE
CREATE TABLE organisations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'CRT Property Investments Ltd',
  logo_url TEXT,
  accounts_email TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  website TEXT DEFAULT 'https://www.crtproperty.co.uk',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. USERS TABLE (extends Supabase auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'PROPERTY_MANAGER',
  organisation_id UUID REFERENCES organisations(id),
  is_active BOOLEAN DEFAULT true,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. CONTRACTORS TABLE
CREATE TABLE contractors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id),
  name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  default_payment_terms INTEGER DEFAULT 30,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. PROPERTIES TABLE
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  reference_code TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. SETTINGS TABLE
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id) UNIQUE,
  next_po_number INTEGER DEFAULT 1,
  po_prefix TEXT DEFAULT 'CRT-2025-',
  notify_md_email TEXT,
  default_vat_rate DECIMAL(5,2) DEFAULT 20.00,
  payment_terms_text TEXT DEFAULT 'Payment terms: 30 days from invoice date. No works should commence without a valid Purchase Order.',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 7. PURCHASE ORDERS TABLE
CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id),
  po_number TEXT UNIQUE NOT NULL,
  created_by_user_id UUID REFERENCES users(id),
  property_id UUID REFERENCES properties(id),
  contractor_id UUID REFERENCES contractors(id) NOT NULL,
  description TEXT NOT NULL,
  amount_ex_vat DECIMAL(12,2) NOT NULL,
  vat_rate DECIMAL(5,2) DEFAULT 20.00,
  amount_inc_vat DECIMAL(12,2) GENERATED ALWAYS AS (amount_ex_vat * (1 + vat_rate/100)) STORED,
  status po_status DEFAULT 'DRAFT',
  approval_date TIMESTAMPTZ,
  approved_by_user_id UUID REFERENCES users(id),
  rejection_reason TEXT,
  pdf_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 8. PO APPROVAL LOG
CREATE TABLE po_approval_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
  action_by_user_id UUID REFERENCES users(id),
  action approval_action NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. INVOICES TABLE
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id),
  po_id UUID REFERENCES purchase_orders(id),
  contractor_id UUID REFERENCES contractors(id),
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  amount_ex_vat DECIMAL(12,2) NOT NULL,
  vat_rate DECIMAL(5,2) DEFAULT 20.00,
  amount_inc_vat DECIMAL(12,2) GENERATED ALWAYS AS (amount_ex_vat * (1 + vat_rate/100)) STORED,
  status invoice_status DEFAULT 'UPLOADED',
  file_url TEXT,
  original_filename TEXT,
  mismatch_notes TEXT,
  rejection_reason TEXT,
  payment_date DATE,
  payment_reference TEXT,
  uploaded_by_user_id UUID REFERENCES users(id),
  approved_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 10. INVOICE APPROVAL LOG
CREATE TABLE invoice_approval_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  action_by_user_id UUID REFERENCES users(id),
  action invoice_action NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 11. INDEXES FOR PERFORMANCE
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX idx_purchase_orders_created_by ON purchase_orders(created_by_user_id);
CREATE INDEX idx_purchase_orders_contractor ON purchase_orders(contractor_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_po ON invoices(po_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_org ON users(organisation_id);

-- 12. TIMESTAMP UPDATE FUNCTION
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 13. TIMESTAMP TRIGGERS
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contractors_updated_at BEFORE UPDATE ON contractors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON purchase_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_organisations_updated_at BEFORE UPDATE ON organisations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 14. RLS POLICIES
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE po_approval_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_approval_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;

-- Basic RLS: Users can see data for their organisation
CREATE POLICY "Users view own org data" ON users FOR SELECT USING (auth.uid() = id OR organisation_id IN (SELECT organisation_id FROM users WHERE id = auth.uid()));
CREATE POLICY "Users view own org contractors" ON contractors FOR SELECT USING (organisation_id IN (SELECT organisation_id FROM users WHERE id = auth.uid()));
CREATE POLICY "Users view own org properties" ON properties FOR SELECT USING (organisation_id IN (SELECT organisation_id FROM users WHERE id = auth.uid()));
CREATE POLICY "Users view own org POs" ON purchase_orders FOR SELECT USING (organisation_id IN (SELECT organisation_id FROM users WHERE id = auth.uid()));
CREATE POLICY "Users view own org invoices" ON invoices FOR SELECT USING (organisation_id IN (SELECT organisation_id FROM users WHERE id = auth.uid()));
CREATE POLICY "Users view own org settings" ON settings FOR SELECT USING (organisation_id IN (SELECT organisation_id FROM users WHERE id = auth.uid()));
CREATE POLICY "Users view org" ON organisations FOR SELECT USING (id IN (SELECT organisation_id FROM users WHERE id = auth.uid()));

-- Insert/Update policies
CREATE POLICY "PM can create POs" ON purchase_orders FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "PM can update own draft POs" ON purchase_orders FOR UPDATE USING (created_by_user_id = auth.uid() OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('MD', 'ACCOUNTS', 'ADMIN')));
CREATE POLICY "Accounts can manage contractors" ON contractors FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('ACCOUNTS', 'ADMIN', 'MD')));
CREATE POLICY "Accounts can manage invoices" ON invoices FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('ACCOUNTS', 'ADMIN', 'MD')));
CREATE POLICY "View approval logs" ON po_approval_logs FOR SELECT USING (true);
CREATE POLICY "Create approval logs" ON po_approval_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "View invoice logs" ON invoice_approval_logs FOR SELECT USING (true);
CREATE POLICY "Create invoice logs" ON invoice_approval_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 15. STORAGE BUCKET FOR PO PDFs AND INVOICES
INSERT INTO storage.buckets (id, name, public) VALUES ('po-documents', 'po-documents', false);

CREATE POLICY "Users can upload documents" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'po-documents' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users can view documents" ON storage.objects FOR SELECT USING (bucket_id = 'po-documents' AND auth.uid() IS NOT NULL);

-- 16. SEED DATA: Create default organisation and settings
INSERT INTO organisations (id, name, accounts_email, address, website) 
VALUES ('00000000-0000-0000-0000-000000000001', 'CRT Property Investments Ltd', 'accounts@crtproperty.co.uk', '1 Waterside Park, Valley Way Wombwell, Barnsley, South Yorkshire, S73 0BB', 'https://www.crtproperty.co.uk');

INSERT INTO settings (organisation_id, po_prefix, next_po_number) 
VALUES ('00000000-0000-0000-0000-000000000001', 'CRT-2025-', 1);

-- 17. Auto-create user profile trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, organisation_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    '00000000-0000-0000-0000-000000000001'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();