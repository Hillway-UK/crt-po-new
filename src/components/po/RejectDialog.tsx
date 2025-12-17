import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatCurrency } from '@/lib/formatters';
import { XCircle, Loader2, AlertTriangle } from 'lucide-react';
import { PurchaseOrder } from '@/types';

interface RejectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  po: PurchaseOrder;
  onConfirm: (reason: string) => Promise<void>;
}

export function RejectDialog({ open, onOpenChange, po, onConfirm }: RejectDialogProps) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    if (reason.trim().length < 10) {
      setError('Rejection reason must be at least 10 characters');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await onConfirm(reason);
      onOpenChange(false);
      setReason('');
    } catch (error) {
      console.error('Rejection failed:', error);
      setError('Failed to reject PO. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      onOpenChange(open);
      if (!open) {
        setReason('');
        setError('');
      }
    }}>
      <DialogContent className="bg-card max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
              <XCircle className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <DialogTitle>Reject Purchase Order</DialogTitle>
              <DialogDescription>Provide a reason for rejection</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">PO Number:</span>
              <span className="font-mono font-semibold">{po.po_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Contractor:</span>
              <span className="font-semibold">{po.contractor?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount:</span>
              <span className="font-bold text-lg">
                {formatCurrency(Number(po.amount_inc_vat))}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rejection_reason">
              Rejection Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="rejection_reason"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setError('');
              }}
              rows={4}
              placeholder="Explain why this PO is being rejected (minimum 10 characters)..."
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {reason.length} / 10 characters minimum
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              The property manager will be notified via email with your rejection reason.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button 
            variant="destructive"
            onClick={handleConfirm}
            disabled={loading || reason.trim().length < 10}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Rejecting...
              </>
            ) : (
              <>
                <XCircle className="mr-2 h-4 w-4" />
                Reject PO
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
