/* ============================================================
   THREE FEED LINES THAT READ WRONG TO A PLAYER (v5.08)

   Found by READING self-play feeds line by line (v5.00's method):

     "Static Shock: the granted on-hit bonus needed `playedCls:lightning`
      — condition not met."
     "Frost Spike: Boltyn has no exposed armour zone — the frostbite has
      nowhere to land, and fizzles."
     "Frostbite created on Boltyn's board — …"     (Iyslander's trigger)
     "The rite empowers this swing — go again."   (Agility, on Boltyn)

   The first is an engine name in the feed: the hit-time evaluator kept a
   SECOND phrase list (v3.96's smaller copy of the vocabulary) whose
   fallback was the identifier, and it had drifted from the main loop's
   twice. The second pair read as the feed contradicting itself, because
   the token line named no SOURCE. The third narrated Viserai's flavour for
   every next-attack go again.

   `condWhy` is the one body for "condition not met (…)" at both
   evaluators, `wayWhy` the one body for an unmet "…this way" gate, the
   token line leads with its source, and the go-again lines name the
   source, the seat and the card that spends it.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../engine/parser");
const J = require("../engine/judge");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached DB — run: node tools/audit.js";
const said = g => (g.feed || []).map(f => typeof f === "string" ? f : (f && f.t) || "");
const unwrap = o => (o && o.game) || o;

/* A REAL PLAY, then a real hit, at seat 0 named `me` */
function hit(nm, pitch, o){
  o = o || {};
  P.fxReset();
  const c = Object.assign(H.card(nm, pitch), {uid: "atk1"});
  const g = H.state(Object.assign({name: o.me || "Briar", hand: [c], res: 9, ap: 1}, o.self || {}),
                    {name: "Bob", hp: 20}, {turn: 3, turnPlayer: 0});
  g.builds = [{}, {}];
  const out = unwrap(H.execute(Object.assign({}, g, {phase: "action", step: "layer", chain: []}), c, "hand", 0, {}));
  assert.ok(out.pend, nm + " opened a link");
  return unwrap(H.fx(out, (fx, m) => {
    const r = fx.linkPayload(m, {total: m.pend.total, pumps: 0, heroHit: true});
    return r.game || r;
  }));
}

test("STATIC SHOCK: the hit-time refusal names the missing card in words, never `playedCls:`", {skip}, () => {
  H.db();
  const off = hit("Static Shock", 1);
  const line = said(off).find(l => /Static Shock: the granted on-hit bonus/.test(l)) || "";
  assert.equal(line, "Static Shock: the granted on-hit bonus — condition not met (no Lightning card played this turn).");
  assert.ok(!said(off).some(l => /playedCls|`/.test(l)), "an engine name reached the feed");
  /* CONTROL: a Lightning card played this turn, and the arcane lands */
  const on = hit("Static Shock", 1, {self: {hist: {playTy: [["lightning", "action"]]}}});
  /* `linkPayload` is handed damage the board has ALREADY subtracted, so
     what comes back is the rider's 1 arcane alone */
  assert.equal(on.sides[1].hp, 19, "the gate is met, so the rider fires");
  assert.equal(off.sides[1].hp, 20, "…and with it unmet, nothing does");
  assert.ok(!said(on).some(l => /condition not met/.test(l)));
});

test("THE CENSUS: every condition the pool emits gets WORDS from `condWhy`, at both sites", {skip}, () => {
  /* Walked through the WHOLE parse — a rider carries conditions too (v4.51),
     which is how a granted `way:took` reached the hit-time refusal with no
     words. A condition whose refusal is printed somewhere else is pinned as a
     SET with that reason, so `condWhy` is never a second record of it. */
  H.db();
  const conds = new Set(), seen = new Set();
  const walk = (o, d) => {
    if(!o || typeof o !== "object" || d > 8) return;
    if(Array.isArray(o)){ o.forEach(x => walk(x, d + 1)); return; }
    if(typeof o.cond === "string") conds.add(o.cond);
    for(const k in o) walk(o[k], d + 1);
  };
  for(const r of require("../data/pool.json")) for(const p of [0, 1, 2, 3]){
    let c; try { c = H.card(r.name, p); } catch(e){ continue; }
    if(!c || !c.name || seen.has(c.name + "|" + c.pitch)) continue;
    seen.add(c.name + "|" + c.pitch);
    walk(P.fxParse(c), 0);
  }
  assert.ok(conds.size > 40, "the walk found " + conds.size + " conditions — it is aimed wrong");
  /* settled in `linkPumps` with lines of their own (LATE_CONDS), and the
     graveyard-check line `discard6` prints in the main loop */
  const ELSEWHERE = ["chainLinkGe4", "defLt2", "defLt2any", "discard6", "hasGa", "pumped"];
  const raw = [];
  J.withEffects(H.state({name: "Alice"}, {name: "Bob"}), (fx, n) => {
    for(const c of conds) for(const atHit of [false, true]){
      if(ELSEWHERE.indexOf(c) >= 0 && !(c === "pumped" && atHit)) continue;
      const w = fx.condWhy(n, c, [], atHit);
      if(!/\s/.test(w) || w === c || /`|:[a-z]/.test(w)) raw.push(c + (atHit ? " @hit" : "") + " -> " + w);
    }
    return n;
  });
  assert.deepEqual(raw, [], "an engine name would reach the feed");
  /* AND THE EXCLUSION IS PINNED BOTH WAYS: each really is emitted, and each
     really is answered without words here — so the day `condWhy` learns one,
     or one stops being emitted, the set is edited on purpose */
  J.withEffects(H.state({name: "Alice"}, {name: "Bob"}), (fx, n) => {
    for(const c of ELSEWHERE){
      assert.ok(conds.has(c), c + " is no longer emitted");
      assert.equal(fx.condWhy(n, c, [], false), c, c + " now has words — move it out of ELSEWHERE");
    }
    return n;
  });
});

