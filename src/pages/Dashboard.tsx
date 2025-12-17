import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Clock, CheckCircle, AlertCircle, Users, DollarSign, TrendingUp } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { POStatusBadge } from '@/components/po/POStatusBadge';
import type { PurchaseOrder } from '@/types';

export default function Dashboard() {
  const { user } = useAuth();

  // Loading or no user - show loading state
  if (!user) {
    return (
      <MainLayout title="Dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </MainLayout>
    );
  }

  // Property Manager Dashboard
  if (user.role === 'PROPERTY_MANAGER') {
    return <PMDashboard user={user} />;
  }

  // MD Dashboard
  if (user.role === 'MD') {
    return <MDDashboard user={user} />;
  }

  // CEO Dashboard (same as MD - approval focused)
  if (user.role === 'CEO') {
    return <MDDashboard user={user} />;
  }

  // Accounts Dashboard
  if (user.role === 'ACCOUNTS') {
    return <AccountsDashboard user={user} />;
  }

  // Admin Dashboard
  if (user.role === 'ADMIN') {
    return <AdminDashboard user={user} />;
  }

  // Default to PM Dashboard
  return <PMDashboard user={user} />;
}

function PMDashboard({ user }: { user: any }) {
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

function MDDashboard({ user }: { user: any }) {
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

function AccountsDashboard({ user }: { user: any }) {
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

function AdminDashboard({ user }: { user: any }) {
  const navigate = useNavigate();
  const { data: stats } = useQuery({
    queryKey: ['admin-dashboard-stats', user.organisation_id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_admin_dashboard_stats', {
        org_id: user.organisation_id,
      });
      if (error) throw error;
      return data as any;
    },
  });

  const { data: mdStats } = useQuery({
    queryKey: ['md-dashboard-stats', user.organisation_id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_md_dashboard_stats', {
        org_id: user.organisation_id,
      });
      if (error) throw error;
      return data as any;
    },
  });

  const hasPending = (mdStats?.pending_pos || 0) + (mdStats?.pending_invoices || 0) > 0;

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

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/pos/new">
              <FileText className="mr-2 h-4 w-4" />
              Create New PO
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/invoices">View Invoices</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/approvals">Review Approvals</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/users">User Management</Link>
          </Button>
        </div>

        {/* Pending Approvals Section */}
        {hasPending && (
          <Card className="border-l-4 border-l-amber-400">
            <CardHeader>
              <CardTitle>Pending Approvals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">Purchase Orders</span>
                <span className="text-2xl font-bold">{mdStats?.pending_pos || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Invoices</span>
                <span className="text-2xl font-bold">{mdStats?.pending_invoices || 0}</span>
              </div>
              <Button asChild className="w-full">
                <Link to="/approvals">Review Now</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* System Overview Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/users')}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total_users || 0}</div>
              <p className="text-xs text-muted-foreground">Active users</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/pos')}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Purchase Orders</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total_pos || 0}</div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/invoices')}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Invoices</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total_invoices || 0}</div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Value</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats?.total_value_processed || 0)}</div>
              <p className="text-xs text-muted-foreground">Processed</p>
            </CardContent>
          </Card>
        </div>

        {stats?.users_by_role && (
          <Card>
            <CardHeader>
              <CardTitle>Users by Role</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(stats.users_by_role).map(([role, count]) => (
                  <div key={role} className="flex justify-between">
                    <span className="text-sm capitalize">{role.replace('_', ' ')}</span>
                    <span className="font-medium">{count as number}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
