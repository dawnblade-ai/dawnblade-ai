-- server/supabase/006_ratings.sql — RANKED RESULTS AND ELO RATINGS (SERVER S5.1). Run after 001..005; safe to run twice.
--
-- WHAT THIS HOLDS. `results`: ONE row per finished ranked game (who, which heroes, who won or a draw, how it ended, how many turns, which
-- build, when, and both ratings before and after). `ratings`: ONE row per player (never per hero): the Elo rating and the record
-- (games / wins / losses / draws). A player nobody has rated has no row and reads as the starting rating with no games.
--
-- WHO WRITES THEM: only the Edge Function's service role, through result_record(), and only from the referee's own game state
-- (server/referee.js reads the winner out of the game it ran; no phone request carries one). RLS stays forced with zero policies and every
-- grant is revoked from anon and authenticated (the same discipline as 001..005), stated three ways.
--
-- THE RULES, in ONE place (change a number here and nowhere else; the function's arithmetic reads these two):
--     starting rating 1200 (rating_start), K = 32 (rating_k), one rating per player,
--     expected score  E = 1 / (1 + 10 ^ ((other - mine) / 400)),   new rating = round(old + K * (score - E)),
--     score: win 1, draw 0.5, loss 0; both new ratings are computed from BOTH old ratings, each rounded to an integer.
--
-- EXACTLY ONCE. result_record() is idempotent on `game_id` (the table code plus the moment the table was made: a code the function draws
-- again after the old table was forgotten is a new game). The second call for a game, from a replay, a resync, a takeover or a retry,
-- answers the STORED result with recorded:false and moves nothing.
--
-- THE RACE. A player may finish two games at the same moment. result_record takes one advisory lock per player (pg_advisory_xact_lock on a
-- hash of the player id), the lower id first so two games sharing a player can never deadlock, reads both ratings only AFTER it holds both
-- locks (READ COMMITTED takes a new snapshot per statement) and writes the ratings and the result in the one transaction: two simultaneous
-- finishes of one player's two games queue up and BOTH apply, the second on the rating the first left. tools/sql-race.sh proves it on a
-- real Postgres.

create or replace function public.rating_start() returns integer language sql immutable as 'select 1200';
create or replace function public.rating_k() returns integer language sql immutable as 'select 32';

create table if not exists public.ratings (
  player_id   text primary key references public.players (id) on delete cascade,
  rating      integer not null default public.rating_start() check (rating between 0 and 100000),
  games       integer not null default 0 check (games >= 0),
  wins        integer not null default 0 check (wins >= 0),
  losses      integer not null default 0 check (losses >= 0),
  draws       integer not null default 0 check (draws >= 0),
  updated_at  timestamptz not null default now(),
  check (games = wins + losses + draws)
);

-- no foreign key to players on purpose: a result is history and outlives a player row (recovery_redeem deletes a throwaway player)
create table if not exists public.results (
  game_id        text primary key check (game_id ~ '^[A-Za-z0-9_-]{1,80}$'),
  table_id       text not null check (table_id ~ '^[A-Za-z0-9_-]{1,32}$'),
  player_0       text not null check (char_length(player_0) between 1 and 64),
  player_1       text not null check (char_length(player_1) between 1 and 64),
  name_0         text check (name_0 is null or char_length(name_0) between 1 and 64),
  name_1         text check (name_1 is null or char_length(name_1) between 1 and 64),
  hero_0         text not null check (char_length(hero_0) between 1 and 64),
  hero_1         text not null check (char_length(hero_1) between 1 and 64),
  winner         smallint check (winner in (0, 1)),                       -- null = a draw
  how            text not null check (how in ('life', 'concession', 'stalemate')),
  turns          integer not null check (turns >= 0),
  build          text check (build is null or char_length(build) <= 80),
  rating_0_before integer not null, rating_0_after integer not null,
  rating_1_before integer not null, rating_1_after integer not null,
  started_at     timestamptz,
  ended_at       timestamptz not null,
  recorded_at    timestamptz not null default now(),
  check (player_0 <> player_1),
  check ((how = 'stalemate') = (winner is null))                           -- a draw is exactly the dead position
);
create index if not exists results_player_0_idx on public.results (player_0, ended_at);
create index if not exists results_player_1_idx on public.results (player_1, ended_at);

alter table public.ratings enable row level security; alter table public.ratings force row level security;
alter table public.results enable row level security; alter table public.results force row level security;
-- NO "create policy" for either, on purpose
revoke all on public.ratings, public.results from anon, authenticated;
grant all on public.ratings, public.results to service_role;

-- rating_get(player) -> one row: the rating and the record; the starting rating and no games for a player nobody has rated
create or replace function public.rating_get(p_player text)
returns table (rating integer, games integer, wins integer, losses integer, draws integer)
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(r.rating, public.rating_start()), coalesce(r.games, 0), coalesce(r.wins, 0), coalesce(r.losses, 0), coalesce(r.draws, 0)
    from (select 1) one left join public.ratings r on r.player_id = p_player
$$;

-- result_record(...) -> jsonb {"recorded": true|false, "ratings": [{"from": n, "to": n}, {"from": n, "to": n}]}  (index 0 = player_0)
--   p_winner: 0 or 1 (the seat that won) or null for the engine's dead-position draw; p_started / p_ended: milliseconds since 1970 (0 = unknown)
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
  if p_how is null or p_how not in ('life', 'concession', 'stalemate') then raise exception 'result_record: unknown way to end a game'; end if;
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

revoke all on function public.rating_start(), public.rating_k() from public, anon, authenticated;
revoke all on function public.rating_get(text) from public, anon, authenticated;
revoke all on function public.result_record(text, text, text, text, text, text, text, text, integer, text, integer, text, bigint, bigint) from public, anon, authenticated;
grant execute on function public.rating_start(), public.rating_k() to service_role;
grant execute on function public.rating_get(text) to service_role;
grant execute on function public.result_record(text, text, text, text, text, text, text, text, integer, text, integer, text, bigint, bigint) to service_role;
notify pgrst, 'reload schema';

-- ---- self-check (leaves nothing behind) ----
do $$
declare a text; b text; c text; r jsonb; g record; f text;
begin
  foreach f in array array['public.ratings', 'public.results'] loop
    if not (select relrowsecurity and relforcerowsecurity from pg_class where oid = f::regclass) then raise exception 'row level security is not enabled and forced on %', f; end if;
    if has_table_privilege('anon', f, 'select') or has_table_privilege('authenticated', f, 'select') or has_table_privilege('anon', f, 'insert') or has_table_privilege('authenticated', f, 'insert')
       or has_table_privilege('anon', f, 'update') or has_table_privilege('authenticated', f, 'update') or has_table_privilege('anon', f, 'delete') or has_table_privilege('authenticated', f, 'delete') then
      raise exception 'anon or authenticated can still reach %', f; end if;
    if exists (select 1 from pg_policies where schemaname = 'public' and tablename = split_part(f, '.', 2)) then raise exception '% has a policy: it must have none', f; end if;
  end loop;
  foreach f in array array['public.rating_get(text)', 'public.result_record(text,text,text,text,text,text,text,text,integer,text,integer,text,bigint,bigint)', 'public.rating_start()', 'public.rating_k()'] loop
    if has_function_privilege('anon', f, 'execute') or has_function_privilege('authenticated', f, 'execute') then raise exception 'anon or authenticated may call %', f; end if;
    if not has_function_privilege('service_role', f, 'execute') then raise exception 'service_role may not call %', f; end if;
  end loop;
  -- the race story: a serial check cannot race, so it at least proves the decision runs under BOTH players' locks (tools/sql-race.sh is the real proof)
  if (select (length(prosrc) - length(replace(prosrc, 'pg_advisory_xact_lock', ''))) / length('pg_advisory_xact_lock') from pg_proc
       where oid = 'public.result_record(text,text,text,text,text,text,text,text,integer,text,integer,text,bigint,bigint)'::regprocedure) < 2 then
    raise exception 'result_record does not take both players'' locks'; end if;
  if public.rating_start() <> 1200 or public.rating_k() <> 32 then raise exception 'the rating constants are not 1200 and 32'; end if;

  delete from public.results where game_id like 'zz-rate-%';
  delete from public.players where id in (select player_id from public.identities where subject like 'zz-ratecheck%');
  select player_id into a from public.identity_resolve('selfcheck', 'zz-ratecheck-a', null);
  select player_id into b from public.identity_resolve('selfcheck', 'zz-ratecheck-b', null);
  select player_id into c from public.identity_resolve('selfcheck', 'zz-ratecheck-c', null);

  -- an unrated player reads as 1200 with no games
  select * into g from public.rating_get(a);
  if g.rating <> 1200 or g.games <> 0 or g.wins <> 0 or g.losses <> 0 or g.draws <> 0 then raise exception 'an unrated player did not read as 1200 with no games: %', g; end if;

  -- 1200 v 1200, seat 0 wins: 1216 / 1184, one game each, a win and a loss
  r := public.result_record('zz-rate-1', 'ZZRATE', a, b, 'Aaa', 'Bbb', 'kayo', 'dash', 0, 'life', 7, 'test', 1700000000000, 1700000600000);
  if r <> '{"recorded": true, "ratings": [{"from": 1200, "to": 1216}, {"from": 1200, "to": 1184}]}'::jsonb then raise exception '1200 v 1200 win answered %', r; end if;
  select * into g from public.rating_get(a); if g.rating <> 1216 or g.games <> 1 or g.wins <> 1 or g.losses <> 0 or g.draws <> 0 then raise exception 'the winner reads %', g; end if;
  select * into g from public.rating_get(b); if g.rating <> 1184 or g.games <> 1 or g.wins <> 0 or g.losses <> 1 or g.draws <> 0 then raise exception 'the loser reads %', g; end if;
  -- the same game again, in every way a duplicate can come: the stored answer, recorded:false, nothing moved, one row
  r := public.result_record('zz-rate-1', 'ZZRATE', a, b, 'Aaa', 'Bbb', 'kayo', 'dash', 0, 'life', 7, 'test', 1700000000000, 1700000600000);
  if r <> '{"recorded": false, "ratings": [{"from": 1200, "to": 1216}, {"from": 1200, "to": 1184}]}'::jsonb then raise exception 'a duplicate answered %', r; end if;
  r := public.result_record('zz-rate-1', 'ZZRATE', b, a, 'Bbb', 'Aaa', 'dash', 'kayo', 1, 'concession', 9, 'test', 0, 0);       -- even a replay that says something else
  if (r->>'recorded') <> 'false' then raise exception 'a replay with other values was recorded: %', r; end if;
  select * into g from public.rating_get(a); if g.rating <> 1216 or g.games <> 1 then raise exception 'a duplicate moved a rating: %', g; end if;
  if (select count(*) from public.results where game_id = 'zz-rate-1') <> 1 then raise exception 'a duplicate stored a second result'; end if;
  if (select winner from public.results where game_id = 'zz-rate-1') <> 0 or (select turns from public.results where game_id = 'zz-rate-1') <> 7 then raise exception 'the stored result was changed by a replay'; end if;
  if (select started_at from public.results where game_id = 'zz-rate-1') is distinct from to_timestamp(1700000000) then raise exception 'the start time was not stored'; end if;
  -- a draw between 1216 and 1184 (a stalemate, no winner), then the unequal pair: a (now 1216) v c (1200)
  r := public.result_record('zz-rate-2', 'ZZRATE', a, b, null, null, 'kayo', 'dash', null, 'stalemate', 40, null, 0, 0);
  if r->'ratings' <> '[{"from": 1216, "to": 1215}, {"from": 1184, "to": 1185}]'::jsonb then raise exception 'an unequal draw answered %', r; end if;
  select * into g from public.rating_get(a); if g.draws <> 1 or g.games <> 2 or g.wins <> 1 then raise exception 'the draw was not counted: %', g; end if;
  -- the underdog wins: c (1200) beats b... use a fresh pair so the numbers are the table's: a=1215 v c=1200 is not in the table, so check the rule itself
  r := public.result_record('zz-rate-3', 'ZZRATE', c, a, null, null, 'kayo', 'dash', 0, 'concession', 3, null, 0, 0);
  if (r->'ratings'->0->>'to')::int <= 1200 or (r->'ratings'->1->>'to')::int >= 1215 then raise exception 'the underdog did not gain and the favourite lose: %', r; end if;
  -- the arithmetic against the table the drills share (1300 v 1200 etc.): done by tools/sql-pglite.js, which feeds test/fixtures/elo-vectors.json through this function
  -- constraints refuse what the function would never send
  begin perform public.result_record('zz-rate-x', 'ZZRATE', a, a, null, null, 'k', 'k', 0, 'life', 1, null, 0, 0); raise exception 'one player on both seats was accepted';
  exception when raise_exception then if sqlerrm like 'one player%' then raise; end if; end;
  begin perform public.result_record('zz-rate-x', 'ZZRATE', a, b, null, null, 'k', 'k', 0, 'stalemate', 1, null, 0, 0); raise exception 'a winner in a stalemate was accepted';
  exception when raise_exception then if sqlerrm like 'a winner%' then raise; end if; end;
  begin perform public.result_record('zz-rate-x', 'ZZRATE', a, b, null, null, 'k', 'k', null, 'life', 1, null, 0, 0); raise exception 'a draw by life was accepted';
  exception when raise_exception then if sqlerrm like 'a draw%' then raise; end if; end;
  begin perform public.result_record('zz-rate-x', 'ZZRATE', a, b, null, null, 'k', 'k', 2, 'life', 1, null, 0, 0); raise exception 'a winner of seat 2 was accepted';
  exception when raise_exception then if sqlerrm like 'a winner of%' then raise; end if; end;
  begin perform public.result_record('zz-rate-x', 'ZZRATE', a, b, null, null, 'k', 'k', 0, 'timeout', 1, null, 0, 0); raise exception 'an unknown ending was accepted';
  exception when raise_exception then if sqlerrm like 'an unknown ending%' then raise; end if; end;
  begin perform public.result_record('zz-rate-x', 'ZZRATE', a, 'no-such-player', null, null, 'k', 'k', 0, 'life', 1, null, 0, 0); raise exception 'an unknown player was accepted';
  exception when raise_exception then if sqlerrm like 'an unknown player%' then raise; end if; end;
  if exists (select 1 from public.results where game_id = 'zz-rate-x') then raise exception 'a refused result was stored'; end if;
  if (select count(*) from public.ratings where player_id = 'no-such-player') <> 0 then raise exception 'a rating row was made for an unknown player'; end if;

  delete from public.results where game_id like 'zz-rate-%';
  delete from public.players where id in (select player_id from public.identities where subject like 'zz-ratecheck%');
  if exists (select 1 from public.ratings where player_id in (a, b, c)) then raise exception 'deleting a player left a rating behind'; end if;
end $$;
select 'ok' as dawnblade_ratings;
