/* test/referee.test.js — HIDDEN HANDS H2: engine/referee.js, the host's
   authority (HIDDEN-HANDS.md §3(b), §4.3–4.5, §6's H2 proving drills).

   THE LOOPBACK: one rule-policy game per hero (all 15, each as seat 0 against
   the hero four along, as test/view.test.js), played through the REFEREE.
   Seat 1 is the guest: a MIRROR fed every commit through JSON (what a wire
   carries) that never runs the reducer. After every commit the drills ask:
     - the guest's view equals the referee's `seatView(hostState, 1)`, and is
       `view(hostState, 1)` with only the three documented cuts;
     - nothing the guest holds or received names a hidden uid, and no feed
       line it can read names a hidden card (reveal lines excepted, as H1);
     - the desync canary (the view fingerprint) agrees.
   Then the whole game is REPLAYED from its opening and log ("verify this
   game"). Every proving drill has a sabotage beside it that must fail.
   Asserts on zones, uids and fingerprints; the feed drill reads prose
   because the leak IS prose (said again where it does). */
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../tools/selfplay.js");
const {match, J, SP, W} = S;
const V = require("../engine/view.js");
const R = require("../engine/referee.js");
const Wr = require("../engine/wire.js");
const INV = require("../engine/invariants.js");

const HEROES = W.HEROES.filter(h => W.DECKS[h.k]).map(h => h.k);
const GUEST = 1;
const json = v => JSON.parse(JSON.stringify(v));
const catalogOf = g => Wr.makeCatalog([].concat(...g.sides.map(sd => [...sd.deck, ...sd.hand, ...sd.gear, ...(sd.arsenal ? [sd.arsenal] : [])])));

/* ---- the deal ---------------------------------------------------------- */
/* tools/selfplay.js's `match`, with uids counted from 100000: a uid is a
   small integer and so is a life total, so with the real numbering a leak
   scanner must guess which keys hold uids. Counted from here, ANY scalar or
   digit run anywhere equal to a hidden uid is a leak, under any key. */
const B = require("../engine/build.js"), G = require("../engine/game.js"), RNG = require("../engine/rng.js");
const UID0 = 100000;
function deal(k0, k1, seed, first){
  const h0 = W.HEROES.find(h => h.k === k0), h1 = W.HEROES.find(h => h.k === k1);
  const ctr = {n: UID0};
  let rng = RNG.make(seed);
  const b0 = B.buildSideDefault(h0, G.parseDeck(W.DECKS[h0.k]), S.DB, rng, ctr); rng = b0.rng;
  const b1 = B.buildSideDefault(h1, G.parseDeck(W.DECKS[h1.k]), S.DB, rng, ctr); rng = b1.rng;
  return J.newMatch({builds: [b0.b, b1.b], names: [h0.n, h1.n], heroKeys: [h0.k, h1.k], rng, first: first || 0, tokSeq: ctr.n});
}

/* ---- the leak scanner ---------------------------------------------------- */
/* Every scalar in `v`, every object key, and every run of six or more digits
   inside a string (a uid signature like `stillSig` is one string). */
function tokens(v, out){
  out = out || [];
  if(v == null) return out;
  if(Array.isArray(v)){ v.forEach(x => tokens(x, out)); return out; }
  /* a KEY can carry a uid inside it (`ct100083`, v6.25): its digit runs are tokens too */
  if(typeof v === "object"){ for(const k of Object.keys(v)){ out.push(k); const m = k.match(/\d{6,}/g); if(m) out.push(...m); if(k !== "tokSeq") tokens(v[k], out); } return out; }
  const s = String(v);
  out.push(s);
  if(typeof v === "string"){ const m = s.match(/\d{6,}/g); if(m) out.push(...m); }
  return out;
}
const hiddenUidSet = (g, seat) => new Set([...V.hiddenUids(g, seat).keys()].map(String));
const leakedUids = (v, hid) => [...new Set(tokens(v).filter(u => hid.has(u)))];

/* H1's feed-leak test, read on what the guest actually holds. */
const REVEAL_LINE = /\breveal(?:s|ed)?\b|\bflips to\b|\bfused\b/;
/* Charge's line names the card it puts in the soul: public since the soul is
   (RULING user 2026-11-07, HIDDEN-HANDS.md §7 q1), so no carve-out. */
