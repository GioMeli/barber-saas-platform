begin;

alter table public.businesses
  add column if not exists industry_key text;

update public.businesses
set industry_key = 'hair_salon'
where industry_key is null or trim(industry_key) = '';

alter table public.businesses
  alter column industry_key set default 'hair_salon',
  alter column industry_key set not null;

alter table public.businesses
  drop constraint if exists businesses_industry_key_check;

alter table public.businesses
  add constraint businesses_industry_key_check
  check (industry_key in (
    'hair_salon',
    'barber_shop',
    'beauty_studio',
    'nail_salon',
    'spa',
    'massage_center',
    'wellness_center',
    'aesthetic_clinic',
    'tattoo_studio',
    'pet_grooming',
    'personal_training'
  ));

create index if not exists businesses_industry_key_idx
  on public.businesses (industry_key);

comment on column public.businesses.industry_key is
  'Controls industry-specific defaults, labels and visual theme. Core business logic remains shared.';

commit;
