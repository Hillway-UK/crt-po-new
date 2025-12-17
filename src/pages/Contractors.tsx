import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ContractorDialog } from '@/components/contractors/ContractorDialog';
import { Contractor } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Search, Edit, Upload, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

export default function Contractors() {
  const { user } = useAuth();
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [filteredContractors, setFilteredContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [editingContractor, setEditingContractor] = useState<Contractor | undefined>();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    fetchContractors();
  }, []);

  useEffect(() => {
    filterContractors();
  }, [contractors, searchTerm, statusFilter]);

  const fetchContractors = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('contractors')
        .select('*')
        .order('name');

      if (error) throw error;
      setContractors(data || []);
    } catch (error) {
      toast.error('Failed to load contractors');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filterContractors = () => {
    let filtered = contractors;

    // Filter by status
    if (statusFilter === 'active') {
      filtered = filtered.filter(c => c.is_active);
    } else if (statusFilter === 'inactive') {
      filtered = filtered.filter(c => !c.is_active);
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(term) ||
        c.email.toLowerCase().includes(term) ||
        c.contact_name?.toLowerCase().includes(term)
      );
    }

    setFilteredContractors(filtered);
  };

  const handleToggleActive = async (contractor: Contractor) => {
    try {
      const { error } = await supabase
        .from('contractors')
        .update({ is_active: !contractor.is_active })
        .eq('id', contractor.id);

      if (error) throw error;
      
      toast.success(`Contractor ${contractor.is_active ? 'deactivated' : 'activated'}`);
      fetchContractors();
    } catch (error) {
      toast.error('Failed to update contractor status');
      console.error(error);
    }
  };

  const handleEdit = (contractor: Contractor) => {
    setEditingContractor(contractor);
    setDialogOpen(true);
  };

  const handleAddNew = () => {
    setEditingContractor(undefined);
    setDialogOpen(true);
  };

  const handleCSVImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          toast.error('CSV file must have a header row and at least one data row');
          return;
        }

        // Parse header to find column indices
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
        
        const nameIdx = headers.findIndex(h => h.includes('name') && !h.includes('contact'));
        const contactIdx = headers.findIndex(h => h.includes('contact'));
        const emailIdx = headers.findIndex(h => h.includes('email'));
        const phoneIdx = headers.findIndex(h => h.includes('phone') || h.includes('tel'));
        const addressIdx = headers.findIndex(h => h.includes('address'));
        const termsIdx = headers.findIndex(h => h.includes('term') || h.includes('payment'));
        const notesIdx = headers.findIndex(h => h.includes('note'));

        if (nameIdx === -1 || emailIdx === -1) {
          toast.error('CSV must have "name" and "email" columns');
          return;
        }

        const contractorsToImport = [];
        let errors = 0;

        for (let i = 1; i < lines.length; i++) {
          // Simple CSV parsing
          const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
          
          const name = values[nameIdx];
          const email = values[emailIdx];

          if (!name || !email) {
            errors++;
            continue;
          }

          contractorsToImport.push({
            name,
            contact_name: contactIdx > -1 ? values[contactIdx] || null : null,
            email,
            phone: phoneIdx > -1 ? values[phoneIdx] || null : null,
            address: addressIdx > -1 ? values[addressIdx] || null : null,
            default_payment_terms: termsIdx > -1 ? parseInt(values[termsIdx]) || 30 : 30,
            notes: notesIdx > -1 ? values[notesIdx] || null : null,
            organisation_id: user?.organisation_id,
            is_active: true
          });
        }

        if (contractorsToImport.length === 0) {
          toast.error('No valid contractors found in CSV');
          return;
        }

        // Bulk insert
        const { error } = await supabase
          .from('contractors')
          .insert(contractorsToImport);

        if (error) {
          toast.error('Failed to import contractors: ' + error.message);
          console.error(error);
        } else {
          toast.success(`Imported ${contractorsToImport.length} contractors` + (errors > 0 ? ` (${errors} rows skipped)` : ''));
          fetchContractors();
          setCsvDialogOpen(false);
        }
      } catch (error) {
        toast.error('Failed to parse CSV file');
        console.error(error);
      }
    };

    reader.readAsText(file);
  };

  // Pagination calculations
  const totalPages = Math.ceil(filteredContractors.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedContractors = filteredContractors.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  return (
    <MainLayout title="Contractors">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold text-foreground">Contractors</h2>
            <p className="text-muted-foreground mt-1">Manage your contractor database</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={csvDialogOpen} onOpenChange={setCsvDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Upload className="mr-2 h-4 w-4" />
                  Import CSV
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Import Contractors from CSV</DialogTitle>
                  <DialogDescription>
                    Upload a CSV file with contractor details. Required columns: <strong>name</strong>, <strong>email</strong>.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <p className="text-sm text-muted-foreground">
                    Optional columns: contact_name, phone, address, payment_terms, notes
                  </p>
                  <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                    <Input
                      type="file"
                      accept=".csv"
                      onChange={handleCSVImport}
                      className="cursor-pointer"
                    />
                  </div>
                  <div className="text-xs text-muted-foreground bg-muted p-3 rounded">
                    <strong>Example CSV format:</strong><br />
                    name,contact_name,email,phone,address,payment_terms<br />
                    ABC Builders,John Smith,john@abc.com,01234567890,123 High St,30
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            
            <Button onClick={handleAddNew}>
              <Plus className="mr-2 h-4 w-4" />
              Add Contractor
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search contractors..."
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
                <SelectItem value="all">All Contractors</SelectItem>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="inactive">Inactive Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Table */}
        <Card>
          {loading ? (
            <div className="p-8 text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Loading contractors...</p>
            </div>
          ) : filteredContractors.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-muted-foreground">
                {contractors.length === 0
                  ? 'No contractors yet. Add your first contractor to get started.'
                  : 'No contractors match your search criteria.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-center">Payment Terms</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedContractors.map((contractor) => (
                  <TableRow key={contractor.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">{contractor.name}</TableCell>
                    <TableCell>{contractor.contact_name || '—'}</TableCell>
                    <TableCell>{contractor.email}</TableCell>
                    <TableCell>{contractor.phone || '—'}</TableCell>
                    <TableCell className="text-center">{contractor.default_payment_terms} days</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={contractor.is_active ? 'default' : 'secondary'} className={contractor.is_active ? 'bg-green-100 text-green-700 hover:bg-green-100' : ''}>
                        {contractor.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(contractor)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Switch
                          checked={contractor.is_active}
                          onCheckedChange={() => handleToggleActive(contractor)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        {/* Pagination */}
        {!loading && filteredContractors.length > 0 && (
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
                Showing {startIndex + 1}-{Math.min(endIndex, filteredContractors.length)} of {filteredContractors.length}
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

      <ContractorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        contractor={editingContractor}
        onSuccess={fetchContractors}
      />
    </MainLayout>
  );
}
