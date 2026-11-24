-- server/supabase/010_rating_window.sql — RANKED PAIRING BY RATING (SERVER, QUEUE NEXT 3). Run after 001..009; safe to run twice.
--
-- 009's seek_step paired a ranked seeker with the OLDEST waiting ranked seek, whoever they were. Now a RANKED seek only pairs with another ranked
-- seek whose rating (006_ratings.sql; a player nobody has rated reads as rating_start() = 1200) is inside a WINDOW that widens with time waited:
--     window(w) = 100 + 50 * floor(w / 20)      rating points, w = whole seconds a seek has waited (now - created_at)
-- i.e. +-100 at once, +-150 after 20 s, +-200 after 40 s ... (the phone's heartbeat is 20 s, so each beat can see a wider window). The ladder is
-- therefore never a wall: anyone is matched in the end, and two players near each other meet at once.
-- THE CAP (CEO decision, user may overrule): once the wider wait reaches seek_window_open_s() = 180 s the window OPENS FULLY: any ranked seeker
-- (still oldest-first). A small community needs a game more than a perfect pairing; without it a 1000-point gap would wait over 6 minutes, longer
-- than a lone seek survives. seek_window returns an unbounded number (1000000, past any rating) from 180 s on. Change 180 here and nowhere else.
--
-- WIDER OF THE TWO, not both: the window used for a pair is window(greatest(wait of the caller, wait of the candidate)). Why: the player who has
-- waited longest is the one the queue owes a game; a fresh arrival 400 points away from a veteran of the queue should take that veteran's table
-- rather than leave both waiting (with "both must agree", a newcomer's window of 100 would hold a 3-minute waiter hostage for the newcomer's first
-- minute). A caller with no seek yet has waited 0 s. It never pairs closer-than-needed: among the candidates inside the window the OLDEST still goes
-- first (created_at, then player id: the same total order as 009), so a long waiter is never overtaken by a newer seek that is also inside.
--
-- CASUAL seeks are unchanged: no window, oldest first. Same lock and transaction discipline as 009: one global advisory lock, the ratings read
-- under it (a rating is read, never written, here). seek_cancel, seek_count and the table are 009's, untouched.
-- Nothing here is callable with the publishable key: service_role alone may execute (as 001..009).

-- the window in one place (the self-check and the function both read it; change a number here and nowhere else)
create or replace function public.seek_window_open_s() returns integer language sql immutable as 'select 180';

create or replace function public.seek_window(p_waited double precision)
returns integer
language sql
immutable
as 'select case when p_waited >= public.seek_window_open_s() then 1000000 else 100 + 50 * floor(greatest(p_waited, 0) / 20)::integer end';

-- seek_step(player, ranked, table, ttl): 009's contract exactly (see 009_seek.sql); only the ranked candidate query changed.
create or replace function public.seek_step(p_player text, p_ranked boolean, p_table text, p_ttl integer)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare mine public.seeks%rowtype; other public.seeks%rowtype; has_mine boolean; dropped text := null; my_rating integer; my_wait double precision := 0;
begin
  if p_player is null or p_player = '' or p_ranked is null or p_ttl is null or p_ttl < 5 or p_ttl > 3600 then raise exception 'seek_step needs a player, a kind and a ttl of 5..3600 s'; end if;
  if p_table is not null and p_table !~ '^[A-Za-z0-9_-]{1,32}$' then raise exception 'seek_step: a table code is 1..32 of A-Za-z0-9_-'; end if;
  perform pg_advisory_xact_lock(hashtextextended('dawnblade-seek', 0));
  delete from public.seeks where seen_at < now() - make_interval(secs => p_ttl);
  select * into mine from public.seeks where player_id = p_player;
  has_mine := found;
  if has_mine and mine.taken_at is not null then
    if mine.table_id is distinct from p_table and p_table is not null then dropped := p_table; end if;
    return jsonb_build_object('state', 'taken', 'table', mine.table_id) || case when dropped is null then '{}'::jsonb else jsonb_build_object('drop', dropped) end;
  end if;
  if has_mine and mine.ranked <> p_ranked then
    delete from public.seeks where player_id = p_player;
    dropped := mine.table_id; has_mine := false;
  end if;
  if p_ranked then
    my_rating := coalesce((select r.rating from public.ratings r where r.player_id = p_player), public.rating_start());
    if has_mine then my_wait := extract(epoch from (now() - mine.created_at)); end if;
  end if;
  select o.* into other from public.seeks o
   where o.player_id <> p_player and o.ranked = p_ranked and o.taken_at is null
     and (not p_ranked or abs(coalesce((select r.rating from public.ratings r where r.player_id = o.player_id), public.rating_start()) - my_rating)
          <= public.seek_window(greatest(my_wait, extract(epoch from (now() - o.created_at)))))
   order by o.created_at, o.player_id collate "C" limit 1;
  if found then
    update public.seeks set taken_at = now(), seen_at = now() where player_id = other.player_id;
    if has_mine then delete from public.seeks where player_id = p_player; dropped := mine.table_id; end if;
    if dropped is null and p_table is not null then dropped := p_table; end if;
    return jsonb_build_object('state', 'matched', 'table', other.table_id) || case when dropped is null then '{}'::jsonb else jsonb_build_object('drop', dropped) end;
  end if;
  if has_mine then
    update public.seeks set seen_at = now() where player_id = p_player;
    if p_table is not null and p_table <> mine.table_id then dropped := coalesce(dropped, p_table); end if;
    return jsonb_build_object('state', 'waiting', 'table', mine.table_id) || case when dropped is null then '{}'::jsonb else jsonb_build_object('drop', dropped) end;
  end if;
  if p_table is not null then
    insert into public.seeks (player_id, table_id, ranked) values (p_player, p_table, p_ranked);
    return jsonb_build_object('state', 'waiting', 'table', p_table) || case when dropped is null then '{}'::jsonb else jsonb_build_object('drop', dropped) end;
  end if;
  return jsonb_build_object('state', 'none') || case when dropped is null then '{}'::jsonb else jsonb_build_object('drop', dropped) end;
end;
$$;

revoke all on function public.seek_window_open_s() from public, anon, authenticated;
grant execute on function public.seek_window_open_s() to service_role;
revoke all on function public.seek_window(double precision) from public, anon, authenticated;
grant execute on function public.seek_window(double precision) to service_role;
revoke all on function public.seek_step(text, boolean, text, integer) from public, anon, authenticated;
grant execute on function public.seek_step(text, boolean, text, integer) to service_role;
notify pgrst, 'reload schema';

-- ---- self-check (leaves nothing behind; uses its own "zz-win-" players) ----
do $$
declare r jsonb; a text := 'zz-win-a'; b text := 'zz-win-b'; c text := 'zz-win-c'; d text := 'zz-win-d'; e text := 'zz-win-e'; f text := 'zz-win-f';
begin
  delete from public.seeks where player_id like 'zz-win-%';
  delete from public.players where id like 'zz-win-%';
  insert into public.players (id) values (a), (b), (c), (d), (e), (f);
  insert into public.ratings (player_id, rating) values (a, 1200), (b, 1600), (c, 1250), (d, 1800), (e, 1500), (f, 1550);
  -- the window itself
  if public.seek_window(0) <> 100 or public.seek_window(19.9) <> 100 or public.seek_window(20) <> 150 or public.seek_window(100) <> 350 or public.seek_window(179.9) <> 100 + 50 * 8 then raise exception 'seek_window is not 100 + 50 per 20 s'; end if;
  if public.seek_window(180) < 100000 or public.seek_window(1000) < 100000 then raise exception 'seek_window does not open fully at 180 s'; end if;
  -- two ranked seekers 400 apart do NOT pair at once
  r := public.seek_step(a, true, 'ZZWNA1', 60);
  r := public.seek_step(b, true, 'ZZWNB1', 60);
  if r->>'state' is distinct from 'waiting' then raise exception 'ranked seekers 400 apart were paired at once: %', r; end if;
  r := public.seek_step(a, true, 'ZZWNA1', 60);
  if r->>'state' is distinct from 'waiting' then raise exception 'a heartbeat paired ranked seekers 400 apart: %', r; end if;
  -- after 100 s (window 350) still not; after 140 s (window 450) they pair, on the older one's beat (the wider window rules)
  update public.seeks set created_at = now() - interval '100 seconds' where player_id in (a, b);
  r := public.seek_step(a, true, 'ZZWNA1', 60);
  if r->>'state' is distinct from 'waiting' then raise exception 'a 350 window paired 400 apart: %', r; end if;
  update public.seeks set created_at = now() - interval '140 seconds' where player_id in (a, b);
  r := public.seek_step(a, true, 'ZZWNA1', 60);
  if r->>'state' is distinct from 'matched' or r->>'table' is distinct from 'ZZWNB1' then raise exception 'the window never widened: %', r; end if;
  delete from public.seeks where player_id like 'zz-win-%';
  -- THE CAP: d (1800) and a (1200) are 600 apart: not paired at 160 s (window 450), paired at 180 s (open fully), whoever beats
  r := public.seek_step(a, true, 'ZZWNA11', 60);
  insert into public.seeks (player_id, table_id, ranked, created_at) values (d, 'ZZWND11', true, now() - interval '160 seconds');
  update public.seeks set created_at = now() - interval '160 seconds' where player_id = a;
  r := public.seek_step(a, true, 'ZZWNA11', 60);
  if r->>'state' is distinct from 'waiting' then raise exception 'a 160 s wait paired seekers 600 apart: %', r; end if;
  update public.seeks set created_at = now() - interval '180 seconds' where player_id in (a, d);
  r := public.seek_step(a, true, 'ZZWNA11', 60);
  if r->>'state' is distinct from 'matched' or r->>'table' is distinct from 'ZZWND11' then raise exception 'the window did not open fully at 180 s: %', r; end if;
  delete from public.seeks where player_id like 'zz-win-%';
  -- 50 apart pair at once
  r := public.seek_step(a, true, 'ZZWNA2', 60);
  r := public.seek_step(c, true, null, 60);
  if r->>'state' is distinct from 'matched' or r->>'table' is distinct from 'ZZWNA2' then raise exception 'ranked seekers 50 apart did not pair at once: %', r; end if;
  delete from public.seeks where player_id like 'zz-win-%';
  -- the WIDER window rules: a veteran who waited 200 s (window 600) takes a fresh arrival 400 away
  r := public.seek_step(a, true, 'ZZWNA3', 60);
  update public.seeks set created_at = now() - interval '200 seconds' where player_id = a;
  r := public.seek_step(b, true, null, 60);
  if r->>'state' is distinct from 'matched' or r->>'table' is distinct from 'ZZWNA3' then raise exception 'a long waiter was not matched to a fresh arrival inside their window: %', r; end if;
  delete from public.seeks where player_id like 'zz-win-%';
  -- oldest first AMONG THOSE INSIDE: d (1800, oldest) is outside e's window, a (1200) is outside, c (1250) and b (1600) inside 1500's 100? no: only b (1600) is
  -- inside +-100 of e (1500); c (1250) is 250 away and a is 300 away, both older than b
  insert into public.seeks (player_id, table_id, ranked, created_at) values
    (d, 'ZZWND1', true, now() - interval '9 seconds'), (a, 'ZZWNA4', true, now() - interval '8 seconds'),
    (c, 'ZZWNC4', true, now() - interval '7 seconds'), (b, 'ZZWNB4', true, now() - interval '6 seconds');
  r := public.seek_step(e, true, null, 60);
  if r->>'state' is distinct from 'matched' or r->>'table' is distinct from 'ZZWNB4' then raise exception 'the oldest INSIDE the window was not chosen: %', r; end if;
  -- ... and among several inside, the oldest: widen c and b both inside e's window by waiting
  delete from public.seeks where player_id like 'zz-win-%';
  insert into public.seeks (player_id, table_id, ranked, created_at) values
    (c, 'ZZWNC5', true, now() - interval '30 seconds'), (b, 'ZZWNB5', true, now() - interval '31 seconds');
  r := public.seek_step(e, true, null, 60);       -- e has waited 0; b waited 31 s (window 150): 1600 vs 1500 inside; c 250 away vs window 150: outside -> b
  if r->>'state' is distinct from 'matched' or r->>'table' is distinct from 'ZZWNB5' then raise exception 'a candidate outside its own window was matched: %', r; end if;
  delete from public.seeks where player_id like 'zz-win-%';
  -- the caller's OWN wait counts too: a (waited 200 s, window 600) finds a fresh seek 400 away on its heartbeat
  insert into public.seeks (player_id, table_id, ranked, created_at) values (a, 'ZZWNA9', true, now() - interval '200 seconds'), (b, 'ZZWNB9', true, now());
  r := public.seek_step(a, true, 'ZZWNA9', 60);
  if r->>'state' is distinct from 'matched' or r->>'table' is distinct from 'ZZWNB9' then raise exception 'the caller''s own wait did not widen its window: %', r; end if;
  delete from public.seeks where player_id like 'zz-win-%';
  -- among several INSIDE the window the OLDEST goes first (b 1600 older than f 1550, both inside e 1500)
  insert into public.seeks (player_id, table_id, ranked, created_at) values (b, 'ZZWNB10', true, now() - interval '6 seconds'), (f, 'ZZWNF10', true, now() - interval '3 seconds');
  r := public.seek_step(e, true, null, 60);
  if r->>'state' is distinct from 'matched' or r->>'table' is distinct from 'ZZWNB10' then raise exception 'not oldest-first inside the window: %', r; end if;
  -- a taken seek is not matched again, however close
  delete from public.seeks where player_id = f;
  r := public.seek_step(e, true, null, 60);
  if r->>'state' is distinct from 'none' then raise exception 'a taken ranked seek was matched twice: %', r; end if;
  delete from public.seeks where player_id like 'zz-win-%';
  -- a player with no rating row reads as the starting rating (1200): pairs with 1250 at once, not with 1800
  delete from public.ratings where player_id in (a);
  r := public.seek_step(a, true, 'ZZWNA6', 60);
  r := public.seek_step(d, true, null, 60);
  if r->>'state' is distinct from 'none' then raise exception 'an unrated player was treated as 1800-ish: %', r; end if;
  r := public.seek_step(c, true, null, 60);
  if r->>'state' is distinct from 'matched' or r->>'table' is distinct from 'ZZWNA6' then raise exception 'an unrated player did not read as the starting rating: %', r; end if;
  delete from public.seeks where player_id like 'zz-win-%';
  -- CASUAL seeks are not windowed: 1250 and 1800 pair at once
  r := public.seek_step(d, false, 'ZZWND7', 60);
  r := public.seek_step(c, false, null, 60);
  if r->>'state' is distinct from 'matched' or r->>'table' is distinct from 'ZZWND7' then raise exception 'a casual seek was windowed: %', r; end if;
  -- kinds still never mix
  delete from public.seeks where player_id like 'zz-win-%';
  r := public.seek_step(c, false, 'ZZWNC8', 60);
  r := public.seek_step(a, true, null, 60);
  if r->>'state' is distinct from 'none' then raise exception 'ranked met casual: %', r; end if;
  -- privileges
  if has_function_privilege('anon', 'public.seek_step(text,boolean,text,integer)', 'execute') then raise exception 'anon may call seek_step'; end if;
  if has_function_privilege('anon', 'public.seek_window(double precision)', 'execute') then raise exception 'anon may call seek_window'; end if;
  if not has_function_privilege('service_role', 'public.seek_step(text,boolean,text,integer)', 'execute') then raise exception 'service_role may not call seek_step'; end if;
  delete from public.seeks where player_id like 'zz-win-%';
  delete from public.ratings where player_id like 'zz-win-%';
  delete from public.players where id like 'zz-win-%';
end $$;
select 'ok' as dawnblade_rating_window;
