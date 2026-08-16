/* ============================================================
   ONE EFFECTS CONTEXT, AND IT IS THE ONE A PLAYER GETS.

   Five drill files each carried a hand-rolled `ctx()` literal and called
   `E.makeEffects(ctx())` directly. That is the no-mirror rule broken in
   the drills rather than in the engine, and it had already drifted:

     * they still passed `dummyDefence` and `built`, neither of which has
       been in `CTX_KEYS` since v2.73 / v2.77 — dead keys aimed at a
       context that changed underneath them;
     * `mkRune`, `openPrompt` and `winCheck` were `s => s`, so a runechant
       was never minted, a prompt never opened and nobody ever won;
     * `had6ThisTurn` was `() => false` — a CONSTANT standing in for the
       one condition half of Kayo's deck is built on;
     * `bAct` and `bFoe` returned the SAME build, so a drill could not
       tell the two seats apart at all.

   Every one of those is the shape this project keeps paying for: a drill
   that passes by asserting against a stub. `effectsFor` is judge.js's own
   context and is what `commitPlay` / `strike` / `closeChain` run on, so a
   drill built here is measuring the engine rather than its own fixture.

   THE BUILD IS ON THE STATE, NOT IN THE CONTEXT. `bAct(g)` reads
   `g.builds[actor]`, which is why `state()` takes `builds` — a build
   handed to a context is seat-agnostic by construction and cannot express
   "his hero ability, not theirs".
   ============================================================ */
const fs = require("fs");
const path = require("path");

const J = require("../../engine/judge.js");
const C = require("../../engine/cards.js");
const S = require("../../engine/sides.js");
const RNG = require("../../engine/rng.js");

const ROOT = path.join(__dirname, "..", "..");
const CACHE = path.join(ROOT, "tools", ".cache", "card.json");

const hasDb = () => fs.existsSync(CACHE);

/* The database is registered with the judge, not handed round as a
   context key: it is a lookup table, identical on both peers, and
   `effectsFor` reaches it through `getDb()`. Registering it once here is
   what lets a drill mint a real Runechant instead of reading a refusal. */
let _db = null;
function db(){
  if(_db) return _db;
  _db = C.buildMaps(JSON.parse(fs.readFileSync(CACHE, "utf8"))
    .filter(c => c && c.name).map(C.mapDbCard));
  J.setDb(_db);
  return _db;
}

/* Resolve a deck entry to the card actually played — the same two steps
   everything else in this repo reasons about a card after. */
const card = (nm, p) => C.resolveEntry(db(), {name: nm, p: p == null ? 0 : p, code: null, q: 1});
const tok  = nm => card(nm, 0);

/* A SIDE IS `makeSide`'s SHAPE, never a literal. Each of the five files
   wrote its own partial side object, and a field one of them forgot is a
   field the engine reads as `undefined` — which is `SIDES-ASYMMETRIC` and
   `NAN-FIELD` waiting to happen inside a fixture no invariant sees.

   AN EXPLICIT `undefined` IS DROPPED, not written. `Object.assign` copies
   a key whose value is undefined, so one optional field threaded through
   a caller (`{hist: o.hist}` where the caller passed nothing) silently
   deletes `freshHist()` and the first `hist.atkNames` read throws from
   inside a reducer whose contract is that it never throws. */
const side = (o, id) => {
  const base = S.makeSide({id: id || 0});
  for(const k of Object.keys(o || {})) if(o[k] !== undefined) base[k] = o[k];
  return base;
};

/* A judge-shaped state small enough to say one thing about. It carries
   what `effectsFor` actually reads — `actor`, `builds`, `tokSeq`, `turn`
   — and nothing invented. */
function state(a, b, o){
  o = o || {};
  return {
    sides: [side(a, 0), side(b, 1)],
    actor: o.actor != null ? o.actor : 0,
    turnPlayer: o.turnPlayer != null ? o.turnPlayer : (o.actor != null ? o.actor : 0),
    turn: o.turn != null ? o.turn : 2,
    builds: o.builds || [{}, {}],
    tokSeq: o.tokSeq || 0,
    log: [], feed: [], chain: [], stack: [], promptQ: [],
    rng: o.rng || RNG.make(o.seed || "judged")
  };
}

/* THE ONE WAY INTO THE SEMANTICS. `withEffects` builds judge's context,
   runs the body and writes the uid counter back — drop that write and two
   peers replaying one log mint colliding uids. Every drill goes through
   it so no drill can accidentally hold a context of its own. */
const fx = (g, body) => J.withEffects(g, body);

/* The three shorthands the drills actually reach for. */
const runOps  = (g, ops, src) => fx(g, (f, n) => f.runOps(n, ops, src));
const execute = (g, c, from, idx, o) => fx(g, (f, n) => f.execute(n, c, from, idx, o));

module.exports = { hasDb, db, card, tok, side, state, fx, runOps, execute, RNG, J };
