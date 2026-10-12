# Feed read, group B — dash · dorinthea · enigma (engine v5.08)

Read-only audit. Nine self-play games read line by line (3 heroes × 3 opponents),
every candidate traced to a code site and driven to a wrong STATE (not just a feed
line). Repro scripts are in the appendix; paste each into a file in a scratch dir and
run it from the repo root (they `require` `/home/user/dawnblade-ai/…` — change `R`
if the checkout lives elsewhere).

Eight findings, ordered by confidence. 1–2 sit in shared engine code reached through
group-B games but belong to other heroes' cards (Kayo's Pulping, Azalea's/Ranger Bolt'n' Shot).

---

## 1. A late "go again" is computed and then thrown away at the table  — HIGH
- **Hero/card:** (seen in dash, dorinthea, enigma games as the opponent) Kayo · **Pulping**; same path for **Bolt'n' Shot**
- **Printed:** Pulping — *"If this is defended by fewer than 2 non-equipment cards, it gets **go again**."*
- **Feed:** `Pulping: defended by fewer than 2 non-equipment cards — go again!` … `Pulping resolves for 3.` … `Kayo passes the turn.` — no `Go again — action point kept.` line (compare Bare Fangs / Wild Ride, which print it). Seen in dash-kayo T3/T7, dorinthea-kayo T5, enigma-kayo T5.
- **Wrong:** `linkPumps` sets `pend.ga = true` for the late conditions (`LATE_CONDS`: `defLt2` → `["ga"]`, `pumped` → `["ga"]`), but `judge.strike` then rebuilds `pend` from the pre-pump `link`, dropping it. Action point is never granted at the table. Driven: control with 2 declared blockers → ap 0 (correct); 1 declared blocker → ap **0** (should be 1). Patching `ga: n.pend.ga` into that rebuild in a scratch copy makes the 1-blocker case read ap 1 and leaves the 2-blocker case at 0. (`_struck`, also written in `linkPumps`, is dropped by the same line.) Pool records affected: exactly the two cards with a late `ga` op — Pulping and Bolt'n' Shot (enumerated via `fxParse` over the pinned pool).
- **Direction:** weaker (printed action point lost, on the CR-exact board only).
- **Repro:** appendix A (`pulp.js`; scenario A).
- **Site:** `engine/judge.js:2200` (`n = {...n, pend: {...link, dealt…}}` after `pre = linkPumps…` at 2127–2135); writer `engine/effects.js:7389`.
- **Confidence:** high.

## 2. A played defense reaction is in the wall but not in any "defended by / defended with" count — HIGH (state), MEDIUM (rules reading)
- **Hero/card:** Dorinthea · **Ironsong Response / Overpower / Out for Blood / Stroke of Foresight / Courageous Steelhand** (Reprise); Kayo · **Pulping**; Azalea · **Widowmaker** ("fewer than 2 cards", though that card also bars DRs)
- **Printed:** Overpower — *"**Reprise** - If the defending hero has defended with a card from their hand this chain link, instead it gets +6{p}."* Pulping — *"…defended by fewer than 2 non-equipment cards…"*
- **Feed (driven):** DR only — `Sigil of Suffering answers at instant speed — +4 defence.` / `Dorinthea plays Overpower.` / `Overpower: reprise needs a card from hand to have met the attack — none did.` / `Overpower on the stack (+4).` With a declared blocker instead: `Reprise — 1 card from hand met the attack.` / `(+6)`.
- **Wrong:** `judge.declaredWall` (reprise) and `strike`'s `handBlockers` (defLt2/defLt2any) count only `blockH`/`blockG`. A defense reaction played from hand goes to `blockRx`, which is added to `wall` (so it defends — "Wall of 6 — Raging Onslaught 3, Frailty Trap 3 — stops 6") but to none of the counts. Pulping with 1 declared + 1 DR scores "fewer than 2" and (modulo finding 1) goes again; with 2 declared it is denied — same wall, different answer.
- **Direction:** reprise → weaker for the attacker; defLt2 → stronger for the attacker. Both wrong if a played DR is a defending card, which the engine itself already assumes when it adds its defence to the wall. I could not open the CR from this sandbox, so the rules reading is medium.
- **Repro:** appendix B (`rep.js`, Dorinthea Overpower) and appendix A scenario C.
- **Site:** `engine/judge.js:2275-2282` (`declaredWall`), `engine/judge.js:2034, 2071, 2088-2091, 2129` (`strike`: `blockRx` summed into `wall` at 2088 but not into `handBlockers`/`defenders`).
- **Confidence:** high that it is inconsistent; medium that the CR agrees with "counts".

