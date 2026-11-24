#!/usr/bin/env node
/* ============================================================
   tools/rematchprobe.js — A FULL REMATCH, END TO END, ON THE FUNCTION (v6.87).

   Two scripted seats (engine/servertable.js, the phone's own client, over plain HTTPS: no Realtime, so they ask with `heal`) sit at one casual table
   opened by signed-in players, play the lobby, and one concedes (the reducer's own way out). Then:
     1. a rematch asked before the game was over would be refused (the seek probe covers it); here the first ask WAITS and the other seat learns it on its next resync;
     2. the asker LEAVES (closes its channel): the ask is taken back, and the other seat's next resync no longer shows it (v6.87);
     3. both ask again: the same new table's code comes back to both, it is not the old table, and both seats can SIT at it;
     4. every table the probe opened is closed by its owner.
   It writes one finished casual game and nothing else; no ranked result. Needs the deployed function to know `rematch` (v6.83) — nothing newer.

     node tools/rematchprobe.js --offline            the probe against server/referee.js in-process (test/rematchprobe.test.js runs this)
     (livecheck.js and tools/supabase-rehearse.js call rematchOverHttp(cfg, [tokA, tokB], row))
   ============================================================ */
"use strict";
const path = require("path");
const ROOT = path.join(__dirname, "..");
const T = require(path.join(ROOT, "test", "helpers", "judgetable.js"));
const PH = require(path.join(ROOT, "test", "helpers", "serverphone.js"));
const ST = require(path.join(ROOT, "engine", "servertable.js"));

/* the same transport shape as the fake wire, over HTTPS to the function; nothing to subscribe to (the seats ask) */
function httpTransport(cfg, fetchFn){
  const f = fetchFn || fetch;
  return {post: async env => { const r = await f(cfg.url + "/functions/v1/" + cfg.fn, {method: "POST", headers: {apikey: cfg.key, "content-type": "application/json"}, body: JSON.stringify(env)}); return r.json(); },
          subscribe: () => () => {}};
}

