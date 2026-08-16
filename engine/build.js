/* ============================================================
   Dawnblade engine — build.js (Phase 1)

   HOW A SEAT BECOMES A HERO.

   Everything here used to live in index.html: `buildSide` at 1847, the
   equipment slot rules at 4527. Both are RULES — `buildSide` reads a
   hero's printed passives off its own text, resolves every printing, and
   deals the opening deck from the seeded stream; `defaultPicks` decides
   how many pieces of iron a hero may legally wear. Neither had a drill,
   because inside the trainer no drill could reach them.

   That cost a real bug in v2.41. The opponent was equipped by passing
   `{}` for its loadout, which handed Azalea all EIGHT printed pieces
   where the slot rules allow about five — and since `chainBlocked` only
   stops a piece re-blocking the SAME chain, every extra piece was another
   free block later in the turn. Every card was read correctly; the
   QUANTITY was illegal, which is a question neither `npm run audit` nor
   `npm run fairness` asks. Only opening the game and reading the dealt
   state found it.

   One set of slot rules, in one file, reachable by a drill, applied to
   both seats. That is the whole point of moving it.

   ---- SYMMETRY IS THE CONTRACT ----------------------------------------

   `buildSide` takes a hero and returns a build. It has no idea which seat
   it is filling and there is no seat argument. Seat 0 and seat 1 are the
   same call with different arguments, which is what makes a second human
   — or a second hero — cost nothing at all.

   PURITY: the only randomness is the `rng` handed in, and the shuffled
   stream is returned beside the build so the caller can thread it on
   (rng.js's rule: store it back, or the next draw repeats).
   ============================================================ */
