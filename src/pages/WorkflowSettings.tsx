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
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/AuthContext';
import { useApprovalWorkflow } from '@/hooks/useApprovalWorkflow';
import { UserRole } from '@/types';
import { formatCurrency } from '@/lib/formatters';
import { 
  GitBranch, 
  Plus, 
  Trash2, 
  Edit2, 
  X, 
  AlertTriangle,
  ArrowRight,
  Users,
  Crown,
  Building2,
  Loader2,
  Settings,
  Workflow,
  ChevronRight
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
    deleteWorkflow,
    addWorkflowStep,
    updateWorkflowStep,
    deleteWorkflowStep,
    setDefaultWorkflow,
    getApplicableSteps,
  } = useApprovalWorkflow();

  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [addStepDialogOpen, setAddStepDialogOpen] = useState(false);
  const [selectedWorkflowForStep, setSelectedWorkflowForStep] = useState<string | null>(null);
  const [newStep, setNewStep] = useState({
    approver_role: 'MD' as UserRole,
    min_amount: '',
    requires_previous_approval: true,
  });

  // Edit step state
  const [editStepDialogOpen, setEditStepDialogOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<{ 
    id: string; 
    step_order: number; 
    approver_role: UserRole; 
    min_amount: number | null;
    requires_previous_approval: boolean;
  } | null>(null);
  const [editStepValues, setEditStepValues] = useState({
    approver_role: 'MD' as UserRole,
    min_amount: '',
    requires_previous_approval: true,
  });

  const [autoApproveAmount, setAutoApproveAmount] = useState('');
  const [ceoThresholdAmount, setCeoThresholdAmount] = useState('');

  // Sync local state with fetched settings
  useEffect(() => {
    setAutoApproveAmount(workflowSettings.auto_approve_below_amount?.toString() || '');
    setCeoThresholdAmount(workflowSettings.require_ceo_above_amount?.toString() || '');
  }, [workflowSettings.auto_approve_below_amount, workflowSettings.require_ceo_above_amount]);

  // Example amounts for preview
  const previewAmounts = [3000, 8000, 18000];

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
      min_amount: newStep.min_amount ? parseFloat(newStep.min_amount) : 0,
      requires_previous_approval: newStep.requires_previous_approval,
      is_required: true,
    });

    setNewStep({
      approver_role: 'MD',
      min_amount: '',
      requires_previous_approval: true,
    });
    setAddStepDialogOpen(false);
    setSelectedWorkflowForStep(null);
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
            <p className="text-muted-foreground">Configure threshold-based approval workflows</p>
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
                <Label htmlFor="auto-approve">PM Can Approve Below (£)</Label>
                <Input
                  id="auto-approve"
                  type="number"
                  placeholder="e.g., 5000"
                  value={autoApproveAmount}
                  onChange={(e) => setAutoApproveAmount(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  POs below this amount can be approved directly by the PM. <span className="font-medium">Leave empty if all POs should require MD approval.</span>
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
                  POs above this amount require CEO approval after MD. <span className="font-medium">Leave empty if CEO approval should never be required.</span>
                </p>
              </div>
            </div>

            {/* Informational Alert */}
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>How Thresholds Work</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1 mt-2 text-sm">
                  <li><span className="font-medium">PM Threshold Empty:</span> All POs require MD approval as the starting point</li>
                  <li><span className="font-medium">PM Threshold Set:</span> POs below this amount only need PM approval</li>
                  <li><span className="font-medium">CEO Threshold Empty:</span> MD is the final approver for all amounts</li>
                  <li><span className="font-medium">CEO Threshold Set:</span> POs above this amount need MD → CEO approval chain</li>
                </ul>
              </AlertDescription>
            </Alert>

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
                              {idx > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
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
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Workflow Definitions</CardTitle>
                  <CardDescription>
                    Define threshold amounts for each approver role. Higher thresholds trigger sequential approval chains.
                  </CardDescription>
                </div>
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
                        Create a new threshold-based approval workflow
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

                      {/* Steps - Threshold Based Display */}
                      <div className="space-y-2">
                        {workflow.steps && workflow.steps.length > 0 ? (
                          <div className="space-y-2">
                            {workflow.steps
                              .sort((a, b) => a.step_order - b.step_order)
                              .map((step) => (
                                <div key={step.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-md">
                                  <div className="flex items-center gap-3">
                                    <span className="text-xs text-muted-foreground font-mono w-16">
                                      Step {step.step_order}
                                    </span>
                                    {getRoleBadge(step.approver_role)}
                                    <span className="text-sm text-muted-foreground">
                                      ≥ {formatCurrency(step.min_amount || 0)}
                                    </span>
                                    {(step as any).requires_previous_approval !== false && step.step_order > 1 && (
                                      <Badge variant="outline" className="text-xs">
                                        Sequential
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0"
                                      onClick={() => handleEditStep(step as any)}
                                    >
                                      <Edit2 className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
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

                      {/* Workflow Preview */}
                      {workflow.steps && workflow.steps.length > 0 && (
                        <div className="mt-4 pt-4 border-t">
                          <h5 className="text-sm font-medium mb-2">Approval Chain Preview</h5>
                          <div className="space-y-1">
                            {previewAmounts.map(amount => {
                              const steps = getApplicableSteps(amount);
                              return (
                                <div key={amount} className="flex items-center gap-2 text-xs">
                                  <span className="font-mono w-20">{formatCurrency(amount)}</span>
                                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                  <div className="flex items-center gap-1">
                                    {steps.map((step, idx) => (
                                      <div key={idx} className="flex items-center gap-1">
                                        {idx > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                                        {getRoleBadge(step.role)}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
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
                Configure a threshold-based approval step
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

              <div className="space-y-2">
                <Label>Threshold Amount (£)</Label>
                <Input
                  type="number"
                  placeholder="e.g., 5000"
                  value={newStep.min_amount}
                  onChange={(e) => setNewStep({ ...newStep, min_amount: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  This step applies when PO amount is ≥ this threshold
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="requires-previous"
                  checked={newStep.requires_previous_approval}
                  onCheckedChange={(checked) => 
                    setNewStep({ ...newStep, requires_previous_approval: checked as boolean })
                  }
                />
                <Label htmlFor="requires-previous" className="text-sm font-normal">
                  Requires previous step approval first (sequential)
                </Label>
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
