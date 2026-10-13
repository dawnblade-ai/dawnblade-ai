# Findings — adversarial review B of v5.01–v5.08

Read-only review of `ca6e4ca` (v5.01) through `e40d41e` (v5.08). No engine or
test file was edited on `main`; every experiment ran in a scratch worktree at
`e40d41e` (or at `8865960^` for the v5.02 before/after census), since removed.

**Suite on main (`e40d41e`):** `# tests 3481 · # pass 3476 · # fail 0 · # skipped 5`, as expected.

Four verified defects: three in the rules, one in CLAUDE.md. All repros run from
the repo root with no network (they use `data/pool.json` through
`test/helpers/judged.js`).

---

## 1. A declared defender's "Discard this" hand ability is legal, and it pulls the card out of the wall

| | |
|---|---|
| commit | `4c9e862` (v5.04), which censused the hand readers and missed this one |
| where | `engine/effects.js:9494` `handAbilityOK`; `engine/judge.js:1091` (`activate`, `from:"hand"`); `index.html` `activateHand` (~4364) |
| boards | **both**: each door asks the shared `handAbilityOK`, and neither asks `P.isDeclaredDefender` |
| severity | sev-3, illegal play allowed (CR 7.3.2b: a declared defender is withdrawn) |
| confidence | high, driven |

**Defect.** v5.04's rule is that a declared defender is on the combat chain and
not in the hand, so it cannot be pitched or played. `judge.legal`'s `paySel` and
`play` branches and `playAtSpeed` now refuse it. The **hand-ability** door does
not. `handAbilityOK` checks that a *"Discard a card"* cost leaves a free card
(`handFree`), but for a `cost:"self"` ability (*"Instant - Discard this: …"*) it
never asks whether the card itself is in `blockH`.

**Failure scenario.** Seat 0 declares Arcane Twining (Wizard Action, 3{d}) or
Agile Windup, Photon Splicing or Reaper's Call against a 7-power Raging
Onslaught. In the reaction step it activates *"Discard this"*:
- `J.legal(g, {t:"activate", uid, from:"hand"}, 0)` → `null` (legal);
- after `reduce`: the card is in the **graveyard**, `blockH` still lists its uid,
  and the payload resolved (amp 1, or an Agility token, or the opponent marked);
- at the damage step, `judge.js:2063` (`if(!c) continue;`) skips the missing card,
  so the wall loses its 3{d}.

So the seat blocks, sees the attack, withdraws the block for value, and pays
nothing for the withdrawal. The trainer does the same through
`activateHand` → `_EFX.activateHandAbility`.

**Repro** (`node repro1.js` from the repo root):
```js
const J=require("./engine/judge"),H=require("./test/helpers/judged.js");H.db();
const atk={...H.card("Raging Onslaught",1),uid:"ATK"}, c={...H.card("Arcane Twining",1),uid:"AW"};
const g={...H.state({hand:[c],res:0,hp:20,name:"Def",blockH:["AW"]},{hand:[],name:"Atk"},{turn:3,actor:1}),
  phase:"action",step:"reaction",turnPlayer:1,attacker:1,priority:0,passed:[false,false],firstPlayer:1,round:1,
  over:null,stack:[],chain:[],chainCards:[atk],pend:{card:atk,from:"hand",by:1,total:atk.power,ga:false,ops:[],onHit:[]}};
console.log(J.legal(g,{t:"activate",uid:"AW",from:"hand"},0));          // null  (should refuse)
const s=J.reduce(g,{t:"activate",uid:"AW",from:"hand"},0).state.sides[0];
console.log(s.grave.map(x=>x.uid), s.blockH, s.amp);                   // ['AW'] ['AW'] 1
```
Observed: `null`, then `[ 'AW' ] [ 'AW' ] 1`. Same result for Agile Windup (an
Agility token appears) and Reaper's Call (the opponent becomes marked).

**Fix direction.** In `handAbilityOK`, refuse when `P.isDeclaredDefender(sd, c.uid)`
and the cost is `"self"`. Rally the Coast Guard's `"card"` cost, gated
"while defending", must stay legal. Then add it to `test/defenderzone.test.js`'s
door census.

---

## 2. The trainer's aura-attack door has no action-point gate, so Waxing Specter swings at 0 action points

| | |
|---|---|
| commit | `ca6e4ca` (v5.01) — the new `from==="aura"` route |
| where | `index.html:3977` (`if(costsAP(card) && act(s).ap<1)`), `index.html:4207` (the aura block); judge's twin is `engine/judge.js` ~1320 (`if(!(sd.ap > 0)) return "no action point left"`) |
| boards | **trainer only.** The table refuses it |
| severity | sev-3: an extra attack with no action point, and the state goes to `ap: -1` (`NEGATIVE-AP`, CR 4.4.3e) |
| confidence | high: the gate expression and the shared resolution were driven; the closure itself cannot be loaded in Node |

