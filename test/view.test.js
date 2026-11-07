/* test/view.test.js — HIDDEN HANDS H1: `view(state, seat)` (engine/view.js).
   HIDDEN-HANDS.md §4.1/§4.2/§6 is the design. Asserts on zones, uids, actions
   and legality; the feed-leak drill reads feed lines because the leak IS prose
   (said again where it does).

   THE POSITIONS: one rule-policy self-play game per hero (all 15, each as seat
   0 against the hero four along), every state kept. The proving drills walk
   them from both seats. */
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../tools/selfplay.js");
const {match, J, SP, W} = S;
const V = require("../engine/view.js");
const RNG = require("../engine/rng.js");

const Wr = require("../engine/wire.js");
const uids = arr => (arr || []).map(c => c && c.uid);
/* equal as JSON; on a miss, say WHERE (the first differing paths) */
const same = (a, b, msg) => { const A = JSON.stringify(a), B = JSON.stringify(b);
  if(A !== B) assert.fail(msg + " — differs at " + Wr.diffPaths(JSON.parse(A), JSON.parse(B), 6, new Set()).join(", ")); };
const hiddenCard = c => V.isPh(c);
const HEROES = W.HEROES.filter(h => W.DECKS[h.k]).map(h => h.k);
const POOL_NAMES = (() => { const p = require("../data/pool.js"); const out = new Set();
  (Array.isArray(p) ? p : Object.values(p)).forEach(c => c && c.name && out.add(c.name)); return out; })();

/* every state of one game per hero: [{g, a, s, n}] (state, action, actor, next) */
const GAMES = (() => {
  const out = [];
  HEROES.forEach((h, i) => {
    let g = match(h, HEROES[(i + 4) % HEROES.length], "h1-view-" + i, i % 2);
    const steps = [];
    for(let k = 0; k < 3000 && !g.over; k++){
      let moved = false;
      for(const s of [0, 1]){
        const a = SP.act(g, s, {search: false});
        if(!a) continue;
        const r = J.reduce(g, a, s);
        if(r.error) continue;
        steps.push({g, a, s, n: r.state}); g = r.state; moved = true; break;
      }
      if(!moved) break;
    }
    out.push({hero: h, steps});
  });
  return out;
})();
const every = (stride, fn) => { for(const G of GAMES) G.steps.forEach((st, i) => { if(i % stride === 0) fn(st, G.hero); }); };

test("the positions: one self-play game for each of the 15 heroes, long enough to mean something", () => {
  assert.equal(GAMES.length, 15);
  for(const G of GAMES) assert.ok(G.steps.length >= 100, G.hero + " played only " + G.steps.length + " steps");
});

/* ---- the zones -------------------------------------------------------- */

/* CR 3.0.4b "The arsenal, deck, and hand zones are private zones." */
test("CR 3.0.4b — the foe's hand, face-down arsenal and deck are placeholders; the seat's own deck is its COMPOSITION, never its order", () => {
  const g = match("kayo", "boltyn", "view-1", 0);
  const o = g.sides[1], arsCard = o.hand[0];
  const g2 = {...g, sides: [g.sides[0], {...o, hand: o.hand.slice(1), arsenal: arsCard}]};
  const v = V.view(g2, 0);
  assert.equal(v.sides[1].hand.length, g2.sides[1].hand.length, "hand size is public");
  assert.ok(v.sides[1].hand.every(hiddenCard), "every foe hand card is hidden");
  assert.ok(hiddenCard(v.sides[1].arsenal), "a face-down arsenal card is hidden");
  assert.equal(v.sides[1].deck.length, o.deck.length, "deck size is public");
  assert.ok(v.sides[1].deck.every(hiddenCard), "the foe's deck is placeholders");
  /* the seat's own deck: the same cards, in canonical order, flagged */
  const me = g2.sides[0];
  assert.deepEqual(uids(v.sides[0].deck), uids(me.deck.slice().sort(V.canon)), "own deck = composition in canonical order");
  assert.notDeepEqual(uids(v.sides[0].deck), uids(me.deck), "fixture: the real order is not the canonical one");
  assert.deepEqual(v.sides[0]._unordered, [0, me.deck.length], "the whole own deck is flagged unordered");
  /* the foe's unseen multiset: every real card behind a placeholder */
  assert.deepEqual(uids(v.sides[1].unseen), uids(o.deck.concat(o.hand).slice().sort(V.canon)), "foe unseen = hand + deck + arsenal, canonical");
  assert.deepEqual(uids(v.sides[0].hand), uids(me.hand), "the seat's own hand is its own");
  assert.notDeepEqual(v.rng, g2.rng, "the seed is every future draw: withheld");
  /* a face-UP arsenal card is public */
  const g3 = {...g2, sides: [g2.sides[0], {...g2.sides[1], arsenal: {...arsCard, _faceUp: true}}]};
  assert.equal(V.view(g3, 0).sides[1].arsenal.uid, arsCard.uid);
  /* a view of a view is the view */
  assert.equal(V.view(v, 0), v);
});

