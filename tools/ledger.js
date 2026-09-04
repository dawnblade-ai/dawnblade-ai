/* ============================================================
   THE LEDGER — every keyword and symbol we claim to understand,
   with its honest implementation status. The audit cross-checks
   the real pool against this; anything found that isn't here is
   flagged UNDOCUMENTED and must be added (with a real status),
   never papered over.

   Parameterized keywords (Ward 3, Arcane Barrier 1, Opt X,
   Heave 3, "<Hero> Specialization") are normalized to their base
   form by the audit before lookup.

   Statuses:
     live        — fully functional in the trainer
     partial     — recognized, core behavior works, edges missing
     approx      — deliberately simplified (see honest ledger)
     inert-dummy — parsed + logged, no effect because the training
                   dummy has no hand/turn (goes live in Phase 2)
     pending     — understood and on the roadmap, not implemented
     unreviewed  — surfaced by the pool audit; needs CR /
                   release-note review before it earns a status
     info        — deckbuilding / identity marker, no combat rules

   NOTE 2026-07-25: this file was rebuilt from AUDIT.md after a
   scripted edit truncated it. AUDIT.md prints every keyword with
   its status and note, which made it a complete backup.
   ============================================================ */

const KEYWORDS = {
   "arcane barrier":      {status:"inert-dummy", note:"prevents arcane damage — the dummy deals only physical"},
   "battleworn":          {status:"live",        note:"-1 counter per block, survives at 0"},
   "blade break":         {status:"live",        note:"equipment destroyed after blocking"},
   "boost":               {status:"live",        note:"per-attack prompt; banish top, Mechanologist grants go again"},
   "charge":              {status:"live",        note:"v3.70 — BUILT, and the record was stale. fx.chargeCost is parsed, `execute` charges the chosen card into the soul and records hist.charged, and the chargedPitchN conditions resolve; Beaming Bravado, Bolt of Courage, Courageous Steelhand and Engulfing Light all read full. Boltyn's own HERO clause is still unread, which is a separate gap (FINISH.md P1)"},
   "clash":               {status:"live",        note:"RULED 2026-07-25: both sides reveal for real, greatest POWER wins, a tie is no winner. Fires when the card DEFENDS, which is how every clash card is printed"},
   "ephemeral":           {status:"live",        note:"from Crouching Tiger's printed reminder text: if it would be put into a graveyard from anywhere, instead it ceases to exist. Enforced in the gy() helper, the single path into the graveyard"},
   "cloaked":             {status:"partial",     note:"v3.99 — build.js equips the piece face-down off the printed reminder line (ENG005: 'Equip this face-down') and the ability's flip cost spends it, so Uphold Tradition's +1{p} counter is the ONE-SHOT it prints. RULED 2026-07-25 and the ruling agrees with the printing: 'EQUIPPED FACE DOWN ... INSTANT ABILITY - ALWAYS ACTIVE - COST 1 RESOURCE - POP UP - SHOW AURAS IN PLAY - SELECT 1 - ADD A +1 ATTACK POWER COUNTER'. ('ALWAYS ACTIVE' is this user's shorthand for the instant WINDOW — they spell it out at length for Spellfire Cloak in the same batch — not a claim the ability repeats; the printed cost includes turning it face-up, which can be paid once.) UNBUILT: 'SHOW CARD BACK ON THE PLAYERS BOARD', a display half deferred with the rest of the UI pass"},
   "crank":               {status:"pending",  note:"RULED 2026-07-25: the item enters with a steam counter; crank prompts to spend it for an action point. Needs the prompt sheet"},
   "crush":               {status:"partial",     note:"threshold and payload read off each card's own printed rider (v3.16); the two next-turn DEBUFFS built v3.29 and the two RESTRICTIONS v3.30. Partial for one card: Walk in My Shoes halves base {p} and {d} for a turn and has no reader"},
   "dominate":            {status:"live",        note:"v2.05: the dummy holds cards, so this really does hold it to one blocker from hand"},
   /* BUILT v3.03. Both halves were `noop` until v3.02 with reasons about a
      training prop retired in v2.71, so Cold Snap reported `tier: full`
      while doing nothing. `payOr` asks the target, declining freezes, and
      the mark records WHOSE freeze it is so the thaw needs no turn
      arithmetic — the two boards count `turn` differently. */
   "freeze":              {status:"live",        note:"RULED 2026-07-25: the target may pay {r} to avoid it; if they decline the caster picks one of their arsenal cards or allies, and it cannot be played or activated until the start of the caster's next turn. The 'or activated' half has nothing to bite on until allies attack"},
   "go again":            {status:"live",        note:"printed via card_keywords; conditional grants parsed from text (never merged — the Kayo rule)"},
   "guardwell":           {status:"live",        note:"defense drops to 0 at chain close"},
   "heave":               {status:"live",        note:"BUILT v3.32 from the card's printed reminder text (the database carries none): at the arsenal step, with an empty arsenal and N floating, pay N to set it FACE UP and create N Seismic Surge tokens"},
   "high tide":           {status:"live",        note:"a GATED pitchBlueN condition in classifyClause, evaluated in execute's condition loop; all 6 pool records read `full`. Was UNREVIEWED for versions after it was built — v3.69's rule: when a record says a thing is unbuilt, go and ask the engine"},
   "ice fusion":          {status:"unreviewed",  note:"RULED 2026-07-25 (spec in tools/rulings.json) — Iyslander — fusion cost rider"},
   "intimidate":          {status:"live",        note:"v2.05: banishes a card from the dummy's hand face-down on attack — a real cost now"},
   "legendary":           {status:"info",        note:"deckbuilding limit: 1 copy"},
   "lightning flow":      {status:"unreviewed",  note:"Briar"},
   "lightning fusion":    {status:"unreviewed",  note:"RULED 2026-07-25 (spec in tools/rulings.json) — Briar — fusion cost rider"},
   "mark":                {status:"live",        note:"RULED 2026-07-25: qualifier only; the marked state now rides on g.dMarked"},
   "meld":                {status:"live",        note:"v3.34 built the whole declaration — isSplit/splitFx/splitCostsAP, the half is chosen before the payment, and judge refuses half:\"both\" without the keyword. RULED 2026-07-25 (spec in tools/rulings.json)"},
   "opt":                 {status:"partial",     note:"RULED 2026-07-25: top N, any order, top or bottom. Auto-sorted by advisor value; the choose-and-order popup is still pending"},
   "overpower":           {status:"unreviewed",  note:"defense restriction; needs CR wording"},
   "phantasm":            {status:"live",        note:"RULED 2026-07-25: a drawback — one blocker with 6+ printed POWER pops the attack; destroyed, so no go again and no action-point refund"},
   "piercing":            {status:"unreviewed",  note:"seen in pool; needs CR wording"},
   "quickstrike":         {status:"live",        note:"v3.99 — the printed gate ('if this has go again') is read into a hasGa condition and settled in linkPumps beside `pumped`. Was UNREVIEWED while the keyword prefix let the loose pump matcher eat the gate, so all three printings pumped unconditionally"},
   "reload":              {status:"live",        note:"v3.69 — the parser rule, the op, the arsEmpty gate and the prompt had all existed for versions and the RECORD was stale. The 1HP237 printing of Take Aim carries the reminder text the database omits: FACE DOWN, a different event from the face-UP put Azalea's arrows trigger on"},
   "reprise":             {status:"live",     note:"RULED 2026-07-25: live since the dummy blocks from hand — counts the non-equipment defenders declared this chain link"},
   "retrieve":            {status:"live",        note:"RULED 2026-07-25 + the SAR017 PRINTING (v3.53): 'you may retrieve a dagger from your graveyard. (Pay {r} to equip it.)' — a graveyard pick costing {r} whose destination is the GEAR zone. Needed destroyed gear to reach the graveyard first (RULING 2026-08-29, effects.sweepGear)"},
   "rupture":             {status:"live",        note:"v3.99 — 'if this is played as chain link N or higher' read into chainLinkGeN, threshold carried in the name, settled in linkPumps. Same prefix defect as quickstrike"},
   "sharpen":             {status:"live",        note:"v3.66 — ctrPut{kind:pow,n:1}; the MPW103 PRINTING carries the reminder text the database omits: put a +1{p} counter on the target, remove ALL +1{p} counters from IT at end of turn"},
   "solflare":            {status:"unreviewed",  note:"Boltyn package"},
   "specialization":      {status:"info",        note:"hero-locked card (normalized from '<Hero> Specialization')"},
   "spellvoid":           {status:"inert-dummy", note:"destroy this to prevent N arcane — the dummy deals only physical"},
   "steal":               {status:"unreviewed",  note:"Arakni package"},
   "stealth":             {status:"live",        note:"RULED 2026-07-25: does nothing alone — a qualifier other cards test for"},
   "surge":               {status:"partial",     note:"v3.70 - PARTIAL, and the record said unreviewed. classifyClause reads the Surge dash line into a surgeOverN condition and effects evaluates it; Aether Quickening and Open the Flood Gates both read full. It is partial rather than live because the condition is APPROXIMATED as amp>0 rather than the damage actually dealt - partial counts as built for an upside and never for a drawback (v3.00)"},
   /* BUILT v3.00. The payload used to be queued on PLAY — Act of Glory
      handed you +6{p} the moment the aura landed rather than two turns
      later — so the keyword was a bonus where it prints a DELAY. It ticks
      in `effects.tickSuspense`, which both turn structures call. */
   "suspense":            {status:"live",        note:"RULED 2026-07-25: enters with 2 counters (same on every suspense card), ticks at the beginning of the turn, destroyed at 0 and the `when this leaves the arena` payload fires then"},
   "temper":              {status:"live",        note:"-1 per block, destroyed at 0"},
   "the crowd boos":      {status:"live",        note:"RULED 2026-07-25: leaves a per-turn booed state; the boo itself does nothing and Reviled is a static talent"},
   "the crowd cheers":    {status:"info",        note:"RULED 2026-07-25: Revered is a static talent — nothing to resolve"},
   "transcend":           {status:"live",        note:"RULED 2026-07-25: the card flips to Inner Chi and returns to hand instead of the graveyard"},
   "unity":               {status:"live",        note:"v3.27 — 'when this defends together with a card from hand'; BOTH walls count their hand defenders before either loop starts, which is the whole of the rule"},
   "ward":                {status:"live",        note:"soaks incoming; arcane ward tracked separately (awd)"},
   /* BOTH HALVES BUILT (v3.00). The upside was live for a long time and
      the drawback was not, which left the six Pirate allies an infinite
      loop that every coverage tool reported as `tier: full`. An ally that
      dies is now stamped `_fd` in the graveyard and
      `parser.playableFromZone` refuses it — one rule, both boards. */
   "watery grave":        {status:"live",        note:"RULED 2026-07-25: Gravy Bones' ability — playable from the graveyard once a blue card has hit it this turn, and a dead ally goes FACE-DOWN so it cannot be replayed"},
};

