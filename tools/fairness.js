#!/usr/bin/env node
/* ============================================================
   tools/fairness.js — IS THIS CARD STRONGER THAN PRINTED?

   A different question from the audit, and the one that actually decides
   whether a game is fair.

   `tools/audit.js` measures COVERAGE: how much of a card's text does the
   parser read? That is the right question while building the parser and
   the wrong one for judging a game. Three real bugs shipped in a single
   week, and the audit reported **identical tiers before and after every
   one of them**:

     v2.30  34 cards granted DOUBLE their printed buff (Act of Glory
            printed +6 and gave +12) — a "+N{p}" read by two rules at once
     v2.30  24 cards dropped a type QUALIFIER, so an arrow buff landed on
            a sword and a Runeblade buff on a Generic
     v2.31  27 cards granted go again UNCONDITIONALLY when their own text
            makes it conditional — Buckwild went again on an empty pitch
            zone; Runerager Swarm logged "condition not met" and went
            again anyway

   Every one of those cards reported tier `full`. They were read, and read
   WRONG. Coverage cannot see that, by construction: it counts clauses
   consumed, not whether the consumption was faithful.

   So this tool compares what the ENGINE WILL DO against what the CARD
   SAYS, and reports only asymmetries in the player's favour. A card that
   is weaker than printed is a different (and much less harmful) bug; this
   is deliberately one-sided, because in Flesh and Blood a card that is
   quietly too strong is the one that steals games.

   Run:  npm run fairness            ranked report
         npm run fairness --json     machine-readable
   ============================================================ */
const fs = require("fs");
const path = require("path");
const P = require(path.join(__dirname, "..", "engine", "parser.js"));

const AUDIT = path.join(__dirname, "audit.json");
if(!fs.existsSync(AUDIT)){
  console.error("tools/audit.json not found — run `npm run audit` first.");
  process.exit(1);
}
const audit = JSON.parse(fs.readFileSync(AUDIT, "utf8"));

/* Severity mirrors tools/failstates.js: rank by damage to a real game.
   3 — the player gets something the card does not grant. Steals games.
   2 — a restriction is dropped, so an effect reaches illegal targets.
   1 — an optional cost is skipped but its payload still lands. */
const SEV = {3:"CRITICAL", 2:"MAJOR", 1:"MINOR"};

const findings = [];
const flag = (sev, code, card, why, detail) =>
  findings.push({sev, code, name: card.name, pitch: card.pitch, why, detail});

/* the ops the engine actually grants without any condition attached */
const uncondOps = fx => [...(fx.ops||[])];
const kindOf = op => op[0];

