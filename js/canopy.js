// Above the Canopy v2 - animation engine (plain canvas 2D, no dependencies).
// World units: the scene is H = 600 units tall; the canvas is scaled to fit.
// Exported as an ES module and driven from Blazor (Pages/Home.razor) via JS interop.
//
// Story: an eagle Leader above the canopy holds the vision (the pyramid), an owl Manager
// under the canopy scouts obstacles and communicates, and four koalas (the Team) do the
// work on the forest floor: hacking through bushes and solving eight obstacles.

const H = 600;
const WORLD_W = 6000;
const GROUND = 480;          // forest floor (normal level)
const LOW_GROUND = 565;      // forest floor between the cliff (down) and the rock wall (up)
const CANOPY_TOP = 120;
const CANOPY_BOTTOM = 245;
const LEADER_Y = 68;
const MANAGER_Y = 320;
const START_X = 120;
const GOAL_X = 5560;         // pyramid centre
const PYR_HALF = 230;
const PYR_APEX = 52;
const MEMBER_GAP = 36;
const KOALA_SCALE = 1.45;
const WALK_SPEED_INFORMED = 46;
const WALK_SPEED_UNINFORMED = 42;
const TEAM_COLORS = ['#f28c28', '#3f8fe8', '#f2c233', '#9b59d0']; // hard hats / bandanas

// Obstacle layout, in path order. Distinct problems, distinct solutions.
const OB_DEFS = [
  { type: 'vines',   x: 640,  w: 110, name: 'tangle of vines',  icon: '🌿' },
  { type: 'boulder', x: 1150, w: 120, name: 'giant boulder',    icon: '🪨' },
  { type: 'river',   x: 1760, w: 190, name: 'fast river',       icon: '🌊' },
  { type: 'bog',     x: 2340, w: 210, name: 'smelly bog',       icon: '🟫' },
  { type: 'log',     x: 2950, w: 170, name: 'fallen giant log', icon: '🪵' },
  { type: 'cliff',   x: 3560, w: 60,  name: 'cliff edge',       icon: '⛰️' },
  { type: 'bees',    x: 4150, w: 120, name: 'bees\' nest',      icon: '🐝' },
  { type: 'wall',    x: 4760, w: 44,  name: 'rock wall',        icon: '🧗' },
];
const defOf = type => OB_DEFS.find(o => o.type === type);

// Workplace distractions for the Leader and Manager, triggered by how far the team has got.
const DISTRACTIONS = [
  { who: 'leader', kind: 'magpie', atX: 880,
    say: 'Argh! Swooping magpies! 🐦', say2: 'Not the eyes, not the eyes!',
    cap: 'Distraction! A magpie swoops the Leader. (Every Aussie knows that feeling.)',
    refocus: 'Shake it off. Eyes on the pyramid. 🔺' },
  { who: 'manager', kind: 'meeting', atX: 1450,
    say: '📅 Meeting request: "Sync about the sync"', say2: 'Ugh, another meeting...',
    cap: 'Distraction! Mid-flight, the Manager gets yet another meeting request.',
    refocus: 'Declined. Back to the team. ✅' },
  { who: 'leader', kind: 'email', atX: 2640,
    say: '📧 URGENT!!! Reply-all chain (47 new)', say2: 'Is it actually urgent though?',
    cap: 'Distraction! An "urgent" email storm floods the Leader\'s inbox.',
    refocus: 'That can wait. Back to the vision. 🔺' },
  { who: 'manager', kind: 'mosquito', atX: 3300,
    say: 'Bzzz! Mozzies everywhere! 🦟', say2: 'Shoo! SHOO!',
    cap: 'Distraction! A cloud of mozzies swarms the Manager.',
    refocus: 'Swatted. Back to scouting. 🔍' },
  { who: 'leader', kind: 'storm', atX: 4420,
    say: 'Whoa! What a wind gust! 🌬️', say2: 'Hold on... hold on...',
    cap: 'Distraction! A storm front blows in and a gust knocks the Leader off course.',
    refocus: 'Steady. Back on course for the pyramid. 🔺' },
  { who: 'manager', kind: 'branch', atX: 5000,
    say: 'Oof! Snagged in the branches! 🌿', say2: 'Who put this vine here?!',
    cap: 'Distraction! The Manager flies into a snag of branches and vines.',
    refocus: 'Untangled. Back to guiding the team. ✅' },
];

const LEADER_TALK = [
  ['Keep heading for the pyramid! 🔺', 'On it, still bearing east. 👍'],
  ['How are the koalas going?', 'Steady progress, boss. Hacking through!'],
  ['Remember why we\'re doing this!', 'I\'ll remind the team. 📣'],
  ['Any blockers I can help with?', 'All handled for now, thanks!'],
  ['We\'re over halfway. Stay focused!', 'Copy that. 🧭'],
];
const MANAGER_CHECKIN = [
  ['How\'s everyone going down there?', 'Hacking away! 🌿'],
  ['Water break at the next clearing!', 'Yes please! 💧'],
  ['Great pace, team. Keep it up!', 'Cheers! 😊'],
  ['Watch your footing, it\'s slippery.', 'Thanks for the heads-up!'],
  ['Path bends right past the big gum tree.', 'Got it, right at the gum! 🌳'],
];
const LONELY = ['Is anyone up there? 😕', 'Are we even going the right way?', 'Which way now? 🤔', 'Nobody tells us anything...'];
const RECOGNITION = ['Great work, koalas! 🦅', 'Brilliant teamwork!', 'That\'s how it\'s done!', 'So proud of this team!'];
const CHEERS = ['Woohoo! 🎉', 'Teamwork! 🤝', 'Nailed it! 😎', 'Easy as! 🐨', 'Too easy!'];
const BUSH_LINES = [
  'Between the big obstacles, the koalas hack through bush after bush: the everyday work nobody up top sees.',
  'Hack, step, hack... most of a team\'s day is this steady, constant work.',
  'Little bushes, again and again. Small daily problems the team just quietly solves.',
  'The everyday grind: no drama, just effort. It\'s what moves the team forward.',
];

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
const pick = (arr, i) => arr[((i % arr.length) + arr.length) % arr.length];
function rng(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
function call(method, ...args) { try { dotnet && dotnet.invokeMethodAsync(method, ...args); } catch (e) { /* ignore */ } }
function inZone(x, pad, types) {
  return OB_DEFS.some(o => (!types || types.includes(o.type)) && x > o.x - pad && x < o.x + o.w + pad);
}

// ---------- world ----------
function makeObstacles() {
  return OB_DEFS.map(o => Object.assign({}, o, { prog: 0, spotted: false, informed: false, done: false, active: false, angry: 0, route: false }));
}
const ob = type => S.obstacles.find(o => o.type === type);

function buildDeco() {
  const r = rng(42);
  const d = { trunks: [], blobs: [], hang: [], bushes: [], far: [], clouds: [], tufts: [], shafts: [] };
  for (let x = 20; x < WORLD_W; x += 70 + r() * 70) {
    if (Math.abs(x - GOAL_X) < PYR_HALF + 30) continue;
    if (inZone(x, 20, ['river', 'bog', 'cliff', 'wall', 'log'])) continue;
    d.trunks.push({ x, w: 16 + r() * 20, shade: r() });
  }
  for (let x = -60; x < WORLD_W + 60; x += 22 + r() * 18) {
    d.blobs.push({ x, y: CANOPY_TOP + 18 + r() * (CANOPY_BOTTOM - CANOPY_TOP - 30), rad: 34 + r() * 30, c: Math.floor(r() * 4) });
  }
  for (let x = 0; x < WORLD_W; x += 40 + r() * 60) d.hang.push({ x, len: 50 + r() * 120, ph: r() * 6 });
  for (let x = 0; x < WORLD_W; x += 45 + r() * 55) {
    if (inZone(x, 10, ['river', 'bog', 'log', 'wall'])) continue;
    if (Math.abs(x - GOAL_X) < PYR_HALF) continue;
    d.bushes.push({ x, s: 0.7 + r() * 0.6, c: Math.floor(r() * 3) });
  }
  for (let x = 0; x < WORLD_W * 0.5 + 1500; x += 40 + r() * 50) d.far.push({ x, h: 140 + r() * 160, w: 30 + r() * 30 });
  for (let i = 0; i < 12; i++) d.clouds.push({ x: r() * 2400, y: 20 + r() * 60, s: 0.6 + r() * 0.8 });
  for (let x = 0; x < WORLD_W; x += 9 + r() * 14) d.tufts.push({ x, h: 4 + r() * 8 });
  for (let x = 100; x < WORLD_W; x += 260 + r() * 260) d.shafts.push({ x, w: 30 + r() * 40 });
  return d;
}

// Small bushes right on the path: the team's constant everyday work.
function makePathBushes() {
  const r = rng(99), list = [];
  for (let x = 360; x < GOAL_X - PYR_HALF - 90; x += 115 + r() * 80) {
    if (inZone(x, 110)) continue;
    list.push({ x, hp: 1, cut: false, s: 0.85 + r() * 0.3 });
  }
  return list;
}

function groundBase(x) {
  const c = defOf('cliff'), w = defOf('wall');
  if (x < c.x) return GROUND;
  if (x <= c.x + c.w) return lerp(GROUND, LOW_GROUND, (x - c.x) / c.w);
  if (x < w.x) return LOW_GROUND;
  if (x <= w.x + w.w) return lerp(LOW_GROUND, GROUND, (x - w.x) / w.w);
  return GROUND;
}
function memberY(x) {
  const r = ob('river');
  if (x > r.x && x < r.x + r.w) return r.prog >= 1 ? GROUND - 6 : GROUND + 30;
  const b = ob('bog');
  if (x > b.x && x < b.x + b.w) {
    if (b.prog < 1) return GROUND + 24; // sinking
    const seg = b.w / 6;
    return GROUND - 2 - Math.abs(Math.sin(Math.PI * (x - b.x) / seg)) * 14; // hop stone to stone
  }
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
    pathBushes: makePathBushes(),
    distractions: DISTRACTIONS.map(d => Object.assign({ done: false }, d)),
    team: { x: START_X + 70, mode: 'idle', seq: null, step: 0, stepT: 0, stepStartX: 0, mood: '', m0: 0, m0y: 0,
      wrong: 0, surprises: 0, distractions: 0, cheer: 0, bush: null, hackT: 0, bushesCut: 0, cleared: 0 },
    mgr: { x: START_X + 140, y: MANAGER_Y, alert: 0, ready: false, ox: 0, oy: 0, rot: 0, dist: null, focusT: 0 },
    leader: { x: START_X + 260, y: LEADER_Y, beam: null, beamT: 0, ox: 0, oy: 0, rot: 0, dist: null },
    bubbles: [], queue: { leader: [], manager: [], team: [] }, pulses: [], events: [], particles: [],
    caption: '', phase: '', capT: 0, finished: false, introCam: 'start', selected: null,
    nextLeaderTalk: 26, leaderTalkI: 0, nextCheckin: 34, checkinI: 0,
  };
  camX = camTarget = 0;
  call('OnRestarted');
  scheduleIntro();
}

