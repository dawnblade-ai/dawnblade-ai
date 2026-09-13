/* ============================================================
   CR 1.4.5 AT THE TABLE — THE DECLARATION THE UI COULD NOT MAKE (v4.45)

   > "If a player plays, activates, or triggers an attack or attack-layer,
   >  the player MUST declare an attackable object controlled by an
   >  opponent as the attack-target."                        — CR 1.4.5

   `judge.reduce` has declared, validated and resolved attack-targets
   since v2.45 and `targets()` has answered the list for as long. What
   nothing checked is whether the BOARD A PLAYER USES can say it.

   FOUR DEFECTS, ONE FAMILY: two shapes for one fact.

   `targets()` answers ENTRIES — a card object carrying `_target` and
   `_life`, because a rail and a prompt sheet both render a card frame.
   An ACTION carries a SPEC: `"hero"`, or an ally's UID.

   1. THE TABLE SENT THE ENTRY. `targetOf` then answers null and `legal`
      refuses with "no such attack-target" — so the moment the opposing
      board held ONE LIVING ALLY, **no attack could be played at all**. A
      hard block, not a wrong target: the tap produced a refusal and there
      was no way forward.
   2. THE WEAPON SWING carried no target, so the rail's selection was
      discarded and every swing went at the hero. It cannot be gated on
      `isAttack` — a weapon's type line carries no "Attack" (v3.43).
   3. THE ARSENAL PLAY bypassed the helper entirely.
   4. THE ARENA ROW COULD ONLY ZOOM, so the whole board-attack route —
      built at v3.44 for allies and v3.84 for auras — had no caller here.
      Measured: 10 attacking allies in the pool, and the four ward-bearing
      auras Cosmo turns into weapons, which is Enigma's whole engine.
      v3.50's sentence at the UI.

   AND `npm run play` COULD NEVER HAVE FOUND ANY OF IT. `sparring.targetFor`
   answers `kill.uid` or `"hero"` — the CORRECT shape — so the
   policy-versus-policy ladder cannot reach the defect at all. It is a real
   limit of that instrument, the same kind v4.31 recorded for mirrors: a
   defect that needs a HUMAN UI on one side is invisible to it.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const H = require("./helpers/judged.js");
const J = H.J;
const PR = require("../engine/parser.js");

const ROOT = path.join(__dirname, "..");
/* CODE ONLY. A naming scan that counts comments reports a field as sent
   when a sentence merely mentions it (v4.27, v4.44). */
const stripComments = src => src
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");
const HTML = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const TABLE = stripComments(HTML.slice(HTML.indexOf("function TableBoard(")));

const ATK  = {uid: 301, name: "Probe Swing", tt: "Generic Attack Action",
              ty: ["Generic", "Action", "Attack"], power: 4, cost: 0, pitch: 1, def: 2, tx: ""};
const SWAB = {uid: 401, name: "Swabbie", tt: "Pirate Ally", ty: ["Pirate", "Ally"],
              power: 2, life: 3, cost: 1, tx: ""};
const WPN  = {uid: 501, name: "Testblade", tt: "Warrior Weapon - Sword",
              ty: ["Warrior", "Weapon"], power: 3, def: null, cost: 0,
              tx: "Once per Turn Action - {r}: Attack"};
/* MY OWN ally, so the arena route has something to activate. */
const MINE = {uid: 402, name: "Deckhand", tt: "Pirate Ally", ty: ["Pirate", "Ally"],
              power: 2, life: 3, cost: 1, tx: "Action - {r}: Attack"};

const board = (o) => {
  H.db();
  const g = H.state({hand: [ATK], gear: [WPN], res: 3, ...(o || {})},
    {hp: 20, board: [{uid: 401, kind: "ally", card: SWAB, life: 3}]});
  const n = {...g, phase: "action", step: "layer", priority: 0, turnPlayer: 0, actor: 0};
  n.sides[0] = {...n.sides[0], ap: 1};
  return n;
};
const entries = g => J.targets(g, 1, {name: "Foe", tt: "Hero", tx: ""});

