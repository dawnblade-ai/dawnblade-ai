# ROADMAP — the new precons

Written 2026-11-15 by the CEO thread, at v6.36, on the user's request ("several new decks
have released … make a plan to add all the new decks"). **This is a plan. Nothing here is
built, and nothing in it ships before the two rulings in "Needs the user" are given.**

Every number below was measured on 2026-11-15. Re-derive before trusting:
`node tools/newdecks-census.js --refresh`.

## What has released, and what can be built

| deck | set | street | list | card text |
|---|---|---|---|---|
| Prism, Advent of Thrones | SAT | 2026-09-18 | pinned in `data/newsets.json` | upstream branch `usurp-the-shadow-throne`: every row resolves, with its printing |
| Viserai, Between Worlds | SBW | 2026-09-18 | pinned in `data/newsets.json` | same branch: every row resolves |
| Mortimer, Living Virus | SLV | announced 2027-02 (Outbreak) | none | upstream branch `outbreak`: 4 cards only |
| α-01, First Cogwarden | SFC | announced 2027-02 (Outbreak) | none | upstream branch `outbreak`: the hero only |

- **The blocker recorded since v4.32 has moved.** `develop` (the branch this project pins
  from) still lists fifteen Silver Age sets. But the-fab-cube now carries both September
  sets, complete, on an unmerged feature branch. `test/drift.test.js` watches `develop`
  only, so it has not fired.
- **The Outbreak pair is not buildable**: no deck lists exist and the text is a handful of
  spoilers. They stay a probe, as the September pair was.
- **No environment change is needed today.** `raw.githubusercontent.com` (card text) and
  `rules.fabtcg.com` (the CR, whose keyword section already defines Usurp, Traverse, Awaken,
  Phantasm, Spectra, Ward, Spellvoid, Blood Debt) are both reachable. `fabrary.net`, where
  the September lists were read, is blocked: it will be needed when the Outbreak lists
  publish, and that is the day to ask for it.

## How far each deck is from playable

`fxParse` over each list, against the branch text (rows by tier; a "full" row can still
hide a keyword with no reader, so read this as a floor on the work, not a ceiling):

- **Viserai, Between Worlds** — 12 full / 14 part / 9 none; 19 names not in the pool.
  Missing readers, in build order:
  1. play a card from the banished zone ("You may play this from your banished zone")
  2. Blood Debt (end-phase life loss while it sits in banish)
  3. Usurp (in the keyword section of the rules: an additional cost that destroys a Runechant, +2 power, and the
     "usurped" fact other cards ask about)
  4. "banish the top card of your deck / if it's red|blue" and "banish a card from your
     hand / if it's Runeblade|Shadow" conditionals
  5. the Gate to i'Arathael token and its grant
  6. the special Runechants ("counts as a Runechant", "when an attack usurps this")
  7. the hero: a trigger on creating Runechants, a per-turn count, and **traverse** — the
     hero is double-faced (Viserai, Usurper on the back, a Demon with its own text), which
     no hero in the pool is today
  8. the small conditionals (attacked twice this turn, dealt damage this turn, played from
     banish this turn)
- **Prism, Advent of Thrones** — 21 full / 4 part / 7 none; 17 names not in the pool.
  Missing readers: the **soul** (a new zone: `sides.js`, `invariants.js` census, `view.js`
  visibility), Herald-named triggers, figments and **Awaken** (double-faced cards in the
  arena), auras that are weapons during the action phase, Phantasm, Spectra, Ward,
  Spellvoid, "loses and can't gain", power reductions while defending, marked.

Viserai goes first: he reuses the Runechant machinery the pool already has, and his
banish and double-face work is smaller than Prism's new zone.

## The phases (one reader per release, as always)

**Phase 0 — rulings.** See "Needs the user". Record them in `data/formats.json`,
`test/formats.test.js` and CLAUDE.md's format paragraph.

**Phase 1 — pin the text (one release, nothing a player can see).**
- `tools/pin-pool.js` learns a second source for named sets (the feature branch), so the
  fifteen keep coming from `develop` untouched. Pin both lists' records, both faces.
- `test/newsets.test.js` turns from "absent" to "pinned, not decked"; `drift.test.js`
  compares the pinned branch text with `develop` the day upstream merges, so a wording
  change between the branch and the merge is caught, not played.
- `DATA_VER` bump, function redeploy, the usual release steps.

**Phase 2 — Viserai, Between Worlds.** The eight readers above, each its own release with
a drill that bites, a scene, fairness, and a CR quote in the source. The hero stays out of
the loadout until the census prints no gap for his list and 630 self-play games with him
seated show 0 refusals, 0 violations, 0 stalls. Then: `DECKS`/`HEROES` entry, art path,
the AI seat's policy keys (measured per CLAUDE.md), and the release that opens him.

**Phase 3 — Prism, Advent of Thrones.** Same shape; the soul zone first, because every
other Prism reader stands on it.

**Phase 4 — Outbreak (2027-02).** When the lists publish: ask for `fabrary.net`, pin the
lists into `data/newsets.json`, run the census, extend this file.

## Needs the user

1. **The format.** Dawnblade was declared FROZEN at fifteen (2026-09-26). Adding decks
   changes that declaration. Proposed wording: "the pool is every Silver Age precon this
   project has built, as printed; it still ignores Silver Age's ban list and hero bench."
   Two Viserais would both be legal heroes.
2. **The source.** Pin the September text from upstream's unmerged branch now (recommended:
   the text is the printed cards', and the drift drill will catch any change at the merge),
   or wait for the merge into `develop` (no date known; it has been two months).

## What this plan does not promise

Dates. The fifteen took the engine from v1 to v6; each reader above is a release. Viserai
is roughly eight to twelve releases, Prism more.