## 3. Dash's starting item enters with no counters and no clock — HIGH
- **Hero/card:** Dash · **Hyper Driver** / **Boom Grenade** (whichever cost ≤2 item the shuffle puts first)
- **Printed:** Dash — *"You may start the game with a Mechanologist item with cost 2 or less in the arena."* Hyper Driver — *"This enters the arena with 3 steam counters. … Once per turn, when you **boost** a card, remove a steam counter from this and gain {r}."* Boom Grenade — *"**Crank** … This enters the arena with a steam counter. At the start of your turn, destroy this unless you remove a steam counter from it."*
- **Feed:** dash-lyath (Dash second): Boom Grenade is never destroyed or ticked at Dash's turn starts 2, 4, 6; it only leaves when it goes off at T6 (`Boom Grenade goes off — Rev Up connected`). In a fresh match `board[0]` is `{card, kind:"item", spent:false, uid}` — no `sd`, no entry in `sd.counters`.
- **Wrong:** `build.js` places the item with a bare entry. (a) Hyper Driver: no steam counters, so a boost yields no {r} — driven: boost Zero to Sixty, `res 0 -> 0`, `counters {}`; printed is up to 3 {r}. (b) Boom Grenade: no steam counter and no `sd:"turn"` stamp, so `sweepArena(…,"turn")` never touches it (3 sweeps → still on the board) — the printed "destroy this unless…" drawback never applies, and the Grenade waits for a hit indefinitely. A hand-played copy gets both (`execute`, `effects.js:5330`).
- **Direction:** Hyper Driver weaker; Boom Grenade stronger (its drawback is skipped). Whether a game-start placement counts as "enters the arena" is a ruling I could not source here; the engine already treats the placement as the card being in the arena, and v3.07 documents the same missing-`sd` failure for tokens.
- **Repro:** appendix C (`hd.js`, Hyper Driver) and appendix D (`bg.js`, Boom Grenade; seed `s3`, Lyath first).
- **Site:** `engine/build.js:829-833` (entry built), `engine/judge.js:698` (placed on `board`); contrast `engine/effects.js:5315,5330`.
- **Confidence:** high on the state; medium on the rules reading.

## 4. Run Through's "your NEXT sword attack" rider pumps the attack it was played on — MEDIUM
- **Hero/card:** Dorinthea · **Run Through** (all pitches)
- **Printed:** *"Target sword attack gets **go again**. Your next sword attack this turn gets +3{p}."*
- **Feed:** `Run Through on the stack (+2).` … `Dawnblade resolves for 5 (+2 reactions).` (dorinthea-lyath T8, dorinthea-viserai T3; second swing in the latter then resolves for the bare 3).
- **Wrong:** `fxParse` reads the second sentence as `["buffNext", N, {sword}]`; `attackRx` pumps the targeted attack with it (rx layer `pump: 2`, `buffQ` stays `[]`). The target is already declared, so "next" can only be a later sword attack — and Dorinthea's hero ability hands her exactly that second swing. Driven: `pend.total 3`, stack `[{k:"rx", pump:2}]`, `sides[0].buffQ []`.
- **Direction:** mis-timed. Stronger when no later sword attack follows, weaker when one does (the +N is lost from the swing that carries it). Same total for a lone swing.
- **Repro:** appendix E (`rt.js`).
- **Site:** `engine/effects.js:6921` (`attackRx`) and the v3.11 comment block at `effects.js:~5118-5130`.
- **Confidence:** medium (by-design v3.11 rule "a reaction pumps the attack it is played on" applied to a card whose text says otherwise).

