import React from 'react';
import { useLocation } from 'react-router-dom';
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  BellRing,
  Bot,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  CreditCard,
  FileText,
  ImagePlus,
  Layers3,
  Mail,
  Megaphone,
  Package,
  Plus,
  ReceiptText,
  Send,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Store,
  Users,
  WalletCards,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useDemoOwner } from '@/demo/DemoOwnerContext';
import PublicCourses from '@/pages/marketing/Courses';

const moduleLabels: Record<string, { title: string; description: string }> = {
  home: { title: 'Good day', description: 'Monitor today\'s operation, team workload and business activity.' },
  calendar: { title: 'Calendar', description: 'Review appointments, availability and the working day.' },
  sales: { title: 'Sales', description: 'Run a sample checkout and review completed demo transactions.' },
  finance: { title: 'Finance', description: 'Explore revenue, expenses and operating performance.' },
  customers: { title: 'Customers', description: 'Review sample customer profiles and relationship history.' },
  staff: { title: 'Staff', description: 'Explore team roles, availability and utilisation.' },
  services: { title: 'Services', description: 'Manage service names, duration, pricing and availability impact.' },
  products: { title: 'Products', description: 'Inspect inventory levels and try a local stock adjustment.' },
  marketing: { title: 'Marketing', description: 'Explore campaign drafts, audiences and delivery controls.' },
  posts: { title: 'Posts', description: 'Create public announcements and customer updates.' },
  gallery: { title: 'Gallery', description: 'Preview how owners organise public images and recent work.' },
  storefront: { title: 'Storefront', description: 'Preview the public business profile and booking experience.' },
  business: { title: 'Business', description: 'Review business details, contact information and closures.' },
  reports: { title: 'Reports', description: 'Explore revenue, appointments, customers and service performance.' },
  billing: { title: 'Billing', description: 'Review the subscription workspace and invoice history.' },
  ai: { title: 'Velliqo AI', description: 'Ask operational questions and review protected action confirmations.' },
};

export default function DemoModulePage() {
  const location = useLocation();
  const key = location.pathname === '/demo' ? 'home' : location.pathname.split('/')[2] || 'home';
  if (key === 'training' || key === 'courses') return <PublicCourses embedded />;
  return <DemoModule moduleKey={key} />;
}

function DemoModule({ moduleKey }: { moduleKey: string }) {
  const data = useDemoOwner();
  const meta = moduleLabels[moduleKey] ?? moduleLabels.home;
  const [dialog, setDialog] = React.useState<string | null>(null);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'new' && moduleKey === 'calendar') setDialog('appointment');
  }, [moduleKey]);

  const action = actionFor(moduleKey, data, setDialog);
  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><div className="text-[11px] font-extrabold uppercase tracking-[.18em] text-violet-600">Interactive owner demo</div><h1 className="mt-1 text-3xl font-extrabold tracking-[-.04em] text-foreground sm:text-4xl">{moduleKey === 'home' ? `${meta.title}, ${data.scenario.businessName}` : meta.title}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{meta.description}</p></div>
        {action && <Button type="button" className="h-11 rounded-xl" onClick={action.onClick}><action.icon className="mr-2 h-4 w-4" />{action.label}</Button>}
      </section>

      {moduleKey === 'home' && <HomeModule />}
      {moduleKey === 'calendar' && <CalendarModule />}
      {moduleKey === 'sales' && <SalesModule />}
      {moduleKey === 'finance' && <FinanceModule />}
      {moduleKey === 'customers' && <CustomersModule />}
      {moduleKey === 'staff' && <StaffModule />}
      {moduleKey === 'services' && <ServicesModule />}
      {moduleKey === 'products' && <ProductsModule />}
      {moduleKey === 'marketing' && <MarketingModule />}
      {moduleKey === 'posts' && <PostsModule />}
      {moduleKey === 'gallery' && <GalleryModule />}
      {moduleKey === 'storefront' && <StorefrontModule />}
      {moduleKey === 'business' && <BusinessModule />}
      {moduleKey === 'reports' && <ReportsModule />}
      {moduleKey === 'billing' && <BillingModule />}
      {moduleKey === 'ai' && <AIModule />}

      <DemoActionDialog type={dialog} onClose={() => setDialog(null)} />
    </div>
  );
}

