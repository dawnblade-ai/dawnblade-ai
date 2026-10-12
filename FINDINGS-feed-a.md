# Feed read, group A — arakni · azalea · blaze (engine v5.08)

Read-only audit. No engine, test or doc file was touched. Repros run from the repo root
(`node <file>`); each prints the wrong STATE, not just a feed line.

Seven findings: three change state (1–3), four are feed text (4–7).

---

## 1. A played attack reaction that grants "go again" to its TARGET also pays its controller an action point

- **hero · card:** Arakni · Stains of the Redback (also Dorinthea's Run Through, same code path)
- **printed:** "Target attack with **stealth** gets +3{p} and **go again**."
  (Run Through: "Target sword attack gets **go again**.")
- **feed excerpt** (arakni v viserai, seed `ar3`, first=1, turn 4):
  ```
  Arakni plays Mark the Prey — 3 power on the chain.
  Arakni plays Stains of the Redback.
  Stains of the Redback: Mark the Prey goes again.
  Go again on an instant — an action point gained (CR 5.3.5).
  ...
  Mark the Prey resolves for 6 (+3 reactions).
  Go again — action point kept.
  Arakni plays Mark the Prey ...      <- second attack
  Arakni plays Mark of the Black Widow — 1 power  <- THIRD attack, no go again printed for either
  ```
- **what is wrong:** the go again belongs to the target attack (the engine already says so: "Mark the Prey goes
  again", and the link later reports "action point kept"). The reaction card itself ALSO gets `ga`, so it banks an
  instant's "+1 action point" the moment it is played. Measured AP trace: 1 → (Stains) 2 → (link 1 resolves, its own
  go again) 2 → (link 2, no go again) 1 → (link 3) 0. Printed text allows two attacks; the engine gave three.
  Run Through is the same: AP 1 → 2 on play (seeds `d1`, `d4` with dorinthea v kayo/viserai).
  This is v3.74's defect ("an attack reaction's go again is the target's") fixed for ABILITIES (`_attackRx`
  powCards) but not for a played attack-reaction CARD.
- **direction:** stronger (a free action point per play; steals games, `tier: full` so no tool sees it)
- **repro:** `node` on this (saved as a scratch file in the repo root, then removed):
  ```js
  const SP=require("./tools/selfplay.js");
  let n=SP.match("arakni","viserai","ar3",1);
  for(let i=0;i<4000&&!n.over;i++){ let moved=false;
    for(const s of [0,1]){ const a=SP.SP.act(n,s); if(!a) continue;
      const out=SP.J.reduce(n,a,s); if(out.error) continue;
      const b=n; n=out.state; moved=true;
      if((n.feed||[]).slice((b.feed||[]).length).some(l=>/plays Stains of the Redback/.test(l)))
        console.log("ap",b.sides[s].ap,"->",n.sides[s].ap,"(expected 1 -> 1)");
      break; }
    if(!moved||n.turn>4) break; }
  ```
  prints `ap 1 -> 2`.
- **engine site:** `engine/effects.js:3635` (the `ga` chain special-cases `card._attackRx` but a played AR card falls
  through to `: fx.ga`), then `engine/effects.js:5437-5438` (`ap - apCost + (ga ? 1 : 0)` and the
  "Go again on an instant — an action point gained" line). Pool claimants: `fxParse` gives `ga` + `gaQ` on exactly
  Run Through ×3 and Stains of the Redback ×3.
- **confidence:** high

## 2. Shred can be played with no defender (or a non-Assassin attack) — the card is spent and nothing happens

- **hero · card:** Arakni · Shred
- **printed:** "Target card defending an Assassin attack gets -4{d} this combat chain."
- **feed excerpt** (arakni v dorinthea seed `ar2`, turn 5; also arakni v viserai seed `ar3`, turn 2):
  ```
  Arakni plays Shred.
  Shred: nothing is defending — there is no card to shrink.
  Shred on the stack (+0).
  Shred plays at instant speed — no action point spent.
  ```
- **what is wrong:** the card needs a target and the wall is already fixed when the reaction step opens (CR 7.3
  precedes 7.4), so with an empty wall there is no legal target; the play is accepted by `judge.legal` and the card
  goes to the graveyard for nothing. Same for a non-Assassin attack (the `defDebuff.q` miss is only reported at
  resolution: "isn't one"). v4.88 ("a target qualifier lives on `selfQ`, `gaQ` OR `fx.modes`") found three homes
  for the qualifier; `fx.defDebuff` is a fourth that `rxNoTargetWhy` does not read.
