/* ============================================================
   CRESCENDO — ui/audio.js  ·  synthesized sound, no files
   docs/crescendo/MOTION.md §6 is the spec; `CUES` below is §6.2's table.

     DawnUIAudio.init();                 // once: listens for the first gesture (iOS rule)
     DawnUIAudio.cue("hit3", {gain:.7, pitch:1, delayMs:0});
     DawnUIAudio.setMuted(true); DawnUIAudio.setVolume(.5);

   - ONE AudioContext, created and resumed inside the first user gesture
     (pointerdown / pointerup / click / touchend / keydown — iOS does not count
     touchstart), plus a 1-sample silent buffer. Nothing plays before that.
   - graph: cue bus -> master (0.5) -> DynamicsCompressor (-14 dB, 6:1) -> out.
   - never more than 6 voices: the quietest cue is dropped past that.
   - best-effort: every entry point is try/catch; it never throws and never
     blocks a beat. The ringer switch is the player's (no <audio> hack).
   - mute and volume live in localStorage (try/catch), per device.
   ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DawnUIAudio = api.shared;
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

var VOICE_CAP = 6, KEY_MUTED = "dawnui.audio.muted", KEY_VOL = "dawnui.audio.volume";

/* the 14 cues (+ coin): peak = the loudest component's peak, len = ms, play(h, t) schedules the recipe at time t.
   h.osc(type, f0, f1, t, durSec, peak, attackSec)  h.noise(t, durSec, peak, filterType, f0, f1, q) */
var CUES = {
  tap:     { peak: .16, len: 30,   play: function (h, t) { h.osc("sine", 1800, 1200, t, .03, .16); } },
  select:  { peak: .18, len: 70,   play: function (h, t) { h.osc("triangle", 520, 700, t, .07, .18); } },
  slap:    { peak: .5,  len: 100,  play: function (h, t) { h.noise(t, .07, .5, "bandpass", 1800, 500, .8); h.osc("sine", 170, 70, t, .1, .5); } },
  pitch:   { peak: .22, len: 220,  play: function (h, t) { h.osc("sine", 2400, 2380, t, .22, .22); h.osc("sine", 3600, 3580, t, .14, .1); } },
  thud:    { peak: .8,  len: 320,  play: function (h, t) { h.osc("sine", 110, 45, t, .32, .8, .006); h.noise(t, .05, .25, "lowpass", 600, 200, .7); } },
  hit1:    { peak: .5,  len: 90,   play: function (h, t) { h.noise(t, .09, .5, "bandpass", 1400, 600, .9); h.osc("square", 220, 110, t, .07, .18); } },
  hit3:    { peak: .7,  len: 200,  play: function (h, t) { h.noise(t, .14, .7, "bandpass", 1000, 350, .8); h.osc("sawtooth", 160, 60, t, .14, .28); h.osc("sine", 90, 45, t, .2, .6); } },
  hit7:    { peak: .9,  len: 420,  play: function (h, t) {
    h.noise(t, .26, .9, "lowpass", 3000, 200, .7); h.osc("sawtooth", 120, 38, t, .3, .4); h.osc("sine", 70, 28, t, .42, .9); h.osc("square", 900, 200, t, .05, .2); } },
  block:   { peak: .4,  len: 120,  play: function (h, t) { h.osc("square", 620, 600, t, .12, .18); h.osc("square", 930, 910, t, .1, .1); h.noise(t, .03, .4, "highpass", 3000, 3000, 1); } },
  prevent: { peak: .16, len: 500,  play: function (h, t) {
    h.osc("sine", 1318, 1318, t, .4, .16, .02); h.osc("sine", 1976, 1976, t + .05, .4, .12, .02); h.osc("sine", 2637, 2637, t + .1, .5, .08, .02); } },
  goagain: { peak: .22, len: 200,  play: function (h, t) { h.osc("triangle", 440, 880, t, .18, .22, .01); h.osc("triangle", 660, 1320, t + .06, .2, .16, .01); } },
  turn:    { peak: .3,  len: 500,  play: function (h, t) { h.osc("sine", 392, 392, t, .3, .3, .01); h.osc("sine", 587, 587, t + .12, .4, .3, .01); h.osc("triangle", 196, 196, t, .5, .2, .02); } },
  draw:    { peak: .18, len: 120,  play: function (h, t) { h.noise(t, .12, .18, "bandpass", 2400, 5200, 1.2); } },
  ko:      { peak: 1,   len: 2300, play: function (h, t) {
    h.osc("sine", 60, 30, t, 1.2, 1, .01); h.noise(t, .5, .5, "lowpass", 2000, 100, .7);
    [523, 659, 784, 1047].forEach(function (f, i) { h.osc("triangle", f, f, t + .7 + i * .05, 1.6, .16, .05); }); } },
  coin:    { peak: .2,  len: 300,  play: function (h, t) { h.osc("triangle", 1200, 800, t, .3, .2, .005); } }
};

