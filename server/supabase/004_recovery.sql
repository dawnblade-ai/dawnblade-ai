-- server/supabase/004_recovery.sql — RECOVERY CODES: MINT AND REDEEM (SERVER S4.3). Run after 003_names.sql; safe to run twice.
-- NOT RUN ANYWHERE as written here: run on PGlite (tools/sql-pglite.js) only; result in server/S4-LOG.md. 002 (the `recovery` table,
-- `recovery_use`) is already on the live project and is NOT edited: this file only ADDS.
--
-- WHAT A RECOVERY CODE IS. A phone's identity is an anonymous sign-in kept on that phone (S4.2), so a lost phone was a lost player.
-- A player can now ask the function for a code (written down, shown once). The function stores ONLY the SHA-256 of it (`recovery`,
-- 002). A NEW phone, with its own fresh anonymous sign-in, presents the code and that sign-in is re-pointed to the code's player.
-- The old phone's sign-in stays on the same player (RULING (user, 2026-11-14): one player on two phones, the last one to sit down
-- wins the seat — already how seats work).
--
-- WHO MAY CALL THESE: service_role only (the Edge Function), stated the same three ways as 002. Nothing here is readable with the
-- publishable key. The code, its hash and the provider's subject never leave the function (referee.js answers neither).
--
-- recovery_mint(player, hash, days) -> 'ok' | 'unknown'
--     ONE LIVE CODE PER PLAYER: the player's older UNUSED codes are deleted in the same statement block, then the new hash is
--     stored. Serialised per player (the player row is locked), so two simultaneous mints cannot leave two live codes.
--     `days` is the expiry; the function sends 730 (two years). The column only requires expires_at > created_at.
-- recovery_redeem(provider, subject, hash) -> (status, display_name)
--     status 'ok'       the sign-in now belongs to the code's player (and `display_name` is that player's name or null);
--                       redeeming a code of the player you already are is also 'ok' (the code is spent)
--            'refused'  unknown, used and expired are ONE answer (and one code path: a single UPDATE that matches or not)
--            'limited'  too many refusals from this sign-in in the last hour (the brake below); the code is NOT looked at,
--                       so a correct code is not spent by a limited try
--            'unknown'  this sign-in is not a player yet (the function resolves it first, so this is a bug guard)
--     ATOMIC: spending the code, moving the identity and removing the throwaway player are one function call = one transaction.
--     THE THROWAWAY PLAYER: the new phone had a player of its own (created at its first sight). When the identity moves and that
--     player is left with NO identity, the row is deleted: its name (if it chose one) is freed, its own codes cascade away, and no
--     identity can ever point at it again. A seat it holds at a table is the FUNCTION's business (referee.js refuses the redeem
--     while the caller's table shows it seated), never this file's.
--     THE BRAKE: a refused try is recorded per sign-in (`recovery_attempts`); eight refusals in an hour answer 'limited'. A code is
--     15 characters of a 31-letter alphabet (74 bits): the brake only slows a pointless storm, the size of the code is the defence.

create table if not exists public.recovery_attempts (
  id        bigint generated always as identity primary key,
  provider  text not null,
  subject   text not null,
  at        timestamptz not null default now()
);
create index if not exists recovery_attempts_who_idx on public.recovery_attempts (provider, subject, at);
alter table public.recovery_attempts enable row level security;  alter table public.recovery_attempts force row level security;
revoke all on public.recovery_attempts from anon, authenticated;
grant all on public.recovery_attempts to service_role;
grant usage, select on all sequences in schema public to service_role;

create or replace function public.recovery_mint(p_player text, p_hash text, p_days int default 730)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare locked text;
begin
  if p_hash is null or p_hash !~ '^[0-9a-f]{64}$' then raise exception 'recovery_mint needs a sha256 hex hash'; end if;
  if p_days is null or p_days < 1 or p_days > 3650 then raise exception 'recovery_mint: days out of range'; end if;
  select id into locked from public.players where id = p_player for update;      -- serialises two mints of one player
  if locked is null then return 'unknown'; end if;
  delete from public.recovery where player_id = p_player and used_at is null;    -- one live code per player
  insert into public.recovery (player_id, code_hash, expires_at) values (p_player, p_hash, now() + make_interval(days => p_days));
  return 'ok';
end;
$$;

