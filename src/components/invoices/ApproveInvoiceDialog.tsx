import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDelegation } from '@/hooks/useDelegation';
import { toast } from '@/components/ui/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { formatCurrency } from '@/lib/formatters';
import type { Invoice } from '@/types';

interface ApproveInvoiceDialogProps {
  invoice: Invoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ApproveInvoiceDialog({
  invoice,
  open,
  onOpenChange,
}: ApproveInvoiceDialogProps) {
  const { user } = useAuth();
  const { isActiveDelegate, getMDsForDelegate } = useDelegation();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  async function handleApprove() {
    if (!invoice || !user) return;

    setLoading(true);

    try {
      // Check if this is a delegated approval
      const isMD = user.role === 'MD';
      const userIsDelegate = isActiveDelegate(user.id);
      const isDelegatedApproval = !isMD && userIsDelegate;
      
      let approvedOnBehalfOfUserId: string | null = null;
      let approvedOnBehalfOfName: string | null = null;
      
      if (isDelegatedApproval) {
        const mds = await getMDsForDelegate(user.id);
        if (mds.length > 0) {
          approvedOnBehalfOfUserId = mds[0].id;
          approvedOnBehalfOfName = mds[0].full_name;
        }
      }

      // Update invoice status
      const { error: updateError } = await supabase
        .from('invoices')
        .update({
          status: 'APPROVED_FOR_PAYMENT',
          approved_by_user_id: user.id,
        })
        .eq('id', invoice.id);

      if (updateError) throw updateError;

      // Create approval log with on-behalf-of info
      const { error: logError } = await supabase.from('invoice_approval_logs').insert({
        invoice_id: invoice.id,
        action_by_user_id: user.id,
        approved_on_behalf_of_user_id: approvedOnBehalfOfUserId,
        action: 'APPROVED',
        comment: isDelegatedApproval && approvedOnBehalfOfName 
          ? `Approved on behalf of ${approvedOnBehalfOfName}` 
          : null,
      });

      if (logError) throw logError;

      // Send email notification to accounts (non-blocking)
      supabase.functions.invoke('send-email', {
        body: {
          type: 'invoice_approved_accounts',
          invoice_id: invoice.id,
        },
      }).catch((err) => {
        console.error('Email notification to Accounts failed:', err);
      });

      // Send email notification to Property Manager (non-blocking)
      supabase.functions.invoke('send-email', {
        body: {
          type: 'invoice_approved_pm',
          invoice_id: invoice.id,
        },
      }).catch((err) => {
        console.error('Email notification to PM failed:', err);
      });

      // Get Accounts users (exclude self)
      const { data: accountsUsers, error: accountsUsersError } = await supabase
        .from('users')
        .select('id')
        .eq('organisation_id', user.organisation_id)
        .in('role', ['ACCOUNTS', 'ADMIN'])
        .eq('is_active', true)
        .neq('id', user.id);

      if (accountsUsersError) {
        console.error('Error fetching Accounts/ADMIN users:', accountsUsersError);
      }

      // Create notifications for Accounts users
      if (accountsUsers && accountsUsers.length > 0) {
        const { error: notificationError } = await supabase.from('notifications').insert(
          accountsUsers.map((accountsUser) => ({
            user_id: accountsUser.id,
            organisation_id: user.organisation_id,
            type: 'invoice_approved',
            title: 'Invoice approved for payment',
            message: `Invoice ${invoice.invoice_number} has been approved and is ready to pay`,
            link: `/invoice/${invoice.id}`,
            related_invoice_id: invoice.id,
          }))
        );

        if (notificationError) {
          console.error('Error creating notifications for Accounts users:', notificationError);
        }
      }

      // Create notification for PM who uploaded (if not the same user who approved and not already notified as ACCOUNTS/ADMIN)
      const uploaderAlreadyNotified = accountsUsers?.some(u => u.id === invoice.uploaded_by_user_id);
      if (invoice.uploaded_by_user_id && invoice.uploaded_by_user_id !== user.id && !uploaderAlreadyNotified) {
        const { error: notificationError } = await supabase.from('notifications').insert({
          user_id: invoice.uploaded_by_user_id,
          organisation_id: user.organisation_id,
          type: 'invoice_approved',
          title: 'Invoice approved',
          message: `Invoice ${invoice.invoice_number} has been approved for payment`,
          link: `/invoice/${invoice.id}`,
          related_invoice_id: invoice.id,
        });

        if (notificationError) {
          console.error('Error creating notification for uploader:', notificationError);
        }
      }

      toast({
        title: 'Invoice approved',
        description: 'Invoice has been approved for payment',
      });

      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice', invoice.id] });
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error approving invoice:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to approve invoice',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  if (!invoice) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Approve Invoice for Payment</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>Are you sure you want to approve this invoice for payment?</p>
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Invoice Number:</span>
                  <span className="text-sm">{invoice.invoice_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Contractor:</span>
                  <span className="text-sm">{invoice.contractor?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Amount:</span>
                  <span className="text-sm font-bold">
                    {formatCurrency(invoice.amount_inc_vat || 0)}
                  </span>
                </div>
                {invoice.purchase_order && (
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">PO Number:</span>
                    <span className="text-sm">{invoice.purchase_order.po_number}</span>
                  </div>
                )}
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleApprove} disabled={loading}>
            {loading ? 'Approving...' : 'Approve for Payment'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
