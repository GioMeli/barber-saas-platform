import React from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/db/supabase';
import { Button } from '@/components/ui/button';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
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
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();

  React.useEffect(() => {
    if (searchParams.get('confirmed') === 'true') {
      toast.success(t('auth.confirmed'));
    }
  }, [searchParams]);

  const handleSignIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    const metadataIndustry = data.user?.user_metadata?.industry_key;
    if (typeof metadataIndustry === 'string' && metadataIndustry.trim()) {
      window.localStorage.setItem('velliqo.selectedIndustry', metadataIndustry);
      window.localStorage.setItem(
        `velliqo.selectedIndustry:${data.user.email?.toLowerCase() ?? email.trim().toLowerCase()}`,
        metadataIndustry
      );
    }

    toast.success(t('auth.signed_in'));
    navigate('/dashboard');
  };

  return (
    <div className="h-screen overflow-hidden bg-background">
      <div className="grid h-full lg:grid-cols-[0.96fr_1.04fr]">
        <section className="relative hidden overflow-hidden bg-zinc-950 px-8 py-6 text-white lg:flex lg:flex-col lg:justify-between xl:px-12 xl:py-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(236,72,153,0.22),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(234,179,8,0.18),transparent_30%)]" />
          <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,.14)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.14)_1px,transparent_1px)] [background-size:40px_40px]" />

          <div className="relative">
            <Link to="/" className="inline-flex items-center gap-3">
              <img src="/brand/velliqo-logo.png" alt="Velliqo" className="h-10 w-10 rounded-xl object-cover shadow-lg" />
              <div><div className="font-extrabold">Velliqo</div><div className="text-[10px] uppercase tracking-[0.16em] text-white/50">Book. Manage. Grow.</div></div>
            </Link>

            <div className="mt-8 max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/80"><Sparkles className="h-4 w-4 text-pink-400" />{t('auth.secure_workspace')}</div>
              <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-[-0.04em] xl:text-5xl">{t('auth.hero_title')}</h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-white/65 xl:text-base">{t('auth.hero_description')}</p>

              <div className="mt-6 grid grid-cols-2 gap-2.5">
                <Feature icon={<CalendarDays className="h-4 w-4" />} title={t('auth.appointments')} text={t('auth.appointments_text')} />
                <Feature icon={<Users className="h-4 w-4" />} title={t('auth.operations')} text={t('auth.operations_text')} />
                <Feature icon={<Store className="h-4 w-4" />} title={t('auth.storefront')} text={t('auth.storefront_text')} />
                <Feature icon={<BarChart3 className="h-4 w-4" />} title={t('auth.insights')} text={t('auth.insights_text')} />
              </div>
            </div>
          </div>

          <div className="relative rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur">
            <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-pink-400" /><div><div className="text-sm font-bold">{t('auth.secure_access')}</div><p className="mt-1 text-xs leading-5 text-white/55">{t('auth.secure_access_text')}</p></div></div>
          </div>
        </section>

        <main className="relative flex h-full items-center justify-center overflow-hidden px-4 py-4 sm:px-6 lg:px-8">
          <div className="absolute right-4 top-4 z-10 sm:right-6"><LanguageSwitcher /></div>
          <div className="w-full max-w-lg">
            <div className="mb-4 flex items-center gap-3 lg:hidden"><img src="/brand/velliqo-logo.png" alt="Velliqo" className="h-10 w-10 rounded-xl object-cover" /><div><div className="font-extrabold">Velliqo</div><div className="text-xs text-muted-foreground">{t('auth.business_access')}</div></div></div>

            <div className="rounded-[2rem] border bg-card p-7 shadow-card sm:p-9">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">{t('auth.business_login')}</div>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight">{t('auth.access_workspace')}</h2>
              <p className="mt-2 text-sm leading-5 text-muted-foreground">{t('auth.access_description')}</p>

              <form onSubmit={handleSignIn} className="mt-5 space-y-4">
                <div className="space-y-1.5"><Label htmlFor="email" className="text-xs font-semibold">{t('auth.business_email')}</Label><Input id="email" type="email" placeholder="owner@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" className="h-12 rounded-xl text-base" /></div>
                <div className="space-y-1.5"><Label htmlFor="password" className="text-xs font-semibold">{t('auth.password')}</Label><div className="relative"><Input id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" className="h-12 rounded-xl pr-11 text-base" /><button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? t('auth.hide_password') : t('auth.show_password')}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>
                <Button type="submit" className="h-12 w-full rounded-xl text-base" disabled={loading}>{loading ? t('auth.signing_in') : t('auth.sign_in_workspace')}</Button>
              </form>

              <div className="mt-5 rounded-xl bg-muted/40 p-3"><div className="flex items-start gap-2.5"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><p className="text-[11px] leading-4 text-muted-foreground">{t('auth.membership_note')}</p></div></div>
              <div className="mt-5 text-center text-xs"><span className="text-muted-foreground">{t('auth.new_to_velliqo')} </span><Link to="/business-types" className="font-bold text-primary hover:text-primary/80">{t('auth.choose_setup')}</Link></div>
            </div>

            <p className="mt-3 text-center text-[10px] leading-4 text-muted-foreground">{t('auth.authorized_only')}</p>
          </div>
        </main>
      </div>
    </div>
  );
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="rounded-xl border border-white/10 bg-white/[0.05] p-3"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-pink-400">{icon}</div><div className="mt-2 text-xs font-bold">{title}</div><p className="mt-1 text-[10px] leading-4 text-white/55">{text}</p></div>;
}
