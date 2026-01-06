import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { uploadInvoice } from '@/services/invoiceService';
import { toast } from '@/components/ui/use-toast';
import type { PurchaseOrder } from '@/types';

interface InvoiceFormData {
  invoiceNumber: string;
  invoiceDate: string;
  amountExVat: string;
  vatRate: string;
  mismatchNotes: string;
}

/**
 * Hook for managing invoice upload state and operations
 */
export function useInvoiceUpload() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const submitInvoice = async (
    file: File,
    selectedPO: PurchaseOrder,
    formData: InvoiceFormData,
    hasMismatch: boolean
  ) => {
    if (!user) return false;

    if (hasMismatch && !formData.mismatchNotes.trim()) {
      toast({
        title: 'Mismatch notes required',
        description: 'Please explain the difference between PO and invoice amounts',
        variant: 'destructive',
      });
      return false;
    }

    setLoading(true);

    try {
      const result = await uploadInvoice({
        file,
        poId: selectedPO.id,
        contractorId: selectedPO.contractor_id,
        organisationId: user.organisation_id,
        invoiceNumber: formData.invoiceNumber,
        invoiceDate: formData.invoiceDate,
        amountExVat: Number(formData.amountExVat),
        vatRate: Number(formData.vatRate),
        hasMismatch,
        mismatchNotes: formData.mismatchNotes,
        userId: user.id,
      });

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Invoice uploaded successfully',
        });

        queryClient.invalidateQueries({ queryKey: ['invoices'] });
        return true;
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to upload invoice',
          variant: 'destructive',
        });
        return false;
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to upload invoice',
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    submitInvoice,
  };
}
