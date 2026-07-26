/* Drills for engine/invariants.js — the guard rails.

   Each drill reconstructs a state that a rule of Flesh and Blood forbids
   and asserts the judge names it. Three of them are REGRESSIONS of bugs
   that actually shipped and were found by eye, never by a test:

     v2.16  crumbling auras were filtered off the board into the graveyard
            and then the board was rebuilt from the pre-filter copy, so the
            cards sat in both zones at once            -> CARD-IN-TWO-ZONES
     v2.18  ward/hist/blockH/blockG/blockRx were written as top-level game
            keys, so the side kept its old value       -> SIDE-FIELD-ON-GAME
     v2.19  paySel likewise, hidden past a nested literal   (same code)

   If the invariant module is worth its weight, those three states cannot
   pass it. */
const test = require("node:test");
const assert = require("node:assert/strict");
const I = require("../engine/invariants.js");
const S = require("../engine/sides.js");

const card = (uid, name) => ({uid, name, pitch:1, cost:1, power:3, def:2, tt:"Attack Action", kw:[], tx:""});

/* A minimal legal two-seat game. */
function g(){
  return {
    turn:1, mode:"act", bphase:"defend", log:[], feed:[], flags:{}, over:null,
    chain:[], chainOpen:false, stack:[], promptQ:[], prompt:null,
    sides:[S.makeSide({id:0, hp:20}), S.makeSide({id:1, hp:42})]
  };
}
const codes = st => I.check(st).map(v => v.code);

test("a freshly built game is clean", () => {
  assert.deepEqual(I.errors(g()), [], I.describe(I.check(g())));
  assert.equal(I.clean(g()), true);
});

test("makeGame() from sides.js is clean", () => {
  const st = S.makeGame ? S.makeGame() : null;
  if(!st) return;
  /* makeGame builds bare seats; it must still satisfy the judge */
  assert.deepEqual(I.errors(st).map(v => v.code + ": " + v.msg), []);
});

/* ---- REGRESSION: the crumbling-aura bug (v2.16) --------------------- */
test("CARD-IN-TWO-ZONES catches a card in the board and the graveyard at once", () => {
  const st = g();
  const aura = card(7, "Suspense Aura");
  st.sides[0].board = [aura];
  st.sides[0].grave = [aura];          /* exactly what v2.16 shipped */
  const v = I.check(st).find(x => x.code === "CARD-IN-TWO-ZONES");
  assert.ok(v, "expected CARD-IN-TWO-ZONES, got: " + codes(st).join(", "));
  assert.match(v.msg, /Suspense Aura/);
  assert.match(v.msg, /board/);
  assert.match(v.msg, /grave/);
});

test("CARD-IN-TWO-ZONES sees a board entry that WRAPS a card", () => {
  const st = g();
  const item = card(11, "Hyper Driver");
  st.sides[0].board = [{card:item, kind:"item", spent:false, uid:item.uid}];
  st.sides[0].hand  = [item];
  assert.ok(codes(st).includes("CARD-IN-TWO-ZONES"));
});

test("CARD-DUP-IN-ZONE catches the same card twice in one zone", () => {
  const st = g();
  const c = card(3, "Raging Onslaught");
  st.sides[0].hand = [c, c];
  const v = I.check(st).find(x => x.code === "CARD-DUP-IN-ZONE");
  assert.ok(v, codes(st).join(", "));
  assert.match(v.msg, /2 times/);
});

test("the same uid on OPPOSITE sides is still two zones", () => {
  const st = g();
  const c = card(5, "Ironrot Helm");
  st.sides[0].gear = [c];
  st.sides[1].gear = [c];
  assert.ok(codes(st).includes("CARD-IN-TWO-ZONES"));
});

/* ---- REGRESSION: side field written as a game key (v2.18 / v2.19) --- */
test("SIDE-FIELD-ON-GAME catches every field the v2.18 bug wrote to the game", () => {
  for(const f of ["ward","hist","blockH","blockG","blockRx","paySel"]){
    const st = g();
    st[f] = f === "hist" ? S.freshHist() : [];
    const v = I.check(st).find(x => x.code === "SIDE-FIELD-ON-GAME" && x.where === f);
    assert.ok(v, "`" + f + "` written to the game object was not caught");
    assert.match(v.msg, /youMut\(\)/);
  }
});

test("no legitimate game key is mistaken for a side field", () => {
  const st = g();
  /* the real GAME_KEYS must never trip SIDE-FIELD-ON-GAME */
  for(const k of S.GAME_KEYS) if(!(k in st)) st[k] = null;
  assert.deepEqual(I.check(st).filter(v => v.code === "SIDE-FIELD-ON-GAME"), []);
});

/* ---- shape ---------------------------------------------------------- */
test("SIDES-ASYMMETRIC catches seats that are different shapes", () => {
  const st = g();
  st.sides[1] = {...st.sides[1]};
  delete st.sides[1].soul;
  const c = codes(st);
  assert.ok(c.includes("SIDES-ASYMMETRIC") || c.includes("SIDE-MISSING-FIELDS"), c.join(", "));
});

