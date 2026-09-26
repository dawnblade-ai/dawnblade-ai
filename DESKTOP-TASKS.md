# Desktop tasks

These tasks need something the cloud sandbox cannot reach. Each one says
what was blocked, what is already known, and where the answer goes.

---

## Silver Age legality — which Dawnblade cards and heroes has Silver Age banned or benched?

**Why it is here.** On 2026-09-26 this environment's egress policy blocked
every source that carries the list: `fabtcg.com`, `fabtcg.gg`,
`fabtcgmeta.com`, `fabrary.net`, `fab.cardsrealm.com` and
`articles.starcitygames.com`. Web SEARCH worked, but its answers are
summaries of snippets and cannot be trusted with card names. Either run
this from a desktop, or add those hosts to the environment's allowed
domains (Network access in the cloud environment's settings).

**Where the answer goes.** `data/formats.json` → `silverAge.banned` and
`silverAge.benched`, replacing `null`. Each entry needs a name, an
effective date and a source:

```json
"banned":  [{"name": "Reaping Blade", "since": "2026-05-29", "source": "fabtcg.com/articles/scheduled-banned-and-restricted-announcement-28-05-26/"}],
"benched": [{"hero": "kayo", "since": "2026-05-29", "until": "2026-09-18", "source": "…"}]
```

`test/formats.test.js` checks every name against the fifteen precons, so a
typo fails the drill rather than silently marking nothing. **Dawnblade's
own legality does not change**: every card and hero in the pool stays
legal here. The block only records what a player would meet at a Silver
Age event.

### Leads from search snippets — UNVERIFIED, confirm each one

The official announcements to read (all on fabtcg.com):

| announcement | effective | page |
|---|---|---|
| March | 2026-03-03 | `/articles/scheduled-banned-and-restricted-announcement-2-3-26/` |
| May | 2026-05-29 | `/articles/scheduled-banned-and-restricted-announcement-28-05-26/` |
| June | ? | `/articles/scheduled-banned-and-restricted-announcement-29-06-26/` |
| September | 2026-09-18 | `/articles/scheduled-banned-and-restricted-announcement-17-09-26/` |
| the hero vote, Usurp the Shadow Throne season | 2026-09-18 | `/articles/silver-age-vote-iar-season/` |

What the snippets claimed, and whether the named card is in our pool:

| claim | in the Dawnblade pool? |
|---|---|
| **May: Reaping Blade** banned in Silver Age | **yes — Viserai's weapon** |
| May: Phantom Tidemaw, Volzar, the Lightning Rod, Channel Lightning Valley, Electromagnetic Somersault, Skyward Serenade banned | no |
| **May: Kayo** benched for one season (with Ira, Crimson Haze and Kano) | **yes — our pilot hero** |
| **September: Entwine Lightning** banned (aimed at Oscilio) | **yes — Briar's** |
| **September: Brand with Cinderclaw** UNBANNED (so it was banned earlier; when?) | **yes — Fai's** |
| **September: Briar** benched by player vote (with Oscilio and Oldhim) | **yes** |
| September: Kayo, Kano and Ira return, with bans aimed at each | Kayo — which cards? |
| Star City Games headline: "Nine Cards Impacted In Flesh And Blood's Silver Age Format" | which nine? |
| Absorb in Aether, Beaten Trackers banned — **Classic Constructed**, not Silver Age | yes (Iyslander/Blaze; Kayo), but a CC ban does not touch Silver Age |

Next scheduled announcement: 2026-10-26, per the same snippets.

---

## Rules update 2026-09-17 — the start-of-game procedure

**Snippet, unverified:** from 2026-09-18, players choose and reveal their
arena cards (equipment and weapons) **before** choosing which cards start
in their main deck. Source to read:
`fabtcg.com/articles/rules-update-17-09-26/` and
`fabtcg.com/articles/start-game-procedure/`.

**What it would touch here.** `engine/lobby.js` negotiates hero → throw →
sideboard, and the loadout screen picks equipment and deck together. If
the update is confirmed, the sideboard step splits so that the loadout is
revealed to both seats before either commits a deck. That is a lobby and
UI change, not a rules-engine one. Recorded rather than guessed, because
the exact order (does the reveal come before or after the throw?) is what
the article settles.

**The CR itself.** The snippets name Comprehensive Rules **v2.14.0, dated
2026-06-10** (`rules.fabtcg.com/pdf/en-fab-cr.pdf`). This engine's CR
citations predate it. Diffing that PDF against the rule numbers in
`CR-INDEX.md` is a desktop task of its own: every guarded rule should be
checked for renumbering or rewording.

---

## The two new precons — nothing to do until upstream publishes

*Prism, Advent of Thrones* (SAT) and *Viserai, Between Worlds* (SBW) are
pinned as fetched lists in `data/newsets.json`. They stay unbuildable
until the-fab-cube's `develop` branch carries them. That was re-measured
from the sandbox on 2026-09-26, eight days after the street date: still 15
Silver Age sets, 0 SAT and 0 SBW printings. `test/drift.test.js` goes red
by itself the day they arrive. No desktop work is needed; this is here so
nobody goes looking.
