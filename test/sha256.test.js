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

/* ---- SERVER S3: the channel's name and seal ------------------------------------------------ */
test("HMAC-SHA256 equals node's own, for short, block-sized and over-long keys and any message", () => {
  for(const k of ["", "k", "a".repeat(63), "a".repeat(64), "a".repeat(65), "b".repeat(300), "é✊"])
    for(const m of ["", "m", "x".repeat(55), "x".repeat(56), "x".repeat(64), "x".repeat(1000), "é🂡"])
      assert.equal(SHA.hmac(k, m), crypto.createHmac("sha256", Buffer.from(k, "utf8")).update(m, "utf8").digest("hex"), JSON.stringify([k.length, m.length]));
});

test("frameMac does not depend on object key order (Realtime re-encodes broadcasts with sorted keys)", () => {
  const a = [{ch: "net", m: {t: "commit", seq: 3, z: [{b: 1, a: null}], s: "é\u2028"}}], b = [{m: {s: "é\u2028", z: [{a: null, b: 1}], seq: 3, t: "commit"}, ch: "net"}];
  assert.notEqual(JSON.stringify(a), JSON.stringify(b), "the fixture really reorders keys");
  assert.equal(SHA.frameMac("k", "K7Q2ZM", 0, 5, a), SHA.frameMac("k", "K7Q2ZM", 0, 5, b));
  assert.notEqual(SHA.frameMac("k", "K7Q2ZM", 0, 5, a), SHA.frameMac("k", "K7Q2ZM", 0, 5, [{ch: "net", m: {t: "commit", seq: 4, z: [{b: 1, a: null}], s: "é\u2028"}}]), "values still count");
  assert.notEqual(SHA.frameMac("k", "K7Q2ZM", 0, 5, [[1, 2]]), SHA.frameMac("k", "K7Q2ZM", 0, 5, [[2, 1]]), "array order still counts");
});
test("seatTopic is one-way and distinct per seat, code and key; frameMac moves with every field", () => {
  const key = "0123456789abcdef0123456789abcdef";
  const t = SHA.seatTopic("K7Q2ZM", 0, key);
  assert.match(t, /^table:K7Q2ZM:[0-9a-f]{64}$/);
  assert.ok(t.indexOf(key) < 0, "the topic does not contain the key");
  assert.equal(t, SHA.seatTopic("K7Q2ZM", 0, key), "deterministic");
  for(const o of [SHA.seatTopic("K7Q2ZM", 1, key), SHA.seatTopic("K7Q2ZN", 0, key), SHA.seatTopic("K7Q2ZM", 0, key + "0")]) assert.notEqual(o, t);
  const fr = [{ch: "net", m: {t: "commit", seq: 3}}], mac = SHA.frameMac(key, "K7Q2ZM", 0, 5, fr);
  assert.match(mac, /^[0-9a-f]{64}$/);
  assert.equal(mac, SHA.frameMac(key, "K7Q2ZM", 0, 5, JSON.parse(JSON.stringify(fr))));
  for(const o of [SHA.frameMac(key + "0", "K7Q2ZM", 0, 5, fr), SHA.frameMac(key, "K7Q2ZN", 0, 5, fr), SHA.frameMac(key, "K7Q2ZM", 1, 5, fr),
                  SHA.frameMac(key, "K7Q2ZM", 0, 6, fr), SHA.frameMac(key, "K7Q2ZM", 0, 5, [{ch: "net", m: {t: "commit", seq: 4}}])]) assert.notEqual(o, mac);
});
