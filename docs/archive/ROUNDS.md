# ROUNDS — the Kayo-mirror testing log

Baton for whoever picks up card/table work next. Per `JOB-AID-TESTERS.md` §8:
short, a handoff not a report.

---

## Round 3 — three testers on the mirror · 2026-08-09 (v2.64 → v2.65)

**Three testers, three axes, run in parallel:** the `declOps` whitelist and
the borrowed actor (headless); the hero ability across the seats (headless);
and play at 393×852 (browser, exclusive). Baseline verified before dispatch —
834 green, fairness clean, tree clean at `ce35a58`.

**The split was the finding.** The two headless testers found four value
leaks; the one that PLAYED it found a soft-lock that makes the mirror
unable to finish a game — and no tool here could have found that one.
`invariants.js` stayed silent throughout, correctly, because a control-flow
dead end is not an illegal state.

**Fixed and shipped in v2.65** (see CHANGELOG for the detail):

| sev | what | where |
|---|---|---|
| 3+ | `foeSwing`'s no-play branch never reached `newTurn` — the game froze where it stood, permanently | index.html `foeSwing` |
| 3 | a prompt addressed to seat 1 was answered by, and paid out to, seat 0 | `promptConfirm` |
| 3 | `foePick` ignored `fx.playIf` — Bear Hug and Run Roughshod swung with the printed gate unmet | `foePick` |
| 3 | Savage Feast's additional cost was never paid by seat 1 | `foePlay` |
| 2 | the `[3,4,5]` table was displayed as a prediction while a real hero played real cards | hero row |

**Drills:** `test/mirror.test.js`, 10 new (834 → 844). **12 sabotages run,
12 caught** — one only after a fix: the `_opening` guard matched its own
COMMENT and passed with the gate deleted.

**Verified in play, not only drilled.** Opponent-first mirror at 393×852:
the soft-lock condition arose on the first opportunity (opponent opened
Buckwild, pitched two, went to one card), and the game carried through it —
turn advanced, action point returned, seat 1's hand refilled 1 → 4, judge
clean.

**Filed, NOT fixed — deliberately out of the scope agreed for this round.**
These are real and each has a location; they are the next round's queue:

- sev-1 `fx.onHit` is never read on the opponent's swing (Strongest Survive
  ×6 — the player never discards)
- sev-1 seat 1's Might/Agility tokens never crumble (the start-of-turn sweep
  reads `you(out).board` only, `index.html:3610`) — and seat 1 CAN own one
  today, via losing a clash (`index.html:3461`)
- sev-1 seat 1's declared defenders fire no "when this defends" trigger, so
  all 7 of Kayo's clash cards are plain blockers in its hands
- sev-1 seat 1's blockers enter the graveyard **unstamped** (`effects.js`
  `resolveStack`) where the player's are stamped — latent, no live
  consequence for Kayo, but the documented invariant is broken
- sev-1 a spurious *"no additional-cost discard to feed — bonus skips"*
  prints on every Bare Fangs / Wild Ride / Pulping attack **and then the
  bonus applies** — the log teaches the opposite of the rule
  (`engine/effects.js`, the `else if` after the addCost block)
- sev-1 END TURN dead-taps during the arsenal step
- sev-1 the loadout still tells the player seat 1 "takes no action phase, so
  its swing is the scripted escalation" — untrue since v2.63
  (`index.html:4330`)
- sev-1/2 the opponent's graveyard pane is a hardcoded empty state; its
  pitch zone is never rendered; its weapon slot shows empty with Mandible
  Claw equipped
- sev-2 four user-facing strings still say "the dummy" though `foeName`
  exists for exactly this (`index.html:2251`): the clash log (×2), reprise,
  and `WinPanel`'s "DUMMY DESTROYED". The VS splash (`index.html:1632`) is
  unconditional in source but sits on the hero-select screen *before* an
  opponent is chosen, so it reads as a default — check it after selection
  before changing it.

**Clause 2 — RULING (user, 2026-08-09):** the +1{p} is a **display rule as
well as a threshold rule**, and the display should be **visually flagged**
so a player can tell a clause-2 value from a printed one. The threshold half
is built and verified correct; **the display half is not built.** That is
the largest single item in the queue above.

