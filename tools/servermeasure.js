#!/usr/bin/env node
/* ============================================================
   tools/servermeasure.js — WHAT ONE HOSTED-REFEREE REQUEST COSTS (SERVER S1)

   The hosted referee rehydrates a hub from its stored row on every request
   (server/referee.js), so the numbers that matter are: how big the row gets,
   how long a COLD instance takes to load the engine and the pinned pool, and
   how long one rehydrate + apply + save takes. This plays judged games over
   the fake store and bus (test/helpers/serverfakes.js) and reports them.

       node tools/servermeasure.js [games]               under Node
       DENO=<path> node tools/servermeasure.js --deno    the same, under Deno
                                                         (Deno reads CJS with
                                                         --unstable-detect-cjs)
   Without a deno binary `--deno` says SKIPPED, never a number. Wall-clock on
   a shared machine: read medians, and run it twice. */
const path = require("path");
const {spawnSync, execSync} = require("child_process");

if(process.argv.indexOf("--deno") >= 0 && !process.env.__SERVERMEASURE_CHILD){
  let deno = process.env.DENO || null;
  if(!deno){ try { deno = execSync("command -v deno", {encoding: "utf8"}).trim() || null; } catch(_){ deno = null; } }
  if(!deno){ console.log("DENO      SKIPPED — no deno binary (set DENO=…); nothing was measured"); process.exit(0); }
  const r = spawnSync(deno, ["run", "--unstable-detect-cjs", "--allow-read", "--allow-env", "--allow-sys", "--no-check", __filename, ...process.argv.slice(2).filter(a => a !== "--deno")],
                      {encoding: "utf8", maxBuffer: 64 << 20, env: {...process.env, __SERVERMEASURE_CHILD: "1"}});
  process.stdout.write("DENO      " + spawnSync(deno, ["--version"], {encoding: "utf8"}).stdout.split("\n")[0] + "\n" + (r.stdout || "") + (r.stderr || ""));
  process.exit(r.status || 0);
}

const now = () => performance.now();
const fmt = x => x.toFixed(1) + " ms";
const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0; };
const ROOT = path.join(__dirname, "..");
const runtime = typeof Deno !== "undefined" ? "Deno " + Deno.version.deno : "Node " + process.version;
console.log("RUNTIME   " + runtime);

/* ---- COLD LOAD: what a fresh Edge instance does before its first request ---- */
let t = now();
const SERVER = require(path.join(ROOT, "server", "referee.js"));              /* hub, net, referee, wire, judge, invariants … */
const tEngine = now() - t; t = now();
const pool = require(path.join(ROOT, "data", "pool.js"));                     /* the pinned pool: every card as printed */
const tPool = now() - t; t = now();
const Cards = require(path.join(ROOT, "engine", "cards.js")), Judge = require(path.join(ROOT, "engine", "judge.js"));
const DB = Cards.buildMaps(pool.filter(c => c && c.name).map(Cards.mapDbCard));
Judge.setDb(DB);
const tDb = now() - t; t = now();
const {loadData} = require(path.join(ROOT, "test", "helpers", "extract.js"));
const W = loadData();                                                          /* HEROES and DECKS: index.html's data script */
const tData = now() - t;
console.log("COLD LOAD engine modules " + fmt(tEngine) + " · pool.js (" + pool.length + " records) " + fmt(tPool) + " · card maps " + fmt(tDb) +
            " · hero/deck data " + fmt(tData) + " · total " + fmt(tEngine + tPool + tDb + tData));

/* ---- the games ---- */
const T = require(path.join(ROOT, "test", "helpers", "judgetable.js"));
const {makeServerHub} = require(path.join(ROOT, "test", "helpers", "serverhub.js"));
const games = +process.argv.filter(a => /^\d+$/.test(a))[0] || 3;
const PAIRS = [["kayo", "dash"], ["briar", "lyath"], ["arakni", "viserai"], ["bravo", "fai"], ["azalea", "gravy"]];
const all = [], rows = [];
for(let i = 0; i < games; i++){
  const [a, b] = PAIRS[i % PAIRS.length];
  const mk = makeServerHub({seedKey: "measure-" + i});
  let hub; const g0 = now();
  const r = T.judgedGame(a, b, "measure-" + i, {makeHub: o => (hub = mk(o))});
  const au = hub.audit, sizes = au.store.sizes;
  const writes = au.timings.filter(x => x.op === "frame" && /^net:intent/.test(x.what) && x.version != null);
  const ms = writes.map(x => x.ms);
  rows.push({a, b, steps: r.steps, calls: au.calls, mid: sizes[Math.floor(sizes.length / 2)], last: sizes[sizes.length - 1], largest: au.store.largest(),
             medianMs: q(ms, 0.5), p95Ms: q(ms, 0.95), maxMs: q(ms, 1), respMax: Math.max(...au.timings.map(x => x.bytes)), over: !!r.over, wall: now() - g0});
  all.push(...ms);
}
for(const r of rows)
  console.log((r.over ? "GAME     " : "UNFINISHED ") + (r.a + " v " + r.b).padEnd(18) + r.steps + " actions, " + r.calls + " requests · stored row mid-game " + r.mid + " B, at the end " + r.last +
              " B, largest " + r.largest + " B · largest response " + r.respMax + " B · action request median " + fmt(r.medianMs) + " p95 " + fmt(r.p95Ms) + " max " + fmt(r.maxMs));
console.log("ACTION    rehydrate + apply + save + push, one request: median " + fmt(q(all, 0.5)) + " · p95 " + fmt(q(all, 0.95)) + " · max " + fmt(q(all, 1)) + " over " + all.length + " actions in " + games + " games");
console.log("ROW       largest stored row " + Math.max(...rows.map(r => r.largest)) + " bytes; mid-game " + rows.map(r => r.mid).join(" / "));