/* CR 3.0.4a/3.0.4d — judge.js keeps a declared defender (`blockH`), a card
   picked to pitch (`paySel`) and the card being played (`pending`) in the hand. */
test("CR 3.0.4d — a declared defender, a card picked to pitch and the card being played are public, though judge keeps them in the hand", () => {
  const g = match("bravo", "kayo", "view-3", 0);
  const o = g.sides[1], [d, p, q] = o.hand;
  const v = V.view({...g, pending: {card: q}, sides: [g.sides[0], {...o, blockH: [d.uid], paySel: [p.uid]}]}, 0);
  assert.deepEqual(uids(v.sides[1].hand).slice(0, 3), [d.uid, p.uid, q.uid]);
  assert.ok(v.sides[1].hand.slice(3).every(hiddenCard), "the rest of the hand stays hidden");
  assert.ok(!uids(v.sides[1].unseen).includes(d.uid), "a public card is not in the unseen multiset");
});

/* CR 3.0.4c "A public zone may contain a private object, if the object is made
   private while in that zone, or if the object is moved into that zone as a
   private object." Intimidate banishes face-down (CR 8.5.10). */
test("CR 3.0.4c — an intimidated card is hidden from the other seat, and REVEAL puts it back at its slot", () => {
  const g = match("lyath", "kayo", "view-4", 0);
  const o = g.sides[1], c = o.hand[0];
  const g2 = {...g, sides: [g.sides[0], {...o, hand: o.hand.slice(1), intimidated: [c]}]};
  assert.ok(hiddenCard(V.view(g2, 0).sides[1].intimidated[0]));
  const r = V.hiddenUids(g2, 0).get(String(c.uid));
  assert.ok(r, "listed as hidden");
  const back = V.reveal(V.view(g2, 0), r);
  assert.equal(back.sides[1].intimidated[0].uid, c.uid);
  assert.ok(!uids(back.sides[1].unseen).includes(c.uid), "a revealed card leaves the unseen multiset");
});

/* HIDDEN-HANDS.md §7: three open rules questions, one switch each, MORE HIDDEN
   by default. Not decided here; the drill pins that each switch does what it
   names and that the default is the hidden side. */
