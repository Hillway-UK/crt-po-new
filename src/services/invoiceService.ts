import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';

interface UploadInvoiceParams {
  file: File;
  poId: string;
  contractorId: string;
  organisationId: string;
  invoiceNumber: string;
  invoiceDate: string;
  amountExVat: number;
  vatRate: number;
  hasMismatch: boolean;
  mismatchNotes?: string;
  userId: string;
}

interface UploadResult {
  success: boolean;
  invoiceId?: string;
  error?: string;
}

/**
 * Uploads an invoice file to storage
 */
async function uploadInvoiceFile(file: File): Promise<{ url: string; path: string } | null> {
  try {
    const fileName = `${Date.now()}_${file.name}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('po-documents')
      .upload(`invoices/${fileName}`, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('po-documents')
      .getPublicUrl(`invoices/${fileName}`);

    return { url: publicUrl, path: `invoices/${fileName}` };
  } catch (error) {
    console.error('Error uploading file:', error);
    return null;
  }
}

/**
 * Creates invoice record in database
 */
async function createInvoiceRecord(params: Omit<UploadInvoiceParams, 'file'> & { fileUrl: string; fileName: string }) {
  const { data: invoice, error: insertError } = await supabase
    .from('invoices')
    .insert({
      po_id: params.poId,
      contractor_id: params.contractorId,
      organisation_id: params.organisationId,
      invoice_number: params.invoiceNumber,
      invoice_date: params.invoiceDate,
      amount_ex_vat: params.amountExVat,
      vat_rate: params.vatRate,
      status: params.hasMismatch ? 'UPLOADED' : 'MATCHED',
      mismatch_notes: params.hasMismatch ? params.mismatchNotes : null,
      file_url: params.fileUrl,
      original_filename: params.fileName,
      uploaded_by_user_id: params.userId,
    })
    .select()
    .single();

  if (insertError) throw insertError;
  return invoice;
}

/**
 * Creates approval logs for the invoice
 */
async function createApprovalLogs(invoiceId: string, userId: string, hasMismatch: boolean) {
  await supabase.from('invoice_approval_logs').insert([
    {
      invoice_id: invoiceId,
      action_by_user_id: userId,
      action: 'UPLOADED',
    },
    ...(hasMismatch
      ? []
      : [
          {
            invoice_id: invoiceId,
            action_by_user_id: userId,
            action: 'MATCHED' as const,
          },
        ]),
  ]);
}

/**
 * Notifies accounts users about new invoice
 */
async function notifyAccountsUsers(
  invoiceId: string,
  organisationId: string,
  userId: string,
  invoiceNumber: string,
  poNumber: string,
  hasMismatch: boolean
) {
  const { data: accountsUsers, error: accountsUsersError } = await supabase
    .from('users')
    .select('id')
    .eq('organisation_id', organisationId)
    .in('role', ['ACCOUNTS', 'ADMIN'])
    .eq('is_active', true)
    .neq('id', userId);

  if (accountsUsersError) {
    console.error('Error fetching Accounts/ADMIN users:', accountsUsersError);
    return;
  }

  if (accountsUsers && accountsUsers.length > 0) {
    const { error: notificationError } = await supabase.from('notifications').insert(
      accountsUsers.map((accountsUser) => ({
        user_id: accountsUser.id,
        organisation_id: organisationId,
        type: 'invoice_uploaded',
        title: 'New invoice uploaded',
        message: `Invoice ${invoiceNumber} has been uploaded and ${hasMismatch ? 'needs matching' : 'matched'} to PO ${poNumber}`,
        link: `/invoices`,
        related_invoice_id: invoiceId,
      }))
    );

    if (notificationError) {
      console.error('Error creating notifications:', notificationError);
    }
  }
}

/**
 * Main function to upload and process an invoice
 */
export async function uploadInvoice(params: UploadInvoiceParams): Promise<UploadResult> {
  try {
    // Upload file
    const fileResult = await uploadInvoiceFile(params.file);
    if (!fileResult) {
      return {
        success: false,
        error: 'Failed to upload file',
      };
    }

    // Create invoice record
    const invoice = await createInvoiceRecord({
      ...params,
      fileUrl: fileResult.url,
      fileName: params.file.name,
    });

    // Create approval logs
    await createApprovalLogs(invoice.id, params.userId, params.hasMismatch);

    // Notify accounts users
    const poNumber = ''; // Will be passed from component
    await notifyAccountsUsers(
      invoice.id,
      params.organisationId,
      params.userId,
      params.invoiceNumber,
      poNumber,
      params.hasMismatch
    );

    return {
      success: true,
      invoiceId: invoice.id,
    };
  } catch (error: any) {
    console.error('Error uploading invoice:', error);
    return {
      success: false,
      error: error.message || 'Failed to upload invoice',
    };
  }
}

/**
 * Loads approved purchase orders for invoice matching
 */
export async function loadApprovedPOs() {
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
    return [];
  }

  return data || [];
}

/**
 * Validates invoice file
 */
export function validateInvoiceFile(file: File): { valid: boolean; error?: string } {
  if (file.type !== 'application/pdf') {
    return {
      valid: false,
      error: 'Please upload a PDF file',
    };
  }

  if (file.size > 10 * 1024 * 1024) {
    return {
      valid: false,
      error: 'Please upload a file smaller than 10MB',
    };
  }

  return { valid: true };
}
