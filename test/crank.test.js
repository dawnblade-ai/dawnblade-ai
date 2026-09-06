/* ============================================================
   CRANK — AN OPTIONAL SELF-COST AT THE MOMENT THE ITEM LANDS (v4.24)

   The database carries no reminder text for any keyword. The SDA023 face
   of Boom Grenade prints it, fetched and read:

     **Crank** (As this enters the arena, you may remove a steam counter
     from it. If you do, gain an action point.)

   TENTH TIME READING THE PRINTED CARD FIRST HAS PAID. It is the half
   v4.23's counter clock left honestly `skip`, and it is what makes the
   clock a DECISION rather than a countdown: bank the action point now and
   the grenade dies at the next upkeep, or keep the counter and buy a turn
   of uptime for the payoff trigger.

   AND THE SAME PASS FOUND THE ON-HIT TRIGGER READING A SUBJECT IT NEVER
   HAD. `onHit` means "when THIS hits"; the test for it was unanchored, so
   Boom Grenade's *"when a MECHANOLOGIST ATTACK ACTION CARD YOU CONTROL
   hits a hero"* was filed as the item's own on-hit — a list read only
   from `pend`, which an Item never opens. The clause read `run`, counted
   as covered, and did nothing.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const P = require("../engine/parser.js");
const PR = require("../engine/prompts.js");
const E = require("../engine/effects.js");
const H = require("./helpers/judged.js");
const J = H.J;

const skip = !H.hasDb() && "no cached card database";
const mk = (nm, p, uid) => Object.assign({}, H.card(nm, p), {uid});
const steam = (n, uid) => ((n.sides[0].counters || {})[uid] || {}).steam || 0;

/* ---- 1. THE KEYWORD'S PARAMETERS ---------------------------------- */

test("crank's kind, amount and payload are the KEYWORD's, off the printed reminder text", {skip}, () => {
  H.db();
  for(const p of [1, 2, 3])
    assert.deepEqual(P.crankCost(H.card("Boom Grenade", p)),
      {kind: "steam", n: 1, ops: [["ap", 1]]},
      "no printing carries a number, so the parameters are the keyword's own " +
      "and live in ONE place with the printing cited — the same treatment " +
      "suspense's two counters get");
  assert.equal(P.crankCost(H.card("Hyper Driver", 1)), null,
    "a card in the same family that does not print the keyword gets nothing");
});

test("`printedKw`, NEVER `hasKw` — and the pool cannot tell them apart", {skip}, () => {
  H.db();
  /* Measured: all four pool records that mention crank also PRINT it, so
     the discriminator is silent against every real fixture and the
     near-miss has to be synthetic (v3.73). An ability a keyword NAMES is
     carried as printed rules text or it is not — v2.84's three questions. */
  const mention = {name: "Crank Probe Mention", pitch: 0, tt: "Mechanologist Action - Item",
                   ty: ["Mechanologist", "Action", "Item"], kw: [], cost: 0, power: null,
                   tx: "When you crank a permanent you control, draw a card."};
  assert.equal(P.hasKw(mention, "crank"), true, "the text mentions it");
  assert.equal(P.crankCost(mention), null,
    "…and mentioning the mechanic is not printing the keyword, so no offer is made");

  const prints = {...mention, name: "Crank Probe Prints", tx: "Crank\n\nThis does nothing else."};
  assert.deepEqual(P.crankCost(prints), {kind: "steam", n: 1, ops: [["ap", 1]]},
    "the positive control — a keyword on a line of its own");
});

test("the clause is a `noop` whose reason names a reader that EXISTS", () => {
  const r = P.classifyClause("Crank");
  assert.equal(r.status, "noop");
  assert.equal(/parser\.|\bv\d\.\d\d\b|\.js\b/.test(r.ops[0][1]), false,
    "a noop's reason is printed VERBATIM into the feed by runOps, so it is " +
    "player-facing text and not a code comment — see noopvoice.test.js");
});

