import type { LucideIcon } from 'lucide-react';
import {
  Award,
  BarChart3,
  Bot,
  Building2,
  CalendarCheck2,
  CalendarCog,
  CalendarDays,
  CalendarPlus2,
  ChartNoAxesCombined,
  CheckCircle2,
  Clock3,
  Contact,
  CreditCard,
  Download,
  GraduationCap,
  History,
  Image,
  KeyRound,
  LayoutDashboard,
  LockKeyhole,
  MapPinned,
  Megaphone,
  Mic2,
  Navigation,
  Newspaper,
  PackagePlus,
  Palette,
  QrCode,
  ReceiptText,
  RefreshCw,
  Scissors,
  Send,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  Star,
  UserPlus,
  UserRoundPlus,
  UsersRound,
  WalletCards,
  Warehouse,
  Workflow,
} from 'lucide-react';
import type { TrainingVisualKey } from '@/training/curriculum';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

const ICONS: Record<TrainingVisualKey, LucideIcon> = {
  'user-plus': UserPlus,
  building: Building2,
  navigation: Navigation,
  graduation: GraduationCap,
  palette: Palette,
  map: MapPinned,
  qr: QrCode,
  scissors: Scissors,
  settings: Settings2,
  users: UsersRound,
  clock: Clock3,
  smartphone: Smartphone,
  calendar: CalendarDays,
  'calendar-plus': CalendarPlus2,
  'calendar-check': CalendarCheck2,
  'shield-calendar': ShieldCheck,
  'user-round-plus': UserRoundPlus,
  history: History,
  'package-plus': PackagePlus,
  warehouse: Warehouse,
  'shopping-cart': ShoppingCart,
  receipt: ReceiptText,
  wallet: WalletCards,
  chart: ChartNoAxesCombined,
  megaphone: Megaphone,
  send: Send,
  star: Star,
  newspaper: Newspaper,
  image: Image,
  'bar-chart': BarChart3,
  'chart-network': ChartNoAxesCombined,
  download: Download,
  bot: Bot,
  mic: Mic2,
  workflow: Workflow,
  'lock-calendar': LockKeyhole,
  'credit-card': CreditCard,
  key: KeyRound,
  layout: LayoutDashboard,
  'circle-check': CheckCircle2,
  'calendar-cog': CalendarCog,
  refresh: RefreshCw,
  contact: Contact,
  shield: ShieldCheck,
  award: Award,
};

const TONES = [
  'from-violet-700 via-purple-600 to-fuchsia-500',
  'from-slate-950 via-indigo-900 to-violet-700',
  'from-sky-700 via-cyan-600 to-emerald-500',
  'from-rose-700 via-fuchsia-600 to-violet-600',
  'from-amber-600 via-orange-600 to-rose-600',
];

export function TrainingLessonVisual({
  visual,
  title,
  checklist,
  index = 0,
  compact = false,
  className,
}: {
  visual: TrainingVisualKey;
  title: string;
  checklist: string[];
  index?: number;
  compact?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const Icon = ICONS[visual] || GraduationCap;
  const tone = TONES[index % TONES.length];

  return (
    <div
      aria-hidden="true"
      className={cn(
        'relative overflow-hidden rounded-[1.5rem] bg-gradient-to-br text-white shadow-[0_24px_70px_rgba(76,29,149,.24)]',
        tone,
        compact ? 'min-h-[210px] p-5' : 'min-h-[320px] p-6 sm:p-7',
        className,
      )}
    >
      <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,.55)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.55)_1px,transparent_1px)] [background-size:28px_28px]" />
      <div className="absolute -right-14 -top-16 h-52 w-52 rounded-full bg-white/20 blur-3xl" />
      <div className="absolute -bottom-24 left-0 h-56 w-56 rounded-full bg-black/20 blur-3xl" />

      <div className="relative flex h-full flex-col justify-between gap-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-[1.35rem] border border-white/25 bg-white/15 shadow-xl backdrop-blur">
            <Icon className="h-8 w-8" strokeWidth={1.8} />
          </div>
          <span className="rounded-full border border-white/20 bg-black/15 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.18em] text-white/85 backdrop-blur">
            {t('training.certification.featureLabel', { number: String(index + 1).padStart(2, '0') })}
          </span>
        </div>

        <div>
          <h3 className={cn('max-w-xl font-black tracking-[-.035em]', compact ? 'text-xl' : 'text-2xl sm:text-3xl')}>{title}</h3>
          <div className={cn('mt-4 grid gap-2', compact ? 'grid-cols-1' : 'sm:grid-cols-3')}>
            {checklist.slice(0, 3).map((item, itemIndex) => (
              <div key={`${item}-${itemIndex}`} className="rounded-xl border border-white/15 bg-black/15 p-3 text-[11px] font-semibold leading-5 text-white/80 backdrop-blur">
                <span className="mb-2 flex h-6 w-6 items-center justify-center rounded-lg bg-white/15 text-[10px] font-black">{itemIndex + 1}</span>
                <span className="line-clamp-3">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
