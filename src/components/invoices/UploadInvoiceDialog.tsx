import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Upload, AlertCircle, CheckCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import type { PurchaseOrder } from '@/types';

interface UploadInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UploadInvoiceDialog({ open, onOpenChange }: UploadInvoiceDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(false);

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

  const difference = selectedPO
    ? amountIncVat - (selectedPO.amount_inc_vat || 0)
    : 0;

  const hasMismatch = Math.abs(difference) > 0.01;

  // Load approved POs when dialog opens
  useEffect(() => {
    if (open) {
      loadApprovedPOs();
    }
  }, [open]);

  async function loadApprovedPOs() {
    const { data, error } = await supabase
      .from('purchase_orders')
      .select('*, contractor:contractors(*), property:properties(*)')
      .eq('status', 'APPROVED')
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to load purchase orders',
        variant: 'destructive',
      });
      return;
    }

    setPos(data || []);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') {
        toast({
          title: 'Invalid file type',
          description: 'Please upload a PDF file',
          variant: 'destructive',
        });
        return;
      }
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Please upload a file smaller than 10MB',
          variant: 'destructive',
        });
        return;
      }
      setFile(selectedFile);
    }
  }

  async function handleSubmit() {
    if (!file || !selectedPO || !user) return;

    if (hasMismatch && !formData.mismatchNotes.trim()) {
      toast({
        title: 'Mismatch notes required',
        description: 'Please explain the difference between PO and invoice amounts',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      // Upload PDF to storage
      const fileName = `${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('po-documents')
        .upload(`invoices/${fileName}`, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('po-documents')
        .getPublicUrl(`invoices/${fileName}`);

      // Insert invoice record
      const { data: invoice, error: insertError } = await supabase
        .from('invoices')
        .insert({
          po_id: selectedPO.id,
          contractor_id: selectedPO.contractor_id,
          organisation_id: user.organisation_id,
          invoice_number: formData.invoiceNumber,
          invoice_date: formData.invoiceDate,
          amount_ex_vat: Number(formData.amountExVat),
          vat_rate: Number(formData.vatRate),
          status: hasMismatch ? 'UPLOADED' : 'MATCHED',
          mismatch_notes: hasMismatch ? formData.mismatchNotes : null,
          file_url: publicUrl,
          original_filename: file.name,
          uploaded_by_user_id: user.id,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Create approval logs
      await supabase.from('invoice_approval_logs').insert([
        {
          invoice_id: invoice.id,
          action_by_user_id: user.id,
          action: 'UPLOADED',
        },
        ...(hasMismatch
          ? []
          : [
              {
                invoice_id: invoice.id,
                action_by_user_id: user.id,
                action: 'MATCHED' as const,
              },
            ]),
      ]);

      // Create notification for Accounts users (exclude self)
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

      if (accountsUsers && accountsUsers.length > 0) {
        const { error: notificationError } = await supabase.from('notifications').insert(
          accountsUsers.map((accountsUser) => ({
            user_id: accountsUser.id,
            organisation_id: user.organisation_id,
            type: 'invoice_uploaded',
            title: 'New invoice uploaded',
            message: `Invoice ${formData.invoiceNumber} has been uploaded and ${hasMismatch ? 'needs matching' : 'matched'} to PO ${selectedPO.po_number}`,
            link: `/invoices`,
            related_invoice_id: invoice.id,
          }))
        );

        if (notificationError) {
          console.error('Error creating notifications:', notificationError);
        }
      }

      toast({
        title: 'Success',
        description: 'Invoice uploaded successfully',
      });

      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      console.error('Error uploading invoice:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to upload invoice',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

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
          <div className="space-y-4">
            <div
              className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer"
              onClick={() => document.getElementById('file-upload')?.click()}
            >
              <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-2">
                Drag invoice PDF here or click to browse
              </p>
              <p className="text-xs text-muted-foreground">PDF only, max 10MB</p>
              <input
                id="file-upload"
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {file && (
              <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
            )}

            <Button onClick={() => setStep(2)} disabled={!file} className="w-full">
              Next
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <Label>Select Purchase Order</Label>
              <Select
                value={selectedPO?.id || ''}
                onValueChange={(value) => {
                  const po = pos.find((p) => p.id === value);
                  setSelectedPO(po || null);
                  if (po) {
                    setFormData((prev) => ({
                      ...prev,
                      vatRate: String(po.vat_rate || 20),
                    }));
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select PO..." />
                </SelectTrigger>
                <SelectContent>
                  {pos.map((po) => (
                    <SelectItem key={po.id} value={po.id}>
                      {po.po_number} - {po.contractor?.name} -{' '}
                      {formatCurrency(po.amount_inc_vat || 0)}
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
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, invoiceNumber: e.target.value }))
                  }
                  required
                />
              </div>
              <div>
                <Label>Invoice Date*</Label>
                <Input
                  type="date"
                  value={formData.invoiceDate}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, invoiceDate: e.target.value }))
                  }
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
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, amountExVat: e.target.value }))
                  }
                  required
                />
              </div>
              <div>
                <Label>VAT Rate (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.vatRate}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, vatRate: e.target.value }))
                  }
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
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, mismatchNotes: e.target.value }))
                          }
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
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                Back
              </Button>
              <Button
                onClick={() => setStep(3)}
                disabled={
                  !selectedPO ||
                  !formData.invoiceNumber ||
                  !formData.invoiceDate ||
                  !formData.amountExVat ||
                  (hasMismatch && !formData.mismatchNotes.trim())
                }
                className="flex-1"
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
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
                  <span className="font-medium">{selectedPO?.po_number}</span>
                </div>
                <div className="flex justify-between">
                  <span>Contractor:</span>
                  <span className="font-medium">{selectedPO?.contractor?.name}</span>
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
              {file && (
                <div className="pt-2 border-t">
                  <span className="text-sm">File: {file.name}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                Back
              </Button>
              <Button onClick={handleSubmit} disabled={loading} className="flex-1">
                {loading ? 'Uploading...' : 'Submit Invoice'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