/* ---- 2. THE OFFER, DRIVEN ----------------------------------------- */

function playGrenade(){
  const bg = mk("Boom Grenade", 1, "bg1");
  let n = H.state({name: "Dash", res: 5, ap: 1, hand: [bg], deck: [{uid: "f1", name: "F1"}]},
                  {name: "Them", deck: [{uid: "d2", name: "T"}]},
                  {actor: 0, turnPlayer: 0, seed: "z", turn: 3});
  n = {...n, phase: "action", step: "layer", priority: 0, passed: []};
  const r = J.reduce(n, {t: "play", uid: "bg1", from: "hand"}, 0);
  assert.ok(!r.error, String(r.error));
  return r.state;
}
function answer(n, choice){
  let r = J.reduce(n, {t: "promptChoose", choice}, 0);
  assert.ok(!r.error, String(r.error));
  r = J.reduce(r.state, {t: "promptConfirm"}, 0);
  assert.ok(!r.error, String(r.error));
  return r.state;
}

test("DRIVEN: taking crank spends the counter and gains the action point", {skip}, () => {
  H.db();
  let n = playGrenade();
  assert.equal(n.prompt && n.prompt.tag, "pay", "the offer is made");
  assert.deepEqual(n.prompt.spendCtr, {uid: "bg1", kind: "steam", n: 1});
  assert.equal(steam(n, "bg1"), 1,
    "AND IT IS OFFERED AFTER `ctrSelf` HAS PUT THE COUNTER ON — the card " +
    "prints \"enters the arena WITH a steam counter\" on the line below the " +
    "keyword, so a crank asked first is a crank nobody can ever pay");
  const ap0 = n.sides[0].ap;
  n = answer(n, "pay");
  assert.equal(n.sides[0].ap, ap0 + 1, "gain an action point");
  assert.equal(steam(n, "bg1"), 0, "and the counter is spent");
  /* AND THE CLOCK THEN BITES. With an empty bag the reprieve cannot be
     paid, so the grenade dies at the next upkeep — which is the whole
     trade the keyword offers. */
  assert.deepEqual(E.sweepArena(n, 0, "turn").fired, ["Boom Grenade"]);
});

test("DRIVEN: declining keeps the counter, and the grenade buys a turn with it", {skip}, () => {
  H.db();
  let n = playGrenade();
  const ap0 = n.sides[0].ap;
  n = answer(n, "decline");
  assert.equal(n.sides[0].ap, ap0, "\"you may\" — declining costs nothing and pays nothing");
  assert.equal(steam(n, "bg1"), 1);
  const sw = E.sweepArena(n, 0, "turn");
  assert.deepEqual(sw.fired, [], "and the counter it kept is what buys the next turn");
});

test("DRIVEN: the feed names the counter, not a price of zero", {skip}, () => {
  H.db();
  /* The feed is the observable in a training sim, and `pay`'s default
     lines are written for a RESOURCE cost. "declined to pay 0" is a
     number that is not the price — the sev-2 category the player trusts. */
  let a = answer(playGrenade(), "pay");
  assert.ok(a.feed.some(l => /took a steam counter off Boom Grenade/.test(l)), a.feed.slice(-3));
  let b = answer(playGrenade(), "decline");
  assert.ok(b.feed.some(l => /kept the steam counter on Boom Grenade/.test(l)), b.feed.slice(-3));
  assert.equal(b.feed.some(l => /pay 0/.test(l)), false);
});

