-- NOT RUN ANYWHERE. A DRAFT (S4.1, 2026-11-14): nothing in this file has been executed on the live project, and the deployed function
-- does not use any of it. It was run on PGlite (WASM Postgres 16) with the three Supabase role names created beside it — result in
-- server/S4-LOG.md. The SQL is plain Postgres plus Supabase's standard roles (anon, authenticated, service_role); when it is
-- deployed, paste it into the SQL editor after 001_tables.sql and read the result: it ends with a self-check that returns one row, 'ok'.
--
-- WHAT THIS IS: OUR OWN identity tables. A `player` is a row HERE; an external sign-in (Supabase anonymous auth is the planned first
-- provider, NOT enabled yet and pending the user's permission) only maps onto it through `identities(provider, subject -> player_id)`.
-- The referee core (server/referee.js) never sees a provider: it is handed `deps.identify(token) -> {player, name?}`, and the Edge
-- Function's identify (entry.template.ts) verifies the token with the provider and calls identity_resolve() below.
--
-- WHO MAY TOUCH THESE TABLES: only the Edge Function's service role. Row level security ON and FORCED with NO policy for anon or
-- authenticated, every grant revoked, every function EXECUTE-able by service_role alone (stated three ways, as in 001). A phone never
-- reads or writes a player, an identity or a recovery code through the API; it is told its own display name by the function.
--
-- WHAT IS IN HERE THAT MUST NEVER LEAK: `identities.subject` (the provider's user id) and `players.id` (ties a seat to a person across
-- tables). The referee puts neither in any response, broadcast or report (test/serverid.test.js). `recovery` holds only the SHA-256
-- of a code, never a code.

create table if not exists public.players (
  id            text primary key default gen_random_uuid()::text check (id ~ '^[A-Za-z0-9_-]{1,64}$'),   -- referee.js PLAYER_RE; OUR id, never the provider's
  display_name  text check (display_name is null or char_length(display_name) between 3 and 16),         -- validated by referee.js validateName (the ONE validator); the DB only bounds it
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);

create table if not exists public.identities (
  provider    text not null check (provider ~ '^[a-z][a-z0-9_-]{0,31}$'),      -- 'supabase-anon' (Supabase anonymous auth), later 'supabase', 'google', …
  subject     text not null check (char_length(subject) between 1 and 256),    -- the provider's own user id: a SECRET of this table
  player_id   text not null references public.players (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (provider, subject)
);
create index if not exists identities_player_idx on public.identities (player_id);

-- recovery codes (S4.3 will mint and redeem them): one row per code, only its hash is kept.
create table if not exists public.recovery (
  id          bigint generated always as identity primary key,
  player_id   text not null references public.players (id) on delete cascade,
  code_hash   text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),       -- sha256 hex of the code; the code itself is shown to the player once and forgotten
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null check (expires_at > created_at),
  used_at     timestamptz                                                       -- set by recovery_use(); a used code never works again
);
create index if not exists recovery_player_idx on public.recovery (player_id);

alter table public.players    enable row level security;  alter table public.players    force row level security;
alter table public.identities enable row level security;  alter table public.identities force row level security;
alter table public.recovery   enable row level security;  alter table public.recovery   force row level security;
-- NO "create policy" for any of them, on purpose (UNVERIFIED: that Supabase's service_role bypasses RLS is how its key behaves).
revoke all on public.players, public.identities, public.recovery from anon, authenticated;
grant all on public.players, public.identities, public.recovery to service_role;
-- the identity column of `recovery` is a generated sequence: service_role needs it to insert
grant usage, select on all sequences in schema public to service_role;

-- identity_resolve(provider, subject, name): who is this sign-in? Creates the player on first sight; the same (provider, subject) is the
-- same player forever. ONE statement's worth of race safety: two simultaneous first sights make one player (the loser's row is removed).
-- `p_name` only seeds a NEW player's display name (the referee has already validated it); an existing player's name is never overwritten here.
-- Returns the player id and display name.
create or replace function public.identity_resolve(p_provider text, p_subject text, p_name text default null)
returns table (player_id text, display_name text)
language plpgsql
security invoker
set search_path = public
as $$
declare v text; mine text;
begin
  select i.player_id into v from public.identities i where i.provider = p_provider and i.subject = p_subject;
  if v is null then
    insert into public.players (display_name) values (p_name) returning id into mine;
    insert into public.identities (provider, subject, player_id) values (p_provider, p_subject, mine) on conflict do nothing;
    select i.player_id into v from public.identities i where i.provider = p_provider and i.subject = p_subject;
    if v <> mine then delete from public.players where id = mine; end if;       -- lost the race: the other writer's player stands
  end if;
  update public.players set last_seen_at = now() where id = v;
  return query select p.id, p.display_name from public.players p where p.id = v;
end;
$$;

-- recovery_use(hash): redeem a recovery code ONCE. Returns the player id, or null (unknown, used or expired). Atomic: two simultaneous
-- redemptions cannot both succeed.
create or replace function public.recovery_use(p_hash text)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare v text;
begin
  update public.recovery set used_at = now()
   where code_hash = p_hash and used_at is null and expires_at > now()
   returning player_id into v;
  return v;
end;
$$;

revoke all on function public.identity_resolve(text, text, text) from public, anon, authenticated;
revoke all on function public.recovery_use(text) from public, anon, authenticated;
grant execute on function public.identity_resolve(text, text, text) to service_role;
grant execute on function public.recovery_use(text) to service_role;

-- SELF-CHECK (idempotent: raises an error naming what is wrong, or ends with one row, 'ok'). It creates and deletes throwaway rows
-- whose subjects start 'zz-selfcheck'. If its FIRST call fails with a row-level-security error, the SQL editor's role does not bypass
-- RLS on this project: harmless for the deploy (the function runs as service_role); say so and skip the check.
do $$
declare t text; f text; a text; b text; c text; h text := repeat('a', 64); got text; n0 bigint;
begin
  foreach t in array array['players', 'identities', 'recovery'] loop
    if not (select relrowsecurity and relforcerowsecurity from pg_class where oid = ('public.' || t)::regclass) then
      raise exception 'row level security is not enabled and forced on public.%', t; end if;
    if has_table_privilege('anon', 'public.' || t, 'select') or has_table_privilege('authenticated', 'public.' || t, 'select')
       or has_table_privilege('anon', 'public.' || t, 'insert') or has_table_privilege('authenticated', 'public.' || t, 'insert')
       or has_table_privilege('anon', 'public.' || t, 'update') or has_table_privilege('authenticated', 'public.' || t, 'update')
       or has_table_privilege('anon', 'public.' || t, 'delete') or has_table_privilege('authenticated', 'public.' || t, 'delete') then
      raise exception 'anon or authenticated can still reach public.%', t; end if;
    if not has_table_privilege('service_role', 'public.' || t, 'select') or not has_table_privilege('service_role', 'public.' || t, 'insert') then
      raise exception 'service_role cannot use public.%', t; end if;
    if exists (select 1 from pg_policies where schemaname = 'public' and tablename = t) then
      raise exception 'public.% has a policy: it must have none', t; end if;
  end loop;
  foreach f in array array['public.identity_resolve(text,text,text)', 'public.recovery_use(text)'] loop
    if has_function_privilege('anon', f, 'execute') or has_function_privilege('authenticated', f, 'execute') then
      raise exception 'anon or authenticated may call %', f; end if;
    if not has_function_privilege('service_role', f, 'execute') then raise exception 'service_role may not call %', f; end if;
  end loop;

  -- clean slate for a re-run
  delete from public.players where id in (select player_id from public.identities where subject like 'zz-selfcheck%');

  -- identity_resolve: first sight makes a player (with the seeded name), the same sign-in is the same player, another is another
  select count(*) into n0 from public.players;
  select r.player_id into a from public.identity_resolve('supabase-anon', 'zz-selfcheck-1', 'Self Check') r;
  select r.player_id into b from public.identity_resolve('supabase-anon', 'zz-selfcheck-1', 'Other Name') r;
  if a is null or a <> b then raise exception 'the same sign-in was not the same player (% / %)', a, b; end if;
  if (select display_name from public.players where id = a) <> 'Self Check' then raise exception 'an existing player''s name was overwritten'; end if;
  select r.player_id into c from public.identity_resolve('supabase-anon', 'zz-selfcheck-2', null) r;
  if c is null or c = a then raise exception 'another sign-in was not another player'; end if;
  select r.player_id into got from public.identity_resolve('google', 'zz-selfcheck-1', null) r;
  if got is null or got = a then raise exception 'the same subject at another provider was the same player'; end if;
  if (select count(*) from public.identities where subject like 'zz-selfcheck%') <> 3 then raise exception 'identities were duplicated or lost'; end if;
  if (select count(*) from public.players) <> n0 + 3 then raise exception 'identity_resolve left a stray player (% -> %)', n0, (select count(*) from public.players); end if;

  -- constraints refuse what the application would never send
  begin insert into public.players (id) values ('has space'); raise exception 'a bad player id was accepted';
  exception when check_violation then null; end;
  begin insert into public.players (display_name) values ('ab'); raise exception 'a 2-character name was accepted';
  exception when check_violation then null; end;
  begin insert into public.identities (provider, subject, player_id) values ('Bad Provider', 'zz-selfcheck-x', a); raise exception 'a bad provider was accepted';
  exception when check_violation then null; end;
  begin insert into public.identities (provider, subject, player_id) values ('supabase-anon', 'zz-selfcheck-y', 'no-such-player'); raise exception 'an identity of no player was accepted';
  exception when foreign_key_violation then null; end;

  -- recovery: a hash only, redeemed once, never after expiry, unknown is null
  begin insert into public.recovery (player_id, code_hash, expires_at) values (a, 'not-a-hash', now() + interval '1 day'); raise exception 'a code (not a hash) was accepted';
  exception when check_violation then null; end;
  insert into public.recovery (player_id, code_hash, expires_at) values (a, h, now() + interval '1 day');
  begin insert into public.recovery (player_id, code_hash, expires_at) values (a, h, now() + interval '1 day'); raise exception 'a duplicate hash was accepted';
  exception when unique_violation then null; end;
  got := public.recovery_use(h);          if got is distinct from a then raise exception 'a good recovery code answered %', got; end if;
  got := public.recovery_use(h);          if got is not null then raise exception 'a recovery code worked twice'; end if;
  got := public.recovery_use(repeat('b', 64)); if got is not null then raise exception 'an unknown recovery code worked'; end if;
  insert into public.recovery (player_id, code_hash, created_at, expires_at) values (a, repeat('c', 64), now() - interval '2 days', now() - interval '1 day');
  got := public.recovery_use(repeat('c', 64)); if got is not null then raise exception 'an expired recovery code worked'; end if;

  -- cascade: removing a player removes its identities and codes
  delete from public.players where id in (select player_id from public.identities where subject like 'zz-selfcheck%');
  if exists (select 1 from public.identities where subject like 'zz-selfcheck%') or exists (select 1 from public.recovery where code_hash in (h, repeat('c', 64))) then
    raise exception 'deleting a player left identities or recovery codes behind'; end if;
end $$;
select 'ok' as dawnblade_players;