function stats() { const t = S.team; call('OnStats', t.wrong, t.surprises, t.distractions); }
function later(delay, fn) { S.events.push({ at: S.t + delay, fn }); }
function caption(text, phase) {
  S.caption = text; S.capT = S.t; if (phase) S.phase = phase;
  call('OnCaption', text, S.phase);
}
// Speech bubbles: one per speaker on screen at a time; extra lines queue up so nothing overlaps or gets lost.
const MIN_SHOW = 1.6;
function bubble(who, text, dur = 3.2, priority = false) {
  if (priority) { S.queue[who] = []; showBubble(who, text, dur); return; }
  const cur = S.bubbles.find(b => b.who === who);
  if (cur && cur.t < MIN_SHOW) {
    const q = S.queue[who];
    if (q.length >= 3) q.shift();
    q.push({ text, dur });
    return;
  }
  showBubble(who, text, dur);
}
function showBubble(who, text, dur) {
  S.bubbles = S.bubbles.filter(b => b.who !== who);
  S.bubbles.push({ who, text, t: 0, dur });
}
function pulse(from, to, color, onArrive, dur = 1.3) { S.pulses.push({ from, to, color, onArrive, t: 0, dur }); }
const PULSE_COL = { leader: '#ffd34d', manager: '#c792ff', team: '#5dd3ff' };
// A message that travels: speaker says it, a pulse carries it, the listener replies.
function say(from, to, text, reply, onArrive) {
  bubble(from, text, 3);
  pulse(from, to, PULSE_COL[from], () => { if (reply) bubble(to, reply, 2.8); onArrive && onArrive(); });
}

function agentPos(who) {
  if (who === 'leader') return { x: S.leader.x + S.leader.ox, y: S.leader.y + S.leader.oy };
  if (who === 'manager') return { x: S.mgr.x + S.mgr.ox, y: S.mgr.y + S.mgr.oy };
  const tx = S.team.x;
  return { x: tx - MEMBER_GAP * 1.5, y: memberY(tx) - 62 + laneOffset(tx) };
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
    say('leader', 'manager', 'Head east to the pyramid.', 'Got it. I\'ll scout a route.', () => {
      caption('The Manager turns the vision into a plan, flying ahead under the canopy to scout the way.', 'Planning');
      S.mgr.ready = true;
      later(1.4, kickOffTeam);
    });
  });
}

function kickOffTeam() {
  if (settings.comms) {
    say('manager', 'team', 'Koalas: east to the pyramid! I\'ll warn you about hazards.', 'East it is! Machetes out! 🐨💪', () => {
      S.team.mode = 'walk';
      caption('The koalas set off on the forest floor. Down here they can only see a few metres ahead.', 'Execution');
    });
  } else {
    caption('Communication is OFF: the koalas never hear the plan, so they don\'t even know which way to go.', 'Execution');
    runSeq([
      { dur: 2.2, cap: 'Which way? The koalas argue and wander west first...', mood: 'confused', move: -60, wrong: true, say: 'Which way?? 🤔' },
      { dur: 2.0, mood: 'confused', move: 60, say: 'Hmm, maybe this way...' },
    ], null);
  }
}

