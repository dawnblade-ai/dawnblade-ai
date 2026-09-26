/* ============================================================
   PLASMA BARREL SHOT'S STEAM LINE, READ (v4.63)

     Action - {r}{r}: If this has no steam counters, put a steam counter
     on it. Go again                          — PLASMA BARREL SHOT, Dash's

   For fourteen versions `build.equipPiece` wrote this ability BY HAND —
   "Action - {r}{r}: Put a steam counter on this. Go again.", cost 2, a
   `_buildSteam` stamp — because `classifyClause` answered null for the
   whole line and for each half. The paraphrase dropped the printed gate
   and `effects.js` re-imposed it off the stamp: two records of one
   printed condition (v3.61), and v3.58's inline-reader shape.

   THREE READERS, AS `tools/approx.js` NAMED THEM:
     1. a whole-clause rule — "if this has no <K> counters, put a <K>
        counter on it" — read WHOLE, because the if/when handler splits on
        the first comma and hands "on IT" over with no antecedent;
     2. `parseHeroPower`'s fourth NAMED conditional shape;
     3. `equipPiece` handing a weapon's non-attack line to the builder.

   AND RETIRING THE STAMP FOUND A ONE-BOARD RULE. v4.49 put the paid-no-op
   refusal in `judge.abCostWhy`; the trainer's `tryPlay` never asked, so a
   second activation there charged {r}{r} for a log line. Both boards ask
   `parser.abCtrGateFails` now.

   ASSERT ON COUNTERS, POINTS AND RESOURCES — NEVER ON FEED PROSE, except
   where the feed IS the observable (the refusal's reason).
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const H = require("./helpers/judged.js");
const P = require("../engine/parser.js");
const B = require("../engine/build.js");
const J = require("../engine/judge.js");

const skip = !H.hasDb() && "no cached DB";
const HTML = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

const LINE = "Action - {r}{r}: If this has no steam counters, put a steam counter on it. Go again";

const gun = () => { H.db(); P.fxReset();
  const gr = {...H.card("Plasma Barrel Shot", 0), uid: 41};
  B.equipPiece(gr); return gr; };
const seat = (ctrs, over) => {
  const gr = gun();
  return {gr, g: {...H.state({res: 20, ap: 9, gear: [gr], counters: ctrs || {}}, {},
                             {turn: 3, actor: 0, turnPlayer: 0}),
                  stack: [], chain: [], boostChain: 0,
                  phase: "action", step: "layer", priority: 0, passed: [], ...(over || {})}};
};

/* ---- 1. THE READER --------------------------------------------------- */

test("the sentence reads WHOLE — a gate and an op on the same object", () => {
  assert.deepEqual(P.classifyClause("If this has no steam counters, put a steam counter on it"),
    {status: "run", ops: [["ctrSrc", {kind: "steam", n: 1, label: "steam"}]], cond: "noCtr:steam"});
  /* "on this" is the same object and reads the same. */
  assert.deepEqual(P.classifyClause("If this has no steam counters, put a steam counter on this").ops,
    [["ctrSrc", {kind: "steam", n: 1, label: "steam"}]]);
});

test("BOTH numbers and BOTH kinds come off the line — a synthetic proves it", () => {
  /* THE ONE POOL RECORD PRINTS "a" AND "steam" TWICE, so a hardcoded 1 or a
     gate that copied the put's kind would be SILENT against it (v3.32). */
  const r = P.classifyClause("If this has no aim counters, put two +1{p} counters on it");
  assert.equal(r.cond, "noCtr:aim", "the GATE's kind is its own");
  assert.deepEqual(r.ops, [["ctrSrc", {kind: "pow", n: 2, label: "+1{p}"}]],
    "and the put's kind and count are read, in the bag's vocabulary");
});

test("an unknown kind REFUSES — the vocabulary is closed in the GUARD", () => {
  /* A counter nothing consumes is a no-op wearing a number (v3.55), and a
     match-then-refuse would steal the clause from a reader further down
     (v3.57) — so the kind is tested in the guard and the clause falls
     through to refuse. */
  assert.equal(P.classifyClause("If this has no moon counters, put a moon counter on it"), null);
  assert.equal(P.classifyClause("If this has no steam counters, put a moon counter on it"), null);
});

