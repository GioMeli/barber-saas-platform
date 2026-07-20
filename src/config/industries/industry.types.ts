export type IndustryKey =
  | 'hair_salon'
  | 'barber_shop'
  | 'beauty_studio'
  | 'nail_salon'
  | 'spa'
  | 'massage_center'
  | 'wellness_center'
  | 'aesthetic_clinic'
  | 'tattoo_studio'
  | 'pet_grooming'
  | 'personal_training';

export type IndustryServiceTemplate = {
  name: string;
  category: string;
  price: number;
  duration: number;
};

export type IndustryPalette = {
  primary: string;
  primaryForeground: string;
  accent: string;
  accentForeground: string;
  ring: string;
  sidebarBackground: string;
  sidebarForeground: string;
  sidebarPrimary: string;
  sidebarPrimaryForeground: string;
  sidebarAccent: string;
  sidebarAccentForeground: string;
  sidebarBorder: string;
};

export type IndustryLabels = {
  singular: string;
  plural: string;
  professional: string;
  professionals: string;
  bookingCta: string;
  storefrontTagline: string;
  serviceSectionDescription: string;
  teamSectionTitle: string;
};

export type IndustryConfig = {
  key: IndustryKey;
  name: string;
  shortName: string;
  description: string;
  icon: string;
  launchEnabled: boolean;
  defaultCategory: string;
  defaultServices: IndustryServiceTemplate[];
  palette: IndustryPalette;
  labels: IndustryLabels;
};
