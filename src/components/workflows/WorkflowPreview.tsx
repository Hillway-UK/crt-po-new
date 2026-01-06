import { Badge } from '@/components/ui/badge';
import { UserRole } from '@/types';
import { formatCurrency } from '@/lib/formatters';
import { ArrowRight } from 'lucide-react';

interface WorkflowPreviewProps {
  previewAmounts: number[];
  getApplicableSteps: (amount: number) => Array<{ role: UserRole }>;
  getRoleBadge: (role: UserRole) => React.ReactNode;
}

export function WorkflowPreview({ previewAmounts, getApplicableSteps, getRoleBadge }: WorkflowPreviewProps) {
  return (
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
  );
}
