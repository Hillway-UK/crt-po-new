import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Invoice } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { CheckCircle2, XCircle, Eye, Loader2, AlertCircle } from 'lucide-react';
import { ApproveInvoiceDialog } from '@/components/invoices/ApproveInvoiceDialog';
import { RejectInvoiceDialog } from '@/components/invoices/RejectInvoiceDialog';

interface InvoiceApprovalsSectionProps {
  pendingInvoices: Invoice[];
  loading: boolean;
  onRefresh: () => void;
}

export function InvoiceApprovalsSection({
  pendingInvoices,
  loading,
  onRefresh,
}: InvoiceApprovalsSectionProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[300px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">Loading pending invoices...</p>
        </div>
      </div>
    );
  }

  if (pendingInvoices.length === 0) {
    return (
      <Card className="p-12">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <h3 className="text-xl font-semibold mb-2">All caught up!</h3>
          <p className="text-muted-foreground">No pending invoice approvals at the moment.</p>
        </div>
      </Card>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {pendingInvoices.map((invoice) => {
          const poAmountMatch = Math.abs(
            (invoice.amount_inc_vat || 0) - (invoice.purchase_order?.amount_inc_vat || 0)
          );
          const amountsMatch = poAmountMatch < 0.01;
          const canApprove = user?.role === 'MD' || user?.role === 'CEO' || user?.role === 'ADMIN';

          return (
            <Card
              key={invoice.id}
              className="border-l-4 border-amber-400 hover:shadow-md transition-shadow"
            >
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <p className="font-mono text-sm font-bold text-primary">
                      Invoice: {invoice.invoice_number}
                    </p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(Number(invoice.amount_inc_vat))}
                    </p>
                  </div>
                  <Badge className="bg-amber-100 text-amber-700">Pending</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div>
                    <span className="text-sm text-muted-foreground">PO Number: </span>
                    <span className="font-medium font-mono">
                      {invoice.purchase_order?.po_number}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Contractor: </span>
                    <span className="font-medium">{invoice.contractor?.name}</span>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Invoice Date: </span>
                    <span className="font-medium">{formatDate(invoice.invoice_date)}</span>
                  </div>
                  <Separator />
                  <div
                    className={`p-3 rounded-lg border ${amountsMatch
                        ? 'bg-green-50 border-green-200'
                        : 'bg-amber-50 border-amber-200'
                      }`}
                  >
                    <div className="flex items-start gap-2">
                      {amountsMatch ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {amountsMatch
                            ? 'Amounts match'
                            : `Difference: ${formatCurrency(Math.abs(poAmountMatch))}`}
                        </p>
                        {!amountsMatch && (
                          <p className="text-xs text-muted-foreground mt-1">
                            PO Amount: {formatCurrency(invoice.purchase_order?.amount_inc_vat || 0)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  {invoice.mismatch_notes && (
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium">Note: </span>
                      {invoice.mismatch_notes}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  {canApprove ? (
                    <>
                      <Button
                        size="sm"
                        className="flex-1 bg-green-600 hover:bg-green-700"
                        onClick={() => {
                          setSelectedInvoice(invoice);
                          setApproveDialogOpen(true);
                        }}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1"
                        onClick={() => {
                          setSelectedInvoice(invoice);
                          setRejectDialogOpen(true);
                        }}
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Reject
                      </Button>
                    </>
                  ) : (
                    <div className="flex-1 text-sm text-muted-foreground italic text-center py-2">
                      Requires MD/CEO approval
                    </div>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => navigate(`/invoice/${invoice.id}`)}
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
      {selectedInvoice && (
        <>
          <ApproveInvoiceDialog
            invoice={selectedInvoice}
            open={approveDialogOpen}
            onOpenChange={(open) => {
              setApproveDialogOpen(open);
              if (!open) {
                onRefresh();
              }
            }}
          />
          <RejectInvoiceDialog
            invoice={selectedInvoice}
            open={rejectDialogOpen}
            onOpenChange={(open) => {
              setRejectDialogOpen(open);
              if (!open) {
                onRefresh();
              }
            }}
          />
        </>
      )}
    </>
  );
}
