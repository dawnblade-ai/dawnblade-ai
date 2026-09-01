/* ============================================================
   SCENES — the instrument that drives a card and checks what HAPPENED.

   Every other tool here answers a question about TEXT:

     npm run audit       was the clause read?              text
     npm run fairness    is it stronger than printed?      text, one direction
     tools/failstates    is it unread and dangerous?       text
     npm run play        does the machine stay legal?      behaviour, NO card
                                                           text — by contract

   Nothing asked whether a card DOES what it prints. Six live defects went
   through that hole in seven releases and FIVE of them were in cards the
   audit called `full` — Take Aim's reload put cards face UP, Cloud Cover's
   ward did nothing at the table, Macho Grande's dominate was enforced by
   nothing. See FINISH.md §0.

   ── WHAT A SCENE IS ──────────────────────────────────────────────────

   A scene sets up a real judge-shaped board, does something, and returns
   NAMED OBSERVATIONS. The runner compares them with `want`.

     {
       name: "reload puts the card face DOWN",
       why:  "face up is the event her arrows trigger on (v3.69)",
       run:  ctx => ({ "arsenal is face up": false, "action points": 1 }),
       want: { "arsenal is face up": false, "action points": 1 }
     }

   ── THE RULES A SCENE OBEYS ──────────────────────────────────────────

   1. OBSERVE STATE, NEVER PROSE. Hands, life, zones, counters, action
      points. Two of v2.45's nine bugs lived under green drills that read
      the log: the end phase really did print (a) through (f) in order, and
      it really did say "draws to intellect" — while drawing for the wrong
      hero. `feed` is not an observation.

   2. NAME THE OBSERVATION IN THE PLAYER'S WORDS. The report is read to
      answer "does Azalea work", so "action points" beats "sides[0].ap".

   3. A SCENE THAT CANNOT FAIL PROVES NOTHING. Every scene here has been
      driven against a sabotaged engine and seen to bite; `why` names the
      defect it exists for, so a future reader can re-sabotage it.

   4. ONE COPY, TWO READERS. `tools/scenes.js` prints the report and
      `test/scenes.test.js` runs the same scenes as drills. The no-mirror
      rule: a report and a drill that drift are worse than either alone.
   ============================================================ */

const path = require("path");
const fs = require("fs");

const ROOT = path.join(__dirname, "..", "..");
const H = require(path.join(ROOT, "test", "helpers", "judged.js"));
const J = require(path.join(ROOT, "engine", "judge.js"));
const P = require(path.join(ROOT, "engine", "parser.js"));
const E = require(path.join(ROOT, "engine", "effects.js"));
const PM = require(path.join(ROOT, "engine", "prompts.js"));

/* The context every scene is handed. Deliberately small: a scene that
   needs something not here is usually a scene reaching past the engine's
   own front door. */
function ctx(){
  H.db();
  return {
    H, J, P, E, PM,
    /* a real pool card, resolved through the loader like the phone does */
    card: (nm, pitch, uid) => Object.assign({}, H.card(nm, pitch == null ? 0 : pitch),
                                            uid == null ? {} : {uid}),
    /* a judge-shaped board */
    state: (you, foe, o) => H.state(you, foe, o),
    /* the action phase, priority held, nothing pending */
    acting: (g) => Object.assign({}, g, {phase: "action", step: "layer",
                                         priority: 0, passed: [], stack: []}),
    exec: (g, c, from, idx, o) => J.withEffects(g, (fx, s) => fx.execute(s, c, from, idx || 0, o || {})),
    ops:  (g, list, src) => J.withEffects(g, (fx, s) => fx.runOps(s, list, src || "scene")),
    open: (g) => J.openPrompt(g),
    /* answer a prompt the way a player would: pick index i, confirm */
    answer: (g, i) => {
      let n = g;
      if(!n.prompt) return n;
      const side = n.prompt.side || 0;
      if(i != null) n = J.reduce(n, {t: "promptSel", i}, side).state;
      return J.reduce(n, {t: "promptConfirm"}, side).state;
    },
    reduce: (g, a, seat) => {
      const out = J.reduce(g, a, seat || 0);
      if(out.error) throw new Error("the scene proposed an illegal action: " + out.error);
      return out.state;
    },
    /* pass until the chain reaches a step, so a scene can watch damage
       land without restating the CR's priority dance */
    passTo: (g, step, limit) => {
      let n = g;
      for(let i = 0; i < (limit || 60) && !n.over && n.step !== step; i++){
        if(n.priority == null) break;
        const out = J.reduce(n, {t: "pass"}, n.priority);
        if(out.error) break;
        n = out.state;
      }
      return n;
    }
  };
}

/* Load every hero file in this directory. A file is `<hero>.js` exporting
   an array; the hero name comes from the FILENAME so a scene cannot claim
   to be about a hero whose file it is not in. */
function load(){
  const out = [];
  for(const f of fs.readdirSync(__dirname).sort()){
    if(!/\.js$/.test(f) || f === "runner.js") continue;
    const hero = f.replace(/\.js$/, "");
    for(const s of require(path.join(__dirname, f))) out.push(Object.assign({hero}, s));
  }
  return out;
}

/* Run one scene. Never throws: a scene that blows up is a FAILING scene
   with the error as its finding, not a crashed report — the same rule
   `report.js` follows, and for the same reason. */
function runOne(scene, c){
  let got;
  try { got = scene.run(c); }
  catch(e){ return {scene, threw: String(e && e.message || e), checks: [], ok: false}; }
  const checks = [];
  for(const k of Object.keys(scene.want)){
    const want = scene.want[k], have = got ? got[k] : undefined;
    checks.push({k, want, have, ok: JSON.stringify(want) === JSON.stringify(have)});
  }
  /* An observation the scene returned and never checked is a scene that
     measured something and then said nothing about it. */
  for(const k of Object.keys(got || {}))
    if(!(k in scene.want)) checks.push({k, want: "(unchecked)", have: got[k], ok: false});
  return {scene, checks, ok: checks.every(x => x.ok)};
}

function runAll(filter){
  const c = ctx();
  const scenes = load().filter(s => !filter ||
    s.hero.indexOf(filter) >= 0 || s.name.toLowerCase().indexOf(filter.toLowerCase()) >= 0);
  return scenes.map(s => { P.fxReset && P.fxReset(); return runOne(s, c); });
}

module.exports = {load, runOne, runAll, ctx, hasDb: H.hasDb};
