#!/usr/bin/env node
/* ============================================================
   tools/supabase-rehearse.js — THE REAL FUNCTION, UNDER DENO, AGAINST LOCAL STAND-INS (SERVER S3)

   The closest offline rehearsal of the deploy. It
     1. cuts the bundle (tools/supabase-bundle.js),
     2. starts tools/supabase-stub.js (the REST calls the function makes: PostgREST select, table_put, the HTTP
        Broadcast endpoint) on a local port,
     3. runs the GENERATED entry — table.single.ts and then the folder variant — with a Deno binary, pointed at the stub
        through SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY, exactly as the platform would,
     4. drives two engine/servertable.js phones through supabaseTransport's own `post` (real fetch, real HTTP, the
        publishable-key `apikey` header, path /functions/v1/table) for a full seeded game, the stub fanning broadcasts out
        to each phone's own derived channel,
     5. checks: the game ends; the stored row's game has the SAME fingerprint as the in-process referee playing the same
        deal; both phones agree with it; every shuffle verifies; nothing hidden reached either phone (the blindness scan of
        test/servertable.test.js); every broadcast went to a seat-key-derived topic, public, sealed under that seat's key;
        the stub saw no malformed call; the function logged no error.
   DENO=<path to deno> node tools/supabase-rehearse.js [--variant single|folder] [--hero a,b]   (npm install --prefix <scratch> deno)
   Needs no account, no key, no network beyond 127.0.0.1. Exits non-zero on any failure. NOT part of `npm test`. */
"use strict";
const path = require("path");
const net = require("net");
const {spawn, execSync, spawnSync} = require("child_process");
const {makeStub} = require("./supabase-stub.js");
const B = require("./supabase-bundle.js");
const T = require("../test/helpers/judgetable.js");
const PH = require("../test/helpers/serverphone.js");
const {dealLikeThePage, matchCatalog} = require("../test/helpers/pagedeal.js");
const ST = require("../engine/servertable.js");
const SHA = require("../engine/sha256.js");
const {Wr, R} = T;
const ROOT = path.join(__dirname, "..");
const OUT = path.join(require("os").tmpdir(), "dawnblade-rehearse-" + process.pid);

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const denoBin = () => { if(process.env.DENO) return process.env.DENO; try { return execSync("command -v deno", {encoding: "utf8"}).trim() || null; } catch(_){ return null; } };
const freePort = () => new Promise(res => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); }); });
const wait = ms => new Promise(r => setTimeout(r, ms));
const HEROES = (arg("--hero", "") || "kayo,dash").split(",");
let failed = 0;
const row = (ok, name, detail) => { if(!ok) failed++; console.log((ok ? "PASS  " : "FAIL  ") + name + (detail ? "  " + detail : "")); };
const median = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };

