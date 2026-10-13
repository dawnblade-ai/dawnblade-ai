# FINDINGS — feed read, group D (kayo, lyath, viserai) — v5.08

Read-only audit. No engine, test or doc file was touched. Scratch scripts lived in the
scratchpad, not the repo.

Four findings: one that changes game state (weaker than printed) and three feed-text
defects. Zero crashes, zero policy refusals, zero invariant violations in 24 games.

Common harness for every repro below (writes the feed to a file):

```sh
node -e 'const SP=require("./tools/selfplay.js");const r=SP.play(SP.match(HERO,OPP,SEED,FIRST));
for(const x of r.game.feed)console.log(typeof x==="string"?x:(x.t||x.text||""))'
```

---

## 1. Viserai · Hit the High Notes / Shrill of Skullform / Runerager Swarm · a Runechant created by Malefic Incantation on the same play is not counted

- **Printed**
  - Hit the High Notes: *"If you've played or created an aura this turn, this gets +2{p}."*
  - Shrill of Skullform: *"If you've played or created an aura this turn, this gets +3{p}."*
  - Runerager Swarm: *"If you've played or created an aura this turn, this gets **go again**."*
  - Malefic Incantation: *"Once per turn, when you play an attack action card, remove a verse counter from this. If you do, create a Runechant token."*
  - Runechant: *"Runeblade Token - Aura"*.
