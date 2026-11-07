/* ============================================================
   Dawnblade engine — sha256.js (HIDDEN HANDS H2, HIDDEN-HANDS.md §4.3)

   SHA-256 IN PLAIN JAVASCRIPT, AND THE COMMIT-REVEAL BUILT ON IT.

   `wire.hash` is a desync canary: FNV, 64 bits, fast, and trivially forged.
   A COMMITMENT is a different job. A seat publishes `H(nonce|value)` now and
   `value` later, and the other seat must be unable to (a) read the value from
   the commitment or (b) find a second value with the same commitment. That
   needs a cryptographic hash.

   WHY NOT `crypto.subtle`: it exists only in a SECURE CONTEXT, and the game
   must run from `file://` on an iPhone (CLAUDE.md, "no build step, ever"),
   where a secure context is not a safe bet. So it is FIPS 180-4 by hand,
   about sixty lines, checked against the standard's own test vectors in
   test/sha256.test.js. No dependency, no build step, a plain UMD script.

   WHAT IT COMMITS (the callers):
     the SEED   lobby.js: the host commits H(seedH), the guest answers seedG,
                and the match seed is H(seedH|seedG). The host cannot bias the
                shuffle (it committed before seeing seedG); the guest cannot
                predict a draw (it never holds seedH until the game is over).
     the THROW  lobby.js: each seat commits H(nonce|throw) before either
                reveals, so a modified client cannot wait for the other throw
                and answer it.

   THE NONCE IS NOT DECORATION. Rock-paper-scissors has three values: a bare
   H(throw) is broken by hashing all three. `nonce()` draws 128 bits from
   `crypto.getRandomValues` (available outside secure contexts) and falls back
   to Math.random only where there is no crypto at all (old test runners).
   ============================================================ */
(function(root, factory){
  if(typeof module==="object" && module.exports) module.exports = factory();
  else root.DawnSHA = factory();
})(typeof self!=="undefined" ? self : this, function(){

/* FIPS 180-4 §4.2.2: the first 32 bits of the fractional parts of the cube
   roots of the first 64 primes. */
const K = [
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];

/* A string as UTF-8 bytes, by hand: TextEncoder is missing on some old
   WebViews, and the commitment must hash the same bytes on both phones. */
function utf8(s){
  const out = [];
  s = String(s);
  for(let i = 0; i < s.length; i++){
    let c = s.charCodeAt(i);
    if(c >= 0xd800 && c <= 0xdbff && i + 1 < s.length){
      const d = s.charCodeAt(i + 1);
      if(d >= 0xdc00 && d <= 0xdfff){ c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00); i++; }
    }
    if(c < 0x80) out.push(c);
    else if(c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if(c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return out;
}

/* SHA-256 of a byte array, as 64 lowercase hex characters. */
function digestBytes(bytes){
  const H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const len = bytes.length, bits = len * 8;
  /* FIPS 180-4 §5.1.1: a 1 bit, zeros to 448 mod 512, then the 64-bit length */
  const total = ((len + 9 + 63) >> 6) << 6;
  const m = new Array(total).fill(0);
  for(let i = 0; i < len; i++) m[i] = bytes[i];
  m[len] = 0x80;
  const hi = Math.floor(bits / 0x100000000), lo = bits >>> 0;
  for(let i = 0; i < 4; i++){ m[total - 8 + i] = (hi >>> (24 - 8 * i)) & 255; m[total - 4 + i] = (lo >>> (24 - 8 * i)) & 255; }
  const w = new Array(64);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  for(let off = 0; off < total; off += 64){
    for(let t = 0; t < 16; t++) w[t] = (m[off + 4*t] << 24) | (m[off + 4*t + 1] << 16) | (m[off + 4*t + 2] << 8) | m[off + 4*t + 3];
    for(let t = 16; t < 64; t++){
      const s0 = rotr(w[t-15], 7) ^ rotr(w[t-15], 18) ^ (w[t-15] >>> 3);
      const s1 = rotr(w[t-2], 17) ^ rotr(w[t-2], 19) ^ (w[t-2] >>> 10);
      w[t] = (w[t-16] + s0 + w[t-7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for(let t = 0; t < 64; t++){
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[t] + w[t]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const mj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + mj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
  }
  return H.map(x => (x >>> 0).toString(16).padStart(8, "0")).join("");
}
const sha256 = s => digestBytes(utf8(s));

/* 128 random bits as 32 hex characters. */
function nonce(rand){
  const c = (typeof crypto !== "undefined" && crypto && crypto.getRandomValues) ? crypto : null;
  if(!rand && c){ const a = new Uint32Array(4); c.getRandomValues(a); return Array.from(a, x => x.toString(16).padStart(8, "0")).join(""); }
  const r = typeof rand === "function" ? rand : Math.random;
  let out = "";
  for(let i = 0; i < 32; i++) out += Math.floor(r() * 16).toString(16);
  return out;
}

/* THE COMMITMENT. `value` is any string; the nonce is prefixed with a
   separator neither a hex nonce nor the length prefix can contain, so
   ("ab", "c|d") and ("ab|c", "d") cannot commit alike. */
const commitOf = (value, n) => sha256("dawnblade-commit|" + String(n).length + ":" + n + "|" + String(value));
/* {c, nonce}: publish `c` now, keep `nonce` and `value` until the reveal. */
function makeCommit(value, rand){ const n = nonce(rand); return {c: commitOf(value, n), nonce: n}; }
/* Does (value, nonce) open commitment `c`? */
const opens = (c, value, n) => typeof c === "string" && typeof n === "string" && commitOf(value, n) === c;

/* THE MATCH SEED from the two halves: the host's secret and the guest's
   public answer. Order-fixed (host first), so both phones derive one seed. */
const seedOf = (seedH, seedG) => sha256("dawnblade-seed|" + String(seedH) + "|" + String(seedG));

return {sha256, digestBytes, utf8, nonce, makeCommit, commitOf, opens, seedOf};
});
