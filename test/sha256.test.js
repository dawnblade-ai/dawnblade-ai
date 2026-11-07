/* test/sha256.test.js — engine/sha256.js (HIDDEN HANDS H2): SHA-256 by hand,
   and the commit-reveal on it. FIPS 180-4's own vectors, then node's crypto
   as an oracle over every padding boundary and some UTF-8. */
const test = require("node:test");
const assert = require("node:assert/strict");
const SHA = require("../engine/sha256.js");
const crypto = require("crypto");
const oracle = s => crypto.createHash("sha256").update(s, "utf8").digest("hex");

test("FIPS 180-4 test vectors", () => {
  assert.equal(SHA.sha256(""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  assert.equal(SHA.sha256("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.equal(SHA.sha256("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"),
    "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1");
});

test("every message length across three padding blocks agrees with node's crypto", () => {
  for(let n = 0; n < 200; n++){ const s = "q".repeat(n); assert.equal(SHA.sha256(s), oracle(s), "length " + n); }
});

test("UTF-8: accents, emoji (surrogate pairs) and a long string", () => {
  for(const s of ["é", "✊🔒", "Dorinthea Ironsong — Dawnblade", "x".repeat(5000) + "🂡"]) assert.equal(SHA.sha256(s), oracle(s), s.slice(0, 20));
});

test("commit-reveal: a commitment opens with its value and nonce, and with nothing else", () => {
  const k = SHA.makeCommit("paper");
  assert.match(k.c, /^[0-9a-f]{64}$/);
  assert.match(k.nonce, /^[0-9a-f]{32}$/);
  assert.ok(SHA.opens(k.c, "paper", k.nonce));
  assert.ok(!SHA.opens(k.c, "rock", k.nonce), "another value does not open it");
  assert.ok(!SHA.opens(k.c, "paper", k.nonce.replace(/^./, c => c === "0" ? "1" : "0")), "another nonce does not open it");
  /* the three throws cannot be brute-forced off a bare hash: the nonce is in it */
  for(const t of ["rock", "paper", "scissors"]) assert.notEqual(SHA.sha256(t), k.c);
  /* two seals of one value differ (fresh nonces) */
  assert.notEqual(SHA.makeCommit("paper").c, k.c);
});

test("the match seed is fixed by both halves, in order", () => {
  const a = SHA.seedOf("h1", "g1");
  assert.equal(a, SHA.seedOf("h1", "g1"));
  assert.notEqual(a, SHA.seedOf("h1", "g2"), "the guest's half moves it");
  assert.notEqual(a, SHA.seedOf("h2", "g1"), "the host's half moves it");
  assert.notEqual(a, SHA.seedOf("g1", "h1"), "order-fixed");
});
