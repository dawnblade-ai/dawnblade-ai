/* tools/sql-sab-011.js — SABOTAGE 011_seek_wait.sql ON PGLITE: each edit must make the file's own self-check raise (or the anon probe fail). PGLITE_DIR=<scratch with @electric-sql/pglite> node tools/sql-sab-011.js. Offline; NOT part of npm test. */
const path=require("path"),fs=require("fs");
const {PGlite}=require(require.resolve("@electric-sql/pglite",{paths:[process.env.PGLITE_DIR]}));
const D=path.join(__dirname,"..","server","supabase")+path.sep;
const base=fs.readFileSync(D+"011_seek_wait.sql","utf8");
const pre=["001_tables.sql","002_players.sql","003_names.sql","004_recovery.sql","005_table_cap.sql","006_ratings.sql","007_forfeit.sql","008_ladder.sql","009_seek.sql","010_rating_window.sql"].map(f=>fs.readFileSync(D+f,"utf8"));
const S=[
 ["no trigger (nothing logged)", s=>s.replace("when (old.taken_at is null and new.taken_at is not null)","when (false)")],
 ["logs every update, not only the take", s=>s.replace("when (old.taken_at is null and new.taken_at is not null)","when (new.taken_at is not null)")],
 ["logs the kind wrong", s=>s.replace("values (new.ranked, least","values (not new.ranked, least")],
 ["logs seconds from seen_at", s=>s.replace("(new.taken_at - new.created_at)","(new.taken_at - new.seen_at)")],
 ["no pruning", s=>s.replace("delete from public.seek_wait_log where at < now() - interval '7 days';","")],
 ["prunes at 1 day", s=>s.replace("where at < now() - interval '7 days';\n  return","where at < now() - interval '1 day';\n  return")],
 ["shows numbers from 1 seek", s=>s.replace("when s.n >= 5 then","when s.n >= 1 then")],
 ["shows numbers only from 6 seeks", s=>s.replace("when s.n >= 5 then","when s.n >= 6 then")],
 ["mean not median", s=>s.replace("percentile_cont(0.5) within group (order by waited_s)","avg(waited_s)")],
 ["rounds down", s=>s.replace("ceil(s.med / 5.0)","floor(s.med / 5.0)")],
 ["kinds mixed", s=>s.replace("where ranked = coalesce(p_ranked, false) and at >=","where at >=")],
 ["window 48 h not 24 h", s=>s.replace("at >= now() - interval '24 hours'","at >= now() - interval '48 hours'")],
 ["log carries the player", s=>s.replace("ranked   boolean not null,","ranked   boolean not null, player_id text,")],
 ["anon may read the log", s=>s.replace("revoke all on public.seek_wait_log from anon, authenticated;","grant select on public.seek_wait_log to anon;")],
 ["real log not put back", s=>s.replace("  insert into public.seek_wait_log (ranked, waited_s, at) select ranked, waited_s, at from zz_wait_keep;\n","")],
];
(async()=>{let miss=0;
 for(const [name,f] of S){
  const sql=f(base); if(sql===base){console.log("SABOTAGE DID NOT APPLY:",name);miss++;continue;}
  const db=new PGlite(); await db.exec("create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;");
  for(const p of pre) await db.exec(p);
  try{
   if(name==="real log not put back"){ await db.exec(base); await db.exec("insert into public.seek_wait_log (ranked, waited_s) values (false, 9);"); await db.exec(sql);
     const n=(await db.query("select count(*)::int n from public.seek_wait_log")).rows[0].n; if(n===1){console.log("NOT CAUGHT:",name);miss++;} else console.log("caught:",name,"- the real row was lost (",n,")"); continue; }
   const r=await db.exec(sql);
   if(name==="anon may read the log"){ await db.exec("set role anon"); try{ await db.query("select * from public.seek_wait_log"); console.log("caught:",name,"- anon read it"); }catch(e){ console.log("NOT CAUGHT:",name); miss++; } continue; }
   console.log("NOT CAUGHT:",name,JSON.stringify(r[r.length-1].rows[0]));miss++;}
  catch(e){console.log("caught:",name,"-",e.message.slice(0,110));}
 }
 console.log("sabotages:",S.length,"uncaught/unapplied:",miss);process.exit(miss?1:0);
})();