function actionFor(moduleKey: string, data: ReturnType<typeof useDemoOwner>, setDialog: (value: string | null) => void) {
  const map: Record<string, { label: string; icon: typeof Plus; onClick: () => void }> = {
    calendar: { label: 'New appointment', icon: Plus, onClick: () => setDialog('appointment') },
    customers: { label: 'Add customer', icon: Plus, onClick: () => setDialog('customer') },
    staff: { label: 'Add team member', icon: Plus, onClick: () => setDialog('staff') },
    services: { label: 'Add service', icon: Plus, onClick: () => setDialog('service') },
    products: { label: 'Adjust stock', icon: Package, onClick: data.adjustStock },
    sales: { label: 'New sale', icon: ShoppingCart, onClick: data.addSale },
    marketing: { label: 'Create campaign', icon: Megaphone, onClick: data.addCampaign },
    posts: { label: 'Create post', icon: Plus, onClick: data.addPost },
    gallery: { label: 'Add image', icon: ImagePlus, onClick: data.addGalleryItem },
  };
  return map[moduleKey];
}

function HomeModule() {
  const d = useDemoOwner();
  const metrics = [
    ['Today\'s appointments', d.appointments.length, CalendarDays],
    ['Expected revenue', `${d.scenario.currency}${Math.round(d.scenario.metrics.revenue + d.sales.reduce((sum, sale) => sum + sale.total, 0) / 4)}`, CircleDollarSign],
    ['Active customers', d.customers.length, Users],
    ['Team utilisation', `${Math.round(d.team.reduce((sum, member) => sum + member.utilisation, 0) / d.team.length)}%`, Activity],
  ] as const;
  return <><section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label, value, Icon]) => <MetricCard key={label} label={label} value={value} icon={Icon} />)}</section><section className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,.55fr)]"><Panel title="Today\'s schedule" subtitle="Sample appointments grouped by time"><AppointmentList limit={6} /></Panel><div className="space-y-5"><Panel title="Velliqo AI briefing" subtitle="A local preview built from sample data"><div className="rounded-2xl bg-gradient-to-br from-violet-700 to-fuchsia-600 p-5 text-white"><div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.18em] text-white/65"><Sparkles className="h-4 w-4" />Business intelligence</div><p className="mt-4 text-sm leading-6 text-white/82">{d.scenario.aiResponse}</p></div></Panel><Panel title="Business health" subtitle="Demo score"><div className="flex items-center justify-between"><div><div className="text-4xl font-extrabold">82<span className="text-lg text-muted-foreground">/100</span></div><p className="mt-2 text-xs text-muted-foreground">Healthy capacity and consistent customer activity.</p></div><div className="flex h-20 w-20 items-center justify-center rounded-full border-[10px] border-emerald-200 text-lg font-extrabold text-emerald-700">82</div></div></Panel></div></section></>;
}