## 5. Counters put on an attacking aura after it is declared never reach that attack — MEDIUM
- **Hero/card:** Enigma · **Astral Etchings** / **Uphold Tradition** onto a Cosmo-armed aura (Spectral Shield, Waxing Specter…)
- **Printed:** Astral Etchings — *"Put three +1{p} counters on target aura with ward you control. If you control a Spectral Shield, you may play this as though it were an instant."* Cosmo — *"auras you control with ward are weapons with base {p} equal to their ward…"*
- **Feed:** `Enigma attacks with Spectral Shield for 1.` / `Enigma plays Astral Etchings.` / `Spectral Shield takes 3 +1{p} counters — now 3.` / `Spectral Shield resolves for 1.` (enigma-kayo T24, enigma-viserai T25 and T35). The next turn the same aura "carries +N{p} in counters — it swings at N+1".
- **Wrong:** `powCtr` is read once, at declaration (`effects.js:4502-4530`), and folded into `pend.total`; nothing re-reads the aura's counters at the damage step. Driven: Shield declared (pend.total 1), Etchings resolved (counters `{sh1:{pow:3}}`), `pend.total` still 1, opponent hp 19.
- **Direction:** weaker — the instant-speed clause on Etchings is how the card is meant to be used mid-swing. Medium because I cannot source whether a counter added after declaration modifies an attack already on the chain.
- **Repro:** appendix F (`ae.js`).
- **Site:** `engine/effects.js:4502-4530`.
- **Confidence:** medium.

## 6. An activated ability with a printed target is activated and paid with no target — MEDIUM-LOW
- **Hero/card:** Enigma · **Uphold Tradition**
- **Printed:** *"**Instant** - {r}, turn this face-up: Put a +1{p} counter on an aura you control with **ward**."*
- **Feed:** `Uphold Tradition — ability costs 1 and Enigma holds 0 — pitch, or cancel.` / `Pitched Unmovable for 3.` / `Uphold Tradition is turned face-up — the rest of the cost is paid.` / `Uphold Tradition — ability: Enigma controls nothing that can take a +1{p} counter.` (enigma-viserai T1; Enigma has no aura).
- **Wrong:** v5.07 made `playTargetWhy` refuse a *played card* whose whole payload is an unfillable target, and v4.59 refuses an activation's unfillable *pick*; an activation whose payload is a `ctrPut` is asked by neither (`abCostWhy` has no `ctrPutCands` branch). `judge.legal` answers `null`; a card is pitched and the piece flipped for a log line. Mitigation: flipping turns its Ward 1 on (v4.94), so this is not strictly nothing — but the printed effect is.
- **Direction:** weaker (cost paid for no effect; policy-reachable).
- **Repro:** appendix G (`uph.js`).
- **Site:** `engine/judge.js:157-260` (`abCostWhy`), reader `engine/effects.js:10692` (`ctrPutCands`).
- **Confidence:** medium-low.

## 7. Tokens sit in graveyards and Pass Over can banish them — LOW-MEDIUM
- **Hero/card:** Enigma · **Pass Over** (and anything that reads a graveyard)
- **Printed:** *"Banish target card from an opposing hero's graveyard."* A token that leaves the arena ceases to exist.
- **Feed:** `Might chosen.` / `Enigma takes Might from Lyath Goldmane's graveyard — out of the game.` (enigma-lyath T7). End state of that game: Lyath's graveyard holds 12 Might tokens, Enigma's a Spectral Shield; dash-lyath: 14 Might + Confidence.
- **Wrong:** CHANGELOG v2.56 (the crumbling tokens) states the token-in-graveyard display difference as harmless because *"nothing reads them there"*. Pass Over reads that zone and offers tokens as targets (they are the first candidates), so a Legendary Mystic instant is spent — and its transcend still triggers — on a card that does not exist.
- **Direction:** feed-text / state difference with a rules consequence (a nonexistent target is legal).
- **Repro:** appendix H (`tokg.js`) prints tokens-in-grave counts; the Pass Over line is in `enigma-lyath`, seed `s3`, Lyath first.
- **Site:** `engine/effects.js:8296-8303` (comment records the premise), `engine/effects.js:3242`; zone filing in `sweepArena`.
- **Confidence:** medium that it is wrong, low impact.

