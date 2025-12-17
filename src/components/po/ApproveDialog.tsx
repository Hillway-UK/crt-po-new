import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/formatters';
import { CheckCircle, Loader2 } from 'lucide-react';
import { PurchaseOrder } from '@/types';

interface ApproveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  po: PurchaseOrder;
  onConfirm: () => Promise<void>;
}

export function ApproveDialog({ open, onOpenChange, po, onConfirm }: ApproveDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (error) {
      console.error('Approval failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <DialogTitle>Approve Purchase Order</DialogTitle>
              <DialogDescription>Confirm approval of this PO</DialogDescription>
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
              <span className="font-bold text-lg text-primary">
                {formatCurrency(Number(po.amount_inc_vat))}
              </span>
            </div>
          </div>

          <div className="text-sm text-muted-foreground space-y-2">
            <p>Upon approval, the system will:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Generate a professional PDF document</li>
              <li>Email the PO to the contractor</li>
              <li>Notify the accounts team</li>
              <li>Log the approval action</li>
            </ul>
          </div>
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
            onClick={handleConfirm}
            disabled={loading}
            className="bg-green-600 hover:bg-green-700"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Approving...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Approve PO
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
