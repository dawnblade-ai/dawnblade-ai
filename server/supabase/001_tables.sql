-- DRAFT — UNVERIFIED. Never run: nothing is deployed on Supabase yet and the build sandbox cannot reach it.
-- Every statement below is written from memory of Supabase's Postgres/RLS/Realtime behaviour; read each one
-- against the live docs before pasting it into the project's SQL editor (server/supabase/DEPLOY.md, step 2).
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
  row        jsonb   not null,                                        -- referee.js newRow(): {v, wireV, id, build, hub, nonces, created, updated}
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

-- OPTIONAL, UNVERIFIED: forget tables nobody has touched for a week (needs the pg_cron extension, enabled
-- from Database -> Extensions in the dashboard).
-- select cron.schedule('dawnblade-forget-old-tables', '17 4 * * *',
--   $$ delete from public.tables where updated_at < now() - interval '7 days' $$);

-- ---------------------------------------------------------------------------------------------------------
-- WHO MAY LISTEN TO A SEAT'S CHANNEL — THE OPEN QUESTION (S3). Nothing below is active.
--
-- Each seat is pushed its own frames on  table:<code>:seat0  /  table:<code>:seat1  (referee.js `topic`). Those
-- frames are that seat's VIEW: its own hand. Anyone able to subscribe to seat 0's topic reads seat 0's hand.
--
-- OPTION A — Realtime Authorization (private channels + RLS on realtime.messages). Needs an auth user per phone
-- (anonymous sign-in: supabase-js signInAnonymously), the phone's JWT sent with `join` so the function can record
-- which user holds which seat, and a policy like the one below. Costs: an extra sign-in round trip, the anonymous
-- sign-in feature switched on in the project, a JWT forwarded to the function (the publishable key alone is not a
-- user), and a referee.js change (join records the caller's user id). It is the strongest answer: the SERVER
-- decides who may listen, and a leaked table code alone gives nothing.
--
--   create table if not exists public.seat_users (
--     table_id text not null, seat smallint not null check (seat in (0,1)), user_id uuid not null,
--     primary key (table_id, seat));
--   alter table public.seat_users enable row level security;  -- service role only, like tables
--   create policy "a seat listens to its own topic" on realtime.messages for select to authenticated
--     using (exists (select 1 from public.seat_users s
--                    where s.user_id = auth.uid()
--                      and realtime.topic() = 'table:' || s.table_id || ':seat' || s.seat));
--   -- (and no insert policy: phones never broadcast; only the function does, with the service role)
--
-- OPTION B — the simplest honest S3: PUBLIC channels with UNGUESSABLE topic names. The topic is
-- 'table:<code>:' || encode(sha256((seat_key || ':' || code)::bytea), 'hex') — derived from the seat key,
-- which only that seat's phone and the function ever hold. No auth users, no policy, no extra round trip;
-- servertable.js already takes a `topic(code, seat)` option for it (the phone hashes its key with
-- engine/sha256.js). Trade-offs, plainly: (1) the secrecy of a seat's hand is exactly the secrecy of a 256-bit
-- name, not an access check — anyone who learns the name (a log line, a proxy, Supabase's own operators, a
-- screenshot of the network tab) can listen AND can publish frames into that seat's channel (public channels
-- let any client send); net.js trusts what arrives on its channel as the referee's, so an attacker who has the
-- name can feed a phone a forged commit (whether net.js's own checks would catch one is not drilled). (2) the
-- topic is a bearer secret that cannot be revoked short of ending the table. (3) a table CODE alone is no longer
-- enough to listen — which is the point — but the 6-character code is still what lets a stranger take the second
-- seat before the real opponent does (the same exposure the direct table has).
