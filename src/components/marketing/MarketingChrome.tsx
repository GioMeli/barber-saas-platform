import React from 'react';
import { Menu, Sparkles, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export type MarketingRoute = 'product' | 'discover' | 'ai' | 'demo' | 'courses' | 'experience' | 'why' | 'pricing' | 'business-types' | 'contact';

const links: Array<{ key: MarketingRoute; label: string; to: string }> = [
  { key: 'product', label: 'Product', to: '/' },
  { key: 'ai', label: 'Velliqo AI', to: '/velliqo-ai' },
  { key: 'demo', label: 'Demo', to: '/demo' },
  { key: 'courses', label: 'Courses', to: '/courses' },
  { key: 'experience', label: 'Experience', to: '/experience' },
  { key: 'why', label: 'Why Velliqo?', to: '/why-velliqo' },
  { key: 'pricing', label: 'Pricing', to: '/pricing' },
  { key: 'business-types', label: 'Business types', to: '/business-types' },
  { key: 'contact', label: 'Contact', to: '/contact' },
];

export function MarketingHeader({ active = 'product', dark = false }: { active?: MarketingRoute; dark?: boolean }) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  return (
    <header className={`sticky top-0 z-50 border-b backdrop-blur-2xl ${dark ? 'border-white/10 bg-[#0d0b18]/90 text-white' : 'border-slate-200/80 bg-white/90 text-slate-950'}`}>
      <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <MarketingBrand dark={dark} />
        <nav className={`hidden items-center gap-6 text-sm font-semibold xl:flex ${dark ? 'text-white/58' : 'text-slate-600'}`}>
          {links.map((link) => (
            <Link key={link.key} to={link.to} className={`relative py-2 transition ${active === link.key ? (dark ? 'text-white' : 'text-violet-700') : dark ? 'hover:text-white' : 'hover:text-slate-950'}`}>
              {link.key === 'ai' && <Sparkles className="mr-1.5 inline h-3.5 w-3.5" />}
              {link.label}
              {active === link.key && <span className="absolute inset-x-0 -bottom-[18px] h-0.5 rounded-full bg-violet-500" />}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" className={`hidden rounded-xl sm:inline-flex ${dark ? 'text-white hover:bg-white/10 hover:text-white' : ''}`}><Link to="/sign-in">Business login</Link></Button>
          <Button asChild className="hidden rounded-xl bg-violet-600 px-5 hover:bg-violet-500 sm:inline-flex"><Link to="/business-types">Start free</Link></Button>
          <Button type="button" variant="ghost" size="icon" className={`rounded-xl xl:hidden ${dark ? 'text-white hover:bg-white/10 hover:text-white' : ''}`} onClick={() => setMenuOpen((current) => !current)} aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}>{menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</Button>
        </div>
      </div>
      {menuOpen && (
        <div className={`border-t px-4 py-4 xl:hidden ${dark ? 'border-white/10 bg-[#0d0b18]' : 'border-slate-200 bg-white'}`}>
          <div className="mx-auto grid max-w-[1440px] gap-1.5">
            {links.map((link) => <Link key={link.key} to={link.to} onClick={() => setMenuOpen(false)} className={`rounded-xl px-3 py-2.5 text-sm font-bold ${active === link.key ? 'bg-violet-500 text-white' : dark ? 'text-white/70 hover:bg-white/[.06]' : 'text-slate-700 hover:bg-slate-50'}`}>{link.key === 'ai' && <Sparkles className="mr-2 inline h-4 w-4" />}{link.label}</Link>)}
            <div className="mt-2 grid grid-cols-2 gap-2 sm:hidden"><Button asChild variant="outline" className={`rounded-xl ${dark ? 'border-white/15 bg-white/[.04] text-white hover:bg-white/[.08] hover:text-white' : ''}`}><Link to="/sign-in">Login</Link></Button><Button asChild className="rounded-xl bg-violet-600 hover:bg-violet-500"><Link to="/business-types">Start free</Link></Button></div>
          </div>
        </div>
      )}
    </header>
  );
}

export function MarketingBrand({ dark = false }: { dark?: boolean }) {
  return <Link to="/" className="flex min-w-0 items-center gap-3" aria-label="Velliqo home"><img src="/brand/velliqo-mark-transparent-v2.png" alt="Velliqo" className="h-10 w-10 object-contain sm:h-11 sm:w-11" /><div className="min-w-0"><div className={`text-sm font-extrabold tracking-tight sm:text-base ${dark ? 'text-white' : 'text-slate-950'}`}>Velliqo</div><div className={`truncate text-[9px] font-extrabold uppercase tracking-[.16em] sm:text-[10px] ${dark ? 'text-violet-300' : 'text-violet-600'}`}>Book. Manage. Grow.</div></div></Link>;
}

export function MarketingFooter() {
  return <footer className="border-t border-white/10 bg-[#090812] text-white"><div className="mx-auto grid max-w-[1440px] gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.2fr_.8fr_.8fr] lg:px-8"><div><MarketingBrand dark /><p className="mt-4 max-w-sm text-sm leading-6 text-white/45">A premium operating platform for appointment-based and service businesses, powered by Velliqo AI.</p></div><div><div className="text-xs font-extrabold uppercase tracking-[.18em] text-white/35">Explore</div><div className="mt-4 grid gap-3 text-sm font-semibold text-white/60"><Link to="/velliqo-ai" className="hover:text-white">Velliqo AI</Link><Link to="/demo" className="hover:text-white">Demo</Link><Link to="/courses" className="hover:text-white">Courses</Link><Link to="/experience" className="hover:text-white">Product experience</Link><Link to="/pricing" className="hover:text-white">Pricing</Link><Link to="/business-types" className="hover:text-white">Business types</Link></div></div><div><div className="text-xs font-extrabold uppercase tracking-[.18em] text-white/35">Access</div><div className="mt-4 grid gap-3 text-sm font-semibold text-white/60"><Link to="/sign-in" className="hover:text-white">Business login</Link><Link to="/business-types" className="hover:text-white">Start free</Link><Link to="/why-velliqo" className="hover:text-white">Why Velliqo?</Link><Link to="/contact" className="hover:text-white">Contact</Link></div></div></div><div className="border-t border-white/10 px-4 py-6 text-center text-xs text-white/30">© 2026 Velliqo. Built for modern service operations.</div></footer>;
}
