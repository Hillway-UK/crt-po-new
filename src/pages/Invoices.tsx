import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Upload, FileText, Clock, CheckCircle, DollarSign, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { InvoiceStatusBadge } from '@/components/invoices/InvoiceStatusBadge';
import { UploadInvoiceDialog } from '@/components/invoices/UploadInvoiceDialog';
import { downloadFile } from '@/lib/fileDownload';
import { toast } from 'sonner';
import type { Invoice, InvoiceStatus } from '@/types';

export default function Invoices() {
  const { user } = useAuth();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null);

  const { data: invoices, isLoading } = useQuery({
    queryKey: ['invoices', user?.organisation_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*, contractor:contractors(*), purchase_order:purchase_orders(*)')
        .eq('organisation_id', user?.organisation_id!)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Invoice[];
    },
    enabled: !!user?.organisation_id,
  });

  const { data: stats } = useQuery({
    queryKey: ['invoice-stats', user?.organisation_id],
    queryFn: async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const [needsMatching, pendingApproval, readyToPay, paidThisMonth] = await Promise.all([
        supabase
          .from('invoices')
          .select('id', { count: 'exact', head: true })
          .eq('organisation_id', user?.organisation_id!)
          .eq('status', 'UPLOADED'),
        supabase
          .from('invoices')
          .select('id', { count: 'exact', head: true })
          .eq('organisation_id', user?.organisation_id!)
          .eq('status', 'PENDING_MD_APPROVAL'),
        supabase
          .from('invoices')
          .select('amount_inc_vat')
          .eq('organisation_id', user?.organisation_id!)
          .eq('status', 'APPROVED_FOR_PAYMENT'),
        supabase
          .from('invoices')
          .select('id', { count: 'exact', head: true })
          .eq('organisation_id', user?.organisation_id!)
          .eq('status', 'PAID')
          .gte('payment_date', monthStart.toISOString()),
      ]);

      const readyToPayValue = readyToPay.data?.reduce(
        (sum, inv) => sum + (inv.amount_inc_vat || 0),
        0
      );

      return {
        needsMatching: needsMatching.count || 0,
        pendingApproval: pendingApproval.count || 0,
        readyToPay: readyToPay.data?.length || 0,
        readyToPayValue: readyToPayValue || 0,
        paidThisMonth: paidThisMonth.count || 0,
      };
    },
    enabled: !!user?.organisation_id,
  });

  const filteredInvoices = invoices?.filter((invoice) => {
    const matchesStatus = statusFilter === 'ALL' || invoice.status === statusFilter;
    const matchesSearch =
      !searchQuery ||
      invoice.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.contractor?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.purchase_order?.po_number.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const isAccounts = user?.role === 'ACCOUNTS' || user?.role === 'ADMIN';

  const handleDownloadInvoice = async (invoice: Invoice) => {
    if (!invoice.file_url) return;
    
    setDownloadingInvoiceId(invoice.id);
    try {
      const poNumber = invoice.purchase_order?.po_number;
      const filename = poNumber 
        ? `${poNumber}_${invoice.invoice_number}.pdf`
        : `${invoice.invoice_number}.pdf`;
      
      await downloadFile(invoice.file_url, filename);
      toast.success('Invoice downloaded successfully');
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Failed to download invoice');
    } finally {
      setDownloadingInvoiceId(null);
    }
  };

  const handleExportCSV = () => {
    if (!filteredInvoices) return;

    const headers = ['Invoice Number', 'PO Number', 'Contractor', 'Invoice Date', 'Amount (ex VAT)', 'VAT Rate', 'Amount (inc VAT)', 'Status'];
    const rows = filteredInvoices.map(invoice => [
      invoice.invoice_number,
      invoice.purchase_order?.po_number || '',
      invoice.contractor?.name || '',
      formatDate(invoice.invoice_date),
      invoice.amount_ex_vat.toFixed(2),
      `${invoice.vat_rate || 20}%`,
      (invoice.amount_inc_vat || 0).toFixed(2),
      invoice.status || 'UPLOADED'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `invoices-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Invoices exported successfully');
  };

  // Pagination calculations
  const totalPages = Math.ceil((filteredInvoices?.length || 0) / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedInvoices = filteredInvoices?.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  return (
    <MainLayout title="Invoices">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-foreground">Invoices</h2>
            <p className="text-muted-foreground mt-1">Manage and track invoice payments</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportCSV} disabled={!filteredInvoices || filteredInvoices.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            {isAccounts && (
              <Button onClick={() => setUploadDialogOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Upload Invoice
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Needs Matching</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.needsMatching || 0}</div>
              <p className="text-xs text-muted-foreground">Awaiting PO match</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Awaiting Approval</CardTitle>
              <Clock className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.pendingApproval || 0}</div>
              <p className="text-xs text-muted-foreground">Pending MD review</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ready to Pay</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.readyToPay || 0}</div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(stats?.readyToPayValue || 0)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Paid This Month</CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.paidThisMonth || 0}</div>
              <p className="text-xs text-muted-foreground">Completed payments</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-4">
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as InvoiceStatus | 'ALL')}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Invoices</SelectItem>
              <SelectItem value="UPLOADED">Awaiting Match</SelectItem>
              <SelectItem value="MATCHED">Matched</SelectItem>
              <SelectItem value="PENDING_MD_APPROVAL">Pending Approval</SelectItem>
              <SelectItem value="APPROVED_FOR_PAYMENT">Ready to Pay</SelectItem>
              <SelectItem value="PAID">Paid</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
            </SelectContent>
          </Select>

          <Input
            placeholder="Search invoices..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-sm"
          />
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>PO Number</TableHead>
                  <TableHead>Contractor</TableHead>
                  <TableHead>Invoice Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">PDF</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Loading invoices...
                    </TableCell>
                  </TableRow>
                ) : filteredInvoices?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      No invoices found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedInvoices?.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-mono">{invoice.invoice_number}</TableCell>
                      <TableCell>
                        {invoice.purchase_order ? (
                       <Link
                            to={`/pos/${invoice.purchase_order.id}`}
                            className="text-primary hover:underline font-mono"
                          >
                            {invoice.purchase_order.po_number}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>{invoice.contractor?.name}</TableCell>
                      <TableCell>{formatDate(invoice.invoice_date)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(invoice.amount_inc_vat || 0)}
                      </TableCell>
                      <TableCell>
                        <InvoiceStatusBadge status={invoice.status || 'UPLOADED'} />
                      </TableCell>
                      <TableCell className="text-center">
                        {invoice.file_url ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDownloadInvoice(invoice)}
                            disabled={downloadingInvoiceId === invoice.id}
                            title="Download Invoice PDF"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/invoice/${invoice.id}`}>View</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Pagination */}
        {!isLoading && filteredInvoices && filteredInvoices.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Rows per page:</span>
              <Select value={pageSize.toString()} onValueChange={(value) => {
                setPageSize(Number(value));
                setCurrentPage(1);
              }}>
                <SelectTrigger className="w-[80px] bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                Showing {startIndex + 1}-{Math.min(endIndex, filteredInvoices.length)} of {filteredInvoices.length}
              </span>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium">Page {currentPage} of {totalPages}</span>
                </div>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <UploadInvoiceDialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen} />
    </MainLayout>
  );
}
