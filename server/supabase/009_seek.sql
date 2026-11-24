-- server/supabase/009_seek.sql — FIND A MATCH: THE QUEUE OF PLAYERS LOOKING FOR AN OPPONENT (SERVER S6.1). Run after 001..008; safe to run twice.
--
-- A player taps "Find a match". The function (server/referee.js op "seek") asks seek_step:
--   * somebody else is already waiting (same kind: friendly or ranked)  -> MATCHED: their seek is marked taken, the caller is handed THEIR table
--     code and sits down at it as the second player;
--   * nobody is waiting                                                 -> the caller waits at a table of their own (the function opens it and
--     passes its code in p_table); the next seeker is matched to it.
-- A waiting phone asks again every ~20 s (the heartbeat; `seen_at`). A seek not seen for p_ttl seconds is forgotten, taken or not: a phone that
-- closed the screen stops being matched within a minute. A taken seek answers 'taken' to its owner's heartbeat (someone is on their way to that
-- table: keep waiting there), until it ages out.
--
-- THE RACE. Every call takes ONE global advisory lock (pg_advisory_xact_lock on a fixed key): the queue is small and each step is a few index
-- reads, so serialising the whole queue is cheaper than reasoning about two seekers taking each other. Two simultaneous first seekers can both
-- end up waiting (each found the queue empty before the other's insert): the next heartbeat of either matches them (seek_step always looks for
-- another waiting seek BEFORE it refreshes the caller's own).
--
-- ORDER: the oldest waiting seek first (created_at, then player id: a total order). No rating window yet: the queue is short.
-- Nothing here is readable or callable with the publishable key: RLS on and forced with zero policies, every grant revoked, the functions
-- EXECUTE-able by service_role alone (as 001..008).

create table if not exists public.seeks (
  player_id  text primary key references public.players (id) on delete cascade,
  table_id   text not null check (table_id ~ '^[A-Za-z0-9_-]{1,32}$'),
  ranked     boolean not null default false,
  created_at timestamptz not null default now(),
  seen_at    timestamptz not null default now(),
  taken_at   timestamptz
);
create index if not exists seeks_queue_idx on public.seeks (ranked, created_at, player_id) where taken_at is null;

alter table public.seeks enable row level security;
alter table public.seeks force row level security;
revoke all on public.seeks from anon, authenticated;
grant all on public.seeks to service_role;

-- seek_step(player, ranked, table, ttl) -> jsonb {"state": "matched"|"waiting"|"taken"|"none", "table"?: code, "drop"?: code}
--   matched  `table` is ANOTHER player's waiting table (now marked taken); `drop` is a table the caller held for its own seek, if any (the
--            function closes it: nobody was ever matched to it)
--   waiting  `table` is the caller's own table, refreshed (or inserted from p_table)
--   taken    the caller's own seek was taken: someone is sitting down at `table`
--   none     nobody waiting and no p_table given: the function opens a table and calls again with it
--   `drop` also names the caller's old table when they switch kind (friendly <-> ranked).
create or replace function public.seek_step(p_player text, p_ranked boolean, p_table text, p_ttl integer)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare mine public.seeks%rowtype; other public.seeks%rowtype; has_mine boolean; dropped text := null;
begin
  if p_player is null or p_player = '' or p_ranked is null or p_ttl is null or p_ttl < 5 or p_ttl > 3600 then raise exception 'seek_step needs a player, a kind and a ttl of 5..3600 s'; end if;
  if p_table is not null and p_table !~ '^[A-Za-z0-9_-]{1,32}$' then raise exception 'seek_step: a table code is 1..32 of A-Za-z0-9_-'; end if;
  perform pg_advisory_xact_lock(hashtextextended('dawnblade-seek', 0));
  delete from public.seeks where seen_at < now() - make_interval(secs => p_ttl);
  select * into mine from public.seeks where player_id = p_player;
  has_mine := found;
  if has_mine and mine.taken_at is not null then
    if mine.table_id is distinct from p_table and p_table is not null then dropped := p_table; end if;
    return jsonb_build_object('state', 'taken', 'table', mine.table_id) || case when dropped is null then '{}'::jsonb else jsonb_build_object('drop', dropped) end;
  end if;
  if has_mine and mine.ranked <> p_ranked then
    delete from public.seeks where player_id = p_player;
    dropped := mine.table_id; has_mine := false;
  end if;
  select * into other from public.seeks
   where player_id <> p_player and ranked = p_ranked and taken_at is null
   order by created_at, player_id collate "C" limit 1;
  if found then
    update public.seeks set taken_at = now(), seen_at = now() where player_id = other.player_id;
    if has_mine then delete from public.seeks where player_id = p_player; dropped := mine.table_id; end if;
    if dropped is null and p_table is not null then dropped := p_table; end if;
    return jsonb_build_object('state', 'matched', 'table', other.table_id) || case when dropped is null then '{}'::jsonb else jsonb_build_object('drop', dropped) end;
  end if;
  if has_mine then
    update public.seeks set seen_at = now() where player_id = p_player;
    if p_table is not null and p_table <> mine.table_id then dropped := coalesce(dropped, p_table); end if;
    return jsonb_build_object('state', 'waiting', 'table', mine.table_id) || case when dropped is null then '{}'::jsonb else jsonb_build_object('drop', dropped) end;
  end if;
  if p_table is not null then
    insert into public.seeks (player_id, table_id, ranked) values (p_player, p_table, p_ranked);
    return jsonb_build_object('state', 'waiting', 'table', p_table) || case when dropped is null then '{}'::jsonb else jsonb_build_object('drop', dropped) end;
  end if;
  return jsonb_build_object('state', 'none') || case when dropped is null then '{}'::jsonb else jsonb_build_object('drop', dropped) end;
