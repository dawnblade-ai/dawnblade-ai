# POLISH — the bar, before shipping

> **Standing direction (user, 2026-08-20):** *"Super Smash Bros. Melee — it's
> more than a game, it's a generational masterpiece. We will be polishing to
> these standards before shipping. We will need to add decks as they are
> released but other than that and rules changes I want the rest of the game
> to be built to last the test of time."*

`FINISH.md` says when the game is **correct**. This says when it is **good**.
They are different questions and the second one is not a coat of paint.

---

## Why Melee, specifically

Not nostalgia — it is the clearest worked example of a game whose *feel* is
an engineering property with numbers attached:

| Melee | the number | the principle |
|---|---|---|
| input latency | **~2 frames** average, unusually low for 2001 | responsiveness is a BUDGET you spend, not a quality you add |
| framerate | **locked 60fps**; players build muscle memory on patterns that assume exactly 60 | a jitter is a bug even when nothing is wrong |
| display chain | tournaments still favour CRTs, because a modern panel adds lag the engine never had | **the feel must not depend on a fast device** |
| depth | wavedashing, L-cancelling and DI were EMERGENT, and HAL left them in | model the system faithfully and let the depth arrive |

That last row is the one this project has been living for twenty versions.
Every bug since v3.00 came from the engine being *convenient* where the card
was *specific* — a blanket debuff for a narrow one, a counter for an aura, a
flag for a count. **Building to print is how depth emerges.** You do not
design the interesting lines; you refuse to round off the rules that produce
them.

---

## The five conditions

Each is measurable, and none is met yet. This is a bar, not a report.

### 1. THE TAP IS NEVER LOST

The phone is the platform, and the interaction is already specified (the
two-tap peek, v2.19). The bar is that it never silently fails:

- every tappable zone has a peek entry in `peekables()` — a tap that arms
  with no preview is the failure mode this project has shipped **twice**
  (v2.35's arena abilities, v2.36's full-width overlay);
- `--peekbot` tracks the live rail per frame, and the dock never overlaps it
  at **393×852** — the phone it is actually played on;
- no dead taps: a card that cannot be played is REFUSED BY NAME, never
  silently inert. A dead button reads as a broken screen, not as a rule.

**Test at phone dimensions, not a tall desktop window.** Both overlay bugs
existed only there.

### 2. THE FEED IS THE LESSON

In a training sim the sequence *is* the teaching. The bar:

- every end-phase step announces itself, **including when it does nothing**
  (already true — keep it true);
- a refusal names the window and the reason, in the coach's voice;
- **no second person in the shared feed.** `say()` is read by both seats, so
  it names them; `return "reason"` goes back to whoever attempted it, so
  "you" is right there. `test/judge.test.js` pins the debt at 44 literals in
  `effects.js` — that number must reach **0**;
- one voice. Sharp, warm, concise, never patronising.

### 3. NOTHING JITTERS

Dawnblade has no 60fps physics loop, so the analogue is **determinism**:

- one seed per match; every shuffle, throw and die roll through `rng.js`;
- `rng.n` only ever goes up — a stalled counter between two states that
  should differ is the desync canary;
- a replay of a seed plus an action log reproduces the game **exactly**;
- the invariant judge stays wired into every state change. A guard rail that
  goes dark is worse than none.

### 4. IT SOUNDS AND LOOKS LIKE ONE THING

Not built yet, and deliberately last — it is the half that ages worst if the
foundation moves under it:

- **sound is feedback, not decoration.** Melee's hits read as heavy because
  hitlag freezes the frame; the analogue here is that a hit, a block and a
  fizzle must be *distinguishable with the screen off*. Three sounds that
  mean three things beats thirty that mean nothing;
- every asset self-hosted. **No build step, ever** — that constraint is not
  negotiable and it governs the art pipeline too;
- the card faces are already right (v2.35's printing precedence). Do not
  regress a real Silver Age face for a generic one.

### 5. IT SURVIVES ITS OWN MAINTENANCE

The user's actual requirement: *"add decks as they are released… the rest
built to last."* That is a statement about the SEAMS, and it is the one
condition already largely met:

- **a new deck is DATA.** Adding one must touch the deck list and nothing
  else. Card text streams from the database and is read by the parser —
  never invented, never special-cased by name;
- **one copy of every shared function** (`engine/`, the no-mirror rule);
- **one copy of the card semantics** (`effects.js`), called by both turn
  structures;
- a rules change is a parser change plus a drill, not a rewrite.

**The test of this condition is a stranger.** Could someone who has never
seen the codebase add the next hero's precon by editing one list? Today:
close. `data/pool.json` needs a repin and `DATA_VER` a bump, and both are
documented — but neither is automatic.

---

## The one thing to protect

Melee shipped in 13 months and is still being discovered 25 years later.
That is not because it was polished — it is because its **foundations were
honest**, so the depth it did not intend was still real.

Every rule here serves that: build to print, refuse rather than guess, one
copy of everything, and a drill that bites. Polish sits ON TOP of that. It
cannot substitute for it, and applied first it just makes a wrong game
prettier.
