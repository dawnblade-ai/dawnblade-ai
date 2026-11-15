-- server/supabase/008_ladder.sql — THE PUBLIC LADDER AND THE RECENT RESULTS (SERVER S5.3). Run after 001..007; safe to run twice.
-- NOT RUN ON THE PROJECT: proven on PGlite (tools/sql-pglite.js, twice, with sabotage; record in server/S5-LOG.md). 001..007 are already on the live project and are
-- NOT edited: this file only ADDS two indexes and ONE read-only function.
--
-- WHAT IT ANSWERS (ladder_get, ONE jsonb): the top players by rating, the last few recorded ranked results, and, when a player id is given, that player's own line.
--   {"ladder": [{"rank","name","rating","games","wins","losses","draws"}, ...],
--    "recent": [{"names":[a,b],"heroes":[a,b],"winner":0|1|null,"how","at":<ms since 1970>}, ...],
--    "you":    {"name","rating","games","wins","losses","draws","listed","rank"}        -- only when p_player is given and is a player}
-- NOTHING ELSE LEAVES: no player id, no sign-in subject, no table code, no game id, no token (the self-check scans the whole answer for them).
--
-- WHO IS LISTED (the whole rule, in one WHERE): a player with a CHOSEN NAME (display_name and its fold are set), at least `p_floor` recorded ranked games, and at least ONE
-- SIGN-IN pointing at them. The last clause is 007's recovery rule: a throwaway kept orphaned after a recovery has its name freed and no sign-in, so it can never be on the
-- ladder (a rating nobody can play on is not a standing). A nameless player never appears. Fewer games than the floor is "provisional": rated, not listed.
-- THE ORDER is a total order: rating desc, then more games, then the name's fold (unique, so no two players tie) in byte order. `rank` is the position in that order.
-- BOUNDED WORK, NO WRITES: one query over `ratings` through ratings_ladder_idx (rating, games) limited to `p_limit`, a join to players by primary key and a sign-in probe by
-- identities_player_idx per candidate row (never a call per row from the function: the whole answer is one statement); the recent list is a LIMIT over results_ended_idx;
-- the caller's rank is one COUNT. The function is STABLE (it cannot write) and is never given a way to create a row for a player it reads.
-- The numbers (floor 3, top 50, last 10) belong to the Edge Function (server/referee.js), which passes them in; here they are only bounded (floor 1..1000, limit 1..100,
-- recent 0..50), so a change of rule is a function redeploy, not a database change.

create index if not exists ratings_ladder_idx on public.ratings (rating desc, games desc);
create index if not exists results_ended_idx on public.results (ended_at desc, game_id desc);

create or replace function public.ladder_get(p_floor integer, p_limit integer, p_recent integer, p_player text default null)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare lad jsonb; rec jsonb; ans jsonb; me record; mine_name text; mine_fold text; listed boolean := false; ahead bigint; rk integer;
begin
  if p_floor is null or p_floor < 1 or p_floor > 1000 then raise exception 'ladder_get: the floor is 1 to 1000'; end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 then raise exception 'ladder_get: the list is 1 to 100 long'; end if;
  if p_recent is null or p_recent < 0 or p_recent > 50 then raise exception 'ladder_get: recent results are 0 to 50'; end if;

  select coalesce(jsonb_agg(jsonb_build_object('rank', t.rk, 'name', t.display_name, 'rating', t.rating, 'games', t.games, 'wins', t.wins, 'losses', t.losses, 'draws', t.draws) order by t.rk), '[]'::jsonb)
    into lad
    from (select row_number() over (order by r.rating desc, r.games desc, p.name_fold collate "C") as rk, p.display_name, r.rating, r.games, r.wins, r.losses, r.draws
            from public.ratings r join public.players p on p.id = r.player_id
           where r.games >= p_floor and p.display_name is not null and p.name_fold is not null
             and exists (select 1 from public.identities i where i.player_id = p.id)
           order by r.rating desc, r.games desc, p.name_fold collate "C"
           limit p_limit) t;

  select coalesce(jsonb_agg(jsonb_build_object('names', jsonb_build_array(x.name_0, x.name_1), 'heroes', jsonb_build_array(x.hero_0, x.hero_1), 'winner', x.winner, 'how', x.how,
                                               'at', (extract(epoch from x.ended_at) * 1000)::bigint) order by x.ended_at desc, x.game_id desc), '[]'::jsonb)
    into rec
    from (select * from public.results order by ended_at desc, game_id desc limit p_recent) x;

  ans := jsonb_build_object('ladder', lad, 'recent', rec);

  if p_player is not null then
    select pl.display_name, pl.name_fold into mine_name, mine_fold from public.players pl where pl.id = p_player;
    if found then
      select coalesce(r.rating, public.rating_start()) as rating, coalesce(r.games, 0) as games, coalesce(r.wins, 0) as wins, coalesce(r.losses, 0) as losses, coalesce(r.draws, 0) as draws
        into me from (select 1) one left join public.ratings r on r.player_id = p_player;
      listed := me.games >= p_floor and mine_name is not null and mine_fold is not null and exists (select 1 from public.identities i where i.player_id = p_player);
      if listed then
        select count(*) into ahead from public.ratings r2 join public.players p2 on p2.id = r2.player_id
         where r2.games >= p_floor and p2.display_name is not null and p2.name_fold is not null and exists (select 1 from public.identities i2 where i2.player_id = p2.id)
           and (r2.rating > me.rating or (r2.rating = me.rating and (r2.games > me.games or (r2.games = me.games and p2.name_fold collate "C" < mine_fold collate "C"))));
        rk := ahead + 1;
      end if;
      ans := ans || jsonb_build_object('you', jsonb_build_object('name', mine_name, 'rating', me.rating, 'games', me.games, 'wins', me.wins, 'losses', me.losses, 'draws', me.draws,
                                                                'listed', listed, 'rank', rk));
    end if;
  end if;
  return ans;