- **Feed** (`SP.match("viserai","dash","d11",1)`, Viserai's turn 18; Malefic on the board with 1 verse counter):
  ```
  Runerager Swarm: condition not met (no aura played or created this turn).
  Malefic Incantation: a verse counter comes off — 1 left.
  +1 Runechant — 1 on the board.
  Viserai plays Runerager Swarm — 3 power on the chain.
  ...
  Viserai passes the turn.
  ```
  The same order appears at `SP.match("viserai","briar","d2",0)` turn 21 for Hit the High Notes: "condition not met", then the verse counter comes off, then "+1 Runechant", then the card is played at 4 power.
- **What is wrong**
  - The condition loop reads `hist.aura` before Malefic's "when you play an attack action card" trigger has made its Runechant.
  - So the card that triggered the Runechant never sees it. The next card played that turn does see it.
  - The Runechant is on the board and `hist.aura` is 1 afterwards, so only the ordering is wrong.
  - Runerager Swarm loses its action point (CR 5.3.5). The other two lose +2 and +3 power.
  - Viserai's own rite (`effects.js:3573`) mints before the loop and is fine. Malefic is the only late creator.
- **Direction**: weaker than printed. It happens every time Malefic is on Viserai's board and he plays any of the three cards.
- **Repro** (minimal, driven state):
  ```js
  const H=require("./test/helpers/judged.js"); const J=H.J; H.db();
  const mk=(n,p,u)=>Object.assign({},H.card(n,p),{uid:u});
  let n=H.state({name:"Viserai",res:9,ap:9,hand:[mk("Hit the High Notes",1,"h1")],deck:[{uid:"f1",name:"F1"}],
    board:[{card:mk("Malefic Incantation",1,"mi1"),kind:"aura",spent:false,uid:"mi1"}],counters:{mi1:{verse:3}}},
    {name:"Them",deck:[{uid:"d2",name:"T"}]},{actor:0,turnPlayer:0,seed:"z",turn:3});
  n={...n,phase:"action",step:"layer",priority:0,passed:[]};
  n=J.reduce(n,{t:"play",uid:"h1",from:"hand"},0).state;
  console.log(n.pend.total, n.sides[0].board.map(b=>b.card.name));   // 4 [Malefic Incantation, Runechant]; printed rule gives 6
  ```
  Control: with a second card, Runerager Swarm first and then Hit the High Notes in the same turn, the second reads 6 (hist.aura = 1).
  Swarm alone shows `pend.ga === false` with the Runechant on the board.
- **Engine site**
  - `engine/effects.js:4027`: the `auraTurn` evaluation in the condition loop.
  - `engine/effects.js:4617`: `ctrClock(n, "atkPlay")`, which fires Malefic after that loop.
  - `engine/effects.js:1962`: where a minted token bumps `hist.aura`.
  - Fix direction: fire the play-clock before the condition loop, or make `auraTurn` a late condition read at the damage step like `pumped`.
- **Confidence**: high. Driven, and seen in two real games.

---

## 2. Kayo · Wild Ride / Pulping / Bare Fangs · "no additional-cost discard to feed — bonus skips" printed beside a bonus that did apply

- **Printed**
  - Bare Fangs: *"When this attacks, draw a card, then discard a random card. If a card with 6 or more {p} is discarded this way, this gets +2{p}."*
  - Pulping: *"…this gets **dominate**."*
  - Wild Ride: *"…this gets **go again**."*
  - None of the three has an additional cost.
- **Feed** (`SP.match("kayo","fai","d1",1)`, Kayo turn 16, Bare Fangs):
  ```
  Bare Fangs: discarded Smash Instinct (6{p}) at random.
  The first card with 6 or more {p} you have discarded this action phase — Kayo makes Might.
  Bare Fangs: no additional-cost discard to feed — bonus skips.
  Kayo plays Bare Fangs — 8 power on the chain (printed 6).
  ```
  Pulping prints the same line immediately after "Pulping gains dominate." (same game, turn 22). Wild Ride prints it after "goes again".
- **What is wrong**
  - The line says the bonus skipped while the bonus was applied: 6 + 2 = 8, dominate, go again.
  - The line also fires when nothing 6+ was discarded.
  - It is the fallback `else if(fx.conds.some(discard6 || discard6way))` at the end of the additional-cost block. It cannot tell a "when this attacks" random discard from an additional-cost discard.
  - Savage Feast is the only pool card with an additional-cost discard; it takes the other branch.
  - Counted in my 24 feeds: 29 occurrences (Bare Fangs 14, Pulping 9, Wild Ride 5, Mandible Claw 1), each beside a correct "discarded X at random" line.
- **Direction**: feed text only. The state is right (power, dominate and go again verified), but the player is told the opposite.
- **Repro**: the driven Bare Fangs play with a 0-power card in hand prints the line even though no additional cost exists. Real-game repro is the Kayo-vs-Fai command above.
- **Engine site**: `engine/effects.js:4636-4638` (the `else if` branch). The `discard6way` cond is answered later at `effects.js:4000`.
- **Confidence**: high.

---

## 3. Any hero · "N unspent 'this turn' grants expire" · reports a fully spent prevention as unspent, and counts a +N payout as N grants

- **Printed**
  - Oasis Respite: *"Prevent the next 4 damage that would be dealt to target hero this turn…"*
  - Act of Glory: *"When this leaves the arena, your next attack this turn gets +6{p}."*
- **Feed**
  - `SP.match("lyath","fai","d1",1)`, end of Fai's turn 1. Oasis Respite's ward 4 was fully used (Brand 3, Lava Burst 1, "…ward soaks 1 and is spent"), then:
    ```
    Lyath Goldmane: 1 unspent “this turn” grant expires with the turn.
    ```
    Same at `SP.match("dorinthea","lyath","d4",0)` turn 6: "ward soaks 4 and is spent", then "Dorinthea: 1 unspent … grant expires".
  - `SP.match("lyath","briar","d2",0)`, Lyath turn 5: a single Act of Glory +6 payout is announced as `6 unspent “this turn” grants expire with the turn.` Another single payout is announced as 5.
- **What is wrong**
  - Spending the prevention pool never decrements `sd.wardTurn`. After the spend, `ward` is 0 and `wardTurn` is still 4, so the end-phase `held` count adds 1 and the line is printed.
  - `held` sums `buffNext` as a number, so one +6 grant is "6 grants". Sprout Strength's three separate +1 grants also print 3, so the unit is inconsistent.
  - The sweep itself is correct: `ward = max(0, ward − wardTurn)` clears the right amount, and no hero holds a non-windowed ward in this pool.
- **Direction**: feed text only.
- **Repro**: play Oasis Respite, spend all 4, then run the end phase:
  ```js
  const H=require("./test/helpers/judged.js"),J=H.J,E=require("./engine/effects.js"); H.db();
  const c=Object.assign({},H.card("Oasis Respite",1),{uid:"or1"});
  let n=H.state({name:"Lyath",hp:20,res:9,ap:9,hand:[c],deck:[{uid:"f1",name:"F1"}]},{name:"Them",hp:20,deck:[{uid:"d2",name:"T"}]},{actor:0,turnPlayer:0,seed:"z",turn:3,builds:[{},{}]});
  n={...n,phase:"action",step:"layer",priority:0,passed:[]};
  n=H.drain(J.reduce(n,{t:"play",uid:"or1",from:"hand"},0).state);
  n=H.fx(n,(f,m)=>f.preventDamage(m,0,4).game||m);          // ward 4 -> 0, wardTurn stays 4
  console.log(n.sides[0].ward,n.sides[0].wardTurn,E.beginEndPhase(n,0).msgs.filter(x=>/unspent/.test(x)));
  ```
  Output: `0 4 [ 'Lyath: 1 unspent “this turn” grant expires with the turn.' ]`. (Run as written.)
- **Engine site**: `engine/effects.js:10303` (`wardTurn` counted), `:10298` (`buffNext` summed), `:10345` (message). `wardTurn` is written only at `:1757` and cleared only at `:10340`.
- **Confidence**: high that the line is false. Low on whether anyone cares.

---

## 4. Lyath · the crowd boos · hard-coded "you" and "your Bravo cards"

- **Printed**: *"Whenever the crowd boos you, create a Might token."* Lyath is a Reviled Guardian. The only "Bravo" in the pool is a different hero.
- **Feed** (55 times across my feeds, e.g. `SP.match("lyath","fai","d1",1)` turn 2):
  ```
  The crowd boos you — Reviled, and your Bravo cards know it.
  ```
  With Lyath in seat 1 (`SP.match("azalea","lyath","d6",0)`) the same string appears and "you" is the other player.
- **What is wrong**
  - The line is hard-coded second person in a feed both seats read (v2.83). It does not use `sv` or the seat name.
  - It names a hero's cards ("Bravo cards") that Lyath does not have.
  - Probably part of the pinned second-person debt (45 literals), but the "Bravo" part is a separate wrong claim.
- **Direction**: feed text only.
- **Engine site**: `engine/effects.js:2674`.
- **Confidence**: high on the string, low on severity.

---

## Probed and found correct (so nobody re-checks them)

- **Kayo**
  - Might fires once per own action phase and not on a discard forced during the opponent's turn.
  - His +1{p} applies in hand, arsenal, pitch and graveyard but not on the chain.
  - Printed values: Rough Up 6→7 and Wild Ride 6→8 (Might), Bare Fangs 5→7 and 6→9 (discard +2, Might +1).
  - Buckwild's go again follows the pitched 6+ card.
  - Strongest Survive's reveal check, Savage Feast's discard cost, and Beaten Trackers offered only on random 6+ discards all read correctly.
- **Lyath**
  - Halving: Stand Strong 1→1, Helm 2→1, Tension in the Air 3→2.
  - Hero power: the +1{d} reaches defenders declared before it, driven and checked (Wee Wrecking Ball 2→3).
  - Mocking Blow: boos only when Lyath is ahead on life, and +N only when booed, both driven. It does not boo on an ally attack.
  - Suspense auras tick down on the controller's own turn and pay out +4/+5/+6 correctly. Confidence applies to the next attack action card only.
  - Walk in My Shoes' crush halves the opponent's attack action cards until the end of their next turn, then restores them.
- **Viserai**
  - Runechant pops are one arcane per source, in the right order, and Spellblade Assault's tokens are not in the firing set.
  - Soaks by Spellfire Cloak (sequential pitch, floating leftover), Reduce to Runechant, Beckoning Haunt X=0, Reaping Blade life-gain lock, and Runic Fellingsong "chose nothing" all behave.
  - The rite's own Runechant is made before the aura conditions are read (`effects.js:3573`).
  - The rite never fired in a driven game (no non-attack Runeblade action then a Runeblade card in one turn); v5.05's drills cover it.

## Out of scope but seen (other groups may want it)

- **Fai · Pouncing Paws**: `crouching tiger springs into your banished zone` has a lowercase card name and a hard-coded "your".
- **Fai · Wax On**: "Wax On answers at instant speed — +3 defence" prints the card's own defence value as if it were a bonus.
- **Engine-voiced noop reasons**: *"Searing Emberblade: weapon attack ability — cost read by the weapon reader."*, *"Predatory Plating — ability: activation gate — checked before the ability can be used."* and *"Pouncing Paws — ability: playable this turn — the flag is set when the card is created."* read like code comments.

## Coverage

- **Games played: 24**, all to a winner, with 0 policy refusals and 0 invariant violations. Total feed length 10,705 lines.
- **Seeds** (`d1`…`d12`, `first = N % 2`):

  | Group | Heroes | Seeds |
  |---|---|---|
  | Hero in seat 0, vs fai / briar / iyslander | kayo, lyath, viserai | d1, d2, d3 |
  | Hero in seat 1, vs dorinthea / boltyn / azalea | kayo, lyath, viserai | d4, d5, d6 |
  | Hero in seat 0, vs dash / gravy | kayo, lyath, viserai | d7–d12 |

- **Lines read**
  - **About 4,100 lines read in full** (end-phase boilerplate and "passes the turn" filtered out):
    - the nine seat-0 games vs fai/briar/iyslander (3,487 lines);
    - three seat-1 games vs dorinthea (636 lines).
  - **About 1,300 lines read in filtered passes**: Lyath vs Gravy (874 lines); a Viserai vs Dash slice; Kayo vs Boltyn filtered to hero lines.
  - **The remaining games (azalea×3, boltyn×2, Kayo/Lyath vs Dash, Kayo vs Gravy, Viserai vs Gravy) were only grepped**, for the Viserai rite/Malefic lines and for engine identifiers (`undefined`, `NaN`, `[object`). Findings 1–4 do not rest on them.