**Defect.** The aura route borrows the ally route's refusals (grant, tap,
once-per-turn) but not the action-point check. The trainer's only action-point
gate is `costsAP(card) && act(s).ap<1`, and `costsAP` reads the **aura card's**
own type line. Cosmo's grant is *"Once per Turn **Action** - {r}: Attack"*, but
**Waxing Specter is a `Mystic Illusionist Instant - Aura`**, so
`costsAP(Waxing Specter) === false` and the gate never fires. Enigma's precon
decks 2× Waxing Specter and Cosmo.

**Failure scenario.** Enigma, Cosmo equipped, Waxing Specter (ward 3) on the board,
her action point already spent, mode `act`, on her turn. She taps the Specter and
`tryPlay(card,"aura")` raises no refusal (the AP gate is false and the aura block
asks only grant/tap/once). `execute` declares the attack, and `linkPayload`
(`effects.js:8046`, `ap = pend.ga ? ap : ap-1`) charges the point she does not
have, leaving `ap: -1`. The table refuses the identical play with *"no action
point left"*.

**Repro** (`node repro2.js`): builds Enigma's real precon through
`buildSideDefault` (Cosmo equipped), puts Waxing Specter on her board with `ap:0`,
and prints:
```
grant: {"cost":1,"taps":false,"oncePerTurn":true,"power":3,...}  costsAP(WS): false
TRAINER gate  costsAP(card) && ap<1  => false (not refused)
TABLE  judge.legal: no action point left
TABLE control ap=1: null
linkPayload (the trainer's resolution step) after execute(from "aura"): ap -1
```
(Script: the Enigma table from `test/cosmo.test.js`'s `table()`, then
`H.execute(g, ws, "aura", 0)` followed by `J.withEffects(m, (f,x) => f.linkPayload(x, {total:3, dealt:3, heroHit:true}))`.)

**Fix direction.** In the aura block (and the ally block, for symmetry), refuse
on `act(s).ap < 1` regardless of `costsAP(card)`: the grant line is an Action.
Judge already does this.

---

## 3. `playTargetWhy` treats every `ctrPut` as targeted, so the trainer refuses Uphold Tradition's flip

| | |
|---|---|
| commit | `7c3a056` (v5.07) |
| where | `engine/effects.js:10748` (`if(k === "ctrPut" && !ctrPutCands(sd, spec).length)`); asked by `index.html:4050` in `tryPlay` for **every** route, gear abilities included |
| boards | **trainer only, and only in the player's own action phase.** Judge's gear branch asks `rxTargetWhy` → `pumpTargetWhy`, not `playTargetWhy`. The trainer's opponent-turn door (`activateInstant`) asks only `pumpTargetWhy` |
| severity | sev-1/2: a legal play is refused, with a false reason ("nothing it can target") |
| confidence | high, driven |

