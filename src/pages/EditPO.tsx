import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ContractorDialog } from '@/components/contractors/ContractorDialog';
import { Contractor, Property, PurchaseOrder } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { z } from 'zod';
import { Plus, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { POStatusBadge } from '@/components/po/POStatusBadge';

const purchaseOrderSchema = z.object({
  contractor_id: z.string().uuid('Please select a contractor'),
  property_id: z.string().uuid().optional().nullable(),
  description: z.string().min(10, 'Description must be at least 10 characters').max(1000),
  amount_ex_vat: z.number().positive('Amount must be greater than 0'),
  vat_rate: z.number().min(0).max(100),
  notes: z.string().max(1000).optional(),
});

export default function EditPO() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [fetchingPO, setFetchingPO] = useState(true);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [contractorDialogOpen, setContractorDialogOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [po, setPo] = useState<PurchaseOrder | null>(null);

  const [formData, setFormData] = useState({
    contractor_id: '',
    property_id: '',
    description: '',
    amount_ex_vat: '',
    vat_rate: 20,
    notes: '',
  });

  useEffect(() => {
    if (id) {
      fetchPO();
      fetchContractors();
      fetchProperties();
    }
  }, [id]);

  const fetchPO = async () => {
    setFetchingPO(true);
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('id', id!)
        .single();

      if (error) throw error;

      // Check if user can edit this PO
      if ((data.status !== 'DRAFT' && data.status !== 'REJECTED') || data.created_by_user_id !== user?.id) {
        toast.error('You do not have permission to edit this purchase order');
        navigate(`/pos/${id}`);
        return;
      }

      setPo(data as any);
      
      // Pre-fill form with existing data
      setFormData({
        contractor_id: data.contractor_id,
        property_id: data.property_id || '',
        description: data.description,
        amount_ex_vat: data.amount_ex_vat.toString(),
        vat_rate: data.vat_rate || 20,
        notes: data.notes || '',
      });
    } catch (error) {
      toast.error('Failed to load purchase order');
      console.error(error);
      navigate('/pos');
    } finally {
      setFetchingPO(false);
    }
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
    if (!po) return;

    setErrors({});
    setLoading(true);

    try {
      const validated = purchaseOrderSchema.parse({
        ...formData,
        amount_ex_vat: parseFloat(formData.amount_ex_vat),
        property_id: formData.property_id || null,
        notes: formData.notes || null,
      });

      const updateData: any = {
        contractor_id: validated.contractor_id,
        description: validated.description,
        amount_ex_vat: validated.amount_ex_vat,
        vat_rate: validated.vat_rate,
        property_id: validated.property_id,
        notes: validated.notes,
      };

      // If resubmitting a rejected PO, clear rejection reason and set to pending
      if (po.status === 'REJECTED' && submitForApproval) {
        updateData.status = 'PENDING_MD_APPROVAL';
        updateData.rejection_reason = null;
      } else if (submitForApproval) {
        updateData.status = 'PENDING_MD_APPROVAL';
      }

      const { data: updatedPO, error: updateError } = await supabase
        .from('purchase_orders')
        .update(updateData)
        .eq('id', po.id)
        .select()
        .single();

      if (updateError) throw updateError;

      // Create approval log if submitting for approval
      if (submitForApproval) {
        await supabase.from('po_approval_logs').insert([{
          po_id: po.id,
          action_by_user_id: user?.id,
          action: 'SENT_FOR_APPROVAL',
        }]);

        // Send notification email to MD
        supabase.functions.invoke('send-email', {
          body: { type: 'po_approval_request', po_id: po.id }
        }).catch(err => {
          console.error('Email notification failed:', err);
        });
      }

      toast.success(
        submitForApproval
          ? po.status === 'REJECTED' 
            ? 'Purchase order resubmitted for approval'
            : 'Purchase order submitted for approval'
          : 'Purchase order updated'
      );
      navigate(`/pos/${updatedPO.id}`);
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
        toast.error('Failed to update purchase order');
        console.error(err);
      }
    } finally {
      setLoading(false);
    }
  };

  if (fetchingPO) {
    return (
      <MainLayout title="Edit Purchase Order">
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      </MainLayout>
    );
  }

  if (!po) {
    return (
      <MainLayout title="Edit Purchase Order">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Purchase order not found</p>
          <Button onClick={() => navigate('/pos')} className="mt-4">
            Back to Purchase Orders
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title={`Edit Purchase Order ${po.po_number}`}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Breadcrumb */}
        <div className="text-sm text-muted-foreground">
          <button onClick={() => navigate('/pos')} className="hover:text-foreground">
            Purchase Orders
          </button>
          {' > '}
          <button onClick={() => navigate(`/pos/${po.id}`)} className="hover:text-foreground">
            {po.po_number}
          </button>
          {' > '}
          <span className="text-foreground">Edit</span>
        </div>

        <div>
          <h2 className="text-3xl font-bold text-foreground">Edit Purchase Order</h2>
          <p className="text-muted-foreground mt-1">Update the details for {po.po_number}</p>
        </div>

        {/* Rejection Alert */}
        {po.status === 'REJECTED' && po.rejection_reason && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Previous Rejection Reason:</strong> {po.rejection_reason}
            </AlertDescription>
          </Alert>
        )}

        {/* PO Number Card */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Purchase Order Number</p>
                <p className="text-2xl font-mono font-bold text-primary">{po.po_number}</p>
              </div>
              <POStatusBadge status={po.status} />
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
                <Label htmlFor="notes">Notes</Label>
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
                onClick={() => navigate(`/pos/${po.id}`)}
                disabled={loading}
              >
                Cancel
              </Button>
              <div className="flex gap-2">
                {po.status === 'DRAFT' && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleSubmit(false)}
                    disabled={loading}
                    className="border-primary text-primary hover:bg-primary/5"
                  >
                    Save Changes
                  </Button>
                )}
                <Button
                  type="button"
                  onClick={() => handleSubmit(true)}
                  disabled={loading}
                >
                  {loading ? 'Submitting...' : po.status === 'REJECTED' ? 'Resubmit for Approval' : 'Submit for Approval'}
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
