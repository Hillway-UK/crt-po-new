import { supabase } from '@/integrations/supabase/client';
import { PurchaseOrder } from '@/types';
import { formatCurrency } from '@/lib/formatters';
import { toast } from 'sonner';

interface ApprovalResult {
  success: boolean;
  needsCeoApproval?: boolean;
  error?: string;
}

interface ApprovalContext {
  user: {
    id: string;
    organisation_id: string;
    role: string;
  };
  po: PurchaseOrder;
}

/**
 * Handles PO approval logic including CEO threshold routing
 */
export async function approvePO(context: ApprovalContext): Promise<ApprovalResult> {
  const { user, po } = context;

  try {
    // Get workflow settings to check CEO threshold
    const { data: settings } = await supabase
      .from('settings')
      .select('use_custom_workflows, require_ceo_above_amount')
      .eq('organisation_id', user.organisation_id)
      .maybeSingle();

    const ceoThreshold = settings?.require_ceo_above_amount || 15000;
    const useCustomWorkflows = settings?.use_custom_workflows ?? false;
    const poAmount = Number(po.amount_inc_vat);

    // Check if CEO approval is required (MD approving high-value PO)
    const needsCeoApproval = useCustomWorkflows &&
      po.status === 'PENDING_MD_APPROVAL' &&
      poAmount > ceoThreshold &&
      user.role !== 'CEO';

    if (needsCeoApproval) {
      // Route to CEO for final approval
      return await routeToCEOApproval(context, poAmount);
    }

    // Full approval (CEO approving, or MD approving under threshold)
    return await finalApproval(context);
  } catch (error) {
    console.error('Failed to approve PO:', error);
    return {
      success: false,
      error: 'Failed to approve purchase order'
    };
  }
}

/**
 * Routes PO to CEO for final approval
 */
async function routeToCEOApproval(
  context: ApprovalContext,
  poAmount: number
): Promise<ApprovalResult> {
  const { user, po } = context;

  const { error: updateError } = await supabase
    .from('purchase_orders')
    .update({ status: 'PENDING_CEO_APPROVAL' })
    .eq('id', po.id);

  if (updateError) throw updateError;

  // Log MD approval action
  await supabase.from('po_approval_logs').insert([{
    po_id: po.id,
    action_by_user_id: user.id,
    action: 'APPROVED',
    comment: 'MD approved - routed to CEO for final approval',
  }]);

  // Notify CEO users
  const { data: ceoUsers } = await supabase
    .from('users')
    .select('id')
    .eq('organisation_id', user.organisation_id)
    .eq('role', 'CEO')
    .eq('is_active', true);

  if (ceoUsers && ceoUsers.length > 0) {
    await supabase.from('notifications').insert(
      ceoUsers.map((ceoUser) => ({
        user_id: ceoUser.id,
        organisation_id: user.organisation_id,
        type: 'po_pending_ceo_approval',
        title: 'High-Value PO Requires CEO Approval',
        message: `PO ${po.po_number} (${formatCurrency(poAmount)}) requires your approval`,
        link: `/pos/${po.id}`,
        related_po_id: po.id,
      }))
    );
  }

  // Send email notification to CEO
  supabase.functions.invoke('send-email', {
    body: { type: 'po_ceo_approval_request', po_id: po.id }
  }).catch(err => console.error('CEO email notification failed:', err));

  return {
    success: true,
    needsCeoApproval: true
  };
}

/**
 * Performs final approval of PO
 */
