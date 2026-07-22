/* ============================================================
   Dawnblade engine — parser.js (Phase 1 extraction)
   THE JUDGE's reading eye: the pure card-text interpreter,
   extracted verbatim from index.html. Zero DOM; runs in Node
   and the browser (window.DawnParser).

   Golden rule: teach the parser, never special-case a card
   by name. Function bodies must stay textually identical to
   index.html — test/sync.test.js enforces the lockstep until
   the trainer imports this file directly.
   ============================================================ */
(function(root, factory){
  if(typeof module==="object" && module.exports) module.exports = factory();
  else root.DawnParser = factory();
})(typeof self!=="undefined" ? self : this, function(){

const norm = s => s.toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const isAttack = c => /attack/i.test(c.tt) && /action/i.test(c.tt) && c.power!=null;
const isArrow  = c => /arrow/i.test(c.tt);
const isWeapon = c => /weapon/i.test(c.tt) && c.power!=null;
const hasGA = c => (c.kw||[]).some(k=>/go again/i.test(k)) || /\bgo again\b/i.test(c.tx||"");
const arcaneDmg = c => { const m=(c.tx||"").match(/deals? (\d+) arcane damage/i); return m?+m[1]:null; };

const NWORD = {a:1,an:1,one:1,two:2,three:3,four:4};
const num = w => NWORD[w] || parseInt(w,10) || 1;
const clean = t => (t||"").replace(/\*\*?/g,"").replace(/\s+/g," ").trim();

function classifyClause(raw){
  const c = clean(raw).toLowerCase().replace(/\.$/,"");
  if(!c) return null;
  const R = (ops,extra) => Object.assign({status:"run",ops},extra||{});
  const NOOP = why => ({status:"noop",ops:[["noop",why]]});
  let m;
  if(m=c.match(/^(?:if|when) ([^,:]+)[,:] ?(.+)$/)){
    const cond=m[1], rest=classifyClause(m[2]);
    if(!rest || rest.status!=="run") return null;
    if(/\bhits?\b/.test(cond)) return Object.assign(rest,{onHit:true});
    if(/another attack action card this turn/.test(cond)) return Object.assign(rest,{cond:"atk"});
    if(/another non-attack action card this turn/.test(cond)) return Object.assign(rest,{cond:"non"});
    if(/6 or more \{p\}[^.]*pitch zone/.test(cond)) return Object.assign(rest,{cond:"pitch6"});
    if(/defended by fewer than 2 non-equipment/.test(cond)) return Object.assign(rest,{cond:"defLt2"});
    if(/6 or more \{p\}[^.]*discard/.test(cond)) return Object.assign(rest,{cond:"discard6"});
    if(/^you attack with /.test(cond)) return rest;
    return null;
  }
  if(/^go again$/.test(c)) return R([["ga"]]);
  if(/(?:this|it) (?:gains?|gets?) go again$/.test(c)) return R([["ga"]]);
  if(/^as an additional cost/.test(c)) return NOOP("additional cost — enforced when played");
  if(m=c.match(/(?:target )?defending card (?:gains?|gets?) \+(\d+)\s*(?:\{d\}|defense)/)) return R([["defBuff",+m[1]]]);
  if(m=c.match(/(?:^|this |it )(?:gains?|gets?) \+(\d+)\s*(?:\{d\}|defense)/)) return R([["defBuff",+m[1]]]);
  if(m=c.match(/(?:target )?attack(?:ing card)? (?:gets?|gains?) -(\d+)\s*(?:\{p\}|power)/)) return R([["atkMinus",+m[1]]]);
  if(/^(dominate|intimidate)$/.test(c)) return NOOP("no defender to restrict — training dummy");
  if(/(?:they|the defending hero|target hero|defending hero|opponent|each opponent) discards?/.test(c)) return R([["foeDiscard",1]]);
  if(m=c.match(/^ward (\d+)/)) return R([["ward",+m[1]]]);
  if(m=c.match(/prevent (?:the next )?(\d+) (?:point(?:s)? of )?(arcane )?damage/)) return m[2] ? R([["awd",+m[1]]]) : R([["ward",+m[1]]]);
  if(m=c.match(/deals? (\d+) arcane damage/)) return R([["arcane",+m[1]]]);
  if(m=c.match(/draw (a|an|one|two|three|\d+) cards?/)) return R([["draw",num(m[1])]]);
  if(m=c.match(/gains? (\d+) (?:\{r\}|resource)/)) return R([["res",+m[1]]]);
  if(m=c.match(/gains? (\d+) (?:\{h\}|life)/)) return R([["life",+m[1]]]);
  if(m=c.match(/your next(?:[^.+]{0,25})attack[^+]*\+(\d+)/)) return R([["buffNext",+m[1]]]);
  if(/the next[^.]*attack[^.]*go again/.test(c)){ const o=[["gaNext"]]; if(/create a runechant/.test(c)) o.push(["runeHitNext"]); return R(o); }
  if(m=c.match(/(?:^|this(?: attack)? |it )(?:gains?|gets?) \+(\d+)\s*(?:\{p\}|power)/)) return R([["self",+m[1]]]);
  if(m=c.match(/\bamp (\d+)/)) return R([["amp",+m[1]]]);
  if(m=c.match(/create (a|an|\d+|one|two|three) runechants?/)) return R([["rune",num(m[1])]]);
  if(/create .*frostbite/.test(c)) return NOOP("frostbite — dummy pays no costs");
  if(/(create|give).*bloodrot/.test(c)) return R([["rot",1]],{approx:true});
  if(/(create|give).*frailty/.test(c)) return R([["fra",1]],{approx:true});
  if(/inertia/.test(c)) return NOOP("inertia — dummy has no action phase");
  if(/put (?:it|this card) into your (?:hero'?s? )?soul/.test(c)) return R([["soulSelf"]]);
  if(m=c.match(/banish (a|an|one|two|three|\d+) cards? from your (?:hero'?s? )?soul[:,]? ?(.*)/)){
    const sub = m[2] ? classifyClause(m[2]) : null;
    if(!sub || sub.status!=="run") return null;
    return R([["soulSpend", num(m[1]), sub.ops]]);
  }
  return null;
}

const FXMEMO = new Map();
function fxParse(card){
  const key = norm(card.name)+"|"+(card.pitch||0);
  if(FXMEMO.has(key)) return FXMEMO.get(key);
  const tt = (card.tt||"").toLowerCase();
  const kw = (card.kw||[]).map(k=>String(k).toLowerCase());
  const fx = {ga:kw.some(k=>k==="go again"), self:0, ops:[], onHit:[], conds:[], clauses:[], perm:null, dr:/defense reaction/.test(tt), approx:false};
  if(/\bally\b/.test(tt)) fx.perm="ally";
  else if(/\bitem\b/.test(tt)) fx.perm="item";
  else if(/\baura\b/.test(tt)) fx.perm="aura";
  else if(/\btrap\b/.test(tt)) fx.perm="trap";
  const clauses = clean(card.tx).split(/\.\s+|\n+/).map(s=>s.trim()).filter(Boolean);
  clauses.forEach(raw=>{
    const r = classifyClause(raw);
    if(!r){ fx.clauses.push({t:raw,st:"skip"}); return; }
    fx.clauses.push({t:raw, st:r.status});
    if(r.approx) fx.approx = true;
    r.ops.forEach(op=>{
      if(op[0]==="ga" && !r.cond && !r.onHit){ fx.ga=true; return; }
      if(op[0]==="self" && !r.cond && !r.onHit){ fx.self+=op[1]; return; }
      if(r.onHit) fx.onHit.push(op);
      else if(r.cond) fx.conds.push({cond:r.cond, op});
      else fx.ops.push(op);
    });
  });
  const tl = clean(card.tx||"").toLowerCase();
  const am = tl.match(/as an additional cost to play(?: this)?,? (you may )?discard (a|an|one|two|\d+) cards?/);
  if(am && !am[1]) fx.addCost = {discard: num(am[2])};
  if(/play(?:ed)?(?:[^.]{0,30})? from (?:your |the )?graveyard/.test(tl)) fx.fromGY = true;
  if(/play(?:ed)?(?:[^.]{0,30})? from (?:your |the )?banish/.test(tl)) fx.fromBan = true;
  if(!fx.self && !isAttack(card)){
    const pm = tl.match(/(?:gains?|gets?)\s*\+(\d+)\s*\{p\}/);
    if(pm) fx.self = +pm[1];
    else if(/\+\s*1\s*\/\s*2\s*\/\s*3\s*\{p\}/.test(tl)) fx.self = card.pitch||0;
  }
  const runs = fx.clauses.filter(x=>x.st!=="skip").length;
  fx.tier = fx.clauses.length===0 ? "full" : runs===fx.clauses.length ? "full" : runs>0 ? "part" : "none";
  fx.playable = fx.ops.length>0 || fx.onHit.length>0 || fx.conds.length>0 || !!fx.perm || fx.ga;
  FXMEMO.set(key,fx);
  return fx;
}
function parseHeroPower(tx, allowDestroy){
  const t = clean(tx);
  const m = t.match(/(once per turn )?(action|instant)\s*[-—]*\s*([^:]{0,40}?):\s*([^.]+)/i);
  if(!m) return null;
  const costStr = (m[3]||"").trim();
  const sd = allowDestroy && /\bdestroy\b/i.test(costStr);
  if(!sd && /(discard|banish|remove|destroy|sacrifice|put |reveal|soul|life|\{h\})/i.test(costStr)) return null;
  if(sd && /(discard|banish|remove|sacrifice|put |reveal|soul|life|\{h\})/i.test(costStr)) return null;
  const dm = costStr.match(/(\d+)/);
  const rsym = (costStr.match(/\{r\}/gi)||[]).length;
  const cost = dm ? +dm[1] : rsym;
  const eff = classifyClause(m[4]);
  if(!eff || eff.status!=="run" || eff.cond || eff.onHit) return null;
  const after = t.slice(m.index + m[0].length);
  const ga = /^\.?\s*go again/i.test(after);
  return {cost, ga, sd:!!sd, kind:m[2].toLowerCase(), eff:m[4].trim(),
    label:(sd?"destroy: ":(m[1]?"once/turn: ":""))+m[4].trim()+(cost?" ["+cost+"r]":"")+(ga?" · go again":"")};
}
function runeRed(c){ const m=clean(c.tx||"").toLowerCase().match(/costs? (?:\{?(\d+)\}?|a|an|one) less for each runechant/); return m?(m[1]?+m[1]:1):0; }
function effCost(c,g){ return Math.max(0,(c.cost||0)-runeRed(c)*((g&&g.rune)||0)); }
function weaponCost(tx){
  const t = clean(tx||"");
  const m = t.match(/(?:once per turn )?action\s*[-—]*\s*([^:]{0,90}?):\s*attack\b/i);
  if(!m) return null;
  const cs = (m[1]||"").trim();
  const dm = cs.match(/(\d+)\s*(?:resource|\{r\})/i) || cs.match(/(\d+)/);
  const rs = (cs.match(/\{r\}/gi)||[]).length;
  return {cost: dm ? +dm[1] : rs, addRust:/rust counter/i.test(cs), needSteam:/remove a steam counter/i.test(cs)};
}
const hasKw = (c,k) => (c.kw||[]).some(x=>String(x).toLowerCase().includes(k)) || new RegExp("\\b"+k+"\\b","i").test(c.tx||"");
const isAR = c => /attack reaction/i.test(c.tt||"");
const isInstantT = c => /\binstant\b/i.test(c.tt||"") && !/reaction/i.test(c.tt||"");

/* test hook — fxParse memoizes on name|pitch; drills must clear between fixtures */
const fxReset = () => FXMEMO.clear();

return {norm, isAttack, isArrow, isWeapon, hasGA, arcaneDmg, num, clean,
        classifyClause, fxParse, fxReset, parseHeroPower, runeRed, effCost,
        weaponCost, hasKw, isAR, isInstantT};
});