test("the open rules questions are switches, and each defaults to the more hidden reading", () => {
  assert.deepEqual(V.SWITCHES, {SOUL_PUBLIC: false, OWNER_SEES_INTIMIDATED: false, PITCH_ORDER_PUBLIC: false});
  const g = match("boltyn", "kayo", "view-sw", 0);
  const me = g.sides[0], o = g.sides[1];
  const g2 = {...g, sides: [{...me, hand: me.hand.slice(1), intimidated: [me.hand[0]]},
                            {...o, hand: o.hand.slice(1), soul: [o.hand[0]]}]};
  const flip = (k, fn) => { V.SWITCHES[k] = true; try { return fn(); } finally { V.SWITCHES[k] = false; } };
  assert.ok(hiddenCard(V.view(g2, 0).sides[1].soul[0]), "soul hidden by default (§7 q1)");
  assert.equal(flip("SOUL_PUBLIC", () => V.view(g2, 0).sides[1].soul[0].uid), o.hand[0].uid);
  assert.ok(hiddenCard(V.view(g2, 0).sides[0].intimidated[0]), "own intimidated hidden by default (§7 q2)");
  assert.equal(flip("OWNER_SEES_INTIMIDATED", () => V.view(g2, 0).sides[0].intimidated[0].uid), me.hand[0].uid);
  /* §7 q3: a known bottom block of three, in a non-canonical order */
  const blk = o.deck.slice(-3).map(c => ({...c, _kb: true}));
  const order = blk.slice().sort(V.canon).reverse();
  const g3 = {...g, sides: [g.sides[0], {...o, deck: o.deck.slice(0, -3).concat(order)}]};
  const tail = vv => uids(vv.sides[1].deck.slice(-3));
  assert.deepEqual(tail(V.view(g3, 0)), uids(order.slice().sort(V.canon)), "the opponent sees the block as a SET (§7 q3)");
  assert.deepEqual(flip("PITCH_ORDER_PUBLIC", () => tail(V.view(g3, 0))), uids(order), "the switch shows the order");
  assert.deepEqual(tail(V.view(g3, 1)), uids(order), "the owner knows its own order");
});

/* ---- known slots ------------------------------------------------------ */

/* CR 4.4.3's end phase puts the pitch zone on the bottom; both players saw it. */
test("known slots: the pitch zone's bottom block is face-up to both, a shuffle ends it, and a drawn card loses the mark", () => {
  let found = null;
  for(const G of GAMES){
    for(const st of G.steps){
      const sd = st.n.sides.find(x => (x.deck || []).length > 3 && x.deck[x.deck.length - 1]._kb);
      if(sd){ found = {g: st.n, seat: st.n.sides.indexOf(sd)}; break; }
    }
    if(found) break;
  }
  assert.ok(found, "self-play put a pitch zone on a deck bottom");
  const {g, seat} = found, deck = g.sides[seat].deck;
  let kb = 0; for(let i = deck.length - 1; i >= 0 && deck[i]._kb; i--) kb++;
  const foeView = V.view(g, 1 - seat).sides[seat].deck;
  assert.ok(foeView.slice(-kb).every(c => !hiddenCard(c)), "the block is face-up to the opponent");
  assert.deepEqual(uids(foeView.slice(-kb)).sort(), uids(deck.slice(-kb)).sort(), "…and holds exactly those cards");
  assert.ok(foeView.slice(0, -kb).every(hiddenCard), "the rest of the deck stays hidden");
  assert.ok(!V.hiddenUids(g, 1 - seat).has(String(deck[deck.length - 1].uid)), "a known card is not listed as hidden");
  /* a shuffle (effects.js's two shuffles) clears the marks */
  const H = require("./helpers/judged.js");
  const sh = J.withEffects({...g, actor: seat, promptQ: []}, (fx, s2) => fx.applyAnswer(s2,
    {tag: "pick", side: seat, shuffleAfter: true, picked: [], cards: [], sel: [], min: 0, src: "Probe"}));
  assert.ok(sh && sh.sides, "fixture: the shuffle ran");
  assert.ok(!(sh.sides[seat].deck || []).some(c => c._kb), "a shuffle ends every known slot");
  /* drawn: a card carrying the mark is cleared on its way into the hand */
  const marked = deck[deck.length - 1];
  const sd2 = {...g.sides[seat], hand: [...g.sides[seat].hand, marked], deck: deck.slice(0, -1)};
  const g2 = {...g, sides: g.sides.map((x, i) => i === seat ? sd2 : x)};
  const after = J.reduce(g2, {t: "concede"}, seat).state;
  assert.ok(!after.sides[seat].hand.some(c => c._kb), "the mark does not follow a card into the hand");
  void H;
});

