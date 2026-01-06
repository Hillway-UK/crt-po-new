import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { loadApprovedPOs } from '@/services/invoiceService';
import { useInvoiceUpload } from '@/hooks/useInvoiceUpload';
import { InvoiceFileUploadStep } from './steps/InvoiceFileUploadStep';
import { InvoiceDetailsStep } from './steps/InvoiceDetailsStep';
import { InvoiceConfirmationStep } from './steps/InvoiceConfirmationStep';
import type { PurchaseOrder } from '@/types';

interface UploadInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UploadInvoiceDialog({ open, onOpenChange }: UploadInvoiceDialogProps) {
  const { loading, submitInvoice } = useInvoiceUpload();
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [pos, setPos] = useState<PurchaseOrder[]>([]);

  const [formData, setFormData] = useState({
    invoiceNumber: '',
    invoiceDate: '',
    amountExVat: '',
    vatRate: '20',
    mismatchNotes: '',
  });

  const amountIncVat = formData.amountExVat
    ? Number(formData.amountExVat) * (1 + Number(formData.vatRate) / 100)
    : 0;

  const difference = selectedPO ? amountIncVat - (selectedPO.amount_inc_vat || 0) : 0;
  const hasMismatch = Math.abs(difference) > 0.01;

  useEffect(() => {
    if (open) {
      loadPOs();
    }
  }, [open]);

  async function loadPOs() {
    const data = await loadApprovedPOs();
    setPos(data);
  }

  const handleSubmit = async () => {
    if (!file || !selectedPO) return;

    const success = await submitInvoice(file, selectedPO, formData, hasMismatch);
    if (success) {
      onOpenChange(false);
      resetForm();
    }
  };

  function resetForm() {
    setStep(1);
    setFile(null);
    setSelectedPO(null);
    setFormData({
      invoiceNumber: '',
      invoiceDate: '',
      amountExVat: '',
      vatRate: '20',
      mismatchNotes: '',
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload Invoice</DialogTitle>
          <DialogDescription>
            Step {step} of 3: {step === 1 ? 'Upload File' : step === 2 ? 'Match to PO' : 'Confirm'}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <InvoiceFileUploadStep
            file={file}
            onFileSelected={setFile}
            onNext={() => setStep(2)}
          />
        )}

        {step === 2 && (
          <InvoiceDetailsStep
            pos={pos}
            selectedPO={selectedPO}
            formData={formData}
            onPOSelect={setSelectedPO}
            onFormChange={(data) => setFormData((prev) => ({ ...prev, ...data }))}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        )}

        {step === 3 && file && selectedPO && (
          <InvoiceConfirmationStep
            file={file}
            selectedPO={selectedPO}
            formData={formData}
            loading={loading}
            onBack={() => setStep(2)}
            onSubmit={handleSubmit}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
