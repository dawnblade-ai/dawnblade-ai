-- server/supabase/011_seek_wait.sql — FIND A MATCH: HOW LONG PLAYERS USUALLY WAIT (SERVER, matchmaking visibility). Run after 001..010; safe to run twice.
--
-- A seeker waiting at the queue is told an honest expectation: the MEDIAN wait of the seeks that were completed (taken by another player) in the last
-- day, for their kind (friendly or ranked). Public numbers only: seek_wait_log holds a kind and a number of seconds, never a player, a table or a time
-- finer than the day's window. A seek that was cancelled or went stale is not "completed" and is never counted.
--   * seek_wait_log   one row per completed seek; written by a trigger on seeks (so seek_step is untouched); rows older than 7 days are pruned as it writes.
--   * seek_wait_stats(p_ranked)  -> {"n": seeks in the last 24 h, "typical": median seconds, rounded up to a 5 s step, or null when n < 5}. Too little
--                                   data answers null: the page then says nothing rather than a made-up number.
-- Nothing here is readable by anon / authenticated (RLS forced, grants revoked, as 009); the function (service_role) is the only reader.

create table if not exists public.seek_wait_log (
  id       bigint generated always as identity primary key,
  ranked   boolean not null,
  waited_s integer not null check (waited_s >= 0 and waited_s <= 86400),
  at       timestamptz not null default now()
);
create index if not exists seek_wait_log_idx on public.seek_wait_log (ranked, at);
alter table public.seek_wait_log enable row level security;
alter table public.seek_wait_log force row level security;
revoke all on public.seek_wait_log from anon, authenticated;
grant all on public.seek_wait_log to service_role;

create or replace function public.seek_wait_note() returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  insert into public.seek_wait_log (ranked, waited_s)
    values (new.ranked, least(86400, greatest(0, round(extract(epoch from (new.taken_at - new.created_at)))::integer)));
  delete from public.seek_wait_log where at < now() - interval '7 days';
  return new;
end;
$$;

drop trigger if exists seeks_wait_note on public.seeks;
create trigger seeks_wait_note after update of taken_at on public.seeks
  for each row when (old.taken_at is null and new.taken_at is not null)
  execute function public.seek_wait_note();

create or replace function public.seek_wait_stats(p_ranked boolean)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object('n', s.n,
    'typical', case when s.n >= 5 then (ceil(s.med / 5.0) * 5)::integer else null end)
  from (select count(*)::integer as n, coalesce(percentile_cont(0.5) within group (order by waited_s), 0) as med
          from public.seek_wait_log where ranked = coalesce(p_ranked, false) and at >= now() - interval '24 hours') s;
$$;

revoke all on function public.seek_wait_note() from public, anon, authenticated;
revoke all on function public.seek_wait_stats(boolean) from public, anon, authenticated;
grant execute on function public.seek_wait_stats(boolean) to service_role;
notify pgrst, 'reload schema';

