/* tools/sql-sab-007.js — THE SABOTAGES OF 007_forfeit.sql ON PGLITE (SERVER S5.2). Each edit of the file must make its own self-check raise.
     PGLITE_DIR=<scratch with @electric-sql/pglite> node tools/sql-sab-007.js      (offline; not part of npm test; exits 1 if a sabotage is missed) */
const fs=require("fs"),path=require("path");const dir=process.env.PGLITE_DIR;if(!dir){console.error("set PGLITE_DIR");process.exit(2);}
const {PGlite}=require(require.resolve("@electric-sql/pglite",{paths:[dir]}));
const R=path.join(__dirname,"..","server","supabase")+"/";
const base=fs.readFileSync(R+"007_forfeit.sql","utf8");
const FOOT="      footprint := exists (select 1 from public.ratings r where r.player_id = cur and r.games > 0)\n                or exists (select 1 from public.results x where x.player_0 = cur or x.player_1 = cur)\n                or exists (select 1 from public.tables t where t.row->>'ranked' = 'true' and coalesce(t.row->>'over', '') <> 'true' and (t.row->'owners') ? cur);\n";
const sabs=[
 ["the results table still refuses a forfeit","alter table public.results add constraint results_how_check check (how in ('life', 'concession', 'stalemate', 'forfeit'));","alter table public.results add constraint results_how_check check (how in ('life', 'concession', 'stalemate'));"],
 ["result_record still refuses a forfeit","p_how not in ('life', 'concession', 'stalemate', 'forfeit')","p_how not in ('life', 'concession', 'stalemate')"],
 ["a forfeit may have no winner","  if (p_how = 'stalemate') <> (p_winner is null) then raise exception 'result_record: a draw is exactly a stalemate'; end if;\n",""],
 ["a repeated forfeit is recorded twice (no idempotency)","  if found then\n    return jsonb_build_object('recorded', false,","  if false then\n    return jsonb_build_object('recorded', false,"],
 ["result_record lost a player lock","  perform pg_advisory_xact_lock(hashtextextended('dawnblade-rating|' || greatest(p_p0, p_p1), 0));\n",""],
 ["every throwaway is deleted (the v6.30 behaviour)",FOOT,"      footprint := false;\n"],
 ["the unfinished-game footprint is ignored",FOOT,"      footprint := exists (select 1 from public.ratings r where r.player_id = cur and r.games > 0) or exists (select 1 from public.results x where x.player_0 = cur or x.player_1 = cur);\n"],
 ["a finished game counts as a footprint",FOOT,"      footprint := exists (select 1 from public.ratings r where r.player_id = cur and r.games > 0) or exists (select 1 from public.results x where x.player_0 = cur or x.player_1 = cur) or exists (select 1 from public.tables t where t.row->>'ranked' = 'true' and (t.row->'owners') ? cur);\n"],
 ["rating and results ignored (only tables count)",FOOT,"      footprint := exists (select 1 from public.tables t where t.row->>'ranked' = 'true' and coalesce(t.row->>'over', '') <> 'true' and (t.row->'owners') ? cur);\n"],
 ["the orphan keeps its name","        update public.players set display_name = null, name_fold = null where id = cur;     -- the name is freed; the row, its rating and its results stay\n",""],
 ["the orphan keeps its recovery codes","        delete from public.recovery where player_id = cur;                                    -- an orphan cannot be recovered into by a stray code\n",""],
 ["the orphan's rating is merged into the recovered player","        update public.players set display_name = null, name_fold = null where id = cur;","        update public.ratings set games = games + (select games from public.ratings where player_id = cur), losses = losses + (select losses from public.ratings where player_id = cur) where player_id = tgt;\n        update public.players set display_name = null, name_fold = null where id = cur;"],
 ["a footprint refuses the redeem instead","      if footprint then\n","      if footprint then\n        return query select 'refused'::text, null::text; return;\n"],
 ["anon may redeem","grant execute on function public.recovery_redeem(text, text, text) to service_role;","grant execute on function public.recovery_redeem(text, text, text) to service_role, anon;"],
];
async function fresh(){const db=new PGlite();await db.exec("create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;");
  for(const f of ["001_tables.sql","002_players.sql","003_names.sql","004_recovery.sql","005_table_cap.sql","006_ratings.sql"]) await db.exec(fs.readFileSync(R+f,"utf8"));return db;}
(async()=>{let bad=0;
 {const db=await fresh();await db.exec(base);await db.exec(base);console.log("control: the real file passes its self-check twice");}
 for(const [n,a,b] of sabs){
  if(base.split(a).length-1!==1){console.log("ANCHOR NOT UNIQUE",n);bad++;continue;}
  const db=await fresh();let seen=null;
  try{await db.exec(base.replace(a,()=>b));}catch(e){seen=e.message;}
  if(seen) console.log("SEEN   ",n,"->",seen.slice(0,70)); else {bad++;console.log("MISSED ",n);}
 }
 console.log(bad?"FAILURES "+bad:"all "+sabs.length+" sabotages seen");process.exit(bad?1:0);})();