function create(env) {
  env = env || {};
  var win = env.window || (typeof window !== "undefined" ? window : null);
  var Ctor = env.AudioContext || (win && (win.AudioContext || win.webkitAudioContext)) || null;
  var store = null;
  try { store = env.storage !== undefined ? env.storage : (win && win.localStorage) || null; } catch (e) { store = null; }

  var ctx = null, master = null, noiseBuf = null, unlocked = false, voices = [], listening = false;
  var muted = false, volume = .5;
  function read(k) { try { return store ? store.getItem(k) : null; } catch (e) { return null; } }
  function write(k, v) { try { if (store) store.setItem(k, v); } catch (e) { /* private window, blocked storage */ } }
  var m0 = read(KEY_MUTED), v0 = parseFloat(read(KEY_VOL));
  if (m0 === "1") muted = true;
  if (isFinite(v0) && v0 >= 0 && v0 <= 1) volume = v0;

  function applyMaster() {
    try { if (master) master.gain.value = muted ? 0 : volume; } catch (e) { /* ignore */ }
  }

  /* must run INSIDE a user gesture the first time */
  function unlock() {
    try {
      if (!Ctor) return false;
      if (!ctx) {
        ctx = new Ctor();
        master = ctx.createGain();
        var comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14; comp.ratio.value = 6;
        master.connect(comp); comp.connect(ctx.destination);
        applyMaster();
        var b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource();   /* belt and braces: a silent sample in the gesture */
        s.buffer = b; s.connect(ctx.destination); s.start(0);
      }
      if (ctx.state !== "running" && ctx.resume) { var p = ctx.resume(); if (p && p["catch"]) p["catch"](function () {}); }
      unlocked = true;
      return true;
    } catch (e) { return false; }
  }
  function init(target) {
    try {
      if (listening) return;
      var doc = target || (win && win.document);
      if (!doc || !doc.addEventListener) return;
      listening = true;
      ["pointerdown", "pointerup", "click", "touchend", "keydown"].forEach(function (n) { doc.addEventListener(n, unlock, { passive: true, capture: true }); });
      doc.addEventListener("visibilitychange", function () {
        try { if (!doc.hidden && ctx && ctx.state !== "running" && ctx.resume) { var p = ctx.resume(); if (p && p["catch"]) p["catch"](function () {}); } } catch (e) { /* ignore */ }
      });
    } catch (e) { /* best effort */ }
  }

  var helper = function (bus, pitch) {
    return {
      osc: function (type, f0, f1, t, dur, peak, att) {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(f0 * pitch, t);
        if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1 * pitch, t + dur);
        g.gain.setValueAtTime(.0001, t);
        g.gain.linearRampToValueAtTime(peak, t + (att || .004));
        g.gain.exponentialRampToValueAtTime(.0001, t + dur);
        o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + .02);
      },
      noise: function (t, dur, peak, ftype, f0, f1, q) {
        if (!noiseBuf) {
          noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * .6), ctx.sampleRate);
          var d = noiseBuf.getChannelData(0);
          for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        }
        var s = ctx.createBufferSource(); s.buffer = noiseBuf;
        var f = ctx.createBiquadFilter(); f.type = ftype; f.Q.value = q || 1;
        f.frequency.setValueAtTime(f0 * pitch, t);
        if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1 * pitch, t + dur);
        var g = ctx.createGain();
        g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
        s.connect(f); f.connect(g); g.connect(bus); s.start(t); s.stop(t + dur + .02);
      }
    };
  };

  /* returns true when the cue was scheduled */
  function cue(name, o) {
    try {
      o = o || {};
      var def = CUES[name];
      if (!def || muted || !unlocked || !ctx) return false;
      var gain = o.gain == null ? 1 : +o.gain, pitch = o.pitch == null ? 1 : +o.pitch;
      if (!(gain > 0) || !(pitch > 0)) return false;
      var t = ctx.currentTime + .005 + (o.delayMs || 0) / 1000;
      voices = voices.filter(function (v) { return v.until > t; });
      var peak = def.peak * gain;
      if (voices.length >= VOICE_CAP) {   /* past six voices the quietest cue goes (possibly this one) */
        var q = 0, i;
        for (i = 1; i < voices.length; i++) if (voices[i].peak < voices[q].peak) q = i;
        if (voices[q].peak >= peak) return false;
        var gone = voices.splice(q, 1)[0];
        try { gone.bus.gain.setTargetAtTime(0, t, .005); } catch (e) { /* ignore */ }
      }
      var bus = ctx.createGain();
      bus.gain.value = gain;
      bus.connect(master);
      voices.push({ until: t + def.len / 1000 + .05, peak: peak, bus: bus });
      def.play(helper(bus, pitch), t);
      return true;
    } catch (e) { return false; }
  }

  return {
    init: init, unlock: unlock, cue: cue,
    setMuted: function (b) { muted = !!b; write(KEY_MUTED, muted ? "1" : "0"); applyMaster(); return muted; },
    toggleMute: function () { return this.setMuted(!muted); },
    muted: function () { return muted; },
    setVolume: function (v) { v = +v; if (isFinite(v)) { volume = Math.max(0, Math.min(1, v)); write(KEY_VOL, String(volume)); applyMaster(); } return volume; },
    volume: function () { return volume; },
    state: function () { return ctx ? ctx.state : (Ctor ? "locked" : "unsupported"); },
    unlocked: function () { return unlocked; },
    voices: function (t) { try { var n = t == null ? (ctx ? ctx.currentTime : 0) : t; return voices.filter(function (v) { return v.until > n; }).length; } catch (e) { return 0; } },
    names: Object.keys(CUES),
    create: create
  };
}

return { create: create, CUES: CUES, VOICE_CAP: VOICE_CAP, shared: create({}) };
});
