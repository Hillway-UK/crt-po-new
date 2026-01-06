import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/formatters';

interface AccountsDashboardProps {
  user: any;
}

export function AccountsDashboard({ user }: AccountsDashboardProps) {
  const navigate = useNavigate();
  const { data: stats } = useQuery({
    queryKey: ['accounts-dashboard-stats', user.organisation_id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_accounts_dashboard_stats', {
        org_id: user.organisation_id,
      });
      if (error) throw error;
      return data as any;
    },
  });

  return (
    <MainLayout title="Dashboard">
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Welcome back, {user?.full_name}</h2>
          <p className="text-muted-foreground mt-2">{new Date().toLocaleDateString('en-GB', { dateStyle: 'full' })}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/pos?status=APPROVED')}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Awaiting Invoice</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.awaiting_invoice || 0}</div>
              <p className="text-xs text-muted-foreground">Approved POs</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => window.location.href = '/invoices?status=UPLOADED'}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Needs Matching</CardTitle>
              <AlertCircle className="h-4 w-4 text-gray-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.needs_matching || 0}</div>
              <p className="text-xs text-muted-foreground">Match to PO</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => window.location.href = '/invoices?status=PENDING_MD_APPROVAL'}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
              <Clock className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.pending_approval || 0}</div>
              <p className="text-xs text-muted-foreground">Awaiting MD</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => window.location.href = '/invoices?status=APPROVED_FOR_PAYMENT'}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ready to Pay</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.ready_to_pay || 0}</div>
              <p className="text-xs text-muted-foreground">{formatCurrency(stats?.ready_to_pay_value || 0)}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Button asChild>
            <Link to="/invoices">
              <FileText className="mr-2 h-4 w-4" />
              Upload Invoice
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/invoices">View All Invoices</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/contractors">Manage Contractors</Link>
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}
