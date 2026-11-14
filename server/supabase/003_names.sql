-- server/supabase/003_names.sql — DISPLAY NAMES ARE UNIQUE (SERVER S4.2). Run after 002_players.sql; safe to run twice.
--
-- RULING (user, 2026-11-14): display names are unique, case-folded. The FOLD is computed by the function (server/referee.js
-- `nameFold`: lower case, spaces gone, look-alike digits and Cyrillic/Greek letters levelled to Latin), so "Dawn Smith",
-- "dawnsmith" and "Dawn Sm1th" are one name. The database only stores the fold beside the name and lets ONE player hold it:
-- the unique index is the whole race story (two phones asking for the same free name at once: one wins, one reads 'taken').
-- Nothing here is readable or callable with the publishable key: RLS stays forced with zero policies (002), and the function
-- below is granted to service_role only.

alter table public.players add column if not exists name_fold text
  check (name_fold is null or char_length(name_fold) between 1 and 64);
create unique index if not exists players_name_fold_key on public.players (name_fold) where name_fold is not null;

-- player_rename(player, name, fold): 'ok' (stored; also when the player already holds that fold), 'taken' (another player holds
-- the fold), 'unknown' (no such player). The name was validated by the function; the table's own check still bounds its length.
create or replace function public.player_rename(p_player text, p_name text, p_fold text)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare n int;
begin
  if p_name is null or p_fold is null or p_fold = '' then raise exception 'player_rename needs a name and its fold'; end if;
  begin
    update public.players set display_name = p_name, name_fold = p_fold, last_seen_at = now() where id = p_player;
    get diagnostics n = row_count;
  exception when unique_violation then return 'taken';
  end;
  if n = 0 then return 'unknown'; end if;
  return 'ok';
end;
$$;

revoke all on function public.player_rename(text, text, text) from public, anon, authenticated;
grant execute on function public.player_rename(text, text, text) to service_role;
notify pgrst, 'reload schema';

-- ---- self-check (leaves nothing behind) ----
do $$
declare a text; b text; r text;
begin
  delete from public.players where id in (select player_id from public.identities where subject like 'zz-namecheck%');
  select player_id into a from public.identity_resolve('selfcheck', 'zz-namecheck-a', null);
  select player_id into b from public.identity_resolve('selfcheck', 'zz-namecheck-b', null);
  r := public.player_rename(a, 'Zz Name Check', 'zznamecheck');
  if r <> 'ok' then raise exception 'a free name was not stored: %', r; end if;
  r := public.player_rename(a, 'ZZ NameCheck', 'zznamecheck');
  if r <> 'ok' then raise exception 'a player could not restyle the name they hold: %', r; end if;
  if (select display_name from public.players where id = a) <> 'ZZ NameCheck' then raise exception 'the restyled name was not stored'; end if;
  r := public.player_rename(b, 'zz namecheck', 'zznamecheck');
  if r <> 'taken' then raise exception 'two players hold one fold: %', r; end if;
  if (select display_name from public.players where id = b) is not null then raise exception 'a refused name was stored'; end if;
  r := public.player_rename(b, 'Zz Other Check', 'zzothercheck');
  if r <> 'ok' then raise exception 'a second free name was not stored: %', r; end if;
  r := public.player_rename('no-such-player', 'Zz Nobody', 'zznobody');
  if r <> 'unknown' then raise exception 'a missing player was renamed: %', r; end if;
  if has_function_privilege('anon', 'public.player_rename(text, text, text)', 'execute') then raise exception 'anon may call player_rename'; end if;
  if has_function_privilege('authenticated', 'public.player_rename(text, text, text)', 'execute') then raise exception 'authenticated may call player_rename'; end if;
  if (select display_name from public.identity_resolve('selfcheck', 'zz-namecheck-a', null)) <> 'ZZ NameCheck' then raise exception 'identity_resolve does not read the stored name'; end if;
  delete from public.players where id in (select player_id from public.identities where subject like 'zz-namecheck%');
end $$;
select 'ok' as dawnblade_names;
