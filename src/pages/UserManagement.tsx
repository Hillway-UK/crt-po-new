import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { User, UserRole } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { UserCog, Shield, Mail, Phone, Plus, Loader2, Search, Edit, ChevronLeft, ChevronRight } from 'lucide-react';

export default function UserManagement() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editRoleDialogOpen, setEditRoleDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('PROPERTY_MANAGER');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    if (user?.role === 'ADMIN' || user?.role === 'MD' || user?.role === 'CEO' || user?.role === 'PROPERTY_MANAGER') {
      fetchUsers();
    }
  }, [user]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('organisation_id', user?.organisation_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data as User[]);
    } catch (error) {
      toast.error('Failed to load users');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Filter users
  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = 
      statusFilter === 'all' ||
      (statusFilter === 'active' && u.is_active) ||
      (statusFilter === 'inactive' && !u.is_active);
    
    return matchesSearch && matchesFilter;
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredUsers.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  const handleUpdateUserRole = async (userId: string, newRole: UserRole) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .update({ role: newRole as any })
        .eq('id', userId)
        .select();

      if (error) throw error;
      
      if (!data || data.length === 0) {
        toast.error('Failed to update user role - permission denied');
        return;
      }
      
      toast.success('User role updated successfully');
      fetchUsers();
      setEditingUser(null);
      setEditRoleDialogOpen(false);
    } catch (error) {
      toast.error('Failed to update user role');
      console.error(error);
    }
  };

  const handleToggleUserStatus = async (targetUser: User) => {
    try {
      const newStatus = !targetUser.is_active;
      const { error } = await supabase
        .from('users')
        .update({ is_active: newStatus })
        .eq('id', targetUser.id);

      if (error) throw error;
      
      toast.success(`User ${newStatus ? 'activated' : 'deactivated'} successfully`);
      fetchUsers();
    } catch (error) {
      toast.error('Failed to update user status');
      console.error(error);
    }
  };

  const handleInviteUser = async () => {
    if (!inviteEmail || !inviteName) {
      toast.error('Please fill in all fields');
      return;
    }

    setSendingInvite(true);

    try {
      const currentUser = users.find(u => u.id === user?.id);
      if (!currentUser) {
        toast.error('User not found');
        return;
      }

      // Generate a unique token for the invitation
      const token = crypto.randomUUID();

      // Insert invitation into database
      const { data: invitation, error: insertError } = await supabase
        .from('user_invitations')
        .insert({
          email: inviteEmail,
          full_name: inviteName,
          role: inviteRole as any,
          organisation_id: currentUser.organisation_id,
          invited_by_user_id: currentUser.id,
          token
        } as any)
        .select()
        .single();

      if (insertError) {
        console.error('Error creating invitation:', insertError);
        toast.error('Failed to create invitation');
        return;
      }

      // Send invitation email via edge function
      const { error: emailError } = await supabase.functions.invoke('send-email', {
        body: {
          type: 'user_invitation',
          invitation_id: invitation.id
        }
      });

      if (emailError) {
        console.error('Error sending invitation email:', emailError);
        toast.error('Invitation created but email failed to send');
      } else {
        toast.success(`Invitation sent to ${inviteEmail}`);
      }

      setInviteDialogOpen(false);
      setInviteEmail('');
      setInviteName('');
      setInviteRole('PROPERTY_MANAGER');
    } catch (error) {
      console.error('Error in handleInviteUser:', error);
      toast.error('Failed to send invitation');
    } finally {
      setSendingInvite(false);
    }
  };

  const getRoleBadge = (role: UserRole) => {
    const variants: Record<UserRole, { label: string; className: string }> = {
      PROPERTY_MANAGER: { label: 'Property Manager', className: 'bg-blue-100 text-blue-700 hover:bg-blue-100' },
      MD: { label: 'Managing Director', className: 'bg-purple-100 text-purple-700 hover:bg-purple-100' },
      CEO: { label: 'CEO', className: 'bg-orange-100 text-orange-700 hover:bg-orange-100' },
      ACCOUNTS: { label: 'Accounts', className: 'bg-green-100 text-green-700 hover:bg-green-100' },
      ADMIN: { label: 'Admin', className: 'bg-red-100 text-red-700 hover:bg-red-100' },
    };
    
    const variant = variants[role];
    return <Badge className={variant.className}>{variant.label}</Badge>;
  };

  const getRoleIcon = (role: UserRole) => {
    if (role === 'ADMIN' || role === 'MD' || role === 'CEO') {
      return <Shield className="h-4 w-4 text-purple-600" />;
    }
    return <UserCog className="h-4 w-4 text-blue-600" />;
  };

  const handleEditRole = (u: User) => {
    setEditingUser(u);
    setEditRoleDialogOpen(true);
  };

  if (user?.role !== 'ADMIN' && user?.role !== 'MD' && user?.role !== 'CEO' && user?.role !== 'PROPERTY_MANAGER') {
    return (
      <MainLayout title="User Management">
        <div className="text-center py-12">
          <p className="text-muted-foreground">You don't have permission to access this page</p>
        </div>
      </MainLayout>
    );
  }

  if (loading) {
    return (
      <MainLayout title="User Management">
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="User Management">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold text-foreground">Team Members</h2>
            <p className="text-muted-foreground mt-1">Manage user access and roles</p>
          </div>
          <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Invite User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite New User</DialogTitle>
                <DialogDescription>
                  Send an invitation to join your organization
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-name">Full Name</Label>
                  <Input
                    id="invite-name"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="John Smith"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Email Address</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="john.smith@company.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-role">Role</Label>
                  <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as UserRole)}>
                    <SelectTrigger id="invite-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PROPERTY_MANAGER">Property Manager</SelectItem>
                      <SelectItem value="ACCOUNTS">Accounts</SelectItem>
                      {(user?.role === 'ADMIN' || user?.role === 'MD' || user?.role === 'CEO') && (
                        <SelectItem value="MD">Managing Director</SelectItem>
                      )}
                      {(user?.role === 'ADMIN' || user?.role === 'CEO') && (
                        <SelectItem value="CEO">CEO</SelectItem>
                      )}
                      {user?.role === 'ADMIN' && (
                        <SelectItem value="ADMIN">Admin</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteDialogOpen(false)} disabled={sendingInvite}>
                  Cancel
                </Button>
                <Button onClick={handleInviteUser} disabled={sendingInvite}>
                  {sendingInvite ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending Invitation...
                    </>
                  ) : (
                    'Send Invitation'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
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
                <SelectItem value="all">All Users</SelectItem>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="inactive">Inactive Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Table */}
        <Card>
          {filteredUsers.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-muted-foreground">
                {users.length === 0
                  ? 'No users yet. Invite your first team member to get started.'
                  : 'No users match your search criteria.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedUsers.map((u) => (
                  <TableRow key={u.id} className="hover:bg-muted/50">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getRoleIcon(u.role)}
                        <div>
                          <p className="font-medium">{u.full_name}</p>
                          <p className="text-sm text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getRoleBadge(u.role)}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          <span>{u.email}</span>
                        </div>
                        {u.phone && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            <span>{u.phone}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        variant={u.is_active ? "default" : "secondary"}
                        className={u.is_active ? 'bg-green-100 text-green-700 hover:bg-green-100' : ''}
                      >
                        {u.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {(user?.role === 'ADMIN' || user?.role === 'MD' || user?.role === 'CEO') && u.id !== user.id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditRole(u)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {user?.role === 'ADMIN' && u.id !== user.id && (
                          <Switch
                            checked={u.is_active}
                            onCheckedChange={() => handleToggleUserStatus(u)}
                          />
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
        {filteredUsers.length > 0 && (
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
                Showing {startIndex + 1}-{Math.min(endIndex, filteredUsers.length)} of {filteredUsers.length}
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
      </div>

      {/* Edit Role Dialog */}
      <Dialog open={editRoleDialogOpen} onOpenChange={setEditRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User Role</DialogTitle>
            <DialogDescription>
              Change the role for {editingUser?.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Current Role</Label>
              <p className="text-sm">{editingUser && getRoleBadge(editingUser.role)}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-role">New Role</Label>
              <Select 
                defaultValue={editingUser?.role}
                onValueChange={(value) => editingUser && handleUpdateUserRole(editingUser.id, value as UserRole)}
              >
                <SelectTrigger id="new-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PROPERTY_MANAGER">Property Manager</SelectItem>
                  <SelectItem value="ACCOUNTS">Accounts</SelectItem>
                  <SelectItem value="MD">Managing Director</SelectItem>
                  <SelectItem value="CEO">CEO</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
