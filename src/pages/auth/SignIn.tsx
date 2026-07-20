import React from 'react';
import { supabase } from '@/db/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useNavigate, Link } from 'react-router-dom';
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Eye,
  EyeOff,
  ShieldCheck,
  Sparkles,
  Store,
  Users,
} from 'lucide-react';

export default function SignIn() {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const navigate = useNavigate();

  const handleSignIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success('Signed in successfully.');
    navigate('/dashboard');
  };

  return (
    <div className="h-screen overflow-hidden bg-background">
      <div className="grid h-full lg:grid-cols-[1.08fr_0.92fr]">
        <section className="relative hidden overflow-hidden bg-zinc-950 px-8 py-6 text-white lg:flex lg:flex-col lg:justify-between xl:px-12 xl:py-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(236,72,153,0.22),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(234,179,8,0.18),transparent_30%)]" />
          <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,.14)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.14)_1px,transparent_1px)] [background-size:40px_40px]" />

          <div className="relative">
            <Link to="/" className="inline-flex items-center gap-3">
              <img src="/brand/barber-saas-logo.jpg" alt="BusinessOS" className="h-10 w-10 rounded-xl object-cover shadow-lg" />
              <div><div className="font-extrabold">BusinessOS</div><div className="text-[10px] uppercase tracking-[0.16em] text-white/50">Beauty business platform</div></div>
            </Link>

            <div className="mt-8 max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/80"><Sparkles className="h-4 w-4 text-pink-400" />One secure workspace for every business type</div>
              <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-[-0.04em] xl:text-5xl">Manage your business from one professional platform.</h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-white/65 xl:text-base">Your account opens the correct workspace automatically—whether you operate a salon, barber shop, beauty studio or another supported business.</p>

              <div className="mt-6 grid grid-cols-2 gap-2.5">
                <Feature icon={<CalendarDays className="h-4 w-4" />} title="Appointments" text="Calendar and real availability" />
                <Feature icon={<Users className="h-4 w-4" />} title="Operations" text="Staff and customer management" />
                <Feature icon={<Store className="h-4 w-4" />} title="Storefront" text="Public booking experience" />
                <Feature icon={<BarChart3 className="h-4 w-4" />} title="Insights" text="Clear business reporting" />
              </div>
            </div>
          </div>

          <div className="relative rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur">
            <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-pink-400" /><div><div className="text-sm font-bold">Secure business access</div><p className="mt-1 text-xs leading-5 text-white/55">Each company’s customers, staff and operational records remain separated inside the platform.</p></div></div>
          </div>
        </section>

        <main className="flex h-full items-center justify-center overflow-hidden px-4 py-4 sm:px-6 lg:px-8">
          <div className="w-full max-w-md">
            <div className="mb-4 flex items-center gap-3 lg:hidden"><img src="/brand/barber-saas-logo.jpg" alt="BusinessOS" className="h-10 w-10 rounded-xl object-cover" /><div><div className="font-extrabold">BusinessOS</div><div className="text-xs text-muted-foreground">Business access</div></div></div>

            <div className="rounded-3xl border bg-card p-5 shadow-card sm:p-6">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Business login</div>
              <h2 className="mt-2 text-2xl font-extrabold tracking-tight">Access your workspace</h2>
              <p className="mt-2 text-sm leading-5 text-muted-foreground">Sign in once. The platform will load the business and industry connected to your account.</p>

              <form onSubmit={handleSignIn} className="mt-5 space-y-4">
                <div className="space-y-1.5"><Label htmlFor="email" className="text-xs font-semibold">Business email</Label><Input id="email" type="email" placeholder="owner@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" className="h-11 rounded-xl" /></div>
                <div className="space-y-1.5"><Label htmlFor="password" className="text-xs font-semibold">Password</Label><div className="relative"><Input id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" className="h-11 rounded-xl pr-11" /><button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>
                <Button type="submit" className="h-11 w-full rounded-xl" disabled={loading}>{loading ? 'Signing in...' : 'Sign in to workspace'}</Button>
              </form>

              <div className="mt-5 rounded-xl bg-muted/40 p-3"><div className="flex items-start gap-2.5"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><p className="text-[11px] leading-4 text-muted-foreground">One login page is intentionally used for every owner. Your membership determines the correct business and theme after authentication.</p></div></div>
              <div className="mt-5 text-center text-xs"><span className="text-muted-foreground">New to the platform? </span><Link to="/" className="font-bold text-primary hover:text-primary/80">Choose your business setup</Link></div>
            </div>

            <p className="mt-3 text-center text-[10px] leading-4 text-muted-foreground">Business owners and authorised staff only. Customers access accounts through each business’s public page.</p>
          </div>
        </main>
      </div>
    </div>
  );
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="rounded-xl border border-white/10 bg-white/[0.05] p-3"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-pink-400">{icon}</div><div className="mt-2 text-xs font-bold">{title}</div><p className="mt-1 text-[10px] leading-4 text-white/55">{text}</p></div>;
}
