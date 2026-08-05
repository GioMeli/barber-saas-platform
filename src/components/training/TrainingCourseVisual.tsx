import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Bot,
  CalendarDays,
  CreditCard,
  Megaphone,
  PackageCheck,
  Rocket,
  Scissors,
  ShieldCheck,
  ShoppingBag,
  Store,
  Users,
  UsersRound,
  Video,
} from 'lucide-react';
import type { TrainingCategory, TrainingGuideSlug } from '@/training/catalog';
import { cn } from '@/lib/utils';

const GUIDE_ICONS: Record<TrainingGuideSlug, LucideIcon> = {
  'getting-started': Rocket,
  'business-storefront': Store,
  'services-pricing': Scissors,
  'staff-availability': Users,
  'calendar-appointments': CalendarDays,
  'customers-profiles': UsersRound,
  'products-sales': ShoppingBag,
  'marketing-content': Megaphone,
  'reports-finance': BarChart3,
  'velliqo-ai': Bot,
  'automations-security': ShieldCheck,
  'billing-subscription': CreditCard,
};

const CATEGORY_STYLES: Record<TrainingCategory, {
  shell: string;
  icon: string;
  pill: string;
  glow: string;
}> = {
  setup: {
    shell: 'border-violet-200/80 bg-[linear-gradient(135deg,#f5f3ff_0%,#ede9fe_52%,#ddd6fe_100%)]',
    icon: 'bg-violet-600 text-white shadow-violet-300/60',
    pill: 'border-violet-200 bg-white/75 text-violet-700',
    glow: 'bg-violet-400/25',
  },
  operations: {
    shell: 'border-sky-200/80 bg-[linear-gradient(135deg,#f0f9ff_0%,#e0f2fe_52%,#bae6fd_100%)]',
    icon: 'bg-sky-600 text-white shadow-sky-300/60',
    pill: 'border-sky-200 bg-white/75 text-sky-700',
    glow: 'bg-sky-400/25',
  },
  growth: {
    shell: 'border-fuchsia-200/80 bg-[linear-gradient(135deg,#fdf4ff_0%,#fae8ff_52%,#f5d0fe_100%)]',
    icon: 'bg-fuchsia-600 text-white shadow-fuchsia-300/60',
    pill: 'border-fuchsia-200 bg-white/75 text-fuchsia-700',
    glow: 'bg-fuchsia-400/25',
  },
  intelligence: {
    shell: 'border-indigo-200/80 bg-[linear-gradient(135deg,#eef2ff_0%,#e0e7ff_52%,#c7d2fe_100%)]',
    icon: 'bg-indigo-600 text-white shadow-indigo-300/60',
    pill: 'border-indigo-200 bg-white/75 text-indigo-700',
    glow: 'bg-indigo-400/25',
  },
  account: {
    shell: 'border-emerald-200/80 bg-[linear-gradient(135deg,#ecfdf5_0%,#d1fae5_52%,#a7f3d0_100%)]',
    icon: 'bg-emerald-600 text-white shadow-emerald-300/60',
    pill: 'border-emerald-200 bg-white/75 text-emerald-700',
    glow: 'bg-emerald-400/25',
  },
};

type TrainingCourseVisualProps = {
  slug: TrainingGuideSlug;
  category: TrainingCategory;
  index: number;
  categoryLabel: string;
  hasVideo: boolean;
  videoLabel: string;
  completed?: boolean;
  completedLabel?: string;
  className?: string;
};

export function TrainingCourseVisual({
  slug,
  category,
  index,
  categoryLabel,
  hasVideo,
  videoLabel,
  completed = false,
  completedLabel = '',
  className,
}: TrainingCourseVisualProps) {
  const Icon = GUIDE_ICONS[slug] || PackageCheck;
  const style = CATEGORY_STYLES[category];

  return (
    <div
      aria-hidden="true"
      data-training-course-visual={slug}
      className={cn(
        'relative h-36 overflow-hidden rounded-[1.35rem] border shadow-inner',
        style.shell,
        className,
      )}
    >
      <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,.55)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.55)_1px,transparent_1px)] [background-size:24px_24px]" />
      <div className={cn('absolute -right-10 -top-10 h-40 w-40 rounded-full blur-2xl', style.glow)} />
      <div className="absolute -bottom-16 left-10 h-32 w-32 rounded-full bg-white/55 blur-2xl" />

      <div className="relative flex h-full flex-col justify-between p-4">
        <div className="flex items-start justify-between gap-3">
          <span className={cn('inline-flex rounded-full border px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[.16em] backdrop-blur', style.pill)}>
            {String(index + 1).padStart(2, '0')} · {categoryLabel}
          </span>
          <span className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[.12em] backdrop-blur',
            hasVideo ? 'border-emerald-200 bg-emerald-50/90 text-emerald-700' : 'border-white/70 bg-white/65 text-slate-500',
          )}>
            <Video className="h-3 w-3" />
            {videoLabel}
          </span>
        </div>

        <div className="flex items-end justify-between gap-4">
          <span className={cn('flex h-16 w-16 items-center justify-center rounded-[1.35rem] shadow-xl ring-4 ring-white/55', style.icon)}>
            <Icon className="h-8 w-8" strokeWidth={1.9} />
          </span>
          <div className="flex flex-col items-end gap-2">
            {completed && (
              <span className="rounded-full border border-emerald-200 bg-white/90 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[.14em] text-emerald-700 shadow-sm">
                {completedLabel}
              </span>
            )}
            <span className="text-[42px] font-black leading-none tracking-[-.08em] text-slate-900/10">
              {String(index + 1).padStart(2, '0')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
