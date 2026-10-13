# FIX QUEUE — triaged by the CEO thread (v1, from v5.08)

Sources: `origin/findings/feed-a`, `feed-b`, `feed-c` (FINDINGS-*.md, with repro scripts).
Still running: feed-d (kayo, lyath, viserai), review-a (v4.95–v5.00), review-b (v5.01–v5.08).
Their items will be APPENDED here as v2; re-read this file at every `git fetch`.

**Rules for the shipper:** one item per release, top to bottom. Re-verify each item yourself
before fixing. If it does not reproduce, skip it and say so in your release summary. Every
"CEO-verified" item below was re-driven in the CEO thread and reproduced. Measure the blast
radius (pool census) before widening any reader, and drive a fixture that bites.

## STATE DEFECTS — in order

1. **A played attack reaction's go again is the TARGET's, not its controller's** — CEO-verified.
   Stains of the Redback ×3 and Run Through ×3 grant go again to their target AND bank an
   instant's "+1 action point" for the player who played them (`ap 1 -> 2` on play; arakni v
   viserai seed `ar3`, first 1). That is a free action point and steals games. v3.74 fixed
   this for ABILITIES (`_attackRx`); a played AR card falls through to `fx.ga`.
   Sites: `engine/effects.js:~3635` (the ga chain), `~5437` (the AP arithmetic). Census the
   pool's attack reactions that carry `fx.ga`: does any print a go again of its OWN?
   Repro: FINDINGS-feed-a.md §1. Direction: stronger.

2. **Dash's starting item enters with no counters and no clock** — CEO-verified.
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

## NEEDS A RULING FROM THE USER (do not build)

- **Mark never expires.** Nothing clears `marked` once it is set (`sides.js:171` is the only
  `false`), so Arakni's Agents and Black Widow / Funnel Web riders keep reading it for the
  rest of the game. The repo has no sourced rule for when a mark ends. Ask the user.