-- SELF-CHECK (rolled into the file's last row; leaves no test rows)
do $$
declare r jsonb; a text := 'zz-wait-a'; b text := 'zz-wait-b'; i integer;
begin
  -- the real log is set aside and put back, so running this on a live project keeps its numbers
  create temp table zz_wait_keep on commit drop as select ranked, waited_s, at from public.seek_wait_log;
  delete from public.seek_wait_log; delete from public.seeks where player_id like 'zz-wait-%'; delete from public.players where id like 'zz-wait-%';
  insert into public.players (id) values (a), (b);
  r := public.seek_wait_stats(false);
  if (r->>'n')::int <> 0 or r->'typical' <> 'null'::jsonb then raise exception 'an empty log did not answer n 0 and typical null: %', r; end if;
  -- a real match through seek_step writes one row
  perform public.seek_step(a, false, 'ZZWTA1', 60);
  update public.seeks set created_at = now() - interval '12 seconds' where player_id = a;
  perform public.seek_step(b, false, null, 60);
  if (select count(*) from public.seek_wait_log) <> 1 then raise exception 'a completed seek did not write exactly one log row'; end if;
  if (select waited_s from public.seek_wait_log) not between 12 and 13 then raise exception 'the logged wait is not the seeker''s wait: %', (select waited_s from public.seek_wait_log); end if;
  if (select ranked from public.seek_wait_log) then raise exception 'a friendly seek was logged as ranked'; end if;
  perform public.seek_step(a, false, 'ZZWTA1', 60);   -- the waiter hears "taken": a heartbeat is not a second completion
  if (select count(*) from public.seek_wait_log) <> 1 then raise exception 'a heartbeat after the match wrote another row'; end if;
  update public.seeks set taken_at = now() where player_id = a;   -- an already-taken seek touched again is not a second completion
  if (select count(*) from public.seek_wait_log) <> 1 then raise exception 'a seek already taken was logged again'; end if;
  -- a cancelled seek and a stale seek are not completed
  delete from public.seek_wait_log; delete from public.seeks where player_id like 'zz-wait-%';
  perform public.seek_step(a, false, 'ZZWTA2', 60); perform public.seek_cancel(a, 60);
  if exists (select 1 from public.seek_wait_log) then raise exception 'a cancelled seek was logged'; end if;
  perform public.seek_step(a, false, 'ZZWTA3', 60);
  update public.seeks set seen_at = now() - interval '61 seconds' where player_id = a;
  perform public.seek_step(b, false, null, 60);
  if exists (select 1 from public.seek_wait_log) then raise exception 'a stale seek was logged'; end if;
  -- the median, per kind, over the last day only, null under 5
  delete from public.seek_wait_log;
  for i in 1..4 loop insert into public.seek_wait_log (ranked, waited_s) values (false, 10 * i); end loop;
  r := public.seek_wait_stats(false);
  if (r->>'n')::int <> 4 or r->'typical' <> 'null'::jsonb then raise exception '4 seeks must say nothing: %', r; end if;
  insert into public.seek_wait_log (ranked, waited_s) values (false, 1000);
  r := public.seek_wait_stats(false);   -- 10,20,30,40,1000 -> median 30
  if (r->>'n')::int <> 5 or (r->>'typical')::int is distinct from 30 then raise exception 'the median of 10,20,30,40,1000 is 30, not: %', r; end if;
  r := public.seek_wait_stats(true);
  if (r->>'n')::int <> 0 or r->'typical' <> 'null'::jsonb then raise exception 'friendly seeks leaked into the ranked numbers: %', r; end if;
  insert into public.seek_wait_log (ranked, waited_s) select true, 7 from generate_series(1, 5);
  r := public.seek_wait_stats(true);    -- median 7 rounds UP to the 5 s step: 10
  if (r->>'typical')::int is distinct from 10 then raise exception 'a 7 s median is told as 10, not: %', r; end if;
  insert into public.seek_wait_log (ranked, waited_s, at) select false, 1, now() - interval '25 hours' from generate_series(1, 20);
  r := public.seek_wait_stats(false);
  if (r->>'n')::int <> 5 then raise exception 'seeks older than a day were counted: %', r; end if;
  -- rows older than 7 days are pruned when the next one is written
  insert into public.seek_wait_log (ranked, waited_s, at) values (false, 1, now() - interval '8 days'), (false, 1, now() - interval '3 days');
  perform public.seek_step(a, false, 'ZZWTA4', 60);
  update public.seeks set created_at = now() - interval '1 second' where player_id = a;
  perform public.seek_step(b, false, null, 60);
  if exists (select 1 from public.seek_wait_log where at < now() - interval '7 days') then raise exception 'a row older than 7 days was kept'; end if;
  if (select count(*) from public.seek_wait_log where at < now() - interval '2 days') <> 1 then raise exception 'a row of 3 days was pruned early'; end if;
  -- the log holds no player and no table
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'seek_wait_log' and column_name not in ('id', 'ranked', 'waited_s', 'at')) then raise exception 'seek_wait_log carries a column off the public list'; end if;
  delete from public.seek_wait_log; delete from public.seeks where player_id like 'zz-wait-%'; delete from public.players where id like 'zz-wait-%';
  insert into public.seek_wait_log (ranked, waited_s, at) select ranked, waited_s, at from zz_wait_keep;
end;
$$;

select 'ok' as dawnblade_seek_wait;