async function rehearse(label, entry, deno, uid0){
  const stub = makeStub({key: "rehearsal-service-key"});
  const {port: stubPort} = await stub.listen(0);
  const port = await freePort();
  const log = [];
  const child = spawn(deno, ["run", "--allow-net", "--allow-env", "--no-check", entry], {
    env: {...process.env, ...(uid0 ? {TABLE_UID0: String(uid0)} : {}), SUPABASE_URL: "http://127.0.0.1:" + stubPort, SUPABASE_SERVICE_ROLE_KEY: "rehearsal-service-key", DENO_SERVE_ADDRESS: "tcp:127.0.0.1:" + port},
    stdio: ["ignore", "pipe", "pipe"]});
  child.stdout.on("data", d => log.push(String(d))); child.stderr.on("data", d => log.push(String(d)));
  const base = "http://127.0.0.1:" + port;
  try {
    /* ---- cold start: the first request builds the card database ---- */
    let health = null; const t0 = Date.now();
    for(let i = 0; i < 100 && !health; i++){ try { const r = await fetch(base + "/"); if(r.ok) health = await r.json(); } catch(_){ await wait(150); } }
    const cold = Date.now() - t0;
    row(!!health && health.service === "dawnblade-table", label + ": the entry serves (health line)", health ? health.build + ", first answer after " + cold + " ms (process start + card database)" : log.join("").slice(0, 300));
    if(!health) return;
    const expectBuild = B.cut().build;
    row(health.build === expectBuild, label + ": its build id is the page's (DawnLobby.buildId of this tree's APP_VER / DATA_VER)", health.build);

    /* ---- the wire: supabaseTransport's own post, the stub's fan-out for subscribe ---- */
    const cfg = {url: base, key: "sb_publishable_rehearsal", fn: "table", fetch: (u, i) => fetch(u, i)};
    const real = ST.supabaseTransport(cfg);
    const subs = new Map(), inbound = [], outbound = [], posts = [], answers = [], timings = [];
    let calls = 0, inflight = 0;
    /* the real Realtime service re-encodes a broadcast with its object keys sorted (observed live, S3 deploy): the stand-in does too */
    const sorted = v => Array.isArray(v) ? v.map(sorted) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sorted(v[k])])) : v;
    stub.subscribe((topic, event, payload) => { const text = JSON.stringify(sorted(payload));
      for(const s of [...(subs.get(topic) || [])]){ inbound.push({topic, text, name: s.name}); setImmediate(() => s.fn(JSON.parse(text))); } });
    const world = {inbound, outbound, posts, answers, errors: [], deps: {deal: spec => dealLikeThePage(spec, uid0)}, row: id => stub.row(id),
      transport: name => ({
        async post(env){
          calls++; inflight++; const t = Date.now();
          try {
            outbound.push({name, text: JSON.stringify(env)}); posts.push({name, op: env.op, n: env.n});
            const ans = await real.post(env);
            timings.push(Date.now() - t);
            const text = JSON.stringify(ans); inbound.push({topic: null, text, op: env.op, name}); answers.push({name, op: env.op, ok: ans.ok, refused: ans.refused});
            return JSON.parse(text);
          } finally { inflight--; }
        },
        subscribe(topic, fn, onState){
          const s = {fn, name};
          if(!subs.has(topic)) subs.set(topic, new Set());
          subs.get(topic).add(s);
          if(onState) Promise.resolve().then(() => { if(subs.get(topic).has(s)) onState("joined"); });
          return () => subs.get(topic).delete(s);
        }}),
      settle: async (handles, maxTurns) => { let quiet = 0, last = -1;
        for(let i = 0; i < (maxTurns || 20000) && quiet < 4; i++){
          await new Promise(r => setTimeout(r, 1));
          const busy = inflight > 0 || (handles || []).some(h => h && h.status() !== "closed" && h.pending() > 0);
          if(!busy && calls === last) quiet++; else quiet = 0; last = calls; } }};

    const build = health.build;
    const {A, B: Bp} = await PH.seatTwo(world, HEROES, label, {phone: {matchCatalog: spec => matchCatalog(spec, uid0), build}});
    const code = A.code;
    row(A.seat === 0 && Bp.seat === 1 && ST.isValid(code), label + ": two phones seated through the function (create, claimed joins)", "table " + code);

    /* ---- play to the end, one action at a time from each phone's own view ---- */
    const phones = [A, Bp], scan = scanner(world, phones, code);
    scan.uidScan = !!uid0;          /* with the page's own uids (from 0) a hidden uid is indistinguishable from any small number: that run scans keys, seed and channel names only */
    let n = 0; const tg = Date.now();
    for(;;){
      let r = await PH.step(world, phones);
      if(!r){ await Promise.all(phones.map(p => p.ch.heal())); await world.settle(phones.map(p => p.ch)); r = await PH.step(world, phones); }
      if(!r) break;
      n++; scan.scan();
    }
    scan.wire();
    const full = PH.storedGame(world, code);
    const ref = PH.reference(world.row(code), 0, spec => dealLikeThePage(spec, uid0));
    row(!!full.over && ref.over(), label + ": the game was played to its end through the function", n + " actions, " + ((Date.now() - tg) / 1000).toFixed(1) + " s, " + calls + " requests");
    row(Wr.hash(full) === Wr.hash(ref.state()), label + ": the stored game's fingerprint equals the in-process referee's on the same deal", Wr.hash(full));
    row(phones.every(p => p.sess.hash() === Wr.hash(R.seatView(full, p.seat))), label + ": both phones' fingerprints are the referee's views of their seats");
    const ver = phones.map(p => { const rv = p.sess.revealed(); return rv && R.verifyGame({seedC: p.spec.seedC, seedG: p.spec.seedG, seedH: rv.seedH,
      start: sd => dealLikeThePage({...p.spec, seed: sd}, uid0).state, reduce: T.J.reduce, seat: p.seat, log: rv.log, hashes: p.sess.hashes(), over: rv.over}).ok; });
    row(ver.every(Boolean), label + ": every shuffle verifies on both phones", ver.join("/"));
    row(scan.leaks.length === 0, label + ": blindness scan (" + (uid0 ? "hidden uids, " : "") + "seed, seat keys, channel names) over everything each phone received is clean", scan.leaks.slice(0, 3).join("; "));
    row(world.answers.filter(a => !a.ok && a.refused !== "conflict").length === 0, label + ": nothing was refused but version races", JSON.stringify([...new Set(world.answers.filter(a => !a.ok).map(a => a.refused))]));

    /* ---- the channels, as the stub saw them ---- */
    const rowv = world.row(code), names = [0, 1].map(s => SHA.seatTopic(code, s, rowv.hub.keys[s]));
    const bc = stub.broadcasts;
    row(bc.length > 100 && bc.every(b => b.event === "frame" && b.private === false), label + ": every broadcast is a public 'frame' event", bc.length + " broadcasts");
    row(bc.every(b => names.includes(b.topic)) && bc.some(b => b.topic === names[0]) && bc.some(b => b.topic === names[1]), label + ": every topic is table:<code>:<hash of that seat's key>, both seats pushed to");
    row(bc.every(b => Object.keys(b.payload).sort().join() === "frames,mac,ver" && b.payload.mac === SHA.frameMac(rowv.hub.keys[names.indexOf(b.topic)], code, names.indexOf(b.topic), b.payload.ver, b.payload.frames)),
        label + ": every payload is {ver, frames, mac} and the seal verifies under that seat's own key (after the HTTP + JSON round trips)");
    row(stub.stats.bad.length === 0, label + ": the stub saw no malformed call (apikey / bearer / select / table_put args)", stub.stats.bad.slice(0, 3).join("; "));
    row(Math.max(...bc.map(b => JSON.stringify(b.payload).length)) < 240000, label + ": the largest broadcast is under the 250,000-byte endpoint limit", Math.max(...bc.map(b => JSON.stringify(b.payload).length)) + " bytes");
    const errs = log.join("").split("\n").filter(l => /error|exception|panick/i.test(l));
    row(errs.length === 0, label + ": the function logged no error", errs.slice(0, 2).join(" | "));
    console.log("      " + label + " numbers: median request " + median(timings) + " ms (HTTP + function + stub), largest stored row " + stub.stats.largestPut.toLocaleString("en-US") + " bytes, " + stub.stats.puts + " saves, " + stub.stats.conflicts + " conflicts, cold first answer " + cold + " ms");
    phones.forEach(p => p.ch.close());
  } finally { child.kill(); await stub.close(); }
}