- **direction:** weaker for its controller + illegal play allowed (a targeted card played with no target)
- **repro:** saved as a scratch file in the repo root:
  ```js
  const SP=require("./tools/selfplay.js");
  let n=SP.match("arakni","dorinthea","ar2",0);
  for(let i=0;i<4000&&!n.over;i++){ let moved=false;
    for(const s of [0,1]){ const a=SP.SP.act(n,s); if(!a) continue;
      const out=SP.J.reduce(n,a,s); if(out.error) continue;
      const b=n; n=out.state; moved=true;
      if((n.feed||[]).slice((b.feed||[]).length).some(l=>/no card to shrink/.test(l))){
        console.log("legal(before) =",SP.J.legal(b,a,s),"wall:",JSON.stringify(b.sides[1].blockH),
                    "grave top:",n.sides[s].grave[0].name); process.exit(0);}
      break; }
    if(!moved) break; }
  ```
  prints `legal(before) = null wall: [] grave top: Shred`.
- **engine site:** `engine/effects.js:10763` (`rxNoTargetWhy` reads `modes` / `selfQ` / `gaQ` only); the fizzle is
  `engine/effects.js:7086`.
- **confidence:** high on the state (legal + card spent); medium on how the CR would phrase it.

## 3. Danger Digits + Mark of the Huntsman: the "destroy this and mark them" offer is answered AFTER the dagger was destroyed, and accepting marks for free

- **hero · card:** Arakni · Danger Digits → Mark of the Huntsman
- **printed:** Danger Digits "Target dagger you control … deals 1 damage to the defending hero. If damage is dealt
  this way, the dagger has hit. Destroy the dagger." Mark of the Huntsman: "When this hits a hero, you may choose to
  **destroy this** and **mark** them."
- **feed excerpt** (arakni v kayo seed `ar1`, turn 2, policy declines):
  ```
  Mark of the Huntsman counts as having HIT — its own on-hit abilities fire, though it never attacked.
  Mark of the Huntsman is destroyed — Danger Digits says so.
  Mark of the Huntsman is destroyed — it goes to Arakni's graveyard.
  Arakni kept Mark of the Huntsman rather than destroy it.        <- offered about a card already in the graveyard
  ```
