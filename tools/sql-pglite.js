#!/usr/bin/env node
/* tools/sql-pglite.js — RUN server/supabase/*.sql ON PGLITE (WASM Postgres), OFFLINE (SERVER S4.1)
   The repo keeps zero dependencies: install PGlite into a scratch dir and point at it.
     npm install --prefix <scratch> @electric-sql/pglite
     PGLITE_DIR=<scratch> node tools/sql-pglite.js [file.sql ...]        (default: 001_tables.sql then 002_players.sql)
   Creates the three Supabase role names (anon, authenticated, service_role), runs each file TWICE (the self-checks are idempotent),
   prints the last row of each run, then proves anon cannot read the tables or call the functions. Exits 1 on any failure.
   NOT part of `npm test`. It does not touch any Supabase project. */
"use strict";
const path = require("path"), fs = require("fs");
const dir = process.env.PGLITE_DIR;
if(!dir){ console.error("set PGLITE_DIR to a directory with @electric-sql/pglite installed"); process.exit(2); }
const {PGlite} = require(require.resolve("@electric-sql/pglite", {paths: [dir]}));
const files = process.argv.slice(2).length ? process.argv.slice(2) : ["001_tables.sql", "002_players.sql"].map(f => path.join(__dirname, "..", "server", "supabase", f));
(async () => {
  const db = new PGlite(); let bad = 0;
  await db.exec("create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;");
  for(const f of files){
    const sql = fs.readFileSync(f, "utf8");
    for(const run of [1, 2]){
      try { const r = await db.exec(sql); console.log(path.basename(f), "run", run, "->", JSON.stringify(r[r.length - 1].rows[0])); }
      catch(e){ bad++; console.log(path.basename(f), "run", run, "RAISED:", e.message); }
    }
  }
  await db.exec("set role anon");
  for(const q of ["select * from public.tables", "select * from public.players", "select * from public.identities", "select * from public.recovery",
      "select public.table_put('x', '{}'::jsonb, 0)", "select * from public.identity_resolve('x', 'y', null)", "select public.recovery_use('x')"]){
    try { await db.query(q); bad++; console.log("anon ALLOWED (bad):", q); } catch(e){ console.log("anon refused:", q.slice(0, 48), "-", e.message.slice(0, 40)); }
  }
  process.exit(bad ? 1 : 0);
})();
