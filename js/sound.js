// Above the Canopy: procedural sound (v6, build sounds added in v7).
// Every sound is synthesised with the Web Audio API: no audio files, no CDNs, no licensing, works offline.
// The AudioContext is only created (and resumed) inside a user gesture, so browser autoplay rules (and iOS Safari) are respected.
// Mixed gently for a classroom: soft envelopes, a compressor and a low-pass on the master bus, and per-sound rate limits.

const LS_ON = 'aboveTheCanopy.sound', LS_VOL = 'aboveTheCanopy.volume';
let ac = null, master = null, sfxBus = null, ambBus = null, noiseBuf = null, amb = null;
let enabled = true, volume = 0.6, paused = false, speed = 1, listening = false;
const last = {};
const stats = { created: false, played: {}, skipped: 0, errors: [], unlocks: 0 };
const level = { water: 0, bees: 0, angry: 0, fire: 0, wind: 0 };
let nextBird = 0, nextKook = 0, nextCicada = 0, nextCrackle = 0, nextBubble = 0, nextDrip = 0;

try {
  const on = localStorage.getItem(LS_ON); if (on === 'off') enabled = false;
  const v = parseFloat(localStorage.getItem(LS_VOL)); if (!isNaN(v)) volume = Math.min(1, Math.max(0, v));
} catch (e) { /* storage blocked: use defaults */ }
function save() { try { localStorage.setItem(LS_ON, enabled ? 'on' : 'off'); localStorage.setItem(LS_VOL, String(volume)); } catch (e) { /* ignore */ } }

// Minimum gap (seconds of real time) between two plays of the same sound, so nothing gets spammy.
const RATE = { saw: 0.42, tap: 0.16, thunk: 0.5, clack: 0.45, creak: 0.9, snip: 0.35, rustle: 0.8, hoot: 6, screech: 14, flap: 2.5,
  pulse: 0.35, chirp: 0.4, sparkle: 1.2, idea: 2, sting: 2, echo: 4, hiss: 2, splash: 1.2, squelch: 1, thud: 0.6,
  whoosh: 1.5, ding: 1.5, emailStorm: 4, magpie: 4, thunder: 6, mozzie: 4, branch: 3, sinkhole: 4, treefall: 4, parachute: 4,
  fanfare: 6, pops: 2, support: 3, yes: 1.5, swarm: 3, block: 0.3, haul: 1.1, layer: 0.8, vision: 4, outreach: 1.2, outreachBack: 1.2 };
const rnd = (a, b) => a + Math.random() * (b - a);

// ---------- graph ----------
function build() {
  const C = window.AudioContext || window.webkitAudioContext; if (!C) return false;
  ac = new C();
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -20; comp.knee.value = 18; comp.ratio.value = 3.5; comp.attack.value = 0.01; comp.release.value = 0.25;
  const tame = ac.createBiquadFilter(); tame.type = 'lowpass'; tame.frequency.value = 8500; tame.Q.value = 0.5;
  master = ac.createGain(); master.gain.value = enabled ? volume : 0;
  sfxBus = ac.createGain(); sfxBus.gain.value = 1;
  ambBus = ac.createGain(); ambBus.gain.value = 0.7;
  const ambTone = ac.createBiquadFilter(); ambTone.type = 'lowpass'; ambTone.frequency.value = 5200;
  sfxBus.connect(master); ambBus.connect(ambTone); ambTone.connect(master); master.connect(comp); comp.connect(tame); tame.connect(ac.destination);
  noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const d = noiseBuf.getChannelData(0); let b = 0;
  for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b = 0.97 * b + 0.03 * w; d[i] = w * 0.6 + b * 2.2; } // a little warmer than white noise
  buildAmbience();
  stats.created = true;
  const now = ac.currentTime; nextBird = now + 2; nextKook = now + rnd(20, 35); nextCicada = now + rnd(10, 20);
  return true;
}
function loopNoise() { const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.start(0, Math.random() * 1.5); return s; }
function filt(type, f, q = 0.7) { const n = ac.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; return n; }
function gainN(v) { const g = ac.createGain(); g.gain.value = v; return g; }
function lfo(freq, depth, target, type = 'sine') { const o = ac.createOscillator(); o.type = type; o.frequency.value = freq; const g = gainN(depth); o.connect(g); g.connect(target); o.start(); return o; }
function buildAmbience() {
  amb = {};
  // soft wind bed + leaf rustle, both slowly breathing
  const wind = gainN(0.05); loopNoise().connect(filt('lowpass', 380)).connect(wind).connect(ambBus); lfo(0.07, 0.025, wind.gain); amb.wind = wind;
  const leaves = gainN(0.006); loopNoise().connect(filt('highpass', 3200)).connect(leaves).connect(ambBus); lfo(0.13, 0.005, leaves.gain);
  // creek / river water
  const water = gainN(0); loopNoise().connect(filt('bandpass', 1000, 0.6)).connect(water).connect(ambBus);
  const rumble = gainN(0); loopNoise().connect(filt('lowpass', 260)).connect(rumble).connect(ambBus); amb.water = [water, rumble];
  // bees: three detuned buzzes with a gentle wobble
  const bees = gainN(0), bf = filt('lowpass', 900); bf.connect(bees); bees.connect(ambBus);
  for (const f of [208, 216, 229]) { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; lfo(rnd(5, 9), 6, o.frequency); o.connect(bf); o.start(); }
  amb.bees = bees;
  // campfire bed
  const fire = gainN(0); loopNoise().connect(filt('lowpass', 520)).connect(fire).connect(ambBus); amb.fire = fire;
  // cicadas: narrow band of noise, pulsing fast, swelling now and then
  const cic = gainN(0), cicAm = gainN(0.5); loopNoise().connect(filt('bandpass', 5400, 9)).connect(cicAm).connect(cic).connect(ambBus); lfo(42, 0.5, cicAm.gain); amb.cic = cic;
}

