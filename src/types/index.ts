export type UserRole = 'PROPERTY_MANAGER' | 'MD' | 'ACCOUNTS' | 'ADMIN' | 'CEO';
export type POStatus = 'DRAFT' | 'PENDING_PM_APPROVAL' | 'PENDING_MD_APPROVAL' | 'PENDING_CEO_APPROVAL' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type InvoiceStatus = 'UPLOADED' | 'MATCHED' | 'PENDING_MD_APPROVAL' | 'APPROVED_FOR_PAYMENT' | 'PAID' | 'REJECTED';
export type ApprovalAction = 'SENT_FOR_APPROVAL' | 'APPROVED' | 'REJECTED';
export type InvoiceAction = 'UPLOADED' | 'MATCHED' | 'SENT_FOR_MD_APPROVAL' | 'APPROVED' | 'REJECTED' | 'MARKED_PAID';
export type WorkflowType = 'PO' | 'INVOICE';
export type ApprovalProgressStatus = 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';

export interface ApprovalWorkflow {
  id: string;
  organisation_id: string;
  name: string;
  workflow_type: WorkflowType;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  steps?: ApprovalWorkflowStep[];
}

export interface ApprovalWorkflowStep {
  id: string;
  workflow_id: string;
  step_order: number;
  approver_role: UserRole;
  min_amount?: number;
  max_amount?: number;
  is_required: boolean;
  skip_if_below_amount?: number;
  requires_previous_approval?: boolean;
  created_at: string;
}

export interface POApprovalProgress {
  id: string;
  po_id: string;
  workflow_id?: string;
  current_step: number;
  total_steps: number;
  completed_steps: CompletedStep[];
  status: ApprovalProgressStatus;
  created_at: string;
  updated_at: string;
  workflow?: ApprovalWorkflow;
}

export interface CompletedStep {
  step_order: number;
  approver_role: UserRole;
  approved_by_user_id: string;
  approved_at: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  organisation_id: string;
  is_active: boolean;
  phone?: string;
  created_at: string;
  updated_at: string;
}

export interface Organisation {
  id: string;
  name: string;
  logo_url?: string;
  accounts_email: string;
  address?: string;
  phone?: string;
  website?: string;
  created_at: string;
  updated_at: string;
}

export interface Contractor {
  id: string;
  organisation_id: string;
  name: string;
  contact_name?: string;
  email: string;
  phone?: string;
  address?: string;
  default_payment_terms: number;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Property {
  id: string;
  organisation_id: string;
  name: string;
  address: string;
  reference_code?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrder {
  id: string;
  organisation_id: string;
  po_number: string;
  created_by_user_id: string;
  property_id?: string;
  contractor_id: string;
  description: string;
  amount_ex_vat: number;
  vat_rate: number;
  amount_inc_vat: number;
  status: POStatus;
  approval_date?: string;
  approved_by_user_id?: string;
  rejection_reason?: string;
  pdf_url?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  contractor?: Contractor;
  property?: Property;
  created_by?: User;
  approved_by?: User;
}

export interface Invoice {
  id: string;
  organisation_id: string;
  po_id: string;
  contractor_id: string;
  invoice_number: string;
  invoice_date: string;
  amount_ex_vat: number;
  vat_rate: number;
  amount_inc_vat: number;
  status: InvoiceStatus;
  file_url?: string;
  original_filename?: string;
  mismatch_notes?: string;
  rejection_reason?: string;
  payment_date?: string;
  payment_reference?: string;
  uploaded_by_user_id: string;
  approved_by_user_id?: string;
  created_at: string;
  updated_at: string;
  purchase_order?: PurchaseOrder;
  contractor?: Contractor;
  uploaded_by?: User;
  approved_by?: User;
}

export interface POApprovalLog {
  id: string;
  po_id: string;
  action_by_user_id: string;
  approved_on_behalf_of_user_id?: string;
  action: ApprovalAction;
  comment?: string;
  created_at: string;
  action_by?: User;
  approved_on_behalf_of?: User;
}

export interface InvoiceApprovalLog {
  id: string;
  invoice_id: string;
  action_by_user_id: string;
  approved_on_behalf_of_user_id?: string;
  action: InvoiceAction;
  comment?: string;
  created_at: string;
  action_by?: User;
  approved_on_behalf_of?: User;
}

export interface Settings {
  id: string;
  organisation_id: string;
  next_po_number: number;
  po_prefix: string;
  notify_md_email?: string;
  default_vat_rate: number;
  payment_terms_text: string;
  use_custom_workflows?: boolean;
  auto_approve_below_amount?: number;
  require_ceo_above_amount?: number;
  created_at: string;
  updated_at: string;
}