/* ---- the proving drills ----------------------------------------------- */

/* THE SCRAMBLE (HIDDEN-HANDS.md §4.1 item 1, the lookahead drill generalized):
   permute the cards hidden from a seat among their slots, reverse the seat's
   own unknown deck order, replace the seed: the seat's view must not move. */
function scramble(g, seat){
  const op = 1 - seat, o = g.sides[op], me = g.sides[seat];
  const hid = V.hiddenUids(g, seat);
  const take = [];   /* [zone, i] slots of the foe's hand, deck, arsenal, in a fixed order */
  for(const r of hid.values()) if(r.owner === op && ["hand", "deck", "arsenal"].includes(r.zone)) take.push(r);
  const cards = take.map(r => r.card).reverse();
  if(take.length > 1) cards.push(cards.shift());
  const so = {...o, hand: (o.hand || []).slice(), deck: (o.deck || []).slice()};
  take.forEach((r, j) => { if(r.zone === "arsenal") so.arsenal = cards[j]; else so[r.zone][r.i] = cards[j]; });
  const mine = V.view(g, seat).sides[seat]._unordered;
  const md = (me.deck || []).slice(), mid = md.slice(mine[0], mine[1]).reverse();
  const sm = {...me, deck: md.slice(0, mine[0]).concat(mid, md.slice(mine[1]))};
  const sides = g.sides.slice(); sides[op] = so; sides[seat] = sm;
  return {h: {...g, sides, rng: RNG.make("scrambled|" + g.turn)}, moved: take.length > 1};
}
test("THE SCRAMBLE — over self-play for all 15 heroes, swapping hidden cards for hidden cards never moves a seat's view", () => {
  let checked = 0, moved = 0;
  every(5, ({g}, hero) => {
    for(const seat of [0, 1]){
      const {h, moved: m} = scramble(g, seat);
      if(!m) continue;
      moved++;
      same(V.view(h, seat), V.view(g, seat), hero + " turn " + g.turn + " seat " + seat);
      checked++;
    }
  });
  assert.ok(checked >= 1500 && moved === checked, "scrambled " + checked + " positions");
});

/* NO HIDDEN UID SURVIVES: the leak scan the scramble cannot see (a copy that
   never moves). Outside the `unseen` multiset, no real uid hidden from the
   seat appears anywhere in its view. */
test("no uid hidden from a seat appears anywhere in its view, carriers included (outside the unseen multiset)", () => {
  let n = 0;
  every(3, ({g}, hero) => {
    for(const seat of [0, 1]){
      const hid = V.hiddenUids(g, seat);
      if(!hid.size) continue;
      const v = V.view(g, seat);
      const found = [];
      const walk = (x, p) => { if(x == null || typeof x !== "object") return;
        if(Array.isArray(x)) return x.forEach((y, i) => walk(y, p + "/" + i));
        if(x.uid != null && hid.has(String(x.uid))) found.push(p);
        for(const k of Object.keys(x)) if(k !== "unseen" && k !== "unseenGear" && k !== "feed" && k !== "log" && k !== "builds") walk(x[k], p + "/" + k); };
      walk(v, "");
      assert.deepEqual(found, [], hero + " turn " + g.turn + " seat " + seat);
      n++;
    }
  });
  assert.ok(n >= 3000, "scanned " + n);
});

/* THE CARRIER CENSUS (invariants.js's census, for visibility): every field
   outside the zones that holds a card object or a pool card's name must have
   a rule in view.js's CARRIERS. A new carrier fails here until it is ruled. */