test("A `way:` GATE IS WORDED BY ONE BODY, at either evaluator and in the late pass", {skip}, () => {
  H.db();
  J.withEffects(H.state({name: "Alice"}, {name: "Bob"}), (fx, n) => {
    assert.equal(fx.condWhy(n, "way:took", [], true), "nothing was taken this way — that zone was empty");
    assert.equal(fx.condWhy(n, "way:took", [], false), "nothing was taken this way — that zone was empty",
      "the main loop asks the same body");
    assert.equal(fx.condWhy(n, "way:discardPitch2", [], true), "no yellow card was discarded this way");
    assert.equal(fx.condWhy(n, "way:somethingNew", [], true), "nothing matching happened this way",
      "an unknown `way:` gate still reads as words");
    return n;
  });
});

test("THE SEAT, NOT 'YOUR': a board or zone phrase names whose it is", {skip}, () => {
  H.db();
  J.withEffects(H.state({name: "Alice"}, {name: "Bob"}), (fx, n) => {
    assert.equal(fx.condWhy(n, "auras3", [], false), "fewer than 3 auras on Alice's board");
    assert.equal(fx.condWhy(n, "pitchBlue1", [], false), "no blue card in Alice's pitch zone",
      "one is 'no', never 'fewer than 1 … cards'");
    assert.equal(fx.condWhy(n, "pitchBlue2", [], false), "fewer than 2 blue cards in Alice's pitch zone");
    return n;
  });
  /* seat 0 is literally named "You" on the trainer, and possesses as "your" */
  J.withEffects(H.state({name: "You"}, {name: "Bob"}), (fx, n) => {
    assert.equal(fx.condWhy(n, "auras3", [], false), "fewer than 3 auras on your board");
    return n;
  });
});

test("A TOKEN LINE NAMES ITS SOURCE — two Frostbites from two sources read as two", {skip}, () => {
  H.db();
  /* Iyslander's hero trigger, through `execute`: an Ice card played on the
     OPPONENT's turn */
  P.fxReset();
  const spike = {...H.card("Frost Spike", 3), uid: "FS"};
  const g = H.state({name: "Iyslander", hand: [spike], res: 9, ap: 0}, {name: "Boltyn", hp: 20},
                    {turn: 3, actor: 0, turnPlayer: 1});
  g.builds = [{iceFrostbite: true, HZOOM: {name: "Iyslander, Stormbind"}}, {}];
  const out = H.execute(g, spike, "hand", 0, {});
  const lines = said(out).filter(l => / created on /.test(l));
  assert.ok(lines.includes("Iyslander's hero ability: Frostbite created on Boltyn's board — "
    + "Cards and abilities cost you an additional {r} to play or activate."), lines.join("\n"));
  /* AND THE FIZZLE NAMES THE TOKEN BY ITS PRINTED NAME, never the
     lowercased capture — driven against a hero armoured in all four zones */
  const G = require("../engine/game.js");
  const armour = G.ARMOR_SLOTS.map((z, i) => ({name: "Plate " + z, uid: "pl" + i, tt: "Generic Equipment - " + z[0].toUpperCase() + z.slice(1),
    ty: ["Generic", "Equipment", z[0].toUpperCase() + z.slice(1)], def: 1, tx: "", kw: []}));
  assert.equal(G.hasExposedZone({gear: armour}), false, "fixture: no exposed zone");
  P.fxReset();
  const s2 = {...H.card("Frost Spike", 3), uid: "FS2"};
  const g2 = H.state({name: "Iyslander", hand: [s2], res: 9, ap: 1}, {name: "Boltyn", hp: 20, gear: armour},
                     {turn: 3, actor: 0, turnPlayer: 0});
  const f2 = said(H.execute(g2, s2, "hand", 0, {}));
  assert.ok(f2.includes("Frost Spike: Boltyn has no exposed armour zone — the Frostbite has nowhere to land, and fizzles."),
    f2.join("\n"));
});

