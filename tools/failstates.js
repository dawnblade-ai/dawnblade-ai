#!/usr/bin/env node
/* ============================================================
   FAIL STATES — how each card goes WRONG at the table.

   The audit answers a coverage question: "how much of this card's text
   does the parser read?" That is the right question for building the
   parser and the wrong question for judging a game. A card can be 90%
   read and still hand a player a win they did not earn.

   This tool asks the judge's question instead: **if this card is played
   tonight, what happens that should not?** The categories are ordered by
   how much damage they do to a game judged at pro-tour standards, and
   the ordering is deliberately NOT "how much text is unread":

     3  UNFAIR      the sim lets a player do something the rules forbid,
                    or skips a drawback they agreed to. They win games
                    they should lose. This is the worst thing a trainer
                    can do, because it teaches wrong play.
     2  WRONG NUM   the sim shows a number that is arithmetically wrong.
                    Insidious: the player TRUSTS the total. Worse than a
                    dead card, which is at least visibly dead.
     2  NO SCHEDULE a delayed or continuous effect (CR 6.3/6.4) with
                    nowhere to live, so it fires early, late, or never.
     1  LOST VALUE  the player is denied something they earned. Annoying,
                    honest, and visible — they can see the card did
                    nothing.
     0  INERT       the card does literally nothing and looks like it.

   HONESTY RULE. Every verdict here is INFERRED from clause text by
   pattern, not from playing the card. A pattern can misread a clause,
   and this tool must never claim otherwise — each entry carries the
   clause that triggered it so a human can overrule it. That is the same
   discipline `mentions()` uses in the sweep: report the signal, name its
   basis, let the reviewer judge. It is also why the output goes into the
   review station rather than straight into a fix.

   Consumed by tools/sweep.js as section 4. Run standalone for a report:
     node tools/failstates.js
   ============================================================ */
const fs = require("fs");
const path = require("path");
const HERE = __dirname;

const slug = s => String(s||"").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const clean = t => String(t||"").replace(/\*\*?/g, "").replace(/\s+/g, " ").trim();

/* A clause is a gap only when the parser SKIPPED it. "run" is handled and
   "noop" is parsed-and-deliberately-nothing (already accounted for). */
const isUnread = x => x && x.st === "skip";

/* ---- the categories -------------------------------------------------
   Each carries the patterns that identify it and the sentence that says
   what actually happens at the table. Patterns are matched against ONE
   clause at a time, lowercased. */
