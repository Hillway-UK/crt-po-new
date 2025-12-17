import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { User, UserRole } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { UserCog, Shield, Mail, Phone, Plus, Loader2 } from 'lucide-react';

export default function UserManagement() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('PROPERTY_MANAGER');
  const [sendingInvite, setSendingInvite] = useState(false);

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
    } catch (error) {
      toast.error('Failed to update user role');
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
          role: inviteRole as any, // Cast needed until DB types regenerated with CEO role
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
      PROPERTY_MANAGER: { label: 'Property Manager', className: 'bg-blue-100 text-blue-700' },
      MD: { label: 'Managing Director', className: 'bg-purple-100 text-purple-700' },
      CEO: { label: 'CEO', className: 'bg-orange-100 text-orange-700' },
      ACCOUNTS: { label: 'Accounts', className: 'bg-green-100 text-green-700' },
      ADMIN: { label: 'Admin', className: 'bg-red-100 text-red-700' },
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
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Team Members</h2>
            <p className="text-muted-foreground">Manage user access and roles</p>
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

        <Card>
          <CardHeader>
            <CardTitle>All Users ({users.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
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
                    <TableCell>
                      <Badge variant={u.is_active ? "default" : "secondary"}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {(user?.role === 'ADMIN' || user?.role === 'MD' || user?.role === 'CEO') && u.id !== user.id && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm" onClick={() => setEditingUser(u)}>
                              Edit Role
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Edit User Role</DialogTitle>
                              <DialogDescription>
                                Change the role for {u.full_name}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div className="space-y-2">
                                <Label>Current Role</Label>
                                <p className="text-sm">{getRoleBadge(u.role)}</p>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="new-role">New Role</Label>
                                <Select 
                                  defaultValue={u.role}
                                  onValueChange={(value) => handleUpdateUserRole(u.id, value as UserRole)}
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
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
