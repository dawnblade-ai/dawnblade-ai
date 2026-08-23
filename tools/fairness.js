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
     twice is not accused.

     IT USED TO LOOK ONLY AT `uncondOps`, AND THAT IS WHY THIS SWEEP WAS
     CLEAN THROUGH SEVEN DOUBLED CARDS (v2.66). `fx.self` is a
     first-class grant that does not live in `fx.ops`, so a pump the
     parser had routed to `fx.conds` and then read AGAIN into `fx.self`
     was invisible to the one check built for exactly that shape —
     Ironsong Response, Hit and Run, Flying High, Mark of the Huntsman,
     Raydn Duskbane and Courageous Steelhand all reported clean.
     A doubled value is a doubled value wherever the second copy sits. */
  const pumps = [...tl.matchAll(/\+\s*(\d+)\s*\{p\}/g)].map(m => +m[1]);
  const pumpOpsAnywhere = [...(fx.ops||[]), ...(fx.onHit||[]),
                           ...(fx.conds||[]).map(x => x.op),
                           ...(fx.condOnHit||[]).map(x => x.op)]
    .filter(o => o && (o[0]==="buffNext" || o[0]==="self"));
  if(fx.self > 0){
    const opSame = pumpOpsAnywhere.filter(o => o[1] === fx.self);
    const timesInText = pumps.filter(n => n === fx.self).length;
    if(opSame.length && timesInText === 1)
      flag(3, "VALUE-DOUBLED", c,
        `+${fx.self}{p} appears once in the text but is applied twice`,
        `fx.self=${fx.self} AND op ${JSON.stringify(opSame[0])} — the card grants +${fx.self*2}`);
  }

  /* ---- 2b. A PRINTED "INSTEAD" APPLIED AS AN ADDITION ----------------
     "instead" REPLACES (v2.32). `classifyClause` marks a conditional
     payload that contains the word, `fx.conds[].instead` carries it, and
     the resolution sites suppress the base op of the same kind. A cond
     whose printed payload says "instead" and which parsed WITHOUT the
     flag is therefore a replacement being summed.

     This is how Overpower granted +10 where it prints +6: the generic
     if/when/while handler had read `instead` since v2.32, but Reprise,
     High Tide and Surge each hand-rolled their own gate and none of the
     three did. Check 1 could never catch it — it `continue`s on exactly
     the flag that was missing. */
  for(const {cond, op, instead} of (fx.conds||[])){
    if(instead) continue;
    const clause = (fx.clauses||[]).find(cl => /\binstead\b/i.test(cl.t||""));
    if(clause && (fx.self > 0 || uncondOps(fx).some(o => kindOf(o) === kindOf(op))))
      flag(3, "INSTEAD-ADDED", c,
        `"${cond}" prints "instead" but parsed as an ADDITION`,
        `${JSON.stringify(op)} should REPLACE the printed base, not stack with it`);
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

  /* ---- 3b. THE SAME BUG IN THE OTHER WORDING ------------------------
     "TARGET <x> attack gains +N{p}" is the reaction family's phrasing and
     this check never looked at it — it matched only "your/the NEXT ...
     attack", and then only in `fx.ops`. So ELEVEN cards dropped a printed
     restriction with the sweep reporting clean: Puncture's "sword or
     dagger" landed on a bow, Pummel's +8 for a "club or hammer weapon"
     landed on anything, and Agile Engagement's "Warrior" restricted
     nothing at all.

     THE QUALIFIER IS ASKED OF THE CARD, not of an op. `fx.self` and
     `fx.ga` are folded out of `fx.ops` by the dispatcher, so an op-only
     check finds nothing to look at for the unconditional half and then
     accuses a correctly-read card — which is exactly what the first
     version of this check did to Overpower and Ironsong Response. The
     parser parks the restriction on `fx.selfQ` / `fx.gaQ` precisely
     because a reaction has ONE target and its qualifier is a legality. */
  const tgtAtk = tl.match(/target ([a-z][a-z0-9' -]{0,40}?) attack[^.]{0,40}?(?:gets?|gains?|has) (?:\+\d+\s*(?:\{p\}|power)|go again)/);
  if(tgtAtk){
    const qual = (tgtAtk[1]||"").replace(/\b(a|an|the|this|turn)\b/g,"").trim();
    const grantsSomething = fx.self > 0 || fx.ga
      || [...(fx.ops||[]), ...(fx.conds||[]).map(x=>x.op)]
           .some(o => o && (o[0]==="self" || o[0]==="ga"));
    /* A MODAL CARD PARKS ITS RESTRICTIONS PER MODE (v3.12). "Choose 1;"
       gives each mode its own printed target, so the qualifier lives on
       `fx.modes[].q` rather than on `fx.selfQ` — and only a mode whose
       restriction was READ is selectable, which `attackRx` enforces. A
       check that knows only about `selfQ` reports every modal card as
       unrestricted; that is the tool's model being out of date rather
       than the card being wrong. */
    const modeCarries = (fx.modes||[]).some(md => md && md.q);
    if(qual && grantsSomething && !fx.selfQ && !fx.gaQ && !modeCarries)
      flag(2, "RESTRICTION-DROPPED", c,
        `it targets a "${qual}" attack but nothing carries that restriction`,
        "it will apply to any attack at all");
  }

  /* ---- 3c. A RESTRICTION IN THE TAIL (v3.31) ------------------------
     Checks 3 and 3b both read the words BEFORE "attack" — the only place
     a restriction could live while `attackQual` took one argument. Five
     kinds of restriction are printed AFTER it:

       target attack ACTION CARD WITH COST 1 OR LESS gets +3{p}
       target attack WITH 3 OR LESS BASE {p} gets +1{p}
       target attack WITH STEALTH gets go again
       your next attack action card YOU PLAY FROM ARSENAL this turn ...
       your next attack YOU BOOST this turn ...

     Every reader let `[^.]*` swallow that, so THIRTEEN pool cards applied
     to any attack at all — Lightning Press pumped a cost-3 attack where
     it prints "cost 1 or less". All of them read `tier: full`, because
     the clause WAS consumed; coverage counts consumption, never
     faithfulness. Neither 3 nor 3b could see it: their captures stop at
     the word "attack".

     This asks the PRINTED TEXT which atoms it names and the PARSE whether
     it carries each one, so it is a comparison rather than a restatement.
     Verified by sabotage: dropping the tail read makes it report all
     thirteen. */
  {
    /* THE CLAUSE, NOT THE WHOLE CARD. Agile Engagement prints "if it's
       DEFENDED BY an attack action card" — a condition about the wall,
       not a restriction on the target — and a whole-text scan read it as
       a dropped restriction. Slice the grant clause and ask only of it. */
    const GRANT = /(?:target|your next|the next)[^.]{0,110}?(?:gets?|gains?|has)[^.]{0,24}?(?:\+\d+\s*(?:\{p\}|power)|go again)/g;
    /* AND THE PARSE MUST ACTUALLY GRANT SOMETHING. Stalker's Steps and
       Mage Master Boots print this shape inside an ACTIVATED ability that
       `fxParse` files as a noop — nothing is granted, so nothing can be
       granted too widely. A tool that flags an unbuilt card is reporting
       its own model, not the engine (v3.12's lesson). */
    const qOf = o => o && (o[0] === "gaNext" ? o[1] : o[2]);
    const carriers = [fx.selfQ, fx.gaQ,
      ...((fx.modes||[]).map(md => md && md.q)),
      ...[...(fx.ops||[]), ...(fx.conds||[]).map(x => x.op)]
          .filter(o => o && /^(buffNext|gaNext|self|ga)$/.test(o[0]))
          .map(qOf)
    ].filter(Boolean).filter(q => !Array.isArray(q));
    const grantsParsed = fx.self > 0 || fx.ga
      || [...(fx.ops||[]), ...(fx.conds||[]).map(x => x.op)]
           .some(o => o && /^(buffNext|gaNext|self|ga)$/.test(o[0]));
    /* AN ACTIVATED ABILITY IS NOT THIS RULE'S CLAUSE. Mage Master Boots
       and Stalker's Steps print the shape behind an activation cost, so
       `fxParse` hands the line to the equipment reader and files a noop —
       and the card's own printed "Go again" keyword then makes `fx.ga`
       true, which looks exactly like a grant with its restriction
       dropped. Both already carry the audit's "no parsed grant path"
       flag, which is the honest place for them. */
    const ACTIVATED = /^\s*(?:once per turn\s+)?(?:action|instant|attack reaction|defense reaction)\s*[-\u2014][^:]{0,40}:/i;
    const activated = new Set(String(c.tx || "").toLowerCase().split("\n")
      .filter(l => ACTIVATED.test(l)).map(l => l.trim()));
    const inActivated = cl => [...activated].some(l => l.indexOf(cl) >= 0);
    const ATOMS = [
      [/\b(?:non-)?attack action cards?\b/,           "aac",    "attack ACTION CARD"],
      [/\bwith stealth\b/,                            "kw",     "with stealth"],
      [/\bwith cost \d+ or less\b/,                   "costLe", "with cost N or less"],
      [/\bwith cost \d+ or more\b/,                   "costGe", "with cost N or more"],
      [/\bwith \d+ or less base \{p\}/,               "powLe",  "with N or less base {p}"],
      [/\bwith \d+ or more base \{p\}/,               "powGe",  "with N or more base {p}"],
      [/\byou play from arsenal\b/,                   "from",   "you play FROM ARSENAL"],
      [/\byou boost\b/,                               "boosted","you BOOST"]
    ];
    if(grantsParsed) for(const clause of (tl.match(GRANT) || [])){
      if(inActivated(clause)) continue;
      for(const [re, key, printed] of ATOMS){
        if(!re.test(clause)) continue;
        if(key === "aac" && carriers.some(q => q.aac != null || q.nonAtk != null)) continue;
        if(carriers.some(q => q[key] != null)) continue;
        flag(2, "RESTRICTION-DROPPED", c,
          `it targets an attack "${printed}" and nothing carries that restriction`,
          "the grant will reach an attack the card cannot legally target");
      }
    }
  }

  /* ---- 3b. A MODAL CHOICE APPLIED AS A SUM (v3.12) -------------------
     "Choose 1;" means ONE mode. Pummel prints +4 in each of its two modes
     and the clause loop added both, granting +8; Two Sides to the Blade
     printed +3 and granted +6. Driven on a real board, Sledge of Anvilheim
     went from 6 to 14 instead of 10.

     CHECK 2 COULD NEVER SEE THIS. It looks for one printed value applied
     by two PATHS; here the value is printed TWICE — once per mode — and
     both are consumed, so there is only ever one path and nothing to
     compare. A doubling this plain went unreported for the tool's whole
     existence, which is why the shape gets its own check rather than a
     widening of the old one. */
  if(/\bchoose \d/i.test(tl)){
    const modeVals = ((c.tx||"").split("\n") || [])
      .filter(l => /^\s*-/.test(l))
      .map(l => { const g = l.match(/\+(\d+)\s*(?:\{p\}|power)/); return g ? +g[1] : null; })
      .filter(v => v != null);
    if(modeVals.length > 1){
      const summed = modeVals.reduce((a, b) => a + b, 0);
      const most = Math.max(...modeVals);
      if(fx.self >= summed && summed > most)
        flag(3, "MODAL-SUMMED", c,
          `"Choose 1" prints ${modeVals.join(" / ")} across its modes and the card grants ${fx.self}`,
          `one mode is chosen, so the most it can grant is +${most}`);
    }
  }

  /* An optional-cost filter that silently lost a printed limit. */
  if(fx.optCost && fx.optCost.filter){
    const f = fx.optCost.filter;
    if(/with cost \d+ or (?:less|more)/.test(tl) && f.costLe == null && f.costGe == null)
      flag(2, "RESTRICTION-DROPPED", c,
        "the cost's subject has a printed cost limit the filter does not carry",
        JSON.stringify(f));
    /* `notSelf` IS the exclusion, expressed structurally (v3.20). A field
       filter still cannot say "not this one"; what it carries is a flag
       the QUEUE SITE turns into a uid, and `promptFilter` refuses every
       candidate when it was never given one. So a filter carrying
       `notSelf` has NOT dropped the restriction — and one that omits it
       while the card prints "another" still has, which is what keeps this
       check biting.

       THIS IS THE MODEL BEING TAUGHT, NOT SILENCED — the same edit this
       check needed at v3.12, when a modal card parked its qualifier on
       `fx.modes[].q` and the tool reported both cards as unrestricted. A
       model that has gone stale and a card that has gone wrong look
       identical in a report, so the difference has to be argued rather
       than assumed. */
    if(/\banother\b/.test(tl) && !/another (?:player|hero|opponent)/.test(tl) && !f.notSelf)
      flag(2, "RESTRICTION-DROPPED", c,
        '"another" excludes the card itself, which the filter does not carry',
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
  /* THIS LIST WAS DECORATION FOR FOUR VERSIONS. The loop enumerated all six
     keywords, computed both discriminators, and then ended with
     `&& k === "go again" && fx.ga` — so five of the six were discarded and
     the check only ever asked about go again. That is exactly why the sweep
     stayed silent while Pulping had unconditional dominate: `fx.ga` is the
     engine's answer for ONE keyword, and nobody wrote down the engine's
     answer for the others.

     It is `hasKwNow` now — the same predicate the trainer asks — so this
     check is no longer a restatement of the parser's opinion but a
     comparison between what the card PRINTS and what the engine GRANTS.
     Reintroduce the bare-`hasKw` reading and this reports Pulping and
     Spectral Rider; `test/fairness.test.js` pins that it bites.

     `kwGated` is imported rather than re-derived. The old local
     `gatedInText` treated a bare "when this attacks" TRIGGER as a
     condition, which would have reported Smash Instinct — a card that
     grants intimidate on every single swing — as too strong. Two
     definitions of "gated" is how that happens. */
  const ACTED = ["go again","dominate","intimidate","crush","phantasm","overpower"];
  for(const kwName of (c.kw||[])){
    const k = String(kwName).toLowerCase();
    if(!ACTED.includes(k)) continue;
    if(!P.kwGated(c, k)) continue;
    const engineGrants = k === "go again" ? !!fx.ga : P.hasKwNow(c, k);
    if(engineGrants)
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