const named = (line, nm) => new RegExp("(^|[^A-Za-z'])" + nm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "($|[^A-Za-z'])").test(line);
const scalars = (v, out) => { if(Array.isArray(v)) v.forEach(x => scalars(x, out));
  else if(v && typeof v === "object") Object.values(v).forEach(x => scalars(x, out));
  else if(v != null) out.add(String(v)); return out; };
/* names the guest may know from the view's structure (not the feed, not the
   composition multisets): the public zones, its own cards, public carriers */
const structNames = v => scalars({...v, feed: [], log: [], sides: v.sides.map(sd => ({...sd, unseen: [], unseenGear: []}))}, new Set());

/* ---- the loopback -------------------------------------------------------- */
/* Play one game through a referee; feed seat 1's commits to a mirror over
   JSON. `o.seatView` / `o.redact` are the sabotage seams. Returns the record
   the drills read. `stopAtLeak` ends a sabotaged run at its first leak. */
function loopback(k0, k1, seed, first, o){
  o = o || {};
  const g0 = deal(k0, k1, seed, first);
  const catalog = catalogOf(g0);
  const ref = R.createReferee({state: g0, reduce: J.reduce, legal: J.legal, check: INV.errors, catalog,
                               seatView: o.seatView, redact: o.redact});
  const mir = R.createMirror({catalog, seat: GUEST});
  const snap = json(ref.snapshot(GUEST));
  const out = {g0, ref, log: null, hashes: {0: snap.h}, steps: 0, mirrorFails: [], viewMismatch: [], cutMismatch: [],
               uidLeaks: [], nameLeaks: [], arsenalBy0: 0, maxBytes: 0, bytes: 0, everNames: new Set()};
  if(mir.load(snap)) out.mirrorFails.push("snapshot");
  out.mirror = mir;
  const ever = out.everNames;
  for(const n of structNames(mir.view())) ever.add(n);
  scanUids(out, snap, ref.state(), 0);
  for(let k = 0; k < 3000 && !ref.over(); k++){
    let moved = false;
    for(const s of [0, 1]){
      const st = ref.state();
      const a = SP.act(st, s, {search: false});
      if(!a) continue;
      const r = ref.intent(s, a);
      if(r.error) continue;
      moved = true;
      out.steps++;
      if(s === 0 && a.t === "arsenal") out.arsenalBy0++;
      const wire = JSON.stringify(r.commits[GUEST]);
      out.bytes += wire.length; out.maxBytes = Math.max(out.maxBytes, wire.length);
      const c = JSON.parse(wire);
      const n = ref.state();
      const feedAt = (mir.view().feed || []).length;
      const why = mir.commit(c);
      if(why) out.mirrorFails.push(r.seq + ": " + why);
      out.hashes[c.seq] = c.h;
      /* EVERY commit: the mirror checked the view fingerprint (`h`) itself and
         would have said "desync". Every third, the whole view is compared
         and scanned too (the drill's own cost, not the referee's). */
      const deep = out.steps % 3 === 0 || ref.over();
      if(deep && !o.seatView){
        const want = R.seatView(n, GUEST);
        if(!R.same(mir.view(), want)) out.viewMismatch.push(r.seq + ": " + Wr.diffPaths(mir.view(), want, 3, new Set()).join(", "));
      }
      if(!o.seatView && out.steps % 7 === 0){
        /* the cuts and nothing else: view() itself, minus feed/log/still, the
           multiset uids, and the uid scrub (hidden counter keys, bare uids) */
        const hid = V.hiddenUids(n, GUEST);
        const strip = v => R.scrubUids(json({...v, feed: 0, log: 0, feedTo: 0, still: 0,
          sides: v.sides.map(sd => ({...sd, unseen: (sd.unseen || []).map(x => ({...x, uid: 0, powCard: 0})), unseenGear: (sd.unseenGear || []).map(x => ({...x, uid: 0, powCard: 0}))}))}),
          hid, u => "?" + hid.get(u).owner + "x");
        if(!R.same(strip(mir.view()), strip(V.view(n, GUEST)))) out.cutMismatch.push(r.seq);
      }
      /* the commit is scanned against cards hidden BEFORE and AFTER it: a card
         the guest just saw leave a public zone (bounced to a hand) may be
         named by the delta that removes it — the move was public */
      scanUids(out, c, n, r.seq, st);
      if(deep) scanUids(out, mir.view(), n, r.seq);
      /* names: the new feed lines the guest can read */
      const v = mir.view();
      const fresh = (v.feed || []).slice(feedAt);
      if(!fresh.length) break;
      for(const nm of structNames(v)) ever.add(nm);
      for(const line of fresh) if(REVEAL_LINE.test(line)) for(const [, rr] of V.hiddenUids(n, GUEST)) if(named(line, rr.card.name)) ever.add(rr.card.name);
      const secret = [...new Set([...V.hiddenUids(n, GUEST).values()].map(rr => rr.card.name))].filter(nm => nm && !ever.has(nm));
      for(const line of fresh){
        if(REVEAL_LINE.test(line)) continue;
        for(const nm of secret) if(named(String(line), nm)) out.nameLeaks.push(r.seq + ": " + line);
      }
      break;
    }
    if(!moved) break;
    if(o.stopAtLeak && (out.uidLeaks.length || out.nameLeaks.length)) break;
  }
  out.log = ref.log();
  out.over = json(ref.state().over);
  return out;
}
function scanUids(out, v, hostState, at, before){
  let hid = hiddenUidSet(hostState, GUEST);
  if(before){ const b = hiddenUidSet(before, GUEST); hid = new Set([...hid].filter(u => b.has(u))); }
  for(const u of leakedUids(v, hid)) out.uidLeaks.push(at + ": uid " + u);
}

