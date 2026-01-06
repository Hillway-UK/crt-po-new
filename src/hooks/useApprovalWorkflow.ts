import { useWorkflowSettings } from './useWorkflowSettings';
import { useWorkflowCRUD } from './useWorkflowCRUD';
import { useApprovalLogic } from './useApprovalLogic';

/**
 * Convenience hook that combines all workflow management functionality.
 * This is a wrapper around the focused hooks for backward compatibility.
 *
 * For new code, consider using the focused hooks directly:
 * - useWorkflowSettings() - for settings management
 * - useWorkflowCRUD() - for workflow CRUD operations
 * - useApprovalLogic() - for approval business logic
 */
export function useApprovalWorkflow() {
  const settingsHook = useWorkflowSettings();
  const crudHook = useWorkflowCRUD();
  const logicHook = useApprovalLogic();

  return {
    // Settings
    workflowSettings: settingsHook.settings,
    updateWorkflowSettings: settingsHook.updateSettings,

    // Workflows
    workflows: crudHook.workflows,
    loading: settingsHook.loading || crudHook.loading,
    fetchWorkflows: crudHook.refetch,
    createWorkflow: crudHook.createWorkflow,
    updateWorkflow: crudHook.updateWorkflow,
    deleteWorkflow: crudHook.deleteWorkflow,

    // Workflow Steps
    addWorkflowStep: crudHook.addWorkflowStep,
    updateWorkflowStep: crudHook.updateWorkflowStep,
    deleteWorkflowStep: crudHook.deleteWorkflowStep,
    setDefaultWorkflow: crudHook.setDefaultWorkflow,

    // Business Logic
    getApplicableSteps: logicHook.getApplicableSteps,
  };
}
