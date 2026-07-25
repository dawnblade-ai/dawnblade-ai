# Handoff — build the prompt machinery

Paste everything below the line into a fresh Claude Code thread in this repo.

---

## The job

Build the **prompt sheet variants** that Dawnblade's recorded rulings are waiting on.
This is the single highest-leverage piece of work left in the project: **26 of the 84
rulings in `tools/rulings.json` explicitly describe a popup**, and none of them can be
built without it. It is also the chokepoint for multiplayer, because in a two-player
game a prompt has to be able to target the *other* player.

**Read `CLAUDE.md` first, in full.** It carries the hard constraints, the golden rule,
the validation workflow, and an honest list of known approximations. Do not skip it —
several rules there exist because breaking them has already cost real bugs.

## Where things stand (v2.13)

- Pool: **405 unique cards** (name|pitch) across 15 decks · **258 fully scripted /
  112 partial / 35 unread**
- `npm test` → **154 drills, all passing**. Never leave them red.
- The stack is down to **35 open entries** (`npm run stack`). Most of what remains is
  in the list below.
- `tools/rulings.json` holds **84 human rulings**. Each is a *spec*. Treat them as the
  source of truth for behaviour and do not re-litigate them.

## What already exists — build on it, don't replace it

There is a working, single prompt component. `opt` uses it end to end:

- **`n.promptQ`** — effects *queue* a prompt: `n.promptQ = [...(n.promptQ||[]), {tag:"opt", …}]`
- **`openPrompt(s)`** — drains the head of the queue into `n.prompt`
- **`promptToggle(i)` / `promptConfirm()`** — the interaction and resolution
- **`.psheet`** CSS — a bottom sheet docked above the action bar, deliberately *not*
  a full-screen modal, because the rulings ask for the hand to stay visible
- Drained at the tail of `execute` and `resolveStack` via `openPrompt(winCheck(n))`

**The queueing is load-bearing.** Effects must never open a prompt inline — the action
has to finish resolving first. Keep that discipline for every new variant.

## The five variants to build

Grouped by shape, with the cards each unlocks. Read each ruling in
`tools/rulings.json` before building its group — they contain specifics
(costs, restrictions, who chooses) that this summary flattens.

**1. Pay-or-decline** — *"you may pay {r}; if you do, …"*
Look Tuff · Brothers in Arms · Staunch Response · Cold Snap · Boom Grenade (crank) ·
Thunder Quake (heave) · Refraction Bolters
→ Must handle: paying from floating resources, falling back to a pitch, and cancelling.
→ This also finally unblocks the **"If you do, …" family** — about 53 unread clauses
   that are *deliberately* unparsed today because running an optional-cost payload for
   free re-introduces the bug v2.04 fixed. See CLAUDE.md.

**2. Pick-a-card from a zone**
Graveyard picks (Crown of Dichotomy, Memorial Ground, Rise from the Ashes, Mournful
Casket) · retrieve (Pick Up the Point, Up Sticks and Run) · reload (Bolt'n' Shot, Take
Aim) · Hope Merchant's Hood · ice fusion (6 cards) · lightning fusion (2) · Arcane Twining
→ Needs: source zone (hand / graveyard / arsenal), a filter predicate, min/max count.

**3. Choose-1 modal** — two printed options, pick one
Pummel · meld (Arcane Seeds // Life, Burn Up // Shock)
→ The parser already strips the leading `- ` from modal option lines.

**4. Target picker** — *"any target"* means a choice
Photon Splicing · Oasis Respite · Bolt'n Boots
→ Oasis Respite's ruling explicitly asks that targeting yourself be easy and targeting
   the opponent be hard to do by accident.

**5. Reveal / acknowledge** — information both players see
Ravenous Rabble (top-card reveal) · Knucklehead (d6 roll) · Smash Instinct (intimidate's
random pick) · Put in Context (refusal explainer) · Run Roughshod (refusal explainer)
→ Several of these already *work*; they just resolve silently in the log. This variant
   is about surfacing them.

## Hard constraints

- **Everything ships as one `index.html`.** No build step, no modules, no framework CLI.
- **Never invent card effects.** Card text streams from the database and is read by
  `classifyClause` / `fxParse`. If a card does something new, teach the parser to read
  its text — never special-case a card by name.
- **The sync guard is real.** `engine/parser.js` and the copy inside `index.html` must
  stay textually identical. Edit one, mirror the other, or `npm test` fails. Mirroring
  by extracting the function body with a brace-matcher works well.
- **Bump `DATA_VER` if you add anything to `NEEDED`.** A warm localStorage cache will
  not contain newly-required cards otherwise. This has bitten twice.

## Traps that have already cost real bugs

1. **Whole-clause patterns must be declared ABOVE the `if/when/while` handler.** That
   handler splits on the first comma; if the payload half doesn't parse it throws the
   whole clause away. Cost reductions, clash payoffs and Reincarnate were all silently
   invisible for exactly this reason.
2. **A `noop` inner clause is still accounted for** — pass it through rather than
   voiding the clause. `"When this attacks, intimidate."` read as nothing for weeks.
3. **Optional costs must not fire for free.** `Instant - Discard this: Amp 1` used to
   grant Amp 1 on play at no cost. Activated abilities defer to `weaponCost` /
   `parseHeroPower`; keep it that way.
4. **Prefer small asserted edits over regex surgery on `tools/ledger.js`.** A scripted
   regex truncated it once. It can be rebuilt from `AUDIT.md` if that happens again.
5. **Card *images* carry reminder text the database omits.** Reading the printed card
   settled both the clash comparison and Ephemeral without needing to ask. Try that
   before adding a follow-up question.

## Validation loop

```bash
npm test                              # 154 drills — must stay green
npm run audit                         # regenerate AUDIT.md, read the diff
node tools/audit.js --write-baseline  # ONLY after reviewing the tier diff
npm run stack                         # regenerates STACK.md + tools/review.html
```

`test/coverage.test.js` fails if any card's tier regresses below the pinned baseline.
When it fires, **read the diff before re-pinning** — it has caught genuine regressions
*and* correctly flagged cards that were only ever passing by accident. Both happen.

Also verify in the actual game, not just the drills. Open `index.html` in a browser,
start a fight, and drive the feature. Several bugs (clash firing on the wrong trigger,
equipment re-blocking a chain) were only visible in play.

## Build it multiplayer-ready

Per the roadmap, there is **no AI opponent** — the goal is two humans. So:

- A prompt must be able to address **either side**. Cold Snap's ruling has the
  *opponent* choosing whether to pay; intimidate shows the opponent's hand.
- The dummy already has `dHand`, `dDeck`, `dGrave`, `dBoard`, `dMarked`, `dBlockedHand`,
  `dIntimidated`, `chainBlocked`. These are parallel `d*` fields, not a real second side.
- **Don't deepen that split.** If a prompt needs per-side state, prefer shaping it so a
  future `sides[]` collapse is easier, and say so in comments. Roadmap item 1 is exactly
  that migration, and every new per-side feature doubles its cost.

## Definition of done

- Each variant works in a real game, verified by playing it — not only by drills
- New drills in `test/parser.test.js` (or a new test file) covering each variant
- `npm test` green, audit re-pinned after reviewing the diff
- `CLAUDE.md` updated: version bumped, drill count, and any new approximation stated
  honestly in the "Known approximations" section
- `npm run stack` regenerated so `tools/review.html` reflects the new coverage

Start by reading `CLAUDE.md`, then `openPrompt` / `promptConfirm` in `index.html` to
see how `opt` flows, then pick **pay-or-decline** first — it unlocks the most cards and
the "If you do, …" family behind them.
