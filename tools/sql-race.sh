#!/bin/bash
# tools/sql-race.sh — THE REAL CONCURRENCY PROOF FOR 005_table_cap.sql, on a REAL Postgres (SERVER S4.4). OFFLINE; touches no Supabase project.
# PGlite is one connection and cannot race; this starts a throwaway Postgres 16 cluster (needs the server binaries and a non-root user to run
# them, e.g. Ubuntu's postgresql-16: initdb, pg_ctl, psql) and fires TEN simultaneous table_create_capped calls for one player who already holds
# four open tables, with a 0.4 s pause put between the count and the insert so that a missing lock cannot hide. Expected:
#   real   -> created=1 capped=9 stored_open_for_X=5          (the per-player advisory lock serialises them)
#   nolock -> created=10 ...                                   (the SAME file with the lock line deleted: the sabotage the lock exists to prevent)
#
# S5.1 adds `rate` and `ratenolock`: the same proof for 006_ratings.sql's result_record (a pause is put between the duplicate check and the rating reads).
#   (1) ONE PLAYER, TWO GAMES AT ONCE: X beats Y and X beats Z at the same moment (a 0.4 s pause inside each call). Expected, rate:
#       X ends at 1231 with games=2 wins=2 (the second game applied on the rating the first left); ratenolock (both locks deleted): X ends below that.
#   (2) ONE GAME, TEN COPIES AT ONCE (a replay storm): exactly one is recorded, one results row, ratings moved once.
# usage:  PGBIN=/usr/lib/postgresql/16/bin PGUSER_OS=postgres tools/sql-race.sh start      (once)   then   tools/sql-race.sh real | nolock | rate | ratenolock   then  stop
set -u
PGBIN=${PGBIN:-/usr/lib/postgresql/16/bin}; OSU=${PGUSER_OS:-postgres}; D=${PGRACE_DIR:-/tmp/pgrace}; PORT=${PGRACE_PORT:-54329}
R="$(cd "$(dirname "$0")/.." && pwd)/server/supabase"
case "${1:-}" in
  start) rm -rf "$D"; mkdir -p "$D"; chown "$OSU" "$D"; runuser -u "$OSU" -- "$PGBIN/initdb" -D "$D/data" -A trust >/dev/null && runuser -u "$OSU" -- "$PGBIN/pg_ctl" -D "$D/data" -o "-p $PORT -k $D -c listen_addresses=''" -l "$D/log" start; exit $? ;;
  stop) runuser -u "$OSU" -- "$PGBIN/pg_ctl" -D "$D/data" stop; exit $? ;;
  real|nolock|rate|ratenolock) ;;
  *) echo "usage: $0 start|real|nolock|stop"; exit 2 ;;
esac
P="psql -h $D -p $PORT -U $OSU -q -X -v ON_ERROR_STOP=1"
$P -d postgres -c "drop database if exists race" -c "create database race" >/dev/null 2>&1
P="$P -d race"
$P -c "create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;" >/dev/null 2>&1 || true
for f in 001_tables 002_players 003_names 004_recovery; do $P -f $R/$f.sql >/dev/null; done
if [ "$1" = rate ] || [ "$1" = ratenolock ]; then
  $P -f $R/005_table_cap.sql >/dev/null
  if [ "$1" = ratenolock ]; then sed "/pg_advisory_xact_lock(hashtextextended/d" $R/006_ratings.sql > $D/006v.sql; else cp $R/006_ratings.sql $D/006v.sql; fi
  # the window: after the duplicate check, before the ratings are read (a real network round trip would be there)
  sed -i "s|  insert into public.ratings (player_id) select id from public.players where id in (p_p0, p_p1) on conflict (player_id) do nothing;|  perform pg_sleep(0.4);\n  insert into public.ratings (player_id) select id from public.players where id in (p_p0, p_p1) on conflict (player_id) do nothing;|" $D/006v.sql
  # the nolock variant's own self-check refuses it (it looks for the locks): that is the point, so errors are not fatal for this one file
  $P -v ON_ERROR_STOP=0 -f $D/006v.sql 2>&1 | tail -1
  # the rating rows exist BEFORE the race: for a player nobody has rated, the first INSERT (on conflict) would make the second caller wait for the
  # first one's whole transaction and hide a missing lock
  $P -tA -c "insert into public.players (id) values ('X'), ('Y'), ('Z')" -c "insert into public.ratings (player_id) values ('X'), ('Y'), ('Z')" >/dev/null
  ( $P -tA -c "select public.result_record('g1', 'T1', 'X', 'Y', null, null, 'k', 'd', 0, 'life', 5, null, 0, 0)" > $D/g1.txt ) &
  ( $P -tA -c "select public.result_record('g2', 'T2', 'X', 'Z', null, null, 'k', 'd', 0, 'life', 5, null, 0, 0)" > $D/g2.txt ) &
  wait
  echo "${1} (one player, two games at once): $($P -tA -F ' ' -c "select 'X rating=' || rating || ' games=' || games || ' wins=' || wins from public.ratings where player_id = 'X'")  (want rating=1231 games=2 wins=2)"
  for i in $(seq 1 10); do ( $P -tA -c "select public.result_record('dup', 'T3', 'Y', 'Z', null, null, 'k', 'd', 1, 'life', 5, null, 0, 0)" > $D/out$i.txt ) & done; wait
  rec=$(cat $D/out*.txt | grep -c '"recorded": true'); rows=$($P -tA -c "select count(*) from public.results where game_id = 'dup'"); g=$($P -tA -c "select games from public.ratings where player_id = 'Z'")
  echo "${1} (one game, ten copies at once): recorded=$rec results_rows=$rows Z_games=$g  (want recorded=1 results_rows=1 Z_games=2: Z played g2 and dup, once each)"
  rm -f $D/out*.txt $D/g1.txt $D/g2.txt
  exit 0
fi
if [ "$1" = nolock ]; then sed "/pg_advisory_xact_lock/d" $R/005_table_cap.sql > $D/005v.sql; else cp $R/005_table_cap.sql $D/005v.sql; fi
# widen the window between the count and the insert for BOTH variants (a real network round trip would), via a scratch copy
sed -i "s|  insert into public.tables (id, row) values (p_id, p_row) on conflict (id) do nothing returning version into v;|  perform pg_sleep(0.4);\n  insert into public.tables (id, row) values (p_id, p_row) on conflict (id) do nothing returning version into v;|" $D/005v.sql
$P -f $D/005v.sql | tail -1
# 4 open tables for creator X
for i in 1 2 3 4; do $P -tA -c "select public.table_create_capped('r$i', '{\"v\":3,\"creator\":\"X\"}'::jsonb, 'X', 5)" >/dev/null; done
# 10 simultaneous creates by X
for i in $(seq 1 10); do ( $P -tA -c "select public.table_create_capped('n$i', '{\"v\":3,\"creator\":\"X\"}'::jsonb, 'X', 5)" > $D/out$i.txt ) & done; wait
ok=$(cat $D/out*.txt | grep -c '"version": 1'); cap=$(cat $D/out*.txt | grep -c capped)
open=$($P -tA -c "select count(*) from public.tables where row->>'creator'='X'")
echo "${1}: created=$ok capped=$cap stored_open_for_X=$open"
rm -f $D/out*.txt
