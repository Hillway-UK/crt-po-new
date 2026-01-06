import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { PMDashboard } from '@/components/dashboards/PMDashboard';
import { MDDashboard } from '@/components/dashboards/MDDashboard';
import { AccountsDashboard } from '@/components/dashboards/AccountsDashboard';
import { AdminDashboard } from '@/components/dashboards/AdminDashboard';

/**
 * Dashboard router component that displays the appropriate dashboard
 * based on the user's role
 */
export default function Dashboard() {
  const { user } = useAuth();

  if (!user) {
    return (
      <MainLayout title="Dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </MainLayout>
    );
  }

  // Route to appropriate dashboard based on role
  switch (user.role) {
    case 'PROPERTY_MANAGER':
      return <PMDashboard user={user} />;
    case 'MD':
    case 'CEO':
      return <MDDashboard user={user} />;
    case 'ACCOUNTS':
      return <AccountsDashboard user={user} />;
    case 'ADMIN':
      return <AdminDashboard user={user} />;
    default:
      return <PMDashboard user={user} />;
  }
}