test("the PRONOUN ALONE refuses — its antecedent is what the gate supplies", () => {
  /* THE POOL PRINTS "on it" MEANING THREE OTHER OBJECTS — Crow's Nest's
     arrow, Spectral Manifestations' token, Edict of Steel's sword — so a
     bare reading would guess. v2.33's Bull's Eye Bracers trap. */
  for(const t of ["put a steam counter on it", "put a steam counter on this",
                  "If that has no steam counters, put a steam counter on it"])
    assert.equal(P.classifyClause(t), null, "must not be read: " + t);
});

test("parseHeroPower answers the line as a FOURTH named shape, and no wider", () => {
  const pw = P.parseHeroPower(LINE, true);
  assert.ok(pw, "the line is read");
  assert.equal(pw.cost, 2, "{r}{r}");
  assert.equal(pw.ga, true, "the go again is the ABILITY's keyword");
  assert.equal(pw.kind, "action");
  /* THE CONTROL — the ordinary guard still refuses an unrelated
     conditional ability, so the shape was NAMED, not the guard relaxed. */
  assert.equal(P.parseHeroPower("Action - {r}: If you have 3 or more auras, draw a card.", true), null,
    "a different conditional payload is still refused");
});

/* ---- 2. THE BUILDER -------------------------------------------------- */

test("the powCard is the ordinary builder's, off the PRINTED line", {skip}, () => {
  const gr = gun();
  assert.ok(gr.pow && gr.powCard, "the piece has its ability");
  assert.equal(gr.powCard.uid, "gp41", "keyed gp+uid — the ability's own route");
  assert.equal(gr.powCard.cost, 2);
  assert.deepEqual(gr.powCard.kw, ["Go again"]);
  assert.equal(gr.powCard.tx, "If this has no steam counters, put a steam counter on it. Go again");
  assert.equal(gr.powCard._buildSteam, undefined, "no stamp");
  assert.equal(gr.powCard._steamFor, undefined, "and no second record of the piece");
  /* THE SWING IS UNTOUCHED — still the bare uid, still a steam cost. */
  assert.equal(gr.needSteam, true);
  assert.equal(gr.cost, 0);
});

test("exactly ONE weapon has a non-attack line, so the door is exactly one card wide", {skip}, () => {
  /* THE MEASUREMENT THE DOOR RESTS ON — a weapon whose activation lines
     include one whose payload is not a bare Attack. A second arriving is a
     deliberate edit, not a quiet new button (v2.34's reason for `_armed`). */
  const pool = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "pool.json"), "utf8"));
  const C = require("../engine/cards.js");
  const hit = [];
  for(const r of pool){
    const m = C.mapDbCard(r);
    const c = {name: m.n, pitch: m.p, cost: m.c, power: m.pw, def: m.d, tt: m.tt,
               ty: m.ty, kw: m.kw, gkw: m.gkw, tx: m.tx};
    if(!P.isWeapon(c)) continue;
    const lines = (c.tx || "").split(/\n+/).map(l => P.clean(l));
    if(lines.some(l => /^(?:once per turn )?(?:attack reaction|action|instant)\s*[-—]/i.test(l)
                       && !/:\s*attack\b/i.test(l))) hit.push(c.name);
  }
  assert.deepEqual([...new Set(hit)], ["Plasma Barrel Shot"]);
});

/* ---- 3. DRIVEN, THROUGH THE REAL REDUCER ----------------------------- */

test("the first activation puts the counter on the GUN and keeps the point", {skip}, () => {
  const {g} = seat({});
  const out = J.reduce(g, {t: "activate", uid: "gp41"}, 0);
  assert.ok(!out.error, "legal: " + out.error);
  const s0 = out.state.sides[0];
  assert.equal(((s0.counters || {})[41] || {}).steam, 1, "on the piece, keyed by its uid");
  assert.equal((s0.counters || {}).gp41, undefined, "never on the powCard's uid");
  /* GO AGAIN IS A GAIN (CR 5.3.5): spend one, gain one. */
  assert.equal(s0.ap, 9, "the action point comes back");
  /* {r}{r} paid out of the pool. */
  assert.equal(s0.res, 18, "two resources spent");
});

