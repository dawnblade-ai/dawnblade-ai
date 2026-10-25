# DAWNBLADE STAGE: the table brought to life

**Status: design, not built.** Design week, 2026-10-14 to 2026-10-16. Nothing in this file has shipped. **Revised 2026-10-18:** the phone's hand and action bar are now a hand wheel in a thumb lane (§2.1), the broadcast field is an overhead playmat (§2.2), and §8.3's open question is answered yes. Appendix C holds both layout changes and their measurements. Every engine claim cites the tree at v5.30 (`4d42c58`). The build order is §10, and its first release changes no look at all: it makes the feed fit to be read by a viewer.

**The brief, in the user's words.**
- "I want the final version to feel like super smash melee / a fighting game. But we are not trying to bring the cards to life — we need to bring the table to life."
- "I want to see an interface with health bars like a fighting game."
- "Each player should get 15 min and be able to track their time score — cumulative time remaining *and* average time."
- "Make them feel like the world is watching, the commentators are raving and the judge is closely watching every move."
- "All that grandeur but still keep it simple, like melee."
- "Think about how the game will look from the perspective of someone who has never read a single one of these cards."
- "We also need to make the game fast and the interface clean for the pros."
- "We also need a plan for a tutorial mode in addition to vs AI and the competitive ladder."

## The answers on one screen

