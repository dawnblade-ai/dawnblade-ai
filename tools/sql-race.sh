#!/bin/bash
# tools/sql-race.sh — THE REAL CONCURRENCY PROOF FOR 005_table_cap.sql, on a REAL Postgres (SERVER S4.4). OFFLINE; touches no Supabase project.
# PGlite is one connection and cannot race; this starts a throwaway Postgres 16 cluster (needs the server binaries and a non-root user to run
# them, e.g. Ubuntu's postgresql-16: initdb, pg_ctl, psql) and fires TEN simultaneous table_create_capped calls for one player who already holds
# four open tables, with a 0.4 s pause put between the count and the insert so that a missing lock cannot hide. Expected:
#   real   -> created=1 capped=9 stored_open_for_X=5          (the per-player advisory lock serialises them)
#   nolock -> created=10 ...                                   (the SAME file with the lock line deleted: the sabotage the lock exists to prevent)
# usage:  PGBIN=/usr/lib/postgresql/16/bin PGUSER_OS=postgres tools/sql-race.sh start      (once)   then   tools/sql-race.sh real | nolock   then  stop
set -u
PGBIN=${PGBIN:-/usr/lib/postgresql/16/bin}; OSU=${PGUSER_OS:-postgres}; D=${PGRACE_DIR:-/tmp/pgrace}; PORT=${PGRACE_PORT:-54329}
R="$(cd "$(dirname "$0")/.." && pwd)/server/supabase"
case "${1:-}" in
  start) rm -rf "$D"; mkdir -p "$D"; chown "$OSU" "$D"; runuser -u "$OSU" -- "$PGBIN/initdb" -D "$D/data" -A trust >/dev/null && runuser -u "$OSU" -- "$PGBIN/pg_ctl" -D "$D/data" -o "-p $PORT -k $D -c listen_addresses=''" -l "$D/log" start; exit $? ;;
  stop) runuser -u "$OSU" -- "$PGBIN/pg_ctl" -D "$D/data" stop; exit $? ;;
  real|nolock) ;;
  *) echo "usage: $0 start|real|nolock|stop"; exit 2 ;;
esac
P="psql -h $D -p $PORT -U $OSU -q -X -v ON_ERROR_STOP=1"
$P -d postgres -c "drop database if exists race" -c "create database race" >/dev/null 2>&1
P="$P -d race"
$P -c "create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;" >/dev/null 2>&1 || true
for f in 001_tables 002_players 003_names 004_recovery; do $P -f $R/$f.sql >/dev/null; done
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
