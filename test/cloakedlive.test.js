/* ============================================================
   A FACE-DOWN PIECE'S ABILITIES ARE OFF UNTIL IT IS TURNED UP (v4.94)

   RULING (user, 2026-10-04): "you have to flip cloaked cards using their
   active abilities before you can use their static abilities."

   Uphold Tradition, Enigma's Arms piece, is the pool's only Cloaked card:

     Cloaked (Equip this face-down.)
     Instant - {r}, turn this face-up: Put a +1{p} counter on an aura you
       control with ward.
     Ward 1

   Until v4.94 its Ward 1 prevented damage from the moment it was dealt,
   while it was still face-down. That was `cloaked-face-down-values`, an
   OPEN record waiting on exactly this ruling.

   `parser.abilitiesLive` is the one reader. Every scan that reads a
   static or a trigger off the gear zone asks it, and the census here pins
   that, because eleven scans each wrote `!g.destroyed` by hand and the
   twelfth copy of a two-part test is where one forgets the second part.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const P = require("../engine/parser.js");
const B = require("../engine/build.js");
const G = require("../engine/game.js");
const RNG = require("../engine/rng.js");
const H = require("./helpers/judged.js");
const {loadData} = require("./helpers/extract.js");

const skip = !H.hasDb() && "no cached card database";
const unwrap = o => (o && o.game) || o;
const ROOT = path.join(__dirname, "..");
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

let _ut = null;
/* THE REAL DEAL: `build.js` equips the piece face-down when Enigma is
   dealt, and a fixture that stamps the flag itself has tested the
   fixture (v3.20). */
function upholdAsDealt(){
  if(_ut) return _ut;
  const W = loadData();
  const h = W.HEROES.find(x => x.k === "enigma");
  const b = B.buildSide(h, G.parseDeck(W.DECKS.enigma), H.db(), {},
                        RNG.make("cloaklive"), {n: 0}).b;
  _ut = b.gear.find(g => g.name === "Uphold Tradition");
  return _ut;
}

test("dealt face-down, its Ward is not a ward bearer; turned up, it is", {skip}, () => {
  const down = upholdAsDealt();
  assert.equal(down._faceDown, true, "premise: build equips it face-down");
  assert.equal(P.wardValue(down), 1, "premise: it prints Ward 1");
  const sdDown = {gear: [down], board: []};
  assert.deepEqual(P.wardBearers(sdDown), [], "a face-down piece's Ward is OFF");
  assert.equal(P.wardTotal(sdDown), 0, "and the number on screen agrees");
  const up = Object.assign({}, down, {_faceDown: false});
  const sdUp = {gear: [up], board: []};
  assert.deepEqual(P.wardBearers(sdUp).map(x => x.uid), [up.uid], "face-up, it is live");
  assert.equal(P.wardTotal(sdUp), 1);
});

test("DRIVEN: damage goes straight through a face-down Uphold, and is soaked once it is up", {skip}, () => {
  const down = upholdAsDealt();
  const hit = faceDown => {
    const ut = Object.assign({}, down, {_faceDown: faceDown});
    const g = H.state({name: "Alice", res: 5, ap: 1}, {name: "Bob", hp: 20, gear: [ut]},
                      {turn: 3, turnPlayer: 0, actor: 0});
    g.builds = [{}, {}];
    const out = unwrap(H.runOps(g, [["dmg", 2]], "Test Hit"));
    return out.sides[1];
  };
  const sDown = hit(true), sUp = hit(false);
  assert.equal(sDown.hp, 18, "face-down: the whole 2 lands");
  assert.ok(!(sDown.gear || []).some(x => x.destroyed), "and the piece is not spent");
  assert.equal(sUp.hp, 19, "face-up: Ward 1 soaks one");
});

test("DRIVEN: the flip is what turns it on — execute, then the Ward is live", {skip}, () => {
  const ut = Object.assign({}, upholdAsDealt());
  const shield = {uid: "sh9", kind: "aura", spent: false,
    card: {name: "Spectral Shield", uid: "sh9", tt: "Illusionist Token - Aura",
           ty: ["Illusionist", "Token", "Aura"], tx: "**Ward 1**", kw: ["Ward 1"]}};
  let g = H.state({name: "Alice", res: 5, ap: 1, gear: [ut], board: [shield]},
                  {name: "Bob", hp: 20}, {turn: 3, turnPlayer: 0});
  g.builds = [{}, {}];
  const gearUids = sd => P.wardBearers(sd).filter(x => x.where === "gear").map(x => x.uid);
  assert.deepEqual(gearUids(g.sides[0]), [], "before the flip, no gear ward");
  g = unwrap(H.execute(g, ut.powCard, "gear", 0, {}));
  assert.deepEqual(gearUids(g.sides[0]), [ut.uid], "after the flip, Uphold's Ward 1 is live");
});

