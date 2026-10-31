/* ============================================================
   AN ATTACK COUNTS ITS OWN CHAIN LINK (v5.55, QUEUE R5)

   RULING (user, 2026-10-31): "Yes, an attack counts its own chain link."

   The strip (`chain`) gets an attack's entry only when `linkPayload`
   resolves it, so a reader asked before then was one link short. Fai's
   "If you control 2 or more Draconic chain links" cards (Cinderskin
   Devotion, Display Loyalty, Hot on Their Heels, Phoenix Flame, Enflame's
   rungs, Searing Emberblade's static) went again on the THIRD Draconic
   attack in a row instead of the second, and Fai's ability priced itself
   off the resolved links alone while an attack was open.

   `parser.dracNow` says whether an attack is Draconic with the four facts
   `linkPayload` stamps the entry from; `parser.dracLinksNow` adds the open
   attack until its link is pushed (`pend.linked`).
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert");
const H = require("./helpers/judged.js");
const P = require("../engine/parser.js");

const skip = !H.hasDb() && "no cached card database";

const dracLink = by => Object.assign({n: "x", kind: "atk", drac: true}, by != null ? {by} : {});
const plainLink = () => ({n: "y", kind: "atk", drac: false});
const declare = (cardOrName, chain, sideExtra) => {
  H.db();
  const card = typeof cardOrName === "string" ? {...H.card(cardOrName, 1), uid: 80} : cardOrName;
  const g = H.state(Object.assign({res: 9, ap: 1}, sideExtra || {}), {}, {turn: 3, actor: 0, turnPlayer: 0});
  return H.execute({...g, chain}, card, "hand", 0);
};

/* A NINJA attack that is NOT Draconic, printing the same gate — the pool
   has none (every drac-gated card is Draconic itself), so this is the
   near-miss: it is a chain link, but not a DRACONIC one. */
const NINJA_GATED = {name: "SYN-OWNLINK-NINJA", pitch: 1, cost: 0, power: 3, def: 2,
  tt: "Ninja Action - Attack", ty: ["Ninja", "Action", "Attack"], kw: [], gkw: [], uid: 81,
  tx: "If you control 2 or more Draconic chain links, this gets **go again**."};

test("the SECOND Draconic attack in a row meets \"2 or more Draconic chain links\"", {skip}, () => {
  /* THE PAIR EITHER SIDE (v3.92): as link 1 it is one Draconic link; as
     link 2 after a Draconic attack, two — itself and the one before. */
  assert.equal(declare("Cinderskin Devotion", []).pend.ga, false, "alone it is one link: no go again");
  assert.equal(declare("Cinderskin Devotion", [dracLink()]).pend.ga, true,
    "second in a row: it counts itself, so go again (it needed a third before v5.55)");
  /* A NON-DRACONIC LINK BEFORE IT IS A LINK, NOT A DRACONIC ONE. */
  assert.equal(declare("Cinderskin Devotion", [plainLink()]).pend.ga, false,
    "after a plain attack: still one Draconic link");
  /* PHOENIX FLAME'S +1{p} rides the same gate. */
  const pf = declare("Phoenix Flame", [dracLink()]);
  assert.equal(pf.pend.total, pf.pend.card.power + 1, "Phoenix Flame as the second Draconic link gets +1{p}");
});

test("an attack counts itself only when it IS Draconic — by talent, or by a grant", {skip}, () => {
  P.fxReset();
  assert.equal(declare(NINJA_GATED, [dracLink()]).pend.ga, false,
    "a Ninja attack after one Draconic link: two links, one Draconic — the gate holds");
  /* "Your next attack this combat chain is Draconic" (Brand with
     Cinderclaw) makes it one, and the count says so at its declaration. */
  assert.equal(declare(NINJA_GATED, [dracLink()], {dracNext: true}).pend.ga, true,
    "made Draconic by a waiting grant, it counts itself");
  /* And Fealty's grant (v5.53), through the play itself. */
  P.fxReset();
  const g = H.runOps(H.state({res: 9, ap: 1}, {}, {turn: 3, actor: 0, turnPlayer: 0}), [["dracCard", 1]], "Fealty — ability");
  assert.equal(H.execute({...g, chain: [dracLink()]}, {...NINJA_GATED, uid: 82}, "hand", 0).pend.ga, true,
    "made Draconic by Fealty, it counts itself");
});

test("Fai's discount counts the OPEN attack, once, and only his own links", {skip}, () => {
  H.db();
  const g0 = H.state({}, {}, {turn: 3, actor: 0, turnPlayer: 0});
  const open = (card, extra) => ({card, by: 0, total: 3, ga: false, ops: [], onHit: [], ...(extra || {})});
  const dragon = {...H.card("Cinderskin Devotion", 1), uid: 83};
  const ninja = {...H.card("Dragon Power", 1), uid: 84};
  const at = g => P.costCtx(g, 0).dracLinks;
  assert.equal(at({...g0, chain: [dracLink(0)]}), 1, "fixture: one resolved Draconic link");
  assert.equal(at({...g0, chain: [dracLink(0)], pend: open(dragon)}), 2,
    "a Draconic attack in its reaction step is a link Fai controls");
  /* NOT TWICE: the table keeps `pend` through the resolution step, after
     `linkPayload` has pushed the entry. */
  assert.equal(at({...g0, chain: [dracLink(0), dracLink(0)], pend: open(dragon, {linked: true})}), 2,
    "once its link is on the strip, the open attack is not added again");
  assert.equal(at({...g0, chain: [dracLink(0)], pend: open(ninja)}), 1, "an open NON-Draconic attack adds nothing");
  /* "…YOU CONTROL": a Fai mirror's other seat. */
  assert.equal(at({...g0, chain: [dracLink(1), dracLink(1)], pend: open(dragon, {by: 1})}), 0,
    "the opponent's Draconic links are not Fai's");
});

test("the push marks the open attack, so the count before and after it agrees", {skip}, () => {
  const out = declare("Cinderskin Devotion", [dracLink(0)]);
  assert.equal(P.dracLinksNow(out, 0), 2, "declared: the strip's one plus itself");
  const paid = H.fx(out, (f, m) => f.linkPayload(m, {total: m.pend.total, pumps: 0, heroHit: true}));
  const after = paid.game || paid;
  assert.equal(after.pend && after.pend.linked, true, "`linkPayload` marks the pushed attack");
  assert.equal(P.dracLinks(after.chain), 2, "its entry is on the strip");
  assert.equal(P.dracLinksNow(after, 0), 2, "and it is not counted a second time");
});
