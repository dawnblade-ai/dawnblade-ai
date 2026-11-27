# QUEUE — the CEO handoff and the open work list

**Keep this file SHORT (under ~80 lines).** Superseded handoffs, the v1–v4 item lists, the old ORDER and the
answered NEEDS-A-RULING notes are in `QUEUE-ARCHIVE.md` on this branch (grep it, don't read it). History lives in
CHANGELOG.md (v6.30 on; older in `docs/archive/CHANGELOG-to-v6.29.md`) and LESSONS.md on main.

## HANDOFF — START HERE (CEO session_013xG9x8ois1huSReX34RriM, 2026-11-27, at v7.20)

**THE USER'S DIRECTION NOW (2026-11-27): CRESCENDO — "the last hurrah".** A new graphical framework for the RELEASE
version, "a blank new canvas", designed first in great detail by a team of Sonnet designers, then built by a team of
Sonnet developers, "sparing no expense"; the bar is Melee ("perfectly polished … facilitates fair competitive games");
the user reports "extreme difficulty in polishing the output on the actual phone". **Everything is in
`docs/crescendo/` on main — its `README.md` is the mission's handoff: START THERE.** The user: walk step by step,
keep the CEO's context lean, write a handoff and notify the user to start a new thread at the end of each session.

**SHIPPED THIS CEO (docs only, no release; live stays v7.20):** the design (`BRIEF.md`, `DESIGN-SYSTEM.md` +
`tokens.css`, `MOTION.md`, `SCREENS-TABLE.md`, `SCREENS-FLOW.md`, `mockups/` — 11 table states, 9 flow screens, a
style tile, a motion lab, a gallery, shots) and the foundation (`FRAMEWORK.md`, `PHONE.md`, `probe.html`). Key finding:
in-browser Babel is ≈93% of load (first paint 17.5 s at 4x CPU throttle; 0.75 s without it) and no drive has ever
run WebKit or Safari's visible 393×660. **Decision: the new shell is `play.html` + `ui/*.js`, Preact + htm, no Babel**
(README.md "CEO decisions").

**State:** live = **v7.20** on `main` (Table Talk's little details; its QUEUE handoff was never written — see
CHANGELOG.md v7.20 and TABLE-TALK.md's log). **WIRE_V 50**, DATA_VER sage-v19, 17 heroes. **WORKERS: NONE.** SQL
unchanged (001..012). Weekly sweep Mondays 06:17 UTC.

**NEXT:** `docs/crescendo/README.md` "Next" — step 0 is asking the user to allow the two Playwright download hosts
(WebKit drives); step 1 the `play.html` skeleton. Ask the user to open `…/docs/crescendo/mockups/` and
`…/docs/crescendo/probe.html` on the phone (a screenshot of the probe calibrates everything) and to answer
README.md's Q1–Q7. The busy work (the archived v7.19 handoff's NEXT: G2, prompts as a hand source, small board
debts, the parked list) waits behind CRESCENDO unless the user asks.

**NEEDS A RULING (defaults standing):** README.md Q1–Q8; Add to Home Screen stays decision C; share text as v7.08;
presence waits on a yes. Table Talk's own questions: TABLE-TALK.md §13.

**How to run the shop:** as the archived v7.19 handoff's last paragraph (QUEUE-ARCHIVE.md, top), plus: Sonnet
workers get ONE file set each, a scratch dir, "do not commit", and a ≤250-word report; the CEO commits. A worker
can stop at the account's 5-hour usage limit — its files stay on disk; resume it with SendMessage after the reset.
