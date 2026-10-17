// Above the Canopy - animation engine (plain canvas 2D, no dependencies).
// World units: the scene is H = 600 units tall; the canvas is scaled to fit.
// Exported as an ES module and driven from Blazor (Pages/Home.razor) via JS interop.

const H = 600;
const WORLD_W = 3800;
const GROUND = 480;          // forest floor before the cliff
const LOW_GROUND = 565;      // forest floor after the cliff
const CANOPY_TOP = 120;
const CANOPY_BOTTOM = 245;
const LEADER_Y = 68;
const MANAGER_Y = 320;
const START_X = 120;
const GOAL_X = 3300;         // pyramid centre
const PYR_HALF = 230;
const PYR_APEX = 52;
const MEMBER_GAP = 30;
const TEAM_COLORS = ['#e8573f', '#3f8fe8', '#f2b233', '#9b59d0'];

let canvas, ctx, dotnet, raf = 0, lastT = 0, ro = null;
let fog, fctx;
let scale = 1, viewW = 1200, camX = 0, camTarget = 0;
let deco = null;
let S = null;
const settings = { speed: 1, playing: true, view: 'all', comms: true };

// ---------- helpers ----------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
function rng(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
function call(method, ...args) { try { dotnet && dotnet.invokeMethodAsync(method, ...args); } catch (e) { /* ignore */ } }

// ---------- world ----------
function makeObstacles() {
  return [
    { type: 'vines', x: 640, w: 110, name: 'tangle of vines', icon: '🌿', prog: 0 },
    { type: 'boulder', x: 1150, w: 120, name: 'giant boulder', icon: '🪨', prog: 0 },
    { type: 'river', x: 1760, w: 190, name: 'fast river', icon: '🌊', prog: 0 },
    { type: 'cliff', x: 2480, w: 60, name: 'cliff edge', icon: '⛰️', prog: 0 },
  ].map(o => Object.assign(o, { spotted: false, informed: false, done: false, active: false }));
}
const ob = type => S.obstacles.find(o => o.type === type);

function buildDeco() {
  const r = rng(42);
  const d = { trunks: [], blobs: [], hang: [], bushes: [], far: [], clouds: [], tufts: [], shafts: [] };
  for (let x = 20; x < WORLD_W; x += 70 + r() * 70) {
    if (Math.abs(x - GOAL_X) < PYR_HALF + 30) continue;
    const river = { x: 1760, w: 190 };
    if (x > river.x - 15 && x < river.x + river.w + 15) continue;
    if (x > 2460 && x < 2560) continue;
    d.trunks.push({ x, w: 16 + r() * 20, shade: r() });
  }
  for (let x = -60; x < WORLD_W + 60; x += 22 + r() * 18) {
    d.blobs.push({ x, y: CANOPY_TOP + 18 + r() * (CANOPY_BOTTOM - CANOPY_TOP - 30), rad: 34 + r() * 30, c: Math.floor(r() * 4) });
  }
  for (let x = 0; x < WORLD_W; x += 40 + r() * 60) d.hang.push({ x, len: 50 + r() * 120, ph: r() * 6 });
  for (let x = 0; x < WORLD_W; x += 45 + r() * 55) {
    if (x > 1750 && x < 1960) continue;
    if (Math.abs(x - GOAL_X) < PYR_HALF) continue;
    d.bushes.push({ x, s: 0.7 + r() * 0.6, c: Math.floor(r() * 3) });
  }
  for (let x = 0; x < WORLD_W * 0.5 + 1500; x += 40 + r() * 50) d.far.push({ x, h: 140 + r() * 160, w: 30 + r() * 30 });
  for (let i = 0; i < 9; i++) d.clouds.push({ x: r() * 2400, y: 20 + r() * 60, s: 0.6 + r() * 0.8 });
  for (let x = 0; x < WORLD_W; x += 9 + r() * 14) d.tufts.push({ x, h: 4 + r() * 8 });
  for (let x = 100; x < WORLD_W; x += 260 + r() * 260) d.shafts.push({ x, w: 30 + r() * 40 });
  return d;
}

function groundBase(x) {
  const c = ob('cliff');
  if (x < c.x) return GROUND;
  if (x > c.x + c.w) return LOW_GROUND;
  return lerp(GROUND, LOW_GROUND, (x - c.x) / c.w);
}
function memberY(x) {
  const r = ob('river');
  if (x > r.x && x < r.x + r.w) return r.prog >= 1 ? GROUND - 6 : GROUND + 30;
  return groundBase(x);
}
function laneOffset(x) {
  // When the team goes around the boulder they swing into the foreground lane.
  const b = ob('boulder');
  if (!b.route) return 0;
  const a = b.x - 70, z = b.x + b.w + 70;
  if (x < a || x > z) return 0;
  return Math.sin(Math.PI * (x - a) / (z - a)) * 34;
}

// ---------- state ----------
function reset() {
  S = {
    t: 0,
    obstacles: makeObstacles(),
    team: { x: START_X + 70, mode: 'idle', seq: null, step: 0, stepT: 0, stepStartX: 0, mood: '', m0: 0, walkT: 0, wrong: 0, surprises: 0, obIndex: -1 },
    mgr: { x: START_X + 140, y: MANAGER_Y, alert: 0, ready: false, scan: 0 },
    leader: { x: START_X + 260, y: LEADER_Y, beam: null, beamT: 0, nextBeam: 22 },
    bubbles: [], pulses: [], events: [], particles: [],
    caption: '', phase: '', finished: false, introCam: 'start', selected: null,
  };
  camX = camTarget = 0;
  scheduleIntro();
}

function later(delay, fn) { S.events.push({ at: S.t + delay, fn }); }
function caption(text, phase) {
  S.caption = text; if (phase) S.phase = phase;
  call('OnCaption', text, S.phase);
}
function bubble(who, text, dur = 3.2) {
  S.bubbles = S.bubbles.filter(b => b.who !== who);
  S.bubbles.push({ who, text, t: 0, dur });
}
function pulse(from, to, color, onArrive, dur = 1.4) { S.pulses.push({ from, to, color, onArrive, t: 0, dur }); }

function agentPos(who) {
  if (who === 'leader') return { x: S.leader.x, y: S.leader.y };
  if (who === 'manager') return { x: S.mgr.x, y: S.mgr.y };
  const tx = S.team.x;
  return { x: tx - MEMBER_GAP * 1.5, y: memberY(tx) - 40 + laneOffset(tx) };
}

function scheduleIntro() {
  caption('High above the canopy, the Leader can see where the team starts... ', 'Vision');
  S.leader.beam = 'start'; S.leader.beamT = 2.6;
  later(2.6, () => {
    S.introCam = 'goal';
    S.leader.beam = 'goal'; S.leader.beamT = 3.2;
    caption('...and the end goal: a pyramid poking out of the top of the canopy, far to the east.', 'Vision');
    bubble('leader', 'There it is: the pyramid! 🔺', 3);
  });
  later(5.8, () => {
    S.introCam = null;
    caption('The Leader shares the vision and the direction with the Manager below the canopy.', 'Direction');
    bubble('leader', 'Head east to the pyramid.', 2.6);
    pulse('leader', 'manager', '#ffd34d', () => {
      bubble('manager', 'Got it. I\'ll scout a route.', 2.6);
      caption('The Manager turns the vision into a plan, flying ahead under the canopy to scout the way.', 'Planning');
      S.mgr.ready = true;
      later(1.6, kickOffTeam);
    });
  });
}

function kickOffTeam() {
  if (settings.comms) {
    bubble('manager', 'Team: east to the pyramid. I\'ll warn you about hazards!', 3);
    pulse('manager', 'team', '#c792ff', () => {
      bubble('team', 'East it is! Let\'s go! 💪', 2.4);
      S.team.mode = 'walk';
      caption('The team sets off on the forest floor. Down here they can only see a few metres ahead, through vines and bushes.', 'Execution');
    });
  } else {
    caption('Communication is OFF: the team never hears the plan, so they don\'t even know which way to go.', 'Execution');
    runSeq([
      { dur: 2.2, cap: 'Which way? The team argues and wanders west first...', mood: 'confused', move: -60, wrong: true, say: 'Which way?? 🤔' },
      { dur: 2.0, mood: 'confused', move: 60, say: 'Hmm, maybe this way...' },
    ], null);
  }
}

// ---------- obstacle sequences ----------
function sequenceFor(o, informed) {
  const T = (o) => o; // readability
  switch (o.type) {
    case 'vines': return informed ? [
      { dur: 0.6, mood: 'work', cap: 'Warned about the vines, the team arrives with machetes ready and hacks a path straight through.', say: 'Machetes out! 🔪' },
      { dur: 2.6, mood: 'work', prog: true },
    ] : [
      { dur: 1.6, mood: 'stuck', cap: 'Nobody warned them: the team walks into a tangle of vines and gets stuck!', say: 'We\'re stuck! 😩', surprise: true },
      { dur: 1.8, mood: 'confused', move: -70, wrong: true, cap: 'Someone runs back to camp for a machete...' },
      { dur: 1.6, mood: 'walk', move: 70 },
      { dur: 3.4, mood: 'work', prog: true, cap: 'Finally, they start hacking through the vines.' },
    ];
    case 'boulder': return informed ? [
      { dur: 0.4, mood: 'walk', cap: 'Thanks to the Manager\'s heads-up, the team veers around the boulder early.', say: 'Around the left side! ↪', onStart: () => { o.route = true; } },
      { dur: 3.0, mood: 'walk', move: o.w + 90 },
    ] : [
      { dur: 1.2, mood: 'stuck', cap: 'BONK! The team walks straight into a giant boulder.', say: 'Ouch! A boulder?! 💥', surprise: true },
      { dur: 2.2, mood: 'work', cap: 'They try to push it out of the way. It doesn\'t budge.', say: 'Push! PUSH!' },
      { dur: 2.0, mood: 'confused', move: -90, wrong: true, cap: 'Wrong turn: they back-track looking for another way.', say: 'Is there a way round? 🤷' },
      { dur: 1.6, mood: 'walk', move: 90, onStart: () => { o.route = true; } },
      { dur: 3.4, mood: 'walk', move: o.w + 90, cap: 'At last they find the way around.' },
    ];
    case 'river': return informed ? [
      { dur: 0.6, mood: 'work', cap: 'The Manager spotted the river early, so the team brought logs and builds a bridge.', say: 'Logs ready, build the bridge! 🪵' },
      { dur: 3.4, mood: 'work', prog: true },
    ] : [
      { dur: 1.0, mood: 'confused', cap: 'A river! Nobody saw it coming.', say: 'A river?! 😮', surprise: true },
      { dur: 1.8, mood: 'stuck', m0: p => Math.sin(Math.PI * p) * 60, cap: 'SPLASH! One brave team member tries to wade across. Far too deep!', say: 'Too deep! 💦' },
      { dur: 2.4, mood: 'confused', move: -110, wrong: true, cap: 'The team scrambles back into the forest to hunt for logs...' },
      { dur: 2.0, mood: 'walk', move: 110 },
      { dur: 4.2, mood: 'work', prog: true, cap: '...and slowly builds a bridge by trial and error.' },
    ];
    case 'cliff': return informed ? [
      { dur: 0.6, mood: 'work', cap: 'The Manager found the safe spot to climb, so the team ties off a rope and climbs down the cliff.', say: 'Rope here, as planned! 🪢' },
      { dur: 2.2, mood: 'work', prog: true },
    ] : [
      { dur: 1.2, mood: 'stuck', cap: 'Dead end! The ground just drops away at a cliff.', say: 'Whoa! A cliff! 😱', surprise: true },
      { dur: 2.4, mood: 'confused', move: -80, wrong: true, cap: 'Wrong turn: they wander along the edge looking for a way down...', say: 'Maybe further back?' },
      { dur: 2.2, mood: 'confused', move: 80, say: 'Nope... back again.' },
      { dur: 3.0, mood: 'work', prog: true, cap: 'Eventually they rig a rope and lower themselves down.' },
    ];
  }
  return [];
}

function runSeq(steps, obstacle) {
  const tm = S.team;
  tm.mode = 'seq'; tm.seq = steps; tm.step = 0; tm.stepT = 0; tm.stepStartX = tm.x; tm.seqOb = obstacle;
  startStep();
}
function startStep() {
  const tm = S.team, st = tm.seq[tm.step];
  if (st.cap) caption(st.cap, tm.seqOb ? 'Obstacle' : S.phase);
  if (st.say) bubble('team', st.say, Math.max(2, st.dur + 0.6));
  if (st.wrong) { tm.wrong++; call('OnStats', tm.wrong, tm.surprises); }
  if (st.surprise) { tm.surprises++; call('OnStats', tm.wrong, tm.surprises); }
  if (st.onStart) st.onStart();
}
function updateSeq(dt) {
  const tm = S.team, st = tm.seq[tm.step];
  tm.stepT += dt;
  const p = Math.min(1, tm.stepT / st.dur);
  tm.mood = st.mood || '';
  if (st.move != null) tm.x = tm.stepStartX + st.move * ease(p);
  if (st.m0) tm.m0 = st.m0(p); else tm.m0 = 0;
  if (st.prog && tm.seqOb) tm.seqOb.prog = Math.max(tm.seqOb.prog, p);
  if (p >= 1) {
    tm.step++; tm.stepT = 0; tm.stepStartX = tm.x;
    if (tm.step >= tm.seq.length) {
      if (tm.seqOb) { tm.seqOb.done = true; tm.seqOb.prog = 1; tm.seqOb.active = false; }
      const wasIntro = !tm.seqOb;
      tm.seq = null; tm.seqOb = null; tm.mode = 'walk'; tm.mood = '';
      caption(wasIntro ? 'Eventually the team picks a direction and heads off, unsure if it\'s right.'
        : 'Obstacle cleared. The team pushes on through the undergrowth.', 'Execution');
    } else startStep();
  }
}

// ---------- update ----------
function update(dt) {
  S.t += dt;
  // events
  for (const e of S.events.slice()) if (S.t >= e.at) { S.events.splice(S.events.indexOf(e), 1); e.fn(); }
  const tm = S.team, mg = S.mgr, ld = S.leader;

  // team
  if (tm.mode === 'walk') {
    const next = S.obstacles.find(o => !o.done);
    const spd = settings.comms ? 62 : 48;
    tm.walkT += dt;
    let nx = tm.x + spd * dt;
    if (next) {
      const stopX = next.x - 28;
      if (nx >= stopX) {
        tm.x = stopX; next.active = true;
        runSeq(sequenceFor(next, next.informed), next);
      } else tm.x = nx;
    } else {
      const endX = GOAL_X - PYR_HALF - 20;
      if (nx >= endX) { tm.x = endX; finish(); } else tm.x = nx;
    }
  } else if (tm.mode === 'seq') updateSeq(dt);
  if (tm.mode === 'walk' || tm.mode === 'seq') tm.walkT += 0;

  // manager: flies ahead of the team, scouting
  if (mg.ready) {
    const lead = S.finished ? 60 : 300;
    let target = Math.min(tm.x + lead, GOAL_X - 40);
    const nextUnspotted = S.obstacles.find(o => !o.spotted);
    if (nextUnspotted && mg.x + 230 >= nextUnspotted.x) spot(nextUnspotted);
    const dx = target - mg.x;
    mg.x += clamp(dx * 1.4 * dt, -140 * dt, 140 * dt);
  }
  mg.alert = Math.max(0, mg.alert - dt);
  mg.y = MANAGER_Y + Math.sin(S.t * 2.1) * 8;

  // leader: soars above, roughly between team and goal
  const base = S.finished ? GOAL_X : clamp(Math.max(tm.x, mg.x) + 180, 300, GOAL_X - 120);
  const lx = base + Math.sin(S.t * 0.45) * 90;
  ld.x += clamp((lx - ld.x) * 1.2 * dt, -150 * dt, 150 * dt);
  ld.y = LEADER_Y + Math.sin(S.t * 1.3) * 10;
  if (ld.beamT > 0) { ld.beamT -= dt; if (ld.beamT <= 0) ld.beam = null; }
  if (S.mgr.ready && !S.finished && S.t > ld.nextBeam) {
    ld.nextBeam = S.t + 16;
    ld.beam = 'goal'; ld.beamT = 2.6;
    bubble('leader', ['Keep heading for the pyramid! 🔺', 'Great progress, stay on course!', 'Remember why: the pyramid!'][Math.floor(S.t / 16) % 3], 2.6);
    pulse('leader', 'manager', '#ffd34d', () => bubble('manager', 'Still on course, boss. 👍', 2));
  }

  // bubbles / pulses / particles
  for (const b of S.bubbles) b.t += dt;
  S.bubbles = S.bubbles.filter(b => b.t < b.dur);
  for (const p of S.pulses.slice()) {
    p.t += dt;
    if (p.t >= p.dur) { S.pulses.splice(S.pulses.indexOf(p), 1); p.onArrive && p.onArrive(); }
  }
  for (const p of S.particles) { p.vy += 160 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt; p.life -= dt; }
  S.particles = S.particles.filter(p => p.life > 0);
  if (S.finished && Math.random() < dt * 30) confetti(GOAL_X + (Math.random() - 0.5) * 300, 60 + Math.random() * 60, 1);
}

function spot(o) {
  o.spotted = true;
  S.mgr.alert = 2.2;
  bubble('manager', `${o.icon} ${o.name} ahead!`, 2.6);
  if (settings.comms) {
    caption(`The Manager spots a ${o.name} ahead and radios a warning down to the team.`, 'Communication');
    later(0.8, () => pulse('manager', 'team', '#c792ff', () => {
      o.informed = true;
      const advice = { vines: 'Heads up: vines ahead, bring machetes!', boulder: 'Boulder ahead: go around the left!', river: 'River ahead: collect logs for a bridge!', cliff: 'Cliff ahead: rope down at the marked spot!' }[o.type];
      bubble('team', '📻 ' + advice, 3.4);
    }));
  } else {
    caption(`The Manager spots a ${o.name}, but communication is OFF, so the team never hears about it.`, 'No communication');
    later(1.2, () => bubble('manager', '(...keeps it to themselves 🤐)', 2.4));
  }
}

function finish() {
  const tm = S.team;
  S.finished = true; tm.mode = 'done'; tm.mood = 'happy';
  caption('The team reaches the pyramid! 🎉 Vision (Leader) + planning & communication (Manager) + execution (Team) got them here.', 'Goal reached');
  bubble('team', 'We made it!! 🎉', 5);
  later(1.2, () => bubble('manager', 'Brilliant work, team!', 4));
  later(2.0, () => bubble('leader', 'Proud of every one of you! 🦅', 4));
  for (let i = 0; i < 80; i++) confetti(tm.x - 30 + (Math.random() - 0.5) * 60, memberY(tm.x) - 50, 1);
  call('OnFinished', Math.round(S.t), tm.wrong, tm.surprises, settings.comms);
}
function confetti(x, y, n) {
  const cols = ['#ff5d5d', '#ffd34d', '#5dd3ff', '#8aff5d', '#d07bff', '#ffffff'];
  for (let i = 0; i < n; i++) S.particles.push({ x, y, vx: (Math.random() - 0.5) * 220, vy: -120 - Math.random() * 200, r: Math.random() * 6, vr: (Math.random() - 0.5) * 10, life: 2.5 + Math.random(), c: cols[Math.floor(Math.random() * cols.length)] });
}

// ---------- camera ----------
function updateCamera(dt) {
  if (S.introCam === 'start') camTarget = 0;
  else if (S.introCam === 'goal') camTarget = GOAL_X + 260 - viewW;
  else if (S.finished) camTarget = GOAL_X + 300 - viewW;
  else camTarget = S.team.x - viewW * 0.3;
  camTarget = clamp(camTarget, 0, Math.max(0, WORLD_W - viewW));
  camX += (camTarget - camX) * Math.min(1, dt * 2.2);
}

// ---------- drawing ----------
function drawSky() {
  const g = ctx.createLinearGradient(0, 0, 0, CANOPY_BOTTOM);
  g.addColorStop(0, '#6ec6ff'); g.addColorStop(0.7, '#bfe8ff'); g.addColorStop(1, '#e8f7e0');
  ctx.fillStyle = g; ctx.fillRect(0, 0, viewW, H);
  // sun
  ctx.fillStyle = 'rgba(255,240,170,0.9)';
  ctx.beginPath(); ctx.arc(viewW - 120, 60, 30, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,240,170,0.25)';
  ctx.beginPath(); ctx.arc(viewW - 120, 60, 50, 0, 7); ctx.fill();
  // clouds (slow parallax)
  for (const c of deco.clouds) {
    const x = ((c.x - camX * 0.1 + S.t * 6 * c.s) % (viewW + 300) + viewW + 300) % (viewW + 300) - 150;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.ellipse(x, c.y, 40 * c.s, 13 * c.s, 0, 0, 7);
    ctx.ellipse(x + 25 * c.s, c.y - 8 * c.s, 26 * c.s, 14 * c.s, 0, 0, 7);
    ctx.ellipse(x - 22 * c.s, c.y - 4 * c.s, 22 * c.s, 11 * c.s, 0, 0, 7);
    ctx.fill();
  }
}
function drawUnderstory() {
  // dim green air beneath the canopy
  const g = ctx.createLinearGradient(0, CANOPY_TOP + 60, 0, LOW_GROUND);
  g.addColorStop(0, '#3e6b43'); g.addColorStop(0.5, '#4d7d4a'); g.addColorStop(1, '#2f5233');
  ctx.fillStyle = g; ctx.fillRect(0, CANOPY_TOP + 60, viewW, H);
  // far trunks (parallax 0.5)
  ctx.fillStyle = 'rgba(36,70,40,0.75)';
  for (const f of deco.far) {
    const x = f.x - camX * 0.5;
    if (x < -60 || x > viewW + 60) continue;
    ctx.fillRect(x, CANOPY_BOTTOM - 20, f.w * 0.5, GROUND - CANOPY_BOTTOM + 40);
  }
  // light shafts
  for (const s of deco.shafts) {
    const x = s.x - camX;
    if (x < -200 || x > viewW + 200) continue;
    ctx.fillStyle = 'rgba(255,250,200,0.07)';
    ctx.beginPath(); ctx.moveTo(x, CANOPY_BOTTOM - 20); ctx.lineTo(x + s.w, CANOPY_BOTTOM - 20);
    ctx.lineTo(x + s.w + 90, GROUND); ctx.lineTo(x + 60, GROUND); ctx.closePath(); ctx.fill();
  }
}
function drawTrunks() {
  for (const t of deco.trunks) {
    const x = t.x - camX;
    if (x < -50 || x > viewW + 50) continue;
    const gy = groundBase(t.x);
    const g = ctx.createLinearGradient(x, 0, x + t.w, 0);
    const base = t.shade > 0.5 ? ['#5b3e2b', '#7a5640'] : ['#4e3626', '#6d4b36'];
    g.addColorStop(0, base[0]); g.addColorStop(0.6, base[1]); g.addColorStop(1, base[0]);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x, CANOPY_TOP + 40); ctx.lineTo(x + t.w, CANOPY_TOP + 40);
    ctx.lineTo(x + t.w + 6, gy + 4); ctx.lineTo(x - 6, gy + 4); ctx.closePath(); ctx.fill();
    // roots
    ctx.beginPath(); ctx.moveTo(x - 6, gy + 4); ctx.quadraticCurveTo(x - 16, gy + 2, x - 22, gy + 6); ctx.lineTo(x, gy - 4); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + t.w + 6, gy + 4); ctx.quadraticCurveTo(x + t.w + 16, gy + 2, x + t.w + 22, gy + 6); ctx.lineTo(x + t.w, gy - 4); ctx.fill();
  }
}
function drawHangingVines() {
  ctx.strokeStyle = '#2e6b2a'; ctx.lineWidth = 2.2;
  for (const v of deco.hang) {
    const x = v.x - camX;
    if (x < -30 || x > viewW + 30) continue;
    const sway = Math.sin(S.t * 1.2 + v.ph) * 6;
    ctx.beginPath(); ctx.moveTo(x, CANOPY_BOTTOM - 25);
    ctx.quadraticCurveTo(x + sway, CANOPY_BOTTOM - 25 + v.len * 0.6, x + sway * 1.5, CANOPY_BOTTOM - 25 + v.len);
    ctx.stroke();
    ctx.fillStyle = '#3f8f3a';
    for (let k = 0.3; k < 1; k += 0.25) {
      ctx.beginPath(); ctx.ellipse(x + sway * k * 1.4 + 3, CANOPY_BOTTOM - 25 + v.len * k, 4, 2, 0.6, 0, 7); ctx.fill();
    }
  }
}
function drawPyramid() {
  const x = GOAL_X - camX;
  if (x < -PYR_HALF - 20 || x > viewW + PYR_HALF + 20) return;
  const by = LOW_GROUND + 2;
  ctx.fillStyle = '#d9b066';
  ctx.beginPath(); ctx.moveTo(x - PYR_HALF, by); ctx.lineTo(x, PYR_APEX); ctx.lineTo(x + PYR_HALF, by); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#b98c45';
  ctx.beginPath(); ctx.moveTo(x, PYR_APEX); ctx.lineTo(x + PYR_HALF, by); ctx.lineTo(x + 30, by); ctx.closePath(); ctx.fill();
  // stone courses
  ctx.strokeStyle = 'rgba(120,85,40,0.45)'; ctx.lineWidth = 1.2;
  for (let y = PYR_APEX + 26; y < by; y += 22) {
    const half = PYR_HALF * (y - PYR_APEX) / (by - PYR_APEX);
    ctx.beginPath(); ctx.moveTo(x - half, y); ctx.lineTo(x + half, y); ctx.stroke();
  }
  // doorway
  ctx.fillStyle = '#4a3418';
  ctx.beginPath(); ctx.moveTo(x - 16, by); ctx.lineTo(x - 16, by - 30); ctx.arc(x, by - 30, 16, Math.PI, 0); ctx.lineTo(x + 16, by); ctx.fill();
  // capstone glint
  ctx.fillStyle = '#ffe58a';
  ctx.beginPath(); ctx.moveTo(x, PYR_APEX); ctx.lineTo(x - 11, PYR_APEX + 18); ctx.lineTo(x + 11, PYR_APEX + 18); ctx.closePath(); ctx.fill();
}
function drawStartCamp() {
  const x = START_X - camX;
  if (x < -100 || x > viewW + 100) return;
  ctx.fillStyle = '#d0603a';
  ctx.beginPath(); ctx.moveTo(x - 40, GROUND); ctx.lineTo(x, GROUND - 46); ctx.lineTo(x + 40, GROUND); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#8a3a20';
  ctx.beginPath(); ctx.moveTo(x - 8, GROUND); ctx.lineTo(x, GROUND - 30); ctx.lineTo(x + 8, GROUND); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x - 70, GROUND); ctx.lineTo(x - 70, GROUND - 70); ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.moveTo(x - 70, GROUND - 70); ctx.lineTo(x - 30, GROUND - 62); ctx.lineTo(x - 70, GROUND - 52); ctx.fill();
  ctx.fillStyle = '#2d2d2d'; ctx.font = 'bold 9px sans-serif'; ctx.fillText('START', x - 67, GROUND - 58);
}
function drawGround() {
  const r = ob('river');
  const x0 = camX - 20, x1 = camX + viewW + 20;
  const g = ctx.createLinearGradient(0, GROUND - 10, 0, H);
  g.addColorStop(0, '#5c8f3a'); g.addColorStop(0.15, '#6b4f2e'); g.addColorStop(1, '#3d2b18');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x0 - camX, H);
  for (let x = x0; x <= x1; x += 6) {
    if (x > r.x && x < r.x + r.w) { // river gap
      ctx.lineTo(r.x - camX, groundBase(r.x)); ctx.lineTo(r.x + 10 - camX, H);
      ctx.lineTo(r.x + r.w - 10 - camX, H); ctx.lineTo(r.x + r.w - camX, groundBase(r.x + r.w));
      x = r.x + r.w; continue;
    }
    ctx.lineTo(x - camX, groundBase(x));
  }
  ctx.lineTo(x1 - camX, H); ctx.closePath(); ctx.fill();
  // grass tufts
  ctx.strokeStyle = '#7fbf4a'; ctx.lineWidth = 1.5;
  for (const t of deco.tufts) {
    if (t.x < x0 || t.x > x1 || (t.x > r.x && t.x < r.x + r.w)) continue;
    const gy = groundBase(t.x), sx = t.x - camX;
    ctx.beginPath(); ctx.moveTo(sx, gy); ctx.lineTo(sx - 2, gy - t.h); ctx.moveTo(sx, gy); ctx.lineTo(sx + 3, gy - t.h * 0.8); ctx.stroke();
  }
}
function drawRiver(front) {
  const r = ob('river');
  const x = r.x - camX;
  if (x > viewW + 20 || x + r.w < -20) return;
  if (!front) {
    ctx.fillStyle = '#2f7fbf';
    ctx.fillRect(x + 4, GROUND + 18, r.w - 8, H - GROUND);
  } else {
    // front water surface over anything wading
    ctx.fillStyle = 'rgba(60,150,220,0.75)';
    ctx.fillRect(x + 6, GROUND + 16, r.w - 12, H - GROUND);
    ctx.strokeStyle = 'rgba(220,245,255,0.8)'; ctx.lineWidth = 2;
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      for (let i = 0; i <= 20; i++) {
        const wx = x + 10 + i * (r.w - 20) / 20;
        const wy = GROUND + 22 + k * 18 + Math.sin(S.t * 4 + i * 0.9 + k) * 2.5;
        i ? ctx.lineTo(wx, wy) : ctx.moveTo(wx, wy);
      }
      ctx.stroke();
    }
    // bridge
    const planks = Math.floor(r.prog * 10 + 0.0001);
    ctx.fillStyle = '#8b5a2b'; ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 1;
    for (let i = 0; i < planks; i++) {
      const px = x - 6 + i * (r.w + 12) / 10;
      ctx.fillRect(px, GROUND - 6, (r.w + 12) / 10 - 2, 9); ctx.strokeRect(px, GROUND - 6, (r.w + 12) / 10 - 2, 9);
    }
    if (r.prog >= 1) {
      ctx.strokeStyle = '#c9a36b'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - 6, GROUND - 26); ctx.quadraticCurveTo(x + r.w / 2, GROUND - 14, x + r.w + 6, GROUND - 26); ctx.stroke();
      ctx.fillStyle = '#5a3a1a'; ctx.fillRect(x - 8, GROUND - 28, 4, 24); ctx.fillRect(x + r.w + 4, GROUND - 28, 4, 24);
    }
    // splash when someone wades
    if (S.team.m0 > 5) {
      const sx = S.team.x + S.team.m0 - camX;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(sx + Math.sin(S.t * 9 + i) * 14, GROUND + 14 - Math.abs(Math.cos(S.t * 7 + i)) * 12, 2.5, 0, 7); ctx.fill(); }
    }
  }
}
function drawBoulder() {
  const b = ob('boulder');
  const x = b.x - camX; if (x > viewW + 50 || x + b.w < -50) return;
  const shake = (S.team.seqOb === b && S.team.mood === 'work') ? Math.sin(S.t * 40) * 1.2 : 0;
  ctx.fillStyle = '#8a8d91';
  ctx.beginPath(); ctx.ellipse(x + b.w / 2 + shake, GROUND - 48, b.w / 2, 56, 0, Math.PI, 0); ctx.lineTo(x + b.w + shake, GROUND + 4); ctx.lineTo(x + shake, GROUND + 4); ctx.fill();
  ctx.fillStyle = '#a7aaae';
  ctx.beginPath(); ctx.ellipse(x + b.w * 0.38 + shake, GROUND - 70, b.w * 0.22, 18, -0.4, 0, 7); ctx.fill();
  ctx.fillStyle = '#5f8f3a';
  ctx.beginPath(); ctx.ellipse(x + b.w * 0.7 + shake, GROUND - 92, 24, 9, 0.3, 0, 7); ctx.fill();
  ctx.strokeStyle = '#6a6d71'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x + b.w * 0.6, GROUND - 40); ctx.lineTo(x + b.w * 0.72, GROUND - 22); ctx.lineTo(x + b.w * 0.66, GROUND - 6); ctx.stroke();
}
function drawCliff() {
  const c = ob('cliff');
  const x = c.x - camX; if (x > viewW + 120 || x < -160) return;
  // rocky outcrop: the forest floor ends in a sheer, layered rock face
  ctx.fillStyle = '#7d6a55';
  ctx.beginPath(); ctx.moveTo(x - 70, GROUND + 2); ctx.lineTo(x - 2, GROUND - 2);
  ctx.lineTo(x + 10, GROUND + 22); ctx.lineTo(x + 22, GROUND + 30); ctx.lineTo(x + 34, GROUND + 52); ctx.lineTo(x + 48, GROUND + 64);
  ctx.lineTo(x + c.w + 6, LOW_GROUND + 2); ctx.lineTo(x - 70, LOW_GROUND + 30); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#5a4a3a'; ctx.lineWidth = 2;
  for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x - 60, GROUND + 14 + k * 16); ctx.lineTo(x + 6 + k * 13, GROUND + 14 + k * 16); ctx.stroke(); }
  ctx.fillStyle = '#9a8670';
  ctx.beginPath(); ctx.moveTo(x - 2, GROUND - 2); ctx.lineTo(x + 10, GROUND + 22); ctx.lineTo(x + 2, GROUND + 22); ctx.closePath(); ctx.fill();
  // warning sign appears once the manager has spotted it
  if (c.spotted && c.informed) {
    ctx.fillStyle = '#5a3a1a'; ctx.fillRect(x - 54, GROUND - 34, 3, 34);
    ctx.fillStyle = '#ffcc33'; ctx.beginPath(); ctx.moveTo(x - 52, GROUND - 52); ctx.lineTo(x - 38, GROUND - 30); ctx.lineTo(x - 66, GROUND - 30); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#222'; ctx.font = 'bold 13px sans-serif'; ctx.fillText('!', x - 54, GROUND - 33);
  }
  // rope
  if (c.prog > 0) {
    ctx.fillStyle = '#5a3a1a'; ctx.fillRect(x - 14, GROUND - 16, 5, 18);
    ctx.strokeStyle = '#e0c38a'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(x - 12, GROUND - 14);
    ctx.lineTo(lerp(x - 12, x + c.w + 4, c.prog), lerp(GROUND - 14, LOW_GROUND - 4, c.prog)); ctx.stroke();
  }
}
function drawVineThicket() {
  const v = ob('vines');
  const x = v.x - camX; if (x > viewW + 60 || x + v.w < -60) return;
  const r = rng(7);
  const n = 26;
  for (let i = 0; i < n; i++) {
    const vx = x + r() * v.w, top = CANOPY_BOTTOM - 10 + r() * 60, ph = r() * 6;
    const cut = i < Math.floor(v.prog * n);
    const bottom = cut ? top + (GROUND - top) * 0.35 : GROUND + 2;
    ctx.strokeStyle = i % 2 ? '#2f7a2d' : '#3c9440'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(vx, top);
    const sw = Math.sin(S.t * 1.5 + ph) * 4;
    ctx.bezierCurveTo(vx + 14 + sw, top + (bottom - top) * 0.3, vx - 14 - sw, top + (bottom - top) * 0.65, vx + sw, bottom);
    ctx.stroke();
    if (!cut) {
      ctx.fillStyle = '#4fae46';
      for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.ellipse(vx + (k - 1) * 6, top + (bottom - top) * (0.3 + k * 0.25), 5, 2.5, k, 0, 7); ctx.fill(); }
    }
  }
  if (v.prog < 1) { // dense undergrowth at the base
    ctx.fillStyle = 'rgba(40,110,40,0.9)';
    ctx.beginPath(); ctx.ellipse(x + v.w / 2, GROUND - 14, v.w / 2 * (1 - v.prog * 0.8) + 4, 26 * (1 - v.prog * 0.7), 0, Math.PI, 0); ctx.fill();
  }
}
function drawBushes() {
  const cols = ['rgba(52,120,50,0.92)', 'rgba(70,140,60,0.92)', 'rgba(40,100,45,0.92)'];
  for (const b of deco.bushes) {
    const x = b.x - camX; if (x < -60 || x > viewW + 60) continue;
    const gy = groundBase(b.x) + 6;
    ctx.fillStyle = cols[b.c];
    ctx.beginPath();
    ctx.ellipse(x, gy - 8 * b.s, 22 * b.s, 13 * b.s, 0, 0, 7);
    ctx.ellipse(x + 15 * b.s, gy - 4 * b.s, 15 * b.s, 10 * b.s, 0, 0, 7);
    ctx.ellipse(x - 14 * b.s, gy - 3 * b.s, 13 * b.s, 9 * b.s, 0, 0, 7);
    ctx.fill();
  }
}
function drawCanopy() {
  const cols = ['rgba(46,125,50,0.88)', 'rgba(67,160,71,0.86)', 'rgba(30,100,40,0.9)', 'rgba(102,187,106,0.82)'];
  for (const b of deco.blobs) {
    const x = b.x - camX; if (x < -80 || x > viewW + 80) continue;
    ctx.fillStyle = cols[b.c];
    const sw = Math.sin(S.t * 0.8 + b.x) * 2;
    ctx.beginPath(); ctx.ellipse(x + sw, b.y, b.rad, b.rad * 0.62, 0, 0, 7); ctx.fill();
  }
  // leafy highlight along the top edge
  ctx.fillStyle = 'rgba(150,215,120,0.55)';
  for (const b of deco.blobs) {
    const x = b.x - camX; if (x < -80 || x > viewW + 80 || b.y > CANOPY_TOP + 45) continue;
    ctx.beginPath(); ctx.ellipse(x - b.rad * 0.2, b.y - b.rad * 0.3, b.rad * 0.45, b.rad * 0.2, 0, 0, 7); ctx.fill();
  }
}