const RUNS = HEROES.map((h, i) => ({hero: h, foe: HEROES[(i + 4) % HEROES.length],
  ...loopback(h, HEROES[(i + 4) % HEROES.length], "h2-ref-" + i, i % 2)}));

test("the loopback: one game per hero for all 15, played through the referee to a result", () => {
  assert.equal(RUNS.length, 15);
  for(const r of RUNS){
    assert.ok(r.steps >= 100, r.hero + " played only " + r.steps + " steps");
    assert.ok(r.over, r.hero + " v " + r.foe + " did not finish");
  }
});

test("THE GUEST'S VIEW AFTER EVERY COMMIT EQUALS THE REFEREE'S seatView(hostState, guest), and the canary agrees", () => {
  for(const r of RUNS){
    assert.deepEqual(r.mirrorFails, [], r.hero + ": the mirror stopped trusting itself");
    assert.deepEqual(r.viewMismatch.slice(0, 3), [], r.hero + ": " + r.viewMismatch.length + " mismatches");
  }
});

test("…and seatView is view(hostState, guest) with exactly the four cuts (feed, still, multiset uids, hidden counter keys)", () => {
  for(const r of RUNS) assert.deepEqual(r.cutMismatch.slice(0, 3), [], r.hero);
});

test("THE LOOPBACK LEAK DRILL — over a full game for all 15 heroes the guest holds and receives NO hidden uid", () => {
  for(const r of RUNS) assert.deepEqual(r.uidLeaks.slice(0, 5), [], r.hero + " v " + r.foe + ": " + r.uidLeaks.length + " leaks");
});

test("…and NO feed line the guest can read names a card hidden from it (reveals excepted, as H1)", () => {
  for(const r of RUNS) assert.deepEqual(r.nameLeaks.slice(0, 5), [], r.hero + " v " + r.foe);
});

test("the referee ran the invariant judge on the FULL state after every action: 0 violations", () => {
  for(const r of RUNS) assert.deepEqual(r.ref.violations().slice(0, 3), [], r.hero);
});

test("the commits are small: a delta, not a board", () => {
  const steps = RUNS.reduce((a, r) => a + r.steps, 0), bytes = RUNS.reduce((a, r) => a + r.bytes, 0);
  const avg = bytes / steps;
  assert.ok(avg < 4000, "average commit " + Math.round(avg) + " bytes");
});

/* ---- sabotage: each drill above must be able to fail ---------------------- */

test("SABOTAGE — a referee that sends the full state is caught leaking uids at once", () => {
  const r = loopback("kayo", "boltyn", "h2-sab-1", 0, {seatView: (g) => json(g), stopAtLeak: true});
  assert.ok(r.uidLeaks.length > 0, "the full state must leak");
});

test("SABOTAGE — without the multiset cut, `unseen` carries hidden uids and the drill says so", () => {
  const r = loopback("kayo", "boltyn", "h2-sab-2", 0, {seatView: (g, s) => json(V.view(g, s)), stopAtLeak: true});
  assert.ok(r.uidLeaks.length > 0);
});