end;
$$;

-- seek_cancel(player, ttl) -> jsonb {"state": "cancelled"|"taken"|"none", "table"?: code}
--   cancelled  the caller's waiting seek is gone; `table` is the table it held (the function closes it)
--   taken      too late: someone was matched to `table` (the phone should go and sit there); the seek is left to age out
--   none       the caller had no live seek
create or replace function public.seek_cancel(p_player text, p_ttl integer)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare mine public.seeks%rowtype;
begin
  if p_player is null or p_player = '' or p_ttl is null or p_ttl < 5 or p_ttl > 3600 then raise exception 'seek_cancel needs a player and a ttl of 5..3600 s'; end if;
  perform pg_advisory_xact_lock(hashtextextended('dawnblade-seek', 0));
  delete from public.seeks where seen_at < now() - make_interval(secs => p_ttl);
  select * into mine from public.seeks where player_id = p_player;
  if not found then return jsonb_build_object('state', 'none'); end if;
  if mine.taken_at is not null then return jsonb_build_object('state', 'taken', 'table', mine.table_id); end if;
  delete from public.seeks where player_id = p_player;
  return jsonb_build_object('state', 'cancelled', 'table', mine.table_id);
end;
$$;

-- seek_count(ttl) -> jsonb {"friendly": n, "ranked": n}: how many players are looking right now (untaken, live). Public numbers, no names.
create or replace function public.seek_count(p_ttl integer)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'friendly', (select count(*) from public.seeks where not ranked and taken_at is null and seen_at >= now() - make_interval(secs => p_ttl)),
    'ranked',   (select count(*) from public.seeks where ranked and taken_at is null and seen_at >= now() - make_interval(secs => p_ttl)));
$$;

revoke all on function public.seek_step(text, boolean, text, integer) from public, anon, authenticated;
revoke all on function public.seek_cancel(text, integer) from public, anon, authenticated;
revoke all on function public.seek_count(integer) from public, anon, authenticated;
grant execute on function public.seek_step(text, boolean, text, integer) to service_role;
grant execute on function public.seek_cancel(text, integer) to service_role;
grant execute on function public.seek_count(integer) to service_role;
notify pgrst, 'reload schema';

