/* ============================================================
   A LATE GO AGAIN REACHES THE TABLE (v5.18)

   > "If this is defended by fewer than 2 non-equipment cards, it gets go
   > again." — PULPING, Kayo's
   > "If this card's {p} is greater than its base, it gets go again and
   > \"When this hits, reload.\"" — BOLT'N' SHOT, Azalea's

   Both conditions can only be answered once the wall exists, so
   `linkPumps` settles them and writes `pend.ga` (and the struck power,
   `_struck`) onto the link. `judge.strike` then rebuilt `pend` from the
   link it had captured BEFORE `linkPumps` ran, and both fields were thrown
   away: the printed action point never arrived at the CR-exact board while
   the trainer, which keeps `n.pend`, granted it (QUEUE item 5).

   GO AGAIN IS AN ACTION POINT (CR 5.3.5), and that is what to assert on.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../engine/parser.js");
const J = require("../engine/judge.js");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached card database";
const blk = (nm, uid) => ({name: nm, uid, pitch: 1, cost: 0, power: 3, def: 2,
  tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"], tx: "", kw: []});

/* A real table: seat 0 attacks, seat 1 declares `walls`, seat 0 may react,
   and the link resolves. Returns the state right after the damage step. */
function link(atk, from, walls, react){
  const zone = from === "arsenal" ? {arsenal: atk, hand: react ? [react] : []}
                                  : {hand: [atk, ...(react ? [react] : [])]};
  let g = {...H.state(Object.assign({res: 9, ap: 1, deck: [blk("Top", "t0"), blk("Top", "t1")]}, zone),
                      {hand: walls, hp: 20, deck: [blk("Deck", "d1")]}, {turn: 3, actor: 0}),
           phase: "action", step: "layer", priority: 0, passed: [], turnPlayer: 0,
           firstPlayer: 0, round: 1, over: null};
  const go = (a, s) => { const o = J.reduce(g, a, s); assert.equal(o.error, null, JSON.stringify(a) + ": " + o.error); g = o.state; };
  go({t: "play", uid: atk.uid, from}, 0);
  g = H.answerAll(H.drain(g));
  for(let i = 0; i < 10 && g.step !== "defend"; i++) go({t: "pass"}, g.priority);
  for(const w of walls) go({t: "defend", uid: w.uid}, 1);
  for(let i = 0; i < 10 && g.step !== "reaction"; i++) go({t: "pass"}, g.priority);
  if(react){
    for(let i = 0; i < 4 && g.priority !== 0; i++) go({t: "pass"}, g.priority);
    go({t: "play", uid: react.uid, from: "hand"}, 0);
    g = H.answerAll(H.drain(g));
  }
  for(let i = 0; i < 12 && g.step !== "resolution" && g.step !== "close"; i++){
    const o = J.reduce(g, {t: "pass"}, g.priority);
    if(o.error) break; g = H.answerAll(o.state);
  }
  return g;
}

test("CENSUS: the late conditions that grant go again", {skip}, () => {
  /* Pinned so a third card arriving with a late go again is a deliberate
     edit, and the drills below are known to cover the whole family. */
  const DB = H.db(), rows = new Set();
  for(const k of Object.keys(DB.byNP)){
    const c = DB.byNP[k], r = H.card(c.n, c.p == null ? 0 : c.p);
    if(!r) continue;
    for(const e of P.fxParse(r).conds || [])
      if(["pumped", "defLt2", "defLt2any", "hasGa"].indexOf(e.cond) >= 0 && e.op[0] === "ga") rows.add(r.name);
  }
  assert.deepEqual([...rows].sort(), ["Bolt'n' Shot", "Pulping"]);
});

test("PULPING at the table: one blocker keeps the action point, two do not", {skip}, () => {
  H.db();
  const one = link({...H.card("Pulping", 1), uid: "P"}, "hand", [blk("Wall A", "w1")]);
  assert.equal(one.sides[0].ap, 1, "defended by one card — the printed go again keeps the point");
  /* CONTROL: two non-equipment defenders deny it */
  const two = link({...H.card("Pulping", 1), uid: "P"}, "hand", [blk("Wall A", "w1"), blk("Wall B", "w2")]);
  assert.equal(two.sides[0].ap, 0, "defended by two — no go again, the point is spent");
});

