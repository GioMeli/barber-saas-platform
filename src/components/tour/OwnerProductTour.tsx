import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BookOpenCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  MousePointerClick,
  RotateCcw,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/db/supabase';

const TOUR_KEY = 'owner-detailed-v2';

type LocalizedText = {
  key: string;
  defaultValue: string;
};

type TourAction = {
  selector: string;
  waitMs?: number;
};

type OwnerTourStep = {
  key: string;
  chapter: string;
  chapterLabel: LocalizedText;
  route: string;
  selector: string;
  title: LocalizedText;
  description: LocalizedText;
  details?: LocalizedText[];
  action?: TourAction;
  opensOverlay?: boolean;
};

const text = (key: string, defaultValue: string): LocalizedText => ({ key, defaultValue });

const chapterLabels = {
  workspace: text('ownerExperience.tour.chapters.workspace', 'Workspace basics'),
  home: text('dashboard.home', 'Home'),
  calendar: text('dashboard.calendar', 'Calendar'),
  sales: text('dashboard.sales', 'Sales'),
  finance: text('dashboard.finance', 'Finance'),
  customers: text('dashboard.customers', 'Customers'),
  staff: text('dashboard.staff', 'Staff'),
  services: text('dashboard.services', 'Services'),
  products: text('dashboard.products', 'Products'),
  marketing: text('navigation.marketing', 'Marketing'),
  posts: text('navigation.posts', 'Posts'),
  gallery: text('navigation.gallery', 'Gallery'),
  storefront: text('navigation.storefront', 'Storefront'),
  business: text('navigation.business', 'Business'),
  reports: text('dashboard.reports', 'Reports'),
  billing: text('dashboard.billing', 'Billing'),
  ai: text('navigation.ai', 'Velliqo AI'),
  training: text('navigation.training', 'Training'),
} satisfies Record<string, LocalizedText>;

const featureDescription = (feature: string, defaultValue: string) =>
  text(`ownerExperience.tour.features.${feature}`, defaultValue);

