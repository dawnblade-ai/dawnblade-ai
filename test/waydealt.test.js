/* ============================================================
   "…IF DAMAGE IS DEALT THIS WAY" — ANSWERED WHEN IT LANDS (v4.77)

   Three defects, one shape: a question about damage asked before the damage
   had landed.

   1. SURGE read `amp > 0` BEFORE the arcane op ran, so an amp whose extra
      point a ward or a barrier then prevented surged anyway (stronger than
      printed). It is `way:dealtOverN` now, off the damage that LANDED.
   2. A HIT DEFERRED INTO AN ARCANE-BARRIER SHEET had not landed when the
      late pass asked, so every "if damage is dealt this way" rider read
      FALSE against a hero wearing a barrier — even one who then declined it
      (weaker than printed). Those conditions ride on the sheet now
      (`wayRider`) and are settled when it is answered.
   3. A SOAK SHEET THAT COULD NO LONGER BE ASKED was dropped by the drain,
      and the damage riding in it with it. `prompts.promptLapse` resolves it
      as its default answer instead: the damage lands in full.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const H = require("./helpers/judged.js");
const J = H.J;
const P = require("../engine/parser.js");
const PM = require("../engine/prompts.js");

const skip = !H.hasDb() && "no cached card database";
const ROOT = path.join(__dirname, "..");

/* Play `name` from seat 0's hand into seat 1. `o.barrier` equips a Nullrune
   Hood (Arcane Barrier 1) and gives the victim one resource to pay for it;
   `o.soak` pays it when the sheet opens, otherwise the sheet is declined. */
function play(name, pitch, o){
  H.db();
  const c = {...H.card(name, pitch), uid: "cc"};
  const hood = {...H.card("Nullrune Hood", 0), uid: "nh"};
  let g = H.state({hp: 20, res: 9, ap: 1, hand: [c], amp: o.amp || 0},
                  {hp: 20, gear: o.barrier ? [hood] : [], res: o.barrier ? 1 : 0, hand: [], ward: o.ward || 0},
                  {turn: 3, actor: 0, turnPlayer: 0, phase: "action"});
  g = H.execute(g, c, "hand", 0, {});
  if(!g.prompt) g = J.openPrompt(g);
  const rider = g.prompt && g.prompt.tag === "soak" ? g.prompt.wayRider : undefined;
  if(g.prompt && g.prompt.tag === "soak"){
    if(o.soak) g = J.reduce(g, {t: "promptSel", i: 0}, 1).state;
    const r = J.reduce(g, {t: "promptConfirm"}, 1);
    assert.ok(!r.error, r.error);
    g = r.state;
  }
  return {g, rider, ap: g.sides[0].ap, hp: g.sides[1].hp};
}

/* ---- 1. SURGE, OFF THE DAMAGE THAT LANDED ---------------------------------- */

test("surge fires when more than its printed amount LANDS, and not otherwise", {skip}, () => {
  /* Aether Quickening, pitch 3: "Deal 2 arcane… Surge - if this deals more
     than 2 damage, it gets go again." The pair either side of the threshold
     is what tests anything (v3.92). */
  assert.deepEqual([play("Aether Quickening", 3, {amp: 1}).ap, play("Aether Quickening", 3, {amp: 1}).hp], [1, 17],
    "three landed and it did not surge");
  assert.deepEqual([play("Aether Quickening", 3, {}).ap, play("Aether Quickening", 3, {}).hp], [0, 18],
    "two landed and it surged");
});

test("an amp whose extra point is PREVENTED does not surge — the old prediction did", {skip}, () => {
  const r = play("Aether Quickening", 3, {amp: 1, ward: 1});
  assert.deepEqual([r.ap, r.hp], [0, 18], "two landed behind a ward and it surged off the amp");
});

