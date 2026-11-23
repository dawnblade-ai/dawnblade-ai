/* ============================================================
   COACH PARITY: THE TRAINER'S COACH ASKS THE SAME JUDGE READERS AS THE TABLE'S AI

   Four of the v6.70-v6.73 lines went into sparring.js (the table's AI and "<Hero>'s call"),
   and the trainer's Coach (engine/advisor.js, a separate module) went on giving the old advice
   (audit 2026-11-23, experiments/census/coachparity.js on findings/queue). advisor.js cannot
   require judge (judge requires it), so the trainer hands it the judge readers in `ctx`, the
   way it already hands `noOpWhy`; nothing is re-implemented here:
     arsTurnPays     Bravo's arsenal turn only when crush makes it pay        (SPXFLIPCRUSH)
     arsenalPayable  no arsenal card next turn could not pay for               (SPXARSPAY)
     condGaNow       a card's own go again when its gate holds now             (SPXCONDGA)
     effPowerNow     Mocking Blow's own on-attack boo ({selfBoo: true})        (SPXBOOSELF)
   Each test drives a real self-play state with the hero at seat 0 (the trainer's `you()`), and
   asks the Coach twice: without the reader (the old advice, the refusal half) and with it. The
   Coach's LINE is the observable here: it is what the trainer shows the player.
   The judge readers were checked against a real TRAINER state in the page (tools/page.js): the
   Battle state carries `builds` and the table's side shape, and all four answer it.
   Sabotage checked: removing a reader from the trainer's ctx in index.html fails the wiring
   test; advisor.js ignoring each reader in turn (the hero-power filter, the arsenal filter,
   the go-again term, the boo delta) fails exactly that line's test.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const SPL = require("../tools/selfplay.js");
const J = SPL.J, SP = SPL.SP;
const A = require("../engine/advisor.js");
const E = require("../engine/effects.js");

const clone = x => JSON.parse(JSON.stringify(x));
function find(hero, hit){
  const foes = SPL.W.HEROES.map(h => h.k).filter(k => k !== hero);
  for(let gi = 0; gi < 64; gi++){
    let n = SPL.match(hero, foes[gi % foes.length], "cp-" + gi, gi % 2);
    for(let i = 0; i < 3000 && !n.over; i++){
      if(hit(n)) return n;
      let moved = false;
      for(const s of [0, 1]){ const x = SP.act(n, s); if(!x) continue; const o = J.reduce(n, x, s); if(o.error) continue; n = o.state; moved = true; break; }
      if(!moved) break;
    }
  }
  return null;
}
const take = (sd, name) => { for(const z of ["deck", "hand", "grave", "pitch", "banish"]){ const k = (sd[z] || []).findIndex(c => c && c.name === name); if(k >= 0) return sd[z].splice(k, 1)[0]; } return null; };
const READERS = {arsTurnPays: J.arsTurnPays, arsenalPayable: J.arsenalPayable, condGaNow: J.condGaNow, effPowerNow: J.effPowerNow};
/* the trainer's ctx (index.html's <Advisor ctx>), with or without the four readers */
const ctxOf = (n, readers) => { const b = J.bOf(n, 0);
  return Object.assign({}, A.advView(n, 0), {runeDmg: b.runeDmg || 1, hpow: b.HPOW, wateryGrave: b.wateryGrave, noOpWhy: E.arsNoOpWhy}, readers ? READERS : {}); };
const coach = (n, readers) => A.advise(n, ctxOf(n, readers)).line;
const actHit = n => n.turnPlayer === 0 && !n.prompt && !n.pending && !n.pend && !(n.stack || []).length && (n.sides[0].ap || 0) >= 1 && !(n.chain || []).length;
function hand(n, names){ const sd = n.sides[0]; sd.deck.push(...sd.hand.filter(Boolean)); sd.hand = [];
  for(const nm of names){ const c = take(sd, nm); assert.ok(c, "pool card " + nm); sd.hand.push(c); }
  if(sd.arsenal && n.arsenalFor !== 0){ sd.deck.push(sd.arsenal); sd.arsenal = null; } return sd.hand; }

test("the trainer hands the Coach the four judge readers", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const ctxLine = src.split("\n").find(l => l.includes("<Advisor g={g} ctx={{window:g.mode"));
  assert.ok(ctxLine, "the trainer's Advisor ctx");
  for(const k of Object.keys(READERS)) assert.ok(ctxLine.includes(k + ":DawnJudge." + k), "ctx passes " + k);
});

test("SPXFLIPCRUSH: no hero power coached onto a face-down card without crush; still coached onto crush", () => {
  const n0 = find("bravo", n => actHit(n) && n.sides[0].arsenal && !n.sides[0].arsenal._faceUp && J.legal(n, {t: "activate", from: "hero", uid: "hpow"}, 0) == null);
  assert.ok(n0, "found in self-play");
  const at = name => { const n = clone(n0), sd = n.sides[0]; const c = take(sd, name); if(sd.arsenal) sd.deck.push(sd.arsenal);
    sd.arsenal = Object.assign({}, c, {_faceUp: false}); sd.deck.push(...sd.hand.filter(Boolean)); sd.hand = []; sd.res = 2; return n; };
  const macho = at("Macho Grande");
  assert.match(coach(macho, false), /hero power/, "the old advice flipped it blind");
  assert.doesNotMatch(coach(macho, true), /hero power/);
  assert.match(coach(at("Chokeslam"), true), /hero power/, "a crush card is still turned");
});

test("SPXARSPAY: the arsenal step coaches a card next turn can pay for", () => {
  const n0 = find("bravo", n => n.arsenalFor === 0 && !n.sides[0].arsenal);
  assert.ok(n0, "found in self-play");
  const n = clone(n0); hand(n, ["Macho Grande", "Cartilage Crush"]);
  assert.match(coach(n, false), /Arsenal Macho Grande/, "the old advice");
  assert.match(coach(n, true), /Arsenal Cartilage Crush/);
});

test("SPXCONDGA: behind on life, Scar for a Scar's go again is coached ahead of the bigger attack", () => {
  const n0 = find("fai", actHit);
  assert.ok(n0, "found in self-play");
  const n = clone(n0); hand(n, ["Scar for a Scar", "Art of the Dragon: Fire"]);
  n.sides[0].res = 8; n.sides[0].hp = 10; n.sides[1].hp = 15;
  assert.match(coach(n, false), /Play Art of the Dragon: Fire/, "the old advice");
  assert.match(coach(n, true), /Play Scar for a Scar.*go again/);
});

test("SPXBOOSELF: ahead on life, Mocking Blow is coached on the power it swings for", () => {
  const n0 = find("lyath", n => actHit(n) && !((n.sides[0].hist || {}).booed));
  assert.ok(n0, "found in self-play");
  const n = clone(n0); hand(n, ["Mocking Blow", "Full of Bravado"]);
  n.sides[0].res = 6; n.sides[0].hp = 18; n.sides[1].hp = 10;
  assert.match(coach(n, false), /Play Full of Bravado/, "the old advice");
  assert.match(coach(n, true), /Play Mocking Blow/);
});