/* the blindness scanner of test/servertable.test.js, over what each phone's channel handed up */
function scanner(world, phones, code){
  const out = {leaks: [], seen: [0, 0]}, parts = [null, null], ps = []; for(const p of phones) ps[p.seat] = p;
  let prev = null;
  out.scan = () => {
    const full = PH.storedGame(world, code), rowh = world.row(code).hub;
    const secret = [rowh.seedH, rowh.spec && rowh.spec.seed].filter(Boolean).map(String);
    const hid = [0, 1].map(s => T.hiddenUidSet(full, s));
    if(!prev) prev = hid;
    for(const s of [0, 1]){
      const both = new Set([...hid[s]].filter(u => prev[s].has(u)));
      for(const f0 of ps[s].inbox.slice(out.seen[s])){
        let f = f0;
        if(f.m && f.m.t === "part"){
          const pp = parts[s] && parts[s].id === f.m.id ? parts[s] : (parts[s] = {id: f.m.id, got: []});
          pp.got[f.m.i] = f.m.s;
          if(pp.got.filter(x => x != null).length < f.m.n) continue;
          f = {ch: f.ch, m: JSON.parse(pp.got.join(""))}; parts[s] = null;
        }
        if(f.m && f.m.t === "reveal"){ if(!full.over) out.leaks.push("early reveal"); continue; }
        const str = JSON.stringify(f);
        if(out.uidScan) for(const u of T.tokens(f)) if(both.has(u)) out.leaks.push("seat " + s + ": " + (f.m && f.m.t) + " uid " + u);
        if(secret.some(x => str.indexOf(x) >= 0)) out.leaks.push("seat " + s + ": the seed");
        for(const k of rowh.keys) if(k && str.indexOf(k) >= 0) out.leaks.push("seat " + s + ": a seat key in a frame handed up");
      }
      out.seen[s] = ps[s].inbox.length;
    }
    prev = hid;
  };
  out.wire = () => {
    const rowh = world.row(code).hub, seatOf = {}; for(const p of phones) seatOf[p.name] = p.seat;
    const tops = [0, 1].map(s => SHA.seatTopic(code, s, rowh.keys[s]).split(":")[2]);
    for(const e of world.inbound){
      const s = seatOf[e.name]; if(s == null) continue;
      if(rowh.keys[1 - s] && e.text.indexOf(rowh.keys[1 - s]) >= 0) out.leaks.push("the other seat's key reached " + e.name);
      if(rowh.keys[s] && e.text.indexOf(rowh.keys[s]) >= 0 && !(e.op === "join" && e.topic == null)) out.leaks.push("own key echoed outside a join answer to " + e.name);
      for(const t of tops) if(e.text.indexOf(t) >= 0) out.leaks.push("a channel name travelled to " + e.name);
    }
  };
  return out;
}

