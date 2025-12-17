import { Badge } from '@/components/ui/badge';
import type { InvoiceStatus } from '@/types';

interface InvoiceStatusBadgeProps {
  status: InvoiceStatus;
}

export function InvoiceStatusBadge({ status }: InvoiceStatusBadgeProps) {
  const config = {
    UPLOADED: {
      label: 'Needs Matching',
      className: 'bg-gray-100 text-gray-700 hover:bg-gray-100',
    },
    MATCHED: {
      label: 'Matched',
      className: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
    },
    PENDING_MD_APPROVAL: {
      label: 'Awaiting Approval',
      className: 'bg-amber-100 text-amber-700 hover:bg-amber-100',
    },
    APPROVED_FOR_PAYMENT: {
      label: 'Ready to Pay',
      className: 'bg-green-100 text-green-700 hover:bg-green-100',
    },
    PAID: {
      label: 'Paid',
      className: 'bg-teal-100 text-teal-700 hover:bg-teal-100',
    },
    REJECTED: {
      label: 'Rejected',
      className: 'bg-red-100 text-red-700 hover:bg-red-100',
    },
  };

  const { label, className } = config[status] || config.UPLOADED;

  return <Badge className={className}>{label}</Badge>;
}
