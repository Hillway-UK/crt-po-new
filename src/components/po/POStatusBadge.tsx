import { Badge } from '@/components/ui/badge';
import type { POStatus } from '@/types';

interface POStatusBadgeProps {
  status: POStatus;
}

export function POStatusBadge({ status }: POStatusBadgeProps) {
  const config: Record<POStatus, { label: string; className: string }> = {
    DRAFT: {
      label: 'Draft',
      className: 'bg-gray-100 text-gray-700 hover:bg-gray-100',
    },
    PENDING_PM_APPROVAL: {
      label: 'Pending PM Approval',
      className: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
    },
    PENDING_MD_APPROVAL: {
      label: 'Pending MD Approval',
      className: 'bg-amber-100 text-amber-700 hover:bg-amber-100',
    },
    PENDING_CEO_APPROVAL: {
      label: 'Pending CEO Approval',
      className: 'bg-orange-100 text-orange-700 hover:bg-orange-100',
    },
    APPROVED: {
      label: 'Approved',
      className: 'bg-green-100 text-green-700 hover:bg-green-100',
    },
    REJECTED: {
      label: 'Rejected',
      className: 'bg-red-100 text-red-700 hover:bg-red-100',
    },
    CANCELLED: {
      label: 'Cancelled',
      className: 'bg-gray-100 text-gray-700 hover:bg-gray-100',
    },
  };

  const { label, className } = config[status] || config.DRAFT;

  return <Badge className={className}>{label}</Badge>;
}
