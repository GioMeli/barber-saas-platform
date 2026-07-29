export type DemoScenario = {
  key: 'wellness' | 'pet' | 'automotive';
  businessName: string;
  industry: string;
  currency: string;
  appointments: Array<{ time: string; customer: string; service: string; professional: string; status: 'confirmed' | 'completed' }>;
  customers: Array<{ name: string; lastVisit: string; visits: number; value: number }>;
  services: Array<{ name: string; duration: number; price: number }>;
  metrics: { appointments: number; revenue: number; customers: number; utilisation: number };
  aiPrompt: string;
  aiResponse: string;
};

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    key: 'wellness',
    businessName: 'Northwell Physiotherapy',
    industry: 'Physiotherapy clinic',
    currency: '€',
    appointments: [
      { time: '09:00', customer: 'Elena P.', service: 'Follow-up session', professional: 'Dr. Maya', status: 'completed' },
      { time: '10:30', customer: 'Andreas K.', service: 'Initial assessment', professional: 'Dr. Maya', status: 'confirmed' },
      { time: '12:00', customer: 'Sofia M.', service: 'Rehabilitation session', professional: 'Nikos', status: 'confirmed' },
      { time: '15:30', customer: 'Daniel R.', service: 'Sports recovery', professional: 'Nikos', status: 'confirmed' },
    ],
    customers: [
      { name: 'Elena P.', lastVisit: 'Today', visits: 8, value: 420 },
      { name: 'Andreas K.', lastVisit: 'Today', visits: 1, value: 65 },
      { name: 'Sofia M.', lastVisit: '12 Jul', visits: 5, value: 310 },
    ],
    services: [
      { name: 'Initial assessment', duration: 60, price: 65 },
      { name: 'Follow-up session', duration: 45, price: 50 },
      { name: 'Sports recovery', duration: 45, price: 55 },
    ],
    metrics: { appointments: 12, revenue: 610, customers: 4, utilisation: 78 },
    aiPrompt: 'Find the best way to fill tomorrow afternoon without overloading the team.',
    aiResponse: 'Tomorrow has two 45-minute openings. I can prepare a reactivation campaign draft for customers who usually book recovery sessions. Review the audience and message before anything is sent.',
  },
  {
    key: 'pet',
    businessName: 'Paws & Polish',
    industry: 'Pet grooming studio',
    currency: '€',
    appointments: [
      { time: '08:30', customer: 'Milo / Anna', service: 'Full groom', professional: 'Emma', status: 'completed' },
      { time: '10:00', customer: 'Luna / Chris', service: 'Wash & dry', professional: 'Emma', status: 'confirmed' },
      { time: '12:30', customer: 'Rocky / Maria', service: 'Nail care', professional: 'Leo', status: 'confirmed' },
      { time: '14:00', customer: 'Bella / Theo', service: 'Full groom', professional: 'Leo', status: 'confirmed' },
    ],
    customers: [
      { name: 'Milo / Anna', lastVisit: 'Today', visits: 11, value: 580 },
      { name: 'Luna / Chris', lastVisit: 'Today', visits: 4, value: 180 },
      { name: 'Rocky / Maria', lastVisit: '3 Jul', visits: 7, value: 265 },
    ],
    services: [
      { name: 'Full groom', duration: 90, price: 55 },
      { name: 'Wash & dry', duration: 45, price: 30 },
      { name: 'Nail care', duration: 20, price: 15 },
    ],
    metrics: { appointments: 10, revenue: 425, customers: 3, utilisation: 82 },
    aiPrompt: 'Which customers are due for another grooming appointment?',
    aiResponse: 'Seven regular customers are outside their normal booking cycle. I can create a reviewable audience and a friendly reminder draft. No message will be sent without confirmation.',
  },
  {
    key: 'automotive',
    businessName: 'Apex Auto Detail',
    industry: 'Car detailing business',
    currency: '€',
    appointments: [
      { time: '08:00', customer: 'BMW 320 / Mark', service: 'Interior detail', professional: 'Alex', status: 'completed' },
      { time: '10:30', customer: 'Tesla Model 3 / Irene', service: 'Premium detail', professional: 'Alex', status: 'confirmed' },
      { time: '13:00', customer: 'Toyota Yaris / John', service: 'Exterior care', professional: 'Sam', status: 'confirmed' },
      { time: '15:00', customer: 'Audi Q3 / Eva', service: 'Ceramic inspection', professional: 'Sam', status: 'confirmed' },
    ],
    customers: [
      { name: 'BMW 320 / Mark', lastVisit: 'Today', visits: 3, value: 360 },
      { name: 'Tesla Model 3 / Irene', lastVisit: 'Today', visits: 2, value: 310 },
      { name: 'Audi Q3 / Eva', lastVisit: '18 Jun', visits: 4, value: 520 },
    ],
    services: [
      { name: 'Premium detail', duration: 150, price: 160 },
      { name: 'Interior detail', duration: 120, price: 120 },
      { name: 'Exterior care', duration: 75, price: 75 },
    ],
    metrics: { appointments: 7, revenue: 780, customers: 4, utilisation: 74 },
    aiPrompt: 'Show me the low-stock products that could affect this week.',
    aiResponse: 'Two products are below their configured thresholds: ceramic coating and interior cleaner. I can prepare a restock task with suggested quantities. No supplier order will be placed automatically.',
  },
];
