import { ArrowRight, MailCheck, ShieldCheck } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function CheckEmail() {
  const [params] = useSearchParams();
  const email = params.get('email') || 'your email address';

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 px-4 py-10">
      <div className="w-full max-w-xl rounded-[2rem] border border-violet-100 bg-white p-7 text-center shadow-[0_30px_80px_rgba(76,29,149,.14)] sm:p-10">
        <img src="/brand/velliqo-logo.png" alt="Velliqo" className="mx-auto h-14 w-14 rounded-2xl object-contain" />
        <div className="mx-auto mt-7 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><MailCheck className="h-8 w-8" /></div>
        <div className="mt-6 text-xs font-extrabold uppercase tracking-[0.2em] text-violet-600">Confirm your account</div>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950">Check your inbox.</h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-slate-600">We sent a secure confirmation link to <strong className="text-slate-950">{email}</strong>. Open the email and confirm your address to activate your Velliqo account.</p>
        <div className="mt-6 rounded-2xl border border-violet-100 bg-violet-50 p-4 text-left">
          <div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-violet-700"/><div><div className="text-sm font-bold text-violet-950">What happens next?</div><p className="mt-1 text-xs leading-5 text-violet-900/70">After confirmation, Velliqo will automatically return you to the Business Login page so you can securely access your workspace.</p></div></div>
        </div>
        <Button asChild className="mt-7 h-12 w-full rounded-xl"><Link to="/sign-in">Go to Business Login <ArrowRight className="ml-2 h-4 w-4"/></Link></Button>
        <p className="mt-5 text-xs leading-5 text-slate-500">The email may take a few minutes. Check your spam or promotions folder if it does not appear.</p>
      </div>
    </div>
  );
}
