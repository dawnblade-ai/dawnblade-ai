# Dawnblade

A rules-accurate **Flesh and Blood** sparring simulator that runs in a browser
tab. Pilot a real Silver Age hero deck against a training dummy, or sit down at
a table and play a second person over a room code.

**▶ Play: <https://dawnblade-ai.github.io/dawnblade-ai/>**

---

## What it is

Dawnblade is built for a phone. Three flick screens — the opponent's board, the
combat chain, your board — with real card art, the printed rules text, and a
combat procedure that follows the Comprehensive Rules rather than an
approximation of it: attack → defend → reaction → damage → resolution, with
priority passing where the CR says it passes.

- **15 official Silver Age precons**, all 55 cards, resolved live from the
  public Flesh and Blood card database. No card effect is ever hardcoded — the
  parser reads the printed text, and when a card does something new the fix is
  to teach the parser, never to special-case the card.
- **Solo trainer** against a dummy that blocks with printed defence, holds a
  real hand, and never fakes anything its cards do not say.
- **Two-player tables** — one player opens a table, reads out a four-character
  code, the other types it in. Hero select, a rock-paper-scissors throw for
  seating, sideboarding, then a real game. No accounts, no server: the two
  browsers talk directly over WebRTC.
- **JUDGE!!** — a button that captures the whole board, both hands, every
  counter, the chain, the feed and the RNG replay key into one JSON report, so
  a bug report can be one line.

## No build step. Ever.

`index.html` plus plain UMD scripts in `engine/`. No bundler, no modules, no
build script, no CLI. React and Babel come from a CDN. GitHub Pages serves the
repository root as-is, and the whole thing runs from `file://` too.

```
git clone git@github.com:dawnblade-ai/dawnblade-ai.git
cd dawnblade-ai
open index.html          # that is the whole setup
```

## The engine

`engine/*.js` is a pure rules engine with no UI and no network in it. It is
where every rule actually lives, and it is covered by **790 drills**:

```
npm test          # node --test "test/*.test.js" — no network, run on every change
npm run audit     # how much of each card's printed text the parser reads
npm run fairness  # is any card STRONGER than printed? (coverage is not faithfulness)
npm run sweep     # hero abilities, tokens, and rulings understood but not built
```

The drills are the point. Every bug this project has shipped is written down in
`CHANGELOG.md` next to the drill that now catches it, because the expensive part
was never noticing — it was reconstructing what went wrong afterwards.

## Documentation

| file | what |
|---|---|
| `CLAUDE.md` | the working manual — conventions, traps, and every rule that cost a real bug |
| `CHANGELOG.md` | per-version history, newest first |
| `HANDOFF.md` | current state and what to pick up next |
| `ARCHITECTURE.md` | how the project uses Flesh and Blood materials |
| `ROADMAP-MULTIPLAYER.md` | the road to online play, and why in this order |

## Status

Solo play is complete and plays real cards. Table play runs two real hero decks
through the CR turn structure, priority, the combat chain and printed costs —
**card text does not resolve there yet**, because the parser's effects still
live in the solo trainer. Moving them into a shared module both sides call is
the next piece of work.

---

**Not affiliated with Legend Story Studios.** Flesh and Blood™ and all set names
are trademarks of Legend Story Studios®. All card names, card text, characters
and artwork are © Legend Story Studios. This is a free, non-commercial fan
project; card images are served from LSS's public CDN and credited to LSS. The
rules engine is entirely original — it implements game procedures, which are not
copyrightable, not card text. See `ARCHITECTURE.md`.
