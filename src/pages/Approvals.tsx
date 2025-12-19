import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { PurchaseOrder, Invoice, UserRole, ApprovalWorkflow } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDelegation } from '@/hooks/useDelegation';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, Eye, Clock, Loader2, AlertCircle } from 'lucide-react';
import { ApproveDialog } from '@/components/po/ApproveDialog';
import { RejectDialog } from '@/components/po/RejectDialog';
import { ApproveInvoiceDialog } from '@/components/invoices/ApproveInvoiceDialog';
import { RejectInvoiceDialog } from '@/components/invoices/RejectInvoiceDialog';

interface WorkflowSettings {
  use_custom_workflows: boolean;
  auto_approve_below_amount: number | null;
  require_ceo_above_amount: number | null;
}

export default function Approvals() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isActiveDelegate, activeDelegatesForMD } = useDelegation();
  const [allPendingPOs, setAllPendingPOs] = useState<PurchaseOrder[]>([]);
  const [pendingInvoices, setPendingInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [approveInvoiceDialogOpen, setApproveInvoiceDialogOpen] = useState(false);
  const [rejectInvoiceDialogOpen, setRejectInvoiceDialogOpen] = useState(false);
  const [processingPOs, setProcessingPOs] = useState<Set<string>>(new Set());
  const [processingInvoices, setProcessingInvoices] = useState<Set<string>>(new Set());
  const [workflowSettings, setWorkflowSettings] = useState<WorkflowSettings>({
    use_custom_workflows: false,
    auto_approve_below_amount: null,
    require_ceo_above_amount: null,
  });
  const [workflows, setWorkflows] = useState<ApprovalWorkflow[]>([]);

  useEffect(() => {
    fetchPendingPOs();
    fetchPendingInvoices();
    fetchWorkflowData();
  }, [user?.organisation_id]);

  const fetchWorkflowData = async () => {
    if (!user?.organisation_id) return;

    try {
      // Fetch settings
      const { data: settings } = await supabase
        .from('settings')
        .select('use_custom_workflows, auto_approve_below_amount, require_ceo_above_amount')
        .eq('organisation_id', user.organisation_id)
        .single();

      if (settings) {
        setWorkflowSettings({
          use_custom_workflows: (settings as any).use_custom_workflows || false,
          auto_approve_below_amount: (settings as any).auto_approve_below_amount ? Number((settings as any).auto_approve_below_amount) : null,
          require_ceo_above_amount: (settings as any).require_ceo_above_amount ? Number((settings as any).require_ceo_above_amount) : null,
        });
      }

      // Fetch workflows with steps
      const { data: workflowData } = await (supabase as any)
        .from('approval_workflows')
        .select(`*, steps:approval_workflow_steps(*)`)
        .eq('organisation_id', user.organisation_id);

      if (workflowData) {
        setWorkflows(workflowData);
      }
    } catch (error) {
      console.error('Error fetching workflow data:', error);
    }
  };

  const fetchPendingPOs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          contractor:contractors(*),
          property:properties(*),
          created_by:users!created_by_user_id(*)
        `)
        .in('status', ['PENDING_PM_APPROVAL', 'PENDING_MD_APPROVAL', 'PENDING_CEO_APPROVAL'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAllPendingPOs(data as any || []);
    } catch (error) {
      toast.error('Failed to load pending approvals');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Filter POs based on user role, workflow configuration, and delegation
  const pendingPOs = useMemo(() => {
    if (!user?.role || !user?.id) return [];

    // Check if current user is an active delegate for MD
    const userIsDelegate = isActiveDelegate(user.id);

    return allPendingPOs.filter(po => {
      const poStatus = po.status;

      // PROPERTY_MANAGER: Only see PENDING_PM_APPROVAL POs
      if (user.role === 'PROPERTY_MANAGER') {
        // PM can also see PENDING_MD_APPROVAL if they are an active delegate
        if (poStatus === 'PENDING_PM_APPROVAL') return true;
        if (poStatus === 'PENDING_MD_APPROVAL' && userIsDelegate) return true;
        return false;
      }

      // ACCOUNTS: Can see PENDING_MD_APPROVAL if they are an active delegate
      if (user.role === 'ACCOUNTS') {
        if (poStatus === 'PENDING_MD_APPROVAL' && userIsDelegate) return true;
        return false;
      }

      // MD: See PENDING_MD_APPROVAL only (not CEO level)
      if (user.role === 'MD') {
        return poStatus === 'PENDING_MD_APPROVAL';
      }

      // ADMIN: Can see PENDING_PM_APPROVAL and PENDING_MD_APPROVAL (same authority as MD)
      // But NOT PENDING_CEO_APPROVAL (that's CEO only)
      if (user.role === 'ADMIN') {
        return poStatus === 'PENDING_PM_APPROVAL' || poStatus === 'PENDING_MD_APPROVAL';
      }

      // CEO: ONLY see PENDING_CEO_APPROVAL POs
      // CEO CANNOT see or approve PENDING_MD_APPROVAL POs (sequential enforcement)
      if (user.role === 'CEO') {
        return poStatus === 'PENDING_CEO_APPROVAL';
      }

      return false;
    });
  }, [allPendingPOs, user?.role, user?.id, isActiveDelegate]);

  const fetchPendingInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          contractor:contractors(*),
          purchase_order:purchase_orders(*)
        `)
        .eq('status', 'PENDING_MD_APPROVAL')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPendingInvoices(data as any || []);
    } catch (error) {
      toast.error('Failed to load pending invoices');
      console.error(error);
    }
  };

  const handleApprove = async (po: PurchaseOrder) => {
    if (!user) return;

    const poId = po.id;
    setProcessingPOs(prev => new Set(prev).add(poId));

    try {
      // Get workflow settings to check CEO threshold
      const { data: settings } = await supabase
        .from('settings')
        .select('use_custom_workflows, require_ceo_above_amount')
        .eq('organisation_id', user.organisation_id)
        .maybeSingle();

      const ceoThreshold = settings?.require_ceo_above_amount || 15000;
      const useCustomWorkflows = settings?.use_custom_workflows ?? false;
      const poAmount = Number(po.amount_inc_vat);
      
      // Check if CEO approval is required (MD approving high-value PO)
      const needsCeoApproval = useCustomWorkflows && 
        po.status === 'PENDING_MD_APPROVAL' && 
        poAmount > ceoThreshold && 
        user.role !== 'CEO';

      if (needsCeoApproval) {
        // Route to CEO for final approval
        const { error: updateError } = await supabase
          .from('purchase_orders')
          .update({ status: 'PENDING_CEO_APPROVAL' })
          .eq('id', poId);

        if (updateError) throw updateError;

        // Log MD approval action
        await supabase.from('po_approval_logs').insert([{
          po_id: poId,
          action_by_user_id: user.id,
          action: 'APPROVED',
          comment: 'MD approved - routed to CEO for final approval',
        }]);

        // Notify CEO users
        const { data: ceoUsers } = await supabase
          .from('users')
          .select('id')
          .eq('organisation_id', user.organisation_id)
          .eq('role', 'CEO')
          .eq('is_active', true);

        if (ceoUsers && ceoUsers.length > 0) {
          await supabase.from('notifications').insert(
            ceoUsers.map((ceoUser) => ({
              user_id: ceoUser.id,
              organisation_id: user.organisation_id,
              type: 'po_pending_ceo_approval',
              title: 'High-Value PO Requires CEO Approval',
              message: `PO ${po.po_number} (${new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(poAmount)}) requires your approval`,
              link: `/pos/${poId}`,
              related_po_id: poId,
            }))
          );
        }

        // Send email notification to CEO
        supabase.functions.invoke('send-email', {
          body: { type: 'po_ceo_approval_request', po_id: poId }
        }).catch(err => console.error('CEO email notification failed:', err));

        toast.success('PO approved by MD - routed to CEO for final approval');
        setAllPendingPOs(prev => prev.filter(p => p.id !== poId));
        return;
      }

      // Full approval (CEO approving, or MD approving under threshold)
      const { error: updateError } = await supabase
        .from('purchase_orders')
        .update({
          status: 'APPROVED',
          approved_by_user_id: user.id,
          approval_date: new Date().toISOString(),
        })
        .eq('id', poId);

      if (updateError) throw updateError;

      // Log approval action
      await supabase.from('po_approval_logs').insert([{
        po_id: poId,
        action_by_user_id: user.id,
        action: 'APPROVED',
      }]);

      // Generate PDF and send emails in background
      Promise.all([
        supabase.functions.invoke('generate-po-pdf', { body: { po_id: poId } }),
        supabase.functions.invoke('send-email', { 
          body: { type: 'po_approved_contractor', po_id: poId } 
        }),
        supabase.functions.invoke('send-email', { 
          body: { type: 'po_approved_accounts', po_id: poId } 
        }),
        supabase.functions.invoke('send-email', { 
          body: { type: 'po_approved_pm', po_id: poId } 
        }),
      ]).catch(err => {
        console.error('Background tasks failed:', err);
        toast.error('PO approved but PDF/email may have failed. Check PO details.');
      });

      // Create notification for PM (if not approving their own PO)
      if (po.created_by_user_id !== user.id) {
        await supabase.from('notifications').insert({
          user_id: po.created_by_user_id,
          organisation_id: user.organisation_id,
          type: 'po_approved',
          title: 'PO Approved',
          message: `Your Purchase Order ${po.po_number} has been approved`,
          link: `/pos/${poId}`,
          related_po_id: poId,
        });
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
            related_po_id: poId,
          }))
        );
        
        if (accountsNotificationError) {
          console.error('Error creating ACCOUNTS notifications:', accountsNotificationError);
        }
      } else {
        console.log('No ACCOUNTS/ADMIN users found to notify, or query failed');
      }

      toast.success('Purchase order approved and sent to contractor');
      
      // Remove from list with optimistic update
      setAllPendingPOs(prev => prev.filter(p => p.id !== poId));
    } catch (error) {
      console.error('Failed to approve PO:', error);
      toast.error('Failed to approve purchase order');
    } finally {
      setProcessingPOs(prev => {
        const next = new Set(prev);
        next.delete(poId);
        return next;
      });
    }
  };

  const handleReject = async (po: PurchaseOrder, reason: string) => {
    if (!user) return;

    const poId = po.id;
    setProcessingPOs(prev => new Set(prev).add(poId));

    try {
      const { error: updateError } = await supabase
        .from('purchase_orders')
        .update({
          status: 'REJECTED',
          rejection_reason: reason,
        })
        .eq('id', poId);

      if (updateError) throw updateError;

      await supabase.from('po_approval_logs').insert([{
        po_id: poId,
        action_by_user_id: user.id,
        action: 'REJECTED',
        comment: reason,
      }]);

      // Send rejection email in background
      supabase.functions.invoke('send-email', { 
        body: { type: 'po_rejected', po_id: poId } 
      }).catch(err => {
        console.error('Email failed:', err);
      });

      toast.success('Purchase order rejected. PM has been notified.');
      
      // Remove from list
      setAllPendingPOs(prev => prev.filter(p => p.id !== poId));
    } catch (error) {
      console.error('Failed to reject PO:', error);
      toast.error('Failed to reject purchase order');
    } finally {
      setProcessingPOs(prev => {
        const next = new Set(prev);
        next.delete(poId);
        return next;
      });
    }
  };

  return (
    <MainLayout title="Approvals">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold text-foreground">Pending Approvals</h2>
            <p className="text-muted-foreground mt-1">Review and approve purchase orders</p>
          </div>
          <Badge className="bg-amber-100 text-amber-700 text-lg px-4 py-2">
            <Clock className="mr-2 h-5 w-5" />
            {pendingPOs.length + pendingInvoices.length} Pending
          </Badge>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="purchase-orders" className="space-y-4">
          <TabsList>
            <TabsTrigger value="purchase-orders">
              Purchase Orders ({pendingPOs.length})
            </TabsTrigger>
            <TabsTrigger value="invoices">
              Invoices ({pendingInvoices.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="purchase-orders" className="space-y-4">
            {loading ? (
              <div className="flex justify-center items-center min-h-[300px]">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                  <p className="mt-4 text-muted-foreground">Loading pending approvals...</p>
                </div>
              </div>
            ) : pendingPOs.length === 0 ? (
              <Card className="p-12">
                <div className="text-center">
                  <div className="mx-auto h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">All caught up!</h3>
                  <p className="text-muted-foreground">No pending approvals at the moment.</p>
                </div>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {pendingPOs.map((po) => {
                  const isProcessing = processingPOs.has(po.id);
                  const isCeoApproval = po.status === 'PENDING_CEO_APPROVAL';
                  return (
                    <Card 
                      key={po.id} 
                      className={`border-l-4 hover:shadow-md transition-shadow ${isCeoApproval ? 'border-orange-500' : 'border-amber-400'}`}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <p className="font-mono text-sm font-bold text-primary">
                              {po.po_number}
                            </p>
                            <p className="text-2xl font-bold">
                              {formatCurrency(Number(po.amount_inc_vat))}
                            </p>
                          </div>
                          <Badge className={isCeoApproval ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700'}>
                            {isCeoApproval ? 'Pending CEO' : 'Pending MD'}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <div>
                            <span className="text-sm text-muted-foreground">Contractor: </span>
                            <span className="font-medium">{po.contractor?.name}</span>
                          </div>
                          {po.property && (
                            <div>
                              <span className="text-sm text-muted-foreground">Property: </span>
                              <span className="font-medium">{po.property.name}</span>
                            </div>
                          )}
                          <div>
                            <span className="text-sm text-muted-foreground">Description: </span>
                            <p className="text-sm mt-1 line-clamp-2">{po.description}</p>
                          </div>
                          <div className="text-sm text-muted-foreground pt-2 border-t">
                            Requested by <span className="font-medium text-foreground">{po.created_by?.full_name}</span> on {formatDate(po.created_at)}
                          </div>
                        </div>

                        {(() => {
                          // Check if current user can approve this PO (including delegates for MD approval)
                          const userIsDelegate = isActiveDelegate(user?.id || '');
                          const canUserApprove = isCeoApproval 
                            ? (user?.role === 'CEO' || user?.role === 'ADMIN')
                            : (user?.role === 'MD' || user?.role === 'CEO' || user?.role === 'ADMIN' || userIsDelegate);

                          return (
                            <div className="flex gap-2 pt-2">
                              {canUserApprove ? (
                                <>
                                  <Button
                                    size="sm"
                                    className="flex-1 bg-green-600 hover:bg-green-700"
                                    onClick={() => {
                                      setSelectedPO(po);
                                      setApproveDialogOpen(true);
                                    }}
                                    disabled={isProcessing}
                                  >
                                    {isProcessing ? (
                                      <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Processing...
                                      </>
                                    ) : (
                                      <>
                                        <CheckCircle2 className="mr-2 h-4 w-4" />
                                        Approve
                                      </>
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    className="flex-1"
                                    onClick={() => {
                                      setSelectedPO(po);
                                      setRejectDialogOpen(true);
                                    }}
                                    disabled={isProcessing}
                                  >
                                    <XCircle className="mr-2 h-4 w-4" />
                                    Reject
                                  </Button>
                                </>
                              ) : (
                                <div className="flex-1 text-sm text-muted-foreground italic">
                                  Requires CEO approval
                                </div>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => navigate(`/pos/${po.id}`)}
                                disabled={isProcessing}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </div>
                          );
                        })()}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="invoices" className="space-y-4">
            {loading ? (
              <div className="flex justify-center items-center min-h-[300px]">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                  <p className="mt-4 text-muted-foreground">Loading pending invoices...</p>
                </div>
              </div>
            ) : pendingInvoices.length === 0 ? (
              <Card className="p-12">
                <div className="text-center">
                  <div className="mx-auto h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">All caught up!</h3>
                  <p className="text-muted-foreground">No pending invoice approvals at the moment.</p>
                </div>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {pendingInvoices.map((invoice) => {
                  const isProcessing = processingInvoices.has(invoice.id);
                  const poAmountMatch = Math.abs(
                    (invoice.amount_inc_vat || 0) - (invoice.purchase_order?.amount_inc_vat || 0)
                  );
                  const amountsMatch = poAmountMatch < 0.01;

                  return (
                    <Card 
                      key={invoice.id} 
                      className="border-l-4 border-amber-400 hover:shadow-md transition-shadow"
                    >
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <p className="font-mono text-sm font-bold text-primary">
                              Invoice: {invoice.invoice_number}
                            </p>
                            <p className="text-2xl font-bold">
                              {formatCurrency(Number(invoice.amount_inc_vat))}
                            </p>
                          </div>
                          <Badge className="bg-amber-100 text-amber-700">
                            Pending
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <div>
                            <span className="text-sm text-muted-foreground">PO Number: </span>
                            <span className="font-medium font-mono">{invoice.purchase_order?.po_number}</span>
                          </div>
                          <div>
                            <span className="text-sm text-muted-foreground">Contractor: </span>
                            <span className="font-medium">{invoice.contractor?.name}</span>
                          </div>
                          <div>
                            <span className="text-sm text-muted-foreground">Invoice Date: </span>
                            <span className="font-medium">{formatDate(invoice.invoice_date)}</span>
                          </div>
                          <Separator />
                          <div
                            className={`p-3 rounded-lg border ${
                              amountsMatch
                                ? 'bg-green-50 border-green-200'
                                : 'bg-amber-50 border-amber-200'
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              {amountsMatch ? (
                                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                              ) : (
                                <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                              )}
                              <div className="flex-1">
                                <p className="text-sm font-medium">
                                  {amountsMatch
                                    ? 'Amounts match'
                                    : `Difference: ${formatCurrency(Math.abs(poAmountMatch))}`}
                                </p>
                                {!amountsMatch && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    PO Amount: {formatCurrency(invoice.purchase_order?.amount_inc_vat || 0)}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                          {invoice.mismatch_notes && (
                            <div className="text-sm text-muted-foreground">
                              <span className="font-medium">Note: </span>
                              {invoice.mismatch_notes}
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2 pt-2">
                          {(user?.role === 'MD' || user?.role === 'CEO' || user?.role === 'ADMIN') ? (
                            <>
                              <Button
                                size="sm"
                                className="flex-1 bg-green-600 hover:bg-green-700"
                                onClick={() => {
                                  setSelectedInvoice(invoice);
                                  setApproveInvoiceDialogOpen(true);
                                }}
                                disabled={isProcessing}
                              >
                                {isProcessing ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Processing...
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                    Approve
                                  </>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="flex-1"
                                onClick={() => {
                                  setSelectedInvoice(invoice);
                                  setRejectInvoiceDialogOpen(true);
                                }}
                                disabled={isProcessing}
                              >
                                <XCircle className="mr-2 h-4 w-4" />
                                Reject
                              </Button>
                            </>
                          ) : (
                            <div className="flex-1 text-sm text-muted-foreground italic text-center py-2">
                              Requires MD/CEO approval
                            </div>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate(`/invoice/${invoice.id}`)}
                            disabled={isProcessing}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      {selectedPO && (
        <>
          <ApproveDialog
            open={approveDialogOpen}
            onOpenChange={setApproveDialogOpen}
            po={selectedPO}
            onConfirm={() => handleApprove(selectedPO)}
          />
          <RejectDialog
            open={rejectDialogOpen}
            onOpenChange={setRejectDialogOpen}
            po={selectedPO}
            onConfirm={(reason) => handleReject(selectedPO, reason)}
          />
        </>
      )}
      {selectedInvoice && (
        <>
          <ApproveInvoiceDialog
            invoice={selectedInvoice}
            open={approveInvoiceDialogOpen}
            onOpenChange={(open) => {
              setApproveInvoiceDialogOpen(open);
              if (!open) {
                fetchPendingInvoices();
              }
            }}
          />
          <RejectInvoiceDialog
            invoice={selectedInvoice}
            open={rejectInvoiceDialogOpen}
            onOpenChange={(open) => {
              setRejectInvoiceDialogOpen(open);
              if (!open) {
                fetchPendingInvoices();
              }
            }}
          />
        </>
      )}
    </MainLayout>
  );
}
