import React from 'react';
import { Check, ChevronDown, Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import {
  LANGUAGE_OPTIONS,
  normalizeLanguage,
  type SupportedLanguage,
} from '@/i18n/config';

interface LanguageSwitcherProps {
  compact?: boolean;
  className?: string;
  appearance?: 'default' | 'glass' | 'sidebar' | 'minimal';
  align?: 'start' | 'center' | 'end';
}

const triggerStyles: Record<NonNullable<LanguageSwitcherProps['appearance']>, string> = {
  default:
    'border-border bg-background/90 text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground',
  glass:
    'border-white/20 bg-white/10 text-white shadow-lg backdrop-blur-md hover:bg-white/15',
  sidebar:
    'border-sidebar-border bg-white/[0.04] text-sidebar-foreground hover:bg-sidebar-accent hover:text-white',
  minimal:
    'border-transparent bg-transparent text-foreground shadow-none hover:bg-accent hover:text-accent-foreground',
};

export default function LanguageSwitcher({
  compact = false,
  className,
  appearance = 'default',
  align = 'end',
}: LanguageSwitcherProps) {
  const { i18n, t } = useTranslation();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const currentLanguage = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);
  const selectedLanguage = LANGUAGE_OPTIONS.find((language) => language.code === currentLanguage)
    ?? LANGUAGE_OPTIONS[0];

  const changeLanguage = async (language: SupportedLanguage) => {
    await i18n.changeLanguage(language);
    setMobileOpen(false);
  };

  const triggerClassName = cn(
    'inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold outline-none transition duration-150',
    'focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
    triggerStyles[appearance],
    compact ? 'w-10 px-0 sm:w-auto sm:px-3' : 'min-w-10',
  );

  const triggerContent = (
    <>
      <LanguageFlag code={selectedLanguage.code} />
      <span className={cn('max-w-[7.5rem] truncate', compact && 'hidden sm:inline')}>
        {compact ? selectedLanguage.code.toUpperCase() : selectedLanguage.nativeLabel}
      </span>
      <ChevronDown
        aria-hidden="true"
        className={cn('h-3.5 w-3.5 opacity-60 transition-transform', compact && 'hidden sm:block')}
      />
    </>
  );

  return (
    <div className={cn('inline-flex shrink-0', className)}>
      <div className="hidden sm:block">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className={triggerClassName} aria-label={t('language.change')}>
              {triggerContent}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align={align}
            sideOffset={8}
            className="w-56 rounded-2xl border-border/70 bg-popover/95 p-2 shadow-xl backdrop-blur-xl"
          >
            <DropdownMenuLabel className="flex items-center gap-2 px-2.5 py-2 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
              <Languages className="h-4 w-4" />
              {t('language.label')}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {LANGUAGE_OPTIONS.map((language) => {
              const active = language.code === currentLanguage;
              return (
                <DropdownMenuItem
                  key={language.code}
                  onSelect={() => void changeLanguage(language.code)}
                  className="my-0.5 min-h-11 cursor-pointer rounded-xl px-2.5"
                >
                  <LanguageFlag code={language.code} />
                  <span className="flex-1 font-medium">{language.nativeLabel}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {language.code}
                  </span>
                  {active && <Check className="h-4 w-4 text-primary" aria-hidden="true" />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="sm:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <button type="button" className={triggerClassName} aria-label={t('language.change')}>
              {triggerContent}
            </button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="safe-bottom max-h-[82vh] rounded-t-[28px] border-x-0 border-b-0 px-4 pb-6 pt-5"
          >
            <div className="mx-auto mb-4 h-1.5 w-11 rounded-full bg-muted" aria-hidden="true" />
            <SheetHeader className="pr-8 text-left">
              <SheetTitle>{t('language.choose')}</SheetTitle>
              <SheetDescription>{t('language.choose_description')}</SheetDescription>
            </SheetHeader>
            <div className="mt-5 grid gap-2" role="listbox" aria-label={t('language.label')}>
              {LANGUAGE_OPTIONS.map((language) => {
                const active = language.code === currentLanguage;
                return (
                  <button
                    key={language.code}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => void changeLanguage(language.code)}
                    className={cn(
                      'flex min-h-14 w-full items-center gap-3 rounded-2xl border px-4 text-left outline-none transition',
                      'focus-visible:ring-2 focus-visible:ring-primary/30',
                      active
                        ? 'border-primary/35 bg-primary/10 text-foreground'
                        : 'border-border/70 bg-card hover:bg-accent',
                    )}
                  >
                    <LanguageFlag code={language.code} className="h-6 w-8" />
                    <span className="flex-1 font-semibold">{language.nativeLabel}</span>
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {language.code}
                    </span>
                    {active && (
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="h-4 w-4" aria-hidden="true" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}

function LanguageFlag({ code, className }: { code: SupportedLanguage; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('inline-flex h-[18px] w-6 shrink-0 overflow-hidden rounded-[4px] ring-1 ring-black/10', className)}
    >
      <svg viewBox="0 0 24 18" className="h-full w-full" focusable="false">
        {code === 'en' && <UnitedKingdomFlag />}
        {code === 'el' && <GreeceFlag />}
        {code === 'de' && <GermanyFlag />}
        {code === 'es' && <SpainFlag />}
        {code === 'tr' && <TurkeyFlag />}
      </svg>
    </span>
  );
}

function UnitedKingdomFlag() {
  return (
    <>
      <rect width="24" height="18" fill="#21468B" />
      <path d="M0 0 24 18M24 0 0 18" stroke="#fff" strokeWidth="4" />
      <path d="M0 0 24 18M24 0 0 18" stroke="#AE1C28" strokeWidth="1.8" />
      <path d="M12 0v18M0 9h24" stroke="#fff" strokeWidth="6" />
      <path d="M12 0v18M0 9h24" stroke="#AE1C28" strokeWidth="3.2" />
    </>
  );
}

function GreeceFlag() {
  return (
    <>
      <rect width="24" height="18" fill="#0D5EAF" />
      {[2, 6, 10, 14].map((y) => <rect key={y} y={y} width="24" height="2" fill="#fff" />)}
      <rect width="10" height="10" fill="#0D5EAF" />
      <rect x="4" width="2" height="10" fill="#fff" />
      <rect y="4" width="10" height="2" fill="#fff" />
    </>
  );
}

function GermanyFlag() {
  return (
    <>
      <rect width="24" height="6" fill="#000" />
      <rect y="6" width="24" height="6" fill="#DD0000" />
      <rect y="12" width="24" height="6" fill="#FFCE00" />
    </>
  );
}

function SpainFlag() {
  return (
    <>
      <rect width="24" height="18" fill="#AA151B" />
      <rect y="4.5" width="24" height="9" fill="#F1BF00" />
    </>
  );
}

function TurkeyFlag() {
  return (
    <>
      <rect width="24" height="18" fill="#E30A17" />
      <circle cx="9" cy="9" r="4.4" fill="#fff" />
      <circle cx="10.4" cy="9" r="3.5" fill="#E30A17" />
      <path d="m15.2 6.8.65 1.35 1.48.22-1.07 1.04.25 1.47-1.31-.7-1.31.7.25-1.47-1.07-1.04 1.48-.22z" fill="#fff" />
    </>
  );
}
