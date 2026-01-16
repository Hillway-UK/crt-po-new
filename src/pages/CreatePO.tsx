import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ContractorDialog } from '@/components/contractors/ContractorDialog';
import { Contractor, Property, POStatus, UserRole } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useApprovalWorkflow } from '@/hooks/useApprovalWorkflow';
import { toast } from 'sonner';
import { z } from 'zod';
import { Plus } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

const purchaseOrderSchema = z.object({
  contractor_id: z.string().uuid('Please select a contractor'),
  property_id: z.string().uuid().optional().nullable(),
  description: z.string().min(10, 'Description must be at least 10 characters').max(1000),
  amount_ex_vat: z.number().positive('Amount must be greater than 0'),
  vat_rate: z.number().min(0).max(100),
  notes: z.string().max(1000).optional().nullable().or(z.literal('')),
});

export default function CreatePO() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getInitialApprovalInfo, loading: workflowLoading } = useApprovalWorkflow();
  const [loading, setLoading] = useState(false);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [contractorDialogOpen, setContractorDialogOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [nextPONumber, setNextPONumber] = useState<string>('');
  const [loadingPONumber, setLoadingPONumber] = useState(true);

  const [formData, setFormData] = useState({
    contractor_id: '',
    property_id: '',
    description: '',
    amount_ex_vat: '',
    vat_rate: 20,
    notes: '',
  });

  useEffect(() => {
    fetchContractors();
    fetchProperties();
    fetchNextPONumber();
  }, []);

  const fetchNextPONumber = async () => {
    setLoadingPONumber(true);
    const { data, error } = await supabase
      .from('settings')
      .select('po_prefix, next_po_number')
      .eq('organisation_id', user?.organisation_id)
      .single();
    
    if (data && !error) {
      const formattedNumber = data.po_prefix + String(data.next_po_number).padStart(5, '0');
      setNextPONumber(formattedNumber);
    }
    setLoadingPONumber(false);
  };

  const fetchContractors = async () => {
    const { data } = await supabase
      .from('contractors')
      .select('*')
      .eq('is_active', true)
      .order('name');
    setContractors(data || []);
  };

  const fetchProperties = async () => {
    const { data } = await supabase
      .from('properties')
      .select('*')
      .eq('is_active', true)
      .order('name');
    setProperties(data || []);
  };

  const calculateVAT = () => {
    const amount = parseFloat(formData.amount_ex_vat) || 0;
    return (amount * formData.vat_rate) / 100;
  };

  const calculateTotal = () => {
    const amount = parseFloat(formData.amount_ex_vat) || 0;
    return amount + calculateVAT();
  };

  const handleSubmit = async (submitForApproval: boolean) => {
    setErrors({});
    setLoading(true);

    try {
      const validated = purchaseOrderSchema.parse({
        ...formData,
        amount_ex_vat: parseFloat(formData.amount_ex_vat),
        property_id: formData.property_id || null,
        notes: formData.notes || null,
      });

      // Calculate the total amount including VAT
      const amountIncVat = validated.amount_ex_vat * (1 + validated.vat_rate / 100);

      // Generate PO number
      const { data: poNumber, error: poNumError } = await supabase.rpc('generate_po_number', {
        org_id: user?.organisation_id,
      });

      if (poNumError) throw poNumError;

      // Get the initial status and approver based on dynamic workflow
      const approvalInfo = submitForApproval 
        ? getInitialApprovalInfo(amountIncVat)
        : { status: 'DRAFT' as POStatus, approverRole: null, emailType: '', approvalChain: [] };
      
      const { status: initialStatus, approverRole, emailType } = approvalInfo;

      const poData: any = {
        contractor_id: validated.contractor_id,
        description: validated.description,
        amount_ex_vat: validated.amount_ex_vat,
        vat_rate: validated.vat_rate,
        amount_inc_vat: amountIncVat,
        property_id: validated.property_id,
        notes: validated.notes,
        po_number: poNumber,
        organisation_id: user?.organisation_id,
        created_by_user_id: user?.id,
        status: initialStatus,
      };

      // If auto-approved, set approval info
      if (initialStatus === 'APPROVED') {
        poData.approved_by_user_id = user?.id;
        poData.approval_date = new Date().toISOString();
      }

      const { data: newPO, error: insertError } = await supabase
        .from('purchase_orders')
        .insert([poData])
        .select()
        .single();

      if (insertError) throw insertError;

      // Create approval log if submitting
      if (submitForApproval) {
        await supabase.from('po_approval_logs').insert([{
          po_id: newPO.id,
          action_by_user_id: user?.id,
          action: initialStatus === 'APPROVED' ? 'APPROVED' : 'SENT_FOR_APPROVAL',
          comment: initialStatus === 'APPROVED' ? 'Auto-approved based on workflow settings' : undefined,
        }]);

        // Only send notifications if not auto-approved
        if (initialStatus !== 'APPROVED' && emailType) {
          // Send notification email to the correct approver role
          supabase.functions.invoke('send-email', {
            body: { type: emailType, po_id: newPO.id }
          }).catch(err => {
            console.error('Email notification failed:', err);
          });

          // Get users with the appropriate role and create notifications
          const rolesToNotify: ('PROPERTY_MANAGER' | 'MD' | 'CEO' | 'ACCOUNTS' | 'ADMIN')[] = approverRole === 'PROPERTY_MANAGER' 
            ? ['PROPERTY_MANAGER', 'ADMIN']
            : approverRole === 'MD' 
              ? ['MD', 'ADMIN']
              : ['CEO', 'ADMIN'];

          const { data: approverUsers, error: approverUsersError } = await supabase
            .from('users')
            .select('id')
            .eq('organisation_id', user?.organisation_id)
            .in('role', rolesToNotify)
            .eq('is_active', true)
            .neq('id', user?.id);

          if (approverUsersError) {
            console.error('Error fetching approver users:', approverUsersError);
          }

          if (approverUsers && approverUsers.length > 0) {
            const { error: notificationError } = await supabase.from('notifications').insert(
              approverUsers.map((approver) => ({
                user_id: approver.id,
                organisation_id: user?.organisation_id,
                type: 'po_pending_approval',
                title: 'New PO requires approval',
                message: `Purchase Order ${poNumber} (${formatCurrency(amountIncVat)}) has been submitted for your approval`,
                link: `/pos/${newPO.id}`,
                related_po_id: newPO.id,
              }))
            );

            if (notificationError) {
              console.error('Error creating notifications:', notificationError);
              toast.error('PO created but notifications may have failed');
            }
          }
        }
      }

      toast.success(
        initialStatus === 'APPROVED'
          ? 'Purchase order auto-approved based on workflow settings'
          : submitForApproval
            ? 'Purchase order submitted for approval'
            : 'Purchase order saved as draft'
      );
      navigate(`/pos/${newPO.id}`);
    } catch (err) {
      if (err instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        err.errors.forEach((error) => {
          if (error.path[0]) {
            fieldErrors[error.path[0].toString()] = error.message;
          }
        });
        setErrors(fieldErrors);
        toast.error('Please fix the form errors');
      } else {
        toast.error('Failed to create purchase order');
        console.error(err);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout title="Create Purchase Order">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Breadcrumb */}
        <div className="text-sm text-muted-foreground">
          <button onClick={() => navigate('/pos')} className="hover:text-foreground">
            Purchase Orders
          </button>
          {' > '}
          <span className="text-foreground">Create New PO</span>
        </div>

        <div>
          <h2 className="text-3xl font-bold text-foreground">Create Purchase Order</h2>
          <p className="text-muted-foreground mt-1">Fill in the details for a new purchase order</p>
        </div>

        {/* PO Number Preview Card */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Purchase Order Number</p>
                {loadingPONumber ? (
                  <div className="h-8 w-40 bg-muted animate-pulse rounded" />
                ) : (
                  <p className="text-2xl font-mono font-bold text-primary">{nextPONumber}</p>
                )}
              </div>
              <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                Draft
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="p-6">
          <form className="space-y-8">
            {/* Order Details Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Order Details</h3>
              
              <div className="space-y-2">
                <Label htmlFor="property">Property (Optional)</Label>
                <Select 
                  value={formData.property_id || "none"} 
                  onValueChange={(value) => setFormData({ ...formData, property_id: value === "none" ? "" : value })}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select a property (optional)" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    <SelectItem value="none">
                      <span className="text-muted-foreground">— No specific property —</span>
                    </SelectItem>
                    {properties.map((property) => (
                      <SelectItem key={property.id} value={property.id}>
                        {property.name} - {property.address}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Leave blank if this PO is not for a specific property</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contractor">Contractor *</Label>
                <div className="flex gap-2">
                  <Select value={formData.contractor_id} onValueChange={(value) => setFormData({ ...formData, contractor_id: value })}>
                    <SelectTrigger className={`flex-1 bg-background ${errors.contractor_id ? 'border-destructive' : ''}`}>
                      <SelectValue placeholder="Select a contractor..." />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      {contractors.map((contractor) => (
                        <SelectItem key={contractor.id} value={contractor.id}>
                          <div className="flex flex-col">
                            <span>{contractor.name}</span>
                            <span className="text-xs text-muted-foreground">{contractor.email}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" size="icon" onClick={() => setContractorDialogOpen(true)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {errors.contractor_id && <p className="text-sm text-destructive">{errors.contractor_id}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  placeholder="Enter the reason for this purchase order..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  className={errors.description ? 'border-destructive' : ''}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  {errors.description && <span className="text-destructive">{errors.description}</span>}
                  <span className="ml-auto">{formData.description.length} / 1000</span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Amounts Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Amounts</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (ex VAT) *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">£</span>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={formData.amount_ex_vat}
                      onChange={(e) => setFormData({ ...formData, amount_ex_vat: e.target.value })}
                      className={`pl-7 ${errors.amount_ex_vat ? 'border-destructive' : ''}`}
                    />
                  </div>
                  {errors.amount_ex_vat && <p className="text-sm text-destructive">{errors.amount_ex_vat}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vat_rate">VAT Rate</Label>
                  <Select value={formData.vat_rate.toString()} onValueChange={(value) => setFormData({ ...formData, vat_rate: parseFloat(value) })}>
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      <SelectItem value="0">0%</SelectItem>
                      <SelectItem value="5">5%</SelectItem>
                      <SelectItem value="20">20%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Amount (inc VAT)</Label>
                  <div className="h-10 px-3 py-2 rounded-md bg-primary/5 border border-input flex items-center font-medium text-primary">
                    {formatCurrency(calculateTotal())}
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Additional Info Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Additional Information</h3>
              
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Add any additional notes or comments..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>
            </div>

            {/* Form Footer */}
            <div className="flex flex-col sm:flex-row justify-between gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/pos')}
                disabled={loading}
              >
                Cancel
              </Button>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleSubmit(false)}
                  disabled={loading}
                  className="border-primary text-primary hover:bg-primary/5"
                >
                  Save as Draft
                </Button>
                <Button
                  type="button"
                  onClick={() => handleSubmit(true)}
                  disabled={loading || workflowLoading}
                >
                  {loading ? 'Submitting...' : 'Submit for Approval'}
                </Button>
              </div>
            </div>
          </form>
        </Card>
      </div>

      <ContractorDialog
        open={contractorDialogOpen}
        onOpenChange={setContractorDialogOpen}
        onSuccess={fetchContractors}
      />
    </MainLayout>
  );
}
