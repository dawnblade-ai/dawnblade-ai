# FINDINGS — review A (v4.95 … v5.00)

Read-only adversarial review of `c75bc66` (v4.95) through `be78686` (v5.00).
Every sabotage ran in a scratch worktree at `origin/main` (`e40d41e`, v5.08)
and was reverted with `git checkout -- <file>` inside that worktree only.
Line numbers are against `e40d41e`.

**Suite on main:** `npm test` → `# tests 3481 · # pass 3476 · # fail 0 · # skipped 5`.

**Headline: no live rules defect was found in the six commits.** Every rule
they add is enforced on the board(s) it claims, and 34 of 36 sabotages bit.
What follows are one drill gap with a demonstrated consequence and three
latent / unexpressible items, each verified, none reachable by a pool card
on today's trainer.

---

## F1 — `playAtSpeed`'s `handBlockers` forward is load-bearing and undrilled

| | |
|---|---|
| commit | `c75bc66` (v4.95) |
| where | `engine/effects.js:5677` (`playAtSpeed` → `execute`); caller `index.html:3437` (`playRx`), `index.html:3468` (`playRxA`, via `...rxWall(s)`) |
| defect | Weak drill. Reprise (Ironsong Response, Out for Blood, Overpower, Stroke of Foresight — Dorinthea's attack reactions) reads the hand-blocker count, which on the trainer reaches `execute` **only** through this forward. Dropping it silences reprise on the trainer's reaction doors and the whole suite stays green. |
| failure scenario | Trainer, Dorinthea swings Dawnblade; the dummy blocks with a card from hand (`{k:"def", gi:null}` layer). She plays Ironsong Response from hand. With the forward intact the layer is `+3`; with `handBlockers` dropped (or `rxWall` miscounting) it is `+0`, and no drill notices. |
| repro (probe) | `playAtSpeed(g, IronsongResponse, "hand", {window:"attack-reaction", handBlockers:hb})` over a weapon `pend` by seat 0: `hb=0 → stack rx "Ironsong Response — +0"`, `hb=1 → "Ironsong Response — +3"`. The field decides the card. |
| sabotage | S19: `handBlockers: o.handBlockers \|\| 0` → `handBlockers: 0` in `playAtSpeed`. **SILENT** on `test/playatspeed.test.js` and related files (195 tests), and **SILENT on the full suite** (3481 / 0 fail). |
| severity | low (no live defect today; a future edit to `rxWall` or the forward can break Dorinthea's reprise on the trainer with nothing red) |
| confidence | high |
| suggested drill | one `playatspeed` case: Ironsong Response with `handBlockers: 1` pumps the link +3 and with `0` pumps +0 — both halves (v3.98). |

## F2 — the trainer's defence-reaction doors count `handDefenders` off the wrong structure (latent)

| | |
|---|---|
| commit | `c75bc66` (v4.95) |
| where | `index.html:3438` (`playRx`, defence window) and `index.html:3492` (`playRxA`, arsenal) |
| defect | Both pass `handDefenders: s.stack.filter(l=>l.k==="def" && l.gi==null).length`. `s.stack`'s `{k:"def"}` layers are the **dummy's** defenders on the **player's own** attack (`dummyDefence`). In the defence-reaction window the player is the DEFENDER and their declared hand defenders are `you(s).blockH` — which is exactly what the trainer's own wall uses two hundred lines later (`index.html:4980`, `handDefenders: bcards.length`) and what judge's wall uses (`judge.js:2046`, `sd.blockH`). A hand-rolled reader of the wrong zone beside the correct one. |
| failure scenario | Synthetic only: a defence reaction printing `defSelf.when: "withHandDefender"` (the Unity line), played from the trainer's react step after the player declared a hand defender, reads `handDefenders: 0` (stack is empty in `mode:"block"`) and is worth its printed value instead of +N. |
| why latent | Measured: `withHandDefender` is emitted only by the Unity line (`parser.js:4963`), and both Unity records are EQUIPMENT, never a played DR. judge's DR path (`judge.js:3226`) passes no `handDefenders` at all, so today both boards answer 0 — they agree by accident, not by reading the same thing. |
| severity | low / latent |
| confidence | high (code read; no pool card reaches it) |

## F3 — the trainer's new CR 7.3.2b refusal cannot fire (latent, by measurement)

| | |
|---|---|
| commit | `b1fafb8` (v4.96) |
| where | `index.html:4935` (`toggleBlock`, gear branch); record at `index.html:5024`; clears at `4872` and `5140` |
| defect | A refusal that can never fire on the board it was added to. `chainBlocked` only matters on a second link of the same chain, and the trainer's opponent is always the vanilla dummy (ruling 2026-08-16): `foeVanilla` spends its only action point (`index.html:4809`) and vanilla cards print no go again, so the dummy's turn is exactly one link. The player's `chainBlocked` is then cleared at the opening hand-off and at the player's `newTurn`, before the next swing. The code and the record are correct; the drill (`test/defenddoor.test.js`) is a source scan and the commit/comment text ("until now it did only on the TABLE") reads as a behaviour change the trainer cannot exhibit. |
| failure scenario | none reachable — which is the finding: no game state reaches the refusal. |
| sabotage | S7 (refusal off) and S8 (record dropped) **BIT**, but only via the source scan; no driven drill exists or can exist on this board today. |
| severity | informational (no harm; stated so it is not counted as a verified rule) |
| confidence | high |

## F4 — `arsNoOpWhy`'s `needEmpty` / `arsFree` split is unexpressible

| | |
|---|---|
| commit | `be78686` (v5.00) |
| where | `engine/effects.js:9013` |
| defect | Sabotage S29 collapses `ap.needEmpty ? !arsEmpty(sd) : !(arsFree(sd) > 0)` to `!(arsFree(sd) > 0)`: **SILENT on the full suite**. Nothing writes `sd.arsCap` (grep: only the reader at `parser.js:8194`), so capacity is always 1 and the two gates coincide — CLAUDE.md's own v2.34 note. |
| failure scenario | none reachable today; the day a second arsenal slot exists, Death Dealer / Bull's Eye Bracers ("if you have NO cards in your arsenal") would be offered with one card already there. |
| severity | informational / latent |
| confidence | high |

---

## Sabotage log (scratch worktree, each reverted)

| # | commit | sabotage | result |
|---|---|---|---|
| S1 | v4.97 | drop `alsoDef` flag in `fxParse` | BITES (4) |
| S2 | v4.97 | `defendsCondMet` unknown gate → `true` | BITES |
| S3 | v4.97 | defend half runs without borrowing the defender's seat | BITES (2) |
| S4 | v4.97 | borrowed seat not handed back | BITES |
| S5 | v4.97 | `lifeLt` → bare `me.hp < them.hp` (drops Line Crossers) | SILENT on attacksordefends/notmetvoice/condcensus; BITES on the full suite ("every cross-seat life comparison goes through the one pair") |
| S6 | v4.96 | `sheetFirst` stops asking `s.over` | BITES |
| S7 | v4.96 | trainer `chainBlocked` refusal off | BITES (source scan only — see F3) |
| S8 | v4.96 | trainer stops recording `chainBlocked` | BITES (source scan) |
| S9 | v4.96 | player's `chainBlocked` clear removed from `newTurn` | BITES (source scan) |
| S10 | v4.96 | `defCapWhy` off-by-one (`<` → `<=`) | BITES (2) |
| S11 | v4.96 | trainer hand cap call off | BITES (source scan) |
| S12 | v4.96 | trainer gear cap call off | BITES (source scan) |
| S13 | v4.95 | card may pitch for itself | BITES (5) |
| S14 | v4.95 | printed cost instead of `effCost` | BITES (2) |
| S15 | v4.95 | `addPaid` lost before `defendValue` | BITES |
| S16 | v4.95 | `rxNoTargetWhy` check removed | BITES |
| S17 | v4.95 | `fromArsenal` always false | BITES |
| S18 | v4.95 | window not forwarded to `execute` | BITES |
| **S19** | v4.95 | **`handBlockers` not forwarded** | **SILENT — full suite (F1)** |
| S20 | v4.95 | "no attack to react to" check removed | BITES |
| S21 | v4.98 | "enters the arena" refused | BITES |
| S22 | v4.99 | charge highest pitch | BITES |
| S23 | v4.99 | multi offer charged again | BITES |
| S24 | v4.99 | offer `uids` filter dropped | BITES (2) |
| S25 | v4.99 | back to declining | BITES |
| S26 | v5.00 | `arsNoOpWhy` always null | BITES (3) |
| S27 | v5.00 | hand-filter refusal off | BITES |
| S28 | v5.00 | hand filter ignores the arrow filter | BITES |
| **S29** | v5.00 | **`needEmpty` collapsed to `arsFree`** | **SILENT — full suite (F4, unexpressible)** |
| S30 | v5.00 | `conds` whole-payload guard dropped | BITES |
| S31 | v5.00 | `ops` whole-payload guard dropped | BITES |
| S32 | v5.00 | empty-arsenal cycle refusal off | BITES |
| S33 | v5.00 | token line foe possessive hand-rolled again | BITES |
| S34 | v5.00 | token line double period restored | BITES |
| S35 | v5.00 | Glisten subject not inflected | BITES |

## Checked and clean (no finding)

- `defCapWhy` extraction (v4.96) is byte-for-byte the old judge logic; both boards ask it.
- `defendsTriggers` defend half (v4.97) runs at the defender's seat on both walls (`afterDefenders` → `1 - actorOf`, trainer `takeIt` → `actorOf`), from a closed vocabulary that shares the main loop's readers.
- v4.99's charge answer comes off `p.uids`, which judge builds from `handFree`, so it can never name the card being played or a declared defender.
- v5.00's `arsNoOpWhy` refuses no hand-played card in the pool (census of every record over empty and occupied arsenals: 0 refusals) — Call in the Big Guns carries a `buffNext` op, so the whole-payload guard holds.
