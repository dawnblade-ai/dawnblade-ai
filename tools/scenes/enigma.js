/* ENIGMA — the hero with NOTHING read, and the two things blocking her.

   "Your first Spectral Shield attack each turn costs {r} less to activate.
    Once per Turn Instant - {c}{c}{c}: Create a Spectral Shield token with
    a +1{p} counter."

   THESE SCENES PIN WHY, so the next session does not re-derive it. Her
   whole engine is Spectral Shields turned into weapons by COSMO, and her
   clause 2 is priced in a symbol that appears on exactly one record in
   the pool — her own — for which the database prints no reminder text. */
const P = require("../../engine/parser.js");

module.exports = [

{
  name: "the {c} symbol is unruled, and refusing it is the honest answer",
  why: "The golden rule at the keyword level. `{c}` appears on ONE record " +
       "in 797 — hers — and the database prints no reminder text for it. " +
       "The SEN001 card face shows three blue-grey spirals, visually " +
       "distinct from the red {r} pip on the line above, and names them " +
       "nowhere. Guessing what resource it is would be inventing card " +
       "text; creating a Spectral Shield for free would be strictly " +
       "stronger than printed. It is booked as a question, not built.",
  run(c){
    const pool = require("../../data/pool.json");
    const withC = pool.filter(x => /\{c\}/.test(x.functional_text || ""));
    const her = pool.find(x => x.name === "Enigma" && /Hero/.test(x.type_text || ""));
    const hp = P.parseHeroPower(her.functional_text, true);
    return {
      "records in the pool printing {c}": withC.length,
      "…and the only one is":             withC.map(x => x.name).join(","),
      "no reminder text explains it":     !/\{c\}[^]*\(/.test(her.functional_text || ""),
      "so her ability is REFUSED rather than made free": hp === null
    };
  },
  want: {
    "records in the pool printing {c}": 1,
    "…and the only one is": "Enigma",
    "no reminder text explains it": true,
    "so her ability is REFUSED rather than made free": true
  }
},

{
  name: "her clause 1 is BUILT now — Cosmo is what made a Shield attack exist",
  why: "\"Your first Spectral Shield ATTACK each turn costs {r} less to " +
       "ACTIVATE\" — and the Spectral Shield token's entire printed text " +
       "is \"Ward 1\". It has no attack. Cosmo, Scroll of Ancestral " +
       "Tapestry is what grants one: \"during your turn, auras you control " +
       "with ward are weapons with base {p} equal to their ward and 'Once " +
       "per Turn Action - {r}: Attack'\". Build Cosmo and the clause " +
       "becomes reachable; until then there is no such attack to discount.",
  run(c){
    const pool = require("../../data/pool.json");
    const shield = pool.find(x => x.name === "Spectral Shield");
    const cosmo = pool.find(x => /^Cosmo/.test(x.name || ""));
    const cx = {name: cosmo.name, tt: cosmo.type_text, ty: cosmo.types,
                kw: cosmo.card_keywords, tx: cosmo.functional_text,
                pitch: cosmo.pitch, power: cosmo.power};
    return {
      "the token's whole text":        (shield.functional_text || "").replace(/\*/g, ""),
      "…so it prints no attack":       !/attack/i.test(shield.functional_text || ""),
      "Cosmo grants one":              /are weapons with base/i.test(cosmo.functional_text || ""),
      "…and Cosmo READS now (v3.84)":  P.fxParse(cx).tier,
      "a POWERLESS card is still not a swing itself (v3.44)": P.allyAttack(cx) == null,
      "the Shield's ward is its base {p}":
        P.auraAttackOf({name: shield.name, tt: shield.type_text, ty: shield.types,
                        kw: shield.card_keywords, tx: shield.functional_text},
                       {gear: [cx]}, {yourTurn: true}).power,
      /* HER CLAUSE 1, reachable only now: until Cosmo was built there was
         no such thing as a Spectral Shield attack, so this priced a play
         that could not happen. */
      "her first Shield attack each turn costs {r} less":
        P.auraAttackOf({name: shield.name, tt: shield.type_text, ty: shield.types,
                        kw: shield.card_keywords, tx: shield.functional_text},
                       {gear: [cx], hist: {auraAtkNames: []}},
                       {yourTurn: true, discount: {name: "spectral shield", amt: 1}}).cost,
      "…and the second pays the printed {r}":
        P.auraAttackOf({name: shield.name, tt: shield.type_text, ty: shield.types,
                        kw: shield.card_keywords, tx: shield.functional_text},
                       {gear: [cx], hist: {auraAtkNames: ["Spectral Shield"]}},
                       {yourTurn: true, discount: {name: "spectral shield", amt: 1}}).cost
    };
  },
  want: {
    "the token's whole text": "Ward 1",
    "…so it prints no attack": true,
    "Cosmo grants one": true,
    "…and Cosmo READS now (v3.84)": "full",
    "a POWERLESS card is still not a swing itself (v3.44)": true,
    "the Shield's ward is its base {p}": 1,
    "her first Shield attack each turn costs {r} less": 0,
    "…and the second pays the printed {r}": 1
  }
}
,

{
  name: "Uphold Tradition is a ONE-SHOT, because the flip is the cost",
  why: "v3.99 — its printed cost is \"{r}, turn this face-up\" and " +
       "`parseHeroPower`'s catch-all refuses none of those words, so the " +
       "line fell through, the cost was read off the {r} alone, and the " +
       "ability minted a +1{p} counter EVERY TURN for one resource. " +
       "STRONGER than printed, `tier: full`, and the keyword itself was " +
       "filed under STEALTH's noop reason — v3.16's mis-filing at the " +
       "keyword level. The printing (ENG005) settles it: \"Cloaked (Equip " +
       "this face-down.)\"",
  run(c){
    const B = require("../../engine/build.js");
    const G = require("../../engine/game.js");
    const RNG = require("../../engine/rng.js");
    const {loadData} = require("../../test/helpers/extract.js");
    const W = loadData();
    const h = W.HEROES.find(x => x.k === "enigma");
    const b = B.buildSide(h, G.parseDeck(W.DECKS.enigma), c.H.db(), {},
                          RNG.make("scene-cloak"), {n: 0}).b;
    const ut = b.gear.find(g => g.name === "Uphold Tradition");
    const shield = {uid: "sh1", kind: "aura", spent: false,
      card: {name: "Spectral Shield", uid: "sh1", tt: "Illusionist Token - Aura",
             ty: ["Illusionist", "Token", "Aura"], tx: "**Ward 1**", kw: ["Ward 1"]}};
    const g = c.acting(Object.assign(
      c.state({res: 5, ap: 1, gear: [ut], board: [shield]}, {hp: 20}, {turn: 3}),
      {builds: [{}, {}]}));
    const one = c.exec(g, ut.powCard, "gear", 0);
    const n1 = one.game || one;
    const two = c.exec(n1, ut.powCard, "gear", 0);
    const n2 = two.game || two;
    const ctr = s => ((s.sides[0].counters || {})["sh1"] || {}).pow || 0;
    return {
      "it is equipped face-down":             !!ut._faceDown,
      "…and nothing else in her loadout is":  b.gear.filter(x => x._faceDown).length,
      "the first use puts the printed counter": ctr(n1),
      "…and turns the piece face-up":         !!(n1.sides[0].gear.find(x => x.uid === ut.uid) || {})._faceDown,
      "a second use mints nothing — the cost cannot be paid twice": ctr(n2),
      "and judge refuses it by name rather than dead-tapping":
        String(c.J.legal(Object.assign({}, n1, {priority: 0}),
                         {t: "activate", uid: ut.uid, from: "gear"}, 0) || "")
          .indexOf("already face-up") >= 0
    };
  },
  want: {
    "it is equipped face-down": true,
    "…and nothing else in her loadout is": 1,
    "the first use puts the printed counter": 1,
    "…and turns the piece face-up": false,
    "a second use mints nothing — the cost cannot be paid twice": 1,
    "and judge refuses it by name rather than dead-tapping": true
  }
}
,

{
  name: "her own phantasm attacks do not pop each other",
  why: "The pop site asked `(c.power||0) >= 6` over the wall — the SIX " +
       "with both printed restrictions beside it dropped. SAT001's set " +
       "carries phantasm's reminder in full, and upstream's own " +
       "`keyword.csv` agrees independently: \"defended by a NON-ILLUSIONIST " +
       "ATTACK ACTION CARD with 6 or more {p}\". Enigma is the hero this " +
       "bites: the pool's nine 6+-power Illusionist attack action cards " +
       "are HER OWN phantasm attacks at every pitch, so blocking with one " +
       "destroyed the opponent's, which the keyword forbids by name. " +
       "WEAKER than printed, so the one-sided fairness sweep is blind, " +
       "and all four cards read `tier: full` because the keyword line IS " +
       "consumed. Driving it is the only thing that sees it (v4.31).",
  run(c){
    const pool = require("../../data/pool.json");
    const six = pool.filter(x => (+x.power || 0) >= 6
      && (x.types || []).some(t => /^illusionist$/i.test(String(t))));
    /* Her three, at every pitch, resolved the way the game resolves them. */
    const chim   = c.card("Enigma Chimera", 3, "w1");        /* 6 power, Illusionist */
    const grunt  = {uid: "w2", name: "Six Power", def: 3, power: 6, pitch: 1,
                    tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"]};
    const swing = blk => {
      const atk = c.card("Spears of Surreality", 1, "ph");
      let g = c.acting(c.state({res: 9, ap: 3, hand: [atk]}, {hp: 20, hand: [blk]},
                               {turn: 3}));
      let n = c.reduce(g, {t: "play", uid: "ph", from: "hand"}, 0);
      if(n.pending && n.pending.kind === "boost") n = c.reduce(n, {t: "boost", yes: false}, 0);
      n = c.passTo(n, "defend");
      n = c.reduce(n, {t: "defend", uid: blk.uid}, 1);
      for(let i = 0; i < 16 && n.phase === "action" && n.step !== "layer"; i++){
        let moved = false;
        for(const seat of [0, 1]){
          const out = c.J.reduce(n, {t: "pass"}, seat);
          if(!out.error){ n = out.state; moved = true; break; }
        }
        if(!moved) break;
      }
      return n;
    };
    const vsHers = swing(chim), vsTheirs = swing(grunt);
    return {
      "her 6+-power Illusionist attacks in the pool": six.length,
      "…and they are":  [...new Set(six.map(x => x.name))].sort().join(", "),
      "blocked by one of her own, the attack RESOLVES": vsHers.sides[1].hp < 20,
      "blocked by a Generic six, it is popped":         vsTheirs.sides[1].hp === 20,
      "…and destroyed, once":                           vsTheirs.sides[0].grave.length
    };
  },
  want: {
    "her 6+-power Illusionist attacks in the pool": 9,
    "…and they are": "Enigma Chimera, Phantasmal Haze, Spectral Rider",
    "blocked by one of her own, the attack RESOLVES": true,
    "blocked by a Generic six, it is popped": true,
    "…and destroyed, once": 1
  }
},

{
  name: "her Shields PAY for the damage they prevent, and Waning Vengeance replaces itself",
  why: "SEN037 — the Silver Age Spectral Shield this project deals — " +
       "prints reminder text the database omits: \"Ward 1 (If you would " +
       "be dealt damage, DESTROY THIS to prevent 1 of that damage.)\" The " +
       "parser read the keyword as the op that fills a side's prevention " +
       "POOL when a card resolves, so the number was banked at PLAY and " +
       "the permanent then outlived it — every Shield she ever made stayed " +
       "on the board, still a Cosmo weapon, still counted by every \"auras " +
       "you control\" clause, while its ward went on soaking. Enigma is the " +
       "hero this is about: she decks four ward auras and equips a fifth " +
       "ward on her Arms piece, and she won 9 of her 14-game slice before " +
       "this and 5 after. All eight records read `tier: full` throughout " +
       "(v4.34).",
  run(c){
    const ent = (card, uid) => ({uid, card, sd: null});
    const hit = (g, amt) => c.J.withEffects(g, (fx, s) => {
      const r = fx.preventDamage(s, 0, amt, "The attack");
      return Object.assign({}, r.game, {_dealt: r.dealt});
    });

    /* (a) a Ward 3 aura pays for ONE point and wastes the other two. */
    const spec = c.card("Waxing Specter", 1, "b3");            /* Ward 3 */
    const one  = hit(c.state({board: [ent(spec, "b3")], hp: 20}, {}, {turn: 7}), 1);

    /* (b) the Arms piece prints Ward 1 and is never PLAYED, so its ward
       used to be worth exactly zero. Marked rather than spliced (v3.54). */
    const arms = c.card("Uphold Tradition", 0, "g41");
    const gear = hit(c.state({gear: [Object.assign({}, arms, {uid: 41})], hp: 20}, {}, {turn: 7}), 1);

    /* (c) THE LOOP THE CARD IS DESIGNED AROUND. Waning Vengeance's ward
       IS its exit, and blue is pitch 3. */
    const wv   = c.card("Waning Vengeance", 3, "b9");          /* Ward 1 */
    const blue = c.card("Oasis Respite", 3, "p1");
    const loop = hit(c.state({board: [ent(wv, "b9")], pitch: [blue], hp: 20}, {}, {turn: 4}), 1);
    const dry  = hit(c.state({board: [ent(wv, "b9")], pitch: [],     hp: 20}, {}, {turn: 4}), 1);

    return {
      "a Ward 3 aura prevents one point":        one._dealt,
      "…and is destroyed for it anyway":         one.sides[0].board.length,
      "…reaching the graveyard, turn-stamped":   (one.sides[0].grave[0] || {})._gy,
      "…and nothing is banked in the pool":      one.sides[0].ward,
      "her ARMS piece prevents too, at last":    gear._dealt,
      "…marked rather than spliced, for the wall": gear.sides[0].gear[0].destroyed,
      "Waning Vengeance leaves and pays out":    (loop.sides[0].board[0] || {}).card.name,
      "…and with nothing blue pitched, nothing": dry.sides[0].board.length
    };
  },
  want: {
    "a Ward 3 aura prevents one point": 0,
    "…and is destroyed for it anyway": 0,
    "…reaching the graveyard, turn-stamped": 7,
    "…and nothing is banked in the pool": 0,
    "her ARMS piece prevents too, at last": 0,
    "…marked rather than spliced, for the wall": true,
    "Waning Vengeance leaves and pays out": "Spectral Shield",
    "…and with nothing blue pitched, nothing": 0
  }
},

{
  name: "and her Shields stop ARCANE and direct damage too, because both say \"damage\"",
  why: "The pool draws the distinction ITSELF — Pyroglyphic Protection " +
       "prints \"if you would be dealt ARCANE damage\" and feeds a separate " +
       "shield, while Cloud Cover, Toe the Line, Radiant Touch and every " +
       "printed `Ward N` say damage unqualified. `preventDamage` was " +
       "reached from the two COMBAT paths only, so a Spectral Shield " +
       "watched a Runechant's arcane point go straight through and Boom " +
       "Grenade's printed 4 landed on a hero holding a full prevention " +
       "pool. v2.74's own sentence one prevention family over: that " +
       "version made `arcaneHit` the single place arcane damage lands " +
       "because a bare `hp -= total` \"is why arcane ward, the shield, " +
       "Arcane Barrier and Spellvoid were ALL dead — there was nowhere " +
       "for a prevention to stand\" (v4.35).",
  run(c){
    const spec = c.card("Waxing Specter", 1, "b3");            /* Ward 3 */
    const armed = () => c.state({}, {board: [{uid: "b3", card: spec, sd: null}],
                                     ward: 2, wardTurn: 2, hp: 20}, {turn: 7});
    const arc  = c.ops(armed(), [["arcane", 3]], "a Runechant");
    const over = c.ops(armed(), [["arcane", 9]], "a Runechant");
    const dir  = c.ops(armed(), [["dmg", 3]], "Boom Grenade");
    const mine = c.ops(c.state({board: [{uid: "b3", card: spec, sd: null}],
                                ward: 2, wardTurn: 2, hp: 20}, {}, {turn: 7}),
                       [["dmgSelf", 3]], "Bloodrot Pox");
    return {
      "three arcane, all of it prevented":        arc.sides[1].hp,
      "…the pool paid what it could":             arc.sides[1].ward,
      "…and the aura paid the rest, with itself": arc.sides[1].board.length,
      "…and a fully prevented hit is NOT a hit":  arc._dmgWay || 0,
      "nine arcane still gets four through":      over.sides[1].hp,
      "Boom Grenade's direct 4 asks it now":      dir.sides[1].hp,
      "…and so does damage a card deals to YOU":  mine.sides[0].hp
    };
  },
  want: {
    "three arcane, all of it prevented": 20,
    "…the pool paid what it could": 0,
    "…and the aura paid the rest, with itself": 0,
    "…and a fully prevented hit is NOT a hit": 0,
    "nine arcane still gets four through": 16,
    "Boom Grenade's direct 4 asks it now": 20,
    "…and so does damage a card deals to YOU": 20
  }
}

];