## 8. Two feed lines — LOW
a) **Engine identifier in the feed.** Dorinthea · Wreck Havoc: `Wreck Havoc: static — read in the reaction window, off fx.noDrx.` (dorinthea-kayo T6/T8, dorinthea-viserai T17). Direction: feed-text. Site: `engine/parser.js:3776` (the noop reason; the v4.24 `noopvoice` census evidently does not flag a dotted field name).
b) **Stray enter-clause condition on an aura attack.** Enigma · Waxing Specter: `Waxing Specter: condition not met (no blue card in Enigma's pitch zone).` printed every time the Specter *attacks* as a Cosmo weapon (enigma-lyath T6/T8, enigma-viserai T3). That is the *"enters the arena with a +1{p} counter"* clause being evaluated at attack time. State is unaffected — when the pitch zone does hold a blue card (enigma-lyath T12, Pitched Manifest Muscle for 3) no line prints and the counters stay at +5 — so it is feed noise that tells the player a condition failed that the card never asks. Direction: feed-text. Site: `engine/effects.js:3019` (`condWhy` for `pitchBlue1`) reached from `execute`'s condition loop on `from:"aura"`.

---

## Checked and clean (no finding)
Cosmo (aura base = ward, go again only with counters, first-Shield-attack discount), Waning Vengeance/Waxing Specter (ward, blue-pitch gates, Shield mint), Spectral Manifestations (3/2 counters only with no other Illusionist aura), phantasm pops (Chimera, Haze; the non-pop of a 5-power Clash of Might is consistent with Kayo's +1 not applying on the chain), transcend (Homage → Inner Chi, Chi pays a resource), Look Tuff, Preserve Tradition, Rising Sun, Dawnblade counters (second hit per turn, end-phase wipe, hero's extra swing), Refraction Bolters, Wreck Havoc payload, Overpower replace-not-add, Puncture piercing note, Talishar rust, Under Loop bottoming, Boom Grenade 4 damage on a hit, Walk in My Shoes halving window, Zipper Hit/Throttle printed powers.

## Coverage
Games played: 9 — dash v kayo (s1), v viserai (s2), v lyath (s3); dorinthea v kayo (s1), v viserai (s2), v lyath (s3); enigma v kayo (s1), v viserai (s2), v lyath (s3). Chairs alternated (`first` = seed index mod 2). Feed lines read: 5,213 (556 + 511 + 711 + 285 + 393 + 225 + 692 + 998 + 842), end-phase boilerplate skimmed, everything else read; plus ~12 minimal driven repros. Not covered: boost accepted by Dash (the seat policy declines it every time, so the boost-pay path is untested here), Hyper Driver played from hand, Dorinthea's second-swing ladder past two hits, Silent Stilettos (never worn).

---

## Appendix — repro scripts
(Each is self-contained; run from the repo root with `node file.js`. Scratch copies used a `R` constant for the repo path.)

