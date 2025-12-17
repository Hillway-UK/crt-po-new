import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { useState } from 'react';
import type { Invoice, InvoiceStatus } from '@/types';
import { Badge } from '@/components/ui/badge';

export default function Invoices() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');

  const statusFilter = searchParams.get('status') || 'all';

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('invoices')
        .select('*, contractor:contractors(*), purchase_order:purchase_orders(*)')
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Invoice[];
    },
    enabled: !!user,
  });

  const filteredInvoices = invoices.filter(invoice => 
    invoice.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
    invoice.contractor?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusBadge = (status: InvoiceStatus) => {
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
    <MainLayout title="Invoices">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div className="flex gap-4 flex-1">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search invoices..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={(value) => setSearchParams({ status: value })}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="UPLOADED">Uploaded</SelectItem>
                <SelectItem value="MATCHED">Matched</SelectItem>
                <SelectItem value="PENDING_MD_APPROVAL">Pending Approval</SelectItem>
                <SelectItem value="APPROVED_FOR_PAYMENT">Ready to Pay</SelectItem>
                <SelectItem value="PAID">Paid</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground">Loading...</div>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground">No invoices found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredInvoices.map((invoice) => (
              <Link key={invoice.id} to={`/invoices/${invoice.id}`}>
                <Card className="hover:border-primary transition-colors cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-semibold text-lg">{invoice.invoice_number}</span>
                          {getStatusBadge((invoice.status as InvoiceStatus) || 'UPLOADED')}
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
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
