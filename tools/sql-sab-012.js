/* tools/sql-sab-012.js — SABOTAGE 012_my_games.sql ON PGLITE: each edit must make the file's own self-check raise. PGLITE_DIR=<scratch with @electric-sql/pglite> node tools/sql-sab-012.js. Offline; NOT part of npm test. */
const path=require("path"),fs=require("fs");
const {PGlite}=require(require.resolve("@electric-sql/pglite",{paths:[process.env.PGLITE_DIR]}));
const D=path.join(__dirname,"..","server","supabase")+path.sep;
const base=fs.readFileSync(D+"012_my_games.sql","utf8");
const pre=["001_tables.sql","002_players.sql","003_names.sql","004_recovery.sql","005_table_cap.sql","006_ratings.sql","007_forfeit.sql","008_ladder.sql","009_seek.sql","010_rating_window.sql","011_seek_wait.sql"].map(f=>fs.readFileSync(D+f,"utf8"));
const S=[
 ["seat 1 games not read", s=>s.replace("from public.results x where x.player_1 = p_player) u","from public.results x where false) u")],
 ["seat 0 games not read", s=>s.replace("from public.results x where x.player_0 = p_player\n","from public.results x where false\n")],
 ["seat 1 result read from seat 0's side", s=>s.replace("when x.winner = 1 then 'won' else 'lost' end\n                    from public.results x where x.player_1","when x.winner = 0 then 'won' else 'lost' end\n                    from public.results x where x.player_1")],
 ["change read from the other seat", s=>s.replace("x.rating_1_after - x.rating_1_before,","x.rating_0_after - x.rating_0_before,")],
 ["foe hero is own hero", s=>s.replace("select x.game_id, x.ended_at, x.hero_1, x.hero_0, x.name_0,","select x.game_id, x.ended_at, x.hero_1, x.hero_1, x.name_0,")],
 ["oldest first", s=>s.replace("order by u.ended_at desc, u.game_id desc limit 10","order by u.ended_at asc, u.game_id asc limit 10")],
 ["limit 11", s=>s.replace("u.game_id desc limit 10","u.game_id desc limit 11")],
 ["limit 9", s=>s.replace("u.game_id desc limit 10","u.game_id desc limit 9")],
 ["a draw reads won", s=>s.replace("case when x.winner is null then 'drew' when x.winner = 0 then 'won'","case when x.winner is null then 'won' when x.winner = 0 then 'won'")],
 ["nameless caller gets a list", s=>s.replace("if mine_name is not null then","if true then")],
 ["a named player with no games gets no key", s=>s.replace("'[]'::jsonb)\n          into mine","null)\n          into mine")],
 ["leaks the game id", s=>s.replace("jsonb_build_object('hero', g.hero,","jsonb_build_object('game', g.game_id, 'hero', g.hero,")],
 ["leaks the table code", s=>s.replace("jsonb_build_object('hero', g.hero,","jsonb_build_object('t', (select table_id from public.results z where z.game_id = g.game_id), 'hero', g.hero,")],
 ["not stable", s=>s.replace("language plpgsql\nstable\n","language plpgsql\nvolatile\n")],
 ["anon may call", s=>s.replace("from public, anon, authenticated;\ngrant","from public;\ngrant execute on function public.ladder_get(integer, integer, integer, text) to anon;\ngrant")],
];
(async()=>{let miss=0;
 for(const [name,f] of S){
  const sql=f(base); if(sql===base){console.log("SABOTAGE DID NOT APPLY:",name);miss++;continue;}
  const db=new PGlite(); await db.exec("create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;");
  for(const p of pre) await db.exec(p);
  try{ await db.exec(sql);
   if(name==="anon may call"){ await db.exec("set role anon"); try{ await db.query("select public.ladder_get(3,50,10,null)"); console.log("caught:",name,"- anon called it"); }catch(e){ console.log("NOT CAUGHT:",name); miss++; } continue; }
   console.log("NOT CAUGHT:",name);miss++;}
  catch(e){console.log("caught:",name,"-",e.message.slice(0,100));}
 }
 console.log("sabotages:",S.length,"uncaught/unapplied:",miss);process.exit(miss?1:0);
})();