test("DRIVEN: no counter, no offer", {skip}, () => {
  H.db();
  /* An offer the seat cannot take is a tap that teaches nothing (v3.39,
     v3.55) — and the printed cost is a counter that has to be there. */
  const bg = mk("Boom Grenade", 1, "bg1");
  bg.tx = "Crank\n\nWhen a Mechanologist attack action card you control hits a hero, destroy this and deal 4 damage to them.";
  bg.name = "Dry Grenade Probe";
  let n = H.state({name: "Dash", res: 5, ap: 1, hand: [bg], deck: [{uid: "f1", name: "F1"}]},
                  {name: "Them", deck: [{uid: "d2", name: "T"}]},
                  {actor: 0, turnPlayer: 0, seed: "z", turn: 3});
  n = {...n, phase: "action", step: "layer", priority: 0, passed: []};
  n = J.reduce(n, {t: "play", uid: "bg1", from: "hand"}, 0).state;
  assert.ok(!n.prompt, "it prints the keyword and enters with nothing to spend");
  assert.ok((n.sides[0].board || []).some(b => b.uid === "bg1"));
});

/* ---- 3. `spendCtr` IS THE FOURTH COST DATUM ----------------------- */

test("the cost leaves as DATA, and a spec only carries fields buildPrompt knows about", () => {
  /* v2.34, v3.33, v3.91, v3.93 — the tap, the hero tap and the destroy
     each had to be DECLARED in `buildPrompt` or they were silently
     dropped and the rider was free (v2.04). This is the fourth. */
  const g = {sides: [{res: 0, hand: []}, {res: 0, hand: []}]};
  const p = PR.buildPrompt(g, {tag: "pay", side: 0, src: "Probe", cost: 0, avail: 0,
                               ops: [["ap", 1]], spendCtr: {uid: "u1", kind: "steam", n: 1}});
  assert.deepEqual(p.spendCtr, {uid: "u1", kind: "steam", n: 1},
    "dropped here, the action point is granted and the counter stays — the " +
    "v2.04 free-ability bug, and the item then outlives its printed clock");
  const paid = PR.applyPrompt(g, {...p, choice: "pay"}, 0);
  assert.deepEqual(paid.spendCtr, {uid: "u1", kind: "steam", n: 1},
    "prompts.js runs no effects: it reports WHICH counter was spent");
  assert.deepEqual(paid.ops, [["ap", 1]]);
  const dec = PR.applyPrompt(g, {...p, choice: "decline"}, 0);
  assert.equal(dec.spendCtr, undefined, "and a declined cost is not reported as paid");
  assert.deepEqual(dec.ops, []);
});

/* ---- 4. WHOSE HIT IS IT? ------------------------------------------ */

test("an on-hit trigger's SUBJECT is read — a third-person one refuses", () => {
  const self = P.classifyClause("When this hits a hero, deal 2 damage to them");
  assert.equal(self.onHit, true);
  assert.equal(self.heroOnly, true);
  assert.equal(P.classifyClause("When this hits, deal 2 damage to them").onHit, true);
  assert.equal(P.classifyClause("When it hits a hero, deal 2 damage to them").onHit, true);

  assert.equal(P.classifyClause(
    "When a Mechanologist attack action card you control hits a hero, deal 2 damage to them"), null,
    "`onHit` means \"when THIS hits\" — filing somebody else's hit there is " +
    "v2.33's wrong-subject trap in a trigger instead of a payload");
  assert.equal(P.classifyClause("When a dagger you own hits a hero, they lose 1{h}"), null);
});

test("the pool's on-hit subjects are pinned as a SET, both halves", {skip}, () => {
  H.db();
  const raw = require("../data/pool.json");
  const self = [], other = [];
  for(const c of raw){
    for(const sent of (c.functional_text || "").split(/\n+/).flatMap(l => l.split(/(?<=\.)\s+/))){
      const m = sent.toLowerCase().match(/^(?:if|when|while|whenever) ([^,:]+)[,:]/);
      if(!m || !/\bhits?\b/.test(m[1])) continue;
      (/^(?:this|it)\b/.test(m[1].trim()) ? self : other).push(m[1].trim());
    }
  }
  /* PINNED AS SETS (v3.98, v4.17): a scan that stops matching returns
     empty, which satisfies "every third-person subject refuses" perfectly
     — so the SELF half is the positive control. */
  assert.deepEqual([...new Set(self)].sort(),
    ["this hits", "this hits a **marked** hero", "this hits a hero"]);
  assert.deepEqual([...new Set(other)].sort(), [
    "a dagger you own hits a hero",              /* Arakni, Tarantula — v3.77, in linkPayload */
    "a mechanologist attack action card you control hits a hero", /* Boom Grenade — no route yet */
    "a weapon attack you control hits",          /* Refraction Bolters — v3.93, payCost */
    "nasreth hits a hero"]);                     /* its own payload has no reader */
});