/* ---- the one reader ---------------------------------------------------- */

test("`targetSpec` converts a display ENTRY into an action's spec", () => {
  const T = entries(board());
  assert.equal(T.length, 2, "the fixture's ally is not attackable — check `kind` and `life`");
  assert.equal(J.targetSpec(T[0]), "hero");
  assert.equal(J.targetSpec(T[1]), 401, "an ally's spec is its UID");
  /* AN ABSENT ENTRY ANSWERS THE HERO, which is the choice that is always
     available (CR 1.4.5a) and the one `targetOf` already defaults to. */
  assert.equal(J.targetSpec(null), "hero");
  assert.equal(J.targetSpec(undefined), "hero");
  assert.equal(J.targetSpec({}), "hero");
});

test("the two shapes are NOT interchangeable — ask for the refusal", () => {
  /* THIS IS THE BUG, AS A DRILL (v3.98: a check that only asks for
     MATCHES cannot see it). The entry and the spec are both truthy
     objects-or-values a UI could plausibly send, and only one is read. */
  const g = board(), T = entries(g);
  const act = t => ({t: "play", uid: 301, from: "hand", target: t});
  assert.equal(J.legal(g, act(J.targetSpec(T[1])), 0), null, "the SPEC must be accepted");
  assert.equal(J.legal(g, act(T[1]), 0), "no such attack-target",
    "the raw ENTRY must be refused — if the reducer starts accepting it, the two shapes " +
    "have merged and `targetSpec` is no longer the only reader");
  assert.equal(J.legal(g, act(T[0]), 0), "no such attack-target",
    "and the HERO entry too — that is what made this a hard block rather than a wrong target");
  /* AND OMITTING IT IS SILENTLY THE HERO, which is why defect 2 was
     invisible: the swing worked, at the wrong target, with no refusal. */
  assert.equal(J.legal(g, {t: "play", uid: 301, from: "hand"}, 0), null);
});

/* ---- every route that declares an attack ------------------------------- */

const lands = (g, a) => {
  const r = J.reduce(g, a, 0);
  assert.ok(!r.error, a.t + ": " + r.error);
  return r.state.pend && r.state.pend.target;
};

test("driven — a card from HAND declares the ally", () => {
  const g = board(), T = entries(g);
  assert.deepEqual(lands(g, {t: "play", uid: 301, from: "hand", target: J.targetSpec(T[1])}),
    {kind: "ally", side: 1, uid: 401});
  assert.deepEqual(lands(board(), {t: "play", uid: 301, from: "hand", target: J.targetSpec(T[0])}),
    {kind: "hero", side: 1, uid: null});
});

test("driven — a WEAPON SWING declares the ally", () => {
  /* THE ONE `isAttack` CANNOT GATE. A weapon's type line carries no
     "Attack" (v3.43), so a target threaded only on that predicate leaves
     every swing at the hero — and CR 1.4.5 names an attack-LAYER, which
     an activated weapon attack is. */
  assert.equal(PR.isAttack(WPN), false, "the premise: a weapon is not an `isAttack` card");
  const g = board(), T = entries(g);
  assert.deepEqual(lands(g, {t: "activate", uid: 501, target: J.targetSpec(T[1])}),
    {kind: "ally", side: 1, uid: 401});
});

test("driven — an ARENA attack declares the ally", () => {
  /* THE ROUTE THE TABLE COULD NOT REACH AT ALL. `boardAttackOf` is how the
     tile asks, so the UI reads no card text and there is one reader of an
     aura's power being its printed ward (v3.84). */
  const g = board();
  g.sides[0] = {...g.sides[0], board: [{uid: 402, kind: "ally", card: MINE, life: 3}]};
  const bp = J.boardAttackOf(g, 0, 402);
  assert.ok(bp && bp.kind === "ally", "boardAttackOf stopped answering for an ally");
  const T = entries(g);
  assert.deepEqual(lands(g, {t: "activate", uid: 402, target: J.targetSpec(T[1])}),
    {kind: "ally", side: 1, uid: 401});
});