/* world: {transport(name)}; toks: [seat A's sign-in, seat B's]; row(ok, what, detail); o: {post: raw post for the closes, settle?: async () => void} */
async function rematchProbe(world, toks, row, o){
  o = o || {};
  const who = tok => ({token: async () => tok});
  const rand = T.seeded("rematchprobe|" + Date.now());
  const mk = (n, h, tok) => PH.makePhone(world, n, {hero: h, rand, ST, throws: [["rock", "rock"], ["paper", "rock"]], identity: who(tok), tune: {fallbackMs: 0, pollMs: 0}, ...(o.phone || {})});
  const opened = [];       /* [code, token of an owner] */
  const heal = async (...ps) => { for(const p of ps) if(p.ch) await p.ch.heal().catch(() => {}); };
  const until = async (what, fn, ps, n) => { for(let i = 0; i < (n || 40); i++){ if(fn()) return true; await heal(...ps); await new Promise(r => setTimeout(r, o.beat === undefined ? 150 : o.beat)); } return fn(); };
  let A = mk("A", "blaze", toks[0]), B = mk("B", "dorinthea", toks[1]);
  try {
    await A.connect("create"); opened.push([A.code, toks[0]]);
    await B.connect("join", A.code);
    const seated = await until("seated", () => A.sess && B.sess && A.sess.status() === "ready" && B.sess.status() === "ready", [A, B]);
    row(seated, "rematch probe: two signed-in seats dealt a game at a fresh table", A.code);
    if(!seated) return;
    B.sess.submit({t: "concede"});
    /* the table answers rematch-playing until the ending has landed */
    let a = null, why = null;
    for(let i = 0; i < 40 && !(a && a.state === "waiting"); i++){ try { a = await A.ch.askRematch(); } catch(e){ why = e.why; await heal(A, B); await new Promise(r => setTimeout(r, o.beat === undefined ? 150 : o.beat)); } }
    row(!!a && a.state === "waiting" && A.ch.rematch().mine === true, "rematch probe: after a concession the first seat's ask waits", JSON.stringify(a || why));
    if(!a) return;
    const heard = await until("heard", () => B.ch.rematch().theirs === true, [B], 12);
    row(heard, "rematch probe: the other seat learns of the ask on its next resync");
    /* leaving takes the ask back */
    A.ch.close();
    const gone = await until("gone", () => B.ch.rematch().theirs === false, [B], 12);
    row(gone, "rematch probe: when the asker leaves the table the ask is taken back (the other seat stops seeing it)");
    /* the asker comes back to its chair, both ask again, one new table */
    const a2 = await (async () => { try { const c = await ST.sitAt({transport: world.transport("A2"), code: opened[0][0], identity: who(toks[0]), tune: {fallbackMs: 0, pollMs: 0}}); return c; } catch(e){ return {why: e.why}; } })();
    row(!!a2 && !a2.why, "rematch probe: the leaver can sit back down at its old table to ask again", a2 && a2.why);
    if(!a2 || a2.why) return;
    const r1 = await a2.askRematch().catch(e => ({state: "err:" + e.why}));
    const r2 = await B.ch.askRematch().catch(e => ({state: "err:" + e.why}));
    const code = r2.table;
    row(r1.state === "waiting" && r2.state === "ready" && /^[A-Z0-9]{6}$/.test(code || "") && code !== opened[0][0], "rematch probe: both asked, the referee opened a NEW table", JSON.stringify([r1, r2]));
    if(code) opened.push([code, toks[1]]);
    await until("same code", () => a2.rematch().table === code, [{ch: a2}], 12);
    row(!!code && a2.rematch().table === code && B.ch.rematch().table === code, "rematch probe: both seats hold the same new code", JSON.stringify([a2.rematch().table, B.ch.rematch().table]));
    if(!code) return;
    const n0 = await ST.sitAt({transport: world.transport("N0"), code, identity: who(toks[0]), tune: {fallbackMs: 0, pollMs: 0}}).catch(e => ({why: e.why}));
    const n1 = await ST.sitAt({transport: world.transport("N1"), code, identity: who(toks[1]), tune: {fallbackMs: 0, pollMs: 0}}).catch(e => ({why: e.why}));
    row(!n0.why && !n1.why && n0.seat !== n1.seat, "rematch probe: both can sit down at the new table, in the two chairs", JSON.stringify([n0.why || n0.seat, n1.why || n1.seat]));
    for(const c of [a2, n0, n1]) try { c.close && c.close(); } catch(_){}
  } catch(e){ row(false, "rematch probe", String(e && e.stack || e).split("\n").slice(0, 3).join(" | ")); }
  finally {
    for(const p of [A, B]) try { p.ch && p.ch.close(); } catch(_){}
    /* close every table the probe opened (by its owner); a table that was never a creator's cannot be closed by a seat, and ages out */
    let ok = 0;
    for(const [code, tok] of opened){ const r = await o.post({op: "close", table: code, identity: {token: tok}}).catch(() => null); if(r && r.ok) ok++; }
    row(ok === opened.length, "rematch probe: every table it opened is closed", ok + " of " + opened.length);
  }
}

async function rematchOverHttp(cfg, toks, row, fetchFn){
  const t = httpTransport(cfg), post = t.post;
  if(!toks || toks.length < 2 || !toks[0] || !toks[1]) return row(false, "rematch probe: two signed-in players to play with", "have " + (toks || []).filter(Boolean).length);
  /* a hosted function deals the page's way and shakes hands on its own build (server/supabase/entry.template.ts): the seats do the same */
  let build = null; try { const h = await (await (fetchFn || fetch)(cfg.url + "/functions/v1/" + cfg.fn, {headers: {apikey: cfg.key}})).json(); build = h && h.build; } catch(_){}
  const {matchCatalog} = require(path.join(ROOT, "test", "helpers", "pagedeal.js"));
  await rematchProbe({transport: () => t}, toks, row, {post, phone: {matchCatalog: spec => matchCatalog(spec, 0), ...(build ? {build} : {})}});
}

module.exports = {rematchProbe, rematchOverHttp, httpTransport};
