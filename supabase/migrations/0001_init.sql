-- Roomwise initial schema. Every table is protected by Row Level Security:
-- users can only ever see and change their own rows.

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Rooms ------------------------------------------------------------------
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  -- Path inside the private "room-photos" storage bucket: <user_id>/<file>.jpg
  photo_path text,
  -- Optional user-supplied dimensions that override the model's estimate.
  width_cm integer check (width_cm between 150 and 2000),
  depth_cm integer check (depth_cm between 150 and 2000),
  analysis_json jsonb,
  analysis_confidence real check (analysis_confidence between 0 and 1),
  analyzed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index rooms_user_id_idx on public.rooms (user_id, created_at desc);
create trigger rooms_set_updated_at before update on public.rooms
  for each row execute function public.set_updated_at();

-- Arrangements -----------------------------------------------------------
create table public.arrangements (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  mode text not null check (mode in ('ergonomic', 'feng_shui')),
  layout_json jsonb not null,
  moves_json jsonb not null default '[]'::jsonb,
  score_before real not null,
  score_after real not null,
  created_at timestamptz not null default now()
);
create index arrangements_room_id_idx on public.arrangements (room_id, created_at desc);
create index arrangements_user_id_idx on public.arrangements (user_id);

-- Preferences ------------------------------------------------------------
create table public.preferences (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  default_mode text not null default 'ergonomic' check (default_mode in ('ergonomic', 'feng_shui')),
  units text not null default 'metric' check (units in ('metric', 'imperial')),
  updated_at timestamptz not null default now()
);
create trigger preferences_set_updated_at before update on public.preferences
  for each row execute function public.set_updated_at();

-- Row Level Security -------------------------------------------------------
alter table public.rooms enable row level security;
alter table public.arrangements enable row level security;
alter table public.preferences enable row level security;

create policy "rooms: owner full access" on public.rooms
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "arrangements: owner full access" on public.arrangements
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.rooms r where r.id = room_id and r.user_id = auth.uid())
  );

create policy "preferences: owner full access" on public.preferences
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Storage: private bucket, each user may only touch files under their own folder -----
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('room-photos', 'room-photos', false, 8388608, array['image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "room-photos: owner read" on storage.objects
  for select to authenticated
  using (bucket_id = 'room-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "room-photos: owner insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'room-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "room-photos: owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'room-photos' and (storage.foldername(name))[1] = auth.uid()::text);
