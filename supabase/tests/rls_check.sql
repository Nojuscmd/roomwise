-- RLS check: proves one user cannot read or change another user's data.
-- Run in Supabase -> SQL Editor. Needs at least 2 accounts in Authentication -> Users.
-- It creates one temporary room for the oldest account and deletes it again at the end.
-- Every line of the result should say PASS.

do $$
declare
  a uuid;
  b uuid;
  room_a uuid;
  n int;
  res text := '';
begin
  select id into a from auth.users order by created_at limit 1;
  select id into b from auth.users order by created_at offset 1 limit 1;
  if b is null then
    perform set_config('rls.result', 'Need two accounts: sign up a second user in the app first.', false);
    return;
  end if;

  -- Act as user A: create a room and read it back.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.rooms (name) values ('RLS test room') returning id into room_a;
  select count(*) into n from public.rooms where id = room_a;
  res := res || case when n = 1 then 'PASS' else 'FAIL' end || ' - A can read own room' || E'\n';

  -- Act as user B: try everything against A's room.
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into n from public.rooms where id = room_a;
  res := res || case when n = 0 then 'PASS' else 'FAIL' end || ' - B cannot read A''s room' || E'\n';

  update public.rooms set name = 'hacked' where id = room_a;
  get diagnostics n = row_count;
  res := res || case when n = 0 then 'PASS' else 'FAIL' end || ' - B cannot update A''s room' || E'\n';

  delete from public.rooms where id = room_a;
  get diagnostics n = row_count;
  res := res || case when n = 0 then 'PASS' else 'FAIL' end || ' - B cannot delete A''s room' || E'\n';

  begin
    insert into public.rooms (user_id, name) values (a, 'forged');
    res := res || 'FAIL - B could insert a room as A' || E'\n';
  exception when others then
    res := res || 'PASS - B cannot insert a room as A' || E'\n';
  end;

  begin
    insert into public.arrangements (room_id, mode, layout_json, score_before, score_after)
    values (room_a, 'ergonomic', '{}'::jsonb, 0, 0);
    res := res || 'FAIL - B could attach an arrangement to A''s room' || E'\n';
  exception when others then
    res := res || 'PASS - B cannot attach an arrangement to A''s room' || E'\n';
  end;

  select count(*) into n from public.rooms where user_id <> b;
  res := res || case when n = 0 then 'PASS' else 'FAIL' end || ' - B sees no rooms of others' || E'\n';
  select count(*) into n from public.arrangements where user_id <> b;
  res := res || case when n = 0 then 'PASS' else 'FAIL' end || ' - B sees no arrangements of others' || E'\n';
  select count(*) into n from public.preferences where user_id <> b;
  res := res || case when n = 0 then 'PASS' else 'FAIL' end || ' - B sees no preferences of others' || E'\n';
  select count(*) into n from storage.objects
    where bucket_id = 'room-photos' and (storage.foldername(name))[1] <> b::text;
  res := res || case when n = 0 then 'PASS' else 'FAIL' end || ' - B sees no photos of others' || E'\n';

  -- Clean up as the admin role.
  reset role;
  delete from public.rooms where id = room_a;

  perform set_config('rls.result', res, false);
end $$;

select current_setting('rls.result') as result;
