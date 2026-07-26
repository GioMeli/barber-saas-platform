begin;

-- A missing or unknown industry must never inherit a beauty-sector identity.
-- Existing businesses keep their selected industry. Only future fallback rows
-- use the neutral appointment/service-business key.
alter table public.businesses
  alter column industry_key set default 'appointment_service_business';

alter table public.businesses
  drop constraint if exists businesses_industry_key_check;

alter table public.businesses
  add constraint businesses_industry_key_check
  check (industry_key in (
    'appointment_service_business',
    'hair_salon',
    'barber_shop',
    'beauty_studio',
    'nail_salon',
    'spa',
    'massage_center',
    'wellness_center',
    'aesthetic_clinic',
    'tattoo_studio',
    'physiotherapy',
    'chiropractic',
    'nutritionist',
    'psychology_practice',
    'speech_therapy',
    'dental_clinic',
    'medical_practice',
    'personal_training',
    'gym_studio',
    'pilates_studio',
    'yoga_studio',
    'dance_studio',
    'pet_grooming',
    'veterinary_clinic',
    'dog_training',
    'car_wash',
    'car_detailing',
    'mechanic',
    'tyre_shop',
    'cleaning_company',
    'electrician',
    'plumber',
    'hvac',
    'pest_control',
    'law_firm',
    'accounting_firm',
    'consultancy',
    'financial_advisor',
    'real_estate',
    'tutoring',
    'language_school',
    'music_school',
    'driving_school',
    'photography_studio',
    'videography_studio',
    'wedding_planner',
    'event_planner',
    'venue_booking'
  ));

comment on column public.businesses.industry_key is
  'Required tenant industry context. Unknown fallbacks use appointment_service_business; industry-specific terminology must be resolved dynamically.';

commit;
