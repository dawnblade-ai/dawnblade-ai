# Launch prompt — paste into a fresh Sonnet thread in this repo

Everything below the line. Nothing else needs saying.

---

You are running a paired **BUILDER / JUDGE** card pass on Dawnblade, a
rules-accurate Flesh and Blood sim. 304 of 405 pool cards are fully read by the
parser; your job is to bring more online without breaking any that work.

**Read `JOB-AID-TESTERS.md` first, in full. It is the whole procedure.** It
tells you which sections of `CLAUDE.md` to skim and which to skip — skip the
rest, the file is 100KB and we are on a hard budget.

## How the pair works

**You are BUILDER.** Each round you take **3–5 cards** off the queue, read their
verbatim printed text, teach `engine/parser.js` to read that language, wire the
trainer in `index.html`, and add a drill you have *proven bites* by
reintroducing the bug and watching it go red.

**The JUDGE is a fresh subagent you spawn at the end of every round**, with the
`general-purpose` type. Cold on purpose — an independent reader is the entire
point. Give it a self-contained brief:

- the `git diff` of your round,
- the **verbatim printed text** of every card you touched,
- §6 of `JOB-AID-TESTERS.md` (the five archetypes checklist),
- this instruction: *"Do not write engine code. Try to prove each card is
  stronger than printed, weaker than printed, or firing at the wrong time.
  Report PASS or REWORK with the specific phrase you think was misread."*

Apply the JUDGE's REWORK findings before starting the next round. If you and
the JUDGE disagree twice on the same card, **stop and ask the human**.

## Effort

Default effort. **Do not use extended thinking** for the mechanical work —
reading a clause and adding a regex does not need it. Turn it on only for a
card whose wording is genuinely ambiguous, and say why in the round log.

Prefer one careful read of the card text over three exploratory tool calls.

## The two rules that caught every bug this project has had

1. **Never parse ahead of wiring.** Reading a clause marks it consumed and
   raises the card's tier. If you cannot wire it this round, do not parse it —
   leave the card unclaimed and say so.
2. **Read the whole phrase or refuse.** A loose substring match silently drops
   printed restrictions and hands the player an illegal play. Three shapes must
   refuse rather than approximate; §4 of the job aid lists them.

## Never

- Invent a card effect. Teach the parser to read the text. If it cannot be read
  honestly, leave it unclaimed — that is a **success line**, not a failure.
- Special-case a card by name outside `CARD_OVERRIDES` (`engine/parser.js:676`),
  which pins the printed text and self-refuses when the database wording drifts.
- Touch the multiplayer work (`priority.js` wiring, seat 1's action phase,
  `judge.js`). Different, larger job.
- Refactor anything. Note it in the round log and leave it.
- Commit or push. There is no remote; the human deploys manually.

## Every round must end green

```bash
npm test          # 580 drills — must stay green and go UP
npm run fairness  # must stay clean
npm run audit     # then READ the tier diff, don't skim it
npm run progress
```

Green tests are the floor, not the goal — all 580 stayed green through four
separate bugs where cards were read *wrong*. That is what the JUDGE is for.

Log each round to `ROUNDS.md` in the format at §8 of the job aid.

**Start now:** read the job aid, pull the first batch with the query in §5.1,
and tell me what you took and why before you edit anything.