### A — `pulp.js`
```js
const R="/home/user/dawnblade-ai/";
const J=require(R+"engine/judge.js"),C=require(R+"engine/cards.js"),H=require(R+"test/helpers/judged.js");
const DB=H.db();
const mk=(n,p,uid)=>Object.assign({},C.resolveEntry(DB,{name:n,p,code:null,q:1}),{uid});
function run(label, declared, useDR){
  let g=J.newMatch({builds:[null,null],names:["A","B"],heroKeys:[null,null],seed:"pulp"});
  const pulp=mk("Pulping",1,"atk1");
  g.sides[0].hand=[pulp];g.sides[0].ap=1;g.sides[0].res=9;g.sides[0].gear=[];
  const dec=declared.map((n,i)=>mk(n,1,"b"+i));
  const dr=useDR?mk("Frailty Trap",1,"dr1"):null;
  g.sides[1].hand=[...dec,...(dr?[dr]:[])];g.sides[1].res=9;g.sides[1].gear=[];g.sides[1].hp=20;
  g.phase="action";g.step="layer";g.priority=0;g.turnPlayer=0;
  let apAtClose=null;const send=(a,s)=>{const r=J.reduce(g,a,s);if(r.error){return r.error}g=r.state;if(apAtClose===null&&g.step==='layer'&&g.turn===1&&!g.pend&&g.chainCards&&g.chainCards.length===0&&a.t==='pass'&&g.sides[0].hand.length===0)apAtClose=g.sides[0].ap;if(process.env.TR)console.log("   ",JSON.stringify(a),"-> step",g.step,"turn",g.turn,"ap0",g.sides[0].ap,"pend.ga",g.pend&&g.pend.ga);return null};
  let e=send({t:"play",uid:"atk1",from:"hand"},0); if(e) return console.log(label,"play refused",e);
  let drDone=false,declared2=false;
  for(let i=0;i<30&&!g.over&&g.step!=="close";i++){
    if(g.step==="defend"&&!declared2){ declared2=true; for(const d of dec){ e=send({t:"defend",uid:d.uid},1); if(e) console.log("defend refused",e); } }
    if(dr&&g.step==="reaction"&&g.priority===1&&!drDone){ e=send({t:"play",uid:"dr1",from:"hand"},1); drDone=!e; if(e) console.log("DR refused",e); if(!e) continue; }
    if(g.priority==null)break;
    e=send({t:"pass"},g.priority); if(e) {console.log("pass refused",e);break}
  }
  const f=g.feed.filter(x=>/Pulping|go again|fewer/i.test(x));
  console.log(label,"| seat0 ap right after the link resolves:",apAtClose,"| hp B",g.sides[1].hp);
  console.log("   ",f.join(" || "));console.log("   ", g.feed.slice(-6).join(" || "));
}
run("A: 1 declared blocker, no DR (control, expect go again)",["Raging Onslaught"],false);
run("B: 2 declared blockers (control, expect NO go again)",["Raging Onslaught","Brutal Assault"],false);
run("C: 1 declared + 1 defense reaction played",["Raging Onslaught"],true);
```

### C — `hd.js`
```js
const R="/home/user/dawnblade-ai/";
const SP=require(R+"tools/selfplay.js"),J=SP.J;
let g=SP.match("dash","kayo","s1",0);
const s0=g.sides[0];
console.log("phase",g.phase,g.step,"turnPlayer",g.turnPlayer,"ap",s0.ap,"res",s0.res);
console.log("driver counters:",JSON.stringify((s0.counters||{})[s0.board[0].uid]),"board",s0.board.map(b=>b.card.name));
const z=s0.hand.find(c=>c.name==="Zero to Sixty");
console.log("hand",s0.hand.map(c=>c.name+"/"+c.pitch+"/"+c.cost).join(", "));
// move to action phase with ap
let r=J.legal? null:null;
// try play
const tryPlay=(g,a)=>J.reduce(g,a,0);
let o=tryPlay(g,{t:"play",uid:z.uid,from:"hand"});
console.log("play",o.error||"ok", o.state&&o.state.pending&&o.state.pending.kind);
if(o.state){ g=o.state; if(g.pending&&g.pending.kind==="boost"){ g.sides[0].deck.slice(0,1).forEach(c=>console.log("top",c.name)); const res0=g.sides[0].res; o=J.reduce(g,{t:"boost",yes:true},0); console.log("boost",o.error||"ok"); g=o.state||g;
 const s=g.sides[0]; console.log("after boost: driver on board?",s.board.map(b=>b.card.name),"counters",JSON.stringify(s.counters),"res",res0,"->",s.res);
 console.log((g.feed||[]).slice(-12).join("\n")); } }
```

### D — `bg.js`
```js
const R="/home/user/dawnblade-ai/";
const SP=require(R+"tools/selfplay.js");
const E=require(R+"engine/effects.js");
let g=SP.match("dash","lyath","s3",1);
const s=g.sides[0];
console.log("start item:",s.board.map(b=>b.card.name+" sd="+b.sd+" counters="+JSON.stringify((s.counters||{})[b.uid])));
const sweep=(g)=>E.sweepArena(g,0,"turn");
let out=sweep(g);
console.log("start-turn sweep x1 ->fired",JSON.stringify(out.fired),"board",out.game.sides[0].board.map(b=>b.card.name));
out=sweep(out.game);out=sweep(out.game);
console.log("after 3 sweeps board",out.game.sides[0].board.map(b=>b.card.name));
```

