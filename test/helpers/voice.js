/* ============================================================
   voice.js — WHAT MAKES A LINE READ AS A CODE COMMENT

   One list, two censuses: a `noop` reason printed into the shared feed
   (test/noopvoice.test.js, v4.24) and the seat's call shown on the table
   (test/explain.test.js, v5.47). Each entry is a real fault one of them
   found, kept as its own alternative so a failure names the shape.

   The last shape, the second person, applies to the FEED only: a feed
   line is read by both seats, and the call is addressed to one player.
   ============================================================ */
const DEV_VOICE = [
  [/\bv\d\.\d\d\b/,            "a version number"],
  [/\.js\b/,                   "a filename"],
  [/[A-Za-z_$][\w$]*\.[A-Za-z_$][\w$]*\(/, "a function call"],
  [/`/,                        "a backtick"],
  [/\bfxParse\b|\bclassifyClause\b|\brunOps\b|\bexecute\(/, "an engine identifier"],
  /* v5.28 (QUEUE item 14 [12]): "off fx.noDrx" and "cost read by the weapon
     reader" printed on every swing. A dotted parse field and the engine's
     own noun for a parser rule are both developer voice. */
  [/\bfx\.[A-Za-z]/,           "a parse field"],
  [/\breaders?\b/i,            "the word \"reader\""],
  /* v5.33 (QUEUE v3 S3): `runOps` prints a noop reason into the feed both
     seats read (v2.83), so "you" is a different player depending on who
     reads it. 299 lines a ladder said "your graveyard" off one reason. */
  [/\byour?\b/i,              "the second person"]
];

module.exports = {DEV_VOICE};
