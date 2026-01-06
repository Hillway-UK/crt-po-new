import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ApprovalWorkflow, ApprovalWorkflowStep, UserRole } from '@/types';
import { toast } from 'sonner';

/**
 * Hook for managing approval workflow CRUD operations
 */
export function useWorkflowCRUD() {
  const { user } = useAuth();
  const [workflows, setWorkflows] = useState<ApprovalWorkflow[]>([]);
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
    } finally {
      setLoading(false);
    }
  }, [user?.organisation_id]);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

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

  return {
    workflows,
    loading,
    createWorkflow,
    updateWorkflow,
    deleteWorkflow,
    addWorkflowStep,
    updateWorkflowStep,
    deleteWorkflowStep,
    setDefaultWorkflow,
    refetch: fetchWorkflows,
  };
}
