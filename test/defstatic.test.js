/* ============================================================
   A DEFENDER IS WORTH ITS PRINTED NUMBER PLUS WHAT MODIFIES IT

   Both walls read `c.def || 0` — the printed value — so a card whose
   defence is changed while it defends blocked for the wrong number on
   BOTH boards. Briar's Embodiment of Earth prints

     "Non-attack action cards you control get +1{d} while defending."

   and did nothing at all.

   `effects.defendValue` is the one body. The WALL stays the caller's —
   the trainer holds defenders on the hand, judge on `blockH` — which is
   the split `linkPumps`/`linkPayload` already keep; what a single card
   is WORTH is card semantics and belongs in one place, or the two
   boards disagree about the number.

   THE SUBJECT IS READ OFF THE STRUCTURED TYPE ARRAY. "Reaction"
   contains the substring "action", and the database's display string
   contradicts its own array on five records.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const E = require("../engine/effects.js");
const P = require("../engine/parser.js");

const CACHE = require("./helpers/extract").cardDbPath();
const skip = !fs.existsSync(CACHE) && "no cached DB";

const rec = nm => JSON.parse(fs.readFileSync(CACHE, "utf8")).find(c => c.name === nm);
const earth = uid => { const r = rec("Embodiment of Earth"); return {
  card: {name: r.name, tt: r.type_text, ty: r.types,
         tx: (r.functional_text || "").replace(/\*\*/g, ""), uid}, kind: "aura", uid}; };

const nonAtk = {name: "Blue Blocker",   ty: ["Runeblade", "Action"],            tt: "Runeblade Action",            def: 3, uid: "b1"};
const atkCrd = {name: "Attack Blocker", ty: ["Generic", "Action", "Attack"],    tt: "Generic Action - Attack",     def: 3, uid: "b2"};
const defRx  = {name: "Trap Blocker",   ty: ["Runeblade", "Defense Reaction"],  tt: "Runeblade Defense Reaction",  def: 3, uid: "b3"};

/* ---- 1. the clause is read, and claims nothing else --------------- */

test("Embodiment of Earth's static is read off its printed line", {skip}, () => {
  P.fxReset();
  const r = rec("Embodiment of Earth");
  const fx = P.fxParse({name: r.name, pitch: 0, tt: r.type_text, ty: r.types, kw: [],
                        tx: (r.functional_text || "").replace(/\*\*/g, "")});
  assert.deepEqual(fx.defGrant, {amt: 1, subject: "nonAttackAction"});
});

test("it is the ONLY card in the pool that grants one, and the self-buffs are not claimed", {skip}, () => {
  /* The pool prints a whole family of DEFENSIVE buffs — Blade Beckoner's
     "this gets +1{d} while defending a weapon attack", Big Blue Sky,
     Sigil of Suffering, Springboard Somersault. Every one of those buffs
     ITSELF under its own condition, which is a different shape, and
     claiming them here would grant conditions nobody has built. This
     reader takes only the one that buffs OTHER cards. */
  const pool = JSON.parse(fs.readFileSync(CACHE, "utf8"));
  const claimed = [];
  for(const c of pool){
    P.fxReset();
    const fx = P.fxParse({name: c.name, pitch: +(c.pitch || 0), tt: c.type_text,
      ty: c.types, kw: c.card_keywords || [],
      tx: (c.functional_text || "").replace(/\*\*/g, "")});
    if(fx.defGrant) claimed.push(c.name);
  }
  assert.deepEqual([...new Set(claimed)], ["Embodiment of Earth"]);
});

/* ---- 2. who it applies to, and who it must not ------------------- */

test("a non-attack action card gets the buff", {skip}, () => {
  P.fxReset();
  assert.equal(E.defendValue({board: []}, nonAtk), 3, "printed, with no aura out");
  assert.equal(E.defendValue({board: [earth("e1")]}, nonAtk), 4);
});

test("an ATTACK action card does not — it carries Attack as well as Action", {skip}, () => {
  P.fxReset();
  assert.equal(E.defendValue({board: [earth("e1")]}, atkCrd), 3,
    "the printed word is 'non-attack'; buffing it blocks more than the card grants");
});

test("a DEFENCE REACTION does not — a reaction is not an action card", {skip}, () => {
  P.fxReset();
  assert.equal(E.defendValue({board: [earth("e1")]}, defRx), 3,
    "'Reaction' contains the substring 'action' — a loose tt test hands it a buff it never got");
});

test("two Embodiments stack", {skip}, () => {
  P.fxReset();
  assert.equal(E.defendValue({board: [earth("e1"), earth("e2")]}, nonAtk), 5);
});

test("only the DEFENDER's own board is consulted — the phrase is 'cards you control'", {skip}, () => {
  P.fxReset();
  assert.equal(E.defendValue({board: []}, nonAtk), 3,
    "an aura on the other seat's board is not on this side's, and defendValue is handed one side");
});

test("a card printing no defence is still 0, not NaN", {skip}, () => {
  P.fxReset();
  const noDef = {name: "Powerless", ty: ["Runeblade", "Action"], tt: "Runeblade Action", uid: "n1"};
  const v = E.defendValue({board: [earth("e1")]}, noDef);
  assert.equal(Number.isFinite(v), true);
  assert.equal(v, 1, "0 printed + the aura's 1");
});

/* ---- 3. ONE BODY, BOTH WALLS ------------------------------------- */

test("both walls ask defendValue rather than reading the printed number", {skip}, () => {
  /* This is the property that makes it one engine. A wall that drifts back
     to `c.def` is a board where the aura silently does nothing — which is
     exactly the state this version found. Comments are stripped: a grep is
     satisfied by a comment, in both directions. */
  const strip = f => fs.readFileSync(path.join(__dirname, "..", "engine", f), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  const eff = strip("effects.js"), jud = strip("judge.js");

  assert.match(eff, /defendValue\(foe\(n\), c\)/, "the trainer's wall must ask");
  assert.match(jud, /E\.defendValue\(sd, c\)/, "and judge's wall must ask");

  /* and neither may go back to summing the printed value into the wall */
  assert.doesNotMatch(eff, /wall \+= \(c\.def/, "the trainer's wall must not read the printed number");
  assert.doesNotMatch(jud, /wall \+= \(c\.def/, "judge's wall must not read the printed number");
});
