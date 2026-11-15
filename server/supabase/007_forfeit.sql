-- server/supabase/007_forfeit.sql — THE FORFEIT CLOCK'S RESULT AND THE RECOVERY RULE FOR RATINGS (SERVER S5.2). Run after 001..006; safe to run twice.
-- NOT RUN ON THE PROJECT: proven on PGlite (tools/sql-pglite.js, twice, with sabotage) and, for the one race claim, on a real Postgres (tools/sql-race.sh); record in server/S5-LOG.md.
-- 001..006 are already on the live project and are NOT edited: this file only ADDS and REPLACES two functions.
--
-- (1) A FIFTH WAY TO END A RANKED GAME: 'forfeit'. The function (server/referee.js) ends an abandoned ranked game for the player the table has been waiting on past the
--     limit (the forfeit clock, claimed by the other player) and records it like any result: the absent seat loses, a winner is always named, the Elo move is the
--     same as for a concession. `results.how` now allows 'life', 'concession', 'stalemate', 'forfeit'; result_record is replaced below with the SAME body as 006 except
--     that one list. (A draw is still exactly a stalemate: the table check of 006 is untouched and a forfeit with no winner raises.)
--
-- (2) RECOVERY MUST NOT THROW A RATING AWAY (recovery_redeem, 004). A recovery code moves the NEW phone's sign-in to the recovered player. The phone's own throwaway
--     player, left with no sign-in, used to be DELETED, and ratings cascade with the player. THE RULE NOW:
--       * the RECOVERED player's rating, record and results are never touched (nothing here writes them);
--       * a throwaway with NO ranked footprint (no rated game, no result row naming it, no seat at an unfinished ranked table) is deleted exactly as in v6.30;
--       * a throwaway WITH a ranked footprint is KEPT, ORPHANED BUT INTACT: its player row, its rating and record and its results stay as they were, its display
--         name is freed (a name is unique and an orphan can no longer be called anything), its unused recovery codes are deleted, and no sign-in points at it, so
--         nothing can ever sit down as it again. It is never merged into the recovered player (a rating cannot be carried from one player to another this way) and the
--         redeem is not refused (a lost phone must stay recoverable even after the new phone played a ranked game).
--     WHY THIS ONE. Deleting loses real rating history and makes an unfinished ranked game unrecordable (result_record needs both players to exist: leaving a
--     lost game by recovering away would dodge it). Merging would let one player's record flow into another's, and refusing would strand a legitimate owner of a
--     lost phone forever. Keeping the orphan changes no one's rating and leaves the opponent's result intact; the cost is a dormant row.
--     RE-RUNNING 004 OR 006 AFTER THIS FILE puts the old function bodies back: run this file again after either.

alter table public.results drop constraint if exists results_how_check;
alter table public.results add constraint results_how_check check (how in ('life', 'concession', 'stalemate', 'forfeit'));

create or replace function public.result_record(p_game text, p_table text, p_p0 text, p_p1 text, p_n0 text, p_n1 text, p_h0 text, p_h1 text,
                                                p_winner integer, p_how text, p_turns integer, p_build text, p_started bigint, p_ended bigint)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare k integer := public.rating_k(); ra integer; rb integer; ea numeric; sa numeric; na integer; nb integer; ex public.results%rowtype;
