import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PurchaseOrder, Invoice } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Clock } from 'lucide-react';
import { POApprovalsSection } from '@/components/approvals/POApprovalsSection';
import { InvoiceApprovalsSection } from '@/components/approvals/InvoiceApprovalsSection';

export default function Approvals() {
  const [pendingPOs, setPendingPOs] = useState<PurchaseOrder[]>([]);
  const [pendingInvoices, setPendingInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPendingPOs();
    fetchPendingInvoices();
  }, []);

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
        .in('status', ['PENDING_MD_APPROVAL', 'PENDING_CEO_APPROVAL'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPendingPOs(data as any || []);
    } catch (error) {
      toast.error('Failed to load pending approvals');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

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
