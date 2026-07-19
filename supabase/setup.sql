-- KiliPeak Media database
-- Run this in the SAME Supabase project used by the public KiliPeak website.

create table if not exists public.site_media (
  key text primary key,
  area text not null,
  label text not null,
  media_type text not null check (media_type in ('image', 'video')),
  media_url text,
  storage_path text,
  original_url text,
  original_name text,
  is_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.site_media enable row level security;

drop policy if exists "Public can read active site media"
on public.site_media;

create policy "Public can read active site media"
on public.site_media
for select
to anon, authenticated
using (true);

grant select on public.site_media to anon, authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'kilipeak-media',
  'kilipeak-media',
  true,
  52428800,
  array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/avif',
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
