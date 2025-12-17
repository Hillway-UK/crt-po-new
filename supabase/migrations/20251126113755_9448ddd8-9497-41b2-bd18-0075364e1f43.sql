-- Create dashboard stats functions for different roles

-- Function to get PM dashboard statistics
CREATE OR REPLACE FUNCTION public.get_pm_dashboard_stats(user_id UUID)
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'draft_pos', (SELECT COUNT(*) FROM purchase_orders WHERE created_by_user_id = user_id AND status = 'DRAFT'),
    'pending_pos', (SELECT COUNT(*) FROM purchase_orders WHERE created_by_user_id = user_id AND status = 'PENDING_MD_APPROVAL'),
    'approved_pos', (SELECT COUNT(*) FROM purchase_orders WHERE created_by_user_id = user_id AND status = 'APPROVED' AND approval_date >= date_trunc('month', now())),
    'rejected_pos', (SELECT COUNT(*) FROM purchase_orders WHERE created_by_user_id = user_id AND status = 'REJECTED')
  );
$$;

-- Function to get MD dashboard statistics
CREATE OR REPLACE FUNCTION public.get_md_dashboard_stats(org_id UUID)
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'pending_pos', (SELECT COUNT(*) FROM purchase_orders WHERE organisation_id = org_id AND status = 'PENDING_MD_APPROVAL'),
    'pending_invoices', (SELECT COUNT(*) FROM invoices WHERE organisation_id = org_id AND status = 'PENDING_MD_APPROVAL'),
    'approved_today', (SELECT COUNT(*) FROM purchase_orders WHERE organisation_id = org_id AND status = 'APPROVED' AND approval_date::date = CURRENT_DATE),
    'approved_value_today', (SELECT COALESCE(SUM(amount_inc_vat), 0) FROM purchase_orders WHERE organisation_id = org_id AND status = 'APPROVED' AND approval_date::date = CURRENT_DATE),
    'invoices_approved_today', (SELECT COUNT(*) FROM invoices WHERE organisation_id = org_id AND status IN ('APPROVED_FOR_PAYMENT', 'PAID') AND updated_at::date = CURRENT_DATE)
  );
$$;

-- Function to get Accounts dashboard statistics
CREATE OR REPLACE FUNCTION public.get_accounts_dashboard_stats(org_id UUID)
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'awaiting_invoice', (
      SELECT COUNT(*) 
      FROM purchase_orders po 
      WHERE po.organisation_id = org_id 
      AND po.status = 'APPROVED' 
      AND NOT EXISTS (
        SELECT 1 FROM invoices i 
        WHERE i.po_id = po.id 
        AND i.status NOT IN ('REJECTED')
      )
    ),
    'needs_matching', (SELECT COUNT(*) FROM invoices WHERE organisation_id = org_id AND status = 'UPLOADED'),
    'pending_approval', (SELECT COUNT(*) FROM invoices WHERE organisation_id = org_id AND status = 'PENDING_MD_APPROVAL'),
    'ready_to_pay', (SELECT COUNT(*) FROM invoices WHERE organisation_id = org_id AND status = 'APPROVED_FOR_PAYMENT'),
    'ready_to_pay_value', (SELECT COALESCE(SUM(amount_inc_vat), 0) FROM invoices WHERE organisation_id = org_id AND status = 'APPROVED_FOR_PAYMENT'),
    'paid_this_month', (SELECT COUNT(*) FROM invoices WHERE organisation_id = org_id AND status = 'PAID' AND payment_date >= date_trunc('month', now()))
  );
$$;

-- Function to get Admin dashboard statistics
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats(org_id UUID)
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'total_users', (SELECT COUNT(*) FROM users WHERE organisation_id = org_id AND is_active = true),
    'total_pos', (SELECT COUNT(*) FROM purchase_orders WHERE organisation_id = org_id),
    'total_invoices', (SELECT COUNT(*) FROM invoices WHERE organisation_id = org_id),
    'total_value_processed', (SELECT COALESCE(SUM(amount_inc_vat), 0) FROM purchase_orders WHERE organisation_id = org_id AND status = 'APPROVED'),
    'users_by_role', (
      SELECT json_object_agg(role, count) 
      FROM (
        SELECT role, COUNT(*) as count 
        FROM users 
        WHERE organisation_id = org_id AND is_active = true 
        GROUP BY role
      ) role_counts
    )
  );
$$;