create or replace function public.recovery_redeem(p_provider text, p_subject text, p_hash text)
returns table (status text, display_name text)
language plpgsql
security invoker
set search_path = public
as $$
declare cur text; tgt text; fails int; nm text;
begin
  if p_hash is null or p_hash !~ '^[0-9a-f]{64}$' then return query select 'refused'::text, null::text; return; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_provider || '|' || p_subject, 0));     -- one try at a time per sign-in
  delete from public.recovery_attempts where at < now() - interval '1 day';
  select i.player_id into cur from public.identities i where i.provider = p_provider and i.subject = p_subject;
  if cur is null then return query select 'unknown'::text, null::text; return; end if;
  select count(*) into fails from public.recovery_attempts a
   where a.provider = p_provider and a.subject = p_subject and a.at > now() - interval '1 hour';
  if fails >= 8 then return query select 'limited'::text, null::text; return; end if;
  update public.recovery r set used_at = now()
   where r.code_hash = p_hash and r.used_at is null and r.expires_at > now()
   returning r.player_id into tgt;
  if tgt is null then
    insert into public.recovery_attempts (provider, subject) values (p_provider, p_subject);   -- committed: the function RETURNS, it does not raise
    return query select 'refused'::text, null::text; return;
  end if;
  if tgt <> cur then
    update public.identities i set player_id = tgt where i.provider = p_provider and i.subject = p_subject;
    if not exists (select 1 from public.identities i where i.player_id = cur) then
      delete from public.players where id = cur;                                    -- the throwaway: no identity left, name freed
    end if;
  end if;
  delete from public.recovery_attempts a where a.provider = p_provider and a.subject = p_subject;
  update public.players set last_seen_at = now() where id = tgt returning public.players.display_name into nm;
  return query select 'ok'::text, nm;
end;
$$;

revoke all on function public.recovery_mint(text, text, int) from public, anon, authenticated;
revoke all on function public.recovery_redeem(text, text, text) from public, anon, authenticated;
grant execute on function public.recovery_mint(text, text, int) to service_role;
grant execute on function public.recovery_redeem(text, text, text) to service_role;
notify pgrst, 'reload schema';

-- ---- self-check (idempotent; leaves nothing behind; raises an error naming what is wrong, or ends with one row, 'ok') ----
do $$
declare a text; b text; c text; r record; h1 text := repeat('1', 64); h2 text := repeat('2', 64); h3 text := repeat('3', 64); h4 text := repeat('4', 64); h5 text := repeat('5', 64); h6 text := repeat('6', 64);
        k int; s text;