const TOUR_STEPS: OwnerTourStep[] = [
  // Workspace shell
  {
    key: 'workspace-welcome', chapter: 'workspace', chapterLabel: chapterLabels.workspace,
    route: '/dashboard', selector: '[data-tour="owner-workspace"]',
    title: text('ownerExperience.tour.steps.welcome.title', 'Welcome to your Owner workspace'),
    description: text('ownerExperience.tour.steps.welcome.description', 'This guided tour explains every major Owner feature, tab, option and creation workflow.'),
    details: [
      text('ownerExperience.tour.features.home', 'Begin with the daily overview and move into each operational workspace.'),
      text('training.description', 'Use Training later for structured guides and walkthrough videos.'),
    ],
  },
  {
    key: 'workspace-navigation', chapter: 'workspace', chapterLabel: chapterLabels.workspace,
    route: '/dashboard', selector: '[data-tour="owner-navigation"]',
    title: text('navigation.workspace_navigation', 'Workspace navigation'),
    description: text('ownerExperience.tour.features.home', 'The navigation gives direct access to every Owner workspace.'),
    details: [
      text('ownerExperience.tour.features.calendar', 'Calendar and appointments'),
      text('ownerExperience.tour.features.customers', 'Customers, staff, services and products'),
      text('ownerExperience.tour.features.reports', 'Reports, finance, billing, AI and training'),
    ],
  },
  {
    key: 'workspace-quick-add', chapter: 'workspace', chapterLabel: chapterLabels.workspace,
    route: '/dashboard', selector: '[data-tour="quick-add"]',
    title: text('ownerExperience.tour.steps.quickAdd.title', 'Create common records quickly'),
    description: text('ownerExperience.tour.steps.quickAdd.description', 'Use Quick add to begin the most common creation workflows from any Owner page.'),
    details: [
      text('calendar.newAppointment.title', 'New appointment'),
      text('customers.dialog.addTitle', 'Add customer'),
      text('staff.dialog.addTitle', 'Add staff member'),
      text('services.dialog.addTitle', 'Add service'),
    ],
  },
  {
    key: 'workspace-notifications', chapter: 'workspace', chapterLabel: chapterLabels.workspace,
    route: '/dashboard', selector: '[data-tour="notifications"]',
    title: text('ownerExperience.tour.steps.notifications.title', 'Stay ahead of operational changes'),
    description: text('ownerExperience.tour.steps.notifications.description', 'Notifications surface appointments, customer activity, AI alerts and automation events.'),
  },
  {
    key: 'workspace-ai', chapter: 'workspace', chapterLabel: chapterLabels.workspace,
    route: '/dashboard', selector: '[data-tour="desktop-ai"]',
    title: text('ownerExperience.tour.steps.aiAssistant.title', 'Talk to Velliqo AI anywhere'),
    description: text('ownerExperience.tour.steps.aiAssistant.description', 'Open the desktop assistant for text or voice conversations without leaving the current page.'),
    details: [
      text('ownerExperience.aiDrawer.description', 'Ask questions, review business insights and confirm protected actions.'),
      text('ai.manager.chatDescription', 'Choose the specialist that best matches the task.'),
    ],
  },
  {
    key: 'workspace-language', chapter: 'workspace', chapterLabel: chapterLabels.workspace,
    route: '/dashboard', selector: '[data-tour="language"]',
    title: text('ownerExperience.tour.steps.language.title', 'Change the workspace language'),
    description: text('ownerExperience.tour.steps.language.description', 'Switch the Owner interface and supported AI experience without changing stored business data.'),
  },

  // Home
  {
    key: 'home-overview', chapter: 'home', chapterLabel: chapterLabels.home,
    route: '/dashboard', selector: '[data-tour-page="home"]',
    title: text('dashboard.home', 'Home'),
    description: featureDescription('home', 'Review today’s activity, performance, alerts and business health.'),
  },
  {
    key: 'home-schedule', chapter: 'home', chapterLabel: chapterLabels.home,
    route: '/dashboard', selector: '[data-tour="home-schedule"]',
    title: text('dashboard_home.schedule.title', 'Today’s schedule'),
    description: text('dashboard_home.schedule.description', 'Review the daily calendar divided into columns for each professional.'),
    details: [
      text('dashboard_home.schedule.open_calendar', 'Open the full calendar'),
      text('dashboard_home.schedule.legend.completed', 'Understand appointment status colours'),
      text('dashboard_home.schedule.unassigned', 'Identify unassigned appointments'),
    ],
  },
  {
    key: 'home-metrics', chapter: 'home', chapterLabel: chapterLabels.home,
    route: '/dashboard', selector: '[data-tour="home-metrics"]',
    title: text('dashboard_home.pulse.title', 'Business pulse'),
    description: featureDescription('home', 'Use the metric cards to assess today’s operation and open the related workspace.'),
    details: [
      text('dashboard_home.metrics.today_appointments', 'Today’s appointments'),
      text('dashboard_home.metrics.expected_revenue', 'Expected revenue'),
      text('dashboard_home.metrics.new_customers', 'New customers'),
      text('dashboard_home.metrics.active_services', 'Active services'),
    ],
  },
  {
    key: 'home-alerts', chapter: 'home', chapterLabel: chapterLabels.home,
    route: '/dashboard', selector: '[data-tour="home-alerts"]',
    title: text('dashboard_home.alerts.title', 'Today’s alerts'),
    description: text('dashboard_home.alerts.description', 'Operational items that need attention today appear here.'),
    details: [
      text('dashboard_home.alerts.unread_detail', 'Review unread notifications.'),
      text('dashboard_home.alerts.unassigned_detail', 'Assign a professional before the appointment begins.'),
      text('dashboard_home.alerts.cancelled_detail', 'Review cancellations and refill available time.'),
    ],
  },
  {
    key: 'home-health', chapter: 'home', chapterLabel: chapterLabels.home,
    route: '/dashboard', selector: '[data-tour="home-health"]',
    title: text('dashboard_home.health.title', 'Business health'),
    description: featureDescription('home', 'Monitor occupancy, completion, cancellations and unassigned work.'),
  },

  // Calendar
  {
    key: 'calendar-overview', chapter: 'calendar', chapterLabel: chapterLabels.calendar,
    route: '/dashboard/calendar', selector: '[data-tour="calendar-workspace"]',
    title: text('calendar.title', 'Calendar'),
    description: featureDescription('calendar', 'Create, edit, move and cancel appointments while reviewing real availability.'),
  },
  ...(['timeGridDay', 'timeGridThreeDay', 'timeGridWeek', 'dayGridMonth', 'listDay'] as const).map((view) => ({
    key: `calendar-view-${view}`, chapter: 'calendar', chapterLabel: chapterLabels.calendar,
    route: '/dashboard/calendar', selector: `[data-tour="calendar-view-${view}"]`,
    title: text(`calendar.views.${view}`, view),
    description: text('calendar.preferences.description', 'Choose the calendar view that matches the way you work.'),
    action: { selector: `[data-tour="calendar-view-${view}"]` },
  })),
  {
    key: 'calendar-options', chapter: 'calendar', chapterLabel: chapterLabels.calendar,
    route: '/dashboard/calendar', selector: '[data-tour="calendar-options-panel"]',
    title: text('calendar.preferences.title', 'Calendar tools'),
    description: text('calendar.preferences.description', 'Choose view, filters, search and visibility options.'),
    details: [
      text('calendar.preferences.searchAppointments', 'Search appointments'),
      text('calendar.preferences.defaultView', 'Choose a default view'),
      text('calendar.filters.professional', 'Filter by professional'),
    ],
    action: { selector: '[data-tour="calendar-options-button"]' }, opensOverlay: true,
  },
  {
    key: 'calendar-appointment-form', chapter: 'calendar', chapterLabel: chapterLabels.calendar,
    route: '/dashboard/calendar', selector: '[data-tour="calendar-appointment-form"]',
    title: text('calendar.newAppointment.title', 'New appointment'),
    description: text('calendar.newAppointment.description', 'Complete the appointment wizard using only valid staff and available slots.'),
    details: [
      text('calendar.customerStep.description', 'Search an existing customer or create a new one.'),
      text('calendar.servicesStep.description', 'Select one or more compatible services.'),
      text('calendar.professionalStep.description', 'Choose an eligible professional or automatic assignment.'),
      text('calendar.dateStep.description', 'Select a real available date and time.'),
      text('calendar.reviewStep.description', 'Review everything before creating the appointment.'),
    ],
    action: { selector: '[data-tour="calendar-new-button"]' }, opensOverlay: true,
  },
  {
    key: 'calendar-delay-form', chapter: 'calendar', chapterLabel: chapterLabels.calendar,
    route: '/dashboard/calendar', selector: '[data-tour="calendar-delay-form"]',
    title: text('calendar.delay.title', 'Create delay'),
    description: text('calendar.delay.description', 'Delay active appointments from a selected time and review every affected booking first.'),
    details: [text('calendar.delay.warning', 'Nothing changes when the delay would create a conflict.')],
    action: { selector: '[data-tour="calendar-delay-button"]' }, opensOverlay: true,
  },

  // Sales
  {
    key: 'sales-overview', chapter: 'sales', chapterLabel: chapterLabels.sales,
    route: '/dashboard/sales', selector: '[data-tour="sales-metrics"]',
    title: text('sales.title', 'Sales & Checkout'),
    description: text('sales.description', 'Complete appointments, sell services or products, record payments and issue receipts.'),
  },
  {
    key: 'sales-checkout', chapter: 'sales', chapterLabel: chapterLabels.sales,
    route: '/dashboard/sales', selector: '[data-tour="sales-checkout-tab"]',
    title: text('sales.tabs.checkout', 'Checkout'),
    description: text('sales.catalog.description', 'Start from an appointment or build a walk-in sale.'),
    action: { selector: '[data-tour="sales-checkout-tab"]' },
  },
  ...(['appointments', 'services', 'products', 'custom'] as const).map((catalog) => ({
    key: `sales-catalog-${catalog}`, chapter: 'sales', chapterLabel: chapterLabels.sales,
    route: '/dashboard/sales', selector: `[data-tour="sales-catalog-${catalog}"]`,
    title: text(`sales.catalog.${catalog}`, catalog),
    description: text('sales.catalog.description', 'Choose what to add to the current sale.'),
    action: { selector: `[data-tour="sales-catalog-${catalog}"]` },
  })),
  {
    key: 'sales-cart', chapter: 'sales', chapterLabel: chapterLabels.sales,
    route: '/dashboard/sales', selector: '[data-tour="sales-cart"]',
    title: text('sales.cart.title', 'Current sale'),
    description: featureDescription('sales', 'Review quantities, discounts, totals, payment method and receipt details before completion.'),
  },
  {
    key: 'sales-transactions', chapter: 'sales', chapterLabel: chapterLabels.sales,
    route: '/dashboard/sales', selector: '[data-tour="sales-transactions"]',
    title: text('sales.transactions.title', 'Transaction history'),
    description: text('sales.transactions.description', 'Review receipts, payment methods and voided transactions with a complete audit trail.'),
    action: { selector: '[data-tour="sales-transactions-tab"]', waitMs: 360 },
  },

  // Finance
  {
    key: 'finance-overview', chapter: 'finance', chapterLabel: chapterLabels.finance,
    route: '/dashboard/finance', selector: '[data-tour-page="finance"]',
    title: text('finance.title', 'Finance & Profit Intelligence'),
    description: text('finance.description', 'Understand collected revenue, margins, costs and expenses from real completed transactions.'),
  },
  {
    key: 'finance-filters', chapter: 'finance', chapterLabel: chapterLabels.finance,
    route: '/dashboard/finance', selector: '[data-tour="finance-filters"]',
    title: text('finance.filters.title', 'Date filters'),
    description: featureDescription('finance', 'Change the reporting period before evaluating finance metrics.'),
  },
  {
    key: 'finance-overview-tab', chapter: 'finance', chapterLabel: chapterLabels.finance,
    route: '/dashboard/finance', selector: '[data-tour="finance-tab-overview"]',
    title: text('finance.views.overview', 'Overview'),
    description: featureDescription('finance', 'Review collected revenue, costs, profit and tax indicators.'),
    action: { selector: '[data-tour="finance-tab-overview"]' },
  },
  {
    key: 'finance-expenses-tab', chapter: 'finance', chapterLabel: chapterLabels.finance,
    route: '/dashboard/finance', selector: '[data-tour="finance-expenses"]',
    title: text('finance.views.expenses', 'Expenses'),
    description: text('finance.expenses.description', 'Review and filter the expense register.'),
    action: { selector: '[data-tour="finance-tab-expenses"]', waitMs: 320 },
  },
  {
    key: 'finance-expense-form', chapter: 'finance', chapterLabel: chapterLabels.finance,
    route: '/dashboard/finance', selector: '[data-tour="finance-expense-form"]',
    title: text('finance.actions.addExpense', 'Add expense'),
    description: featureDescription('finance', 'Enter the expense date, category, amount, payment status, supplier and notes.'),
    action: { selector: '[data-tour="finance-new-expense"]' }, opensOverlay: true,
  },

  // Customers
  {
    key: 'customers-overview', chapter: 'customers', chapterLabel: chapterLabels.customers,
    route: '/dashboard/customers', selector: '[data-tour="customers-segments"]',
    title: text('customers.title', 'Customers'),
    description: text('customers.crm.description', 'Understand every customer relationship, visit pattern and revenue contribution.'),
  },
  ...([
    ['customers', 'customers.tabs.customers', 'Customer list'],
    ['records', 'customers.tabs.records', 'Customer records'],
    ['history', 'customers.tabs.history', 'Visit history'],
  ] as const).map(([tab, key, fallback]) => ({
    key: `customers-tab-${tab}`, chapter: 'customers', chapterLabel: chapterLabels.customers,
    route: '/dashboard/customers', selector: `[data-tour="customers-tab-${tab}"]`,
    title: text(key, fallback), description: featureDescription('customers', 'Use each CRM tab to review the corresponding customer information.'),
    action: { selector: `[data-tour="customers-tab-${tab}"]` },
  })),
  {
    key: 'customers-form', chapter: 'customers', chapterLabel: chapterLabels.customers,
    route: '/dashboard/customers', selector: '[data-tour="customers-form"]',
    title: text('customers.dialog.addTitle', 'Add customer'),
    description: featureDescription('customers', 'Create a registered customer profile with accurate contact and communication information.'),
    details: [
      text('customers.fields.fullName', 'Full name'),
      text('customers.fields.email', 'Email'),
      text('customers.fields.phone', 'Phone'),
      text('customers.fields.notes', 'Notes'),
    ],
    action: { selector: '[data-tour="customers-new-button"]' }, opensOverlay: true,
  },

  // Staff
  {
    key: 'staff-overview', chapter: 'staff', chapterLabel: chapterLabels.staff,
    route: '/dashboard/staff', selector: '[data-tour="staff-summary"]',
    title: text('staff.title', 'Staff'),
    description: text('staff.description', 'Manage employee profiles, service skills and weekly availability.'),
  },
  {
    key: 'staff-filters', chapter: 'staff', chapterLabel: chapterLabels.staff,
    route: '/dashboard/staff', selector: '[data-tour="staff-filters"]',
    title: text('staff.filters.title', 'Staff filters'),
    description: featureDescription('staff', 'Search and filter the team before opening an employee profile.'),
  },
  {
    key: 'staff-list', chapter: 'staff', chapterLabel: chapterLabels.staff,
    route: '/dashboard/staff', selector: '[data-tour="staff-list"]',
    title: text('staff.title', 'Staff members'),
    description: featureDescription('staff', 'Open a staff card to edit profile, skills, schedule and personal access.'),
  },
  {
    key: 'staff-form', chapter: 'staff', chapterLabel: chapterLabels.staff,
    route: '/dashboard/staff', selector: '[data-tour="staff-form"]',
    title: text('staff.dialog.addTitle', 'Add staff member'),
    description: text('staff.dialog.description', 'Configure the profile, services and weekly availability.'),
    details: [
      text('staff.profile.description', 'Add the customer-facing profile and contact details.'),
      text('staff.services.description', 'Select every service this professional can perform.'),
      text('staff.schedule.description', 'Set working hours that determine bookable slots.'),
      text('staff.personalAccess.description', 'Configure personal Staff App access when the plan permits it.'),
    ],
    action: { selector: '[data-tour="staff-new-button"]' }, opensOverlay: true,
  },

  // Services
  {
    key: 'services-list', chapter: 'services', chapterLabel: chapterLabels.services,
    route: '/dashboard/services', selector: '[data-tour="services-list"]',
    title: text('services.title', 'Services'),
    description: text('services.description', 'Manage pricing, duration, categories and online booking visibility.'),
  },
  {
    key: 'services-form', chapter: 'services', chapterLabel: chapterLabels.services,
    route: '/dashboard/services', selector: '[data-tour="services-form"]',
    title: text('services.dialog.addTitle', 'Add new service'),
    description: featureDescription('services', 'Define the service name, description, category, price, duration, image and booking visibility.'),
    action: { selector: '[data-tour="services-new-button"]' }, opensOverlay: true,
  },

  // Products
  {
    key: 'products-overview', chapter: 'products', chapterLabel: chapterLabels.products,
    route: '/dashboard/products', selector: '[data-tour="products-summary"]',
    title: text('products.title', 'Products & Inventory'),
    description: text('products.description', 'Manage products, stock, suppliers and inventory movement history.'),
  },
  ...([
    ['products', 'products.tabs.products', 'Products'],
    ['movements', 'products.tabs.movements', 'Stock movements'],
    ['alerts', 'products.tabs.alerts', 'Stock alerts'],
  ] as const).map(([tab, key, fallback]) => ({
    key: `products-tab-${tab}`, chapter: 'products', chapterLabel: chapterLabels.products,
    route: '/dashboard/products', selector: `[data-tour="products-tab-${tab}"]`,
    title: text(key, fallback), description: featureDescription('products', 'Use this tab to review the corresponding inventory information.'),
    action: { selector: `[data-tour="products-tab-${tab}"]` },
  })),
  {
    key: 'products-form', chapter: 'products', chapterLabel: chapterLabels.products,
    route: '/dashboard/products', selector: '[data-tour="products-form"]',
    title: text('products.dialog.addTitle', 'Add product'),
    description: featureDescription('products', 'Enter product identity, cost, retail price, stock, low-stock threshold, supplier and visibility.'),
    action: { selector: '[data-tour="products-new-button"]' }, opensOverlay: true,
  },

  // Marketing
  {
    key: 'marketing-overview', chapter: 'marketing', chapterLabel: chapterLabels.marketing,
    route: '/dashboard/marketing', selector: '[data-tour="marketing-metrics"]',
    title: text('marketing.title', 'Marketing Center'),
    description: text('marketing.description', 'Build campaigns, customer journeys, review workflows and growth activity.'),
  },
  ...([
    ['overview', 'marketing.tabs.overview', 'Overview'],
    ['campaigns', 'marketing.tabs.campaigns', 'Campaigns'],
    ['automations', 'marketing.tabs.automations', 'Automations'],
    ['delivery', 'marketing.tabs.delivery', 'Delivery'],
    ['reviews', 'marketing.tabs.reviews', 'Reviews'],
  ] as const).map(([tab, key, fallback]) => ({
    key: `marketing-tab-${tab}`, chapter: 'marketing', chapterLabel: chapterLabels.marketing,
    route: '/dashboard/marketing', selector: `[data-tour="marketing-tab-${tab}"]`,
    title: text(key, fallback), description: featureDescription('marketing', 'Open this tab to manage its marketing workflow and performance information.'),
    action: { selector: `[data-tour="marketing-tab-${tab}"]` },
  })),
  {
    key: 'marketing-appointment-communications', chapter: 'marketing', chapterLabel: chapterLabels.marketing,
    route: '/dashboard/marketing?tab=automations', selector: '[data-tour="marketing-appointment-communications"]',
    title: text('marketing.automations.appointmentCommunications.title', 'Appointment communications'),
    description: featureDescription('marketing', 'Choose confirmation and reminder channels, default language and reply-to email. These operational messages are separate from promotional campaigns.'),
  },
  {
    key: 'marketing-form', chapter: 'marketing', chapterLabel: chapterLabels.marketing,
    route: '/dashboard/marketing', selector: '[data-tour="marketing-campaign-form"]',
    title: text('marketing.actions.createCampaign', 'Create campaign'),
    description: featureDescription('marketing', 'Choose the audience, channel, content, timing and review status before publishing or scheduling.'),
    action: { selector: '[data-tour="marketing-new-button"]' }, opensOverlay: true,
  },

  // Posts
  {
    key: 'posts-overview', chapter: 'posts', chapterLabel: chapterLabels.posts,
    route: '/dashboard/posts', selector: '[data-tour="posts-summary"]',
    title: text('posts.title', 'Posts'),
    description: text('posts.description', 'Publish professional updates, offers, closures and business news.'),
  },
  {
    key: 'posts-filters', chapter: 'posts', chapterLabel: chapterLabels.posts,
    route: '/dashboard/posts', selector: '[data-tour="posts-filters"]',
    title: text('posts.filters.title', 'Post filters'),
    description: featureDescription('posts', 'Filter by status and search existing posts before editing or publishing.'),
  },
  {
    key: 'posts-list', chapter: 'posts', chapterLabel: chapterLabels.posts,
    route: '/dashboard/posts', selector: '[data-tour="posts-list"]',
    title: text('posts.title', 'Published content'),
    description: featureDescription('posts', 'Review previews, publication status and customer-facing content.'),
  },
  {
    key: 'posts-form', chapter: 'posts', chapterLabel: chapterLabels.posts,
    route: '/dashboard/posts', selector: '[data-tour="posts-form"]',
    title: text('posts.actions.create', 'Create post'),
    description: text('posts.dialog.description', 'Compose the post exactly as customers will see it.'),
    action: { selector: '[data-tour="posts-new-button"]' }, opensOverlay: true,
  },

  // Gallery
  {
    key: 'gallery-overview', chapter: 'gallery', chapterLabel: chapterLabels.gallery,
    route: '/dashboard/gallery', selector: '[data-tour="gallery-summary"]',
    title: text('gallery.title', 'Gallery'),
    description: text('gallery.description', 'Curate business images for the public storefront.'),
  },
  {
    key: 'gallery-filters', chapter: 'gallery', chapterLabel: chapterLabels.gallery,
    route: '/dashboard/gallery', selector: '[data-tour="gallery-filters"]',
    title: text('gallery.filters.title', 'Gallery filters'),
    description: featureDescription('gallery', 'Search and filter images by category or visibility.'),
  },
  {
    key: 'gallery-grid', chapter: 'gallery', chapterLabel: chapterLabels.gallery,
    route: '/dashboard/gallery', selector: '[data-tour="gallery-grid"]',
    title: text('gallery.title', 'Gallery images'),
    description: featureDescription('gallery', 'Review, edit, order and remove images used by the customer experience.'),
  },
  {
    key: 'gallery-form', chapter: 'gallery', chapterLabel: chapterLabels.gallery,
    route: '/dashboard/gallery', selector: '[data-tour="gallery-form"]',
    title: text('gallery.actions.add', 'Add image'),
    description: featureDescription('gallery', 'Upload an image, add its title and category, and control whether it appears publicly.'),
    action: { selector: '[data-tour="gallery-new-button"]' }, opensOverlay: true,
  },

  // Storefront
  {
    key: 'storefront-readiness', chapter: 'storefront', chapterLabel: chapterLabels.storefront,
    route: '/dashboard/storefront', selector: '[data-tour="storefront-readiness"]',
    title: text('storefront.owner.readiness.title', 'Storefront readiness'),
    description: text('storefront.owner.readiness.description', 'Complete the essential information customers expect before booking.'),
  },
  ...([
    ['overview', 'storefront.owner.sections.overview', 'Overview', 'storefront-overview', 'ownerExperience.tour.features.storefront', 'Review the public identity and core business details.'],
    ['branding', 'storefront.owner.sections.branding', 'Branding', 'storefront-branding', 'storefront.owner.branding.description', 'Upload the logo and cover image used throughout the customer experience.'],
    ['contact', 'storefront.owner.sections.contact', 'Contact', 'storefront-contact', 'storefront.owner.contact.description', 'Maintain customer-facing phone, email and address details.'],
    ['location', 'storefront.owner.sections.location', 'Location', 'storefront-location', 'storefront.owner.location.description', 'Configure structured address, map coordinates and directions.'],
    ['booking', 'storefront.owner.sections.booking', 'Booking rules', 'storefront-booking', 'ownerExperience.tour.features.storefront', 'Set booking interval, notice, advance window, cancellation policy and terms.'],
    ['online', 'storefront.owner.sections.online', 'Online presence', 'storefront-online', 'storefront.owner.online.description', 'Manage discovery visibility, SEO and social links.'],
    ['sharing', 'storefront.owner.sections.sharing', 'Preview & sharing', 'storefront-sharing', 'storefront.owner.sharing.description', 'Preview, copy and distribute the permanent public business page and QR code.'],
  ] as const).map(([section, titleKey, titleDefault, target, descriptionKey, descriptionDefault]) => ({
    key: `storefront-${section}`, chapter: 'storefront', chapterLabel: chapterLabels.storefront,
    route: '/dashboard/storefront', selector: `[data-tour="${target}"]`,
    title: text(titleKey, titleDefault), description: text(descriptionKey, descriptionDefault),
    action: { selector: `[data-tour="storefront-section-${section}"]`, waitMs: 320 },
  })),
  {
    key: 'storefront-save', chapter: 'storefront', chapterLabel: chapterLabels.storefront,
    route: '/dashboard/storefront', selector: '[data-tour="storefront-save"]',
    title: text('common.save_changes', 'Save changes'),
    description: featureDescription('storefront', 'Save only after reviewing the changed section. These values become the single source of truth for public pages and booking rules.'),
  },

  // Business
  {
    key: 'business-overview', chapter: 'business', chapterLabel: chapterLabels.business,
    route: '/dashboard/business', selector: '[data-tour="business-summary"]',
    title: text('business.title', 'Business'),
    description: text('business.description', 'Manage whole-business closures and operational controls.'),
  },
  {
    key: 'business-filters', chapter: 'business', chapterLabel: chapterLabels.business,
    route: '/dashboard/business', selector: '[data-tour="business-filters"]',
    title: text('business.filters.title', 'Closure filters'),
    description: featureDescription('business', 'Filter upcoming, past and active closures.'),
  },
  {
    key: 'business-closures', chapter: 'business', chapterLabel: chapterLabels.business,
    route: '/dashboard/business', selector: '[data-tour="business-closures"]',
    title: text('business.closures.title', 'Business closures'),
    description: featureDescription('business', 'Review closure dates, customer notices and booking impact.'),
  },
  {
    key: 'business-closure-form', chapter: 'business', chapterLabel: chapterLabels.business,
    route: '/dashboard/business', selector: '[data-tour="business-closure-form"]',
    title: text('business.dialog.addTitle', 'Add business closure'),
    description: text('business.dialog.description', 'No new appointment times will be available during this period.'),
    details: [
      text('business.fields.startDate', 'Start date'),
      text('business.fields.endDate', 'End date'),
      text('business.fields.title', 'Closure title'),
      text('business.fields.customerMessage', 'Optional customer message'),
    ],
    action: { selector: '[data-tour="business-new-closure"]' }, opensOverlay: true,
  },

  // Reports
  {
    key: 'reports-filters', chapter: 'reports', chapterLabel: chapterLabels.reports,
    route: '/dashboard/reports', selector: '[data-tour="reports-filters"]',
    title: text('reports.title', 'Business Intelligence'),
    description: text('reports.description', 'Analyse performance using a selected reporting period and real business data.'),
  },
  {
    key: 'reports-actions', chapter: 'reports', chapterLabel: chapterLabels.reports,
    route: '/dashboard/reports', selector: '[data-tour="reports-actions"]',
    title: text('reports.actions.export', 'Report actions'),
    description: featureDescription('reports', 'Refresh, print or export the current report after selecting the correct period and tab.'),
  },
  ...([
    ['executive', 'reports.tabs.executive', 'Executive'],
    ['finance', 'reports.tabs.finance', 'Finance intelligence'],
    ['revenue', 'reports.tabs.revenue', 'Revenue'],
    ['appointments', 'reports.tabs.appointments', 'Appointments'],
    ['staff', 'reports.tabs.staff', 'Staff'],
    ['services', 'reports.tabs.services', 'Services'],
    ['customers', 'reports.tabs.customers', 'Customers'],
    ['products', 'reports.tabs.products', 'Products'],
  ] as const).map(([tab, key, fallback]) => ({
    key: `reports-tab-${tab}`, chapter: 'reports', chapterLabel: chapterLabels.reports,
    route: '/dashboard/reports', selector: `[data-tour="reports-tab-${tab}"]`,
    title: text(key, fallback), description: featureDescription('reports', 'Open this reporting tab to analyse the corresponding business dimension.'),
    action: { selector: `[data-tour="reports-tab-${tab}"]`, waitMs: 260 },
  })),

  // Billing
  {
    key: 'billing-plan', chapter: 'billing', chapterLabel: chapterLabels.billing,
    route: '/dashboard/billing', selector: '[data-tour="billing-plan"]',
    title: text('billing.title', 'Billing'),
    description: featureDescription('billing', 'Review the active subscription, trial status and plan controls.'),
  },
  {
    key: 'billing-history', chapter: 'billing', chapterLabel: chapterLabels.billing,
    route: '/dashboard/billing', selector: '[data-tour="billing-history"]',
    title: text('billing.history.title', 'Payment history'),
    description: text('billing.history.description', 'Paid invoices and receipts appear here after payment synchronization.'),
  },

  // AI
  {
    key: 'ai-proactive', chapter: 'ai', chapterLabel: chapterLabels.ai,
    route: '/dashboard/ai', selector: '[data-tour="ai-proactive"]',
    title: text('ai.manager.proactive.title', 'Proactive intelligence'),
    description: featureDescription('ai', 'Review briefings, alerts, recommendations and automation opportunities.'),
  },
  {
    key: 'ai-agent-selector', chapter: 'ai', chapterLabel: chapterLabels.ai,
    route: '/dashboard/ai', selector: '[data-tour="ai-agent-selector"]',
    title: text('ai.manager.agentLabel', 'AI specialist'),
    description: text('ai.manager.chatDescription', 'Choose the specialist that matches the business question or action.'),
  },
  {
    key: 'ai-chat', chapter: 'ai', chapterLabel: chapterLabels.ai,
    route: '/dashboard/ai', selector: '[data-tour="ai-chat"]',
    title: text('navigation.ai', 'Velliqo AI'),
    description: featureDescription('ai', 'Ask questions by text or voice and review every protected action before confirmation.'),
    details: [
      text('ai.quickAccess.description', 'Keep the conversation open while reviewing actions.'),
      text('ai.automations.safetyDescription', 'Protected actions remain under owner control.'),
    ],
  },

  // Training
  {
    key: 'training-overview', chapter: 'training', chapterLabel: chapterLabels.training,
    route: '/dashboard/training', selector: '[data-tour="training-overview"]',
    title: text('training.title', 'Training Portal'),
    description: text('training.description', 'Use structured guides to learn every important Velliqo workflow.'),
  },
  {
    key: 'training-filters', chapter: 'training', chapterLabel: chapterLabels.training,
    route: '/dashboard/training', selector: '[data-tour="training-filters"]',
    title: text('training.searchPlaceholder', 'Search guides and workflows'),
    description: featureDescription('training', 'Filter courses by category and search for the workflow you need.'),
  },
  {
    key: 'training-courses', chapter: 'training', chapterLabel: chapterLabels.training,
    route: '/dashboard/training', selector: '[data-tour="training-courses"]',
    title: text('training.publicTitle', 'Courses for confident Velliqo owners'),
    description: featureDescription('training', 'Open PDF guides, future videos and the related workspace, then track completion.'),
  },
];