test("SABOTAGE — without the slot handle, an arsenal action names the face-down card", () => {
  let found = null;
  for(let i = 0; i < 8 && !found; i++){
    const r = loopback(HEROES[i], HEROES[(i + 4) % HEROES.length], "h2-ref-" + i, i % 2, {redact: a => json(a), stopAtLeak: true});
    if(r.uidLeaks.length) found = r;
  }
  assert.ok(found, "an unredacted arsenal action must leak its card's uid");
  /* and the real runs did put cards face-down: the slot handle was exercised */
  assert.ok(RUNS.reduce((a, r) => a + r.arsenalBy0, 0) > 0, "the host arsenaled at least once in the loopback");
});

/* THE SCRAMBLE, ON THE WIRE. Swap the cards behind the guest's placeholders
   (the foe's hand, deck and face-down arsenal, and the guest's own deck
   order) and the guest's view must not move. This is what catches a leak
   the uid scanner cannot read: `still`'s uid signature is one string. */
function scramble(g){
  const sides = g.sides.slice();
  const f = {...sides[0]};
  const pool = [...f.hand, ...f.deck, ...(f.arsenal && !f.arsenal._faceUp ? [f.arsenal] : [])];
  const hidden = [...V.hiddenUids(g, GUEST).keys()].map(String);
  const isHid = c => c && hidden.indexOf(String(c.uid)) >= 0;
  const hc = pool.filter(isHid);
  if(hc.length < 2) return null;
  const rot = hc.slice(1).concat(hc.slice(0, 1));
  let j = 0;
  const put = c => isHid(c) ? rot[j++] : c;
  f.hand = f.hand.map(put); f.deck = f.deck.map(put);
  if(f.arsenal && !f.arsenal._faceUp) f.arsenal = put(f.arsenal);
  sides[0] = f;
  /* the guest's own deck order: reversed, except the known bottom block (`_kb`)
     and the known top block (`_kt`), whose slots are public */
  const d = sides[GUEST].deck, kb = (() => { let k = 0; for(let i = d.length - 1; i >= 0 && d[i]._kb; i--) k++; return k; })();
  const kt = (() => { let k = 0; while(k < d.length - kb && d[k]._kt) k++; return k; })();
  const me = {...sides[GUEST], deck: d.slice(0, kt).concat(d.slice(kt, d.length - kb).reverse(), d.slice(d.length - kb))};
  sides[GUEST] = me;
  return {...g, sides};
}
/* `still` is recomputed on both boards from scratch (judge.stalemateCheck), as
   the reducer would have written it for that arrangement of cards */
const scrambleMoves = sv => {
  let n = 0, moved = [];
  for(const r of RUNS.slice(0, 6)){
    let g = r.g0;
    for(const e of r.log){
      g = J.reduce(g, e.action, e.seat).state;
      if(e.seq % 9) continue;
      let x = scramble(g);
      if(!x) continue;
      x = J.stalemateCheck({...x, still: null});
      const gs = J.stalemateCheck({...g, still: null});
      if(gs.over || x.over) continue;
      n++;
      const strip = v => ({...v, feed: 0, log: 0, feedTo: 0});
      const A = strip(sv(gs, GUEST)), B = strip(sv(x, GUEST));
      if(!R.same(A, B)) moved.push(r.hero + "@" + e.seq + ": " + Wr.diffPaths(A, B, 2, new Set()).join(", "));
    }
  }
  return {n, moved};
};
test("THE SCRAMBLE ON THE WIRE — swapping every card behind the guest's placeholders does not move its view", () => {
  const {n, moved} = scrambleMoves(R.seatView);
  assert.ok(n > 100, "scrambled " + n + " positions");
  assert.deepEqual(moved.slice(0, 3), [], moved.length + " positions moved");
});
test("SABOTAGE — without the `still` cut, the stalemate tracker's uid signature moves with the scramble", () => {
  const leaky = (g, s) => ({...R.seatView(g, s), still: json(g.still)});
  const {moved} = scrambleMoves(leaky);
  assert.ok(moved.length > 0 && moved.every(m => /still/.test(m)), "the full `still` must be caught: " + moved.slice(0, 2).join(" / "));
});