// ---------- obstacle sequences ----------
// Each obstacle has an "informed" script (the manager warned them) and an "uninformed" one (comms OFF).
// Step fields: dur, cap (caption), say (team bubble), mood, move (dx over the step), prog (advance the
// obstacle's build/clear progress), m0/m0y (front koala offsets), ask ([team request, manager reply]),
// wrong / surprise (counters), onStart.
function sequenceFor(o, informed) {
  switch (o.type) {
    case 'vines': return informed ? [
      { dur: 0.6, mood: 'work', cap: 'Warned about the vines, the koalas arrive with machetes ready and hack a path straight through.', say: 'Machetes out! 🔪' },
      { dur: 2.6, mood: 'work', prog: true },
    ] : [
      { dur: 1.6, mood: 'stuck', cap: 'Nobody warned them: the koalas walk into a tangle of vines and get stuck!', say: 'We\'re stuck! 😩', surprise: true },
      { dur: 1.8, mood: 'confused', move: -70, wrong: true, cap: 'Someone runs back to camp for a bigger machete...' },
      { dur: 1.6, mood: 'walk', move: 70 },
      { dur: 3.4, mood: 'work', prog: true, cap: 'Finally, they start hacking through the vines.' },
    ];
    case 'boulder': return informed ? [
      { dur: 0.4, mood: 'walk', cap: 'Thanks to the Manager\'s heads-up, the koalas veer around the boulder early.', say: 'Around the left side! ↪', onStart: () => { o.route = true; } },
      { dur: 3.0, mood: 'walk', move: o.w + 90 },
    ] : [
      { dur: 1.2, mood: 'stuck', cap: 'BONK! The koalas walk straight into a giant boulder.', say: 'Ouch! A boulder?! 💥', surprise: true },
      { dur: 2.2, mood: 'work', cap: 'They try to push it out of the way. It doesn\'t budge.', say: 'Push! PUSH!' },
      { dur: 2.0, mood: 'confused', move: -90, wrong: true, cap: 'Wrong turn: they back-track looking for another way.', say: 'Which way now? 🤷' },
      { dur: 1.6, mood: 'walk', move: 90, onStart: () => { o.route = true; } },
      { dur: 3.4, mood: 'walk', move: o.w + 90, cap: 'At last they find the way around.' },
    ];
    case 'river': return informed ? [
      { dur: 0.6, mood: 'work', cap: 'The Manager spotted the river early, so the koalas brought logs and build a bridge.', say: 'Logs ready, build the bridge! 🪵' },
      { dur: 3.4, mood: 'work', prog: true, ask: ['Need two more logs!', 'More logs on the left bank! 🪵'] },
    ] : [
      { dur: 1.0, mood: 'confused', cap: 'A river! Nobody saw it coming.', say: 'A river?! 😮', surprise: true },
      { dur: 1.8, mood: 'stuck', m0: p => Math.sin(Math.PI * p) * 60, cap: 'SPLASH! One brave koala tries to wade across. Far too deep!', say: 'Too deep! 💦' },
      { dur: 2.4, mood: 'confused', move: -110, wrong: true, cap: 'The koalas scramble back into the forest to hunt for logs...' },
      { dur: 2.0, mood: 'walk', move: 110 },
      { dur: 4.2, mood: 'work', prog: true, cap: '...and slowly build a bridge by trial and error.' },
    ];
    case 'bog': return informed ? [
      { dur: 0.6, mood: 'work', cap: 'The Manager mapped the firm spots in the bog. The koalas drop stepping stones and hop across.', say: 'Stones here, here and here! 🪨' },
      { dur: 2.8, mood: 'work', prog: true, ask: ['Pass more stones down the line!', 'Big flat ones are by the fern! 👍'] },
    ] : [
      { dur: 1.0, mood: 'confused', cap: 'Squelch! A smelly bog nobody mentioned.', say: 'Ew, a bog?! 🤢', surprise: true },
      { dur: 2.0, mood: 'stuck', m0: p => Math.sin(Math.PI * p) * 50, cap: 'One koala steps in and sinks up to its tummy!', say: 'Help, I\'m sinking! 😱' },
      { dur: 2.2, mood: 'confused', move: -90, wrong: true, cap: 'They retreat to hunt for rocks...', say: 'Which way now? 🤔' },
      { dur: 1.8, mood: 'walk', move: 90 },
      { dur: 3.8, mood: 'work', prog: true, cap: '...and test every wobbly stepping stone one at a time.' },
    ];
    case 'log': return informed ? [
      { dur: 0.6, mood: 'work', cap: 'Warned about the fallen giant log, the koalas head straight for its hollow and crawl through.', say: 'Through the hollow! 🪵' },
      { dur: 1.8, mood: 'work', prog: true, cap: 'A quick sweep of the cobwebs and they\'re in.' },
    ] : [
      { dur: 1.2, mood: 'stuck', cap: 'A giant fallen log blocks the path!', say: 'It\'s HUGE! 😧', surprise: true },
      { dur: 2.2, mood: 'work', m0y: p => -Math.sin(Math.PI * p) * 46, cap: 'They try to climb over it... and slide right back down.', say: 'Too slippery! 😵' },
      { dur: 2.4, mood: 'confused', move: -100, wrong: true, cap: 'Wrong turn: they trek back along the log looking for an end.', say: 'Is there a way through?' },
      { dur: 1.8, mood: 'walk', move: 100 },
      { dur: 2.6, mood: 'work', prog: true, cap: 'Finally someone spots the hollow and they clear out the cobwebs.' },
    ];
    case 'cliff': return informed ? [
      { dur: 0.6, mood: 'work', cap: 'The Manager found the safe spot to climb down, so the koalas tie off a rope and abseil down the cliff.', say: 'Rope here, as planned! 🪢' },
      { dur: 2.4, mood: 'work', prog: true, ask: ['Need more rope!', 'Rope coming down! 🪢'] },
    ] : [
      { dur: 1.2, mood: 'stuck', cap: 'Dead end! The ground just drops away at a cliff.', say: 'Whoa! A cliff! 😱', surprise: true },
      { dur: 2.4, mood: 'confused', move: -80, wrong: true, cap: 'Wrong turn: they wander along the edge looking for a way down...', say: 'Maybe further back?' },
      { dur: 2.2, mood: 'confused', move: 80, say: 'Nope... back again.' },
      { dur: 3.0, mood: 'work', prog: true, cap: 'Eventually they rig a rope and lower themselves down.' },
    ];
    case 'bees': return informed ? [
      { dur: 0.6, mood: 'sneak', cap: 'The Manager spotted a bees\' nest. The koalas tiptoe underneath in total silence.', say: 'Shhh... tiptoe! 🤫' },
      { dur: 4.0, mood: 'sneak', move: o.w + 90 },
    ] : [
      { dur: 1.0, mood: 'walk', move: 40, cap: 'Chatting loudly, the koalas stomp right under a bees\' nest...', say: 'La la la! 🎵' },
      { dur: 2.0, mood: 'stuck', move: -130, wrong: true, surprise: true, cap: 'BZZZ! The bees attack and the koalas flee back the way they came!', say: 'BEES!! RUN! 🐝', onStart: () => { o.angry = 4; } },
      { dur: 2.0, mood: 'confused', cap: 'They wait for the swarm to calm down...', say: 'Ouch... ouch... ouch.' },
      { dur: 1.6, mood: 'walk', move: 90 },
      { dur: 4.0, mood: 'sneak', move: o.w + 90, cap: 'Lesson learned the hard way: they sneak past quietly.' },
    ];
    case 'wall': return informed ? [
      { dur: 0.6, mood: 'work', cap: 'Warned about the rock wall, the koalas carried a ladder. Up it goes!', say: 'Ladder up! 🪜' },
      { dur: 2.2, mood: 'work', prog: true, ask: ['Can someone steady the top?', 'I\'ve got the top, climb away! 🦉'] },
    ] : [
      { dur: 1.2, mood: 'stuck', cap: 'A sheer rock wall! Nobody brought a ladder.', say: 'How do we get up THAT? 😰', surprise: true },
      { dur: 2.0, mood: 'work', m0y: p => -Math.sin(Math.PI * p) * 46, cap: 'One koala tries to climb with bare paws... and slides back down.', say: 'Whoooa!' },
      { dur: 2.4, mood: 'confused', move: -90, wrong: true, cap: 'They head back into the bush to find sticks...', say: 'Need sticks! Lots of sticks!' },
      { dur: 1.8, mood: 'walk', move: 90 },
      { dur: 3.4, mood: 'work', prog: true, cap: '...and lash together a wobbly ladder.' },
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
  if (st.ask) {
    const [q, a] = st.ask;
    later(0.5, () => {
      if (settings.comms) say('team', 'manager', q, a);
      else bubble('team', q + ' ...hello?', 2.6);
    });
  }
  if (st.wrong) tm.wrong++;
  if (st.surprise) tm.surprises++;
  if (st.wrong || st.surprise) stats();
  if (st.onStart) st.onStart();
}
function updateSeq(dt) {
  const tm = S.team, st = tm.seq[tm.step];
  tm.stepT += dt;
  const p = Math.min(1, tm.stepT / st.dur);
  tm.mood = st.mood || '';
  if (st.move != null) tm.x = tm.stepStartX + st.move * ease(p);
  tm.m0 = st.m0 ? st.m0(p) : 0;
  tm.m0y = st.m0y ? st.m0y(p) : 0;
  if (st.prog && tm.seqOb) tm.seqOb.prog = Math.max(tm.seqOb.prog, p);
  if (p >= 1) {
    tm.step++; tm.stepT = 0; tm.stepStartX = tm.x;
    if (tm.step >= tm.seq.length) {
      const o = tm.seqOb;
      tm.seq = null; tm.seqOb = null; tm.mode = 'walk'; tm.mood = ''; tm.m0 = 0; tm.m0y = 0;
      if (o) obstacleCleared(o);
      else caption('Eventually the koalas pick a direction and head off, unsure if it\'s right.', 'Execution');
    } else startStep();
  }
}
function obstacleCleared(o) {
  const tm = S.team;
  o.done = true; o.prog = 1; o.active = false;
  tm.cleared++; tm.cheer = 1.0;
  caption(`${o.name[0].toUpperCase() + o.name.slice(1)} cleared! The koalas push on through the undergrowth.`, 'Execution');
  bubble('team', pick(CHEERS, tm.cleared), 2.2);
  // Manager reports progress up; the Leader recognises the team.
  later(1.0, () => say('manager', 'leader', `${o.icon} ${o.name[0].toUpperCase() + o.name.slice(1)} cleared! ✅`, null, () => {
    if (tm.cleared % 2 === 1 || !settings.comms) bubble('leader', pick(RECOGNITION, tm.cleared >> 1), 2.8);
    else bubble('leader', 'Good progress. Keep going!', 2.4);
    if (settings.comms && tm.cleared % 2 === 1) later(0.6, () => say('manager', 'team', 'The boss says great work! 🌟', 'Thanks boss! 😊'));
  }));
}

// ---------- update ----------
function update(dt) {
  S.t += dt;
  for (const e of S.events.slice()) if (S.t >= e.at) { S.events.splice(S.events.indexOf(e), 1); e.fn(); }
  const tm = S.team, mg = S.mgr, ld = S.leader;
  tm.cheer = Math.max(0, tm.cheer - dt);

  // --- team ---
  if (tm.mode === 'walk') {
    const next = S.obstacles.find(o => !o.done);
    const spd = settings.comms ? WALK_SPEED_INFORMED : WALK_SPEED_UNINFORMED;
    const nx = tm.x + spd * dt;
    const stopX = next ? next.x - 28 : GOAL_X - PYR_HALF - 20;
    const bush = S.pathBushes.find(b => !b.cut && b.x - 22 > tm.x - 1);
    const bushStop = bush ? bush.x - 22 : Infinity;
    tm.mood = '';
    if (bush && bushStop < stopX && nx >= bushStop) {
      tm.x = bushStop; tm.mode = 'hack'; tm.bush = bush; tm.hackT = 0;
    } else if (nx >= stopX) {
      tm.x = stopX;
      if (next) { next.active = true; runSeq(sequenceFor(next, next.informed), next); }
      else finish();
    } else tm.x = nx;
  } else if (tm.mode === 'hack') {
    const dur = settings.comms ? 0.9 : 1.3;
    tm.hackT += dt; tm.mood = 'hack';
    const b = tm.bush;
    b.hp = Math.max(0, 1 - tm.hackT / dur);
    if (Math.random() < dt * 22) leaf(b.x - 4, groundBase(b.x) - 14 - Math.random() * 14);
    if (tm.hackT >= dur) {
      b.cut = true; tm.bush = null; tm.mode = 'walk'; tm.bushesCut++;
      for (let i = 0; i < 6; i++) leaf(b.x, groundBase(b.x) - 12);
      if (tm.bushesCut === 1 || (tm.bushesCut % 4 === 0 && S.t - S.capT > 7)) caption(pick(BUSH_LINES, tm.bushesCut >> 2), 'Everyday work');
      if (tm.bushesCut % 3 === 0 && !S.bubbles.some(x => x.who === 'team')) bubble('team', pick(['Hack! 🌿', 'Another one...', 'Chop chop!', 'Snip snip!', 'Next!'], tm.bushesCut), 1.4);
    }
  } else if (tm.mode === 'seq') updateSeq(dt);

  // --- distractions (triggered by team progress, only between obstacles) ---
  if (!S.finished && (tm.mode === 'walk' || tm.mode === 'hack')) {
    for (const d of S.distractions) {
      const ag = d.who === 'leader' ? ld : mg;
      if (!d.done && tm.x >= d.atX && !ag.dist && mg.ready) { d.done = true; startDistraction(ag, d); }
    }
  }
  updateDistraction(ld, dt);
  updateDistraction(mg, dt);

  // --- manager: flies ahead of the team, scouting ---
  if (mg.ready) {
    const lead = S.finished ? 60 : 300;
    const target = Math.min(tm.x + lead, GOAL_X - 40);
    const nextUnspotted = S.obstacles.find(o => !o.spotted);
    const distracted = mg.dist && mg.dist.phase === 'distract';
    if (!distracted && nextUnspotted && mg.x + 230 >= nextUnspotted.x) spot(nextUnspotted);
    const dx = target - mg.x;
    mg.x += clamp(dx * 1.4 * dt, -140 * dt, 140 * dt);
  }
  mg.alert = Math.max(0, mg.alert - dt);
  mg.focusT = Math.max(0, mg.focusT - dt);
  mg.y = MANAGER_Y + Math.sin(S.t * 2.1) * 8;

  // --- leader: soars above, roughly between team and goal ---
  const base = S.finished ? GOAL_X : clamp(Math.max(tm.x, mg.x) + 180, 300, GOAL_X - 120);
  const lx = base + Math.sin(S.t * 0.45) * 90;
  ld.x += clamp((lx - ld.x) * 1.2 * dt, -150 * dt, 150 * dt);
  ld.y = LEADER_Y + Math.sin(S.t * 1.3) * 10;
  if (ld.beamT > 0) { ld.beamT -= dt; if (ld.beamT <= 0) ld.beam = null; }

  // --- routine communication ---
  if (mg.ready && !S.finished) {
    if (S.t > S.nextLeaderTalk && !ld.dist && !mg.dist) {
      S.nextLeaderTalk = S.t + 19;
      const [a, b] = pick(LEADER_TALK, S.leaderTalkI++);
      ld.beam = 'goal'; ld.beamT = 2.4;
      say('leader', 'manager', a, b);
    }
    if (S.t > S.nextCheckin && !mg.dist && tm.mode !== 'seq') {
      S.nextCheckin = S.t + 21;
      if (settings.comms) { const [a, b] = pick(MANAGER_CHECKIN, S.checkinI++); say('manager', 'team', a, b); }
      else bubble('team', pick(LONELY, S.checkinI++), 2.6);
    }
  }

  // --- bubbles (with per-speaker queue) / pulses / particles ---
  for (const b of S.bubbles) b.t += dt;
  S.bubbles = S.bubbles.filter(b => b.t < b.dur);
  for (const who of ['leader', 'manager', 'team']) {
    const q = S.queue[who]; if (!q.length) continue;
    const cur = S.bubbles.find(b => b.who === who);
    if (!cur || cur.t >= MIN_SHOW) { const n = q.shift(); showBubble(who, n.text, n.dur); }
  }
  for (const p of S.pulses.slice()) {
    p.t += dt;
    if (p.t >= p.dur) { S.pulses.splice(S.pulses.indexOf(p), 1); p.onArrive && p.onArrive(); }
  }
  for (const p of S.particles) {
    if (p.kind === 'leaf') { p.vy += 60 * dt; p.vx *= 0.98; p.x += (p.vx + Math.sin(p.life * 6) * 20) * dt; }
    else { p.vy += 160 * dt; p.x += p.vx * dt; }
    p.y += p.vy * dt; p.r += p.vr * dt; p.life -= dt;
  }
  S.particles = S.particles.filter(p => p.life > 0);
  for (const o of S.obstacles) o.angry = Math.max(0, o.angry - dt);
  if (S.finished && Math.random() < dt * 30) confetti(GOAL_X + (Math.random() - 0.5) * 300, 60 + Math.random() * 60, 1);
}

function startDistraction(ag, d) {
  ag.dist = { def: d, t: 0, phase: 'distract', last: { ox: 0, oy: 0, rot: 0 } };
  caption(d.cap, 'Distraction');
  bubble(d.who, d.say, 2.4, true);
  later(1.8, () => bubble(d.who, d.say2, 1.9, true));
}
const D_DISTRACT = 3.6, D_REFOCUS = 2.0;
function updateDistraction(ag, dt) {
  const d = ag.dist;
  if (!d) { ag.ox = 0; ag.oy = 0; ag.rot = 0; return; }
  d.t += dt;
  const t = S.t;
  if (d.phase === 'distract') {
    const p = Math.min(1, d.t / D_DISTRACT), env = Math.sin(Math.PI * Math.min(1, p * 1.25)) * 0.6 + 0.4 * (p < 0.9 ? 1 : 0);
    let ox = 0, oy = 0, rot = 0;
    switch (d.def.kind) {
      case 'magpie': ox = -40 * env; oy = Math.sin(t * 9) * 10 + 22 * env; rot = Math.sin(t * 8) * 0.28; break;
      case 'email': ox = -60 * env; oy = Math.sin(t * 3) * 5; rot = 0.12 * env; break;
      case 'storm': ox = -150 * Math.sin(Math.PI * p * 0.5); oy = Math.sin(t * 6) * 14; rot = Math.sin(t * 5) * 0.4; break;
      case 'meeting': ox = -70 * env; oy = 6 * env; rot = -0.1 * env; break;
      case 'mosquito': ox = Math.sin(t * 13) * 9; oy = Math.cos(t * 11) * 9; rot = Math.sin(t * 14) * 0.22; break;
      case 'branch': ox = -26 * env; oy = 16 * env; rot = Math.sin(t * 6) * 0.5 * env; break;
    }
    ag.ox = ox; ag.oy = oy; ag.rot = rot; d.last = { ox, oy, rot };
    if (d.t >= D_DISTRACT) {
      d.phase = 'refocus'; d.t = 0;
      bubble(d.def.who, d.def.refocus, 2.6, true);
      if (d.def.who === 'leader') {
        S.leader.beam = 'goal'; S.leader.beamT = 2.4;
        caption('The Leader refocuses on the pyramid. Distractions happen; what matters is getting back to the main objective.', 'Refocus');
      } else {
        S.mgr.focusT = 2.0;
        caption('The Manager shakes off the distraction and gets back to planning and guiding the team.', 'Refocus');
      }
    }
  } else {
    const q = ease(Math.min(1, d.t / D_REFOCUS));
    ag.ox = d.last.ox * (1 - q); ag.oy = d.last.oy * (1 - q); ag.rot = d.last.rot * (1 - q);
    if (d.t >= D_REFOCUS) { ag.dist = null; S.team.distractions++; stats(); }
  }
}

function spot(o) {
  o.spotted = true;
  S.mgr.alert = 2.2;
  bubble('manager', `${o.icon} ${o.name[0].toUpperCase() + o.name.slice(1)} ahead!`, 2.6);
  if (settings.comms) {
    caption(`The Manager spots a ${o.name} ahead and radios a warning down to the koalas.`, 'Communication');
    const advice = {
      vines: ['Heads up: vines ahead, bring machetes!', 'Machetes ready! 🔪'],
      boulder: ['Boulder ahead: go around the left!', 'Left it is! ↪'],
      river: ['River ahead: collect logs for a bridge!', 'Grabbing logs! 🪵'],
      bog: ['Bog ahead: carry flat stones!', 'Stones, check! 🪨'],
      log: ['Big log ahead: there\'s a hollow you can crawl through!', 'Ooh, a tunnel! 🐨'],
      cliff: ['Cliff ahead: rope down at the marked spot!', 'Rope ready! 🪢'],
      bees: ['Bees\' nest ahead: tiptoe quietly!', '(whispering) Okay... 🤫'],
      wall: ['Rock wall ahead: bring the ladder!', 'Ladder on our shoulders! 🪜'],
    }[o.type];
    later(0.8, () => say('manager', 'team', '📻 ' + advice[0], advice[1], () => { o.informed = true; }));
  } else {
    caption(`The Manager spots a ${o.name}, but communication is OFF, so the koalas never hear about it.`, 'No communication');
    later(1.2, () => bubble('manager', '(...keeps it to themselves 🤐)', 2.4));
  }
}

function finish() {
  const tm = S.team;
  S.finished = true; tm.mode = 'done'; tm.mood = 'happy';
  caption('The koalas reach the pyramid! 🎉 Vision (Leader) + planning & communication (Manager) + everyday hard work (Team) got them here.', 'Goal reached');
  bubble('team', 'We made it!! 🎉🐨', 5);
  later(1.0, () => bubble('manager', 'Brilliant work, koalas! 🦉', 4));
  later(1.8, () => bubble('leader', 'Proud of every one of you! 🦅', 4));
  later(4.6, () => bubble('team', 'Group hug!! 🤗', 4));
  for (let i = 0; i < 80; i++) confetti(tm.x - 30 + (Math.random() - 0.5) * 60, memberY(tm.x) - 50, 1);
  call('OnFinished', Math.round(S.t), tm.wrong, tm.surprises, tm.distractions, settings.comms);
}
function confetti(x, y, n) {
  const cols = ['#ff5d5d', '#ffd34d', '#5dd3ff', '#8aff5d', '#d07bff', '#ffffff'];
  for (let i = 0; i < n; i++) S.particles.push({ kind: 'confetti', x, y, vx: (Math.random() - 0.5) * 220, vy: -120 - Math.random() * 200, r: Math.random() * 6, vr: (Math.random() - 0.5) * 10, life: 2.5 + Math.random(), c: cols[Math.floor(Math.random() * cols.length)] });
}
function leaf(x, y) {
  const cols = ['#4caf50', '#66bb6a', '#2e7d32', '#9ccc65'];
  S.particles.push({ kind: 'leaf', x, y, vx: 30 + Math.random() * 90, vy: -60 - Math.random() * 80, r: Math.random() * 6, vr: (Math.random() - 0.5) * 8, life: 1.1 + Math.random() * 0.6, c: cols[Math.floor(Math.random() * 4)] });
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
// ---------- drawing (scene pieces kept from v1) ----------
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
    if (S.team.m0 > 5 && S.team.seqOb && S.team.seqOb.type === 'river') {
      const sx = S.team.x + S.team.m0 - camX;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(sx + Math.sin(S.t * 9 + i) * 14, GROUND + 14 - Math.abs(Math.cos(S.t * 7 + i)) * 12, 2.5, 0, 7); ctx.fill(); }
    }
  }
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
    const px = p.x - camX;
    let x, y;
    ctx.globalAlpha = a;
    ctx.fillStyle = cols[b.who][0]; ctx.strokeStyle = cols[b.who][1]; ctx.lineWidth = 2;
    if (b.who === 'leader') {
      // The eagle flies near the top of the sky, so its bubble sits beside it instead of above.
      const right = px + 58 + w < viewW - 6;
      x = right ? px + 58 : px - 58 - w; y = clamp(p.y - h / 2 - 6, 4, H - h);
      rr(x, y, w, h, 10); ctx.fill(); ctx.stroke();
      const ex = right ? x + 1 : x + w - 1, dir = right ? -1 : 1;
      ctx.beginPath(); ctx.moveTo(ex, y + h / 2 - 6); ctx.lineTo(ex + dir * 10, y + h / 2 + 2); ctx.lineTo(ex, y + h / 2 + 6); ctx.fill();
    } else {
      x = clamp(px - w / 2, 6, viewW - w - 6);
      y = p.y - (b.who === 'team' ? 44 : 58) - h;
      rr(x, y, w, h, 10); ctx.fill(); ctx.stroke();
      const tx = clamp(px, x + 12, x + w - 12);
      ctx.beginPath(); ctx.moveTo(tx - 6, y + h - 1); ctx.lineTo(tx, y + h + 9); ctx.lineTo(tx + 6, y + h - 1); ctx.fill();
    }
    ctx.fillStyle = '#222'; ctx.fillText(b.text, x + 10, y + 17.5);
    ctx.globalAlpha = 1;
  }
}

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
    team: '🐨 TEAM VIEW: the koalas see only what\'s right in front of them',
  }[v];
  ctx.font = 'bold 14px system-ui, sans-serif';
  const w = ctx.measureText(text).width + 24;
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; rr(12, H - 40, w, 28, 14); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillText(text, 24, H - 21);
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


