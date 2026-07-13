import React, { useEffect, useState } from 'react';
import { Outlet, useParams, Link } from 'react-router-dom';
import { supabase } from '@/db/supabase';
import { toast } from 'sonner';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { Scissors } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function PublicAppLayout() {
  const { slug } = useParams();
  const { user } = useAuth();
  const [business, setBusiness] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Gate State
  const [gatePassed, setGatePassed] = useState(false);
  const [authMode, setAuthMode] = useState<'options' | 'login' | 'signup'>('options');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    if (slug) {
      fetchBusiness();
    }
  }, [slug]);

  useEffect(() => {
    // If user is already logged in, or gate was passed in this session, bypass
    if (user || sessionStorage.getItem(`gatePassed_${slug}`) === 'true') {
      setGatePassed(true);
    }
  }, [user, slug]);

  const fetchBusiness = async () => {
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select('*, business_settings(*)')
        .eq('slug', slug)
        .single();
      
      if (error) throw error;
      setBusiness(data);
    } catch (error) {
      console.error('Error fetching business:', error);
      toast.error('Business not found');
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = () => {
    sessionStorage.setItem(`gatePassed_${slug}`, 'true');
    setGatePassed(true);
  };

  const handleAuth = async () => {
    if (!email || !password) {
      toast.error('Email and password required');
      return;
    }
    setAuthLoading(true);
    try {
      if (authMode === 'signup') {
        if (!name) {
          toast.error('Name required');
          return;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name, role: 'Registered Customer' }
          }
        });
        if (error) throw error;
        toast.success('Account created! You can now book.');
        handleGuest();
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success('Signed in successfully');
        handleGuest();
      }
    } catch (e: any) {
      toast.error(e.message || 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!business) {
    return <div className="min-h-screen flex items-center justify-center">Business not found</div>;
  }

  if (!gatePassed) {
    return (
      <div className="min-h-screen bg-background flex flex-col relative">
        {/* Cover Background */}
        <div className="absolute inset-0 z-0">
          {business.photos && business.photos.length > 0 ? (
            <>
              <div className="absolute inset-0 bg-black/60 z-10" />
              <img src={business.photos[0]} alt="Cover" className="w-full h-full object-cover" />
            </>
          ) : (
            <div className="absolute inset-0 bg-primary/5" />
          )}
        </div>

        <div className="absolute top-4 right-4 z-20">
          <LanguageSwitcher />
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-4 z-10 relative">
          <div className="w-full max-w-sm bg-background/95 backdrop-blur-md p-8 rounded-2xl shadow-xl border border-border/50 text-center space-y-6">
            {business.logo_url ? (
              <img src={business.logo_url} alt={business.name} className="w-24 h-24 mx-auto rounded-full object-cover shadow-sm border border-background" />
            ) : (
              <div className="w-24 h-24 mx-auto rounded-full bg-primary/10 flex items-center justify-center text-primary shadow-sm border border-background">
                <Scissors className="w-10 h-10" />
              </div>
            )}
            
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{business.name}</h1>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                Welcome to our booking portal. Please sign in or continue as a guest to make an appointment.
              </p>
            </div>

            {authMode === 'options' ? (
              <div className="space-y-3 pt-4">
                <Button className="w-full h-12 text-md font-medium" onClick={() => setAuthMode('login')}>Sign In</Button>
                <Button className="w-full h-12 text-md font-medium" variant="outline" onClick={() => setAuthMode('signup')}>Create Account</Button>
                <div className="pt-2">
                  <Button className="w-full h-12 text-md text-muted-foreground" variant="ghost" onClick={handleGuest}>Continue as Guest</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 pt-2 text-left animate-in fade-in zoom-in-95 duration-200">
                {authMode === 'signup' && (
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input value={name} onChange={e => setName(e.target.value)} className="bg-background/50" />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} className="bg-background/50" />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input type="password" value={password} onChange={e => setPassword(e.target.value)} className="bg-background/50" />
                </div>
                <div className="pt-2 space-y-3">
                  <Button className="w-full h-12" onClick={handleAuth} disabled={authLoading}>
                    {authMode === 'login' ? 'Sign In' : 'Create Account'}
                  </Button>
                  <Button className="w-full h-12" variant="ghost" onClick={() => setAuthMode('options')}>
                    Back
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 flex flex-col">
      <header className="bg-background border-b border-border sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to={`/app/${business.slug}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            {business.logo_url ? (
              <img src={business.logo_url} alt={business.name} className="w-10 h-10 rounded-full object-cover border border-primary/20" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                <Scissors className="w-5 h-5" />
              </div>
            )}
            <h1 className="font-bold text-xl tracking-tight truncate max-w-[200px] sm:max-w-[400px] text-primary">{business.name}</h1>
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <main className="flex-1 w-full mx-auto bg-background min-h-[calc(100vh-4rem)] pb-20 relative">
        <Outlet context={{ business }} />
      </main>
    </div>
  );
}
