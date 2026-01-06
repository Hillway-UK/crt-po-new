import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import type { PurchaseOrder } from '@/types';

interface InvoiceFormData {
  invoiceNumber: string;
  invoiceDate: string;
  amountExVat: string;
  vatRate: string;
  mismatchNotes: string;
}

interface InvoiceDetailsStepProps {
  pos: PurchaseOrder[];
  selectedPO: PurchaseOrder | null;
  formData: InvoiceFormData;
  onPOSelect: (po: PurchaseOrder | null) => void;
  onFormChange: (data: Partial<InvoiceFormData>) => void;
  onBack: () => void;
  onNext: () => void;
}

export function InvoiceDetailsStep({
  pos,
  selectedPO,
  formData,
  onPOSelect,
  onFormChange,
  onBack,
  onNext,
}: InvoiceDetailsStepProps) {
  const amountIncVat = formData.amountExVat
    ? Number(formData.amountExVat) * (1 + Number(formData.vatRate) / 100)
    : 0;

  const difference = selectedPO ? amountIncVat - (selectedPO.amount_inc_vat || 0) : 0;
  const hasMismatch = Math.abs(difference) > 0.01;

  const isValid =
    selectedPO &&
    formData.invoiceNumber &&
    formData.invoiceDate &&
    formData.amountExVat &&
    (!hasMismatch || formData.mismatchNotes.trim());

  return (
    <div className="space-y-4">
      <div>
        <Label>Select Purchase Order</Label>
        <Select
          value={selectedPO?.id || ''}
          onValueChange={(value) => {
            const po = pos.find((p) => p.id === value);
            onPOSelect(po || null);
            if (po) {
              onFormChange({ vatRate: String(po.vat_rate || 20) });
            }
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select PO..." />
          </SelectTrigger>
          <SelectContent>
            {pos.map((po) => (
              <SelectItem key={po.id} value={po.id}>
                {po.po_number} - {po.contractor?.name} - {formatCurrency(po.amount_inc_vat || 0)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedPO && (
        <div className="p-4 bg-muted rounded-lg space-y-2">
          <div className="flex justify-between">
            <span className="text-sm font-medium">PO Number:</span>
            <span className="text-sm">{selectedPO.po_number}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm font-medium">Contractor:</span>
            <span className="text-sm">{selectedPO.contractor?.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm font-medium">PO Amount:</span>
            <span className="text-sm">{formatCurrency(selectedPO.amount_inc_vat || 0)}</span>
          </div>
          {selectedPO.property && (
            <div className="flex justify-between">
              <span className="text-sm font-medium">Property:</span>
              <span className="text-sm">{selectedPO.property.name}</span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Invoice Number*</Label>
          <Input
            value={formData.invoiceNumber}
            onChange={(e) => onFormChange({ invoiceNumber: e.target.value })}
            required
          />
        </div>
        <div>
          <Label>Invoice Date*</Label>
          <Input
            type="date"
            value={formData.invoiceDate}
            onChange={(e) => onFormChange({ invoiceDate: e.target.value })}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Amount ex VAT*</Label>
          <Input
            type="number"
            step="0.01"
            value={formData.amountExVat}
            onChange={(e) => onFormChange({ amountExVat: e.target.value })}
            required
          />
        </div>
        <div>
          <Label>VAT Rate (%)</Label>
          <Input
            type="number"
            step="0.01"
            value={formData.vatRate}
            onChange={(e) => onFormChange({ vatRate: e.target.value })}
          />
        </div>
      </div>

      <div className="p-4 bg-muted rounded-lg">
        <div className="flex justify-between mb-2">
          <span className="text-sm font-medium">Amount inc VAT:</span>
          <span className="text-sm font-bold">{formatCurrency(amountIncVat)}</span>
        </div>
      </div>

      {selectedPO && formData.amountExVat && (
        <div
          className={`p-4 rounded-lg border ${
            hasMismatch ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'
          }`}
        >
          <div className="flex items-start gap-2">
            {hasMismatch ? (
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            ) : (
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p className="text-sm font-medium mb-2">
                {hasMismatch
                  ? `Invoice differs from PO by ${formatCurrency(Math.abs(difference))} (${(
                      (difference / (selectedPO.amount_inc_vat || 1)) *
                      100
                    ).toFixed(1)}%)`
                  : 'Amounts match'}
              </p>
              {hasMismatch && (
                <div>
                  <Label>Mismatch Notes*</Label>
                  <Textarea
                    value={formData.mismatchNotes}
                    onChange={(e) => onFormChange({ mismatchNotes: e.target.value })}
                    placeholder="Please explain the difference (e.g., variation order, additional works)"
                    rows={3}
                    required
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button onClick={onNext} disabled={!isValid} className="flex-1">
          Next
        </Button>
      </div>
    </div>
  );
}
