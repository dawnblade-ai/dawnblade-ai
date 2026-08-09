/* THE ACTOR MIGRATION LEDGER — ROADMAP-MULTIPLAYER.md, Phase A step 1.
   ("Split actor from perspective … Do this first. It is the whole ballgame.")

   Two concepts are conflated in you()/opp(), and today the two readings
   coincide because only seat 0 ever acts:

     PERSPECTIVE — the seat this CLIENT renders. A UI question.
                   you()/opp() stay as its helpers.
     ACTOR       — the side whose effect is RESOLVING. A RULES question.
                   act()/foe() read s.actor.

   `s.actor` defaults to 0, so act(s) === you(s) today and every migrated
   function is behaviour-identical NOW while being correct the moment a
   second human occupies seat 1.

   This file is the ledger, and it works like symmetryGap()/flatRemaining:
   MIGRATED functions must contain NO perspective helper, PENDING ones are
   listed so the remaining work is a visible number rather than folklore.
   Moving a name between the two lists must be a DELIBERATE edit. */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { html } = require("./helpers/extract.js");

const src = html();

/* THE RULES CORE IS MOVING OUT OF index.html (v2.53, the effects port), so
   the ledger has to FOLLOW a function to its new home rather than lose
   sight of it. A migrated body that stops being scanned is worse than one
   that was never scanned: the ledger keeps reporting it green.
   Each anchor therefore names its source file, and adding a source here is
   the deliberate edit that admits a rules function has left the trainer. */
const SOURCES = {
  html: src,
  effects: fs.readFileSync(path.join(__dirname, "..", "engine", "effects.js"), "utf8")
};

/* ---- slice one function body out of index.html ----------------------
   Brace-matching is the obvious approach and the WRONG one here: `execute`
   contains regex literals, and a lexer that is not regex-literal-aware
   miscounts braces inside them (the same hazard html-balance.test.js
   documents). So bound each function by the START of the next declaration
   instead — deterministic, needs no lexing, and fails loudly if the file
   is ever reordered. ANCHORS must stay in true file order; the self-check
   drill below enforces exactly that. */
const ANCHORS = [
  /* --- engine/effects.js: the ported card semantics -------------------- */
  ["runOps",       "  const runOps = (s, ops, srcName) => {",  "effects"],
  ["execute",      "  const execute = (s,card,from,idx) => {", "effects"],
  ["__endEffects", "  return {runOps, execute, afterDiscard};",  "effects"],
  /* --- index.html: what is still a closure inside Battle ---------------
     playRx is a BOUNDARY, not a rules function: with runOps and execute
     gone from this file, dummyDefence would otherwise slice all the way
     to resolveStack and swallow three unrelated handlers. An anchor list
     that stops bounding things stops being a guard. */
  ["dummyDefence", "  const dummyDefence = (s, total, card) => {"],
  ["playRx",       "  const playRx = i => setG(s=>{"],
  ["resolveStack", "  const resolveStack = () => setG(s=>{"],
  ["tryPlay",      "  const tryPlay = (card,from,idx) => setG(s=>{"],
  ["confirmPay",   "  const confirmPay = () => setG(s=>{"],
  ["allySwing",    "  const allySwing = bi => setG(s=>{"],
  ["foeSwing",     "  function foeSwing(s){"],
  /* finishBlock/confirmDefPay (v2.39) are new, not in RULES_FNS — the
     ledger covers exactly the seven the roadmap names, deliberately not
     grown here — but they still need their own anchors or their bodies
     would be silently swallowed into takeIt's slice (finishBlock, defined
     just before it) or newTurn's (confirmDefPay, defined just after). */
  ["finishBlock",  "  const finishBlock = (s, clashDef, defBonus) => {"],
  ["takeIt",       "  const takeIt = () => setG(s=>{"],
  ["confirmDefPay","  const confirmDefPay = pay => setG(s=>{"],
  ["newTurn",      "  function newTurn(s){"],
  ["__end",        "  const toks = ["]
];

const srcOf = a => SOURCES[a[2] || "html"];

const OFFSETS = (() => {
  const out = {};
  for(const a of ANCHORS){
    const [name, decl] = a;
    const text = srcOf(a);
    const at = text.indexOf(decl);
    if(at < 0) throw new Error("anchor not found (did the declaration change?): " + name);
    if(text.indexOf(decl, at + 1) >= 0) throw new Error("anchor is not unique: " + name);
    out[name] = at;
  }
  return out;
})();

/* A body is bounded by the next anchor IN THE SAME SOURCE — bounding it by
   the next anchor in the list would slice one file with another's offset. */