function onKey(e) {
  if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  if (e.code === 'Space') { e.preventDefault(); settings.playing = !settings.playing; call('OnPlayState', settings.playing); }
  else if (e.key === 'r' || e.key === 'R') { reset(); call('OnRestarted'); }
  else if (['1', '2', '3', '4'].includes(e.key)) { settings.view = ['all', 'leader', 'manager', 'team'][+e.key - 1]; call('OnViewChanged', settings.view); }
}


// ---------- drawing (new in v2) ----------
function drawPyramid() {
  const x = GOAL_X - camX;
  if (x < -PYR_HALF - 20 || x > viewW + PYR_HALF + 20) return;
  const by = groundBase(GOAL_X) + 2;
  ctx.fillStyle = '#d9b066';
  ctx.beginPath(); ctx.moveTo(x - PYR_HALF, by); ctx.lineTo(x, PYR_APEX); ctx.lineTo(x + PYR_HALF, by); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#b98c45';
  ctx.beginPath(); ctx.moveTo(x, PYR_APEX); ctx.lineTo(x + PYR_HALF, by); ctx.lineTo(x + 30, by); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(120,85,40,0.45)'; ctx.lineWidth = 1.2;
  for (let y = PYR_APEX + 26; y < by; y += 22) {
    const half = PYR_HALF * (y - PYR_APEX) / (by - PYR_APEX);
    ctx.beginPath(); ctx.moveTo(x - half, y); ctx.lineTo(x + half, y); ctx.stroke();
  }
  ctx.fillStyle = '#4a3418';
  ctx.beginPath(); ctx.moveTo(x - 16, by); ctx.lineTo(x - 16, by - 30); ctx.arc(x, by - 30, 16, Math.PI, 0); ctx.lineTo(x + 16, by); ctx.fill();
  ctx.fillStyle = '#ffe58a';
  ctx.beginPath(); ctx.moveTo(x, PYR_APEX); ctx.lineTo(x - 11, PYR_APEX + 18); ctx.lineTo(x + 11, PYR_APEX + 18); ctx.closePath(); ctx.fill();
}

