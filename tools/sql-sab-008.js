/* tools/sql-sab-008.js — SABOTAGE 008_ladder.sql ON PGLITE: each edit must make the file's own self-check raise. PGLITE_DIR=<scratch with @electric-sql/pglite> node tools/sql-sab-008.js. Offline; NOT part of npm test. */
const path=require("path"),fs=require("fs");
const {PGlite}=require(require.resolve("@electric-sql/pglite",{paths:[process.env.PGLITE_DIR]}));
const D=path.join(__dirname,"..","server","supabase")+path.sep;
const base=fs.readFileSync(D+"008_ladder.sql","utf8");
const pre=["001_tables.sql","002_players.sql","003_names.sql","004_recovery.sql","005_table_cap.sql","006_ratings.sql","007_forfeit.sql"].map(f=>fs.readFileSync(D+f,"utf8"));
const S=[
 ["no floor", s=>s.replace("where r.games >= p_floor and p.display_name is not null and p.name_fold is not null","where p.display_name is not null and p.name_fold is not null")],
 ["orphans listed", s=>s.replace("             and exists (select 1 from public.identities i where i.player_id = p.id)\n           order by","           order by")],
 ["nameless listed", s=>s.replace("where r.games >= p_floor and p.display_name is not null and p.name_fold is not null","where r.games >= p_floor")],
 ["no games tiebreak", s=>s.replace("order by r.rating desc, r.games desc, p.name_fold collate \"C\") as rk","order by r.rating desc, p.name_fold collate \"C\") as rk").replace("order by r.rating desc, r.games desc, p.name_fold collate \"C\"\n           limit","order by r.rating desc, p.name_fold collate \"C\"\n           limit")],
 ["name desc tiebreak", s=>s.split("p.name_fold collate \"C\"").join("p.name_fold collate \"C\" desc").replace("p2.name_fold collate \"C\" < mine_fold","p2.name_fold collate \"C\" > mine_fold")],
 ["cap ignored", s=>s.replace("limit p_limit) t","limit 100) t")],
 ["rank off by one", s=>s.replace("rk := ahead + 1;","rk := ahead;")],
 ["id leaked", s=>s.replace("jsonb_build_object('rank', t.rk,","jsonb_build_object('id', t.player_id, 'rank', t.rk,").replace("select row_number() over (order by r.rating desc, r.games desc, p.name_fold collate \"C\") as rk,","select p.id as player_id, row_number() over (order by r.rating desc, r.games desc, p.name_fold collate \"C\") as rk,")],
 ["table code leaked", s=>s.replace("'winner', x.winner, 'how'","'table', x.table_id, 'winner', x.winner, 'how'")],
 ["recent oldest first", s=>s.replace("order by x.ended_at desc, x.game_id desc), '[]'::jsonb)","order by x.ended_at asc, x.game_id asc), '[]'::jsonb)")],
 ["recent cap ignored", s=>s.replace("order by ended_at desc, game_id desc limit p_recent) x","order by ended_at desc, game_id desc limit 50) x")],
 ["volatile", s=>s.replace("language plpgsql\nstable\n","language plpgsql\nvolatile\n")],
 ["anon may call", s=>s.replace("revoke all on function public.ladder_get(integer, integer, integer, text) from public, anon, authenticated;","grant execute on function public.ladder_get(integer, integer, integer, text) to anon;")],
 ["caller listed w/o floor", s=>s.replace("listed := me.games >= p_floor and mine_name","listed := mine_name")],
 ["caller rank ignores orphans", s=>s.replace("where r2.games >= p_floor and p2.display_name is not null and p2.name_fold is not null and exists (select 1 from public.identities i2 where i2.player_id = p2.id)","where r2.games >= p_floor and p2.display_name is not null and p2.name_fold is not null")],
 ["stranger gets a line", s=>s.replace("    if found then\n      select coalesce(r.rating","    if true then\n      select coalesce(r.rating")],
 ["caller line adds id", s=>s.replace("jsonb_build_object('name', mine_name, 'rating', me.rating","jsonb_build_object('id', p_player, 'name', mine_name, 'rating', me.rating")],
 ["writes on read", s=>s.replace("  ans := jsonb_build_object('ladder', lad, 'recent', rec);","  ans := jsonb_build_object('ladder', lad, 'recent', rec);\n  if p_player is not null then perform 1; end if;").replace("language plpgsql\nstable\n","language plpgsql\nvolatile\n").replace("  select coalesce(jsonb_agg(jsonb_build_object('names'","  update public.players set last_seen_at = now() where id = p_player;\n  select coalesce(jsonb_agg(jsonb_build_object('names'")],
 ["ratings from a copy (stale games)", s=>s.replace("'games', t.games,","'games', t.games - 1,")],
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
