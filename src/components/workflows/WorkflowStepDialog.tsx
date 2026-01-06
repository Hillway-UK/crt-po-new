import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserRole } from '@/types';
import { Users, Crown, Building2, Settings } from 'lucide-react';

const ROLE_OPTIONS: { value: UserRole; label: string; icon: React.ReactNode }[] = [
  { value: 'PROPERTY_MANAGER', label: 'Property Manager', icon: <Building2 className="h-4 w-4" /> },
  { value: 'MD', label: 'Managing Director', icon: <Users className="h-4 w-4" /> },
  { value: 'CEO', label: 'CEO', icon: <Crown className="h-4 w-4" /> },
  { value: 'ADMIN', label: 'Admin', icon: <Settings className="h-4 w-4" /> },
];

interface WorkflowStepDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowId: string | null;
  currentStepCount: number;
  onAddStep: (workflowId: string, step: {
    step_order: number;
    approver_role: UserRole;
    skip_if_below_amount: number | null;
    min_amount: number | null;
    max_amount: number | null;
    is_required: boolean;
  }) => Promise<void>;
}

export function WorkflowStepDialog({
  open,
  onOpenChange,
  workflowId,
  currentStepCount,
  onAddStep,
}: WorkflowStepDialogProps) {
  const [approverRole, setApproverRole] = useState<UserRole>('MD');
  const [skipIfBelowAmount, setSkipIfBelowAmount] = useState('');

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setApproverRole('MD');
      setSkipIfBelowAmount('');
    }
  }, [open]);

  const handleAddStep = async () => {
    if (!workflowId) return;

    await onAddStep(workflowId, {
      step_order: currentStepCount + 1,
      approver_role: approverRole,
      skip_if_below_amount: skipIfBelowAmount ? parseFloat(skipIfBelowAmount) : null,
      min_amount: null,
      max_amount: null,
      is_required: true,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
              value={approverRole}
              onValueChange={(value) => setApproverRole(value as UserRole)}
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
            <Label>Skip if Amount Below (£)</Label>
            <Input
              type="number"
              placeholder="Leave empty for no threshold"
              value={skipIfBelowAmount}
              onChange={(e) => setSkipIfBelowAmount(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              This step will be skipped if the PO amount is below this value
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAddStep}>Add Step</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
