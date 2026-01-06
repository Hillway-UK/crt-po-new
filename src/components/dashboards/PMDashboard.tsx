import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { POStatusBadge } from '@/components/po/POStatusBadge';
import type { PurchaseOrder } from '@/types';

interface PMDashboardProps {
  user: any;
}

export function PMDashboard({ user }: PMDashboardProps) {
  const navigate = useNavigate();
  const { data: stats } = useQuery({
    queryKey: ['pm-dashboard-stats', user.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_pm_dashboard_stats', {
        user_id: user.id,
      });
      if (error) throw error;
      return data as any;
    },
  });

  const { data: recentPOs } = useQuery({
    queryKey: ['recent-pos', user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('*, contractor:contractors(*)')
        .eq('created_by_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data as PurchaseOrder[];
    },
  });

  return (
    <MainLayout title="Dashboard">
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Welcome back, {user?.full_name}</h2>
          <p className="text-muted-foreground mt-2">{new Date().toLocaleDateString('en-GB', { dateStyle: 'full' })}</p>
        </div>

        <Button asChild>
          <Link to="/pos/new">
            <FileText className="mr-2 h-4 w-4" />
            Create New PO
          </Link>
        </Button>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/pos?status=DRAFT')}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Draft</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.draft_pos || 0}</div>
              <p className="text-xs text-muted-foreground">Continue editing</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/pos?status=PENDING_MD_APPROVAL')}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.pending_pos || 0}</div>
              <p className="text-xs text-muted-foreground">Awaiting MD approval</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/pos?status=APPROVED')}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.approved_pos || 0}</div>
              <p className="text-xs text-muted-foreground">This month</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/pos?status=REJECTED')}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rejected</CardTitle>
              <AlertCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.rejected_pos || 0}</div>
              <p className="text-xs text-muted-foreground">Needs attention</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Your latest purchase orders</CardDescription>
          </CardHeader>
          <CardContent>
            {recentPOs && recentPOs.length > 0 ? (
              <div className="space-y-3">
                {recentPOs.map((po) => (
                  <Link
                    key={po.id}
                    to={`/pos/${po.id}`}
                    className="block p-4 rounded-lg border hover:border-primary transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium">{po.po_number}</span>
                          <POStatusBadge status={po.status || 'DRAFT'} />
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{po.contractor?.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatCurrency(po.amount_inc_vat || 0)}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(po.created_at)}</p>
                      </div>
                    </div>
                  </Link>
                ))}
                <Button variant="link" asChild className="w-full">
                  <Link to="/pos">View all POs</Link>
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No recent purchase orders</p>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
