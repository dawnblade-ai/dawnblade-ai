# FIX QUEUE — triaged by the CEO thread (v2; v1 from v5.08, v2 at v5.13)

Sources: `origin/findings/feed-a`, `feed-b`, `feed-c` (FINDINGS-*.md, with repro scripts).
v2 adds `feed-d`, `review-a` and `review-b`. **All six audits are in; this is the complete queue.**
**Work the ORDER below ("THE ORDER — v2"); it supersedes v1's numbering.**

**Rules for the shipper:** one item per release, top to bottom. Re-verify each item yourself
before fixing. If it does not reproduce, skip it and say so in your release summary. Every
"CEO-verified" item below was re-driven in the CEO thread and reproduced. Measure the blast
radius (pool census) before widening any reader, and drive a fixture that bites.

## THE ORDER — v2 (work this list; numbers in brackets point at the item text)

Done: [1] v5.12, [2] v5.13. Also shipped from the trigger-order measurement: v5.09, v5.10,
v5.11. **Order items 1–7 are SHIPPED** as v5.14 (N1), v5.15 (N2), v5.16 ([3]), v5.17 ([4]),
v5.18 ([5]), v5.19 (N3) and v5.20 ([6]). The CEO verified v5.20: 3541 tests, 0 fail, 5 skipped,
fairness clean, scenes 107/107, every script tag present in the pushed commit.
**NEXT: item 8.**

1. **[N1] A declared defender's "Discard this" hand ability is legal and pulls it out of
   the wall.** Sev-3, both boards. CEO-verified on v5.13.
2. **[N2] The trainer's aura-attack door has no action-point gate.** Waxing Specter swings
   at 0 AP and leaves `ap: -1`. Sev-3, trainer only.
3. [3] Tokens in graveyards.
4. [4] Mark of the Huntsman paid with a card that's already gone.
5. [5] Late go again dropped at the table.
6. **[N3] Malefic Incantation's Runechant is made AFTER the "played or created an aura
   this turn" gate is read.** CEO-verified on v5.13.
7. [6] Run Through's "your next sword attack" rider.
8. [7] A played defense reaction is in the wall but not in the counts. Fold in **[N4]**
   and **[N5]**.
9. **[R1] THE MARK RULING (user, 2026-10-14) — build next, after item 8.** See "R1" below.
9b. [8] Shred is legal with nothing to target.
10. **[N6] `playTargetWhy` treats an untargeted `ctrPut` as targeted.** It refuses Uphold
    Tradition's flip on the trainer. This is the other half of v1's rejection note.
11. [9] Look Tuff's "unless you pay" tests floating resources only.
12. **[N7] Murkmire Grapnel's "can't be prevented" does nothing.** Verify first.
13. [10] Counters on an attacking aura after declaration.
14. FEED BATCH: [11]–[18] plus **[N8]–[N11]**. One or two releases.
15. [19] Record the Compass hidden-information leak; [N12] doc fix rides with any release.

## v2 ITEMS

**N1. A declared defender's "Discard this" hand ability is legal, and it pulls the card out
of the wall.** Source: review-b §1. CEO-verified on v5.13: `legal: null`, then the card is in
the graveyard while `blockH` still lists it, and amp is 1.
- v5.04 censused the hand readers and missed this door. `handAbilityOK`
  (`effects.js:~9494`) checks `handFree` for a "Discard a card" cost, but never asks
  `P.isDeclaredDefender` for a `cost:"self"` ability.