test("DRIVEN: Boom Grenade's watcher is visibly UNREAD rather than silently wrong", {skip}, () => {
  H.db();
  P.fxReset();
  const fx = P.fxParse(H.card("Boom Grenade", 1));
  assert.deepEqual(fx.onHitHero, [],
    "it used to be filed here — a list read only from `pend`, which an ITEM " +
    "never opens, so the clause read `run` and did nothing");
  assert.equal(fx.clauses[3].st, "skip");
  assert.equal(fx.tier, "part",
    "and the card reports PART. Claiming it would file a `full` whose payoff " +
    "is an unbounded repeatable 4 damage: the payload reader drops the " +
    "printed \"destroy this\" too, so the grenade would never leave the board");
  /* THE DROPPED DESTROY IS THE SECOND HALF OF WHY IT REFUSES, and it is
     asserted rather than described. */
  assert.deepEqual(P.classifyClause("destroy this and deal 4 damage to them").ops,
    [["dmg", 4]], "the payload reader keeps the damage and loses the destroy");
  P.fxReset();
});

/* ---- 5. THE TOKEN HALF — LATENT, AND MEASURED ---------------------- */

test("a MINTED permanent gets its counters and its crank offer too", {skip}, () => {
  H.db();
  /* v3.07 had to give the token mint its own `sd` stamp — "a token
     carries its own clock" — and the counter it enters with is the
     sibling field that was never given the same treatment. Without it
     Golden Cog reported `full` with a crank nobody could ever pay, which
     is the no-op blind spot; with it the two entry points share one body.

     LATENT AND MEASURED (v3.84: when you build a route, count how often
     it fires). Exactly two pool tokens print an enters-with-counters
     clause and NEITHER has a creator anywhere in the pool — see the
     census below, which fails the day one gains a source and this stops
     being latent. */
  const n = J.withEffects(
    H.state({name: "Dash", res: 5, ap: 2, deck: [{uid: "f1", name: "F1"}]},
            {name: "Them", deck: [{uid: "d1", name: "T"}]},
            {actor: 0, turnPlayer: 0, seed: "z", turn: 3}),
    (fx, s2) => fx.runOps(s2, [["token", "Golden Cog", 1, "self"]], "probe"));
  const e = (n.sides[0].board || [])[0];
  assert.ok(e, "the token reached the board");
  assert.equal(e.sd, "turn", "with its printed clock (v3.07)");
  assert.equal((n.sides[0].counters[e.uid] || {}).steam, 1, "and its printed counter");
  assert.equal((n.promptQ || []).length, 1, "and the crank offer");
  assert.deepEqual((n.promptQ || [])[0].spendCtr, {uid: e.uid, kind: "steam", n: 1});
  /* THE ORDER IS THE LESSON (v3.60): a counter announced before the token
     it sits on reads as a counter on something else. */
  const iCreated = n.feed.findIndex(l => /Golden Cog created/.test(l));
  const iCtr = n.feed.findIndex(l => /Golden Cog enters with a steam counter/.test(l));
  assert.ok(iCreated >= 0 && iCtr > iCreated, n.feed.slice(-4));
});

