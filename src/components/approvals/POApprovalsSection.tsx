import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PurchaseOrder } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { CheckCircle2, XCircle, Eye, Loader2, Clock } from 'lucide-react';
import { ApproveDialog } from '@/components/po/ApproveDialog';
import { RejectDialog } from '@/components/po/RejectDialog';
import { usePOApproval } from '@/hooks/usePOApproval';

interface POApprovalsSectionProps {
  pendingPOs: PurchaseOrder[];
  loading: boolean;
  onRefresh: () => void;
}

export function POApprovalsSection({ pendingPOs, loading, onRefresh }: POApprovalsSectionProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { approve, reject, isProcessing } = usePOApproval();
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);

  const handleApprove = async (po: PurchaseOrder) => {
    await approve(po, () => {
      onRefresh();
      setApproveDialogOpen(false);
    });
  };

  const handleReject = async (po: PurchaseOrder, reason: string) => {
    await reject(po, reason, () => {
      onRefresh();
      setRejectDialogOpen(false);
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[300px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">Loading pending approvals...</p>
        </div>
      </div>
    );
  }

  if (pendingPOs.length === 0) {
    return (
      <Card className="p-12">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <h3 className="text-xl font-semibold mb-2">All caught up!</h3>
          <p className="text-muted-foreground">No pending approvals at the moment.</p>
        </div>
      </Card>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {pendingPOs.map((po) => {
          const processing = isProcessing(po.id);
          const isCeoApproval = po.status === 'PENDING_CEO_APPROVAL';
          const canUserApprove = isCeoApproval
            ? (user?.role === 'CEO' || user?.role === 'ADMIN')
            : (user?.role === 'MD' || user?.role === 'CEO' || user?.role === 'ADMIN');

          return (
            <Card
              key={po.id}
              className={`border-l-4 hover:shadow-md transition-shadow ${isCeoApproval ? 'border-orange-500' : 'border-amber-400'
                }`}
            >
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <p className="font-mono text-sm font-bold text-primary">
                      {po.po_number}
                    </p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(Number(po.amount_inc_vat))}
                    </p>
                  </div>
                  <Badge className={isCeoApproval ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700'}>
                    {isCeoApproval ? 'Pending CEO' : 'Pending MD'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div>
                    <span className="text-sm text-muted-foreground">Contractor: </span>
                    <span className="font-medium">{po.contractor?.name}</span>
                  </div>
                  {po.property && (
                    <div>
                      <span className="text-sm text-muted-foreground">Property: </span>
                      <span className="font-medium">{po.property.name}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-sm text-muted-foreground">Description: </span>
                    <p className="text-sm mt-1 line-clamp-2">{po.description}</p>
                  </div>
                  <div className="text-sm text-muted-foreground pt-2 border-t">
                    Requested by <span className="font-medium text-foreground">{po.created_by?.full_name}</span> on {formatDate(po.created_at)}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  {canUserApprove ? (
                    <>
                      <Button
                        size="sm"
                        className="flex-1 bg-green-600 hover:bg-green-700"
                        onClick={() => {
                          setSelectedPO(po);
                          setApproveDialogOpen(true);
                        }}
                        disabled={processing}
                      >
                        {processing ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Approve
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1"
                        onClick={() => {
                          setSelectedPO(po);
                          setRejectDialogOpen(true);
                        }}
                        disabled={processing}
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Reject
                      </Button>
                    </>
                  ) : (
                    <div className="flex-1 text-sm text-muted-foreground italic">
                      Requires CEO approval
                    </div>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => navigate(`/pos/${po.id}`)}
                    disabled={processing}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Dialogs */}
      {selectedPO && (
        <>
          <ApproveDialog
            open={approveDialogOpen}
            onOpenChange={setApproveDialogOpen}
            po={selectedPO}
            onConfirm={() => handleApprove(selectedPO)}
          />
          <RejectDialog
            open={rejectDialogOpen}
            onOpenChange={setRejectDialogOpen}
            po={selectedPO}
            onConfirm={(reason) => handleReject(selectedPO, reason)}
          />
        </>
      )}
    </>
  );
}