begin
  if p_game is null or p_game !~ '^[A-Za-z0-9_-]{1,80}$' or p_table is null or p_table !~ '^[A-Za-z0-9_-]{1,32}$' then raise exception 'result_record needs a game id and a table id'; end if;
  if p_p0 is null or p_p1 is null or p_p0 = '' or p_p1 = '' or p_p0 = p_p1 then raise exception 'result_record needs two different players'; end if;
  if p_how is null or p_how not in ('life', 'concession', 'stalemate', 'forfeit') then raise exception 'result_record: unknown way to end a game'; end if;
  if p_winner is not null and p_winner not in (0, 1) then raise exception 'result_record: the winner is seat 0, seat 1 or nobody'; end if;
  if (p_how = 'stalemate') <> (p_winner is null) then raise exception 'result_record: a draw is exactly a stalemate'; end if;
  if p_h0 is null or p_h1 is null or p_turns is null or p_turns < 0 then raise exception 'result_record needs both heroes and a turn count'; end if;
  perform pg_advisory_xact_lock(hashtextextended('dawnblade-rating|' || least(p_p0, p_p1), 0));
  perform pg_advisory_xact_lock(hashtextextended('dawnblade-rating|' || greatest(p_p0, p_p1), 0));
  -- recorded already (a replay, a resync, a takeover, a retry): the stored answer, and nothing moves
  select * into ex from public.results where game_id = p_game;
  if found then
    return jsonb_build_object('recorded', false, 'ratings', jsonb_build_array(
      jsonb_build_object('from', ex.rating_0_before, 'to', ex.rating_0_after), jsonb_build_object('from', ex.rating_1_before, 'to', ex.rating_1_after)));
  end if;
  insert into public.ratings (player_id) select id from public.players where id in (p_p0, p_p1) on conflict (player_id) do nothing;
  select rating into ra from public.ratings where player_id = p_p0;
  select rating into rb from public.ratings where player_id = p_p1;
  if ra is null or rb is null then raise exception 'result_record: a player is unknown'; end if;
  sa := case when p_winner is null then 0.5 when p_winner = 0 then 1 else 0 end;
  ea := 1 / (1 + power(10::numeric, (rb - ra)::numeric / 400));
  na := round(ra + k * (sa - ea));
  nb := round(rb + k * ((1 - sa) - (1 - ea)));
  update public.ratings set rating = na, games = games + 1, updated_at = now(),
         wins = wins + (case when p_winner = 0 then 1 else 0 end), losses = losses + (case when p_winner = 1 then 1 else 0 end), draws = draws + (case when p_winner is null then 1 else 0 end)
   where player_id = p_p0;
  update public.ratings set rating = nb, games = games + 1, updated_at = now(),
         wins = wins + (case when p_winner = 1 then 1 else 0 end), losses = losses + (case when p_winner = 0 then 1 else 0 end), draws = draws + (case when p_winner is null then 1 else 0 end)
   where player_id = p_p1;
  insert into public.results (game_id, table_id, player_0, player_1, name_0, name_1, hero_0, hero_1, winner, how, turns, build,
                              rating_0_before, rating_0_after, rating_1_before, rating_1_after, started_at, ended_at)
  values (p_game, p_table, p_p0, p_p1, p_n0, p_n1, p_h0, p_h1, p_winner, p_how, p_turns, p_build, ra, na, rb, nb,
          case when coalesce(p_started, 0) > 0 then to_timestamp(p_started / 1000.0) end, case when coalesce(p_ended, 0) > 0 then to_timestamp(p_ended / 1000.0) else now() end);
  return jsonb_build_object('recorded', true, 'ratings', jsonb_build_array(jsonb_build_object('from', ra, 'to', na), jsonb_build_object('from', rb, 'to', nb)));
end;
$$;

create or replace function public.recovery_redeem(p_provider text, p_subject text, p_hash text)
returns table (status text, display_name text)
language plpgsql
security invoker
set search_path = public
as $$
declare cur text; tgt text; fails int; nm text; footprint boolean;
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
      -- the throwaway has no sign-in left. A RANKED FOOTPRINT keeps it (orphaned, intact); none and it goes, as in v6.30.
      footprint := exists (select 1 from public.ratings r where r.player_id = cur and r.games > 0)
                or exists (select 1 from public.results x where x.player_0 = cur or x.player_1 = cur)
                or exists (select 1 from public.tables t where t.row->>'ranked' = 'true' and coalesce(t.row->>'over', '') <> 'true' and (t.row->'owners') ? cur);
      if footprint then
        update public.players set display_name = null, name_fold = null where id = cur;     -- the name is freed; the row, its rating and its results stay
        delete from public.recovery where player_id = cur;                                    -- an orphan cannot be recovered into by a stray code
      else
        delete from public.players where id = cur;                                            -- the throwaway: no identity left, name freed
      end if;
    end if;
  end if;
  delete from public.recovery_attempts a where a.provider = p_provider and a.subject = p_subject;
  update public.players set last_seen_at = now() where id = tgt returning public.players.display_name into nm;
  return query select 'ok'::text, nm;
end;
$$;

revoke all on function public.result_record(text, text, text, text, text, text, text, text, integer, text, integer, text, bigint, bigint) from public, anon, authenticated;
revoke all on function public.recovery_redeem(text, text, text) from public, anon, authenticated;
grant execute on function public.result_record(text, text, text, text, text, text, text, text, integer, text, integer, text, bigint, bigint) to service_role;
grant execute on function public.recovery_redeem(text, text, text) to service_role;
notify pgrst, 'reload schema';

