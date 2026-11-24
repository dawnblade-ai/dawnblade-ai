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
    await rankedPhase(label, base, stub, log, world, build, uid0);
    await forfeitPhase(label, base, stub, log, world, build, uid0);
    await identityPhase(label, base, stub, log);
    await ladderPhase(label, base, stub, log);
  } finally { child.kill(); await stub.close(); }
}

/* S5.1: a RANKED table through the real function — two signed-in, named players (stand-in sign-ins) play a table to a recorded result and a rating move
   (the stub stands in for 006_ratings.sql: rating_get, result_record; UNVERIFIED against the real SQL over PostgREST), and the refusals. */
async function rankedPhase(label, base, stub, log, world, build, uid0){
  const post = async body => { const r = await fetch(base + "/functions/v1/table", {method: "POST", headers: {apikey: "sb_publishable_rehearsal", "content-type": "application/json"}, body: JSON.stringify(body)});
    const text = await r.text(); return {text, ...JSON.parse(text)}; };
  const SUB_A = "sub-rank-aaaa-1111", SUB_B = "sub-rank-bbbb-2222", SUB_N = "sub-rank-nnnn-3333", tokA = stub.issueUser(SUB_A), tokB = stub.issueUser(SUB_B), tokN = stub.issueUser(SUB_N);
  const texts = [], go = async b => { const r = await post(b); texts.push(r.text); return r; };
  const fresh = await go({op: "me", identity: {token: tokA}});
  row(fresh.ok === true && fresh.rating === 1200 && fresh.games === 0 && fresh.wins === 0 && fresh.losses === 0 && fresh.draws === 0, label + ": ranked: me reads 1200 and no games for a fresh player", JSON.stringify([fresh.rating, fresh.games]));
  await go({op: "me", identity: {token: tokA}, name: "Rank Ann"}); await go({op: "me", identity: {token: tokB}, name: "Rank Bob"});
  const noSign = await go({op: "create", ranked: true}), noName = await go({op: "create", identity: {token: tokN}, ranked: true});
  const rowsBefore = stub.rows.size, badFlag = await go({op: "create", identity: {token: tokA}, ranked: "yes"});
  row(noSign.refused === "ranked-signin" && noName.refused === "ranked-name" && badFlag.refused === "bad-request" && stub.rows.size === rowsBefore, label + ": ranked: a ranked create with no sign-in, with no name, or with a bad flag is refused and writes nothing", [noSign.refused, noName.refused, badFlag.refused].join());
  /* two phones through the function's HTTP, signed in, ranked */
  const rand = T.seeded("rank-rehearse|" + label), cat = {matchCatalog: spec => matchCatalog(spec, uid0), build};
  const mk = (n, h, tok, extra) => PH.makePhone(world, n, {hero: h, rand, throws: [["rock", "rock"], ["paper", "rock"]], identity: {token: async () => tok}, ...cat, ...(extra || {})});
  const RA = mk("RA", HEROES[0], tokA, {ranked: true}), RB = mk("RB", HEROES[1], tokB);
  await RA.connect("create");
  const code = RA.code;
  row(RA.ch.rank().ranked === true && stub.row(code).v === 5 && stub.row(code).ranked === true && JSON.stringify(RA.ch.rank().ratings.filter(x => x != null)) === "[1200]", label + ": ranked: the table opens ranked (a v5 row), the opener sits down at 1200", JSON.stringify(RA.ch.rank()));
  const anon = await go({op: "join", table: code}), nameless = await go({op: "join", table: code, identity: {token: tokN}});
  row(anon.refused === "ranked-signin" && nameless.refused === "ranked-name", label + ": ranked: a join with no sign-in or no name is refused with its own word", [anon.refused, nameless.refused].join());
  await RB.connect("join", code);
  await world.settle([RA.ch, RB.ch]);
  for(let i = 0; i < 8 && !(RA.sess && RB.sess && RA.sess.status() === "ready" && RB.sess.status() === "ready"); i++) await world.settle([RA.ch, RB.ch]);
  row(!!RA.sess && !!RB.sess && RA.sess.status() === "ready" && JSON.stringify(RA.ch.rank().ratings) === "[1200,1200]" && JSON.stringify(RB.ch.rank().ratings) === "[1200,1200]", label + ": ranked: both phones are in the game and read both ratings (the lobby shows them)", JSON.stringify([RA.ch.rank().ratings, RB.ch.rank().ratings]));
  const forged = await go({op: "record", table: code, winner: 1, how: "life"});
  row(forged.refused === "bad-request" && (stub.stats.records || 0) === 0, label + ": ranked: a request that names a winner is refused and nothing is recorded");
  RB.sess.submit({t: "concede"});
  await world.settle([RA.ch, RB.ch]);
  const resB = RB.ch.rank().result, resA = await RA.ch.result(5, 20);
  const players = [...stub.players.keys()], rt = players.map(p => stub.ratings.get(p)).filter(Boolean);
  row(stub.results.size === 1 && (stub.stats.records || 0) === 1 && !!resA && !!resB && resA.winner === 0 && resA.how === "concession" && JSON.stringify(resA.change) === JSON.stringify([{from: 1200, to: 1216}, {from: 1200, to: 1184}]) && JSON.stringify(resB.change) === JSON.stringify(resA.change),
    label + ": ranked: a conceded game is recorded ONCE and both phones read the rating change (1200 -> 1216 / 1184)", JSON.stringify([stub.results.size, stub.stats.records, resA && resA.change]));
  row(rt.length === 2 && rt.map(x => x.rating).sort().join() === "1184,1216" && rt.every(x => x.games === 1), label + ": ranked: the database holds both new ratings and one game each");
  for(let i = 0; i < 3; i++){ await RA.ch.heal(); await RB.ch.heal(); await post({op: "join", table: code, identity: {token: tokA}}); }
  const meA = await go({op: "me", identity: {token: tokA}}), meB = await go({op: "me", identity: {token: tokB}});
  row(stub.results.size === 1 && (stub.stats.records || 0) === 1 && meA.rating === 1216 && meA.wins === 1 && meB.rating === 1184 && meB.losses === 1, label + ": ranked: resyncs and a takeover record nothing more; me reads the new rating and record", JSON.stringify([meA.rating, meA.wins, meB.rating, meB.losses]));
  const closeAfter = await go({op: "close", table: code, identity: {token: tokA}});
  row(closeAfter.ok === true && stub.row(code).closed !== true && !!stub.row(code).result && (await go({op: "join", table: code, identity: {token: tokA}})).result != null, label + ": ranked: a close after a decided game erases nothing");
  const all = texts.join("\n") + JSON.stringify(stub.broadcasts.filter(b => b.topic.startsWith("table:" + code))) + world.inbound.map(x => x.text).join("\n");
  row([SUB_A, SUB_B, SUB_N, tokA, tokB, tokN, ...players].every(x => all.indexOf(x) < 0), label + ": ranked: no token, provider user id or player id in any answer or broadcast of the ranked game");
  row(stub.stats.bad.length === 0, label + ": ranked: the stub saw no malformed call (rating_get / result_record args)", stub.stats.bad.slice(0, 3).join("; "));
  RA.ch.close(); RB.ch.close();
}

