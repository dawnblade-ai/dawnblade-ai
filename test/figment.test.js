/* ============================================================
   test/figment.test.js — FIGMENTS AND AWAKEN (v6.47, Prism reader 3)

   Cited rules: CR 8.2.16a, CR 8.2.16b, CR 8.5.43, CR 8.5.43a, CR 9.1.3, CR 9.1.3b.
   CR 8.2.16a / 8.2.16b: "When a figment resolves as a layer on the stack, it enters
   the arena. When a figment enters the arena, it becomes a permanent, except
   when it is added as a defending card to a chain link."
   CR 8.5.43: "To awaken a double-faced card, its back-face becomes its active
   face." 8.5.43a: it fails on a card that is not double-faced or already awake.
   CR 9.1.3: a figment is a flip-card; "the properties of a flip-card are
   defined by its active face"; 9.1.3b: off the arena its front is active again.

   Prism, Advent of Thrones: "Once per Turn Instant - {r}{r}, banish a card
   from Prism's soul: Awaken target figment you control." Figment of Hope's
   back is Suraya, Archangel of Endless Hope (an Angel Ally, 4{p}, 4 life,
   Ward 4, "When this is awakened, gain 1{h}"), sharing print code SAT023.
   Staged records (Prism is not open yet), registered with the judge beside
   the pool and put back after, as test/traverse.test.js does.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../engine/parser.js");
const C = require("../engine/cards.js");
const BD = require("../engine/build.js");
const H = require("./helpers/judged.js");
const J = H.J;

const skip = !H.hasDb() && "no cached card database";
const STAGED_RECS = require("../data/staged.js").filter(c => c && c.name).map(C.mapDbCard);
const PRISM = "Prism, Advent of Thrones", FIG = "Figment of Hope", SURAYA = "Suraya, Archangel of Endless Hope";
function withStaged(body){
  const pool = H.db();
  const both = C.buildMaps(require("./helpers/extract").readPool()
    .filter(c => c && c.name).map(C.mapDbCard).concat(STAGED_RECS));
  J.setDb(both);
  try { return body(both); } finally { J.setDb(pool); }
}
const card = (db, nm, uid, p) => {
  const c = C.resolveEntry(db, {name: nm, p: p || 0, code: null, q: 1});
  assert.ok(c.resolved, nm + " did not resolve");
  return uid ? {...c, uid} : c;
};
const table = g => ({...g, phase: "action", step: "layer", priority: 0, passed: []});
const act = (g, a, seat) => {
  const out = J.reduce(g, a, seat);
  assert.equal(out.error, null, JSON.stringify(a) + " was refused: " + out.error);
  return out.state;
};
function settle(g){ for(let i = 0; i < 40 && (g.pend || (g.stack || []).length || g.prompt || g.pending); i++){ const m = H.move(g); if(m === g) break; g = m; } return g; }
const names = z => (z || []).map(c => c.name);
const soulCard = uid => ({uid, name: "Drill Soul " + uid, tt: "Light Action", ty: ["Light", "Action"], pitch: 1, tx: "", kw: []});
function world(db, o){
  const hero = C.resolveEntry(db, {name: PRISM, p: 0, code: null, q: 1});
  const rec = (db.byName[PRISM.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()] || [])[0];
  const b = BD.heroAbilities(rec, PRISM);
  assert.ok(hero.resolved && b && b.HPOW, "fixture: Prism's ability did not build");
  return table(H.state(Object.assign({res: 9, ap: 1, hp: 15, hand: [], soul: [soulCard("s1"), soulCard("s2")]}, o || {}),
    {hp: 20, hand: []}, {actor: 0, turnPlayer: 0, turn: 3, builds: [b, {}]}));
}
const AWAKEN = {t: "activate", from: "hero", uid: "hpow"};

test("the readers: the clause is a targeted pick on the board; the back face is found by print code", {skip}, () => {
  assert.deepEqual(P.classifyClause("Awaken target figment you control").ops,
    [["pickPrompt", {zone: "board", filter: {ty: "figment"}, min: 1, max: 1, tgt: true, awaken: true,
      title: "Choose a figment you control — it awakens"}]]);
  withStaged(db => {
    assert.equal(BD.flipBackOf(db, FIG).n, SURAYA);
    assert.equal(BD.flipBackOf(db, "Wartune Herald"), null, "a card that is not a flip-card has a back");
    assert.equal(BD.flipBackOf(db, PRISM), null, "a hero was read as a flip-card");
    P.fxReset();
    assert.deepEqual(P.fxParse({...card(db, SURAYA), tt: "Light Angel Ally"}).onAwaken, [["life", 1]]);
  });
});

test("Prism's cost reads; a soul-cost line whose payload is \"Attack\" still refuses", () => {
  const pw = P.parseHeroPower("Once per Turn Instant - {r}{r}, banish a card from Prism's soul: Awaken target figment you control.");
  assert.equal(pw && pw.cost, 2, "the {r}{r} was not counted");
  assert.equal(pw.soul, 1);
  /* Teklovossen's shape: read across its line break, it became "the opponent discards" */
  assert.equal(P.parseHeroPower("Action - {r}{r}{r}, banish 2 cards from your soul: Attack\nWhenever this attacks a hero, they discard a card."),
    null, "an activation that makes its source attack was read as its next sentence");
});