-- ---- self-check (idempotent; leaves nothing behind; raises an error naming what is wrong, or ends with one row, 'ok') ----
do $$
declare a text; b text; c text; d text; e text; f text; r jsonb; q record; s text; h1 text := repeat('a', 64); h2 text := repeat('b', 64); h3 text := repeat('c', 64); h4 text := repeat('d', 64); h5 text := repeat('e', 64);
begin
  foreach s in array array['public.result_record(text,text,text,text,text,text,text,text,integer,text,integer,text,bigint,bigint)', 'public.recovery_redeem(text,text,text)'] loop
    if has_function_privilege('anon', s, 'execute') or has_function_privilege('authenticated', s, 'execute') then raise exception 'anon or authenticated may call %', s; end if;
    if not has_function_privilege('service_role', s, 'execute') then raise exception 'service_role may not call %', s; end if;
  end loop;
  if (select length(prosrc) - length(replace(prosrc, 'pg_advisory_xact_lock', '')) from pg_proc where oid = 'public.result_record(text,text,text,text,text,text,text,text,integer,text,integer,text,bigint,bigint)'::regprocedure) / length('pg_advisory_xact_lock') < 2 then
    raise exception 'result_record lost its two player locks'; end if;
  if public.rating_start() <> 1200 or public.rating_k() <> 32 then raise exception 'the rating constants moved'; end if;

  delete from public.results where game_id like 'zz-fo-%';
  delete from public.tables where id like 'zz-fo-%';
  delete from public.players where id in (select player_id from public.identities where subject like 'zz-focheck%');
  select player_id into a from public.identity_resolve('selfcheck', 'zz-focheck-a', null);
  select player_id into b from public.identity_resolve('selfcheck', 'zz-focheck-b', null);

  -- (1) a forfeit is a result: the winner is named, the Elo move is a concession's, a forfeit with no winner is refused, other endings still are
  r := public.result_record('zz-fo-1', 'ZZFO', a, b, 'Aaa', 'Bbb', 'kayo', 'dash', 1, 'forfeit', 0, 'test', 0, 0);
  if r <> '{"recorded": true, "ratings": [{"from": 1200, "to": 1184}, {"from": 1200, "to": 1216}]}'::jsonb then raise exception 'a forfeit by seat 0 answered %', r; end if;
  if (select how from public.results where game_id = 'zz-fo-1') <> 'forfeit' then raise exception 'the forfeit was not stored as one'; end if;
  r := public.result_record('zz-fo-1', 'ZZFO', a, b, 'Aaa', 'Bbb', 'kayo', 'dash', 0, 'forfeit', 0, 'test', 0, 0);
  if (r->>'recorded') <> 'false' then raise exception 'a repeated forfeit was recorded twice'; end if;
  begin perform public.result_record('zz-fo-x', 'ZZFO', a, b, null, null, 'k', 'k', null, 'forfeit', 1, null, 0, 0); raise exception 'a forfeit with no winner was accepted';
  exception when raise_exception then if sqlerrm like 'a forfeit with no winner%' then raise; end if; end;
  begin perform public.result_record('zz-fo-x', 'ZZFO', a, b, null, null, 'k', 'k', 0, 'timeout', 1, null, 0, 0); raise exception 'an unknown ending was accepted';
  exception when raise_exception then if sqlerrm like 'an unknown ending%' then raise; end if; end;
  begin insert into public.results (game_id, table_id, player_0, player_1, hero_0, hero_1, winner, how, turns, rating_0_before, rating_0_after, rating_1_before, rating_1_after, ended_at)
          values ('zz-fo-y', 'ZZFO', a, b, 'k', 'k', 0, 'timeout', 1, 1, 1, 1, 1, now()); raise exception 'the table accepted an unknown ending';
  exception when check_violation then null; end;
  delete from public.results where game_id like 'zz-fo-%';
  delete from public.ratings where player_id in (a, b);                                   -- back to unrated, so the next numbers are exact

  -- (2) recovery. The recovered player (a) has a rating; each case is a new phone (a throwaway) redeeming a's code.
  perform public.result_record('zz-fo-2', 'ZZFO', a, b, null, null, 'kayo', 'dash', 0, 'life', 5, null, 0, 0);
  -- (2a) a throwaway with no ranked footprint: deleted, its name freed (v6.30's behaviour)
  select player_id into c from public.identity_resolve('selfcheck', 'zz-focheck-c', null);
  if public.player_rename(c, 'Zz Fo Cee', 'zzfocee') <> 'ok' then raise exception 'could not name the check player'; end if;
  perform public.recovery_mint(a, h1, 730);
  if (select status from public.recovery_redeem('selfcheck', 'zz-focheck-c', h1)) <> 'ok' then raise exception 'redeem (no footprint) was not ok'; end if;
  if exists (select 1 from public.players where id = c) then raise exception 'a throwaway with no ranked footprint was kept'; end if;
  if exists (select 1 from public.players where name_fold = 'zzfocee') then raise exception 'the deleted throwaway kept its name'; end if;
  -- (2b) a throwaway that played a ranked game: kept, orphaned, intact; its name freed; the recovered player's rating untouched
  select player_id into d from public.identity_resolve('selfcheck', 'zz-focheck-d', null);
  if public.player_rename(d, 'Zz Fo Dee', 'zzfodee') <> 'ok' then raise exception 'could not name the second check player'; end if;
  perform public.result_record('zz-fo-3', 'ZZFO', d, b, null, null, 'kayo', 'dash', 1, 'concession', 4, null, 0, 0);     -- d loses to b
  perform public.recovery_mint(d, h5, 730);                                                 -- the orphan's own unused code must go with the orphan's sign-in
  perform public.recovery_mint(a, h2, 730);
  select * into q from public.rating_get(a); if q.rating <> 1216 or q.games <> 1 then raise exception 'the recovered player is not at 1216 with one game before: %', q; end if;
  if (select status from public.recovery_redeem('selfcheck', 'zz-focheck-d', h2)) <> 'ok' then raise exception 'redeem (ranked footprint) was not ok'; end if;
  if not exists (select 1 from public.players where id = d) then raise exception 'a throwaway that played ranked was deleted: its rating went with it'; end if;
  select * into q from public.rating_get(d); if q.games <> 1 or q.losses <> 1 or q.rating >= 1200 then raise exception 'the orphan''s rating or record was changed: %', q; end if;
  if exists (select 1 from public.identities where player_id = d) then raise exception 'a sign-in still points at the orphan'; end if;
  if exists (select 1 from public.players where id = d and (display_name is not null or name_fold is not null)) then raise exception 'the orphan kept its name'; end if;
  if public.player_rename(a, 'Zz Fo Dee', 'zzfodee') <> 'ok' then raise exception 'the orphan''s name was not freed'; end if;
  if public.player_rename(a, 'Zz Fo Aye', 'zzfoaye') <> 'ok' then raise exception 'could not rename back'; end if;
  if exists (select 1 from public.recovery where player_id = d) then raise exception 'the orphan still has a recovery code'; end if;
  select * into q from public.rating_get(a); if q.rating <> 1216 or q.games <> 1 or q.wins <> 1 then raise exception 'recovery moved the recovered player''s rating: %', q; end if;
  if (select count(*) from public.results where player_0 = d or player_1 = d) <> 1 then raise exception 'the orphan''s result vanished'; end if;
  if (select player_id from public.identities where subject = 'zz-focheck-d') <> a then raise exception 'the new phone was not moved to the recovered player'; end if;
  -- (2c) a throwaway that holds a seat at an UNFINISHED ranked table: kept (leaving it by recovering away would dodge the game); one at a FINISHED ranked table: deleted
  select player_id into e from public.identity_resolve('selfcheck', 'zz-focheck-e', null);
  perform public.table_put('zz-fo-live', jsonb_build_object('v', 5, 'ranked', true, 'over', false, 'owners', jsonb_build_array(e, null)), 0);
  perform public.recovery_mint(a, h3, 730);
  perform public.recovery_redeem('selfcheck', 'zz-focheck-e', h3);
  if not exists (select 1 from public.players where id = e) then raise exception 'a throwaway seated at an unfinished ranked game was deleted'; end if;
  select player_id into f from public.identity_resolve('selfcheck', 'zz-focheck-f', null);
  perform public.table_put('zz-fo-done', jsonb_build_object('v', 5, 'ranked', true, 'over', true, 'owners', jsonb_build_array(f, null)), 0);
  perform public.table_put('zz-fo-casual', jsonb_build_object('v', 3, 'owners', jsonb_build_array(f, null)), 0);
  perform public.recovery_mint(a, h4, 730);
  perform public.recovery_redeem('selfcheck', 'zz-focheck-f', h4);
  if exists (select 1 from public.players where id = f) then raise exception 'a throwaway whose only seats were a finished ranked game and a casual table was kept'; end if;

  delete from public.results where game_id like 'zz-fo-%';
  delete from public.tables where id like 'zz-fo-%';
  delete from public.players where id in (select player_id from public.identities where subject like 'zz-focheck%') or id in (d, e, f, c);
  delete from public.recovery_attempts where subject like 'zz-focheck%';
  if exists (select 1 from public.results where game_id like 'zz-fo-%') or exists (select 1 from public.tables where id like 'zz-fo-%') or exists (select 1 from public.ratings where player_id in (a, b, c, d, e, f)) then
    raise exception 'the self-check left rows behind'; end if;
end $$;
select 'ok' as dawnblade_forfeit;