test("a surge miss says what it asked, in the player's words", {skip}, () => {
  const r = play("Aether Quickening", 3, {});
  assert.ok(r.g.feed.some(l => /didn't deal more than 2 damage/.test(l.t || l)),
    "the feed does not say why the surge did not fire");
});

/* ---- 2. A HIT DEFERRED INTO A BARRIER SHEET ------------------------------ */

test("a barrier sheet carries what waits on the hit landing", {skip}, () => {
  const r = play("Aether Quickening", 3, {amp: 1, barrier: true});
  assert.ok(r.rider, "the soak sheet carries no wayRider");
  assert.deepEqual(r.rider.conds.map(c => c.cond), ["way:dealtOver2"]);
  assert.equal(r.rider.seat, 0, "the rider belongs to the DEALER, not the side answering");
});

test("barrier DECLINED: the hit lands in full, and the surge fires then", {skip}, () => {
  const r = play("Aether Quickening", 3, {amp: 1, barrier: true});
  assert.deepEqual([r.ap, r.hp], [1, 17]);
});

test("barrier PAID: one prevented, two land, no surge", {skip}, () => {
  const r = play("Aether Quickening", 3, {amp: 1, barrier: true, soak: true});
  assert.deepEqual([r.ap, r.hp], [0, 18]);
});

test("an ATTACK's rider lands on its own live link — Path of Same Ends", {skip}, () => {
  /* "When this attacks a hero, deal 1 arcane damage to them. If damage is
     dealt this way, this gets go again." The trigger fires at declaration
     (v4.08), so the sheet is answered while the attack is still the open
     link, and the grant belongs on `pend` — the thing that resolves. */
  const declined = play("Path of Same Ends", 1, {barrier: true});
  assert.equal(declined.hp, 19);
  assert.equal(declined.g.pend && declined.g.pend.ga, true, "the point landed and the attack did not go again");
  const soaked = play("Path of Same Ends", 1, {barrier: true, soak: true});
  assert.equal(soaked.hp, 20);
  assert.equal(soaked.g.pend && soaked.g.pend.ga, false, "the point was prevented and it went again anyway");
  const bare = play("Path of Same Ends", 1, {});
  assert.equal(bare.g.pend && bare.g.pend.ga, true, "the control: no barrier, it goes again at once");
});

test("Turn to Mindfire's tap is offered once the deferred hit lands", {skip}, () => {
  const r = play("Turn to Mindfire", 1, {barrier: true});
  assert.ok(r.g.prompt && r.g.prompt.tag === "pay" && r.g.prompt.tapHero,
    "the hero-tap offer was never made — the hit landed after the question was asked");
  assert.equal(r.g.prompt.side, 0, "the offer is the dealer's");
});

test("a deferred hit that the barrier stops ENTIRELY offers no tap — prevented is not dealt", {skip}, () => {
  /* Turn to Mindfire deals 5, so one Arcane Barrier can never stop all of it.
     A synthetic printing 1 is what reaches the guard (v3.73); the declined
     half is its positive control. */
  H.db();
  const probe = {uid: "pm", name: "Probe Mindfire", pitch: 1, cost: 0, tt: "Wizard Action",
    ty: ["Wizard", "Action"], kw: [],
    tx: "Deal 1 arcane damage to any target.\nIf this deals damage, you may {t} your hero. If you do, create a Ponder token."};
  const hood = {...H.card("Nullrune Hood", 0), uid: "nh"};
  const run = soak => {
    let g = H.state({hp: 20, res: 9, ap: 1, hand: [probe]}, {hp: 20, gear: [hood], res: 1, hand: []},
                    {turn: 3, actor: 0, turnPlayer: 0, phase: "action"});
    g = H.execute(g, probe, "hand", 0, {});
    if(!g.prompt) g = J.openPrompt(g);
    assert.equal(g.prompt && g.prompt.tag, "soak");
    if(soak) g = J.reduce(g, {t: "promptSel", i: 0}, 1).state;
    return J.reduce(g, {t: "promptConfirm"}, 1).state;
  };
  const stopped = run(true);
  assert.equal(stopped.sides[1].hp, 20);
  assert.ok(!(stopped.prompt && stopped.prompt.tapHero), "a fully prevented hit offered the tap");
  const landed = run(false);
  assert.equal(landed.sides[1].hp, 19);
  assert.ok(landed.prompt && landed.prompt.tapHero, "the control: a hit that landed offers it");
});

/* ---- 3. A SOAK THAT LAPSES STILL LANDS ------------------------------------- */

test("three hits, one affordable barrier: paying for the first does not delete the rest", {skip}, () => {
  H.db();
  const hood = {...H.card("Nullrune Hood", 0), uid: "nh"};
  let g = H.state({hp: 20, res: 9, hand: []}, {hp: 20, gear: [hood], res: 1, hand: []},
                  {turn: 3, actor: 0, turnPlayer: 0});
  g = H.runOps(g, [["arcane", 1], ["arcane", 1], ["arcane", 1]], "Probe Bolt");
  assert.equal((g.promptQ || []).length, 3, "the fixture queues three soaks");
  g = J.openPrompt(g);
  g = J.reduce(g, {t: "promptSel", i: 0}, 1).state;
  g = J.reduce(g, {t: "promptConfirm"}, 1).state;
  assert.equal(g.sides[1].res, 0, "the barrier was paid for");
  assert.equal(g.sides[1].hp, 18, "two points of arcane damage vanished with the sheets that lapsed");
  assert.ok(!g.prompt && !(g.promptQ || []).length);
});

test("promptLapse answers only a soak that cannot be asked", {skip}, () => {
  H.db();
  const hood = {...H.card("Nullrune Hood", 0), uid: "nh"};
  const opts = P.arcaneSoaks({gear: [hood]});
  const spec = {tag: "soak", side: 1, src: "Probe", amount: 2, options: opts, by: 0, wayRider: {card: "Probe", seat: 0, conds: []}};
  const broke = H.state({}, {hp: 20, gear: [hood], res: 0, hand: []});
  const flush = H.state({}, {hp: 20, gear: [hood], res: 1, hand: []});
  const lapse = PM.promptLapse(broke, spec);
  assert.ok(lapse && lapse.tag === "soak" && lapse.amount === 2 && lapse.options.length === 0);
  assert.deepEqual(lapse.sel, [], "the default answer is to take it all");
  assert.equal(lapse.by, 0, "the dealer rides through");
  assert.ok(lapse.wayRider, "what waits on the hit rides through too");
  assert.equal(PM.promptLapse(flush, spec), null, "a sheet that CAN be asked is asked");
  assert.equal(PM.promptLapse(broke, {tag: "pick", side: 1, zone: "hand", min: 0, max: 1}), null,
    "a lapsed pick carries nothing and skips");
});

test("both drains ask promptLapse before skipping a sheet", () => {
  const judge = fs.readFileSync(path.join(ROOT, "engine", "judge.js"), "utf8");
  assert.match(judge, /if\(!live\)\{\s*\/\*[^*]*\*\/\s*const lapse = PM\.promptLapse\(g, p\);\s*if\(lapse\) return withEffects/,
    "judge.js's openPrompt skips a lapsed soak and drops its damage");
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.match(html, /if\(!live\)\{\s*\/\*[^*]*\*\/\s*const lapse = promptLapse\(s, p\);\s*if\(lapse\) return _EFX\.applyAnswer/,
    "the trainer's openPrompt skips a lapsed soak and drops its damage");
});

/* ---- 4. THE PREMISES THE DESIGN RESTS ON, AS DRILLS ---------------------- */

function poolCards(){
  H.db();
  const recs = JSON.parse(fs.readFileSync(require("./helpers/extract").cardDbPath(), "utf8"));
  const out = [], seen = new Set();
  for(const r of recs) for(const p of [0, 1, 2, 3]){
    let c; try { c = H.card(r.name, p); } catch(e){ continue; }
    if(!c || seen.has(c.name + "|" + c.pitch)) continue;
    seen.add(c.name + "|" + c.pitch); out.push(c);
  }
  return out;
}

test("PREMISE: no `way:` gate carries `instead` — a late gate cannot replace an op that already ran", {skip}, () => {
  const bad = [];
  for(const c of poolCards()){
    const fx = P.fxParse(c);
    for(const cd of (fx.conds || [])) if(/^way:/.test(String(cd.cond)) && cd.instead) bad.push(c.name);
  }
  assert.deepEqual(bad, [], "a pool record gates an `instead` payload on what its own resolution did — " +
    "the late pass would ADD it on top of the base op, which is VALUE-DOUBLED");
});

test("PREMISE: every card whose rider waits on its own damage deals exactly ONE arcane instance", {skip}, () => {
  /* `holdWayRider` attaches to the LAST deferred sheet and counts what landed
     before it; with two deferred instances the earlier one's damage would not
     be counted. Measured: none of the six cards deals two. */
  const found = new Map();
  for(const c of poolCards()){
    const fx = P.fxParse(c);
    const dealtGate = (fx.conds || []).some(cd => /^way:dealt/.test(String(cd.cond)))
                   || (fx.tapCost && fx.tapCost.when === "dealt");
    if(!dealtGate) continue;
    const arc = [...(fx.ops || []), ...(fx.onAtk || []), ...(fx.onAtkHero || [])].filter(o => o[0] === "arcane").length;
    found.set(c.name, Math.max(found.get(c.name) || 0, arc));
  }
  assert.deepEqual([...found.keys()].sort(),
    ["Aether Icevein", "Aether Quickening", "Open the Flood Gates", "Path of Same Ends", "Polar Cap", "Turn to Mindfire"]);
  for(const [nm, k] of found) assert.equal(k, 1, nm + " deals " + k + " arcane instances");
});
