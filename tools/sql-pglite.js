#!/usr/bin/env node
/* tools/sql-pglite.js — RUN server/supabase/*.sql ON PGLITE (WASM Postgres), OFFLINE (SERVER S4.1)
   The repo keeps zero dependencies: install PGlite into a scratch dir and point at it.
     npm install --prefix <scratch> @electric-sql/pglite
     PGLITE_DIR=<scratch> node tools/sql-pglite.js [file.sql ...]        (default: 001..006)
   Creates the three Supabase role names (anon, authenticated, service_role), runs each file TWICE (the self-checks are idempotent),
   prints the last row of each run, then proves anon cannot read the tables or call the functions. Exits 1 on any failure.
   NOT part of `npm test`. It does not touch any Supabase project. */
"use strict";
const path = require("path"), fs = require("fs");
const dir = process.env.PGLITE_DIR;
if(!dir){ console.error("set PGLITE_DIR to a directory with @electric-sql/pglite installed"); process.exit(2); }
const {PGlite} = require(require.resolve("@electric-sql/pglite", {paths: [dir]}));
const files = process.argv.slice(2).length ? process.argv.slice(2) : ["001_tables.sql", "002_players.sql", "003_names.sql", "004_recovery.sql", "005_table_cap.sql", "006_ratings.sql"].map(f => path.join(__dirname, "..", "server", "supabase", f));
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
  /* S5.1: the Elo arithmetic is checked against the table the drills share (test/fixtures/elo-vectors.json): the SAME numbers prove the fake
     backend the drills run on and the SQL's own rounding, so the two cannot drift apart. Each vector is a fresh pair set to the two ratings. */
  const V = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "test", "fixtures", "elo-vectors.json"), "utf8"));
  let vi = 0;
  for(const v of V.vectors){
    const a = "zz-vec-a" + vi, b = "zz-vec-b" + vi; vi++;
    await db.query("insert into public.players (id) values ($1), ($2)", [a, b]);
    await db.query("insert into public.ratings (player_id, rating) values ($1, $2), ($3, $4)", [a, v.a, b, v.b]);
    const r = (await db.query("select public.result_record($1, 'ZZVEC', $2, $3, null, null, 'kayo', 'dash', $4, $5, 5, null, 0, 0) as r",
      ["zz-vec-" + vi, a, b, v.outcome === "a" ? 0 : v.outcome === "b" ? 1 : null, v.outcome === "draw" ? "stalemate" : "life"])).rows[0].r;
    const got = [r.ratings[0].to, r.ratings[1].to];
    if(got[0] !== v.after[0] || got[1] !== v.after[1]){ bad++; console.log("ELO VECTOR WRONG", JSON.stringify(v), "->", JSON.stringify(got)); }
  }
  console.log("elo vectors:", V.vectors.length, "checked against result_record");
  await db.exec("delete from public.results where game_id like 'zz-vec-%'; delete from public.players where id like 'zz-vec-%';");
  await db.exec("set role anon");
  for(const q of ["select * from public.tables", "select * from public.players", "select * from public.identities", "select * from public.recovery",
      "select public.table_put('x', '{}'::jsonb, 0)", "select * from public.identity_resolve('x', 'y', null)", "select public.recovery_use('x')", "select public.player_rename('x', 'Abc', 'abc')", "select * from public.recovery_attempts", "select public.recovery_mint('x'::text, repeat('a', 64), 1)", "select * from public.recovery_redeem('x'::text, 'y'::text, repeat('a', 64))", "select public.table_create_capped('x', '{\"creator\":\"p\"}'::jsonb, 'p', 5)",
      "select * from public.ratings", "select * from public.results", "select * from public.rating_get('x')", "select public.rating_k()",
      "select public.result_record('g', 'T', 'a', 'b', null, null, 'k', 'k', 0, 'life', 1, null, 0, 0)"]){
    try { await db.query(q); bad++; console.log("anon ALLOWED (bad):", q); } catch(e){ console.log("anon refused:", q.slice(0, 48), "-", e.message.slice(0, 40)); }
  }
  process.exit(bad ? 1 : 0);
})();
