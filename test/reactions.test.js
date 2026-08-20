/* ============================================================
   AN ATTACK REACTION RESOLVES ONTO THE OPEN LINK (v3.11)

   `linkPumps` has read `{k:"rx"}` layers off the stack since v2.77, and
   **only the trainer ever pushed one.** At the table an attack reaction
   was played legally, left the hand and paid its cost — and its pump fell
   through to `buffNext`, so it landed on the player's NEXT attack while
   the current one resolved for its base. The feed said so in as many
   words: *"+3 power queued for your next attack."*

   Sev-2, the category the player TRUSTS: nothing refused, nothing failed,
   and the number on screen was simply wrong. **14 pool cards across four
   heroes** — eight of them Dorinthea's, which is her whole reaction game.

   The printed TARGET RESTRICTION was gone with it. `buffNext` asks no
   qualifier, so at the table Puncture ("target sword or dagger attack")
   pumped whatever happened to be swinging — the v2.30 arrow-buff-on-a-
   sword shape, on the board where nobody had looked.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../engine/parser");
const J = require("../engine/judge");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached DB — run: node tools/audit.js";

/* A judge-shaped game standing in the reaction step, with a declared
   attack the acting seat owns. Cards get real uids — `H.card` returns
   `uid: null`, so a hand of them all answer to the same lookup. */
function reacting(handCards, atkName){
  const atk = {...H.card(atkName || "Raging Onslaught", 1), uid: "atk1"};
  const hand = handCards.map((c, i) => ({...c, uid: "h" + i}));
  let g = {...H.state({hand: [atk, ...hand], res: 9}, {}, {turn: 3, actor: 0}),
           phase: "action", step: "layer", priority: 0, passed: [],
           firstPlayer: 0, round: 1, over: null};
  g = J.reduce(g, {t: "play", uid: "atk1", from: "hand"}, 0).state;
  for(let i = 0; i < 8 && g.step !== "reaction"; i++){
    const o = J.reduce(g, {t: "pass"}, g.priority);
    if(o.error) break;
    g = o.state;
  }
  return {g, atk};
}

test("the pump reaches the attack on the chain, not the next one", {skip}, () => {
  H.db();
  const rx = H.card("Stains of the Redback", 1);          /* +3, no qualifier */
  const {g, atk} = reacting([rx]);
  assert.equal(g.step, "reaction", "standing in the right window");
  assert.equal(g.pend.total, atk.power, "base before the reaction");

  const out = J.reduce(g, {t: "play", uid: "h0", from: "hand"}, 0);
  assert.ok(!out.error, out.error || "the play must be legal");
  const n = out.state;
  assert.deepEqual((n.stack || []).map(l => l.k), ["rx"], "a reaction layer is on the stack");
  const pre = J.withEffects(n, (fx, s) => fx.linkPumps(s, {equipDefenders: 0}));
  assert.equal(pre.total, atk.power + 3, "and linkPumps reads it into the total");
  assert.equal(n.sides[0].buffNext, 0,
    "NOT queued for the next attack — that was the bug, and the feed announced it");
});

test("a printed target restriction refuses the PLAY, before the card is spent", {skip}, () => {
  H.db();
  const rx = H.card("Puncture", 1);                        /* target sword or dagger */
  const {g} = reacting([rx]);
  const why = J.legal(g, {t: "play", uid: "h0", from: "hand"}, 0);
  assert.match(String(why), /sword or dagger/, "refused by NAME, with the reason");

  const out = J.reduce(g, {t: "play", uid: "h0", from: "hand"}, 0);
  assert.ok(out.error, "and the reducer agrees with legal");
  assert.ok(g.sides[0].hand.some(c => c.uid === "h0"),
    "a play the rules never allowed must not cost the player the card");
});

test("an unqualified reaction is still allowed", {skip}, () => {
  H.db();
  const {g} = reacting([H.card("Stains of the Redback", 1)]);
  assert.equal(J.legal(g, {t: "play", uid: "h0", from: "hand"}, 0), null,
    "the restriction must gate only the cards that print one");
});

/* ---- THE SHARED BODY ------------------------------------------------- */

test("attackRx refuses when there is no attack to react to", {skip}, () => {
  H.db();
  const rx = H.card("Stains of the Redback", 1);
  const g = H.state({res: 9}, {}, {turn: 3, actor: 0});
  const out = J.withEffects(g, (fx, s) => { const r = fx.attackRx(s, rx, {}); assert.ok(r.why); return s; });
  assert.ok(out);
});

test("the reprise count is the CALLER's answer, never read from a board", {skip}, () => {
  H.db();
  const EFX = require("fs").readFileSync(require("path").join(__dirname, "..", "engine", "effects.js"), "utf8");
  const ai = EFX.indexOf("const attackRx = (s, c, o) =>");
  const body = EFX.slice(ai, EFX.indexOf("  /* PIECE ONE", ai));
  /* The trainer files declared defenders as `{k:"def"}` layers on the
     stack; judge.js holds them on `blockH`. A shared body that reads
     either representation is one the other board cannot call — which is
     exactly how phantasm came to be inert at the table (v3.00). */
  assert.ok(/o\.handBlockers/.test(body), "it must take the count as an argument");
  assert.ok(!/k\s*===\s*"def"/.test(body), "and must not go looking for the trainer's layers");
  assert.ok(!/blockH/.test(body), "nor for judge's");
});

