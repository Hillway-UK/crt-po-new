import { useQuery } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { POStatusBadge } from '@/components/po/POStatusBadge';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { Link } from 'react-router-dom';
import type { PurchaseOrder, Invoice, POStatus, InvoiceStatus } from '@/types';
import { Badge } from '@/components/ui/badge';

export default function Approvals() {
  const { user } = useAuth();

  const { data: pendingPOs = [] } = useQuery({
    queryKey: ['pending-pos-approval'],
    queryFn: async () => {
      const statuses = user?.role === 'CEO' 
        ? ['PENDING_CEO_APPROVAL'] 
        : ['PENDING_MD_APPROVAL', 'PENDING_CEO_APPROVAL'];
      
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('*, contractor:contractors(*), property:properties(*), created_by:users!purchase_orders_created_by_user_id_fkey(*)')
        .in('status', statuses)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as PurchaseOrder[];
    },
    enabled: !!user,
  });

  const { data: pendingInvoices = [] } = useQuery({
    queryKey: ['pending-invoices-approval'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*, contractor:contractors(*), purchase_order:purchase_orders(*)')
        .eq('status', 'PENDING_MD_APPROVAL')
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as Invoice[];
    },
    enabled: !!user,
  });

  const getInvoiceStatusBadge = (status: InvoiceStatus) => {
    const config: Record<InvoiceStatus, { label: string; className: string }> = {
      UPLOADED: { label: 'Uploaded', className: 'bg-muted text-muted-foreground' },
      MATCHED: { label: 'Matched', className: 'bg-blue-100 text-blue-700' },
      PENDING_MD_APPROVAL: { label: 'Pending Approval', className: 'bg-amber-100 text-amber-700' },
      APPROVED_FOR_PAYMENT: { label: 'Ready to Pay', className: 'bg-green-100 text-green-700' },
      PAID: { label: 'Paid', className: 'bg-green-100 text-green-700' },
      REJECTED: { label: 'Rejected', className: 'bg-red-100 text-red-700' },
    };
    const { label, className } = config[status] || config.UPLOADED;
    return <Badge className={className}>{label}</Badge>;
  };

  return (
    <MainLayout title="Approvals">
      <Tabs defaultValue="pos" className="space-y-6">
        <TabsList>
          <TabsTrigger value="pos">
            Purchase Orders
            {pendingPOs.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {pendingPOs.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="invoices">
            Invoices
            {pendingInvoices.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {pendingInvoices.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pos" className="space-y-4">
          {pendingPOs.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground">No pending purchase orders</p>
              </CardContent>
            </Card>
          ) : (
            pendingPOs.map((po) => (
              <Link key={po.id} to={`/pos/${po.id}`}>
                <Card className="hover:border-primary transition-colors cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-semibold text-lg">{po.po_number}</span>
                          <POStatusBadge status={(po.status as POStatus) || 'DRAFT'} />
                        </div>
                        <p className="text-muted-foreground mt-1">{po.contractor?.name}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Submitted by {po.created_by?.full_name}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold">{formatCurrency(po.amount_inc_vat || 0)}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(po.created_at)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </TabsContent>

        <TabsContent value="invoices" className="space-y-4">
          {pendingInvoices.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground">No pending invoices</p>
              </CardContent>
            </Card>
          ) : (
            pendingInvoices.map((invoice) => (
              <Link key={invoice.id} to={`/invoices/${invoice.id}`}>
                <Card className="hover:border-primary transition-colors cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-semibold text-lg">{invoice.invoice_number}</span>
                          {getInvoiceStatusBadge((invoice.status as InvoiceStatus) || 'UPLOADED')}
                        </div>
                        <p className="text-muted-foreground mt-1">{invoice.contractor?.name}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          PO: {invoice.purchase_order?.po_number}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold">{formatCurrency(invoice.amount_inc_vat || 0)}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(invoice.invoice_date)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
