# QUEUE — the CEO handoff and the open work list

**Keep this file SHORT (under ~80 lines).** Superseded handoffs, the v1–v4 item lists, the old ORDER and the
answered NEEDS-A-RULING notes are in `QUEUE-ARCHIVE.md` on this branch (grep it, don't read it). History lives in
CHANGELOG.md (v6.30 on; older in `docs/archive/CHANGELOG-to-v6.29.md`) and LESSONS.md on main.

## HANDOFF — START HERE (CEO session_013xG9x9BM85CQeWCh5kaSZq, 2026-11-25, at v7.10)

**DIRECTION (user, 2026-11-25, standing):** "marching toward the finish line — less is more, keep things simple, **let the
gameplay be the main focus**. Once the necessary foundation is laid we focus on the **major graphical interface changes**."
AI strength stays on the back burner; a card that plays wrong is still a bug: fix it.

**SHIPPED THIS CEO (CEO alone, no workers) — the foundation list is DONE except item 4 (a ruling):**
- **v7.08** — *Join from the link*: the shared text carries `…/?join=CODE` ("Tap <link> to sit down."); the page skips the
  title and opens the right join screen with the number filled in (4 chars = direct, 6 = server; else ignored). Read once
  (`JOIN_ASK`, script0), stripped from the address at once (`history.replaceState`), forgotten when the code screen is
  left; the player still taps *Sit down*. 3 page.js rows; sabotage FAILS 2. Function v168.
- **v7.09** — *The recap*: every end screen (trainer win/loss/draw, every table) carries one card — turns, *Life lost*,
  *Most at once* (+ turn), *Life gained* when any — from STATE: `judge.recapStep` keeps game key `recap` inside
  `stalemateCheck` (both boards' one funnel), before `over`. **WIRE_V 50.** `test/recap.test.js` (books balance at every
  state of two real games; sabotage FAILS 4/4); 3 page.js rows (sabotage FAILS 3). chaos 289 clean, trainchaos 18 clean.
  Function v170. Weak spot: the page rows end on a turn-1 concede (0/0); the drill carries the real numbers.
- **v7.10** — *Your record on the hero tiles*: a chip bottom-left of the art, won–lost(–drawn) with that hero, `mine` +
  `pvp.mine` added; nothing at 0. Top-left collided with the ★ best chip at 320, hence the bottom. 4 page.js rows (393/320,
  sabotage FAILS both seeded). Function v172. **`docs/GRAPHICS-PLAN.md` drafted** (see NEXT).
- Gates each release: npm test 4627/4622/0/5 · babel 4/4 · page.js clean (315/315 at v7.10) · serverpage 490/0 · livecheck ALL PASS.
- test/slicecensus.test.js: the `<style>` pin passed six digits (100,125) and now SORTS FIRST among phasebar's two pins —
  its line moved above the 20,445 one (a comment marks where its history stands).

**State:** live = **v7.10** on `main`. **WIRE_V 50**, DATA_VER sage-v19, 17 heroes. **WORKERS: NONE.** SQL unchanged
(001..012). Weekly sweep Mondays 06:17 UTC — glance at Monday's run.

**NEXT:**
1. **The user's yes on `docs/GRAPHICS-PLAN.md` §2** (the board's shape: A one-screen "mat" — recommended — / B restyle the
   three panes / C hybrid). Then G1 (the mat) ALONE first, then G2–G5 with parallel Sonnet workers
   (`experiments/WORKER-PROMPT-UI.txt`: update its CEO session id; branches `ship/AG-…`).
2. Until the yes: small gameplay polish only. Candidates: a recap page row that ends on real damage (AI concedes after a hit);
   `cards played` in the recap (needs a per-seat play count kept like `recap`, not `hist`, which resets per turn).
- Parked: matchmaking SQL 013 (re-query `select ranked, count(*), max(at) from public.seek_wait_log group by ranked`; was 0
  rows); presence (needs SQL + a user yes); serverpage's 9 px advisories; real-iPhone pass (DESKTOP-TASKS 1–10 + v7.06 the
  screen stays lit, v7.07 the share sheet, v7.08 a tapped join link, v7.09 the recap, v7.10 the tile chips).

**NEEDS A RULING (defaults standing — overrule any):**
- **Add to Home Screen (old NEXT 4) NOT built**: it collides with decision C (CEO, 2026-11-02, in index.html's head): no
  standalone mode, because iOS keeps a home-screen app's storage APART from Safari's — saved games, the record and the
  server sign-in would split in two, and a shared join link opens in Safari, not the app. Home-screen add already works
  (name + icon). Default: keep decision C. A manifest with `display: standalone` waits on the user's yes to that trade.
- The share text now reads "Join my Dawnblade table — table number XXXX. Tap <url>?join=XXXX to sit down." (file:// opens
  leave the link out). Earlier defaults stand (QUEUE-ARCHIVE.md). Presence waits on a yes.

**How to run the shop:** as before (QUEUE-ARCHIVE.md, v6.99/v7.04/v7.05/v7.07 handoffs). This CEO: page deps install into the
scratchpad (`npm install --prefix $SP/pagedeps …`, tools/page.js's header) and `PAGE_DEPS=` names them; page.js's `open()`
waits for the hero grid's card count, so a drive of a URL that skips the grid opens as usual and then `page.goto`s
(`kj.href + "?join=…"`). Next letter: **AG**.
