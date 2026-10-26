/* ============================================================
   feedsource.test.js — ONE NEUTRAL ACTIVATED-ATTACK REASON (v5.47,
   QUEUE FEED 19)

   An "Action - <cost>: Attack" line is read by the attack route, so the
   parser files it `noop`, and `runOps` prints the reason into the feed
   under the card's name on every play. The reason said "the weapon's
   attack", and 26 pool cards carry it: allies (on every deploy), weapons,
   Bait and Teklovossen. It now says what is true of all of them.

   The reason has no state, so the line is the observable (v3.60).
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const H = require("./helpers/judged.js");
const P = require("../engine/parser.js");
const C = require("../engine/cards.js");

const skip = !H.hasDb() && "no cached card database";
const WHY = "it attacks through its own ability — the cost is paid each time it attacks";

test("every carrier of the reason is an ally, a weapon or another permanent that attacks", {skip}, () => {
  const raw = require("../data/pool.json");
  const db = C.buildMaps(raw.filter(c => c && c.name).map(C.mapDbCard));
  const carriers = new Map();
  for(const r of raw){
    if(!r || !r.name) continue;
    const c = C.resolveEntry(db, {name: r.name, p: r.pitch === "" || r.pitch == null ? 0 : +r.pitch, code: null, q: 1});
    if(!c) continue;
    if((P.fxParse(c).ops || []).some(o => o[0] === "noop" && o[1] === WHY)) carriers.set(c.name, c.ty || []);
  }
  /* the denominator: measured at 26 cards when this was written */
  assert.ok(carriers.size >= 20, "the census found " + carriers.size + " carriers");
  const kinds = new Set([...carriers.values()].map(ty => ty.includes("Ally") ? "ally" : ty.includes("Weapon") ? "weapon" : "other"));
  assert.deepEqual([...kinds].sort(), ["ally", "other", "weapon"], "the wording must be true of all three");
  assert.ok(!/weapon|swing|\byour?\b/i.test(WHY), "no kind of card, and no second person (feed voice)");
});

test("driven: deploying Riggermortis prints the neutral line", {skip}, () => {
  H.db();
  const ally = Object.assign({}, H.card("Riggermortis", 1) || H.card("Riggermortis", 2) || H.card("Riggermortis", 3), {uid: "rg1"});
  assert.ok(ally.name, "Riggermortis is in the pool");
  let g = H.state({name: "Gravy", res: 9, ap: 1, hand: [ally]}, {name: "Bob", hp: 20}, {turn: 3, turnPlayer: 0});
  g = Object.assign({}, g, {phase: "action", step: "layer"});
  const r = H.execute(g, ally, "hand", 0, {});
  const out = r && r.game ? r.game : r;
  const lines = (out.feed || []).join("\n");
  assert.match(lines, new RegExp("^Riggermortis: " + WHY + "\\.$", "m"));
  assert.doesNotMatch(lines, /the weapon's attack/);
});

/* ---- QUEUE FEED 20: WHOSE GO AGAIN IT WAS --------------------------
   The action-point line printed "Go again — action point kept." with no
   source. It names the resolving card now: on an attack's resolution, on
   a non-attack, on a piece's ability (without the builder's suffix) and on
   a hero's ability (the way `heroAbilityName` names a hero trigger). The
   action point is held by the drills that own each route; what is new is
   the NAME, so the line is the observable (v3.60). Driven over self-play,
   because the policy reaches every route there. */
test("driven: every go-again line names its source, in game words", () => {
  const {match, J, SP} = require("../tools/selfplay.js");
  const HEROES = ["arakni", "azalea", "blaze", "boltyn", "bravo", "briar", "dash", "dorinthea",
                  "enigma", "fai", "gravy", "iyslander", "kayo", "lyath", "viserai"];
  const ga = [], bare = [];
  for(let i = 0; i < HEROES.length; i++){
    let g = match(HEROES[i], HEROES[(i + 5) % 15], "ga-src-" + i, 0), steps = 0;
    while(!g.over && steps < 3000){
      let moved = false;
      for(const s of [0, 1]){
        const a = SP.act(g, s); if(!a) continue;
        const before = (g.feed || []).length, r = J.reduce(g, a, s);
        if(r.error) continue;
        for(const l of r.state.feed.slice(before)){
          if(/^Go again\b/.test(l)) bare.push(l);
          else if(/: go again(?: on an instant)? — (?:action point kept|an action point gained)/.test(l)) ga.push(l);
        }
        g = r.state; steps++; moved = true; break;
      }
      if(!moved) break;
    }
  }
  assert.deepEqual(bare, [], "a go-again line with no source");
  assert.ok(ga.length > 100, "the census found " + ga.length + " go-again lines");
  assert.deepEqual(ga.filter(l => / — (?:ability|hero power)\b/.test(l)), [], "a builder's suffix leaked");
  assert.ok(ga.some(l => /^[A-Z][^:]*'s hero ability: go again/.test(l)), "a hero ability's go again is named as one");
  assert.ok(ga.some(l => /^Mage Master Boots: go again/.test(l)), "a piece's ability is named by the piece");
});