/* S5.2: the forfeit clock, close-as-concession and the recovery rule, through the real function. REAL time cannot be waited for (the limit is five
   minutes), so the table's stored stamp is AGED in the stub's store (the function then compares it against its own Date.now(), exactly as it would after five minutes);
   everything else is the function's own code. (The stub stands in for 006/007's result_record and recovery_redeem: UNVERIFIED against the real SQL over PostgREST.) */
async function forfeitPhase(label, base, stub, log, world, build, uid0){
  const post = async body => { const r = await fetch(base + "/functions/v1/table", {method: "POST", headers: {apikey: "sb_publishable_rehearsal", "content-type": "application/json"}, body: JSON.stringify(body)});
    const text = await r.text(); return {text, ...JSON.parse(text)}; };
  const SUBS = ["sub-ff-cccc-1111", "sub-ff-dddd-2222", "sub-ff-eeee-3333", "sub-ff-ffff-4444"], toks = SUBS.map(x => stub.issueUser(x)), texts = [];
  const go = async b => { const r = await post(b); texts.push(r.text); return r; };
  await go({op: "me", identity: {token: toks[0]}, name: "Forfeit Cee"}); await go({op: "me", identity: {token: toks[1]}, name: "Forfeit Dee"});
  await go({op: "me", identity: {token: toks[2]}, name: "Forfeit Eee"}); await go({op: "me", identity: {token: toks[3]}, name: "Forfeit Eff"});
  const rand = T.seeded("forfeit-rehearse|" + label), cat = {matchCatalog: spec => matchCatalog(spec, uid0), build};
  const mk = (n, h, tok, extra) => PH.makePhone(world, n, {hero: h, rand, throws: [["rock", "rock"], ["paper", "rock"]], identity: {token: async () => tok}, ...cat, ...(extra || {})});
  const seatUp = async (a, b, tokA, tokB) => { const PA = mk("PA" + a, HEROES[0], tokA, {ranked: true}), PB = mk("PB" + b, HEROES[1], tokB);
    await PA.connect("create"); await PB.connect("join", PA.code); await world.settle([PA.ch, PB.ch]);
    for(let i = 0; i < 8 && !(PA.sess && PB.sess && PA.sess.status() === "ready" && PB.sess.status() === "ready"); i++) await world.settle([PA.ch, PB.ch]);
    return [PA, PB]; };
  const age = (code, ms) => { const e = stub.rows.get(code), r = JSON.parse(e.json); r.clock.since -= ms; e.json = JSON.stringify(r); };
  /* ---- a claimed forfeit ---- */
  const before = stub.results.size;
  const [A, B] = await seatUp(0, 1, toks[0], toks[1]);
  const code = A.code, ck0 = stub.row(code).clock;
  row(!!A.sess && !!B.sess && !!ck0 && (ck0.on === 0 || ck0.on === 1) && Number.isFinite(ck0.since), label + ": forfeit: a ranked game that has started carries a clock naming the seat the game waits on", JSON.stringify(ck0));
  const wait = ck0.on, claimant = 1 - wait, keyOf = s => stub.row(code).hub.keys[s];
  const early = await go({op: "claim", table: code, seat: claimant, key: keyOf(claimant)}), self = await go({op: "claim", table: code, seat: wait, key: keyOf(wait)}), forged = await go({op: "claim", table: code, seat: claimant, key: "x".repeat(keyOf(claimant).length)});
  row(early.refused === "claim-early" && early.left > 0 && early.left <= 450000 && self.refused === "claim-self" && forged.refused === "auth" && stub.results.size === before && stub.row(code).over !== true, label + ": forfeit: an early claim, a claim by the waited-on player and a forged claim are each refused and change nothing", [early.refused, early.left, self.refused, forged.refused].join());
  const peek = await go({op: "resync", table: code, seat: claimant, key: keyOf(claimant)});
  row(peek.ok === true && peek.clock && peek.clock.on === wait && peek.clock.limit === 450000 && peek.clock.age >= 0, label + ": forfeit: a resync tells the phone who the game waits on, how long (server time) and the limit", JSON.stringify(peek.clock));
  age(code, require(path.join(__dirname, "..", "server", "referee.js")).FORFEIT_MS + 1000);   /* past the limit, whatever it is (it was 300 s when this was written; it is the referee's FORFEIT_MS) */
  const claimed = await go({op: "claim", table: code, seat: claimant, key: keyOf(claimant)});
  const stored = [...stub.results.values()].pop();
  row(claimed.ok === true && claimed.claimed === true && claimed.result && claimed.result.how === "forfeit" && claimed.result.winner === claimant && stub.results.size === before + 1 && stored && stored.p_how === "forfeit" && stored.p_winner === claimant,
    label + ": forfeit: a due claim records ONE win by forfeit for the claimant (the absent seat loses)", JSON.stringify([claimed.ok, claimed.result && claimed.result.how, claimed.result && claimed.result.winner, stub.results.size - before]));
  row(JSON.stringify(claimed.result.change.map(c => c.to).sort()) === "[1184,1216]", label + ": forfeit: the ratings moved by the Elo amount (1216 / 1184)", JSON.stringify(claimed.result.change));
  const again = await go({op: "claim", table: code, seat: claimant, key: keyOf(claimant)}), lateMove = await go({op: "frame", table: code, seat: wait, key: keyOf(wait), n: 99999, frame: {ch: "net", m: {t: "intent", id: 3, seat: wait, action: {t: "pass"}}}});
  const loser = await go({op: "resync", table: code, seat: wait, key: keyOf(wait)});
  row(again.refused === "claim-over" && stub.results.size === before + 1 && !(lateMove.frames || []).some(f => f.m && f.m.t === "commit") && loser.ok === true && loser.result && loser.result.how === "forfeit" && loser.result.winner === claimant,
    label + ": forfeit: a second claim and the absent player's late move change nothing; the absent player reads the ending", JSON.stringify([again.refused, loser.result && loser.result.how]));
  A.ch.close(); B.ch.close();
  /* ---- close is a concession once the game has started; free before ---- */
  const [C, D] = await seatUp(2, 3, toks[2], toks[3]);
  const cc = C.code, r0 = stub.results.size, closer = stub.row(cc).owners.indexOf(stub.players.get([...stub.identities.values()][0]) ? stub.row(cc).creator : null);
  const closed = await go({op: "close", table: cc, identity: {token: toks[2]}});
  const st2 = [...stub.results.values()].pop(), cseat = stub.row(cc).owners.indexOf(stub.row(cc).creator);
  row(closed.ok === true && closed.conceded === true && stub.results.size === r0 + 1 && st2.p_how === "concession" && st2.p_winner === 1 - cseat && stub.row(cc).closed !== true && stub.row(cc).over === true,
    label + ": forfeit: closing a started ranked table is the creator's concession (the closer loses, one result, the table is over)", JSON.stringify([closed.ok, closed.conceded, stub.results.size - r0, st2 && st2.p_how, st2 && st2.p_winner, cseat]));
  void closer;
  const idle = await go({op: "create", identity: {token: toks[2]}, ranked: true}), r1 = stub.results.size;
  const free = await go({op: "close", table: idle.table, identity: {token: toks[2]}});
  row(free.ok === true && !free.conceded && stub.results.size === r1 && stub.row(idle.table).closed === true, label + ": forfeit: closing a ranked table before the game started is free and records nothing");
  C.ch.close(); D.ch.close();
  /* ---- recovery: the stub's redeem keeps a throwaway that played ranked (orphaned), and never touches the recovered player ---- */
  const playedBefore = stub.ratings.get([...stub.players.keys()][0]);
  const SUBR = "sub-ff-rrrr-5555", tokR = stub.issueUser(SUBR);
  const mint = await go({op: "recovery-mint", identity: {token: toks[2]}});
  const mePlayer = [...stub.identities.entries()].find(([k]) => k.endsWith("\u0000" + SUBS[2]))[1];
  const throwaway = [...stub.identities.entries()].find(([k]) => k.endsWith("\u0000" + SUBS[3]))[1];
  const ratingBefore = JSON.stringify(stub.ratings.get(mePlayer)), tBefore = JSON.stringify(stub.ratings.get(throwaway));
  await go({op: "me", identity: {token: toks[3]}});
  const mint2 = await go({op: "recovery-mint", identity: {token: toks[2]}});
  const redeem = await go({op: "recovery-redeem", identity: {token: toks[3]}, code: mint2.code});
  row(mint.ok === true && redeem.ok === true && stub.players.has(throwaway) && JSON.stringify(stub.ratings.get(throwaway)) === tBefore && JSON.stringify(stub.ratings.get(mePlayer)) === ratingBefore && stub.players.get(throwaway).display_name === null,
    label + ": forfeit: a recovery redeem keeps the throwaway that played ranked (orphaned, name freed, rating intact) and leaves the recovered player's rating alone", JSON.stringify([redeem.ok, stub.players.has(throwaway)]));
  void playedBefore; void SUBR; void tokR;
  stub.recovery.clear();                         /* the recovery phase after this one counts the codes it mints itself */
  const all = texts.join("\n") + JSON.stringify(stub.broadcasts.filter(b => b.topic.startsWith("table:" + code) || b.topic.startsWith("table:" + cc))) + world.inbound.map(x => x.text).join("\n");
  row([...SUBS, ...toks, mePlayer, throwaway].every(x => all.indexOf(x) < 0), label + ": forfeit: no token, provider user id or player id in any claim, close or recovery answer or broadcast");
  row(stub.stats.bad.length === 0, label + ": forfeit: the stub saw no malformed call (result_record args with the forfeit ending)", stub.stats.bad.slice(0, 3).join("; "));
}