function drawLeader() {
  const L = S.leader, x = L.x - camX, y = L.y;
  const flap = Math.sin(S.t * 5) * 14;
  ctx.save(); ctx.translate(x, y);
  if (S.selected === 'leader') ring(0, 0, 40, '#ffd34d');
  ctx.fillStyle = '#6b4423';
  ctx.beginPath(); ctx.moveTo(-4, 0); ctx.quadraticCurveTo(-26, -10 - flap, -52, -4 - flap * 1.4); ctx.quadraticCurveTo(-30, 4, -4, 6); ctx.fill();
  ctx.beginPath(); ctx.moveTo(4, 0); ctx.quadraticCurveTo(26, -10 - flap, 52, -4 - flap * 1.4); ctx.quadraticCurveTo(30, 4, 4, 6); ctx.fill();
  ctx.fillStyle = '#7a4f2a'; ctx.beginPath(); ctx.ellipse(0, 2, 10, 18, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#5a3a1e'; ctx.beginPath(); ctx.moveTo(-7, 16); ctx.lineTo(0, 28); ctx.lineTo(7, 16); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, -14, 8, 0, 7); ctx.fill();
  ctx.fillStyle = '#f2b233'; ctx.beginPath(); ctx.moveTo(-3, -11); ctx.lineTo(0, -4); ctx.lineTo(3, -11); ctx.fill();
  ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(-3, -16, 1.4, 0, 7); ctx.arc(3, -16, 1.4, 0, 7); ctx.fill();
  ctx.restore();
  tag(x, y - 34, 'LEADER', '#ffd34d');
}
function drawManager() {
  const M = S.mgr, x = M.x - camX, y = M.y;
  // scouting spotlight cone, reaching down and ahead
  ctx.fillStyle = M.alert > 0 ? 'rgba(255,140,90,0.16)' : 'rgba(255,255,200,0.10)';
  ctx.beginPath(); ctx.moveTo(x + 10, y + 6); ctx.lineTo(x + 250, GROUND - 120); ctx.lineTo(x + 230, GROUND + 6); ctx.lineTo(x + 40, GROUND + 6); ctx.closePath(); ctx.fill();
  const flap = Math.sin(S.t * 12) * 8;
  ctx.save(); ctx.translate(x, y);
  if (S.selected === 'manager') ring(0, 0, 36, '#c792ff');
  ctx.fillStyle = '#7b5a8c';
  ctx.beginPath(); ctx.moveTo(-10, 0); ctx.quadraticCurveTo(-28, -8 - flap, -36, 4 - flap); ctx.quadraticCurveTo(-24, 10, -10, 10); ctx.fill();
  ctx.beginPath(); ctx.moveTo(10, 0); ctx.quadraticCurveTo(28, -8 - flap, 36, 4 - flap); ctx.quadraticCurveTo(24, 10, 10, 10); ctx.fill();
  ctx.fillStyle = '#9b74ad'; ctx.beginPath(); ctx.ellipse(0, 2, 15, 18, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#e8d8c0'; ctx.beginPath(); ctx.ellipse(0, 8, 9, 10, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#7b5a8c'; ctx.beginPath(); ctx.moveTo(-13, -12); ctx.lineTo(-10, -22); ctx.lineTo(-4, -14); ctx.fill();
  ctx.beginPath(); ctx.moveTo(13, -12); ctx.lineTo(10, -22); ctx.lineTo(4, -14); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-6, -6, 6, 0, 7); ctx.arc(6, -6, 6, 0, 7); ctx.fill();
  ctx.fillStyle = '#ffb000'; ctx.beginPath(); ctx.arc(-6 + 1.5, -6, 3.4, 0, 7); ctx.arc(6 + 1.5, -6, 3.4, 0, 7); ctx.fill();
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(-6 + 2, -6, 1.6, 0, 7); ctx.arc(6 + 2, -6, 1.6, 0, 7); ctx.fill();
  ctx.fillStyle = '#e8a33a'; ctx.beginPath(); ctx.moveTo(-2, 0); ctx.lineTo(0, 5); ctx.lineTo(2, 0); ctx.fill();
  // headset antenna
  ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(12, -14); ctx.lineTo(18, -26); ctx.stroke();
  ctx.fillStyle = settings.comms ? '#5dff8a' : '#ff5d5d'; ctx.beginPath(); ctx.arc(18, -27, 2.6, 0, 7); ctx.fill();
  ctx.restore();
  if (M.alert > 0) { ctx.fillStyle = '#ff7043'; ctx.font = 'bold 22px sans-serif'; ctx.fillText('!', x - 4, y - 30); }
  tag(x, y - 42, 'MANAGER', '#c792ff');
}
function drawTeam() {
  const tm = S.team;
  for (let i = 3; i >= 0; i--) {
    let mx = tm.x - i * MEMBER_GAP + (i === 0 ? tm.m0 : 0);
    const lane = laneOffset(mx);
    let gy = memberY(mx) + lane;
    const moving = tm.mode === 'walk' || (tm.seq && tm.seq[tm.step] && tm.seq[tm.step].move != null);
    const ph = S.t * 9 + i * 1.7;
    let bob = moving ? Math.abs(Math.sin(ph)) * 2 : 0;
    if (tm.mood === 'happy') bob = Math.abs(Math.sin(S.t * 6 + i)) * 16;
    const shake = tm.mood === 'stuck' ? Math.sin(S.t * 30 + i) * 1.5 : 0;
    const s = 1.35 * (1 + lane / 120);
    drawMember(mx - camX + shake, gy - bob, s, TEAM_COLORS[i], moving ? Math.sin(ph) : 0, tm.mood, i);
  }
  const p = agentPos('team');
  if (tm.mood === 'confused') { ctx.fillStyle = '#fff'; ctx.font = 'bold 18px sans-serif'; ctx.fillText('?', p.x - camX + 46 + Math.sin(S.t * 3) * 4, p.y - 8); }
  if (S.selected === 'team') ring(p.x - camX, p.y + 12, 58, '#5dd3ff');
  tag(p.x - camX, p.y - 26, 'TEAM', '#5dd3ff');
}
function drawMember(x, y, s, col, swing, mood, i) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  // legs
  ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(-5 * swing - 2, 0); ctx.moveTo(0, -12); ctx.lineTo(5 * swing + 2, 0); ctx.stroke();
  // body
  ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-6, -27, 12, 16, 4) : ctx.rect(-6, -27, 12, 16); ctx.fill();
  // backpack
  ctx.fillStyle = '#6d5a3a'; ctx.fillRect(-10, -25, 5, 11);
  // arms + tool
  ctx.strokeStyle = '#f0c8a0'; ctx.lineWidth = 2.5;
  let arm = mood === 'work' ? Math.sin(S.t * 14 + i) * 0.9 : (mood === 'happy' ? -2.2 : swing * 0.5);
  ctx.beginPath(); ctx.moveTo(2, -24); ctx.lineTo(2 + Math.sin(arm + 0.6) * 10, -24 + Math.cos(arm + 0.6) * 10); ctx.stroke();
  if (mood === 'work') {
    ctx.strokeStyle = '#bbb'; ctx.lineWidth = 2;
    const hx = 2 + Math.sin(arm + 0.6) * 10, hy = -24 + Math.cos(arm + 0.6) * 10;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + Math.sin(arm + 1.4) * 9, hy + Math.cos(arm + 1.4) * 9); ctx.stroke();
  }
  if (mood === 'happy') { ctx.beginPath(); ctx.moveTo(-2, -24); ctx.lineTo(-10, -36); ctx.stroke(); }
  // head + hat
  ctx.fillStyle = '#f0c8a0'; ctx.beginPath(); ctx.arc(0, -33, 6, 0, 7); ctx.fill();
  ctx.fillStyle = '#c9a36b'; ctx.beginPath(); ctx.ellipse(0, -37, 9, 2.5, 0, 0, 7); ctx.fill(); ctx.fillRect(-5, -43, 10, 6);
  ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(2.5, -33, 1, 0, 7); ctx.fill();
  ctx.restore();
}
function ring(x, y, r, col) {
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.setLineDash([6, 5]); ctx.lineDashOffset = -S.t * 20;
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke(); ctx.restore();
}
function tag(x, y, text, col) {
  ctx.font = 'bold 10px system-ui, sans-serif';
  const w = ctx.measureText(text).width + 10;
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; rr(x - w / 2, y - 9, w, 14, 7); ctx.fill();
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.fillText(text, x, y + 1.5); ctx.textAlign = 'left';
}
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

