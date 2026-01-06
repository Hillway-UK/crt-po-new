import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface WorkflowSettings {
  use_custom_workflows: boolean;
  auto_approve_below_amount: number | null;
  require_ceo_above_amount: number | null;
}

/**
 * Hook for managing workflow settings (thresholds and flags)
 */
export function useWorkflowSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<WorkflowSettings>({
    use_custom_workflows: false,
    auto_approve_below_amount: null,
    require_ceo_above_amount: null,
  });
  const [loading, setLoading] = useState(true);

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
        setSettings({
          use_custom_workflows: settingsData.use_custom_workflows || false,
          auto_approve_below_amount: settingsData.auto_approve_below_amount
            ? Number(settingsData.auto_approve_below_amount)
            : null,
          require_ceo_above_amount: settingsData.require_ceo_above_amount
            ? Number(settingsData.require_ceo_above_amount)
            : null,
        });
      }
    } catch (error) {
      console.error('Error fetching workflow settings:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.organisation_id]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = async (newSettings: Partial<WorkflowSettings>) => {
    if (!user?.organisation_id) return false;

    try {
      const { error } = await supabase
        .from('settings')
        .update(newSettings as any)
        .eq('organisation_id', user.organisation_id);

      if (error) throw error;

      setSettings((prev) => ({ ...prev, ...newSettings }));
      toast.success('Workflow settings updated');
      return true;
    } catch (error) {
      console.error('Error updating workflow settings:', error);
      toast.error('Failed to update workflow settings');
      return false;
    }
  };

  return {
    settings,
    loading,
    updateSettings,
    refetch: fetchSettings,
  };
}
