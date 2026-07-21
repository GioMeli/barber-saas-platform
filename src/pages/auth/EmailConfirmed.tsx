import React from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/db/supabase';

export default function EmailConfirmed() {
  const navigate = useNavigate();

  React.useEffect(() => {
    let active = true;
    const complete = async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 900));
      await supabase.auth.signOut();
      await new Promise((resolve) => window.setTimeout(resolve, 900));
      if (active) navigate('/sign-in?confirmed=true', { replace: true });
    };
    void complete();
    return () => { active = false; };
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 px-4">
      <div className="w-full max-w-lg rounded-[2rem] border border-emerald-100 bg-white p-8 text-center shadow-[0_30px_80px_rgba(15,23,42,.12)]">
        <img src="/brand/velliqo-logo.png" alt="Velliqo" className="mx-auto h-14 w-14 rounded-2xl object-contain" />
        <div className="mx-auto mt-7 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><CheckCircle2 className="h-9 w-9" /></div>
        <h1 className="mt-6 text-3xl font-extrabold tracking-tight">Email confirmed.</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-600">Your Velliqo account is now active. We are securely redirecting you to Business Login.</p>
        <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-violet-700"><Loader2 className="h-4 w-4 animate-spin"/>Redirecting...</div>
      </div>
    </div>
  );
}
