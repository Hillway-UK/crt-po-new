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
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/formatters';
import type { Invoice } from '@/types';

interface MarkAsPaidDialogProps {
  invoice: Invoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MarkAsPaidDialog({ invoice, open, onOpenChange }: MarkAsPaidDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentReference, setPaymentReference] = useState('');

  async function handleMarkAsPaid() {
    if (!invoice || !user || !paymentDate) return;

    setLoading(true);

    try {
      const { error: updateError } = await supabase
        .from('invoices')
        .update({
          status: 'PAID',
          payment_date: paymentDate,
          payment_reference: paymentReference.trim() || null,
        })
        .eq('id', invoice.id);

      if (updateError) throw updateError;

      const { error: logError } = await supabase.from('invoice_approval_logs').insert({
        invoice_id: invoice.id,
        action_by_user_id: user.id,
        action: 'MARKED_PAID',
        comment: paymentReference.trim() || null,
      });

      if (logError) throw logError;

      toast({
        title: 'Invoice marked as paid',
        description: 'Invoice has been marked as paid',
      });

      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice', invoice.id] });
      onOpenChange(false);
      setPaymentReference('');
    } catch (error: any) {
      console.error('Error marking invoice as paid:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to mark invoice as paid',
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
          <DialogTitle>Mark Invoice as Paid</DialogTitle>
          <DialogDescription>Record payment details for this invoice</DialogDescription>
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
            <Label htmlFor="payment-date">Payment Date*</Label>
            <Input
              id="payment-date"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="payment-reference">Payment Reference</Label>
            <Input
              id="payment-reference"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              placeholder="e.g., Bank transfer ref, cheque number"
              className="mt-1.5"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleMarkAsPaid} disabled={loading || !paymentDate}>
            {loading ? 'Marking as Paid...' : 'Mark as Paid'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