const SYMBOLS = {
  "{d}": {status:"live", note:"defense — defBuff ops"},
  "{h}": {status:"live", note:"life"},
  "{i}": {status:"display", note:"intellect — stat display only, no parsed ops use it"},
  "{p}": {status:"live", note:"power / pitch pips — pump parser reads +N{p} and the +1/2/3{p} shorthand"},
  "{r}": {status:"live", note:"resource — costs and gains"},
  /* WHEN YOU CLOSE A RECORDED GAP, DELETE THE RECORD (v3.41). Both of
     these said "not parsed" and both had stopped being true — and this
     ledger is not prose: `failstates.js` grades a keyword's severity
     against its STATUS rather than a grep, so a stale `pending` is
     load-bearing. The 2026-07-22 finding underneath the {t} note is kept
     because it is still the reason tap detection keys on the symbol and
     never on the word. */
  "{t}": {status:"live", note:"TAP cost symbol. AUDIT FINDING 2026-07-22: no pool text spells the word 'tap', so tap detection keys on {t} and never on the word. Charged by the ROUTE, per source: an ally's attack (v3.44), a weapon swing (v2.46 weaponCost.taps), an equipment or item ability (tapsToActivate + perTurnCleared), a triggered `you may {t} this` (v3.33), and a HERO's own ability (v3.48). RULING (user, 2026-08-25): a tapped hero cannot be tapped again to pay a cost, and is otherwise unaffected. 14 of the pool's 17 {t} cards enforce it; the 3 that do not have no reader for the ability's PAYLOAD"},
  "{u}": {status:"partial", note:"UNTAP — BUILT v3.47 for Scuttle Toes (`{u} target ally you control`), which buys a second ally attack now that allies tap to attack. Jack Be Quick still refuses: its {u} untaps an OPPOSING ally and then steals it, and nothing models a control change"},
  "{x}": {status:"display", note:"variable X cost (Beckoning Haunt) — no parsed ops"},
};

module.exports = { KEYWORDS, SYMBOLS };