function carriersIn(g){
  const out = new Map(), zones = new Set(V.ZONES);
  const walk = (x, key, d) => { if(x == null || d > 8) return;
    if(typeof x === "string"){ if(POOL_NAMES.has(x)) out.set(key, "name"); return; }
    if(typeof x !== "object") return;
    if(Array.isArray(x)) return x.forEach(y => walk(y, key, d + 1));
    if(x.uid != null && typeof x.name === "string") out.set(key, "card");
    for(const k of Object.keys(x)) walk(x[k], key, d + 1); };
  for(const k of Object.keys(g)){
    if(k === "log" || k === "feed") continue;
    if(k === "sides"){ g.sides.forEach(sd => { for(const f of Object.keys(sd)) if(!zones.has(f)) walk(sd[f], "sides." + f, 0); }); continue; }
    walk(g[k], k, 0);
  }
  return out;
}
test("THE CARRIER CENSUS — every field that copies a card or names one has a visibility rule", () => {
  const seen = new Map();
  every(1, ({n}) => { for(const [k, kind] of carriersIn(n)) seen.set(k, kind); });
  const unruled = [...seen.keys()].filter(k => !(k in V.CARRIERS)).sort();
  assert.deepEqual(unruled, [], "a field carries cards and has no rule in engine/view.js CARRIERS");
  /* the census must not pass by finding nothing */
  for(const k of ["pend", "chainCards", "featured", "revealed", "prompt", "_discWay"]) assert.ok(seen.has(k), "the census saw " + k);
  /* a `names` carrier never holds a card object: it is not swept */
  const bad = [...seen].filter(([k, kind]) => V.CARRIERS[k] === "names" && kind === "card").map(x => x[0]);
  assert.deepEqual(bad, [], "a names-only carrier holds card objects");
});

/* POLICY ON THE VIEW (HIDDEN-HANDS.md §4.2): the rule policy run on the
   actor's own view proposes the action it proposes on the real state. The
   spike missed 22 Dash boost calls when the view erased the own deck's
   composition; the composition is back. */
test("POLICY ON THE VIEW — the rule policy on its own view picks the same action, every step, all 15 heroes", () => {
  const misses = [];
  let n = 0;
  every(1, ({g, a, s}, hero) => {
    const b = SP.act(V.view(g, s), s, {search: false});
    if(JSON.stringify(b) !== JSON.stringify(a)) misses.push(hero + " t" + g.turn + " " + JSON.stringify(a) + " vs " + JSON.stringify(b));
    n++;
  });
  assert.ok(n >= 3000, "compared " + n);
  assert.deepEqual(misses.slice(0, 5), [], misses.length + " misses");
});

/* THE SPIKE AS A DRILL (HIDDEN-HANDS.md §5): every action the actor took is
   legal on the actor's own view. */
test("LEGAL ON THE VIEW — every action taken is legal judged from the actor's own view, 0 refusals", () => {
  const bad = [];
  let n = 0;
  every(1, ({g, a, s}, hero) => {
    const why = J.legal(V.view(g, s), a, s);
    if(why) bad.push(hero + " t" + g.turn + " " + a.t + ": " + why);
    n++;
  });
  assert.ok(n >= 3000, "judged " + n);
  assert.deepEqual(bad.slice(0, 5), [], bad.length + " refusals");
});

/* THE FEED-LEAK DRILL. The line text IS the observable: the leak is prose.
   A new feed line a seat may read (untagged, or tagged for it) never names a
   card hidden from that seat — unless the line is a REVEAL (clash, fusion,
   transcend's flip: both players see the card). "Hidden" = the name of a card
   in a hidden slot that appears nowhere public in the seat's view before or
   after the step. */
const REVEAL_LINE = /\breveal(?:s|ed)?\b|\bflips to\b|\bfused\b/;
/* OPEN (HIDDEN-HANDS.md §7 q1): charge names the card it puts in the soul.
   Public if the soul is; if the user rules it private, this line must be
   tagged and this carve-out goes. */