const CATS = [
  {
    key: "illegal-play",
    sev: 3,
    label: "Illegal play allowed",
    /* Restrictions are the sharpest kind of rules text: they say what MAY
       NOT happen. An unenforced restriction is a rules violation every
       time the card is played, not a missing bonus. */
    re: [
      /can'?t be defended/, /cannot be defended/, /can only be defended/,
      /can only defend/, /play this only if/, /can'?t be played/,
      /can'?t attack/, /may not be/, /can'?t block/, /only if you/,
      /can'?t gain/, /cannot gain/, /can'?t be targeted/
    ],
    table: "The restriction is not enforced, so a play the rules forbid goes through — every time this card is used."
  },
  {
    key: "missing-drawback",
    sev: 3,
    label: "Drawback skipped",
    /* These cards are priced with a downside. Skip the downside and the
       card is simply better than printed — the player gets an above-rate
       effect the format never gave them.

       SUBJECT MATTERS, and getting it wrong overstates the danger. A
       reduction aimed at the OPPONENT ("they discard", "target card
       defending gets -2{d}") is the player's upside, not their drawback.
       `otherSubject` below downgrades those to lost value. Bare
       /is destroyed/ is deliberately absent: in this pool it is almost
       always a TRIGGER condition ("when this is destroyed, create …"),
       which is a payoff. */
    re: [
      /destroy(ed)? this attack/, /this attack is destroyed/,
      /this gets? -\d/, /it gets? -\d/, /-\d+\s*\{p\} unless/,
      /unless you pay/, /you lose \d/, /deals? \d+ damage to you/,
      /halved/, /rounded up/,
      /put(s)? this into (his|her|their|your) graveyard instead/
    ],
    table: "The card's own downside never lands, so it plays as strictly better than printed."
  },
  {
    key: "cost-inert",
    sev: 1,
    label: "Ability inert — cost not modelled",
    /* NOT a free lunch, and calling it one would be dishonest. v2.04 made
       exactly these deliberately inert rather than free, and CLAUDE.md
       records "If you do, …" as intentionally unread for the same reason:
       running the payload without charging the cost IS the bug, so
       refusing to run it is the correct conservative choice.

       These are flagged because they are now BUILDABLE, not because they
       are broken. engine/prompts.js has a `pay` variant (pay-or-decline,
       addressed to a side) that did not exist when they were shelved.
       Every card here is a spec away from working. */
    re: [
      /as an additional cost/, /destroy this/, /discard (a|an|one|two|three|\d+)/,
      /banish (a|an|another|\d+)/, /pay \{r\}/, /pay \d/, /if you do/,
      /you may pay/
    ],
    table: "The cost cannot be charged, so the whole ability is deliberately inert (the v2.04 fix). Safe, but the player simply cannot use it — and the `pay` prompt variant now exists to build it."
  },
  {
    key: "wrong-number",
    sev: 2,
    label: "Displayed total is wrong",
    /* The most insidious failure mode in a trainer: the player reads the
       number off the screen and believes it. */
    re: [
      /\+\d+\s*\{p\}/, /\+\d+\s*\{d\}/, /gets? \+\d/, /gains? \+\d/, /has \+\d/,
      /deals? \d+ (arcane )?damage/, /power (is|becomes)/,
      /defense (is|becomes)/, /for each/, /equal to/
    ],
    table: "This modifies power, defense or damage. Unread, the total shown to the player is arithmetically wrong — and they will trust it."
  },
  {
    key: "no-schedule",
    sev: 2,
    label: "No schedule to fire on",
    /* CR 6.3 continuous effects and 6.4 delayed triggered effects. The
       user's rulings call these "macros" over and over, which is exactly
       what they are. The trainer has no register for them. */
    re: [
      /at the (beginning|start|end) of/, /the next time/, /until end of turn/,
      /until the (beginning|start|end) of/, /this turn/, /next turn/,
      /when this (leaves|enters)/, /while (this|you)/, /each time/,
      /whenever/, /during (your|an opponent)/
    ],
    table: "A delayed or continuous effect (CR 6.3/6.4) with nowhere to live — it fires early, late, or never. This is the 'macro' register the rulings keep asking for."
  },
  {
    key: "choice-skipped",
    sev: 1,
    label: "Choice never offered",
    re: [
      /you may/, /choose (one|a|an|up to)/, /target/, /up to \d/,
      /any target/, /may choose/, /if (you|they) wish/
    ],
    table: "A decision that belongs to a player is never offered; the engine silently takes one branch."
  },
  {
    key: "lost-upside",
    sev: 1,
    label: "Earned value denied",
    re: [
      /go again/, /draw (a|an|one|two|\d+)/, /create (a|an|\d+)/,
      /gain \d+ life/, /search/, /return .* to (your|his|her|their) hand/,
      /put .* into (your|his|her|their) (hand|arsenal|soul)/,
      /gain \d+ action point/, /gain(s)? \{r\}/, /dominate/, /go-again/
    ],
    table: "The player earned this and does not get it. Visible and honest — they can see the card did nothing."
  }
];

/* Does this clause aim its effect at somebody OTHER than the controller?
   If so, a "penalty" pattern in it is the controller's upside. */
const otherSubject = t => /\b(they|their|them|opponent|opposing|target card defending|defending card|each other|its controller)\b/.test(t);

/* ---- THE NOOP BLIND SPOT --------------------------------------------
   The audit files a clause as "noop" to mean "parsed, and it genuinely
   does nothing on its own" — printed keywords like stealth and mark,
   which really are inert until another card asks about them.

   But a keyword filed as noop that ACTUALLY has rules meaning is
   invisible to every coverage tool, because noop counts as accounted
   for. Phantasm is the case that proves it: the ruling says an attack
   blocked by a 6+ power card is DESTROYED, and yet

       Spears of Surreality   tier = full    kw = [Phantasm, Go again]

   reports as fully scripted while its entire drawback is ignored. A
   coverage audit can never surface that; a fail-state audit must.

   The honest test is the ruling's own words. Where the user wrote that a
   keyword "does nothing on its own", noop is correct and this is silent.
   Where the ruling describes real behaviour, noop is a mis-filing. */
const INERT_BY_DESIGN = /does nothing on its own|doesn'?t mean anything on it'?s own|nothing happens|is static and doesn'?t change|nothing on its own/i;