function bodyOf(name){
  const i = ANCHORS.findIndex(a => a[0] === name);
  if(i < 0) throw new Error("not an anchored function: " + name);
  const text = srcOf(ANCHORS[i]);
  const here = ANCHORS[i][2] || "html";
  const next = ANCHORS.slice(i + 1).find(a => (a[2] || "html") === here);
  return text.slice(OFFSETS[name], next ? OFFSETS[next[0]] : text.length);
}

/* THE RULES CORE — exactly the seven functions ROADMAP-MULTIPLAYER.md names
   ("`Battle` holds runOps, execute, resolveStack, newTurn, takeIt, tryPlay,
   foeSwing — the entire rules core"). All seven resolve game effects and so
   must speak in ACTOR terms. Keeping the denominator honest matters: a
   ledger that quietly omits two functions makes the remaining work look
   smaller than it is. */
const RULES_FNS = ["runOps", "execute", "resolveStack", "tryPlay", "takeIt",
                   "newTurn", "foeSwing"];

/* Migrated to act()/foe(). Add a name here ONLY together with its edit. */
const MIGRATED = ["runOps", "execute", "resolveStack", "tryPlay", "takeIt"];
/* Still on perspective helpers — the remaining Phase A step-1 work.
   Both are entangled with the DUMMY specifically rather than with a generic
   opponent (`foeSwing` is the scripted [3,4,5] escalation; `newTurn` refills
   the dummy to DUMMY_INT every turn to stand in for the turn it never
   takes). Migrating them is best done together with giving seat 1 a real
   action phase, which is what replaces both behaviours. */
const PENDING  = ["newTurn", "foeSwing"];