begin
  if not (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.recovery_attempts'::regclass) then
    raise exception 'row level security is not enabled and forced on public.recovery_attempts'; end if;
  if has_table_privilege('anon', 'public.recovery_attempts', 'select') or has_table_privilege('authenticated', 'public.recovery_attempts', 'select')
     or has_table_privilege('anon', 'public.recovery_attempts', 'insert') or has_table_privilege('authenticated', 'public.recovery_attempts', 'insert') then
    raise exception 'anon or authenticated can reach public.recovery_attempts'; end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'recovery_attempts') then raise exception 'public.recovery_attempts has a policy'; end if;
  foreach s in array array['public.recovery_mint(text,text,int)', 'public.recovery_redeem(text,text,text)'] loop
    if has_function_privilege('anon', s, 'execute') or has_function_privilege('authenticated', s, 'execute') then raise exception 'anon or authenticated may call %', s; end if;
    if not has_function_privilege('service_role', s, 'execute') then raise exception 'service_role may not call %', s; end if;
  end loop;

  delete from public.players where id in (select player_id from public.identities where subject like 'zz-reccheck%');
  delete from public.recovery_attempts where subject like 'zz-reccheck%';
  -- a (the old phone's player, named) and b (the new phone's throwaway, also named, so its name must be freed)
  select player_id into a from public.identity_resolve('selfcheck', 'zz-reccheck-old', null);
  select player_id into b from public.identity_resolve('selfcheck', 'zz-reccheck-new', null);
  if public.player_rename(a, 'Zz Rec Old', 'zzrecold') <> 'ok' or public.player_rename(b, 'Zz Rec New', 'zzrecnew') <> 'ok' then raise exception 'could not name the check players'; end if;

  -- mint: stores one live code; a second mint retires the first (one live code per player); unknown player; bad input raises
  if public.recovery_mint(a, h1, 730) <> 'ok' then raise exception 'mint did not store'; end if;
  if (select count(*) from public.recovery where player_id = a and used_at is null) <> 1 then raise exception 'mint did not leave exactly one live code'; end if;
  if (select expires_at from public.recovery where code_hash = h1) < now() + interval '729 days' then raise exception 'the expiry is not two years'; end if;
  if public.recovery_mint(a, h2, 730) <> 'ok' then raise exception 'second mint did not store'; end if;
  if exists (select 1 from public.recovery where code_hash = h1) then raise exception 'a second mint left the first code alive'; end if;
  if (select count(*) from public.recovery where player_id = a and used_at is null) <> 1 then raise exception 'a second mint left more than one live code'; end if;
  if public.recovery_mint('no-such-player', h3, 730) <> 'unknown' then raise exception 'a missing player minted a code'; end if;
  begin perform public.recovery_mint(a, 'not-a-hash', 730); raise exception 'a non-hash was stored'; exception when raise_exception then
    if sqlerrm = 'a non-hash was stored' then raise; end if; end;
  begin perform public.recovery_mint(a, h3, 0); raise exception 'a zero-day code was stored'; exception when raise_exception then
    if sqlerrm = 'a zero-day code was stored' then raise; end if; end;

  -- redeem: wrong, used and expired are one answer; the old code (retired by the second mint) is refused too
  select * into r from public.recovery_redeem('selfcheck', 'zz-reccheck-new', h1);
  if r.status <> 'refused' or r.display_name is not null then raise exception 'a retired code answered %', r.status; end if;
  select * into r from public.recovery_redeem('selfcheck', 'zz-reccheck-new', repeat('9', 64));
  if r.status <> 'refused' then raise exception 'an unknown code answered %', r.status; end if;
  insert into public.recovery (player_id, code_hash, created_at, expires_at) values (a, h3, now() - interval '2 days', now() - interval '1 day');
  select * into r from public.recovery_redeem('selfcheck', 'zz-reccheck-new', h3);
  if r.status <> 'refused' then raise exception 'an expired code answered %', r.status; end if;
  select * into r from public.recovery_redeem('selfcheck', 'zz-reccheck-nobody', h2);
  if r.status <> 'unknown' then raise exception 'a sign-in that is no player answered %', r.status; end if;
  if (select used_at from public.recovery where code_hash = h2) is not null then raise exception 'a refused try spent the live code'; end if;
  if (select player_id from public.identities where subject = 'zz-reccheck-new') <> b then raise exception 'a refused try moved the identity'; end if;

  -- the good redeem: the new sign-in is now player a, named like a; the throwaway b and its name are gone; the old sign-in is still a
  select * into r from public.recovery_redeem('selfcheck', 'zz-reccheck-new', h2);
  if r.status <> 'ok' or r.display_name <> 'Zz Rec Old' then raise exception 'a good code answered % / %', r.status, r.display_name; end if;
  if (select player_id from public.identities where subject = 'zz-reccheck-new') <> a then raise exception 'the identity was not moved'; end if;
  if (select player_id from public.identities where subject = 'zz-reccheck-old') <> a then raise exception 'the old phone lost its player'; end if;
  if exists (select 1 from public.players where id = b) then raise exception 'the throwaway player was kept'; end if;
  if public.player_rename(a, 'Zz Rec Old', 'zzrecold') <> 'ok' then raise exception 'the player lost its name'; end if;
  if exists (select 1 from public.players where name_fold = 'zzrecnew') then raise exception 'the throwaway player''s name was kept'; end if;
  select * into r from public.recovery_redeem('selfcheck', 'zz-reccheck-new', h2);
  if r.status <> 'refused' then raise exception 'a spent code answered %', r.status; end if;

  -- redeeming a code of the player you already are: ok, the code is spent, nothing is deleted
  if public.recovery_mint(a, h4, 730) <> 'ok' then raise exception 'mint (again) did not store'; end if;
  select * into r from public.recovery_redeem('selfcheck', 'zz-reccheck-old', h4);
  if r.status <> 'ok' or not exists (select 1 from public.players where id = a) then raise exception 'redeeming your own code answered %', r.status; end if;
  if (select used_at from public.recovery where code_hash = h4) is null then raise exception 'redeeming your own code did not spend it'; end if;

  -- a throwaway that still has ANOTHER identity is kept (only an orphan is deleted)
  select player_id into c from public.identity_resolve('selfcheck', 'zz-reccheck-c1', null);
  insert into public.identities (provider, subject, player_id) values ('selfcheck', 'zz-reccheck-c2', c);
  if public.recovery_mint(a, h5, 730) <> 'ok' then raise exception 'mint (third) did not store'; end if;
  select * into r from public.recovery_redeem('selfcheck', 'zz-reccheck-c1', h5);
  if r.status <> 'ok' or not exists (select 1 from public.players where id = c) then raise exception 'a player with another identity was deleted'; end if;

  -- the brake: eight refusals in an hour, then 'limited' (and a GOOD code is not spent by a limited try); another sign-in is unaffected
  select player_id into b from public.identity_resolve('selfcheck', 'zz-reccheck-brake', null);
  if public.recovery_mint(a, h6, 730) <> 'ok' then raise exception 'mint (fourth) did not store'; end if;
  for k in 1..8 loop
    select * into r from public.recovery_redeem('selfcheck', 'zz-reccheck-brake', repeat('8', 64));
    if r.status <> 'refused' then raise exception 'try % answered %', k, r.status; end if;
  end loop;
  select * into r from public.recovery_redeem('selfcheck', 'zz-reccheck-brake', h6);
  if r.status <> 'limited' then raise exception 'the ninth try answered %', r.status; end if;
  if (select used_at from public.recovery where code_hash = h6) is not null then raise exception 'a limited try spent the code'; end if;
  update public.recovery_attempts set at = now() - interval '2 hours' where subject = 'zz-reccheck-brake';
  select * into r from public.recovery_redeem('selfcheck', 'zz-reccheck-brake', h6);
  if r.status <> 'ok' then raise exception 'the brake did not lift after an hour: %', r.status; end if;
  if exists (select 1 from public.recovery_attempts where subject = 'zz-reccheck-brake') then raise exception 'a success left failed tries behind'; end if;

  -- cleanup
  delete from public.players where id in (select player_id from public.identities where subject like 'zz-reccheck%');
  delete from public.recovery_attempts where subject like 'zz-reccheck%';
  if exists (select 1 from public.identities where subject like 'zz-reccheck%') or exists (select 1 from public.recovery where code_hash in (h1, h6, h3, h4)) then
    raise exception 'the self-check left rows behind'; end if;
end $$;
select 'ok' as dawnblade_recovery;
