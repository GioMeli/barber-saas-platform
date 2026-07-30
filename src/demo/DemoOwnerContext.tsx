import React from 'react';
import { toast } from 'sonner';
import { DEMO_SCENARIOS, type DemoScenario } from './sampleData';

export type DemoAppointment = DemoScenario['appointments'][number] & { id: string; date: string };
export type DemoCustomer = DemoScenario['customers'][number] & { id: string; email: string; phone: string };
export type DemoTeamMember = { id: string; name: string; role: string; workingHours: string; utilisation: number };
export type DemoService = DemoScenario['services'][number] & { id: string; active: boolean };
export type DemoProduct = { id: string; name: string; stock: number; threshold: number; price: number };
export type DemoSale = { id: string; reference: string; customer: string; total: number; status: 'paid' | 'refunded' };
export type DemoPost = { id: string; title: string; status: 'published' | 'draft'; createdAt: string };
export type DemoCampaign = { id: string; name: string; audience: number; status: 'draft' | 'scheduled' };

export type DemoState = {
  scenarioIndex: number;
  scenario: DemoScenario;
  appointments: DemoAppointment[];
  customers: DemoCustomer[];
  team: DemoTeamMember[];
  services: DemoService[];
  products: DemoProduct[];
  sales: DemoSale[];
  posts: DemoPost[];
  campaigns: DemoCampaign[];
  galleryCount: number;
  settings: { reminders: boolean; onlineBooking: boolean; aiBriefing: boolean };
};

type DemoContextValue = DemoState & {
  switchScenario: (index: number) => void;
  reset: () => void;
  addAppointment: () => void;
  addCustomer: () => void;
  addTeamMember: () => void;
  addService: () => void;
  adjustStock: () => void;
  addSale: () => void;
  addPost: () => void;
  addCampaign: () => void;
  addGalleryItem: () => void;
  toggleSetting: (key: keyof DemoState['settings']) => void;
};

const DemoOwnerContext = React.createContext<DemoContextValue | null>(null);

function initialState(index = 0): DemoState {
  const scenario = DEMO_SCENARIOS[index];
  return {
    scenarioIndex: index,
    scenario,
    appointments: scenario.appointments.map((item, i) => ({ ...item, id: `a-${index}-${i}`, date: 'Today' })),
    customers: scenario.customers.map((item, i) => ({ ...item, id: `c-${index}-${i}`, email: `customer${i + 1}@example.com`, phone: `+357 99 000 10${i}` })),
    team: [
      { id: `t-${index}-1`, name: scenario.appointments[0]?.professional || 'Alex', role: 'Professional', workingHours: '09:00-17:00', utilisation: scenario.metrics.utilisation },
      { id: `t-${index}-2`, name: scenario.appointments[2]?.professional || 'Sam', role: 'Professional', workingHours: '10:00-18:00', utilisation: Math.max(55, scenario.metrics.utilisation - 9) },
    ],
    services: scenario.services.map((item, i) => ({ ...item, id: `s-${index}-${i}`, active: true })),
    products: [
      { id: `p-${index}-1`, name: 'Professional care product', stock: 14, threshold: 5, price: 24 },
      { id: `p-${index}-2`, name: 'Daily-use consumable', stock: 4, threshold: 6, price: 12 },
      { id: `p-${index}-3`, name: 'Premium treatment item', stock: 8, threshold: 4, price: 38 },
    ],
    sales: [
      { id: `sale-${index}-1`, reference: 'VLQ-1048', customer: scenario.customers[0]?.name || 'Customer', total: scenario.metrics.revenue / 4, status: 'paid' },
      { id: `sale-${index}-2`, reference: 'VLQ-1047', customer: scenario.customers[1]?.name || 'Customer', total: 65, status: 'paid' },
    ],
    posts: [
      { id: `post-${index}-1`, title: 'Welcome to our updated booking experience', status: 'published', createdAt: 'Today' },
      { id: `post-${index}-2`, title: 'Seasonal availability update', status: 'draft', createdAt: 'Yesterday' },
    ],
    campaigns: [
      { id: `campaign-${index}-1`, name: 'Customer reactivation', audience: 34, status: 'draft' },
      { id: `campaign-${index}-2`, name: 'Appointment reminder', audience: 18, status: 'scheduled' },
    ],
    galleryCount: 6,
    settings: { reminders: true, onlineBooking: true, aiBriefing: true },
  };
}

