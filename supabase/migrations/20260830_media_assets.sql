-- GROVIA video assets
create table if not exists public.grovia_media_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content_id uuid references public.grovia_content_items(id) on delete set null,
  bucket text not null default 'grovia-videos',
  storage_path text not null,
  original_name text not null,
  mime_type text not null default 'video/mp4',
  size_bytes bigint not null default 0,
  status text not null default 'uploaded',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, storage_path)
);

create index if not exists grovia_media_assets_user_idx
  on public.grovia_media_assets(user_id, created_at desc);

create index if not exists grovia_media_assets_content_idx
  on public.grovia_media_assets(content_id);

alter table public.grovia_media_assets enable row level security;

drop policy if exists grovia_media_assets_own on public.grovia_media_assets;
create policy grovia_media_assets_own
on public.grovia_media_assets
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'grovia-videos',
  'grovia-videos',
  false,
  53687091200,
  array['video/mp4','video/webm','video/quicktime','video/x-matroska','video/mpeg','video/ogg']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Users may store files under their own UUID folder only.
drop policy if exists grovia_videos_insert_own on storage.objects;
create policy grovia_videos_insert_own
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'grovia-videos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists grovia_videos_select_own on storage.objects;
create policy grovia_videos_select_own
on storage.objects
for select to authenticated
using (
  bucket_id = 'grovia-videos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists grovia_videos_update_own on storage.objects;
create policy grovia_videos_update_own
on storage.objects
for update to authenticated
using (
  bucket_id = 'grovia-videos'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'grovia-videos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists grovia_videos_delete_own on storage.objects;
create policy grovia_videos_delete_own
on storage.objects
for delete to authenticated
using (
  bucket_id = 'grovia-videos'
  and (storage.foldername(name))[1] = auth.uid()::text
);
