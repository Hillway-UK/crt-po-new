import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import crtLogo from '@/assets/crt_property.png';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { signIn, user, session, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Only redirect if we have both a session AND a loaded user profile
    if (user && session && !authLoading) {
      console.log('Redirecting to dashboard with user:', user);
      navigate('/dashboard', { replace: true });
    }
  }, [user, session, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const validated = loginSchema.parse({ email, password });
      const { error } = await signIn(validated.email, validated.password);
      
      if (error) {
        setError(error.message);
      } else {
        toast.success('Signed in successfully!');
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.errors[0].message);
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  // If we have a session but no user yet, show loading state
  if (session && !user && authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary to-primary-hover">
        <div className="text-center text-white">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Setting up your account...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary to-primary-hover p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <img src={crtLogo} alt="CRT Property" className="mx-auto mb-4 h-16 object-contain" />
          <CardTitle className="text-2xl">CRT Property Investments</CardTitle>
          <CardDescription>Approvals Hub - Secure Access</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@crtproperty.co.uk"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
            
            <p className="text-xs text-muted-foreground text-center mt-4">
              Contact your administrator to request access.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
