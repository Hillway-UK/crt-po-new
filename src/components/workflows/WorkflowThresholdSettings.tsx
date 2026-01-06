import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GitBranch } from 'lucide-react';
import { WorkflowPreview } from './WorkflowPreview';
import { UserRole } from '@/types';

interface WorkflowThresholdSettingsProps {
  autoApproveAmount: number | null;
  ceoThresholdAmount: number | null;
  onSaveThresholds: (autoApprove: number | null, ceoThreshold: number | null) => Promise<void>;
  getApplicableSteps: (amount: number) => Array<{ role: UserRole }>;
  getRoleBadge: (role: UserRole) => React.ReactNode;
}

export function WorkflowThresholdSettings({
  autoApproveAmount,
  ceoThresholdAmount,
  onSaveThresholds,
  getApplicableSteps,
  getRoleBadge,
}: WorkflowThresholdSettingsProps) {
  const [localAutoApprove, setLocalAutoApprove] = useState('');
  const [localCeoThreshold, setLocalCeoThreshold] = useState('');

  // Sync local state with props
  useEffect(() => {
    setLocalAutoApprove(autoApproveAmount?.toString() || '');
    setLocalCeoThreshold(ceoThresholdAmount?.toString() || '');
  }, [autoApproveAmount, ceoThresholdAmount]);

  const handleSave = async () => {
    const autoApprove = localAutoApprove ? parseFloat(localAutoApprove) : null;
    const ceoThreshold = localCeoThreshold ? parseFloat(localCeoThreshold) : null;
    await onSaveThresholds(autoApprove, ceoThreshold);
  };

  const previewAmounts = [3000, 10000, 20000];

  return (
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
              value={localAutoApprove}
              onChange={(e) => setLocalAutoApprove(e.target.value)}
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
              value={localCeoThreshold}
              onChange={(e) => setLocalCeoThreshold(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              POs above this amount require CEO approval after MD
            </p>
          </div>
        </div>

        <Button onClick={handleSave}>Save Thresholds</Button>

        <WorkflowPreview
          previewAmounts={previewAmounts}
          getApplicableSteps={getApplicableSteps}
          getRoleBadge={getRoleBadge}
        />
      </CardContent>
    </Card>
  );
}