function drawPathBushes() {
  for (const b of S.pathBushes) {
    const x = b.x - camX; if (x < -40 || x > viewW + 40) continue;
    const gy = groundBase(b.x) + 3;
    if (b.cut) {
      ctx.fillStyle = '#6d4c2f'; ctx.fillRect(x - 5, gy - 8, 4, 8); ctx.fillRect(x + 2, gy - 10, 4, 10);
      ctx.fillStyle = 'rgba(76,175,80,0.7)';
      ctx.beginPath(); ctx.ellipse(x - 9, gy - 1, 4, 1.6, 0.3, 0, 7); ctx.ellipse(x + 10, gy - 1, 4, 1.6, -0.4, 0, 7); ctx.fill();
      continue;
    }
    const k = 1.35 * b.s * (0.35 + 0.65 * b.hp);
    const wob = b.hp < 1 ? Math.sin(S.t * 40) * 1.5 : 0;
    ctx.fillStyle = '#3d9a3f';
    ctx.beginPath();
    ctx.ellipse(x + wob, gy - 14 * k, 16 * k, 14 * k, 0, 0, 7);
    ctx.ellipse(x - 10 * k + wob, gy - 7 * k, 11 * k, 9 * k, 0, 0, 7);
    ctx.ellipse(x + 11 * k + wob, gy - 8 * k, 11 * k, 9 * k, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#5cbf55';
    ctx.beginPath(); ctx.ellipse(x - 4 * k + wob, gy - 20 * k, 7 * k, 4 * k, -0.3, 0, 7); ctx.fill();
    ctx.fillStyle = '#d84343';
    ctx.beginPath(); ctx.arc(x + 6 * k, gy - 12 * k, 1.8, 0, 7); ctx.arc(x - 7 * k, gy - 9 * k, 1.8, 0, 7); ctx.fill();
  }
}

function drawBog(front) {
  const b = ob('bog'); const x = b.x - camX;
  if (x > viewW + 30 || x + b.w < -30) return;
  if (!front) {
    ctx.fillStyle = '#4b5a2a';
    ctx.beginPath(); ctx.ellipse(x + b.w / 2, GROUND + 4, b.w / 2 + 8, 14, 0, 0, 7); ctx.fill();
    ctx.fillRect(x - 4, GROUND + 2, b.w + 8, 40);
    // bubbles popping
    ctx.strokeStyle = 'rgba(190,200,140,0.8)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) {
      const ph = (S.t * 0.7 + i * 0.37) % 1;
      ctx.beginPath(); ctx.arc(x + 20 + i * (b.w - 40) / 4, GROUND + 4 - ph * 4, 2 + ph * 4, 0, 7); ctx.stroke();
    }
    // reeds
    ctx.strokeStyle = '#6f8f3a'; ctx.lineWidth = 2;
    for (const rx of [x - 6, x + 4, x + b.w - 4, x + b.w + 6]) {
      ctx.beginPath(); ctx.moveTo(rx, GROUND + 6); ctx.quadraticCurveTo(rx + 3, GROUND - 14, rx + 1 + Math.sin(S.t + rx) * 2, GROUND - 30); ctx.stroke();
      ctx.fillStyle = '#7a4a2a'; ctx.beginPath(); ctx.ellipse(rx + 1, GROUND - 26, 2.4, 6, 0, 0, 7); ctx.fill();
    }
    // stepping stones
    const n = Math.floor(b.prog * 6 + 0.0001);
    for (let k = 0; k < n; k++) {
      const sx = x + (k + 0.5) * b.w / 6;
      ctx.fillStyle = '#8d8d8d'; ctx.beginPath(); ctx.ellipse(sx, GROUND + 1, 14, 5.5, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#b0b0b0'; ctx.beginPath(); ctx.ellipse(sx - 2, GROUND - 1, 8, 2.5, 0, 0, 7); ctx.fill();
    }
  } else {
    ctx.fillStyle = 'rgba(70,86,38,0.9)';
    ctx.fillRect(x - 2, GROUND + 7, b.w + 4, 36);
    if (S.team.m0 > 5 && S.team.seqOb === b) {
      const sx = S.team.x + S.team.m0 - camX;
      ctx.fillStyle = 'rgba(150,160,90,0.9)';
      for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(sx + Math.sin(S.t * 6 + i) * 12, GROUND + 8 - Math.abs(Math.cos(S.t * 5 + i)) * 6, 2.5, 0, 7); ctx.fill(); }
    }
  }
}

