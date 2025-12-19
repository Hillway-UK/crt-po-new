import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PurchaseOrder, POStatus } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Search, Eye, Edit, FileText, Clock, CheckCircle, TrendingUp, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { downloadStorageFile } from '@/lib/storage';
import { toast } from 'sonner';
import { PDFViewerDialog } from '@/components/po/PDFViewerDialog';

export default function PurchaseOrders() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [filteredPos, setFilteredPos] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<POStatus | 'all'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [selectedPdfUrl, setSelectedPdfUrl] = useState<string>('');
  const [selectedPdfTitle, setSelectedPdfTitle] = useState<string>('');

  useEffect(() => {
    fetchPOs();
  }, []);

  useEffect(() => {
    filterPOs();
  }, [pos, searchTerm, statusFilter]);

  const fetchPOs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          contractor:contractors(*),
          property:properties(*),
          created_by:users!created_by_user_id(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPos(data as any || []);
    } catch (error) {
      toast.error('Failed to load purchase orders');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filterPOs = () => {
    let filtered = pos;

    if (statusFilter !== 'all') {
      filtered = filtered.filter(po => po.status === statusFilter);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(po =>
        po.po_number.toLowerCase().includes(term) ||
        po.description.toLowerCase().includes(term) ||
        po.contractor?.name.toLowerCase().includes(term)
      );
    }

    setFilteredPos(filtered);
  };

  const stats = [
    {
      title: 'Draft',
      value: pos.filter(p => p.status === 'DRAFT').length,
      icon: FileText,
      color: 'text-gray-600',
    },
    {
      title: 'Pending Approval',
      value: pos.filter(p => p.status === 'PENDING_MD_APPROVAL').length,
      icon: Clock,
      color: 'text-secondary',
    },
    {
      title: 'Approved',
      value: pos.filter(p => p.status === 'APPROVED').length,
      icon: CheckCircle,
      color: 'text-green-600',
    },
    {
      title: 'Total Value',
      value: formatCurrency(
        pos
          .filter(p => p.status === 'APPROVED')
          .reduce((sum, p) => sum + Number(p.amount_inc_vat), 0)
      ),
      icon: TrendingUp,
      color: 'text-primary',
    },
  ];

  const getStatusBadge = (status: POStatus) => {
    const variants: Record<POStatus, { label: string; className: string }> = {
      DRAFT: { label: 'Draft', className: 'bg-gray-100 text-gray-700' },
      PENDING_PM_APPROVAL: { label: 'Pending PM', className: 'bg-blue-100 text-blue-700' },
      PENDING_MD_APPROVAL: { label: 'Pending MD', className: 'bg-amber-100 text-amber-700' },
      PENDING_CEO_APPROVAL: { label: 'Pending CEO', className: 'bg-orange-100 text-orange-700' },
      APPROVED: { label: 'Approved', className: 'bg-green-100 text-green-700' },
      REJECTED: { label: 'Rejected', className: 'bg-red-100 text-red-700' },
      CANCELLED: { label: 'Cancelled', className: 'bg-gray-100 text-gray-500' },
    };

    const variant = variants[status];
    return <Badge className={variant.className}>{variant.label}</Badge>;
  };

  const canEdit = (po: PurchaseOrder) => {
    return (po.status === 'DRAFT' || po.status === 'REJECTED') && po.created_by_user_id === user?.id;
  };

  const handleExportCSV = () => {
    const headers = ['PO Number', 'Date', 'Contractor', 'Description', 'Amount (ex VAT)', 'VAT Rate', 'Amount (inc VAT)', 'Status', 'Created By'];
    const rows = filteredPos.map(po => [
      po.po_number,
      formatDate(po.created_at),
      po.contractor?.name || '',
      po.description.replace(/,/g, ';'),
      Number(po.amount_ex_vat).toFixed(2),
      `${po.vat_rate}%`,
      Number(po.amount_inc_vat).toFixed(2),
      po.status,
      po.created_by?.full_name || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `purchase-orders-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Purchase orders exported successfully');
  };

  // Pagination calculations
  const totalPages = Math.ceil(filteredPos.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedPos = filteredPos.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  return (
    <MainLayout title="Purchase Orders">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold text-foreground">Purchase Orders</h2>
            <p className="text-muted-foreground mt-1">Manage and track all purchase orders</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportCSV} disabled={filteredPos.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            {(user?.role === 'PROPERTY_MANAGER' || user?.role === 'ADMIN') && (
              <Button onClick={() => navigate('/pos/new')}>
                <Plus className="mr-2 h-4 w-4" />
                Create PO
              </Button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search PO number, contractor, description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
              <SelectTrigger className="w-full sm:w-[180px] bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="PENDING_MD_APPROVAL">Pending</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Table */}
        <Card>
          {loading ? (
            <div className="p-8 text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Loading purchase orders...</p>
            </div>
          ) : filteredPos.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-muted-foreground">
                {pos.length === 0
                  ? 'No purchase orders yet. Create your first PO to get started.'
                  : 'No purchase orders match your search criteria.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO Number</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Contractor</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount (inc VAT)</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedPos.map((po) => (
                  <TableRow
                    key={po.id}
                    className="hover:bg-muted/50 cursor-pointer"
                    onClick={() => navigate(`/pos/${po.id}`)}
                  >
                    <TableCell className="font-mono text-sm text-primary font-medium">
                      {po.po_number}
                    </TableCell>
                    <TableCell>{formatDate(po.created_at)}</TableCell>
                    <TableCell>{po.contractor?.name || '—'}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{po.description}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(Number(po.amount_inc_vat))}
                    </TableCell>
                    <TableCell className="text-center">
                      {getStatusBadge(po.status)}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/pos/${po.id}`)}
                          title="View PO Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {po.status === 'APPROVED' && po.pdf_url && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedPdfUrl(po.pdf_url!);
                              setSelectedPdfTitle(`Purchase Order ${po.po_number}`);
                              setPdfViewerOpen(true);
                            }}
                            title="View PDF"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                        )}
                        {po.status === 'APPROVED' && po.pdf_url && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={async () => {
                              try {
                                await downloadStorageFile(po.pdf_url!, `PO-${po.po_number}.pdf`);
                              } catch (error) {
                                console.error('Download failed:', error);
                                toast.error('Failed to download PDF');
                              }
                            }}
                            title="Download PDF"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                        {canEdit(po) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/pos/${po.id}/edit`)}
                            title="Edit PO"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        {/* Pagination */}
        {!loading && filteredPos.length > 0 && (
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
                Showing {startIndex + 1}-{Math.min(endIndex, filteredPos.length)} of {filteredPos.length}
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

      <PDFViewerDialog
        open={pdfViewerOpen}
        onOpenChange={setPdfViewerOpen}
        pdfUrl={selectedPdfUrl}
        title={selectedPdfTitle}
      />
    </MainLayout>
  );
}
