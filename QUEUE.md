# QUEUE — the CEO handoff and the open work list

**Keep this file SHORT (under ~80 lines).** Superseded handoffs, the v1–v4 item lists, the old ORDER and the
answered NEEDS-A-RULING notes are in `QUEUE-ARCHIVE.md` on this branch (grep it, don't read it). History lives in
CHANGELOG.md (v6.30 on; older in `docs/archive/CHANGELOG-to-v6.29.md`) and LESSONS.md on main.

## HANDOFF — START HERE (CEO session_013xG9x84b3jca3ZpKGRmHXL, 2026-11-28, at v7.20)

**THE USER'S DIRECTION (2026-11-27): CRESCENDO — the release UI, "the last hurrah".** "Never settle, always look to
make the game better and better and stick to the spirit of the source material." Its own handoff is
**`docs/crescendo/README.md` on the branch `claude/vigilant-gates-qz10xn`** (NOT yet on main): START THERE.

**SHIPPED THIS CEO (on the branch, no release; live stays v7.20):** the new shell `play.html` + `ui/` (Preact + htm,
no Babel), README steps 0–9: every table state and flow screen box-matches its mockup in Chromium AND WebKit at four
phone viewports; the AI's search runs in a Worker; the session seats the local AI, the Dummy, the server table and two
phones, with rematch; chaos (random taps through whole games, every hero) is clean. WebKit drives work (the two
Playwright hosts were allowed; the environment's setup script installs WebKit). Engine touched twice:
`prompts.js` refuses a selection index the sheet does not hold; `sparring.js` exports `wallNow`.

**State:** live = **v7.20** on `main`. **WIRE_V 50**, DATA_VER sage-v19, 17 heroes. **WORKERS: NONE.** SQL unchanged.

**NEXT:** README "Next": (1) release v7.21 from the branch (merge to main is the user's go: this session could push only
its branch; engine files changed, so `supabase-deploy` + DEPLOYED.json), (2) the real iPhone on `play.html`,
(3) then ask the user to make play.html the default.

**NEW ITEMS:** **S** engine perf: at 4x CPU the UI's long tasks are the engine's own (`judge.js effectsFor` rebuilt
on every call, then `executeInner`/`runOps`; worst 124 ms on an AI tick). **H** the coach (Sharp) loses slow
attrition games to the Dummy (Iyslander 4/12 seeds, Fai 2/12, Kayo 0/12; turns 36-37; engine clean).

**NEEDS A RULING (defaults standing):** README Q1–Q14 (Q13 the roll/the throw, Q14 a Deck button for the
undesigned loadout are new). Add to Home Screen stays decision C.

**How to run the shop:** as before (QUEUE-ARCHIVE.md, top), plus: three builders with disjoint file sets ran at once
(table · flow · session); the CEO checkpointed their in-progress files as labelled ungated WIP commits (the stop hook
asks for commits, the container is ephemeral) and committed each gated round on its report. The account's 5-hour
usage limit stopped workers twice: resume them with SendMessage after the reset.