test("BRIAR'S MINTS name her hero ability — and no hero's name is written into the engine", {skip}, () => {
  H.db();
  const fs = require("fs"), path = require("path");
  const src = fs.readFileSync(path.join(__dirname, "..", "engine", "effects.js"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(src, /Briar draws up|act\(n\)\.hero \? act\(n\)\.hero\.name/,
    "`sd.hero` is the hero KEY, a string — `.name` on it is undefined");
  /* DRIVEN: the second non-attack action card this turn, through `execute` */
  P.fxReset();
  const nim = {...H.card("Nimblism", 1), uid: "NB"};
  assert.ok(P.isNonAtkActionCard(nim), "fixture: Nimblism is a non-attack action card");
  /* seat 0 named "You", the trainer's shape — so the SOURCE must come off
     the hero card, and the board off the seat */
  const g = H.state({name: "You", hand: [nim], res: 9, ap: 1, hist: {non: 1}}, {name: "Bob"},
                    {turn: 3, actor: 0, turnPlayer: 0});
  g.builds = [{lightningOnSecondNonAtk: "Embodiment of Lightning", HZOOM: {name: "Briar, Warden of Thorns"}}, {}];
  const f = said(H.execute(g, nim, "hand", 0, {}));
  assert.ok(f.includes("Briar's hero ability: the second non-attack action card this turn."), f.join("\n"));
  assert.ok(f.some(l => /^Briar's hero ability: Embodiment of Lightning created on your board — /.test(l)), f.join("\n"));
});

test("THE GO-AGAIN GRANT names its source and seat, and the attack that spends it names itself", {skip}, () => {
  H.db();
  /* the grant: Agility's printed "your next attack this turn gets go again" */
  const made = H.runOps(H.state({name: "Boltyn"}, {name: "Kayo"}), [["gaNext", null]], "Agility");
  assert.ok(said(made).includes("Agility: Boltyn's next attack this turn will carry go again."), said(made).join("\n"));
  const you = H.runOps(H.state({name: "You"}, {name: "Kayo"}), [["gaNext", null]], "Agility");
  assert.ok(said(you).includes("Agility: your next attack this turn will carry go again."), said(you).join("\n"));
  /* the spend: an attack declared with the grant waiting */
  P.fxReset();
  const atk = {...H.card("Raging Onslaught", 1), uid: "RO"};
  const g = H.state({name: "Boltyn", hand: [atk], res: 9, ap: 1, gaNext: true}, {name: "Kayo", hp: 20},
                    {turn: 3, actor: 0, turnPlayer: 0});
  const out = H.execute(Object.assign({}, g, {phase: "action", step: "layer", chain: []}), atk, "hand", 0, {});
  const f = said(out);
  assert.ok(f.includes("Raging Onslaught is the attack that grant was waiting for — go again."), f.join("\n"));
  assert.ok(!f.some(l => /\brite\b/.test(l)), "Viserai's flavour, on a card that is not his");
});

test("THE END PHASE names the seat whose turn it is — 'your turn', never 'You's turn'", {skip}, () => {
  H.db();
  const E = require("../engine/effects");
  const frost = H.card("Frostbite", 0);
  const g = H.state({name: "You", board: [{uid: "fb", kind: "token", card: {...frost, uid: "fb"}, sd: "end"}]},
                    {name: "Bob"}, {turn: 3, actor: 0, turnPlayer: 0});
  const r = E.beginEndPhase(g, 0);
  assert.ok(r.msgs.includes("The Frostbite thaws unspent at the end of your turn."), r.msgs.join("\n"));
  /* and intimidate's return agrees its verb with the seat it names */
  const card = {...H.card("Raging Onslaught", 1), uid: "RO"};
  const h = H.state({name: "You", intimidated: [card]}, {name: "Bob"}, {turn: 3, actor: 1, turnPlayer: 1});
  const m = E.beginEndPhase(h, 1).msgs.find(x => /intimidated card/.test(x)) || "";
  assert.match(m, /^You take back 1 intimidated card/, m);
});
