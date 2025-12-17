import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ApprovalWorkflow, ApprovalWorkflowStep, UserRole } from '@/types';
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
      // Using any cast since these tables are new and DB types haven't been regenerated
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

  // Determine which approval steps apply based on PO amount
  // Uses HIERARCHICAL approval: for high-value POs, MD must approve before CEO
  const getApplicableSteps = useCallback((amount: number, workflowType: 'PO' | 'INVOICE' = 'PO') => {
    if (!workflowSettings.use_custom_workflows) {
      // Default workflow logic
      const steps: { role: UserRole; required: boolean }[] = [];
      
      // Check auto-approve threshold
      if (workflowSettings.auto_approve_below_amount && amount < workflowSettings.auto_approve_below_amount) {
        // Auto-approve - no steps needed (PM can approve directly)
        return steps;
      }

      // MD approval always required for standard flow
      steps.push({ role: 'MD', required: true });

      // CEO approval if above threshold
      if (workflowSettings.require_ceo_above_amount && amount >= workflowSettings.require_ceo_above_amount) {
        steps.push({ role: 'CEO', required: true });
      }

      return steps;
    }

    // Custom workflow logic - HIERARCHICAL APPROACH
    const defaultWorkflow = workflows.find(
      w => w.workflow_type === workflowType && w.is_default && w.is_active
    );

    if (!defaultWorkflow?.steps || defaultWorkflow.steps.length === 0) {
      return [{ role: 'MD' as UserRole, required: true }];
    }

    // Sort steps by step_order
    const sortedSteps = [...defaultWorkflow.steps].sort((a, b) => a.step_order - b.step_order);

    // Find which step the amount falls into (the target step)
    let targetStep = sortedSteps.find(step => {
      const meetsMin = !step.min_amount || amount >= step.min_amount;
      const withinMax = !step.max_amount || amount <= step.max_amount;
      return meetsMin && withinMax;
    });

    // If no exact match, find the highest step where amount meets min_amount
    if (!targetStep) {
      for (let i = sortedSteps.length - 1; i >= 0; i--) {
        const step = sortedSteps[i];
        if (!step.min_amount || amount >= step.min_amount) {
          targetStep = step;
          break;
        }
      }
    }

    // Fallback to MD if still no match
    if (!targetStep) {
      return [{ role: 'MD' as UserRole, required: true }];
    }

    // Build HIERARCHICAL approval chain
    // If target is CEO, include MD first (MD → CEO)
    // If target is MD, just MD
    // If target is PM, just PM
    const approvalChain: { role: UserRole; required: boolean }[] = [];

    if (targetStep.approver_role === 'CEO') {
      // CEO needs MD approval first - hierarchical
      const mdStep = sortedSteps.find(s => s.approver_role === 'MD');
      if (mdStep) {
        approvalChain.push({ role: 'MD', required: true });
      }
      approvalChain.push({ role: 'CEO', required: targetStep.is_required ?? true });
    } else if (targetStep.approver_role === 'MD') {
      // MD range - just MD needed
      approvalChain.push({ role: 'MD', required: targetStep.is_required ?? true });
    } else if (targetStep.approver_role === 'PROPERTY_MANAGER') {
      // PM range - just PM needed
      approvalChain.push({ role: 'PROPERTY_MANAGER', required: targetStep.is_required ?? true });
    } else {
      // Any other role
      approvalChain.push({ role: targetStep.approver_role, required: targetStep.is_required ?? true });
    }

    return approvalChain;
  }, [workflowSettings, workflows]);

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
  };
}
