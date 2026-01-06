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

  const handleEditStep = (step: { 
    id: string; 
    step_order: number; 
    approver_role: UserRole; 
    min_amount?: number | null;
    requires_previous_approval?: boolean;
  }) => {
    setEditingStep({
      id: step.id,
      step_order: step.step_order,
      approver_role: step.approver_role,
      min_amount: step.min_amount ?? null,
      requires_previous_approval: step.requires_previous_approval ?? (step.step_order > 1),
    });
    setEditStepValues({
      approver_role: step.approver_role,
      min_amount: step.min_amount?.toString() || '',
      requires_previous_approval: step.requires_previous_approval ?? (step.step_order > 1),
    });
    setEditStepDialogOpen(true);
  };

  const handleSaveStep = async () => {
    if (!editingStep) return;

    await updateWorkflowStep(editingStep.id, {
      approver_role: editStepValues.approver_role,
      min_amount: editStepValues.min_amount ? parseFloat(editStepValues.min_amount) : 0,
      requires_previous_approval: editStepValues.requires_previous_approval,
    });

    setEditStepDialogOpen(false);
    setEditingStep(null);
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
            <p className="text-muted-foreground">Configure threshold-based approval workflows</p>
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
                  Enable to create threshold-based approval workflows with custom steps
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

        {/* Edit Step Dialog */}
        <Dialog open={editStepDialogOpen} onOpenChange={setEditStepDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Approval Step</DialogTitle>
              <DialogDescription>
                Modify the threshold-based approval step
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Approver Role</Label>
                <Select
                  value={editStepValues.approver_role}
                  onValueChange={(value) => setEditStepValues({ ...editStepValues, approver_role: value as UserRole })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map(role => (
                      <SelectItem key={role.value} value={role.value}>
                        <div className="flex items-center gap-2">
                          {role.icon}
                          {role.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Threshold Amount (£)</Label>
                <Input
                  type="number"
                  placeholder="e.g., 5000"
                  value={editStepValues.min_amount}
                  onChange={(e) => setEditStepValues({ ...editStepValues, min_amount: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  This step applies when PO amount is ≥ this threshold
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="edit-requires-previous"
                  checked={editStepValues.requires_previous_approval}
                  onCheckedChange={(checked) => 
                    setEditStepValues({ ...editStepValues, requires_previous_approval: checked as boolean })
                  }
                />
                <Label htmlFor="edit-requires-previous" className="text-sm font-normal">
                  Requires previous step approval first (sequential)
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditStepDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveStep}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Help Section */}
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>How Threshold-Based Workflows Work</AlertTitle>
          <AlertDescription className="mt-2">
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>
                <strong>Each step has a threshold</strong> - the minimum amount that triggers that approval step
              </li>
              <li>
                <strong>Sequential approval</strong> - when enabled, higher-level approvers require lower-level approval first (e.g., MD → CEO)
              </li>
              <li>
                <strong>Example:</strong> PM at £0, MD at £5,000, CEO at £15,000 means:
                <ul className="list-disc list-inside ml-4 mt-1 text-muted-foreground">
                  <li>£4,000 PO → PM only</li>
                  <li>£10,000 PO → MD only</li>
                  <li>£20,000 PO → MD first, then CEO</li>
                </ul>
              </li>
              <li>
                Changes take effect immediately for new POs
              </li>
            </ul>
          </AlertDescription>
        </Alert>
      </div>
    </MainLayout>
  );
}
