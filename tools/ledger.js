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
   "charge":              {status:"pending",     note:"RULED 2026-07-25 (spec in tools/rulings.json) — Boltyn's soul engine"},
   "clash":               {status:"live",        note:"RULED 2026-07-25: both sides reveal for real, greatest POWER wins, a tie is no winner. Fires when the card DEFENDS, which is how every clash card is printed"},
   "ephemeral":           {status:"live",        note:"from Crouching Tiger's printed reminder text: if it would be put into a graveyard from anywhere, instead it ceases to exist. Enforced in the gy() helper, the single path into the graveyard"},
   "cloaked":             {status:"unreviewed",  note:"Arakni package"},
   "crank":               {status:"pending",  note:"RULED 2026-07-25: the item enters with a steam counter; crank prompts to spend it for an action point. Needs the prompt sheet"},
   "crush":               {status:"partial",     note:"4+ threshold checked at resolve; hand payload live from v2.05, arsenal/next-turn payloads still inert"},
   "dominate":            {status:"live",        note:"v2.05: the dummy holds cards, so this really does hold it to one blocker from hand"},
   "freeze":              {status:"unreviewed",  note:""},
   "go again":            {status:"live",        note:"printed via card_keywords; conditional grants parsed from text (never merged — the Kayo rule)"},
   "guardwell":           {status:"live",        note:"defense drops to 0 at chain close"},
   "heave":               {status:"unreviewed",  note:"seen on Thunder Quake (Guardian)"},
   "high tide":           {status:"unreviewed",  note:"2+ blue cards in pitch zone rider (Gravy Bones)"},
   "ice fusion":          {status:"unreviewed",  note:"RULED 2026-07-25 (spec in tools/rulings.json) — Iyslander — fusion cost rider"},
   "intimidate":          {status:"live",        note:"v2.05: banishes a card from the dummy's hand face-down on attack — a real cost now"},
   "legendary":           {status:"info",        note:"deckbuilding limit: 1 copy"},
   "lightning flow":      {status:"unreviewed",  note:"Briar"},
   "lightning fusion":    {status:"unreviewed",  note:"RULED 2026-07-25 (spec in tools/rulings.json) — Briar — fusion cost rider"},
   "mark":                {status:"live",        note:"RULED 2026-07-25: qualifier only; the marked state now rides on g.dMarked"},
   "meld":                {status:"unreviewed",  note:"RULED 2026-07-25 (spec in tools/rulings.json) — split-effect cards (Arcane Seeds // Life, Briar)"},
   "opt":                 {status:"partial",     note:"RULED 2026-07-25: top N, any order, top or bottom. Auto-sorted by advisor value; the choose-and-order popup is still pending"},
   "overpower":           {status:"unreviewed",  note:"defense restriction; needs CR wording"},
   "phantasm":            {status:"live",        note:"RULED 2026-07-25: a drawback — one blocker with 6+ printed POWER pops the attack; destroyed, so no go again and no action-point refund"},
   "piercing":            {status:"unreviewed",  note:"seen in pool; needs CR wording"},
   "quickstrike":         {status:"unreviewed",  note:"seen on Rush of Power"},
   "reload":              {status:"pending",     note:"RULED 2026-07-25 (spec in tools/rulings.json) — roadmap #4 — Azalea"},
   "reprise":             {status:"live",     note:"RULED 2026-07-25: live since the dummy blocks from hand — counts the non-equipment defenders declared this chain link"},
   "retrieve":            {status:"unreviewed",  note:"RULED 2026-07-25 (spec in tools/rulings.json) — seen in pool; hero package TBD"},
   "rupture":             {status:"unreviewed",  note:"seen in pool; hero package TBD"},
   "sharpen":             {status:"unreviewed",  note:"seen in pool; hero package TBD"},
   "solflare":            {status:"unreviewed",  note:"Boltyn package"},
   "specialization":      {status:"info",        note:"hero-locked card (normalized from '<Hero> Specialization')"},
   "spellvoid":           {status:"inert-dummy", note:"destroy this to prevent N arcane — the dummy deals only physical"},
   "steal":               {status:"unreviewed",  note:"Arakni package"},
   "stealth":             {status:"live",        note:"RULED 2026-07-25: does nothing alone — a qualifier other cards test for"},
   "surge":               {status:"unreviewed",  note:"bonus when dealing more than printed arcane (Blaze)"},
   "suspense":            {status:"pending",     note:"RULED 2026-07-25: enters with 2 counters (same on every suspense card), ticks at start of turn, destroyed at 0 and the payload fires then — not built yet"},
   "temper":              {status:"live",        note:"-1 per block, destroyed at 0"},
   "the crowd boos":      {status:"live",        note:"RULED 2026-07-25: leaves a per-turn booed state; the boo itself does nothing and Reviled is a static talent"},
   "the crowd cheers":    {status:"info",        note:"RULED 2026-07-25: Revered is a static talent — nothing to resolve"},
   "transcend":           {status:"live",        note:"RULED 2026-07-25: the card flips to Inner Chi and returns to hand instead of the graveyard"},
   "unity":               {status:"unreviewed",  note:"Boltyn package"},
   "ward":                {status:"live",        note:"soaks incoming; arcane ward tracked separately (awd)"},
   /* TWO HALVES, AND ONLY ONE IS BUILT (v3.00). The UPSIDE is live —
      `built.wateryGrave` plus the blue-in-graveyard check lets Gravy Bones
      replay these from the graveyard. The DRAWBACK the ruling exists for
      is not: "they must be turned face down when they die so they can not
      be used infinitely". Recorded as live, it read as done. */
   "watery grave":        {status:"partial",     note:"RULED 2026-07-25: Gravy Bones' ability — playable from the graveyard once a blue card has hit it this turn. THE DRAWBACK IS NOT BUILT: a dead ally must go face-down so it cannot be replayed forever"},
};

const SYMBOLS = {
  "{d}": {status:"live", note:"defense — defBuff ops"},
  "{h}": {status:"live", note:"life"},
  "{i}": {status:"display", note:"intellect — stat display only, no parsed ops use it"},
  "{p}": {status:"live", note:"power / pitch pips — pump parser reads +N{p} and the +1/2/3{p} shorthand"},
  "{r}": {status:"live", note:"resource — costs and gains"},
  "{t}": {status:"pending", note:"TAP cost symbol. AUDIT FINDING 2026-07-22: no pool text spells the word 'tap', so the trainer's /\\btap\\b/ rotation checks never fire — tap detection must key on {t}; parser does not enforce tap costs"},
  "{u}": {status:"pending", note:"UNTAP — seen on Jack Be Quick, Scuttle Toes; not parsed"},
  "{x}": {status:"display", note:"variable X cost (Beckoning Haunt) — no parsed ops"},
};

module.exports = { KEYWORDS, SYMBOLS };
