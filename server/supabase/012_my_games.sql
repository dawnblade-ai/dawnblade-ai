-- server/supabase/012_my_games.sql — A PLAYER'S OWN LAST RANKED GAMES ON THE LADDER (V). Run after 001..011; safe to run twice.
-- NOT RUN ON THE PROJECT: proven on PGlite (tools/sql-pglite.js, twice; tools/sql-sab-012.js sabotages it). Nothing in 001..011 is edited: this file REPLACES ladder_get
-- (same signature, same body as 008) with ONE addition: when p_player is a player WITH A CHOSEN NAME, the answer carries
--   "mine": [{"hero","foeHero","foe","result":"won"|"lost"|"drew","how","change":<signed rating points>,"at":<ms>}, ...]   -- newest first, at most 10, [] when none yet
-- `foe` is the other seat's name as recorded (null when they had none). `hero` is the caller's own. `change` is rating_after - rating_before for the caller's seat.
-- A nameless or unknown caller gets NO `mine` key. Still STABLE, still no player id / game id / table code in the answer (self-check below scans for them). The two
-- indexes of 006 (player_0, ended_at) and (player_1, ended_at) serve the two arms; the work is two index scans and a limit of 10.

create or replace function public.ladder_get(p_floor integer, p_limit integer, p_recent integer, p_player text default null)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare lad jsonb; rec jsonb; ans jsonb; me record; mine_name text; mine_fold text; listed boolean := false; ahead bigint; rk integer; mine jsonb;
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

      -- 012: a NAMED caller's own last ranked games (a nameless caller gets no `mine` key at all: the page shows nothing new)
      if mine_name is not null then
        select coalesce(jsonb_agg(jsonb_build_object('hero', g.hero, 'foeHero', g.foe_hero, 'foe', g.foe, 'result', g.result, 'how', g.how, 'change', g.change, 'at', (extract(epoch from g.ended_at) * 1000)::bigint)
                                  order by g.ended_at desc, g.game_id desc), '[]'::jsonb)
          into mine
          from (select * from (
                  select x.game_id, x.ended_at, x.hero_0 as hero, x.hero_1 as foe_hero, x.name_1 as foe, x.how, x.rating_0_after - x.rating_0_before as change,
                         case when x.winner is null then 'drew' when x.winner = 0 then 'won' else 'lost' end as result
                    from public.results x where x.player_0 = p_player
                  union all
                  select x.game_id, x.ended_at, x.hero_1, x.hero_0, x.name_0, x.how, x.rating_1_after - x.rating_1_before,
                         case when x.winner is null then 'drew' when x.winner = 1 then 'won' else 'lost' end
                    from public.results x where x.player_1 = p_player) u
                 order by u.ended_at desc, u.game_id desc limit 10) g;
        ans := ans || jsonb_build_object('mine', mine);
      end if;
    end if;
  end if;
  return ans;
end;
$$;


revoke all on function public.ladder_get(integer, integer, integer, text) from public, anon, authenticated;
grant execute on function public.ladder_get(integer, integer, integer, text) to service_role;
notify pgrst, 'reload schema';

