-- Several photos per room: photo_path stays the main photo, extra_photo_paths holds up to three more
-- (all in the private "room-photos" bucket, under the owner's folder).
alter table public.rooms
  add column if not exists extra_photo_paths text[] not null default '{}'
  check (cardinality(extra_photo_paths) <= 3);
