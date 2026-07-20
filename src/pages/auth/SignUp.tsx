import React from 'react';
import { supabase } from '@/db/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  ShieldCheck,
  Store,
  Users,
} from 'lucide-react';
import { getIndustryConfig, isIndustryKey } from '@/config/industries';
import { IndustryThemeRoot } from '@/theme';

export default function SignUp() {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [fullName, setFullName] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedIndustry = searchParams.get('industry');
  const industryKey = isIndustryKey(requestedIndustry) ? requestedIndustry : 'hair_salon';
  const industry = getIndustryConfig(industryKey);

  const handleSignUp = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          role: 'Business Owner',
          industry_key: industry.key,
        },
      },
    });

    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success('Account created. Please sign in to continue setup.');
    navigate('/sign-in');
  };

  return (
    <IndustryThemeRoot industryKey={industry.key}>
      <div className="min-h-screen bg-background lg:h-screen lg:overflow-hidden">
        <div className="grid min-h-screen lg:h-full lg:min-h-0 lg:grid-cols-[1.04fr_0.96fr]">
          <section className="relative hidden overflow-hidden bg-zinc-950 px-8 py-6 text-white lg:flex lg:flex-col lg:justify-between xl:px-12 xl:py-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.30),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.18),transparent_30%)]" />
            <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,.14)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.14)_1px,transparent_1px)] [background-size:40px_40px]" />

            <div className="relative">
              <Link to="/" className="inline-flex items-center gap-3">
                <img src="/brand/barber-saas-logo.jpg" alt="BusinessOS" className="h-10 w-10 rounded-xl object-cover shadow-lg" />
                <div><div className="font-extrabold">BusinessOS</div><div className="text-[10px] uppercase tracking-[0.16em] text-white/50">Beauty business platform</div></div>
              </Link>

              <div className="mt-8 max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/80">
                  {industry.icon} {industry.name} setup
                </div>
                <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-[-0.04em] xl:text-5xl">
                  Build a polished digital home for your business.
                </h1>
                <p className="mt-4 max-w-xl text-sm leading-6 text-white/65 xl:text-base">
                  Create your owner account, complete setup and launch your booking workspace in a guided process.
                </p>

                <div className="mt-6 grid grid-cols-2 gap-2.5">
                  <Benefit icon={<CalendarDays className="h-4 w-4" />} text="Professional calendar" />
                  <Benefit icon={<Users className="h-4 w-4" />} text="Staff and customers" />
                  <Benefit icon={<Store className="h-4 w-4" />} text="Branded storefront" />
                  <Benefit icon={<BarChart3 className="h-4 w-4" />} text="Business reports" />
                </div>
              </div>
            </div>

            <div className="relative rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div><div className="text-sm font-bold">14 days free. No card required.</div><p className="mt-1 text-xs leading-5 text-white/55">Your workspace and business data stay isolated from every other company on the platform.</p></div>
              </div>
            </div>
          </section>

          <main className="flex min-h-screen items-center justify-center px-4 py-5 sm:px-6 lg:h-full lg:min-h-0 lg:overflow-hidden lg:px-8 lg:py-4">
            <div className="w-full max-w-[500px]">
              <div className="mb-4 flex items-center justify-between lg:hidden">
                <Link to="/" className="flex items-center gap-3"><img src="/brand/barber-saas-logo.jpg" alt="BusinessOS" className="h-10 w-10 rounded-xl object-cover" /><div><div className="font-extrabold">BusinessOS</div><div className="text-xs text-muted-foreground">Owner registration</div></div></Link>
              </div>

              <Link to="/" className="mb-3 hidden items-center gap-2 text-xs font-semibold text-muted-foreground transition hover:text-foreground lg:inline-flex">
                <ArrowLeft className="h-4 w-4" /> Change business type
              </Link>

              <div className="rounded-3xl border bg-card p-5 shadow-card sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Owner registration · {industry.shortName}</div>
                    <h2 className="mt-2 text-2xl font-extrabold tracking-tight">Create your business account</h2>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">Account first. Business details and storefront setup follow next.</p>
                  </div>
                  <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xl sm:flex">{industry.icon}</div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <ProgressStep label="Account" active />
                  <ProgressStep label="Business" />
                  <ProgressStep label="Launch" />
                </div>

                <form onSubmit={handleSignUp} className="mt-5 space-y-3.5">
                  <Field label="Owner full name" htmlFor="fullName">
                    <Input id="fullName" type="text" placeholder="John Doe" value={fullName} onChange={(event) => setFullName(event.target.value)} required autoComplete="name" className="h-10 rounded-xl" />
                  </Field>

                  <Field label="Business email" htmlFor="email">
                    <Input id="email" type="email" placeholder="owner@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" className="h-10 rounded-xl" />
                  </Field>

                  <Field label="Create password" htmlFor="password">
                    <div className="relative">
                      <Input id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} autoComplete="new-password" className="h-10 rounded-xl pr-11" />
                      <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </Field>

                  <Button type="submit" className="h-11 w-full rounded-xl" disabled={loading}>{loading ? 'Creating account...' : 'Create owner account'}</Button>
                </form>

                <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-muted/40 p-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <p className="text-[11px] leading-4 text-muted-foreground">Creating an account starts your guided onboarding. Customer and business data remain private to your workspace.</p>
                </div>

                <div className="mt-4 text-center text-xs"><span className="text-muted-foreground">Already have an owner account? </span><Link to="/sign-in" className="font-bold text-primary hover:text-primary/80">Business login</Link></div>
              </div>

              <p className="mt-3 text-center text-[10px] leading-4 text-muted-foreground">For business owners only. Customers register through the public page of their selected business.</p>
            </div>
          </main>
        </div>
      </div>
    </IndustryThemeRoot>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label htmlFor={htmlFor} className="text-xs font-semibold">{label}</Label>{children}</div>;
}

function Benefit({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.05] p-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-primary">{icon}</div><span className="text-xs font-semibold text-white/80">{text}</span></div>;
}

function ProgressStep({ label, active = false }: { label: string; active?: boolean }) {
  return <div className={`rounded-xl border px-2 py-2 text-center text-[10px] font-bold ${active ? 'border-primary bg-primary/10 text-foreground' : 'bg-muted/20 text-muted-foreground'}`}><div className={`mx-auto mb-1 flex h-5 w-5 items-center justify-center rounded-full ${active ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>{active ? <Check className="h-3 w-3" /> : ''}</div>{label}</div>;
}
