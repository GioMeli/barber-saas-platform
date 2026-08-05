import React from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, Menu, Plus, RefreshCw, Search, ShieldCheck, Sparkles, X } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DemoOwnerProvider, useDemoOwner } from '@/demo/DemoOwnerContext';
import { DEMO_NAVIGATION_ITEMS, isDemoNavigationItemActive } from '@/demo/demoNavigation';

export default function DemoOwnerLayout() {
  return (
    <DemoOwnerProvider>
      <DemoOwnerLayoutInner />
    </DemoOwnerProvider>
  );
}

function DemoOwnerLayoutInner() {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const { scenario, reset } = useDemoOwner();
  const location = useLocation();
  const navigate = useNavigate();
  const current = DEMO_NAVIGATION_ITEMS.find((item) => isDemoNavigationItemActive(location.pathname, item.path)) ?? DEMO_NAVIGATION_ITEMS[0];

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] border-r border-sidebar-border bg-sidebar lg:block">
        <DemoSidebar onNavigate={() => undefined} />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[92vw] max-w-[340px] border-0 bg-sidebar p-0 [&>button]:hidden">
          <DemoSidebar mobile onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="min-w-0 lg:pl-[264px]">
        <header className="sticky top-0 z-30 border-b border-border/70 bg-background/92 backdrop-blur-xl">
          <div className="flex min-h-16 min-w-0 items-center gap-2 px-3 py-2 sm:min-h-[72px] sm:px-5 lg:px-7">
            <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-xl lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open demo menu"><Menu className="h-5 w-5" /></Button>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-extrabold sm:text-base">{current.key === 'training' ? 'Courses' : current.key === 'home' ? 'Home' : current.key.charAt(0).toUpperCase() + current.key.slice(1)}</div>
              <div className="hidden truncate text-xs text-muted-foreground sm:block">{scenario.businessName} - owner demo workspace</div>
            </div>
            <div className="hidden max-w-[290px] flex-1 md:block"><div className="flex h-10 items-center rounded-xl border bg-card px-3 text-xs text-muted-foreground"><Search className="mr-2 h-4 w-4" />Search demo workspace<span className="ml-auto rounded-md border bg-muted px-1.5 py-0.5 text-[10px]">Ctrl K</span></div></div>
            <Button type="button" size="icon" className="h-10 w-10 rounded-xl" onClick={() => navigate('/demo/calendar?action=new')} aria-label="Add demo appointment"><Plus className="h-4 w-4" /></Button>
            <Button type="button" variant="outline" size="icon" className="h-10 w-10 rounded-xl" aria-label="Demo notifications"><Bell className="h-4 w-4" /></Button>
            <Button asChild size="icon" className="relative h-10 w-10 rounded-xl bg-violet-600 hover:bg-violet-700"><Link to="/demo/ai"><Sparkles className="h-4 w-4" /><span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-fuchsia-300" /></Link></Button>
          </div>
          <div className="flex flex-col gap-2 border-t border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 sm:flex-row sm:items-center sm:justify-between sm:px-5 lg:px-7">
            <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 shrink-0 text-emerald-700" /><span><strong>Demo mode:</strong> actions work only in this browser session. Nothing is read from or saved to the production database.</span></div>
            <div className="flex shrink-0 gap-2"><Button type="button" variant="ghost" size="sm" className="h-8 rounded-lg text-emerald-800 hover:bg-emerald-100" onClick={reset}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Reset</Button><Button asChild variant="ghost" size="sm" className="h-8 rounded-lg text-emerald-800 hover:bg-emerald-100"><Link to="/"><ArrowLeft className="mr-1.5 h-3.5 w-3.5" />Exit demo</Link></Button></div>
          </div>
        </header>

        <main className="min-h-[calc(100dvh-112px)] min-w-0 overflow-x-clip px-3 py-4 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:px-5 sm:py-6 lg:px-7 lg:pb-7 xl:px-8"><Outlet /></main>
        <DemoMobileNavigation onOpenMenu={() => setMobileOpen(true)} />
      </div>
    </div>
  );
}

