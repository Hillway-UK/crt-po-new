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

  /**
   * Determine the initial PO status and first approver based on workflow
   */
  const getInitialApprovalInfo = useCallback((amount: number): { 
    status: POStatus; 
    approverRole: UserRole | null; 
    emailType: string;
    approvalChain: { role: UserRole; required: boolean }[];
  } => {
    const steps = getApplicableSteps(amount, 'PO');
    
    // If no steps (shouldn't happen), default to MD
    if (steps.length === 0) {
      return { 
        status: 'PENDING_MD_APPROVAL', 
        approverRole: 'MD', 
        emailType: 'po_approval_request',
        approvalChain: [{ role: 'MD', required: true }]
      };
    }

    const firstStep = steps[0];
    
    // Determine status based on first approver role
    let status: POStatus;
    let emailType: string;
    
    switch (firstStep.role) {
      case 'PROPERTY_MANAGER':
        status = 'PENDING_PM_APPROVAL';
        emailType = 'po_pm_approval_request';
        break;
      case 'MD':
        status = 'PENDING_MD_APPROVAL';
        emailType = 'po_approval_request';
        break;
      case 'CEO':
        status = 'PENDING_CEO_APPROVAL';
        emailType = 'po_ceo_approval_request';
        break;
      default:
        status = 'PENDING_MD_APPROVAL';
        emailType = 'po_approval_request';
    }

    return { 
      status, 
      approverRole: firstStep.role, 
      emailType,
      approvalChain: steps
    };
  }, [getApplicableSteps]);

  /**
   * Determine the next approval step after current approval
   * Returns null if this is the final approval (PO should be APPROVED)
   */
  const getNextApprovalStep = useCallback((
    currentStatus: POStatus, 
    amount: number
  ): { 
    nextStatus: POStatus | null; 
    nextRole: UserRole | null; 
    emailType: string | null 
  } | null => {
    const steps = getApplicableSteps(amount, 'PO');
    
    if (steps.length === 0) {
      return null; // No more steps, approve
    }

    // Find current step index based on status
    let currentStepIndex = -1;
    
    if (currentStatus === 'PENDING_PM_APPROVAL') {
      currentStepIndex = steps.findIndex(s => s.role === 'PROPERTY_MANAGER');
    } else if (currentStatus === 'PENDING_MD_APPROVAL') {
      currentStepIndex = steps.findIndex(s => s.role === 'MD');
    } else if (currentStatus === 'PENDING_CEO_APPROVAL') {
      currentStepIndex = steps.findIndex(s => s.role === 'CEO');
    }

    // Check if there's a next step
    if (currentStepIndex >= 0 && currentStepIndex < steps.length - 1) {
      const nextStep = steps[currentStepIndex + 1];
      
      let nextStatus: POStatus;
      let emailType: string;
      
      switch (nextStep.role) {
        case 'PROPERTY_MANAGER':
          nextStatus = 'PENDING_PM_APPROVAL';
          emailType = 'po_pm_approval_request';
          break;
        case 'MD':
          nextStatus = 'PENDING_MD_APPROVAL';
          emailType = 'po_approval_request';
          break;
        case 'CEO':
          nextStatus = 'PENDING_CEO_APPROVAL';
          emailType = 'po_ceo_approval_request';
          break;
        default:
          nextStatus = 'PENDING_MD_APPROVAL';
          emailType = 'po_approval_request';
      }

      return { nextStatus, nextRole: nextStep.role, emailType };
    }

    // No more steps - final approval
    return null;
  }, [getApplicableSteps]);

  /**
   * Role hierarchy for determining if a higher role can approve on behalf of lower roles
   * Higher number = higher authority
   * 
   * IMPORTANT: This hierarchy is used for PM approval only.
   * CEO cannot bypass MD step - sequential approval is enforced.
   */
  const getRoleHierarchy = useCallback((role: UserRole): number => {
    const hierarchy: Record<UserRole, number> = {
      'PROPERTY_MANAGER': 1,
      'ACCOUNTS': 2,
      'MD': 3,
      'ADMIN': 3, // ADMIN has same authority as MD for approval purposes
      'CEO': 4,
    };
    return hierarchy[role] || 0;
  }, []);

  /**
   * Check if a role has authority to approve at a given step
   * 
   * CRITICAL: CEO cannot approve MD step. Sequential approval is enforced.
   * This prevents CEO from bypassing the MD approval workflow.
   */
  const canRoleApproveStep = useCallback((approverRole: UserRole, stepRole: UserRole): boolean => {
    // CEO HARD BLOCK: CEO cannot approve MD step
    if (approverRole === 'CEO' && stepRole === 'MD') {
      return false;
    }
    
    // CEO can only approve CEO step
    if (approverRole === 'CEO') {
      return stepRole === 'CEO';
    }
    
    // MD and ADMIN can approve PM and MD steps
    if (approverRole === 'MD' || approverRole === 'ADMIN') {
      return stepRole === 'PROPERTY_MANAGER' || stepRole === 'MD';
    }
    
    // PM can only approve PM steps
    if (approverRole === 'PROPERTY_MANAGER') {
      return stepRole === 'PROPERTY_MANAGER';
    }
    
    return false;
  }, []);

  /**
   * Check if a user can approve a PO at its current status
   * Takes into account role AND delegation
   * 
   * @param userRole - The role of the user attempting to approve
   * @param userId - The ID of the user attempting to approve
   * @param currentStatus - The current PO status
   * @param isDelegate - Whether the user is an active delegate for MD
   */
  const canUserApproveAtStatus = useCallback((
    userRole: UserRole,
    currentStatus: POStatus,
    isDelegate: boolean = false
  ): boolean => {
    // CEO HARD BLOCK: CEO cannot approve before CEO step
    if (userRole === 'CEO' && currentStatus !== 'PENDING_CEO_APPROVAL') {
      return false;
    }
    
    switch (currentStatus) {
      case 'PENDING_PM_APPROVAL':
        // PM, MD, ADMIN can approve PM steps
        return ['PROPERTY_MANAGER', 'MD', 'ADMIN'].includes(userRole);
        
      case 'PENDING_MD_APPROVAL':
        // MD can approve, or active delegates can approve
        // CEO CANNOT approve MD step
        if (userRole === 'CEO') return false;
        if (userRole === 'MD' || userRole === 'ADMIN') return true;
        return isDelegate; // Delegates can approve on behalf of MD
        
      case 'PENDING_CEO_APPROVAL':
        // Only CEO and ADMIN can approve CEO steps
        return userRole === 'CEO' || userRole === 'ADMIN';
        
      default:
        return false;
    }
  }, []);

  /**
   * Get all remaining steps that the current approver can complete in one action
   * 
   * DISABLED FOR CEO: CEO cannot auto-complete MD steps.
   * This enforces sequential approval: MD must approve before CEO.
   * 
   * Only MD/ADMIN can auto-complete PM steps when they have higher authority.
   */
  const getAutoCompletableSteps = useCallback((
    currentStatus: POStatus,
    amount: number,
    approverRole: UserRole
  ): { role: UserRole; status: POStatus }[] => {
    // CEO CANNOT auto-complete any steps - sequential approval enforced
    if (approverRole === 'CEO') {
      return [];
    }
    
    const steps = getApplicableSteps(amount, 'PO');
    const completableSteps: { role: UserRole; status: POStatus }[] = [];
    
    // Find current step index based on status
    let currentStepIndex = -1;
    
    if (currentStatus === 'PENDING_PM_APPROVAL') {
      currentStepIndex = steps.findIndex(s => s.role === 'PROPERTY_MANAGER');
    } else if (currentStatus === 'PENDING_MD_APPROVAL') {
      currentStepIndex = steps.findIndex(s => s.role === 'MD');
    } else if (currentStatus === 'PENDING_CEO_APPROVAL') {
      currentStepIndex = steps.findIndex(s => s.role === 'CEO');
    }

    // Check subsequent steps (but NOT CEO steps - those require explicit CEO approval)
    for (let i = currentStepIndex + 1; i < steps.length; i++) {
      const step = steps[i];
      
      // NEVER auto-complete CEO step
      if (step.role === 'CEO') {
        break;
      }
      
      // MD/ADMIN can auto-complete PM steps
      if (canRoleApproveStep(approverRole, step.role)) {
        let status: POStatus;
        switch (step.role) {
          case 'PROPERTY_MANAGER':
            status = 'PENDING_PM_APPROVAL';
            break;
          case 'MD':
            status = 'PENDING_MD_APPROVAL';
            break;
          default:
            status = 'PENDING_MD_APPROVAL';
        }
        completableSteps.push({ role: step.role, status });
      } else {
        break;
      }
    }

    return completableSteps;
  }, [getApplicableSteps, canRoleApproveStep]);

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
