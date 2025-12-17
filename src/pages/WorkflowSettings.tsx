import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { useApprovalWorkflow } from '@/hooks/useApprovalWorkflow';
import { UserRole } from '@/types';
import { formatCurrency } from '@/lib/formatters';
import { 
  GitBranch, 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  X, 
  AlertTriangle,
  ArrowRight,
  Users,
  Crown,
  Building2,
  Loader2,
  Settings,
  Workflow
} from 'lucide-react';
import { toast } from 'sonner';

const ROLE_OPTIONS: { value: UserRole; label: string; icon: React.ReactNode }[] = [
  { value: 'PROPERTY_MANAGER', label: 'Property Manager', icon: <Building2 className="h-4 w-4" /> },
  { value: 'MD', label: 'Managing Director', icon: <Users className="h-4 w-4" /> },
  { value: 'CEO', label: 'CEO', icon: <Crown className="h-4 w-4" /> },
  { value: 'ADMIN', label: 'Admin', icon: <Settings className="h-4 w-4" /> },
];

export default function WorkflowSettings() {
  const { user } = useAuth();
  const {
    workflows,
    workflowSettings,
    loading,
    updateWorkflowSettings,
    createWorkflow,
    updateWorkflow,
    deleteWorkflow,
    addWorkflowStep,
    updateWorkflowStep,
    deleteWorkflowStep,
    setDefaultWorkflow,
    getApplicableSteps,
  } = useApprovalWorkflow();

  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<string | null>(null);
  const [addStepDialogOpen, setAddStepDialogOpen] = useState(false);
  const [selectedWorkflowForStep, setSelectedWorkflowForStep] = useState<string | null>(null);
  const [newStep, setNewStep] = useState({
    approver_role: 'MD' as UserRole,
    skip_if_below_amount: '',
    min_amount: '',
    max_amount: '',
  });

  const [autoApproveAmount, setAutoApproveAmount] = useState('');
  const [ceoThresholdAmount, setCeoThresholdAmount] = useState('');

  // Sync local state with fetched settings
  useEffect(() => {
    setAutoApproveAmount(workflowSettings.auto_approve_below_amount?.toString() || '');
    setCeoThresholdAmount(workflowSettings.require_ceo_above_amount?.toString() || '');
  }, [workflowSettings.auto_approve_below_amount, workflowSettings.require_ceo_above_amount]);

  // Example amounts for preview
  const previewAmounts = [3000, 10000, 20000];

  if (user?.role !== 'ADMIN' && user?.role !== 'CEO') {
    return (
      <MainLayout title="Workflow Settings">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Access denied. Admin or CEO only.</div>
        </div>
      </MainLayout>
    );
  }

  const handleSaveThresholds = async () => {
    const updates: any = {};
    
    if (autoApproveAmount) {
      updates.auto_approve_below_amount = parseFloat(autoApproveAmount);
    } else {
      updates.auto_approve_below_amount = null;
    }
    
    if (ceoThresholdAmount) {
      updates.require_ceo_above_amount = parseFloat(ceoThresholdAmount);
    } else {
      updates.require_ceo_above_amount = null;
    }
    
    await updateWorkflowSettings(updates);
  };

  const handleCreateWorkflow = async () => {
    if (!newWorkflowName.trim()) {
      toast.error('Please enter a workflow name');
      return;
    }
    
    const result = await createWorkflow(newWorkflowName);
    if (result) {
      setNewWorkflowName('');
      setCreateDialogOpen(false);
    }
  };

  const handleAddStep = async () => {
    if (!selectedWorkflowForStep) return;

    const workflow = workflows.find(w => w.id === selectedWorkflowForStep);
    const currentSteps = workflow?.steps?.length || 0;

    await addWorkflowStep(selectedWorkflowForStep, {
      step_order: currentSteps + 1,
      approver_role: newStep.approver_role,
      skip_if_below_amount: newStep.skip_if_below_amount ? parseFloat(newStep.skip_if_below_amount) : null,
      min_amount: newStep.min_amount ? parseFloat(newStep.min_amount) : null,
      max_amount: newStep.max_amount ? parseFloat(newStep.max_amount) : null,
      is_required: true,
    });

    setNewStep({
      approver_role: 'MD',
      skip_if_below_amount: '',
      min_amount: '',
      max_amount: '',
    });
    setAddStepDialogOpen(false);
    setSelectedWorkflowForStep(null);
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

  if (loading) {
    return (
      <MainLayout title="Workflow Settings">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              Quick Threshold Settings
            </CardTitle>
            <CardDescription>
              Set simple amount-based rules without custom workflows
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="auto-approve">Auto-Approve Below (£)</Label>
                <Input
                  id="auto-approve"
                  type="number"
                  placeholder="e.g., 5000"
                  value={autoApproveAmount}
                  onChange={(e) => setAutoApproveAmount(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  POs below this amount can be approved directly by the PM
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="ceo-threshold">Require CEO Approval Above (£)</Label>
                <Input
                  id="ceo-threshold"
                  type="number"
                  placeholder="e.g., 15000"
                  value={ceoThresholdAmount}
                  onChange={(e) => setCeoThresholdAmount(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  POs above this amount require CEO approval after MD
                </p>
              </div>
            </div>

            <Button onClick={handleSaveThresholds}>Save Thresholds</Button>

            {/* Preview */}
            <div className="border rounded-lg p-4 bg-muted/30">
              <h4 className="font-medium mb-3">Preview: Approval Flow by Amount</h4>
              <div className="space-y-2">
                {previewAmounts.map(amount => {
                  const steps = getApplicableSteps(amount);
                  return (
                    <div key={amount} className="flex items-center gap-2 text-sm">
                      <span className="font-mono w-24">{formatCurrency(amount)}</span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      {steps.length === 0 ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700">
                          Auto-Approved
                        </Badge>
                      ) : (
                        <div className="flex items-center gap-1">
                          {steps.map((step, idx) => (
                            <div key={idx} className="flex items-center gap-1">
                              {idx > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                              {getRoleBadge(step.role)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

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
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Workflow Definitions</CardTitle>
                <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      New Workflow
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Workflow</DialogTitle>
                      <DialogDescription>
                        Create a new approval workflow for purchase orders or invoices
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Workflow Name</Label>
                        <Input
                          placeholder="e.g., Standard PO Approval"
                          value={newWorkflowName}
                          onChange={(e) => setNewWorkflowName(e.target.value)}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleCreateWorkflow}>Create</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {workflows.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <GitBranch className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No workflows created yet</p>
                  <p className="text-sm">Create your first workflow to get started</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {workflows.map(workflow => (
                    <div key={workflow.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{workflow.name}</h4>
                          {workflow.is_default && (
                            <Badge variant="secondary">Default</Badge>
                          )}
                          {!workflow.is_active && (
                            <Badge variant="outline" className="text-muted-foreground">
                              Inactive
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {!workflow.is_default && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setDefaultWorkflow(workflow.id, workflow.workflow_type as 'PO' | 'INVOICE')}
                            >
                              Set as Default
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedWorkflowForStep(workflow.id);
                              setAddStepDialogOpen(true);
                            }}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => deleteWorkflow(workflow.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Steps */}
                      <div className="space-y-2">
                        {workflow.steps && workflow.steps.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-2">
                            {workflow.steps
                              .sort((a, b) => a.step_order - b.step_order)
                              .map((step, idx) => (
                                <div key={step.id} className="flex items-center gap-2">
                                  {idx > 0 && (
                                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                  )}
                                  <div className="flex items-center gap-1 border rounded-md px-2 py-1 bg-muted/30">
                                    <span className="text-xs text-muted-foreground mr-1">
                                      Step {step.step_order}:
                                    </span>
                                    {getRoleBadge(step.approver_role)}
                                    {(step.min_amount !== null || step.max_amount !== null) && (
                                      <span className="text-xs text-muted-foreground">
                                        ({step.min_amount !== null ? formatCurrency(step.min_amount) : '£0'} - {step.max_amount !== null ? formatCurrency(step.max_amount) : '∞'})
                                      </span>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
                                      onClick={() => deleteWorkflowStep(step.id)}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No steps configured</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Add Step Dialog */}
        <Dialog open={addStepDialogOpen} onOpenChange={setAddStepDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Approval Step</DialogTitle>
              <DialogDescription>
                Configure a new approval step for the workflow
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Approver Role</Label>
                <Select
                  value={newStep.approver_role}
                  onValueChange={(value) => setNewStep({ ...newStep, approver_role: value as UserRole })}
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Minimum Amount (£)</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 0"
                    value={newStep.min_amount}
                    onChange={(e) => setNewStep({ ...newStep, min_amount: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Lower bound of the interval
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Maximum Amount (£)</Label>
                  <Input
                    type="number"
                    placeholder="No limit"
                    value={newStep.max_amount}
                    onChange={(e) => setNewStep({ ...newStep, max_amount: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Upper bound (empty = unlimited)
                  </p>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddStepDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddStep}>Add Step</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
