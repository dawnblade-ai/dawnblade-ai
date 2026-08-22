/* ============================================================
   A DEFENCE REACTION IS NOT DECLARED, IT IS PLAYED — and its
   printed defence still has to reach the wall.

   `blockRx` has been a field on every side since v2.14 and has been
   cleared in judge's `strike` since v2.46. It was never written and
   never read there. So at the table every defence reaction in the
   pool resolved its text, went to the graveyard, and stopped
   exactly nothing: the player spent a card for the half of it that
   was already free.

   THE TRAINER ALWAYS APPLIED IT (`drx`, in its own wall). One board
   had the rule and the other did not — v3.17's shape, and the reason
   that entry says a comment is not a mechanism.

   Asserted on LIFE, driven through the real reducer.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const J = require("../engine/judge.js");
const C = require("../engine/cards.js");
const PR = require("../engine/parser.js");

const CACHE = require("./helpers/extract").cardDbPath();
const skip = !fs.existsSync(CACHE) && "no cached DB";

let _db = null;
const DB = () => _db || (_db = (() => {
  const d = C.buildMaps(JSON.parse(fs.readFileSync(CACHE, "utf8"))
    .filter(c => c && c.name).map(C.mapDbCard));
  J.setDb(d); return d;
})());

const SWING = () => ({name: "Probe Swing", tt: "Generic Action - Attack",
  ty: ["Generic", "Action", "Attack"], tx: "", kw: [],
  power: 6, pitch: 1, cost: 0, def: 0, uid: "atk1", resolved: true});

/* Play an attack from seat 0, then let seat 1 answer with `drCard` in the
   reaction step. Returns the finished state. `answer:false` skips the
   reaction, which is the control. */
function played(drCard, o){
  o = o || {};
  DB();
  let g = J.newMatch({builds: [null, null], names: ["A", "B"],
                      heroKeys: [null, null], seed: "dr-drill"});
  g.sides[0].hand = [SWING()]; g.sides[0].ap = 1; g.sides[0].res = 9;
  g.sides[0].gear = [];
  g.sides[1].hand = drCard ? [drCard] : []; g.sides[1].res = 9;
  g.sides[1].gear = []; g.sides[1].hp = 20;
  g.phase = "action"; g.step = "layer"; g.priority = 0; g.turnPlayer = 0;

  const send = (a, seat) => {
    const r = J.reduce(g, a, seat);
    if(r.error) return false;
    g = r.state; return true;
  };
  assert.ok(send({t: "play", uid: "atk1", from: "hand"}, 0), "the attack must be legal");

  let answered = false;
  for(let i = 0; i < 30 && !g.over && g.step !== "close"; i++){
    if(o.answer !== false && drCard && g.step === "reaction" && g.priority === 1 && !answered){
      answered = send({t: "play", uid: drCard.uid, from: "hand"}, 1);
      if(answered) continue;
    }
    if(g.priority == null) break;
    if(!send({t: "pass"}, g.priority)) break;
  }
  return {g, answered};
}

const sigil = uid => Object.assign({},
  C.resolveEntry(DB(), {name: "Sigil of Suffering", p: 1, code: null, q: 1}), {uid: uid || "dr1"});

/* A PLAIN defence reaction for the plumbing drills: 3 printed defence, no
   self-buff, and a trigger ("when this defends an attack with go again")
   that a plain swing does not fire. Sigil is the wrong fixture for
   measuring the printed number, because its own clause modifies it. */
const plain = uid => Object.assign({},
  C.resolveEntry(DB(), {name: "Frailty Trap", p: 1, code: null, q: 1}), {uid: uid || "dr1"});

/* ---- 1. the fixture is what it claims to be ----------------------- */

test("the fixtures really are defence reactions with printed defence", {skip}, () => {
  for(const c of [sigil(), plain()]){
    assert.equal(PR.isDR(c), true, c.name + ": or this drill measures something else");
    assert.equal(c.def, 3, c.name + " prints 3 defence");
  }
});

/* ---- 2. the control: no reaction, full damage --------------------- */

test("with no answer the attack lands in full", {skip}, () => {
  const {g} = played(null);
  assert.equal(g.sides[1].hp, 14, "6 power into an empty board");
});

/* ---- 3. THE BUG: the printed defence must reach the wall ---------- */

test("a defence reaction played at the table reduces the damage it prints", {skip}, () => {
  const {g, answered} = played(plain());
  assert.equal(answered, true, "it must be legal to play in the reaction step");
  assert.equal(g.sides[1].hp, 17,
    "20 - (6 - 3). Before v3.25 this was 14: the card resolved, went to the "
    + "graveyard, and its printed defence was thrown away.");
});

test("a self-buff on the reaction reaches the wall too (v3.26)", {skip}, () => {
  /* Sigil of Suffering: "Deal 1 arcane damage to the attacking hero. If
     you've dealt arcane damage this turn, this gets +1{d}."

     ASSUMPTION, RECORDED: the card's OWN arcane satisfies its own
     condition. It is dealt while the card resolves, and the defence is
     totalled after that, so by the time the wall asks, arcane HAS been
     dealt this turn. That is what the CR ordering gives and it is what
     the engine does; it also leaves the clause meaningful rather than
     vacuous, because a turn in which the arcane never lands is a turn in
     which it does not apply. Flagged for the user to correct if the
     intent is "arcane dealt BEFORE this card". */
  const {g} = played(sigil());
  assert.equal(g.sides[1].hp, 18, "20 - (6 - (3 printed + 1 from its own clause))");
});

test("and its TEXT still resolves — the ops were never the broken half", {skip}, () => {
  /* "Deal 1 arcane damage to the attacking hero." That always worked; what
     was missing was the number on the card. Pinning both together is what
     keeps a future fix from trading one for the other. */
  const {g} = played(sigil());
  assert.equal(g.sides[0].hp, 19, "the attacker still takes the printed 1 arcane");
});

test("the declaration is spent — blockRx does not survive the link", {skip}, () => {
  /* CR 7.3.2: defenders defend ONE chain link. `blockRx` is cleared in
     `strike` alongside blockH/blockG; a leftover entry would block the
     next link for free, which is the v2.46 bug in a third zone. */
  const {g} = played(plain());
  assert.deepEqual(g.sides[1].blockRx || [], []);
});

/* ---- 4. it is the DEFENDER's card, not the attacker's ------------- */

test("the wall reads blockRx, and commitPlay only records it for the defender", {skip}, () => {
  /* Comments stripped — a grep is satisfied by a comment, in both
     directions. */
  const src = fs.readFileSync(path.join(__dirname, "..", "engine", "judge.js"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  assert.match(src, /for\(const l of \(sd\.blockRx \|\| \[\]\)\)/,
    "judge's wall must sum the defence reactions that answered");
  assert.match(src, /if\(seat !== atkSeat\)/,
    "a defence reaction is the DEFENDER's — CR 8.1.3a");
  assert.match(src, /PR\.isDR\(card\) && n\.pend/,
    "and it defends only against a live attack");
});
