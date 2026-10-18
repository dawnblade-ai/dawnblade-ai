# Stage prototype

A clickable replay of one real engine game, Kayo against Dorinthea (seed `p1`,
Kayo first), staged the way `design/STAGE.md` describes the new table. It is a
design instrument, not the game: nothing here is loaded by `index.html`.

| file | what it does |
|---|---|
| `record.js` | drives `sparring.act` in both seats through `judge.reduce`, and records every row the stage shows: both sides' zones, the open chain link, the engine's **"if both pass now" projection** (the real reducer run on a copy), the chain, the feed lines, and the cup8 booth lines. It also runs `invariants.check` on every state and records the count |
| `build.py` | inlines the recording and the card art (fetched from the public CDN into a work folder you name, shrunk, embedded as `data:` URIs) into one self-contained page |
| `stage.tpl.html` | the page: a 393x852 phone table with the hand wheel in a bottom-centre thumb lane, a 960x540 broadcast program over an overhead playmat, the moment director, three presets (`STAGE.md`, Appendix C) |

## Rebuild

```sh
node design/prototype/record.js kayo dorinthea p1 0 /tmp/stage/game.json
python3 design/prototype/build.py /tmp/stage/game.json /tmp/stage/art /tmp/stage/stage.html
```

`build.py` needs `curl` and ImageMagick's `convert`. The art is never committed.
Any hero pair, seed and first seat works; the recorder prints how many actions,
passes and judge-audited states the game had.

## What is real and what is mocked

- **Real:** every life total, card, wall, chain link, projection and caption is
  the engine's. The recorder keeps a row only when something was printed or
  life moved; the dropped rows are passes, which the design never stages.
- **Mocked:** think time. The clocks charge each seat a deterministic
  pseudo-random pause per decision kind, so the 15:00 bank and the average
  time per turn have something to show. The page says so.
- **Presentation fixes applied in the page, not in the engine:** a face-down
  arsenal card is never named (the engine still names it, `judge.js` ~3457),
  and the caption keeps only headline lines from the feed. Both are increment 1
  work in `STAGE.md`.

## What it measured

See `STAGE.md`, Appendix B. In short: the projection matched every strike in
the game, and every pass-only projection in the 210-game corpus. The strike
equation needs a new `pend.power` field, because neither `pend.total` nor
`_struck` is the power the wall was subtracted from. The life numeral belongs
beside the bar (over it, it covers the damage edge at some life total).
Per-blocker numbers must come from `defendValue`. The shared feed needs a
classified caption list, and it names hidden cards and speaks in the second
person on thousands of lines. The page's stamp reads `_struck`, which is exact
for this game only.