-- ---- self-check (idempotent; leaves nothing behind) ----
do $$
declare a text; b text; c text; d text; r jsonb; s text; n int; ids text; before_counts text; after_counts text;
begin
  s := 'public.ladder_get(integer,integer,integer,text)';
  if has_function_privilege('anon', s, 'execute') or has_function_privilege('authenticated', s, 'execute') then raise exception 'anon or authenticated may call ladder_get'; end if;
  if not has_function_privilege('service_role', s, 'execute') then raise exception 'service_role may not call ladder_get'; end if;
  if (select provolatile from pg_proc where oid = s::regprocedure) <> 's' then raise exception 'ladder_get is not STABLE'; end if;
  delete from public.results where game_id like 'zz-my-%';
  delete from public.players where id in (select player_id from public.identities where subject like 'zz-mycheck%');
  delete from public.players where display_name like 'Zz My %';
  select player_id into a from public.identity_resolve('selfcheck', 'zz-mycheck-a', null);   -- Aye: named, plays three
  select player_id into b from public.identity_resolve('selfcheck', 'zz-mycheck-b', null);   -- Bee: named, plays Aye
  select player_id into c from public.identity_resolve('selfcheck', 'zz-mycheck-c', null);   -- Cee: NO name, plays Aye once
  select player_id into d from public.identity_resolve('selfcheck', 'zz-mycheck-d', null);   -- Dee: named, no games
  if public.player_rename(a, 'Zz My Aye', 'zzmyaye') <> 'ok' or public.player_rename(b, 'Zz My Bee', 'zzmybee') <> 'ok' or public.player_rename(d, 'Zz My Dee', 'zzmydee') <> 'ok' then raise exception 'could not name the check players'; end if;
  insert into public.ratings (player_id, rating, games) values (a, 1200, 0), (b, 1200, 0), (c, 1200, 0) on conflict (player_id) do nothing;
  -- three ranked games of Aye's, one at each seat: a win as seat 0, a loss as seat 1, a draw as seat 0; and one game Aye is not in
  perform public.result_record('zz-my-1', 'ZZMY1', a, b, 'Zz My Aye', 'Zz My Bee', 'kayo', 'dash', 0, 'life', 9, 'test', 0, 1700000100000);
  perform public.result_record('zz-my-2', 'ZZMY2', b, a, 'Zz My Bee', 'Zz My Aye', 'katsu', 'dorinthea', 0, 'concession', 9, 'test', 0, 1700000200000);
  perform public.result_record('zz-my-3', 'ZZMY3', a, c, 'Zz My Aye', null, 'kayo', 'rhinar', null, 'stalemate', 40, null, 0, 1700000300000);
  perform public.result_record('zz-my-4', 'ZZMY4', b, c, 'Zz My Bee', null, 'dash', 'rhinar', 1, 'forfeit', 0, null, 0, 1700000400000);
  update public.results set ended_at = to_timestamp(1900000000 + (substr(game_id, 7))::int) where game_id like 'zz-my-%';

  r := public.ladder_get(3, 100, 0, a);
  if jsonb_array_length(r->'mine') <> 3 then raise exception 'Aye has % games in mine, want 3', jsonb_array_length(r->'mine'); end if;
  if (select array_agg(x->>'result' order by ord) from jsonb_array_elements(r->'mine') with ordinality t(x, ord)) is distinct from array['drew', 'lost', 'won'] then raise exception 'the results read % (newest first: drew, lost, won)', r->'mine'; end if;
  if (r->'mine'->0->>'hero') <> 'kayo' or (r->'mine'->0->>'foeHero') <> 'rhinar' or (r->'mine'->0->'foe') <> 'null'::jsonb then raise exception 'the draw''s heroes read %', r->'mine'->0; end if;
  -- seat 1's game is read from seat 1's side: Aye was seat 1 with dorinthea against Bee's katsu, and lost? No: winner 0 is Bee (seat 0), so Aye lost
  if (r->'mine'->1->>'hero') <> 'dorinthea' or (r->'mine'->1->>'foeHero') <> 'katsu' or (r->'mine'->1->>'foe') <> 'Zz My Bee' or (r->'mine'->1->>'result') <> 'lost' or (r->'mine'->1->>'how') <> 'concession' then raise exception 'the seat-1 game reads %', r->'mine'->1; end if;
  if (r->'mine'->2->>'hero') <> 'kayo' or (r->'mine'->2->>'result') <> 'won' or (r->'mine'->2->>'foe') <> 'Zz My Bee' then raise exception 'the seat-0 win reads %', r->'mine'->2; end if;
  -- the change is the caller's own: a win is positive, a loss is negative, and Bee's mirror of the same game is the opposite number
  if (r->'mine'->2->>'change')::int <= 0 or (r->'mine'->1->>'change')::int >= 0 then raise exception 'the changes read % and % (win +, loss -)', r->'mine'->2->>'change', r->'mine'->1->>'change'; end if;
  if (public.ladder_get(3, 100, 0, b)->'mine'->2->>'change')::int <> -(r->'mine'->2->>'change')::int then raise exception 'Bee''s side of game 1 is not the mirror of Aye''s'; end if;
  if (select (x->>'result') from jsonb_array_elements(public.ladder_get(3, 100, 0, b)->'mine') x limit 1) <> 'lost' then raise exception 'Bee''s newest game (the forfeit she lost) does not read lost'; end if;
  if (select array_agg(k order by k) from jsonb_object_keys(r->'mine'->0) k) is distinct from array['at', 'change', 'foe', 'foeHero', 'result', 'how', 'hero'] and
     (select array_agg(k order by k) from jsonb_object_keys(r->'mine'->0) k) is distinct from array['at', 'change', 'foe', 'foeHero', 'hero', 'how', 'result'] then raise exception 'a game has other fields than its public ones'; end if;
  -- a named player with no games: an empty list, not a missing key; a nameless caller and a stranger and no caller: no key
  if (public.ladder_get(3, 100, 0, d)->'mine') <> '[]'::jsonb then raise exception 'a player with no games reads %', public.ladder_get(3, 100, 0, d)->'mine'; end if;
  if public.ladder_get(3, 100, 0, c) ? 'mine' then raise exception 'a nameless caller got a list'; end if;
  if public.ladder_get(3, 100, 0, 'no-such-player') ? 'mine' then raise exception 'a stranger got a list'; end if;
  if public.ladder_get(3, 100, 0, null) ? 'mine' then raise exception 'no caller, yet a list'; end if;
  -- ONE caller sees ONLY their own games: Bee's list holds no game of Aye's that Bee is not in (game 3 is Aye and Cee)
  if exists (select 1 from jsonb_array_elements(public.ladder_get(3, 100, 0, b)->'mine') x where x->>'how' = 'stalemate') then raise exception 'Bee sees a game she was not in'; end if;
  -- AT MOST 10, newest first: twelve more games for Aye
  for n in 1..12 loop
    perform public.result_record('zz-my-x' || n, 'ZZMYX' || n, a, b, 'Zz My Aye', 'Zz My Bee', 'kayo', 'dash', 0, 'life', 9, 'test', 0, 1700001000000 + n);
    update public.results set ended_at = to_timestamp(1900001000 + n) where game_id = 'zz-my-x' || n;
  end loop;
  r := public.ladder_get(3, 100, 0, a);
  if jsonb_array_length(r->'mine') <> 10 then raise exception 'mine holds % games, want 10', jsonb_array_length(r->'mine'); end if;
  if (r->'mine'->0->>'at')::bigint <> 1900001012000 then raise exception 'the newest game is not first'; end if;

  -- NO LEAK
  ids := (public.ladder_get(3, 100, 50, a))::text;
  if position('zz-mycheck' in ids) > 0 or position('zz-my-' in ids) > 0 or position('ZZMY' in ids) > 0 or position(a in ids) > 0 or position(b in ids) > 0 or position(c in ids) > 0 then raise exception 'the answer leaks a subject, a game id, a table code or a player id'; end if;
  -- NO WRITES
  select (select count(*) from public.players) || '/' || (select count(*) from public.ratings) || '/' || (select count(*) from public.results) || '/' || (select coalesce(sum(extract(epoch from last_seen_at)), 0) from public.players) into before_counts;
  perform public.ladder_get(3, 50, 10, a); perform public.ladder_get(3, 50, 10, d); perform public.ladder_get(3, 50, 10, 'no-such-player');
  select (select count(*) from public.players) || '/' || (select count(*) from public.ratings) || '/' || (select count(*) from public.results) || '/' || (select coalesce(sum(extract(epoch from last_seen_at)), 0) from public.players) into after_counts;
  if before_counts <> after_counts then raise exception 'reading changed a row'; end if;

  delete from public.results where game_id like 'zz-my-%';
  delete from public.players where id in (select player_id from public.identities where subject like 'zz-mycheck%');
  delete from public.players where display_name like 'Zz My %';
  if exists (select 1 from public.results where game_id like 'zz-my-%') or exists (select 1 from public.players where id in (a, b, c, d)) then raise exception 'the self-check left rows behind'; end if;
end $$;
select 'ok' as check_012;