function DemoSidebar({ onNavigate, mobile = false }: { onNavigate: () => void; mobile?: boolean }) {
  const location = useLocation();
  const { scenario, scenarioIndex, switchScenario } = useDemoOwner();
  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar text-sidebar-foreground">
      <div className="border-b border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-3"><img src="/brand/velliqo-mark.png" alt="Velliqo" className="h-11 w-11 object-contain" /><div><div className="text-base font-extrabold text-white">Velliqo</div><div className="text-[10px] font-semibold uppercase tracking-[.18em] text-sidebar-foreground/50">Demo owner workspace</div></div>{mobile && <button type="button" className="ml-auto text-white/60" onClick={onNavigate}><X className="h-5 w-5" /></button>}</div>
        <div className="mt-4 rounded-2xl border border-white/[.07] bg-white/[.045] p-3"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sidebar-primary font-bold text-sidebar-primary-foreground">{scenario.businessName.charAt(0)}</div><div className="min-w-0"><div className="truncate text-sm font-bold text-white">{scenario.businessName}</div><div className="truncate text-[11px] text-sidebar-foreground/55">Sample owner account</div></div></div><select value={scenarioIndex} onChange={(event) => switchScenario(Number(event.target.value))} className="mt-3 h-9 w-full rounded-xl border border-white/10 bg-white/[.06] px-2 text-xs text-white outline-none"><option value={0} className="text-slate-900">Physiotherapy demo</option><option value={1} className="text-slate-900">Pet grooming demo</option><option value={2} className="text-slate-900">Car detailing demo</option></select></div>
      </div>
      <div className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto px-3 py-4"><div className="mb-3 px-1 text-[10px] font-bold uppercase tracking-[.18em] text-sidebar-foreground/40">Workspace navigation</div><nav className="grid grid-cols-2 gap-2">{DEMO_NAVIGATION_ITEMS.map((item) => { const active = isDemoNavigationItemActive(location.pathname, item.path); return <Link key={item.key} to={item.path} onClick={onNavigate} className={cn('group relative flex min-h-[74px] min-w-0 flex-col items-center justify-center gap-2 rounded-2xl border px-2 py-3 text-center transition', active ? 'border-sidebar-primary/35 bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_12px_30px_hsl(var(--sidebar-primary)/0.22)]' : 'border-white/[.055] bg-white/[.025] text-sidebar-foreground/68 hover:bg-sidebar-accent hover:text-white')}><item.icon className="h-5 w-5" /><span className="line-clamp-2 text-[11px] font-semibold leading-4">{item.key === 'training' ? 'Courses' : item.key === 'home' ? 'Home' : item.key.charAt(0).toUpperCase() + item.key.slice(1)}</span>{item.key === 'ai' && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-fuchsia-300" />}</Link>; })}</nav></div>
      <div className={cn('border-t border-sidebar-border p-3', mobile && 'safe-bottom')}><Button asChild variant="ghost" className="w-full justify-start rounded-xl text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-white"><Link to="/"><ArrowLeft className="mr-2 h-4 w-4" />Exit demo</Link></Button></div>
    </div>
  );
}

function DemoMobileNavigation({ onOpenMenu }: { onOpenMenu: () => void }) {
  const location = useLocation();
  const items = DEMO_NAVIGATION_ITEMS.filter((item) => ['home', 'calendar'].includes(item.key));
  const ai = DEMO_NAVIGATION_ITEMS.find((item) => item.key === 'ai');
  return <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-sidebar-border bg-sidebar px-2 pt-2 text-sidebar-foreground shadow-[0_-18px_42px_rgba(10,8,28,.28)] lg:hidden"><div className="mx-auto grid max-w-md grid-cols-5 items-end gap-1">{items.map((item) => <Link key={item.key} to={item.path} className={cn('flex min-h-[62px] flex-col items-center gap-1 rounded-2xl px-1 py-1.5 text-center', isDemoNavigationItemActive(location.pathname, item.path) ? 'bg-sidebar-accent text-white' : 'text-sidebar-foreground/62')}><span className="flex h-8 w-8 items-center justify-center rounded-xl"><item.icon className="h-4.5 w-4.5" /></span><span className="text-[10px] font-semibold">{item.key === 'home' ? 'Home' : 'Calendar'}</span></Link>)}<Link to="/demo/calendar?action=new" className="flex min-h-[62px] flex-col items-center gap-1 rounded-2xl px-1 py-1.5 text-center text-white"><span className="-mt-5 flex h-12 w-12 items-center justify-center rounded-full border-4 border-sidebar bg-sidebar-primary text-sidebar-primary-foreground shadow-xl"><Plus className="h-6 w-6" /></span><span className="text-[10px] font-semibold">Appointment</span></Link>{ai && <Link to="/demo/ai" className="flex min-h-[62px] flex-col items-center gap-1 rounded-2xl px-1 py-1.5 text-center text-sidebar-foreground/72"><img src="/brand/velliqo-ai.png" alt="" className="h-8 w-8 rounded-[10px] object-cover mix-blend-screen" /><span className="text-[10px] font-semibold">Velliqo AI</span></Link>}<button type="button" onClick={onOpenMenu} className="flex min-h-[62px] flex-col items-center gap-1 rounded-2xl px-1 py-1.5 text-center text-sidebar-foreground/62"><span className="flex h-8 w-8 items-center justify-center rounded-xl"><Menu className="h-4.5 w-4.5" /></span><span className="text-[10px] font-semibold">More</span></button></div></nav>;
}