test("driven — the ARSENAL route declares it too", () => {
  const g = board({hand: [], arsenal: ATK});
  const T = entries(g);
  assert.deepEqual(lands(g, {t: "play", uid: 301, from: "arsenal", target: J.targetSpec(T[1])}),
    {kind: "ally", side: 1, uid: 401});
});

/* ---- the table's own source ------------------------------------------- */

test("the table sends a SPEC and never a raw entry", () => {
  /* A SOURCE SCAN IS A LEAD LIST (v3.17) and it cannot tell a live control
     from a dead one (v4.00). What it CAN say is that no `target:` in this
     board is built any way but through the one reader — which is exactly
     the defect: four expressions, three of them wrong or missing. */
  /* BOTH SPELLINGS. `playAct` ASSIGNS (`a.target = …`) and `actAct` uses a
     KEY (`target: …`) — a scan aimed at one found a single expression and
     reported the other route as carrying nothing, which looks exactly like
     the defect it is checking for (v3.81, v4.07). */
  const tg = [...TABLE.matchAll(/(?:target\s*:|\.target\s*=)\s*([^,;}\n]+)/g)].map(m => m[1].trim());
  assert.ok(tg.length >= 2, "found " + tg.length + " target expressions — the scan is aimed wrong");
  for(const e of tg)
    assert.ok(/tgtSpec\(\)/.test(e), "the table builds an action target as `" + e
      + "` — every one must come from `tgtSpec()`, which is `judge.targetSpec`");
  assert.ok(/DawnJudge\.targetSpec/.test(TABLE),
    "the table stopped asking judge for the conversion");
});

test("every attack-declaring route at the table carries one", () => {
  /* THE CENSUS, not a list. Each of these is a route `judge.reduce` reads
     `a.target` on, and each was a separate omission. */
  assert.ok(/const playAct = /.test(TABLE) && /const actAct = /.test(TABLE),
    "the two helpers that carry the target are gone");
  /* NO ACTIVATE MAY BE BUILT OUTSIDE `actAct`, or it is defect 2 again —
     the swing and the arena tile each built their own and neither said a
     target. TWO exemptions, and BOTH are named rather than matched
     loosely, because what makes them safe is the same fact: neither is an
     ATTACK, so CR 1.4.5 does not apply and `targetOf` is never asked
     about it.

       `from:"hero"`  the hero power
       `uid:b.uid`    an arena permanent's ABILITY (v4.47) — the arena tile
                      offers the attack through `actAct` and the ability
                      bare, because sending a target on an ability is a
                      field `legal` never validates

     THE EXEMPTION IS AN ALLOW-LIST AND NOT A WIDENING (v3.35, v3.80): a
     third shape that is not one of these two fails here, which is the
     moment somebody states whether it declares an attack.

     `actAct`'s OWN two branches are excluded by bounding its body, because
     it is the thing every other route is required to call — and its
     no-target branch is correct: with no ally on the board there is no
     choice to make, and an omitted target reads as the hero. */
  const ai = TABLE.indexOf("const actAct = ");
  assert.ok(ai > 0, "`actAct` is gone");
  const rest = TABLE.slice(ai + 1);
  const bodyEnd = ai + 1 + (rest.match(/\n  const /) || {index: 400}).index;
  const outside = TABLE.slice(0, ai) + TABLE.slice(bodyEnd);
  const inline = [...outside.matchAll(/\{\s*t\s*:\s*"activate"[^}]*\}/g)].map(m => m[0].replace(/\s+/g, " "));
  const EXEMPT = [/from\s*:\s*"hero"/,
                  /^\{\s*t\s*:\s*"activate",\s*uid\s*:\s*b\.uid\s*\}$/];
  for(const a of inline)
    assert.ok(EXEMPT.some(rx => rx.test(a)),
      "an `activate` action is built outside `actAct` at the table: " + a
      + " — a swing or an arena attack must go through it, or it declares the hero silently");
  /* BOTH HALVES OR THE CENSUS PROVES NOTHING (v3.98). A scan that only
     ever finds exempt literals passes vacuously on a table that built
     none — so the exemptions must actually be PRESENT. */
  assert.ok(inline.some(a => /from\s*:\s*"hero"/.test(a)),
    "the hero-power exemption is gone — the scan is passing on nothing");
  assert.ok(inline.some(a => /uid:b\.uid/.test(a)),
    "the arena-ability exemption is gone — either the route left or the scan is aimed wrong");
  /* AND NEITHER MAY A `play`, which is defect 3 — the arsenal card built
     its own action and so declared the hero whatever the rail said. The
     scan needs BOTH verbs: aimed at `activate` alone it came back silent
     against a sabotage that put the arsenal's inline literal back (v3.62,
     and the census half of v4.44's own lesson). */
  const pi = TABLE.indexOf("const playAct = ");
  assert.ok(pi > 0, "`playAct` is gone");
  const prest = TABLE.slice(pi + 1);
  const pEnd = pi + 1 + (prest.match(/\n  const /) || {index: 400}).index;
  const outP = TABLE.slice(0, pi) + TABLE.slice(pEnd);
  const inlineP = [...outP.matchAll(/\{\s*t\s*:\s*"play"[^}]*\}/g)].map(m => m[0].replace(/\s+/g, " "));
  assert.deepEqual(inlineP, [],
    "a `play` action is built outside `playAct` at the table: " + inlineP.join(" · ")
    + " — every play route must go through it, or it declares the hero silently");
  /* AND THE ARENA ROW HAS AN ACTIVATION AT ALL (defect 4). Its only
     handler was `setZoom`. */
  const row = TABLE.slice(TABLE.indexOf("InPlayRow entries={me.board}"));
  const cell = row.slice(0, row.indexOf("/>"));
  assert.ok(/boardAttackOf/.test(cell) && /actAct\(/.test(cell),
    "your own arena row cannot activate anything — the ally and aura attack routes " +
    "have no caller at the table, which is what v4.45 fixed");
});

