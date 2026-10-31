# docs/archive — finished plans and old handoffs

**Frozen history. Nothing here is current.** These files were the plan, the
handoff or the procedure for a phase that is over. They are kept because old
code comments, `CHANGELOG.md` and `LESSONS.md` still cite them by name (for
example "see HANDOFF.md", "FINISH.md §0"), and a citation should still land on
the text it meant.

**For where things stand now**, read `CLAUDE.md` (auto-loaded), then the
handoff at the top of `QUEUE.md` on the `findings/queue` branch:

```sh
git fetch origin findings/queue && git show origin/findings/queue:QUEUE.md | sed -n 1,60p
```

Moved here 2026-10-31 at v5.55. Each line gives what the file was and what
replaced it.

| file | what it was | superseded by |
|---|---|---|
| `HANDOFF.md` | the session handoff, last refreshed at v5.20 (2026-10-13) | the HANDOFF section at the top of `QUEUE.md` |
| `WEEK.md` | a fortnight's plan written at v4.39 (2026-09-11) | `QUEUE.md`'s ORDER |
| `HANDOFF-MERGE.md` | the record of the two-board merge, done at v2.79 | `CLAUDE.md` § Engine map, `LESSONS.md` |
| `FINISH.md` | "the blueprint to done", measured at v3.70 | `QUEUE.md`; the approximation ledger (`node tools/approx.js`) |
| `ROADMAP-OPPONENT.md` | the 2026-08-01 plan to turn the dummy into an opponent | built at the table: an AI hero pilots seat 1 (`engine/sparring.js`, ruling 2026-10-18); the trainer's dummy stays as the regression harness (`CLAUDE.md` § Two boards) |
| `PLAYNOTES.md` | notes from the first 210-game self-play session (v3.49) | `npm run play`, `CHANGELOG.md` |
| `ROUNDS.md` | the Kayo-mirror testing log (v2.5x–v2.6x) | `CHANGELOG.md` |
| `KAYO-GUIDE.md` | one table-testing session's findings (v2.51) | `CHANGELOG.md`, `AUDIT.md` |
| `JOB-AID-TESTERS.md` | the BUILDER/JUDGE card-pass procedure (pool now read 405/405) | `CLAUDE.md`, `npm run audit` |
| `PROMPT-KAYO-MIRROR.md` | launch prompt for the Kayo-mirror build thread | done |
| `PROMPT-TESTER-THREAD.md` | launch prompt for the tester thread | done |
