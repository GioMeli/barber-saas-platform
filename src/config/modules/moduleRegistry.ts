export type ModuleKey =
  | 'appointments'
  | 'calendar'
  | 'services'
  | 'team'
  | 'customers'
  | 'storefront'
  | 'reports'
  | 'products'
  | 'inventory'
  | 'gallery'
  | 'posts'
  | 'memberships'
  | 'classes'
  | 'resources'
  | 'forms'
  | 'payments'
  | 'academy';

export type ModuleConfig = {
  key: ModuleKey;
  name: string;
  description: string;
  core: boolean;
};

export const MODULE_REGISTRY: Record<ModuleKey, ModuleConfig> = {
  appointments: { key: 'appointments', name: 'Appointments', description: 'Online and internal appointment management.', core: true },
  calendar: { key: 'calendar', name: 'Calendar', description: 'Team schedules, availability and daily operations.', core: true },
  services: { key: 'services', name: 'Services', description: 'Service catalogue, pricing and duration.', core: true },
  team: { key: 'team', name: 'Team', description: 'Professionals, roles and working hours.', core: true },
  customers: { key: 'customers', name: 'Customers', description: 'Customer profiles, history and CRM.', core: true },
  storefront: { key: 'storefront', name: 'Online Storefront', description: 'Public business page and booking experience.', core: true },
  reports: { key: 'reports', name: 'Reports', description: 'Revenue and operational performance.', core: true },
  products: { key: 'products', name: 'Products', description: 'Retail products and customer-facing catalogue.', core: false },
  inventory: { key: 'inventory', name: 'Inventory', description: 'Stock levels and inventory activity.', core: false },
  gallery: { key: 'gallery', name: 'Gallery', description: 'Showcase work, spaces and results.', core: false },
  posts: { key: 'posts', name: 'Updates', description: 'Offers, announcements and business news.', core: false },
  memberships: { key: 'memberships', name: 'Memberships', description: 'Recurring plans, packages and subscriptions.', core: false },
  classes: { key: 'classes', name: 'Classes', description: 'Group sessions and class capacity.', core: false },
  resources: { key: 'resources', name: 'Resources', description: 'Rooms, equipment, vehicles or workstations.', core: false },
  forms: { key: 'forms', name: 'Forms', description: 'Intake, consent and custom forms.', core: false },
  payments: { key: 'payments', name: 'Payments', description: 'Deposits, checkout and payment records.', core: false },
  academy: { key: 'academy', name: 'Velliqo Academy', description: 'Guides, tutorials and onboarding help.', core: true },
};

export const CORE_MODULES = Object.values(MODULE_REGISTRY).filter((module) => module.core).map((module) => module.key);