function noopBlindSpots(card, RULINGS){
  const out = [];
  for(const cl of (card.clauses || [])){
    if(!cl || cl.st !== "noop") continue;
    const kw = clean(cl.t).toLowerCase().replace(/\s+\d+$/, "");   /* "arcane barrier 1" -> "arcane barrier" */
    const key = slug(kw);
    const r = (RULINGS || {})[key];
    if(!r) continue;
    const txt = String(r.ruling || r.answer || r.note || r.text || "");
    if(!txt || INERT_BY_DESIGN.test(txt)) continue;   /* correctly inert */
    /* A drawback filed as noop is the worst case: the card is above rate
       and every tool reports it as handled. */
    /* "can not" with a space is how the watery-grave ruling phrases it, and
       a /can'?t/-only test read that whole mechanic as harmless. Getting
       this wrong matters: unread, watery grave lets Gravy Bones replay the
       same ally out of the graveyard forever. */
    const isDrawback = /drawback|destroy(ed)?|penalt|can ?not|can'?t|reduce|restrict|prevent|infinit/i.test(txt);
    out.push({
      cat: "noop-with-meaning",
      sev: isDrawback ? 3 : 2,
      label: isDrawback ? "Keyword filed as no-op, but it is a DRAWBACK" : "Keyword filed as no-op, but it has meaning",
      table: "The parser records \"" + clean(cl.t) + "\" as doing nothing, so this card can report as fully " +
             "scripted while the keyword is ignored. Your ruling describes real behaviour: " +
             txt.replace(/\s+/g, " ").trim().slice(0, 240),
      clause: clean(cl.t),
      keyword: kw
    });
  }
  return out;
}

/* ---- classify one card ---------------------------------------------- */
function classify(card, RULINGS){
  const clauses = card.clauses || [];
  const unread = clauses.filter(isUnread);
  const runs = clauses.filter(x => x && x.st === "run").length;
  const blind = noopBlindSpots(card, RULINGS);

  /* Nothing skipped AND no mis-filed keyword: genuinely not a fail state.
     A card with only blind spots still is one — that is the whole point. */
  if(!unread.length && !blind.length) return null;

  const hits = [...blind];
  for(const cl of unread){
    const t = clean(cl.t).toLowerCase();
    const other = otherSubject(t);
    for(const cat of CATS){
      if(!cat.re.some(re => re.test(t))) continue;
      /* A penalty aimed at the opponent is not the controller's drawback:
         skipping it denies the PLAYER a payoff and spares the OPPONENT a
         cost. Real, but the opposite of unfair-to-the-opponent. */
      if(cat.key === "missing-drawback" && other){
        hits.push({cat: "lost-upside", sev: 1, label: "Earned value denied",
          table: "This penalty lands on the OPPONENT, so skipping it denies the player a payoff and spares the opponent a cost.",
          clause: clean(cl.t)});
        continue;
      }
      hits.push({cat: cat.key, sev: cat.sev, label: cat.label, table: cat.table, clause: clean(cl.t)});
    }
  }

  if(!hits.length){
    /* Unread text that matches no pattern. Honest answer: we do not know
       what breaks, only that something is unread. Never guess. */
    return {
      sev: runs ? 2 : 0,
      cats: [{cat: "unclassified", sev: runs ? 2 : 0, label: "Unread, effect unknown",
        table: runs
          ? "Part of this card resolves and part is unread, so the outcome is some unknown fraction of the printed card."
          : "Nothing on this card resolves. It is inert, and at least visibly so.",
        clause: clean(unread[0].t)}],
      unread: unread.length, runs
    };
  }

  /* Dedupe by category, keep the worst severity. */
  const byCat = new Map();
  for(const h of hits) if(!byCat.has(h.cat)) byCat.set(h.cat, h);
  const cats = [...byCat.values()].sort((a,b) => b.sev - a.sev);
  return {sev: cats[0].sev, cats, unread: unread.length, runs};
}

/* ---- which rulings already cover a card ------------------------------
   A card whose ruling exists but which still fails is the highest-value
   entry in the whole tool: the thinking is done, only the building is
   left. Index rulings both by their own slug convention and by the
   "Name (pitch)" strings they list. */
function rulingIndex(RULINGS){
  const bySlug = new Set(), byCard = new Map();
  for(const [k, v] of Object.entries(RULINGS || {})){
    if(k.startsWith("_")) continue;
    bySlug.add(k);
    for(const c of (v.cards || [])){
      const m = String(c).match(/^(.*?)\s*\((\d+)\)\s*$/);
      const key = m ? slug(m[1]) + "-" + m[2] : slug(String(c)) + "-0";
      if(!byCard.has(key)) byCard.set(key, []);
      byCard.get(key).push(v.mechanic || k);
    }
  }
  return {bySlug, byCard};
}