function drawLog() {
  const o = ob('log'); const x = o.x - camX;
  if (x > viewW + 40 || x + o.w < -40) return;
  const top = GROUND - 76, hgt = 78, cy = top + hgt / 2;
  const g = ctx.createLinearGradient(0, top, 0, GROUND);
  g.addColorStop(0, '#8a5a34'); g.addColorStop(0.5, '#6d4426'); g.addColorStop(1, '#4e2f19');
  ctx.fillStyle = g; ctx.fillRect(x, top, o.w, hgt);
  ctx.strokeStyle = 'rgba(40,22,10,0.5)'; ctx.lineWidth = 2;
  for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.moveTo(x + 10, top + 12 + k * 14); ctx.bezierCurveTo(x + o.w * 0.3, top + 8 + k * 14, x + o.w * 0.6, top + 18 + k * 14, x + o.w - 6, top + 12 + k * 14); ctx.stroke(); }
  // moss + mushrooms on top
  ctx.fillStyle = '#5f9a3a'; ctx.beginPath(); ctx.ellipse(x + o.w * 0.45, top + 2, o.w * 0.35, 6, 0, 0, 7); ctx.fill();
  for (const mx of [0.25, 0.7]) {
    ctx.fillStyle = '#f4e3c0'; ctx.fillRect(x + o.w * mx - 1.5, top - 8, 3, 8);
    ctx.fillStyle = '#d84a3a'; ctx.beginPath(); ctx.arc(x + o.w * mx, top - 8, 6, Math.PI, 0); ctx.fill();
  }
  // right end (solid rings)
  ctx.fillStyle = '#c99a62'; ctx.beginPath(); ctx.ellipse(x + o.w, cy, 14, hgt / 2, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#2a1a0c'; ctx.beginPath(); ctx.ellipse(x + o.w, cy + 4, 9, hgt / 2 - 10, 0, 0, 7); ctx.fill();
  // left end: the hollow entrance
  ctx.fillStyle = '#c99a62'; ctx.beginPath(); ctx.ellipse(x, cy, 14, hgt / 2, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#1e1208'; ctx.beginPath(); ctx.ellipse(x, cy + 4, 9.5, hgt / 2 - 9, 0, 0, 7); ctx.fill();
  if (o.prog < 1) { // cobwebs
    ctx.strokeStyle = `rgba(255,255,255,${0.75 * (1 - o.prog)})`; ctx.lineWidth = 1;
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(x, cy + 4); ctx.lineTo(x + Math.cos(a) * 9, cy + 4 + Math.sin(a) * (hgt / 2 - 10)); ctx.stroke(); }
    for (const rr2 of [0.35, 0.7]) { ctx.beginPath(); ctx.ellipse(x, cy + 4, 9 * rr2, (hgt / 2 - 10) * rr2, 0, 0, 7); ctx.stroke(); }
  }
}

function drawBees(front) {
  const o = ob('bees'); const x = o.x - camX;
  if (x > viewW + 80 || x + o.w < -80) return;
  const by = groundBase(o.x) - 175, cx = x + o.w / 2;
  if (!front) {
  ctx.strokeStyle = '#5b3e2b'; ctx.lineWidth = 7; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x - 70, by - 12); ctx.quadraticCurveTo(cx, by + 6, x + o.w + 60, by - 4); ctx.stroke(); ctx.lineCap = 'butt';
  ctx.fillStyle = '#3f8f3a';
  for (const lx of [-50, -10, 70, 120]) { ctx.beginPath(); ctx.ellipse(x + lx, by - 10, 10, 4, 0.4, 0, 7); ctx.fill(); }
  // nest
  ctx.strokeStyle = '#5b3e2b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, by); ctx.lineTo(cx, by + 8); ctx.stroke();
  ctx.fillStyle = '#d9a441'; ctx.beginPath(); ctx.ellipse(cx, by + 30, 17, 23, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = '#a8752a'; ctx.lineWidth = 2;
  for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.ellipse(cx, by + 30 + k * 8, 16 - Math.abs(k) * 2.5, 2, 0, 0, Math.PI); ctx.stroke(); }
  ctx.fillStyle = '#3a2a10'; ctx.beginPath(); ctx.arc(cx + 2, by + 38, 3.5, 0, 7); ctx.fill();
  }
  if (front) {
  // bees: orbit lazily, or chase the koalas when angry
  const tp = agentPos('team'), k = clamp(o.angry / 2.5, 0, 1);
  for (let i = 0; i < 9; i++) {
    const a = S.t * (1.5 + i * 0.15) + i * 0.7;
    let bx = cx + Math.cos(a) * (26 + i * 2), byy = by + 30 + Math.sin(a * 1.3) * (18 + i);
    if (k > 0) { bx = lerp(bx, tp.x - camX + Math.cos(a * 3) * 34, k); byy = lerp(byy, tp.y + 30 + Math.sin(a * 3) * 26, k); }
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.ellipse(bx - 1, byy - 4.5, 4, 2.2, -0.5 + Math.sin(S.t * 40 + i) * 0.4, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffcc1a'; ctx.beginPath(); ctx.ellipse(bx, byy, 5, 3.5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#222'; ctx.fillRect(bx - 1, byy - 3.4, 1.8, 6.8); ctx.fillRect(bx + 2.2, byy - 2.6, 1.4, 5.2);
  }
  if (!o.angry && !o.done) { ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = 'bold 11px sans-serif'; ctx.fillText('z z', cx + 20, by + 8 - (S.t * 6 % 6)); }
  }
}
function drawWall() {
  const w = ob('wall'); const x = w.x - camX;
  if (x > viewW + 120 || x < -160) return;
  ctx.fillStyle = '#857261';
  ctx.beginPath(); ctx.moveTo(x - 4, LOW_GROUND + 4); ctx.lineTo(x + 4, LOW_GROUND - 22); ctx.lineTo(x + 14, LOW_GROUND - 36); ctx.lineTo(x + 22, GROUND + 26);
  ctx.lineTo(x + 34, GROUND + 12); ctx.lineTo(x + w.w + 2, GROUND - 2); ctx.lineTo(x + w.w + 80, GROUND + 2); ctx.lineTo(x + w.w + 80, LOW_GROUND + 30); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#64544a'; ctx.lineWidth = 2;
  for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x + 8 + k * 9, LOW_GROUND - 10 - k * 18); ctx.lineTo(x + w.w + 70, LOW_GROUND - 14 - k * 18); ctx.stroke(); }
  ctx.fillStyle = '#5f9a3a'; ctx.beginPath(); ctx.ellipse(x + w.w + 30, GROUND, 40, 5, 0, 0, 7); ctx.fill();
  if (w.prog > 0) {
    const bx = x - 16, byy = LOW_GROUND - 2, tx = x + w.w + 4, ty = GROUND - 8;
    const L = Math.hypot(tx - bx, byy - ty), th = Math.atan2(byy - ty, tx - bx) * w.prog;
    const ex = bx + L * Math.cos(th), ey = byy - L * Math.sin(th);
    const nx = -Math.sin(th) * 5, ny = -Math.cos(th) * 5;
    ctx.strokeStyle = '#c08a4a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(bx + nx, byy + ny); ctx.lineTo(ex + nx, ey + ny); ctx.moveTo(bx - nx, byy - ny); ctx.lineTo(ex - nx, ey - ny); ctx.stroke();
    ctx.lineWidth = 2;
    for (let s = 0.1; s < 1; s += 0.12) { const px = lerp(bx, ex, s), py = lerp(byy, ey, s); ctx.beginPath(); ctx.moveTo(px + nx, py + ny); ctx.lineTo(px - nx, py - ny); ctx.stroke(); }
  }
}

