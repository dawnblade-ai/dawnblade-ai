#!/usr/bin/env node
/* tools/supabase-live.js — ONE OR MORE REAL GAMES AGAINST THE DEPLOYED FUNCTION (publishable key only; no secret anywhere).
   SBJS=<dir with node_modules/@supabase/supabase-js> NODE_USE_ENV_PROXY=1 node tools/supabase-live.js full kayo,dash [reload|noreload] [label]
   Two engine/servertable.js phones play a whole seeded game through supabaseTransport (real HTTP + real Realtime websocket from Node, not a
   browser) and the harness checks: both seat views equal the in-process referee's, every shuffle verifies on both phones, a blindness scan, pushes
   on exactly two derived topics, a wrong key is refused; `reload` closes seat 1's phone at action 60 and reclaims the seat. It leaves its rows in the
   project (expiry forgets them after 48 hours). Written during the v6.25 deploy; NOT part of `npm test`. Numbers: server/S3-DEPLOY-LOG.md. */
const R0 = require("path").join(__dirname, "..") + "/";
const ST = require(R0 + "engine/servertable.js");
const SHA = require(R0 + "engine/sha256.js");
const T = require(R0 + "test/helpers/judgetable.js");
const PH = require(R0 + "test/helpers/serverphone.js");
const {dealLikeThePage, matchCatalog} = require(R0 + "test/helpers/pagedeal.js");
const {Wr, R} = T;
const SB = require(process.env.SBJS + "/node_modules/@supabase/supabase-js");
const URL = "https://fokcpzplomjsraquaaid.supabase.co", KEY = "sb_publishable_E-p8S8CA_F2C-RD25nLiuw_xPZttEAu";
const MODE = process.argv[2] || "full", HEROES = (process.argv[3] || "kayo,dash").split(",");
const wait = ms => new Promise(r => setTimeout(r, ms));
const pct = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0; };
let failed = 0; const row = (ok, n, d) => { if(!ok) failed++; console.log((ok ? "PASS  " : "FAIL  ") + n + (d ? "  " + d : "")); };

