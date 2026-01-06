import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GitBranch, Plus, Trash2, ArrowRight, X } from 'lucide-react';
import { WorkflowCreateDialog } from './WorkflowCreateDialog';
import { UserRole } from '@/types';
import { formatCurrency } from '@/lib/formatters';

interface WorkflowStep {
  id: string;
  step_order: number;
  approver_role: UserRole;
  skip_if_below_amount?: number | null;
}

interface Workflow {
  id: string;
  name: string;
  is_default: boolean;
  is_active: boolean;
  workflow_type: string;
  steps?: WorkflowStep[];
}

interface WorkflowListProps {
  workflows: Workflow[];
  onCreateWorkflow: (name: string) => Promise<boolean>;
  onDeleteWorkflow: (workflowId: string) => Promise<void>;
  onSetDefaultWorkflow: (workflowId: string, workflowType: 'PO' | 'INVOICE') => Promise<void>;
  onAddStepClick: (workflowId: string) => void;
  onDeleteStep: (stepId: string) => Promise<void>;
  getRoleBadge: (role: UserRole) => React.ReactNode;
}

export function WorkflowList({
  workflows,
  onCreateWorkflow,
  onDeleteWorkflow,
  onSetDefaultWorkflow,
  onAddStepClick,
  onDeleteStep,
  getRoleBadge,
}: WorkflowListProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Workflow Definitions</CardTitle>
          <WorkflowCreateDialog onCreateWorkflow={onCreateWorkflow} />
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
                        onClick={() => onSetDefaultWorkflow(workflow.id, workflow.workflow_type as 'PO' | 'INVOICE')}
                      >
                        Set as Default
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onAddStepClick(workflow.id)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => onDeleteWorkflow(workflow.id)}
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
                              {step.skip_if_below_amount && (
                                <span className="text-xs text-muted-foreground">
                                  (skip if &lt; {formatCurrency(step.skip_if_below_amount)})
                                </span>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
                                onClick={() => onDeleteStep(step.id)}
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
  );
}