- **what is wrong:** the offer is queued during the jab and drained after the jab's last sentence has already destroyed
  the dagger. If the seat ACCEPTS, `payCost` carries `destroyUid` of a card that is already in the graveyard,
  `applyAnswer`'s `gear.find(...)` finds nothing and silently destroys nothing, and the rider (mark) still resolves,
  while the feed says "destroyed Mark of the Huntsman — the rider resolves". An unpayable cost is paid for free
  (v2.04's rule: inert, never free). Whether the CR lets the dagger's trigger fire at all after it is destroyed is a
  ruling; what is certain is that the printed cost "destroy this" cannot be paid twice.
- **direction:** stronger (a free mark) when accepted + feed-text (claims a destroy that did not happen). The default
  policy declines, so self-play rarely reaches it; a human player at the table does.
- **repro:** saved as a scratch file in the repo root:
  ```js
  const SP=require("./tools/selfplay.js");
  let n=SP.match("arakni","kayo","ar1",1);
  for(let i=0;i<4000&&!n.over;i++){ let moved=false;
    for(const s of [0,1]){ let a=SP.SP.act(n,s); if(!a) continue; const p=n.prompt;
      if(p&&p.tag==="pay"&&/Mark of the Huntsman/.test(p.src||"")&&p.choice==null&&(p.side||0)===s){
        console.log("destroyUid already in graveyard:",n.sides[s].grave.some(c=>c.uid===p.destroyUid),
                    "| foe marked:",n.sides[1-s].marked);
        let m=SP.J.reduce(n,{t:"promptChoose",choice:"pay"},s).state; m=SP.J.reduce(m,{t:"promptConfirm"},s).state;
        console.log(m.feed.slice(-2).join(" / "),"| foe marked after:",m.sides[1-s].marked); process.exit(0); }
      const out=SP.J.reduce(n,a,s); if(out.error) continue; n=out.state; moved=true; break; }
    if(!moved) break; }
  ```
  prints `destroyUid already in graveyard: true | foe marked: false`, then
  `… destroyed Mark of the Huntsman — the rider resolves. / Kayo is marked … | foe marked after: true`.
- **engine site:** `engine/effects.js:5948-5953` (`if(r.destroy != null){ const piece = gear.find(...); if(piece){…} }` —
  a miss is silent and the rider proceeds); queued from `heroHitBy` (`engine/effects.js:~7494`) inside `jabResolve`
  (`~7520-7560`), whose own comment says the order is load-bearing; `payVerb` (`engine/prompts.js:1031`) words the
  line from the spec, not from what happened.
- **confidence:** medium (state is certain; the intended ruling for "dagger destroyed before its own trigger" is not
  sourced in the repo — the v4.38 comment wants the trigger offered, but not paid for with a card that is gone).

## 4. Feed leaks raw engine keys on every pick result: "Swift Shot → deckTop from grave."

- **hero · card:** Azalea (Memorial Ground); any pick with `to`/`zone`
- **printed:** "Put target attack action card with cost 2 or less from your graveyard on top of your deck."
- **feed excerpt:** `Swift Shot → deckTop from grave.` (azalea v kayo seed `a1`, turn 8; azalea v viserai seed `az3`, turn 3:
  `Murkmire Grapnel → deckTop from grave.`). Same shape for `→ hand from grave`, `→ banish from hand`, `→ deckBottom`.
  The sheet hint carries the same key: "From your grave → deckTop." (`prompts.js:492`).
- **what is wrong:** `to` and `zone` are state keys, not words (`deckTop`, `deckBottom`, `grave`). `promptZoneWord`
  exists for exactly this noun and is used by the hint's zone, not by the feed line or by the destination. The
  comment above the line (`prompts.js:1160`) even calls "→ deckTop" a contradiction under Topsy Turvy while the line
  still prints it in every other case.
- **direction:** feed-text
- **repro:** `node tools/` any azalea game; or `node -e 'const SP=require("./tools/selfplay.js");const r=SP.play(SP.match("azalea","kayo","a1"));console.log(r.game.feed.filter(l=>/→ \w+ from/.test(l)).join("\n"))'`
- **engine site:** `engine/prompts.js:1167-1169` (and `:492`)
- **confidence:** high

## 5. Start-of-turn trigger lines print BEFORE the turn header, so they read as the previous player's end phase

- **hero · card:** seen in every hero's feed when the opponent has a Might/Agility/Vigor token (Kayo's Might in azalea,
  arakni and blaze games); any `tickSuspense` / `armNextTurn` / `sweepArena(..., "turn")` line
- **feed excerpt** (azalea v kayo seed `a1`):
  ```
  (f) Azalea draws to intellect.
  Might crumbles at the top of the turn. It pays out as it goes.
  Next attack +1.
  — Kayo's turn 4 —
  ```
- **what is wrong:** the lines belong to Kayo's start phase but are said before the "— Kayo's turn N —" header, i.e.
  under the previous turn's end-phase steps (a)–(f). The sequence is the lesson in a training sim.
- **direction:** feed-text
- **repro:** the feed above; or `grep -B1 -A3 "crumbles at the top" ` on any feed that contains it.
- **engine site:** `engine/judge.js:3647` (`return say(n, "— … turn …")` runs after the thaw/arm/tick/sweep block at
  `~3612-3640`; the header should be said first)
- **confidence:** high

## 6. Equipment-ability feed says the effect first and "The piece shatters — cost paid." after it

- **hero · card:** Azalea / Arakni / Blaze — Blossom of Spring, Talismanic Lens, Prey Spotters, Danger Digits …
- **printed:** "**Action** - Destroy this: Gain {r}. **Go again**" (cost before colon, effect after)
- **feed excerpt:**
  ```
  Azalea plays Blossom of Spring — ability — activated.
  +1 resource.
  The piece shatters — cost paid.
  ```
  and worse in the forced Danger Digits path (arakni v dorinthea seed `ar2`, turn 1): "Mark of the Huntsman lashes
  out at Dorinthea for 1 … is destroyed — Danger Digits says so." precedes "The piece shatters — cost paid." (while the
  picked-target path prints the cost first, so the same card narrates in two orders).
- **what is wrong:** the destroy is a cost; the gear is only marked `destroyed` after `runOps` has already run, so
  during the effect the paid piece is still live (its Arcane Barrier, defence, `abilitiesLive` all still count).
- **direction:** feed-text; latent state ordering (no pool card observably depends on it today)
- **engine site:** `engine/effects.js:5244` (cost applied after the ops block)
- **confidence:** medium