function drawLeader() {
  const L = S.leader, x = L.x + L.ox - camX, y = L.y + L.oy;
  const flap = Math.sin(S.t * (L.dist ? 9 : 5)) * 14;
  ctx.save(); ctx.translate(x, y); ctx.rotate(L.rot);
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
  if (L.dist) drawLeaderFX(L, x, y);
  tag(x, y - 34, 'LEADER', '#ffd34d');
}
function drawLeaderFX(L, x, y) {
  const d = L.dist, t = S.t, fade = d.phase === 'distract' ? 1 : Math.max(0, 1 - d.t / 0.8);
  if (fade <= 0) return;
  ctx.save(); ctx.globalAlpha = fade;
  if (d.def.kind === 'magpie') {
    const mx = x + Math.cos(t * 4.5) * 58, my = y - 14 + Math.sin(t * 9) * 22, dir = -Math.sin(t * 4.5) >= 0 ? 1 : -1;
    ctx.save(); ctx.translate(mx, my); ctx.scale(dir, 1);
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(0, 0, 11, 5.5, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(9, -3, 4.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(-2, -2, 6, 2.4, -0.2, 0, 7); ctx.fill(); ctx.fillRect(4, -6, 3, 4);
    ctx.fillStyle = '#9aa'; ctx.beginPath(); ctx.moveTo(13, -4); ctx.lineTo(19, -2); ctx.lineTo(13, -1); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.moveTo(-3, -2); ctx.lineTo(-10, -12 - Math.sin(t * 20) * 6); ctx.lineTo(4, -3); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y - 6, 62, t * 4.5 - 0.6, t * 4.5 - 0.1); ctx.stroke();
  } else if (d.def.kind === 'email') {
    for (let k = 0; k < 4; k++) {
      const a = t * 2.4 + k * Math.PI / 2, ex = x + Math.cos(a) * 52, ey = y - 6 + Math.sin(a) * 26;
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#888'; ctx.lineWidth = 1;
      ctx.fillRect(ex - 9, ey - 6, 18, 12); ctx.strokeRect(ex - 9, ey - 6, 18, 12);
      ctx.beginPath(); ctx.moveTo(ex - 9, ey - 6); ctx.lineTo(ex, ey + 1); ctx.lineTo(ex + 9, ey - 6); ctx.stroke();
    }
    ctx.fillStyle = '#e53935'; ctx.beginPath(); ctx.arc(x + 20, y - 26, 9, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('47', x + 20, y - 22.5); ctx.textAlign = 'left';
  } else if (d.def.kind === 'storm') {
    ctx.fillStyle = 'rgba(70,74,84,0.92)';
    ctx.beginPath(); ctx.ellipse(x + 40, y - 30, 50, 15, 0, 0, 7); ctx.ellipse(x + 10, y - 38, 30, 14, 0, 0, 7); ctx.ellipse(x + 70, y - 38, 28, 12, 0, 0, 7); ctx.fill();
    if ((t * 1.7) % 1 < 0.15) {
      ctx.strokeStyle = '#ffeb3b'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x + 46, y - 18); ctx.lineTo(x + 38, y - 4); ctx.lineTo(x + 48, y - 2); ctx.lineTo(x + 36, y + 16); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 2;
    for (let k = 0; k < 6; k++) {
      const wx = x + 140 - ((t * 320 + k * 57) % 280), wy = y - 26 + k * 11;
      ctx.beginPath(); ctx.moveTo(wx, wy); ctx.quadraticCurveTo(wx - 20, wy - 5, wx - 40, wy); ctx.stroke();
    }
  }
  ctx.restore();
}

function drawManager() {
  const M = S.mgr, x = M.x + M.ox - camX, y = M.y + M.oy;
  const distracted = M.dist && M.dist.phase === 'distract';
  ctx.fillStyle = M.alert > 0 ? 'rgba(255,140,90,0.16)' : (distracted ? 'rgba(255,255,200,0.04)' : 'rgba(255,255,200,0.10)');
  ctx.beginPath(); ctx.moveTo(x + 10, y + 6); ctx.lineTo(x + 250, GROUND - 120); ctx.lineTo(x + 230, GROUND + 6); ctx.lineTo(x + 40, GROUND + 6); ctx.closePath(); ctx.fill();
  if (M.focusT > 0) { // refocus: re-locks onto the team
    const tp = agentPos('team');
    ctx.save(); ctx.globalAlpha = Math.min(1, M.focusT); ctx.strokeStyle = '#7dff9a'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(tp.x - camX, tp.y); ctx.stroke(); ctx.restore();
    ring(x, y, 30 + (2 - M.focusT) * 8, 'rgba(125,255,154,0.8)');
  }
  const flap = Math.sin(S.t * 12) * 8;
  ctx.save(); ctx.translate(x, y); ctx.rotate(M.rot);
  if (S.selected === 'manager') ring(0, 0, 36, '#c792ff');
  ctx.fillStyle = '#7b5a8c';
  ctx.beginPath(); ctx.moveTo(-10, 0); ctx.quadraticCurveTo(-28, -8 - flap, -36, 4 - flap); ctx.quadraticCurveTo(-24, 10, -10, 10); ctx.fill();
  ctx.beginPath(); ctx.moveTo(10, 0); ctx.quadraticCurveTo(28, -8 - flap, 36, 4 - flap); ctx.quadraticCurveTo(24, 10, 10, 10); ctx.fill();
  ctx.fillStyle = '#9b74ad'; ctx.beginPath(); ctx.ellipse(0, 2, 15, 18, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#e8d8c0'; ctx.beginPath(); ctx.ellipse(0, 8, 9, 10, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#7b5a8c'; ctx.beginPath(); ctx.moveTo(-13, -12); ctx.lineTo(-10, -22); ctx.lineTo(-4, -14); ctx.fill();
  ctx.beginPath(); ctx.moveTo(13, -12); ctx.lineTo(10, -22); ctx.lineTo(4, -14); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-6, -6, 6, 0, 7); ctx.arc(6, -6, 6, 0, 7); ctx.fill();
  const look = distracted ? -1.5 : 1.5;
  ctx.fillStyle = '#ffb000'; ctx.beginPath(); ctx.arc(-6 + look, -6, 3.4, 0, 7); ctx.arc(6 + look, -6, 3.4, 0, 7); ctx.fill();
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(-6 + look * 1.3, -6, 1.6, 0, 7); ctx.arc(6 + look * 1.3, -6, 1.6, 0, 7); ctx.fill();
  ctx.fillStyle = '#e8a33a'; ctx.beginPath(); ctx.moveTo(-2, 0); ctx.lineTo(0, 5); ctx.lineTo(2, 0); ctx.fill();
  ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(12, -14); ctx.lineTo(18, -26); ctx.stroke();
  ctx.fillStyle = settings.comms ? '#5dff8a' : '#ff5d5d'; ctx.beginPath(); ctx.arc(18, -27, 2.6, 0, 7); ctx.fill();
  ctx.restore();
  if (M.dist) drawManagerFX(M, x, y);
  if (M.alert > 0) { ctx.fillStyle = '#ff7043'; ctx.font = 'bold 22px sans-serif'; ctx.fillText('!', x - 4, y - 30); }
  tag(x, y - 42, 'MANAGER', '#c792ff');
}
function drawManagerFX(M, x, y) {
  const d = M.dist, t = S.t, fade = d.phase === 'distract' ? 1 : Math.max(0, 1 - d.t / 0.8);
  if (fade <= 0) return;
  ctx.save(); ctx.globalAlpha = fade;
  if (d.def.kind === 'meeting') {
    for (let k = 0; k < 3; k++) {
      const cx = x + 34 + k * 20, cy = y - 18 + Math.sin(t * 4 + k) * 6 - k * 8;
      ctx.fillStyle = '#fff'; ctx.fillRect(cx - 8, cy - 8, 16, 16);
      ctx.fillStyle = '#e53935'; ctx.fillRect(cx - 8, cy - 8, 16, 5);
      ctx.fillStyle = '#333'; ctx.font = 'bold 8px sans-serif'; ctx.fillText('9:00', cx - 8, cy + 6);
    }
  } else if (d.def.kind === 'mosquito') {
    ctx.fillStyle = '#222';
    for (let k = 0; k < 14; k++) {
      const mx = x + Math.sin(t * 17 + k * 1.3) * 30, my = y + Math.cos(t * 13 + k * 2.1) * 24;
      ctx.beginPath(); ctx.arc(mx, my, 1.7, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(mx - 3, my - 2); ctx.lineTo(mx + 3, my - 2); ctx.stroke();
    }
  } else if (d.def.kind === 'branch') {
    ctx.strokeStyle = '#5b3e2b'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - 70, y - 40); ctx.quadraticCurveTo(x - 10, y - 10, x + 40, y + 26); ctx.stroke(); ctx.lineCap = 'butt';
    ctx.fillStyle = '#3f8f3a';
    for (const k of [0.2, 0.45, 0.75]) { ctx.beginPath(); ctx.ellipse(lerp(x - 70, x + 40, k), lerp(y - 40, y + 26, k) - 6, 9, 4, 0.5, 0, 7); ctx.fill(); }
    ctx.strokeStyle = '#2f7a2d'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, y + 2, 20, 14, Math.sin(t * 6) * 0.4, 0, 7); ctx.stroke();
  }
  ctx.restore();
}

function drawTeam() {
  const tm = S.team, logO = ob('log');
  for (let i = 3; i >= 0; i--) {
    const mx = tm.x - i * MEMBER_GAP + (i === 0 ? tm.m0 : 0);
    const lane = laneOffset(mx);
    const gy = memberY(mx) + lane + (i === 0 ? tm.m0y : 0);
    const moving = tm.mode === 'walk' || (tm.seq && tm.seq[tm.step] && tm.seq[tm.step].move != null);
    const ph = S.t * 9 + i * 1.7;
    let bob = moving ? Math.abs(Math.sin(ph)) * 2 : 0;
    if (tm.mood === 'happy') bob = Math.abs(Math.sin(S.t * 6 + i)) * 16;
    if (tm.cheer > 0) bob += Math.abs(Math.sin(S.t * 10 + i)) * 10 * tm.cheer;
    const shake = tm.mood === 'stuck' ? Math.sin(S.t * 30 + i) * 1.5 : 0;
    let mood = tm.mood;
    if (mx > logO.x - 6 && mx < logO.x + logO.w + 6) mood = 'sneak'; // crawling through the hollow log
    const s = KOALA_SCALE * (1 + lane / 120);
    drawKoala(mx - camX + shake, gy - bob, s, TEAM_COLORS[i], moving ? Math.sin(ph) : 0, mood, i);
  }
  const p = agentPos('team');
  if (tm.mood === 'confused') { ctx.fillStyle = '#fff'; ctx.font = 'bold 18px sans-serif'; ctx.fillText('?', p.x - camX + 56 + Math.sin(S.t * 3) * 4, p.y + 4); }
  if (S.selected === 'team') ring(p.x - camX, p.y + 30, 74, '#5dd3ff');
  tag(p.x - camX, p.y - 26, 'TEAM', '#5dd3ff');
}
// A cute koala, facing right, feet at (0,0). Hard hats on even koalas, bandanas on odd ones.
function drawKoala(x, y, s, col, swing, mood, i) {
  const t = S.t;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s * (mood === 'sneak' ? 0.86 : 1));
  // feet
  ctx.fillStyle = '#5f6368';
  ctx.beginPath(); ctx.ellipse(-5 + swing * 4, -2, 5, 3, 0, 0, 7); ctx.ellipse(6 - swing * 4, -2, 5, 3, 0, 0, 7); ctx.fill();
  // back arm
  ctx.strokeStyle = '#8a9198'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-4, -21); ctx.lineTo(-8 - swing * 3, -12); ctx.stroke();
  // body + belly
  ctx.fillStyle = '#9aa1a8'; ctx.beginPath(); ctx.ellipse(0, -15, 12, 14, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#e8e8e8'; ctx.beginPath(); ctx.ellipse(2.5, -13, 7, 9, 0, 0, 7); ctx.fill();
  // scarf / bandana neck
  if (i % 2 === 1) { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-8, -27); ctx.lineTo(10, -27); ctx.lineTo(2, -19); ctx.closePath(); ctx.fill(); }
  // ears (big and fluffy)
  for (const ex of [-10, 12]) {
    ctx.fillStyle = '#a7aeb5'; ctx.beginPath(); ctx.arc(ex, -44, 8, 0, 7); ctx.fill();
    ctx.fillStyle = '#f6f6f6';
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + 0.3; ctx.beginPath(); ctx.arc(ex + Math.cos(a) * 6.8, -44 + Math.sin(a) * 6.8, 2.6, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#ecc9cf'; ctx.beginPath(); ctx.arc(ex, -44, 4, 0, 7); ctx.fill();
  }
  // head
  ctx.fillStyle = '#a7aeb5'; ctx.beginPath(); ctx.arc(1, -35, 11.5, 0, 7); ctx.fill();
  ctx.fillStyle = '#c2c8cd'; ctx.beginPath(); ctx.ellipse(3, -31, 7, 5, 0, 0, 7); ctx.fill();
  // headwear
  if (i % 2 === 0) { // hard hat
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(1, -44, 8.5, Math.PI, 0); ctx.fill();
    ctx.fillRect(-9, -45, 20, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(-1, -52, 3, 7);
  } else { // bandana tied round the head
    ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(1, -43, 10.5, 4, 0, Math.PI, 0); ctx.fill(); ctx.fillRect(-9.5, -44, 21, 3.5);
    ctx.beginPath(); ctx.moveTo(-10, -42); ctx.lineTo(-17, -46 + Math.sin(t * 8 + i) * 2); ctx.lineTo(-15, -39); ctx.fill();
  }
  // eyes
  ctx.fillStyle = '#1d1d1d';
  if (mood === 'happy') { ctx.strokeStyle = '#1d1d1d'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(-1, -36, 2, Math.PI, 0); ctx.arc(8, -36, 2, Math.PI, 0); ctx.stroke(); }
  else { ctx.beginPath(); ctx.arc(-1, -37, 1.7, 0, 7); ctx.arc(8, -37, 1.7, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-0.5, -37.6, 0.6, 0, 7); ctx.arc(8.5, -37.6, 0.6, 0, 7); ctx.fill(); }
  // big black nose
  ctx.fillStyle = '#262626'; ctx.beginPath(); ctx.ellipse(4, -31, 3.8, 4.8, 0, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.ellipse(3, -33, 1, 1.5, 0, 0, 7); ctx.fill();
  // mouth
  if (mood === 'stuck' || mood === 'confused') { ctx.fillStyle = '#5a2a2a'; ctx.beginPath(); ctx.ellipse(4, -25, 2, 1.6, 0, 0, 7); ctx.fill(); }
  // front arm + machete
  let a;
  if (mood === 'hack') a = -1.4 + (Math.sin(t * 16 + i * 1.1) * 0.5 + 0.5) * 2.3;
  else if (mood === 'work') a = -1.0 + (Math.sin(t * 11 + i) * 0.5 + 0.5) * 1.6;
  else if (mood === 'happy') a = -1.9 + Math.sin(t * 8 + i) * 0.3;
  else if (mood === 'stuck') a = Math.sin(t * 18 + i) * 1.1 - 0.4;
  else if (mood === 'sneak') a = -2.2;
  else a = 0.9 + swing * 0.3;
  const sx = 5, sy = -22, len = mood === 'sneak' ? 7 : 9;
  const hx = sx + Math.cos(a) * len, hy = sy + Math.sin(a) * len;
  if (mood === 'hack' || mood === 'work' || mood === '' || mood === 'walk') {
    const ba = mood === 'hack' || mood === 'work' ? a + 0.25 : 1.35;
    ctx.strokeStyle = '#6d4c2f'; ctx.lineWidth = 3; ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.moveTo(hx - Math.cos(ba) * 3, hy - Math.sin(ba) * 3); ctx.lineTo(hx + Math.cos(ba) * 2, hy + Math.sin(ba) * 2); ctx.stroke();
    ctx.strokeStyle = '#5f6b70'; ctx.lineWidth = 5.2;
    ctx.beginPath(); ctx.moveTo(hx + Math.cos(ba) * 2, hy + Math.sin(ba) * 2); ctx.lineTo(hx + Math.cos(ba) * 18, hy + Math.sin(ba) * 18); ctx.stroke();
    ctx.strokeStyle = '#e3eaee'; ctx.lineWidth = 3.4;
    ctx.beginPath(); ctx.moveTo(hx + Math.cos(ba) * 2.5, hy + Math.sin(ba) * 2.5); ctx.lineTo(hx + Math.cos(ba) * 17.5, hy + Math.sin(ba) * 17.5); ctx.stroke();
  }
  ctx.strokeStyle = '#9aa1a8'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(hx, hy); ctx.stroke();
  ctx.fillStyle = '#7d848b'; ctx.beginPath(); ctx.arc(hx, hy, 2.6, 0, 7); ctx.fill();
  ctx.lineCap = 'butt';
  ctx.restore();
}

function drawParticles() {
  for (const p of S.particles) {
    ctx.save(); ctx.translate(p.x - camX, p.y); ctx.rotate(p.r);
    ctx.fillStyle = p.c; ctx.globalAlpha = Math.min(1, p.life);
    if (p.kind === 'leaf') { ctx.beginPath(); ctx.ellipse(0, 0, 4.5, 2, 0, 0, 7); ctx.fill(); }
    else ctx.fillRect(-3, -2, 6, 4);
    ctx.restore();
  }
}

function drawMiniMap() {
  if (settings.view === 'team' || settings.view === 'manager') return;
  const w = 340, h = 34, x = 12, y = 12, k = (w - 20) / WORLD_W;
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; rr(x, y, w, h, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = '#2e7d32'; ctx.fillRect(x + 10, y + 20, w - 20, 4);
  ctx.font = '11px sans-serif';
  ctx.fillText('🏁', x + 10 + START_X * k - 6, y + 17);
  for (const o of S.obstacles) { ctx.globalAlpha = o.done ? 0.35 : 1; ctx.fillText(o.icon, x + 10 + o.x * k - 6, y + 17); ctx.globalAlpha = 1; }
  ctx.fillText('🔺', x + 10 + GOAL_X * k - 6, y + 17);
  const dot = (wx, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x + 10 + wx * k, y + 22, 3.5, 0, 7); ctx.fill(); };
  dot(S.team.x, '#1f8fd0'); dot(S.mgr.x, '#9b59d0'); dot(S.leader.x, '#d4a000');
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
  drawBog(false);
  drawStartCamp();
  drawBoulder();
  drawCliff();
  drawWall();
  drawVineThicket();
  drawBees(false);
  drawTeam();
  drawBees(true);
  drawRiver(true);
  drawBog(true);
  drawLog();
  drawBushes();
  drawPathBushes();
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

function onClick(ev) {
  const rect = canvas.getBoundingClientRect();
  const sx = (ev.clientX - rect.left) * (canvas.width / rect.width) / scale;
  const sy = (ev.clientY - rect.top) * (canvas.height / rect.height) / scale;
  const wx = sx + camX;
  const near = (p, r) => Math.hypot(p.x - wx, p.y - sy) < r;
  let hit = null;
  if (near(agentPos('leader'), 48)) hit = 'leader';
  else if (near(agentPos('manager'), 44)) hit = 'manager';
  else {
    const tx = S.team.x;
    if (wx > tx - MEMBER_GAP * 3 - 22 && wx < tx + 22 && sy > memberY(tx) - 95 && sy < memberY(tx) + 50) hit = 'team';
    else {
      const by = groundBase(GOAL_X), half = PYR_HALF * (sy - PYR_APEX) / (by - PYR_APEX);
      if (sy > PYR_APEX && sy < by && Math.abs(wx - GOAL_X) < half) hit = 'goal';
    }
  }
  S.selected = hit;
  call('OnAgentClicked', hit || '');
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
  window.aboveTheCanopy = { settings, get state() { return S; }, fastForward, restart, runToEnd };
}
export function setPlaying(p) { settings.playing = !!p; }
export function restart() { reset(); }
export function setSpeed(v) { settings.speed = clamp(+v || 1, 0.1, 5); }
export function setView(v) { settings.view = v; }
export function setComms(on) { settings.comms = !!on; }
export function select(role) { S.selected = role || null; }
export function fastForward(seconds) { const step = 1 / 30; for (let t = 0; t < seconds; t += step) { update(step); updateCamera(step); } render(); }
// Simulates a full run (used for testing pacing); returns the sim-time when the team finished.
export function runToEnd(maxSeconds = 600) { const step = 1 / 30; while (!S.finished && S.t < maxSeconds) { update(step); updateCamera(step); } render(); return S.t; }
export function dispose() {
  cancelAnimationFrame(raf);
  if (ro) ro.disconnect();
  if (canvas) canvas.removeEventListener('click', onClick);
  window.removeEventListener('keydown', onKey);
  dotnet = null;
}
