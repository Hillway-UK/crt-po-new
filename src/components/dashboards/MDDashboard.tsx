import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/formatters';

interface MDDashboardProps {
  user: any;
}

export function MDDashboard({ user }: MDDashboardProps) {
  const { data: stats } = useQuery({
    queryKey: ['md-dashboard-stats', user.organisation_id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_md_dashboard_stats', {
        org_id: user.organisation_id,
      });
      if (error) throw error;
      return data as any;
    },
  });

  const hasPending = (stats?.pending_pos || 0) + (stats?.pending_invoices || 0) > 0;

  return (
    <MainLayout title="Dashboard">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-3xl font-bold text-foreground">Welcome back, {user?.full_name}</h2>
            <p className="text-muted-foreground mt-1">{new Date().toLocaleDateString('en-GB', { dateStyle: 'full' })}</p>
          </div>
          {hasPending && (
            <div className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">
              Requires Attention
            </div>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-l-4 border-l-amber-400">
            <CardHeader>
              <CardTitle>Pending Approvals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">Purchase Orders</span>
                <span className="text-2xl font-bold">{stats?.pending_pos || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Invoices</span>
                <span className="text-2xl font-bold">{stats?.pending_invoices || 0}</span>
              </div>
              <Button asChild className="w-full">
                <Link to="/approvals">Review Now</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Today's Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm">POs Approved</span>
                <span className="font-medium">{stats?.approved_today || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Invoices Approved</span>
                <span className="font-medium">{stats?.invoices_approved_today || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Total Value</span>
                <span className="font-bold">{formatCurrency(stats?.approved_value_today || 0)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