- So the seat blocks, sees the attack, withdraws the 3{d} for value (Arcane Twining amp 1,
  Agile Windup's Agility, Reaper's Call's mark), and the damage step skips the missing card.
- Rally the Coast Guard's "Discard a card", gated "while defending", must stay legal.
- Add the door to `test/defenderzone.test.js`'s census. Both boards: `judge.js:~1091` and
  the trainer's `activateHand`.

**N2. The trainer's aura-attack door has no action-point gate.** Source: review-b §2.
- The trainer's only AP gate is `costsAP(card) && act(s).ap<1`, which reads the AURA's own
  type line. Waxing Specter is a Mystic Illusionist **Instant** - Aura, but Cosmo's grant
  is an **Action** ("Once per Turn Action - {r}: Attack").
- So at 0 AP she swings, and `linkPayload` charges the point she doesn't have
  (`NEGATIVE-AP`, CR 4.4.3e).
- The table refuses it ("no action point left"). Refuse on `ap < 1` in the aura block, and
  the ally block for symmetry, whatever the card's own type. `index.html:~3977`, `~4207`.
- Repro: review-b §2.

**N3. Malefic Incantation's Runechant is created after the aura-turn gate is read.** Source:
feed-d §1. CEO-verified on v5.13 (viserai v dash, seed `d11`, first 1).
- Feed: "Runerager Swarm: condition not met (no aura played or created this turn)", then
  Malefic's verse comes off, then "+1 Runechant".
- `auraTurn` is evaluated in the condition loop (`effects.js:~4027`), and
  `ctrClock(n, "atkPlay")` fires Malefic afterwards (`~4617`).
- Runerager Swarm loses its go again; Hit the High Notes loses +2 and Shrill of Skullform
  +3. The next card that turn does see it.
- CR 7.2-style reasoning (a "when you play" trigger resolves above the card) says the
  Runechant exists before the attack resolves. So either fire the play clock before the
  loop, or settle `auraTurn` late like `pumped`.
- Measure which "when you play an attack action card" creators exist (the Runechant pop
  site at v2.23 is the precedent) and drive both orders. Repro: feed-d §1.

**N4. (with [7]) The trainer's defence-reaction doors count `handDefenders` off the wrong
structure.** Source: review-a F2.
- `playRx` and `playRxA` (`index.html:~3438`, `~3492`) pass
  `s.stack.filter(l=>l.k==="def"&&l.gi==null)`. Those are the DUMMY's defenders on the
  PLAYER's attack.
- In the defence window the player's declared hand defenders are `you(s).blockH`, which is
  what the trainer's own wall and judge's wall use.
- Latent today: only the Unity line emits `withHandDefender`, and both Unity records are
  equipment. Fix it while you are in [7].

**N5. (with [7]) `playAtSpeed`'s `handBlockers` forward is load-bearing and undrilled.**
Source: review-a F1.
- Sabotaging `handBlockers: o.handBlockers || 0` to `0` was SILENT on the full suite, yet it
  is the only way the trainer's reaction doors feed reprise (Ironsong Response +3 vs +0).
- Add the both-halves drill.

**N6. `playTargetWhy` treats every `ctrPut` as targeted.** Source: review-b §3.
- Uphold Tradition prints "Put a +1{p} counter on **an** aura you control with ward". That is
  untargeted, and the flip itself turns its Ward 1 on (ruling 2026-10-04).
- But the trainer's `tryPlay` (`index.html:~4050`) asks `playTargetWhy` for powCards too, and
  with no ward aura it refuses ("nothing it can target"). The table allows it, and so does the
  trainer on the opponent's turn: the trainer disagrees with itself.
- Re-Charge! prints the same untargeted shape and escapes only through its `buffNext`.
- Mark `ctrPut` targeted off the printed word "target", and keep the census of
  `playTargetWhy`'s claimants (review-b lists them) both directions.

**N7. Murkmire Grapnel's "can't be prevented" sets `n._unpreventable`, which nothing reads.**
Source: review-b, noted out of scope. Verify it first. If it is real, the damage is
preventable against its printed text (weaker). Drive it against a ward and a one-event shield.

FEED (add to the batch):
- **N8.** "N unspent 'this turn' grants expire". `preventDamage` never decrements `wardTurn`,
  so a fully spent Oasis Respite still counts. `held` sums `buffNext` as a NUMBER, so one +6
  grant prints "6 grants". `effects.js:~10298-10345`. (feed-d §3)
- **N9.** Lyath's boo line `effects.js:~2674`: "The crowd boos you — Reviled, and your Bravo
  cards know it." It is hard-coded second person in a shared feed, and **no pool card prints
  "Bravo"** (CEO grep), so the second half is false. Name the seat with `sv`, and check the
  45-literal ledger moves. (feed-d §4)
- **N10.** Pouncing Paws: "crouching tiger springs into your banished zone". Lowercase card
  name, and a hand-rolled "your" (use `sp`). (feed-d, out-of-scope note)
- **N11.** Wax On: "Wax On answers at instant speed — +3 defence" prints the card's own
  defence as if it were a bonus. Also the noop reason "Pouncing Paws — ability: playable this
  turn — the flag is set when the card is created" joins [12]. (feed-d notes)

DOC:
- **N12.** CLAUDE.md still tells readers to widen `parser.pumpRead` (deleted at v5.02), at
  ~line 7013 ("ADD IT TO BOTH LISTS — `parser.pumpRead` and `fairness.PUMP_OPS`") and ~483
  ("The fallback's existing magnitude test is what suppresses it"). Correct both in the next
  release's CLAUDE.md edit. (review-b §4)

INFORMATIONAL (no action): review-a F3 (the trainer's CR 7.3.2b refusal can't fire, because
its opponent's turn is one link) and F4 (`needEmpty`/`arsFree` coincide while `arsCap` is
always 1). Both are measured and stated; don't build anything for them.

## STATE DEFECTS — v1 item text (numbers referenced above)

1. ~~SHIPPED v5.12~~ **A played attack reaction's go again is the TARGET's, not its controller's** — CEO-verified.
   Stains of the Redback ×3 and Run Through ×3 grant go again to their target AND bank an
   instant's "+1 action point" for the player who played them (`ap 1 -> 2` on play; arakni v
   viserai seed `ar3`, first 1). That is a free action point and steals games. v3.74 fixed
   this for ABILITIES (`_attackRx`); a played AR card falls through to `fx.ga`.
   Sites: `engine/effects.js:~3635` (the ga chain), `~5437` (the AP arithmetic). Census the
   pool's attack reactions that carry `fx.ga`: does any print a go again of its OWN?
   Repro: FINDINGS-feed-a.md §1. Direction: stronger.

