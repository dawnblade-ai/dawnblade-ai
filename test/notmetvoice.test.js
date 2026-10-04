/* ======================================================================
   "CONDITION NOT MET (…)" IS READ BY THE PLAYER (v4.97)

   The main condition loop prints `${card}: condition not met (${why})` into
   the feed both seats read, and `why` falls back to the condition's ENGINE
   NAME when it has no words. Measured over 210 driven games and over every
   pool card executed into an empty board, five reached the feed raw —
   `discard6way` (Pulping, Bare Fangs, Wild Ride), `arcTakenTurn` (Arcane
   Polarity), `reprise` and `defAtkAction` — plus two lines that were words
   but wrong ("wasn't the right colour" for a charge that never happened,
   "Boltyn's hero's soul"). In a training sim the feed is the lesson (v3.60).

   DRIVEN, NOT GREPPED: every pool card with a gate is executed into an
   empty board, and every reason it prints must be a phrase. A reason with
   no space in it is an identifier.
   ====================================================================== */
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../engine/parser");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached DB — run: node tools/audit.js";

test("every 'condition not met' reason a pool card can print is a phrase, not an engine name", {skip}, () => {
  H.db(); P.fxReset();
  const seen = new Set(), raw = [];
  let driven = 0, lines = 0;
  for(const r of require("../data/pool.json")) for(const p of [1, 2, 3]){
    let c; try { c = H.card(r.name, p); } catch(e){ continue; }
    if(!c || !c.name) continue;
    const k = c.name + "|" + c.pitch; if(seen.has(k)) continue; seen.add(k);
    if(!(P.fxParse(c).conds || []).length) continue;
    const card = {...c, uid: "X1"};
    const g = H.state({res: 20, ap: 2, hand: [card], deck: []}, {hand: [], deck: []}, {actor: 0, turnPlayer: 0});
    const out = H.execute(g, card, "hand", 0, {});
    driven++;
    for(const l of (out.feed || [])){
      const t = typeof l === "string" ? l : (l && (l.t || l.text)) || "";
      const m = /: condition not met \((.*)\)\.$/.exec(t);
      if(!m) continue;
      lines++;
      if(!/\s/.test(m[1])) raw.push(c.name + " -> " + m[1]);
    }
  }
  assert.ok(driven > 150 && lines > 40, "the scan drove " + driven + " cards and saw " + lines + " lines — it is aimed wrong");
  assert.deepEqual([...new Set(raw)], [], "an engine name reached the feed");
});

test("a declined charge is not reported as the wrong colour", {skip}, () => {
  H.db(); P.fxReset();
  const bb = {...H.card("Beaming Bravado", 2), uid: "BB"};
  const g = H.state({res: 20, ap: 2, hand: [bb], deck: []}, {hand: [], deck: []}, {actor: 0, turnPlayer: 0});
  const out = H.execute(g, bb, "hand", 0, {});
  const t = (out.feed || []).map(l => typeof l === "string" ? l : (l && (l.t || l.text)) || "").join("\n");
  assert.match(t, /condition not met \(nothing was charged this way\)/);
  assert.doesNotMatch(t, /wasn't the right colour/);
});
