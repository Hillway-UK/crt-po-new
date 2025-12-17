import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { POStatusBadge } from '@/components/po/POStatusBadge';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { useState } from 'react';
import type { PurchaseOrder, POStatus } from '@/types';

export default function PurchaseOrders() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');

  const statusFilter = searchParams.get('status') || 'all';

  const { data: purchaseOrders = [], isLoading } = useQuery({
    queryKey: ['purchase-orders', user?.id, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('purchase_orders')
        .select('*, contractor:contractors(*), property:properties(*)')
        .order('created_at', { ascending: false });

      if (user?.role === 'PROPERTY_MANAGER') {
        query = query.eq('created_by_user_id', user.id);
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as PurchaseOrder[];
    },
    enabled: !!user,
  });

  const filteredPOs = purchaseOrders.filter(po => 
    po.po_number.toLowerCase().includes(search.toLowerCase()) ||
    po.contractor?.name?.toLowerCase().includes(search.toLowerCase()) ||
    po.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <MainLayout title="Purchase Orders">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div className="flex gap-4 flex-1">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search POs..."
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
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="PENDING_MD_APPROVAL">Pending MD</SelectItem>
                <SelectItem value="PENDING_CEO_APPROVAL">Pending CEO</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {user?.role === 'PROPERTY_MANAGER' && (
            <Button asChild>
              <Link to="/pos/new">
                <Plus className="mr-2 h-4 w-4" />
                Create PO
              </Link>
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground">Loading...</div>
          </div>
        ) : filteredPOs.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground mb-4">No purchase orders found</p>
              {user?.role === 'PROPERTY_MANAGER' && (
                <Button asChild>
                  <Link to="/pos/new">Create your first PO</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredPOs.map((po) => (
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
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{po.description}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold">{formatCurrency(po.amount_inc_vat || 0)}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(po.created_at)}</p>
                        {po.property && (
                          <p className="text-xs text-muted-foreground">{po.property.name}</p>
                        )}
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
