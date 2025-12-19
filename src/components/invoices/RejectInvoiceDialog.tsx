import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency } from '@/lib/formatters';
import type { Invoice } from '@/types';

interface RejectInvoiceDialogProps {
  invoice: Invoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RejectInvoiceDialog({
  invoice,
  open,
  onOpenChange,
}: RejectInvoiceDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('');

  async function handleReject() {
    if (!invoice || !user || reason.trim().length < 10) {
      toast({
        title: 'Validation error',
        description: 'Please provide a rejection reason (minimum 10 characters)',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      // Update invoice status
      const { error: updateError } = await supabase
        .from('invoices')
        .update({
          status: 'REJECTED',
          rejection_reason: reason.trim(),
        })
        .eq('id', invoice.id);

      if (updateError) throw updateError;

      // Create approval log
      const { error: logError } = await supabase.from('invoice_approval_logs').insert({
        invoice_id: invoice.id,
        action_by_user_id: user.id,
        action: 'REJECTED',
        comment: reason.trim(),
      });

      if (logError) throw logError;

      // Send email notification to ACCOUNTS/ADMIN + uploader (non-blocking)
      supabase.functions.invoke('send-email', {
        body: {
          type: 'invoice_rejected',
          invoice_id: invoice.id,
        },
      }).catch((err) => {
        console.error('Email notification for invoice rejection failed:', err);
      });

      // Get ACCOUNTS/ADMIN users (exclude self)
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

      // Create in-app notifications for ACCOUNTS/ADMIN users
      if (accountsUsers && accountsUsers.length > 0) {
        const { error: notificationError } = await supabase.from('notifications').insert(
          accountsUsers.map((accountsUser) => ({
            user_id: accountsUser.id,
            organisation_id: user.organisation_id,
            type: 'invoice_rejected',
            title: 'Invoice rejected',
            message: `Invoice ${invoice.invoice_number} has been rejected`,
            link: `/invoice/${invoice.id}`,
            related_invoice_id: invoice.id,
          }))
        );

        if (notificationError) {
          console.error('Error creating notifications for Accounts users:', notificationError);
        }
      }

      // Create notification for uploader (if not same user and not already notified)
      const uploaderAlreadyNotified = accountsUsers?.some(u => u.id === invoice.uploaded_by_user_id);
      if (invoice.uploaded_by_user_id && invoice.uploaded_by_user_id !== user.id && !uploaderAlreadyNotified) {
        const { error: notificationError } = await supabase.from('notifications').insert({
          user_id: invoice.uploaded_by_user_id,
          organisation_id: user.organisation_id,
          type: 'invoice_rejected',
          title: 'Invoice rejected',
          message: `Invoice ${invoice.invoice_number} has been rejected: ${reason.trim().substring(0, 50)}${reason.trim().length > 50 ? '...' : ''}`,
          link: `/invoice/${invoice.id}`,
          related_invoice_id: invoice.id,
        });

        if (notificationError) {
          console.error('Error creating notification for uploader:', notificationError);
        }
      }

      toast({
        title: 'Invoice rejected',
        description: 'Invoice has been rejected',
      });

      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice', invoice.id] });
      onOpenChange(false);
      setReason('');
    } catch (error: any) {
      console.error('Error rejecting invoice:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to reject invoice',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject Invoice</DialogTitle>
          <DialogDescription>
            Please provide a reason for rejecting this invoice
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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
          </div>

          <div>
            <Label htmlFor="rejection-reason">Rejection Reason*</Label>
            <Textarea
              id="rejection-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Please explain why this invoice is being rejected..."
              rows={4}
              className="mt-1.5"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Minimum 10 characters ({reason.length}/10)
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleReject}
            disabled={loading || reason.trim().length < 10}
          >
            {loading ? 'Rejecting...' : 'Reject Invoice'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