for(const c of Object.values(audit.cards)){
  /* Parse with the REAL name and pitch: the parser rewrites a card's own
     name to "this", so a doctored name silently breaks self-reference
     rules, and the memo is keyed name|pitch. */
  const card = {name:c.name, pitch:c.pitch, tt:c.tt, tx:c.tx, kw:c.kw||[],
                power:c.power, def:c.def, cost:c.cost};
  let fx;
  try { fx = P.fxParse(card); } catch(e){ continue; }
  const tx = c.tx || "";
  const tl = tx.toLowerCase();

  /* ---- 1. A CONDITION THAT DOES NOT GATE ANYTHING -------------------
     The card says "IF <x>, this gets Y" and the engine also grants Y with
     no condition. The condition is then decoration — the player gets Y
     for free. This is exactly the v2.31 go-again bug, generalised to
     every op kind rather than just `ga`. */
  for(const {cond, op, instead} of (fx.conds||[])){
    const k = kindOf(op);
    /* `instead` is the LEGITIMATE version of this shape: the conditional
       payload REPLACES the base rather than adding to it, and execute
       suppresses the base op when the condition fires. Not a finding. */
    if(instead) continue;
    const alsoFree = (k === "ga" && fx.ga) ||
                     uncondOps(fx).some(o => kindOf(o) === k);
    if(alsoFree)
      flag(3, "COND-BYPASSED", c,
        `"${cond}" gates ${k}, but ${k} is ALSO granted unconditionally`,
        `the condition can never matter — the player gets ${k} either way`);
  }

  /* ---- 2. THE SAME VALUE COUNTED TWICE ------------------------------
     A "+N{p}" that appears once in the text but is applied by two
     different paths — the v2.30 double-count. Only fires when the text
     mentions that exact magnitude ONCE, so a card that genuinely pumps
     twice is not accused. */
  const pumps = [...tl.matchAll(/\+\s*(\d+)\s*\{p\}/g)].map(m => +m[1]);
  if(fx.self > 0){
    const opSame = uncondOps(fx).filter(o => (o[0]==="buffNext"||o[0]==="self") && o[1]===fx.self);
    const timesInText = pumps.filter(n => n === fx.self).length;
    if(opSame.length && timesInText === 1)
      flag(3, "VALUE-DOUBLED", c,
        `+${fx.self}{p} appears once in the text but is applied twice`,
        `fx.self=${fx.self} AND op ${JSON.stringify(opSame[0])} — the card grants +${fx.self*2}`);
  }

  /* ---- 3. A DROPPED RESTRICTION -------------------------------------
     The text restricts WHICH attack a buff applies to, and the op carries
     no qualifier — the v2.30 arrow-buff-on-a-sword bug. */
  const nextAtk = tl.match(/(?:your|the) next([^.+]{0,70}?)attack[^+]*\+\d+\s*(?:\{p\}|power)/);
  if(nextAtk){
    const qual = (nextAtk[1]||"").replace(/\b(a|an|the|this|turn)\b/g,"").trim();
    const op = uncondOps(fx).find(o => o[0]==="buffNext");
    if(qual && op && !op[2])
      flag(2, "RESTRICTION-DROPPED", c,
        `the buff is restricted to "${qual}" attacks but the op carries no qualifier`,
        "it will apply to any attack at all");
  }

  /* An optional-cost filter that silently lost a printed limit. */
  if(fx.optCost && fx.optCost.filter){
    const f = fx.optCost.filter;
    if(/with cost \d+ or (?:less|more)/.test(tl) && f.costLe == null && f.costGe == null)
      flag(2, "RESTRICTION-DROPPED", c,
        "the cost's subject has a printed cost limit the filter does not carry",
        JSON.stringify(f));
    if(/\banother\b/.test(tl) && !/another (?:player|hero|opponent)/.test(tl))
      flag(2, "RESTRICTION-DROPPED", c,
        '"another" excludes the card itself, which a field filter cannot express',
        JSON.stringify(f));
  }

  /* ---- 4. AN OPTIONAL COST TREATED AS FREE --------------------------
     "You may pay/banish/discard X. If you do, Y" where Y is granted
     unconditionally and no optional cost was read. The player collects
     the payload without paying — the bug v2.04 fixed, watched for. */
  if(/\byou may (pay|banish|discard|destroy)\b/.test(tl) && /\bif you do\b/.test(tl) && !fx.optCost){
    /* Only a finding when the RIDER ITSELF fires. An unread cost whose
       payload is also unread makes the card WEAKER than printed, which is
       the safe direction and not this tool's business — tools/failstates.js
       covers that. So classify the "if you do, X" half and require X's ops
       to actually be among the unconditional ones. `noop` never counts: it
       is bookkeeping, not an effect. */
    const rider = (tx.match(/if you do,?\s*([^.]+)/i) || [])[1];
    let riderOps = [];
    try { const rr = rider && P.classifyClause(rider); riderOps = (rr && rr.ops) || []; } catch(e){}
    const real = k => k !== "noop";
    const free = riderOps.filter(o => real(kindOf(o)))
                         .filter(o => uncondOps(fx).some(u => kindOf(u) === kindOf(o)));
    if(free.length)
      flag(1, "COST-SKIPPED", c,
        "the rider of an optional cost fires without the cost being paid",
        `rider ops granted free: ${JSON.stringify(free.map(kindOf))}`);
  }

  /* ---- 5. A KEYWORD INDEXED BUT ONLY CONDITIONALLY GRANTED ----------
     The generalisation of the v2.31 discriminator to every keyword the
     engine acts on: listed in card_keywords, mentioned in the text ONLY
     inside a sentence, never on a line of its own. */
  const ACTED = ["go again","dominate","intimidate","crush","phantasm","overpower"];
  for(const kwName of (c.kw||[])){
    const k = String(kwName).toLowerCase();
    if(!ACTED.includes(k)) continue;
    if(!new RegExp("\\b"+k.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"\\b","i").test(tx)) continue;
    const standalone = tx.split(/\n+/).some(l => new RegExp("^\\**"+k+"\\**\\.?$","i").test(l.trim()));
    const gatedInText = new RegExp("(?:if|when|while|unless)[^.]*\\b"+k+"\\b","i").test(tx);
    if(!standalone && gatedInText && k === "go again" && fx.ga)
      flag(3, "KEYWORD-UNGATED", c,
        `"${kwName}" is only granted conditionally in the text but the engine treats it as printed`,
        "card_keywords is an INDEX, not a claim of unconditional possession");
  }
}

/* ---- report -------------------------------------------------------- */
findings.sort((a,b) => b.sev - a.sev || a.name.localeCompare(b.name));

if(process.argv.includes("--json")){
  console.log(JSON.stringify({generated:new Date().toISOString(),
    appVer:audit.appVer, count:findings.length, findings}, null, 2));
  process.exit(findings.length ? 1 : 0);
}

console.log("\nFAIRNESS SWEEP — is any card STRONGER than printed?");
console.log("  pool " + Object.keys(audit.cards).length + " cards · audit " +
            (audit.appVer||"?") + "\n");

if(!findings.length){
  console.log("  Nothing found. Every card the parser reads grants no more than it prints.\n");
  console.log("  This is NOT the same as 'every card works' — see the audit for coverage,");
  console.log("  and tools/failstates.js for cards that do too LITTLE.\n");
  process.exit(0);
}

const byCode = {};
for(const f of findings) (byCode[f.code] = byCode[f.code] || []).push(f);

for(const sev of [3,2,1]){
  const rows = findings.filter(f => f.sev === sev);
  if(!rows.length) continue;
  console.log("  " + SEV[sev] + " — " + rows.length + "\n");
  for(const f of rows){
    console.log("   [" + f.code + "] " + f.name + " (pitch " + f.pitch + ")");
    console.log("      " + f.why);
    if(f.detail) console.log("      " + f.detail);
  }
  console.log("");
}
console.log("  " + findings.length + " finding(s). Each is a card that grants MORE than it prints.\n");
process.exit(1);