test("SABOTAGE — without the feed cut, the guest reads the host's private look (Compass)", () => {
  const H = require("./helpers/judged.js");
  const top = {uid: "tp", name: "Hidden Probe", pitch: 2, tt: "Generic Action", ty: ["Generic", "Action"], tx: ""};
  const g = H.state({name: "Gravy", deck: [top, {uid: "t2", name: "Other Probe", pitch: 1, tx: ""}]}, {name: "Bob"});
  const n = H.runOps(g, [["reveal", 1, "look"]], "Compass of Sunken Depths");
  const lines = s => R.seatView(n, s).feed.filter(l => named(l, "Hidden Probe"));
  assert.ok(lines(0).length >= 1, "the looker reads its card");
  assert.deepEqual(lines(1), [], "the other seat does not");
  /* the cut is what did it: the unfiltered feed names the card to seat 1 */
  assert.ok((n.feed || []).some(l => named(l, "Hidden Probe")), "fixture: the raw feed names it");
  assert.ok(R.seatView(n, 1).log.every(l => !named(l, "Hidden Probe")), "and the rebuilt log does not");
});

/* ---- the desync canary ----------------------------------------------------- */
test("THE CANARY — a tampered delta, a wrong fingerprint and a gap each stop the mirror; a duplicate applies once", () => {
  const g0 = match("kayo", "boltyn", "h2-canary", 0);
  const catalog = catalogOf(g0);
  const ref = R.createReferee({state: g0, reduce: J.reduce, legal: J.legal, catalog});
  const mir = () => { const m = R.createMirror({catalog, seat: GUEST}); m.load(json(ref.snapshot(GUEST))); return m; };
  const m = mir();
  const commits = [];
  for(let k = 0; commits.length < 6 && k < 50; k++) for(const s of [0, 1]){
    const a = SP.act(ref.state(), s, {search: false}); if(!a) continue;
    const r = ref.intent(s, a); if(r.error) continue;
    commits.push(json(r.commits[GUEST])); break;
  }
  assert.equal(m.commit(commits[0]), null);
  assert.equal(m.commit(commits[0]), null, "a duplicate is applied once");
  assert.equal(m.seq(), commits[0].seq);
  assert.equal(m.commit(commits[2]), "gap", "a missing commit is a gap");
  const bad = {...commits[1], h: "0000000000000000"};
  assert.equal(m.commit(bad), "desync", "a fingerprint the view does not match");
  assert.equal(m.seq(), commits[0].seq, "and the mirror keeps the view it trusted");
  /* a delta that writes a wrong value: the fingerprint catches it */
  const t = json(commits[1]);
  t.d = (t.d || []).concat([["s", ["sides", 0, "hp"], 999]]);
  assert.equal(m.commit(t), "desync");
  assert.equal(m.commit(commits[1]), null, "the honest commit still applies");
});

/* ---- the slot handle ---------------------------------------------------------- */
test("SLOT HANDLE (P3) — the other seat learns WHERE a card went face-down, never which card", () => {
  const g = match("azalea", "kayo", "h2-slot", 0);
  const sd = g.sides[0], c = sd.hand[0];
  const after = {...g, sides: [{...sd, hand: sd.hand.slice(1), arsenal: c}, g.sides[1]]};
  const a = {t: "arsenal", uid: c.uid};
  const toGuest = R.redactAction(a, after, 1), toOwner = R.redactAction(a, after, 0);
  assert.equal(toGuest.uid, "?0a0", "the guest's action names the arsenal slot");
  assert.equal(toOwner.uid, c.uid, "the owner's names its card");
  /* a card that went PUBLIC by the action keeps its uid: the action revealed it */
  const played = {...g, sides: [{...sd, hand: sd.hand.slice(1), grave: [c]}, g.sides[1]]};
  assert.equal(R.redactAction({t: "play", uid: c.uid, from: "hand"}, played, 1).uid, c.uid);
});

test("A CHARGE'S `picked` LIST names hand cards by bare uid: the other seat gets the carrier placeholder, the owner its own uids (v6.25)", () => {
  const g = match("azalea", "boltyn", "h2-picked", 0);
  const sd = g.sides[1], [c0, c1, played] = sd.hand;   /* `played` is the charging card itself: public in `pending.card` */
  const pending = {kind: "charge", seat: 1, card: played, from: "hand", window: "action", uids: [c1.uid], picked: [c0.uid], multi: true};
  const g2 = {...g, pending};
  const foe = R.seatView(g2, 0).pending, own = R.seatView(g2, 1).pending;
  assert.deepEqual(foe.picked, ["?1x"], "the foe's view names no picked card");
  assert.deepEqual(foe.uids, ["?1x"]);
  assert.deepEqual(own.picked, [c0.uid], "the owner keeps its own uids");
  assert.ok(R.UID_KEY.test("picked"));
});