type OwnerProductTourProps = {
  open: boolean;
  businessId?: string | null;
  userId?: string | null;
  onOpenChange: (open: boolean) => void;
};

type TargetRect = {
  top: number;
  left: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
};

const CHAPTERS = Array.from(
  TOUR_STEPS.reduce((map, step, index) => {
    if (!map.has(step.chapter)) map.set(step.chapter, { id: step.chapter, label: step.chapterLabel, firstIndex: index });
    return map;
  }, new Map<string, { id: string; label: LocalizedText; firstIndex: number }>()),
).map(([, value]) => value);

export default function OwnerProductTour({
  open,
  businessId,
  userId,
  onOpenChange,
}: OwnerProductTourProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [targetRect, setTargetRect] = React.useState<TargetRect | null>(null);
  const [loadingProgress, setLoadingProgress] = React.useState(false);
  const actionRunRef = React.useRef<string | null>(null);
  const step = TOUR_STEPS[currentIndex];

  const tr = React.useCallback((value: LocalizedText) => (
    t(value.key, { defaultValue: value.defaultValue })
  ), [t]);

  const persistProgress = React.useCallback(async (patch: {
    current_step?: number;
    completed_at?: string | null;
    skipped_at?: string | null;
  }) => {
    if (!businessId || !userId) return;
    const { error } = await supabase
      .from('owner_tour_progress')
      .upsert({
        user_id: userId,
        business_id: businessId,
        tour_key: TOUR_KEY,
        current_step: patch.current_step ?? currentIndex,
        completed_at: patch.completed_at ?? null,
        skipped_at: patch.skipped_at ?? null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,business_id,tour_key' });

    if (error) console.warn('Unable to save owner tour progress', error);
  }, [businessId, currentIndex, userId]);

  const dismissInteractiveSurface = React.useCallback(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
  }, []);

  const moveTo = React.useCallback((nextIndex: number) => {
    if (step?.opensOverlay) dismissInteractiveSurface();
    actionRunRef.current = null;
    setTargetRect(null);
    setCurrentIndex(Math.min(Math.max(nextIndex, 0), TOUR_STEPS.length - 1));
  }, [dismissInteractiveSurface, step?.opensOverlay]);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const load = async () => {
      if (!businessId || !userId) {
        setCurrentIndex(0);
        return;
      }

      setLoadingProgress(true);
      const { data, error } = await supabase
        .from('owner_tour_progress')
        .select('current_step, completed_at, skipped_at')
        .eq('user_id', userId)
        .eq('business_id', businessId)
        .eq('tour_key', TOUR_KEY)
        .maybeSingle();

      if (cancelled) return;
      if (error) console.warn('Unable to load owner tour progress', error);

      const savedStep = Number(data?.current_step || 0);
      const resumeStep = !data?.completed_at && !data?.skipped_at && savedStep < TOUR_STEPS.length
        ? savedStep
        : 0;
      setCurrentIndex(resumeStep);
      setLoadingProgress(false);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [businessId, open, userId]);

  React.useEffect(() => {
    if (!open || !step || loadingProgress) return;
    if (location.pathname !== step.route) {
      navigate(step.route);
      return;
    }

    let cancelled = false;
    let frame = 0;
    let attempts = 0;

    const findElement = async (selector: string, maxAttempts = 70): Promise<HTMLElement | null> => {
      for (let index = 0; index < maxAttempts && !cancelled; index += 1) {
        const element = document.querySelector(selector) as HTMLElement | null;
        if (element) return element;
        await new Promise<void>((resolve) => {
          frame = window.requestAnimationFrame(() => resolve());
        });
      }
      return null;
    };

    const resolveTarget = async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 240));
      if (cancelled) return;

      if (step.action && actionRunRef.current !== step.key) {
        const actionTarget = await findElement(step.action.selector);
        if (actionTarget && !cancelled) {
          actionTarget.click();
          actionRunRef.current = step.key;
          await new Promise((resolve) => window.setTimeout(resolve, step.action?.waitMs ?? 280));
        }
      }

      const target = await findElement(step.selector);
      if (!target || cancelled) {
        setTargetRect(null);
        return;
      }

      target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: attempts === 0 ? 'smooth' : 'auto' });
      attempts += 1;
      await new Promise((resolve) => window.setTimeout(resolve, 120));
      const rect = target.getBoundingClientRect();
      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        right: rect.right,
        bottom: rect.bottom,
      });
    };

    void resolveTarget();

    const update = () => {
      const target = document.querySelector(step.selector) as HTMLElement | null;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        right: rect.right,
        bottom: rect.bottom,
      });
    };

    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [loadingProgress, location.pathname, navigate, open, step]);

  React.useEffect(() => {
    if (!open || loadingProgress) return;
    void persistProgress({ current_step: currentIndex });
  }, [currentIndex, loadingProgress, open, persistProgress]);

  React.useEffect(() => () => dismissInteractiveSurface(), [dismissInteractiveSurface]);

  if (!open || !step) return null;

  const isLast = currentIndex === TOUR_STEPS.length - 1;
  const progress = ((currentIndex + 1) / TOUR_STEPS.length) * 100;
  const chapterSteps = TOUR_STEPS.filter((item) => item.chapter === step.chapter);
  const chapterPosition = chapterSteps.findIndex((item) => item.key === step.key) + 1;
  const tooltipStyle = getTooltipStyle(targetRect);

  const finish = async () => {
    if (step.opensOverlay) dismissInteractiveSurface();
    await persistProgress({
      current_step: TOUR_STEPS.length - 1,
      completed_at: new Date().toISOString(),
      skipped_at: null,
    });
    onOpenChange(false);
  };

  const skip = async () => {
    if (step.opensOverlay) dismissInteractiveSurface();
    await persistProgress({
      current_step: currentIndex,
      completed_at: null,
      skipped_at: new Date().toISOString(),
    });
    onOpenChange(false);
  };

  return (
    <div className="fixed inset-0 z-[90] hidden lg:block" role="dialog" aria-modal="true" aria-label={t('ownerExperience.tour.title')}>
      {targetRect ? (
        <div
          className="pointer-events-none fixed rounded-2xl border-2 border-violet-300 bg-transparent shadow-[0_0_0_9999px_rgba(7,9,24,.76),0_0_0_6px_rgba(139,92,246,.18),0_20px_70px_rgba(0,0,0,.35)] transition-all duration-300"
          style={{
            top: Math.max(8, targetRect.top - 6),
            left: Math.max(8, targetRect.left - 6),
            width: Math.max(44, targetRect.width + 12),
            height: Math.max(44, targetRect.height + 12),
          }}
        />
      ) : (
        <div className="pointer-events-none fixed inset-0 bg-slate-950/76" />
      )}

      <section
        data-tour="tour-panel"
        className="fixed flex max-h-[min(78vh,720px)] w-[470px] max-w-[calc(100%-2rem)] flex-col overflow-hidden rounded-[1.6rem] border border-violet-200/60 bg-background shadow-[0_28px_90px_rgba(0,0,0,.42)]"
        style={tooltipStyle}
      >
        <div className="relative shrink-0 overflow-hidden bg-[#111027] px-5 py-4 text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,.4),transparent_48%)]" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-violet-200">
                <BookOpenCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-[.18em] text-violet-200">
                  {t('ownerExperience.tour.title')}
                </div>
                <div className="mt-0.5 text-sm font-bold text-white/88">
                  {t('ownerExperience.tour.stepCounter', { current: currentIndex + 1, total: TOUR_STEPS.length })}
                </div>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-xl text-white/70 hover:bg-white/10 hover:text-white"
              onClick={() => void skip()}
              aria-label={t('ownerExperience.tour.close')}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <Progress value={progress} className="relative mt-4 h-1.5 bg-white/12" />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="mb-4 grid gap-2 rounded-2xl border bg-muted/25 p-3 sm:grid-cols-[1fr_auto] sm:items-center">
            <label className="min-w-0 text-xs font-semibold text-muted-foreground">
              <span className="mb-1 block">{t('ownerExperience.tour.jumpTo', { defaultValue: 'Jump to a tour section' })}</span>
              <select
                value={step.chapter}
                onChange={(event) => {
                  const chapter = CHAPTERS.find((item) => item.id === event.target.value);
                  if (chapter) moveTo(chapter.firstIndex);
                }}
                className="h-10 w-full rounded-xl border bg-background px-3 text-sm font-bold text-foreground"
              >
                {CHAPTERS.map((chapter) => (
                  <option key={chapter.id} value={chapter.id}>{tr(chapter.label)}</option>
                ))}
              </select>
            </label>
            <div className="rounded-xl bg-background px-3 py-2 text-center text-xs font-bold text-muted-foreground shadow-sm">
              {t('ownerExperience.tour.chapterProgress', {
                defaultValue: '{{current}} / {{total}} in this section',
                current: chapterPosition,
                total: chapterSteps.length,
              })}
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
              <MousePointerClick className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">
                {tr(step.chapterLabel)}
              </div>
              <h2 className="mt-1 text-xl font-extrabold tracking-tight">{tr(step.title)}</h2>
            </div>
          </div>

          <p className="mt-3 text-sm leading-6 text-muted-foreground">{tr(step.description)}</p>

          {step.details?.length ? (
            <div className="mt-4 rounded-2xl border bg-muted/20 p-4">
              <div className="flex items-center gap-2 text-sm font-extrabold">
                <ListChecks className="h-4 w-4 text-primary" />
                {t('ownerExperience.tour.detailsTitle', { defaultValue: 'Actions and options explained here' })}
              </div>
              <ul className="mt-3 space-y-2">
                {step.details.map((detail) => (
                  <li key={`${step.key}-${detail.key}`} className="flex gap-2 text-xs leading-5 text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    <span>{tr(detail)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {step.action ? (
            <p className="mt-4 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs leading-5 text-violet-950">
              {t('ownerExperience.tour.interactiveNote', {
                defaultValue: 'Velliqo opened this tab or form for demonstration. Nothing is saved unless you deliberately press its Save or Create button.',
              })}
            </p>
          ) : null}

          {!targetRect ? (
            <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
              {t('ownerExperience.tour.targetUnavailable')}
            </p>
          ) : null}
        </div>

        <div className="shrink-0 border-t bg-background p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => moveTo(currentIndex - 1)}
                disabled={currentIndex === 0}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                {t('ownerExperience.tour.back')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  moveTo(0);
                  void persistProgress({ current_step: 0, completed_at: null, skipped_at: null });
                }}
              >
                <RotateCcw className="mr-1 h-3.5 w-3.5" />
                {t('ownerExperience.tour.restart')}
              </Button>
            </div>

            {isLast ? (
              <Button type="button" size="sm" onClick={() => void finish()}>
                {t('ownerExperience.tour.finish')}
              </Button>
            ) : (
              <Button type="button" size="sm" onClick={() => moveTo(currentIndex + 1)}>
                {t('ownerExperience.tour.next')}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </div>

          <button
            type="button"
            className="mt-3 w-full text-center text-xs font-semibold text-muted-foreground hover:text-foreground"
            onClick={() => void skip()}
          >
            {t('ownerExperience.tour.skip')}
          </button>
        </div>
      </section>
    </div>
  );
}

function getTooltipStyle(rect: TargetRect | null): React.CSSProperties {
  const margin = 18;
  const width = 470;
  const estimatedHeight = 620;

  if (!rect) {
    return {
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
    };
  }

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  let left = Math.min(Math.max(margin, rect.left), viewportWidth - width - margin);
  let top = rect.bottom + 18;

  if (top + estimatedHeight > viewportHeight - margin) {
    top = rect.top - estimatedHeight - 18;
  }

  if (top < margin || rect.width > viewportWidth * 0.62 || rect.height > viewportHeight * 0.5) {
    top = Math.max(margin, viewportHeight - Math.min(estimatedHeight, viewportHeight - margin * 2) - margin);
    left = viewportWidth - width - margin;
  }

  return { left: Math.max(margin, left), top: Math.max(margin, top) };
}
