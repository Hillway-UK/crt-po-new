import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@/types';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', { event, session: !!session, userId: session?.user?.id });
        setSession(session);

        if (session?.user) {
          // Fetch user profile with fallback creation
          setTimeout(async () => {
            await fetchOrCreateUserProfile(session.user.id, session.user.email || '', session.user.user_metadata?.full_name);
          }, 0);
        } else {
          setUser(null);
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      console.log('Initial session check:', { session: !!session, userId: session?.user?.id });
      setSession(session);

      if (session?.user) {
        await fetchOrCreateUserProfile(session.user.id, session.user.email || '', session.user.user_metadata?.full_name);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchOrCreateUserProfile = async (userId: string, email: string, fullName?: string) => {
    console.log('Fetching user profile for:', userId);

    // Try to fetch existing profile
    const { data: existingProfile, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    console.log('User profile result:', { profile: !!existingProfile, error: fetchError });

    if (existingProfile) {
      setUser(existingProfile as User);
      setLoading(false);
      return;
    }

    // Profile doesn't exist - create it now (fallback for trigger failures)
    console.log('Profile not found, creating fallback profile');
    const { data: newProfile, error: insertError } = await supabase
      .from('users')
      .insert({
        id: userId,
        email: email,
        full_name: fullName || email.split('@')[0] || 'User',
        role: 'PROPERTY_MANAGER',
        organisation_id: '00000000-0000-0000-0000-000000000001',
        is_active: true
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to create user profile:', insertError);

      // One more attempt to fetch in case of race condition
      const { data: retryProfile } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (retryProfile) {
        setUser(retryProfile as User);
      }
    } else if (newProfile) {
      console.log('Created fallback profile successfully');
      setUser(newProfile as User);
    }

    setLoading(false);
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    toast.success('Signed out successfully');
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
