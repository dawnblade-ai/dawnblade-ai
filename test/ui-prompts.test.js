/* ============================================================
   ui-prompts.test.js — CRESCENDO's prompt sheets (ui/sheets.js, F5)

   `model(prompt, view, ui)` is the pure half of the sheet. The claim of this file is the one test/promptctl.test.js
   makes for the old board, made for the new one, and DRIVEN rather than scanned (a Preact component cannot load in
   node, its model can):

     - every tag `buildPrompt` can build has a model;
     - EVERY ANSWER THE MODULE ACCEPTS HAS A CONTROL: for each shape, every action `prompts.js` would change the
       prompt for (a toggle, a choose, a decline, a take-back, a move) is sent by some control of the model;
     - NO CONTROL SENDS AN ANSWER THE MODULE REFUSES: an enabled control's actions change the prompt (or confirm a
       ready one), a disabled item's would be refused, and an enabled primary is `promptReady` when it confirms;
     - the sheet shows only what the prompt's own cards carry, and nothing at all to the seat not asked (a reveal
       is for both);
     - the sheet's CSS keeps every control >= 44 px and no text under 11 px.
   Real prompts come from real self-played legs (`tools/tournament.js`), the way speccensus drives them.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

/* the hook goes in BEFORE tournament.js loads (effects.js destructures buildPrompt at require time) */
const PM = require("../engine/prompts.js");
const built = [];
const realBuild = PM.buildPrompt;
PM.buildPrompt = function(game, spec){ const r = realBuild.apply(this, arguments); if(r) built.push(r); return r; };
const T = require("../tools/tournament.js");
const S = require("../ui/sheets.js");
const J = require("../engine/judge.js");

const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const card = (nm, uid, o) => Object.assign({name: nm, uid, pitch: 1, cost: 1, power: 3, def: 2, tt: "Generic Action", ty: ["Generic", "Action"], tx: "", img: "https://x/" + uid + ".webp"}, o || {});
const g0 = {sides: [{hand: [card("H1", 81, {pitch: 3}), card("H2", 82, {pitch: 2})], deck: [card("D1", 91), card("D2", 92), card("D3", 93)], grave: [], board: [], gear: [], res: 1}, {}], turn: 1};

/* one real prompt per shape, built by `buildPrompt` (no fixture claims a shape the module does not produce) */
function variants(){
  const cs = [card("A", 1), card("B", 2), card("C", 3)];
  const b = (spec, g) => PM.buildPrompt(g || g0, Object.assign({side: 0, src: "Src"}, spec));
  return {
    opt:      b({tag: "opt", cards: cs, n: 3}),
    optKeep:  b({tag: "opt", cards: cs, n: 2, keepTop: true}),
    pick:     b({tag: "pick", cards: cs, min: 0, max: 1}),
    pickM:    b({tag: "pick", cards: cs, min: 1, max: 1}),
    pickN:    b({tag: "pick", cards: cs, min: 1, max: 2}),
    pickF:    b({tag: "pick", cards: cs, filters: [{}, {}]}),
    modal:    b({tag: "modal", optional: true, options: [{label: "Discard a card", ops: []}, {label: "Destroy the top card", ops: []}]}),
    modalM:   b({tag: "modal", options: [{label: "Top", ops: []}, {label: "Bottom", ops: []}]}),
    modalOne: b({tag: "modal", optional: true, options: [{label: "Do it", ops: []}]}),
    pay:      b({tag: "pay", cost: 2, ops: []}),
    payShort: b({tag: "pay", cost: 9, ops: []}),
    reveal:   b({tag: "reveal", cards: cs}),
    target:   b({tag: "target", cards: [card("Hero", 11, {life: 20}), card("Ally", 12)]}),
    alloc:    b({tag: "alloc", cards: cs, n: 2}),
    soak:     b({tag: "soak", amount: 3, options: [{uid: 7, name: "Iron", cost: 2, amount: 1}, {uid: 8, name: "Void", kind: "spellvoid", amount: 2}, {uid: 9, name: "Dear", cost: 5, amount: 1}]})
  };
}