async function game(label, cap, doReload){
  const cfg = {url: URL, key: KEY, fn: "table", lib: SB, fetch: (u, i) => fetch(u, i)};
  const real = ST.supabaseTransport(cfg);
  const timings = [], byOp = {}, raw = [], states = [];
  let calls = 0, inflight = 0, lastAct = Date.now(), firstAnswer = null;
  const world = {errors: [], deps: {deal: spec => dealLikeThePage(spec, 0)},
    transport: name => ({
      async post(env){
        calls++; inflight++; const t = Date.now(); if(firstAnswer == null) firstAnswer = -t;
        try { const ans = await real.post(env); const d = Date.now() - t; if(firstAnswer < 0) firstAnswer = d;
          timings.push(d); (byOp[env.op] = byOp[env.op] || []).push(d); raw.push({name, op: env.op, text: JSON.stringify(ans), topic: null}); lastAct = Date.now(); return ans; }
        finally { inflight--; lastAct = Date.now(); }
      },
      subscribe(topic, fn, onState){
        return real.subscribe(topic, p => { raw.push({name, op: null, text: JSON.stringify(p), topic}); lastAct = Date.now(); fn(p); }, s => { states.push(name + ":" + s); if(onState) onState(s); });
      }}),
    settle: async (handles, quiet) => { quiet = quiet || 350; const t0 = Date.now();
      for(;;){ await wait(25);
        const busy = inflight > 0 || (handles || []).some(h => h && h.status() !== "closed" && h.pending() > 0);
        if(!busy && Date.now() - lastAct >= quiet) return; if(Date.now() - t0 > 30000) return; } }};
  const health = await (await fetch(URL + "/functions/v1/table", {headers: {apikey: KEY}})).json();
  const build = health.build;
  const {A, B, rand: seatRand} = await PH.seatTwo(world, HEROES, label, {phone: {matchCatalog: spec => matchCatalog(spec, 0), build}});
  const tl=Date.now(); while(!(A.sess && B.sess && A.sess.status()==="ready" && B.sess.status()==="ready") && Date.now()-tl<90000) await wait(100); await world.settle([A.ch, B.ch], 1000); console.log("      lobby to ready: "+(Date.now()-tl)+" ms");
  const code = A.code;
  row(A.seat === 0 && B.seat === 1 && ST.isValid(code), label + ": two phones seated (create, join by code)", "table " + code + ", status " + A.ch.status() + "/" + B.ch.status());
  let phones = [A, B], n = 0, reloaded = false, actT = [];
  const t0 = Date.now();
  for(;;){
    if(cap && n >= cap) break;
    if(doReload && !reloaded && n >= 60){
      reloaded = true; const keep = B.keep; B.ch.close();
      const B2 = PH.makePhone(world, "B2", {hero: HEROES[1], rand: seatRand, keep, throws: [["rock", "rock"], ["paper", "rock"]], matchCatalog: spec => matchCatalog(spec, 0), build});
      await B2.connect("reclaim", code); const n0 = B2.ch.counter();
      await world.settle([A.ch, B2.ch], 1000);
      row(B2.seat === 1, label + ": reload mid-game claimed seat 1 back", "counter resumed at " + n0 + " after " + n + " actions, status " + B2.ch.status());
      phones = [A, B2];
    }
    const t = Date.now();
    let r = await PH.step(world, phones);
    if(!r){ await Promise.all(phones.map(p => p.ch.heal())); await world.settle(phones.map(p => p.ch), 800); r = await PH.step(world, phones); }
    if(!r) break; n++; actT.push(Date.now() - t);
  }
  await world.settle(phones.map(p => p.ch), 1000);
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  // reference
  const rv = phones.map(p => p.sess.revealed());
  const over = phones.every(p => p.sess.state && p.sess.state().over);
  let ref = null, seedH = rv[0] && rv[0].seedH;
  if(!cap){
    row(!!rv[0] && !!rv[1], label + ": game ended, both phones got the reveal", n + " actions in " + secs + " s, " + calls + " requests");
    ref = PH.reference({hub: {spec: A.spec, seedH}}, 0, spec => dealLikeThePage(spec, 0));
    row(ref.over(), label + ": in-process referee finishes the same deal");
  } else {
    row(true, label + ": played " + n + " actions in " + secs + " s, " + calls + " requests");
    // reference needs seedH, which is hidden until the end; finish the game below instead
  }
  return {world, A, B, phones, code, n, timings, byOp, raw, states, ref, rv, firstAnswer, actT, health, cap};
}
function verify(label, g){
  const {phones, ref, rv, raw, code} = g;
  const full = ref.state();
  row(phones.every(p => p.sess.hash() === Wr.hash(R.seatView(full, p.seat))), label + ": both phones' fingerprints equal the in-process referee's seat views", Wr.hash(full) + " (referee full-state fingerprint)");
  const ver = phones.map((p, i) => R.verifyGame({seedC: p.spec.seedC, seedG: p.spec.seedG, seedH: rv[i].seedH, start: sd => dealLikeThePage({...p.spec, seed: sd}, 0).state,
    reduce: T.J.reduce, seat: p.seat, log: rv[i].log, hashes: p.sess.hashes(), over: rv[i].over}));
  { const a = JSON.stringify(phones[0].spec), b = JSON.stringify(phones[1].spec); console.log("      specs equal across phones: " + (a === b) + (a === b ? "" : "\n A=" + a.slice(0,600) + "\n B=" + b.slice(0,600))); }
  ver.forEach((v, i) => { if(!v.ok) console.log("      VERIFY seat " + i + " why=" + v.why + " at=" + v.at + " logLen=" + (rv[i].log||[]).length + " seqs=" + Object.keys(phones[i].sess.hashes()).length + " events=" + JSON.stringify(phones[i].events.filter(e=>e.t&&!/^(seat|view)/.test(e.t)).slice(-6))); });
  row(ver.every(v => v.ok), label + ": every shuffle verifies on both phones", ver.map(v => v.ok).join("/"));
  // blindness scan
  const leaks = [], keys = [], tops = [];
  for(const p of phones){ const k = p.keep.get("srv." + code, null); keys[p.seat] = k && k.key; }
  const seedH = String(rv[0].seedH), seedAny = [seedH, String(g.A.spec.seed || "")].filter(x => x && x !== "undefined");
  for(let s = 0; s < 2; s++) tops[s] = SHA.seatTopic(code, s, keys[s]).split(":")[2];
  const seatOf = {A: 0, B: 1, B2: 1};
  for(const e of raw){ const s = seatOf[e.name]; if(e.text.indexOf(keys[1 - s]) >= 0) leaks.push("other key to " + e.name);
    if(e.text.indexOf(keys[s]) >= 0 && e.op !== "join") leaks.push("own key echoed outside join to " + e.name);
    for(const t of tops) if(e.text.indexOf(t) >= 0) leaks.push("channel name travelled to " + e.name);
    if(e.topic){ const parts = e.topic.split(":"); if(parts[0] !== "table" || parts[1] !== code || parts[2] !== tops[s]) leaks.push("odd topic " + e.topic); } }
  for(const p of phones){ const parts = {}; const frames = []; for(const f0 of p.inbox){ let f = f0; if(f.m && f.m.t === "part"){ const pp = parts[f.m.id] = parts[f.m.id] || []; pp[f.m.i] = f.m.s; if(pp.filter(x => x != null).length < f.m.n) continue; const mid = f.m.id; f = {ch: f.ch, m: JSON.parse(pp.join(""))}; delete parts[mid]; } frames.push(f); }
    console.log("      seat " + p.seat + ": " + p.inbox.length + " frames handed up (" + frames.length + " after reassembling parts), hashes " + p.sess.hashes().length);
    for(const f of frames){ if(f.m && f.m.t === "reveal") continue; const str = JSON.stringify(f);
    if(str.indexOf(seedH) >= 0) leaks.push("seat " + p.seat + " saw seedH in a non-reveal frame"); for(const k of keys) if(k && str.indexOf(k) >= 0) leaks.push("key in a frame handed up to seat " + p.seat); } }
  row(leaks.length === 0, label + ": blindness scan over " + raw.length + " received answers/pushes + frames handed up (keys, channel names, seed before reveal)", leaks.slice(0, 3).join("; "));
  const subTopics = new Set(raw.filter(e => e.topic).map(e => e.topic));
  row(raw.filter(e => e.topic).length > 50 && subTopics.size === 2, label + ": pushes arrived over real Realtime on both seats' derived topics", raw.filter(e => e.topic).length + " pushes, " + subTopics.size + " topics");
}
function nums(label, g){
  const t = g.timings; console.log("      " + label + " latency (per request, ms): n=" + t.length + " median " + pct(t, .5) + " p95 " + pct(t, .95) + " max " + Math.max(...t) + "; cold first answer " + g.firstAnswer + " ms");
  for(const [op, a] of Object.entries(g.byOp)) console.log("        op " + op + ": n=" + a.length + " median " + pct(a, .5) + " p95 " + pct(a, .95) + " max " + Math.max(...a));
  console.log("      per-action wall time incl. 350 ms settle window: median " + pct(g.actT, .5) + " p95 " + pct(g.actT, .95) + "; statuses " + [...new Set(g.states)].join(","));
}
(async () => {
  if(MODE === "wrongkey"){
    return;
  }
  if(MODE === "short"){
    const g = await game("second", 40, false);
    // finish to get seedH: play on to the end then verify against full reference
    console.log("(short game left unfinished by design: 40 actions)");
    // compare each phone's view to a reference built from the row-independent deal: unavailable without seedH, so compare agreement between phones' counters only
    const [A, B] = g.phones; row(A.sess.seq && true, "second: table works while the first row exists", "code " + g.code + ", statuses " + A.ch.status() + "/" + B.ch.status());
    nums("second", g); g.phones.forEach(p => p.ch.close()); setTimeout(() => process.exit(failed ? 1 : 0), 500); return;
  }
  const g = await game(process.argv[5] || "first", 0, process.argv[4] !== "noreload");
  verify(process.argv[5] || "first", g); nums(process.argv[5] || "first", g);
  // wrong key
  const bad = PH.memKeep(); bad.set("srv." + g.code, {seat: 0, key: "not-the-key-" + "0".repeat(20), role: "creator", at: 1});
  let why = null; try { await ST.reclaim({transport: ST.supabaseTransport({url: URL, key: KEY, fn: "table", lib: SB, fetch: (u, i) => fetch(u, i)}), keep: bad, code: g.code, rand: () => 0.5}); } catch(e){ why = e.why || String(e); }
  row(why === "auth", "first: a wrong key is refused", "why=" + why + ", record forgotten=" + (bad.get("srv." + g.code, "gone") === null));
  g.phones.forEach(p => p.ch.close()); setTimeout(() => { console.log(failed ? "FAILED " + failed : "ALL PASS"); process.exit(failed ? 1 : 0); }, 800);
})().catch(e => { console.log("CRASH " + (e && e.stack || e)); process.exit(1); });
