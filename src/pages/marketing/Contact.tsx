import React from 'react';
import {
  ArrowRight,
  Clock3,
  Mail,
  MapPin,
  MessageSquareText,
  Phone,
  Send,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MarketingFooter, MarketingHeader } from '@/components/marketing/MarketingChrome';

const CONTACT_EMAIL = 'georgeau791926@gmail.com';
const CONTACT_PHONE_DISPLAY = '+357 96 211 102';
const CONTACT_PHONE_HREF = '+35796211102';
const CONTACT_REGION = 'Nicosia, Cyprus';

const BUSINESS_TYPES = [
  'Beauty & personal care',
  'Health & wellness',
  'Fitness',
  'Pet services',
  'Automotive services',
  'Home services',
  'Professional services',
  'Education',
  'Creative services',
  'Events',
  'Other appointment-based business',
];

type ContactFormState = {
  fullName: string;
  email: string;
  businessName: string;
  phone: string;
  businessType: string;
  subject: string;
  message: string;
};

const INITIAL_FORM: ContactFormState = {
  fullName: '',
  email: '',
  businessName: '',
  phone: '',
  businessType: '',
  subject: '',
  message: '',
};

export default function Contact() {
  const [form, setForm] = React.useState<ContactFormState>(INITIAL_FORM);
  const [draftOpened, setDraftOpened] = React.useState(false);

  const updateField = (field: keyof ContactFormState) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    setDraftOpened(false);
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const buildMailto = React.useCallback(() => {
    const subject = form.subject.trim() || 'Velliqo website enquiry';
    const body = [
      'Velliqo website enquiry',
      '',
      `Name: ${form.fullName.trim()}`,
      `Email: ${form.email.trim()}`,
      `Business name: ${form.businessName.trim() || 'Not provided'}`,
      `Phone: ${form.phone.trim() || 'Not provided'}`,
      `Business type: ${form.businessType || 'Not selected'}`,
      '',
      'Message:',
      form.message.trim(),
      '',
      'Sent from the Velliqo contact page.',
    ].join('\n');

    return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }, [form]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setDraftOpened(true);
    window.location.href = buildMailto();
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f7f7fb] text-slate-950">
      <MarketingHeader active="contact" />
      <main>
        <section className="relative overflow-hidden border-b border-slate-200 bg-[#0d0b18] text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_8%,rgba(124,58,237,.34),transparent_31%),radial-gradient(circle_at_88%_22%,rgba(217,70,239,.18),transparent_29%),linear-gradient(180deg,#0d0b18_0%,#111025_100%)]" />
          <div className="absolute inset-0 opacity-[.08] [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:56px_56px]" />
          <div className="relative mx-auto grid max-w-[1280px] items-center gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[.82fr_1.18fr] lg:px-8 lg:py-24">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-400/10 px-3 py-1.5 text-xs font-extrabold text-violet-200">
                <Sparkles className="h-4 w-4" /> Contact Velliqo
              </div>
              <h1 className="mt-7 text-4xl font-extrabold leading-[1.02] tracking-[-.055em] sm:text-5xl lg:text-6xl">
                Tell us what your business needs next.
              </h1>
              <p className="mt-6 text-base leading-7 text-white/60 sm:text-lg">
                Ask about the platform, onboarding, pricing, integrations or the best Velliqo setup for your appointment-based business.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="h-12 rounded-xl bg-white px-6 text-slate-950 hover:bg-white/90">
                  <a href={`mailto:${CONTACT_EMAIL}`}>Email Velliqo <ArrowRight className="ml-2 h-4 w-4" /></a>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-12 rounded-xl border-white/15 bg-white/[.04] px-6 text-white hover:bg-white/[.08] hover:text-white">
                  <a href={`tel:${CONTACT_PHONE_HREF}`}>Call {CONTACT_PHONE_DISPLAY}</a>
                </Button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              <ContactCard icon={<Mail className="h-5 w-5" />} label="Email" value={CONTACT_EMAIL} href={`mailto:${CONTACT_EMAIL}`} />
              <ContactCard icon={<Phone className="h-5 w-5" />} label="Phone" value={CONTACT_PHONE_DISPLAY} href={`tel:${CONTACT_PHONE_HREF}`} />
              <ContactCard icon={<MapPin className="h-5 w-5" />} label="Region" value={CONTACT_REGION} />
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-[1280px] gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[.72fr_1.28fr] lg:px-8 lg:py-24">
          <aside className="space-y-5">
            <div className="rounded-[2rem] border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-6 shadow-[0_22px_70px_rgba(76,29,149,.10)] sm:p-7">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><MessageSquareText className="h-5 w-5" /></div>
              <h2 className="mt-5 text-2xl font-extrabold tracking-tight">Start with a clear enquiry.</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">The form opens a prepared email draft in your email application. You can review the message and attachments before sending it.</p>
              <div className="mt-6 space-y-4">
                <InfoLine icon={<Clock3 className="h-4 w-4" />} title="Response channel" text="Replies are sent to the email address you provide." />
                <InfoLine icon={<ShieldCheck className="h-4 w-4" />} title="You stay in control" text="The form does not send automatically; it creates a reviewable email draft." />
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_16px_55px_rgba(15,23,42,.055)]">
              <div className="text-xs font-extrabold uppercase tracking-[.18em] text-violet-600">Planning a workspace?</div>
              <h3 className="mt-3 text-lg font-extrabold">Explore the platform before contacting us.</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">See how the owner workspace, customer booking and Velliqo AI work together.</p>
              <Button asChild variant="outline" className="mt-5 w-full rounded-xl"><Link to="/experience">View product experience</Link></Button>
            </div>
          </aside>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_28px_90px_rgba(15,23,42,.09)] sm:p-8">
            <div className="max-w-2xl">
              <div className="text-xs font-extrabold uppercase tracking-[.2em] text-violet-600">Email draft form</div>
              <h2 className="mt-3 text-3xl font-extrabold tracking-[-.04em]">Prepare your message to Velliqo.</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">Required fields are marked. Your email application will open with the details already placed in the draft.</p>
            </div>

            <form className="mt-8 grid gap-5" onSubmit={handleSubmit}>
              <div className="grid gap-5 sm:grid-cols-2">
                <FormField label="Full name" required>
                  <Input value={form.fullName} onChange={updateField('fullName')} placeholder="Your full name" autoComplete="name" required className="h-12 rounded-xl" />
                </FormField>
                <FormField label="Email" required>
                  <Input type="email" value={form.email} onChange={updateField('email')} placeholder="you@business.com" autoComplete="email" required className="h-12 rounded-xl" />
                </FormField>
                <FormField label="Business name">
                  <Input value={form.businessName} onChange={updateField('businessName')} placeholder="Your business" autoComplete="organization" className="h-12 rounded-xl" />
                </FormField>
                <FormField label="Phone">
                  <Input type="tel" value={form.phone} onChange={updateField('phone')} placeholder="Optional contact number" autoComplete="tel" className="h-12 rounded-xl" />
                </FormField>
              </div>

              <FormField label="Business type">
                <select value={form.businessType} onChange={updateField('businessType')} className="flex h-12 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                  <option value="">Select the closest business type</option>
                  {BUSINESS_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </FormField>

              <FormField label="Subject">
                <Input value={form.subject} onChange={updateField('subject')} placeholder="What would you like to discuss?" className="h-12 rounded-xl" />
              </FormField>

              <FormField label="Message" required>
                <Textarea value={form.message} onChange={updateField('message')} placeholder="Tell us about your current workflow, team and what you would like Velliqo to help with." required className="min-h-[180px] resize-y rounded-xl" />
              </FormField>

              <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-5 text-slate-500">The message opens in your configured email application and is not sent until you approve it there.</p>
                <Button type="submit" size="lg" className="h-12 shrink-0 rounded-xl bg-violet-600 px-6 hover:bg-violet-700">
                  Open email draft <Send className="ml-2 h-4 w-4" />
                </Button>
              </div>

              {draftOpened && (
                <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
                  Your email application should now show a prepared draft addressed to {CONTACT_EMAIL}.
                </div>
              )}
            </form>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}

function ContactCard({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: string; href?: string }) {
  const content = (
    <>
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-400/15 text-violet-200">{icon}</div>
      <div className="mt-5 text-[10px] font-extrabold uppercase tracking-[.2em] text-white/35">{label}</div>
      <div className="mt-2 break-words text-sm font-extrabold text-white">{value}</div>
    </>
  );

  return href
    ? <a href={href} className="rounded-3xl border border-white/10 bg-white/[.055] p-5 transition hover:-translate-y-0.5 hover:bg-white/[.08]">{content}</a>
    : <div className="rounded-3xl border border-white/10 bg-white/[.055] p-5">{content}</div>;
}

function InfoLine({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-violet-700 shadow-sm">{icon}</span>
      <div><div className="text-sm font-extrabold">{title}</div><p className="mt-1 text-xs leading-5 text-slate-600">{text}</p></div>
    </div>
  );
}

function FormField({ label, required = false, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-bold text-slate-800">
      <span>{label}{required && <span className="ml-1 text-rose-500">*</span>}</span>
      {children}
    </label>
  );
}