/* the reducer's own cases for a prompt action (judge.js: promptSel / promptChoose / promptDecline / ...) */
function apply(p, a){
  switch(a.t){
    case "promptSel": return PM.promptToggleSel(p, a.i);
    case "promptChoose": return PM.promptChoose(p, a.choice);
    case "promptDecline": return PM.promptDecline(p);
    case "promptTakeBack": return PM.promptTakeBack(p);
    case "promptMove": return PM.promptMove(p, a.i, a.dir);
    case "promptConfirm": return PM.promptReady(p) ? {...p, _confirmed: true} : p;
  }
  return p;
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/* a modal's "decline" by promptChoose is the same answer as promptDecline (promptDecline calls it): one control owes both */
const key = (a, p) => (p && (p.tag === "modal" || p.tag === "pay") && (a.t === "promptDecline" || (a.t === "promptChoose" && a.choice === "decline"))) ? "DECLINE" : JSON.stringify([a.t, a.i, a.choice, a.dir]);
const drive = (p, acts) => acts.reduce(apply, p);

test("every tag buildPrompt knows has a model, and the list is total over the module's vocabulary", () => {
  const tags = [...new Set([...read("engine/prompts.js").matchAll(/spec\.tag === "([a-z]+)"/g)].map(m => m[1]))].sort();
  assert.deepEqual(tags, S.TAGS.slice().sort(), "a ninth tag must be given a sheet");
  const v = variants();
  const seen = new Set();
  for(const k of Object.keys(v)){
    assert.ok(v[k], k + " builds");
    const m = S.model(v[k], {seat: 0});
    assert.ok(m, k + " has a model");
    assert.equal(m.tag, v[k].tag); assert.ok(m.title, k + " has a title"); assert.ok(m.primary, k + " has a primary");
    assert.ok(m.primary.label && m.primary.actions.length, k + " primary sends something");
    seen.add(m.tag);
  }
  assert.deepEqual([...seen].sort(), S.TAGS.slice().sort(), "the fixtures reach every tag");
  assert.equal(S.model(null), null); assert.equal(S.model({tag: "nope"}), null);
});

test("every answer the module accepts has a control that sends it", () => {
  const v = variants();
  let checked = 0;
  for(const k of Object.keys(v)){
    const p0 = v[k], n = (p0.cards || []).length, no = (p0.options || []).length;
    /* the states a player can be in: nothing chosen, one chosen, everything placed */
    const states = [p0];
    for(let i = 0; i < Math.max(n, no); i++){ const q = PM.promptToggleSel(p0, i); if(!same(q, p0)) states.push(q); }
    if(p0.tag === "pick" || p0.tag === "alloc" || p0.tag === "soak") states.push(drive(p0, [0, 1, 2].map(i => ({t: "promptSel", i}))));
    for(const p of states){
      /* the controls on offer, over every card an opt sheet could have tapped */
      const offered = new Set();
      for(const cur of [null, 0, 1, 2]) S.answersOf(S.model(p, {seat: 0}, {cur})).forEach(a => offered.add(key(a, p)));
      /* the universe of answers the module could be sent */
      const universe = [{t: "promptDecline"}, {t: "promptTakeBack"}, {t: "promptChoose", choice: "pay"}, {t: "promptChoose", choice: "decline"}];
      for(let i = 0; i < Math.max(n, no); i++){   /* an index the sheet never rendered is not an answer (opt's toggle would take 99) */
        universe.push({t: "promptSel", i}, {t: "promptChoose", choice: i}, {t: "promptMove", i, dir: -1}, {t: "promptMove", i, dir: 1});
      }
      for(const a of universe){
        if(same(apply(p, a), p)) continue;               /* the module refuses it: no control owed */
        checked++;
        assert.ok(offered.has(key(a, p)), k + ": the module accepts " + JSON.stringify(a) + " and no control sends it");
      }
      /* and a ready sheet can always be confirmed */
      if(PM.promptReady(p)) assert.ok(offered.has(key({t: "promptConfirm"})), k + ": ready but no confirm control");
    }
  }
  assert.ok(checked > 60, "the drill really exercised the module: " + checked);
});

test("no control sends an answer the module refuses; a dark control would be refused", () => {
  const v = variants();
  let enabled = 0, dark = 0;
  for(const k of Object.keys(v)) for(const cur of [null, 0, 1]){
    const p = v[k], m = S.model(p, {seat: 0}, {cur});
    const ctl = [...m.items, ...m.controls, m.primary, m.secondary].filter(Boolean);
    for(const c of ctl){
      if(c.local) continue;                               /* a local tap (an opt card chosen) sends nothing */
      if(c.enabled === false){
        dark++;
        /* a dark primary is a Confirm the module would not take; a dark item is a toggle it would refuse */
        if(c === m.primary && c.actions.length === 1 && c.actions[0].t === "promptConfirm") assert.ok(!PM.promptReady(p), k + ": a dark primary on a ready sheet");
        /* a dark ITEM or control is a toggle the module would refuse (pay's PAY when short is the one deliberate extra:
           the module would take it and pitch on demand, the sheet will not offer a payment that cannot land) */
        else if(c.actions.length && c !== m.primary && c !== m.secondary) assert.ok(same(drive(p, c.actions.filter(a => a.t !== "promptConfirm")), p), k + ": a dark control that the module would accept");
        continue;
      }
      if(!c.actions.length) continue;
      enabled++;
      let q = p;
      c.actions.forEach((a, n) => {
        const r = apply(q, a);
        const last = n === c.actions.length - 1 && a.t === "promptConfirm";
        if(last) assert.ok(r._confirmed, `${k}: "${c.label}" confirms a sheet that is not ready`);
        /* a decline on a sheet with nothing chosen changes nothing and is still the printed answer "none" */
        else if(a.t !== "promptDecline") assert.ok(!same(r, q), `${k}: "${c.label}" sends ${JSON.stringify(a)}, which the module refuses`);
        q = r;
      });
    }
    /* a primary that is enabled is ready when it confirms */
    if(m.primary.enabled) assert.ok(m.primary.actions.every(a => a.t === "promptConfirm" || a.t === "promptChoose"));
  }
  assert.ok(enabled > 40 && dark > 5, `controls checked: ${enabled} live, ${dark} dark`);
});

test("shapes: pay, soak, modal, pick, opt and alloc read as the F5 spec says", () => {
  const v = variants(), M = (k, ui) => S.model(v[k], {seat: 0}, ui);
  /* pay: PAY n is dark when the seat cannot reach it, DON'T PAY never is; both choose then confirm */
  assert.equal(M("pay").primary.enabled, true); assert.equal(M("payShort").primary.enabled, false);
  assert.match(M("payShort").reason, /NEEDS \d+ MORE/); assert.equal(M("payShort").secondary.enabled, true);
  assert.deepEqual(M("pay").primary.actions, [{t: "promptChoose", choice: "pay"}, {t: "promptConfirm"}]);
  assert.deepEqual(M("pay").secondary.actions, [{t: "promptChoose", choice: "decline"}, {t: "promptConfirm"}]);
  /* soak: the barrier the hero cannot afford stays visible with its reason; taking none is the default */
  const sk = M("soak"); assert.equal(sk.items.length, 3);
  assert.ok(sk.items.every(i => i.enabled), "buildPrompt only offers what the hero can reach alone");
  assert.match(sk.primary.label, /^TAKE 3$/);
  const sk2 = S.model(PM.promptToggleSel(v.soak, 2), {seat: 0});   /* the dear barrier eats the budget (avail 6) */
  assert.match(sk2.primary.label, /^SPEND 5$/);
  assert.equal(sk2.items[0].enabled, false); assert.match(sk2.items[0].why, /NEEDS 1 MORE/); assert.equal(sk2.items[1].enabled, true, "spellvoid is always affordable");
  /* modal: Confirm stays dark until a mode is chosen; an optional one offers NO THANKS; "you may X" is one button */
  assert.equal(M("modalM").primary.enabled, false); assert.equal(M("modalM").secondary, null);
  assert.equal(M("modal").secondary.label, "NO THANKS");
  assert.deepEqual(M("modal").secondary.actions, [{t: "promptDecline"}, {t: "promptConfirm"}]);
  assert.equal(M("modalOne").primary.label, "DO IT"); assert.equal(M("modalOne").items.length, 0);
  /* pick: the foot says what it is waiting for (a dead control reads as a broken screen, v2.83) */
  assert.equal(M("pickM").primary.enabled, false); assert.match(M("pickM").reason, /PICK 1/);
  assert.match(M("pickN").reason, /PICK UP TO 2 · 0 CHOSEN/); assert.match(M("pickF").reason, /ONE OF EACH/);
  assert.equal(M("pick").secondary.label, "NO THANKS"); assert.equal(M("pickM").secondary, null);
  /* a one-card pick swaps instead of refusing the second tap */
  const one = PM.promptToggleSel(v.pickM, 0), mo = S.model(one, {seat: 0});
  assert.deepEqual(mo.items[1].actions, [{t: "promptSel", i: 0}, {t: "promptSel", i: 1}]);
  assert.deepEqual(drive(one, mo.items[1].actions).sel, [1]);
  /* opt: draw order numbers, lanes, and the three controls follow the tapped card */
  const o = M("opt", {cur: 1});
  assert.deepEqual(o.items.map(i => i.num), [1, 2, 3]); assert.deepEqual(o.items.map(i => i.lane), ["top", "top", "top"]);
  assert.deepEqual(o.controls.map(c => c.enabled), [true, true, true]);
  assert.deepEqual(o.controls[0].actions, [{t: "promptMove", i: 1, dir: -1}]);
  assert.equal(M("opt", {cur: 0}).controls[0].enabled, false, "the first card has nothing sooner");
  assert.equal(M("opt").controls.every(c => !c.enabled), true, "no card tapped: nothing to move");
  const dn = S.model(PM.promptToggleSel(v.opt, 1), {seat: 0}, {cur: 1});
  assert.equal(dn.items[1].lane, "bottom"); assert.deepEqual(dn.items.filter(i => i.lane === "top").map(i => i.num), [1, 2]);
  assert.equal(dn.controls[2].label, "TOP"); assert.equal(M("optKeep", {cur: 0}).controls[2].label, "UNDER");
  /* alloc: counts per card, only the last placement can be stepped back, and a full sheet places no more */
  const al = S.model(drive(v.alloc, [{t: "promptSel", i: 0}, {t: "promptSel", i: 0}]), {seat: 0});
  assert.deepEqual(al.items.map(i => i.count), [2, 0, 0]); assert.equal(al.items[0].minus.enabled, true); assert.equal(al.items[1].minus.enabled, false);
  assert.equal(al.items[1].enabled, false); assert.equal(al.items[1].why, "ALL PLACED");
  /* target: mandatory, the primary names the choice */
  assert.equal(M("target").primary.enabled, false);
  assert.equal(S.model(PM.promptChoose(v.target, 1), {seat: 0}).primary.label, "TARGET ALLY");
});

test("the sheet shows only what the prompt's own cards carry, and the seat not asked sees nothing", () => {
  const v = variants();
  for(const k of Object.keys(v)){
    const p = v[k], m = S.model(p, {seat: 0});
    const names = new Set((p.cards || []).map(c => c.name));
    if(p.tag === "pick" || p.tag === "opt" || p.tag === "reveal" || p.tag === "target" || p.tag === "alloc")
      assert.deepEqual(m.items.map(i => i.name), (p.cards || []).map(c => c.name), k + ": items are the prompt's cards, in order");
    m.items.forEach(i => { if(i.card) assert.ok(names.has(i.card.name), k + ": an invented card"); });
    if(p.tag === "modal") assert.deepEqual(m.items.map(i => i.label).filter(Boolean), p.options.map(o => o.label).filter(() => p.options.length > 1));
    /* the other seat: a waiting card with no cards, no names, no options */
    const w = S.model(p, {seat: 1, names: ["Ann", "Bo"]});
    if(p.tag === "reveal"){ assert.equal(w.waiting, false); assert.equal(w.chip, "LOOK ONLY"); assert.equal(w.items.length, p.cards.length); continue; }
    assert.equal(w.waiting, true, k); assert.equal(w.items.length, 0); assert.equal(w.primary, null); assert.equal(w.title, "Ann is choosing");
    const dump = JSON.stringify(w);
    for(const c of p.cards || []) assert.ok(!dump.includes('"' + c.name + '"') && !dump.includes(c.name + '"'), k + ": a hidden card named to the other seat");
    assert.equal(w.answers, undefined);
  }
  /* the source thumbnail is the table's lookup, never invented here */
  assert.equal(S.model(v.pick, {seat: 0}).source.name, "Src"); assert.equal(S.model({...v.pick, src: "Fai — hero power"}, {seat: 0}).source.name, "Fai");
});

test("real prompts from real games: every one has a model whose items are its cards", () => {
  if(!built.length){ for(let i = 0; i < T.ENTRANTS.length; i += 3) T.leg(T.ENTRANTS[i], T.ENTRANTS[(i + 1) % T.ENTRANTS.length], "ui-" + i, 0); }
  assert.ok(built.length > 20, "the legs raised prompts: " + built.length);
  const tags = new Set();
  let looked = 0;
  for(const p of built){
    tags.add(p.tag);
    const m = S.model(p, {seat: p.side});
    assert.ok(m, p.tag + " " + p.title);
    assert.equal(m.title, p.title); assert.equal(m.hint, p.hint);
    assert.ok(m.primary && m.primary.label);
    assert.ok(m.answers.length > 0);
    if(p.tag === "pick" || p.tag === "opt") assert.deepEqual(m.items.map(i => i.name), p.cards.map(c => c.name));
    if(p.tag === "soak") assert.deepEqual(m.items.map(i => i.name), p.options.map(o => o.name));
    /* the same two properties as above, on the real shape */
    const nonLocal = [...m.items, ...m.controls, m.primary, m.secondary].filter(c => c && c.enabled !== false && !c.local && c.actions && c.actions.length);
    for(const c of nonLocal){ let q = p; c.actions.forEach(a => { q = apply(q, a); }); looked++; }
    /* a seat that was not asked sees nothing of it */
    if(p.tag !== "reveal") assert.equal(S.model(p, {seat: 1 - p.side}).items.length, 0);
  }
  for(const t of ["pick", "opt", "soak", "pay"]) assert.ok(tags.has(t), "the games raised a " + t + " sheet");
  assert.ok(looked > 30);
});

test("the sheet's own actions are judge.PROMPT_ACTIONS and nothing else", () => {
  const v = variants(), acts = new Set();
  for(const k of Object.keys(v)) for(const cur of [null, 0]) S.answersOf(S.model(v[k], {seat: 0}, {cur})).forEach(a => acts.add(a.t));
  for(const t of acts) assert.ok(J.PROMPT_ACTIONS.includes(t), t + " is an engine prompt action");
  /* and it uses every one of them: a new engine action would need a control */
  for(const t of J.PROMPT_ACTIONS) assert.ok(acts.has(t), "no control sends " + t);
});

test("the sheet's CSS keeps every control >= 44 px and no text under 11 px", () => {
  const css = read("ui/sheets.css").replace(/\/\*[\s\S]*?\*\//g, "");
  const rule = sel => { const m = css.match(new RegExp("(?:^|\\})\\s*" + sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\{([^}]*)\\}")); return m && m[1]; };
  for(const sel of [".sh-btn", ".sh-tile", ".sh-mode", ".sh-row"]){
    const r = rule(sel); assert.ok(r, sel + " is styled");
    const mh = r.match(/min-height:\s*(\d+)px/); assert.ok(mh && +mh[1] >= 44, sel + " min-height >= 44");
  }
  assert.ok(+rule(".sh-btn.sh-step").match(/width:\s*(\d+)px/)[1] >= 44, "steppers are 44 wide");
  assert.ok(+rule(".sh-btn.sec").match(/min-height:\s*(\d+)px/)[1] >= 44);
  for(const m of css.matchAll(/font(?:-size)?:\s*(?:[^;}]*?\s)?(\d+(?:\.\d+)?)px/g)) assert.ok(+m[1] >= 11, "type >= 11px: " + m[0]);
  /* nothing animates here: the director does that (MOTION 1.2) */
  assert.ok(!/@keyframes|transition\s*:|animation\s*:/.test(css), "no CSS motion in the sheets");
  /* anchored to the bottom */
  assert.match(rule(".sh-sheet"), /bottom:\s*0/);
});