export function DemoOwnerProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<DemoState>(() => initialState());

  const announce = React.useCallback((message: string) => {
    toast.success(message, { description: 'Demo only - this change exists in this browser session and is never saved to the database.' });
  }, []);

  const value = React.useMemo<DemoContextValue>(() => ({
    ...state,
    switchScenario: (index) => setState(initialState(index)),
    reset: () => { setState(initialState(state.scenarioIndex)); announce('Demo workspace reset'); },
    addAppointment: () => {
      setState((current) => ({ ...current, appointments: [...current.appointments, { id: `demo-${Date.now()}`, date: 'Tomorrow', time: '16:30', customer: 'Demo customer', service: current.services[0]?.name || 'Service', professional: current.team[0]?.name || 'Professional', status: 'confirmed' }] }));
      announce('Appointment added to the demo session');
    },
    addCustomer: () => {
      setState((current) => ({ ...current, customers: [...current.customers, { id: `demo-c-${Date.now()}`, name: 'New demo customer', email: 'new.customer@example.com', phone: '+357 99 000 199', lastVisit: 'Not visited yet', visits: 0, value: 0 }] }));
      announce('Customer added to the demo session');
    },
    addTeamMember: () => {
      setState((current) => ({ ...current, team: [...current.team, { id: `demo-t-${Date.now()}`, name: 'New team member', role: 'Professional', workingHours: '09:00-17:00', utilisation: 0 }] }));
      announce('Team member added to the demo session');
    },
    addService: () => {
      setState((current) => ({ ...current, services: [...current.services, { id: `demo-s-${Date.now()}`, name: 'New demo service', duration: 45, price: 50, active: true }] }));
      announce('Service added to the demo session');
    },
    adjustStock: () => {
      setState((current) => ({ ...current, products: current.products.map((product, i) => i === 1 ? { ...product, stock: product.stock + 10 } : product) }));
      announce('Stock adjusted in the demo session');
    },
    addSale: () => {
      setState((current) => ({ ...current, sales: [{ id: `demo-sale-${Date.now()}`, reference: `VLQ-${1100 + current.sales.length}`, customer: current.customers[0]?.name || 'Customer', total: 75, status: 'paid' }, ...current.sales] }));
      announce('Sale completed in the demo session');
    },
    addPost: () => {
      setState((current) => ({ ...current, posts: [{ id: `demo-post-${Date.now()}`, title: 'New demo announcement', status: 'draft', createdAt: 'Now' }, ...current.posts] }));
      announce('Post draft created in the demo session');
    },
    addCampaign: () => {
      setState((current) => ({ ...current, campaigns: [{ id: `demo-campaign-${Date.now()}`, name: 'New Velliqo AI campaign draft', audience: 26, status: 'draft' }, ...current.campaigns] }));
      announce('Campaign draft created in the demo session');
    },
    addGalleryItem: () => {
      setState((current) => ({ ...current, galleryCount: current.galleryCount + 1 }));
      announce('Gallery item added to the demo session');
    },
    toggleSetting: (key) => {
      setState((current) => ({ ...current, settings: { ...current.settings, [key]: !current.settings[key] } }));
      announce('Setting changed in the demo session');
    },
  }), [announce, state]);

  return <DemoOwnerContext.Provider value={value}>{children}</DemoOwnerContext.Provider>;
}

export function useDemoOwner() {
  const context = React.useContext(DemoOwnerContext);
  if (!context) throw new Error('useDemoOwner must be used inside DemoOwnerProvider');
  return context;
}