test("a token minted under the OPPONENT's control gets ITS counters, not the actor's", {skip}, () => {
  H.db();
  /* THE SEAT IS THE RECIPIENT'S. `runOps` can mint onto either board —
     Frostbite and Bloodrot Pox both land under the hero they hurt — so
     reading the actor's seat writes the counter into the wrong bag and
     offers the crank to the wrong player. Nothing in the pool mints a
     counter-bearing token at all, let alone across the table, so this is
     the near-miss that has to be driven rather than found (v3.73), and it
     is the sabotage that came back SILENT without it. */
  const n = J.withEffects(
    H.state({name: "Dash", res: 5, ap: 2, deck: [{uid: "f1", name: "F1"}]},
            {name: "Them", deck: [{uid: "d1", name: "T"}]},
            {actor: 0, turnPlayer: 0, seed: "z", turn: 3}),
    (fx, s2) => fx.runOps(s2, [["token", "Golden Cog", 1, "foe"]], "probe"));
  const e = (n.sides[1].board || [])[0];
  assert.ok(e, "it landed on the opponent's board");
  assert.equal((n.sides[1].counters[e.uid] || {}).steam, 1, "and the counter is theirs");
  assert.equal((n.sides[0].counters || {})[e.uid], undefined, "not the actor's");
  assert.equal((n.promptQ || [])[0].side, 1, "and the crank is offered to them");
});

test("the enters-with-counters token census is pinned, both halves", {skip}, () => {
  H.db();
  const raw = require("../data/pool.json");
  const toks = raw.filter(c => /token/i.test(c.type_text || ""));
  const prints = toks.filter(c => /enters the arena with/i.test(c.functional_text || ""))
                     .map(c => c.name).sort();
  assert.deepEqual(prints, ["Golden Cog", "Zen State"]);
  /* AND NEITHER HAS A CREATOR. This is the half that says the route is
     latent; if it ever stops being true the mint's behaviour becomes
     observable and this drill is where somebody is told. */
  const made = prints.filter(nm => raw.some(c =>
    new RegExp("create[^.]{0,40}" + nm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
      .test(c.functional_text || "")));
  assert.deepEqual(made, [], "no pool card creates either one");
});

/* ---- 6. A PRICE THE POLICY CANNOT WEIGH IS NOT NO PRICE ------------ */

test("payPolicy prices RESOURCES, and every other cost verb was reading as free", () => {
  /* `payCostSpec` sets `cost: 0` when the price is the PERMANENT ITSELF
     (v3.93), and `payPolicy` opened with `cost <= 0 → true` — "free from
     the floating pool, nothing is given up". That claim is false for
     three of the four cost verbs the `pay` sheet carries, so the seat
     destroyed a Legs piece every time the offer was made, on both of
     v3.93's cards, and would have cranked every grenade the same way.

     THE STANDING POLICY IS TO DECLINE WHAT CANNOT BE WEIGHED —
     `sparring.js` states it twice for boost, with the reason: declining
     can never make the seat stronger than printed. */
  const rich = {res: 9, hand: [{pitch: 1}, {pitch: 1}]};
  assert.equal(E.payPolicy({cost: 0}, rich), true,
    "a genuinely free rider is still taken — the positive control");
  assert.equal(E.payPolicy({cost: 0, destroyUid: 7}, rich), false, "the piece itself");
  assert.equal(E.payPolicy({cost: 0, spendCtr: {uid: 1, kind: "steam", n: 1}}, rich), false, "a counter");
  assert.equal(E.payPolicy({cost: 0, tapHero: true}, rich), false, "the hero's tap");
  assert.equal(E.payPolicy({cost: 0, taps: true, tapUid: 3}, rich), false, "a permanent's tap");
  /* AND A RESOURCE COST WITH A SECOND PRICE ATTACHED FALLS THE SAME WAY —
     it is the SHAPE that is unweighable, not the size of the number. */
  assert.equal(E.payPolicy({cost: 1, avail: 9, destroyUid: 7}, rich), false);
  assert.equal(E.payPolicy({cost: 1, avail: 9}, rich), true, "…and a plain one is unchanged");
});