### B — `rep.js`
```js
const R="/home/user/dawnblade-ai/";
const SP=require(R+"tools/selfplay.js"),J=SP.J,H=require(R+"test/helpers/judged.js");
function run(label, defDeclared){
  let g=SP.match("dorinthea","viserai","r1",0);
  const op=Object.assign({},H.card("Overpower",1),{uid:"op1"});
  const sig=Object.assign({},H.card("Sigil of Suffering",1),{uid:"sg1"});
  const blk=Object.assign({},H.card("Raging Onslaught",1)||{},{uid:"bk1"});
  g.sides[0]={...g.sides[0],hand:[op],res:9,ap:1};
  g.sides[1]={...g.sides[1],hand:[sig,...(defDeclared?[blk]:[])],gear:[],res:9,hp:20,blockH:[],blockG:[]};
  g={...g,phase:"action",step:"layer",priority:0,turnPlayer:0};
  const send=(a,s)=>{const r=J.reduce(g,a,s);if(r.error){console.log(" REFUSED",JSON.stringify(a),r.error);return false}g=r.state;return true};
  const blade=g.sides[0].gear.find(x=>/Dawnblade/.test(x.name));
  send({t:"activate",uid:blade.uid,from:"gear",target:"hero"},0);
  let k=0;
  while(g.step!=="reaction"&&k++<12){ if(g.step==="defend"&&defDeclared&&!g._d){g._d=1;send({t:"defend",uid:"bk1"},1);} if(!send({t:"pass"},g.priority))break; }
  console.log(label,"step",g.step,"prio",g.priority);
  // seat1 (defender) plays DR; priority order in reaction: turn player first
  if(g.priority===0) send({t:"pass"},0);
  if(g.priority===1) send({t:"play",uid:"sg1",from:"hand"},1);
  // now seat0 plays Overpower
  while(g.priority!==0&&k++<30){ if(!send({t:"pass"},g.priority))break; }
  send({t:"play",uid:"op1",from:"hand"},0);
  while(g.pending&&g.pending.kind==="pay"){ if(!send({t:"payConfirm"},0))break; }
  console.log(g.feed.filter(x=>/reprise|Overpower|Sigil/i.test(x)).slice(-6).join("\n"));
}
run("CONTROL declared blocker only",true);
run("DR from hand only",false);
```

### E — `rt.js`
```js
const R="/home/user/dawnblade-ai/";
const H=require(R+"test/helpers/judged.js"),J=require(R+"engine/judge"),P=require(R+"engine/parser.js");
H.db();
const sword={...H.card("Dawnblade",0),uid:"w1"};
const rt=H.card("Run Through",2);
const fx=P.fxParse(rt);console.log("ops",JSON.stringify(fx.ops),"self",fx.self,"ga",fx.ga);
const g={...H.state({hand:[],res:9},{},{turn:3,actor:0}),pend:{card:sword,by:0,total:3,ga:false,ops:[],onHit:[]},stack:[]};
const out=J.withEffects(g,(f,s)=>f.attackRx(s,rt,{handBlockers:0}).game);
console.log("pend.total",out.pend.total,"ga",out.pend.ga,"stack",JSON.stringify(out.stack.map(x=>({k:x.k,amt:x.amt,pump:x.pump,label:x.label}))));
console.log("sides[0].buffQ",JSON.stringify(out.sides[0].buffQ),"buffNext",out.sides[0].buffNext);
```

