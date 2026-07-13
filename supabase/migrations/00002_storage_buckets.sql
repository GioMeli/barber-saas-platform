-- Create storage buckets for the app
insert into storage.buckets (id, name, public) values ('logos', 'logos', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('covers', 'covers', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('products', 'products', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('services', 'services', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false) on conflict (id) do nothing;

-- Set up security policies for storage buckets
create policy "Public Access to logos" on storage.objects for select using (bucket_id = 'logos');
create policy "Public Access to covers" on storage.objects for select using (bucket_id = 'covers');
create policy "Public Access to avatars" on storage.objects for select using (bucket_id = 'avatars');
create policy "Public Access to products" on storage.objects for select using (bucket_id = 'products');
create policy "Public Access to services" on storage.objects for select using (bucket_id = 'services');

-- Authenticated users can upload to buckets
create policy "Authenticated users can upload logos" on storage.objects for insert with check (bucket_id = 'logos' and auth.role() = 'authenticated');
create policy "Authenticated users can upload covers" on storage.objects for insert with check (bucket_id = 'covers' and auth.role() = 'authenticated');
create policy "Authenticated users can upload avatars" on storage.objects for insert with check (bucket_id = 'avatars' and auth.role() = 'authenticated');
create policy "Authenticated users can upload products" on storage.objects for insert with check (bucket_id = 'products' and auth.role() = 'authenticated');
create policy "Authenticated users can upload services" on storage.objects for insert with check (bucket_id = 'services' and auth.role() = 'authenticated');
create policy "Authenticated users can upload receipts" on storage.objects for insert with check (bucket_id = 'receipts' and auth.role() = 'authenticated');

-- Authenticated users can read their own receipts
create policy "Authenticated users can read own receipts" on storage.objects for select using (bucket_id = 'receipts' and auth.role() = 'authenticated');

-- Authenticated users can update/delete their own uploads
create policy "Authenticated users can update own uploads" on storage.objects for update using (auth.uid() = owner);
create policy "Authenticated users can delete own uploads" on storage.objects for delete using (auth.uid() = owner);