end;
$$;

revoke all on function public.ladder_get(integer, integer, integer, text) from public, anon, authenticated;
grant execute on function public.ladder_get(integer, integer, integer, text) to service_role;
notify pgrst, 'reload schema';

-- ---- self-check (idempotent; leaves nothing behind; raises an error naming what is wrong, or ends with one row, 'ok') ----
-- It runs on a project that holds real players, so every assertion is about the Zz Lad players it makes (found by name in the answer), never about absolute ranks.
do $$
declare a text; b text; c text; d text; e text; f text; g text; h text; r jsonb; s text; names text[]; n int; before_counts text; after_counts text; ids text;
begin
  s := 'public.ladder_get(integer,integer,integer,text)';
  if has_function_privilege('anon', s, 'execute') or has_function_privilege('authenticated', s, 'execute') then raise exception 'anon or authenticated may call ladder_get'; end if;
  if not has_function_privilege('service_role', s, 'execute') then raise exception 'service_role may not call ladder_get'; end if;
  if (select provolatile from pg_proc where oid = s::regprocedure) <> 's' then raise exception 'ladder_get is not STABLE: it must not be able to write'; end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'ratings_ladder_idx') or not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'results_ended_idx') then
    raise exception 'the ladder indexes are missing'; end if;

  delete from public.results where game_id like 'zz-lad-%';
  delete from public.players where id in (select player_id from public.identities where subject like 'zz-ladcheck%');
  delete from public.players where display_name like 'Zz Lad %';
  select player_id into a from public.identity_resolve('selfcheck', 'zz-ladcheck-a', null);   -- Aye: 1700, 5 games
  select player_id into b from public.identity_resolve('selfcheck', 'zz-ladcheck-b', null);   -- Bee: 1500, 5 games
  select player_id into c from public.identity_resolve('selfcheck', 'zz-ladcheck-c', null);   -- Cee: 1500, 5 games  (ties Bee on rating and games: the name decides)
  select player_id into d from public.identity_resolve('selfcheck', 'zz-ladcheck-d', null);   -- Dee: 1500, 6 games (more games than Bee and Cee: above them)
  select player_id into e from public.identity_resolve('selfcheck', 'zz-ladcheck-e', null);   -- Eee: 1900, 2 games (under the floor: provisional)
  select player_id into f from public.identity_resolve('selfcheck', 'zz-ladcheck-f', null);   -- Fee: 1950, 9 games but NO NAME
  select player_id into g from public.identity_resolve('selfcheck', 'zz-ladcheck-g', null);   -- Gee: 1960, 9 games, named, then ORPHANED (no sign-in)
  select player_id into h from public.identity_resolve('selfcheck', 'zz-ladcheck-h', null);   -- Hee: nobody has rated them
  if public.player_rename(a, 'Zz Lad Aye', 'zzladaye') <> 'ok' or public.player_rename(b, 'Zz Lad Bee', 'zzladbee') <> 'ok' or public.player_rename(c, 'Zz Lad Cee', 'zzladcee') <> 'ok'
     or public.player_rename(d, 'Zz Lad Dee', 'zzladdee') <> 'ok' or public.player_rename(e, 'Zz Lad Eee', 'zzladeee') <> 'ok' or public.player_rename(g, 'Zz Lad Gee', 'zzladgee') <> 'ok'
     or public.player_rename(h, 'Zz Lad Hee', 'zzladhee') <> 'ok' then raise exception 'could not name the check players'; end if;
  insert into public.ratings (player_id, rating, games, wins, losses, draws) values (a, 1700, 5, 3, 2, 0), (b, 1500, 5, 2, 2, 1), (c, 1500, 5, 5, 0, 0), (d, 1500, 6, 6, 0, 0),
    (e, 1900, 2, 2, 0, 0), (f, 1950, 9, 9, 0, 0), (g, 1960, 9, 9, 0, 0);
  delete from public.identities where player_id = g;                                               -- an orphan: its name is still on the row, nothing signs in as it

  -- LISTING AND ORDER: Aye, Dee, Bee, Cee, in that order; the provisional, the nameless, the orphan and the unrated are not there
  r := public.ladder_get(3, 100, 10, null);
  select array_agg(x->>'name' order by (x->>'rank')::int) into names from jsonb_array_elements(r->'ladder') x where x->>'name' like 'Zz Lad %';
  if names is distinct from array['Zz Lad Aye', 'Zz Lad Dee', 'Zz Lad Bee', 'Zz Lad Cee'] then raise exception 'the check ladder reads % (want Aye, Dee, Bee, Cee: rating, then more games, then name)', names; end if;
  if (select count(*) from jsonb_array_elements(r->'ladder') x where x->>'name' in ('Zz Lad Eee', 'Zz Lad Gee', 'Zz Lad Hee')) <> 0 then raise exception 'a provisional, orphaned or unrated player is on the ladder'; end if;
  if exists (select 1 from jsonb_array_elements(r->'ladder') x where x->>'name' is null) then raise exception 'a nameless player is on the ladder'; end if;
  -- ranks are the positions 1..n, with no gap or repeat, and the list is in rating order
  select count(*) into n from jsonb_array_elements(r->'ladder') x; if (select array_agg((x->>'rank')::int order by (x->>'rank')::int) from jsonb_array_elements(r->'ladder') x) is distinct from (select array_agg(i) from generate_series(1, n) i) then raise exception 'the ranks are not 1..n'; end if;
  if exists (select 1 from jsonb_array_elements(r->'ladder') x, jsonb_array_elements(r->'ladder') y where (x->>'rank')::int + 1 = (y->>'rank')::int and (x->>'rating')::int < (y->>'rating')::int) then raise exception 'the ladder is not in rating order'; end if;
  if (select (x->>'wins')::int || '/' || (x->>'losses')::int || '/' || (x->>'draws')::int from jsonb_array_elements(r->'ladder') x where x->>'name' = 'Zz Lad Bee') <> '2/2/1' then raise exception 'the record is not carried'; end if;
  -- THE FLOOR is a parameter: at 6 only Dee stays; at 2 the provisional player joins; a nameless or orphaned one never does
  r := public.ladder_get(6, 100, 0, null);
  select array_agg(x->>'name') into names from jsonb_array_elements(r->'ladder') x where x->>'name' like 'Zz Lad %'; if names is distinct from array['Zz Lad Dee'] then raise exception 'at floor 6 the check ladder reads %', names; end if;
  r := public.ladder_get(2, 100, 0, null);
  if not exists (select 1 from jsonb_array_elements(r->'ladder') x where x->>'name' = 'Zz Lad Eee') then raise exception 'at floor 2 the 2-game player is missing'; end if;
  if exists (select 1 from jsonb_array_elements(r->'ladder') x where x->>'name' in ('Zz Lad Gee', 'Zz Lad Hee')) then raise exception 'an orphan or an unrated player was listed at floor 2'; end if;
  if jsonb_array_length(r->'recent') <> 0 then raise exception 'recent 0 answered results'; end if;
  -- THE CAP: one row when asked for one, and it is the best listed player
  r := public.ladder_get(3, 1, 0, null); if jsonb_array_length(r->'ladder') <> 1 or (r->'ladder'->0->>'rank') <> '1' then raise exception 'the cap of 1 answered %', r->'ladder'; end if;
  begin perform public.ladder_get(3, 101, 10, null); raise exception 'a list of 101 was allowed'; exception when raise_exception then if sqlerrm like 'a list of%' then raise; end if; end;
  begin perform public.ladder_get(0, 10, 10, null); raise exception 'a floor of 0 was allowed'; exception when raise_exception then if sqlerrm like 'a floor of%' then raise; end if; end;
  begin perform public.ladder_get(3, 10, 51, null); raise exception 'fifty-one recent results were allowed'; exception when raise_exception then if sqlerrm like 'fifty-one%' then raise; end if; end;

  -- THE CALLER'S LINE: a listed player gets their position (checked against an independent count), an unlisted one their rating and games, a stranger none
  r := public.ladder_get(3, 100, 0, c);
  select count(*) + 1 into n from public.ratings r2 join public.players p2 on p2.id = r2.player_id
   where r2.games >= 3 and p2.display_name is not null and p2.name_fold is not null and exists (select 1 from public.identities i where i.player_id = p2.id)
     and (r2.rating, r2.games) > (1500, 5);
  select n + count(*) into n from public.ratings r2 join public.players p2 on p2.id = r2.player_id
   where r2.games = 5 and r2.rating = 1500 and p2.display_name is not null and p2.name_fold is not null and exists (select 1 from public.identities i where i.player_id = p2.id) and p2.name_fold collate "C" < 'zzladcee' collate "C";
  if (r->'you'->>'listed') <> 'true' or (r->'you'->>'rank')::int <> n or r->'you'->>'name' <> 'Zz Lad Cee' or (r->'you'->>'rating')::int <> 1500 then raise exception 'the listed caller reads % (want rank %)', r->'you', n; end if;
  if (select (x->>'rank')::int from jsonb_array_elements(r->'ladder') x where x->>'name' = 'Zz Lad Cee') <> n then raise exception 'the caller''s rank is not their place in the list'; end if;
  r := public.ladder_get(3, 1, 0, c);                                                                  -- listed but below the cap of the list: still ranked
  if (r->'you'->>'listed') <> 'true' or (r->'you'->>'rank')::int <> n then raise exception 'a caller below the cap lost their rank: %', r->'you'; end if;
  r := public.ladder_get(3, 100, 0, e); if (r->'you'->>'listed') <> 'false' or (r->'you'->'rank') <> 'null'::jsonb or (r->'you'->>'games')::int <> 2 or (r->'you'->>'rating')::int <> 1900 then raise exception 'the provisional caller reads %', r->'you'; end if;
  r := public.ladder_get(3, 100, 0, h); if (r->'you'->>'listed') <> 'false' or (r->'you'->>'games')::int <> 0 or (r->'you'->>'rating')::int <> 1200 then raise exception 'an unrated caller reads %', r->'you'; end if;
  r := public.ladder_get(3, 100, 0, f); if (r->'you'->>'listed') <> 'false' or (r->'you'->>'games')::int <> 9 or (r->'you'->'name') <> 'null'::jsonb then raise exception 'a nameless caller with games reads %', r->'you'; end if;
  r := public.ladder_get(3, 100, 0, g); if (r->'you'->>'listed') <> 'false' then raise exception 'an orphan reads as listed'; end if;
  r := public.ladder_get(3, 100, 0, 'no-such-player'); if r ? 'you' then raise exception 'a stranger got a line'; end if;
  r := public.ladder_get(3, 100, 0, null); if r ? 'you' then raise exception 'no caller, yet a line'; end if;

  -- RECENT RESULTS: newest first, capped, and exactly their public fields
  perform public.result_record('zz-lad-1', 'ZZLAD1', a, b, 'Zz Lad Aye', 'Zz Lad Bee', 'kayo', 'dash', 0, 'life', 7, 'test', 1700000000000, 1700000600000);
  perform public.result_record('zz-lad-2', 'ZZLAD2', c, d, 'Zz Lad Cee', 'Zz Lad Dee', 'katsu', 'dorinthea', 1, 'concession', 9, 'test', 0, 1700000700000);
  perform public.result_record('zz-lad-3', 'ZZLAD3', a, c, 'Zz Lad Aye', 'Zz Lad Cee', 'kayo', 'katsu', null, 'stalemate', 40, null, 0, 1700000800000);
  perform public.result_record('zz-lad-4', 'ZZLAD4', b, d, 'Zz Lad Bee', 'Zz Lad Dee', 'dash', 'dorinthea', 0, 'forfeit', 0, null, 0, 1700000900000);
  update public.results set ended_at = to_timestamp(1900000000 + (substr(game_id, 8))::int) where game_id like 'zz-lad-%';   -- far in the future: ours are the newest of any real result
  r := public.ladder_get(3, 100, 3, null);
  if jsonb_array_length(r->'recent') <> 3 then raise exception 'recent 3 answered % results', jsonb_array_length(r->'recent'); end if;
  if r->'recent'->0 <> '{"names": ["Zz Lad Bee", "Zz Lad Dee"], "heroes": ["dash", "dorinthea"], "winner": 0, "how": "forfeit", "at": 1900000004000}'::jsonb then raise exception 'the newest result reads %', r->'recent'->0; end if;
  if r->'recent'->1 <> '{"names": ["Zz Lad Aye", "Zz Lad Cee"], "heroes": ["kayo", "katsu"], "winner": null, "how": "stalemate", "at": 1900000003000}'::jsonb then raise exception 'a draw reads %', r->'recent'->1; end if;
  if (select array_agg(k order by k) from jsonb_object_keys(r->'recent'->0) k) is distinct from array['at', 'heroes', 'how', 'names', 'winner'] then raise exception 'a result has other fields than its public ones'; end if;
  if (select array_agg(k order by k) from jsonb_object_keys(r->'ladder'->0) k) is distinct from array['draws', 'games', 'losses', 'name', 'rank', 'rating', 'wins'] then raise exception 'a ladder row has other fields than its public ones'; end if;
  if (select array_agg(k order by k) from jsonb_object_keys((public.ladder_get(3, 100, 0, c))->'you') k) is distinct from array['draws', 'games', 'listed', 'losses', 'name', 'rank', 'rating', 'wins'] then raise exception 'the caller''s line has other fields than its public ones'; end if;
  -- the ratings above moved with the games: the ladder reads what result_record left, never a copy
  select (x->>'games')::int into n from jsonb_array_elements(public.ladder_get(3, 100, 0, null)->'ladder') x where x->>'name' = 'Zz Lad Aye'; if n <> 7 then raise exception 'the ladder does not read the live ratings (Aye has % games, want 7)', n; end if;

  -- NO LEAK: the whole answer, as text, holds no player id, no sign-in subject, no game id and no table code of the check
  ids := (public.ladder_get(3, 100, 50, c))::text;
  if position('zz-ladcheck' in ids) > 0 or position('zz-lad-' in ids) > 0 or position('ZZLAD' in ids) > 0 then raise exception 'the ladder answer leaks a subject, a game id or a table code'; end if;
  for n in 1..8 loop
    if position((array[a, b, c, d, e, f, g, h])[n] in ids) > 0 then raise exception 'the ladder answer holds a player id'; end if;
  end loop;

  -- NO WRITES: reading the ladder (with and without a caller, for a stranger and for an unrated player) changes no row anywhere
  select (select count(*) from public.players) || '/' || (select count(*) from public.ratings) || '/' || (select count(*) from public.results) || '/' || (select count(*) from public.identities) || '/' || (select count(*) from public.tables)
       || '/' || (select coalesce(sum(extract(epoch from last_seen_at)), 0) from public.players) into before_counts;
  perform public.ladder_get(3, 50, 10, null); perform public.ladder_get(3, 50, 10, h); perform public.ladder_get(3, 50, 10, 'no-such-player'); perform public.ladder_get(3, 50, 10, a);
  select (select count(*) from public.players) || '/' || (select count(*) from public.ratings) || '/' || (select count(*) from public.results) || '/' || (select count(*) from public.identities) || '/' || (select count(*) from public.tables)
       || '/' || (select coalesce(sum(extract(epoch from last_seen_at)), 0) from public.players) into after_counts;
  if before_counts <> after_counts then raise exception 'reading the ladder changed a row: % -> %', before_counts, after_counts; end if;
  if exists (select 1 from public.ratings where player_id = 'no-such-player') then raise exception 'reading made a rating row'; end if;

  delete from public.results where game_id like 'zz-lad-%';
  delete from public.players where id in (select player_id from public.identities where subject like 'zz-ladcheck%') or id = g;
  delete from public.players where display_name like 'Zz Lad %';
  if exists (select 1 from public.results where game_id like 'zz-lad-%') or exists (select 1 from public.ratings where player_id in (a, b, c, d, e, f, g, h)) or exists (select 1 from public.players where id in (a, b, c, d, e, f, g, h)) then
    raise exception 'the self-check left rows behind'; end if;
end $$;
select 'ok' as dawnblade_ladder;