const CHARGE_LINE = /\(Charge\)/;
const named = (line, nm) => new RegExp("(^|[^A-Za-z'])" + nm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "($|[^A-Za-z'])").test(line);
const scalars = (v, out) => { if(Array.isArray(v)) v.forEach(x => scalars(x, out));
  else if(v && typeof v === "object") Object.values(v).forEach(x => scalars(x, out));
  else if(v != null) out.add(String(v)); return out; };
const publicNames = v => scalars({...v, feed: [], log: [], sides: v.sides.map(sd => ({...sd, deck: sd.deck.filter(c => !V.isPh(c)), unseen: []}))}, new Set());
function feedLeaks(steps){
  const out = [];
  for(const {g, n} of steps){
    const at = (g.feed || []).length, fresh = (n.feed || []).slice(at), to = n.feedTo || {};
    if(!fresh.length) continue;
    for(const v of [0, 1]){
      const pub = new Set([...publicNames(V.view(g, v)), ...publicNames(V.view(n, v))]);
      const cands = [...V.hiddenUids(n, v).values()].map(r => r.card.name).filter(nm => nm && !pub.has(nm));
      /* a card a reveal line of this step named is public for the step */
      const readable = fresh.filter((line, i) => !(to[at + i] != null && to[at + i] !== v));
      const secret = new Set(cands.filter(nm => !readable.some(l => REVEAL_LINE.test(l) && named(l, nm))));
      fresh.forEach((line, i) => {
        if(to[at + i] != null && to[at + i] !== v) return;   /* addressed to the other seat */
        if(REVEAL_LINE.test(line) || (!V.SWITCHES.SOUL_PUBLIC && CHARGE_LINE.test(line))) return;
        for(const nm of secret) if(named(String(line), nm)) out.push("seat " + v + " reads: " + line);
      });
    }
  }
  return out;
}
test("THE FEED-LEAK DRILL — no line a seat may read names a card hidden from it, unless the line is a reveal", () => {
  const leaks = [];
  for(const G of GAMES) leaks.push(...feedLeaks(G.steps));
  assert.deepEqual(leaks.slice(0, 5), [], leaks.length + " leaks");
});
test("the feed-leak drill can fail: Compass's look, run at the table, names the card only in the line tagged for the looker", () => {
  const H = require("./helpers/judged.js");
  const top = {uid: "tp", name: "Hidden Probe", pitch: 2, tt: "Generic Action", ty: ["Generic", "Action"], tx: ""};
  const g = H.state({name: "Gravy", deck: [top, {uid: "t2", name: "Other Probe", pitch: 1, tx: ""}]}, {name: "Bob"});
  const n = H.runOps(g, [["reveal", 1, "look"]], "Compass of Sunken Depths");
  assert.deepEqual(feedLeaks([{g, n}]), [], "the look leaks nothing");
  /* the same step with the tag stripped: the looker's line is now everyone's */
  const leaks = feedLeaks([{g, n: {...n, feedTo: {}}}]);
  assert.ok(leaks.length >= 1 && leaks.every(l => /^seat 1 reads/.test(l)), "untagged, the opponent reads the card: " + leaks.join(" / "));
  /* and the opponent's view drops the private `revealed` */
  assert.equal(V.view(n, 1).revealed, null);
  assert.equal(V.view(n, 0).revealed.uid, "tp");
});

/* ONE BODY WITH laMask: Sharp's lookahead root is determinize(view). Here is
   v5.37's laMask, kept as the REFERENCE it must reproduce. It read the real
   state, so it saw what the view rightly withholds: the foe's intimidated
   cards (dealt back at random now), hidden copies in carrier fields and the two open
   §7 questions' cards (soul, own intimidated). Those positions are counted
   apart; every other position must match byte for byte. */
const num = (c, k) => (c && c[k] != null) ? c[k] : 0;
const oldCanon = (a, b) => String(a.name) < String(b.name) ? -1 : String(a.name) > String(b.name) ? 1
  : num(a, "pitch") - num(b, "pitch") || (String(a.uid) < String(b.uid) ? -1 : String(a.uid) > String(b.uid) ? 1 : 0);