test("the rail names the HERO, not two allies", () => {
  /* THE LABEL READ `t.kind` AND AN ENTRY KEEPS IT AT `t._target.kind`, so
     it was undefined and BOTH buttons read "ally" — the same
     two-shapes-for-one-fact defect, in the one place a player looks to
     tell the choices apart. The observable is the ENTRY's own shape. */
  const T = entries(board());
  assert.equal(T[0].kind, undefined,
    "an entry now carries a bare `kind` — then the rail's old label was right and this " +
    "drill is about a shape that no longer exists");
  assert.equal(T[0]._target.kind, "hero");
  assert.equal(T[1].name, "Swabbie", "an entry IS the card, so an ally can be NAMED — " +
    "two Swabbies are otherwise two identical buttons");
  assert.equal(T[1]._life, 3);
  assert.ok(/_target\.kind\s*===\s*"hero"/.test(TABLE),
    "the rail's label is not reading `_target.kind` — both buttons will say the same thing");
});

test("the POLICY sends the right shape, which is why the ladder never saw this", () => {
  /* RECORDED AS A LIMIT OF THE INSTRUMENT (v4.31's mirror, one field
     over). `npm run play` drives `sparring.act` in both seats and its
     `targetFor` answers `kill.uid` or `"hero"` — so 210 games a version
     could not reach a defect that needs a human UI on one side. */
  const SP = fs.readFileSync(path.join(ROOT, "engine", "sparring.js"), "utf8");
  assert.ok(/return kill \? kill\.uid : "hero";/.test(SP),
    "`sparring.targetFor` no longer answers a uid-or-hero spec — if it now answers an " +
    "ENTRY the ladder has inherited the table's old bug, and if it asks `targetSpec` " +
    "then the two boards share a reader and this note should say so");
});
