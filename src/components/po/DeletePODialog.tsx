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
import { PurchaseOrder } from '@/types';
import { formatCurrency } from '@/lib/formatters';

interface DeletePODialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  po: PurchaseOrder;
  onConfirm: () => void;
}

export function DeletePODialog({ open, onOpenChange, po, onConfirm }: DeletePODialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel Purchase Order?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              Are you sure you want to cancel this purchase order? This action will archive the PO
              and it will no longer be active.
            </p>
            <div className="bg-muted p-3 rounded-md space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">PO Number:</span>
                <span className="font-mono">{po.po_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Contractor:</span>
                <span>{po.contractor?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Amount:</span>
                <span className="font-semibold">{formatCurrency(Number(po.amount_inc_vat))}</span>
              </div>
            </div>
            <p className="text-muted-foreground text-xs">
              Note: The PO will be marked as cancelled but will remain in the system for record keeping.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep Purchase Order</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Cancel Purchase Order
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