**Defect.** v5.07 meant to refuse a *played card whose whole payload is a
printed target*. But `ctrPut` is also emitted for untargeted text, and
`playTargetWhy` is called by the trainer's `tryPlay` for powCards too.
Uphold Tradition (Enigma's default Arms piece, Cloaked) prints
*"Instant - {r}, turn this face-up: Put a +1{p} counter on **an** aura you control
with ward."* That is not "target". Its payload is that one `ctrPut`, so with no
ward aura `rest()` is false and the activation is refused.

Activating it with no aura is still worth doing: flipping it face-up is the only
way to switch on its `Ward 1` (the 2026-10-04 ruling, `parser.abilitiesLive`).

**Failure scenario.** Enigma at the trainer, Uphold Tradition face-down, no ward
aura in play, her own action phase. She taps the gear: `tryPlay(powCard,"hero")`
→ *"Uphold Tradition — ability: you control nothing it can target."* The same
activation is legal at the table, where it flips the piece and turns Ward 1 on.
It is also legal on the trainer during the opponent's turn
(`activateInstant`), so the trainer disagrees with itself.

**Repro** (`node repro3.js`: the real Enigma precon, auras removed, `res:5`):
```
uphold in gear: true  face-down: _faceDown=true   auras: 0   ward live before: 0
TABLE legal(activate Uphold): null
TRAINER playTargetWhy(powCard): Uphold Tradition — ability: you control nothing it can target
after table activation: _faceDown=false   ward live: 1   res 4
```
Census across the pinned pool's cards and powCards (empty board, empty
graveyard): `playTargetWhy` fires for exactly Astral Etchings ×3, Memorial
Ground ×3, Lightning Press ×3, Concealed Object's ability, Fai's, Beckoning
Haunt's, Crown of Dichotomy's and **Uphold Tradition's**. Every one prints
"target" (or is refused by judge through `abPickSpec`) except Uphold Tradition.
Re-Charge! prints the same untargeted shape (*"Put a steam counter on **a** Hyper
Driver"*) and escapes only because `rest()` sees its `buffNext`.

**Fix direction.** Mark `ctrPut` as targeted off the printed word (or make
`ctrPutCands` emptiness a refusal only for ops that print "target"), and/or keep
`playTargetWhy` off the powCard routes, as judge does.

---

## 4. CLAUDE.md still instructs readers to widen `parser.pumpRead`, which v5.02 deleted

| | |
|---|---|
| commit | `8865960` (v5.02) deleted `pumpRead` and the whole-text fallback |
| where | `CLAUDE.md:7013–7014` (*"WHEN YOU ADD AN OP THAT CARRIES A PRINTED VALUE, ADD IT TO BOTH LISTS — `parser.pumpRead` and `fairness.PUMP_OPS`"*); `CLAUDE.md:483–485` (*"The fallback's existing magnitude test is what suppresses it"*) |
| severity | doc |
| confidence | certain: `grep -n pumpRead engine/*.js` finds only the retirement comment |

The instruction names a function that no longer exists, and the v3.73 paragraph
describes a guard on a fallback that is gone. `tools/fairness.js` was updated
(*"…is gone at v5.02"*). CLAUDE.md was not. This is the "retired function named as
a live one" shape from v4.60.

---

## Checked and not reported (no verified defect)

- **v5.02 retirement, before/after**: `fx.self` for all 797 pool records and
  every hero, equipment and arena powCard, compared at `8865960^` and `e40d41e`.
  20 values moved, all pumps already read elsewhere: the census's 18 pool cards,
  plus **Tearing Shuko's ability** powCard (`self 2 → 0`; `namedBuff` still carries
  its +2, so this removes a double). No pump was lost.
- **v5.03** `pumpTargetWhy` reaches exactly Lightning Press ×3 and Concealed
  Object's ability; every door asks it.
- **v5.05** activations never reach `hist.playTy`, because powCards carry no `ty`.
  The `execute` call sites pass only play zones or activation routes.
- **v5.06** `wardNext` is swept for both seats and counted in `held`; Toe the
  Line's merged op keeps `next` and its rider.
- **v5.08** `heroAbilityName`/`condWhy`: no defect found.
- Out of scope, noted only: `unpreventable` (Murkmire Grapnel) sets
  `n._unpreventable`, which nothing reads, so its "can't be prevented" does nothing.
  That predates v5.01.

## Sabotage log (scratch worktree at `e40d41e`, one edit at a time, reverted with `git checkout` and checked byte-identical)

| # | sabotage | drills run | result |
|---|---|---|---|
| S1 | v5.01 arena row back to a plain arrow that returns the handler | tapdoor | **bites** (2 fail) |
| S2 | v5.01 `swingSpentWhy` refuses every second swing | swinglimit | **bites** (2) |
| S3 | v5.01 trainer aura door drops its once-per-turn refusal | full suite | **bites** (2) |
| S4 | v5.02 whole-text self-pump fallback restored | selfpump | **bites** (2) |
| S5 | v5.03 `pumpTargetWhy` accepts the opponent's attack | instantpump | **bites** (1) |
| S6 | v5.03/v5.07 trainer `tryPlay` drops `playTargetWhy` | instantpump, notarget | **bites** (1) |
| S7 | v5.04 judge `paySel` lets a declared defender pitch | defenderzone | **bites** (1) |
| S8 | v5.04 `handFree` stops excluding the wall | defenderzone | **bites** (4) |
| S9 | v5.05 `PLAY_ROUTES` admits `"weapon"` | playroute, briar | **bites** (3) |
| S10 | v5.06 a shield keeps its leftover (budget again) | ward | **bites** (2) |
| S11 | v5.06 end phase stops counting `wardNext` in `held` | ward | **bites** (2) |
| S12 | v5.07 `playTargetWhy` ignores `rest()` | notarget, instantpump, journey | **bites** (3) |
| S13 | v5.07 `arsNoOpWhy`'s arsTurn case removed | full suite | **bites** (1) |
| S14 | v5.08 `condWhy`'s hit-time table removed | feedvoice | **bites** (1) |
| S15 | v5.08 `heroAbilityName` names the seat | feedvoice, tokenline, briar | **bites** (2) |
| S16 | v5.01 trainer weapon door back to "any second swing refused" | swinglimit, keycensus | **bites** (1) |

16 of 16 bite. No guarding drill was silent. The gaps are what no drill guards at
all: findings 1–3 are each a rule missing from a door, and the suite stays green
because nothing drives that door with the failing input.
