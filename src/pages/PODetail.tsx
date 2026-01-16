import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { PurchaseOrder, POApprovalLog, POStatus } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useApprovalWorkflow } from '@/hooks/useApprovalWorkflow';
import { useDelegation } from '@/hooks/useDelegation';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/formatters';
import { downloadStorageFile } from '@/lib/storage';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Edit, Trash2, Send, FileText, AlertTriangle, Download, Mail, Eye } from 'lucide-react';
import { ApproveDialog } from '@/components/po/ApproveDialog';
import { RejectDialog } from '@/components/po/RejectDialog';
import { DeletePODialog } from '@/components/po/DeletePODialog';
import { PDFViewerDialog } from '@/components/po/PDFViewerDialog';
import { usePOApproval } from '@/hooks/usePOApproval';

export default function PODetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { approve, reject, isProcessing } = usePOApproval();
  const { isActiveDelegate } = useDelegation();
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [approvalLogs, setApprovalLogs] = useState<POApprovalLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (id) {
      fetchPO();
      fetchApprovalLogs();
    }
  }, [id]);

  const fetchPO = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          contractor:contractors(*),
          property:properties(*),
          created_by:users!created_by_user_id(*),
          approved_by:users!approved_by_user_id(*)
        `)
        .eq('id', id!)
        .single();

      if (error) throw error;
      setPo(data as any);
    } catch (error) {
      toast.error('Failed to load purchase order');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchApprovalLogs = async () => {
    const { data } = await supabase
      .from('po_approval_logs')
      .select(`
        *,
        action_by:users!action_by_user_id(*),
        approved_on_behalf_of:users!approved_on_behalf_of_user_id(*)
      `)
      .eq('po_id', id!)
      .order('created_at', { ascending: false });

    setApprovalLogs(data as any || []);
  };

  const handleApprove = async () => {
    if (!po) return;

    await approve(po, () => {
      fetchPO();
      fetchApprovalLogs();
      setApproveDialogOpen(false);
    });
  };

  const handleReject = async (reason: string) => {
    if (!po) return;

    await reject(po, reason, () => {
      fetchPO();
      fetchApprovalLogs();
      setRejectDialogOpen(false);
    });
  };

  const handleDelete = async () => {
    if (!po || !user) return;

    setProcessing(true);
    try {
      const { error: updateError } = await supabase
        .from('purchase_orders')
        .update({
          status: 'CANCELLED',
        })
        .eq('id', po.id);

      if (updateError) throw updateError;

      toast.success('Purchase order cancelled successfully');
      navigate('/pos');
    } catch (error) {
      toast.error('Failed to cancel purchase order');
      console.error(error);
    } finally {
      setProcessing(false);
      setDeleteDialogOpen(false);
    }
  };

  const handleRegeneratePDF = async () => {
    if (!po) return;

    toast.loading('Generating PDF...', { id: 'pdf-gen' });
    try {
      const { data, error } = await supabase.functions.invoke('generate-po-pdf', {
        body: { po_id: po.id }
      });

      if (error) throw error;

      toast.success('PDF generated successfully', { id: 'pdf-gen' });
      fetchPO();
    } catch (error) {
      toast.error('Failed to generate PDF', { id: 'pdf-gen' });
      console.error(error);
    }
  };

  const handleResendEmail = async () => {
    if (!po) return;

    toast.loading('Sending email...', { id: 'email-send' });
    try {
      await supabase.functions.invoke('send-email', {
        body: { type: 'po_approved_contractor', po_id: po.id }
      });

      toast.success('Email sent to contractor', { id: 'email-send' });
    } catch (error) {
      toast.error('Failed to send email', { id: 'email-send' });
      console.error(error);
    }
  };

  const getStatusBadge = (status: POStatus) => {
    const variants: Record<POStatus, { label: string; className: string }> = {
      DRAFT: { label: 'Draft', className: 'bg-gray-100 text-gray-700 text-lg px-4 py-1' },
      PENDING_PM_APPROVAL: { label: 'Pending PM Approval', className: 'bg-blue-100 text-blue-700 text-lg px-4 py-1' },
      PENDING_MD_APPROVAL: { label: 'Pending MD Approval', className: 'bg-amber-100 text-amber-700 text-lg px-4 py-1' },
      PENDING_CEO_APPROVAL: { label: 'Pending CEO Approval', className: 'bg-orange-100 text-orange-700 text-lg px-4 py-1' },
      APPROVED: { label: 'Approved', className: 'bg-green-100 text-green-700 text-lg px-4 py-1' },
      REJECTED: { label: 'Rejected', className: 'bg-red-100 text-red-700 text-lg px-4 py-1' },
      CANCELLED: { label: 'Cancelled', className: 'bg-gray-100 text-gray-500 text-lg px-4 py-1' },
    };

    const variant = variants[status];
    return <Badge className={variant.className}>{variant.label}</Badge>;
  };

  if (loading) {
    return (
      <MainLayout title="Purchase Order">
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      </MainLayout>
    );
  }

  if (!po) {
    return (
      <MainLayout title="Purchase Order">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Purchase order not found</p>
          <Button onClick={() => navigate('/pos')} className="mt-4">
            Back to Purchase Orders
          </Button>
        </div>
      </MainLayout>
    );
  }

  const canEdit = (po.status === 'DRAFT' || po.status === 'REJECTED') && po.created_by_user_id === user?.id;
  const userIsDelegate = isActiveDelegate(user?.id || '');
  const canApprove = 
    (po.status === 'PENDING_PM_APPROVAL' && (user?.role === 'PROPERTY_MANAGER' || user?.role === 'MD' || user?.role === 'CEO' || user?.role === 'ADMIN')) ||
    (po.status === 'PENDING_MD_APPROVAL' && (user?.role === 'MD' || user?.role === 'CEO' || user?.role === 'ADMIN' || userIsDelegate)) ||
    (po.status === 'PENDING_CEO_APPROVAL' && (user?.role === 'CEO' || user?.role === 'ADMIN'));

  return (
    <MainLayout title={`Purchase Order ${po.po_number}`}>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Breadcrumb */}
        <div className="text-sm text-muted-foreground">
          <button onClick={() => navigate('/pos')} className="hover:text-foreground">
            Purchase Orders
          </button>
          {' > '}
          <span className="text-foreground font-mono">{po.po_number}</span>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold font-mono text-foreground">{po.po_number}</h2>
            <p className="text-muted-foreground mt-1">
              Created on {formatDate(po.created_at)} by {po.created_by?.full_name}
            </p>
          </div>
          {getStatusBadge(po.status)}
        </div>

        {/* Rejection Alert */}
        {po.status === 'REJECTED' && po.rejection_reason && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Rejected:</strong> {po.rejection_reason}
            </AlertDescription>
          </Alert>
        )}

        {/* Main Details Card */}
        <Card>
          <CardHeader>
            <CardTitle>Purchase Order Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Contractor</h4>
                  <p className="font-medium">{po.contractor?.name}</p>
                  <p className="text-sm text-muted-foreground">{po.contractor?.email}</p>
                  {po.contractor?.phone && (
                    <p className="text-sm text-muted-foreground">{po.contractor?.phone}</p>
                  )}
                </div>

                {po.property && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Property</h4>
                    <p className="font-medium">{po.property.name}</p>
                    <p className="text-sm text-muted-foreground">{po.property.address}</p>
                  </div>
                )}

                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Description</h4>
                  <p className="text-sm whitespace-pre-wrap">{po.description}</p>
                </div>

                {po.notes && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Notes</h4>
                    <p className="text-sm whitespace-pre-wrap">{po.notes}</p>
                  </div>
                )}
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                <Card className="bg-muted/50">
                  <CardContent className="pt-6">
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Amount (ex VAT)</span>
                        <span className="font-medium">{formatCurrency(Number(po.amount_ex_vat))}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">VAT @ {po.vat_rate}%</span>
                        <span className="font-medium">
                          {formatCurrency(Number(po.amount_ex_vat) * (po.vat_rate / 100))}
                        </span>
                      </div>
                      <Separator />
                      <div className="flex justify-between text-lg">
                        <span className="font-semibold">Total (inc VAT)</span>
                        <span className="font-bold text-primary">{formatCurrency(Number(po.amount_inc_vat))}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {po.approval_date && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Approved</h4>
                    <p className="text-sm">{formatDateTime(po.approval_date)}</p>
                    <p className="text-sm text-muted-foreground">by {po.approved_by?.full_name}</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <>
              <Button variant="outline" onClick={() => navigate(`/pos/${po.id}/edit`)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setDeleteDialogOpen(true)}
                disabled={processing}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Cancel PO
              </Button>
            </>
          )}

          {canApprove && (
            <>
              <Button onClick={() => setApproveDialogOpen(true)} disabled={processing || isProcessing(po.id)}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Approve
              </Button>
              <Button variant="destructive" onClick={() => setRejectDialogOpen(true)} disabled={processing || isProcessing(po.id)}>
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </Button>
            </>
          )}

          {po.status === 'APPROVED' && (
            <>
              {po.pdf_url ? (
                <>
                  <Button variant="outline" onClick={() => setPdfViewerOpen(true)}>
                    <Eye className="mr-2 h-4 w-4" />
                    View PDF
                  </Button>
                  <Button variant="outline" onClick={async () => {
                    try {
                      await downloadStorageFile(po.pdf_url!, `${po.po_number}.pdf`);
                      toast.success('PDF downloaded successfully');
                    } catch (error) {
                      console.error('Download failed:', error);
                      toast.error('Failed to download PDF');
                    }
                  }}>
                    <Download className="mr-2 h-4 w-4" />
                    Download PDF
                  </Button>
                </>
              ) : (
                <Button variant="outline" onClick={handleRegeneratePDF}>
                  <FileText className="mr-2 h-4 w-4" />
                  Generate PDF
                </Button>
              )}
              {(user?.role === 'MD' || user?.role === 'ACCOUNTS' || user?.role === 'ADMIN') && (
                <Button variant="outline" onClick={handleResendEmail}>
                  <Mail className="mr-2 h-4 w-4" />
                  Resend to Contractor
                </Button>
              )}
            </>
          )}
        </div>

        {/* Approval History */}
        {approvalLogs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Approval History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {approvalLogs.map((log) => (
                  <div key={log.id} className="flex gap-4 pb-4 border-b last:border-0">
                    <div className="flex-shrink-0">
                      {log.action === 'APPROVED' ? (
                        <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        </div>
                      ) : log.action === 'REJECTED' ? (
                        <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
                          <XCircle className="h-4 w-4 text-red-600" />
                        </div>
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center">
                          <Send className="h-4 w-4 text-amber-600" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">
                        {log.action.replace(/_/g, ' ')}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        by {log.action_by?.full_name}
                        {log.approved_on_behalf_of && (
                          <> on behalf of {log.approved_on_behalf_of.full_name}</>
                        )}
                        {' '}on {formatDateTime(log.created_at)}
                      </p>
                      {log.comment && (
                        <p className="text-sm mt-2 p-2 bg-muted rounded">{log.comment}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialogs */}
      {po && (
        <>
          <ApproveDialog
            open={approveDialogOpen}
            onOpenChange={setApproveDialogOpen}
            po={po}
            onConfirm={handleApprove}
          />
          <RejectDialog
            open={rejectDialogOpen}
            onOpenChange={setRejectDialogOpen}
            po={po}
            onConfirm={handleReject}
          />
          <DeletePODialog
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            po={po}
            onConfirm={handleDelete}
          />

          {po.pdf_url && (
            <PDFViewerDialog
              open={pdfViewerOpen}
              onOpenChange={setPdfViewerOpen}
              pdfUrl={po.pdf_url}
              title={`Purchase Order ${po.po_number}`}
            />
          )}
        </>
      )}
    </MainLayout>
  );
}
