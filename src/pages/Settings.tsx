import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';

export default function Settings() {
  const { user } = useAuth();

  return (
    <MainLayout title="Settings">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Organisation Settings</CardTitle>
            <CardDescription>Configure your organisation's settings</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Settings configuration coming soon.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Approval Workflows</CardTitle>
            <CardDescription>Configure approval thresholds and workflows</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Workflow configuration coming soon.</p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
