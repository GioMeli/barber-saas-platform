export type DialOption = { country: string; iso: string; dial: string };

// Common international destinations plus a Custom option keep the UI compact while
// still allowing every E.164 destination worldwide. Values are stored as full
// international numbers (+country-code + national significant number).
export const DIAL_OPTIONS: DialOption[] = [
  { country: 'Cyprus', iso: 'CY', dial: '+357' },
  { country: 'Greece', iso: 'GR', dial: '+30' },
  { country: 'Turkey', iso: 'TR', dial: '+90' },
  { country: 'United Kingdom', iso: 'GB', dial: '+44' },
  { country: 'Ireland', iso: 'IE', dial: '+353' },
  { country: 'Germany', iso: 'DE', dial: '+49' },
  { country: 'France', iso: 'FR', dial: '+33' },
  { country: 'Spain', iso: 'ES', dial: '+34' },
  { country: 'Italy', iso: 'IT', dial: '+39' },
  { country: 'Portugal', iso: 'PT', dial: '+351' },
  { country: 'Netherlands', iso: 'NL', dial: '+31' },
  { country: 'Belgium', iso: 'BE', dial: '+32' },
  { country: 'Luxembourg', iso: 'LU', dial: '+352' },
  { country: 'Austria', iso: 'AT', dial: '+43' },
  { country: 'Switzerland', iso: 'CH', dial: '+41' },
  { country: 'Denmark', iso: 'DK', dial: '+45' },
  { country: 'Sweden', iso: 'SE', dial: '+46' },
  { country: 'Norway', iso: 'NO', dial: '+47' },
  { country: 'Finland', iso: 'FI', dial: '+358' },
  { country: 'Iceland', iso: 'IS', dial: '+354' },
  { country: 'Poland', iso: 'PL', dial: '+48' },
  { country: 'Czechia', iso: 'CZ', dial: '+420' },
  { country: 'Slovakia', iso: 'SK', dial: '+421' },
  { country: 'Hungary', iso: 'HU', dial: '+36' },
  { country: 'Romania', iso: 'RO', dial: '+40' },
  { country: 'Bulgaria', iso: 'BG', dial: '+359' },
  { country: 'Croatia', iso: 'HR', dial: '+385' },
  { country: 'Slovenia', iso: 'SI', dial: '+386' },
  { country: 'Serbia', iso: 'RS', dial: '+381' },
  { country: 'Montenegro', iso: 'ME', dial: '+382' },
  { country: 'North Macedonia', iso: 'MK', dial: '+389' },
  { country: 'Albania', iso: 'AL', dial: '+355' },
  { country: 'Bosnia and Herzegovina', iso: 'BA', dial: '+387' },
  { country: 'Malta', iso: 'MT', dial: '+356' },
  { country: 'Estonia', iso: 'EE', dial: '+372' },
  { country: 'Latvia', iso: 'LV', dial: '+371' },
  { country: 'Lithuania', iso: 'LT', dial: '+370' },
  { country: 'Ukraine', iso: 'UA', dial: '+380' },
  { country: 'Moldova', iso: 'MD', dial: '+373' },
  { country: 'Canada / United States', iso: 'US', dial: '+1' },
  { country: 'Mexico', iso: 'MX', dial: '+52' },
  { country: 'Brazil', iso: 'BR', dial: '+55' },
  { country: 'Argentina', iso: 'AR', dial: '+54' },
  { country: 'Chile', iso: 'CL', dial: '+56' },
  { country: 'Colombia', iso: 'CO', dial: '+57' },
  { country: 'Peru', iso: 'PE', dial: '+51' },
  { country: 'Uruguay', iso: 'UY', dial: '+598' },
  { country: 'United Arab Emirates', iso: 'AE', dial: '+971' },
  { country: 'Saudi Arabia', iso: 'SA', dial: '+966' },
  { country: 'Qatar', iso: 'QA', dial: '+974' },
  { country: 'Bahrain', iso: 'BH', dial: '+973' },
  { country: 'Kuwait', iso: 'KW', dial: '+965' },
  { country: 'Israel', iso: 'IL', dial: '+972' },
  { country: 'Jordan', iso: 'JO', dial: '+962' },
  { country: 'Lebanon', iso: 'LB', dial: '+961' },
  { country: 'Egypt', iso: 'EG', dial: '+20' },
  { country: 'South Africa', iso: 'ZA', dial: '+27' },
  { country: 'Nigeria', iso: 'NG', dial: '+234' },
  { country: 'Kenya', iso: 'KE', dial: '+254' },
  { country: 'Morocco', iso: 'MA', dial: '+212' },
  { country: 'India', iso: 'IN', dial: '+91' },
  { country: 'Pakistan', iso: 'PK', dial: '+92' },
  { country: 'Bangladesh', iso: 'BD', dial: '+880' },
  { country: 'Sri Lanka', iso: 'LK', dial: '+94' },
  { country: 'China', iso: 'CN', dial: '+86' },
  { country: 'Hong Kong', iso: 'HK', dial: '+852' },
  { country: 'Japan', iso: 'JP', dial: '+81' },
  { country: 'South Korea', iso: 'KR', dial: '+82' },
  { country: 'Singapore', iso: 'SG', dial: '+65' },
  { country: 'Malaysia', iso: 'MY', dial: '+60' },
  { country: 'Thailand', iso: 'TH', dial: '+66' },
  { country: 'Indonesia', iso: 'ID', dial: '+62' },
  { country: 'Philippines', iso: 'PH', dial: '+63' },
  { country: 'Vietnam', iso: 'VN', dial: '+84' },
  { country: 'Australia', iso: 'AU', dial: '+61' },
  { country: 'New Zealand', iso: 'NZ', dial: '+64' },
].sort((a, b) => a.country.localeCompare(b.country));

