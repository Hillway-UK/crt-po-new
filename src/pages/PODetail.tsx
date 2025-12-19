import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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

export default function PODetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getNextApprovalStep, getAutoCompletableSteps, canUserApproveAtStatus } = useApprovalWorkflow();
  const { isActiveDelegate, getMDsForDelegate } = useDelegation();
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
    if (!po || !user) return;

    // CEO HARD BLOCK: CEO cannot approve before CEO step
    if (user.role === 'CEO' && po.status !== 'PENDING_CEO_APPROVAL') {
      toast.error('CEO cannot approve before the CEO approval step');
      return;
    }

    // Check if user is an active delegate for MD step
    const userIsDelegate = isActiveDelegate(user.id);
    
    // Verify approval eligibility
    const canApprove = canUserApproveAtStatus(user.role, po.status, userIsDelegate);
    if (!canApprove) {
      toast.error('You are not authorized to approve this PO at its current stage');
      return;
    }

    setProcessing(true);
    try {
      const poAmount = Number(po.amount_inc_vat);

      // Determine if this is a delegated approval (non-MD approving MD step)
      const isDelegatedApproval = po.status === 'PENDING_MD_APPROVAL' && 
        user.role !== 'MD' && 
        user.role !== 'ADMIN' && 
        userIsDelegate;

      // Get the MD user ID if this is a delegated approval
      let approvedOnBehalfOfUserId: string | null = null;
      if (isDelegatedApproval) {
        const mds = await getMDsForDelegate(user.id);
        if (mds.length > 0) {
          approvedOnBehalfOfUserId = mds[0].id;
        }
      }

      // Check if there are steps this approver can auto-complete
      const autoCompletableSteps = getAutoCompletableSteps(po.status, poAmount, user.role);
      
      // Use the dynamic workflow hook to determine next step
      const nextStep = getNextApprovalStep(po.status, poAmount);

      // If there's a next step BUT the current approver can auto-complete it, skip to final approval
      if (nextStep && nextStep.nextStatus && autoCompletableSteps.length > 0) {
        // Higher-role user is approving - check if they can complete ALL remaining steps
        const remainingStepRoles = autoCompletableSteps.map(s => s.role);
        const canCompleteAll = remainingStepRoles.includes(nextStep.nextRole!);

        if (canCompleteAll) {
          // Auto-complete: Log the current step approval
          const roleLabel = user.role === 'PROPERTY_MANAGER' ? 'PM' : user.role;
          const delegateNote = isDelegatedApproval ? ` (on behalf of MD)` : '';
          
          await (supabase as any).from('po_approval_logs').insert([{
            po_id: po.id,
            action_by_user_id: user.id,
            approved_on_behalf_of_user_id: approvedOnBehalfOfUserId,
            action: 'APPROVED',
            comment: `${roleLabel} approved${delegateNote} (acting at ${po.status.replace('PENDING_', '').replace('_APPROVAL', '')} step)`,
          }]);

          // Log auto-completed steps
          for (const step of autoCompletableSteps) {
            await (supabase as any).from('po_approval_logs').insert([{
              po_id: po.id,
              action_by_user_id: user.id,
              approved_on_behalf_of_user_id: approvedOnBehalfOfUserId,
              action: 'APPROVED',
              comment: `Auto-approved ${step.role} step (same approver has authority)`,
            }]);
          }

          // Go directly to full approval
          const { error: updateError } = await supabase
            .from('purchase_orders')
            .update({
              status: 'APPROVED',
              approved_by_user_id: user.id,
              approval_date: new Date().toISOString(),
            })
            .eq('id', po.id);

          if (updateError) throw updateError;

          // Generate PDF and send emails in background
          Promise.all([
            supabase.functions.invoke('generate-po-pdf', { body: { po_id: po.id } }),
            supabase.functions.invoke('send-email', { 
              body: { type: 'po_approved_contractor', po_id: po.id } 
            }),
            supabase.functions.invoke('send-email', { 
              body: { type: 'po_approved_accounts', po_id: po.id } 
            }),
            supabase.functions.invoke('send-email', { 
              body: { type: 'po_approved_pm', po_id: po.id } 
            }),
          ]).catch(err => {
            console.error('Background tasks failed:', err);
            toast.error('PO approved but PDF/email may have failed');
          });

          // Notify PM and accounts
          if (po.created_by_user_id !== user.id) {
            await supabase.from('notifications').insert({
              user_id: po.created_by_user_id,
              organisation_id: user.organisation_id,
              type: 'po_approved',
              title: 'PO Approved',
              message: `Your Purchase Order ${po.po_number} has been approved`,
              link: `/pos/${po.id}`,
              related_po_id: po.id,
            });
          }

          const { data: accountsUsers } = await supabase
            .from('users')
            .select('id')
            .eq('organisation_id', user.organisation_id)
            .in('role', ['ACCOUNTS', 'ADMIN'])
            .eq('is_active', true)
            .neq('id', user.id);

          if (accountsUsers && accountsUsers.length > 0) {
            await supabase.from('notifications').insert(
              accountsUsers.map((accountsUser) => ({
                user_id: accountsUser.id,
                organisation_id: user.organisation_id,
                type: 'po_approved_for_invoice',
                title: 'PO Ready for Invoice',
                message: `PO ${po.po_number} approved. Ready for invoice matching.`,
                link: `/invoices`,
                related_po_id: po.id,
              }))
            );
          }

          toast.success(`PO fully approved (${autoCompletableSteps.length} step(s) auto-completed)`);
          fetchPO();
          fetchApprovalLogs();
          return;
        }
      }

      if (nextStep && nextStep.nextStatus) {
        // Route to next approver (standard flow)
        const { error: updateError } = await supabase
          .from('purchase_orders')
          .update({ status: nextStep.nextStatus as any })
          .eq('id', po.id);

        if (updateError) throw updateError;

        // Log approval action with delegation info
        const roleLabel = user.role === 'PROPERTY_MANAGER' ? 'PM' : user.role;
        const delegateNote = isDelegatedApproval ? ` (on behalf of MD)` : '';
        
        await (supabase as any).from('po_approval_logs').insert([{
          po_id: po.id,
          action_by_user_id: user.id,
          approved_on_behalf_of_user_id: approvedOnBehalfOfUserId,
          action: 'APPROVED',
          comment: `${roleLabel} approved${delegateNote} - routed to ${nextStep.nextRole} for approval`,
        }]);

        // Notify next approver users
        const rolesToNotify: ('PROPERTY_MANAGER' | 'MD' | 'CEO' | 'ACCOUNTS' | 'ADMIN')[] = 
          nextStep.nextRole === 'CEO' ? ['CEO'] : 
          nextStep.nextRole === 'MD' ? ['MD', 'ADMIN'] : 
          nextStep.nextRole === 'PROPERTY_MANAGER' ? ['PROPERTY_MANAGER', 'ADMIN'] :
          ['ADMIN'];
        
        const { data: nextApprovers } = await supabase
          .from('users')
          .select('id')
          .eq('organisation_id', user.organisation_id)
          .in('role', rolesToNotify)
          .eq('is_active', true);

        if (nextApprovers && nextApprovers.length > 0) {
          await supabase.from('notifications').insert(
            nextApprovers.map((approver) => ({
              user_id: approver.id,
              organisation_id: user.organisation_id,
              type: nextStep.nextStatus === 'PENDING_CEO_APPROVAL' ? 'po_pending_ceo_approval' : 'po_pending_approval',
              title: nextStep.nextStatus === 'PENDING_CEO_APPROVAL' ? 'High-Value PO Requires CEO Approval' : 'PO Requires Approval',
              message: `PO ${po.po_number} (${formatCurrency(poAmount)}) requires your approval`,
              link: `/pos/${po.id}`,
              related_po_id: po.id,
            }))
          );
        }

        // Send email notification to next approver
        if (nextStep.emailType) {
          supabase.functions.invoke('send-email', {
            body: { type: nextStep.emailType, po_id: po.id }
          }).catch(err => console.error('Email notification failed:', err));
        }

        toast.success(`PO approved - routed to ${nextStep.nextRole} for final approval`);
        fetchPO();
        fetchApprovalLogs();
        return;
      }

      // Full approval
      const { error: updateError } = await supabase
        .from('purchase_orders')
        .update({
          status: 'APPROVED',
          approved_by_user_id: user.id,
          approval_date: new Date().toISOString(),
        })
        .eq('id', po.id);

      if (updateError) throw updateError;

      // Log with delegation info
      const delegateNote = isDelegatedApproval ? ` (on behalf of MD)` : '';
      await (supabase as any).from('po_approval_logs').insert([{
        po_id: po.id,
        action_by_user_id: user.id,
        approved_on_behalf_of_user_id: approvedOnBehalfOfUserId,
        action: 'APPROVED',
        comment: isDelegatedApproval ? `Approved${delegateNote}` : null,
      }]);

      // Generate PDF and send emails in background
      Promise.all([
        supabase.functions.invoke('generate-po-pdf', { body: { po_id: po.id } }),
        supabase.functions.invoke('send-email', { 
          body: { type: 'po_approved_contractor', po_id: po.id } 
        }),
        supabase.functions.invoke('send-email', { 
          body: { type: 'po_approved_accounts', po_id: po.id } 
        }),
        supabase.functions.invoke('send-email', { 
          body: { type: 'po_approved_pm', po_id: po.id } 
        }),
      ]).catch(err => {
        console.error('Background tasks failed:', err);
        toast.error('PO approved but PDF/email may have failed');
      });

      // Create notification for PM (if not approving their own PO)
      if (po.created_by_user_id !== user.id) {
        const { error: notificationError } = await supabase.from('notifications').insert({
          user_id: po.created_by_user_id,
          organisation_id: user.organisation_id,
          type: 'po_approved',
          title: 'PO Approved',
          message: `Your Purchase Order ${po.po_number} has been approved`,
          link: `/pos/${po.id}`,
          related_po_id: po.id,
        });

        if (notificationError) {
          console.error('Error creating notification:', notificationError);
        }
      }

      // Notify Accounts/ADMIN users that a new PO is ready for invoice
      const { data: accountsUsers, error: accountsQueryError } = await supabase
        .from('users')
        .select('id')
        .eq('organisation_id', user.organisation_id)
        .in('role', ['ACCOUNTS', 'ADMIN'])
        .eq('is_active', true)
        .neq('id', user.id);

      if (accountsQueryError) {
        console.error('Error fetching ACCOUNTS/ADMIN users:', accountsQueryError);
      }

      if (accountsUsers && accountsUsers.length > 0) {
        const { error: accountsNotificationError } = await supabase.from('notifications').insert(
          accountsUsers.map((accountsUser) => ({
            user_id: accountsUser.id,
            organisation_id: user.organisation_id,
            type: 'po_approved_for_invoice',
            title: 'PO Ready for Invoice',
            message: `PO ${po.po_number} approved. Ready for invoice matching.`,
            link: `/invoices`,
            related_po_id: po.id,
          }))
        );

        if (accountsNotificationError) {
          console.error('Error creating ACCOUNTS notifications:', accountsNotificationError);
        }
      } else {
        console.log('No ACCOUNTS/ADMIN users found to notify, or query failed');
      }

      toast.success('Purchase order approved and sent to contractor');
      fetchPO();
      fetchApprovalLogs();
    } catch (error) {
      toast.error('Failed to approve purchase order');
      console.error(error);
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (reason: string) => {
    if (!po || !user) return;

    setProcessing(true);
    try {
      const { error: updateError } = await supabase
        .from('purchase_orders')
        .update({
          status: 'REJECTED',
          rejection_reason: reason,
        })
        .eq('id', po.id);

      if (updateError) throw updateError;

      await supabase.from('po_approval_logs').insert([{
        po_id: po.id,
        action_by_user_id: user.id,
        action: 'REJECTED',
        comment: reason,
      }]);

      // Send rejection email in background
      supabase.functions.invoke('send-email', { 
        body: { type: 'po_rejected', po_id: po.id } 
      }).catch(err => {
        console.error('Email failed:', err);
      });

      // Create notification for PM (if not rejecting their own PO)
      if (po.created_by_user_id !== user.id) {
        const { error: notificationError } = await supabase.from('notifications').insert({
          user_id: po.created_by_user_id,
          organisation_id: user.organisation_id,
          type: 'po_rejected',
          title: 'PO Rejected',
          message: `Your Purchase Order ${po.po_number} has been rejected`,
          link: `/pos/${po.id}`,
          related_po_id: po.id,
        });

        if (notificationError) {
          console.error('Error creating notification:', notificationError);
        }
      }

      toast.success('Purchase order rejected. PM has been notified.');
      fetchPO();
      fetchApprovalLogs();
    } catch (error) {
      toast.error('Failed to reject purchase order');
      console.error(error);
    } finally {
      setProcessing(false);
    }
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
              <Button onClick={() => setApproveDialogOpen(true)} disabled={processing}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Approve
              </Button>
              <Button variant="destructive" onClick={() => setRejectDialogOpen(true)} disabled={processing}>
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
