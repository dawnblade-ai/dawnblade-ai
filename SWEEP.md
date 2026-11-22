# The Sweep

Generated 2026-11-22 from `tools/audit.json`.
The card stack is empty — every pool card has a ruling. These are the
axes it never covered.

| area | entries | note |
|---|---|---|
| Hero abilities | 2 heroes, 2 unread clauses | never charged by the stack |
| Tokens | 2 | 1 barely named in the trainer |
| Ruled but not built | 0 cards | understood ≠ built |
| **Fail states** | 3 entries, 0 break a rule | how cards go *wrong* at the table |

## 1. Hero abilities

### Briar — 1/3 unread
- ❌ Essence of Earth and Lightning  _(the ability's printed NAME — a heading, not a rule)_
- ✅ The first time an attack action card you control deals damage to an opposing hero each turn, create an Embodiment of Earth token.
- ✅ The second time you play a non-attack action card each turn, create an Embodiment of Lightning token.

### Iyslander — 1/3 unread
- ❌ Essence of Ice  _(the ability's printed NAME — a heading, not a rule)_
- ✅ If it's not your turn, you may play blue non-attack action cards from your arsenal as though they were instants.
- ✅ Whenever you play an Ice card during an opponent's turn, create a Frostbite token under their control.

## 2. Tokens

### Fealty — fx `part`, 0 mentions in the trainer — **likely a real gap**
> Instant - Destroy this: The next card you play this turn is Draconic.
At the beginning of your end phase, if you haven't created a Fealty token or played a Draconic card this turn, destroy this.

### Frostbite — fx `part`, 8 mentions in the trainer (named in the trainer — verify it is carried, not just a refusal string)
> Cards and abilities cost you an additional {r} to play or activate.
When you play a card or activate an ability, destroy this.
At the beginning of your end phase, destroy this.

## 3. Ruled but not built

Cards whose ruling exists but which still do not resolve in full.


## 4. Fail states — how cards go WRONG at the table

Sections 1–3 measure *coverage* (how much text is unread). This one asks
the judge's question: if this card is played tonight, what happens that
should not? Ranked by damage to a game judged at pro-tour standards —
a different order from "most unread text".

**Every verdict here is inferred from clause text by pattern, not from
playing the card.** Each entry names the clause that triggered it so it
can be overruled. Same discipline as the mention count.

| category | entries |
|---|---|
| Unread, effect unknown | 2 |
| Keyword filed as no-op — but the trainer names it (verify) | 1 |

### WRONG — 2 entries

- **Briar** · tier `hero` · briar
  - *Unread, effect unknown* — Part of this card resolves and part is unread, so the outcome is some unknown fraction of the printed card.
    > Essence of Earth and Lightning
- **Iyslander** · tier `hero` · iyslander
  - *Unread, effect unknown* — Part of this card resolves and part is unread, so the outcome is some unknown fraction of the printed card.
    > Essence of Ice

### LOST VALUE — 1 entries

- **Uphold Tradition** · tier `full` · enigma
  - *Keyword filed as no-op — but the trainer names it (verify)* — The parser records "Cloaked" as doing nothing, so this card reports as fully scripted from coverage alone. The trainer names it 5 times, so it is probably enforced by name (phantasm is: fxParse calls it a no-op and the trainer still pops the attack). Verify it is carried, not just mentioned.Your ruling describes real behaviour: CLOAKED - EQUIPPED FACE DOWN - SHOW CARD BACK ON THE PLAYERS BOARD INSTANT ABILITY - ALWAYS ACTIVE - COST 1 RESOURCE - POP UP - SHOW AURAS IN PLAY - SELECT 1 - ADD A +1 ATTACK POWER COUNTER TO IT
    > Cloaked

