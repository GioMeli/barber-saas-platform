import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Apple,
  BookOpen,
  Brain,
  Building,
  Building2,
  Calculator,
  Camera,
  Car,
  CircleDot,
  Dog,
  Dumbbell,
  Fan,
  HeartHandshake,
  Landmark,
  Languages,
  Leaf,
  MessageCircle,
  Music2,
  PartyPopper,
  PawPrint,
  PenTool,
  PersonStanding,
  Presentation,
  Scale,
  Scissors,
  ShieldCheck,
  SmilePlus,
  Sparkles,
  SprayCan,
  Stethoscope,
  Video,
  WandSparkles,
  Waves,
  Wrench,
  Zap,
} from 'lucide-react';
import type { IndustryCategoryKey, IndustryKey } from '@/config/industries/industry.types';
import { cn } from '@/lib/utils';

const INDUSTRY_ICONS: Partial<Record<IndustryKey, LucideIcon>> = {
  appointment_service_business: Presentation,
  hair_salon: Scissors,
  barber_shop: Scissors,
  beauty_studio: Sparkles,
  nail_salon: WandSparkles,
  spa: Waves,
  massage_center: HeartHandshake,
  wellness_center: Leaf,
  aesthetic_clinic: Sparkles,
  tattoo_studio: PenTool,
  physiotherapy: Activity,
  chiropractic: Activity,
  nutritionist: Apple,
  psychology_practice: Brain,
  speech_therapy: MessageCircle,
  dental_clinic: SmilePlus,
  medical_practice: Stethoscope,
  personal_training: Dumbbell,
  gym_studio: Dumbbell,
  pilates_studio: PersonStanding,
  yoga_studio: Leaf,
  dance_studio: Music2,
  pet_grooming: PawPrint,
  veterinary_clinic: Stethoscope,
  dog_training: Dog,
  car_wash: Waves,
  car_detailing: Sparkles,
  mechanic: Wrench,
  tyre_shop: CircleDot,
  cleaning_company: SprayCan,
  electrician: Zap,
  plumber: Wrench,
  hvac: Fan,
  pest_control: ShieldCheck,
  law_firm: Scale,
  accounting_firm: Calculator,
  consultancy: Presentation,
  financial_advisor: Landmark,
  real_estate: Building2,
  tutoring: BookOpen,
  language_school: Languages,
  music_school: Music2,
  driving_school: Car,
  photography_studio: Camera,
  videography_studio: Video,
  wedding_planner: HeartHandshake,
  event_planner: PartyPopper,
  venue_booking: Building,
};

const CATEGORY_STYLES: Record<IndustryCategoryKey, {
  shell: string;
  icon: string;
  glow: string;
  label: string;
}> = {
  beauty_personal_care: {
    shell: 'bg-[linear-gradient(135deg,#fff1f2_0%,#fce7f3_52%,#f5d0fe_100%)]',
    icon: 'bg-rose-600 text-white shadow-rose-300/70',
    glow: 'bg-fuchsia-400/30',
    label: 'text-rose-700',
  },
  health_wellness: {
    shell: 'bg-[linear-gradient(135deg,#eff6ff_0%,#e0f2fe_52%,#cffafe_100%)]',
    icon: 'bg-sky-600 text-white shadow-sky-300/70',
    glow: 'bg-cyan-400/30',
    label: 'text-sky-700',
  },
  fitness: {
    shell: 'bg-[linear-gradient(135deg,#fff7ed_0%,#ffedd5_52%,#fed7aa_100%)]',
    icon: 'bg-orange-600 text-white shadow-orange-300/70',
    glow: 'bg-amber-400/30',
    label: 'text-orange-700',
  },
  pet_services: {
    shell: 'bg-[linear-gradient(135deg,#ecfdf5_0%,#d1fae5_52%,#a7f3d0_100%)]',
    icon: 'bg-emerald-600 text-white shadow-emerald-300/70',
    glow: 'bg-teal-400/30',
    label: 'text-emerald-700',
  },
  automotive: {
    shell: 'bg-[linear-gradient(135deg,#f8fafc_0%,#e2e8f0_52%,#cbd5e1_100%)]',
    icon: 'bg-slate-800 text-white shadow-slate-400/60',
    glow: 'bg-slate-500/25',
    label: 'text-slate-700',
  },
  home_services: {
    shell: 'bg-[linear-gradient(135deg,#ecfeff_0%,#cffafe_52%,#a5f3fc_100%)]',
    icon: 'bg-cyan-700 text-white shadow-cyan-300/70',
    glow: 'bg-sky-400/25',
    label: 'text-cyan-800',
  },
  professional_services: {
    shell: 'bg-[linear-gradient(135deg,#eef2ff_0%,#e0e7ff_52%,#c7d2fe_100%)]',
    icon: 'bg-indigo-700 text-white shadow-indigo-300/70',
    glow: 'bg-violet-400/25',
    label: 'text-indigo-800',
  },
  education: {
    shell: 'bg-[linear-gradient(135deg,#fffbeb_0%,#fef3c7_52%,#fde68a_100%)]',
    icon: 'bg-amber-600 text-white shadow-amber-300/70',
    glow: 'bg-yellow-400/25',
    label: 'text-amber-800',
  },
  creative_services: {
    shell: 'bg-[linear-gradient(135deg,#fdf4ff_0%,#fae8ff_52%,#e9d5ff_100%)]',
    icon: 'bg-fuchsia-700 text-white shadow-fuchsia-300/70',
    glow: 'bg-purple-400/25',
    label: 'text-fuchsia-800',
  },
  events: {
    shell: 'bg-[linear-gradient(135deg,#f5f3ff_0%,#ede9fe_52%,#ddd6fe_100%)]',
    icon: 'bg-violet-700 text-white shadow-violet-300/70',
    glow: 'bg-fuchsia-400/25',
    label: 'text-violet-800',
  },
};

type IndustryVisualProps = {
  industryKey: IndustryKey;
  category: IndustryCategoryKey;
  emoji: string;
  name: string;
  className?: string;
};

export function IndustryVisual({ industryKey, category, emoji, name, className }: IndustryVisualProps) {
  const Icon = INDUSTRY_ICONS[industryKey] || Sparkles;
  const style = CATEGORY_STYLES[category];

  return (
    <div
      role="img"
      aria-label={`${name} illustration`}
      data-industry-visual={industryKey}
      className={cn('relative h-[118px] overflow-hidden border-b border-white/80', style.shell, className)}
    >
      <div className="absolute inset-0 opacity-45 [background-image:linear-gradient(rgba(255,255,255,.65)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.65)_1px,transparent_1px)] [background-size:22px_22px]" />
      <div className={cn('absolute -right-8 -top-10 h-36 w-36 rounded-full blur-2xl', style.glow)} />
      <div className="absolute -bottom-12 left-12 h-28 w-28 rounded-full bg-white/65 blur-2xl" />

      <div className="relative flex h-full items-center justify-between px-5">
        <div className="flex flex-col gap-2">
          <span className={cn('text-[10px] font-extrabold uppercase tracking-[.18em]', style.label)}>{name}</span>
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/80 bg-white/80 text-2xl shadow-sm backdrop-blur">
            {emoji}
          </span>
        </div>
        <span className={cn('flex h-20 w-20 items-center justify-center rounded-[1.6rem] shadow-xl ring-4 ring-white/55', style.icon)}>
          <Icon className="h-10 w-10" strokeWidth={1.75} />
        </span>
      </div>
    </div>
  );
}
