import React from 'react';
import { Menu, Sparkles, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export type MarketingRoute = 'product' | 'discover' | 'ai' | 'demo' | 'courses' | 'experience' | 'why' | 'pricing' | 'business-types' | 'contact';

const links: Array<{ key: MarketingRoute; labelKey: string; to: string }> = [
  { key: 'product', labelKey: 'marketingSite.chrome.product', to: '/' },
  { key: 'ai', labelKey: 'marketingSite.chrome.ai', to: '/velliqo-ai' },
  { key: 'demo', labelKey: 'marketingSite.chrome.demo', to: '/demo' },
  { key: 'courses', labelKey: 'marketingSite.chrome.courses', to: '/courses' },
  { key: 'experience', labelKey: 'marketingSite.chrome.experience', to: '/experience' },
  { key: 'why', labelKey: 'marketingSite.chrome.why', to: '/why-velliqo' },
  { key: 'pricing', labelKey: 'marketingSite.chrome.pricing', to: '/pricing' },
  { key: 'business-types', labelKey: 'marketingSite.chrome.businessTypes', to: '/business-types' },
  { key: 'contact', labelKey: 'marketingSite.chrome.contact', to: '/contact' },
];

export function MarketingHeader({ active = 'product', dark = false }: { active?: MarketingRoute; dark?: boolean }) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = React.useState(false);
  return (
    <header className={`sticky top-0 z-50 border-b backdrop-blur-2xl ${dark ? 'border-white/10 bg-[#0d0b18]/90 text-white' : 'border-slate-200/80 bg-white/90 text-slate-950'}`}>
      <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <MarketingBrand dark={dark} />
        <nav className={`hidden items-center gap-5 text-sm font-semibold 2xl:flex ${dark ? 'text-white/58' : 'text-slate-600'}`}>
          {links.map((link) => (
            <Link key={link.key} to={link.to} className={`relative py-2 transition ${active === link.key ? (dark ? 'text-white' : 'text-violet-700') : dark ? 'hover:text-white' : 'hover:text-slate-950'}`}>
              {link.key === 'ai' && <Sparkles className="mr-1.5 inline h-3.5 w-3.5" />}
              {t(link.labelKey)}
              {active === link.key && <span className="absolute inset-x-0 -bottom-[18px] h-0.5 rounded-full bg-violet-500" />}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <LanguageSwitcher compact appearance={dark ? 'glass' : 'default'} />
          <Button asChild variant="ghost" className={`hidden rounded-xl lg:inline-flex ${dark ? 'text-white hover:bg-white/10 hover:text-white' : ''}`}><Link to="/sign-in">{t('marketingSite.chrome.businessLogin')}</Link></Button>
          <Button asChild className="hidden rounded-xl bg-violet-600 px-5 hover:bg-violet-500 lg:inline-flex"><Link to="/business-types">{t('marketingSite.chrome.startFree')}</Link></Button>
          <Button type="button" variant="ghost" size="icon" className={`rounded-xl 2xl:hidden ${dark ? 'text-white hover:bg-white/10 hover:text-white' : ''}`} onClick={() => setMenuOpen((current) => !current)} aria-label={menuOpen ? t('marketingSite.chrome.closeNavigation') : t('marketingSite.chrome.openNavigation')}>{menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</Button>
        </div>
      </div>
      {menuOpen && (
        <div className={`border-t px-4 py-4 2xl:hidden ${dark ? 'border-white/10 bg-[#0d0b18]' : 'border-slate-200 bg-white'}`}>
          <div className="mx-auto grid max-w-[1440px] gap-1.5">
            {links.map((link) => <Link key={link.key} to={link.to} onClick={() => setMenuOpen(false)} className={`rounded-xl px-3 py-2.5 text-sm font-bold ${active === link.key ? 'bg-violet-500 text-white' : dark ? 'text-white/70 hover:bg-white/[.06]' : 'text-slate-700 hover:bg-slate-50'}`}>{link.key === 'ai' && <Sparkles className="mr-2 inline h-4 w-4" />}{t(link.labelKey)}</Link>)}
            <div className="mt-2 grid grid-cols-2 gap-2 lg:hidden"><Button asChild variant="outline" className={`rounded-xl ${dark ? 'border-white/15 bg-white/[.04] text-white hover:bg-white/[.08] hover:text-white' : ''}`}><Link to="/sign-in">{t('marketingSite.chrome.login')}</Link></Button><Button asChild className="rounded-xl bg-violet-600 hover:bg-violet-500"><Link to="/business-types">{t('marketingSite.chrome.startFree')}</Link></Button></div>
          </div>
        </div>
      )}
    </header>
  );
}

export function MarketingBrand({ dark = false }: { dark?: boolean }) {
  const { t } = useTranslation();
  return <Link to="/" className="flex min-w-0 items-center gap-3" aria-label={t('marketingSite.chrome.homeLabel')}><img src="/brand/velliqo-mark-transparent-v2.png" alt="Velliqo" className="h-10 w-10 object-contain sm:h-11 sm:w-11" /><div className="min-w-0"><div className={`text-sm font-extrabold tracking-tight sm:text-base ${dark ? 'text-white' : 'text-slate-950'}`}>Velliqo</div><div className={`truncate text-[9px] font-extrabold uppercase tracking-[.16em] sm:text-[10px] ${dark ? 'text-violet-300' : 'text-violet-600'}`}>{t('marketingSite.chrome.tagline')}</div></div></Link>;
}

export function MarketingFooter() {
  const { t } = useTranslation();
  return <footer className="border-t border-white/10 bg-[#090812] text-white"><div className="mx-auto grid max-w-[1440px] gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.2fr_.8fr_.8fr] lg:px-8"><div><MarketingBrand dark /><p className="mt-4 max-w-sm text-sm leading-6 text-white/45">{t('marketingSite.chrome.footerDescription')}</p></div><div><div className="text-xs font-extrabold uppercase tracking-[.18em] text-white/35">{t('marketingSite.chrome.explore')}</div><div className="mt-4 grid gap-3 text-sm font-semibold text-white/60"><Link to="/velliqo-ai" className="hover:text-white">{t('marketingSite.chrome.ai')}</Link><Link to="/demo" className="hover:text-white">{t('marketingSite.chrome.demo')}</Link><Link to="/courses" className="hover:text-white">{t('marketingSite.chrome.courses')}</Link><Link to="/experience" className="hover:text-white">{t('marketingSite.chrome.productExperience')}</Link><Link to="/pricing" className="hover:text-white">{t('marketingSite.chrome.pricing')}</Link><Link to="/business-types" className="hover:text-white">{t('marketingSite.chrome.businessTypes')}</Link></div></div><div><div className="text-xs font-extrabold uppercase tracking-[.18em] text-white/35">{t('marketingSite.chrome.access')}</div><div className="mt-4 grid gap-3 text-sm font-semibold text-white/60"><Link to="/sign-in" className="hover:text-white">{t('marketingSite.chrome.businessLogin')}</Link><Link to="/business-types" className="hover:text-white">{t('marketingSite.chrome.startFree')}</Link><Link to="/why-velliqo" className="hover:text-white">{t('marketingSite.chrome.why')}</Link><Link to="/contact" className="hover:text-white">{t('marketingSite.chrome.contact')}</Link></div></div></div><div className="border-t border-white/10 px-4 py-6 text-center text-xs text-white/30">{t('marketingSite.chrome.copyright')}</div></footer>;
}
