import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useDelegation, ApprovalDelegation } from '@/hooks/useDelegation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@/types';
import { UserPlus, Trash2, AlertCircle, Calendar, Info } from 'lucide-react';
import { format } from 'date-fns';

export function DelegationManager() {
  const { user } = useAuth();
  const {
    ownDelegations,
    loading,
    isDelegationActive,
    createDelegation,
    updateDelegation,
    deleteDelegation,
  } = useDelegation();

  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [startsAt, setStartsAt] = useState<string>('');
  const [endsAt, setEndsAt] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reactivation modal state
  const [reactivateDialogOpen, setReactivateDialogOpen] = useState(false);
  const [delegationToReactivate, setDelegationToReactivate] = useState<ApprovalDelegation | null>(null);
  const [reactivateStartsAt, setReactivateStartsAt] = useState<string>('');
  const [reactivateEndsAt, setReactivateEndsAt] = useState<string>('');

  // Fetch available users (excluding CEO and self)
  useEffect(() => {
    const fetchUsers = async () => {
      if (!user?.organisation_id) return;

      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('organisation_id', user.organisation_id)
        .eq('is_active', true)
        .neq('id', user.id)
        .neq('role', 'CEO'); // CEO cannot be delegate

      setAvailableUsers((data as User[]) || []);
    };

    fetchUsers();
  }, [user?.organisation_id, user?.id]);

  const handleAddDelegate = async () => {
    if (!selectedUserId) return;

    setIsSubmitting(true);
    const success = await createDelegation(
      selectedUserId,
      startsAt ? new Date(startsAt) : null,
      endsAt ? new Date(endsAt) : null
    );

    if (success) {
      setAddDialogOpen(false);
      setSelectedUserId('');
      setStartsAt('');
      setEndsAt('');
    }
    setIsSubmitting(false);
  };

  const handleToggleActive = async (delegation: ApprovalDelegation) => {
    if (!delegation.is_active) {
      // Reactivating - show modal to set new dates
      setDelegationToReactivate(delegation);
      setReactivateStartsAt(delegation.starts_at 
        ? new Date(delegation.starts_at).toISOString().slice(0, 16) 
        : '');
      setReactivateEndsAt(delegation.ends_at 
        ? new Date(delegation.ends_at).toISOString().slice(0, 16) 
        : '');
      setReactivateDialogOpen(true);
    } else {
      // Deactivating - just toggle off directly
      await updateDelegation(delegation.id, { 
        is_active: false,
        starts_at: delegation.starts_at ? new Date(delegation.starts_at) : null,
        ends_at: delegation.ends_at ? new Date(delegation.ends_at) : null,
      });
    }
  };

  const handleConfirmReactivate = async () => {
    if (!delegationToReactivate) return;
    
    setIsSubmitting(true);
    await updateDelegation(delegationToReactivate.id, {
      is_active: true,
      starts_at: reactivateStartsAt ? new Date(reactivateStartsAt) : null,
      ends_at: reactivateEndsAt ? new Date(reactivateEndsAt) : null,
    });
    
    setReactivateDialogOpen(false);
    setDelegationToReactivate(null);
    setReactivateStartsAt('');
    setReactivateEndsAt('');
    setIsSubmitting(false);
  };

  const handleDelete = async (delegationId: string) => {
    if (confirm('Are you sure you want to remove this delegate?')) {
      await deleteDelegation(delegationId);
    }
  };

  // Filter out users who are already delegates
  const existingDelegateIds = ownDelegations.map(d => d.delegate_user_id);
  const selectableUsers = availableUsers.filter(u => !existingDelegateIds.includes(u.id));

  if (user?.role !== 'MD') {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            <CardTitle>Approval Delegation</CardTitle>
          </div>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <UserPlus className="h-4 w-4 mr-2" />
                Add Delegate
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Approval Delegate</DialogTitle>
                <DialogDescription>
                  Select a user who can approve POs on your behalf.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Delegates can approve POs on your behalf while you're unavailable. 
                    The CEO cannot be assigned as a delegate.
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Label>Select User</Label>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a delegate..." />
                    </SelectTrigger>
                    <SelectContent>
                      {selectableUsers.map(u => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.full_name} ({u.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectableUsers.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No eligible users available to add as delegates.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="starts-at">Start Date (Optional)</Label>
                    <Input
                      id="starts-at"
                      type="datetime-local"
                      value={startsAt}
                      onChange={(e) => setStartsAt(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ends-at">End Date (Optional)</Label>
                    <Input
                      id="ends-at"
                      type="datetime-local"
                      value={endsAt}
                      onChange={(e) => setEndsAt(e.target.value)}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Leave dates empty for delegation to be active immediately with no expiration.
                </p>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleAddDelegate} 
                  disabled={!selectedUserId || isSubmitting}
                >
                  {isSubmitting ? 'Adding...' : 'Add Delegate'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Reactivate Delegate Dialog */}
          <Dialog open={reactivateDialogOpen} onOpenChange={setReactivateDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reactivate Delegate</DialogTitle>
                <DialogDescription>
                  Set the delegation period for {delegationToReactivate?.delegate?.full_name}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Set the start and end dates for when this delegate can approve POs on your behalf.
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="reactivate-starts-at">Start Date (Optional)</Label>
                    <Input
                      id="reactivate-starts-at"
                      type="datetime-local"
                      value={reactivateStartsAt}
                      onChange={(e) => setReactivateStartsAt(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reactivate-ends-at">End Date (Optional)</Label>
                    <Input
                      id="reactivate-ends-at"
                      type="datetime-local"
                      value={reactivateEndsAt}
                      onChange={(e) => setReactivateEndsAt(e.target.value)}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Leave dates empty for delegation to be active immediately with no expiration.
                </p>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setReactivateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleConfirmReactivate} disabled={isSubmitting}>
                  {isSubmitting ? 'Reactivating...' : 'Reactivate Delegate'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <CardDescription>
          Manage who can approve POs on your behalf when you're unavailable
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-4 text-muted-foreground">Loading...</div>
        ) : ownDelegations.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <UserPlus className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No delegates configured</p>
            <p className="text-sm">Add a delegate to allow them to approve POs on your behalf.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {ownDelegations.map((delegation) => {
              const isActive = isDelegationActive(delegation);
              const delegate = delegation.delegate;
              
              return (
                <div
                  key={delegation.id}
                  className={`flex items-center justify-between p-4 rounded-lg border ${
                    isActive ? 'bg-green-50 border-green-200' : 'bg-muted/50 border-border'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-medium">{delegate?.full_name || 'Unknown'}</p>
                      <p className="text-sm text-muted-foreground">{delegate?.role}</p>
                      {(delegation.starts_at || delegation.ends_at) && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <Calendar className="h-3 w-3" />
                          {delegation.starts_at && format(new Date(delegation.starts_at), 'MMM d, yyyy')}
                          {delegation.starts_at && delegation.ends_at && ' - '}
                          {delegation.ends_at && format(new Date(delegation.ends_at), 'MMM d, yyyy')}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Badge className={isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                      {isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    <Switch
                      checked={delegation.is_active}
                      onCheckedChange={() => handleToggleActive(delegation)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(delegation.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
