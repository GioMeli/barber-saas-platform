import { ArrowRight, MailCheck, ShieldCheck } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function CheckEmail() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const email = params.get('email') || t('auth.email_fallback');

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 px-4 py-10">
      <div className="absolute right-4 top-4"><LanguageSwitcher /></div>
      <div className="w-full max-w-xl rounded-[2rem] border border-violet-100 bg-white p-7 text-center shadow-[0_30px_80px_rgba(76,29,149,.14)] sm:p-10">
        <img src="/brand/velliqo-logo.png" alt="Velliqo" className="mx-auto h-14 w-14 rounded-2xl object-contain" />
        <div className="mx-auto mt-7 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><MailCheck className="h-8 w-8" /></div>
        <div className="mt-6 text-xs font-extrabold uppercase tracking-[0.2em] text-violet-600">{t('auth.confirm_account')}</div>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950">{t('auth.check_inbox')}</h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-slate-600">{t('auth.confirm_email_sent', { email })}</p>
        <div className="mt-6 rounded-2xl border border-violet-100 bg-violet-50 p-4 text-left">
          <div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-violet-700"/><div><div className="text-sm font-bold text-violet-950">{t('auth.what_next')}</div><p className="mt-1 text-xs leading-5 text-violet-900/70">{t('auth.after_confirmation')}</p></div></div>
        </div>
        <Button asChild className="mt-7 h-12 w-full rounded-xl"><Link to="/sign-in">{t('auth.go_to_login')} <ArrowRight className="ml-2 h-4 w-4"/></Link></Button>
        <p className="mt-5 text-xs leading-5 text-slate-500">{t('auth.email_delay')}</p>
      </div>
    </div>
  );
}