**Ruled out, not filed** — checked and correct: clause 2 is genuinely
per-side (all 11 call sites pass the owner's build via `bAct`/`bFoe`);
`symmetryGap()` 42/42 both seats, `flatRemaining` 0; `invariants.check`
clean on a real mirrored opening; equipment legal and symmetric (identical
5 pieces, no repeat of the v2.41 eight-gear bug); the `declOps` whitelist
drops nothing that matters for Kayo; the borrowed actor is correct on all
11 ops including direction-sensitive `mark`/`dmg`; `foePick`'s printed-power
sort is a fair heuristic, not a wrong number; `foePlay`'s raw `card.power`
on the chain is right, and right for the stated reason.

**Coverage this round:** the opponent-first opening was driven end to end.
A full multi-turn game still has not been played — the soft-lock is why it
could not be, and that cause is now removed rather than outstanding.

---

## Round 2 — BUILDER pass, Kayo end to end · 2026-08-08/09 (v2.53 → v2.64)

**Round 1's two findings are both fixed** (v2.64), four days after they were
filed and root-caused. Both were exactly where Round 1 said they were:

- **Finding 1 — unstyled seat screen.** The table's `step==="seat"` block
  rendered `className="lobseat"` while every rule is scoped `.rps .rtitle`
  / `.rps .rsub` / `.rps .rseatpick`. Fixed by adding `rps` to the
  className, which is the smaller change Round 1 recommended.
- **Finding 2 — preview off-screen from the board panel.** `PeekDock`'s
  `querySelector(".phand, .chand, .hand")` took the FIRST rail in document
  order, which on the table's three stacked screens was the chain screen's.
  It now considers every rail and picks by **visible height**, which needs
  no refs and no knowledge of which board is rendering — so one component
  still serves both.

**A JUDGE finding is worth filing even when nobody fixes it that day.**
Both were reproduced from the write-up alone, with no re-investigation.

**Kayo is complete.** Nine hero/card defects built or corrected across
v2.55–v2.63 — see CHANGELOG. Every one of them reported tier `full` before
the fix. The three that no tool in this repo could have found:

- **clause 2 doing nothing** (22 of 47 cards satisfied his own threshold;
  45 after) — found by reading the hero's printed text against the deck list
- **`_foe is not a function`**, a crash on every clash resolved on defence
  — found by reading a browser console after two testing agents died
- **Might minted on the opponent's turn** — found by watching a card work

**Two more found by playing after the drills were green:** Rally the Coast
Guard's `+3{d}` was written to state and thrown away one line before the
wall was totalled (`finishBlock(s, clashDef, {})`), and the log never named
the card you played.

**Left unclaimed:** the networked table still runs no card text. That is not
a location problem any more — `engine/effects.js` holds all three semantics
functions — it is that `execute` advances the turn structure as well as
applying effects. See `HANDOFF.md`.

---

## Round 1 — JUDGE pass (live table + headless engine) · 2026-08-04

**Role:** JUDGE only — no engine code written this round. Three testers: me
(live 2-tab table play) + two subagents (headless `engine/judge.js` driving).

**Baseline:** `npm test` 790/790 green before starting.

**What was tested:** A real 2-peer WebRTC table match, Kayo vs Kayo, table
code **RHNB**, played end-to-end by me across both browser tabs — lobby,
hero pick, throw, seating, sideboard, a full turn 1 (attack → defend →
damage → chain close → CR 4.4.3 end phase, including the turn-1 double-draw)
and into turn 2 (arsenal, weapon activation). In parallel, two subagents drove
the pure reducer headlessly: one fuzzed **60 full games** across seeds and
seating order with `invariants.errors()` checked after every action; the
other ran **5 scripted scenarios** (Mandible Claw once-per-turn vs tap,
CR 4.4.3 end-phase order, defend-step priority, payment math, symmetry),
asserting on state fields, never on log prose.

**Numbers:** 127 assertions/games across the two subagents, **0 engine
findings**. That is a real result, not a shortfall — the CR turn structure,
priority, chain, damage math, weapon costs and seat symmetry all held for
Kayo-vs-Kayo. Both peers' `net.js` state hashes matched throughout live play
(`desyncs:0, resyncs:0`).

### Finding 1 — table's seat-choice screen is entirely unstyled

**`index.html:5286-5299`** (table lobby, `step==="seat"`). The block —
title, subtitle, and both "I go first / They go first" buttons — needs a
`.rps` ancestor class for its CSS to apply (`index.html:570-593`,
`.rps .rtitle`, `.rps .rsub`, `.rps .rseatpick button`). The **solo**
trainer's identical markup (`Pregame`, `index.html:4930-4968`) correctly
wraps in `<div className="rps">`; the table's copy doesn't. Verified live
in solo play that the reference version renders correctly (big bold title,
two properly boxed buttons, one accent-colored) — confirmed table-only.

Result: "You won the throw / The winner chooses..." and the two seating
buttons render as unstyled, unspaced run-on text —
`"I go firsttake the initiativeThey go firstkeep the extra card"`. Still
functionally clickable (verified via `ref`-click, advanced the lobby state
correctly) — a legibility bug, not a dead tap.

**Fix shape:** wrap the `step==="seat"` JSX block in `<div className="rps">`
(or move `.rtitle`/`.rsub`/`.rseatpick` off the `.rps`-scoped selectors onto
something the table wrapper already has — `.rps` is the smaller, safer
change since `TableThrow` already uses it correctly one screen prior).

### Finding 2 — card preview renders off-screen when peeking from the table's board panel

Peeking any card (reproduced with a gear piece and the weapon) from the
table's "Your board" screen opens `PeekDock` at **y ≈ -365px** — entirely
above the viewport, invisible. Root cause: `index.html:2021`,
`document.querySelector(".phand, .chand, .hand")` inside `PeekDock`'s
measurement effect is **not scoped to the currently-visible screen**. The
table has three vertically stacked screens (opponent board / chain+hand /
your board); when peeking from "your board", the query finds the `.phand`
belonging to the *chain* screen, which is scrolled mostly-but-not-fully off
the top (`rect.top ≈ -73px`, `rect.bottom` still >0) — just enough to dodge
the existing "is it on/off screen" guard (`r.bottom<=0 || r.top>=innerHeight`)
and produce a huge, wrong `--peekbot` offset (~893px) meant for a rail near
the viewport bottom.

The tap still commits correctly underneath (log said "Kayo declares
Knucklehead", state hash matched on both peers) — legibility bug, not a
dead tap, but it defeats the entire two-tap peek-first design ("look before
you commit") for every card interaction on that screen. **JUDGE!! report
saved** via the in-app button: table RHNB, seat 1, turn 1 — see
`~/Downloads/dawnblade-bug-kayo-t1-1785849361693.json` (note field is
empty — my own targeting slip typing into it, not a repro detail; the
useful state is in the saved JSON itself).

**Fix shape:** the rail lookup needs to find *this screen's* rail, not the
first one in DOM order. Simplest: scope the query to the nearest ancestor
`vscreen`/`.hpane`, or have each board pass its own rail ref into
`PeekDock` instead of `querySelector`ing the whole document.

**Also confirmed, not a bug:** the v2.51 pitch-slot-3/4 payment bug
(`KAYO-GUIDE.md` §8) is genuinely fixed as of v2.52 — reproduced the exact
scenario (pitching from hand slot 3 to cover another card's cost) and it
worked cleanly both times I tried it.

**Ruled out, not filed (verify-before-report worked as intended):**
- Bare Fangs appearing twice in hand — it has two real printings (pitch 1
  and pitch 2) in the Kayo pool; a second draw is correct, not a dupe bug.
- Knucklehead's BLOCK value dropping 2→1 after one block — `Temper`
  (`engine/game.js:39`, `tools/ledger.js`) is a live, correctly-implemented
  keyword ("-1 def per block, destroyed at 0"), distinct from Battleworn.
- "Pitched Reincarnate for 3." appearing to float at the top of the wrong
  screen — a mid-`scrollIntoView`-animation screenshot artifact, not a
  state bug; confirmed by re-reading the log in its normal chronological
  position afterward.
- My own JUDGE!! note field saving empty once — reproduced clean with a
  precise `ref`-targeted click; was my own coordinate miss, not a product
  bug.

**JUDGE verdict:** two solid, root-caused, reproducible table-UI findings
(both about screen/context scoping — CSS ancestor scoping for Finding 1,
DOM-query scoping for Finding 2). Engine and sync layer verified clean at
depth. Did not manufacture a third finding to hit a round number — an
honest miss is worth more than a guessed one.

**Left unclaimed:** nothing card-related this round — this was engine/UI
testing only, no parser or `classifyClause` work touched.

**Open question for the human:** none — both findings are scoped and
actionable as-is.

---

## Coverage checklist — table-layer testing only (not card text; see §7 of `KAYO-GUIDE.md`)

Table mechanics actually exercised this round, live, on table RHNB:

- [x] Lobby: hero pick (mirrored, both Kayo), throw, seating call, sideboard
- [x] Turn 1: pitch-to-pay flow (incl. slot 3/4 — confirmed fixed v2.52)
- [x] Attack declaration → defend step (attacker holds priority, CR 7.3.3 — correct)
- [x] Blocker declaration (gear) → damage resolution → correct wall math (5 pow − 2 def = 3)
- [x] Chain close, resolution step
- [x] End phase, full CR 4.4.3 lettered order incl. turn-1 double draw (4.4.3f)
- [x] Arsenal step (face-down set)
- [x] Weapon activation entry (Mandible Claw, cost {r}{r}) — payment flow reached, not completed live (session ended mid-payment on an unrelated finding)
- [ ] Weapon swing → attack → resolution (activation started, not carried through)
- [ ] Two full turns each side / a completed game
- [ ] Ally interactions (n/a — Kayo has none)

Headless (both subagents, `engine/judge.js` direct): full games end-to-end,
60+ across seeds/seating, all CR/priority/payment/symmetry checks green —
see subagent summaries above for exact scope.