(function(root, factory){
  if(typeof module==="object" && module.exports)
    module.exports = factory(require("./parser.js"), require("./cards.js"),
                             require("./game.js"), require("./rng.js"));
  else root.DawnBuild = factory(root.DawnParser, root.DawnCards, root.DawnGame, root.DawnRNG);
})(typeof self!=="undefined" ? self : this, function(PR, CD, GM, RNG){

const {clean, isWeapon, weaponCost, isAttack, fxParse, hasKw, parseHeroPower, ARS_PUT} = PR;
const {resolveEntry, resolveHero, cdnImg} = CD;
const {slotOf} = GM;

/* ---- the equipment slots (official zones) -----------------------------
   Four armour slots and two hands. A quiver is free but needs a bow in
   those hands to hang arrows on. */
const ARMOR_Z = ["head","chest","arms","legs"];
const HAND_Z  = ["1h","2h","off","qvr"];

/* `list` is [{i, c, s}] — an index, the resolved card, and its slot.
   `gearSlots` builds it so no caller has to remember the shape. */
const gearSlots = cards => (cards||[]).map((c,i)=>({i, c, s:slotOf(c)}));

/* Toggle piece `i` in `sel`, evicting whatever it displaces. This is the
   legality of a loadout expressed as a transition rather than a checker,
   which is what lets the loadout screen and the auto-equipper share it. */
function applyPick(list, sel, i){
  const item = idx => list.find(x=>x.i===idx);
  if(sel.includes(i)){
    let out = sel.filter(x=>x!==i);
    /* dropping the two-hander drops the quiver with it — a quiver with no
       bow to hang on is not a legal board */
    if(item(i).s.z==="2h") out = out.filter(x=>item(x).s.z!=="qvr");
    return out;
  }
  const s = item(i).s;
  let out = sel.slice();
  if(ARMOR_Z.includes(s.z) || s.z==="misc"){
    if(ARMOR_Z.includes(s.z)) out = out.filter(x=>item(x).s.z!==s.z);
    const armorN = out.filter(x=>ARMOR_Z.includes(item(x).s.z)||item(x).s.z==="misc").length;
    if(armorN>=4) return sel;
    return [...out,i];
  }
  if(s.z==="qvr"){
    out = out.filter(x=>item(x).s.z!=="qvr");
    if(!out.some(x=>item(x).s.z==="2h")) return sel;
    return [...out,i];
  }
  if(s.z==="2h"){
    out = out.filter(x=>!["1h","off"].includes(item(x).s.z));
    return [...out,i];
  }
  out = out.filter(x=>item(x).s.z!=="2h" && item(x).s.z!=="qvr");
  if(s.z==="off") out = out.filter(x=>item(x).s.z!=="off");
  let hands = out.filter(x=>["1h","off"].includes(item(x).s.z));
  hands.sort((a,b)=>(item(a).s.z==="off"?0:1)-(item(b).s.z==="off"?0:1));
  while(hands.reduce((a,x)=>a+item(x).s.h,0) + s.h > 2){ out = out.filter(x=>x!==hands[0]); hands = hands.slice(1); }
  return [...out,i];
}

/* A sensible legal loadout: the best armour in each slot, then the best
   weapon configuration the hands allow.

   ---- A BOW PRINTS NO POWER, AND THAT USED TO DISQUALIFY IT ------------

   This gated the two-hander on `twoH.c.power != null`. Azalea's Death
   Dealer is a `Ranger Weapon - Bow (2H)` with `power: null`, so she
   defaulted to NO WEAPON AND NO QUIVER — for the player's own loadout as
   much as the opponent's. The check was never doing any work: `slotOf`
   only returns `z:"2h"` for a printed `2H` type line, so anything in that
   list is already a two-handed weapon. It is gone.

   The sort is unchanged and still correct with bows in it: `power||0`
   ranks a printed sword above a powerless bow when a hero owns both, and
   picks the bow when it is the only two-hander on offer. */
function defaultPicks(list){
  let sel = [];
  ARMOR_Z.forEach(z=>{
    const best = list.filter(x=>x.s.z===z).sort((a,b)=>(b.c.def||0)-(a.c.def||0))[0];
    if(best) sel = applyPick(list, sel, best.i);
  });
  const twoH = list.filter(x=>x.s.z==="2h").sort((a,b)=>(b.c.power||0)-(a.c.power||0))[0];
  if(twoH){
    sel = applyPick(list, sel, twoH.i);
    const q = list.find(x=>x.s.z==="qvr"); if(q) sel = applyPick(list, sel, q.i);
  } else {
    list.filter(x=>x.s.z==="1h").sort((a,b)=>(b.c.power||0)-(a.c.power||0)).slice(0,2).forEach(x=>{ sel = applyPick(list, sel, x.i); });
    const off = list.filter(x=>x.s.z==="off").sort((a,b)=>(b.c.def||0)-(a.c.def||0))[0];
    if(off) sel = applyPick(list, sel, off.i);
  }
  return sel;
}

/* ---- the build --------------------------------------------------------
   `h` is the hero entry (name, key, printed code), `d` is its parsed deck
   definition, `db` the card database, `opts` the loadout choices, `rng`
   the seeded stream and `ctr` the shared uid counter.

   `d` is a PARAMETER rather than a lookup because that is the difference
   between a pure function and one that reads the trainer's module scope.
   Two seats, two decks, one function. */
function buildSide(h, d, db, opts, rng, ctr){
  const o = opts || {};
  const heroRec = resolveHero(db, d.hero) || {};
  const heroPow = heroRec.tx ? parseHeroPower(heroRec.tx) : null;
  const HPOW = heroPow ? {name:d.hero.name.split(",")[0]+" — hero power", pitch:0, cost:heroPow.cost, power:null, def:null,
    tt:"Hero Ability", kw:heroPow.ga?["Go again"]:[], tx:heroPow.eff, _instant:heroPow.kind==="instant", img:null, dbImg:null, uid:"hpow"} : null;
  const HZOOM = {name:d.hero.name, pitch:0, cost:null, power:null, def:null, tt:heroRec.tt||"Hero", kw:[],
    tx:heroRec.tx||"", img:cdnImg(d.hero.code), dbImg:heroRec.pr?heroRec.pr._first:null};
  const cuts = o.cuts||{};
  /* THIS HERO'S SILVER AGE SET, read off its own printed code (SAZ001 ->
     SAZ). Passed to every resolveEntry so a card wears the face it has in
     this deck's own precon rather than whatever printing the database
     happened to list first. See cards.js `pickPrinting`. */
  const saSet = (h.code||"").slice(0,3) || null;
  const _pd = RNG.shuffle(rng, d.deck.flatMap((e,ei)=>{
    const q = Math.max(0, e.q - (cuts[ei]||0));
    if(!q) return [];
    const c = resolveEntry(db,e,saSet);
    return Array.from({length:q},()=>({...c,uid:++ctr.n}));
  }));
  rng = _pd.rng;
  const deck = _pd.arr;
  const gearAll = d.gear.map((e,gi)=>({...resolveEntry(db,e,saSet),gi,uid:++ctr.n,used:false}));
  const gear = o.gearIdx ? gearAll.filter(x=>o.gearIdx.includes(x.gi)) : gearAll;
  gear.forEach(gr=>{
    if(isWeapon(gr) && gr.tx){ const wc=weaponCost(gr.tx);
      if(wc){ if(gr.cost==null) gr.cost=wc.cost; gr.addRust=wc.addRust; gr.needSteam=wc.needSteam; }
      if(/is equal to 1 plus the number of times you have boosted/i.test(gr.tx)) gr._powBoost=true;
      if(wc && wc.needSteam){ gr.pow=true; gr.powCard={name:gr.name+" — build steam",pitch:0,cost:2,power:null,def:null,tt:"Equipment Ability",kw:["Go again"],tx:"Action - {r}{r}: Put a steam counter on this. Go again.",_buildSteam:true,_steamFor:gr.uid,ga:true,img:gr.img,dbImg:gr.dbImg,_gearArt:true,uid:"gp"+gr.uid}; }
    }
    /* A WEAPON CAN CARRY A NON-ATTACK ACTIVATED ABILITY (v2.34). Death
       Dealer is a Bow whose printed ability puts an arrow face up into your
       arsenal — it is not a weapon attack, so `weaponCost` (which requires
       ": attack") never claimed it and the `!isWeapon` gate below skipped
       it, leaving the ability inert. The extra door is deliberately narrow:
       only an ability the arsenal reader actually recognises, so no other
       weapon quietly grows a second button nothing is wired to run. */
    const _armed = isWeapon(gr) && gr.tx && ARS_PUT.test(gr.tx);
    if((!isWeapon(gr) || _armed) && gr.tx){ const pw=parseHeroPower(gr.tx, true);
    if(pw){ gr.pow=pw;
    /* The ability's WHOLE printed line, not just its first sentence.
       Knucklehead reads "Action - Destroy this: Roll a 6-sided die. Until
       end of turn, your base {i} is the number rolled." — parseHeroPower
       stops at the period, which orphaned the rider so it never fired.
       Strip the cost prefix off the line and keep the rest. */
    const _abLine = (gr.tx||"").split(/\n+/).map(l=>clean(l))
      .find(l=>/^(?:once per turn )?(?:action|instant)\s*[-—]/i.test(l)) || "";
    const _effFull = _abLine.replace(/^[^:]*:\s*/, "") || pw.eff;
    gr.powCard={name:gr.name+" — ability",pitch:0,cost:pw.cost,power:null,def:null,
      tt:"Equipment Ability",kw:pw.ga?["Go again"]:[],tx:_effFull,sd:pw.sd,_instant:pw.kind==="instant",img:gr.img,dbImg:gr.dbImg,_gearArt:true,uid:"gp"+gr.uid}; } } });
  const _atk = deck.filter(isAttack);
  const _ga = deck.filter(c=>fxParse(c).ga).length;
  const _arc = deck.filter(c=>fxParse(c).ops.concat(fxParse(c).onHit).some(o2=>o2[0]==="arcane")).length;
  const _blue = deck.filter(c=>c.pitch===3).length;
  const _perm = deck.filter(c=>fxParse(c).perm).length;
  const _avg = _atk.length ? _atk.reduce((a,c)=>a+(c.power||0),0)/_atk.length : 0;
  const read = "Claude's read: "+_atk.length+" attacks avg "+_avg.toFixed(1)+" power, "+_ga+" go-again, "+_blue+" blue fuel"
    +(_arc?", "+_arc+" arcane":"")+(_perm?", "+_perm+" permanents":"")+". "+(function(){
      const cnt = k => deck.filter(c=>hasKw(c,k)).length;
      const soulN = deck.filter(c=>/into your (?:hero'?s? )?soul/i.test(c.tx||"")).length;
      const m = [["boost",cnt("boost")],["clash",cnt("clash")],["soul",soulN],["rune",deck.filter(c=>/runechant/i.test(c.tx||"")).length],["arcane",_arc],["ally",deck.filter(c=>fxParse(c).perm==="ally").length]].sort((a,b)=>b[1]-a[1])[0];
      const T = {boost:"Line: boost everything — each banish digs the deck and chains go again.",
        clash:"Line: bank blues, clash with fat tops, cash wins into free tempo.",
        soul:"Line: land hits to charge the soul, then spend it to break through.",
        rune:"Line: stack runechants on non-attacks, pop them all on one clean swing.",
        arcane:"Line: amp first, spell second — arcane ignores the iron.",
        ally:"Line: crew up early — every ally is free damage each turn after."};
      return (m && m[1]>=4) ? T[m[0]] : "Line: chain go again into your heaviest hit; block with threes.";
    })()+(heroPow?" Hero power online — "+heroPow.label+".":"");
  const hasBoost = deck.some(c=>hasKw(c,"boost"));
  /* THE HERO PASSIVES ARE PER-SIDE, and that is the point of this whole
     function. Read off THIS hero's printed text, so seat 1's Viserai
     conjures seat 1's runechants. */
  const _htx = clean(heroRec.tx||"").toLowerCase();
  const arsenalInstant = /play blue[^.]*non-attack[^.]*action cards from your arsenal as though/.test(_htx);
  const iceFrostbite = /ice card during an opponent.{0,4}turn.{0,4}create a frostbite/.test(_htx);
  const viseraiPassive = /whenever you play a runeblade card, if you.{0,15}played another.{0,8}non-attack.{0,8}action card this turn, create a runechant/.test(_htx);
  /* RULING 2026-07-25: "gravy bones' hero ability allows you to play watery
     grave cards" — and his printed text names the condition exactly:
     a blue card must have hit your graveyard this turn. */
  const wateryGrave = /if a blue card has been put into your graveyard this turn, you may play cards with watery grave from your graveyard/.test(_htx);
  /* LYATH: "Whenever the crowd boos you, create a Might token." */
  const lyathBoo = /whenever the crowd boos you, create a might token/.test(_htx);
  /* KAYO: "Attack action cards you own get +1{p} while they are in any zone
     other than the combat chain." Read the NUMBER off the text rather than
     hardcoding 1 — the clause names its own value, and inventing it here
     would be inventing card text. The combat-chain exclusion is what makes
     this a THRESHOLD rule and not a damage buff: see parser.zonePow, which
     is the only thing that consumes it. */
  const _offChain = _htx.match(/attack action cards you own get \+(\d+)\{p\} while they are in any zone other than the combat chain/);
  const atkPowOffChain = _offChain ? +_offChain[1] : 0;
  /* KAYO clause 3: "The first time you discard a card with 6 or more {p}
     during each of your action phases, create a Might token." A per-action-
     phase latch, not a per-turn one — RULING (user, 2026-08-08): a discard
     in the end phase or on the opponent's turn does NOT make Might. */
  const mightOnFirst6Discard = /the first time you discard a card with 6 or more \{p\} during each of your action phases, create a might token/.test(_htx);
  /* DORINTHEA: "Once per turn Effect - When a weapon you control hits, you
     may attack an additional time with that weapon this turn."

     This is her deck's engine the way Kayo's clause 2 was his: nearly every
     card in it either pumps a WEAPON attack or pays off a Reprise, and both
     want the blade swinging more than once.

     RULING (user, 2026-08-09): the ability waives the weapon's own "Once per
     Turn" limit and NOTHING ELSE. The additional activation is an ordinary
     action — it pays the weapon's printed {r} again and it spends an action
     point again. That is why the deck is dense with go again (Sharpen Steel,
     Warrior's Valor ×3, Hit and Run, Trot Along, Goblet of Bloodrun Wine):
     without one, the second swing has no action to spend.

     "That weapon" is literal — only the piece that hit is refreshed, so a
     hero holding two weapons does not get a free swing with the other. */
  const weaponRefresh = /when a weapon you control hits, you may attack an additional time with that weapon this turn/.test(_htx);
  let startItem = null;
  if(/start the game with a mechanologist item with cost 2 or less/.test(_htx)){
    const ii = deck.findIndex(c=>/\bitem\b/i.test(c.tt||"") && (c.cost||0)<=2);
    if(ii>=0){ startItem = {card:deck[ii], kind:"item", spent:false, uid:deck[ii].uid}; deck.splice(ii,1); }
  }
  return {b:{deck,gear,hasBoost,read,heroPow,HPOW,HZOOM,heroRec,
    arsenalInstant,iceFrostbite,viseraiPassive,wateryGrave,lyathBoo,startItem,
    atkPowOffChain,mightOnFirst6Discard,weaponRefresh,
    hp:heroRec.hp!=null?heroRec.hp:20, int:heroRec.int!=null?heroRec.int:4}, rng};
}

/* Equip a hero to a legal default loadout and build it. The two seats
   differ only in their arguments — there is deliberately no seat index
   here, and no branch for "the opponent". */
function buildSideDefault(h, d, db, rng, ctr){
  const saSet = (h.code||"").slice(0,3) || null;
  const slots = gearSlots(d.gear.map(e => resolveEntry(db, e, saSet)));
  return buildSide(h, d, db, {gearIdx: defaultPicks(slots)}, rng, ctr);
}

/* ---- BOTH SEATS, FROM A SPEC AND A SEED (Phase 2) ---------------------

   The lobby agrees on four small values — two hero keys, two loadouts, a
   seating call and the table code. This is what turns them into two real
   hero decks, and the property that matters is that it does so
   IDENTICALLY ON BOTH PHONES. Nothing about a card crosses the wire: each
   peer runs this over its own card database and arrives at the same
   state, which is rng.js's own stated goal ("both peers derive the same
   seed from the same room code without exchanging it") applied to the
   whole opening rather than to one shuffle.

   Three things make it deterministic, and each is a real way to break it:

   1. THE STREAM IS SEAT-SPECIFIC. One stream for both seats deals seat 1
      the continuation of seat 0's shuffle — reproducible, but it means a
      change to seat 0's cuts silently reshuffles seat 1's deck.
   2. THE UID COUNTER IS SHARED AND THREADED IN SEAT ORDER, so no card in
      the match repeats a uid. `invariants.js` reports a repeat as
      CARD-IN-TWO-ZONES, which is how the runechant collision was caught
      in live play — the same hazard, one layer up.
   3. THE SEATS ARE BUILT IN INDEX ORDER, always. `map` over [0,1] rather
      than over anything derived from who is hosting: a build order that
      depends on the local seat produces two different games from one
      spec, and it would only show up as a hash mismatch on turn one.

   It has no idea which seat this client occupies, and it must not: that
   is `buildSide`'s contract kept one level up. */
const buildSeed = (code, i) => String(code == null ? 0 : code) + ":build:" + i;

/* ---- THE PUNCHING BAG -------------------------------------------------
   A SEAT THE DUMMY FILLS IS ALWAYS VANILLA (ruling, user, 2026-08-16).
   Seat 1 is either a person, who picks their own hero, or the dummy —
   and the dummy is a pile of Generic attack actions with no rules text,
   there for seat 0 to practise against. There is no third thing, and in
   particular there is no hero the dummy "plays as": that choice existed,
   was never load-bearing, and every branch it created had to be carried
   by the trainer, the loadout, the pregame and the table.

   THE DECK LIST IS DATA AND IS PASSED IN, exactly as `buildSide` takes
   `d` rather than looking it up. It lives in index.html's data script
   beside the hero decks; hardcoding thirty card names in the engine
   would make the pool two things instead of one, and a drill could then
   only check the copy it was told about.

   `hp` and `int` are the caller's too. They are the trainer's tuning,
   not a rule — 42 life is a training prop's number, and the engine has
   no opinion about how long a practice session should last.

   EVERY PASSIVE IS WRITTEN OUT AS FALSE rather than defaulted, which is
   the discipline `DUMMY_BUILD` has held since v2.41: a passive added to
   `buildSide` and forgotten here reads `undefined` at the call site
   instead of quietly reading as false on a real hero's turn. The drill
   over `PASSIVES` holds this build to the same list. */
function buildVanilla(list, gearNames, db, rng, ctr, o){
  o = o || {};
  const gear = (gearNames || []).map(nm => Object.assign(
    resolveEntry(db, {name: nm, p: 0, code: null, q: 1}), {uid: ++ctr.n, used: false}));
  const flat = (list || []).reduce((acc, e) => {
    const [nm, p, q] = e;
    for(let i = 0; i < (q || 1); i++)
      acc.push(Object.assign(resolveEntry(db, {name: nm, p, code: null, q: 1}), {uid: ++ctr.n}));
    return acc;
  }, []).filter(c => c.resolved);
  const sh = RNG.shuffle(rng, flat);
  const b = {
    deck: sh.arr, gear, hasBoost: false, read: "", heroPow: null, HPOW: null,
    HZOOM: null, heroRec: {},
    startItem: null,
    hp: o.hp != null ? o.hp : 42,
    int: o.int != null ? o.int : 4,
    _dummy: true
  };
  for(const p of PASSIVES) b[p] = PASSIVE_TYPE[p] === "number" ? 0 : false;
  return {b, rng: sh.rng};
}

/* `spec` is the lobby's matchSpec; `o` supplies the data the engine has
   no opinion about — the hero entries, the parsed decks and the card
   database, all passed in for the same reason `buildSide` takes `d` as a
   parameter rather than looking it up.

   A seat whose hero key is `null` is the DUMMY, and is built vanilla off
   `o.vanilla` ({deck, gear, hp, int}). Its stream, its place in the uid
   threading and its build order are identical to a hero's — the seat is
   filled differently, it is not a different KIND of seat, which is what
   keeps `judge.reduce` unable to tell them apart. */
function buildMatch(spec, o){
  o = o || {};
  const ctr = {n: o.ctr0 || 0};
  const builds = [0, 1].map(i => {
    const key = spec.heroes[i];
    const rng = RNG.make(RNG.seedFrom(buildSeed(spec.seed, i)));
    if(key == null){
      const v = o.vanilla;
      if(!v) throw new Error("buildMatch: seat " + i + " is the dummy and no vanilla pile was given");
      return buildVanilla(v.deck, v.gear, o.db, rng, ctr, v).b;
    }
    const h = o.heroes[key], d = o.decks[key];
    if(!h) throw new Error("buildMatch: no hero entry for " + key);
    if(!d) throw new Error("buildMatch: no deck for " + key);
    return buildSide(h, d, o.db, spec.boards[i] || {}, rng, ctr).b;
  });
  return {builds, first: spec.first, seed: spec.seed,
          heroKeys: spec.heroes.slice(),
          names: spec.heroes.map(k => k == null
            ? ((o.vanilla && o.vanilla.name) || "The Dummy")
            : ((o.heroes[k] && o.heroes[k].n) || k)),
          tokSeq: 0, uidHigh: ctr.n};
}

/* The passives a build is expected to answer for. A rules site reads
   these through `bAct` — the build of whoever is RESOLVING — never off a
   captured seat-0 build, which is the bug v2.41 fixed. Listed here so a
   drill can assert every build answers all of them: a passive added to
   `buildSide` and forgotten elsewhere then fails loudly instead of
   reading as a silent `false` on a real hero's turn. */
const PASSIVES = ["arsenalInstant","iceFrostbite","viseraiPassive","wateryGrave","lyathBoo",
                  "atkPowOffChain","mightOnFirst6Discard","weaponRefresh"];

/* NOT EVERY PASSIVE IS A YES/NO. Most are — a hero either has Watery Grave
   or does not — but Kayo's clause 2 names its own MAGNITUDE ("get +1{p}"),
   and storing that as `true` would mean hardcoding the 1 somewhere else,
   which is inventing card text one level up. So the ledger records the
   TYPE each passive answers in, and a drill holds every build to it: a
   hero that answers `undefined` still fails, which is the property the
   original boolean check was actually protecting. */
const PASSIVE_TYPE = {
  arsenalInstant: "boolean", iceFrostbite: "boolean", viseraiPassive: "boolean",
  wateryGrave: "boolean", lyathBoo: "boolean", mightOnFirst6Discard: "boolean",
  weaponRefresh: "boolean", atkPowOffChain: "number"
};

return {ARMOR_Z, HAND_Z, gearSlots, applyPick, defaultPicks, buildSide, buildSideDefault,
        buildSeed, buildMatch, buildVanilla, PASSIVES, PASSIVE_TYPE};
});
