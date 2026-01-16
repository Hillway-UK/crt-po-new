import { useState, useEffect, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PurchaseOrder, Invoice } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Clock } from 'lucide-react';
import { POApprovalsSection } from '@/components/approvals/POApprovalsSection';
import { InvoiceApprovalsSection } from '@/components/approvals/InvoiceApprovalsSection';
import { useAuth } from '@/contexts/AuthContext';
import { useDelegation } from '@/hooks/useDelegation';

export default function Approvals() {
  const { user } = useAuth();
  const { isActiveDelegate } = useDelegation();
  const [allPendingPOs, setAllPendingPOs] = useState<PurchaseOrder[]>([]);
  const [pendingInvoices, setPendingInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.organisation_id) {
      fetchPendingPOs();
      fetchPendingInvoices();
    }
  }, [user?.organisation_id]);

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
            <POApprovalsSection
              pendingPOs={pendingPOs}
              loading={loading}
              onRefresh={fetchPendingPOs}
            />
          </TabsContent>

          <TabsContent value="invoices" className="space-y-4">
            <InvoiceApprovalsSection
              pendingInvoices={pendingInvoices}
              loading={loading}
              onRefresh={fetchPendingInvoices}
            />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
