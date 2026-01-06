import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/formatters';
import type { PurchaseOrder } from '@/types';

interface InvoiceFormData {
  invoiceNumber: string;
  invoiceDate: string;
  amountExVat: string;
  vatRate: string;
  mismatchNotes: string;
}

interface InvoiceConfirmationStepProps {
  file: File;
  selectedPO: PurchaseOrder;
  formData: InvoiceFormData;
  loading: boolean;
  onBack: () => void;
  onSubmit: () => void;
}

export function InvoiceConfirmationStep({
  file,
  selectedPO,
  formData,
  loading,
  onBack,
  onSubmit,
}: InvoiceConfirmationStepProps) {
  const amountIncVat = Number(formData.amountExVat) * (1 + Number(formData.vatRate) / 100);

  return (
    <div className="space-y-4">
      <div className="p-4 bg-muted rounded-lg space-y-3">
        <h3 className="font-medium">Invoice Summary</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Invoice Number:</span>
            <span className="font-medium">{formData.invoiceNumber}</span>
          </div>
          <div className="flex justify-between">
            <span>Invoice Date:</span>
            <span className="font-medium">{formData.invoiceDate}</span>
          </div>
          <div className="flex justify-between">
            <span>PO Number:</span>
            <span className="font-medium">{selectedPO.po_number}</span>
          </div>
          <div className="flex justify-between">
            <span>Contractor:</span>
            <span className="font-medium">{selectedPO.contractor?.name}</span>
          </div>
          <div className="flex justify-between">
            <span>Amount ex VAT:</span>
            <span className="font-medium">{formatCurrency(Number(formData.amountExVat))}</span>
          </div>
          <div className="flex justify-between">
            <span>VAT @ {formData.vatRate}%:</span>
            <span className="font-medium">
              {formatCurrency(amountIncVat - Number(formData.amountExVat))}
            </span>
          </div>
          <div className="flex justify-between pt-2 border-t">
            <span className="font-medium">Total:</span>
            <span className="font-bold text-lg">{formatCurrency(amountIncVat)}</span>
          </div>
        </div>
        <div className="pt-2 border-t">
          <span className="text-sm">File: {file.name}</span>
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button onClick={onSubmit} disabled={loading} className="flex-1">
          {loading ? 'Uploading...' : 'Submit Invoice'}
        </Button>
      </div>
    </div>
  );
}
