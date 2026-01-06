import { useCallback } from 'react';
import { UserRole } from '@/types';
import { useWorkflowSettings } from './useWorkflowSettings';
import { useWorkflowCRUD } from './useWorkflowCRUD';

/**
 * Hook for determining approval workflow logic based on amount and type
 */
export function useApprovalLogic() {
  const { settings } = useWorkflowSettings();
  const { workflows } = useWorkflowCRUD();

  /**
   * Determine which approval steps apply based on PO/Invoice amount
   */
  const getApplicableSteps = useCallback(
    (amount: number, workflowType: 'PO' | 'INVOICE' = 'PO') => {
      if (!settings.use_custom_workflows) {
        // Default workflow logic
        const steps: { role: UserRole; required: boolean }[] = [];

        // Check auto-approve threshold
        if (
          settings.auto_approve_below_amount &&
          amount < settings.auto_approve_below_amount
        ) {
          // Auto-approve - no steps needed (PM can approve directly)
          return steps;
        }

        // MD approval always required for standard flow
        steps.push({ role: 'MD', required: true });

        // CEO approval if above threshold
        if (
          settings.require_ceo_above_amount &&
          amount >= settings.require_ceo_above_amount
        ) {
          steps.push({ role: 'CEO', required: true });
        }

        return steps;
      }

      // Custom workflow logic
      const defaultWorkflow = workflows.find(
        (w) => w.workflow_type === workflowType && w.is_default && w.is_active
      );

      if (!defaultWorkflow?.steps) {
        return [{ role: 'MD' as UserRole, required: true }];
      }

      return defaultWorkflow.steps
        .filter((step) => {
          if (step.skip_if_below_amount && amount < step.skip_if_below_amount) return false;
          if (step.min_amount && amount < step.min_amount) return false;
          if (step.max_amount && amount > step.max_amount) return false;
          return true;
        })
        .sort((a, b) => a.step_order - b.step_order)
        .map((step) => ({
          role: step.approver_role,
          required: step.is_required,
        }));
    },
    [settings, workflows]
  );

  return {
    getApplicableSteps,
    settings,
    workflows,
  };
}