// ---------- primitives ----------
function env(t, peak, a, d, dest = sfxBus) {
  const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  g.connect(dest); return g;
}
function tone(t, f, dur, o = {}) {
  const osc = ac.createOscillator(); osc.type = o.type || 'sine';
  osc.frequency.setValueAtTime(f, t); if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
  if (o.vib) lfo(o.vib[0], o.vib[1], osc.frequency).stop(t + dur + 0.1);
  let out = osc;
  if (o.lp) { const fl = filt('lowpass', o.lp, 0.7); osc.connect(fl); out = fl; }
  if (o.bp) { const fl = filt('bandpass', o.bp[0], o.bp[1]); osc.connect(fl); out = fl; }
  out.connect(env(t, o.peak || 0.05, o.a || 0.01, Math.max(0.02, dur - (o.a || 0.01)), o.dest));
  osc.start(t); osc.stop(t + dur + 0.05);
}
function noise(t, dur, o = {}) {
  const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const fl = filt(o.type || 'bandpass', o.f || 1000, o.q || 0.8);
  fl.frequency.setValueAtTime(o.f || 1000, t); if (o.f2) fl.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
  s.connect(fl); fl.connect(env(t, o.peak || 0.05, o.a || 0.01, Math.max(0.02, dur - (o.a || 0.01)), o.dest));
  s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
}
function bell(t, f, dur, peak, dest) { tone(t, f, dur, { peak, a: 0.005, dest }); tone(t, f * 2.01, dur * 0.55, { peak: peak * 0.22, a: 0.005, dest }); }

