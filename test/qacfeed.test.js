/* ============================================================
   QA-C (v5.96 trainer read) — FEED TEXT THAT READ WRONG

     "Pitched Wounding Blow at instant speed"  — the DUMMY's card, in the player's voice
     "You draws back up to 4"                   — a hand-built verb
     "…the next time You would be dealt damage"  — a capital mid-sentence
     "You: their next Guardian attack…"          — their, for seat 0
     "paid 1 and tapped X" before the "Pitched" that paid it  (drilled in test/payorder.test.js)

   The line IS the observable here, so these assert on prose; each has a sabotage
   (the same line at the other seat, or the old order).
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../engine/parser");
const H = require("./helpers/judged.js");
const skip = !H.hasDb() && "no cached DB — run: node tools/audit.js";
const said = g => (g.feed || []).map(f => typeof f === "string" ? f : (f && f.t) || "");

test("FEED-4 — a seat named You reads lower-case mid-sentence, a hero keeps the name", {skip}, () => {
  for(const [name, want] of [["You", "the next time you would be dealt damage"], ["Dorinthea", "the next time Dorinthea would be dealt damage"]]){
    P.fxReset();
    const c = Object.assign(H.card("Toe the Line", 3), {uid: "ttl1"});
    const g = H.execute(H.state({name, hand: [c], res: 0, ap: 1}, {}, {}), c, "hand", 0, {});
    const line = said(g.game || g).find(l => /would be dealt damage/.test(l));
    assert.ok(line && line.includes(want), `${name}: ${line}`);
  }
});

test("FEED-4 — 'their next' is 'your next' for seat 0 and stays 'their' for a hero", {skip}, () => {
  for(const [name, want, not] of [["You", /^You: your next/, /their next/], ["Bravo", /^Bravo: their next/, /your next/]]){
    P.fxReset();
    const c = Object.assign(H.card("Seismic Surge", 0), {uid: "ss1"});
    const g = H.execute(H.state({name, hand: [c], res: 3, ap: 1}, {}, {}), c, "hand", 0, {});
    const line = said(g.game || g).find(l => /next .* (costs|may be played)/.test(l));
    if(!line){ assert.fail(`${name}: no line in ${JSON.stringify(said(g.game || g))}`); }
    assert.match(line, want); assert.doesNotMatch(line, not);
  }
});

test("FEED-1 — an instant-speed pitch names its seat (shared autoPitch, both boards)", () => {
  const fs = require("node:fs");
  const src = fs.readFileSync(require("node:path").join(__dirname, "../engine/effects.js"), "utf8");
  assert.equal((src.match(/Pitched \$\{p\.name\} at instant speed/g) || []).length, 0, "the unnamed 'Pitched …' line is back");
  assert.equal((src.match(/\$\{sv\(act\(n\), "pitch"\)\} \$\{p\.name\} at instant speed/g) || []).length, 2, "both pitch loops name the seat");
});