-- ---- self-check (leaves nothing behind; uses its own "zz-seek-" players) ----
do $$
declare r jsonb; n0 integer; a text := 'zz-seek-a'; b text := 'zz-seek-b'; c text := 'zz-seek-c'; d text := 'zz-seek-d'; e text := 'zz-seek-e';
begin
  delete from public.seeks where player_id like 'zz-seek-%';
  delete from public.players where id like 'zz-seek-%';
  insert into public.players (id) values (a), (b), (c), (d), (e);
  -- an empty queue: nobody to match, nothing written without a table
  r := public.seek_step(a, false, null, 60);
  if r->>'state' is distinct from 'none' then raise exception 'an empty queue did not answer none: %', r; end if;
  if exists (select 1 from public.seeks where player_id = a) then raise exception 'a seek with no table was written'; end if;
  -- a waits at its table
  r := public.seek_step(a, false, 'ZZSKA1', 60);
  if r->>'state' is distinct from 'waiting' or r->>'table' is distinct from 'ZZSKA1' then raise exception 'the first seeker did not wait at its table: %', r; end if;
  -- a's heartbeat keeps it waiting, at the same table
  r := public.seek_step(a, false, 'ZZSKA1', 60);
  if r->>'state' is distinct from 'waiting' or r->>'table' is distinct from 'ZZSKA1' or r ? 'drop' then raise exception 'a heartbeat did not keep waiting: %', r; end if;
  -- a ranked seeker is not matched to a friendly one
  r := public.seek_step(c, true, null, 60);
  if r->>'state' is distinct from 'none' then raise exception 'a ranked seeker was matched to a friendly table: %', r; end if;
  -- b is matched to a's table; a's seek is taken
  r := public.seek_step(b, false, null, 60);
  if r->>'state' is distinct from 'matched' or r->>'table' is distinct from 'ZZSKA1' or r ? 'drop' then raise exception 'the second seeker was not matched to the first table: %', r; end if;
  if (select taken_at from public.seeks where player_id = a) is null then raise exception 'a matched seek was not marked taken'; end if;
  if exists (select 1 from public.seeks where player_id = b) then raise exception 'the matched seeker was left in the queue'; end if;
  -- a's heartbeat now says taken; nobody else is matched to it
  r := public.seek_step(a, false, 'ZZSKA1', 60);
  if r->>'state' is distinct from 'taken' or r->>'table' is distinct from 'ZZSKA1' then raise exception 'the waiting seeker did not hear its seek was taken: %', r; end if;
  r := public.seek_step(d, false, null, 60);
  if r->>'state' is distinct from 'none' then raise exception 'a taken seek was matched twice: %', r; end if;
  -- a seeker never matches itself; oldest first
  r := public.seek_step(d, false, 'ZZSKD1', 60);
  if r->>'state' is distinct from 'waiting' then raise exception 'd did not wait: %', r; end if;
  update public.seeks set created_at = now() - interval '10 seconds' where player_id = d;
  insert into public.seeks (player_id, table_id, ranked) values (e, 'ZZSKE1', false);   -- e waits too (the race: two waiting at once), newer than d
  r := public.seek_step(c, false, 'ZZSKC1', 60);           -- c switches kind: its ranked seek had no row (none), so this is a fresh friendly seek -> matched to d
  if r->>'state' is distinct from 'matched' or r->>'table' is distinct from 'ZZSKD1' or r->>'drop' is distinct from 'ZZSKC1' then raise exception 'a seeker holding a table was not matched oldest-first with its table dropped: %', r; end if;
  if (select taken_at from public.seeks where player_id = e) is not null then raise exception 'the newer seek was taken before the older one'; end if;
  -- the race resolves on a heartbeat: e (waiting, holding a table) is matched to an older waiting seek, and leaves the queue with its table dropped
  insert into public.seeks (player_id, table_id, ranked, created_at) values (b, 'ZZSKB1', false, now() - interval '20 seconds');
  r := public.seek_step(e, false, 'ZZSKE1', 60);
  if r->>'state' is distinct from 'matched' or r->>'table' is distinct from 'ZZSKB1' or r->>'drop' is distinct from 'ZZSKE1' then raise exception 'two waiting seekers were not joined on a heartbeat: %', r; end if;
  if exists (select 1 from public.seeks where player_id = e) then raise exception 'a matched seeker that was waiting stayed in the queue'; end if;
  -- switching kind drops the old table
  delete from public.seeks where player_id like 'zz-seek-%';
  r := public.seek_step(c, true, 'ZZSKC2', 60);
  r := public.seek_step(c, false, null, 60);
  if r->>'state' is distinct from 'none' or r->>'drop' is distinct from 'ZZSKC2' then raise exception 'switching kind did not drop the old table: %', r; end if;
  -- a seek not seen for ttl is forgotten
  r := public.seek_step(a, false, 'ZZSKA2', 60);
  update public.seeks set seen_at = now() - interval '61 seconds' where player_id = a;
  r := public.seek_step(b, false, null, 60);
  if r->>'state' is distinct from 'none' then raise exception 'a stale seek was matched: %', r; end if;
  if exists (select 1 from public.seeks where player_id = a) then raise exception 'a stale seek was not forgotten'; end if;
  -- counting
  r := public.seek_step(a, false, 'ZZSKA3', 60);
  r := public.seek_step(c, true, 'ZZSKC3', 60);
  r := public.seek_count(60);
  if (r->>'friendly')::int < 1 or (r->>'ranked')::int < 1 then raise exception 'seek_count missed a seek: %', r; end if;
  n0 := (r->>'ranked')::int;
  -- cancel: a waiting seek goes, its table is named; a taken one is not cancelled
  r := public.seek_cancel(a, 60);
  if r->>'state' is distinct from 'cancelled' or r->>'table' is distinct from 'ZZSKA3' then raise exception 'a cancel did not cancel: %', r; end if;
  if exists (select 1 from public.seeks where player_id = a) then raise exception 'a cancelled seek stayed'; end if;
  r := public.seek_cancel(a, 60);
  if r->>'state' is distinct from 'none' then raise exception 'a second cancel found something: %', r; end if;
  r := public.seek_step(b, true, null, 60);
  if r->>'state' is distinct from 'matched' or r->>'table' is distinct from 'ZZSKC3' then raise exception 'b was not matched to the ranked table: %', r; end if;
  if (public.seek_count(60)->>'ranked')::int is distinct from n0 - 1 then raise exception 'seek_count still counts a taken seek'; end if;
  r := public.seek_cancel(c, 60);
  if r->>'state' is distinct from 'taken' or r->>'table' is distinct from 'ZZSKC3' then raise exception 'a taken seek was cancelled: %', r; end if;
  -- privileges
  if has_function_privilege('anon', 'public.seek_step(text,boolean,text,integer)', 'execute') then raise exception 'anon may call seek_step'; end if;
  if has_function_privilege('authenticated', 'public.seek_step(text,boolean,text,integer)', 'execute') then raise exception 'authenticated may call seek_step'; end if;
  if has_function_privilege('anon', 'public.seek_cancel(text,integer)', 'execute') then raise exception 'anon may call seek_cancel'; end if;
  if has_function_privilege('anon', 'public.seek_count(integer)', 'execute') then raise exception 'anon may call seek_count'; end if;
  if not has_function_privilege('service_role', 'public.seek_step(text,boolean,text,integer)', 'execute') then raise exception 'service_role may not call seek_step'; end if;
  if has_table_privilege('anon', 'public.seeks', 'select') then raise exception 'anon may read seeks'; end if;
  if not (select relforcerowsecurity from pg_class where oid = 'public.seeks'::regclass) then raise exception 'seeks: row level security is not forced'; end if;
  delete from public.seeks where player_id like 'zz-seek-%';
  delete from public.players where id like 'zz-seek-%';
end $$;
select 'ok' as dawnblade_seek;