test("a second activation is REFUSED before it is paid, at the table", {skip}, () => {
  const {g} = seat({41: {steam: 1}});
  const out = J.reduce(g, {t: "activate", uid: "gp41"}, 0);
  assert.ok(out.error, "refused");
  assert.match(out.error, /already carries a steam counter/);
  /* THE CONTROL: the same state with the counter spent is legal — a
     refusal that fires regardless passes the half above perfectly. */
  assert.ok(!J.reduce(seat({41: {steam: 0}}).g, {t: "activate", uid: "gp41"}, 0).error,
    "a spent counter lets it build again");
});

test("off a wire, past the legality, the gate still holds at RESOLUTION", {skip}, () => {
  /* `reduce` is fed by JSON off a wire (v2.04), so the condition loop is
     the second guard and must honour the printed gate on its own. */
  const {g, gr} = seat({41: {steam: 1}});
  const out = H.execute(g, gr.powCard, "hero", 0, {});
  assert.equal(((out.sides[0].counters || {})[41] || {}).steam, 1, "no second counter");
  assert.ok((out.feed || []).some(l => /already carries a steam counter/.test(l)),
    "and the feed says why, in the counter's printed name");
});

test("`ctrSrc` with no resolving card refuses rather than guessing", {skip}, () => {
  /* Only `execute` hands `runOps` the card. A rider, a leave payout or an
     attack's ops riding to resolution pass nothing, and "it" cannot be
     guessed from a name. */
  const {g} = seat({});
  const out = H.runOps(g, [["ctrSrc", {kind: "steam", n: 1, label: "steam"}]], "Somebody");
  assert.deepEqual(out.sides[0].counters || {}, {}, "no counter anywhere");
});

/* ---- 4. THE READERS -------------------------------------------------- */

test("`abSourceUid` finds the piece the way `execute` matches it", () => {
  const sd = {gear: [{uid: 41}], board: [{uid: 7, card: {}}]};
  assert.equal(P.abSourceUid(sd, {uid: "gp41"}), 41, "gear, by `gp`+uid — a NUMBER back");
  assert.equal(P.abSourceUid(sd, {uid: "bp7"}), 7, "board, by `bp`+uid");
  assert.equal(P.abSourceUid(sd, {uid: "gp99"}), null, "a piece that is gone answers null");
  assert.equal(P.abSourceUid(sd, {uid: 12}), 12, "anything else asks about itself");
  assert.equal(P.abSourceUid(sd, null), null);
});

test("`abCtrGateFails` names the printed kind, and only when EVERY gate fails", {skip}, () => {
  const {gr} = seat({});
  const sd = c => ({gear: [gr], counters: c});
  assert.equal(P.abCtrGateFails(sd({41: {steam: 1}}), gr.powCard), "steam");
  assert.equal(P.abCtrGateFails(sd({41: {steam: 0}}), gr.powCard), null);
  assert.equal(P.abCtrGateFails(sd({}), gr.powCard), null);
  /* An ability with an UNCONDITIONAL payload is never a no-op here. */
  const pot = {name: "SYN-POTION", pitch: 0, cost: 0, tt: "Equipment Ability", kw: [],
               tx: "Gain {r}{r}.", uid: "gp41"};
  assert.equal(P.abCtrGateFails(sd({41: {steam: 1}}), pot), null);
  /* A nameless ability is the memo key missing — it answers, never throws,
     because `judge.legal` reaches this off a wire. */
  assert.equal(P.abCtrGateFails(sd({}), {uid: "gp41"}), null);
  /* The label is the PRINTED spelling, not the bag key. */
  assert.equal(P.ctrLabel("pow"), "+1{p}");
  assert.equal(P.ctrLabel("steam"), "steam");
});

/* ---- 5. THE TRAINER ASKS THE SAME QUESTION -------------------------- */

test("the trainer's `tryPlay` refuses the paid no-op too", () => {
  /* A SOURCE SCAN CANNOT TELL A LIVE CHECK FROM A NEUTERED ONE (v4.00), so
     the WHOLE conditional is pinned, opening paren included (v4.55) — an
     `if(… && false)` fails it. The live property is judge's, driven above;
     this pins that the trainer did not quietly go back to asking nothing. */
  const i = HTML.indexOf("const tryPlay = (card,from,idx,half)");
  const j = HTML.indexOf("const confirmPay = () => setG");
  assert.ok(i > 0 && j > i, "tryPlay is bounded");
  const body = HTML.slice(i, j);
  assert.ok(body.includes("{ const _cg = DawnParser.abCtrGateFails(act(s), card);\n"
                        + "      if(_cg) return L(s, "),
    "tryPlay asks `abCtrGateFails` of the ACTING side and returns on it");
});

