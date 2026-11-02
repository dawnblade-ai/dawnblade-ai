# Dawnblade

**Play: <https://dawnblade-ai.github.io/dawnblade-ai/>**

Dawnblade is a **Flesh and Blood** sparring simulator for your phone. Pick one of
the Silver Age precon heroes, play the real deck card for card, and get coached
while you do it. Nothing to install, no account.

## Playing

**On an iPhone.** Open the link in Safari. To keep it like an app: tap the Share
button, then **Add to Home Screen** — it saves as "Dawnblade" with its own icon,
and opens in Safari, so your trophies and loadouts are the same either way. The
game is built for a phone held upright; it works on any modern browser too.

**Pick a hero.** The roster shows every precon in the format. Tap one to see the
hero and the official decklist, then **Battle**. A coin decides who picks the
seating, then the loadout lets you choose your gear and cut cards before you start.

**Two places to play from the loadout:**

- **Fight** — **the trainer.** An iron-armoured training dummy that swings on a
  fixed, tuned pattern and blocks with what it holds. Start here: it is where you
  learn a deck.
- **Fight the new engine — harder** — **the table.** A real opponent seat that
  holds a hand, pays costs and blocks like a person. Leave it on the Dummy, or
  pick an AI hero to pilot a full precon against you. With an AI hero picked,
  choose how it plays: **Sharp** (the default) plays out each way to start its
  turn and picks the best; **Steady** plays by its rules of thumb, quicker to
  read and easier to beat. The game remembers your choice.

**Getting around the board.** The board is stacked top to bottom: the opponent's
board, the chain (the log, the advisor and the cards in play), and your board.
Swipe up and down, or use the row at the top (▲ opponent · Chain · You ▼).
**Tap a card once to see it large** with what the next tap will do; tap it
again to do it.

**The advisor.** On the chain screen, a panel reads the board and tells you the
play it would make and why: **Coach's call** in the trainer, **&lt;Hero&gt;'s
call** at the table (the move the AI would make in your seat). Tap its header to
fold it away.

**The feed** under it is the game written down: every attack, block, pitch and
end-phase step, in order. When a card cannot be played, the game says why.

**Two phones, one table.** From the roster, **Find an opponent**. One player taps
**Open a table** and reads out the table number; the other taps **Join a table**
and types it in. Both choose heroes, a rock-paper-scissors throw decides who
picks the seating, both sideboard, and the game starts. The phones talk to each
other directly, so both need to be online; there are no accounts and no server
holding your game.

**JUDGE!!** — the red button on the chain screen. If something looks wrong, tap
it and write one line about what you expected. It captures the whole board with
your note (both sides, every zone and counter, the chain, the feed, and anything
the game's own rule-checker flagged), and **Copy** or **Save report** gives you
something to send. One line is plenty.

## The Dawnblade format

**Dawnblade is a fan-made sub-format of Silver Age.** Its pool is the Silver
Age Chapter 1–3 preconstructed decks exactly as printed, and it does not
follow Silver Age's rolling ban list or its seasonal hero bench. A card Silver
Age has since banned, or a hero it has benched, is still legal here. The
definition lives in [`data/formats.json`](data/formats.json).

This is a fan project. It is not affiliated with or endorsed by Legend Story
Studios. Flesh and Blood and its cards belong to them.

---

# For maintainers

**Start with [`CLAUDE.md`](CLAUDE.md)** — the working manual: the hard
constraints, the card-data rules, release and validation steps, and the engine
map. The current handoff and work list are `QUEUE.md` on the branch
`findings/queue`.

The card text is the public Flesh and Blood card database's, pinned in
`data/pool.js` and read by the parser. No card effect is hardcoded; when a card
does something new, the parser learns to read it. The page loads the pinned pool
and downloads no card database.

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
where every rule actually lives, and the drills cover it (`npm test` prints the count):

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
| `QUEUE.md` (branch `findings/queue`) | the handoff — current state and what to pick up next |
| `ARCHITECTURE.md` | how the project uses Flesh and Blood materials, and the engine map |
| `LESSONS.md` | the long-form why behind every rule in `CLAUDE.md` |
| `docs/archive/` | finished plans and old handoffs, kept because the history cites them |
| `UI-GUIDE.md` | the UI surface — components, screens, the design system |
| `POLISH.md` | the quality bar the screen is held to |
| `ROADMAP-MULTIPLAYER.md` | the road to online play, and why in this order |

## Status

Both boards play real cards. Solo runs the tuned training dummy; table play
runs two real hero decks through the CR turn structure, priority, the combat
chain and printed costs — and **card text resolves on both**, through one
shared `engine/effects.js`. Every deck card in the pool now reads something
(`node tools/approx.js`, `pool-deck-complete`).

What is left is written down rather than guessed at: `node tools/approx.js`
lists every stated approximation with a drill behind it, and `QUEUE.md` (branch
`findings/queue`) orders the remaining work. At the table an AI hero plays
Sharp (it searches its own turn) or Steady (the rule policy), the player's pick.

---

**Not affiliated with Legend Story Studios.** Flesh and Blood™ and all set names
are trademarks of Legend Story Studios®. All card names, card text, characters
and artwork are © Legend Story Studios. This is a free, non-commercial fan
project; card images are served from LSS's public CDN and credited to LSS. The
rules engine is entirely original — it implements game procedures, which are not
copyrightable, not card text. See `ARCHITECTURE.md`.
