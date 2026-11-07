/* test/hostref.test.js — HIDDEN HANDS H2: net.js in REFEREE MODE, the host
   phone holding the deck (HIDDEN-HANDS.md §3(b), §4.5, §6's H2 drills).

   Two sessions over net.js's JSON loopback: the HOST runs referee.js on the
   full game; the GUEST holds a mirror of its own seat's view and never runs
   the reducer. The drills: a whole game agrees view-for-view and no frame
   carries a hidden uid or exceeds the data-channel budget; the guest cannot
   act for the host's seat; a dropped commit is caught up; the HOST DROPS and
   the game pauses (the guest cannot take over), the host restores from what
   it persisted, the guest rejoins on a snapshot and the game ends exactly as
   an uninterrupted one; the post-game REVEAL verifies, and a lying reveal
   does not. Each has its sabotage. */
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../tools/selfplay.js");
const {J, SP, W} = S;
const N = require("../engine/net.js");
const R = require("../engine/referee.js");
const V = require("../engine/view.js");
const Wr = require("../engine/wire.js");
const L = require("../engine/lobby.js");
const SHA = require("../engine/sha256.js");
const INV = require("../engine/invariants.js");
const B = require("../engine/build.js"), G = require("../engine/game.js"), RNG = require("../engine/rng.js");

const WIRE_BUDGET = 16 * 1024;   /* test/table.test.js's: what a data channel carries reliably */
/* uids from 100000, so any scalar equal to a hidden uid is a leak (referee.test.js) */
function deal(k0, k1, seed, first){
  const h0 = W.HEROES.find(h => h.k === k0), h1 = W.HEROES.find(h => h.k === k1);
  const ctr = {n: 100000};
  let rng = RNG.make(seed);
  const b0 = B.buildSideDefault(h0, G.parseDeck(W.DECKS[h0.k]), S.DB, rng, ctr); rng = b0.rng;
  const b1 = B.buildSideDefault(h1, G.parseDeck(W.DECKS[h1.k]), S.DB, rng, ctr); rng = b1.rng;
  return J.newMatch({builds: [b0.b, b1.b], names: [h0.n, h1.n], heroKeys: [h0.k, h1.k], rng, first: first || 0, tokSeq: ctr.n});
}
const catalogOf = g => Wr.makeCatalog([].concat(...g.sides.map(sd => [...sd.deck, ...sd.hand, ...sd.gear])));

/* a table: the lobby's seed exchange, the host's deal, two referee sessions */
function table(k0, k1, o){
  o = o || {};
  const sc = L.seedCommitMsg(), g1 = L.seedAnswer();
  const seed = SHA.seedOf(sc.seedH, g1.g);
  const g0 = deal(k0, k1, seed, o.first || 0);
  const catalog = catalogOf(g0);
  const link = N.loopback();
  const ev = {a: [], b: []};
  const mk = (end, seat, host, extra) => {
    const s = N.createSession({seat, host, referee: true, reduce: J.reduce, legal: J.legal, check: INV.errors, catalog,
      state: host ? g0 : null, send: m => end.send(m), onEvent: e => ev[end.name].push(e), ...(extra || {})});
    end.session = s;
    return s;
  };
  const host = mk(link.a, 0, true), guest = mk(link.b, 1, false);
  guest.join();
  return {g0, seed, seedH: sc.seedH, seedC: sc.msg.c, seedG: g1.g, catalog, link, ev, host, guest, mk,
          start: sd => deal(k0, k1, sd, o.first || 0)};
}
/* one action by whichever seat the policy moves, through its own session */
function step(t){
  const st = t.host.full();
  if(st.over) return false;
  for(const s of [0, 1]){
    const a = SP.act(st, s, {search: false});
    if(!a) continue;
    const why = (s === 0 ? t.host : t.guest).submit(a);
    if(why) throw new Error("seat " + s + " refused: " + why);
    return true;
  }
  return false;
}
const agrees = t => t.guest.hash() === Wr.hash(R.seatView(t.host.full(), 1));

/* every scalar, key and long digit run in a frame */
function tokens(v, out){
  out = out || [];
  if(v == null) return out;
  if(Array.isArray(v)){ v.forEach(x => tokens(x, out)); return out; }
  if(typeof v === "object"){ for(const k of Object.keys(v)){ out.push(k); tokens(v[k], out); } return out; }
  const s = String(v); out.push(s);
  if(typeof v === "string"){ const m = s.match(/\d{6,}/g); if(m) out.push(...m); }
  return out;
}