function oldLaMask(g, seat, k, salt){
  const op = 1 - seat, sides = g.sides.slice(), me = sides[seat], o = sides[op];
  const pub = [g.turn, seat, k, salt != null ? salt : (g.feed || []).length, (o.hand || []).length, (o.deck || []).length,
               (me.deck || []).length, (me.hand || []).map(c => c.uid).join(".")].join("|");
  let r = RNG.make("la|" + pub);
  const hidArs = !!(o.arsenal && !o.arsenal._faceUp);
  const pool = (o.hand || []).concat(o.deck || [], hidArs ? [o.arsenal] : []).slice().sort(oldCanon);
  let sh = RNG.shuffle(r, pool); r = sh.rng;
  const nh = (o.hand || []).length;
  sides[op] = {...o, hand: sh.arr.slice(0, nh), arsenal: hidArs ? sh.arr[nh] : o.arsenal, deck: sh.arr.slice(nh + (hidArs ? 1 : 0))};
  sh = RNG.shuffle(r, (me.deck || []).slice().sort(oldCanon)); r = sh.rng;
  sides[seat] = {...me, deck: sh.arr};
  return {...g, sides, rng: RNG.make("la-game|" + pub), feed: [], log: []};
}
function peeked(g, seat){
  const o = g.sides[1 - seat], me = g.sides[seat];
  if((o.intimidated || []).length) return "foe intimidated";
  if(!V.SWITCHES.SOUL_PUBLIC && (o.soul || []).length) return "soul (§7 q1)";
  if(!V.SWITCHES.OWNER_SEES_INTIMIDATED && (me.intimidated || []).length) return "own intimidated (§7 q2)";
  const hid = V.hiddenUids(g, seat);
  for(const k of Object.keys(V.CARRIERS)) if(["sweep", "addressed"].includes(V.CARRIERS[k]) && g[k] != null){
    const s = new Set(); JSON.stringify(g[k], (kk, vv) => { if(kk === "uid") s.add(String(vv)); return vv; });
    for(const u of s) if(hid.has(u)) return "hidden copy in " + k;
  }
  return null;
}
test("ONE BODY WITH laMask — Sharp's root is determinize(view), and it is v5.37's deal byte for byte wherever that deal saw nothing hidden", () => {
  const apart = {};
  let matched = 0;
  every(2, ({g}, hero) => {
    for(const seat of [0, 1]){
      const why = peeked(g, seat);
      if(why){ apart[why] = (apart[why] || 0) + 1; continue; }
      /* `revealed` is compared apart: the table never clears it, so a stale
         one rides into every later root. The view drops the other seat's
         look and sweeps a stale card; no rollout reads it before a reveal
         op writes it afresh. */
      const a = SP.laMask(g, seat, 0), b = oldLaMask(g, seat, 0);
      if(JSON.stringify(a.revealed) !== JSON.stringify(b.revealed)) apart["(revealed only)"] = (apart["(revealed only)"] || 0) + 1;
      same({...a, revealed: null}, {...b, revealed: null}, hero + " turn " + g.turn + " seat " + seat);
      matched++;
    }
  });
  const total = matched + Object.keys(apart).filter(k => k[0] !== "(").reduce((a, k) => a + apart[k], 0);
  console.log("# laMask identity: matched " + matched + " of " + total + "; apart " + JSON.stringify(apart));
  assert.ok(matched >= 0.8 * total, "matched " + matched + " of " + total + "; apart " + JSON.stringify(apart));
  /* the search never runs the real state: a scrambled root determinizes the same */
  every(25, ({g}) => { for(const seat of [0, 1]){ const {h} = scramble(g, seat);
    same(SP.laMask(h, seat, 0), SP.laMask(g, seat, 0), "scrambled root"); } });
});