| Question | Answer | Where |
|---|---|---|
| **Is three.js practical?** | **No, not for the table.** The card-art host sends no CORS headers, so WebGL cannot put a card on screen at all. The last build that loads from a plain `<script>` tag is r160 (January 2024), and every later one is ES-module only. It would add 26% to the page and run a GPU context iOS drops when the tab backgrounds. The fighting-game feel comes from DOM, CSS 3D in motion only, the Web Animations API and one Canvas2D overlay for sparks and flashbulbs: **0 added bytes**. | §9.1 |
| **The look** | One screen. Two skewed life bars and two clocks over a single lit ring. Cards stay printed and still; the ring, the wall, the bars, the light and the crowd perform. | §0, §2 |
| **Health bars** | Fill, a red chip trail that drains a beat after the hit, a hatched **ghost** of what lands if both players pass now (the engine's own answer, run on a copy), shield pills, a danger rim and hand pips. The numeral sits beside the bar. | §3 |
| **The clock** | 15:00 per seat, stamped by the sequencer **outside** the reducer, so lockstep and replays stay exact. Timeout is a loss. The time score is time remaining (wins only) plus average clock per turn. | §4 |
| **The moments** | An opening READY · GO plus twelve staged beats: turn, pitch, swing, wall, instant, strike (with hit-pause), nothing lands, go again, combo, hero power, danger, GAME. Passes are never staged, and any tap skips the staging. | §5 |
| **Commentators and judge** | Tally calls the play, Ledger explains the rule, and the judge's eye nods at every legal state and calls a refused reach in plain words. All three are **readers** of the engine, never authors. | §6 |
| **Newcomers and pros** | One interface with three presets: Story, Competitor and Instant. Four glyphs mean the same thing everywhere, and a strike equation reads `6 vs WALL 3 → 3`. Pros get auto-pass, yield, drag-to-ring, auto-pay and hotkeys. | §7 |
| **Tutorial, vs AI, ladder** | Eleven lessons (about 20 minutes plus one full game) and a Hero Trial per hero; four vs-AI tiers on the existing seat policy, each measured over 80+ games per pair, **if the AI may pilot a hero** (an open decision, §8.3); Clocked Friendlies now, a server-stamped ranked ladder in Phase C. | §8 |
| **Build order** | Twelve releases, v5.31 to v5.42 (the last two are the Phase C server and ladder), each with its own acceptance drills. | §10 |

## How this was made

1. **Four readers measured the tree:** the current UI, the event vocabulary a state diff can see, whether three.js is practical, and the craft of fighting-game and broadcast presentation.
2. **Three designs competed:** broadcast-first, pro-first and newcomer-first. **Three judges** scored them, playing a pro, a newcomer and an engineer.
3. **A synthesis** took the newcomer-and-engineer pick (A) as the base, grafted the pro layer from B and the story grammar from C, and settled every disagreement in §0.3. **A completeness critic** checked it against the brief and the tree, and **a final pass** applied every critique point (Appendix A).
4. **A clickable prototype** then replayed a real engine game through the design, and **an adversarial pass** checked what it found across the 210-game self-play corpus. Ten corrections came out of that, four of them found by trying to refute the first six. They are applied in place below, each marked *(corrected)*, and Appendix B holds the measurements. One of them is a question only you can answer: may the AI pilot a hero (§8.3)?

**The prototype** lives in `design/prototype/` (its README has the two rebuild commands). It replays Kayo against Dorinthea, seed `p1`: 351 actions, 18 strikes, and Dorinthea survives on 1 life. A phone seat view and a 16:9 broadcast view are both driven by the same director, at all three presets.

## The blueprint

**Decision basis.** Proposal A is the base. Two of the three judges chose it: the newcomer judge and the engineer judge. From B (the pro judge's pick) I take the pro layer: the primary button that shows the engine's own number, the projected damage preview, yield and stops, the combo counter, the clock-delay underline, and the "chrome never moves" drill. From C I take the story grammar: four number glyphs, hand pips, glowing the moves that are legal right now, stage-lab, the Safari-tab viewport, and citing CR numbers only where the rules code already cites them. Every judge dealbreaker is honoured. Section 0.3 lists each disagreement and how it was settled. The completeness critique is folded in throughout, and the appendix records what changed.

I re-checked these claims against the tree at v5.30 (4d42c58):
- `concede` is legal at any moment (engine/judge.js:766) and writes `how:"concession"` with "X concedes." (:2352-2355).
- `doPlay` opens a `pending` only when `cost > res` (:2455-2466).
- `settle` runs `afterDefenders` before `strike` (:1928-1929).
- `someoneCanRespond` checks both seats and is not exported (:3144; exports at :3721).
- `legal` routes plays through `playableWhy` (:1085, :1513).
- COMMIT is `{t, seq, seat, action, id, h}` (engine/net.js:166). The journal holds 20 commits (:108). `PROTO` comes from `W.PROTO` (:88).
- net.js `apply` calls `onState(state, {seq, action, seat, source, hash})` (:150-157).
- local.js `push` passes **only** `state` (engine/local.js:72). `runPolicy` is synchronous, and `submit` calls `push()` once (:78-111).
- `GM.sv` / `GM.sp` live at engine/game.js:105 / :135. The short hero name is `name.split(",")[0]` (index.html:1721, 5518, 5808).
- `buildVanilla` accepts empty gear (`(gearNames || [])`, engine/build.js:927). `DUMMY_GEAR` is the four Ironrot pieces (index.html:827), and they carry Blade Break.
- The actbar's discost, fuse and charge branches render one button per uid (index.html:7497-7555).
- tools/cup8.js:202 cites CR 7.3.3 for "the TURN player holds priority here". engine/sparring.js:660 cites CR 7.3.2 for declaring.
- selfplay's route regexes are inline (tools/selfplay.js:146-431) under a written no-mirror rule (:107-110).
- `tools/ledger.js` already exists, so the name "ledger" is taken twice.
- SUPABASE.md:174-176 says running the engine in a Deno Edge Function "has not been tried and is the first thing to prove".
- serve.sh copies only `engine/` (tools/phone/serve.sh:28). The wire census scans only `engine/` (test/wire.test.js:424-433).
- There is exactly one `.psheet` and there are two `<PromptSheet ` renders (test/glisten.test.js:515).
- `W.hash` treats `feed`/`log` as volatile (engine/wire.js:301).
- index.html has no manifest and no `apple-mobile-web-app-capable` tag, so the game runs in a Safari tab.
- `data/pool.json` exists, but `fetch` cannot read it from `file://`. The database host sends `access-control-allow-origin: *`. The art host sends none.

---

## 0. North star

You sit down and the table wakes up. READY. GO. Two skewed life bars and two chess clocks hang over a single lit ring. The cards are what they are: real printed faces, still, legible, never animated into creatures. Everything around them performs.
- An attack slides into the ring with its power stamped on it.
- The blockers rise into a wall in front of it, and a ghost on the defender's bar shrinks as they do.
- The table freezes for a sixth of a second, sparks fly, the bar snaps, and a red chip of lost life drains a beat later.
- The booth calls it, in print and optionally aloud, reading only what the engine did.
- A judge's eye in the centre of the HUD nods at every legal state. The instant you reach for something the rules don't allow, it speaks up in plain words.

A viewer who has never read a card follows the whole game through four numbers and one grammar of motion. A pro on Instant sees the same table as a clean, silent instrument that never makes them wait. A game is a pinned build, a seed and an action log, so every game can be watched, replayed and retold, and there is still only one rules engine.

### 0.1 The five design principles

| # | Principle | The user's words | What it requires | What it forbids |
|---|---|---|---|---|
| P1 | **The table performs; the cards stay printed** | "we are not trying to bring the cards to life — we need to bring the TABLE to life" | Card art as `<img>`, text streamed from the database on tap. The things that move are the ring, wall, bars, light, camera and crowd | Animated card creatures; card text in any banner, lesson line or voice; text on a tilted surface |
| P2 | **Numbers and motion tell the story** | "think about how the game will look from the perspective of someone who has never read a single one of these cards" | Four glyphs (power, defence, cost, pitch) that mean the same thing everywhere. One direction of motion means one thing. A strike equation. A caption that repeats state. Counters named by their own card | Any number, name or claim the state does not hold; paraphrased card behaviour |
| P3 | **Three verbs and a punch** | "keep it simple, like melee… hone in on the most important and meaningful actions" | Ammo (swing), money (pitch), armour (wall), then the strike. One screen, one primary button, an opening beat plus twelve staged moments, everything else quiet | Staging passes (64% of all steps), end-phase bookkeeping, payment UI, rows of equal buttons |
| P4 | **Input is never blocked** | "make the game fast and the interface clean for the pros who will have every card and deck memorized" | Any tap flushes staging. Fast and Instant paces. Auto-pass on forced windows. The button states the engine's own number. Drag-to-ring and auto-pay for pros | Animation that gates a tap; a banner that eats a tap; a clock that bills animation |
| P5 | **Honest grandeur** | "high stakes competitive rules enforced environment… the world is watching, the commentators are raving and the judge is closely watching every move" | A fair, sequencer-stamped clock. A visible judge who calls refused reaches. A booth that raves in tiers computed from numbers, in print and voice. A crowd that is real, or reaction-only | Fake chatters, fake handles, fake viewer counts, fake "featured" tables, predicted knockouts, wall-clock or presentation values inside `g` |

### 0.2 The hard constraints as design rules
1. **No build step and no ES modules.** New code is plain `<script src>` UMD files. Pure modules go in `engine/`; DOM-only modules go in a new `stage/` folder. New JSX stays small because Babel compiles it on every load. Every feature runs from `file://`. The only exception is an optional embed that cannot work there, the YouTube chat iframe, and it is hidden on `file://` rather than broken.
2. **The golden rule.** Presentation reads `g`, the feed and the moments, and writes nothing back. Every voice line carries its `seq`, and a drill checks every number in it against that row. Lesson and coach copy may name a card-specific fact only through a slot bound to a numeric field or `kw` entry of a card in that lesson.
3. **One engine.** The clock, director, particles, booth and speech all live outside `g` and outside `W.hash`. A timeout enters rules state only as an ordinary action with no timestamp: `concede{why:"time"}`.
4. **Phone first.** Layouts are asserted on boxes at 393x852, 393x660 (Safari tab), 375x667, 360x740 and 820x1180, never on screenshots.
5. **Both seats read the feed.** Seat-named lines, and seat-named HUD banners too, go through `GM.sv` / `GM.sp`, and banners use the short name. Judge banners carry no invariant codes; codes appear only inside the JudgeSheet report.

### 0.3 Resolved disagreements

| Question | Decision | Why |
|---|---|---|
| Base design | **A**, with B's pro layer and C's grammar | Two of three judges. A is the most honest about rules and adds no second board |
| One screen or the three flick screens | **One screen during play** (B/C). Zone detail opens by holding a strip chip, which brings up `ArmorGrid`/`GravePane`/`InPlayRow` as a bottom sheet. The three-screen board survives as **Classic** behind a setting | The pro judge ruled out a board a swipe can move mid-decision. One rail also removes the "most visible rail" peek defect by construction (HANDOFF.md:197-201) |
| Where the Stage mounts | **Inside `TableBoard`**, in a `staged` branch that renders the *same* actbar, hand rail, PeekDock and PromptSheet instances, hoisted into local consts. No `StageBoard`. The moment-driven HUD and ring live in a memoized `StageView` child, so a moment frame never re-renders `TableBoard` | B's second button table is the v2.52 mirror. The glisten count (one `.psheet`, two `<PromptSheet `) stays unchanged and guards this. `setShown` at `TableBoard` level would re-render about 850 lines per frame |
| Damage-preview source | **The engine's own pass projection** (B) on the immutable state, with hidden-information guards | A's `strike(copy)` skips `afterDefenders` (judge.js:1928). C's `wallOf` sums defence, ignores ward and refactors `strike` |
| Clock source | **Sequencer stamps `tm`** (A). The stamps come from `performance.now()`, cross-checked against `Date.now()` to detect device sleep. Allowance comes from a fixed Normal-pace table, so it is identical for both seats. Grace is granted once per window key per game | B's self-reported `dt`, and allowance that depends on each player's pace setting, are unfair (dealbreaker). iOS can stall `performance.now()` while the device sleeps |
| Courtesy beat on forced passes | **None** | At about 12 passes per player-turn it costs 7-10 s of dead air per turn. A fixed beat is itself a fingerprint, and both peers hold full state in Phase B anyway. Revisit only in Phase C, gated on B's corpus measurement |
| Recording a time loss | **`concede{why:"time"}` → `over.how:"time"`** with its own seat-named line. The host sends it through a new **host-only, whitelisted** `sequenceFor(seat, action)` | C's plain concede would narrate "X concedes." about a timeout (judge.js:2354). Today the host cannot sequence an action for the guest's seat |
| A flag the guest disagrees with | **CLOCK DISPUTED**, recorded as disputed. Never RESYNC | In lockstep the guest cannot refuse a commit, and a resync adopts the host's state, concession included |
| What "average time" means | **Headline AVG = clock used per turn started** (A), on the HUD and the ladder. **PACE = seconds per decision** (B) is a personal stat on the results screen | Turns started cannot be inflated. B's per-decision count can be gamed with `payCancel` loops |
| What the time score counts | **Wins only.** `contrib = R_s` in a win and 0 in any loss. A concession or abandonment win before the winner's 3rd turn counts 0. The tiebreak and Clock board rank **CTR/W** (mean per win), with at least 10 rated wins required for the board | If losses kept their time, losing fast (taking every hit) would top the Clock board. A friend's instant concession must not bank 15:00. A mean cannot be bought with volume |
| Judge voice | **Plain words** (A). CR numbers **only where the refusal's own code site cites one** (C); otherwise "table procedure". Census drill | B's STEP_CR fallback invents citations. B/C put engine codes on screen (constraint 5) |
| When the judge CALLs | **On any refused reach**: a commit attempt (second tap, drag, hotkey) on a card the glow left dim shows that `legal()` refusal | The UI only offers legal plays, so without this the judge would almost never speak |
| One-tap commit | **Rejected.** Two-tap peek-then-commit for every commit, on every preset, including the ladder. Opt-in one-tap only for reversible toggles (`defend`, `paySel`, `promptSel`), with a drill that proves reversibility. **Drag-to-ring** (press = peek, release on the ring = commit) and opt-in **auto-pay when covered** are the pro fast paths | `doPlay` commits at once when `cost ≤ res` (judge.js:2455-2479), so a mis-tap on a 0-cost card is irreversible. A drag is deliberate. An exactly covering pitch leaves nothing else to choose, because over-pitching is refused (v4.93) |
| N-choice actbar branches | **The rail is the chooser.** discost, fuse and charge glow their eligible hand cards and use the two-tap pick, as the arsenal branch already does ("tap a card to set it"). xval values, split halves and any non-hand uid go into a scrolling chip row inside the actbar band. The decline verb holds the primary slot | Today these render one button per uid or value (index.html:7497-7555). That breaks "one primary button", the primary-size assertion and "chrome never moves" |
| Pitch help | **Glow pitch values gated by `legal`** (C). Never pre-select (B's `pitchPick`) | An engine-chosen pitch sitting in state on the ladder is a dealbreaker |
| Hand pips | **Count cards in hand only**, labelled "cards in hand". No arsenal pip | Arsenal cards cannot be declared as defenders, and not every hand card has a defence value. "Blocks left" would be false |
| What Tally says | **Reads the feed lines its row carries** plus "NAME down to N" (the cup8 contract), with a deterministic interjection bank that contains no digits. It raves through a tier-scaled type ramp and optional Web Speech voices | C's field templates make the voice an author. The arithmetic lives in the HUD's strike equation instead |
| Crowd and chat | **No simulated chatters, handles, counts or featured tables.** The rail is filled by booth badges and moment cards. Real chat appears only when real people are present. For a real stream, YouTube's own chat can be overlaid in a reserved chat-safe column of the program, or embedded on the Pages watch page | The golden rule (all three proposals). The literal "YouTube Live chat" is YouTube's chat, which is real |
| Felt tilt | **Seat: at most 10°**, Story's seat cam only. **Program: up to 26°.** At any tilt the felt carries **no text**; equations, chips and labels live in a flat overlay | Safari blurs rotated and skewed text |
| Where DOM code lives | **`stage/`**, with serve.sh copying it in the same release, plus a drill that every script directory gets copied and every `stage/*.js` is script-tagged | engine/README.md: "Pure JS rules engine, zero DOM, runs in Node". The engineer judge allowed "or edit serve.sh". The wire census scans only `engine/` |
| Clock in the defend step | **Follows priority** (all three agree). The attacker's defend-step stop is **off** by default, so in practice the defender's clock runs | The turn player holds priority (CR 7.3.3, priority.js:243). Declaring is free and simultaneous (CR 7.3.2, as sparring.js:660 cites) |
| Name of the clock's fold | **`DawnClock.createBank` / `fold`**, never "ledger" | "Ledger" already names tools/ledger.js (the keyword ledger) and the Ledger commentator |

---

## 1. Modes and flow

```
TITLE  "TAP TO SIT DOWN"  (the tap unlocks WebAudio and speech on iOS)
  │      idle 15 s → ATTRACT: a muted Exhibition at Fast pace, tagged "DEMO · AI vs AI"; any tap → TITLE
  └─ HOME: four Smash tiles + QUICK REMATCH + TODAY'S EXHIBITION      bottom tabs: Heroes · Rules quiz · Trophies
       ├─ LEARN ── chapter map (L1–L11, Hero Trials, Sandbox: the Dummy) ── lesson ── RETRY / NEXT
       ├─ VS AI ── tier (Rookie · Contender · Champion · Gauntlet) ─┐
       ├─ LADDER ─ Phase B: Clocked Friendlies (TableScreen/Room)  ├─► HERO SELECT (HeroGrid)
       │           Phase C: ranked queue (increments 11-12)        │     └─ LOADOUT (collapsed:
       │                                                           │        "Precon as printed")
       │                                                           │        └─ THROW (coin) ─ VS SPLASH 1.6 s
       │                                                           │           └─ READY · GO! ─ THE STAGE ─ GAME! ─ STORY CARD
       │                                                           │                              ├ Rematch  ├ Watch replay
       │                                                           │                              └ Share    └ Home
       └─ WATCH ── Exhibition (AI vs AI) · My replays · Program (#broadcast) · Live tables (inc 10)
```

- **Routing.**
  - `App` (index.html:7643-7773) gains a `mode` key, plus hash routes `#lesson=`, `#replay=<fragment>`, `#watch=<code>` and `#broadcast=<id>`.
  - In increment 9, `#broadcast` takes an Exhibition seed or a replay id. Live room codes join in increment 10, once room.js has spectators.
  - Hash routes work from `file://` and on Pages, and they give OBS a URL.
- **ATTRACT.** The title's idle demo is pure Melee and costs 0 bytes, because Exhibition already exists.
  - It is muted, at Fast pace, and labelled AI vs AI.
  - It stops on `visibilitychange` and after 3 games.
  - Under reduced motion it is replaced by a static title.
- **TODAY'S EXHIBITION.** An AI vs AI game seeded from the date, so everyone sees the same one. It is labelled "AI vs AI" and carries no viewer count. "Your last game" sits beside it. A featured *live* table appears only when real live tables exist (increment 10).
- **QUICK REMATCH.** One tap: the same heroes and settings again, like Melee's "same settings".
- **LEARN** (§8).
  - Lessons last 45-180 s, each has a decision that can fail, and retry is instant.
  - **Sandbox: the Dummy** is today's trainer `Battle`. It leaves the main path in increment 7 but stays in the file, because 98 test files read index.html.
- **VS AI** runs on `TableBoard` with `DawnLocal` + `sparring.act` (index.html:7729-7742).
  - Difficulty is set by matchup, chair and policy knobs, all measured (§8.3).
  - It has an optional practice clock on your seat only, and it can be paused.
- **LADDER.**
  - Phase B is **Clocked Friendlies**: the existing room flow (index.html:6380, 7689) under ladder rules. Those are 15:00, no coach, two-tap, auto-pass, no undo, judge on. Time scores are kept locally and labelled "advisory clock · friend play".
  - Phase C is the Supabase ladder with server stamps (§8.4, increments 11-12).
- **WATCH.**
  - **Exhibition** is safe now: no human holds hidden information, so the hole cam is allowed.
  - **Replays** are a pinned build + seed + build spec + `[{seq, seat, action, tm, h}]` (§9.3). `judge.reduce` regenerates every state, moment and caption.
  - **Program** is the 16:9 broadcast layout for OBS, with a chat-safe variant.
  - **Live tables** (increment 10) are friend tables with "Allow watchers": a redacted live view, a hole cam only after a 3:00 delay, labelled "friend play, not cheat-proof".
- **Replay** is the live pipeline fed from the log, with scrub-by-turn, 1x/2x/4x speed and tappable story-strip ticks.

---

## 2. The table

### 2.1 Phone portrait, 393x852 (standalone geometry). Every band is measured, and only the stage flexes.

> **Revised 2026-10-18 (Appendix C.1).** The hand rail and the actbar below are replaced by one **hand wheel** in a bottom-centre **thumb lane**, and the stage shrinks from 419 to 333. The bands above the stage are unchanged.

```
 x0                                                                         393
y  0 ┌──────────────────────────────────────────────────────────────────────┐
     │ safe-area top 59 (standalone) · 0 in a Safari tab                    │
y 59 ├═ HUD 64 · flat DOM · never transformed (text never under a skew) ═══════┤
     │┌──┐◢▰▰▰▰▰▰▰▰▰▰▰▰▱▱┐17 ┌─T7·R4─┐ 14┌▱▱▰▰▰▰▰▰▰▰▰▰◣┌──┐│ row A 36
     ││P1│ bar: flex (94 @393, 78 @360)  │  (eye) │ bar: flex             │P2││ portraits 36x36
     │└──┘●●●●●  12:41  0:38/t        └─ SYNC ─┘     9:58  0:51/t ●●●x6 └──┘│ row B 24
y123 ├═ THEIR STRIP 56 ═══════════════════════════════════════════════════════┤
     │ [H][C][A][L] [WPN] [ARS back] [Runechant x3] (+2)  pitch●●  D31 G6  [last]│ hold a chip → sheet
y179 ├═ STAGE · flex (419 standalone · 320 Safari tab · min 200) ═════════════┤
     │ LINKS        ┌────────────────┐   atk 6          STACK               │  ← felt: no text
     │ [1] 3        │   ATTACK CARD  │   ──► DORINTHEA  [+2]                │  ← flat overlay
     │ [2] 4        │    104 x 146   │                                      │
     │ 2 LINKS·7    │ chip "LINK 3"  │                                      │
     │              └────────────────┘                                      │
     │        [def 3] [def 2]       6 vs WALL 5  →  1                       │ wall row 56
     │ ● TALLY  Kayo swings for 6 — the wall holds 5. Dorinthea down to 16. │ caption lane 28
y598 ├═ YOUR STRIP 52 ════════════════════════════════════════════════════════┤
     │ [H][C][A][L] [WPN] [ARS face] [Soul 2]  pitch●●●  D28 G4             │
y650 ├═ HAND RAIL 112 · cards 70x98, gap 6; compresses, then scrolls ════════┤
     │  ▭  ▭  ▭  ▭  ▭        (PeekDock floats above, --peekbot measured)     │
y762 ├═ ACTBAR 56 · the ONE existing .actbar, relabelled ═════════════════════┤
     │ res 3  AP●  [Cancel 88x48]  [      BLOCK · TAKE 1        >=152x48 ]   │
y818 ├──────────────────────────────────────────────────────────────────────┤
     │ safe-area bottom 34                                                  │
y852 └──────────────────────────────────────────────────────────────────────┘
```

**HUD width budget** (it must fit at 360): 6 + 36 + 4 + **bar** + 22 + 4 + 60 + 4 + 22 + **bar** + 4 + 36 + 6 = 204 + 2 bars, with a 22-px numeral beside each bar. That gives bars of about 94 px at 393, 85 at 375 and 78 at 360 *(the two 22-px numerals are the prototype's correction; Appendix B, P2)*.

**HUD row B.** Each side holds the hand pips, the clock and AVG.
- Pips show at most 5, then collapse to `xN`, so they take at most 45 px.
- Measured need: 45 + 6 + "12:41" (13-px mono, about 39) + 6 + "0:38/t" (11-px mono, about 40) = about 136 px.
- Available: 156 at 393, 147 at 375, 140 at 360.
- AVG renders **only when measured slack is at least 8 px**. At 360 it moves to press-and-hold on the clock and to the results screen.
- Box assertion: row B children never overlap and the clock is never clipped.

**Life numeral.** It is a *sibling* of the skewed bar box, not a child, and sits absolutely over the bar's inner end. No HUD text node has a transformed ancestor; a drill walks the HUD and checks this.

**Strip overflow.** Counter and token chips (§3.5) group by card name. Once they would push past the strip, they collapse into a `+N` chip that opens the zone sheet, so the strip never reflows.

**Per-blocker numbers in the wall row** come from `effects.defendValue` with the strike's own context (judge.js `strike`: `base: gearDef(piece)`, `weaponAttack`, `atkCard`, `handDefenders`), never from `card.def`. Gauntlets and Helm of Unity print 1 and block for 2 *(found by the prototype; Appendix B, P5)*.

**Actbar at 360:** 8 + resources/AP 84 + 6 + secondary 88 + 6 + **primary** + 8, so the primary is 160 px. It sits in the right thumb zone and never moves.

| Band | Standalone 852 | Safari tab 660 | Compact (<620) | Notes |
|---|---|---|---|---|
| HUD | 64 | 64 | 56 | Flat. Life numeral 20px Big Shoulders; clocks 13px mono; nothing under 11px |
| Their strip | 56 | 56 | 48 | Chips 24-34px |
| Stage | 419 | 320 | ≥200 | Caption lane 28 inside it |
| Your strip | 52 | 52 | 44 | |
| Hand rail | 112 | 112 | 96 (cards 56x78) | |
| Actbar | 56 | 56 | 52 | |

The bands replace `--tv:calc(100vh - 152px)` (index.html:19). Heights come from `100dvh`, with a fallback to `window.innerHeight` re-measured on `resize` and `visualViewport` changes. This follows the `--lochrome` lesson.

**The caption lane has two owners:**
- the booth (Tally) while moments are staging, with type scaled by tier (§6);
- the existing `.statusline` hint ("pick a card to pitch") while it is your decision.

### 2.2 Broadcast, 16:9. Design canvas 960x540, scaled by one flat `transform: scale()`: 2x for an OBS 1920x1080 browser source.

> **Revised 2026-10-18 (Appendix C.2).** The field in the middle of this canvas is now an **overhead playmat**, laid out the way a tournament feed shoots a real table. The HUD, hole cam, now-resolving card, lower third and spine are unchanged.

```
  0 ┌──────────────────────────────────────── 960 ────────────────────────────────────────┐
    │[P1 64] DORINTHEA ◢▰▰▰▰▰▰▰▰▰▰▰▰▰▱┐17 ●●●●● │ T7·R4 │ ●●●●● 14┌▱▰▰▰▰▰▰▰▰▰▰▰◣ KAYO [P2 64]│ HUD 76
    │        Warrior   12:41 · 0:38/t           │  eye  │          9:58 · 0:51/t   Brute    │
 76 ├───────────┬──────────────────────────────────────────────────────┬───────────────────┤
    │ HOLE CAM  │ TABLE felt 592x300, rotateX ≤ 26° (NO text on felt)   │ NOW RESOLVING     │
    │ P1 hand   │ P1 gear·arena·arsenal·pitch │ RING │ P2 gear·arena…  │ card 156x218      │
    │ 100w      │ ┄┄ flat overlay: LINK 2 · 6 vs WALL 3 → 3 ┄┄┄┄┄┄┄┄┄┄  │ name + chip       │
    │ Exhibition│ ┄┄ flat overlay: combo  2 LINKS · 7 ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄  │ "LINK 2 — 6 DMG"  │
    │ / replay /│                                                      │ (text: replay     │
    │ 3:00 delay│                                                      │  pause/tap only)  │
400 ├───────────┴──────────────────────────────────────────────────────┴───────────────────┤
    │ [TALLY]  BIG ONE — Kayo swings for 6 — the wall holds 3. Dorinthea down to 14.        │ lower third 72
    │ [LEDGER] the life moved on a PASS — damage lands on entering the damage step (CR 7.5)   │
472 ├────────────────────────────────────────────────────────────────────────────────────────┤
    │ STORY SPINE: two life lines per turn · moment pips · T1…T7 tap to scrub · LIVE/DELAY 3:00│ 44
516 └────────────────────────────────────────────────────────────────────────────────────────┘ +24 title-safe
```

- **Columns.** 100 + 8 + 592 + 8 + 156 = 864, the title-safe width (90% of 960). In landscape, P1 sits left and P2 right, matching the bars: the fighting-game read. The centre stays clear (the FaBStream norm).
- **Flat overlay.** The felt may tilt to 26° in the program. Every label (equation, combo, chip captions) sits in a flat overlay layer positioned from the post-transform rects of anchor elements on the felt. A drill checks that no text node in the program has a rotated ancestor.

**Chat-safe program** (`#broadcast=<id>&layout=chat`):
- The HUD, lower third and spine keep full width.
- The band from y 76 to 472, x 648 to 912 (264x396, inside title-safe) is left **transparent**. OBS overlays the real YouTube chat there: YouTube's popout chat as a second browser source.
- The table column becomes hole cam 100 + 8 + felt 484 = 592 (x 48-640).
- NOW RESOLVING shrinks to a 104x146 card at the felt's top-right corner.

**The "YouTube Live chat" view** (WATCH):
- **Desktop:** the program on the left, scaled to fit, plus a 360-px rail on the right.
  - The rail holds booth badges (TALLY / LEDGER / JUDGE), moment cards (Super-Chat style, sized by damage and chain length), and real messages when real viewers exist.
  - Under it sits a "Who takes it?" two-colour bar, voted by real spectators only.
  - **Optional YouTube embed:** paste a live video id and the rail becomes `https://www.youtube.com/live_chat?v=<id>&embed_domain=<location.hostname>`, with the booth badges moved to a compact strip above it. This is offered only when `location.protocol === "https:"` (Pages), and the control is hidden on `file://`.
- **Phone portrait:** a compact program at 393x221 (bars, life numerals, ring; no lower third). The booth lane below it is 52 px of real DOM text at 12-13 px. Then the prediction bar (36), the chat (flex) and the input (44).
- **Phone landscape:** the program goes full bleed at 699x393, with chat in a drawer.

### 2.3 Always-on HUD vs the moment layer

| Layer | Contents | Rule |
|---|---|---|
| **L0, always** | Two bars + life numerals, hand pips, the whose-decision light, T·R, the judge eye, clocks (timed modes), the ring, both strips (counts, chips, counters), your hand, one primary button | Melee-minimal. Flat DOM. Never moves during a moment (drilled) |
| **L1, moments** | READY · GO!, turn banner, swing stamp, wall + equation, ghost, `+N` pumps, sparks, `−N` pop, GO AGAIN / BLOCKED / WARD tags, combo counter, hero cut-in, Ledger pop, judge CALL, GAME! | Each one fades on its own. Budgeted per turn (§5) |
| **L2, on tap or hold** | Peek with streamed `card.tx` (CardModal path), zone sheets | Two-tap contract |
| **L3, on demand** | Full log (render capped at 200 lines), the "Call a judge" sheet | |

**Z-order:**
- 90: GAME!
- 85: judge CALL/HOLD. The wrapper is `pointer-events:none`. A CALL is dismissed by **any** global tap, which still reaches its target, or after 2.2 s. It never eats a tap.
- 80 / 70 / 60 / 55: existing bugwrap, `.reveal`, actbar + psheet, peekwrap (unchanged)
- 50: HUD + caption lane
- 30: flying clones (FLIP, `pointer-events:none`)
- 20: FX canvas (`pointer-events:none`)
- 10: stage felt

### 2.4 Mounting rules (non-negotiable)
- The staged branch sits behind `store` flag **"Stage (beta)"** until increment 7 makes it the default. Classic stays selectable for one season after that.
- **Controls render the true state** (`g` from `onState`): hand rail, actbar, PromptSheet, PeekDock, `legal` gating, `fire`. **Only `StageView` (HUD + ring) renders the director's cursor** (`shown`).
- `StageView` is a `React.memo` child that subscribes to the director itself, so `shown` changes never re-render `TableBoard`. Motion within a moment is WAAPI on DOM nodes and uses no React render.
- `fire(a)` always does two things first, synchronously:
  1. It captures the source element's rect (hand card, arsenal, weapon) and its `<img>` src, and hands them to `director.launch(uid, rect, src)`, which flies a fixed-position clone (no `crossorigin`). This is needed because the true-state render removes the source element in the same frame.
  2. It calls `director.flush()`.

  Opponent plays launch from their strip's hand chip.

---

## 3. Health bars, resources and the damage preview

### 3.1 The bar (one skewed box per seat: 18 px tall, ±10°, 2-px bone border; no text inside the skewed box)

| Layer | Source (read-only) | Behaviour |
|---|---|---|
| Fill | `sides[i].hp / maxHp` | Snaps instantly on the strike. Gold-to-ember gradient. Ticks every point when `maxHp ≤ 25`, every 5 otherwise. Life above `maxHp` shows a `+N` pip |
| Life numeral | `hp` | **Always visible**, 20 px, a flat sibling **beside** the bar's inner end, flanking the T·R box, never over the bar: the fill, the chip trail and the ghost all move at the bar's ends, so a numeral over any part of it covers the damage at some life total *(corrected by the prototype; Appendix B, P2)*. The number is the truth; the bar is the feel |
| Chip trail | previous `hp`, kept in client memory outside `g` | Red. Holds for hit-pause + 350 ms, then drains over 500 / 150 / 0 ms (Normal / Fast / Instant). A gain grows a green segment over 400 ms |
| Ghost | the projection (§3.4) | Hatched and pulsing at the leading edge. Story label "−N if it lands now"; otherwise "−N". Shows "?" when the engine cannot know. On an ally target it moves to that ally's chip |
| Shield pills | `ward` (steel "ward N"), `awd` (violet "arcane ward N") | Show *why* the ghost is smaller. They shatter when spent. Ward *auras* stay arena chips ("the number is the card", ROUTE_GLOSS.ward) |
| Danger | `hp ≤ ceil(maxHp/4)` | Two ember pulses, then a steady rim and one heartbeat. A fact about state, never a lethal prediction |
| Hand pips | `hand.length` only | Melee stocks, read as "cards in hand". Up to 5 pips, then `xN`. The arsenal is shown by its chip in the strip, not by a pip |
| Whose decision | `waitingOn(g)` (§4) | That seat's portrait and clock light up; a blade marker shows the turn player |

Seat colours are tokens `--p1` (ember) and `--p2` (bone-steel). They are never used as card fills, so they cannot be confused with the pitch hues `--r/--y/--b`. Seats are also identified by position, portrait and chevron. In a mirror match, `buildMatch` suffixes the names ("Kayo · P1" / "Kayo · P2"). This is deterministic setup data, comes with a `TABLE_BUILD` bump, and does not affect the 105-pair corpus, which has no mirrors.

### 3.2 Resources and action points
- **Yours** sit at the left of the actbar: `res N` (gems in the pitched cards' colours, always with the numeral). They appear only while `res > 0` or a payment is open. During a payment they become a ring, "2/3". `AP●` lights when `ap ≥ 1` in your action phase, with a second diamond when `ap ≥ 2`.
- **Theirs** show small in their strip, during their turn only.
- **`wasted`** is a FIZZLE beat at end-phase step (e), not a permanent readout.
- **Context glow**, gated by `DawnJudge.legal` (index.html:6940):
  - cost and power badges glow on playable cards in your action phase;
  - pitch pips glow during a payment;
  - defence badges glow in your defend step;
  - eligible cards glow in the discost / fuse / charge branches.

  Dim cards are not dead. The first tap peeks, and the peek names the `legal` reason in small text; a commit attempt raises a judge CALL (§6). It is presentation only, and it is the fastest read for newcomers and pros alike.

### 3.3 The four glyphs
- sword = power (ember)
- shield = defence (steel)
- coin = cost (gold)
- pips = pitch (red / yellow / blue)

They are identical on `CardFrame` badges (raised to 13 px or more), in the ring, on the ghost and in the equation. All four are numeric card fields, never text.

### 3.4 The damage preview of the open chain link

`DawnMoments.preview(g, reduce)` is pure and lives in `engine/moments.js`. `reduce` is injected to avoid a dependency cycle.

```
if !g.pend || g.pend.dealt != null || g.step ∉ {attack, defend, reaction} → none
h = g
repeat ≤ 8:
  if h.prompt || pendingOf(h) → "?"            // a choice the engine can't make for anyone
  s = h.priority; if s == null → break
  r = reduce(h, {t:"pass"}, s); if r.error → hide
  h = r.state
  if h.pend && h.pend.dealt != null → N = h.pend.dealt; break
  if h.chain.length > g.chain.length → N = last(h.chain).dmg; break
GUARDS (any one → "?"): h.rng ≠ g.rng; any deck order, hand or face-down arsenal differs from g
memoize by seq; run after paint (setTimeout 0); never touches live g, hash or feed
```

- The answer means "if both seats pass now". It runs through the real `settle`, so `afterDefenders` (Phantasm, Spears of Surreality), reactions and prevention all count.
- The engineer judge measured it at 0.156 ms average and 7.7 ms worst case per state, exact on 825 of 825 strikes.
- The guards ensure the ghost never knows more than the table does.
- **The strike equation:** `6 vs WALL 3 → 3`. The values are the **power the wall was subtracted from** (the `pre.total` that `linkPumps` hands back inside `strike`), the projected `pend.wall` and the projected dealt amount. No state field holds that power today, so increment 1 has `strike` record it as **`pend.power`** beside `wall` and `dealt` (judge.js:2220), and the projection reads the same field off the projected state. `pend.total` is the declared power, and `pend._struck` is stamped before the attacking card's own late bonus (engine/effects.js:7442-7446). Counting prevention, an equation written against `total` shows the wrong damage on 282 of 4,224 corpus hero strikes, one against `_struck` on 97, and one against the power `linkPumps` returns on none *(corrected by the prototype; Appendix B, P1)*. "(N prevented)" is `max(0, power − wall) − dealt`, once `pend.power` exists. It is **not** read off the ward pools: a `Ward N` is the permanent itself (v4.34) and a shield lives on `wardNext` (v5.06), so the pool drop matched the prevented amount on only 87 of 283 prevented corpus strikes *(corrected; Appendix B, P7)*.
- When the strike lands, the equation stamps the real `pend.power` / `wall` / `dealt` (all three written by `strike`, judge.js:2220).
- It shows in the Story preset and in the program; Competitor hides it, Instant shows only `→ N`.

### 3.5 Counters, tokens and statuses (the newcomer grammar for hero machinery)
- **What a chip is.** Every token or aura in `sides[i].board[]` becomes a chip, grouped by its **own card name** with a count: "Runechant x3", "Frostbite x2", "Gold x1". Zone counts the state holds become chips named by the zone: "Soul 2" from the soul zone's length.
- **What it never says.** A chip never paraphrases what the thing does. Tapping it opens the card's streamed text through the CardModal path, and its art is the card's own `<img>`.
- **Changes.** Each change is a minor beat (§5): a 150-ms count tick, with an up or down nudge.
- **Fit.** Chips sit in the strips and collapse into `+N` on overflow (§2.1). `frostCount` (index.html:5518) is the existing reference reader; the chip generalizes it.

---

## 4. The clocks

### 4.1 Rules
- **Bank.** 15:00 per seat per game: 900,000 ms, no increment. A time flag is a **loss** (the MTGO model; open question 1).
- **Who is charged.** `DawnClock.waitingOn(g)` lives in the new UMD module `engine/clock.js`. It is pure and uses sparring's precedence (engine/sparring.js:625-665):

```
waitingOn(g):
  g.over                  → null
  g.prompt                → g.prompt.side || 0
  p = judge.pendingOf(g)  → p.seat
  g.arsenalFor != null    → g.arsenalFor
  g.priority != null      → g.priority
  otherwise               → null    // start phase, close step (CR 7.7.1), end-phase steps with no choice
```

- **The defend step** follows priority. The turn player holds priority first (CR 7.3.3); declaring is free and simultaneous (CR 7.3.2).
  - The attacker's defend-step stop is off by default, so the attacker auto-passes and the defender's clock runs through declaring and the confirming pass.
  - An attacker who turns that stop on and holds priority pays for holding. The defender's declarations during that time are free.
  - This is the one named divergence from sparring's order, and the drill names it too.
  - *The prototype confirms it is load-bearing (Appendix B, P6).* In a sparring game the engine leaves priority with the attacker through every declaration, so a `waitingOn` without this rule lights the attacker's clock and shows the defender a dead "KAYO TO ACT" button instead of BLOCK · TAKE N.
- **An AI seat is never charged, in every mode including lessons.** Tutorials have no clock unless the lesson is about the clock, and then only your seat has one (L10).

### 4.2 Stamps and the bank (exact)
- **Who stamps.** The sequencer stamps each COMMIT with `tm`: integer ms since the match's opening state. The host does this now, the server in Phase C, and `local.js` for local play.
- **The clock source.** Stamps use `performance.now()`. On each stamp, the sequencer compares that delta with `Date.now()`'s delta. If `Date.now()` ran more than 2 s ahead, the device slept and the page clock stalled. That gap becomes a **hidden span** `{tm0, tm1}`, measured by `Date.now()` and clamped to 6 h, and is handled by the mode's rule (§4.5).
- **Where `tm` lives.** On the envelope, in session records and in the replay log. It is **never** in `g` or `W.hash`.
- **PROTO.** COMMIT gains `tm`, so `W.PROTO` is bumped (wire.js). HELLO already refuses a mismatched proto in plain words (net.js:365).

```
c_1..c_n: commits {seq, seat, action, tm};  S_0 opening state;  S_k = state after c_k;  tm_0 = 0
ALLOW[kind]   Normal-pace ms per moment kind (fixed table in engine/moments.js; NEVER the player's pace)
allow_k     = min(2500, Σ ALLOW[m.kind] for m ∈ moments(S_{k-1}, S_k))
stageEnd_0  = ALLOW.open                                   // READY · GO! (800 ms) is never billed
stageEnd_k  = min( max(tm_k, stageEnd_{k-1}) + allow_k ,  tm_k + 3000 )     // backlog capped at 3 s
w_k         = waitingOn(S_k)
paused_k    = total length of pause spans inside (stageEnd_k, tm_{k+1})
raw_{k+1}   = max(0, tm_{k+1} − stageEnd_k − paused_k)     // charged to w_k; to nobody if w_k is null or AI
K_k         = windowKey(S_k)
grace       : per-game map; the first sight of a key grants 2000 ms
charge_{k+1}= max(0, raw_{k+1} − grace[K_k]);   grace[K_k] −= min(raw_{k+1}, grace[K_k])
U_s         = Σ charge assigned to s;   R_s = max(0, 900000 − U_s)
running     : R_w − max(0, now − stageEnd_last − grace[K_last])   (display interpolation only)

windowKey(S) = [w, turn, phase, step, stack.length, chain.length, pending kind|"", prompt tag|"",
                arsenalFor, sorted uids of w's hand ∪ arsenal ∪ pitch, hp0, hp1]
```

- **Toggles share one grace.** `defend`, `paySel`, `promptSel` and `promptTakeBack` don't change the key.
- **Undo loops earn nothing.** A `play`→`payCancel` cycle returns to a key that was already granted.
- **Real progress earns new grace.** A card leaving the hand or a life total moving changes the key.
- The grace also absorbs network latency. That is why the host's zero latency is not an advantage.
- **The API.** `DawnClock.createBank()` → `fold(bank, commit, S_prev, S_k)`, `pause(bank, span)`, `remaining(bank, seat, now)`, `flagDue(bank, now)`, `score(bank, g)`. The word "ledger" is not used (§0.3).

### 4.3 Auto-pass, yield and stops (they decide what the clock sees)
- **A forced window:** `waitingOn(g)===me`, no prompt, pending or arsenal choice of mine, `!P.canDeclareDefenders(g, me)`, and `!judge.canRespond(g, me)`.
  - `canRespond` is new, read-only and exported: the per-seat body of `someoneCanRespond`, which then becomes `canRespond(g,0)||canRespond(g,1)`.
  - Before auto-pass ships, it is drilled against an **independent** candidate generator (increment 1).
- **What happens:** the client sends `pass` immediately, with **no beat**. The pass arrives within the grace, so it costs about one round trip, which is always under 2 s.
- **Where it runs.** Auto-pass is a **session-level seat policy**, never a React effect loop.
  - **Local:** `createLocal({autoPass})` runs it inside `runPolicy`'s bounded loop (shared `STEP_LIMIT`), alternating with the other seat's policy.
  - **Net:** the `onState` handler submits at most one auto-pass per received `seq` (guard `lastAutoSeq`), deferred with `setTimeout 0`, and never re-enters.
- **Exception:** auto-pass **never** fires in your own action phase with an empty chain and stack. Ending your turn is a decision. There the button reads END TURN and glows when nothing is playable.
- **Stops** and **yield** are defined in §7.4. The leak ("they had nothing at instant speed") is documented on screen, as MTGA does. It is moot while both peers hold full state.

### 4.4 Flags, claims and disputes
- **Host side.** When the host's bank shows `R_w(now) ≤ 0`, the host calls `sequenceFor(w, {t:"concede", why:"time"})`, stamped at that moment.
  - `sequenceFor` is host-only, whitelisted to `concede{why ∈ {time, abandon}}`, and goes through the ordinary `legal`/`apply`/COMMIT path.
  - The guest's receive path accepts a COMMIT for its own seat that has no matching in-flight id **only** for that whitelist.
- **Reducer change.** `concede` copies a whitelisted `why ∈ {time, abandon}` into `over.how` and prints, through `GM.sv`:
  `GM.sv(loser,"run") + " out of time. " + GM.sv(winner,"take") + " it."`
  For example: "Kayo runs out of time. Dorinthea takes it." The action carries no time.
- **Guest verification.** The guest applies the commit (it must; this is lockstep), then re-folds its bank with that commit's `tm`.
  - If its fold does not also show `R_w ≤ 0`, the judge shows **CLOCK DISPUTED** in plain words, and the result is recorded as *disputed*. It is never RESYNC, because the guest has no authority to refuse.
  - That check alone is circular, because the guest is folding the host's own stamps. So the guest also runs a **drift check**: it compares host `tm` deltas with its own receive-time deltas. If the cumulative over-charge to the guest exceeds 5 s + 10% of the guest's `U`, the judge shows **CLOCK DISPUTED**, and the result is recorded as disputed.
- **A flagged host.** If the guest's estimate passes 0 + 3 s with no flag, the guest gets **CLAIM TIME**. That ends the match at the session layer (`{how:"time-claim"}`), leaves the reducer untouched, and marks the result disputed.

### 4.5 Disconnects, sleep, abandonment, pauses
- **Ladder (Phase C, server stamps):**
  - The waiting seat's clock keeps running while that seat is disconnected, backgrounded or asleep (MTGO).
  - After 90 s with no heartbeat *during that seat's decision*, the opponent may claim. The server sequences `concede{why:"abandon"}`. There is no pause.
- **Clocked Friendlies (Phase B):**
  - Clocks pause while either seat has no heartbeat for more than 3 s, and there is no claim (the Lichess rule).
  - The host records each pause as a session record `{t:"pause", tm0, tm1}`. It covers gaps in the guest's heartbeat and the host's own hidden spans (`visibilitychange` plus the sleep detector). `fold` excludes these spans.
  - The guest checks the spans with its drift check.
- **Wake Lock.** In every clocked mode, `navigator.wakeLock.request("screen")` (Safari 16.4+) runs at the first decision and again on every return to visible, and is released at GAME. If it is refused or unsupported, a plain banner says "Keep your screen on: your clock runs" (ladder) or "screen sleep pauses this Friendly".
- **vs AI practice clock:** pausable, and it auto-pauses on `visibilitychange`.

### 4.6 Display
- Remaining time in `m:ss`, 13-px Spline Sans Mono, lit in the seat colour while running, dimmed otherwise.
- A 2-px **delay underline** drains over the current window's remaining grace. Act inside the line and it costs nothing.
- Amber at ≤ 2:00. Red at ≤ 0:30, with one mutable tone. Tenths below 0:10.
- The text updates at 4 Hz, or 10 Hz under 10 s, in clocked modes only. True time always comes from the fold.
- AVG sits beside the clock only when row B has room (§2.1). Otherwise press-and-hold the clock to see it.

### 4.7 The time score (precise)

```
T_s(game)  = turns seat s started as turn player
AVG_s      = U_s / max(1, T_s)                          // "0:38/t" under the clock; the ladder's AVG
contrib_s  = R_s at game end   if s WON, unless the win came by concession or abandonment
                                before s's 3rd turn as turn player (then 0)
           = 0                 in any loss (life, concession, time, abandon, time-claim)
Season over rated games G, wins W_s:
CTR_s      = Σ contrib_s                                // "cumulative time remaining", shown h:mm:ss
CTR/W_s    = CTR_s / max(1, |W_s|)                       // mean banked per win; volume cannot buy it
AVG_s      = Σ U_s / Σ T_s                              // weighted by turns
PACE_s     = Σ raw over s's decisions / D_s             // personal stat; a decision = a run of s's commits
                                                        // ended by a non-toggle; forced passes excluded
Leaderboards: Rating (rating → CTR/W → fewer flags); Clock (CTR/W, minimum 10 rated wins)
```

- **In game:** R (large) and AVG (small, green if at or below your season AVG, red if above).
- **Results:** R, AVG, PACE, number of decisions, and a per-turn bar chart against your AVG.
- **Profile:** CTR, CTR/W, wins and season AVG.

### 4.8 Why the clock lives outside the reducer, and how it still travels
1. `judge.reduce` is a pure function of `(state, action, seat)`, and net.js compares `W.hash` on every commit. A wall-clock value inside `g` would differ between phones, fork the hash and trigger desyncs. It would also make a replay impossible to reproduce.
2. The clock charges the time *between* actions, which the reducer never sees.
3. So time rides on the COMMIT envelope (`tm`) and on pause records, and a pure bank folds them outside `g`. Both peers fold the same records into the same numbers.
4. Only the clock's *consequence* enters rules state, and it does so as an ordinary, already-legal action with no time in it (`concede{why:"time"}`).
5. Replays store `{seq, seat, action, tm, h}` plus pause spans. `reduce` ignores `tm`; the bank re-folds it into the identical clock graph. The Phase C server recomputes scores from the same log, on the same build.

---

## 5. The key moments

`DawnMoments.moments(b, x, meta)` (engine/moments.js) is pure. It reads fields, lengths, uids and enums only, and **never card text**. The only phrase matches are the engine's own pinned phrases for fizzle, crush and prevention.

**Where it runs:**
- **Net:** every `onState(st, meta)`. net.js already passes `{seq, action, seat, source, hash}` (index.html:6900).
- **Local:** every step. `local.js` gains `onStep(prev, next, meta)` for **every** accepted action: the player's own, the policy's and auto-passes. `push` becomes `onState(state, {seq, action, seat, source})`. Without that, the player's own swing and hero power would never reach `moments` (local.js:72).

**Order within one diff:** wall confirmed → reactions → strike → hit or block → go again → close. That order is required because `settle` runs several steps inside one `pass` (judge.js:1869). Damage is credited to `pend.by`. `hitSeq` is an animation key only.

| # | Event | Detected from state | Staging (motion · pause · sound) | Newcomer reads | Pro reads | Normal / Fast / Instant ms | Skip rule |
|---|---|---|---|---|---|---|---|
| 0 | **READY · GO!** | The opening state, before any commit | "READY" in Big Shoulders, a beat, "GO!" slashes across; the felt light comes up; the announcer says it (if voices are on) | The game starts | — | 800 / 300 / 0 (= `ALLOW.open`, never billed) | any tap |
| 1 | **Turn opens** | `turnPlayer` changes, `turn` goes up | Slash banner "TURN 7 · KAYO" in the seat colour; the felt light swings to their side; low gong | Whose turn it is | The light moves | 450 / 150 / 0 | any tap |
| 2 | **Pitch** (money) | `sides[s].pitch.length` grows, `res` goes up | The card flips into the pitch pile; gem(s) in its colour fly to the resource ring; coin tick, pitched by value | "Spent a card as money, worth N" (N from its `pitch` field) | Ring count | 220 / 80 / 0 | runs concurrently, never queues |
| 3 | **Swing** (ammo) | `step` becomes `attack`; `pend.card/by/total/target` | The clone launched from `fire()`'s captured rect (or the opponent's hand chip) flies into the ring at 1.3x; the sword badge stamps N; an arrow to the target (ally chip if an ally); the ghost appears; whoosh; 6-px dolly | Who swings, how hard, at whom | Card + number | 450 / 150 / 0 | any tap |
| 4 | **Wall** (armour) | `blockH`/`blockG`/`blockRx` change on the defending player | Each blocker rises with its shield badge; the equation updates; the ghost re-projects; a withdrawal reverses it; a clack per card. **Your own toggles echo within one frame and are never queued** | "Blocking costs cards" (hand pips drop) | Projected damage | 180 per card / 80 / 0 | concurrent |
| 5 | **Instant speed** | A `stack` layer appears (`featured.chip==="ON THE STACK"`, or `k:'rx'`); on resolution the pump lands on `pend.rxPump`, not `pend.total` (judge.js:1973-1974; it rose 186 times in the corpus, while `total` rose 34 times mid-link, 32 of them Lightning Press), so the +N is read from `rxPump` and the projection *(corrected; Appendix B, P8)*; the stack shrinks on resolution | The card drops into the stack column; "+N" ticks into the sword badge on resolution; the ghost regrows; riser | "Either seat may answer before it resolves" | +N | 300 / 120 / 0 | any tap |
| 6 | **Strike, hit** | `pend.dealt` set; defender `hp` drops; new `chain` entry with `dmg>0` | **Hit-pause `min(60+20·d, 220)` ms** (Fast: half, capped at 110); sparks `min(12·d, 80)`; the bar snaps and the chip drains; `−d` pops; the equation stamps; HIT pitched lower as d grows. **Tier 1 (d ≥ 6):** 4-px shake for 120 ms, push-in to 1.03, flashbulbs, roar, portrait cut-in (Normal only) | The arithmetic and the new life | Number + bar | 700 (+400 at T1) / 220 (+100) / 0 | input is buffered during the freeze; any tap flushes |
| 7 | **Nothing lands** | New `chain` entry with `dmg===0` (BLOCK); `ward+awd` drops (WARD); `wasted` grows or the engine's "fizzle" phrase appears (FIZZLE) | BLOCK: clang, steel flash, BLOCKED tag, bar still. WARD: the pill shatters, "WARD −N". FIZZLE: a descending whiff. **Three sounds that mean three things** (POLISH.md:84-91) | "Stopped cold" | Tag | 500 / 200 / 0 | any tap |
| 8 | **Go again** | Last `chain` entry has `ga:true` | GO AGAIN tag slides in from the attacker's side; the AP diamond relights; two-note chime | "They get to swing again" | AP lit | 350 / 120 / 0 | any tap |
| 9 | **Combo / chain closes** | `chain.length ≥ 2`; `chainOpen` true→false (read the totals from `chainHist[0]`) | Live counter "2 LINKS · 7" in the attacker's colour at the stage edge, bumping per link. At close, it stamps "3-LINK CHAIN · 9" and the links sweep to the graveyards. A single link sweeps quietly | "A combo, and its total" | Total | 300 (+600 at close) / 100 / 0 | any tap |
| 10 | **Hero power** | `meta.action` is `{t:"activate", uid:"hpow"}`, or `heroTapped` false→true | Super flash: the screen dims 40%, the portrait slashes in with the hero name, stinger; the effect then plays as ordinary moments | "The hero's own move" | Brief flash | 600 / 200 / 0 | any tap |
| 11 | **Danger** | `hp` crosses ≤ `ceil(maxHp/4)` going down | Two pulses, a steady rim, one heartbeat; the crowd swells tense | "In danger" | Glow only | 0 (ambient) | n/a |
| 12 | **GAME** | `over` set (`how`: life, concession, time, abandon) | 500-ms freeze on the final strike; the fallen side desaturates; a long chip drain; TIME! or CONCEDED first where it applies; then **GAME!** in crimson Big Shoulders (spoken, if voices are on); the crowd peaks; the engine's own closing line; then the story card | Who won and how | Same, shorter | 2000 / 900 / 600 | taps ignored for the first 600 ms |

**Minor beats** get a 150-ms fade, no pause, and a caption only in the Story preset:
- arsenal set (a back to everyone, the face to its owner, via the Cloaked back) and arsenal played;
- arena enters or leaves (by `board[].kind`);
- a counter or token chip count changes (§3.5);
- gear destroyed ("BROKEN" crack);
- draw;
- life gain;
- sheets and payments opening (those are UI).

**Never staged:** passes, and the end-phase (a)-(f) lines (log only; Story names each step once per game).

**Budgets:**
- Per player-turn: 3.0 s total on Normal, 1.0 s on Fast, 0 on Instant. When a queue exceeds the remaining budget, durations scale down to a floor of 0.25x. READY · GO! and GAME! are exempt.
- Hit-pause: 600 ms per turn on Normal, 150 on Fast.
- **Skip:** any input calls `director.flush()`, which completes every queued moment to its final frame synchronously and cancels speech. The input then applies to the true state. The first tap on a card is a peek by contract, so nothing is ever committed blind.

**The AI's turn** arrives as one jump today. Through `onStep` (session code, not rules), the director stages the AI's steps at stage pace, and the clock bills none of it.

---

## 6. Voices

**The rule.** Every voice is a reader.
- **Its input** is a moment group, the feed lines the commit appended (`x.feed.slice(b.feed.length)`; the feed is append-only), and the row shape `{i: seq, seat, act, lines, hp, hand, deck, step, routes}` (tools/selfplay.js:452-460).
- **Its output.** Every line carries its `seq`. Drills fail any number not in the row and any name that is not a seat or a card in that row.
- **Determinism.** Templates and interjections are picked by `seq mod n`, never `Math.random`.
- **A pure fold.** The booth is `DawnBooth.fold(log)`: given a log prefix, it yields every line and the per-match "said" set. Scrub-by-turn rebuilds both from the start, and a replay is commentated identically.
- **Per-viewer lines.** Story's first-encounter teaching lines are remembered across games in `store`. They are keyed per viewer, outside the fold, and excluded from the replay = live equality.

**Before any voice ships, the feed must be fit for a viewer (increment 1):**
- The arsenal line names the card. Fix: "(b) X sets a card face down in the arsenal." (judge.js:3457)
- The opt result lists the deck cards. Fix: counts only ("puts N on top, M on the bottom"); the owner sees names through its own state (prompts.js:1182).
- `condWhy` speaks in the second person (effects.js:3002-3007). Fix it and widen the SECOND-PERSON check.
- The opponent's arsenal shows face up without checking `_faceUp` (index.html:7164-7166). Fix it and build the Cloaked card back.
- **A fifth fix** *(found by the prototype; Appendix B, P4)*: Dorinthea's hero line speaks in the second person in a feed both seats read, "<weapon> connects — your hero ability frees it for one more swing this turn." (engine/effects.js:8151). Name the seat through `GM.sp`.
- **The caption reads a classified list, not the whole feed.** The feed also carries procedure narration a viewer cannot use, such as noop reasons and restated rules ("a condition on the ability — it can only be used when that holds", "the weapon's attack — its cost is paid when it swings"). `engine/booth.js` keeps a pinned table of feed-line shapes classed HEADLINE, DETAIL or PROCEDURE, censused over the corpus like selfplay's route counters. A new shape fails a drill instead of reaching the caption unclassified. The full feed stays in the log. Measured over the corpus, the headline shapes are 28,529 of 108,351 lines (26.3%) once the duplicate attack declaration goes. The same drill fails any shape a viewer reads that speaks in the second person or names a hidden card: 43 and 10 shapes today, all listed in QUEUE.md as increment 1 inputs (Appendix B, P4).
- Each wording fix ships **in the same commit** as the matching edit to selfplay's route regexes (tools/selfplay.js:146-431), so the route counters never go blind.

**The voices:**

- **TALLY (play-by-play: the caption lane and the lower third).**
  - `tally`, `ledger`, `called`, `observe` and `ROUTE_GLOSS` move from tools/cup8.js:146-230 into the UMD module `engine/booth.js`, and cup8 and selfplay `require` it. There is one copy, and test/cup8.test.js keeps guarding it.
  - The event-route pattern list moves out of selfplay's loop into `DawnBooth.routesOf(lines)`, and selfplay calls it. This is the single copy that selfplay's no-mirror rule (:107-110) demands. The audit-only routes (MALFORMED, SECOND-PERSON) stay in selfplay.
  - Tally speaks the staged moment's own feed lines plus "NAME down to N".
  - **It raves by tier, and the tiers are computed from numbers:**
    - T0 is routine: 13-px caption.
    - T1 is a hit of 6+, a chain of 3+, or a full block of 6+ power. It gets a bolder 16-px line, a seat-colour flash on the lane, and an interjection from a fixed bank ("BIG ONE —", "WHAT A WALL —", "AND AGAIN —").
    - T2 is a hero falling ("THAT'S IT —"), a 20-px line.
  - The bank is drilled to contain no digits, no number words and no names.
- **LEDGER (colour: a pop over the ring).**
  - It uses `ROUTE_GLOSS` plus cup8's existing structural glosses, verbatim:
    - damage lands on entering the damage step (CR 7.5);
    - "declaring is free and simultaneous, and the TURN player holds priority here (CR 7.3.3)". The citation belongs to the priority clause (cup8.js:202). Declaring itself is CR 7.3.2 wherever this plan cites it on its own;
    - pitched on demand (CR 4.4.3e);
    - chain link N.
  - "An explanation is news once" per match (tools/cup8.js:187-194). At most one pop per turn, 2.5 s each.
  - In the Story preset, the first-ever occurrence of each moment kind gets a teaching line, per viewer, remembered across games in `store`.
- **BOOTH VOICES (optional, 0 bytes: Web Speech).**
  - `speechSynthesis` reads the same drilled Tally and Ledger strings, nothing more. Tally uses rate 1.15 and pitch 1.0; Ledger uses a second voice at rate 0.95 and pitch 0.8. Voices are picked from `getVoices()` by language. The announcer speaks READY, GO!, TIME! and GAME!.
  - Speech is unlocked by the title tap.
  - **Queue.** At most one utterance is queued. A new T0 line is dropped while one is speaking. T1 and T2 cancel the current line. `flush()` calls `speechSynthesis.cancel()`.
  - **Defaults.** On in WATCH (Exhibition, replays, program). Opt-in at the seat in Learn and VS AI. Off by default on any clock. Always off on Instant.
  - Speech is never the only signal. The caption carries the same line.
- **CLAUDE'S CALL (the coach).** The existing `Advisor` (index.html:2570). It runs only in local sessions, for seat 0 only. It is on in Learn and in VS AI on the Story preset, off in Competitor, and always off on any clock.
- **THE JUDGE.** A badge at the centre of the HUD.
  - **WATCHING:** the judges already run on every `onState` (index.html:6800-6820), but through `DawnInvariants.errors(st)` (:6809), which drops the warn band (v4.39). The eye reads `check()`, both bands *(corrected; Appendix B, P10)*. The eye nods for 120 ms on each of your committing actions, and a count runs ("1,204 states checked").
  - **CALL (amber, the refused seat only, 2.2 s, dismissed by any tap that still reaches its target):**
    - It fires on every refused reach: a second tap, drag release or hotkey commit on a dimmed card. It shows that `legal()` refusal in plain words, e.g. "JUDGE · finish paying for X first".
    - A CR number appears **only** if a `REFUSAL_CR` entry exists, and an entry exists only where the refusal's code site already cites one (pinned against tools/crindex.js). Otherwise the call says "table procedure", or carries no number.
  - **HOLD (red, both seats):** "JUDGE · the table recorded a position the rules forbid. Play continues; the report is saved." The code goes **only** into the JudgeSheet report. A clocked game with a HOLD is marked "under review, unrated".
  - **TIME:** `"JUDGE · TIME — " + GM.sv({name: short}, "run") + " out of time."`, using the short name (`name.split(",")[0]`) through `GM.sv`. It is never a hand-rolled possessive. It reads "Kayo runs out of time." or "You run out of time."
  - **CLOCK DISPUTED** appears on a disagreeing fold or on drift (§4.4).
  - **SYNC lamp:** green while lockstep hashes agree (`__dawnTable.report()`). RESYNC: "the two tables disagreed; re-dealt from the host's record."
  - **"Call a judge"** (J, or long-press the badge) opens the existing JudgeSheet plus: the last refusal with its citation, the current window (`stepLabel`), who holds priority, and **Concede** (two-step).
  - The quiz tab is renamed "Rules quiz", so "judge" means one thing.
  - The results screen carries the judge's report: states audited, flags, replay hash, build.
- **THE CROWD AND CHAT.**
  - **Solo:** an **event-driven** WebAudio crowd. Short swells (≤ 2 s envelopes) around moments, scaled by tier and chain length; gasps on a full block of a 5+ attack; roars on T1 and GAME. Canvas flashbulbs on T1 and GAME.
    - The AudioContext is `suspend()`ed after 3 s with nothing staged and resumed on the next moment.
    - On `visibilitychange`, and when iOS reports `state === "interrupted"`, it resumes on the next tap.
    - **No usernames and no counts.**
  - **A player at a watched table:** the real count "LIVE · 3 watching" and a crowd meter driven by real chat velocity. **No chat text on any clock.** Four fixed, mutable emotes between players (GG, Nice, Thinking, Good luck), at most one per 5 s.
  - **Spectators:** the rail described in §2.2, five reaction glyphs in one rate-limited danmaku lane, and the prediction bar. **No eval bar.** On a real stream, the chat-safe program column and the optional embed carry YouTube's own chat.

---

## 7. The newcomer story layer and the pro fast layer

### 7.1 One interface with dials, not two
The newcomer grammar is the same everywhere:
- the four glyphs;
- one direction per meaning: toward a portrait = damage, into the wall = blocked, into the pitch slot = money, into the arsenal = saved, to the graveyard = gone;
- context glow;
- the strike equation;
- the ghost;
- counter chips named by their own cards (§3.5);
- the opponent's played card popping large (1.2 s in Story, 0.6 s in Competitor), so viewers learn to recognise cards without reading them. On Instant the pop is replaced by a persistent **last-action chip** in their strip: the card's name and glyph number, tap to peek.

**Who is ahead** is read from the bars plus the hand pips.

**The story card** after the game:
- the engine's closing line;
- two life lines per turn;
- the turning point (the biggest swing from `observe()`);
- three panels (opening, the turn it swung, the finish), each with that moment's Tally line and a live DOM render of the ring at that `seq` from the replay (never a canvas snapshot: the art host sends no CORS headers, so a canvas holding art is tainted);
- the clock graph;
- the judge's report.

**Share** sends a `#replay=` URL through `navigator.share`, with a clipboard fallback. An optional art-free PNG (Canvas2D: names, bars, life lines, closing line; no `<img>` drawn) is offered beside it.

### 7.2 Presets (every dial can also be set individually)

| Dial | **Story** (Learn + your first 10 games) | **Competitor** (default afterwards; forced on clocks) | **Instant** |
|---|---|---|---|
| Pace | Normal | Fast | Instant |
| Booth | Tally + Ledger + first-encounter lines | Tally (headline moments) | Off (log only) |
| Booth voices | Opt-in (on in WATCH) | Off on clocks; opt-in otherwise | Off |
| Equation / ghost label | On / "if it lands now" | Off / numbers | `→ N` only / numbers |
| Opponent card | Pop 1.2 s | Pop 0.6 s | Last-action chip |
| Coach | On (local only) | Off | Off |
| Auto-pass | On; each one leaves a "nothing to answer" pip in the lane | On | On |
| Auto-pay when covered | Off | Off | On |
| Camera | Seat cam ≤ 10° | Flat | Flat |
| Pro extras | — | Opponent pitch pips, chain history, AVG | Same |

**Other settings:**
- Board (Stage / Classic).
- Sound (all / no crowd / off).
- Reduced motion (follows the OS, with an override).
- Tap model (two-tap everywhere / one-tap toggles).
- Drag-to-ring (on / off).
- Auto-pay when covered.
- Stops (§7.4).

`prefers-reduced-motion` turns off camera, shake, particles, slashes and attract mode, uses crossfades, and snaps the bars. Sounds and tags stay. index.html has no such handling today.

### 7.3 The primary button (the existing `.actbar` branches, relabelled; not a second table)

| State (existing branch, index.html:7475-7577) | Label | Sends |
|---|---|---|
| Your action phase, empty chain and stack | **END TURN** (glows when nothing is playable) | `endTurn` |
| Your priority, chain or stack open | **PASS** (Story: "PASS · LET IT RESOLVE") | `pass` |
| Defend step, you hold priority, nothing declared | **TAKE N** | `pass` |
| Defend step, defenders declared | **BLOCK · TAKE N** | `pass` |
| Defend step, attacker holds priority | `.a.dis` "DECLARE FREELY — {ATTACKER} HOLDS PRIORITY" | none (no dead tap) |
| `pending.kind==='pay'` | CANCEL + **PAY ✓**, or a disabled **NEED n**, where n is read from `legal`'s own refusal | `payConfirm` |
| addPay | Decline + **PAY N MORE** | `addPay{yes}` |
| discost / fuse / charge | Eligible **hand** cards glow and are picked with the two-tap pick on the rail (the arsenal pattern). Any non-hand uid becomes a chip in the choice row. Primary = the decline verb (**NO CHARGE** / **NO REVEAL**, or Cancel for discost) | `{t, uid}` / `{t, uid:null}` |
| xval / split | A horizontally scrolling **choice row** of ≥44x44 chips (one per X value or half) fills the resources and secondary zone of the band. Primary = the decline or cancel verb | unchanged actions |
| boost | Unchanged two-button verb | unchanged |
| `arsenalFor===you` | **KEEP IT EMPTY** · "tap a card to set it" | `arsenal{uid:null}` |
| Opponent's decision | `.a.dis` "{HERO} TO ACT" (short name) | none |

- N comes from the projection (§3.4), or reads "?".
- The choice row lives inside the existing 56-px band, so the band's box never changes. Only the primary-size assertion treats the chip row as exempt.
- No new sheet is added, so the glisten counts are unchanged.
- Concede leaves the bar and moves to the judge sheet; the drills that pin the bar get re-checked in increment 3.

### 7.4 Auto-pass, yield and stops
- **Auto-pass** applies to forced windows (§4.3). It is on in every preset and never fires in your own empty action phase.
- **Stops** apply only when `canRespond(g, me)` is true, and they persist across games:
  - **On by default:** your reaction step as attacker; their reaction step as defender; any held play on the stack ("ON THE STACK").
  - **Always on:** your action phase; your defend step as defender; any prompt, payment or arsenal choice of yours.
  - **Off by default:** your defend step as attacker; their layer and attack steps; both end phases.
- **Yield** is a 500-ms long-press on PASS, or Shift+Space.
  - It means "pass until something changes": a new stack layer from the opponent, a new attack at you, a prompt for you, or your action phase.
  - It shows a YIELDING pill; tap the pill to cancel.
  - The PASS button carries `-webkit-touch-callout:none; user-select:none`, so the long-press never brings up iOS's callout or text selection.

### 7.5 The tap model
- **Two-tap peek-then-commit** for every commit, on every preset (UI-GUIDE.md §5).
- **Opt-in one-tap for reversible toggles only** (`defend`, `paySel`, `promptSel`). A drill checks that a toggle followed by the same toggle returns an identical hash.
- **Drag-to-ring** (the single-gesture pro commit, on by default):
  - Pressing a hand, arsenal or weapon card shows the peek.
  - A vertical-dominant drag of at least 32 px toward the stage picks it up. Hand cards carry `touch-action: pan-x`, so horizontal drags still scroll the rail.
  - Releasing over the ring sends the same `fire` path, gated by `legal`; a refusal is a judge CALL. Releasing anywhere else commits nothing and leaves the peek open.
- **Auto-pay when covered** (opt-in): during a payment, the tap that selects a pitch card counts as the commit only if two things are true: the selection now exactly covers the cost, and `legal(payConfirm)` is null. In that case `payConfirm` follows at once. Over-pitching is already refused (v4.93), so an exact cover leaves nothing else to choose.
- During staging, a tap flushes the queue, then peeks on the current board.
- A paid play on a phone with every pro option on takes one drag plus one pitch tap.

### 7.6 Hotkeys (desktop and broadcast; one global `keydown`)

| Key | Action |
|---|---|
| Space | The primary button, exactly as labelled (it ends the turn only when it says END TURN) |
| Shift+Space | Yield |
| Esc | Cancel / decline / close the peek |
| 1-9 | Hand card i: the first press peeks, the second commits (or picks, in a choice branch) |
| A / Q / W / H | Arsenal / weapon 1 / weapon 2 / hero power (peek, then commit) |
| D | Toggle the peeked card as a defender |
| Z | Take back the last toggle (unpitch, withdraw, `promptTakeBack`) |
| Tab | Cycle the peek through legal targets, or through the choice row |
| P / F | Cycle pace / flush staging (any key also flushes) |
| L / J / ? | Log / call a judge / key help |

There is no dedicated end-turn key, which removes the slip risk next to Q and W.

---

## 8. Tutorial, vs AI, ladder

### 8.1 How a lesson is built (`engine/lesson.js`, UMD, pure)

```js
{ id, title, mechanic, seed, first,
  seats: [{build}, {build}],          // REAL cards, dealt IN ORDER by newMatch; a stacked permutation, never a new card
  prelude: [{seat, action}],          // run through judge.reduce from the seed to reach the starting window (e.g. L8's end phase)
  startPatch: {hp: [h0, h1]},         // the ONLY whitelisted patch; the patched start must pass invariants.check
  opponent: {script:[actions…], fallback:"sparring"},   // every scripted action is offered to judge.legal
  goal: g => bool, fail: g => bool,   // predicates on STATE; numbers come from card fields at build time, never typed by hand
  coach: [{on:"swing"|"wall"|"strike"|…, say}] }       // templates; card facts only through slots
```

- Lessons run through `DawnLocal.createLocal({state, policy})`. A lesson replay stores the prelude and patch.
- **Coach and Ledger copy are templates.** A card-specific fact may appear only through a slot bound to a card in that lesson's seats:
  - `{pitch:uid}`, `{power:uid}`, `{defense:uid}`, `{cost:uid}` (numeric fields);
  - `{kw:uid:name}` (a `kw` entry the card carries), which renders as a tappable chip opening streamed text.
  - Unslotted prose may contain no digits and no keyword names.
- **Retry** rebuilds the identical game from the seed. **Rewind** returns to the failed decision using the runner's state stack, which is cheap because `reduce` is deterministic.
- The judge teaches windows (CALL); Ledger teaches rules; the coach names mechanics.
- **Every lesson has a decision that can fail.**
- **L1-L4 seat both players on vanilla builds with no equipment**: the existing vanilla path in `buildMatch` with `gear: []` (build.js:927 accepts it). They use `DUMMY_DECK`'s text-free Generic attacks (Raging Onslaught, Brutal Assault, Critical Strike, Wounding Blow; index.html:832-837). Seat names are "You" and "The Dummy". This needs one small extension: a per-seat vanilla name. **No card on the table carries rules text.** `DUMMY_GEAR`'s Ironrot pieces carry Blade Break and are not used in L1-L4.
- From L5 on, lessons use real precons, and only cards whose coverage is `full`.
- **Hero Trials** take their staging and copy from the hero card's own `kw` entries and the deck's real cards. The `HEROES` blurbs (index.html:841-857) are menu copy, never coach copy.
- Veterans can skip with a confirmation.

### 8.2 The curriculum (about 20 minutes plus one full game)

| # | Lesson | Goal (state predicate) | Setup | Decision that can fail | Teacher lines (samples; `{…}` = slot) |
|---|---|---|---|---|---|
| L1 | **The Swing** | The Dummy loses at least the bigger attack's printed power this turn | Vanilla vs vanilla, no gear; you on the chair; the Dummy scripted not to block; hand: two attacks of different printed power plus two pitch cards | Swinging the smaller one | "The sword number is how hard it hits. This one: {power:a}." / "The bar is their life. Zero ends it." |
| L2 | **Money** | The attack lands **and** you end the turn holding ≥ 2 cards | Stacked so one pitch card pays alone, or two cards pay together | Pitching two cards and leaving nothing to block with | "This card's pips are worth {pitch:p}. Pitch it and you have {pitch:p} to spend." / Ledger: pitched on demand (CR 4.4.3e) |
| L3 | **The Wall** | End the Dummy's turn above L life with an attack still in hand | The Dummy swings a printed P (from the card's field); `startPatch` sets L | Over-blocking with your attack card, or under-blocking | "The ghost is what lands if you do nothing. Add to the wall and watch it shrink." |
| L4 | **One Card, Three Jobs** | Win a two-turn race from set life totals | `startPatch: {hp}`; a 4-card hand where each card has exactly one right role | Any card in the wrong role | "Every card is ammo, money or armour, and each can only be one." Story card at the end |
| L5 | **Go Again** | LINK 2 lands | Dorinthea vs the Dummy (no gear); a go-again attack and a second attack | Wrong order: the action point is gone | "{kw:a:Go again} hands your action point back, but only if that card goes first." |
| L6 | **Gear and the Weapon** | Deal at least the weapon's printed power with it, and end the Dummy's turn at or above L life | Dorinthea's printed weapon and gear | Not swinging the weapon, or leaving life on the table you could have walled with gear | "Equipment can join the wall too. Its shield number is printed on it: {defense:g}." / Keyword chips for whatever the pieces carry ({kw:g:…}), tapped for streamed text. No claim about how gear wears |
| L7 | **Instant Speed** | The pump resolves on an attack that lands | A stacked attack reaction | Playing it in the wrong window: the judge refuses it and says why | "Some cards wait for the right moment. The judge only lets legal plays through." |
| L8 | **The Arsenal** | An arsenal play lands next turn | `prelude` plays the opening turn through `reduce` into the end phase with the arsenal choice open | Setting the wrong card | End-phase steps announce themselves. "One card, saved, face down." |
| L9 | **Reading the Table** | End two turns ahead on life | vs Bravo (sparring) | Racing into a full hand, or blocking an empty one | "Count their pips: that's how many cards they hold." |
| L10 | **The Clock** | Win on life before **your** 2:00 runs out | vs the Dummy, scripted and never charged; only your seat has a 2:00 bank | Flagging | "Act inside the underline and it's free." / "Hold PASS to yield." |
| L11 | **Sit Down** | Win | A full game vs Contender, Story preset, no clock | — | Everything, then the story card |
| H1-15 | **Hero Trials** | That hero's goal predicate | That hero's real 55, with an opening stacked around the machinery the hero card's own `kw` names | That hero's key choice | Slots and streamed card text only. Authored as new lesson files; tools/scenes serve as reference only, because about half of them build no board |

**Ladder gate:** finish L1-L7 and L10, *or* win once against Contender, *or* skip with a confirmation.

### 8.3 vs AI. Waiting on one decision: may the AI pilot a hero?

> **Answered 2026-10-18: yes.** RULING (user): *"Yes it is time for the ai to learn to play the heroes - I'm confident the cards are suitable :)"* It shipped as v5.35, and the AI is now being taught one hero gap at a time (v5.36 plays a go-again non-attack before the attack). The rest of this section is kept as it was written.

*(Corrected; Appendix B, P3 and P9.)* The draft cited ROADMAP-MULTIPLAYER.md:232, "Do not build a deck-piloting AI". That line is stale: CLAUDE.md records it **reversed on 2026-08-14** ("build the seat"), and `engine/sparring.js` is that seat. But a later ruling narrows it. **RULING (user, 2026-08-16):** "seat 1 is either a PERSON, who picks their own hero when they join a table, or the dummy — and a seat the dummy fills is ALWAYS the vanilla pile. There is no hero the dummy plays as" (CLAUDE.md:12059; HANDOFF-MERGE.md:186; `test/flow.test.js:89` guards it). Today's VS AI seats `heroes: [yours, null]` (index.html:7729-7742), which is the vanilla dummy.

The tiers below, the hero opponent in L9 and the AI-vs-AI Exhibition and attract mode all need an AI **piloting a hero**, so they reopen that ruling. The 2026-10-14 brief asks for "vs AI" but does not say which kind. This is open question 3, and the two answers build different things:
- **Yes, the AI may pilot a hero:** the tiers below, on `sparring.act` with measured knobs. A stronger policy is its own project, measured with tools/tournament.js before a tier depends on it.
- **No, the ruling stands:** VS AI is the vanilla dummy, with difficulty set by its life total, the chair and the sparring knobs; L9 uses the dummy; Exhibitions replay real player games instead of AI-vs-AI ones.

Until it is answered, increment 7 ships everything except the tiers and the Exhibition, and nothing else in the plan is blocked.

| Tier | Matchup | Chair | `sparring.DEFAULTS` knobs (sparring.js:70-100) |
|---|---|---|---|
| Rookie | AI pilots a hero yours beats | You go first | `takeUpTo: 5, handBlockers: 1` |
| Contender | Even matchup | Coin | defaults |
| Champion | AI pilots a hero that beats yours | AI goes first (about 2:1 in close matchups, WEEK.md) | stricter than the defaults (`takeUpTo: 3, ironAt: 4, handBlockers: 2`, sparring.js:70-100), chosen by measurement; the draft's `handBlockers: 2` is already the default |
| Gauntlet | All 14 others, in measured order | Alternating | defaults; one cumulative practice clock on your seat |

Every tier is measured with tools/tournament.js at **80 or more games per pair** and shown in the picker as "measured with the AI in both seats". That replaces the stale "currently winning most games" copy (index.html:6196-6212). Trophies are earned only against the AI.

### 8.4 The ladder
- **Fixed rules (Melee-style):** Bo1, 15:00 bank, 2-s grace, auto-pass on, two-tap (drag-to-ring and auto-pay are personal), no coach, no undo, judge on. Pace, booth and voices are personal presentation and never affect the opponent.
- **Phase B (now):** Clocked Friendlies with the local time-score history. Labelled advisory, with no public board.
- **Server spike S (runs alongside increment 5, so it finishes before increment 6):**
  - **The test.** Load `engine/*.js` **unmodified** in a Supabase Edge Function (Deno, CommonJS through its Node layer). Replay the 105-pair corpus and match every commit `h`.
  - **Pass condition:** no bundler, no transpile, no edits to engine files. Anything else fails it, because "ought to" is how a no-build project acquires a build step (SUPABASE.md:174-176).
  - **On failure,** Phase C keeps the server as a relay and stamper only: it stamps `tm` and stores logs. Both clients' hashes must agree, and any disagreement marks the result disputed.
- **Phase C1 (increment 11):**
  - Supabase UMD at an exact version pinned at that time.
  - Accounts and matchmaking.
  - A server-side sequencer stamping `tm`, which makes the clock authoritative.
  - Redacted state.
  - The ladder pause, sleep and abandon rules of §4.5.
- **Phase C2 (increment 12):**
  - Elo rating: K=32 for the first 20 games, 16 after.
  - Leaderboards: Rating, and Clock (CTR/W, ≥ 10 rated wins).
  - A newcomer-only bracket for the first 10 rated games.
  - Games with a HOLD flag go unrated, "under review".
  - Scores are recomputed from stored replays **on the same pinned build** only.

---

## 9. Technology

### 9.1 The three.js verdict: not on the player seat, not for card art

| Fact | Measurement |
|---|---|
| The art host sends no CORS headers | `Server: AmazonS3`, no `Access-Control-Allow-Origin`. A preflight returns **403 "CORS is not enabled for this bucket"**. `texImage2D` throws `SecurityError`, so a card texture never uploads, and any canvas that draws art is tainted. `<img>` works (never add `crossorigin`) |
| The last plain-`<script>` build | **r160 / npm 0.160.1 (2024-01-22)**: `three.min.js` 669,884 B raw / **166,415 B gzip**. It self-deprecates. 0.161.0 has no `build/three.min.js`: r161+ is ES-module only (constraint 1). There have been no global addons (bloom, controls) since r148 |
| Page weight | Current React + ReactDOM + Babel is about 643,074 B gzipped. three.js would add **+25.9%** |
| iPhone cost (arithmetic; no device in the sandbox) | At DPR 3, one RGBA buffer is about 12.05 MB, and about 36 MB with depth and the compositor copy. Continuous rAF over a 30-minute clocked match means heat and throttling. **iOS drops WebGL contexts** when a tab is backgrounded or short on memory |
| Testability | A WebGL scene is one opaque box to the layout assertions |

Sizes come from npm registry tarballs. The cdnjs version folders could not be fetched from the sandbox, which does not matter because three.js is rejected.

**Verdict.** The "vibe-code vibe" comes from DOM + CSS 3D + the Web Animations API + one Canvas2D overlay, at **0 added bytes**. WebGL might be reconsidered only as an opt-in, desktop-only atmosphere layer behind the 16:9 program, with no card textures. It is not in this plan.

### 9.2 The stack
- **Existing, unchanged:**
  - React 18.2.0 UMD, ReactDOM 18.2.0 UMD, and Babel standalone 7.23.5, all from cdnjs (index.html:10-12).
  - PeerJS 1.5.4, lazy-loaded (engine/room.js:63).
  - Big Shoulders Display, Spline Sans and Spline Sans Mono from Google Fonts.
- **Added at Phase C only:** Supabase-js UMD at an exact version.
- **Rejected:** GSAP (licence is not MIT), Anime.js, PixiJS, canvas-confetti (none are needed).
- **Platform features, all 0 bytes:**
  - CSS 3D (`perspective`, `preserve-3d`), used **only in motion**. At rest the felt is flat or tilted ≤ 10° (seat) / ≤ 26° (program) and never carries text; all labels sit in flat layers.
  - WAAPI (`el.animate().finished`, Safari 13.1+).
  - Canvas2D (particles and the art-free share PNG; it never draws a card `<img>`).
  - WebAudio (about 12 synthesized envelopes plus the event-driven crowd, unlocked by the title tap). Sound is never the only signal, because the silent switch may mute it.
  - Web Speech `speechSynthesis` (booth voices, announcer; unlocked by the title tap).
  - Screen Wake Lock (clocked modes; Safari 16.4+).
  - Pointer Events (drag-to-ring).
  - `navigator.share` with a clipboard fallback.
  - `CompressionStream` for replay fragments, with a base64 JSON fallback.
  - No haptics: iOS Safari has no `navigator.vibrate`.
- **Optional embed (Pages only):** the YouTube `live_chat` iframe. It is not a library and loads no script into our page. It is hidden on `file://`.

### 9.3 Files and how they attach

| File | Kind | Exports |
|---|---|---|
| `engine/moments.js` | Pure UMD | `moments(b,x,meta)`, `ALLOW` (incl. `open`), `preview(g, reduce)`, `TIER` |
| `engine/clock.js` | Pure UMD | `waitingOn`, `windowKey`, `createBank`, `fold`, `pause`, `remaining`, `flagDue`, `score` |
| `engine/booth.js` | Pure UMD (moved from cup8/selfplay) | `tally`, `ledger`, `called`, `observe`, `fold`, `ROUTE_GLOSS`, `routesOf`, `REFUSAL_CR`, `BANK` |
| `engine/lesson.js` (+ lesson data) | Pure UMD | `createLesson`, lessons L1-L11, H1-H15, slot renderer |
| `engine/replay.js` | Pure UMD | `record`, `pack`/`unpack` (fragment), `check(replay, env)` (build/catalog/`h` verification) |
| `engine/view.js` (increment 10) | Pure UMD | `project(g, viewer, mode)`: live, delayed or replay |
| `stage/director.js` | DOM, plain JS, no JSX | `createDirector({hud, stage, fx})` with `.push(moments, shown)`, `.launch(uid, rect, src)`, `.flush()`, `.pace(p)`, `.subscribe(fn)` |
| `stage/fx.js`, `stage/sound.js`, `stage/voice.js` | DOM | sparks and flashbulbs; the 12 sounds and the event-driven crowd; Web Speech queue and announcer |
| `tools/phone/stage-lab.html` | Dev page | replays seeded sparring games at Normal / Fast / Instant |

**The replay record:**

```
{ v, app: APP_VER, build: TABLE_BUILD, catalog: W.catalogHash(catalog),
  spec: {seed, heroes, first, vanilla?, lesson?: {id, prelude, startPatch}},
  log: [{seq, seat, action, tm, h}], pauses: [{tm0, tm1}] }
```

- The local store keeps `h` on every commit. A URL fragment keeps `h` on every 10th `seq` plus the last, to stay short.
- `check` re-reduces the log and compares each stored `h`. On a `build` or `catalog` mismatch, the player labels it: "recorded on another build; this table may tell it differently". At the first diverging `h`, it stops there.
- The pin matters because the database streams from upstream and drifts (test/drift.test.js).

**Small, non-rules touches:**
- **`judge.js`:** export `canRespond` (read-only); the `concede` `why` branch; the feed wording fixes.
- **`prompts.js`:** the opt-result line.
- **`local.js`:**
  - `onState(state, meta)`;
  - `onStep(prev, next, meta)` for every accepted action;
  - `autoPass` as a seat policy inside `runPolicy`'s bounded loop;
  - `tm` stamps with the sleep cross-check;
  - the full log.
- **`net.js`:**
  - `tm` on COMMIT;
  - host-only whitelisted `sequenceFor`;
  - the guest's whitelist for own-seat commits with no in-flight id;
  - pause records;
  - an append-only full log outside `g` (beyond the 20-commit journal).
- **`wire.js`:** `PROTO` bump.
- **`room.js`** (increment 10): spectators.
- **`build.js`:** the mirror-name suffix; a per-seat vanilla name.
- **`tools/selfplay.js`:** calls `DawnBooth.routesOf` and keeps the audit-only routes.

**Load order and wiring:**
- `<script src>` tags for engine/ and stage/ go before the `text/babel` blocks, and the bridge lifts `DawnMoments`, `DawnClock`, `DawnBooth`, `DawnLesson`, `DawnReplay`, `DawnView` and `DawnStage`.
- Each new engine module also gets a test/sync.test.js MODULES entry, to satisfy the census at test/wire.test.js:424-433.
- A new **stage census** sits beside it: every `stage/*.js` is script-tagged in index.html and copied by serve.sh.
- serve.sh gains one line: `cp -r "$R/stage"`.
- **The wiring:**
  - `onStep`/`onState(st, meta)` → `moments(prev, st, meta)` → `director.push`, plus `booth.fold`, `clock.fold(bank, commit)`, `replay.record` and `judge`.
  - The director notifies `StageView` through `subscribe`. That is the only side effect, and nothing writes to `g`.
- **stage-lab** loads card data from the public database URL (ACAO `*`, which works from `file://`), never `fetch("../../data/pool.json")`, which `file://` blocks.

### 9.4 Phone performance budget (iPhone 12 class, 393x852, DPR 3)

| Item | Budget |
|---|---|
| Added library bytes | 0. New plain JS ≤ 70 KB raw; new JSX ≤ 900 lines |
| Tap acknowledged | ≤ 1 frame (CSS `:active`). Tap → reduce → render, locally, ≤ 50 ms |
| Per state change | `moments` + `booth` + `waitingOn` + `fold` ≤ 2 ms. `preview` ≤ 8 ms, after paint, memoized by `seq`. If it exceeds 16 ms on 3 consecutive states, the ghost turns itself off for the session and the report says so |
| React renders | A moment frame re-renders only `StageView` (memoized); `TableBoard` renders only on true-state changes |
| Idle | **0 rAF loops**. Clock text at 4 Hz (10 Hz under 10 s), clocked modes only. Danger is a compositor-only CSS animation. AudioContext suspended after 3 s idle |
| Motion | `transform` and `opacity` only; ≤ 12 concurrent; FLIP reads happen in `fire()` before dispatch (one rect per source), and clones are positioned with writes only |
| FX canvas | ≤ 80 particles, ≤ 0.6 s life, DPR ≤ 2 (786x1704 ≈ 5.4 MB); the loop stops when empty |
| Speech | ≤ 1 queued utterance; cancelled on flush |
| Attract mode | ≤ 3 games, then a static title; stops when hidden |
| GPU | No WebGL context, so nothing to lose on backgrounding |
| Log | Render capped at 200 lines |
| Battery | Target ≤ 6% per 30-minute clocked game on an iPhone 13 (Wake Lock on, crowd on, voices off). **Measured** with Safari Web Inspector Timelines before the clock ships |

---

## 10. Build plan (each numbered increment is one release)

The release rule for all of them:
- `npm test` green;
- box assertions at 393x852, 393x660, 375x667, 360x740 and 820x1180 (overlap, narrowest flex child, `flex-direction`);
- the dead-tap sweep (tools/phone/sweep.sh, 15 heroes).

| # | Release | Ships | Acceptance checks |
|---|---|---|---|
| 0 | **Design week** (not a release) | This blueprint as `STAGE.md`. `tools/phone/stage-lab.html`: plain scripts loading `../../engine/*.js` and prototype `stage/*.js`, card data from the public database; runs and replays seeded sparring games with HUD, ghost, ring, caption and the three paces | Opens from `file://` with no server. A seed replays to the same final hash as tools/selfplay. 0 idle rAF. Feel reviewed on the iPhone at all three paces |
| 1 | **v5.31 Truth first** (no new look) | The five feed and arsenal fixes, each with its selfplay regex update, plus the Cloaked back and the caption shape census (§6). `strike` records `pend.power` (§3.4). Table renders `featured.chip` and `.dmgpop`. `.gamelog` capped at 200. `engine/moments.js`. `judge.canRespond`. `local.js` `onState(state, meta)` + `onStep` for every action. `engine/replay.js` with pinned build, catalog and `h`. Full logs with `tm` in local.js and net.js (+ PROTO bump). Mirror names | **Moments census** over the 105-pair corpus: every `hp` change is explained by a strike or arcane moment credited to `pend.by`; every moment number is in state; order inside a pass is correct; exactly one GAME per game; the player's own swings and hero powers arrive through `onStep`. **Hidden-card census:** no face-down card name in any shared line. **`canRespond` census with an independent generator:** ACTIONS × every uid in every zone of both sides × `targets()` × each split half × pitch and soul zones; false ⇒ `legal` refuses every non-pass candidate. Route counters unchanged after the wording fixes. State hashes change exactly once, for `pend.power`, and every pinned hash is re-pinned in that commit; `W.hash` unchanged by `tm`. SECOND-PERSON check catches `condWhy`. Replay `check` passes all 105 games and flags a forged `catalog`. cup8 green |
| 2 | **v5.32 The HUD** (Stage beta) | The staged single-screen branch inside `TableBoard` (shared subtrees hoisted, not copied) with a memoized `StageView`. Bars with sibling numerals, chip, ghost (projection + guards), shields, danger, hand pips, whose-decision light, T·R, passive judge eye. Strips with hold-for-sheet, counter chips and `+N` overflow. Measured bands, compact mode, row-B AVG rule. Glyph badges ≥ 13 px. Strike equation | Box assertions at every viewport: no band overlap; rail top = stage bottom ±1; bars equal width ±1; life numeral ≥ 18 px; all text ≥ 11 px; targets ≥ 44x44; primary ≥ 152x48 in the bottom-right third; row B children never overlap and the clock is never clipped (AVG hidden at 360). **No HUD text node under a transformed ancestor.** **"Preview never lies":** wherever both seats then pass, preview equals the real dealt amount, and the guard-hide rate is reported. Counter chips: every chip name is a card name in that `board[]` or a zone name. glisten counts unchanged. Dead-tap sweep on the staged branch; `peekables()` covers the strips. A moment frame does not render `TableBoard` (render counter) |
| 3 | **v5.33 The button** | Actbar relabel (§7.3) incl. rail-chooser and choice row; auto-pass as a seat policy; yield (with touch-callout CSS); persistent stops; context glow; judge CALL on refused reaches (any-tap dismiss); opt-in one-tap toggles; drag-to-ring; auto-pay when covered; Instant last-action chip; hotkeys | Every label maps to an action `legal` accepts, or to a `.a.dis` naming the reason, on every corpus state. Every discost, fuse, charge, xval and split option is reachable, and the actbar band box is identical across all branches. Auto-pass never fires when a stop applies, never in your own empty action phase, and never recurses (`STEP_LIMIT` respected in local, one per `seq` in net). Toggle-twice hash identity. Auto-pay fires only when `legal(payConfirm)` is null on an exact cover. Drag drill with synthesized pointer events: a release off the ring commits nothing; horizontal drags scroll the rail. Every refused reach shows a CALL whose text is the `legal` string. Each hotkey drives the same `fire` path, and commits take two presses |
| 4 | **v5.34 The beat** | `stage/director.js` (with `launch` clones from `fire()`), `fx.js`, `sound.js` (event-driven crowd, suspend and resume). READY · GO! plus the 12 moments and minor beats; hit-pause; budgets; flush-on-input; reduced motion; the AI turn paced through `onStep`. serve.sh copies `stage/` | Dead-tap sweep widened to hand, arsenal, weapons, strips and hero power, with the director slowed 5x: every first tap peeks on current state, every second commits, none lost. After `flush`, the `shown` hash = the session hash. **Chrome never moves:** rail, strips and actbar boxes identical before, during and after a strike. Clones and canvas have `pointer-events:none`. 0 rAF and a suspended AudioContext over 5 s idle. Normal ≤ 3.0 s per player-turn across the corpus; Instant = 0. Drills: every script directory is copied by serve.sh; every `stage/*.js` is script-tagged |
| 5 | **v5.35 Booth and judge** (+ spike S in parallel) | `engine/booth.js` (cup8 and selfplay `require` it; `routesOf` extracted; `fold`). Caption lane with the tier type ramp, Ledger pops, tiers and bank, per-viewer first-encounter lines, presets. `stage/voice.js` booth voices and announcer. Judge states, `REFUSAL_CR`, TIME line through `GM.sv`, "Call a judge" + Concede, "Rules quiz", judge's report, coach gating. **Spike S:** the engine in a Deno Edge Function | cup8.test unchanged and green; selfplay route counts unchanged. Live-booth drill: every number and name is in its row; the bank holds no digits, number words or names; same `seq` ⇒ same line; `fold(prefix)` at any scrub point equals the live state of the booth. Speech speaks only strings the caption drill passed, and `flush` cancels it. **Refusal census:** every refusal string seen across the corpus plus a candidate sweep maps to `REFUSAL_CR` or "table procedure". No invariant code, camelCase engine identifier or hand-rolled possessive in any player-facing line. **S:** the corpus replays to every `h` with unmodified engine files, or Phase C takes the relay-only fallback |
| 6 | **v5.36 The clock** | `engine/clock.js` (bank, fold, pauses); the `concede{why}` branch and its line; host `sequenceFor` + guest whitelist; host flag; guest fold and drift check → CLOCK DISPUTED; claim; sleep detector; pause records; Wake Lock; HUD clocks, underline and tiers; Clocked Friendlies; vs AI practice clock; results time score (wins-only CTR, CTR/W, AVG, PACE) and chart; local history | net.js loopback with drop, delay and reorder: host and guest banks equal. `W.hash` identical with and without `tm`. Toggle spam and `play`↔`payCancel` loops earn no grace. Auto-passes are charged ≤ RTT. READY · GO! is never billed. A forged early flag yields **CLOCK DISPUTED** and a disputed record on the guest (not RESYNC). An accepted flag gives `over.how==='time'`, and the replay reproduces it and the clock graph. A simulated sleep (frozen `performance.now`, advancing `Date.now`) records a pause in a Friendly. Pause records excluded from charge. Wake Lock requested and released. A guest cannot have a non-whitelisted own-seat action sequenced for it. Unit drills for U, R, AVG, PACE and every `contrib` case (incl. the early-concession win). Battery measured |
| 7 | **v5.37 The shell** | Title with attract mode, Home tiles, TODAY'S EXHIBITION, QUICK REMATCH, hash routes, VS splash, GAME!, story card (live DOM panels, URL share, art-free PNG), vs AI tiers + Gauntlet. Stage becomes the default (Classic remains), **gated on the FINISH.md P5 tuning play session**: making Stage the default moves the tuned `[3,4,5]` trainer off the main path, and FINISH.md:286 sequences that with tuning *(Appendix B, P10)*. The trainer moves to Learn → Sandbox | Router drill: every mode is reachable and returns Home. Attract stops on tap and when hidden, and is absent under reduced motion. Today's Exhibition is the same for a given date. The share PNG canvas is never tainted (`toBlob` succeeds). Tier rates measured at ≥ 80 games per pair and printed. Dead-tap over the menus. Trainer drills green |
| 8 | **v5.38 Learn** | `engine/lesson.js` (prelude, startPatch, slot templates), L1-L11, H1-H15, skip, ladder gate | Per lesson: the start state (after prelude and patch) passes `invariants.check`; the patch touches only `hp`; the golden path reaches `goal`; the scripted wrong path reaches `fail`; every scripted and prelude action passes `legal`; only `full`-coverage cards; L1-L4 tables carry no card with rules text (gear empty); no 5-word window of lesson copy matches any `card.tx`. **Claim drill:** every slot resolves to a field or `kw` present on its card in that lesson's seats, and unslotted copy holds no digits or keyword names. Golden path ≤ 3 min of simulated Normal pace |
| 9 | **v5.39 Watch I** | Exhibition with hole cam; replays (store + URL fragment); replay player; 16:9 program with flat text overlay and the chat-safe layout; `#broadcast` for Exhibition and replays; desktop watch page with the booth-filled rail, moment cards and the optional YouTube chat embed (Pages only); phone watch layouts; story spine | Replay `check` = the original commit `h` at every stored `seq` for all 105 games. Replay commentary = live commentary, excluding per-viewer first-encounter lines. Program exactly 16:9 and inside title-safe at 1280x720 and 1920x1080. The chat-safe column is empty of our pixels. No program text node has a rotated ancestor. The embed control is absent on `file://`. No hole cam reachable from any player view. One manual OBS capture to an unlisted YouTube stream with the real chat overlaid |
| 10 | **v5.40 Watch II** (friend-grade live) | `engine/view.js`; room.js spectators ("Allow watchers"); live redacted view plus a hole cam after ≥ 3:00 delay; `#broadcast` / `#watch` for live codes; real `{ch:"chat"}`, reactions, prediction bar; viewer count and crowd meter for players; "friend play, not cheat-proof" label; a featured live table on Home when one is open | Projection drill: no hand faces, deck order or rng in the live view; faces appear only after the delay. Opening ≤ 20 KB, each patch < 2 KB (under the 97 KB channel drop). Loopback with 2 players + 1 spectator. Players on a clock never receive chat text. Home features only tables that are really live |
| 11 | **v5.41 Phase C1: the server** | Supabase accounts, matchmaking, server sequencer and stamps (or the relay-only fallback from S), redacted state, the ladder pause, sleep and abandon rules | Server-stamp clock drills. The abandon claim at 90 s. The SUPABASE.md checklist. No build step introduced (the engine files are byte-identical to Pages) |
| 12 | **v5.42 Phase C2: the ladder** | Elo, Rating and Clock (CTR/W, ≥ 10 wins) boards, newcomer bracket, under-review flags | Scores recomputed from stored same-build replays equal the stored scores. HOLD games unrated. The early-concession rule enforced server-side |

---

## 11. Risks and open questions

### Risks

| Risk | Mitigation |
|---|---|
| 98 test files read index.html; a reflow breaks anchors | The staged branch is added beside the existing code. Shared subtrees are hoisted inside `TableBoard`, never copied, and the glisten counts guard that. The beta flag stays until increment 7 |
| Babel compile time grows with the JSX | Director, FX, sound, voice and every pure module are plain JS; JSX ≤ 900 new lines |
| Re-rendering the 850-line `TableBoard` per moment frame | Memoized `StageView` subscribed to the director; a render-counter drill |
| The Safari tab has about 660 px of height (no manifest) | Measured bands, an assertion at 393x660, and compact mode below 620. Adding `apple-mobile-web-app-capable` is optional and recorded, not assumed |
| The HUD is too narrow at 360 | Pips capped at 5 + `xN`; AVG measured onto or off row B; box assertion |
| The projection is slow on the device | Memoized by `seq`, run after paint, a self-disabling budget; Node corpus timing as a proxy |
| The projection reveals hidden information | The rng / deck / hand / face-down guards; "?" over a guess |
| Peer-to-peer trust: the host stamps the clock and both peers hold full state | Drift check, CLOCK DISPUTED, everything labelled advisory until Phase C. No public leaderboard in Phase B |
| The device sleeps or the screen locks mid-match | Wake Lock; the `Date.now` sleep detector; Friendlies pause on recorded spans; the ladder (server) keeps running, as stated on the rules screen |
| The engine won't run in Deno without a build step | Spike S runs alongside increment 5 with a strict pass condition; the relay-only fallback |
| Replays diverge as the database drifts | Pinned `build`, `catalog` and `h`; mismatches labelled; Phase C recomputes same-build only |
| The `canRespond` census shares the code's blind spots | An independent candidate generator before auto-pass ships |
| Over-juicing, or pros feeling dragged | Per-turn budgets, flush on any input, Fast and Instant, drag-to-ring, auto-pay, the chrome-never-moves drill |
| Commentary fatigue | Once-per-match glosses, at most one Ledger pop per turn, tiers rather than constant hype, a speech queue of one |
| Speech voices vary by device | Presentation only (outside `g`); the caption is canonical; voices are off on clocks by default |
| Auto-pass tells the opponent you hold nothing | Documented. Moot while peers hold full state. Revisited with Phase C redaction, gated on a corpus measurement |
| Sound muted by the silent switch | Every sound has a visual twin; sound is never the only signal |
| Time-score farming | Wins-only CTR, no credit for an early-concession win, CTR/W with a minimum wins rule |

### Open questions for the user (each with the default this plan builds)
1. **What does running out of time mean?** *Default: a loss* (MTGO). Flesh and Blood paper policy plays one more turn and then calls a draw.
2. **Fake chat for atmosphere?** *Default: no simulated chatters, handles or viewer counts.* The rail fills with real booth lines and moment cards, real chat appears when real people watch, and a real YouTube stream can show its own chat. Fake chat would be the one dishonest pixel on the screen.
3. **May the AI pilot a hero?** **Answered 2026-10-18: yes** (§8.3; shipped v5.35). *As first written:* The 2026-08-16 ruling says a seat the dummy fills is always the vanilla pile, and the vs-AI tiers, L9's hero opponent and the AI-vs-AI Exhibition all need a hero-piloting AI (§8.3). If yes, the tiers run on `sparring.act` with measured knobs. If no, VS AI is the vanilla dummy at tuned difficulty.
4. **Which number is "average time"?** *Default: clock used per turn started* (on the HUD and the ladder), with seconds per decision as a personal stat on the results screen.
5. **When does "ranked" begin?** *Default: Phase B ships as Clocked Friendlies* with local, advisory time scores. The word "ranked" and a public leaderboard wait for the Phase C server, which stamps the clock and holds redacted state.
6. **Should "cumulative time remaining" count wins only?** *Default: yes.* Losses add 0, and the board ranks the mean per win. Counting losses would let a player top the Clock board by losing quickly.
7. **Should the booth speak at the seat by default?** *Default: on when watching, opt-in when playing, off on any clock.*

---

## Appendix A: Critique applied

**Applied as proposed:**
- READY · GO! beat; attract-mode Exhibition on the title.
- Broadcast felt text moved to a flat overlay, with the felt-tilt rule unified.
- `#broadcast` scoped to Exhibition and replays in increment 9, with live codes in 10.
- Chat-safe OBS column for the real YouTube chat.
- Life numeral taken out of the skew.
- Early flag → CLOCK DISPUTED, not RESYNC.
- Wake Lock and the `performance.now` / `Date.now` sleep cross-check.
- HUD row B overflow, resolved with measured AVG placement and an assertion.
- Tier type ramp and Web Speech booth voices plus an announcer (off on clocks by default).
- Judge CALL on refused reaches.
- N-choice actbar branches moved to the rail and a chip row.
- Counter and token chips named by their own cards.
- Drag-to-ring; auto-pay when covered (opt-in); Instant last-action chip.
- Phase C numbered as increments 11-12, with the Deno spike before increment 6.
- Lesson `prelude` + whitelisted `startPatch`.
- CALL dismissed by any tap.
- TIME line through `GM.sv` with the short name.
- L10 charges only your seat.
- L1-L4 `gear: []`, since Ironrot carries Blade Break; `buildVanilla` accepts empty gear.
- First-encounter lines excluded from replay equality.
- CR attribution fixed: 7.3.2 for declaring, 7.3.3 for the priority clause, as cup8.js:202 already writes it.
- `h` stored in replays.
- local.js `onState(state, meta)` + `onStep` for every action.
- FLIP source rect captured in `fire()`, with a clone animated.
- `stage/` script census.
- Share by URL; story panels as live DOM (CORS taint).
- stage-lab reads the remote database, not `data/pool.json`.
- Memoized `StageView`; event-driven, suspendable crowd.
- Long-press CSS; replays pinned to `TABLE_BUILD`, `catalogHash` and app version.
- Booth as a pure fold; auto-pass as a session seat policy.
- Host-only `sequenceFor` + PROTO bump.
- Independent `canRespond` candidate generator.
- L6 copy rebuilt from fields and `kw`; hand pips count cards in hand only.
- Hero Trials not built from blurbs; pitch values from the `pitch` field.
- Claim-to-field/`kw` drill via slots.
- CTR made wins-only, plus a minimum wins rule.
- The clock's fold renamed to bank/fold.
- `routesOf` extracted with the feed fixes landing alongside their regexes, and the audit-only routes kept in selfplay.

**Applied with a narrower scope:**
- **YouTube `live_chat` iframe:** Pages-origin only and hidden on `file://`. Constraint 1 requires the game itself to run from `file://`, so the embed is optional rather than core.
- **"Featured table" spotlight:** before real live tables exist (increment 10), Home features only a date-seeded Exhibition labelled AI vs AI plus your last replay. A featured live table before then would be a fake (golden rule).
- **Deno spike:** its pass condition explicitly forbids any bundler, transpile or engine edit (constraint 1). Failure routes Phase C to a relay-only server instead of a build step.
- **CTR fix:** beyond wins-only, a concession or abandonment win before the winner's 3rd turn counts 0, and the tiebreak and board use CTR/W instead of CTR/G, so collusion and volume cannot buy it.

**Rejected:** none. No critique point conflicts with a hard constraint once it is scoped as above.

## Appendix B: What the prototype measured, and what the corpus confirmed

The prototype (`design/prototype/`) replays one real engine game: Kayo against Dorinthea, seed `p1`, Kayo first. Each finding it made was then measured across the self-play corpus: every ordered pairing of the 15 heroes (210 games), seeded exactly as `tools/tourney.js` seeds them. The drive loops reproduced `selfplay.play()` game for game (same final hash, steps and turn, and byte-identical feeds in 210 of 210 games), so the measuring did not disturb what it measured. An adversarial pass then tried to refute each correction, and four more came out of that (P7 to P10).

### The game

| Measure | Value |
|---|---|
| Actions | 351, of which **223 passes (64%)**. None of the passes are staged |
| Rows the stage shows | 143 (a row is kept when it printed something or life moved) |
| States audited by the judge | 351: **0 violations, 0 warnings** |
| Strikes | 18; Dorinthea wins on 1 life on turn 18 |
| Fidelity check | **42,527 checks, 0 mismatches**: every life total, zone, wall, chain link and projection the page shows, against the recording |
| Phone layout | No horizontal scroll at 393 or 360. Every band is contiguous. Nothing in the device is under 11 px. On a 393 phone, the table starts 239 px down the page |

Across the corpus, passes are 58,493 of 90,942 steps (64.32%), about 12 per player-turn. That is why §5 never stages a pass.

### The preview never lies (§3.4)

Across 210 games (90,942 actions):

| Measure | Value |
|---|---|
| Eligible states (an open link, nothing dealt yet, step attack/defend/reaction) | 41,043 |
| **Projections followed only by passes up to the strike** | **16,818 of 16,818 exact**, at 1 to 6 passes ahead |
| Projections followed by any other action (a defender declared, a reaction played) | 4,035 of 21,341 equal the final damage. Expected: the preview means "if both pass now", and the defender then changes the answer, which is the point of showing it |
| **"?" rate** | **6.7% (2,731 states)**. 2,650 had a payment, a prompt or a pending choice already open. 81 opened one during the projected passes (Crash and Bash's pick, Brothers in Arms' pay sheet) |
| Known but not a number | 27 states: 14 predict a phantasm pop (the attack is destroyed with no strike) and 13 are games already over |
| Cost per projection (2.1 GHz Xeon, Node 22) | mean **0.12 ms**, p95 0.23 ms, p99 0.68 ms. The rare 12–42 ms maxima are garbage collection; §9.4's self-disabling budget covers them |

### The corrections, and the evidence for each

| # | Section | What the blueprint said | What was measured | Applied |
|---|---|---|---|---|
| P1 | §3.4, increment 1 | The strike equation reads `pend.total` | In the game, 4 of 18 strikes had a reaction pump outside `pend.total`: every pumped Dawnblade swing would print `3 vs WALL 0 → 6`. **Across the corpus**, the struck power differs from `total` on 195 of 4,424 strikes (4.4%): a reaction pump (181), a standing grant such as Night's Embrace (9) or both (5). **`_struck` is not the answer either.** It is stamped before the late bonuses (engine/effects.js:7442), and 13 cards add one after it: Walk in My Shoes 33 times, Short Shrift 28, Wee Wrecking Ball 26, Take Flight 7, and nine more 1 to 4 times each (117 strikes). Counting prevention, over 4,224 hero strikes the equation shows the wrong damage on **282** against `total`, **97** against `_struck`, and **0** against the total `linkPumps` returns | `strike` records the power the wall was subtracted from as `pend.power` (one key at judge.js:2220). The equation and the projection read it. State hashes change once, deliberately |
| P2 | §3.1, §2.1 | The life numeral is "a flat sibling over the bar's inner end" | The inner end is where the fill drains, the chip trail drains and the ghost is drawn, and the numeral hid the ghost. The outer end is no refuge: of 8,339 ghosts shown in the corpus, 2,761 touch the outer end, including all 1,892 lethal ones. Beside the bar, a box-overlap check reports no overlap with the bar or the T·R box at 393 or at 960 | Beside the bar, flanking T·R, as the blueprint's own diagram drew it. The width budget pays 2 × 22 px: bars ~94 px at 393, 78 at 360 |
| P3 | §8.3, Q3 | "The roadmap rule stands: Do not build a deck-piloting AI (ROADMAP-MULTIPLAYER.md:232)" | CLAUDE.md records that decision **reversed on 2026-08-14** ("build the seat"), and `engine/sparring.js` is that seat. ROADMAP-MULTIPLAYER.md:232 still says "still right" | The stale citation is gone. What the reversal does not settle is P9 |
| P4 | §6, increment 1 | Four feed fixes before any voice ships | **A census of all 108,351 feed lines in the corpus.** A fifth fix: "<weapon> connects — your hero ability frees it for one more swing this turn." (engine/effects.js:8151, 118 lines in 28 games). In all, **2,561 lines in 43 shapes speak in the second person** to a feed both seats read: 1,716 in the engine's own voice (27 shapes) and 845 that quote a token's printed text. **2,124 lines in 10 shapes name a hidden card, in all 210 games**; the face-down arsenal line alone is 1,347. A headline allowlist keeps 32,972 lines (30.4%), and every attack prints its declaration twice (judge.js:3377 and effects.js:5076, 4,443 of 4,443), so dropping one leaves 28,529 (26.3%). Procedure narration is 41,079 lines (37.9%): end-phase steps, payment prompts, "no action point spent", and noop reasons | Five fixes. The caption reads a pinned, censused table of headline shapes, and the census is a drill (§6) |
| P5 | §2.1 | The wall row shows a number per blocker | In the game, Gauntlets and Helm of Unity printed 1 and blocked for 2. **Across 2,100 games**, 4,863 of 52,481 blocker contributions (9.3%) differ from the printed defence. The causes: Lyath's halving (`card.def` is already halved at the deal), Unity (only with a declared hand card: 101 of 326 Unity blocks), Temper wear, Blade Beckoner, a clash won, Brothers in Arms paid, Embodiment of Earth, Shred, and defence reactions' own conditions. **The exact reader** reproduced all 52,481: `defendValue(sd, card, {base: gearDef(piece) for gear, weaponAttack, atkCard, handDefenders})` with `handDefenders` counted from `blockH`; a played reaction's value is `blockRx[i].def`. Without the context it is wrong 645 times, all on gear. About 1% of values change between declaration and strike (Unity when a hand card joins, a clash, a pay sheet, Shred), so the display re-reads on every state | Per-blocker numbers come from that reader on every state, never from `card.def` |
| P6 | §4.1 | The attacker's defend-step stop is off by default, so the defender's clock runs | Load-bearing, and stronger than the draft said: after **every one of 4,856** corpus declarations priority was back with the attacker, because `doDefend` ends `return P.reset(n)` (judge.js:3418) by design. 1,310 defend steps had more than one declaration (up to 5). Without the rule, the defender is shown "KAYO TO ACT" and a dead button after each toggle, and the attacker's clock is billed for the defender's thinking | Kept. `waitingOn` names the defender in the defend step until the strike (§4.1) |
| P7 | §3.4 | "(N prevented)" shows only when the projected ward and arcane-ward pools fell by exactly that difference | A `Ward N` is the permanent itself (v4.34) and a shield lives on `wardNext` (v5.06). The pool drop matched the prevented amount on only **87 of 283** prevented hero strikes (559 points prevented), and 195 had no pool drop at all | "(N prevented)" is `max(0, power − wall) − dealt`, read off `pend.power` (P1) |
| P8 | §5 row 5 | An instant-speed pump shows as "pend.total goes up" | A reaction's pump lands on `pend.rxPump` (judge.js:1973-1974; v4.03). Mid-link, `rxPump` rose **186** times and `pend.total` only 34, 32 of them Lightning Press through the `runOps` self route | The moment watches `rxPump` and `total` both |
| P9 | §8.3, L9, attract mode, Q3 | Four vs-AI tiers with the AI piloting heroes; L9 against Bravo; AI-vs-AI Exhibitions | **RULING (user, 2026-08-16):** "a seat the dummy fills is ALWAYS the vanilla pile. There is no hero the dummy plays as" (CLAUDE.md:12059, HANDOFF-MERGE.md:186; `test/flow.test.js:89` guards it). Today's VS AI seats the vanilla dummy (index.html:7729-7742). The draft, its critic and the first correction pass all missed this | §8.3 states both answers. Increment 7 ships everything except the tiers and the Exhibition until the question is answered |
| P10 | §6, increment 7, §1, §8.3 | (a) The judge's eye reads `invariants.check`; (b) increment 7 makes Stage the default; (c) "98 drills read index.html"; (d) Champion sets `handBlockers: 2` | (a) The `onState` funnel calls `DawnInvariants.errors(st)` (index.html:6809), which drops the warn band, the channel v4.39 found nobody listening on. (b) FINISH.md:286 sequences retiring the tuned `[3,4,5]` dummy *with* the P5 tuning play session. (c) It is 98 test files of 235. (d) `handBlockers: 2` is already the default (sparring.js:78) | (a) The eye reads `check()`, both bands. (b) Stage becomes the default only after that play session. (c), (d) Corrected in place |

### The prototype's own review

An auditor drove the page row by row at every preset and both views and found seven presentation defects. All seven are fixed in the template, and the fidelity check above re-ran clean afterwards.

| # | Defect | Fix |
|---|---|---|
| D1 | A declared hand defender showed in the hand rail unmarked and again in the wall row (21 rows) | The rail marks it ⛨ WALL |
| D2 | The caption rewrite printed "Knucklehead is destroyed breaks." | One headline phrase per line, "Knucklehead breaks." |
| D3 | The story card's "biggest single hit" named one of a four-way tie | Ties are named as ties |
| D4 | The phone hand rail hid a 6th card with no sign it was there | The rail compresses its overlap first, then scrolls with an edge marker |
| D5 | The broadcast hole-cam header wrapped to three lines and its cards ran past the box | "HOLE CAM" on one line, cards at 26 × 36 |
| D6 | Broadcast wall cards overlapped the links line by 2 px | Re-laid out; overlap measured 0 |
| D7 | The first and last turn on the broadcast spine were clipped by 4 px | Clamped inside the spine |

### Leads for the engine queue (measured, not fixed here)

Increment 1 takes these as inputs; each one is in `QUEUE.md` on `findings/queue`.

- **Hidden cards named in the shared feed (P4).** Beyond the two looks already recorded as `look-named-in-shared-feed` (Compass of Sunken Depths, Scout the Periphery):
  - the face-down arsenal line, judge.js:3457 (1,347 lines, every game);
  - opt and Spire Sniping's reorder, prompts.js:1179-1184 (214 lines; the "sent to the bottom" branch never fired but names cards the same way);
  - Azalea's ability naming the face-down card it sends to the deck, effects.js:1435 (46);
  - hand-to-deck moves with no printed reveal, prompts.js:1218-1221 (29);
  - Boulder Drop's crush, effects.js:1283 (3).
- **Second-person lines (P4).** 43 shapes. The largest are noop reasons: parser.js:1713 (299), parser.js:2510 (263), parser.js:880/882 (152).
- **Hardcoded names in engine strings.** effects.js:581 prints "Kayo makes Might" and parser.js:1713 prints "Gravy Bones'". effects.js:2430 prints a lowercased card name ("crouching tiger").
- **The duplicate attack declaration** (judge.js:3377 and effects.js:5076, on every attack).
- **A blocker the feed never names.** In 3 strikes of 2,100 games, a halved card hit by Shred went to 0 defence and was the whole wall. `strike` prints no Wall line when the wall totals 0, so the feed never mentions that the card defended.
- **Unity and a defence reaction from hand (a ruling question).** Unity prints "When this defends together with a card from hand". `handDefenders` counts declared hand cards (`blockH`) only, so a defence reaction played from hand in the reaction step does not lift it (44 times at 3 seeds). On timing, that is probably right: the trigger is at declaration and the reaction comes later. v5.21's rule (every count of a wall should see a played reaction) points the other way. It needs a ruling, not an edit.
- **Unity's "until end of turn".** The +1 is computed per wall and not carried to a later wall in the same turn. Not measured.
- **Stale documents.** ROADMAP-MULTIPLAYER.md:232 still calls the 2026-07-25 "no AI" decision "still right", and CLAUDE.md points to HANDOFF.md for the 2026-08-14 reversal, which is recorded in HANDOFF-MERGE.md:188.

### What the prototype does not show

It is a replay, so nothing in it is an input. These parts of the blueprint are not built in it:
- the payment ring, auto-pass, yield, drag-to-ring and hotkeys;
- counter chips, the READY · GO beat and hero-power staging (danger is staged as a rim flash and a low tone);
- the opponent card pop;
- the booth's voices, the Ledger pop (only the broadcast's lower third carries Ledger), the judge CALL and the JudgeSheet;
- lessons, menus, the chat rail, spectators and the real clock.

Its stamp reads `_struck` because `pend.power` does not exist yet. That is exact for this game, which has no late-bonus strikes. Its sound is a handful of synthesized blips, off by default. Its caption uses a small allowlist of headline phrases, which is the prototype of P4's census, not the census.

### Critical Files for Implementation
- /home/user/dawnblade-ai/index.html (`TableBoard` 6789-7642: local and net `onState` 6867/6900, `fire` 6941, opponent arsenal ~7164, actbar 7475-7577 with the N-choice branches 7497-7555; `App` 7643-7773; bridge 1455-1532; `PeekDock` 2191, `PromptSheet` 2304, `JudgeSheet` 2466, `Advisor` 2570; `DUMMY_GEAR`/`DUMMY_DECK` 827-837)
- /home/user/dawnblade-ai/engine/judge.js (`legal` 761/766 and `playableWhy` 1085/1513; `settle` 1869 / `afterDefenders` 1928; `strike` 2023/2220; `concede` 2352-2355; `doPlay` pending 2455-2466; `someoneCanRespond` 3144-3162; arsenal line 3457; exports 3721)
- /home/user/dawnblade-ai/engine/net.js (`PROTO` 88, `JOURNAL` 108, `apply`/`sequence`/COMMIT 150-172, `submit` 178-185, HELLO/proto 365-390) and /home/user/dawnblade-ai/engine/local.js (`push` with no meta at 72, `runPolicy`/`submit` 78-111)
- /home/user/dawnblade-ai/tools/cup8.js (`tally`/`ledger`/`called`/`observe`/`ROUTE_GLOSS` 146-230, glosses 195-212) and /home/user/dawnblade-ai/tools/selfplay.js (route regexes 146-431, no-mirror rule 107-110, row shape 452-460), which merge into the new engine/booth.js
- /home/user/dawnblade-ai/engine/game.js (`sv`/`sp` 105/135), /home/user/dawnblade-ai/engine/build.js (`buildVanilla` 925-937, vanilla names 985), /home/user/dawnblade-ai/tools/phone/serve.sh (line 28) and /home/user/dawnblade-ai/test/wire.test.js (424-433)

## Appendix C. Two layout changes, 2026-10-18

Both came from the user after watching the prototype. They are built in `design/prototype/stage.tpl.html` and measured the same way as Appendix B.

### C.1 The hand wheel and the thumb lane (phone)

**The brief, in the user's words:**
> "Display the playables rail as a wheel that goes off the bottom of the screen, the 'top' card is the target - the lower rectangle in the center of the screen is the most unbiased region of the phone for someone lefty or righty playing with 1 hand to hit. They can easily swipe through that center bottom rectangle. The center lower rectangular region should also be the default for the user to answer prompts. The user should rarely be asked to move their thumb from that bottom half center vertical rectangular region. The card in the top of the wheel can then be significantly magnified. The player can also have the satisfaction of fidget spinning through the wheel while they think of their play."

**The thumb lane** is the band from x 96 to x 297 at 393 wide: the middle 51% of the screen, from the wheel's top to the bottom edge. A left or a right thumb reaches it equally. Everything a turn needs sits in it:
- the **top card** of the wheel, the only card a tap commits;
- its **verb** (`TAP · PLAY · COST 2`, `TAP · BLOCK ⛨3`, `TAP · LOOK`), read from the state the same way the actbar's labels are;
- the **hub**, a 212x54 half-disc on the bottom edge holding the primary button (PASS, END TURN, TAKE 6). It is the old actbar's primary, moved under the thumb.

Two things sit outside the lane on purpose, because a thumb should not hit them by accident: resources and the action point (bottom left, read-only) and the secondary button (bottom right, LOG in the replay; Cancel in the game).

**The wheel.**

| | value | why |
|---|---|---|
| radius | 260 px, centre 348 px below the wheel's top edge | the arc leaves through the bottom corners, so the wheel reads as larger than the screen |
| spacing | 24° per card | the top card's two neighbours stay readable; the next ones fade to 0.4 and leave the screen |
| top card | 80x112 scaled 1.5, outlined in yellow | "significantly magnified": cost, pitch and printed defence are legible without the peek |
| spin | drag moves the wheel 1:1 along the arc; release coasts with friction and snaps to a card in 220 ms | the fidget spin |
| tap the top card | commits (in the replay, it opens the large peek and says so) | one card is ever the target, so there is no peek-then-commit step for the top card |
| tap any other card | spins it to the top | the second tap commits; the same two-tap rule as today, said with motion instead of a dock |
| a declared defender | stays on the wheel, outlined in steel and marked ⛨ WALL | it is still a uid in the hand (v5.04), and a player looks for it there |
| the same card | stays on top across a state change while it is still in hand | the wheel never jumps under a thinking thumb |

**Prompts answer in the lane, and that is a rule for increment 3, not a nice-to-have.** Every prompt variant maps onto the two controls the lane already has:
- `pick`, `target`, `modal`: the candidates, targets or modes load onto the wheel and the hub confirms the top one. `promptReady` decides when the hub lights, exactly as it decides Confirm today.
- `pay`, `soak`: the hub is PAY N; a downward swipe on the hub is Decline. The sheet's text sits above the wheel, where the verb sits now.
- `opt`, `alloc`: the cards load onto the wheel, a tap on the top card toggles it into the bottom (opt) or places one counter (alloc), and the hub confirms.
  - **Opt also has an ORDER** (added 2026-10-25, from a user report on v5.40). The ruling says the kept cards go back on top "in any order", and today's sheet cannot order them (QUEUE S12). On the wheel, the order the kept cards sit in IS the draw order, clockwise from the top. A drag that carries the top card past its neighbour swaps them. The verb strip reads `1ST DRAW` / `BOTTOM` for the top card.
- `reveal`: the revealed cards load onto the wheel and the hub reads OK.

So `PromptSheet` becomes a second **source** for the wheel rather than a second surface, and the thumb leaves the lane only to read the strips above it.

**What the geometry cost.** The stage gives up 86 px (419 to 333) and the peek moves up to sit above the wheel (bottom 296). The ring card, the swing line, the projection and the caption all still fit; the box check below holds them to it.

**Measured** (the prototype, all 143 rows, at 393x852 and 360x740):
- no overlap between the top card, the verb, the index, the hub and the corner controls, and none between any two named parts of the stage;
- no text under 11 px, the hub is 54 px tall, and there is no horizontal scroll;
- the check bites: the first geometry (centre 360, top scale 1.6) hid the verb under the top card in 122 of 143 rows;
- the fidelity check (C.3) holds the wheel to the viewer's hand, in hand order, on every row.

### C.2 The overhead playmat (broadcast)

**The brief:** "make the actual view of the field look more like the YouTube screenshot … I'd like to see the cards arranged in the classic broadcast over table angle", with "no major revision" to the rest of the view. The reference was the Calling finals feed: a landscape playmat shot from overhead, split down the middle, each half laid out like a real mat.

**The mat** is 592x294 in the middle of the 960x540 canvas, a dark felt with a centre line and the wordmark printed faintly down it. Each half is the same four columns, mirrored, so a viewer who learns one side has learned both:

| column | top | middle | bottom |
|---|---|---|---|
| A, the outer edge | graveyard (a pile with its count) | deck (back, with its count) | pitch zone (the pitched cards fanned, labelled with floating resources) |
| B | arms | weapon | legs |
| C | head | **hero** (larger) | chest |
| D | second weapon or off-hand | arsenal (face down unless it was turned up) | |
| arena | tokens, auras, allies and items, stacked beside the centre line, newest last, then `+N` | | |

- **A piece's slot is read off its printed type line**, never off a list of names: `Equipment - Head` goes to HEAD, any `Weapon` or `Off-Hand` to a weapon slot. A slot holding more than one piece stacks the rest, offset, so nothing on the mat is ever hidden.
- **The combat chain lives on the centre line**: the open link's card enlarged with its power stamp, earlier links as small cards with their damage above it, and the declared wall below it, outlined in steel.
- **Kept as they were:** the HUD, the hole cam, the now-resolving card, the strike equation, the lower third and the spine.

**Measured** (all 143 rows, at 1280x900 and 820x1180):
- no overlap between any two slots, labels, the arena column or the chain parts, or between the mat and the parts around it. The first pass found one: the strike equation sat 2 px over the mat's bottom edge in 88 rows, so the mat is 294 tall rather than 300;
- no text under 11 px;
- the fidelity check (C.3) holds every zone on the mat to the recording.

**Limitations, stated rather than hidden.**
- The recording keeps the graveyard as a **count**, so the mat shows a pile and not its top card. The game has the cards, and the built mat should show the top one.
- **No deck in this recording carries two weapons**, so the stacking rule is never reached by the real game. It was checked on a synthetic recording with three weapons on one seat: all three shown.
- The reference shows **player cams** beside the mat. A replay has no video, so the hole cam column is where an OBS layout would put them.

### C.3 The fidelity check, updated

The Appendix B fidelity check, rewritten for the new structure, reads the page's DOM on every row, at all three presets, and compares it to the recording: **48,533 checks, 0 mismatches.** For the mat it asks that the grave and deck counts are right, the pitch fan is the pitch zone, every gear piece is shown exactly once and in its printed slot, the arsenal is face down unless it was turned up, the arena is the board, and the hero has art. **It bites:** a mat that drops the arms slot fails 447 checks.