/* ---- 6. WHAT THE FIRST SABOTAGE PASS FOUND ---------------------------
   Four came back SILENT and three were fixtures that could not express
   the bug (v3.62): the one pool record puts ONE counter on an EMPTY bag
   behind ONE gate with NO other payload, so "set" and "add" agree, "any
   gate held" and "every gate held" agree, and an unconditional op is never
   there to be ignored. Synthetics are what see them (v3.73). The fourth
   was a guard that could not refuse anything and is deleted, with its
   premise pinned here instead (v4.11). */

const synth = (tx, nm) => { P.fxReset();
  return {name: nm, pitch: 0, cost: 0, power: null, def: null,
          tt: "Equipment Ability", kw: [], tx, uid: "gp41"}; };

test("the counter is ADDED to what the piece already holds", {skip}, () => {
  /* a gate on one kind, a put of another, so the put lands on a bag that
     already carries some of it */
  const {g} = seat({41: {steam: 2}});
  const out = H.fx(g, (f, n) => f.runOps(n, [["ctrSrc", {kind: "steam", n: 1, label: "steam"}]],
                                          "SYN", {uid: "gp41"}));
  assert.equal(out.sides[0].counters[41].steam, 3, "two plus one, never reset to one");
});

test("the refusal needs EVERY gate held — one live gate is still a play", {skip}, () => {
  const {gr} = seat({});
  const ab = synth("If this has no steam counters, put a steam counter on it. "
                 + "If this has no aim counters, put an aim counter on it.", "SYN-TWO-GATES");
  assert.equal(P.fxParse(ab).conds.length, 2, "fixture: two gated puts");
  assert.equal(P.abCtrGateFails({gear: [gr], counters: {41: {steam: 1}}}, ab), null,
    "the aim half still does something");
  assert.equal(P.abCtrGateFails({gear: [gr], counters: {41: {steam: 1, aim: 1}}}, ab), "steam",
    "both held — nothing left to do");
});

test("an unconditional op beside the gate is never a no-op", {skip}, () => {
  const {gr} = seat({});
  const ab = synth("If this has no steam counters, put a steam counter on it. Draw a card.",
                   "SYN-GATE-AND-DRAW");
  const fx = P.fxParse(ab);
  assert.ok(fx.conds.length === 1 && fx.ops.some(o => o[0] === "draw"), "fixture: a gate and a draw");
  assert.equal(P.abCtrGateFails({gear: [gr], counters: {41: {steam: 1}}}, ab), null,
    "the draw still happens, so the play is not refused");
});

test("PREMISE: every `ctrSrc` the pool emits rides behind a `noCtr:` gate", {skip}, () => {
  /* WHY `parseHeroPower`'s named shape does not test the gate itself. Walk
     every record AND every powCard the equipment builder makes — the steam
     line lives only on the powCard, which the card's own parse files as a
     `noop` (the powCard is its reader). */
  const pool = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "pool.json"), "utf8"));
  const C = require("../engine/cards.js");
  const seen = [];
  const walk = (fx, who) => {
    for(const o of fx.ops || []) if(o[0] === "ctrSrc") seen.push(who + " UNGATED");
    for(const c of fx.conds || []) if(c.op && c.op[0] === "ctrSrc")
      seen.push(who + (/^noCtr:/.test(c.cond) ? "" : " gate:" + c.cond));
  };
  let n = 0;
  for(const r of pool){
    const m = C.mapDbCard(r);
    const c = {name: m.n, pitch: m.p, cost: m.c, power: m.pw, def: m.d, tt: m.tt,
               ty: m.ty, kw: m.kw, gkw: m.gkw, tx: m.tx};
    P.fxReset(); walk(P.fxParse(c), c.name);
    const gr = {...c, uid: 700000 + n++};
    try { B.equipPiece(gr); } catch(e){}
    if(gr.powCard){ P.fxReset(); walk(P.fxParse(gr.powCard), gr.powCard.name); }
  }
  assert.deepEqual([...new Set(seen)], ["Plasma Barrel Shot — ability"],
    "a `ctrSrc` emitter arrived, or one lost its gate — re-read the named shape's door");
});