/* ---- build ----------------------------------------------------------- */
function failStates(A, RULINGS){
  const idx = rulingIndex(RULINGS);
  const out = [];
  for(const c of Object.values(A.cards || {})){
    const f = classify(c, RULINGS);
    if(!f) continue;
    const key = slug(c.name) + "-" + (c.pitch || 0);
    const mechanics = idx.byCard.get(key) || [];
    const ruled = mechanics.length > 0 || idx.bySlug.has("card-" + key);
    const heroes = [...new Set(((A.usage || {})[c.name.toLowerCase() + "|" + (c.pitch||0)] || [])
      .map(u => u.hero))];
    out.push({
      slug: "fail-" + key,
      kind: "fail",
      title: c.name,
      sub: (c.tt || "") + " · pitch " + (c.pitch || 0),
      pitch: c.pitch || 0,
      tier: c.tier,
      tx: c.tx || "",
      sev: f.sev,
      cats: f.cats,
      unread: f.unread,
      runs: f.runs,
      ruled,
      mechanics,
      heroes,
      clauses: (c.clauses || []).map(x => ({t: x.t, covered: !isUnread(x), st: x.st}))
    });
  }
  /* Worst first; within a severity, put the ones whose ruling already
     exists at the top — those are ready to build. */
  return out.sort((a, b) =>
    b.sev - a.sev ||
    (a.ruled === b.ruled ? 0 : a.ruled ? -1 : 1) ||
    b.unread - a.unread ||
    a.title.localeCompare(b.title));
}

/* Hero abilities get the same treatment. Their clauses use `covered`
   rather than a status, so adapt the shape and reuse one classifier. */
function heroFailStates(A, RULINGS){
  const out = [];
  for(const h of Object.values(A.heroes || {})){
    const shaped = {
      name: h.name, pitch: 0, tt: h.tt, tier: "hero", tx: h.tx,
      clauses: (h.clauses || []).map(c => ({t: c.t, st: c.covered ? "run" : "skip"}))
    };
    const f = classify(shaped, RULINGS);
    if(!f) continue;
    out.push({
      slug: "fail-hero-" + slug(h.name),
      kind: "fail",
      title: h.name,
      sub: (h.tt || "Hero") + " — hero ability",
      pitch: 0, tier: "hero", tx: h.tx || "",
      sev: f.sev, cats: f.cats, unread: f.unread, runs: f.runs,
      ruled: false, mechanics: [], heroes: [slug(h.name)],
      isHero: true,
      clauses: shaped.clauses.map(x => ({t: x.t, covered: x.st === "run", st: x.st}))
    });
  }
  return out.sort((a, b) => b.sev - a.sev || b.unread - a.unread || a.title.localeCompare(b.title));
}

const SEV_NAME = {3: "UNFAIR", 2: "WRONG", 1: "LOST VALUE", 0: "INERT"};

module.exports = {failStates, heroFailStates, classify, CATS, SEV_NAME, isUnread};

/* ---- standalone report ----------------------------------------------- */
if(require.main === module){
  const A = JSON.parse(fs.readFileSync(path.join(HERE, "audit.json"), "utf8"));
  let R = {}; try { R = JSON.parse(fs.readFileSync(path.join(HERE, "rulings.json"), "utf8")); } catch(e){}
  const cards = failStates(A, R), heroes = heroFailStates(A, R);
  const B = t => "\x1b[1m" + t + "\x1b[0m";
  console.log("\n" + B("FAIL STATES") + " — how each card goes wrong at the table\n");
  const bySev = s => cards.filter(c => c.sev === s);
  for(const s of [3, 2, 1, 0]){
    const list = bySev(s);
    if(!list.length) continue;
    console.log(B("  " + SEV_NAME[s] + "  (" + list.length + " cards)"));
    for(const c of list.slice(0, 14)){
      console.log("     " + (c.ruled ? "◆" : " ") + " " + c.title.padEnd(30) +
        c.cats.map(x => x.label).join(", ").slice(0, 62));
    }
    if(list.length > 14) console.log("     … and " + (list.length - 14) + " more");
    console.log();
  }
  const cat = {};
  for(const c of cards) for(const x of c.cats) cat[x.label] = (cat[x.label] || 0) + 1;
  console.log(B("  BY CATEGORY"));
  for(const [k, v] of Object.entries(cat).sort((a, b) => b[1] - a[1]))
    console.log("     " + String(v).padStart(4) + "  " + k);
  console.log("\n  ◆ = a ruling already exists (" + cards.filter(c => c.ruled).length +
    " of " + cards.length + ") — the thinking is done, only the building is left.");
  console.log("  Heroes with fail states: " + heroes.length);
  console.log("\n  Station: npm run sweep && open tools/sweep.html\n");
}