const PERSPECTIVE = /\b(you|opp|youMut|oppMut)\(/g;
const hits = s => (s.match(PERSPECTIVE) || []);

/* ---- the extractor must be trustworthy before it can be a guard ------ */
test("the anchors are unique and in true file order", () => {
  /* Order is only meaningful WITHIN a source, and the grouping matters:
     interleaving two files' anchors would make a body run to an offset
     taken from the other file — a slice that is silently too long or
     empty, which is a guard that reports green while scanning nothing. */
  for(const key of Object.keys(SOURCES)){
    const inSrc = ANCHORS.filter(a => (a[2] || "html") === key);
    for(let i = 1; i < inSrc.length; i++)
      assert.ok(OFFSETS[inSrc[i][0]] > OFFSETS[inSrc[i-1][0]],
        `ANCHORS are out of file order at ${inSrc[i][0]} — reorder the list to match ${key}`);
  }
  const seen = ANCHORS.map(a => (a[2] || "html"));
  assert.deepEqual(seen, [...new Set(seen)].flatMap(k => seen.filter(x => x === k)),
    "ANCHORS must be grouped by source, not interleaved");
});

test("bodyOf extracts a real, complete function body", () => {
  const b = bodyOf("runOps");
  assert.ok(b.includes('k==="draw"'), "runOps body missing its first op");
  assert.ok(b.includes('k==="noop"'), "runOps body missing its last op");
  /* must stop at runOps and not swallow the next function */
  assert.ok(!b.includes("const execute ="), "body ran past the function end");
  /* and must not start early */
  assert.ok(!b.includes("const dummyDefence"), "body started before the function");
});

/* ---- the guard the roadmap asks for --------------------------------- */
for(const name of MIGRATED){
  test(`${name} is migrated — no perspective helper survives in it`, () => {
    const found = hits(bodyOf(name));
    assert.deepEqual(found, [],
      `${name} is on the MIGRATED list but still calls ${[...new Set(found)].join(", ")}. ` +
      "A rules function must resolve relative to s.actor (act/foe/actMut/foeMut), " +
      "never a hardcoded seat. See ROADMAP-MULTIPLAYER.md Phase A step 1.");
  });

  test(`${name} actually uses the actor helpers`, () => {
    const b = bodyOf(name);
    assert.ok(/\b(act|foe|actMut|foeMut)\(/.test(b),
      `${name} claims to be migrated but references no actor helper at all`);
  });

  /* A LITERAL SEAT INDEX is the same bug as you(), wearing a different hat.
     `popRunechants(n, 0, …)` popped seat 0's runechants whoever was swinging
     — correct today, wrong the moment seat 1 attacks. Reaching into
     `sides[0]`/`sides[1]` by hand inside a rules function is the same thing.
     Use actorOf(n) / act() / foe() instead. */
  test(`${name} indexes no seat literally`, () => {
    const b = bodyOf(name);
    const bad = b.match(/sides\s*\[\s*[01]\s*\]/g) || [];
    assert.deepEqual(bad, [],
      `${name} indexes a seat literally (${[...new Set(bad)].join(", ")}). ` +
      "A rules function must derive the seat from s.actor — use actorOf(n), act() or foe().");
  });
}

/* PENDING is pinned so finishing one is a deliberate edit, and so the
   remaining work stays a number instead of a memory. */
test("the actor-migration ledger is exhaustive and honest", () => {
  assert.deepEqual([...MIGRATED, ...PENDING].sort(), [...RULES_FNS].sort(),
    "every rules function must be classified as MIGRATED or PENDING");
  assert.equal(MIGRATED.filter(n => PENDING.includes(n)).length, 0,
    "a function cannot be both migrated and pending");
  for(const name of PENDING){
    assert.ok(hits(bodyOf(name)).length > 0,
      `${name} is listed PENDING but no longer uses any perspective helper — ` +
      "move it to MIGRATED (and check it uses act/foe rather than nothing at all)");
  }
});

/* ---- the helpers themselves ----------------------------------------- */
/* act/foe are trainer-local, so exercise their SEMANTICS here rather than
   importing them: with actor 0 they must agree with you/opp, and with
   actor 1 they must swap. This is the property the whole migration rests
   on — it is what makes every swap behaviour-identical today. */
test("act/foe semantics: actor 0 agrees with you/opp, actor 1 swaps", () => {
  const A = {id:0}, B = {id:1};
  const actorOf = s => s.actor||0;
  const act = s => s.sides[actorOf(s)];
  const foe = s => s.sides[1-actorOf(s)];

  const s0 = {sides:[A,B], actor:0};
  assert.equal(act(s0), A, "actor 0 acts as seat 0");
  assert.equal(foe(s0), B, "actor 0's opponent is seat 1");

  const s1 = {sides:[A,B], actor:1};
  assert.equal(act(s1), B, "actor 1 acts as seat 1");
  assert.equal(foe(s1), A, "actor 1's opponent is seat 0");

  /* the default matters: an absent actor must mean seat 0, or every
     un-migrated caller changes behaviour the day the field is introduced */
  const sd = {sides:[A,B]};
  assert.equal(act(sd), A, "a missing actor must default to seat 0");
  assert.equal(foe(sd), B, "a missing actor must default its foe to seat 1");
});

/* The Mut helpers must clone the ACTOR's seat, and must not disturb the
   other one — the access rule, stated in actor terms. */
test("actMut/foeMut clone the correct seat and leave the other identical", () => {
  const mk = () => ({sides:[{id:0,hp:20},{id:1,hp:42}]});
  const youMut = n => { n.sides = [{...n.sides[0]}, n.sides[1]]; return n.sides[0]; };
  const oppMut = n => { n.sides = [n.sides[0], {...n.sides[1]}]; return n.sides[1]; };
  const actorOf = s => s.actor||0;
  const actMut = n => actorOf(n)===0 ? youMut(n) : oppMut(n);
  const foeMut = n => actorOf(n)===0 ? oppMut(n) : youMut(n);

  for(const actor of [0,1]){
    const orig = mk(); orig.actor = actor;
    const before = orig.sides.slice();
    const n = {...orig};
    const m = actMut(n);
    assert.notEqual(m, before[actor], "actMut must hand back a FRESH seat");
    assert.equal(n.sides[1-actor], before[1-actor], "actMut must not clone the other seat");
    m.hp -= 4;
    assert.equal(before[actor].hp, actor===0?20:42, "the write must not reach the original");

    const n2 = {...mk(), actor};
    const b2 = n2.sides.slice();
    const f = foeMut(n2);
    assert.notEqual(f, b2[1-actor], "foeMut must hand back a FRESH opposing seat");
    assert.equal(n2.sides[actor], b2[actor], "foeMut must not clone the acting seat");
  }
});

/* `actor` is shared state, not per-side, and the sides drill fails any
   unclassified top-level key — so it must be registered in GAME_KEYS. */
test("actor is registered as a shared game key", () => {
  const S = require("../engine/sides.js");
  assert.ok(S.GAME_KEYS.includes("actor"),
    "actor must be in GAME_KEYS or toSides/fromSides drops it and the state literal drill fails");
  assert.ok(!S.SIDE_FIELDS.includes("actor"),
    "actor names one of the two seats — it must NOT live on a side");
  assert.equal(S.makeGame({}).actor, 0, "a fresh game must open with seat 0 acting");
  assert.equal(S.makeGame({firstPlayer:1}).actor, 1,
    "when the opponent is seated first, it is also the opening actor");
});

/* The seat-hardcoded engine helpers are gone and must stay gone — they are
   the exact conflation this migration undoes, and `foe` coming back would
   collide with the trainer's actor-relative one under DIFFERENT semantics. */
test("engine/sides.js exports no seat-hardcoded you/foe", () => {
  const S = require("../engine/sides.js");
  assert.equal(S.you, undefined, "sides.js must not re-export a seat-hardcoded `you`");
  assert.equal(S.foe, undefined,
    "sides.js must not export `foe` — it would collide with the trainer's actor-relative foe()");
});