function CalendarModule() { return <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]"><Panel title="Week schedule" subtitle="Appointments can be opened and reviewed in this local demo"><div className="grid grid-cols-[70px_repeat(3,minmax(130px,1fr))] overflow-x-auto rounded-xl border"><div className="bg-muted/50 p-3 text-xs font-bold">Time</div>{['Professional 1','Professional 2','Professional 3'].map((name) => <div key={name} className="border-l bg-muted/50 p-3 text-center text-xs font-bold">{name}</div>)}{['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00'].map((time, row) => <React.Fragment key={time}><div className="border-t p-3 text-xs font-bold">{time}</div>{[0,1,2].map((col) => <div key={col} className="min-h-16 border-l border-t p-1.5">{(row + col) % 4 === 0 && <div className="rounded-lg border border-emerald-300 bg-emerald-100 p-2 text-[10px] font-bold text-emerald-900">Confirmed appointment</div>}</div>)}</React.Fragment>)}</div></Panel><Panel title="Appointments" subtitle="Current demo session"><AppointmentList /></Panel></div>; }
function SalesModule() { const d=useDemoOwner(); return <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]"><Panel title="Recent sales" subtitle="Local demo receipts"><div className="divide-y">{d.sales.map((sale)=><div key={sale.id} className="grid grid-cols-[1fr_auto] gap-3 py-4"><div><div className="text-sm font-extrabold">{sale.reference}</div><div className="text-xs text-muted-foreground">{sale.customer}</div></div><div className="text-right"><div className="text-sm font-extrabold">{d.scenario.currency}{sale.total.toFixed(2)}</div><span className="text-[10px] font-bold uppercase text-emerald-700">{sale.status}</span></div></div>)}</div></Panel><Panel title="Checkout summary" subtitle="No payment provider is contacted"><div className="space-y-3 rounded-2xl bg-muted/50 p-4 text-sm"><div className="flex justify-between"><span>Selected service</span><strong>{d.services[0]?.name}</strong></div><div className="flex justify-between"><span>Subtotal</span><strong>{d.scenario.currency}{d.services[0]?.price.toFixed(2)}</strong></div><div className="flex justify-between border-t pt-3 text-base"><span>Total</span><strong>{d.scenario.currency}{d.services[0]?.price.toFixed(2)}</strong></div></div></Panel></div>; }
function FinanceModule() { const d=useDemoOwner(); return <><section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Revenue" value={`${d.scenario.currency}${d.scenario.metrics.revenue}`} icon={CircleDollarSign}/><MetricCard label="Expenses" value={`${d.scenario.currency}184`} icon={ReceiptText}/><MetricCard label="Net result" value={`${d.scenario.currency}${d.scenario.metrics.revenue-184}`} icon={WalletCards}/><MetricCard label="Transactions" value={d.sales.length+8} icon={CreditCard}/></section><Panel title="Cash-flow preview" subtitle="Last seven demo days"><div className="flex h-72 items-end gap-4 rounded-2xl bg-muted/40 p-5">{[42,58,47,76,62,88,71].map((height,i)=><div key={i} className="flex flex-1 flex-col items-center gap-2"><div className="w-full rounded-t-xl bg-gradient-to-t from-violet-700 to-violet-400" style={{height:`${height}%`}}/><span className="text-[10px] text-muted-foreground">Day {i+1}</span></div>)}</div></Panel></>; }
function CustomersModule() { const d=useDemoOwner(); return <Panel title="Customer directory" subtitle="Sample profiles only"><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="border-b bg-muted/40 text-xs text-muted-foreground"><tr><th className="p-3">Customer</th><th className="p-3">Contact</th><th className="p-3">Last visit</th><th className="p-3">Visits</th><th className="p-3">Lifetime value</th></tr></thead><tbody className="divide-y">{d.customers.map((customer)=><tr key={customer.id}><td className="p-3 font-bold">{customer.name}</td><td className="p-3"><div>{customer.email}</div><div className="text-xs text-muted-foreground">{customer.phone}</div></td><td className="p-3">{customer.lastVisit}</td><td className="p-3">{customer.visits}</td><td className="p-3 font-bold">{d.scenario.currency}{customer.value}</td></tr>)}</tbody></table></div></Panel>; }
function StaffModule() { const d=useDemoOwner(); return <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{d.team.map((member)=><article key={member.id} className="rounded-2xl border bg-card p-5 shadow-sm"><div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 font-extrabold text-violet-700">{member.name.charAt(0)}</div><div><h2 className="font-extrabold">{member.name}</h2><p className="text-xs text-muted-foreground">{member.role}</p></div></div><div className="mt-5 grid grid-cols-2 gap-3 text-xs"><div className="rounded-xl bg-muted/50 p-3"><span className="text-muted-foreground">Hours</span><div className="mt-1 font-bold">{member.workingHours}</div></div><div className="rounded-xl bg-muted/50 p-3"><span className="text-muted-foreground">Utilisation</span><div className="mt-1 font-bold">{member.utilisation}%</div></div></div></article>)}</section>; }
function ServicesModule() { const d=useDemoOwner(); return <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{d.services.map((service)=><article key={service.id} className="rounded-2xl border bg-card p-5 shadow-sm"><div className="flex items-start justify-between"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700"><Layers3 className="h-5 w-5" /></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase text-emerald-700">Active</span></div><h2 className="mt-5 text-lg font-extrabold">{service.name}</h2><div className="mt-3 flex gap-4 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{service.duration} min</span><span className="font-extrabold text-foreground">{d.scenario.currency}{service.price}</span></div></article>)}</section>; }
function ProductsModule() { const d=useDemoOwner(); return <Panel title="Inventory" subtitle="Low-stock rules are demonstrated locally"><div className="grid gap-3">{d.products.map((product)=><div key={product.id} className="grid gap-3 rounded-xl border p-4 sm:grid-cols-[minmax(0,1fr)_120px_120px]"><div><div className="font-extrabold">{product.name}</div><div className="text-xs text-muted-foreground">Threshold {product.threshold}</div></div><div><div className="text-xs text-muted-foreground">Stock</div><div className={cn('font-extrabold',product.stock<=product.threshold?'text-rose-600':'text-emerald-700')}>{product.stock} units</div></div><div><div className="text-xs text-muted-foreground">Retail price</div><div className="font-extrabold">{d.scenario.currency}{product.price}</div></div></div>)}</div></Panel>; }
function MarketingModule() { const d=useDemoOwner(); return <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]"><Panel title="Campaigns & automations" subtitle="Sending is disabled in demo mode"><div className="grid gap-3">{d.campaigns.map((campaign)=><div key={campaign.id} className="flex items-center justify-between rounded-xl border p-4"><div><div className="font-extrabold">{campaign.name}</div><div className="text-xs text-muted-foreground">Audience: {campaign.audience} customers</div></div><span className={cn('rounded-full px-2.5 py-1 text-[10px] font-bold uppercase',campaign.status==='draft'?'bg-amber-100 text-amber-800':'bg-violet-100 text-violet-700')}>{campaign.status}</span></div>)}</div></Panel><Panel title="Communication controls" subtitle="Transactional and promotional delivery"><StatusRow label="Appointment email" value={d.settings.reminders ? 'Enabled' : 'Disabled'}/><StatusRow label="Email reminders" value={d.settings.reminders ? 'Enabled' : 'Disabled'}/><StatusRow label="SMS provider" value="Not connected"/><div className="mt-4"><ul className="space-y-3 text-sm text-muted-foreground">{['Consent is checked before promotional delivery','Appointment communications are managed in Automations','No email or SMS provider is called in demo mode'].map((item)=><li key={item} className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{item}</li>)}</ul></div></Panel></div>; }
function PostsModule() { const d=useDemoOwner(); return <Panel title="Customer posts" subtitle="Public updates, offers and closure notices"><div className="grid gap-4 md:grid-cols-2">{d.posts.map((post)=><article key={post.id} className="rounded-2xl border p-5"><div className="flex items-center justify-between"><Megaphone className="h-5 w-5 text-violet-600"/><span className="rounded-full bg-muted px-2 py-1 text-[10px] font-bold uppercase">{post.status}</span></div><h2 className="mt-4 font-extrabold">{post.title}</h2><p className="mt-2 text-xs text-muted-foreground">Created {post.createdAt}</p></article>)}</div></Panel>; }
function GalleryModule() { const d=useDemoOwner(); return <Panel title="Public gallery" subtitle={`${d.galleryCount} images in this demo session`}><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{Array.from({length:d.galleryCount}).map((_,index)=><div key={index} className="aspect-square overflow-hidden rounded-2xl border bg-gradient-to-br from-violet-100 via-white to-amber-100"><div className="flex h-full items-center justify-center"><ImagePlus className="h-8 w-8 text-violet-400" /></div></div>)}</div></Panel>; }
function StorefrontModule() { const d=useDemoOwner(); return <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]"><Panel title="Public storefront preview" subtitle="What customers see before booking"><div className="overflow-hidden rounded-2xl border bg-slate-950 text-white"><div className="bg-[radial-gradient(circle_at_top_right,_rgba(124,58,237,.45),_transparent_45%)] p-7"><div className="text-xs font-bold uppercase tracking-[.16em] text-violet-300">{d.scenario.industry}</div><h2 className="mt-3 text-3xl font-extrabold">{d.scenario.businessName}</h2><p className="mt-3 max-w-xl text-sm text-white/65">Professional services, real availability and a simple booking experience.</p><Button className="mt-6 rounded-xl bg-amber-400 text-slate-950 hover:bg-amber-300">Book appointment</Button></div></div></Panel><Panel title="Storefront & booking controls" subtitle="Business profile, public presence and booking rules"><StatusRow label="Public page" value="Published"/><StatusRow label="Online booking" value={d.settings.onlineBooking ? 'Enabled' : 'Disabled'}/><StatusRow label="Booking rules" value="Configured"/><StatusRow label="Services visible" value={String(d.services.length)}/><StatusRow label="Gallery images" value={String(d.galleryCount)}/></Panel></div>; }
function BusinessModule() { const d=useDemoOwner(); return <div className="grid gap-5 lg:grid-cols-2"><Panel title="Business profile" subtitle="Sample business information"><Field label="Business name" value={d.scenario.businessName}/><Field label="Industry" value={d.scenario.industry}/><Field label="Region" value="Nicosia, Cyprus"/><Field label="Timezone" value="Europe/Nicosia"/></Panel><Panel title="Operational controls" subtitle="Closures and booking configuration"><StatusRow label="Online booking" value="Enabled"/><StatusRow label="Business closures" value="None configured"/><StatusRow label="Guest bookings" value="Allowed"/><StatusRow label="Default currency" value={d.scenario.currency}/></Panel></div>; }
function ReportsModule() { const d=useDemoOwner(); return <><section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Revenue" value={`${d.scenario.currency}${d.scenario.metrics.revenue}`} icon={CircleDollarSign}/><MetricCard label="Appointments" value={d.appointments.length} icon={CalendarDays}/><MetricCard label="Completion rate" value="76%" icon={CheckCircle2}/><MetricCard label="New customers" value={d.customers.length} icon={Users}/></section><Panel title="Revenue trend" subtitle="Sample reporting period"><div className="flex h-72 items-end gap-3 rounded-2xl border bg-muted/30 p-5">{[35,48,44,63,58,82,74,91,68,88].map((height,index)=><div key={index} className="flex flex-1 flex-col items-center gap-2"><div className="w-full rounded-t-lg bg-violet-600" style={{height:`${height}%`}}/><span className="text-[9px] text-muted-foreground">{index+1}</span></div>)}</div></Panel></>; }
function BillingModule() { return <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]"><Panel title="Velliqo Pro" subtitle="Demo subscription"><div className="rounded-2xl border border-violet-200 bg-violet-50 p-5"><div className="flex items-center justify-between"><div><div className="text-xs font-bold uppercase tracking-[.16em] text-violet-700">Current plan</div><h2 className="mt-2 text-2xl font-extrabold text-violet-950">Pro</h2></div><CreditCard className="h-8 w-8 text-violet-600"/></div><div className="mt-5 text-3xl font-extrabold">€49.99<span className="text-sm font-semibold text-muted-foreground"> / month</span></div><div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-bold"><div className="rounded-xl border bg-white/70 p-2">Standard<br/>€29.99</div><div className="rounded-xl border border-violet-300 bg-white p-2 text-violet-800">Pro<br/>€49.99</div><div className="rounded-xl border bg-white/70 p-2">Premium<br/>€89.99</div></div></div></Panel><Panel title="Invoices" subtitle="Example billing history"><div className="space-y-3"><StatusRow label="July 2026" value="Paid - €49.99"/><StatusRow label="June 2026" value="Paid - €49.99"/><StatusRow label="May 2026" value="Paid - €49.99"/></div></Panel></div>; }
function AIModule() { const d=useDemoOwner(); const [messages,setMessages]=React.useState([{role:'assistant',text:`I am ready to help with ${d.scenario.businessName}. Ask about appointments, customers, stock or campaigns.`}]); const [input,setInput]=React.useState(''); const [confirm,setConfirm]=React.useState(false); const ask=()=>{if(!input.trim())return; const text=input.trim(); setMessages((m)=>[...m,{role:'user',text},{role:'assistant',text:d.scenario.aiResponse}]); if(/create|add|prepare|send|book/i.test(text))setConfirm(true); setInput('');}; return <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]"><Panel title="Velliqo AI conversation" subtitle="Text and voice use the same permission model"><div className="flex min-h-[430px] flex-col"><div className="flex-1 space-y-3 overflow-y-auto rounded-2xl bg-muted/30 p-4">{messages.map((m,i)=><div key={i} className={cn('max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6',m.role==='user'?'ml-auto bg-violet-600 text-white':'bg-white shadow-sm')}>{m.text}</div>)}</div><div className="mt-3 flex gap-2"><Input value={input} onChange={(e)=>setInput(e.target.value)} onKeyDown={(e)=>e.key==='Enter'&&ask()} placeholder="Ask Velliqo AI..."/><Button size="icon" onClick={ask}><Send className="h-4 w-4"/></Button></div></div></Panel><Panel title="Permissions" subtitle="Protected action boundaries"><div className="space-y-3"><StatusRow label="Read business data" value="Allowed in sample data"/><StatusRow label="Create draft" value="Confirmation required"/><StatusRow label="Send campaign" value="Disabled in demo"/><StatusRow label="Delete records" value="Disabled in demo"/></div></Panel><Dialog open={confirm} onOpenChange={setConfirm}><DialogContent><DialogHeader><DialogTitle>Confirm demo action</DialogTitle><DialogDescription>This confirmation behaves like the owner workspace, but the action remains local and is not saved.</DialogDescription></DialogHeader><div className="rounded-xl border bg-muted/40 p-4 text-sm"><strong>Prepared action:</strong> Create a reviewable draft based on your request.</div><DialogFooter><Button variant="outline" onClick={()=>setConfirm(false)}>Cancel</Button><Button onClick={()=>{setConfirm(false);setMessages((m)=>[...m,{role:'assistant',text:'Confirmed. The demo draft was created locally and was not written to the database.'}]);}}>Confirm demo action</Button></DialogFooter></DialogContent></Dialog></div>; }
function DemoActionDialog({ type, onClose }: { type: string | null; onClose: () => void }) { const d=useDemoOwner(); const configs: Record<string,{title:string,description:string,action:()=>void}>={appointment:{title:'Create demo appointment',description:'Complete the form as an owner would. The appointment will exist only in this session.',action:d.addAppointment},customer:{title:'Add demo customer',description:'This sample profile is never sent to Supabase.',action:d.addCustomer},staff:{title:'Add demo team member',description:'The team member is local to this demo session.',action:d.addTeamMember},service:{title:'Add demo service',description:'The service is not stored in the production database.',action:d.addService}}; const config=type?configs[type]:null; return <Dialog open={Boolean(config)} onOpenChange={(open)=>!open&&onClose()}>{config&&<DialogContent><DialogHeader><DialogTitle>{config.title}</DialogTitle><DialogDescription>{config.description}</DialogDescription></DialogHeader><div className="grid gap-3"><Input defaultValue={type==='appointment'?'Demo customer':type==='service'?'New demo service':'Sample value'} /><Input defaultValue={type==='appointment'?'16:30':type==='service'?'45 minutes':'Additional information'} /></div><div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900"><ShieldCheck className="mr-2 inline h-4 w-4"/>No database request will be made.</div><DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={()=>{config.action();onClose();}}>Apply in demo</Button></DialogFooter></DialogContent>}</Dialog>; }
function MetricCard({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon: typeof BarChart3 }) { return <article className="rounded-2xl border bg-card p-5 shadow-sm"><div className="flex items-center justify-between"><span className="text-xs font-bold text-muted-foreground">{label}</span><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-4 w-4"/></span></div><div className="mt-4 text-2xl font-extrabold">{value}</div></article>; }
function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) { return <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5"><div className="mb-4 flex items-start justify-between gap-3"><div><h2 className="font-extrabold">{title}</h2>{subtitle&&<p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}</div></div>{children}</section>; }
function AppointmentList({ limit }: { limit?: number }) { const d=useDemoOwner(); return <div className="grid gap-2">{d.appointments.slice(0,limit).map((appointment)=><div key={appointment.id} className="grid grid-cols-[58px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border bg-muted/25 p-3"><div className="text-xs font-extrabold">{appointment.time}</div><div className="min-w-0"><div className="truncate text-sm font-extrabold">{appointment.customer}</div><div className="truncate text-xs text-muted-foreground">{appointment.service} - {appointment.professional}</div></div><span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-700">{appointment.status}</span></div>)}</div>; }
function StatusRow({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-4 border-b py-3 text-sm last:border-0"><span className="text-muted-foreground">{label}</span><strong className="text-right">{value}</strong></div>; }
function Field({ label, value }: { label: string; value: string }) { return <label className="mb-4 block"><span className="mb-1.5 block text-xs font-bold text-muted-foreground">{label}</span><Input value={value} readOnly /></label>; }