## 7. Noop reasons printed to the feed leak engine voice: "off fx.noDrx", "cost read by the weapon reader"

- **hero · card:** Dorinthea (Wreck Havoc, Widowmaker via Azalea) — seen in Arakni, Azalea and Blaze feeds; every weapon swing
- **feed excerpt:** `Wreck Havoc: static — read in the reaction window, off fx.noDrx.` /
  `Widowmaker: static — read in the reaction window, off fx.noDrx.` /
  `Dawnblade: weapon attack ability — cost read by the weapon reader.` (every swing) /
  `Predatory Plating — ability: activation gate — checked before the ability can be used.`
- **what is wrong:** `runOps` prints a `noop` reason verbatim. `fx.noDrx` is a field name; "weapon reader" / "cost
  reader" / "reaction window, off …" are implementation notes, not game text. `test/noopvoice.test.js:54` bans
  `fxParse`/`classifyClause`/`runOps`/`execute(` but not a dotted `fx.` field, so the census is green.
- **direction:** feed-text
- **repro:** `node -e 'const SP=require("./tools/selfplay.js");const r=SP.play(SP.match("azalea","viserai","az3",1));console.log(r.game.feed.filter(l=>/fx\.|reader/.test(l)).slice(0,5).join("\n"))'`
- **engine site:** `engine/parser.js:3776` (`fx.noDrx`), `:721` (weapon reader), `:3672`, `:3146`; the missing pattern in `test/noopvoice.test.js:54`
- **confidence:** high

---

## Noted, not reported as findings

- **Mark never expires.** Every `marked` write is a set to true (`effects.js:2681`), none clears it: Arakni's Agents keep
  re-triggering "if an opponent is marked, you become a random Agent" and Black Widow/Funnel Web riders fire for the rest
  of the game. I could not source the real expiry rule from the repo (`tools/rulings.json`: "having a mark does nothing on
  its own"), so I am not claiming a deviation — worth a ruling.
- **Bare effect lines name no seat or source** ("+1 life.", "Ward 4.", "+1 resource.", "Azalea chose nothing.") — v5.08 fixed
  token lines only. Low.
- Arakni, Trap-Door's "when you become this" search is silent in the feed (recorded refusal in `parser.js:506`).
- The seat policy declines every optional sheet it cannot price (Bull's Eye Bracers, Death Dealer, Up Sticks and Run's
  retrieve, Blaze's hero ability): strategic, per brief. Forced-accept runs of those routes were all correct (see below).

## Verified correct (so nobody re-checks)

Forced-accept drives, state asserted: Azalea — Bull's Eye Bracers (arrow to arsenal face up, +1{p}), Death Dealer (put + draw
1, AP kept), Drop the Anchor / Lace with Frailty / Inertia / Bloodrot / Release the Tension (+3 and on-hit rider; 20 → 12
vs a 7+1 swing, hero tapped / token landed), Widowmaker's +3 against < 2 defenders, Crow's Nest aim counter, Spire Sniping
reorder, hero power bottom/top swap with dominate on arrows only. Blaze — energy counters per opt (Cindering Foresight p1/p2/p3
= 3/2/1, Whisper 4/3/2, Aether Spindle = damage dealt), hero ability on the opponent's turn (X = printed arcane, counters
spent, card banished, playable from banish at instant speed that turn only, refused the next turn), Amp/Crucible/Absorb
amounts. Arakni — Web of Deceit's +1{p}/go again only while she is Web of Deceit, Agent riders (Redback go again, Black Widow
double banish, Funnel Web arsenal banish), Concoct Disorder's two-put gate, Hyper Inflation tax and expiry, Stains cost
reduction, Danger Digits damage/life totals.

## Coverage

Games played: 9 required (azalea / arakni / blaze × kayo / dorinthea / viserai; seeds `a1`,`az2`,`az3`; `ar1`,`ar2`,`ar3`;
`bl1`,`bl2`,`bl3`; first seat alternating) + 6 extra azalea games (seeds `x1`–`x6` vs kayo, viserai, dorinthea, boltyn, fai,
gravy) + ~20 targeted drives (forced accepts, state edits, AP traces; seeds `ac1`–`ac3`, `bl2`–`bl5`, `cs1`).
Feed lines read: ≈ 3,000 (9 games, read in full or with end-phase boilerplate filtered) + ≈ 2,750 (6 extra azalea games, read
via targeted excerpts of every pump/grant/arsenal/token line).