test("A WHOLE GAME, host and guest: the guest's view agrees after every commit; no frame leaks a hidden uid or exceeds the budget", () => {
  const t = table("kayo", "azalea");
  let n = 0, leaks = [], big = 0, mism = 0, scanned = 0;
  while(n < 3000 && step(t)){
    n++;
    if(!agrees(t)) mism++;
    /* everything the host has sent so far that the guest has not had scanned */
    const hid = new Set([...V.hiddenUids(t.host.full(), 1).keys()].map(String));
    const before = n > 1 ? t.prevHid : hid;
    const both = new Set([...hid].filter(u => before.has(u)));
    for(const m of t.link.a.log.slice(scanned)){
      big = Math.max(big, JSON.stringify(m).length);
      for(const u of tokens(m)) if(both.has(u)) leaks.push(n + ": " + m.t + " uid " + u);
    }
    scanned = t.link.a.log.length;
    t.prevHid = hid;
  }
  assert.ok(t.host.full().over, "the game finished");
  assert.ok(n > 100);
  assert.equal(mism, 0, "the guest's view disagreed " + mism + " times");
  assert.deepEqual(leaks.slice(0, 5), [], leaks.length + " frames named a hidden uid");
  assert.ok(big <= WIRE_BUDGET, "a frame of " + big + " bytes");
  assert.equal(t.guest.status(), "ready");
  assert.deepEqual(t.host.violations(), []);
  /* the guest never ran the reducer: it holds a view, with the foe's hand as placeholders */
  assert.equal(t.guest.state().viewSeat, 1);
  assert.ok(t.guest.state().sides[0].deck.filter(c => !c._kb).every(V.isPh), "the host's deck is placeholders on the guest's phone (bar the known bottom block)");
});

test("SABOTAGE — the same scan over a lockstep session (both phones hold the game) finds the leak", () => {
  const g0 = deal("kayo", "azalea", "lockstep-sab", 0);
  const link = N.loopback();
  const host = N.createSession({seat: 0, host: true, reduce: J.reduce, legal: J.legal, state: g0, send: m => link.a.send(m)});
  const guest = N.createSession({seat: 1, host: false, reduce: J.reduce, legal: J.legal, send: m => link.b.send(m)});
  link.a.session = host; link.b.session = guest;
  guest.join();
  const hid = new Set([...V.hiddenUids(g0, 1).keys()].map(String));
  const leaks = link.a.log.reduce((n, m) => n + tokens(m).filter(u => hid.has(u)).length, 0);
  assert.ok(leaks > 0, "the lockstep snapshot carries the host's hand and deck");
});

test("the guest acts for its own seat only: an intent naming the host's seat is refused and changes nothing", () => {
  const t = table("kayo", "boltyn");
  const st = t.host.full(), a = SP.act(st, 0, {search: false});
  assert.ok(a, "fixture: seat 0 has an action");
  const before = t.host.seq();
  t.link.b.send({t: "intent", id: 99, seat: 0, action: a});
  assert.equal(t.host.seq(), before, "the forged intent was not applied");
  assert.ok(t.ev.b.some(e => e.t === "nacked" && /you sit in seat 1/.test(e.reason)), "and the guest was told why");
  /* the same action from the host itself is fine */
  assert.equal(t.host.submit(a), null);
});

test("a dropped commit is a gap, caught up from the journal; the views agree after", () => {
  const t = table("dorinthea", "kayo");
  /* play to a moment the host holds priority */
  for(let i = 0; i < 200 && !(i > 8 && t.host.full().priority === 0); i++) step(t);
  assert.equal(t.host.full().priority, 0, "fixture: the host holds priority");
  t.link.a.drop = true;
  /* the host moves with the channel down, until it passes priority or has moved twice */
  let moved = 0;
  while(moved < 2 && t.host.full().priority === 0){ const a = SP.act(t.host.full(), 0, {search: false}); if(!a) break; t.host.submit(a); moved++; }
  assert.ok(moved >= 1);
  t.link.a.drop = false;
  /* the next commit the guest sees is ahead of it: a gap. If the host cannot
     move again, the app's own resync (on a reconnect) asks the same question. */
  if(t.host.full().priority === 0 && SP.act(t.host.full(), 0, {search: false})) t.host.submit(SP.act(t.host.full(), 0, {search: false}));
  else t.guest.resync();
  assert.ok(t.ev.b.some(e => e.t === "resync-requested"), "the gap was noticed");
  assert.ok(t.ev.b.some(e => e.t === "catchup-applied" || e.t === "snapshot-applied"), "and repaired");
  assert.ok(agrees(t), "the views agree after the repair");
  for(let i = 0; i < 20; i++) step(t);
  assert.ok(agrees(t));
});