const COUNTRY_ALIASES: Record<string, string> = {
  cyprus: 'CY', cy: 'CY', greece: 'GR', gr: 'GR', turkey: 'TR', türkiye: 'TR', tr: 'TR',
  'united kingdom': 'GB', uk: 'GB', gb: 'GB', ireland: 'IE', ie: 'IE', germany: 'DE', de: 'DE',
  france: 'FR', fr: 'FR', spain: 'ES', es: 'ES', italy: 'IT', it: 'IT', portugal: 'PT', pt: 'PT',
  'united states': 'US', usa: 'US', us: 'US', canada: 'US', ca: 'US', australia: 'AU', au: 'AU',
  'united arab emirates': 'AE', uae: 'AE', ae: 'AE', india: 'IN', in: 'IN',
};

export function countryFlag(iso: string) {
  if (!/^[A-Z]{2}$/.test(iso)) return '🌐';
  return String.fromCodePoint(...iso.split('').map((char) => 127397 + char.charCodeAt(0)));
}

export function resolveDefaultDial(country?: string | null) {
  const normalized = String(country || '').trim().toLowerCase();
  const iso = COUNTRY_ALIASES[normalized] || normalized.toUpperCase();
  return DIAL_OPTIONS.find((option) => option.iso === iso)?.dial || '+357';
}

export function normalizeE164(value: string) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const normalized = raw.startsWith('00') ? `+${raw.slice(2)}` : raw;
  const digits = normalized.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
  return digits.startsWith('+') ? `+${digits.slice(1).replace(/\D/g, '')}` : `+${digits.replace(/\D/g, '')}`;
}

export function isLikelyE164(value?: string | null) {
  if (!value) return false;
  return /^\+[1-9]\d{7,14}$/.test(normalizeE164(value));
}

export function splitInternationalPhone(value: string, fallbackDial = '+357') {
  const normalized = normalizeE164(value);
  if (!normalized) return { dial: fallbackDial, national: '' };
  const candidates = Array.from(new Set(DIAL_OPTIONS.map((option) => option.dial))).sort((a, b) => b.length - a.length);
  const matched = candidates.find((dial) => normalized.startsWith(dial));
  if (matched) return { dial: matched, national: normalized.slice(matched.length) };
  return { dial: 'custom', national: normalized.slice(1), customDial: '+' } as const;
}
