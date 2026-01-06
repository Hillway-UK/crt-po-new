import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { useApprovalWorkflow } from '@/hooks/useApprovalWorkflow';
import { UserRole } from '@/types';
import { AlertTriangle, Loader2, Workflow } from 'lucide-react';
import { WorkflowThresholdSettings } from '@/components/workflows/WorkflowThresholdSettings';
import { WorkflowList } from '@/components/workflows/WorkflowList';
import { WorkflowStepDialog } from '@/components/workflows/WorkflowStepDialog';

export default function WorkflowSettings() {
  const { user } = useAuth();
  const {
    workflows,
    workflowSettings,
    loading,
    updateWorkflowSettings,
    createWorkflow,
    deleteWorkflow,
    addWorkflowStep,
    deleteWorkflowStep,
    setDefaultWorkflow,
    getApplicableSteps,
  } = useApprovalWorkflow();

  const [addStepDialogOpen, setAddStepDialogOpen] = useState(false);
  const [selectedWorkflowForStep, setSelectedWorkflowForStep] = useState<string | null>(null);

  const handleSaveThresholds = async (autoApprove: number | null, ceoThreshold: number | null) => {
    await updateWorkflowSettings({
      auto_approve_below_amount: autoApprove,
      require_ceo_above_amount: ceoThreshold,
    });
  };

  const handleCreateWorkflow = async (name: string): Promise<boolean> => {
    const result = await createWorkflow(name);
    return !!result;
  };

  const handleAddStepClick = (workflowId: string) => {
    setSelectedWorkflowForStep(workflowId);
    setAddStepDialogOpen(true);
  };

  const handleAddStep = async (
    workflowId: string,
    step: {
      step_order: number;
      approver_role: UserRole;
      skip_if_below_amount: number | null;
      min_amount: number | null;
      max_amount: number | null;
      is_required: boolean;
    }
  ) => {
    await addWorkflowStep(workflowId, step);
  };

  const getRoleBadge = (role: UserRole) => {
    const colors: Record<UserRole, string> = {
      PROPERTY_MANAGER: 'bg-blue-100 text-blue-700',
      MD: 'bg-purple-100 text-purple-700',
      CEO: 'bg-orange-100 text-orange-700',
      ACCOUNTS: 'bg-green-100 text-green-700',
      ADMIN: 'bg-red-100 text-red-700',
    };
    const labels: Record<UserRole, string> = {
      PROPERTY_MANAGER: 'PM',
      MD: 'MD',
      CEO: 'CEO',
      ACCOUNTS: 'Accounts',
      ADMIN: 'Admin',
    };
    return <Badge className={colors[role]}>{labels[role]}</Badge>;
  };

  if (user?.role !== 'ADMIN' && user?.role !== 'CEO') {
    return (
      <MainLayout title="Workflow Settings">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Access denied. Admin or CEO only.</div>
        </div>
      </MainLayout>
    );
  }

  if (loading) {
    return (
      <MainLayout title="Workflow Settings">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  const currentWorkflow = workflows.find(w => w.id === selectedWorkflowForStep);
  const currentStepCount = currentWorkflow?.steps?.length || 0;

  return (
    <MainLayout title="Workflow Settings">
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Workflow className="h-8 w-8 text-primary" />
          <div>
            <h2 className="text-3xl font-bold text-foreground">Approval Workflows</h2>
            <p className="text-muted-foreground">Configure custom approval thresholds and multi-step workflows</p>
          </div>
        </div>

        {/* Quick Threshold Settings */}
        <WorkflowThresholdSettings
          autoApproveAmount={workflowSettings.auto_approve_below_amount}
          ceoThresholdAmount={workflowSettings.require_ceo_above_amount}
          onSaveThresholds={handleSaveThresholds}
          getApplicableSteps={getApplicableSteps}
          getRoleBadge={getRoleBadge}
        />

        {/* Custom Workflows Toggle */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Custom Approval Workflows</CardTitle>
                <CardDescription>
                  Enable to create complex multi-step approval workflows with custom conditions
                </CardDescription>
              </div>
              <Switch
                checked={workflowSettings.use_custom_workflows}
                onCheckedChange={(checked) => updateWorkflowSettings({ use_custom_workflows: checked })}
              />
            </div>
          </CardHeader>
        </Card>

        {/* Custom Workflows Section */}
        {workflowSettings.use_custom_workflows && (
          <WorkflowList
            workflows={workflows}
            onCreateWorkflow={handleCreateWorkflow}
            onDeleteWorkflow={deleteWorkflow}
            onSetDefaultWorkflow={setDefaultWorkflow}
            onAddStepClick={handleAddStepClick}
            onDeleteStep={deleteWorkflowStep}
            getRoleBadge={getRoleBadge}
          />
        )}

        {/* Add Step Dialog */}
        <WorkflowStepDialog
          open={addStepDialogOpen}
          onOpenChange={setAddStepDialogOpen}
          workflowId={selectedWorkflowForStep}
          currentStepCount={currentStepCount}
          onAddStep={handleAddStep}
        />

        {/* Help Section */}
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>How Approval Workflows Work</AlertTitle>
          <AlertDescription className="mt-2">
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>
                <strong>Quick Thresholds</strong> work independently - set simple rules for auto-approval and CEO escalation
              </li>
              <li>
                <strong>Custom Workflows</strong> give you full control over multi-step approval chains
              </li>
              <li>
                When both are enabled, custom workflows take precedence over quick thresholds
              </li>
              <li>
                The default workflow is used for all new POs; you can have different workflows for different scenarios
              </li>
            </ul>
          </AlertDescription>
        </Alert>
      </div>
    </MainLayout>
  );
}
