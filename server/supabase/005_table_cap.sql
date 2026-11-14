-- server/supabase/005_table_cap.sql — AT MOST 5 OPEN TABLES PER PLAYER (SERVER S4.4). Run after 001..004; safe to run twice.
--
-- RULING (user, 2026-11-14): "cap 5 open tables per player". A signed-in player may hold at most 5 OPEN tables they CREATED.
--
-- WHAT THE ROWS RECORD, AND SO WHAT "OPEN" MEANS. The function (server/referee.js) writes two facts into the stored row of a table a
-- signed-in player creates, both inside the one jsonb `row` that table_put already versions:
--     row->>'creator'   OUR player id of whoever created the table (never set on a casual table: those are not counted, not capped)
--     row->>'over'      'true' once the game is finished (the referee sees the session end) or the creator closed the table
-- A table is OPEN, for its creator, when ALL of:
--     1. row->>'creator' is that player;
--     2. row->>'over' is not 'true'  (a finished or closed table does not count);
--     3. updated_at is within the last 48 hours  (a table idle for 48 hours is forgotten by table_put and by this function;
--        the date test also makes the count right BEFORE the next create sweeps the row away).
-- Joining someone else's table never counts: only the creator field does. Casual tables have no creator and are never counted.
--
-- THE RACE. table_create_capped does the whole decision in ONE transaction under a per-player advisory lock
-- (pg_advisory_xact_lock on a hash of the player id): two simultaneous creates by one player queue up, the second one's count
-- runs after the first one's insert committed (READ COMMITTED takes a new snapshot per statement): at 4 open exactly one of the
-- two gets the fifth and the other is refused. Different players take different locks and never wait on each other.
-- Nothing here is readable or callable with the publishable key: RLS stays forced with zero policies (001), the function is
-- granted to service_role only. table_put (001) is untouched: it still writes every update, and casual creates still use it.

create index if not exists tables_creator_idx on public.tables ((row->>'creator')) where (row->>'creator') is not null;

-- table_create_capped(id, row, creator, cap) -> jsonb, one of
--   {"version": 1}                                  created (the new version)
--   {"version": 0, "exists": true}                  that id is taken (the caller picks another)
--   {"version": 0, "capped": true, "open": [ids]}   the creator already holds `cap` open tables (their codes, oldest first, at most 10)
create or replace function public.table_create_capped(p_id text, p_row jsonb, p_creator text, p_cap integer)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare v integer; open_ids text[];
begin
  if p_creator is null or p_creator = '' or p_cap is null or p_cap < 1 then raise exception 'table_create_capped needs a creator and a cap of at least 1'; end if;
  if p_row->>'creator' is distinct from p_creator then raise exception 'the row does not name the creator it is created for'; end if;
  perform pg_advisory_xact_lock(hashtextextended('dawnblade-open-tables|' || p_creator, 0));
  -- the same forgetting table_put does when a table is opened
  delete from public.tables where updated_at < now() - interval '48 hours';
  if exists (select 1 from public.tables where id = p_id) then return jsonb_build_object('version', 0, 'exists', true); end if;
  select coalesce(array_agg(id order by created_at, id), '{}') into open_ids
    from public.tables
   where row->>'creator' = p_creator and coalesce(row->>'over', '') <> 'true' and updated_at >= now() - interval '48 hours';
  if cardinality(open_ids) >= p_cap then
    return jsonb_build_object('version', 0, 'capped', true, 'open', to_jsonb(open_ids[1:10]));
  end if;
  insert into public.tables (id, row) values (p_id, p_row) on conflict (id) do nothing returning version into v;
  if v is null then return jsonb_build_object('version', 0, 'exists', true); end if;
  return jsonb_build_object('version', v);
end;
$$;

revoke all on function public.table_create_capped(text, jsonb, text, integer) from public, anon, authenticated;
grant execute on function public.table_create_capped(text, jsonb, text, integer) to service_role;
notify pgrst, 'reload schema';