async function finalApproval(context: ApprovalContext): Promise<ApprovalResult> {
  const { user, po } = context;

  const { error: updateError } = await supabase
    .from('purchase_orders')
    .update({
      status: 'APPROVED',
      approved_by_user_id: user.id,
      approval_date: new Date().toISOString(),
    })
    .eq('id', po.id);

  if (updateError) throw updateError;

  // Log approval action
  await supabase.from('po_approval_logs').insert([{
    po_id: po.id,
    action_by_user_id: user.id,
    action: 'APPROVED',
  }]);

  // Generate PDF and send emails in background
  Promise.all([
    supabase.functions.invoke('generate-po-pdf', { body: { po_id: po.id } }),
    supabase.functions.invoke('send-email', {
      body: { type: 'po_approved_contractor', po_id: po.id }
    }),
    supabase.functions.invoke('send-email', {
      body: { type: 'po_approved_accounts', po_id: po.id }
    }),
    supabase.functions.invoke('send-email', {
      body: { type: 'po_approved_pm', po_id: po.id }
    }),
  ]).catch(err => {
    console.error('Background tasks failed:', err);
    toast.error('PO approved but PDF/email may have failed. Check PO details.');
  });

  // Create notification for PM (if not approving their own PO)
  if (po.created_by_user_id !== user.id) {
    await supabase.from('notifications').insert({
      user_id: po.created_by_user_id,
      organisation_id: user.organisation_id,
      type: 'po_approved',
      title: 'PO Approved',
      message: `Your Purchase Order ${po.po_number} has been approved`,
      link: `/pos/${po.id}`,
      related_po_id: po.id,
    });
  }

  // Notify Accounts/ADMIN users that a new PO is ready for invoice
  await notifyAccountsUsers(context);

  return { success: true };
}

/**
 * Notifies accounts users that PO is ready for invoice
 */
async function notifyAccountsUsers(context: ApprovalContext): Promise<void> {
  const { user, po } = context;

  const { data: accountsUsers, error: accountsQueryError } = await supabase
    .from('users')
    .select('id')
    .eq('organisation_id', user.organisation_id)
    .in('role', ['ACCOUNTS', 'ADMIN'])
    .eq('is_active', true)
    .neq('id', user.id);

  if (accountsQueryError) {
    console.error('Error fetching ACCOUNTS/ADMIN users:', accountsQueryError);
    return;
  }

  if (accountsUsers && accountsUsers.length > 0) {
    const { error: accountsNotificationError } = await supabase.from('notifications').insert(
      accountsUsers.map((accountsUser) => ({
        user_id: accountsUser.id,
        organisation_id: user.organisation_id,
        type: 'po_approved_for_invoice',
        title: 'PO Ready for Invoice',
        message: `PO ${po.po_number} approved. Ready for invoice matching.`,
        link: `/invoices`,
        related_po_id: po.id,
      }))
    );

    if (accountsNotificationError) {
      console.error('Error creating ACCOUNTS notifications:', accountsNotificationError);
    }
  }
}

/**
 * Handles PO rejection
 */
export async function rejectPO(
  context: ApprovalContext,
  reason: string
): Promise<ApprovalResult> {
  const { user, po } = context;

  try {
    const { error: updateError } = await supabase
      .from('purchase_orders')
      .update({
        status: 'REJECTED',
        rejection_reason: reason,
      })
      .eq('id', po.id);

    if (updateError) throw updateError;

    await supabase.from('po_approval_logs').insert([{
      po_id: po.id,
      action_by_user_id: user.id,
      action: 'REJECTED',
      comment: reason,
    }]);

    // Send rejection email in background
    supabase.functions.invoke('send-email', {
      body: { type: 'po_rejected', po_id: po.id }
    }).catch(err => {
      console.error('Email failed:', err);
    });

    // Create notification for PM (if not rejecting their own PO)
    if (po.created_by_user_id !== user.id) {
      await supabase.from('notifications').insert({
        user_id: po.created_by_user_id,
        organisation_id: user.organisation_id,
        type: 'po_rejected',
        title: 'PO Rejected',
        message: `Your Purchase Order ${po.po_number} has been rejected`,
        link: `/pos/${po.id}`,
        related_po_id: po.id,
      });
    }

    return { success: true };
  } catch (error) {
    console.error('Failed to reject PO:', error);
    return {
      success: false,
      error: 'Failed to reject purchase order'
    };
  }
}