// ---------- the sound library ----------
const SFX = {
  // message pulses: downward messages fall, upward escalations rise
  pulse(t, o) {
    const k = `${o.from}>${o.to}`;
    const seq = { 'leader>manager': [880, 659], 'manager>team': [659, 523], 'team>manager': [523, 659, 784], 'manager>leader': [587, 740, 880, 1175] }[k] || [700];
    seq.forEach((f, i) => bell(t + i * 0.085, f, 0.45, 0.035));
  },
  screech(t) { // soft, distant eagle cry
    tone(t, 1900, 0.55, { type: 'sawtooth', f2: 1250, vib: [26, 45], bp: [1900, 3], peak: 0.028, a: 0.06 });
    tone(t + 0.62, 1700, 0.35, { type: 'sawtooth', f2: 1200, vib: [26, 40], bp: [1700, 3], peak: 0.018, a: 0.05 });
  },
  flap(t) { for (let i = 0; i < 3; i++) noise(t + i * 0.17, 0.11, { type: 'lowpass', f: 650, peak: 0.07 - i * 0.012, a: 0.02 }); },
  hoot(t, o) { const f = o.visitor ? 330 : 392; tone(t, f, 0.3, { f2: f * 0.92, peak: 0.06, a: 0.07 }); tone(t + 0.42, f * 0.97, 0.5, { f2: f * 0.86, peak: 0.055, a: 0.08 }); },
  whoosh(t) { noise(t, 0.95, { f: 380, f2: 1700, q: 0.9, peak: 0.055, a: 0.4 }); },
  magpie(t) {
    for (let i = 0; i < 5; i++) { const f = rnd(1100, 1600); tone(t + i * 0.1, f, 0.08, { type: 'triangle', f2: f * rnd(1.2, 1.5), peak: 0.035 }); }
    tone(t + 0.55, 760, 0.2, { type: 'sawtooth', f2: 520, lp: 1800, peak: 0.03 });
  },
  emailStorm(t) { for (let i = 0; i < 7; i++) bell(t + i * 0.17 + rnd(0, 0.05), [1318, 1568, 1760][i % 3], 0.22, 0.03); },
  thunder(t) {
    noise(t, 0.35, { type: 'lowpass', f: 900, f2: 200, peak: 0.08, a: 0.01 });
    noise(t + 0.05, 2.8, { type: 'lowpass', f: 150, q: 0.5, peak: 0.2, a: 0.2 });
    noise(t + 0.5, 1.8, { f: 450, f2: 1300, q: 0.6, peak: 0.05, a: 0.6 }); // wind gust
  },
  mozzie(t) { tone(t, 640, 2.0, { type: 'sawtooth', vib: [7, 26], lp: 1700, peak: 0.016, a: 0.4 }); },
  ding(t) { bell(t, 1046, 0.9, 0.05); bell(t + 0.14, 1568, 0.9, 0.04); },
  branch(t) { noise(t, 0.35, { type: 'highpass', f: 2400, peak: 0.04, a: 0.03 }); noise(t + 0.22, 0.035, { f: 3000, q: 1, peak: 0.12 }); tone(t + 0.22, 900, 0.05, { f2: 300, peak: 0.04 }); },
  sinkhole(t) {
    noise(t, 2.2, { type: 'lowpass', f: 95, q: 0.5, peak: 0.24, a: 0.25 });
    tone(t, 55, 2.0, { f2: 36, peak: 0.07, a: 0.3 });
    for (let i = 0; i < 5; i++) SFX.clack(t + 0.5 + i * rnd(0.15, 0.3), { soft: true });
  },
  treefall(t) {
    for (let i = 0; i < 3; i++) tone(t + i * 0.32, 120 - i * 15, 0.3, { type: 'sawtooth', f2: 85 - i * 10, bp: [520, 7], peak: 0.04, a: 0.08 });
    noise(t + 1.05, 1.5, { type: 'lowpass', f: 1300, f2: 180, peak: 0.2, a: 0.01 });
    tone(t + 1.05, 70, 0.5, { f2: 38, peak: 0.14 });
    noise(t + 1.1, 1.1, { type: 'highpass', f: 3000, peak: 0.035, a: 0.05 });
  },
  hiss(t) { noise(t, 1.3, { type: 'highpass', f: 5200, peak: 0.04, a: 0.25 }); },
  sting(t) { tone(t, 659, 0.22, { type: 'triangle', peak: 0.055 }); tone(t + 0.1, 988, 0.4, { type: 'triangle', peak: 0.05 }); },
  splash(t) {
    noise(t, 0.6, { f: 1600, f2: 480, q: 0.8, peak: 0.13, a: 0.01 });
    for (let i = 0; i < 5; i++) { const f = rnd(800, 1500); tone(t + 0.1 + i * rnd(0.06, 0.12), f, 0.06, { f2: f * 1.6, peak: 0.025 }); }
  },
  squelch(t) {
    noise(t, 0.4, { type: 'lowpass', f: 220, f2: 900, q: 4, peak: 0.13, a: 0.05 });
    tone(t, 140, 0.3, { f2: 65, peak: 0.06 });
    noise(t + 0.5, 0.3, { type: 'lowpass', f: 200, f2: 700, q: 4, peak: 0.07, a: 0.04 });
  },
  thunk(t) { const f = rnd(150, 190); tone(t, f, 0.18, { f2: f * 0.5, peak: 0.12 }); noise(t, 0.05, { type: 'lowpass', f: 1300, peak: 0.05 }); },
  clack(t, o = {}) { const p = o.soft ? 0.5 : 1; tone(t, 2200, 0.05, { f2: 1800, peak: 0.04 * p }); noise(t, 0.04, { f: 2800, q: 3, peak: 0.09 * p }); noise(t + 0.08, 0.03, { f: 2500, q: 3, peak: 0.05 * p }); },
  creak(t) { tone(t, 175, 0.45, { type: 'sawtooth', f2: 215, bp: [700, 10], peak: 0.045, a: 0.12 }); },
  saw(t) { noise(t, 0.16, { f: 2600, q: 1.6, peak: 0.05, a: 0.05 }); noise(t + 0.2, 0.16, { f: 2150, q: 1.6, peak: 0.045, a: 0.05 }); },
  snip(t) { noise(t, 0.03, { type: 'highpass', f: 4200, peak: 0.07 }); noise(t + 0.07, 0.03, { type: 'highpass', f: 3800, peak: 0.06 }); },
  rustle(t) { noise(t, 0.5, { type: 'highpass', f: 2600, peak: 0.03, a: 0.12 }); },
  tap(t, o = {}) { // hammer on chisel: a soft metallic tick with a short ring
    const acc = o.accent ? 1 : 0.6, f = o.accent ? 1480 : 1650;
    tone(t, f, 0.07, { peak: 0.08 * acc }); tone(t, 3150, 0.14, { peak: 0.012 * acc }); noise(t, 0.03, { f: 3600, q: 2, peak: 0.06 * acc });
  },
  thud(t) { tone(t, 95, 0.32, { f2: 44, peak: 0.18 }); noise(t, 0.2, { type: 'lowpass', f: 320, peak: 0.1 }); },
  parachute(t) { noise(t, 2.6, { f: 780, f2: 320, q: 0.7, peak: 0.045, a: 0.7 }); },
  sparkle(t) { [1568, 2093, 2637, 3136].forEach((f, i) => { tone(t + i * 0.07, f, 0.55, { peak: 0.028 }); tone(t + i * 0.07, f * 2, 0.25, { peak: 0.006 }); }); },
  idea(t) { bell(t, 988, 0.5, 0.04); bell(t + 0.12, 1319, 0.6, 0.04); bell(t + 0.24, 1760, 0.8, 0.035); },
  support(t) { for (const f of [392, 494, 587]) tone(t, f, 0.8, { type: 'triangle', peak: 0.03, a: 0.04 }); },
  yes(t) { bell(t, 784, 0.4, 0.04); bell(t + 0.1, 1175, 0.6, 0.035); },
  // v7.4: the Leader's outreach to other teams and projects: a very soft, distant two-note chime out, and one back
  outreach(t) { bell(t, 1319, 0.35, 0.011); bell(t + 0.09, 1760, 0.3, 0.008); },
  outreachBack(t) { bell(t, 1568, 0.3, 0.009); bell(t + 0.09, 1175, 0.35, 0.008); },
  swarm(t) { tone(t, 230, 1.6, { type: 'sawtooth', vib: [11, 18], lp: 1200, peak: 0.04, a: 0.1 }); tone(t, 247, 1.6, { type: 'sawtooth', vib: [9, 15], lp: 1200, peak: 0.03, a: 0.1 }); },
  fanfare(t) {
    const brass = (tt, f, d, p = 0.035) => { tone(tt, f, d, { type: 'sawtooth', lp: 1700, peak: p, a: 0.03 }); tone(tt, f * 1.004, d, { type: 'triangle', peak: p * 0.8, a: 0.03 }); };
    [[0, 392], [0.16, 523], [0.32, 659]].forEach(([d, f]) => brass(t + d, f, 0.2));
    brass(t + 0.48, 784, 0.45, 0.04);
    for (const f of [523, 659, 784, 1046]) brass(t + 0.95, f, 1.4, 0.026);
    SFX.pops(t + 0.3);
  },
  // v7: the build. Stone blocks settling, rope hauling, a motif that climbs with every course, and the vision turning solid.
  block(t) { const f = rnd(105, 125); tone(t, f, 0.24, { f2: f * 0.5, peak: 0.13 }); noise(t, 0.12, { type: 'lowpass', f: 700, peak: 0.08 }); noise(t + 0.02, 0.07, { f: 2300, q: 2, peak: 0.025 }); },
  haul(t) {
    tone(t, 205, 0.5, { type: 'sawtooth', f2: 262, bp: [820, 12], peak: 0.04, a: 0.15 });
    tone(t + 0.55, 250, 0.35, { type: 'sawtooth', f2: 200, bp: [900, 12], peak: 0.03, a: 0.1 });
    noise(t + 0.1, 0.4, { type: 'highpass', f: 3000, peak: 0.012, a: 0.1 });
  },
  layer(t, o) { // a short rising motif, one step higher for every course laid
    const sc = [392, 440, 494, 587, 659, 784, 880, 988, 1175, 1319], n = (o && o.n != null ? o.n : 0) + 1;
    for (let i = 0; i < 3; i++) bell(t + i * 0.13, sc[Math.min(sc.length - 1, n + i)], 0.55, 0.036);
  },
  vision(t) { // the vision turns solid: a shimmering chord with a cascade of chimes
    for (const f of [523, 659, 784, 1046]) tone(t, f, 2.6, { type: 'triangle', vib: [5, 3], peak: 0.022, a: 0.5 });
    [1568, 1760, 2093, 2349, 2637, 3136].forEach((f, i) => bell(t + 0.15 + i * 0.09, f, 0.9, 0.022));
    noise(t, 2.0, { type: 'highpass', f: 6000, peak: 0.01, a: 0.8 });
  },
  pops(t) { for (let i = 0; i < 7; i++) noise(t + rnd(0, 1.3), 0.03, { f: rnd(1500, 3200), q: 2, peak: 0.07 }); },
  echo(t) { // an unanswered call fading into the forest
    const d = ac.createDelay(1), fb = gainN(0.42), lp = filt('lowpass', 1600), wet = gainN(0.8);
    d.delayTime.value = 0.34; d.connect(lp); lp.connect(fb); fb.connect(d); d.connect(wet); wet.connect(sfxBus);
    const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(520, t); o.frequency.exponentialRampToValueAtTime(700, t + 0.3);
    const g = env(t, 0.045, 0.04, 0.3); o.connect(g); g.connect(d); o.start(t); o.stop(t + 0.4);
    setTimeout(() => { try { d.disconnect(); fb.disconnect(); wet.disconnect(); } catch (e) { /* gone */ } }, 3500);
  },
  chirp(t) { const n = 2 + Math.floor(Math.random() * 3), f0 = rnd(2500, 3900), up = Math.random() < 0.5;
    for (let i = 0; i < n; i++) tone(t + i * 0.1, f0 * (1 + i * 0.03), 0.07, { f2: f0 * (up ? 1.3 : 0.75), peak: 0.016, dest: ambBus }); },
  kookaburra(t) { // a distant, gentle "laugh"
    const fs = [620, 700, 820, 940, 1040, 1100, 1060, 980, 1080, 1000, 900, 780, 680];
    fs.forEach((f, i) => tone(t + i * 0.12 + (i > 8 ? (i - 8) * 0.03 : 0), f, 0.1, { type: 'triangle', f2: f * 0.8, vib: [30, 30], peak: 0.014, dest: ambBus }));
  },
  crackle(t) { noise(t, rnd(0.01, 0.03), { type: 'highpass', f: rnd(2000, 4500), peak: rnd(0.02, 0.06), dest: ambBus }); },
  bubble(t) { const f = rnd(300, 620); tone(t, f, 0.06, { f2: f * 1.7, peak: 0.02, dest: ambBus }); },
  drip(t) { const f = rnd(900, 1500); tone(t, f, 0.05, { f2: f * 1.5, peak: 0.012, dest: ambBus }); },
};

