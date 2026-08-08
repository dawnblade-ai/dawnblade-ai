# ROUNDS — the Kayo-mirror testing log

Baton for whoever picks up card/table work next. Per `JOB-AID-TESTERS.md` §8:
short, a handoff not a report.

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