/* S4.1: the identify seam, against the stub's /auth/v1/user and identity_resolve (UNVERIFIED stand-ins for the real services). Plain
   fetches in the page's own request shape: no page code is involved, none changed. */
async function identityPhase(label, base, stub, log){
  const post = async body => { const r = await fetch(base + "/functions/v1/table", {method: "POST", headers: {apikey: "sb_publishable_rehearsal", "content-type": "application/json"}, body: JSON.stringify(body)});
    const text = await r.text(); return {text, ...JSON.parse(text)}; };
  const keyOf = r => ((r.frames || []).find(f => f.ch === "judge" && f.key) || {}).key;
  const SUB_A = "sub-secret-aaaa-1111", SUB_B = "sub-secret-bbbb-2222";
  const tokA = stub.issueUser(SUB_A), tokB = stub.issueUser(SUB_B), texts = [];
  const go = async body => { const r = await post(body); texts.push(r.text); return r; };
  const made = await go({op: "create"}); const code = made.table;
  const sBefore = stub.stats.auths;
  /* S4.2: the name is set by op "me" (player_rename), unique on its fold, and the join shows the stored one */
  const who0 = await go({op: "me", identity: {token: tokA}});
  const named = await go({op: "me", identity: {token: tokA}, name: "Rehearsal Ann"});
  const clash = await go({op: "me", identity: {token: tokB}, name: "rehearsal ann"});
  const who1 = await go({op: "me", identity: {token: tokA}});
  row(who0.ok && who0.name === null && named.ok && named.name === "Rehearsal Ann" && clash.ok === false && clash.refused === "name-taken" && who1.name === "Rehearsal Ann",
    label + ": identity: op me reads no name, stores a free one, refuses its fold to another player, and reads it back", JSON.stringify([who0.name, named.name, clash.refused, who1.name]));
  const atJoin = await go({op: "join", table: code, identity: {token: tokA, name: "Rehearsal Ann"}});
  row(atJoin.ok === false && atJoin.refused === "bad-request" && atJoin.reason === "at-join", label + ": identity: a name offered at a join is refused");
  const a = await go({op: "join", table: code, identity: {token: tokA}});
  const kA = keyOf(a);
  row(a.ok && a.seat === 0 && a.owned === true && !!kA, label + ": identity: a join with a (stub) sign-in token is seated and bound to a player", "seat " + a.seat);
  const v1 = stub.version(code), row1 = JSON.stringify(stub.row(code));
  const forged = await go({op: "join", table: code, identity: {token: "stub.jwt.forged"}});
  row(forged.ok === false && forged.refused === "identity" && stub.version(code) === v1 && JSON.stringify(stub.row(code)) === row1, label + ": identity: a forged token is refused 'identity' and the stored row is untouched");
  const b = await go({op: "join", table: code, identity: {token: tokB}});
  row(b.ok && b.seat === 1 && JSON.stringify(b.names) === JSON.stringify(["Rehearsal Ann", null]), label + ": identity: the second player takes the other chair and reads the first's public name", JSON.stringify(b.names));
  const full = await go({op: "join", table: code});
  row(full.refused === "full", label + ": identity: a casual join on the full table is 'full', as before");
  const re = await go({op: "join", table: code, identity: {token: tokA}});
  const kA2 = keyOf(re);
  row(re.ok && re.seat === 0 && !!kA2 && kA2 !== kA && re.owned === true, label + ": identity: the same player with no key re-claims seat 0 and is dealt a FRESH key");
  const old = await go({op: "resync", table: code, seat: 0, key: kA});
  row(old.ok === false && old.refused === "auth" && old.taken === true, label + ": identity: the old key answers 'auth' with taken:true (the old phone is told, not left hanging)");
  const cast = stub.broadcasts.filter(b => b.topic === SHA.seatTopic(code, 0, kA) && (b.payload.frames || []).some(f => f.taken));
  row(cast.length === 1 && cast[0].payload.mac === SHA.frameMac(kA, code, 0, cast[0].payload.ver, cast[0].payload.frames) && cast[0].private === false, label + ": identity: the old channel got ONE sealed 'taken' notice", cast.length + " notice(s)");
  const back = await go({op: "join", table: code, seat: 0, key: kA2});
  row(back.ok && back.seat === 0, label + ": identity: the new key holds the chair");
  const r1 = stub.row(code);
  row(r1.v === 3 && r1.owners.filter(Boolean).length === 2 && r1.retired[0].length === 1 && JSON.stringify(r1).indexOf(kA) < 0, label + ": identity: the row is v3, two owners, the old key stored as a hash only");
  const players = stub.players.size, again = await go({op: "join", table: code, identity: {token: tokA}});
  row(again.ok && stub.players.size === players && stub.stats.auths - sBefore >= 5 && stub.stats.resolves >= 4, label + ": identity: every token was verified at /auth/v1/user and mapped by identity_resolve; the same sign-in is the same player (" + stub.players.size + " players)");
  /* S4.3: a recovery code, minted by player A and redeemed by a brand-new sign-in C (stand-ins for 004_recovery.sql; UNVERIFIED against the real SQL over PostgREST) */
  const SUB_C = "sub-secret-cccc-3333", tokC = stub.issueUser(SUB_C);
  const nameC = await go({op: "me", identity: {token: tokC}, name: "Throwaway Cee"});
  const playersBefore = stub.players.size;
  const minted = await post({op: "recovery-mint", identity: {token: tokA}});
  const codeA = minted.code, plainA = String(codeA || "").replace(/-/g, "");
  row(minted.ok === true && /^[A-HJ-KM-NP-Z2-9]{5}(-[A-HJ-KM-NP-Z2-9]{5}){2}$/.test(codeA) && minted.days === 730 && stub.recovery.size === 1 && !stub.recovery.has(plainA) && [...stub.recovery.keys()].every(h => /^[0-9a-f]{64}$/.test(h)),
    label + ": recovery: a mint answers the code once, and the database holds only a sha256 hash", JSON.stringify(Object.keys(minted).filter(k => k !== "text")));
  const wrong = await go({op: "recovery-redeem", identity: {token: tokC}, code: "ABCDE-FGHJK-MNPQR"});
  row(wrong.ok === false && wrong.refused === "recovery" && stub.players.size === playersBefore, label + ": recovery: a wrong code is 'recovery' and moves nothing");
  const redeemed = await go({op: "recovery-redeem", identity: {token: tokC}, code: plainA.toLowerCase().replace(/(.{4})/g, "$1 ")});
  row(redeemed.ok === true && redeemed.name === "Rehearsal Ann" && Object.keys(redeemed).filter(k => k !== "text").sort().join() === "name,ok" && nameC.ok && stub.players.size === playersBefore - 1,
    label + ": recovery: a new sign-in redeems the code (lower case, spaces), is told the recovered name, and its throwaway player is deleted", JSON.stringify([redeemed.ok, redeemed.name, stub.players.size - playersBefore]));
  const againRedeem = await go({op: "recovery-redeem", identity: {token: stub.issueUser("sub-secret-dddd-4444")}, code: codeA});
  row(againRedeem.ok === false && againRedeem.refused === "recovery" && againRedeem.text === wrong.text, label + ": recovery: the same code again is the very answer a wrong code gets");
  const seatC = await go({op: "join", table: code, identity: {token: tokC}});
  const kC = keyOf(seatC);
  row(seatC.ok && seatC.seat === 0 && seatC.owned === true && !!kC && kC !== kA2, label + ": recovery: the recovered sign-in takes the player's seat 0 with a fresh key (one player, two phones; last one wins)");
  const mint2 = await post({op: "recovery-mint", identity: {token: tokA}}), mint3 = await post({op: "recovery-mint", identity: {token: tokA}});
  const oldCode = await go({op: "recovery-redeem", identity: {token: stub.issueUser("sub-secret-eeee-5555")}, code: mint2.code});
  row(mint2.ok && mint3.ok && mint2.code !== mint3.code && oldCode.refused === "recovery" && [...stub.recovery.values()].filter(e => !e.used).length === 1, label + ": recovery: a second mint retires the first (one live code)");
  const sentSeat = await go({op: "recovery-redeem", identity: {token: stub.issueUser("sub-secret-ffff-6666")}, code: mint3.code, tables: [code]});
  row(sentSeat.ok === true, label + ": recovery: a phone with no seat at the named table redeems");
  const noMint = stub.stats.bad.length;
  const hashes = [...stub.recovery.keys()];
  const reco = texts.join("\n") + JSON.stringify(stub.broadcasts) + JSON.stringify(stub.row(code));
  row([plainA, codeA, mint2.code, mint3.code, SUB_C, tokC, ...hashes].every(x => reco.indexOf(x) < 0) && noMint === 0, label + ": recovery: no code, hash, token or subject in any redeem/join answer, broadcast or stored row", "bad calls " + noMint);
  const all = texts.join("\n") + JSON.stringify(stub.broadcasts.filter(b => b.topic.startsWith("table:" + code)));
  const secrets = [SUB_A, SUB_B, SUB_C, tokA, tokB, tokC, ...stub.players.keys(), ...stub.recovery.keys()];
  row(secrets.every(x => all.indexOf(x) < 0), label + ": identity: no token, provider user id or player id in any response or broadcast for this table");
  const cas = await go({op: "create"}), c1 = await go({op: "join", table: cas.table}), c2 = await go({op: "join", table: cas.table, claim: "casualClaimTokenAAAAAAAA"});
  row(c1.ok && c2.ok && c1.seat !== c2.seat && stub.row(cas.table).v === 2 && !("owners" in stub.row(cas.table)), label + ": identity: a casual table on the same function is unchanged (v2 row, no identity fields)");
  /* S4.4: at most 5 open tables per player — table_create_capped through the real function (the stub stands in for 005_table_cap.sql) */
  {
    const SUB_K = "sub-secret-kkkk-9999", SUB_L = "sub-secret-llll-8888", tokK = stub.issueUser(SUB_K), tokL = stub.issueUser(SUB_L);
    const mk = tok => go({op: "create", identity: {token: tok}});
    const first = []; for(let i = 0; i < 5; i++) first.push(await mk(tokK));
    row(first.every(r => r.ok && /^[A-Z0-9]{6}$/.test(r.table)), label + ": cap: five signed-in tables are created", first.map(r => r.refused || "ok").join());
    const rowK = stub.row(first[0].table);
    row(rowK.v === 3 && typeof rowK.creator === "string" && rowK.creator.length > 0 && JSON.stringify(rowK).indexOf(SUB_K) < 0 && JSON.stringify(rowK).indexOf(tokK) < 0, label + ": cap: the row records a creator (our player id), not the provider's subject or the token");
    const rowsN = stub.rows.size, sixth = await mk(tokK);
    row(sixth.ok === false && sixth.refused === "table-cap" && sixth.cap === 5 && JSON.stringify(sixth.open) === JSON.stringify(first.map(r => r.table)) && stub.rows.size === rowsN, label + ": cap: the sixth is refused table-cap with the five codes, nothing written", JSON.stringify(sixth).slice(0, 120));
    row((await mk(tokL)).ok === true, label + ": cap: another player is not held to it");
    const casualMore = []; for(let i = 0; i < 3; i++) casualMore.push(await go({op: "create"}));
    row(casualMore.every(r => r.ok && stub.row(r.table).v === 2 && !("creator" in stub.row(r.table))) && (await mk(tokK)).refused === "table-cap", label + ": cap: casual tables are unchanged and do not count");
    /* the creator joins their own table and another player joins it: neither is a new table */
    const jj = await go({op: "join", table: first[1].table, identity: {token: tokL}});
    row(jj.ok === true && (await mk(tokK)).refused === "table-cap", label + ": cap: a join does not count");
    /* the way out: close one (creator only), then exactly one more may be made */
    const notMine = await go({op: "close", table: first[0].table, identity: {token: tokL}});
    const forgedClose = await go({op: "close", table: first[0].table, identity: {token: "stub.jwt.forged"}});
    const closed = await go({op: "close", table: first[0].table, identity: {token: tokK}});
    row(notMine.refused === "not-creator" && forgedClose.refused === "identity" && closed.ok === true && stub.row(first[0].table).closed === true && stub.row(first[0].table).over === true, label + ": cap: only the creator may close; a close marks the row over and closed", [notMine.refused, forgedClose.refused, closed.ok].join());
    const gone = await go({op: "join", table: first[0].table, identity: {token: tokL}});
    row(gone.refused === "no-table", label + ": cap: a closed table is gone for a joiner");
    const again = await mk(tokK), again2 = await mk(tokK);
    row(again.ok === true && again2.refused === "table-cap", label + ": cap: one slot freed, exactly one more table");
    /* a finished game frees a slot: the stub's row is marked over the way the referee does when the session ends */
    const rr = stub.row(first[2].table); rr.over = true; stub.rows.get(first[2].table).json = JSON.stringify(rr);
    row((await mk(tokK)).ok === true && (await mk(tokK)).refused === "table-cap", label + ": cap: a row marked over (a finished game) stops counting");
    /* simultaneous creates at the cap: exactly one passes (a fresh player, four open) */
    const tokM = stub.issueUser("sub-secret-mmmm-7777"); for(let i = 0; i < 4; i++) await mk(tokM);
    const race = await Promise.all(Array.from({length: 6}, () => mk(tokM)));
    row(race.filter(r => r.ok).length === 1 && race.filter(r => r.refused === "table-cap").length === 5, label + ": cap: six simultaneous creates at four open make exactly one", race.map(r => r.refused || "ok").join());
    const capText = texts.join("\n") + JSON.stringify(stub.broadcasts);
    row([SUB_K, SUB_L, tokK, tokL].every(x => capText.indexOf(x) < 0) && stub.stats.bad.length === 0, label + ": cap: no token or provider id in any answer or broadcast; the stub saw no malformed call", stub.stats.bad.slice(0, 2).join("; "));
  }
  const logged = log.join("").split("\n").filter(l => /error|exception|panick/i.test(l)).length;
  stub.authDown(true);
  const down = await go({op: "join", table: code, identity: {token: tokB}});
  stub.authDown(false);
  await new Promise(r => setTimeout(r, 100));
  const after = log.join("").split("\n").filter(l => /error|exception|panick/i.test(l));
  row(down.ok === false && down.refused === "internal" && down.text.indexOf("auth is down") < 0 && after.length > logged && after.every(l => l.indexOf(tokB) < 0 && l.indexOf(SUB_B) < 0), label + ": identity: a provider outage is 'internal' (logged for the operator, without the token), not a verdict on the token");
  row(stub.stats.bad.length === 0, label + ": identity: the stub saw no malformed call (the /auth/v1/user headers, identity_resolve's args)", stub.stats.bad.slice(0, 3).join("; "));
}

