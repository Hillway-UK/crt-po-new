import { Home, FileText, CheckSquare, Receipt, Users, Building, Settings, LogOut, UserCog } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

export function Sidebar() {
  const { user, signOut } = useAuth();

  if (!user) return null;

  const navItems = [
    { icon: Home, label: 'Dashboard', to: '/dashboard', roles: ['PROPERTY_MANAGER', 'MD', 'CEO', 'ACCOUNTS', 'ADMIN'] },
    { icon: FileText, label: 'Purchase Orders', to: '/pos', roles: ['PROPERTY_MANAGER', 'MD', 'ACCOUNTS'] },
    { icon: CheckSquare, label: 'Approvals', to: '/approvals', roles: ['MD', 'CEO', 'ADMIN'] },
    { icon: Receipt, label: 'Invoices', to: '/invoices', roles: ['PROPERTY_MANAGER', 'ACCOUNTS', 'MD'] },
    { icon: Users, label: 'Contractors', to: '/contractors', roles: ['PROPERTY_MANAGER', 'MD', 'ACCOUNTS'] },
    { icon: Building, label: 'Properties', to: '/properties', roles: ['PROPERTY_MANAGER', 'MD', 'ACCOUNTS'] },
    { icon: UserCog, label: 'User Management', to: '/users', roles: ['PROPERTY_MANAGER', 'MD'] },
    { icon: Settings, label: 'Settings', to: '/settings', roles: ['ADMIN', 'CEO'] },
  ];

  const filteredNavItems = navItems.filter(item => item.roles.includes(user.role));

  return (
    <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border">
        <h2 className="text-xl font-bold text-sidebar-foreground">CRT Property</h2>
        <p className="text-xs text-sidebar-foreground/70 mt-1">Approvals Hub</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {filteredNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                isActive && 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
              )
            }
          >
            <item.icon className="h-5 w-5" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <Separator className="bg-sidebar-border" />

      {/* User Profile */}
      <div className="p-4">
        <div className="mb-4">
          <p className="font-medium text-sidebar-foreground">{user.full_name}</p>
          <p className="text-xs text-sidebar-foreground/70">{user.role.replace('_', ' ')}</p>
        </div>
        <Button
          variant="outline"
          className="w-full justify-start border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
          onClick={signOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
}