test("the reader: destroyed and face-down are both off, and a board entry is read through its card", () => {
  assert.equal(P.abilitiesLive(null), false);
  assert.equal(P.abilitiesLive({name: "X"}), true);
  assert.equal(P.abilitiesLive({name: "X", destroyed: true}), false);
  assert.equal(P.abilitiesLive({name: "X", _faceDown: true}), false);
  assert.equal(P.abilitiesLive({uid: 1, card: {name: "Y"}}), true);
  assert.equal(P.abilitiesLive({uid: 1, card: {name: "Y", _faceDown: true}}), false,
    "a board entry wraps its card, and the card's flag is what counts");
});

test("SYNTHETIC: a face-down arcane barrier soaks nothing; turned up, it is offered", () => {
  /* The pool's one Cloaked record prints Ward and nothing else, so every
     other static reader is LATENT here — a synthetic is what reaches it
     (v3.73). */
  const piece = {uid: 77, name: "Hidden Barrier Test", tt: "Generic Equipment - Head",
                 ty: ["Generic", "Equipment", "Head"], tx: "**Arcane Barrier 2**",
                 kw: ["Arcane Barrier 2"], def: 0};
  const down = P.arcaneSoaks({gear: [Object.assign({}, piece, {_faceDown: true})], res: 5}, {});
  const up = P.arcaneSoaks({gear: [piece], res: 5}, {});
  assert.ok(up.some(x => x.uid === 77), "control: face-up, the barrier is offered");
  assert.ok(!down.some(x => x.uid === 77), "face-down, it is not");
});

/* ------------------------------------------------------------------
   THE CENSUS — every gear scan that reads a printed static or trigger
   asks the one reader. A hand-rolled `!x.destroyed` beside one of those
   reads is the shape this version retired.
   ------------------------------------------------------------------ */
test("every static and trigger scan of the gear zone asks abilitiesLive", () => {
  const par = strip(fs.readFileSync(path.join(ROOT, "engine/parser.js"), "utf8"));
  const eff = strip(fs.readFileSync(path.join(ROOT, "engine/effects.js"), "utf8"));
  const body = (src, name) => {
    const m = new RegExp("\\n( *)(?:function|const) " + name + "\\b").exec(src);
    assert.ok(m, name + " not found");
    /* bounded at the next declaration AT THE SAME INDENT (v4.05) — a
       nested `const` inside the body is not the end of it */
    const rest = src.slice(m.index + 1);
    const j = rest.slice(1).search(new RegExp("\\n" + m[1] + "(?:function|const) "));
    return rest.slice(0, j < 0 ? undefined : j + 1);
  };
  for(const f of ["wardBearers", "auraAttackOf", "arcaneSoaks", "gyFirstGaKw",
                  "idleCounterWipes", "rustedThrough"])
    assert.match(body(par, f), /abilitiesLive\b/, "parser." + f + " no longer asks the reader");
  for(const f of ["offerPayCost", "ctrClock", "tieGrantOf"])
    assert.match(body(eff, f), /abilitiesLive/, "effects." + f + " no longer asks the reader");
  /* the two watcher scans that are not their own function, pinned by their read */
  assert.match(eff, /filter\(P\.abilitiesLive\)\s*\n\s*\.map\(w => \(\{w, hw: fxParse\(w\)\.hitWatch\}\)\)/,
    "the hit watcher scan no longer asks the reader");
  assert.match(eff, /const watchers = \[\.\.\.\(act\(n\)\.gear\|\|\[\]\)\.filter\(P\.abilitiesLive\),/,
    "the from-deck arsenal watcher scan no longer asks the reader");
  assert.match(eff, /\.\.\.\(sd\.gear \|\| \[\]\)\.filter\(P\.abilitiesLive\)\];/,
    "the teardown re-derivation (stillGrants) no longer asks the reader");
});

test("PREMISE: every Cloaked pool record prints no defence and its only activation flips it", {skip}, () => {
  /* What the ruling does NOT decide is whether a face-down piece keeps a
     printed DEFENCE. It is moot while no Cloaked record prints one, and
     this fails the day one arrives, so the question is asked then. */
  const pool = JSON.parse(fs.readFileSync(path.join(ROOT, "data/pool.json"), "utf8"));
  const recs = (Array.isArray(pool) ? pool : (pool.cards || Object.values(pool)))
    .filter(c => /\*\*Cloaked\*\*/.test(c.functional_text || ""));
  assert.ok(recs.length >= 1, "the scan found no Cloaked record — it stopped matching");
  for(const c of recs){
    assert.ok(c.defense === "" || c.defense == null, c.name + " prints a defence — decide it");
    const acts = (c.functional_text || "").split(/\n+/).filter(l => /^\*\*(?:Action|Instant)\*\* -/.test(l));
    assert.ok(acts.length >= 1 && acts.every(l => /turn this face-up/.test(l)),
      c.name + " prints an activation that does not flip it — decide whether it is usable face-down");
  }
});