test("a figment resolves into the arena as a permanent (CR 8.2.16)", {skip}, () => withStaged(db => {
  P.fxReset();
  let g = world(db, {hand: [card(db, FIG, "f1", 2)]});
  g = act(g, {t: "play", uid: "f1", from: "hand"}, 0);
  g = settle(g);
  const me = g.sides[0];
  assert.deepEqual((me.board || []).map(b => [b.uid, b.kind, b.card.name]), [["f1", "figment", FIG]]);
  assert.deepEqual(names(me.grave), [], "the figment went to the graveyard");
}));

test("at the table: Prism pays {r}{r} and a soul card, and the figment awakens into Suraya", {skip}, () => withStaged(db => {
  P.fxReset();
  const fig = card(db, FIG, "f1", 2);
  let g = world(db, {board: [{card: fig, kind: "figment", spent: false, uid: "f1"}]});
  assert.equal(J.legal(g, AWAKEN, 0), null, "the table refused Prism's ability");
  g = act(g, AWAKEN, 0);
  assert.equal(g.pending && g.pending.kind, "soulcost", "the soul card was not asked for");
  g = settle(act(g, {t: "soulcost", uid: "s1"}, 0));
  const me = g.sides[0];
  const b = me.board.find(x => x.uid === "f1");
  assert.equal(b.card.name, SURAYA, "the figment did not awaken");
  assert.equal(b.kind, "ally", "the awakened face is not an ally on the board");
  assert.equal(b.card._front.name, FIG, "the front face was not kept for when it leaves");
  assert.equal(b.card.power, 4);
  assert.equal(me.res, 7, "the {r}{r} was not paid");
  assert.equal(me.soul.length, 1, "no soul card was banished");
  assert.equal(me.hp, 16, "\"when this is awakened, gain 1{h}\" did not pay");
}));

test("no figment, no activation: the ability needs its target", {skip}, () => withStaged(db => {
  P.fxReset();
  const g = world(db, {board: []});
  assert.ok(J.legal(g, AWAKEN, 0), "Prism's ability was legal with no figment to awaken");
}));

test("Suraya dies, and the graveyard holds Figment of Hope (CR 9.1.3b); the judge says so if it does not", {skip}, () => withStaged(db => {
  P.fxReset();
  const fig = card(db, FIG, "f1", 2);
  let g = world(db, {board: [{card: fig, kind: "figment", spent: false, uid: "f1"}]});
  g = act(g, AWAKEN, 0);
  g = settle(act(g, {t: "soulcost", uid: "s1"}, 0));
  assert.equal(g.sides[0].board[0].card.name, SURAYA, "fixture: no Suraya");
  const out = require("../engine/game.js").damageAlly(g, 0, "f1", 9);
  const me = (out.game || out).sides[0];
  assert.deepEqual(me.board, [], "Suraya survived 9 damage");
  assert.deepEqual(names(me.grave), [FIG], "the awakened face was filed");
  assert.equal(me.grave[0]._front, undefined, "the filed card still carries a back face");
  /* the invariant: a back face filed anywhere off the arena is reported */
  const INV = require("../engine/invariants.js");
  const bad = {...g, sides: [{...g.sides[0], grave: [g.sides[0].board[0].card]}, g.sides[1]]};
  assert.ok(INV.check(bad).some(v => v.code === "BACK-FACE-OFF-ARENA"), "the judge did not see a back face in the graveyard");
}));