test("a desynced guest (a tampered commit) asks for a snapshot and gets the true view back", () => {
  const t = table("kayo", "dorinthea");
  for(let i = 0; i < 6; i++) step(t);
  const orig = t.link.a.send.bind(t.link.a);
  let tamper = true;
  t.link.a.send = m => { if(tamper && m.t === "commit"){ tamper = false; m = {...m, h: "deadbeefdeadbeef"}; } orig(m); };
  for(let i = 0; i < 6; i++) step(t);
  assert.ok(t.ev.b.some(e => e.t === "desync"), "the canary fired");
  assert.ok(t.ev.b.some(e => e.t === "snapshot-applied"), "a snapshot repaired it");
  assert.ok(agrees(t));
});

/* THE HOST-DROP DRILL. HIDDEN-HANDS.md §4.5: "if the host phone drops, the
   game pauses. The guest cannot take over without the hidden state, which is
   the whole point. The host persists the state locally so a backgrounded host
   resumes." */
test("HOST DROP — the game pauses, the guest cannot act or take over; the host restores; the game ends as an uninterrupted one", () => {
  /* the reference: one deal, played straight through */
  const ref = table("briar", "kayo");
  /* the same deal again, with the host dropping in the middle */
  const g0 = ref.start(ref.seed);
  const cat = catalogOf(g0);
  const link = N.loopback(), ev = [];
  const mkHost = restore => { const s = N.createSession({seat: 0, host: true, referee: true, reduce: J.reduce, legal: J.legal, catalog: cat,
    state: g0, restore, send: m => link.a.send(m)}); link.a.session = s; return s; };
  let host = mkHost(null);
  const guest = N.createSession({seat: 1, host: false, referee: true, reduce: J.reduce, legal: J.legal, catalog: cat,
    send: m => link.b.send(m), onEvent: e => ev.push(e)});
  link.b.session = guest;
  guest.join();
  const T = {get host(){ return host; }, guest, link};
  for(let i = 0; i < 40; i++) step(T);
  /* the host's phone goes away: it had persisted after its last commit */
  const saved = JSON.parse(JSON.stringify(host.persist()));
  const seqAt = host.seq(), viewAt = JSON.stringify(guest.state());
  link.a.session = null; link.b.drop = true;
  guest.pause("the host's phone left the table");
  /* the guest cannot act, whatever it tries */
  const why = guest.submit({t: "pass"});
  assert.ok(why && /paused/.test(why), "the guest's action is refused while paused: " + why);
  assert.equal(JSON.stringify(guest.state()), viewAt, "and its view did not move");
  assert.equal(guest.status(), "paused");
  /* the guest holds no hidden card from which to carry on: the host's hand and deck are placeholders */
  assert.ok(guest.state().sides[0].deck.filter(c => !c._kb).every(V.isPh), "the guest cannot take over: it has no deck to deal from");
  assert.ok(guest.state().rng.hidden, "and no seed");
  assert.ok(String(JSON.stringify(saved)).length > 1000, "the host saved its game");
  /* the host comes back from what it saved; the guest rejoins */
  host = mkHost(saved);
  assert.equal(host.seq(), seqAt, "the restored host is at the same sequence");
  link.b.drop = false;
  guest.join();
  assert.equal(guest.status(), "ready", "the guest is back in the game");
  assert.ok(ev.some(e => e.t === "snapshot-applied"));
  while(step(T)) {}
  /* and the game ended exactly as the uninterrupted one */
  while(step(ref)) {}
  assert.deepEqual(host.full().over, ref.host.full().over);
  assert.equal(Wr.hash(host.full()), Wr.hash(ref.host.full()), "the paused game is the same game");
  assert.ok(agrees({host, guest}));
});

test("SABOTAGE — a host that restores nothing cannot resume the game (the drill can fail)", () => {
  const t = table("briar", "kayo");
  for(let i = 0; i < 40; i++) step(t);
  const seqAt = t.host.seq();
  /* a fresh host from the opening, no restore: the sequence and the game are gone */
  const fresh = N.createSession({seat: 0, host: true, referee: true, reduce: J.reduce, legal: J.legal, catalog: t.catalog,
    state: t.g0, send: m => t.link.a.send(m)});
  assert.notEqual(fresh.seq(), seqAt);
  assert.notEqual(Wr.hash(fresh.full()), Wr.hash(t.host.full()));
  /* and a saved game from another wire version is refused, not misread */
  const saved = t.host.persist();
  assert.throws(() => N.createSession({seat: 0, host: true, referee: true, reduce: J.reduce, catalog: t.catalog, state: t.g0,
    restore: {...saved, v: saved.v - 1}}), /another wire version/);
});