/* S5.3: the PUBLIC LADDER through the real function (the stub stands in for 008_ladder.sql's ladder_get: UNVERIFIED against the real SQL over PostgREST). Runs last: it adds
   players and ratings directly to the stub's store (a ladder of 55, an orphan, a nameless player), reads over plain HTTP with NO sign-in, with a sign-in, with a forged one,
   and proves the answers well-formed (the very checks tools/livecheck.js runs on live: one copy), ordered, floored, capped, one statement per request, and read-only. */
async function ladderPhase(label, base, stub, log){
  const LC = require("./livecheck.js");
  const cfg = {url: base, key: "sb_publishable_rehearsal", fn: "table"};
  const R = (ok, name, detail) => row(ok, label + ": " + name, detail);
  const post = LC.functionPost(cfg), errLines = () => log.join("").split("\n").filter(l => /error|exception|panick/i.test(l)).length, logged0 = errLines();
  const mkPlayer = (sub, name, rating, games, o) => { const id = "pl-lad-" + sub, o2 = o || {};
    stub.players.set(id, {id, display_name: name || null, name_fold: name ? name.toLowerCase().replace(/ /g, "") : null});
    if(!o2.orphan) stub.identities.set("supabase-anon\u0000" + sub, id);
    if(games !== undefined) stub.ratings.set(id, {rating, games, wins: games, losses: 0, draws: 0});
    return {id, sub}; };
  const keyed = (sub) => { const tok = stub.issueUser(sub); return tok; };
  /* what the earlier phases left, whatever it is, must already be a well-formed ladder */
  const hostSub = "sub-lad-host", hostTok = keyed(hostSub), hostMe = await post({op: "me", identity: {token: hostTok}, name: "Ladder Host"});
  R(hostMe.ok === true, "ladder: a player to call with (named through `me`)");
  const calls0 = stub.stats.ladders || 0;
  await LC.ladderOverHttp(cfg, [hostTok], R);
  {
    const guestTok = keyed("sub-seek-guest"); await post({op: "me", identity: {token: guestTok}});
    const seeks0 = stub.stats.seeks || 0;
    await LC.seekOverHttp(cfg, [hostTok, guestTok], R);
    await require("./rematchprobe.js").rematchOverHttp(cfg, await Promise.all(["sub-rm-a", "sub-rm-b"].map(async (s, i) => { const t = keyed(s); await post({op: "me", identity: {token: t}, name: i ? "Rematch Bee" : "Rematch Ay"}); return t; })), R);
    R((stub.stats.seeks || 0) - seeks0 >= 4, "seek: the queue was reached through seek_count / seek_step on the stub", String((stub.stats.seeks || 0) - seeks0));
  }
  R((stub.stats.ladders || 0) - calls0 === 3, "ladder: each of the three requests (public, signed in, forged) was exactly ONE ladder_get call (no call per row)", String((stub.stats.ladders || 0) - calls0));
  /* a ladder of 55 players, and the cases that must not appear */
  const crowd = []; for(let i = 0; i < 55; i++) crowd.push(mkPlayer("crowd" + i, "Crowd " + String(i).padStart(2, "0"), 1300 + i, 3 + (i % 4)));
  mkPlayer("prov", "Provisional One", 1900, 2); mkPlayer("nameless", null, 1950, 9); mkPlayer("orphan", "Orphan Rated", 1960, 9, {orphan: true});
  const two = mkPlayer("tie-a", "Tie Aaa", 1250, 5), tie2 = mkPlayer("tie-b", "Tie Bbb", 1250, 5); void two; void tie2;
  const nowCalls = stub.stats.ladders;
  const pub = await post({op: "ladder"});
  R(pub.ok === true && pub.ladder.length === 50 && pub.cap === 50 && pub.floor === 3, "ladder: 55 players listed, the top 50 are shown (cap 50, floor 3)", String(pub.ladder && pub.ladder.length));
  R(pub.ladder[0].name === "Crowd 54" && pub.ladder[0].rating === 1354 && pub.ladder.every((x, i) => i === 0 || pub.ladder[i - 1].rating >= x.rating), "ladder: the best is first and the list is in rating order");
  R(!pub.ladder.some(x => /Provisional One|Orphan Rated/.test(x.name)) && pub.ladder.every(x => x.name && x.games >= 3), "ladder: the provisional, the nameless and the orphan are not listed");
  const t51 = keyed("sub-lad-fifty-first"); const p51 = mkPlayer("fifty-first", "Fifty First", 1299, 3); void p51;
  stub.identities.set("supabase-anon\u0000sub-lad-fifty-first", "pl-lad-fifty-first");
  const lowest = await post({op: "ladder", identity: {token: t51}});
  R(lowest.ok && lowest.you && lowest.you.listed === true && lowest.you.rank > 50 && lowest.ladder.length === 50 && !lowest.ladder.some(x => x.name === "Fifty First"), "ladder: a listed player below the cap is told their rank and is not in the top 50", JSON.stringify(lowest.you));
  const provTok = keyed("sub-lad-prov"); stub.identities.set("supabase-anon\u0000sub-lad-prov", "pl-lad-prov");
  const prov = await post({op: "ladder", identity: {token: provTok}});
  R(prov.ok && prov.you && prov.you.listed === false && prov.you.toGo === 1 && prov.you.games === 2 && prov.you.rating === 1900, "ladder: a provisional player is told how many games are left", JSON.stringify(prov.you));
  const orphTok = keyed("sub-lad-orphan");           /* a brand-new sign-in: the function makes it a new, unrated player; the orphan seeded above (no sign-in) is still not listed */
  const orph = await post({op: "ladder", identity: {token: orphTok}});
  R(orph.ok && !orph.ladder.some(x => x.name === "Orphan Rated") && orph.you && orph.you.games === 0 && orph.you.toGo === 3 && orph.you.name === null, "ladder: a brand-new sign-in is told it has no name and no games; the orphan is still not listed", JSON.stringify(orph.you));
  const tieA = await post({op: "ladder", identity: {token: keyed("sub-lad-tie-a")}}); void tieA;
  const forged = await post({op: "ladder", identity: {token: "x".repeat(80)}}), bad = await post({op: "ladder", identity: "nope"}), pub2 = await post({op: "ladder"});
  R(forged.ok === true && forged.you === undefined && bad.ok === true && JSON.stringify(forged.ladder) === JSON.stringify(pub2.ladder), "ladder: a forged or malformed identity still gets the public list");
  const reads = [pub, lowest, prov, orph, forged, bad, pub2];
  const snap0 = JSON.stringify([stub.rows.size, stub.stats.puts, stub.players.size, stub.ratings.size, stub.results.size, stub.identities.size, stub.stats.records || 0, stub.broadcasts.length, [...stub.ratings.entries()]]);
  for(let i = 0; i < 5; i++) await post({op: "ladder", identity: {token: hostTok}});
  R(snap0 === JSON.stringify([stub.rows.size, stub.stats.puts, stub.players.size, stub.ratings.size, stub.results.size, stub.identities.size, stub.stats.records || 0, stub.broadcasts.length, [...stub.ratings.entries()]]) && !stub.ratings.has([...stub.players.values()].find(p => p.display_name === "Ladder Host").id),
    "ladder: five more reads (signed in, never rated) wrote nothing: no table row, no put, no rating row, no result, no broadcast");
  R((stub.stats.ladders - nowCalls) >= reads.length, "ladder: every read reached the one ladder_get statement");
  const hay = JSON.stringify(reads) + JSON.stringify(await post({op: "ladder", identity: {token: hostTok}}));
  const secretsAll = [...stub.players.keys(), ...[...stub.identities.keys()].map(k => k.split("\u0000")[1]), hostTok, t51, provTok, orphTok];
  R(secretsAll.every(x => hay.indexOf(x) < 0), "ladder: no player id, provider user id or token in any ladder answer");
  R(stub.stats.bad.length === 0, "ladder: the stub saw no malformed call (ladder_get args)", stub.stats.bad.slice(0, 3).join("; "));
  R(errLines() === logged0, "ladder: the function logged no error while the ladder was read", String(errLines() - logged0));
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
