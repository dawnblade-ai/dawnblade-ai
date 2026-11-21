/* WHAT BECAME OF THE LINK (v6.48, UX roadmap step 5).
   Every resolved attack on the combat chain records `out` — "hit" (damage was
   dealt), "blocked" (the wall stopped it all) or "prevented" (damage got past
   the wall and a prevention took all of it) — from `effects.linkOutcome`, the
   one body both boards call. The board flashes it; this drill asks the engine.

   Driven through real self-play at the table (`judge.reduce`), not a fixture:
   each new chain entry is checked against the damage it actually
   dealt, and the run must see both a hit and a block, so a constant `out`
   cannot pass. Sabotage checked: `linkOutcome` returning "hit" always fails
   the blocked rows; dropping `afterWall` from judge's call fails the census. */
const test = require("node:test");
const assert = require("node:assert/strict");
const SPL = require("../tools/selfplay.js");

test("linkOutcome: three outcomes from three numbers, and none for a 0-power swing", () => {
  const H = require("./helpers/judged.js");
  let lo = null;
  H.fx(H.state({}, {}, {actor: 0, turn: 1}), (f, n) => { lo = f.linkOutcome; return n; });
  assert.ok(lo, "effects exports linkOutcome");
  assert.equal(lo(5, 2, 2), "hit");
  assert.equal(lo(5, 0, 0), "blocked");
  assert.equal(lo(5, 3, 0), "prevented");
  assert.equal(lo(0, 0, 0), null);
});

test("every resolved attack at the table records what became of it", () => {
  const seen = {hit: 0, blocked: 0, prevented: 0};
  const heroes = SPL.W.HEROES.map(h => h.k);
  for(let gi = 0; gi < 6; gi++){
    const k0 = heroes[gi % heroes.length], k1 = heroes[(gi * 5 + 3) % heroes.length];
    let n = SPL.match(k0, k1, 1000 + gi, gi % 2);
    for(let i = 0; i < 1500 && !n.over; i++){
      let moved = false;
      for(const s of [0, 1]){
        const a = SPL.SP.act(n, s);
        if(!a) continue;
        const out = SPL.J.reduce(n, a, s);
        if(out.error) continue;
        const before = n; n = out.state; moved = true;
        const bc = before.chain || [], nc = n.chain || [];
        if(nc.length === bc.length + 1){
          const e = nc[nc.length - 1];
          if(e.kind !== "atk") continue;
          assert.ok(["hit", "blocked", "prevented", null].includes(e.out),
            `${e.n}: out is ${JSON.stringify(e.out)}`);
          if(e.out) seen[e.out]++;
          /* a hit is damage dealt (CR 7.5.5): the entry's dmg is what was dealt */
          assert.equal(e.out === "hit", e.dmg > 0, `${e.n}: out ${e.out} with ${e.dmg} dealt`);
        }
      }
      if(!moved) break;
    }
  }
  assert.ok(seen.hit > 0, "the run saw a hit");
  assert.ok(seen.blocked > 0, "the run saw a block");
});
