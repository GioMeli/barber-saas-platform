import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function PageContainer({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-7xl min-w-0 px-3 py-6 pb-28 sm:px-6 sm:py-10 md:pb-12', className)}>{children}</div>;
}

export function PageHero({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/15 via-card to-card shadow-card">
      <div className="grid min-w-0 gap-6 p-4 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          {eyebrow && <div className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</div>}
          <h1 className="mt-2 break-words text-2xl font-bold leading-tight tracking-tight sm:text-4xl">{title}</h1>
          {description && <div className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">{description}</div>}
          {children && <div className="mt-6">{children}</div>}
        </div>
        {actions && <div className="grid w-full gap-2 sm:flex sm:flex-wrap sm:gap-3 lg:w-auto lg:justify-end [&>*]:w-full sm:[&>*]:w-auto">{actions}</div>}
      </div>
    </section>
  );
}

export function MetricCard({
  title,
  value,
  icon,
  caption,
  compact = false,
}: {
  title: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  caption?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className="metric-card h-full">
      <div className="flex h-full items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm text-muted-foreground">{title}</div>
          <div className={`mt-2 break-words font-bold leading-tight tracking-tight ${compact ? 'text-base sm:text-lg' : 'text-2xl sm:text-3xl'}`}>{value}</div>
          {caption && <div className="mt-2 text-xs leading-5 text-muted-foreground">{caption}</div>}
        </div>
        {icon && <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">{icon}</div>}
      </div>
    </div>
  );
}

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h2 className="break-words text-xl font-bold tracking-tight sm:text-2xl">{title}</h2>
        {description && <div className="mt-1 text-sm leading-6 text-muted-foreground">{description}</div>}
      </div>
      {action && <div className="grid w-full shrink-0 gap-2 sm:flex sm:w-auto [&>*]:w-full sm:[&>*]:w-auto">{action}</div>}
    </div>
  );
}

type ActionCardProps = {
  title: string;
  description?: string;
  icon: React.ReactNode;
  to?: string;
  onClick?: () => void;
  disabled?: boolean;
};

export function ActionCard({ title, description, icon, to, onClick, disabled }: ActionCardProps) {
  const className = "flex min-h-[88px] w-full items-center gap-4 rounded-2xl border bg-card p-3.5 shadow-sm transition sm:p-4 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60";
  const content = (
    <>
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">{icon}</div>
      <div className="min-w-0 flex-1 text-left">
        <div className="font-semibold">{title}</div>
        {description && <div className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{description}</div>}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </>
  );

  if (to) return <Link to={to} className={className} aria-disabled={disabled}>{content}</Link>;
  return <button type="button" className={className} onClick={onClick} disabled={disabled}>{content}</button>;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="rounded-3xl shadow-card">
      <CardContent className="flex min-h-[240px] flex-col items-center justify-center p-6 text-center sm:min-h-[320px] sm:p-10">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">{icon}</div>
        <h3 className="mt-5 text-lg font-bold">{title}</h3>
        <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>
        {action && <div className="mt-5">{action}</div>}
      </CardContent>
    </Card>
  );
}

export function LoadingSkeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl animate-pulse px-4 py-8 sm:px-6 sm:py-10">
      <div className="h-56 rounded-3xl bg-muted" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-32 rounded-2xl bg-muted" />)}
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.8fr)]">
        <div className="h-[420px] rounded-3xl bg-muted" />
        <div className="h-[420px] rounded-3xl bg-muted" />
      </div>
    </div>
  );
}

type Tone = 'default' | 'success' | 'danger' | 'muted' | 'coming-soon';
const tones: Record<Tone, string> = {
  default: 'bg-primary/15 text-primary',
  success: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  danger: 'bg-destructive/15 text-destructive',
  muted: 'bg-muted text-muted-foreground',
  'coming-soon': 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
};

export function StatBadge({ children, tone = 'default' }: { children: React.ReactNode; tone?: Tone }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${tones[tone]}`}>{children}</span>;
}

export function DashboardGrid({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3', className)}>{children}</div>;
}