function drawBeam() {
  const L = S.leader; if (!L.beam) return;
  const lx = L.x - camX, ly = L.y;
  const tx = (L.beam === 'goal' ? GOAL_X : START_X) - camX, ty = L.beam === 'goal' ? PYR_APEX + 6 : CANOPY_TOP + 10;
  const a = Math.min(1, L.beamT) * 0.8;
  ctx.save(); ctx.strokeStyle = `rgba(255,211,77,${a})`; ctx.lineWidth = 3; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -S.t * 40;
  ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(tx, ty); ctx.stroke(); ctx.restore();
  // if the target is off-screen, show an arrow at the edge
  if (tx > viewW - 10 || tx < 10) {
    const ex = tx > viewW ? viewW - 70 : 70;
    ctx.fillStyle = `rgba(0,0,0,${a * 0.6})`; rr(ex - 58, 18, 116, 26, 13); ctx.fill();
    ctx.fillStyle = `rgba(255,211,77,${a + 0.2})`; ctx.font = 'bold 13px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(L.beam === 'goal' ? 'Pyramid  ➜' : '⬅  Start', ex, 36); ctx.textAlign = 'left';
  }
}
function drawPulses() {
  for (const p of S.pulses) {
    const a = agentPos(p.from), b = agentPos(p.to);
    const t = p.t / p.dur;
    const ax = a.x - camX, bx = b.x - camX;
    ctx.save(); ctx.strokeStyle = p.color; ctx.globalAlpha = 0.35; ctx.lineWidth = 2; ctx.setLineDash([3, 6]);
    ctx.beginPath(); ctx.moveTo(ax, a.y); ctx.lineTo(bx, b.y); ctx.stroke(); ctx.restore();
    for (let k = 0; k < 3; k++) {
      const tt = t - k * 0.08; if (tt < 0) continue;
      const x = lerp(ax, bx, tt), y = lerp(a.y, b.y, tt);
      ctx.strokeStyle = p.color; ctx.globalAlpha = 1 - k * 0.3; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, 7 + k * 5 + Math.sin(S.t * 10) * 2, 0, 7); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}
function drawBubbles() {
  const cols = { leader: ['#fff7d6', '#b08a00'], manager: ['#f3e8ff', '#7b3fb0'], team: ['#e3f6ff', '#1f6f9f'] };
  ctx.font = '600 13px system-ui, sans-serif';
  for (const b of S.bubbles) {
    const p = agentPos(b.who);
    if (p.x - camX < -30 || p.x - camX > viewW + 30) continue; // speaker is off-screen
    const a = Math.min(1, b.t * 4, (b.dur - b.t) * 3);
    const w = ctx.measureText(b.text).width + 20, h = 26;
    let x = clamp(p.x - camX - w / 2, 6, viewW - w - 6);
    let y = p.y - (b.who === 'team' ? 62 : 58) - h;
    if (b.who === 'leader') y = Math.max(4, y + 2);
    ctx.globalAlpha = a;
    ctx.fillStyle = cols[b.who][0]; ctx.strokeStyle = cols[b.who][1]; ctx.lineWidth = 2;
    rr(x, y, w, h, 10); ctx.fill(); ctx.stroke();
    const tx = clamp(p.x - camX, x + 12, x + w - 12);
    ctx.beginPath(); ctx.moveTo(tx - 6, y + h - 1); ctx.lineTo(tx, y + h + 9); ctx.lineTo(tx + 6, y + h - 1); ctx.fill();
    ctx.fillStyle = '#222'; ctx.fillText(b.text, x + 10, y + 17.5);
    ctx.globalAlpha = 1;
  }
}
function drawParticles() {
  for (const p of S.particles) {
    ctx.save(); ctx.translate(p.x - camX, p.y); ctx.rotate(p.r);
    ctx.fillStyle = p.c; ctx.globalAlpha = Math.min(1, p.life); ctx.fillRect(-3, -2, 6, 4); ctx.restore();
  }
}

// Perspective fog: everything a role cannot see is hidden under fog.
function drawFog() {
  const v = settings.view; if (v === 'all') return;
  const W = canvas.width, Hh = canvas.height;
  if (fog.width !== W || fog.height !== Hh) { fog.width = W; fog.height = Hh; }
  fctx.setTransform(1, 0, 0, 1, 0, 0);
  fctx.globalCompositeOperation = 'source-over';
  fctx.clearRect(0, 0, W, Hh);
  fctx.setTransform(scale, 0, 0, scale, 0, 0);
  const color = { leader: 'rgba(24,64,32,0.93)', manager: 'rgba(205,220,210,0.93)', team: 'rgba(10,22,14,0.95)' }[v];
  fctx.fillStyle = color; fctx.fillRect(0, 0, viewW, H);
  fctx.globalCompositeOperation = 'destination-out';
  if (v === 'leader') {
    const g = fctx.createLinearGradient(0, CANOPY_BOTTOM - 70, 0, CANOPY_BOTTOM + 10);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    fctx.fillStyle = g; fctx.fillRect(0, 0, viewW, CANOPY_BOTTOM + 10);
  } else if (v === 'manager') {
    const cx = S.mgr.x - camX + 120, cy = 400;
    fctx.save(); fctx.translate(cx, cy); fctx.scale(2.3, 1);
    const g = fctx.createRadialGradient(0, 0, 60, 0, 0, 230);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.75, 'rgba(0,0,0,0.95)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    fctx.fillStyle = g; fctx.beginPath(); fctx.arc(0, 0, 230, 0, 7); fctx.fill(); fctx.restore();
  } else if (v === 'team') {
    const p = agentPos('team');
    const g = fctx.createRadialGradient(p.x - camX, p.y + 10, 40, p.x - camX, p.y + 10, 190);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.6, 'rgba(0,0,0,0.9)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    fctx.fillStyle = g; fctx.beginPath(); fctx.arc(p.x - camX, p.y + 10, 190, 0, 7); fctx.fill();
  }
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(fog, 0, 0); ctx.restore();
}
function drawViewBanner() {
  const v = settings.view; if (v === 'all') return;
  const text = {
    leader: '🦅 LEADER VIEW: sees the start and the goal, but not the ground',
    manager: '🦉 MANAGER VIEW: sees the obstacles ahead, but not the far-off goal',
    team: '🧑‍🤝‍🧑 TEAM VIEW: sees only what\'s right in front of them',
  }[v];
  ctx.font = 'bold 14px system-ui, sans-serif';
  const w = ctx.measureText(text).width + 24;
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; rr(12, H - 40, w, 28, 14); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillText(text, 24, H - 21);
}
function drawMiniMap() {
  if (settings.view === 'team' || settings.view === 'manager') return;
  const w = 260, h = 34, x = 12, y = 12, k = (w - 20) / WORLD_W;
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; rr(x, y, w, h, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = '#2e7d32'; ctx.fillRect(x + 10, y + 20, w - 20, 4);
  ctx.font = '11px sans-serif';
  ctx.fillText('🏁', x + 10 + START_X * k - 6, y + 17);
  for (const o of S.obstacles) {
    ctx.globalAlpha = o.done ? 0.35 : 1; ctx.fillText(o.icon, x + 10 + o.x * k - 6, y + 17); ctx.globalAlpha = 1;
  }
  ctx.fillText('🔺', x + 10 + GOAL_X * k - 6, y + 17);
  const dot = (wx, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x + 10 + wx * k, y + 22, 3.5, 0, 7); ctx.fill(); };
  dot(S.team.x, '#1f8fd0'); dot(S.mgr.x, '#9b59d0'); dot(S.leader.x, '#d4a000');
  // camera window
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.strokeRect(x + 10 + camX * k, y + 4, viewW * k, h - 8);
}

function render() {
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  drawSky();
  drawUnderstory();
  drawTrunks();
  drawPyramid();
  drawHangingVines();
  drawRiver(false);
  drawGround();
  drawStartCamp();
  drawBoulder();
  drawCliff();
  drawVineThicket();
  drawTeam();
  drawRiver(true);
  drawBushes();
  drawManager();
  drawCanopy();
  drawLeader();
  drawFog();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  drawBeam();
  drawPulses();
  drawParticles();
  drawBubbles();
  drawMiniMap();
  drawViewBanner();
}

function frame(ts) {
  raf = requestAnimationFrame(frame);
  const dt = Math.min(0.05, (ts - (lastT || ts)) / 1000);
  lastT = ts;
  if (settings.playing) {
    const sdt = dt * settings.speed;
    // sub-step for stability at high speeds
    const n = Math.ceil(sdt / 0.02) || 1;
    for (let i = 0; i < n; i++) { update(sdt / n); updateCamera(sdt / n); }
  }
  render();
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(320, Math.round(rect.width * dpr));
  canvas.height = Math.max(160, Math.round(rect.height * dpr));
  scale = canvas.height / H;
  viewW = canvas.width / scale;
}

function onClick(ev) {
  const rect = canvas.getBoundingClientRect();
  const sx = (ev.clientX - rect.left) * (canvas.width / rect.width) / scale;
  const sy = (ev.clientY - rect.top) * (canvas.height / rect.height) / scale;
  const wx = sx + camX;
  const near = (p, r) => Math.hypot(p.x - wx, p.y - sy) < r;
  let hit = null;
  if (near(S.leader, 48)) hit = 'leader';
  else if (near(S.mgr, 44)) hit = 'manager';
  else {
    const tx = S.team.x;
    if (wx > tx - MEMBER_GAP * 3 - 16 && wx < tx + 16 && sy > memberY(tx) - 70 && sy < memberY(tx) + 50) hit = 'team';
    else {
      const by = LOW_GROUND, half = PYR_HALF * (sy - PYR_APEX) / (by - PYR_APEX);
      if (sy > PYR_APEX && sy < by && Math.abs(wx - GOAL_X) < half) hit = 'goal';
    }
  }
  S.selected = hit;
  call('OnAgentClicked', hit || '');
}
function onKey(e) {
  if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  if (e.code === 'Space') { e.preventDefault(); settings.playing = !settings.playing; call('OnPlayState', settings.playing); }
  else if (e.key === 'r' || e.key === 'R') { reset(); call('OnRestarted'); }
  else if (['1', '2', '3', '4'].includes(e.key)) { settings.view = ['all', 'leader', 'manager', 'team'][+e.key - 1]; call('OnViewChanged', settings.view); }
}

// ---------- public API (called from Blazor) ----------
export function init(canvasEl, dotnetRef) {
  canvas = canvasEl; ctx = canvas.getContext('2d'); dotnet = dotnetRef;
  fog = document.createElement('canvas'); fctx = fog.getContext('2d');
  deco = buildDeco();
  reset();
  resize();
  ro = new ResizeObserver(resize); ro.observe(canvas);
  canvas.addEventListener('click', onClick);
  window.addEventListener('keydown', onKey);
  lastT = 0; raf = requestAnimationFrame(frame);
  window.aboveTheCanopy = { settings, get state() { return S; }, fastForward };
}
export function setPlaying(p) { settings.playing = !!p; }
export function restart() { reset(); }
export function setSpeed(v) { settings.speed = clamp(+v || 1, 0.1, 5); }
export function setView(v) { settings.view = v; }
export function setComms(on) { settings.comms = !!on; }
export function select(role) { S.selected = role || null; }
export function fastForward(seconds) { const step = 1 / 30; for (let t = 0; t < seconds; t += step) { update(step); updateCamera(step); } render(); }
export function dispose() {
  cancelAnimationFrame(raf);
  if (ro) ro.disconnect();
  if (canvas) canvas.removeEventListener('click', onClick);
  window.removeEventListener('keydown', onKey);
  dotnet = null;
}