/* ---- THE HERO'S TRIGGER (v6.47): "Whenever a card with Herald in its name is put into your soul
   during an action phase, you may search your deck for a figment, put it into the arena, then
   shuffle." Wartune Herald: "When this hits, put it into your soul." */
test("the readers: the passive builds off Prism's line; the search puts a figment into the arena", {skip}, () => withStaged(db => {
  const rec = (db.byName[PRISM.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()] || [])[0];
  const b = BD.heroAbilities(rec, PRISM);
  assert.equal(b.soulNamedTrig && b.soulNamedTrig.named, "Herald");
  assert.deepEqual(b.soulNamedTrig.ops, [["pickPrompt", {zone: "deck", to: "arena", filter: {ty: "figment"},
    min: 0, max: 1, shuffleAfter: true, title: "Search your deck?",
    hint: "Optional — choose none to decline. Your deck is shuffled either way."}]]);
  const vis = (db.byName["viserai between worlds"] || [])[0];
  assert.equal(BD.heroAbilities(vis, vis.name).soulNamedTrig, null, "a hero who prints no such line has the trigger");
  assert.equal(P.classifyClause("you may search your deck for a figment, put it into your graveyard, then shuffle"), null,
    "an unread disposition was read");
}));

function heraldSwing(db, o){
  const hero = (db.byName[PRISM.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()] || [])[0];
  const b = BD.heroAbilities(hero, PRISM);
  const herald = card(db, (o && o.atk) || "Wartune Herald", "w1", 1);
  const deck = [card(db, "Herald of Hope", "d1", 1), card(db, FIG, "f9", 2), card(db, "Herald of Hope", "d2", 1)];
  let g = table(H.state({res: 9, ap: 1, hp: 15, hand: [herald], deck, soul: []},
    {hp: 20, hand: []}, {actor: 0, turnPlayer: 0, turn: 3, builds: [(o && o.build) || b, {}]}));
  if(o && o.phase) g = {...g, phase: o.phase};
  g = act(g, {t: "play", uid: "w1", from: "hand"}, 0);
  let asked = null;
  for(let i = 0; i < 80 && !g.over; i++){
    if(g.prompt){
      if(g.prompt.zone === "deck" && g.prompt.to === "arena"){
        asked = g.prompt;
        const ix = (g.prompt.cards || g.prompt.pool || []).findIndex(c => c && c.uid === "f9");
        if(o && o.decline){ g = act(g, {t: "promptConfirm"}, 0); continue; }
        assert.ok(ix >= 0, "the figment was not offered: " + JSON.stringify(Object.keys(g.prompt)));
        g = act(g, {t: "promptSel", i: ix}, 0);
      }
      g = act(g, {t: "promptConfirm"}, g.prompt.side); continue;
    }
    if(g.pending) break;
    if(!g.pend && !(g.stack || []).length && !(g.chain || []).length) break;
    const out = J.reduce(g, {t: "pass"}, g.priority);
    if(out.error) break;
    g = out.state;
  }
  return {g, asked};
}

test("at the table: a Herald hits, goes into Prism's soul, and the search puts Figment of Hope into the arena", {skip}, () => withStaged(db => {
  P.fxReset();
  const {g, asked} = heraldSwing(db);
  const me = g.sides[0];
  assert.ok(g.sides[1].hp < 20, "fixture: the Herald did not hit");
  assert.deepEqual(names(me.soul), ["Wartune Herald"], "fixture: the Herald did not reach the soul");
  assert.ok(asked, "the search was never offered");
  assert.equal(asked.min, 0, "the search is a may");
  assert.deepEqual((asked.cards || asked.pool || []).map(c => c.uid), ["f9"], "the search offered a card that is not a figment");
  assert.deepEqual((me.board || []).map(b => [b.uid, b.kind, b.card.name]), [["f9", "figment", FIG]]);
  assert.deepEqual(me.deck.map(c => c.uid).sort(), ["d1", "d2"], "the deck lost or kept the wrong cards");
}));

