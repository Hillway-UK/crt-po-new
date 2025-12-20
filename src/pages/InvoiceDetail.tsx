import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDelegation } from '@/hooks/useDelegation';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, FileText, Download, CheckCircle, X, Send } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { InvoiceStatusBadge } from '@/components/invoices/InvoiceStatusBadge';
import { ApproveInvoiceDialog } from '@/components/invoices/ApproveInvoiceDialog';
import { RejectInvoiceDialog } from '@/components/invoices/RejectInvoiceDialog';
import { MarkAsPaidDialog } from '@/components/invoices/MarkAsPaidDialog';
import { downloadStorageFile, getSignedUrl } from '@/lib/storage';
import { toast } from 'sonner';
import type { Invoice } from '@/types';

export default function InvoiceDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [paidDialogOpen, setPaidDialogOpen] = useState(false);
  const [sendingForApproval, setSendingForApproval] = useState(false);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);
  const [downloadingPO, setDownloadingPO] = useState(false);
  const [viewingPO, setViewingPO] = useState(false);

  const handleViewPOPdf = async () => {
    if (!invoice?.purchase_order?.pdf_url) return;
    setViewingPO(true);
    try {
      const signedUrl = await getSignedUrl(invoice.purchase_order.pdf_url);
      if (signedUrl) {
        window.open(signedUrl, '_blank');
      } else {
        toast.error('Failed to get PDF URL');
      }
    } catch (error) {
      console.error('View failed:', error);
      toast.error('Failed to view PO PDF');
    } finally {
      setViewingPO(false);
    }
  };

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select(
          `
          *,
          contractor:contractors(*),
          purchase_order:purchase_orders(*),
          uploaded_by:users!invoices_uploaded_by_user_id_fkey(*),
          approved_by:users!invoices_approved_by_user_id_fkey(*)
        `
        )
        .eq('id', id!)
        .single();

      if (error) throw error;
      return data as Invoice;
    },
    enabled: !!id,
  });

  const { data: approvalLogs } = useQuery({
    queryKey: ['invoice-approval-logs', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoice_approval_logs')
        .select('*, action_by:users(*)')
        .eq('invoice_id', id!)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { isActiveDelegate } = useDelegation();
  
  const isMD = user?.role === 'MD';
  const isAccounts = user?.role === 'ACCOUNTS' || user?.role === 'ADMIN';
  const userIsActiveDelegate = user?.id ? isActiveDelegate(user.id) : false;
  const canApprove = (isMD || userIsActiveDelegate) && invoice?.status === 'PENDING_MD_APPROVAL';
  const canMarkPaid = isAccounts && invoice?.status === 'APPROVED_FOR_PAYMENT';
  const canSendForApproval = isAccounts && invoice?.status === 'MATCHED';

  const handleDownloadInvoice = async () => {
    if (!invoice?.file_url) return;
    
    setDownloadingInvoice(true);
    try {
      const poNumber = invoice.purchase_order?.po_number;
      const filename = poNumber 
        ? `${poNumber}_${invoice.invoice_number}.pdf`
        : `${invoice.invoice_number}.pdf`;
      
      await downloadStorageFile(invoice.file_url, filename);
      toast.success('Invoice downloaded successfully');
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Failed to download invoice');
    } finally {
      setDownloadingInvoice(false);
    }
  };

  const handleDownloadPO = async () => {
    if (!invoice?.purchase_order?.pdf_url) return;
    
    setDownloadingPO(true);
    try {
      const filename = `${invoice.purchase_order.po_number}.pdf`;
      await downloadStorageFile(invoice.purchase_order.pdf_url, filename);
      toast.success('PO downloaded successfully');
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Failed to download PO');
    } finally {
      setDownloadingPO(false);
    }
  };

  const handleSendForApproval = async () => {
    if (!invoice || !user) return;

    setSendingForApproval(true);
    try {
      // Update invoice status to PENDING_MD_APPROVAL
      const { error: updateError } = await supabase
        .from('invoices')
        .update({ status: 'PENDING_MD_APPROVAL' })
        .eq('id', invoice.id);

      if (updateError) throw updateError;

      // Log the action
      await supabase.from('invoice_approval_logs').insert({
        invoice_id: invoice.id,
        action_by_user_id: user.id,
        action: 'SENT_FOR_MD_APPROVAL',
      });

      // Send email notification to MD (with detailed logging)
      supabase.functions.invoke('send-email', {
        body: {
          type: 'invoice_needs_approval',
          invoice_id: invoice.id,
        },
      }).then((response) => {
        if (response.error) {
          console.error('Email notification error:', response.error);
        } else {
          console.log('Invoice approval email sent successfully:', response.data);
        }
      }).catch((err) => {
        console.error('Email notification failed:', err);
      });

      // Get MD and ADMIN users (exclude self)
      const { data: mdUsers, error: mdUsersError } = await supabase
        .from('users')
        .select('id')
        .eq('organisation_id', user.organisation_id)
        .in('role', ['MD', 'ADMIN'])
        .eq('is_active', true)
        .neq('id', user.id);

      if (mdUsersError) {
        console.error('Error fetching MD/ADMIN users:', mdUsersError);
      }

      // Get active delegates for MD users
      const { data: activeDelegations } = await supabase
        .from('approval_delegations')
        .select('delegate_user_id, starts_at, ends_at')
        .in('delegator_user_id', (mdUsers || []).map(u => u.id))
        .eq('scope', 'PO_APPROVAL')
        .eq('is_active', true);

      // Filter for currently active delegations
      const now = new Date();
      const activeDelegateIds = (activeDelegations || [])
        .filter(d => {
          const startsAt = d.starts_at ? new Date(d.starts_at) : null;
          const endsAt = d.ends_at ? new Date(d.ends_at) : null;
          return (!startsAt || now >= startsAt) && (!endsAt || now <= endsAt);
        })
        .map(d => d.delegate_user_id)
        .filter(id => id !== user.id); // Exclude self

      // Combine MD/ADMIN users with active delegates (deduplicated)
      const allRecipientIds = [...new Set([
        ...(mdUsers || []).map(u => u.id),
        ...activeDelegateIds
      ])];

      if (allRecipientIds.length > 0) {
        const { error: notificationError } = await supabase.from('notifications').insert(
          allRecipientIds.map((recipientId) => ({
            user_id: recipientId,
            organisation_id: user.organisation_id,
            type: 'invoice_pending_approval',
            title: 'Invoice needs approval',
            message: `Invoice ${invoice.invoice_number} is ready for your approval`,
            link: `/invoice/${invoice.id}`,
            related_invoice_id: invoice.id,
          }))
        );

        if (notificationError) {
          console.error('Error creating notifications:', notificationError);
        }
      }

      toast.success('Invoice sent for MD approval');
      queryClient.invalidateQueries({ queryKey: ['invoice', invoice.id] });
      queryClient.invalidateQueries({ queryKey: ['invoice-approval-logs', invoice.id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    } catch (error) {
      console.error('Failed to send for approval:', error);
      toast.error('Failed to send invoice for approval');
    } finally {
      setSendingForApproval(false);
    }
  };

  if (isLoading) {
    return (
      <MainLayout title="Invoice Detail">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading invoice...</p>
        </div>
      </MainLayout>
    );
  }

  if (!invoice) {
    return (
      <MainLayout title="Invoice Detail">
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <p className="text-muted-foreground">Invoice not found</p>
          <Button asChild>
            <Link to="/invoices">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Invoices
            </Link>
          </Button>
        </div>
      </MainLayout>
    );
  }

  const poAmountMatch = Math.abs(
    (invoice.amount_inc_vat || 0) - (invoice.purchase_order?.amount_inc_vat || 0)
  );
  const amountsMatch = poAmountMatch < 0.01;

  return (
    <MainLayout title={`Invoice ${invoice.invoice_number}`}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link to="/invoices">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Link>
            </Button>
            <div>
              <h2 className="text-3xl font-bold text-foreground">
                Invoice {invoice.invoice_number}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <InvoiceStatusBadge status={invoice.status || 'UPLOADED'} />
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            {invoice.file_url && (
              <>
                <Button variant="outline" asChild>
                  <a href={invoice.file_url} target="_blank" rel="noopener noreferrer">
                    <FileText className="mr-2 h-4 w-4" />
                    View PDF
                  </a>
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleDownloadInvoice}
                  disabled={downloadingInvoice}
                >
                  <Download className="mr-2 h-4 w-4" />
                  {downloadingInvoice ? 'Downloading...' : 'Download'}
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Invoice Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <span className="text-sm text-muted-foreground">Invoice Number</span>
                <p className="font-mono font-medium">{invoice.invoice_number}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Invoice Date</span>
                <p className="font-medium">{formatDate(invoice.invoice_date)}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Contractor</span>
                <p className="font-medium">{invoice.contractor?.name}</p>
              </div>
              <Separator />
              <div>
                <span className="text-sm text-muted-foreground">Amount ex VAT</span>
                <p className="font-medium">{formatCurrency(invoice.amount_ex_vat)}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">
                  VAT @ {invoice.vat_rate || 20}%
                </span>
                <p className="font-medium">
                  {formatCurrency(
                    (invoice.amount_inc_vat || 0) - invoice.amount_ex_vat
                  )}
                </p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Total Amount</span>
                <p className="text-xl font-bold">{formatCurrency(invoice.amount_inc_vat || 0)}</p>
              </div>
              <Separator />
              <div>
                <span className="text-sm text-muted-foreground">Uploaded by</span>
                <p className="font-medium">
                  {invoice.uploaded_by?.full_name} on {formatDate(invoice.created_at)}
                </p>
              </div>
              {invoice.payment_date && (
                <>
                  <div>
                    <span className="text-sm text-muted-foreground">Payment Date</span>
                    <p className="font-medium">{formatDate(invoice.payment_date)}</p>
                  </div>
                  {invoice.payment_reference && (
                    <div>
                      <span className="text-sm text-muted-foreground">Payment Reference</span>
                      <p className="font-medium">{invoice.payment_reference}</p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Purchase Order Comparison</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {invoice.purchase_order ? (
                <>
                  <div>
                    <span className="text-sm text-muted-foreground">PO Number</span>
                    <p className="font-mono font-medium">
                   <Link
                        to={`/pos/${invoice.purchase_order.id}`}
                        className="text-primary hover:underline"
                      >
                        {invoice.purchase_order.po_number}
                      </Link>
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">PO Amount</span>
                    <p className="font-medium">
                      {formatCurrency(invoice.purchase_order.amount_inc_vat || 0)}
                    </p>
                  </div>
                  {invoice.purchase_order.pdf_url && (
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleViewPOPdf}
                        disabled={viewingPO}
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        {viewingPO ? 'Opening...' : 'View PO PDF'}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleDownloadPO}
                        disabled={downloadingPO}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        {downloadingPO ? 'Downloading...' : 'Download PO'}
                      </Button>
                    </div>
                  )}
                  <Separator />
                  <div
                    className={`p-4 rounded-lg border ${
                      amountsMatch
                        ? 'bg-green-50 border-green-200'
                        : 'bg-amber-50 border-amber-200'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {amountsMatch ? (
                        <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      ) : (
                        <X className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-medium mb-1">
                          {amountsMatch
                            ? 'Amounts match'
                            : `Difference: ${formatCurrency(Math.abs(poAmountMatch))}`}
                        </p>
                        {!amountsMatch && invoice.mismatch_notes && (
                          <p className="text-sm text-muted-foreground">{invoice.mismatch_notes}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  {invoice.rejection_reason && (
                    <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                      <p className="text-sm font-medium text-red-900 mb-1">Rejection Reason</p>
                      <p className="text-sm text-red-700">{invoice.rejection_reason}</p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground">No PO linked to this invoice</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              {canSendForApproval && (
                <Button onClick={handleSendForApproval} disabled={sendingForApproval}>
                  <Send className="mr-2 h-4 w-4" />
                  {sendingForApproval ? 'Sending...' : 'Send for Approval'}
                </Button>
              )}
              {canApprove && (
                <>
                  <Button onClick={() => setApproveDialogOpen(true)}>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Approve for Payment
                  </Button>
                  <Button variant="destructive" onClick={() => setRejectDialogOpen(true)}>
                    <X className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                </>
              )}
              {canMarkPaid && (
                <Button onClick={() => setPaidDialogOpen(true)}>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Mark as Paid
                </Button>
              )}
              {!canApprove && !canMarkPaid && !canSendForApproval && (
                <p className="text-sm text-muted-foreground">No actions available</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Approval History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {approvalLogs?.map((log) => (
                <div key={log.id} className="flex gap-4">
                  <div className="flex-shrink-0 w-2 h-2 rounded-full bg-primary mt-2" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{log.action}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(log.created_at)}
                      </span>
                    </div>
                    <p className="text-sm mt-1">
                      By {log.action_by?.full_name || 'Unknown User'}
                    </p>
                    {log.comment && <p className="text-sm text-muted-foreground mt-1">{log.comment}</p>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <ApproveInvoiceDialog
        invoice={invoice}
        open={approveDialogOpen}
        onOpenChange={setApproveDialogOpen}
      />
      <RejectInvoiceDialog
        invoice={invoice}
        open={rejectDialogOpen}
        onOpenChange={setRejectDialogOpen}
      />
      <MarkAsPaidDialog invoice={invoice} open={paidDialogOpen} onOpenChange={setPaidDialogOpen} />
    </MainLayout>
  );
}
