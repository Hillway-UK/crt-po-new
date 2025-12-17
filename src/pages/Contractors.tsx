import { useQuery } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search, Mail, Phone, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';
import type { Contractor } from '@/types';
import { Badge } from '@/components/ui/badge';

export default function Contractors() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');

  const { data: contractors = [], isLoading } = useQuery({
    queryKey: ['contractors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contractors')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as Contractor[];
    },
    enabled: !!user,
  });

  const filteredContractors = contractors.filter(contractor => 
    contractor.name.toLowerCase().includes(search.toLowerCase()) ||
    contractor.email.toLowerCase().includes(search.toLowerCase()) ||
    contractor.contact_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <MainLayout title="Contractors">
      <div className="space-y-6">
        <div className="flex gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search contractors..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground">Loading...</div>
          </div>
        ) : filteredContractors.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground">No contractors found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredContractors.map((contractor) => (
              <Card key={contractor.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-lg">{contractor.name}</h3>
                    <Badge variant={contractor.is_active ? 'default' : 'secondary'}>
                      {contractor.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  
                  {contractor.contact_name && (
                    <p className="text-sm text-muted-foreground mb-2">{contractor.contact_name}</p>
                  )}

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      <a href={`mailto:${contractor.email}`} className="hover:text-primary">
                        {contractor.email}
                      </a>
                    </div>
                    
                    {contractor.phone && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-4 w-4" />
                        <a href={`tel:${contractor.phone}`} className="hover:text-primary">
                          {contractor.phone}
                        </a>
                      </div>
                    )}

                    {contractor.address && (
                      <div className="flex items-start gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4 mt-0.5" />
                        <span>{contractor.address}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t text-xs text-muted-foreground">
                    Payment Terms: {contractor.default_payment_terms || 30} days
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
