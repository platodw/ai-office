-- Add branding fields to clients and provision storage bucket for logos.

alter table clients
  add column if not exists logo_url    text,
  add column if not exists brand_color text,   -- hex string e.g. "#3B82F6"
  add column if not exists website     text,
  add column if not exists industry    text;

-- Storage bucket for client logos (public read, admin write).
insert into storage.buckets (id, name, public)
  values ('client-logos', 'client-logos', true)
  on conflict (id) do nothing;

create policy "client_logos_admin_insert" on storage.objects
  for insert with check (
    bucket_id = 'client-logos' and is_admin()
  );

create policy "client_logos_public_read" on storage.objects
  for select using (bucket_id = 'client-logos');

create policy "client_logos_admin_delete" on storage.objects
  for delete using (
    bucket_id = 'client-logos' and is_admin()
  );
