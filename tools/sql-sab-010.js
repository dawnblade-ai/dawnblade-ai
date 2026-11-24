/* tools/sql-sab-010.js — SABOTAGE 010_rating_window.sql ON PGLITE: each edit must make the file's own self-check raise. PGLITE_DIR=<scratch with @electric-sql/pglite> node tools/sql-sab-010.js. Offline; NOT part of npm test. */
const path=require("path"),fs=require("fs");
const {PGlite}=require(require.resolve("@electric-sql/pglite",{paths:[process.env.PGLITE_DIR]}));
const D=path.join(__dirname,"..","server","supabase")+path.sep;
const base=fs.readFileSync(D+"010_rating_window.sql","utf8");
const pre=["001_tables.sql","002_players.sql","003_names.sql","004_recovery.sql","005_table_cap.sql","006_ratings.sql","007_forfeit.sql","008_ladder.sql","009_seek.sql"].map(f=>fs.readFileSync(D+f,"utf8"));
const W=`abs(coalesce((select r.rating from public.ratings r where r.player_id = o.player_id), public.rating_start()) - my_rating)
          <= public.seek_window(greatest(my_wait, extract(epoch from (now() - o.created_at))))`;
const S=[
 ["window ignored", s=>s.replace("and (not p_ranked or "+W+")","")],
 ["window never widens", s=>s.replace("else 100 + 50 * floor(greatest(p_waited, 0) / 20)::integer end","else 100 + 0 * floor(greatest(p_waited, 0) / 20)::integer end")],
 ["casual wrongly windowed", s=>s.replace("(not p_ranked or "+W+")",W)],
 ["narrower of the two", s=>s.replace("greatest(my_wait, extract(epoch from (now() - o.created_at)))","least(my_wait, extract(epoch from (now() - o.created_at)))")],
 ["caller's wait ignored", s=>s.replace("greatest(my_wait, extract(epoch from (now() - o.created_at)))","extract(epoch from (now() - o.created_at))")],
 ["candidate's wait ignored", s=>s.replace("greatest(my_wait, extract(epoch from (now() - o.created_at)))","my_wait")],
 ["unrated reads as zero", s=>s.replace("public.rating_start()) - my_rating","0) - my_rating")],
 ["newest first", s=>s.replace('order by o.created_at, o.player_id collate "C" limit 1','order by o.created_at desc, o.player_id collate "C" limit 1')],
 ["ignores kind", s=>s.replace("o.ranked = p_ranked and o.taken_at is null","o.taken_at is null")],
 ["matches a taken seek", s=>s.replace("o.ranked = p_ranked and o.taken_at is null","o.ranked = p_ranked")],
 ["window step 10 s not 20 s", s=>s.replace("/ 20)::integer end","/ 10)::integer end")],
 ["window base 200", s=>s.replace("else 100 + 50","else 200 + 50")],
 ["never opens fully", s=>s.replace("when p_waited >= public.seek_window_open_s() then 1000000 else ","when p_waited >= public.seek_window_open_s() then 100 + 50 * floor(greatest(p_waited, 0) / 20)::integer else ")],
 ["opens at 300 s not 180 s", s=>s.replace("as 'select 180'","as 'select 300'")],
 ["anon may call", s=>s.replace("revoke all on function public.seek_step(text, boolean, text, integer) from public, anon, authenticated;","grant execute on function public.seek_step(text, boolean, text, integer) to anon;")],
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
