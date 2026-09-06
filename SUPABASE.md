# Supabase — accounts, saved games, and reporting

Investigated 2026-09-06 at v4.28, against `ROADMAP-MULTIPLAYER.md` Phase C
step 9, which already names Supabase by name.

**Short answer: yes, and the seams it needs already exist.** Every number
below was measured here rather than recalled. Where a fact is about
Supabase's *hosted service* rather than its shipped client, this file says
so and says it could not be verified from this sandbox — see
**[What is not verified](#what-is-not-verified)** at the end.

---

## 1. THE ONE HARD CONSTRAINT — CLEARED, AND MEASURED

CLAUDE.md's first rule is **no build step, ever**. That is not a
preference; it is why React, Babel and PeerJS all arrive as CDN
`<script src>` tags and why the page runs from `file://`. It has already
decided one library choice in this repo: `room.js`'s own header records
that **Trystero was rejected for being ESM-only** and PeerJS chosen
because it ships UMD.

Supabase passes the same test. From the published package
(`@supabase/supabase-js@2.115.0`, tarball fetched and unpacked):

| | |
|---|---|
| `jsdelivr` / `unpkg` fields | `dist/umd/supabase.js` |
| the file | present, **214,101 bytes** raw, **54,901 gzipped** |
| its first bytes | `var supabase=(function(e){…` — an IIFE assigned to a global |

So it loads with a plain `<script src>` and defines `window.supabase`,
which is exactly the shape `room.js`'s `loadLib` already knows how to
fetch. **No bundler, no `type="module"`, nothing to add to a build that
does not exist.**

Verified present in that same bundle: `signInWithOtp`, `verifyOtp`,
`signInAnonymously`, `getSession`, `onAuthStateChange`, `broadcast`,
`presence`, `rpc`, `storage`, `functions`, and the string `email_otp`.

**LOAD IT LAZILY, FOR `room.js`'s THREE STATED REASONS**: the solo trainer
is the common case and should not pay a CDN round trip; a `file://` page
keeps working for everything except the one feature; and a backend that is
down degrades to a clear message on one screen instead of a broken app.
55KB is small beside babel-standalone, and it is still 55KB nobody playing
alone needs.

---

## 2. THE THREE JOBS, AND THE SEAM EACH ONE ALREADY HAS

### Account login → `store`, which is already one door

`index.html` keeps every piece of per-player state behind a two-method
object:

```js
const store = {
  get(k,f){ …localStorage.getItem("dawnblade."+k)… },
  set(k,v){ …localStorage.setItem("dawnblade."+k, …)… }
};
```

Five key families use it, and **four of the five are exactly what an
account is for**:

| key | what | account-backed? |
|---|---|---|
| `loadout.<hero>` | gear picks + deck cuts, per hero | **yes** — the thing a player most wants on their other device |
| `best` | best score per hero (`turn + wasted`) | **yes** — and it is the ELO input |
| `case` | the trophy case | **yes** |
| `adv` | advisor on/off | yes, trivially |
| `dbcache_<DATA_VER>` | the **23MB card database** | **NEVER.** It is a cache of a public file, keyed by `DATA_VER`, and it belongs on the device |

That is the whole integration surface for login: one async write-behind
layer under `store`, plus a rule that `dbcache_` never leaves. Nothing
else in the app needs to know an account exists.

**`signInAnonymously` IS PROBABLY THE RIGHT FRONT DOOR.** A player opens
the page on a phone and taps a hero; asking for an email first is a wall
in front of a training sim. An anonymous identity gives cloud-saved
loadouts and a stable id for results immediately, and can be linked to an
email later without losing either.

**AND THE EMAIL PATH MUST BE THE CODE, NOT THE LINK.** A magic link needs
a registered redirect URL, and `file://` cannot be one — this page is
explicitly meant to run from `file://`. `signInWithOtp` +
`verifyOtp({type:"email"})` types a six-digit code into the page and
needs no redirect at all. Both are in the shipped bundle.

### Game-state storage → **the seed and the log, not the state**

This is the finding worth the most, and this project built the answer two
years of versions ago without a backend to spend it on. `rng.js`'s own
header: **"a game is its seed plus its action log."** `judge.reduce` is
pure, actions are serializable, and `sparring.act` is deterministic and
never touches `game.rng`.

Measured, three real games driven through `judge.reduce` with
`sparring.act` in both seats (`tools/selfplay.js`'s own setup):

| match | turns | actions | action log raw | **gzipped** |
|---|---|---|---|---|
| Kayo v Dorinthea | 20 | 398 | 8,710 B | **597 B** |
| Briar v Iyslander | 16 | 280 | 6,247 B | **517 B** |
| Azalea v Bravo | 26 | 470 | 10,549 B | **797 B** |

**A whole game of Flesh and Blood is well under a kilobyte compressed.**
For comparison, a `report.build` bug report of the same end state is
24–30KB raw (4.0–4.6KB gzipped), and a mid-game `wire.encode` snapshot is
larger again — the project pins only the **opening** snapshot, at ≤16KB
(`test/table.test.js`), because that is the one that has to fit down a
WebRTC channel.

So the row is `{seed, heroes, loadouts, first, log}` and it is tiny.
Everything else is derived:

- **a replay** is a re-application — the engine already does this;
- **a resume** is the same thing, stopped early;
- **verification is free**: `wire.hash` fingerprints the rules state, so
  a stored log can be replayed server-side and the final hash compared. A
  submitted result that does not reproduce is rejected, which is the
  whole anti-cheat story for a ladder built on logs.

**DO NOT STORE SNAPSHOTS AS THE PRIMARY RECORD.** They are 10–100x
larger, they cannot be replayed, and they carry `DATA_VER`-shaped rot: a
snapshot decoded against a moved card database is a different game. A log
plus a seed plus `DATA_VER` reproduces exactly, or fails loudly.

### Game reporting → `report.js`, which already writes the row

The JUDGE!! button has produced a serializable JSON report since v2.51 —
both seats' zones by `name#uid`, every counter, `hist`, the chain, the
stack, the whole feed, `invariantsNow`, and the replay key
(`rng.seed` / `rng.s` / `rng.n`). It already carries `appVer`, `dataVer`,
`source` ("trainer" or "table"), the seat and the table code, and
`machine.lang` naming which state vocabulary is authoritative.

**That is a database row with a `Save report` button in front of it.**
Today it downloads a file the player has to send somewhere. One insert
turns it into a report you can query — *"every report on v4.28 whose
`invariantsNow` is non-empty"* — and `REPORT_V` is already the schema
version.

The same table takes the ladder's results, because `report.build`'s
context already names the hero, the seating and the source.

---

## 3. WHAT SUPABASE DOES **NOT** SOLVE

`ROADMAP-MULTIPLAYER.md` fact 4 is blunt about the thing that actually
gates ranked play:

> **Ranked play (Phase C):** not acceptable. The server must hold
> authoritative state and send each client only its own view.

Supabase is Postgres, auth, storage and a realtime bus. **None of that
hides a hand.** Both peers hold full state today — the roadmap's stated,
accepted Phase B position — and moving the pipe from PeerJS to Supabase
Realtime does not change it by one card. What hides a hand is
`judge.reduce` running somewhere the client cannot read, and that is the
real work behind the ladder.

**The good news is that it is a RELOCATION, not a rewrite, and `net.js`
says so in its own header**: the room host is the sequencer, it assigns
order and nothing else, and it is deliberately *not* authoritative over
outcomes. Moving the sequencer to a server is the change Phase C was
designed for.

Two concrete pieces:

1. **`engine/*.js` are dependency-free UMD scripts** that already run
   under Node in `npm test`. A Supabase Edge Function is Deno, which
   reads CommonJS through its Node compatibility layer — so the rules
   engine ought to run server-side essentially unchanged. **This has not
   been tried and is the first thing to prove**, because "ought to" is
   how a no-build-step project acquires a build step.
2. **`net.js` takes a `send` and exposes `receive`, and `wsAdapter` is
   already written** for exactly this. Supabase Realtime is a WebSocket
   channel; the adapter is ~15 lines that already exist. That seam has
   been drilled over a loopback with packet loss, desync and reconnect
   since Phase B.

**AND THE `DATA_VER` REFUSAL GETS STRONGER, NOT WEAKER.** `net.js`
already refuses a peer whose `catalogHash` differs, because two clients
on different card data deal *silently different decks from the same
spec* — the one failure a state hash cannot describe usefully. A server
can enforce that at the door instead of discovering it at the handshake.

---

## 4. THE ORDER

Each step is useful shipped alone, and none of them blocks on the next.

1. **Reporting.** One table, one insert behind the existing `Save report`
   button, anonymous auth. No schema risk, no gameplay risk, and it makes
   every later step easier to debug. *Start here.*
2. **Accounts + `store` sync.** Anonymous by default, email-code upgrade,
   a write-behind layer under `store`, and `dbcache_` explicitly excluded.
   Loadouts and trophies follow the player to a second device.
3. **Saved games.** `{seed, heroes, loadouts, first, log, dataVer,
   appVer, hash}`. Replay and resume for free; a "share this game" link is
   a row id.
4. **Realtime as an ALTERNATIVE transport.** `wsAdapter` plus a Supabase
   channel, beside `room.js` rather than replacing it — PeerJS needs no
   backend and should stay the zero-cost path. Keep `test/wire.test.js`'s
   `HEADLESS` ledger honest when a new module joins the page.
5. **The authoritative server, and only then the ladder.** `judge.reduce`
   in an Edge Function, clients send intents and receive their own view.
   This is the one that is real work, and it is what fact 4 has always
   said the ladder costs. The broadcast view (Phase D) sits behind it for
   the same reason: a spectator seat built before this is a cheat panel
   wearing a broadcast coat.

---

## 5. WHAT TO WATCH

- **The anon key is PUBLIC and that is by design.** This page is a single
  readable static file; anyone can read the key out of it. Row Level
  Security is the entire security boundary, so no table ships without a
  policy. A `results` table that anyone can `INSERT` into with an
  arbitrary score is a ladder anyone can win — which is why step 5's
  replay-and-compare (`wire.hash`) matters even before the reducer moves.
- **`file://` gets auth but not much else.** A code-based sign-in works
  from a file page; anything that depends on an origin will not. The
  trainer must keep working with the backend absent — the same
  degradation `room.js` already implements.
- **Nothing on the page today costs money to run.** GitHub Pages is free
  and PeerJS's rendezvous is free. Adding a backend adds an account that
  can be paused, rate-limited or billed, and a failure mode where the
  *game* is fine and the *save* is not. Say so on screen when it happens
  (v2.51: never dress a failure as a success).
- **`DATA_VER` still keys everything.** A stored log replays correctly
  only against the card data it was recorded on. Store it in the row.

---

## What is not verified

`supabase.com` is blocked by this sandbox's egress policy
(`connect_rejected`), so **nothing in this file about the hosted service
was checked against the live docs**: free-tier limits, current pricing,
Realtime's delivery and ordering guarantees, Edge Function runtime
details, and the exact current shape of the auth calls. All of that needs
a pass against the real documentation before any of it is built.

What **was** verified here: the npm package metadata, the UMD bundle's
existence, size and global, the API names present inside it, and every
number measured about this repo.
