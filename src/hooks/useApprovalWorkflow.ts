import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ApprovalWorkflow, ApprovalWorkflowStep, UserRole, POStatus } from '@/types';
import { toast } from 'sonner';

interface WorkflowSettings {
  use_custom_workflows: boolean;
  auto_approve_below_amount: number | null;
  require_ceo_above_amount: number | null;
}

export function useApprovalWorkflow() {
  const { user } = useAuth();
  const [workflows, setWorkflows] = useState<ApprovalWorkflow[]>([]);
  const [workflowSettings, setWorkflowSettings] = useState<WorkflowSettings>({
    use_custom_workflows: false,
    auto_approve_below_amount: null,
    require_ceo_above_amount: null,
  });
  const [loading, setLoading] = useState(true);

  const fetchWorkflows = useCallback(async () => {
    if (!user?.organisation_id) return;

    try {
      const { data, error } = await (supabase as any)
        .from('approval_workflows')
        .select(`
          *,
          steps:approval_workflow_steps(*)
        `)
        .eq('organisation_id', user.organisation_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWorkflows(data || []);
    } catch (error) {
      console.error('Error fetching workflows:', error);
    }
  }, [user?.organisation_id]);

  const fetchSettings = useCallback(async () => {
    if (!user?.organisation_id) return;

    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('organisation_id', user.organisation_id)
        .single();

      if (error) throw error;
      if (data) {
        const settingsData = data as any;
        setWorkflowSettings({
          use_custom_workflows: settingsData.use_custom_workflows || false,
          auto_approve_below_amount: settingsData.auto_approve_below_amount ? Number(settingsData.auto_approve_below_amount) : null,
          require_ceo_above_amount: settingsData.require_ceo_above_amount ? Number(settingsData.require_ceo_above_amount) : null,
        });
      }
    } catch (error) {
      console.error('Error fetching workflow settings:', error);
    }
  }, [user?.organisation_id]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchWorkflows(), fetchSettings()]);
      setLoading(false);
    };
    loadData();
  }, [fetchWorkflows, fetchSettings]);

  const updateWorkflowSettings = async (newSettings: Partial<WorkflowSettings>) => {
    if (!user?.organisation_id) return false;

    try {
      const { error } = await supabase
        .from('settings')
        .update(newSettings as any)
        .eq('organisation_id', user.organisation_id);

      if (error) throw error;
      
      setWorkflowSettings(prev => ({ ...prev, ...newSettings }));
      toast.success('Workflow settings updated');
      return true;
    } catch (error) {
      console.error('Error updating workflow settings:', error);
      toast.error('Failed to update workflow settings');
      return false;
    }
  };

  const createWorkflow = async (name: string, workflowType: 'PO' | 'INVOICE' = 'PO') => {
    if (!user?.organisation_id) return null;

    try {
      const { data, error } = await (supabase as any)
        .from('approval_workflows')
        .insert({
          organisation_id: user.organisation_id,
          name,
          workflow_type: workflowType,
          is_active: true,
          is_default: workflows.length === 0,
        })
        .select()
        .single();

      if (error) throw error;
      
      await fetchWorkflows();
      toast.success('Workflow created');
      return data;
    } catch (error) {
      console.error('Error creating workflow:', error);
      toast.error('Failed to create workflow');
      return null;
    }
  };

  const updateWorkflow = async (workflowId: string, updates: Partial<ApprovalWorkflow>) => {
    try {
      const { error } = await (supabase as any)
        .from('approval_workflows')
        .update(updates)
        .eq('id', workflowId);

      if (error) throw error;
      
      await fetchWorkflows();
      toast.success('Workflow updated');
      return true;
    } catch (error) {
      console.error('Error updating workflow:', error);
      toast.error('Failed to update workflow');
      return false;
    }
  };

  const deleteWorkflow = async (workflowId: string) => {
    try {
      const { error } = await (supabase as any)
        .from('approval_workflows')
        .delete()
        .eq('id', workflowId);

      if (error) throw error;
      
      await fetchWorkflows();
      toast.success('Workflow deleted');
      return true;
    } catch (error) {
      console.error('Error deleting workflow:', error);
      toast.error('Failed to delete workflow');
      return false;
    }
  };

  const addWorkflowStep = async (
    workflowId: string,
    step: {
      step_order: number;
      approver_role: UserRole;
      min_amount?: number | null;
      max_amount?: number | null;
      skip_if_below_amount?: number | null;
      is_required?: boolean;
      requires_previous_approval?: boolean;
    }
  ) => {
    try {
      const { error } = await (supabase as any)
        .from('approval_workflow_steps')
        .insert({
          workflow_id: workflowId,
          ...step,
        });

      if (error) throw error;
      
      await fetchWorkflows();
      return true;
    } catch (error) {
      console.error('Error adding workflow step:', error);
      toast.error('Failed to add workflow step');
      return false;
    }
  };

  const updateWorkflowStep = async (stepId: string, updates: Partial<ApprovalWorkflowStep>) => {
    try {
      const { error } = await (supabase as any)
        .from('approval_workflow_steps')
        .update(updates)
        .eq('id', stepId);

      if (error) throw error;
      
      await fetchWorkflows();
      return true;
    } catch (error) {
      console.error('Error updating workflow step:', error);
      toast.error('Failed to update workflow step');
      return false;
    }
  };

  const deleteWorkflowStep = async (stepId: string) => {
    try {
      const { error } = await (supabase as any)
        .from('approval_workflow_steps')
        .delete()
        .eq('id', stepId);

      if (error) throw error;
      
      await fetchWorkflows();
      return true;
    } catch (error) {
      console.error('Error deleting workflow step:', error);
      toast.error('Failed to delete workflow step');
      return false;
    }
  };

  const setDefaultWorkflow = async (workflowId: string, workflowType: 'PO' | 'INVOICE') => {
    if (!user?.organisation_id) return false;

    try {
      // First, unset default for all workflows of this type
      await (supabase as any)
        .from('approval_workflows')
        .update({ is_default: false })
        .eq('organisation_id', user.organisation_id)
        .eq('workflow_type', workflowType);

      // Then set the new default
      const { error } = await (supabase as any)
        .from('approval_workflows')
        .update({ is_default: true })
        .eq('id', workflowId);

      if (error) throw error;
      
      await fetchWorkflows();
      toast.success('Default workflow updated');
      return true;
    } catch (error) {
      console.error('Error setting default workflow:', error);
      toast.error('Failed to set default workflow');
      return false;
    }
  };

  /**
   * DYNAMIC THRESHOLD-BASED APPROVAL LOGIC
   * 
   * This function determines which approval steps are required based on the PO amount.
   * It uses a threshold-based approach where each step has a min_amount (threshold).
   * 
   * Logic:
   * 1. Sort steps by step_order (ascending)
   * 2. Find the HIGHEST step where amount >= min_amount (threshold)
   * 3. If that step requires_previous_approval, include the previous step in the chain
   * 4. Return the approval chain (e.g., [PM], [MD], or [MD, CEO])
   */
  const getApplicableSteps = useCallback((amount: number, workflowType: 'PO' | 'INVOICE' = 'PO') => {
    if (!workflowSettings.use_custom_workflows) {
      // Default workflow logic (quick thresholds)
      const steps: { role: UserRole; required: boolean }[] = [];
      
      // Check auto-approve threshold (PM can approve directly)
      if (workflowSettings.auto_approve_below_amount && amount < workflowSettings.auto_approve_below_amount) {
        steps.push({ role: 'PROPERTY_MANAGER', required: true });
        return steps;
      }

      // MD approval required
      steps.push({ role: 'MD', required: true });

      // CEO approval if above threshold (sequential: MD then CEO)
      if (workflowSettings.require_ceo_above_amount && amount >= workflowSettings.require_ceo_above_amount) {
        steps.push({ role: 'CEO', required: true });
      }

      return steps;
    }

    // CUSTOM WORKFLOW: Dynamic Threshold-Based Logic
    const defaultWorkflow = workflows.find(
      w => w.workflow_type === workflowType && w.is_default && w.is_active
    );

    if (!defaultWorkflow?.steps || defaultWorkflow.steps.length === 0) {
      return [{ role: 'MD' as UserRole, required: true }];
    }

    // Sort steps by step_order (ascending)
    const sortedSteps = [...defaultWorkflow.steps].sort((a, b) => a.step_order - b.step_order);

    // Find the HIGHEST step where amount >= min_amount (threshold)
    let targetStepIndex = -1;
    for (let i = 0; i < sortedSteps.length; i++) {
      const step = sortedSteps[i];
      const threshold = step.min_amount || 0;
      
      if (amount >= threshold) {
        targetStepIndex = i;
      }
    }

    // Fallback to first step if no match
    if (targetStepIndex === -1) {
      targetStepIndex = 0;
    }

    const targetStep = sortedSteps[targetStepIndex];
    const approvalChain: { role: UserRole; required: boolean }[] = [];

    // Check if target step EXPLICITLY requires previous approval (fully dynamic - no hardcoded role checks)
    const requiresPrevious = targetStep.requires_previous_approval === true;

    if (requiresPrevious && targetStepIndex > 0) {
      const prevStep = sortedSteps[targetStepIndex - 1];
      approvalChain.push({ 
        role: prevStep.approver_role, 
        required: prevStep.is_required ?? true 
      });
    }

    // Add target step to the chain
    approvalChain.push({ 
      role: targetStep.approver_role, 
      required: targetStep.is_required ?? true 
    });

    return approvalChain;
  }, [workflowSettings, workflows]);

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

  return {
    workflows,
    workflowSettings,
    loading,
    fetchWorkflows,
    updateWorkflowSettings,
    createWorkflow,
    updateWorkflow,
    deleteWorkflow,
    addWorkflowStep,
    updateWorkflowStep,
    deleteWorkflowStep,
    setDefaultWorkflow,
    getApplicableSteps,
    getInitialApprovalInfo,
    getNextApprovalStep,
  };
}
