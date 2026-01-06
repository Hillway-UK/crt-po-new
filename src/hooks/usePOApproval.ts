import { useState } from 'react';
import { PurchaseOrder } from '@/types';
import { approvePO, rejectPO } from '@/services/approvalService';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook for managing PO approval operations
 */
export function usePOApproval() {
  const { user } = useAuth();
  const [processing, setProcessing] = useState<Set<string>>(new Set());

  const approve = async (po: PurchaseOrder, onSuccess?: () => void) => {
    if (!user) return false;

    const poId = po.id;
    setProcessing(prev => new Set(prev).add(poId));

    try {
      const result = await approvePO({ user, po });

      if (result.success) {
        if (result.needsCeoApproval) {
          toast.success('PO approved by MD - routed to CEO for final approval');
        } else {
          toast.success('Purchase order approved and sent to contractor');
        }
        onSuccess?.();
        return true;
      } else {
        toast.error(result.error || 'Failed to approve purchase order');
        return false;
      }
    } catch (error) {
      console.error('Approval error:', error);
      toast.error('Failed to approve purchase order');
      return false;
    } finally {
      setProcessing(prev => {
        const next = new Set(prev);
        next.delete(poId);
        return next;
      });
    }
  };

  const reject = async (po: PurchaseOrder, reason: string, onSuccess?: () => void) => {
    if (!user) return false;

    const poId = po.id;
    setProcessing(prev => new Set(prev).add(poId));

    try {
      const result = await rejectPO({ user, po }, reason);

      if (result.success) {
        toast.success('Purchase order rejected. PM has been notified.');
        onSuccess?.();
        return true;
      } else {
        toast.error(result.error || 'Failed to reject purchase order');
        return false;
      }
    } catch (error) {
      console.error('Rejection error:', error);
      toast.error('Failed to reject purchase order');
      return false;
    } finally {
      setProcessing(prev => {
        const next = new Set(prev);
        next.delete(poId);
        return next;
      });
    }
  };

  const isProcessing = (poId: string) => processing.has(poId);

  return {
    approve,
    reject,
    isProcessing,
  };
}
