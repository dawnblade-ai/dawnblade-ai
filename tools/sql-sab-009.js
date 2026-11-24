/* tools/sql-sab-009.js — SABOTAGE 009_seek.sql ON PGLITE: each edit must make the file's own self-check raise. PGLITE_DIR=<scratch with @electric-sql/pglite> node tools/sql-sab-009.js. Offline; NOT part of npm test. */
const path=require("path"),fs=require("fs");
const {PGlite}=require(require.resolve("@electric-sql/pglite",{paths:[process.env.PGLITE_DIR]}));
const D=path.join(__dirname,"..","server","supabase")+path.sep;
const base=fs.readFileSync(D+"009_seek.sql","utf8");
const pre=["001_tables.sql","002_players.sql","003_names.sql","004_recovery.sql","005_table_cap.sql","006_ratings.sql","007_forfeit.sql","008_ladder.sql"].map(f=>fs.readFileSync(D+f,"utf8"));
const S=[
 ["matches itself", s=>s.replace("where player_id <> p_player and ranked = p_ranked and taken_at is null","where ranked = p_ranked and taken_at is null")],
 ["ignores kind", s=>s.replace("where player_id <> p_player and ranked = p_ranked and taken_at is null","where player_id <> p_player and taken_at is null")],
 ["matches a taken seek twice", s=>s.replace("where player_id <> p_player and ranked = p_ranked and taken_at is null","where player_id <> p_player and ranked = p_ranked")],
 ["never marks taken", s=>s.replace("update public.seeks set taken_at = now(), seen_at = now() where player_id = other.player_id;","update public.seeks set seen_at = now() where player_id = other.player_id;")],
 ["newest first", s=>s.replace("order by created_at, player_id collate \"C\" limit 1","order by created_at desc, player_id collate \"C\" limit 1")],
 ["no ageing", s=>s.split("delete from public.seeks where seen_at < now() - make_interval(secs => p_ttl);").join("")],
 ["writes without a table", s=>s.replace("  return jsonb_build_object('state', 'none')","  insert into public.seeks (player_id, table_id, ranked) values (p_player, 'NONE', p_ranked);\n  return jsonb_build_object('state', 'none')")],
 ["matched seeker stays queued", s=>s.replace("    if has_mine then delete from public.seeks where player_id = p_player; dropped := mine.table_id; end if;","    if has_mine then dropped := mine.table_id; end if;")],
 ["no drop of own table", s=>s.replace("    if dropped is null and p_table is not null then dropped := p_table; end if;\n","")],
 ["kind switch keeps old", s=>s.replace("    dropped := mine.table_id; has_mine := false;","    has_mine := false;")],
 ["cancel ignores taken", s=>s.replace("  if mine.taken_at is not null then return jsonb_build_object('state', 'taken', 'table', mine.table_id); end if;\n","")],
 ["cancel keeps row", s=>s.replace("  delete from public.seeks where player_id = p_player;\n  return jsonb_build_object('state', 'cancelled'","  return jsonb_build_object('state', 'cancelled'")],
 ["anon may call", s=>s.replace("revoke all on function public.seek_step(text, boolean, text, integer) from public, anon, authenticated;","grant execute on function public.seek_step(text, boolean, text, integer) to anon;")],
 ["rls not forced", s=>s.replace("alter table public.seeks force row level security;","")],
 ["count includes taken", s=>s.replace("where ranked and taken_at is null and seen_at","where ranked and seen_at")],
];
(async()=>{let miss=0;
 for(const [name,f] of S){
  const sql=f(base); if(sql===base){console.log("SABOTAGE DID NOT APPLY:",name);miss++;continue;}
  const db=new PGlite(); await db.exec("create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;");
  for(const p of pre) await db.exec(p);
  try{const r=await db.exec(sql); const last=r[r.length-1].rows[0]; console.log("NOT CAUGHT:",name,JSON.stringify(last));miss++;}
  catch(e){console.log("caught:",name,"-",e.message.slice(0,110));}
 }
 console.log("sabotages:",S.length,"uncaught/unapplied:",miss);process.exit(miss?1:0);
})();