test("RECONNECT — a guest that lost its phone mid-game rejoins on one (chunked) snapshot and the views agree", () => {
  const t = table("viserai", "kayo");
  for(let i = 0; i < 150 && step(t); i++) {}
  /* a brand-new guest session on a new channel */
  const link = N.loopback(), ev = [];
  const g2 = N.createSession({seat: 1, host: false, referee: true, reduce: J.reduce, legal: J.legal, catalog: t.catalog,
    send: m => link.b.send(m), onEvent: e => ev.push(e)});
  link.b.session = g2;
  /* re-point the host at the new channel */
  t.link.a.send = m => { const w = JSON.parse(JSON.stringify(m)); link.a.log.push(w); g2.receive(w); };
  link.b.peer = {session: t.host}; link.b.send = m => t.host.receive(JSON.parse(JSON.stringify(m)));
  g2.join();
  assert.equal(g2.status(), "ready");
  assert.equal(g2.hash(), Wr.hash(R.seatView(t.host.full(), 1)));
  const sizes = link.a.log.map(m => JSON.stringify(m).length);
  assert.ok(sizes.every(n => n <= WIRE_BUDGET), "every frame within budget: " + Math.max(...sizes));
  assert.ok(link.a.log.some(m => m.t === "part"), "a mid-game snapshot is big enough to be sent in parts");
});

test("VERIFY THIS GAME — the host's reveal (seedH + log) opens its commitment and replays to every view the guest saw", () => {
  const t = table("fai", "dash");
  while(step(t)) {}
  assert.ok(t.host.full().over);
  assert.ok(t.host.reveal({seedH: t.seedH}) === null);
  const rv = t.guest.revealed();
  assert.ok(rv && rv.log.length > 100, "the guest holds the full log");
  const v = R.verifyGame({seedC: t.seedC, seedG: t.seedG, seedH: rv.seedH, start: t.start, reduce: J.reduce, seat: 1,
                          log: rv.log, hashes: t.guest.hashes(), over: rv.over});
  assert.ok(v.ok, v.why);
  assert.deepEqual(JSON.parse(JSON.stringify(v.over)), rv.over);
  /* a reveal before the end is refused */
  const t2 = table("fai", "dash");
  assert.ok(t2.host.reveal({seedH: t2.seedH}), "no reveal mid-game");
});

test("SABOTAGE — a lying reveal fails: another seedH, a doctored log, a host that dealt from another seed", () => {
  const t = table("fai", "dash");
  while(step(t)) {}
  t.host.reveal({seedH: t.seedH});
  const rv = t.guest.revealed();
  const base = {seedC: t.seedC, seedG: t.seedG, start: t.start, reduce: J.reduce, seat: 1, hashes: t.guest.hashes(), over: rv.over};
  assert.equal(R.verifyGame({...base, seedH: SHA.nonce(), log: rv.log}).ok, false, "a seedH that does not open the commitment");
  const doctored = rv.log.slice(0, 30).concat(rv.log.slice(31));
  assert.equal(R.verifyGame({...base, seedH: rv.seedH, log: doctored}).ok, false, "a log with an action removed");
  /* a host that ignored the guest's half and dealt from a seed of its own choosing */
  const cheat = table("fai", "dash");
  const stacked = deal("fai", "dash", "host-chose-this", 0);
  const link = N.loopback();
  const h = N.createSession({seat: 0, host: true, referee: true, reduce: J.reduce, legal: J.legal, catalog: cheat.catalog, state: stacked, send: m => link.a.send(m)});
  const g = N.createSession({seat: 1, host: false, referee: true, reduce: J.reduce, legal: J.legal, catalog: cheat.catalog, send: m => link.b.send(m)});
  link.a.session = h; link.b.session = g; g.join();
  const T = {host: h, guest: g};
  while(step(T)) {}
  h.reveal({seedH: cheat.seedH});
  const r2 = g.revealed();
  const v = R.verifyGame({seedC: cheat.seedC, seedG: cheat.seedG, seedH: r2.seedH, start: cheat.start, reduce: J.reduce, seat: 1,
                          log: r2.log, hashes: g.hashes(), over: r2.over});
  assert.equal(v.ok, false, "the deal does not match the committed seed");
  assert.equal(v.at, 0, "caught at the opening: " + v.why);
});
