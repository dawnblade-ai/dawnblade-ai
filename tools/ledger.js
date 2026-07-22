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
   ============================================================ */
const KEYWORDS = {
  /* — reviewed, in the trainer today — */
  "go again":       {status:"live",        note:"printed via card_keywords; conditional grants parsed from text (never merged — the Kayo rule)"},
  "boost":          {status:"live",        note:"per-attack prompt; banish top, Mechanologist grants go again"},
  "ward":           {status:"live",        note:"soaks incoming; arcane ward tracked separately (awd)"},
  "blade break":    {status:"live",        note:"equipment destroyed after blocking"},
  "battleworn":     {status:"live",        note:"-1 counter per block, survives at 0"},
  "temper":         {status:"live",        note:"-1 per block, destroyed at 0"},
  "guardwell":      {status:"live",        note:"defense drops to 0 at chain close"},
  "arrow":          {status:"live",        note:"fires from arsenal only (Ranger law)"},
  "crush":          {status:"partial",     note:"4+ damage threshold checked at resolve; debuff payloads inert vs dummy"},
  "clash":          {status:"approx",      note:"dummy pantomimes its reveal instead of truly pitching"},
  "dominate":       {status:"inert-dummy", note:"defender restricted to 1 card from hand — no hand to restrict"},
  "intimidate":     {status:"inert-dummy", note:"banishes a card from defender's hand face-down — no hand"},
  "reprise":        {status:"inert-dummy", note:"needs a defending card from hand to check"},
  "inertia":        {status:"inert-dummy", note:"taxes the opponent's action phase — dummy has none"},
  "arcane barrier": {status:"inert-dummy", note:"prevents arcane damage — the dummy deals only physical"},
  "spellvoid":      {status:"inert-dummy", note:"destroy this to prevent N arcane — the dummy deals only physical"},
  "combo":          {status:"pending",     note:"roadmap #3 — unlocks Fai and Dorinthea"},
  "reload":         {status:"pending",     note:"roadmap #4 — Azalea"},
  "charge":         {status:"pending",     note:"Boltyn's soul engine"},
  "aim counter":    {status:"pending",     note:"Azalea's arrow steering"},

  /* — identity / deckbuilding markers, no combat behavior to script — */
  "legendary":      {status:"info",        note:"deckbuilding limit: 1 copy"},
  "specialization": {status:"info",        note:"hero-locked card (normalized from '<Hero> Specialization')"},

  /* — surfaced by the pool audit 2026-07-22; each needs a CR /
       release-note review pass before it earns a real status — */
  "transcend":        {status:"unreviewed", note:"seen on A Drop in the Ocean (Enigma)"},
  "meld":             {status:"unreviewed", note:"split-effect cards (Arcane Seeds // Life, Briar)"},
  "surge":            {status:"unreviewed", note:"bonus when dealing more than printed arcane (Blaze)"},
  "high tide":        {status:"unreviewed", note:"2+ blue cards in pitch zone rider (Gravy Bones)"},
  "watery grave":     {status:"unreviewed", note:"play from graveyard when a blue hit the graveyard this turn (Gravy Bones)"},
  "phantasm":         {status:"unreviewed", note:"illusion pop on 6+ power non-illusion attack (Enigma)"},
  "mark":             {status:"unreviewed", note:"marked-hero state (Arakni)"},
  "quickstrike":      {status:"unreviewed", note:"seen on Rush of Power"},
  "suspense":         {status:"unreviewed", note:"leaves-arena rider (Enigma)"},
  "stealth":          {status:"unreviewed", note:"Arakni package"},
  "cloaked":          {status:"unreviewed", note:"Arakni package"},
  "steal":            {status:"unreviewed", note:"Arakni package"},
  "ice fusion":       {status:"unreviewed", note:"Iyslander — fusion cost rider"},
  "lightning fusion": {status:"unreviewed", note:"Briar — fusion cost rider"},
  "lightning flow":   {status:"unreviewed", note:"Briar"},
  "solflare":         {status:"unreviewed", note:"Boltyn package"},
  "unity":            {status:"unreviewed", note:"Boltyn package"},
  "crank":            {status:"unreviewed", note:"Dash — Mechanologist items"},
  "the crowd cheers": {status:"unreviewed", note:"Bravo, Flattering Showman"},
  "the crowd boos":   {status:"unreviewed", note:"Bravo, Flattering Showman"},
  "rupture":          {status:"unreviewed", note:"seen in pool; hero package TBD"},
  "retrieve":         {status:"unreviewed", note:"seen in pool; hero package TBD"},
  "overpower":        {status:"unreviewed", note:"defense restriction; needs CR wording"},
  "freeze":           {status:"unreviewed", note:"frozen state — related to Frostbite handling"},
  "sharpen":          {status:"unreviewed", note:"seen in pool; hero package TBD"},
  "opt":              {status:"unreviewed", note:"look at top N of deck, reorder"},
  "piercing":         {status:"unreviewed", note:"seen in pool; needs CR wording"},
  "heave":            {status:"unreviewed", note:"seen on Thunder Quake (Guardian)"}
};

const SYMBOLS = {
  "{p}": {status:"live",    note:"power / pitch pips — pump parser reads +N{p} and the +1/2/3{p} shorthand"},
  "{d}": {status:"live",    note:"defense — defBuff ops"},
  "{r}": {status:"live",    note:"resource — costs and gains"},
  "{h}": {status:"live",    note:"life"},
  "{i}": {status:"display", note:"intellect — stat display only, no parsed ops use it"},
  "{t}": {status:"pending", note:"TAP cost symbol. AUDIT FINDING 2026-07-22: no pool text spells the word 'tap', so the trainer's /\\btap\\b/ rotation checks never fire — tap detection must key on {t}; parser does not enforce tap costs"},
  "{u}": {status:"pending", note:"UNTAP — seen on Jack Be Quick, Scuttle Toes; not parsed"},
  "{x}": {status:"display", note:"variable X cost (Beckoning Haunt) — no parsed ops"}
};

module.exports = { KEYWORDS, SYMBOLS };