// ---------- public API ----------
// Any tap, click or key press unlocks audio. Turning sound ON (button or M) also counts, even while muted.
function onGesture(e) {
  const toggling = e && ((e.target && e.target.closest && e.target.closest('[data-sound-toggle]')) || (e.type === 'keydown' && (e.key === 'm' || e.key === 'M')));
  if (enabled || toggling) unlock(true);
}
export function init() {
  if (listening) return; listening = true;
  for (const ev of ['pointerdown', 'touchend', 'keydown', 'click']) window.addEventListener(ev, onGesture, { capture: true, passive: true });
}
export function dispose() {
  listening = false;
  for (const ev of ['pointerdown', 'touchend', 'keydown', 'click']) window.removeEventListener(ev, onGesture, { capture: true });
  if (ac) { try { ac.close(); } catch (e) { /* ignore */ } ac = null; }
}
// Called inside a user gesture: creates the AudioContext the first time, then resumes it (iOS needs this on a touch).
export function unlock(force = false) {
  if (!enabled && !force) return;
  try {
    if (!ac && !build()) return;
    stats.unlocks++;
    if (!paused && ac.state !== 'running') ac.resume().catch(() => {});
    // iOS: play a silent one-sample buffer inside the gesture to fully unlock output
    const b = ac.createBuffer(1, 1, 22050), s = ac.createBufferSource(); s.buffer = b; s.connect(ac.destination); s.start(0);
  } catch (e) { stats.errors.push(String(e)); }
}
function applyGain(immediate = false) {
  if (!master) return;
  const g = master.gain, v = enabled ? volume : 0;
  if (immediate) { g.cancelScheduledValues(ac.currentTime); g.value = v; } else g.setTargetAtTime(v, ac.currentTime, 0.05);
}
export function setEnabled(on) {
  enabled = !!on; save();
  if (!ac) { if (enabled) unlock(); return; }
  applyGain(true);
  if (!enabled) ac.suspend().catch(() => {});
  else if (!paused) ac.resume().catch(() => {});
}
export function setVolume(v) { volume = Math.min(1, Math.max(0, +v || 0)); save(); applyGain(); }
export function setPaused(p) {
  paused = !!p; if (!ac) return;
  if (paused) ac.suspend().catch(() => {});
  else if (enabled) ac.resume().catch(() => {});
}
export function setSpeed(s) { speed = Math.max(0.1, +s || 1); }
export function prefs() { return { enabled, volume }; }
export function debug() {
  return { created: stats.created, state: ac ? ac.state : 'none', enabled, volume, paused, gain: master ? master.gain.value : null,
    played: Object.assign({}, stats.played), skipped: stats.skipped, errors: stats.errors.slice(), unlocks: stats.unlocks };
}
export function play(name, opts) {
  if (!ac || !enabled || paused || ac.state !== 'running' || !SFX[name]) { stats.skipped++; return false; }
  const now = ac.currentTime, gap = (RATE[name] || 0.25) * Math.max(1, speed / 1.5);
  if (last[name] != null && now - last[name] < gap) { stats.skipped++; return false; }
  last[name] = now;
  try { SFX[name](now + 0.02, opts || {}); stats.played[name] = (stats.played[name] || 0) + 1; return true; }
  catch (e) { stats.errors.push(name + ': ' + e); return false; }
}
// Called every animation frame while the story plays: ambient levels follow the scene, and the forest fills in birds etc.
export function tick(lv) {
  if (!ac || !amb || ac.state !== 'running' || !enabled) return;
  try {
    const now = ac.currentTime, k = 0.35;
    for (const key in level) level[key] = lv[key] || 0;
    amb.wind.gain.setTargetAtTime(0.045 + 0.06 * level.wind, now, 0.6);
    amb.water[0].gain.setTargetAtTime(0.06 * level.water, now, k); amb.water[1].gain.setTargetAtTime(0.05 * level.water, now, k);
    amb.bees.gain.setTargetAtTime(0.022 * level.bees + 0.05 * level.angry, now, 0.25);
    amb.fire.gain.setTargetAtTime(0.05 * level.fire, now, k);
    const busy = speed > 2.2; // at high speed, keep the forest calm
    if (now > nextBird) { if (!busy) SFX.chirp(now + 0.02); nextBird = now + rnd(3.5, 9); }
    if (now > nextKook) { if (!busy) SFX.kookaburra(now + 0.02); nextKook = now + rnd(50, 90); }
    if (now > nextCicada) { const g = amb.cic.gain; g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.linearRampToValueAtTime(0.012, now + 2.5); g.linearRampToValueAtTime(0.012, now + 5.5); g.linearRampToValueAtTime(0, now + 8.5); nextCicada = now + rnd(22, 40); }
    if (level.fire > 0.2 && now > nextCrackle) { SFX.crackle(now + 0.01); nextCrackle = now + rnd(0.06, 0.28); }
    if (level.fire > 0.2 && now > nextBubble) { SFX.bubble(now + 0.01); nextBubble = now + rnd(0.15, 0.45); }
    if (level.water > 0.3 && now > nextDrip) { SFX.drip(now + 0.01); nextDrip = now + rnd(0.3, 1.1); }
  } catch (e) { stats.errors.push('tick: ' + e); }
}
// Test hook: synthesise every sound once (ignoring rate limits) and report any errors. Used by the headless checks.
export function testAll() {
  if (!ac) return { ok: false, reason: 'no AudioContext yet' };
  const errs = [], names = Object.keys(SFX); let t = ac.currentTime + 0.05;
  for (const n of names) { try { SFX[n](t, { from: 'team', to: 'manager', accent: true }); } catch (e) { errs.push(n + ': ' + e); } t += 0.01; }
  return { ok: errs.length === 0, count: names.length, names, errs };
}