2. ~~SHIPPED v5.13~~ **Dash's starting item enters with no counters and no clock** — CEO-verified.
   `build.js:~829` places the item as a bare entry: Hyper Driver has no steam counters (a
   boost yields no {r}), and Boom Grenade has no steam counter and no `sd` stamp, so its
   printed "destroy this unless you remove a steam counter" never runs (3 start sweeps, still
   on the board). Route the placement through the same enters-the-arena body `execute` uses
   (`effects.js:~5315/5330`). Whether crank is offered at game start is a separate RULING:
   record it, don't guess it. Repro: FINDINGS-feed-b.md §3 (C hd.js, D bg.js).
   Direction: Grenade stronger, Driver weaker.

3. **Tokens reach graveyards (a token that leaves the arena ceases to exist)** — CEO-verified.
   End of enigma v lyath (seed s3, first 1): Lyath's graveyard holds 12 Might tokens. Pass
   Over then offers a token as a legal banish target. Ephemeral already has a "ceases to
   exist" path (`parser.isEphemeral`, `gy()`/`toGrave`); a token should share it. Census
   every writer into a graveyard and every reader that counts or picks from one, and consider
   an invariant (a token in a graveyard is an error). Repro: FINDINGS-feed-b.md §7 (H tokg.js).

4. **Mark of the Huntsman's "destroy this and mark them" is paid with a card that's already
   gone** — CEO-verified. Danger Digits' jab makes the dagger hit and its last sentence
   destroys it; the queued pay sheet then carries `destroyUid` for a card in the graveyard.
   Accepting destroys nothing (`gear.find` misses silently at `effects.js:~5948`), the mark
   still lands, and the feed claims "destroyed Mark of the Huntsman". Rule: an unpayable cost
   is inert, never free (v2.04). At minimum, refuse at answer time (the rider must not
   resolve) and lapse the sheet as declined, with a true feed line. Repro:
   FINDINGS-feed-a.md §3 (a3.js). Direction: stronger when accepted.