/* ---- the invariant judge at the referee ------------------------------------ */
test("the referee records what the invariant judge finds on the full state (sabotage: a judge that always objects)", () => {
  const g0 = match("kayo", "boltyn", "h2-inv", 0);
  const ref = R.createReferee({state: g0, reduce: J.reduce, legal: J.legal, check: st => st.turn >= 1 ? [{code: "PROBE", msg: "always"}] : []});
  for(let k = 0; k < 10; k++) for(const s of [0, 1]){ const a = SP.act(ref.state(), s, {search: false}); if(a && !ref.intent(s, a).error) break; }
  assert.ok(ref.violations().some(v => v.code === "PROBE"), "a violation is recorded");
  /* and an illegal intent is refused, never applied */
  const before = ref.seq();
  assert.ok(ref.intent(1, {t: "nonsense"}).error);
  assert.equal(ref.seq(), before);
});

test("the view census passes every view the guest held, and catches a uid in two zones", () => {
  const r = RUNS[0];
  assert.deepEqual(R.viewCensus(R.seatView(r.ref.state(), GUEST)), []);
  const v = json(R.seatView(r.g0, GUEST));
  v.sides[1].grave = [v.sides[1].hand[0]];
  assert.ok(R.viewCensus(v).some(x => /is in/.test(x)), "a card in hand and graveyard at once");
});

/* ---- VERIFY THIS GAME ---------------------------------------------------------- */
test("VERIFY THIS GAME — the opening and the full log replay through judge.reduce to every view the guest saw and the same result", () => {
  for(const r of RUNS){
    const v = R.replay({start: r.g0, log: r.log, reduce: J.reduce, seat: GUEST, hashes: r.hashes, over: r.over});
    assert.ok(v.ok, r.hero + ": " + v.why);
    assert.deepEqual(json(v.over), r.over);
  }
});
test("SABOTAGE — a doctored log, a different opening and a different result each fail verification", () => {
  const r = RUNS[1];
  /* drop one action from the middle: the next views differ (or an action turns illegal) */
  const cut = r.log.slice(0, 20).concat(r.log.slice(21));
  assert.equal(R.replay({start: r.g0, log: cut, reduce: J.reduce, seat: GUEST, hashes: r.hashes, over: r.over}).ok, false);
  /* another seed's opening: refused at the deal */
  const other = deal(r.hero, r.foe, "not-the-seed", RUNS.indexOf(r) % 2);
  const v2 = R.replay({start: other, log: r.log, reduce: J.reduce, seat: GUEST, hashes: r.hashes, over: r.over});
  assert.equal(v2.ok, false);
  assert.equal(v2.at, 0, "the opening itself does not match: " + v2.why);
  /* the right log, a claimed result it does not reach */
  const v3 = R.replay({start: r.g0, log: r.log, reduce: J.reduce, seat: GUEST, over: {winner: 1 - r.over.winner, how: "life"}});
  assert.equal(v3.ok, false);
});

/* ---- the delta ----------------------------------------------------------------- */
test("the delta round-trips: applyDelta(a, delta(a, b)) equals b, without mutating a", () => {
  const cases = [[{x: 1, y: [1, 2, 3]}, {x: 2, y: [1, 3], z: {k: null}}], [[1, 2, 3, 4, 5, 6, 7], [0, 1, 2, 9, 9, 9, 9, 9, 6, 7]],
    [{a: [{uid: 1, n: "a"}, {uid: 2}]}, {a: [{uid: 2}]}], [{a: 1}, {}], [{}, {b: [1]}], [[], [1]], [[1], []]];
  for(const [a, b] of cases){
    const keep = JSON.stringify(a);
    const out = R.applyDelta(json(a), json(R.delta(a, b)));
    assert.deepEqual(out, b);
    assert.equal(JSON.stringify(a), keep);
  }
  /* and over two real views, with cards interned against the catalog */
  const g = RUNS[2].g0, cat = catalogOf(g), a = R.seatView(g, 1);
  const st = J.reduce(g, SP.act(g, g.priority, {search: false}), g.priority).state;
  const b = R.seatView(st, 1), d = json(R.delta(a, b, cat));
  assert.deepEqual(R.applyDelta(json(a), d, cat), b);
  assert.ok(JSON.stringify(d).indexOf("\"tx\"") < 0, "a catalogued card ships as its key, not its text");
});