test("14 pool attack reactions pump, and that is the blast radius", {skip}, () => {
  H.db();
  const cards = require("../tools/audit.json").cards;
  let n = 0;
  for(const k of Object.keys(cards)){
    const c = cards[k];
    if(!/attack reaction/i.test(c.tt || "")) continue;
    const full = H.card(c.name, c.pitch);
    if(!full) continue;
    P.fxReset && P.fxReset();
    if((P.fxParse(full).self || 0) > 0) n++;
  }
  assert.equal(n, 14, "every one of these was landing on the wrong attack at the table");
});

/* ============================================================
   "CHOOSE 1;" IS A CHOICE, AND IT WAS BEING SUMMED (v3.12)
   ============================================================ */

test("a modal reaction reads its modes apart, never added together", {skip}, () => {
  H.db();
  /* Pummel prints +4 in EACH of two modes and granted +8; Two Sides to
     the Blade printed +3 and granted +6. Both literally double. */
  for(const [nm, each] of [["Pummel", 4], ["Two Sides to the Blade", 3]]){
    P.fxReset && P.fxReset();
    const fx = P.fxParse(H.card(nm, 1));
    assert.equal((fx.modes || []).length, 2, nm + ": two printed modes");
    assert.ok(fx.modes.every(m => m.self === each), nm + `: each mode prints +${each}`);
    assert.ok(fx.self <= each, nm + `: the card must never carry the SUM (${each * 2})`);
  }
});

test("the board picks the mode, and an unreadable restriction is not selectable", {skip}, () => {
  H.db();
  const sledge = {...H.card("Sledge of Anvilheim", 0), uid: "w1"};   /* Hammer */
  const g = {...H.state({res: 9}, {}, {turn: 3, actor: 0}),
             pend: {card: sledge, by: 0, total: sledge.power, ga: false, ops: [], onHit: []},
             stack: []};
  const out = J.withEffects(g, (fx, s) => {
    const r = fx.attackRx(s, H.card("Pummel", 1), {handBlockers: 0});
    assert.equal(r.why, null, "a hammer satisfies mode 1");
    assert.equal(r.pump, 4, "and gets the ONE mode's +4, not +8");
    return r.game;
  });
  const pre = J.withEffects(out, (fx, s) => fx.linkPumps(s, {equipDefenders: 0}));
  assert.equal(pre.total, sledge.power + 4,
    "driven: 6 -> 10. It was 14 before v3.12");
});

test("a modal reaction with no legal mode is refused, not silently applied", {skip}, () => {
  H.db();
  const plain = {...H.card("Raging Onslaught", 1), uid: "a1"};   /* neither hammer nor stealth */
  const g = {...H.state({res: 9}, {}, {turn: 3, actor: 0}),
             pend: {card: plain, by: 0, total: plain.power, ga: false, ops: [], onHit: []},
             stack: []};
  J.withEffects(g, (fx, s) => {
    const r = fx.attackRx(s, H.card("Pummel", 1), {handBlockers: 0});
    assert.match(String(r.why), /no mode/, "refused by name");
    assert.equal(r.pump, 0);
    return s;
  });
});

/* ---- THE GRANTED RIDER LANDS ON THE ATTACK, NOT THE REACTION -------- */

test("a targeted grant stamps its rider onto the open link", {skip}, () => {
  H.db();
  const cards = require("../tools/audit.json").cards;
  const dg = Object.keys(cards).map(k => cards[k])
    .find(c => /dagger/i.test(c.tt || "") && /weapon/i.test(c.tt || ""));
  const dagger = {...H.card(dg.name, 0), uid: "w1"};
  const g = {...H.state({res: 9}, {}, {turn: 3, actor: 0}),
             pend: {card: dagger, by: 0, total: dagger.power || 1, ga: false, ops: [], onHit: []},
             stack: []};
  const out = J.withEffects(g, (fx, s) => fx.attackRx(s, H.card("Scar Tissue", 1), {handBlockers: 0}).game);
  /* A reaction never hits anything itself, so "target dagger attack gets
     +3{p} and \"When this hits a hero, mark them\"" belongs to the ATTACK. */
  assert.deepEqual(out.pend.onHit, [["mark", 1]],
    "the rider rides on the link, where linkPayload fires it if it connects");
});

test("the fairness sweep would catch the doubling — MODAL-SUMMED exists", () => {
  const fs2 = require("fs"), path2 = require("path");
  const src = fs2.readFileSync(path2.join(__dirname, "..", "tools", "fairness.js"), "utf8");
  /* Check 2 (VALUE-DOUBLED) looks for one printed value applied by two
     PATHS. A modal sum prints the value TWICE and consumes both, so there
     is only ever one path and nothing to compare — which is why a
     doubling this plain went unreported for the tool's whole existence,
     and why the shape needed its own check rather than a widening. */
  assert.match(src, /MODAL-SUMMED/, "the check must exist");
  assert.ok(src.indexOf("choose") >= 0, "and it must key off the printed 'Choose N'");
  /* VERIFIED BY SABOTAGE, not assumed: disabling the parser's modal branch
     makes `npm run fairness` report both cards with their printed numbers
     — "prints 4 / 4 across its modes and the card grants 8". */
  assert.match(src, /fx\.modes/, "and RESTRICTION-DROPPED must know modes carry their own qualifier");
});