(async () => {
  const deno = denoBin();
  if(!deno){ console.log("DENO      SKIPPED — no deno binary (set DENO=…); nothing rehearsed"); process.exit(0); }
  console.log("DENO      " + spawnSync(deno, ["--version"], {encoding: "utf8"}).stdout.split("\n")[0]);
  const bundle = spawnSync(process.execPath, [path.join(__dirname, "supabase-bundle.js"), "--out", OUT], {encoding: "utf8"});
  console.log(bundle.stdout.trim().split("\n").map(l => "BUNDLE    " + l).join("\n"));
  if(bundle.status !== 0){ console.log(bundle.stderr); process.exit(1); }
  const which = arg("--variant", "both");
  /* the single file deals from uid 100000 (a test hook) so the hidden-uid scan is sound; the folder variant deals as deployed (from 0) */
  if(which !== "folder") await rehearse("single", path.join(OUT, "table.single.ts"), deno, 100000);
  if(which !== "single") await rehearse("folder", path.join(OUT, "supabase/functions/table/index.ts"), deno, 0);
  require("fs").rmSync(OUT, {recursive: true, force: true});
  console.log(failed ? "FAILED: " + failed : "ALL PASS");
  process.exit(failed ? 1 : 0);
})().catch(e => { console.log("FAIL  rehearsal crashed: " + (e && e.stack || e)); process.exit(1); });
