import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Contractor } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { z } from 'zod';

const contractorSchema = z.object({
  name: z.string().min(2, 'Company name must be at least 2 characters').max(100),
  contact_name: z.string().max(100).optional().or(z.literal('')),
  email: z.string().email('Please enter a valid email address').max(255),
  phone: z.string().max(20).optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
  default_payment_terms: z.number().min(0).max(365),
  notes: z.string().max(1000).optional().or(z.literal('')),
});

interface ContractorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractor?: Contractor;
  onSuccess: () => void;
}

export function ContractorDialog({ open, onOpenChange, contractor, onSuccess }: ContractorDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    name: '',
    contact_name: '',
    email: '',
    phone: '',
    address: '',
    default_payment_terms: 30,
    notes: '',
  });

  useEffect(() => {
    if (contractor) {
      setFormData({
        name: contractor.name,
        contact_name: contractor.contact_name || '',
        email: contractor.email,
        phone: contractor.phone || '',
        address: contractor.address || '',
        default_payment_terms: contractor.default_payment_terms,
        notes: contractor.notes || '',
      });
    } else {
      setFormData({
        name: '',
        contact_name: '',
        email: '',
        phone: '',
        address: '',
        default_payment_terms: 30,
        notes: '',
      });
    }
    setErrors({});
  }, [contractor, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      const validated = contractorSchema.parse(formData);

      const data: any = {
        name: validated.name,
        email: validated.email,
        default_payment_terms: validated.default_payment_terms,
        organisation_id: user?.organisation_id,
        contact_name: validated.contact_name || null,
        phone: validated.phone || null,
        address: validated.address || null,
        notes: validated.notes || null,
      };

      if (contractor) {
        const { error } = await supabase
          .from('contractors')
          .update(data)
          .eq('id', contractor.id);

        if (error) throw error;
        toast.success('Contractor updated successfully');
      } else {
        const { error } = await supabase
          .from('contractors')
          .insert([data]);

        if (error) throw error;
        toast.success('Contractor added successfully');
      }

      onSuccess();
      onOpenChange(false);
    } catch (err) {
      if (err instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        err.errors.forEach((error) => {
          if (error.path[0]) {
            fieldErrors[error.path[0].toString()] = error.message;
          }
        });
        setErrors(fieldErrors);
      } else {
        toast.error('Failed to save contractor');
        console.error(err);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto bg-card">
        <DialogHeader>
          <DialogTitle>{contractor ? 'Edit Contractor' : 'Add Contractor'}</DialogTitle>
          <DialogDescription>
            {contractor ? 'Update contractor information' : 'Add a new contractor to your system'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Company Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={errors.name ? 'border-destructive' : ''}
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact_name">Contact Name</Label>
            <Input
              id="contact_name"
              value={formData.contact_name}
              onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={errors.email ? 'border-destructive' : ''}
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment_terms">Default Payment Terms</Label>
            <div className="flex items-center gap-2">
              <Input
                id="payment_terms"
                type="number"
                min="0"
                max="365"
                value={formData.default_payment_terms}
                onChange={(e) => setFormData({ ...formData, default_payment_terms: parseInt(e.target.value) || 0 })}
                className="max-w-[120px]"
              />
              <span className="text-sm text-muted-foreground">days</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Contractor'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
