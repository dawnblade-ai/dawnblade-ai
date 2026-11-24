# babelroom — getting the trainer's babel block well under Babel's 500,000-char limit

Status: DESIGN ONLY. Nothing in index.html is changed on this branch. Waiting for the CEO's go (workers Q and R are editing index.html).

## The problem
`script1` (the second `text/babel` block) is ~499,000 chars on main (it was 498,618 at v6.87; 499,004 after the v6.88 trim). Babel standalone prints
`[BABEL] Note: The code generator has deoptimised the styling ... exceeds the max of 500KB` through console.error above 500,000. On a phone that note is
cosmetic (only the generated code's formatting). But tools/page.js, serverpage.js and every drive built on `open()` treat ANY console.error while loading as a
crash, so every page-touching worker is one paragraph from breaking all page drives. Headroom today: ~1,000 chars.

## Recommendation: split `script1` at two top-level seams (zero code moved)
Insert `</script>\n<script type="text/babel" data-presets="env,react">` at two function boundaries. Nothing is moved, renamed or reordered, so the diff is
two 2-line seams and Q/R's edits merge cleanly (they edit inside functions; a seam is between functions).

| new block | from | to | chars (measured) |
|---|---|---|---|
| script1a | first line of script1 (helpers, `Battle`, `Loadout`, `Pregame`) | before `function SrvLadder` | ~330,900 |
| script1b | `SrvLadder` (server UI: ladder, hands sheet, TableScreen, banner, RankChange, RematchRow, TableRoom, JudgeRoom, TableBoard) | before `function App` | ~157,400 |
| script1c | `App` + `ReactDOM.createRoot(...).render(<App/>)` | end | ~11,300 |

Headroom after: script1a has ~169k (it is the one that holds `Battle`, 232k alone), script1b ~342k, script1c ~489k. The mount line stays in the LAST block,
so every component exists before the first render (this is the one ordering rule: the block holding `createRoot().render` must be last).
If a comment block sits directly above a seam function it goes with that function (the seam goes above the comment).

Why this works: Babel standalone compiles and runs the blocks in document order; top-level `const`/`function` in a script block become globals, which is
exactly how script1 already sees script0 (CLAUDE.md "load-bearing"). I checked the only load-time statements in the moved region
(`REMATCH_WAIT`, `CLAIM_WHY`, `CH_LOBBY/CH_NET`, `TABLE_BUILD = DawnLobby.buildId(window.APP_VER, window.DATA_VER)`): they read only engine globals/`window`, nothing
from a later block; every cross-block use of a component is inside a function body, resolved at render time.

### Prototype (done in scratch, reverted; not on the branch)
I applied exactly those two seams to main's index.html and ran: both-preset `@babel/standalone` compile of all 4 blocks (24,585 / 330,856 / 157,384 / 11,328 chars,
no deopt note); `node --test test/html-balance.test.js test/sync.test.js test/slicecensus.test.js test/shadow.test.js`; `tools/page.js`.
Result: page.js 134 PASS / 0 FAIL, and the only red test was `html-balance` "exactly two text/babel blocks" (expected; listed below). sync, slicecensus and shadow were green unmodified.

## What has to change with it (when approved)
1. `test/html-balance.test.js`: "exactly two blocks" -> exactly four (script0, 1a, 1b, 1c); bracket-balance drill per block (it indexes `babelBlocks(src)[1]` today).
   ADD a size guard so this cannot silently come back: every block <= 450,000 chars (fail text says "move a seam or split again; Babel stops formatting at 500,000
   and tools/page.js crashes on the console note"). Sabotage: pad a block to 450,001 and watch it fail.
2. `test/sync.test.js` reads `trainerSrc = htmlSrc.slice(htmlSrc.indexOf(BABEL))` (from the first block to the end of the file): unchanged, it spans all four blocks. Verified green.
3. `test/slicecensus.test.js`: green in the prototype; a worker's later edit that straddles a seam would show as a moved slice, repin as usual.
4. CLAUDE.md / UI-GUIDE.md layout line: "script0 ... script1 (trainer)" -> "script1 is three consecutive blocks 1a/1b/1c; the one containing the `createRoot` mount must stay last". (CEO owns CLAUDE.md; a one-line edit.)
5. Anything that says "script1" in comments is prose only (grep showed no code reading a block by index except html-balance).

## Risks and how each is covered
- A block that is not self-balanced at its seam: the seams are at column-0 `function` lines between components; html-balance per block catches it.
- A load-time statement in an earlier block using a name from a later one (TDZ/ReferenceError at boot): none today (checked); page.js boots the page and every drive would fail loudly. New rule for workers: top-level statements may only use names from earlier blocks.
- Babel work per block: same total transform work; three smaller compiles. Startup time is unchanged to first order (will check page.js timing rows).
- Merge conflicts with Q/R: only the two seam sites; Q/R should land first or rebase over a 2-line hunk.
- `data-presets="env,react"` must be copied on every new tag (the prototype did).
- Headroom after the split is permanent only if each block stays under the guard: 1a (Battle, the trainer) is the one to watch (~169k left).

## Alternatives considered (and why not first)
- Move pure non-JSX helpers out to engine/ modules (no-mirror rule applies): the right long-term shape but per-function surgery, `test/sync.test.js` bridge entries,
  and each helper needs a drill. Buys ~100–115k from script0-sized helpers; larger risk, slower. Good second step if 1a ever fills.
- Strip comments / shrink prose in place: buys ~1–5k per pass, and every pass costs slicecensus repins (v6.88 had to). Not lasting.
- A Babel option (compact) cannot be set from a script tag, so the deopt note cannot be silenced from index.html.
- Pre-compile (build step): forbidden by CLAUDE.md.
