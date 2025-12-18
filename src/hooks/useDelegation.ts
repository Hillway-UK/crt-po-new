import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { User } from '@/types';

export interface ApprovalDelegation {
  id: string;
  delegator_user_id: string;
  delegate_user_id: string;
  scope: string;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  delegate?: User;
  delegator?: User;
}

export function useDelegation() {
  const { user } = useAuth();
  const [delegations, setDelegations] = useState<ApprovalDelegation[]>([]);
  const [activeDelegatesForMD, setActiveDelegatesForMD] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDelegations = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await (supabase as any)
        .from('approval_delegations')
        .select(`
          *,
          delegate:users!delegate_user_id(*),
          delegator:users!delegator_user_id(*)
        `)
        .or(`delegator_user_id.eq.${user.id},delegate_user_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDelegations(data || []);
    } catch (error) {
      console.error('Error fetching delegations:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Fetch all active delegates for MD users (used for approval eligibility)
  const fetchActiveDelegatesForOrg = useCallback(async () => {
    if (!user?.organisation_id) return;

    try {
      const now = new Date().toISOString();
      
      // Get all active MD users in the organisation
      const { data: mdUsers } = await supabase
        .from('users')
        .select('id')
        .eq('organisation_id', user.organisation_id)
        .eq('role', 'MD')
        .eq('is_active', true);

      if (!mdUsers || mdUsers.length === 0) {
        setActiveDelegatesForMD([]);
        return;
      }

      const mdIds = mdUsers.map(u => u.id);
      
      const { data, error } = await (supabase as any)
        .from('approval_delegations')
        .select(`
          *,
          delegate:users!delegate_user_id(*)
        `)
        .in('delegator_user_id', mdIds)
        .eq('scope', 'PO_APPROVAL')
        .eq('is_active', true);

      if (error) throw error;

      // Filter for currently active delegations (time-wise)
      const activeDelegates = (data || [])
        .filter((d: ApprovalDelegation) => {
          const startsAt = d.starts_at ? new Date(d.starts_at) : null;
          const endsAt = d.ends_at ? new Date(d.ends_at) : null;
          const nowDate = new Date(now);
          
          const afterStart = !startsAt || nowDate >= startsAt;
          const beforeEnd = !endsAt || nowDate <= endsAt;
          
          return afterStart && beforeEnd;
        })
        .map((d: any) => d.delegate)
        .filter(Boolean);

      setActiveDelegatesForMD(activeDelegates);
    } catch (error) {
      console.error('Error fetching active delegates:', error);
    }
  }, [user?.organisation_id]);

  useEffect(() => {
    fetchDelegations();
    fetchActiveDelegatesForOrg();
  }, [fetchDelegations, fetchActiveDelegatesForOrg]);

  /**
   * Check if a delegation is currently active (time-wise)
   */
  const isDelegationActive = useCallback((delegation: ApprovalDelegation): boolean => {
    if (!delegation.is_active) return false;

    const now = new Date();
    const startsAt = delegation.starts_at ? new Date(delegation.starts_at) : null;
    const endsAt = delegation.ends_at ? new Date(delegation.ends_at) : null;

    const afterStart = !startsAt || now >= startsAt;
    const beforeEnd = !endsAt || now <= endsAt;

    return afterStart && beforeEnd;
  }, []);

  /**
   * Get active delegates for a specific MD user
   */
  const getActiveDelegates = useCallback(async (mdUserId: string, scope: string = 'PO_APPROVAL'): Promise<User[]> => {
    try {
      const now = new Date().toISOString();
      
      const { data, error } = await (supabase as any)
        .from('approval_delegations')
        .select(`
          *,
          delegate:users!delegate_user_id(*)
        `)
        .eq('delegator_user_id', mdUserId)
        .eq('scope', scope)
        .eq('is_active', true);

      if (error) throw error;

      // Filter for currently active delegations
      return (data || [])
        .filter((d: ApprovalDelegation) => {
          const startsAt = d.starts_at ? new Date(d.starts_at) : null;
          const endsAt = d.ends_at ? new Date(d.ends_at) : null;
          const nowDate = new Date(now);
          
          const afterStart = !startsAt || nowDate >= startsAt;
          const beforeEnd = !endsAt || nowDate <= endsAt;
          
          return afterStart && beforeEnd;
        })
        .map((d: any) => d.delegate)
        .filter(Boolean);
    } catch (error) {
      console.error('Error getting active delegates:', error);
      return [];
    }
  }, []);

  /**
   * Check if a user is an active delegate for any MD
   */
  const isActiveDelegate = useCallback((userId: string): boolean => {
    return activeDelegatesForMD.some(d => d.id === userId);
  }, [activeDelegatesForMD]);

  /**
   * Create a new delegation (MD only)
   * Validates that delegate is not CEO
   */
  const createDelegation = async (
    delegateUserId: string,
    startsAt?: Date | null,
    endsAt?: Date | null
  ): Promise<boolean> => {
    if (!user?.id) return false;

    // Validate delegate is not CEO
    const { data: delegateUser } = await supabase
      .from('users')
      .select('role')
      .eq('id', delegateUserId)
      .single();

    if (delegateUser?.role === 'CEO') {
      toast.error('CEO cannot be assigned as an approval delegate');
      return false;
    }

    try {
      const { error } = await (supabase as any)
        .from('approval_delegations')
        .insert({
          delegator_user_id: user.id,
          delegate_user_id: delegateUserId,
          scope: 'PO_APPROVAL',
          starts_at: startsAt?.toISOString() || null,
          ends_at: endsAt?.toISOString() || null,
          is_active: true,
        });

      if (error) {
        if (error.code === '23505') {
          toast.error('This user is already a delegate');
        } else {
          throw error;
        }
        return false;
      }

      toast.success('Delegate added successfully');
      await fetchDelegations();
      await fetchActiveDelegatesForOrg();
      return true;
    } catch (error) {
      console.error('Error creating delegation:', error);
      toast.error('Failed to add delegate');
      return false;
    }
  };

  /**
   * Update an existing delegation
   */
  const updateDelegation = async (
    delegationId: string,
    updates: {
      is_active?: boolean;
      starts_at?: Date | null;
      ends_at?: Date | null;
    }
  ): Promise<boolean> => {
    try {
      const { error } = await (supabase as any)
        .from('approval_delegations')
        .update({
          is_active: updates.is_active,
          starts_at: updates.starts_at?.toISOString() || null,
          ends_at: updates.ends_at?.toISOString() || null,
        })
        .eq('id', delegationId);

      if (error) throw error;

      toast.success('Delegation updated');
      await fetchDelegations();
      await fetchActiveDelegatesForOrg();
      return true;
    } catch (error) {
      console.error('Error updating delegation:', error);
      toast.error('Failed to update delegation');
      return false;
    }
  };

  /**
   * Delete a delegation
   */
  const deleteDelegation = async (delegationId: string): Promise<boolean> => {
    try {
      const { error } = await (supabase as any)
        .from('approval_delegations')
        .delete()
        .eq('id', delegationId);

      if (error) throw error;

      toast.success('Delegate removed');
      await fetchDelegations();
      await fetchActiveDelegatesForOrg();
      return true;
    } catch (error) {
      console.error('Error deleting delegation:', error);
      toast.error('Failed to remove delegate');
      return false;
    }
  };

  /**
   * Get MDs that have delegated to a specific user
   */
  const getMDsForDelegate = useCallback(async (userId: string): Promise<User[]> => {
    try {
      const now = new Date().toISOString();
      
      const { data, error } = await (supabase as any)
        .from('approval_delegations')
        .select(`
          *,
          delegator:users!delegator_user_id(*)
        `)
        .eq('delegate_user_id', userId)
        .eq('scope', 'PO_APPROVAL')
        .eq('is_active', true);

      if (error) throw error;

      return (data || [])
        .filter((d: ApprovalDelegation) => {
          const startsAt = d.starts_at ? new Date(d.starts_at) : null;
          const endsAt = d.ends_at ? new Date(d.ends_at) : null;
          const nowDate = new Date(now);
          
          const afterStart = !startsAt || nowDate >= startsAt;
          const beforeEnd = !endsAt || nowDate <= endsAt;
          
          return afterStart && beforeEnd;
        })
        .map((d: any) => d.delegator)
        .filter(Boolean);
    } catch (error) {
      console.error('Error getting MDs for delegate:', error);
      return [];
    }
  }, []);

  // Get own delegations (where current user is the delegator)
  const ownDelegations = delegations.filter(d => d.delegator_user_id === user?.id);
  
  // Get delegations assigned to current user (where current user is the delegate)
  const assignedDelegations = delegations.filter(d => d.delegate_user_id === user?.id);

  return {
    delegations,
    ownDelegations,
    assignedDelegations,
    activeDelegatesForMD,
    loading,
    isDelegationActive,
    getActiveDelegates,
    isActiveDelegate,
    createDelegation,
    updateDelegation,
    deleteDelegation,
    getMDsForDelegate,
    fetchDelegations,
    fetchActiveDelegatesForOrg,
  };
}
