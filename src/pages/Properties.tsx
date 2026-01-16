import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Search, Edit, Building, Loader2, Upload, ChevronLeft, ChevronRight } from 'lucide-react';

interface Property {
  id: string;
  name: string;
  address: string;
  reference_code: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

export default function Properties() {
  const { user } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [saving, setSaving] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    reference_code: '',
    notes: ''
  });

  useEffect(() => {
    fetchProperties();
  }, []);

  async function fetchProperties() {
    setLoading(true);
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .order('name');
    
    if (error) {
      toast.error('Failed to load properties');
      console.error(error);
    } else {
      setProperties(data || []);
    }
    setLoading(false);
  }

  const filteredProperties = properties.filter(p => {
    const matchesSearch = 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.reference_code?.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesFilter = 
      statusFilter === 'all' ||
      (statusFilter === 'active' && p.is_active) ||
      (statusFilter === 'inactive' && !p.is_active);
    
    return matchesSearch && matchesFilter;
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredProperties.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedProperties = filteredProperties.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  function openAddDialog() {
    setEditingProperty(null);
    setFormData({ name: '', address: '', reference_code: '', notes: '' });
    setDialogOpen(true);
  }

  function openEditDialog(property: Property) {
    setEditingProperty(property);
    setFormData({
      name: property.name,
      address: property.address,
      reference_code: property.reference_code || '',
      notes: property.notes || ''
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!formData.name.trim() || !formData.address.trim()) {
      toast.error('Property name and address are required');
      return;
    }

    setSaving(true);

    const propertyData = {
      name: formData.name.trim(),
      address: formData.address.trim(),
      reference_code: formData.reference_code.trim() || null,
      notes: formData.notes.trim() || null,
      organisation_id: user?.organisation_id
    };

    if (editingProperty) {
      const { error } = await supabase
        .from('properties')
        .update(propertyData)
        .eq('id', editingProperty.id);

      if (error) {
        toast.error('Failed to update property');
        console.error(error);
      } else {
        toast.success('Property updated');
        setDialogOpen(false);
        fetchProperties();
      }
    } else {
      const { error } = await supabase
        .from('properties')
        .insert(propertyData);

      if (error) {
        toast.error('Failed to add property');
        console.error(error);
      } else {
        toast.success('Property added');
        setDialogOpen(false);
        fetchProperties();
      }
    }

    setSaving(false);
  }

  async function toggleActive(property: Property) {
    const { error } = await supabase
      .from('properties')
      .update({ is_active: !property.is_active })
      .eq('id', property.id);

    if (error) {
      toast.error('Failed to update property');
    } else {
      toast.success(property.is_active ? 'Property deactivated' : 'Property activated');
      fetchProperties();
    }
  }

  async function handleCSVImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        toast.error('CSV must have header row and at least one data row');
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
      
      const nameIdx = headers.findIndex(h => h.includes('name') && !h.includes('ref'));
      const addressIdx = headers.findIndex(h => h.includes('address'));
      const refIdx = headers.findIndex(h => h.includes('ref') || h.includes('code'));
      const notesIdx = headers.findIndex(h => h.includes('note'));

      if (nameIdx === -1 || addressIdx === -1) {
        toast.error('CSV must have "name" and "address" columns');
        return;
      }

      const propertiesToImport = [];
      let errors = 0;

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        
        const name = values[nameIdx];
        const address = values[addressIdx];

        if (!name || !address) {
          errors++;
          continue;
        }

        propertiesToImport.push({
          name,
          address,
          reference_code: refIdx > -1 ? values[refIdx] || null : null,
          notes: notesIdx > -1 ? values[notesIdx] || null : null,
          organisation_id: user?.organisation_id,
          is_active: true
        });
      }

      if (propertiesToImport.length === 0) {
        toast.error('No valid properties found in CSV');
        return;
      }

      const { error } = await supabase
        .from('properties')
        .insert(propertiesToImport);

      if (error) {
        toast.error('Failed to import: ' + error.message);
      } else {
        toast.success(`Imported ${propertiesToImport.length} properties` + (errors > 0 ? ` (${errors} rows skipped)` : ''));
        fetchProperties();
      }

      setCsvDialogOpen(false);
      event.target.value = '';
    };

    reader.readAsText(file);
  }

  return (
    <MainLayout title="Properties">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Properties</h1>
            <p className="text-muted-foreground mt-1">Manage properties for purchase order allocation</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={csvDialogOpen} onOpenChange={setCsvDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Upload className="h-4 w-4 mr-2" />
                  Import CSV
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Import Properties from CSV</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <p className="text-sm text-muted-foreground">
                    Upload a CSV with property details. Required: <strong>name</strong>, <strong>address</strong>.
                    Optional: reference_code, notes.
                  </p>
                  <Input type="file" accept=".csv" onChange={handleCSVImport} />
                  <p className="text-xs text-muted-foreground">
                    Example: name,address,reference_code<br/>
                    Waterside Park,Valley Way Wombwell S73 0BB,WP001
                  </p>
                </div>
              </DialogContent>
            </Dialog>
            
            <Button onClick={openAddDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Add Property
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search properties..."
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
                <SelectItem value="all">All Properties</SelectItem>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="inactive">Inactive Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Properties Table */}
        <Card>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredProperties.length === 0 ? (
            <div className="text-center py-12">
              <Building className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground">No properties found</h3>
              <p className="text-muted-foreground mt-1">
                {properties.length === 0 ? "Add your first property to get started" : "Try adjusting your search"}
              </p>
              {properties.length === 0 && (
                <Button onClick={openAddDialog} className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Property
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property Name</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedProperties.map((property) => (
                  <TableRow key={property.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">{property.name}</TableCell>
                    <TableCell>{property.address}</TableCell>
                    <TableCell>{property.reference_code || '—'}</TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        variant={property.is_active ? 'default' : 'secondary'}
                        className={property.is_active ? 'bg-green-100 text-green-700 hover:bg-green-100' : ''}
                      >
                        {property.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(property)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Switch
                          checked={property.is_active}
                          onCheckedChange={() => toggleActive(property)}
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
        {!loading && filteredProperties.length > 0 && (
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
                Showing {startIndex + 1}-{Math.min(endIndex, filteredProperties.length)} of {filteredProperties.length}
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
                  <span className="text-sm font-medium">Page {currentPage} of {totalPages || 1}</span>
                </div>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || totalPages === 0}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingProperty ? 'Edit Property' : 'Add New Property'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="name">Property Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="Waterside Business Park"
                />
              </div>
              <div>
                <Label htmlFor="address">Address *</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  placeholder="Valley Way, Wombwell, Barnsley, S73 0BB"
                  rows={2}
                />
              </div>
              <div>
                <Label htmlFor="reference_code">Reference Code</Label>
                <Input
                  id="reference_code"
                  value={formData.reference_code}
                  onChange={(e) => setFormData({...formData, reference_code: e.target.value})}
                  placeholder="WBP-001"
                />
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  placeholder="Any additional notes..."
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingProperty ? 'Update' : 'Add'} Property
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