-- ---- self-check (leaves nothing behind) ----
do $$
declare r jsonb; i int; c text := 'zz-capcheck-a'; d text := 'zz-capcheck-b'; e text := 'zz-capcheck-c';
begin
  delete from public.tables where id like 'zz-cap-%';
  -- the lock is the race story: a serial check cannot race, so it at least proves the decision runs under the per-player lock
  if position('pg_advisory_xact_lock' in (select prosrc from pg_proc where oid = 'public.table_create_capped(text,jsonb,text,integer)'::regprocedure)) = 0 then
    raise exception 'table_create_capped does not take the per-player lock'; end if;
  for i in 1..5 loop
    r := public.table_create_capped('zz-cap-a' || i, jsonb_build_object('v', 3, 'creator', c), c, 5);
    if r <> jsonb_build_object('version', 1) then raise exception 'open table % of 5 was not created: %', i, r; end if;
  end loop;
  r := public.table_create_capped('zz-cap-a6', jsonb_build_object('v', 3, 'creator', c), c, 5);
  if (r->>'capped') is distinct from 'true' or jsonb_array_length(r->'open') <> 5 or r->'open'->>0 <> 'zz-cap-a1' then raise exception 'the sixth open table was not refused with the five codes: %', r; end if;
  if exists (select 1 from public.tables where id = 'zz-cap-a6') then raise exception 'a refused table was stored'; end if;
  -- another player is not touched by this player's tables
  r := public.table_create_capped('zz-cap-b1', jsonb_build_object('v', 3, 'creator', d), d, 5);
  if r <> jsonb_build_object('version', 1) then raise exception 'another player was held to this player''s count: %', r; end if;
  -- casual tables (no creator) and a join never count: a casual table is not this player's, whatever is in it
  perform public.table_put('zz-cap-casual', '{"v":2}'::jsonb, 0);
  perform public.table_put('zz-cap-joined', jsonb_build_object('v', 3, 'owners', jsonb_build_array(c, null)), 0);
  r := public.table_create_capped('zz-cap-a6', jsonb_build_object('v', 3, 'creator', c), c, 5);
  if (r->>'capped') is distinct from 'true' then raise exception 'a casual or a joined table changed the count: %', r; end if;
  -- a FINISHED table stops counting (table_put writes the row the referee marked over), and a closed one too
  if public.table_put('zz-cap-a1', jsonb_build_object('v', 3, 'creator', c, 'over', true), 1) <> 2 then raise exception 'the finished row was not stored'; end if;
  r := public.table_create_capped('zz-cap-a6', jsonb_build_object('v', 3, 'creator', c), c, 5);
  if r <> jsonb_build_object('version', 1) then raise exception 'a finished table still counted: %', r; end if;
  r := public.table_create_capped('zz-cap-a7', jsonb_build_object('v', 3, 'creator', c), c, 5);
  if (r->>'capped') is distinct from 'true' then raise exception 'the count did not return to five: %', r; end if;
  -- a code that is taken is answered `exists` first, even for a player at the cap (the caller then picks a fresh code and meets the cap on the next try)
  r := public.table_create_capped('zz-cap-a2', jsonb_build_object('v', 3, 'creator', c), c, 5);
  if (r->>'exists') is distinct from 'true' then raise exception 'a taken code was not reported for a player at the cap: %', r; end if;
  -- an update that does not finish the game keeps it open
  if public.table_put('zz-cap-a2', jsonb_build_object('v', 3, 'creator', c, 'over', false), 1) <> 2 then raise exception 'the open row was not stored'; end if;
  r := public.table_create_capped('zz-cap-a7', jsonb_build_object('v', 3, 'creator', c), c, 5);
  if (r->>'capped') is distinct from 'true' then raise exception 'a table that is not over stopped counting: %', r; end if;
  -- idle for 3 days: forgotten, not counted
  update public.tables set updated_at = now() - interval '3 days' where id = 'zz-cap-a3';
  r := public.table_create_capped('zz-cap-a7', jsonb_build_object('v', 3, 'creator', c), c, 5);
  if r <> jsonb_build_object('version', 1) then raise exception 'a table idle for 3 days still counted: %', r; end if;
  if exists (select 1 from public.tables where id = 'zz-cap-a3') then raise exception 'a table idle for 3 days was not forgotten'; end if;
  -- 47 hours idle still counts; 49 hours idle is forgotten (a third player, cap 1, so the other rows cannot mask it)
  r := public.table_create_capped('zz-cap-e1', jsonb_build_object('v', 3, 'creator', e), e, 1);
  if r <> jsonb_build_object('version', 1) then raise exception 'the first table of a third player was not created: %', r; end if;
  update public.tables set updated_at = now() - interval '47 hours' where id = 'zz-cap-e1';
  r := public.table_create_capped('zz-cap-e2', jsonb_build_object('v', 3, 'creator', e), e, 1);
  if (r->>'capped') is distinct from 'true' then raise exception 'a table idle for 47 hours stopped counting: %', r; end if;
  update public.tables set updated_at = now() - interval '49 hours' where id = 'zz-cap-e1';
  r := public.table_create_capped('zz-cap-e2', jsonb_build_object('v', 3, 'creator', e), e, 1);
  if r <> jsonb_build_object('version', 1) then raise exception 'a table idle for 49 hours still counted: %', r; end if;
  -- a code that is taken is `exists`, not a count
  r := public.table_create_capped('zz-cap-b1', jsonb_build_object('v', 3, 'creator', d), d, 5);
  if (r->>'exists') is distinct from 'true' then raise exception 'a taken code was not reported: %', r; end if;
  -- the row must name its creator
  begin
    perform public.table_create_capped('zz-cap-x', jsonb_build_object('v', 3, 'creator', d), c, 5);
    raise exception 'a row naming another creator was accepted';
  exception when raise_exception then
    if sqlerrm like 'a row naming another creator%' then raise; end if;
  end;
  if has_function_privilege('anon', 'public.table_create_capped(text,jsonb,text,integer)', 'execute') then raise exception 'anon may call table_create_capped'; end if;
  if has_function_privilege('authenticated', 'public.table_create_capped(text,jsonb,text,integer)', 'execute') then raise exception 'authenticated may call table_create_capped'; end if;
  if not has_function_privilege('service_role', 'public.table_create_capped(text,jsonb,text,integer)', 'execute') then raise exception 'service_role may not call table_create_capped'; end if;
  delete from public.tables where id like 'zz-cap-%';
end $$;
select 'ok' as dawnblade_table_cap;
