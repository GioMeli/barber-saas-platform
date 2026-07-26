export type IndustryContext = {
  key: string;
  name: string;
  category: string;
  professional: string;
  professionals: string;
};

const GENERIC_CONTEXT: IndustryContext = {
  key: 'appointment_service_business',
  name: 'Appointment-based service business',
  category: 'service_business',
  professional: 'team member',
  professionals: 'team members',
};

const INDUSTRY_CONTEXTS: Record<string, Omit<IndustryContext, 'key'>> = {
  "appointment_service_business": { name: "Service Business", category: "professional_services", professional: "team member", professionals: "team members" },
  "hair_salon": { name: "Hair Salon", category: "beauty_personal_care", professional: "stylist", professionals: "stylists" },
  "barber_shop": { name: "Barber Shop", category: "beauty_personal_care", professional: "barber", professionals: "barbers" },
  "beauty_studio": { name: "Beauty Studio", category: "beauty_personal_care", professional: "beauty professional", professionals: "beauty professionals" },
  "nail_salon": { name: "Nail Salon", category: "beauty_personal_care", professional: "nail technician", professionals: "nail technicians" },
  "spa": { name: "Spa", category: "beauty_personal_care", professional: "therapist", professionals: "therapists" },
  "massage_center": { name: "Massage Center", category: "beauty_personal_care", professional: "massage therapist", professionals: "massage therapists" },
  "wellness_center": { name: "Wellness Center", category: "beauty_personal_care", professional: "wellness professional", professionals: "wellness professionals" },
  "aesthetic_clinic": { name: "Aesthetic Clinic", category: "beauty_personal_care", professional: "practitioner", professionals: "practitioners" },
  "tattoo_studio": { name: "Tattoo Studio", category: "creative_services", professional: "artist", professionals: "artists" },
  "physiotherapy": { name: "Physiotherapy Practice", category: "health_wellness", professional: "physiotherapist", professionals: "physiotherapists" },
  "chiropractic": { name: "Chiropractic Clinic", category: "health_wellness", professional: "chiropractor", professionals: "chiropractors" },
  "nutritionist": { name: "Nutrition Practice", category: "health_wellness", professional: "nutritionist", professionals: "nutritionists" },
  "psychology_practice": { name: "Psychology Practice", category: "health_wellness", professional: "psychologist", professionals: "psychologists" },
  "speech_therapy": { name: "Speech Therapy Practice", category: "health_wellness", professional: "speech therapist", professionals: "speech therapists" },
  "dental_clinic": { name: "Dental Clinic", category: "health_wellness", professional: "dentist", professionals: "dentists" },
  "medical_practice": { name: "Private Medical Practice", category: "health_wellness", professional: "doctor", professionals: "doctors" },
  "personal_training": { name: "Personal Training Studio", category: "fitness", professional: "trainer", professionals: "trainers" },
  "gym_studio": { name: "Gym Studio", category: "fitness", professional: "coach", professionals: "coaches" },
  "pilates_studio": { name: "Pilates Studio", category: "fitness", professional: "instructor", professionals: "instructors" },
  "yoga_studio": { name: "Yoga Studio", category: "fitness", professional: "instructor", professionals: "instructors" },
  "dance_studio": { name: "Dance Studio", category: "fitness", professional: "instructor", professionals: "instructors" },
  "pet_grooming": { name: "Pet Grooming", category: "pet_services", professional: "groomer", professionals: "groomers" },
  "veterinary_clinic": { name: "Veterinary Clinic", category: "pet_services", professional: "veterinarian", professionals: "veterinarians" },
  "dog_training": { name: "Dog Training", category: "pet_services", professional: "trainer", professionals: "trainers" },
  "car_wash": { name: "Car Wash", category: "automotive", professional: "technician", professionals: "technicians" },
  "car_detailing": { name: "Car Detailing", category: "automotive", professional: "detailer", professionals: "detailers" },
  "mechanic": { name: "Mechanic Workshop", category: "automotive", professional: "mechanic", professionals: "mechanics" },
  "tyre_shop": { name: "Tyre Shop", category: "automotive", professional: "technician", professionals: "technicians" },
  "cleaning_company": { name: "Cleaning Company", category: "home_services", professional: "cleaner", professionals: "cleaners" },
  "electrician": { name: "Electrical Services", category: "home_services", professional: "electrician", professionals: "electricians" },
  "plumber": { name: "Plumbing Services", category: "home_services", professional: "plumber", professionals: "plumbers" },
  "hvac": { name: "HVAC Services", category: "home_services", professional: "technician", professionals: "technicians" },
  "pest_control": { name: "Pest Control", category: "home_services", professional: "technician", professionals: "technicians" },
  "law_firm": { name: "Law Firm", category: "professional_services", professional: "lawyer", professionals: "lawyers" },
  "accounting_firm": { name: "Accounting Firm", category: "professional_services", professional: "accountant", professionals: "accountants" },
  "consultancy": { name: "Consultancy", category: "professional_services", professional: "consultant", professionals: "consultants" },
  "financial_advisor": { name: "Financial Advisory", category: "professional_services", professional: "advisor", professionals: "advisors" },
  "real_estate": { name: "Real Estate Office", category: "professional_services", professional: "agent", professionals: "agents" },
  "tutoring": { name: "Tutoring Service", category: "education", professional: "tutor", professionals: "tutors" },
  "language_school": { name: "Language School", category: "education", professional: "teacher", professionals: "teachers" },
  "music_school": { name: "Music School", category: "education", professional: "teacher", professionals: "teachers" },
  "driving_school": { name: "Driving School", category: "education", professional: "instructor", professionals: "instructors" },
  "photography_studio": { name: "Photography Studio", category: "creative_services", professional: "photographer", professionals: "photographers" },
  "videography_studio": { name: "Videography Studio", category: "creative_services", professional: "videographer", professionals: "videographers" },
  "wedding_planner": { name: "Wedding Planner", category: "events", professional: "planner", professionals: "planners" },
  "event_planner": { name: "Event Planner", category: "events", professional: "planner", professionals: "planners" },
  "venue_booking": { name: "Venue Booking", category: "events", professional: "coordinator", professionals: "coordinators" },
};

export function resolveIndustryContext(value: unknown): IndustryContext {
  const key = typeof value === 'string' && value.trim()
    ? value.trim()
    : GENERIC_CONTEXT.key;
  const match = INDUSTRY_CONTEXTS[key];
  return match ? { key, ...match } : { ...GENERIC_CONTEXT, key };
}

export function industryPromptContext(value: unknown): string {
  const context = resolveIndustryContext(value);
  return [
    `Industry: ${context.name} (${context.key})`,
    `Preferred team terminology: ${context.professional} / ${context.professionals}`,
    'Use the actual service names, customer records and staff names supplied by Velliqo.',
    'When the industry is unknown or a term is not supplied, use neutral words: business, owner, team member, customer, service and appointment.',
    'Never assume hair, beauty, salon or barber terminology unless the selected industry explicitly requires it.',
  ].join('\\n');
}