5. **A late go again is dropped at the table** — CEO-verified. Pulping and Bolt'n' Shot
   ("defended by fewer than 2 non-equipment cards" / "pumped") get `pend.ga = true` in
   `linkPumps`, but `judge.strike` rebuilds `pend` from the pre-pump `link`
   (`judge.js:~2200`), so the point never arrives (1 declared blocker → ap 0, want 1).
   `_struck` is dropped by the same line. Repro: FINDINGS-feed-b.md §1 (A pulp.js).
   Direction: weaker, CR-exact board only.

6. **Run Through's "your NEXT sword attack this turn gets +N{p}" pumps the attack it targets**
   — CEO-verified (rx layer pump 2, `buffQ` empty). That attack is already on the chain, so
   "next" is a later sword attack (Dorinthea's hero hands her one). Read it as a
   sword-qualified `buffQ` grant. Census the attack reactions printing "your next … attack"
   so the v3.11 "a reaction pumps the attack it's played on" rule keeps every card it was
   right for. Repro: FINDINGS-feed-b.md §4 (E rt.js).

7. **A played defense reaction is in the wall but not in the "defended by / with" counts** —
   reader-verified, not re-run here. Reprise ("defended with a card from their hand") and
   defLt2/defLt2any count `blockH`/`blockG` and never `blockRx`, while the wall already adds
   its defence. A resolved defense reaction is a defending card, so it should count, with
   timing as played. Sites: `judge.js:~2275` (`declaredWall`), `strike`'s `handBlockers`
   (`~2034–2129`), and the trainer's equivalents. Repro: FINDINGS-feed-b.md §2 (B rep.js).

8. **Shred is legal with nothing to target** — reader-verified. `rxNoTargetWhy` reads
   `modes`/`selfQ`/`gaQ`, and `fx.defDebuff` is a FOURTH home of a target qualifier, so Shred
   is played and spent with an empty wall or against a non-Assassin attack. This is the v4.88
   lesson again. Repro: FINDINGS-feed-a.md §2.

9. **Look Tuff's "unless you pay {r}" tests floating resources only** — reader-verified.
   "Look Tuff: can't pay 1" prints while the hand holds pitchable cards (pitch-on-demand
   ruling, 2026-08-01). Offer the payment the way the shared pay sheet does, and census the
   other self "unless you pay" clauses. Site: `effects.js:~4423`. Repro: FINDINGS-feed-c.md §1.

10. **+1{p} counters put on an attacking aura after declaration never reach the attack** —
    reader-verified, MEDIUM rules reading. Astral Etchings (instant speed with a Spectral
    Shield) on a Cosmo-armed attacking aura: the counters land and `pend.total` is unchanged.
    `powCtr` is read once at declaration (`effects.js:~4502`). Find a sourced CR quote in the
    repo about an attack-proxy's power following its source before building; if there isn't
    one, record it in `tools/approx.js` as stated and move on. Repro: FINDINGS-feed-b.md §5.

## FEED TEXT — batch into one or two releases

11. Pick result lines print raw state keys: `Swift Shot → deckTop from grave.` (also the
    sheet hint `From your grave → deckTop`). Use `promptZoneWord` and a destination word.
    `prompts.js:~1167`, `~492`. (feed-a §4)
12. Noop reasons leak engine voice into the feed: `off fx.noDrx`, `cost read by the weapon
    reader` (every swing), `activation gate — checked before the ability can be used`. Reword
    them, and widen `test/noopvoice.test.js` to ban dotted `fx.` fields and "reader".
    `parser.js:~3776, ~721, ~3672, ~3146`. (feed-a §7, feed-b §8a)
13. Payment-averts lines: `Kayo paid 1 — the rider resolves.` for Winter's Bite / Cold Snap,
    where the payment PREVENTS the consequence (`ops: []`, `elseOps`). `prompts.js:~1268`.
    (feed-c §2)
14. v5.06 leftover: `Throw Caution to the Wind: 1 of that damage is prevented — the other 2
    goes with this hit.` The unused points are lost with the event. `effects.js:~839`.
    (feed-c §3)
15. False skip line on discard6way cards: `Bare Fangs: no additional-cost discard to feed —
    bonus skips.` while the bonus lands (6 → 8). `effects.js:~4636`. (feed-c §4)
16. Start-phase trigger lines print BEFORE `— X's turn N —`, so they read as the previous end
    phase. Say the header first. `judge.js:~3647` vs `~3612–3640`; check the trainer too.
    (feed-a §5)
17. Waxing Specter's enters-clause condition is evaluated when it ATTACKS as a Cosmo weapon:
    `condition not met (no blue card in Enigma's pitch zone)` on every swing. State is
    unaffected; the line is noise. (feed-b §8b)
18. Equipment "Destroy this:" abilities print the effect, then `The piece shatters — cost
    paid.` The piece is only marked destroyed after `runOps`, so it is live during its own
    effect (latent state). Pay the cost first. `effects.js:~5244`. (feed-a §6)

## RECORD, DON'T BUILD

19. Compass of Sunken Depths "looks at" the top card and the shared table feed NAMES it to
    both seats. This is a hidden-information leak at the table, by recorded design
    (`parser.js:~3113`). Record it in `tools/approx.js` (table board) with a probe. A per-seat
    feed is a UI decision. (feed-c §5)

## REJECTED

- feed-b §6, Uphold Tradition activated with no aura: its line is "Put a +1{p} counter on an
  aura you control with ward" — NOT targeted — and the flip itself turns its Ward 1 on. The
  activation is legal and not a paid no-op.

## R1 — THE MARK RULING (user, 2026-10-14)

> "Marks wear off when the hero is hit by an opponent's attack or an effect but otherwise
> sticks around — I'd say even if a hero transforms the mark will stay on!"

Record it verbatim, with the date, wherever rulings are recorded (`tools/rulings.json`, and
`tools/approx.js` if a stated record is affected). Nothing clears `marked` today; `sides.js`
is the only place it is ever `false`. Build it this way:

- **Cleared by a HIT from an opponent's attack.** CR 7.5.5: damage actually dealt. A swing
  blocked to nothing or fully prevented is not a hit and does not clear. A hit on an ally does
  not clear the hero's mark.
- **The hit fiction counts.** Danger Digits' "the dagger has hit" is a hit by definition.
- **Order inside the hit.** Snapshot marked-ness AT the hit, then clear it, then resolve the
  on-hit triggers.
  - "When this hits a MARKED hero" (Mark of the Black Widow, Mark of the Funnel Web) must
    still fire off the snapshot.
  - "When this hits a hero, mark them" (Mark the Prey, Scar Tissue, Two Sides, Hot on Their
    Heels, Mark of the Huntsman) re-marks AFTER the clear, so the hero ends that hit marked.
  - Drill both: a two-case drill can't tell clear-then-trigger from trigger-then-clear.
- **Persists through transformation.** Arakni becoming an Agent, and returning to the brood,
  changes nothing about anyone's mark. Pin it with a drill.
- **"Or an effect" — ANSWERED (user, 2026-10-14): "the effect would specifically need to
  remove a mark."** Non-attack damage (arcane, a Runechant) does NOT clear a mark. Only an
  effect whose text says to remove the mark does, and over the pinned pool NO card prints one,
  so there is nothing to build for that half. Record both quotes verbatim. Pin the premise as a
  drill: a census proving no pool record removes a mark, so the day one arrives it is a
  decision rather than a silent no-op. No `stated` record is needed.
- **Measure the ladder on both sides.** Arakni's whole deck reads marks (Agents,
  Black Widow, Funnel Web, Stains' discount, Graphene Chelicera), so expect her to move.
  Report it, and don't retune the policy inside the rules fix.

## NEEDS A RULING FROM THE USER (do not build)

- ~~**Mark never expires.**~~ **RULED 2026-10-14, see R1.** Original note: Nothing clears `marked` once it is set (`sides.js:171` is the only
  `false`), so Arakni's Agents and Black Widow / Funnel Web riders keep reading it for the
  rest of the game. The repo has no sourced rule for when a mark ends. Ask the user.