test("ZONE-NOT-ARRAY catches a zone clobbered with a non-array", () => {
  const st = g();
  st.sides[0].grave = null;
  assert.ok(codes(st).includes("ZONE-NOT-ARRAY"));
});

test("ARSENAL-SHAPE keeps arsenal a single card, never an array", () => {
  const st = g();
  st.sides[0].arsenal = [card(1, "Snatch")];
  assert.ok(codes(st).includes("ARSENAL-SHAPE"));
  const ok = g();
  ok.sides[0].arsenal = card(1, "Snatch");
  assert.deepEqual(I.errors(ok), []);
});

/* ---- CR 4.4.3e: points are lost, never owed ------------------------- */
test("a player can never owe resources or action points", () => {
  const st = g();
  st.sides[0].res = -1;
  st.sides[1].ap = -2;
  const c = codes(st);
  assert.ok(c.includes("NEGATIVE-RES"));
  assert.ok(c.includes("NEGATIVE-AP"));
});

test("NAN-FIELD catches arithmetic that produced NaN", () => {
  const st = g();
  st.sides[0].hp = 20 - undefined;      /* NaN */
  assert.ok(codes(st).includes("NAN-FIELD"));
});

/* ---- CR 7.3.2b: a defending card cannot defend twice ---------------- */
test("DEFENDER-REUSED-ON-CHAIN enforces CR 7.3.2b across chain links", () => {
  const st = g();
  const helm = card(21, "Ironrot Helm");
  st.chainOpen = true;
  st.chain = [{defs:[helm]}, {defs:[helm]}];
  const v = I.check(st).find(x => x.code === "DEFENDER-REUSED-ON-CHAIN");
  assert.ok(v, codes(st).join(", "));
  assert.match(v.msg, /7\.3\.2b/);
});

test("the same card defending once on each of two separate chains is fine", () => {
  const st = g();
  const helm = card(21, "Ironrot Helm");
  st.chainOpen = true;
  st.chain = [{defs:[helm]}];
  assert.deepEqual(I.errors(st).filter(v => v.code === "DEFENDER-REUSED-ON-CHAIN"), []);
});

test("CHAIN-CLOSED-WITH-LINKS warns when a closed chain still holds links", () => {
  const st = g();
  st.chainOpen = false;
  st.chain = [{defs:[]}];
  assert.ok(codes(st).includes("CHAIN-CLOSED-WITH-LINKS"));
});

/* ---- CR 4.2.1 / 4.4.1: no priority in the start or end phase -------- */
test("nobody may hold priority during the start or end phase", () => {
  for(const ph of ["start","end"]){
    const st = g();
    st.phase = ph; st.priority = 0;
    const v = I.check(st).find(x => x.code === "PRIORITY-IN-CLOSED-PHASE");
    assert.ok(v, "priority during the " + ph + " phase was allowed");
    assert.match(v.msg, /4\.2\.1/);
  }
  const ok = g();
  ok.phase = "action"; ok.priority = 0;
  assert.deepEqual(I.errors(ok).filter(v => v.code === "PRIORITY-IN-CLOSED-PHASE"), []);
});

test("BAD-PHASE / BAD-STEP reject values outside the CR's turn machine", () => {
  const st = g();
  st.phase = "middle"; st.step = "wiggle";
  const c = codes(st);
  assert.ok(c.includes("BAD-PHASE"));
  assert.ok(c.includes("BAD-STEP"));
});

test("a prompt must be addressed to a real seat", () => {
  const st = g();
  st.prompt = {tag:"pick", side:2, cards:[], sel:[]};
  assert.ok(codes(st).includes("PROMPT-BAD-SIDE"));
});

test("DEAD-BUT-RUNNING warns when a hero is at 0 with no result set", () => {
  const st = g();
  st.sides[1].hp = 0;
  assert.ok(codes(st).includes("DEAD-BUT-RUNNING"));
});

/* ---- the API -------------------------------------------------------- */
test("assertClean throws with a readable report and passes clean states", () => {
  assert.doesNotThrow(() => I.assertClean(g(), "fresh game"));
  const st = g();
  const c = card(9, "Twin Bite");
  st.sides[0].hand = [c]; st.sides[0].grave = [c];
  assert.throws(() => I.assertClean(st, "takeIt"), /invariant violation after takeIt/);
  assert.throws(() => I.assertClean(st), /CARD-IN-TWO-ZONES/);
});

test("warnings alone never make a state unclean", () => {
  const st = g();
  st.sides[0].hp = st.sides[0].maxHp + 5;   /* legal in FaB, warn only */
  assert.ok(I.check(st).some(v => v.code === "HP-ABOVE-START"));
  assert.equal(I.clean(st), true);
});

test("census reports the zone every card sits in", () => {
  const st = g();
  st.sides[0].hand = [card(1,"A"), card(2,"B")];
  st.sides[0].arsenal = card(3,"C");
  const rows = I.census(st.sides[0], 0);
  assert.equal(rows.length, 3);
  assert.ok(rows.some(r => r.zone === "sides[0].arsenal" && r.uid === 3));
});