test("BOLT'N' SHOT at the table: pumped by a reaction, it goes again AND the struck power survives", {skip}, () => {
  /* The arrow is played from the arsenal (v4.91) and pumped by an attack
     reaction (synthetic, so its only effect is the +1). Its go again needs
     `pend.ga` and its hit-time "reload" rider asks `_struck` — the second
     field the old rebuild dropped, after which the hit-time gate fell back
     to the DECLARED power and answered "not pumped". */
  H.db(); P.fxReset();
  const shot = {...H.card("Bolt'n' Shot", 1), uid: "B"};
  const nudge = {name: "Synthetic Nudge Ga", uid: "N", pitch: 1, cost: 0, def: 2,
                 tt: "Generic Attack Reaction", ty: ["Generic", "Attack Reaction"],
                 tx: "Target attack gets +1{p}.", kw: [], gkw: []};
  const pumped = link(shot, "arsenal", [], nudge);
  assert.equal(pumped.sides[1].hp, 20 - (shot.power + 1), "fixture: the reaction's +1 landed");
  assert.equal(pumped.sides[0].ap, 1, "pumped above its base — it goes again");
  assert.ok(pumped.pend && pumped.pend._struck === shot.power + 1, "and the struck power is on the link");
  /* CONTROL: unpumped, it does neither */
  const plain = link({...shot}, "arsenal", [], null);
  assert.equal(plain.sides[0].ap, 0, "not pumped — the point is spent");
  P.fxReset();
});

test("…and its hit-time \"reload\" asks the STRUCK power, so the sheet opens (both halves)", {skip}, () => {
  /* `condOnHit`'s `pumped` gate reads `_struck`. With it dropped, the gate
     fell back to the DECLARED power, so the reaction's +1 was invisible to
     it and the printed reload was never offered at the table. */
  H.db(); P.fxReset();
  const run = withNudge => {
    const shot = {...H.card("Bolt'n' Shot", 1), uid: "B"};
    const nudge = {name: "Synthetic Nudge Ga", uid: "N", pitch: 1, cost: 0, def: 2,
                   tt: "Generic Attack Reaction", ty: ["Generic", "Attack Reaction"],
                   tx: "Target attack gets +1{p}.", kw: [], gkw: []};
    let g = {...H.state({res: 9, ap: 1, arsenal: shot, hand: [...(withNudge ? [nudge] : []), blk("Keep", "K")],
                         deck: [blk("Top", "t0")]}, {hand: [], hp: 20, deck: [blk("Deck", "d1")]}, {turn: 3, actor: 0}),
             phase: "action", step: "layer", priority: 0, passed: [], turnPlayer: 0, firstPlayer: 0, round: 1, over: null};
    const go = (a, s) => { const o = J.reduce(g, a, s); assert.equal(o.error, null, o.error); g = o.state; };
    go({t: "play", uid: "B", from: "arsenal"}, 0); g = H.drain(g);
    for(let i = 0; i < 10 && g.step !== "reaction"; i++) go({t: "pass"}, g.priority);
    if(withNudge){
      for(let i = 0; i < 4 && g.priority !== 0; i++) go({t: "pass"}, g.priority);
      go({t: "play", uid: "N", from: "hand"}, 0); g = H.drain(g);
    }
    for(let i = 0; i < 12 && g.step !== "resolution" && !g.prompt; i++){
      const o = J.reduce(g, {t: "pass"}, g.priority); if(o.error) break; g = o.state;
    }
    return g;
  };
  const yes = run(true);
  assert.ok(yes.prompt && yes.prompt.src === "Bolt'n' Shot" && yes.prompt.tag === "pick",
    "pumped by the reaction — the reload is offered");
  const no = run(false);
  assert.ok(!(no.prompt && no.prompt.src === "Bolt'n' Shot"), "not pumped — no reload");
  P.fxReset();
});