test("declined, the figment stays in the deck; no Herald, no search; outside an action phase, no search", {skip}, () => withStaged(db => {
  P.fxReset();
  const d = heraldSwing(db, {decline: true});
  assert.ok(d.asked, "fixture: the search was not offered");
  assert.deepEqual(d.g.sides[0].board || [], [], "a declined search put a card into the arena");
  assert.ok(d.g.sides[0].deck.some(c => c.uid === "f9"), "a declined search took the figment");
  /* the same swing for a hero who prints no such line */
  const n = heraldSwing(db, {build: {}});
  assert.deepEqual(names(n.g.sides[0].soul), ["Wartune Herald"], "fixture: the Herald did not reach the soul");
  assert.equal(n.asked, null, "a hero without the line searched");
  /* the trigger itself, outside an action phase: a pick into the soul at the end phase */
  const rec = (db.byName[PRISM.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()] || [])[0];
  const b = BD.heroAbilities(rec, PRISM);
  for(const [phase, nm, want] of [["end", "Herald of Hope", 0], ["action", "Herald of Hope", 1], ["action", "Drill Soul x", 0]]){
    const c = nm === "Drill Soul x" ? soulCard("x") : card(db, nm, "x", 1);
    let g = table(H.state({hand: [c], deck: [card(db, FIG, "f9", 2)], soul: []}, {hp: 20},
      {actor: 0, turnPlayer: 0, turn: 3, builds: [b, {}]}));
    g = {...g, phase};
    /* one card in hand, min 1: the judge confirms the forced pick as it opens (`promptForcedSel`) */
    const s = J.openPrompt(H.runOps(g, [["pickPrompt", {zone: "hand", to: "soul", min: 1, max: 1, title: "t"}]]));
    assert.deepEqual(names(s.sides[0].soul), [c.name], "fixture: the pick did not reach the soul (" + phase + ")");
    const searching = (s.prompt && s.prompt.to === "arena" ? 1 : 0) + (s.promptQ || []).filter(q => q.to === "arena").length;
    assert.equal(searching, want, `${nm} into the soul in the ${phase} phase`);
  }
}));

/* ---- SURAYA AS AN ALLY (v6.47): "Once per Turn Action - {r}{r}: Attack" and "Ward 4". The readers
   were already there (`parser.allyAttack`, `wardValue`); this drives them on the awakened face. */
test("at the table: Suraya, awakened, attacks for {r}{r} once per turn and carries Ward 4", {skip}, () => withStaged(db => {
  P.fxReset();
  const fig = card(db, FIG, "f1", 2);
  let g = world(db, {board: [{card: fig, kind: "figment", spent: false, uid: "f1"}]});
  const SWING = {t: "activate", uid: "f1", from: "board"};
  assert.ok(J.legal(g, SWING, 0), "a figment, not yet awakened, attacked");
  g = settle(act(act(g, AWAKEN, 0), {t: "soulcost", uid: "s1"}, 0));
  const sur = g.sides[0].board.find(x => x.uid === "f1").card;
  assert.equal(P.wardValue(sur), 4, "Suraya's Ward 4 does not read");
  assert.equal(g.sides[0].res, 7, "fixture: the awaken did not pay {r}{r}");
  assert.equal(J.legal(g, SWING, 0), null, "the table refused Suraya's attack");
  g = act(g, SWING, 0);
  assert.equal(g.sides[0].res, 5, "Suraya's attack did not cost {r}{r}");
  for(let i = 0; i < 60 && !g.over && (g.pend || (g.stack || []).length || (g.chain || []).length || g.prompt); i++){
    if(g.prompt){ g = act(g, {t: "promptConfirm"}, g.prompt.side); continue; }
    const out = J.reduce(g, {t: "pass"}, g.priority);
    if(out.error) break;
    g = out.state;
  }
  assert.equal(g.sides[1].hp, 16, "Suraya's 4{p} did not land unblocked");
  assert.equal(g.sides[0].ap, 0, "the attack is an action and costs the action point (paid at the link's payload)");
  g = {...g, sides: [{...g.sides[0], ap: 1}, g.sides[1]]};
  assert.ok(J.legal(g, SWING, 0), "Suraya attacked twice in one turn");
}));
