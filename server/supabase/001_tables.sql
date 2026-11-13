-- NOT YET RUN: the build sandbox can reach the project's REST API with the publishable key only (no secret, no SQL), so these
-- statements have not been executed anywhere. (Checked 2026-11-13: GET /rest/v1/tables answers PGRST205 "table not found" —
-- nothing is deployed.) The SQL is plain Postgres plus Supabase's standard roles (anon, authenticated, service_role); paste it
-- into the SQL editor (server/supabase/DEPLOY.md) and read the result: it ends with a self-check that returns one row, 'ok'.
--
-- WHAT THIS IS: the table store server/referee.js's `deps.store` needs (S1: store.get(id) -> {version,row}|null,
-- store.put(id,row,expectedVersion) -> {ok,version}), as one Postgres table that ONLY the Edge Function's
-- service role can touch, plus the one atomic statement `put` needs.
--
-- WHAT IS IN A ROW: the whole stored table — both seats' secret keys, the seed's secret half, the deck order.
-- It must never be readable by a phone. That is the whole security model of the row, so it is stated three ways:
-- row level security ON, FORCED, with NO policy for anon or authenticated; every grant revoked; and the
-- function is EXECUTE-able by service_role alone.

create table if not exists public.tables (
  id         text primary key check (id ~ '^[A-Za-z0-9_-]{1,32}$'),   -- the table code (referee.js ID_RE)
  version    integer not null default 1,                              -- optimistic concurrency: put() succeeds only against the version it read
  row        jsonb   not null,                                        -- referee.js newRow(): {v, wireV, id, build, hub, nonces, claims, created, updated}  (v = 2)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tables enable row level security;
alter table public.tables force row level security;
-- NO "create policy" for this table, on purpose: with RLS on and no policy, anon and authenticated read and write
-- nothing. The service role bypasses RLS (UNVERIFIED: that is how Supabase's service_role key behaves).
revoke all on public.tables from anon, authenticated;

create index if not exists tables_updated_at_idx on public.tables (updated_at);

-- put(id, row, expected): referee.js's compare-and-set, in ONE statement so two simultaneous requests cannot both win.
--   expected = 0  -> insert a new table; 0 rows if the id already exists
--   expected > 0  -> update only if the stored version is still `expected`
-- Returns the new version, or 0 for "someone else wrote first" (the referee answers {refused:"conflict", retry:true}).
create or replace function public.table_put(p_id text, p_row jsonb, p_expected integer)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare v integer;
begin
  if p_expected = 0 then
    insert into public.tables (id, row) values (p_id, p_row)
      on conflict (id) do nothing
      returning version into v;
  else
    update public.tables
       set row = p_row, version = version + 1, updated_at = now()
     where id = p_id and version = p_expected
     returning version into v;
  end if;
  return coalesce(v, 0);
end;
$$;

revoke all on function public.table_put(text, jsonb, integer) from public, anon, authenticated;
grant execute on function public.table_put(text, jsonb, integer) to service_role;

-- get(id) needs no function: the Edge Function reads `select version, row from public.tables where id = $1`
-- with the service role.

-- SELF-CHECK: raises an error naming what is wrong, or ends with one row, 'ok'. It creates and deletes one throwaway row
-- ('zz-selfcheck'). If its FIRST put fails with a row-level-security error, the SQL editor's role does not bypass RLS on
-- this project: that is harmless for the deploy (the function runs as service_role, which does), say so and skip the check.
do $$
declare v integer;
begin
  if not (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.tables'::regclass) then
    raise exception 'row level security is not enabled and forced on public.tables'; end if;
  if has_table_privilege('anon', 'public.tables', 'select') or has_table_privilege('authenticated', 'public.tables', 'select')
     or has_table_privilege('anon', 'public.tables', 'insert') or has_table_privilege('authenticated', 'public.tables', 'insert') then
    raise exception 'anon or authenticated can still reach public.tables'; end if;
  if has_function_privilege('anon', 'public.table_put(text,jsonb,integer)', 'execute')
     or has_function_privilege('authenticated', 'public.table_put(text,jsonb,integer)', 'execute') then
    raise exception 'anon or authenticated may call table_put'; end if;
  if not has_function_privilege('service_role', 'public.table_put(text,jsonb,integer)', 'execute') then
    raise exception 'service_role may not call table_put'; end if;
  v := public.table_put('zz-selfcheck', '{"v":2}'::jsonb, 0);          if v <> 1 then raise exception 'a first put answered %', v; end if;
  v := public.table_put('zz-selfcheck', '{"v":2}'::jsonb, 0);          if v <> 0 then raise exception 'a duplicate create was not refused (%)', v; end if;
  v := public.table_put('zz-selfcheck', '{"v":2,"x":1}'::jsonb, 1);    if v <> 2 then raise exception 'an update at version 1 answered %', v; end if;
  v := public.table_put('zz-selfcheck', '{"v":2,"x":2}'::jsonb, 1);    if v <> 0 then raise exception 'a stale put was not refused (%)', v; end if;
  delete from public.tables where id = 'zz-selfcheck';
end $$;
select 'ok' as dawnblade_tables;

-- OPTIONAL, UNVERIFIED: forget tables nobody has touched for a week (needs the pg_cron extension, enabled
-- from Database -> Extensions in the dashboard).
-- select cron.schedule('dawnblade-forget-old-tables', '17 4 * * *',
--   $$ delete from public.tables where updated_at < now() - interval '7 days' $$);

-- ---------------------------------------------------------------------------------------------------------
-- WHO MAY LISTEN TO A SEAT'S CHANNEL — DECIDED (CEO, 2026-11-13, casual stage): OPTION B. Nothing below is SQL to run.
--
-- Each seat is pushed its own frames — that seat's VIEW, its own hand — on a PUBLIC Realtime channel named
--     table:<code>:<64 hex>      the hex is sha256 of (code, seat, the seat's secret key): engine/sha256.js `seatTopic`,
-- computed by the function (server/referee.js) and by the phone from the key it was dealt. The name never reveals the key;
-- the other seat's name is never sent to a phone and cannot be worked out from its own; a stranger with only the table code
-- cannot guess either. No auth users, no policy, no extra round trip. (Realtime's own table, realtime.messages, is not
-- touched: public channels need no policy. VERIFIED 2026-11-13: a client holding only the publishable key joins such a
-- channel; the same key is refused on a private one — "Unauthorized: You do not have permissions to read from this Channel topic".)
--
-- WHAT THAT BUYS, AND WHAT IT DOES NOT:
--   * The secrecy of a seat's hand is exactly the secrecy of a 256-bit name, not an access check. Anyone who LEARNS the
--     name — a log line, a proxy, a screenshot of a network tab, Supabase's own operators — can LISTEN to that seat's frames.
--   * Anyone with the name can also PUBLISH into the channel (public channels let any client send; VERIFIED). So every push
--     is SEALED: the function adds `mac`, HMAC-SHA256 under the seat's key over (code, seat, ver, frames), and a phone
--     applies nothing whose seal does not verify (engine/servertable.js `onPayload`). A listener cannot forge a frame
--     without the key; at worst a replayed genuine push costs the phone one resync. An intruder cannot put a frame in a game.
--   * The name is a bearer secret and CANNOT BE REVOKED short of ending the table.
--   * The 6-character table CODE alone no longer lets anyone listen — but it is still what lets a stranger take the second
--     seat before the real opponent does (the same exposure the direct table has).
--
-- LATER (S4, with sign-in): private channels + a policy on realtime.messages, so the SERVER decides who may listen and a
-- leaked name gives nothing. That needs anonymous or real sign-in users, a JWT forwarded to `join` so the function can
-- record which user holds which seat (a seat_users table), and a policy such as
--   create policy "a seat listens to its own topic" on realtime.messages for select to authenticated
--     using (exists (select 1 from public.seat_users s where s.user_id = auth.uid()
--                    and realtime.topic() = 'table:' || s.table_id || ':seat' || s.seat));
-- and a topic that no longer needs to be secret. Not built.