### F — `ae.js`
```js
const R="/home/user/dawnblade-ai/";
const SP=require(R+"tools/selfplay.js"),J=SP.J,H=require(R+"test/helpers/judged.js"),C=require(R+"engine/cards.js");
let g=SP.match("enigma","kayo","s1",0);
const s=g.sides[0];
const shield=Object.assign({},H.tok("Spectral Shield"),{uid:"sh1"});
const ae=Object.assign({},H.card("Astral Etchings",1),{uid:"ae1"});
g.sides[0]={...s,board:[{card:shield,kind:"token",spent:false,uid:"sh1"}],hand:[ae],res:5,ap:1,counters:{}};
g.sides[1]={...g.sides[1],hand:[],gear:[],hp:20};
g={...g,phase:"action",step:"layer",priority:0,turnPlayer:0};
const send=(a,seat)=>{const r=J.reduce(g,a,seat);if(r.error){console.log("REFUSED",JSON.stringify(a),r.error);return false}g=r.state;return true};
const act=J.boardAttackOf?J.boardAttackOf(g,0,"sh1"):null;
console.log("boardAttackOf",JSON.stringify(act&&{from:act.from,cost:act.cost}));
send({t:"activate",uid:"sh1",from:"aura",target:"hero"},0);
console.log("after declare: pend.total",g.pend&&g.pend.total,"step",g.step,"counters",JSON.stringify(g.sides[0].counters));
console.log("step",g.step,"prio",g.priority,"res",g.sides[0].res);
let k=0;while(!g.pend&&k++<6){const p=g.priority;if(p==null||!send({t:"pass"},p))break;}
console.log("step",g.step,"prio",g.priority,"pend.total",g.pend&&g.pend.total,"res",g.sides[0].res);
while(g.priority!==0&&k++<12){if(!send({t:"pass"},g.priority))break;}
console.log("step",g.step,"prio",g.priority);
send({t:"play",uid:"ae1",from:"hand"},0);
while(g.pending&&g.pending.kind==="pay"){ if(!send({t:"payConfirm"},0))break; }
if(g.prompt){console.log("prompt",g.prompt.tag);}
console.log("after Astral Etchings: pend.total",g.pend&&g.pend.total,"counters",JSON.stringify(g.sides[0].counters), "stack",g.stack&&g.stack.length);
let i=0;while(g.pend&&i++<20){ if(g.priority==null)break; const p=g.priority; if(!send({t:"pass"},p))break; }
console.log("opp hp",g.sides[1].hp,"(20 start)");
console.log(g.feed.filter(x=>/Shield|Etchings|power/.test(x)).slice(-8).join("\n"));
```

### G — `uph.js`
```js
const R="/home/user/dawnblade-ai/";
const SP=require(R+"tools/selfplay.js"),J=SP.J;
let g=SP.match("enigma","kayo","s1",1);
const s=g.sides[0];
const up=s.gear.find(x=>x.name==="Uphold Tradition");
console.log("Uphold:",up&&up.uid,"faceDown",up&&up._faceDown,"board auras:",s.board.length,"res",s.res,"hand",s.hand.length);
// move to action phase of seat 0 with priority
g={...g,phase:"action",step:"layer",priority:0,turnPlayer:0};
const cands=["activate","play"];
let r=J.legal?J.legal(g,{t:"activate",uid:up.uid,from:"gear"},0):null;
console.log("legal(activate)=",r);
const out=J.reduce(g,{t:"activate",uid:up.uid,from:"gear"},0);
console.log("reduce error:",out.error);
if(out.state){let st=out.state;console.log("pending",st.pending&&st.pending.kind);
 const feed=st.feed.slice(-6);console.log(feed.join("\n"));}
```

### H — `tokg.js`
```js
const R="/home/user/dawnblade-ai/";
const SP=require(R+"tools/selfplay.js");
for(const [a,b,s,f] of [["enigma","lyath","s3",1],["dash","lyath","s3",1],["dorinthea","kayo","s1",1]]){
const r=SP.play(SP.match(a,b,s,f));const g=r.game;
for(const i of [0,1]){const gr=g.sides[i].grave;const tk=gr.filter(c=>/Token/.test(c.tt||"")||/token/i.test(c.tt||""));
console.log(a,b,"seat",i,"grave n",gr.length,"tokens in grave:",tk.map(c=>c.name).join(", ")||"none");}
}
```

