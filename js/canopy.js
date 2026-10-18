// Above the Canopy v7.6 - animation engine (plain canvas 2D, no dependencies).
// v6: procedural Web Audio sound (sound.js), chapters with deterministic jumps, and a teaching mode.
// v7: the pyramid is the Leader's VISION (a golden blueprint above the canopy) until the koalas BUILD it themselves at the end.
import * as snd from './sound.js';
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
// v4: project time. 1 project day = 2 seconds of animation at 1x speed (a comms-ON run is roughly 100 days).
const SEC_PER_DAY = 2;
const dd = n => n + (n === 1 ? " day" : " days");
const dayOf = t => Math.floor(t / SEC_PER_DAY) + 1;
const TEAM_COLORS = ['#f28c28', '#3f8fe8', '#f2c233', '#9b59d0']; // hard hats / bandanas
// v5: the koalas have names (shown on hover and in the team info card). Wattle is the smallest.
const KOALAS = [
  { name: 'Kip', desc: 'orange hard hat' },
  { name: 'Banjo', desc: 'blue bandana' },
  { name: 'Matilda', desc: 'yellow hard hat' },
  { name: 'Wattle', desc: 'purple bandana, the smallest' },
];
const KOALA_SIZE = [1, 1, 1, 0.86];
const COACH_X = 1000;                         // the thick bush where Wattle struggles (and gets coached)
const SHRUBS = { x0: 3190, x1: 3470, n: 8 }; // thick shrubbery on the planned route
const CREEK = { x0: 3150, x1: 3525 };         // the dry creek bed alongside it (Banjo's shortcut)
const SHRUB_HACK = { on: 2.2, off: 2.8 };
const BREAK_X = 4900;                         // top of the rock wall: time for a break
// v7: the build site. The pyramid rises in six stepped courses inside the Leader's blueprint, then the capstone.
const PYR_BY = GROUND + 2;
const CAP_BASE = PYR_APEX + 44;               // the capstone sits on top of course 6
const COURSES = 6;
const COURSE_H = (PYR_BY - CAP_BASE) / COURSES;
const halfAt = y => PYR_HALF * (y - PYR_APEX) / (PYR_BY - PYR_APEX);
const cTop = k => k < 0 ? PYR_BY : PYR_BY - (k + 1) * COURSE_H;   // top of course k (k = -1: the forest floor)
const cHalf = k => halfAt(cTop(k));                                // half-width of course k: its top corners touch the vision
const BUILD_X = 5040;                         // where the koalas stop: the build site
const STOCK_X = BUILD_X + 30;                 // the stone pile
const RAMP_FOOT = 5120;
const rampTop = r => [GOAL_X - cHalf(r), cTop(r)];
const LADDER = { b: [GOAL_X - cHalf(4) - 16, cTop(3)], t: [GOAL_X - cHalf(4) + 2, cTop(4)] };
const FINAL = [[-36, 0], [36, 0], [56, 8], [-56, 8]];    // where the four koalas stand to set the capstone [dx, lane]

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

// v3: unexpected events the Manager could NOT see coming. The koalas discover them and report UP the chain.
const SURPRISE_DEFS = [
  { type: 'sinkhole', x: 2150, w: 90, name: 'sinkhole', icon: '🕳️',
    reveal: 'SURPRISE! The ground collapses into a sinkhole right in front of the koalas. Nobody saw it coming, not even the Manager.',
    revSay: 'Whoa! The ground just vanished! 😱',
    up: 'Manager! A sinkhole just opened up! 🕳️', ack: 'Everyone okay? Stay back, I\'ll tell the boss.',
    toLeader: 'Unplanned sinkhole. Team needs planks, about a week.', leaderReply: 'Safety first, take the week. Goal stays the same. 🔺',
    down: 'The boss says take the time you need. Let\'s gather planks!', teamAck: 'Thanks! On it 👍',
    gatherCap: 'Gathering materials: the koalas fan out into the bush and carry planks back to the sinkhole.',
    fixCap: 'Backed by the Manager and the Leader, the koalas lay planks across the sinkhole and cross safely.',
    aloneCap: 'Alone and unsure if they\'re allowed the time, the koalas slowly rig a crossing.' },
  { type: 'treefall', x: 3900, w: 150, name: 'fallen gum tree', icon: '🌳',
    reveal: 'SURPRISE! CRAAACK! A huge gum tree crashes down across the track. Even the Manager didn\'t see that one coming.',
    revSay: 'TIMBERRR! 😵',
    up: 'Manager! A gum tree just fell across the track! 🌳', ack: 'Is everyone okay? Escalating now.',
    toLeader: 'Tree down on the track. Team needs saws and safety gear, about 5 or 6 days.', leaderReply: 'Yes! Sending saws and safety gear down now. 🪂',
    down: 'The gear is down! Take your time and saw it up safely. 🪚', teamAck: 'Thanks, boss! Saws out! 🪚', support: true,
    fixCap: 'With the delay approved and the new saws, the koalas cut up the trunk and roll the pieces off the track.',
    aloneCap: 'Nobody answers, so the koalas hack at the trunk for ages.' },
  { type: 'snake', x: 4650, w: 110, name: 'brown snake', icon: '🐍',
    reveal: 'SURPRISE! A big brown snake slides out onto the track. Nobody could have planned for this.',
    revSay: 'S-s-snake!! 🐍',
    up: 'Manager! Big brown snake on the track! 🐍', ack: 'Stay still and keep back! I\'ll tell the boss.',
    toLeader: 'Snake on the track. Team needs to wait it out, a few days.', leaderReply: 'No rush. Let it pass safely. Goal stays the same. 🔺',
    down: 'The boss says no rush: wait it out, safety first!', teamAck: 'Waiting quietly... 🤫',
    fixCap: 'The koalas wait calmly at a safe distance until the snake slithers off into the bush.',
    aloneCap: 'Nobody tells them what to do, so the koalas panic, back off and wait nervously.' },
];

// v3: meetings above the canopy. Visiting eagles bring competing priorities; the Leader filters them.
const MEETINGS = [
  { atX: 1300, who: 'Finance, Marketing and Safety',
    visitors: [
      { label: 'FINANCE', body: '#3d6b45', head: '#d9f2c4', size: 0.82, ask: 'Budget cuts? 💸' },
      { label: 'MARKETING', body: '#9c3f6b', head: '#ffd6e8', size: 0.74, ask: 'Urgent: rebrand! 🎨' },
      { label: 'SAFETY', body: '#a8641e', head: '#ffe2b8', size: 0.92, ask: 'Safety gear for koalas', accept: true },
    ],
    yes: 'Yes to safety gear: it gets us to the pyramid. ✅', no: 'Rebrand and budget review: let\'s park those for now. The pyramid comes first.' },
  { atX: 2560, who: 'the Board, Another Project and Product',
    visitors: [
      { label: 'BOARD', body: '#37474f', head: '#eceff1', size: 1.0, ask: 'Can you also run the picnic?' },
      { label: 'OTHER PROJECT', body: '#5d4037', head: '#d7ccc8', size: 0.76, ask: 'Lend us two koalas?' },
      { label: 'PRODUCT', body: '#1565c0', head: '#cfe3ff', size: 0.86, ask: 'Better map to the pyramid', accept: true },
    ],
    yes: 'A better map? Yes, that helps us get there. ✅', no: 'The koalas need that time: the picnic can wait! 🛡️',
    support: 'The Leader backs the team: no picnic and no lending koalas. Protecting the team\'s time protects the goal.' },
  { atX: 5030, who: 'Strategy, HR and Customers',
    visitors: [
      { label: 'STRATEGY', body: '#6a1b9a', head: '#ead6ff', size: 0.9, ask: 'New initiative! 🚀' },
      { label: 'HR', body: '#00796b', head: '#c8f2ea', size: 0.78, ask: 'Can you also do a survey?' },
      { label: 'CUSTOMERS', body: '#c62828', head: '#ffd9d9', size: 0.84, ask: 'Pyramid opening: still on?', accept: true },
    ],
    yes: 'Yes, the pyramid opening is on. That IS the goal. ✅', no: 'New initiative and survey: great ideas, let\'s do them after the launch.' },
  // v7: one last request, mid-build (started from the build sequence, never by distance)
  { atX: Infinity, who: 'Sales',
    visitors: [{ label: 'SALES', body: '#ef6c00', head: '#ffe0b2', size: 0.86, ask: 'Add a gift shop to the pyramid? 🛍️' }],
    no: 'After the launch! 🛡️ Let the koalas finish.',
    capArrive: 'One last visiting eagle swoops in mid-build with a "small" extra request.',
    capAsk: 'Scope creep, right at the end: "Can we add a gift shop?"',
    support: 'Leaders protect the finish: "After the launch!" The Leader keeps the team\'s focus on the vision.',
    capLeave: 'The visitor flies off and the koalas keep building, undisturbed. 🔺' },
];
const MEETING_PHASES = { arrive: 2.0, ask: 3.0, decide: 3.0, leave: 1.8 };

// v4: manager-level meetings under the canopy. Another owl flies in to coordinate with the Manager while the
// koalas are busy gathering materials, then flies off and the Manager refocuses on the team.
const MGR_MEETINGS = [
  { ob: 'river', label: 'OPS MANAGER', body: '#2e7d6f', wing: '#1f5a50', belly: '#d3f0e8', who: 'An Ops manager', topic: 'to share resources',
    lines: [['visitor', 'Your team needs logs? We have spare! 🪵'], ['manager', 'Yes please! Can you drop them by the river?'], ['visitor', 'Done. Shout if you need more.'], ['manager', 'Legend, thanks! 🤝']],
    // v7.6: with communication OFF the Manager is out of the loop, so offers of help go nowhere
    offLines: [['visitor', 'Your team needs logs? We have spare! 🪵'], ['manager', 'Logs? Not sure what my team needs, to be honest... 🤷'], ['visitor', 'No worries. The offer stands!'], ['manager', 'Thanks... 😬']] },
  { ob: 'bog', label: 'PMO', body: '#5c6b7a', wing: '#3e4a56', belly: '#e3e9ef', who: 'The PMO', topic: 'for a quick status update',
    lines: [['visitor', 'Quick status update? 📋'], ['manager', 'River done, bog in progress. On track.'], ['visitor', 'Great, I\'ll update the roadmap.'], ['manager', 'Thanks! Back to my koalas.']],
    offLines: [['visitor', 'Quick status update? 📋'], ['manager', 'Um... not sure. I haven\'t checked in with the team. 😬'], ['visitor', 'Oh. Let me know when you know?'], ['manager', 'Will do... 😬']] },
  { ob: 'cliff', label: 'PROJECT MANAGER B', body: '#b8621b', wing: '#8a4510', belly: '#ffe3c4', who: 'Project manager B', topic: 'to coordinate between teams',
    lines: [['visitor', 'Can we share your rope after? 🪢'], ['manager', 'Sure, once my koalas are down the cliff.'], ['visitor', 'Thanks! Need a ladder later? 🪜'], ['manager', 'Yes please! Could you leave it by the wall?']],
    offLines: [['visitor', 'Can we share your rope after? 🪢'], ['manager', 'Um... I\'m not sure what rope they\'ve got. 🤷'], ['visitor', 'Okay. Need a ladder later? 🪜'], ['manager', 'No idea, sorry. 😬']] },
];
const MM_PHASES = { arrive: 1.5, talk: 6.8, leave: 1.5 };
const MM_LINE_GAP = 1.7;

// Workplace distractions for the Leader and Manager, triggered by how far the team has got.
const DISTRACTIONS = [
  { who: 'leader', kind: 'magpie', atX: 770,
    say: 'Argh! Swooping magpies! 🐦', say2: 'Not the eyes, not the eyes!',
    cap: 'Distraction! A magpie swoops the Leader. (Every Aussie knows that feeling.)',
    refocus: 'Shake it off. Eyes on the pyramid. 🔺' },
  { who: 'manager', kind: 'meeting', atX: 380,
    say: '📅 Meeting request: "Irrelevant meeting"', say2: 'Ugh, another meeting...',
    cap: 'Distraction! Mid-flight, the Manager gets yet another meeting request.',
    refocus: 'Politely declined. Back to the team. ✅' },
  { who: 'leader', kind: 'email', atX: 3700,
    say: '📧 URGENT!!! Reply-all chain (47 new)', say2: 'Is it actually urgent though?',
    cap: 'Distraction! An "urgent" email storm floods the Leader\'s inbox.',
    refocus: 'That can wait. Back to the vision. 🔺' },
  { who: 'manager', kind: 'mosquito', atX: 3330,
    say: 'Bzzz! Mozzies everywhere! 🦟', say2: 'Shoo! SHOO!',
    cap: 'Distraction! A cloud of mozzies swarms the Manager.',
    refocus: 'Swatted. Back to scouting. 🔍' },
  { who: 'leader', kind: 'storm', atX: 4480,
    say: 'Whoa! What a wind gust! 🌬️', say2: 'Hold on... hold on...',
    cap: 'Distraction! A storm front blows in and a gust knocks the Leader off course.',
    refocus: 'Steady. Back on course for the pyramid. 🔺' },
  { who: 'manager', kind: 'branch', atX: 3000,
    say: 'Oof! Snagged in the branches! 🌿', say2: 'Who put this vine here?!',
    cap: 'Distraction! The Manager flies into a snag of branches and vines.',
    refocus: 'Untangled. Back to guiding the team. ✅' },
];

// v7.6: warmer, encouraging lines. A second round (a2/b2) uses different wording; 'relay' is passed down to the team,
// 'ack' is the Leader's reply to the Manager's answer.
const LEADER_TALK = [
  { a: 'Still bearing east for the build site? Lovely work! 🔺', b: 'Yes, still bearing east. 👍' },
  { a: 'How are the koalas going?', b: 'Steady progress, boss. Hacking through!' },
  { a: 'Look how far we\'ve come, the goal\'s worth it! 🌟', b: 'I\'ll pass that on, they\'ll love it! 📣', relay: ['The boss says: look how far we\'ve come! 🌟', 'Aww, thanks boss! 😊'],
    a2: 'You\'re doing great, team, the pyramid\'s getting closer! 🌟', b2: 'Passing that on right now! 📣', relay2: ['The boss says the pyramid\'s getting closer! 🌟', 'Woohoo! Let\'s go! 🎉'] },
  { a: 'Any blockers I can help with?', b: 'All clear for now, thanks! I\'ll shout if anything comes up 🦉', ack: 'Good to hear. I\'m here if you need me! 🦅' },
  { a: 'Great headway, everyone. Proud of you all! 🧭', b: 'Thanks, boss! They\'ve earned it. 🧭', a2: 'We\'re well over halfway. Brilliant effort! 🧭' },
];
// v7.4: the Leader is never idle. In the stretches between meetings, check-ins and escalations, the eagle sends
// communication rings out to OTHER teams and projects (just off-screen) and gets decisions and feedback back.
// Purely presentational: it never touches the simulation (no rand(), no S.pulses / S.bubbles / S.cap), so the story,
// its timing and chapter jumps stay exactly the same. Shown in the Everything and Leader perspectives.
const OUTREACH_TARGETS = [ // side: L/R = off the left/right edge at height y, T = off the top at fx * screen width
  { label: 'Team North', icon: '🌲', side: 'L', y: 150, say: 'Approving the budget for Team North ✅' },
  { label: 'Project B', icon: '📁', side: 'R', y: 122, say: 'Aligning Project B with the strategy 🧭' },
  { label: 'Strategy', icon: '🧭', side: 'T', fx: 0.62, say: 'Steering the bigger picture 🔭' },
  { label: 'Partners', icon: '🤝', side: 'R', y: 172, say: 'Keeping our partners on board 🤝' },
  { label: 'Budget', icon: '💰', side: 'L', y: 84, say: 'Balancing the budget across all teams ⚖️' },
  { label: 'Project C', icon: '🏗️', side: 'T', fx: 0.42, say: 'Green light for Project C ✅' },
];
const OUTREACH_ORDER = [1, 0, 2, 4, 3, 5];
const OUTREACH_CAPS = [
  'Between check-ins the Leader is far from idle: aligning other teams and projects with the organisation\'s strategy.',
  'High-level decisions: the Leader approves budgets and priorities for several teams at once, not just this one.',
  'The Leader keeps partners and stakeholders on board, so every team, the koalas included, has what it needs.',
  'From above the canopy the Leader balances people, money and time across the whole organisation.',
  'Decisions go out and feedback comes back: two-way communication with every team the Leader is responsible for.',
  'Many teams, one direction: the Leader keeps every project pointing toward the bigger picture.',
];
const OUT = { first: 1.2, gap: 3.6, out: 1.5, hold: 0.5, back: 1.2, bubble: 2.6 };
const MANAGER_CHECKIN = [
  ['How\'s everyone going down there?', 'Hacking away! 🌿'],
  ['Water break at the next clearing! 💧', 'Yes please! 💧', () => { S.water = { pending: true }; }],
  ['Great pace, team. Keep it up!', 'Cheers! 😊'],
  ['Watch your footing, it\'s slippery.', 'Thanks for the heads-up!'],
  ['Nice shady stretch of track coming up! 🌳', 'Ooh, lovely! 🌳'],
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
const settings = { speed: 1, playing: true, view: 'all', comms: true, teach: false };
// v6 chapters: each chapter starts when its mark is first hit in the story (see mark()). Blazor passes the same list (Models/Chapters.cs).
let CH_MARKS = ['start', 'dir', 'go', 'ob:vines', 'coach', 'ob:boulder', 'meet:0', 'ob:river', 'mm:0', 'sp:sinkhole', 'ob:bog', 'meet:1', 'ob:log', 'idea', 'ob:cliff', 'sp:treefall', 'ob:bees', 'sp:snake', 'ob:wall', 'break', 'meet:2', 'build', 'reality', 'finish'];
const JUMP_STEP = 1 / 60, TEACH_DELAY = 0.4;

// ---------- helpers ----------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const pick = (arr, i) => arr[((i % arr.length) + arr.length) % arr.length];
let seed = 20261017;
function rand() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
function rng(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
function call(method, ...args) { if (S && S.quiet) return; try { dotnet && dotnet.invokeMethodAsync(method, ...args); } catch (e) { /* ignore */ } }
function inZone(x, pad, types) {
  return OB_DEFS.concat(SURPRISE_DEFS).some(o => (!types || types.includes(o.type)) && x > o.x - pad && x < o.x + o.w + pad);
}

// ---------- world ----------
function makeObstacles() {
  return OB_DEFS.map(o => Object.assign({}, o, { prog: 0, spotted: false, informed: false, done: false, active: false, angry: 0, route: false }));
}
const ob = type => S.obstacles.find(o => o.type === type);
const sfx = (name, opts) => { if (S && !S.silent) snd.play(name, opts); };
function mark(key) {
  if (S.marks.has(key)) return; S.marks.add(key);
  let idx = S.chapter; CH_MARKS.forEach((m, i) => { if (i > idx && S.marks.has(m)) idx = i; });
  if (idx === S.chapter) return;
  S.chapter = idx; call('OnChapter', idx);
  // teaching mode: pause a moment after the chapter starts (so its first bubbles have faded in)
  if (settings.teach && !S.quiet && CH_MARKS[idx] !== 'finish') S.teachAt = { t: S.t + TEACH_DELAY, idx };
}

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
    if (inZone(x, 10, ['river', 'bog', 'log', 'wall', 'boulder'])) continue;
    if (Math.abs(x - GOAL_X) < PYR_HALF) continue;
    if (x > BREAK_X - 10 && x < BREAK_X + 140) continue; // the break clearing
    if (x > BUILD_X - 70 && x < GOAL_X + PYR_HALF + 30) continue; // the build site
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
  for (let x = 360; x < BUILD_X - 60; x += 115 + r() * 80) {
    if (inZone(x, 110)) continue;
    if ((x > SHRUBS.x0 - 70 && x < SHRUBS.x1 + 60) || Math.abs(x - COACH_X) < 90 || (x > BREAK_X - 20 && x < BREAK_X + 150)) continue;
    list.push({ x, hp: 1, cut: false, s: 0.85 + r() * 0.3 });
  }
  list.push({ x: COACH_X, hp: 1, cut: false, s: 1.15, coach: true });
  for (let k = 0; k < SHRUBS.n; k++) list.push({ x: SHRUBS.x0 + k * (SHRUBS.x1 - SHRUBS.x0) / (SHRUBS.n - 1), hp: 1, cut: false, s: 1.1 + (k % 3) * 0.08, shrub: true });
  return list.sort((a, b) => a.x - b.x);
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
  let off = 0;
  const b = ob('boulder');
  if (b.route) { const a = b.x - 70, z = b.x + b.w + 70; if (x > a && x < z) off += Math.sin(Math.PI * (x - a) / (z - a)) * 34; }
  // v5: Banjo's creek route runs in the foreground lane, beside the shrubs
  if (S.idea && S.idea.go && x > CREEK.x0 && x < CREEK.x1) off += Math.pow(Math.sin(Math.PI * (x - CREEK.x0) / (CREEK.x1 - CREEK.x0)), 0.5) * 30 * Math.min(1, S.idea.goT / 1.2);
  return off;
}

// ---------- state ----------
function reset() {
  seed = 20261017;
  S = {
    t: 0,
    obstacles: makeObstacles(),
    pathBushes: makePathBushes(),
    distractions: DISTRACTIONS.map(d => Object.assign({ done: false }, d)),
    surprises: SURPRISE_DEFS.map(d => Object.assign({}, d, { isSurprise: true, rev: 0, prog: 0, done: false, active: false, chainDone: false })),
    meetings: MEETINGS.map(m => Object.assign({ done: false }, m)),
    mgrMeetings: MGR_MEETINGS.map(m => Object.assign({ done: false, pending: false }, m)), day: 1,
    waiters: [],
    team: { x: START_X + 70, mode: 'idle', seq: null, step: 0, stepT: 0, stepStartX: 0, mood: '', m0: 0, m0y: 0,
      wrong: 0, surprises: 0, distractions: 0, priorities: 0, reported: 0, syncs: 0, upT: 0, seqStart: 0, cheer: 0, bush: null, hackT: 0, bushesCut: 0, cleared: 0,
      ideas: 0, breaks: 0, tired: false, fresh: 0, supplied: 0, lead: -1, leaf: -1, coached: false, onDone: null },
    mgr: { x: START_X + 140, y: MANAGER_Y, dy: 0, alert: 0, ready: false, ox: 0, oy: 0, rot: 0, dist: null, focusT: 0, meeting: null, task: null, busy: false },
    leader: { x: START_X + 260, y: LEADER_Y, beam: null, beamT: 0, ox: 0, oy: 0, rot: 0, dist: null, meeting: null },
    bubbles: [], queue: { leader: [], manager: [], team: [], visitor: [] }, pulses: [], events: [], particles: [],
    caption: '', phase: '', capT: 0, cap: null, capQ: [], pend: [], finished: false, introCam: 'team', selected: null, hover: -1,
    idea: { started: false, adopted: false, go: false, goT: 0, saved: 0, bulb: false }, drop: null, leafFly: null, kb: [], kpos: [], capBy: {}, capShown: null, huddle: { on: false, done: false, t: 0, spk: -1, wrapT: -1, capLater: false },
    coachDone: false, breakDone: false, marks: new Set(['start']), chapter: 0, silent: false, quiet: false, tapT: 0, tapN: 0, finArgs: null, teachAt: null,
    nextLeaderTalk: 26, leaderTalkI: 0, nextCheckin: 34, checkinI: 0,
    todo: [], water: null, visit: null, vests: false, gifts: { logs: null, ropeDeal: false, ladderDeal: false, ropeTaken: false, visitQueued: false, ladder: false }, // v7.6
    busy: { idleT: 0, next: 0, n: 0, rings: [], marks: {}, bubble: null, cap: null, capI: 0, log: [], capLog: [] }, // v7.4: the Leader's outreach
    build: { on: false, t0: 0, c: [0, 0, 0, 0, 0, 0], wrongP: 0, wrongShow: false, pl: [0, 0, 0, 0, 0, 0, 0], doneK: [], rampL: -1, rampG: 0, ladder: 0,
      rollers: false, cap: null, capSet: false, solid: 0, stock: 0, shaped: 0, rejects: 0, skills: [], kp: null, kpOn: false, tgt: null, mt: null, mcarry: false, check: 0, climbR: null, downR: null, clearT: null },
  };
  camX = camTarget = 0;
  call('OnRestarted');
  call('OnDay', 1);
  scheduleIntro();
}

function stats() { const t = S.team; call('OnStats', t.wrong, t.surprises, t.distractions, t.priorities, t.reported, t.syncs, t.ideas); }
function later(delay, fn) { S.events.push({ at: S.t + delay, fn }); }
function whenFree(cond, fn) { S.pend.push({ cond, fn }); }
function whenReady(cond, fn) { S.todo.push({ cond, fn }); } // v7.6: follow-ups that wait without holding up routine talk
const mgFree = () => { const m = S.mgr; return m.ready && !m.dist && !m.meeting && !m.task && !m.busy; };
// v5: captions queue instead of cutting each other off. Every caption stays up for at least CAP_MIN seconds;
// a caption can also hold the bar (for seconds, or while a predicate is true), e.g. for the length of a meeting.
// Queued captions are dropped once they're stale (or no longer match what's on screen), so the bar never lags behind.
const CAP_MIN = 1.8, CAP_STALE = 6;
// Priorities: 0 = routine (spotted / refocus / cleared), 1 = normal, 2 = key moments (surprises, meetings, v5 moments).
// A key moment can cut short a routine caption; routine captions go stale quickly.
const LOW_PHASES = ['Communication', 'Refocus', 'Execution', 'Everyday work', 'Focus'];
function caption(text, phase, opts = {}) {
  const ph = phase || S.phase;
  const it = { text, phase: ph, hold: opts.hold, valid: opts.valid, at: S.t, prio: opts.prio != null ? opts.prio : LOW_PHASES.includes(ph) ? 0 : (ph === ph.toUpperCase() || opts.hold ? 2 : 1) };
  if (opts.force) S.capQ = [];
  else if (capHeld(it.prio)) { S.capQ.push(it); if (S.capQ.length > 5) S.capQ.shift(); return; }
  showCaption(it);
}
function capHeld(prio = 1) {
  const c = S.cap; if (!c) return false;
  if (prio >= 2 && c.prio === 0 && S.t - c.shown > 0.8) return false;
  if (S.t - c.shown < CAP_MIN) return true;
  if (typeof c.hold === 'function') return !!c.hold();
  if (typeof c.hold === 'number') return S.t - c.shown < c.hold;
  return false;
}
// v7.3: every caption belongs to one or more roles (L = Leader, M = Manager, T = Team), so each perspective can show only
// its own narration. First matching rule wins: [phase, text (optional), roles, role-specific wording (optional)].
const CAP_RULES = [
  [/^Goal reached$/, null, 'LMT'],
  [/^VISION → REALITY$/, null, 'LT'],
  [/^Vision$/, null, 'L'],
  [/^Big picture$/, null, 'L'], // v7.4: the Leader's outreach to other teams (shown via S.busy.cap, see updateOutreach)
  [/^Direction$/, null, 'LM'],
  [/^Planning$/, /koalas argue/, 'T'],
  [/^(Planning|Communication|Manager meeting|SUPPORT)$/, null, 'M'],
  [/^LEADER SUPPORT$/, /safety gear the Leader said yes to/, 'LMT'], // v7.6
  [/^SHARING$/, null, 'MT'], // v7.6: managers sharing resources, seen arriving with the team
  [/^LEADER SUPPORT$/, /supply drop/, 'LT', { T: 'Help from above: saws and safety gear float down through a gap in the canopy. 🪂' }],
  [/^(Meeting|Priorities|Focus|LEADER SUPPORT)$/, null, 'L'],
  [/^(Distraction|Refocus)$/, /Leader/, 'L'],
  [/^(Distraction|Refocus)$/, null, 'M'],
  [/^COACHING$/, /struggling|Wattle cuts/, 'MT'],
  [/^COACHING$/, null, 'M'],
  [/^(DELEGATION|RECOGNITION)$/, null, 'MT'],
  [/^WELLBEING$/, /owl calls|Nobody calls|Water break/, 'MT'],
  [/^COURSE CORRECTION$/, /Credit flows/, 'LT'],
  [/^COURSE CORRECTION$/, null, 'L'],
  [/^SURPRISE$/, /report the surprise straight up/, 'TM', { M: 'The koalas report a surprise up to the Manager: the owl listens, then takes it up the chain.' }],
  [/^SURPRISE$/, /escalates it to the Leader/, 'ML', { L: 'The Manager brings the Leader the facts: what happened, what the team needs, and the likely delay.' }],
  [/^SURPRISE$/, /Leader accepts the delay/, 'LT', { T: 'Word comes back down from the Leader: safety first, take the time. The goal stays the same.' }],
  [/^No communication$/, /^The Manager spots/, 'M'],
  [/^No communication$/, /final product/, 'TL'],
  [/^No communication$/, /coach/, 'TM'],
  [/^BUILD$/, /owl relays progress/, 'MLT', { T: 'Layer 5 of 6: the koalas keep the blocks coming, one after another.', L: 'Progress comes up from the build: "Layer 4 done, two to go!" The Leader always knows where things stand.' }],
  [/^BUILD$/, /nobody up top knows/, 'TL'],
  [/^BUILD$/, /Leader's vision/, 'TL'],
  [/^BUILD$/, /No owl|nobody organising/i, 'TM'],
  [/^Obstacle$/, /The Manager (spotted|mapped|found)|the Manager has arranged/, 'MT'],
  [null, null, 'T'], // everything else is the team's story: everyday work, obstacles, surprises, ideas, the break, the build
];
function capInfo(text, phase) {
  const R = CAP_RULES.find(([pr, tr]) => (!pr || pr.test(phase)) && (!tr || tr.test(text)));
  const roles = [...R[2]].map(c => ({ L: 'leader', M: 'manager', T: 'team' })[c]);
  const alt = {}; if (R[3]) for (const [k, v] of Object.entries(R[3])) alt[{ L: 'leader', M: 'manager', T: 'team' }[k]] = v;
  return { roles, alt };
}
const CAP_PLACEHOLDER = { leader: ['Watching the Leader... 🦅', 'Leader'], manager: ['Watching the Manager... 🦉', 'Manager'], team: ['Watching the koalas... 🐨', 'Team'] };
// What the caption bar shows: everything in the Everything view, otherwise the latest caption for that role.
function emitCaption(force) {
  const v = settings.view; let text, phase;
  if (v === 'all' || !CAP_PLACEHOLDER[v]) {
    const bc = S.busy && S.busy.cap; // v7.4: a Leader outreach caption shows until the story's next caption
    if (bc && (!S.cap || bc.t > S.cap.shown)) { text = bc.text; phase = bc.phase; }
    else { if (!S.cap) return; text = S.cap.text; phase = S.cap.phase; }
  }
  else { const c = S.capBy[v]; if (c) { text = c.text; phase = c.phase; } else [text, phase] = CAP_PLACEHOLDER[v]; }
  const role = v === 'all' ? '' : v, key = text + '|' + phase + '|' + role;
  if (!force && key === S.capShown) return;
  S.capShown = key; call('OnCaption', text, phase, role);
}
// v7.5: an optional trace of everything shown (speech, captions, cards, badges) for the script export; null in normal use.
let TRACE = null;
function showCaption(it) {
  it.shown = S.t; S.cap = it; S.caption = it.text; S.capT = S.t; S.phase = it.phase;
  const ci = capInfo(it.text, it.phase); it.roles = ci.roles;
  for (const r of ci.roles) S.capBy[r] = { text: ci.alt[r] || it.text, phase: it.phase, t: S.t };
  if (TRACE) TRACE('caption', it.text, it.phase, ci.roles, ci.alt);
  emitCaption();
}
function pumpCaptions() {
  if (!S.capQ.length) return;
  S.capQ = S.capQ.filter(c => S.t - c.at < (c.prio === 0 ? 3 : CAP_STALE) && (!c.valid || c.valid()));
  if (!S.capQ.length) return;
  const best = S.capQ.reduce((a, c) => c.prio > a.prio ? c : a, S.capQ[0]);
  if (capHeld(best.prio)) return;
  S.capQ.splice(S.capQ.indexOf(best), 1); showCaption(best);
}
// A badge shown under one koala's feet (name + what they did), so it never collides with the speech bubbles.
function kbadge(i, text, dur, col = '#ffd34d') { if (TRACE) TRACE('badge', KOALAS[i].name, text); sfx('sparkle'); S.kb = S.kb.filter(b => b.i !== i); S.kb.push({ i, text, t: dur, dur, col }); }
// Speech bubbles: one per speaker on screen at a time; extra lines queue up so nothing overlaps or gets lost.
const MIN_SHOW = 1.6;
function bubble(who, text, dur = 3.2, priority = false) {
  if (who === 'team' && !settings.comms && /hello\?|anyone up there|tell someone/i.test(text)) sfx('echo');
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
  if (TRACE) TRACE('bubble', who, text, who === 'visitor' && (S.visit || S.mgr.meeting) ? (S.visit || S.mgr.meeting).def.label : null);
  S.bubbles = S.bubbles.filter(b => b.who !== who);
  S.bubbles.push({ who, text, t: 0, dur });
}
function pulse(from, to, color, onArrive, dur = 1.3) {
  sfx('pulse', { from, to }); S.pulses.push({ from, to, color, onArrive, t: 0, dur }); }
const PULSE_COL = { leader: '#ffd34d', manager: '#c792ff', team: '#5dd3ff' };
// A message that travels: speaker says it, a pulse carries it, the listener replies.
function say(from, to, text, reply, onArrive) {
  bubble(from, text, 3);
  pulse(from, to, PULSE_COL[from], () => { if (reply) bubble(to, reply, 2.8); onArrive && onArrive(); });
}

function agentPos(who) {
  if (who === 'leader') return { x: S.leader.x + S.leader.ox, y: S.leader.y + S.leader.oy };
  if (who === 'manager') return { x: S.mgr.x + S.mgr.ox, y: S.mgr.y + S.mgr.oy };
  if (who === 'visitor') return S.visit ? visitPos() : S.mgr.meeting ? mgrVisitorPos() : { x: -9999, y: 0 };
  const B = S.build, Hd = S.huddle;
  if (Hd.on && Hd.spk >= 0 && S.kpos[Hd.spk]) { const K = S.kpos[Hd.spk]; return { x: K.x, y: K.y - 60 * K.s / KOALA_SCALE }; }
  if (B.on && B.kpOn) { const ax = B.kp.reduce((a, P) => a + P.x, 0) / 4, ay = B.kp.reduce((a, P) => a + P.y, 0) / 4; return { x: ax, y: ay - 62 }; }
  const tx = S.team.x;
  const lo = laneOffset(tx);
  return { x: tx - MEMBER_GAP * 1.5, y: memberY(tx) - 62 * (1 + lo / 120) + lo };
}

function scheduleIntro() {
  caption('High above the canopy, the Leader can see where the team is right now, already hard at work... ', 'Vision');
  S.leader.beam = 'team'; S.leader.beamT = 2.6;
  later(2.6, () => {
    S.introCam = 'goal'; sfx('screech');
    S.leader.beam = 'goal'; S.leader.beamT = 3.2;
    caption('...and holds the vision of the end goal: a golden pyramid above the canopy, far to the east. The koalas will build it.', 'Vision');
    bubble('leader', 'There it is: the vision! 🔺', 3);
  });
  later(5.8, () => {
    S.introCam = null; mark('dir');
    caption('The Leader shares the vision and the direction with the Manager below the canopy.', 'Direction');
    say('leader', 'manager', 'Head east: that\'s where we build the pyramid.', 'Got it. I\'ll scout a route.', () => {
      caption('The Manager turns the vision into a plan, flying ahead under the canopy to scout the way.', 'Planning');
      S.mgr.ready = true;
      later(1.4, kickOffTeam);
    });
  });
}

function kickOffTeam() {
  mark('go');
  if (settings.comms) {
    say('manager', 'team', 'Koalas, we\'re heading east to the build site! I\'ll warn you about hazards. 🧭', 'East it is! Tools out! 🐨💪', () => {
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
      { dur: 0.6, mood: 'work', cap: 'Warned about the vines, the koalas arrive with their cutting tools ready and clear a path straight through.', say: 'Tools out! ✂️' },
      { dur: 2.6, mood: 'work', prog: true },
    ] : [
      { dur: 1.6, mood: 'stuck', cap: 'Nobody warned them: the koalas walk into a tangle of vines and get stuck!', say: 'We\'re stuck! 😩', surprise: true },
      { dur: 1.8, mood: 'confused', move: -70, wrong: true, cap: 'Someone runs all the way back for better tools...' },
      { dur: 1.6, mood: 'walk', move: 70 },
      { dur: 3.4, mood: 'work', prog: true, cap: 'Finally, they start hacking through the vines.' },
    ];
    case 'boulder': return informed ? [
      { dur: 0.6, mood: '', cap: 'Warned early, the koalas know the boulder is too big to go around, and the Manager has arranged training.', say: 'Training time! 🎓' },
      { dur: 3.0, train: true, cap: 'Investing in team skills: a quick training session. The koalas learn to use hammers and chisels.', say: 'Training: hammer and chisel! 🔨' },
      { dur: 5.4, mood: 'chisel', form: 'rock', prog: true, cap: 'Upskilled! Together the koalas break the boulder down: tap, tap, tap... cracks appear, then it splits.', say: 'Tap... tap... TAP! 🔨', onStart: () => { S.team.upT = 3.6; } },
      { dur: 1.8, mood: 'walk', move: o.w + 40, cap: 'The rubble is swept aside off the path. The new skills stay with the team for the rest of the journey.' },
    ] : [
      { dur: 1.2, mood: 'stuck', cap: 'BONK! The koalas walk straight into a giant boulder.', say: 'Ouch! A boulder?! 💥', surprise: true },
      { dur: 2.2, mood: 'work', cap: 'They try to push it out of the way. It doesn\'t budge.', say: 'Push! PUSH!' },
      { dur: 2.0, mood: 'confused', move: -90, wrong: true, cap: 'Wrong turn: they back-track looking for a way around. There isn\'t one.', say: 'Which way now? 🤷' },
      { dur: 1.6, mood: 'walk', move: 90 },
      { dur: 4.4, train: true, slow: true, cap: 'Nobody arranged any training, so the koalas teach themselves hammer and chisel by trial and error.', say: 'How does this hammer work?? 🤔' },
      { dur: 7.2, mood: 'chisel', form: 'rock', prog: true, cap: 'Self-taught at last, they chip away at the boulder. It takes much longer.', say: 'Tap... ow... tap...', onStart: () => { S.team.upT = 3.6; } },
      { dur: 1.8, mood: 'walk', move: o.w + 40, cap: 'Finally, rubble. Skills built the hard way.' },
    ];
    case 'river': return informed ? [
      { dur: 0.6, mood: 'work', cap: 'The Manager spotted the river early, so the koalas know exactly what they need: logs for a bridge.' },
      { dur: 2.8, mood: '', phase: 'DELEGATION', cap: 'Delegation: the Manager hands Kip the lead on the bridge build. Growing people means trusting them with real responsibility.',
        onStart: () => { S.team.lead = 0; kbadge(0, '⭐ Kip leads the build', 9); say('manager', 'team', 'Kip, would you like to lead the bridge build? ⭐', 'Kip: On it! Follow me, team! 🌟'); } },
      { dur: 4.2, gather: 'logs', cap: 'Gathering materials: Kip sends the koalas into the bush to pick up logs and carry them back to the bank.', say: 'Kip: Spread out, grab logs! 🪵' },
      // v7.6: the Ops manager's spare logs go into the bridge too, so the build starts once they've landed
      { dur: 0.4, mood: 'work', until: () => !settings.comms || (S.gifts.logs && S.gifts.logs.t > 1.3) || (S.mgrMeetings[0].done && !S.mgr.meeting) },
      { dur: 3.4, mood: 'work', prog: true, cap: 'Logs gathered, Kip directs the build and the bridge goes up.' },
    ] : [
      { dur: 1.0, mood: 'confused', cap: 'A river! Nobody saw it coming.', say: 'A river?! 😮', surprise: true },
      { dur: 1.8, mood: 'stuck', m0: p => Math.sin(Math.PI * p) * 60, cap: 'SPLASH! One brave koala tries to wade across. Far too deep!', say: 'Too deep! 💦' },
      { dur: 5.8, gather: 'logs', lost: true, wrong: true, cap: 'Nobody told them what to bring, so the koalas scatter into the bush hunting for anything that floats...', say: 'Logs? Sticks? Anything?! 🤷' },
      { dur: 4.2, mood: 'work', prog: true, cap: '...and slowly build a bridge by trial and error.' },
    ];
    case 'bog': return informed ? [
      { dur: 0.6, mood: 'work', cap: 'The Manager mapped the firm spots in the bog, so the koalas know they need flat stepping stones.', say: 'Find flat stones! 🪨' },
      { dur: 4.0, gather: 'stones', cap: 'Gathering materials: the koalas head off the path, pick up flat stones and carry them back.' },
      { dur: 2.8, mood: 'work', prog: true, cap: 'Stone by stone, they lay stepping stones and hop across.' },
    ] : [
      { dur: 1.0, mood: 'confused', cap: 'Squelch! A smelly bog nobody mentioned.', say: 'Ew, a bog?! 🤢', surprise: true },
      { dur: 2.0, mood: 'stuck', m0: p => Math.sin(Math.PI * p) * 50, cap: 'One koala steps in and sinks up to its tummy!', say: 'Help, I\'m sinking! 😱' },
      { dur: 5.6, gather: 'stones', lost: true, wrong: true, cap: 'They wander off the path to hunt for rocks, not sure what size they need...', say: 'Which rocks?? 🤔' },
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
      { dur: 0.6, mood: 'work', cap: 'The Manager found the safe spot to climb down. The koalas need rope, so they collect long vines to braid one.', say: 'Grab long vines! 🌿' },
      { dur: 3.8, gather: 'vines', cap: 'Gathering materials: the koalas fan out and drag long vines back to braid into a rope.' },
      { dur: 2.4, mood: 'work', prog: true, cap: 'Rope braided and tied off at the marked spot, they abseil down the cliff.' },
    ] : [
      { dur: 1.2, mood: 'stuck', cap: 'Dead end! The ground just drops away at a cliff.', say: 'Whoa! A cliff! 😱', surprise: true },
      { dur: 2.4, mood: 'confused', move: -80, wrong: true, cap: 'Wrong turn: they wander along the edge looking for a way down...', say: 'Maybe further back?' },
      { dur: 1.8, mood: 'confused', move: 80, say: 'Nope... back again.' },
      { dur: 4.4, gather: 'vines', lost: true, cap: 'No rope, so they hunt around for anything long and strong...', say: 'Will vines work?? 🤔' },
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
    case 'wall': return informed && S.gifts.ladder ? [ // v7.6: Project Manager B kept their word
      { dur: 0.8, mood: 'work', cap: 'Project Manager B kept their word: the promised ladder is waiting at the rock wall. 🪜', say: 'Thanks to Project Manager B\'s ladder! 🪜' },
      { dur: 1.6, mood: 'work', cap: 'Kip has a good look at how it\'s lashed together. Handy to know for later!', onStart: () => kbadge(0, '🪜 Kip studies the lashing', 6) },
      { dur: 2.2, mood: 'work', prog: true, cap: 'Sharing pays off: no poles to gather, so up the borrowed ladder they go!' },
    ] : informed ? [
      { dur: 0.6, mood: 'work', cap: 'Warned about the rock wall, the koalas know they need a ladder.', say: 'Poles for a ladder! 🪜' },
      { dur: 4.0, gather: 'poles', cap: 'Gathering materials: the koalas collect straight poles from the bush to lash into a ladder.' },
      { dur: 2.2, mood: 'work', prog: true, cap: 'Ladder lashed together, and up it goes!' },
    ] : [
      { dur: 1.2, mood: 'stuck', cap: 'A sheer rock wall! Nobody brought a ladder.', say: 'How do we get up THAT? 😰', surprise: true },
      { dur: 2.0, mood: 'work', m0y: p => -Math.sin(Math.PI * p) * 46, cap: 'One koala tries to climb with bare paws... and slides back down.', say: 'Whoooa!' },
      { dur: 5.6, gather: 'poles', lost: true, wrong: true, cap: 'They head back into the bush to find sticks, any sticks...', say: 'Need sticks! Lots of sticks!' },
      { dur: 3.4, mood: 'work', prog: true, cap: '...and lash together a wobbly ladder.' },
    ];
  }
  return [];
}

// ---------- v7.6: promises that visibly happen ----------
// The Manager's "Water break at the next clearing!" check-in: at the next stretch of clear track the koalas stop and drink.
function waterBreakCheck() {
  const tm = S.team;
  if (S.build.on || tm.x > BUILD_X - 300) { S.water = null; return; }
  if (!waterSpot(70)) return;
  S.water.pending = false;
  runSeq([
    { dur: 0.7, mood: '', phase: 'WELLBEING', cap: 'Water break: rest and rehydrate keeps the team going 💧', capPrio: 2,
      onStart: () => bubble('manager', 'Here\'s the clearing. Drink up, team! 💧', 2.4, true) },
    { dur: 2.8, mood: 'drink', phase: 'WELLBEING', onStart: () => later(0.6, () => bubble('team', 'Ahh, that hits the spot! 💧', 2.4)) },
    { dur: 0.4, mood: '', phase: 'WELLBEING', onStart: () => { tm.fresh = 1.6; } },
  ], null, () => { S.water = null; });
}
function waterSpot(d) {
  const tm = S.team, bush = S.pathBushes.find(b => !b.cut && !(b.shrub && S.idea.go) && b.x > tm.x - 10);
  return tm.x < BUILD_X - 400 && clearAhead(d) && !(bush && bush.x - tm.x < 60) && !(tm.x > SHRUBS.x0 - 80 && tm.x < SHRUBS.x1 + 60);
}
function clearAhead(d) { const tm = S.team, n = S.obstacles.concat(S.surprises).filter(o => !o.done && o.x > tm.x).sort((a, b) => a.x - b.x)[0]; return !n || n.x - tm.x > d; }
// Lines in a manager meeting that commit to something (comms ON only: with comms OFF the Manager can't commit).
function mmLine(M, i) {
  if (!settings.comms) return;
  const d = M.def, G = S.gifts;
  if (d.ob === 'river' && i === 2) { // "Done." The Ops manager's spare logs drop by the river
    const v = mgrVisitorPos(), r = ob('river');
    G.logs = { t: 0, x: r.x - 24, fx: v.x, fy: v.y, p0: r.prog, fade: 0 }; sfx('flap');
    later(1.2, () => caption('Managers sharing resources: the Ops team\'s spare logs land by the river, and the koalas build them into the bridge. 🪵', 'SHARING', { force: true, hold: 2.6 }));
    later(1.5, () => bubble('team', 'Kip: Spare logs from the Ops team? Thanks! 🪵', 2.6));
  }
  if (d.ob === 'cliff' && i === 1) G.ropeDeal = true;
  if (d.ob === 'cliff' && i === 3) G.ladderDeal = true;
}
// Project Manager B comes back for the shared rope once the koalas are down the cliff, and leaves the ladder at the wall.
function ropeVisitCheck() {
  const G = S.gifts;
  if (!settings.comms || !G.ropeDeal || G.visitQueued || !ob('cliff').done || S.mgr.meeting) return;
  G.visitQueued = true;
  whenReady(() => mgFree() && !S.pulses.length && !S.queue.manager.length && !S.bubbles.some(b => b.who === 'manager') && !(S.team.seqOb && S.team.seqOb.isSurprise) && !S.surprises.some(o => o.active && !o.done), () => {
    S.visit = { def: S.mgrMeetings.find(m => m.ob === 'cliff'), phase: 'in', t: 0, said: 0 }; sfx('hoot', { visitor: true });
  });
}
const VISIT_PH = { in: 1.8, talk: 5.4, out: 1.8 };
function updateVisit(dt) {
  const V = S.visit, G = S.gifts; V.t += dt;
  if (V.phase === 'talk') {
    if (V.said === 0 && V.t >= 0.2) { V.said = 1; bubble('team', 'Kip: Here\'s our rope, all yours! 🪢', 2.4); }
    if (V.said === 1 && V.t >= 1.5) { V.said = 2; G.ropeTaken = true; sfx('chirp'); }
    if (V.said === 2 && V.t >= 1.7) { V.said = 3; bubble('visitor', 'Got the rope, thanks! 🪢 Your ladder\'s waiting at the rock wall. 🪜', 2.6); }
    if (V.said === 3 && V.t >= 3.4) { V.said = 4; bubble('manager', 'You\'re a legend, thanks! 🤝', 2.4); }
  }
  if (V.t >= VISIT_PH[V.phase]) {
    V.t = 0;
    if (V.phase === 'in') V.phase = 'talk';
    else if (V.phase === 'talk') {
      V.phase = 'out';
      if (G.ladderDeal) { G.ladder = true; caption('Managers keep their promises: Project Manager B collects the shared rope and leaves a ladder at the rock wall. 🪜', 'SHARING', { prio: 2 }); }
    } else S.visit = null;
  }
}
function visitPos() {
  const V = S.visit, bx = S.mgr.x + S.mgr.ox + 190, by = MANAGER_Y + 70 + Math.sin(S.t * 2.4) * 4; // beside the Manager, above the koalas
  const p = Math.min(1, V.t / VISIT_PH[V.phase]), q = ease(p);
  if (V.phase === 'in') return { x: bx + (1 - q) * 520, y: by - (1 - q) * (1 - q) * 260 };
  if (V.phase === 'out') return { x: bx + q * 900, y: by - q * q * 240 };
  return { x: bx, y: by };
}
function drawVisit() {
  const V = S.visit; if (!V) return;
  const v = visitPos(), x = v.x - camX, y = v.y, d = V.def;
  if (x < -80 || x > viewW + 80) return;
  if (V.phase === 'talk' && !S.gifts.ropeTaken && V.t > 0.5) { // the koalas pass the coiled rope up to Project Manager B
    const tp = agentPos('team'), q = ease(clamp((V.t - 0.5) / 1.0, 0, 1));
    drawItem('vines', lerp(tp.x - camX, x - 2, q), lerp(tp.y + 30, y + 26, q) - Math.sin(Math.PI * q) * 30, 0.9);
  }
  if (S.gifts.ropeTaken) drawItem('vines', x - 2, y + 26, 0.9);
  if (V.phase === 'out' && S.gifts.ladderDeal) drawItem('poles', x + 4, y + 30, 0.9);
  drawOwlShape(x, y, d.body, d.wing, d.belly, V.phase === 'talk' ? 8 : 14);
  tag(x, y + 34 + (S.gifts.ropeTaken ? 14 : 0), d.label, d.belly);
}
// The Ops logs: they arc down from the visiting owl, land in a pile by the river and get used up as the bridge goes in.
function drawGiftLogs() {
  const L = S.gifts.logs; if (!L) return;
  const r = ob('river'), gy = groundBase(L.x) - 4;
  const left = r.prog >= 1 ? 0 : Math.ceil(3 * clamp((1 - r.prog) / Math.max(0.05, 1 - L.p0), 0, 1));
  const a = r.prog >= 1 ? Math.max(0, 1 - L.fade / 3) : 1;
  if (a <= 0) return;
  const x = L.x - camX; if (x < -120 || x > viewW + 120) return;
  ctx.save(); ctx.globalAlpha = a;
  if (L.t < 1.1) { // falling
    const q = ease(L.t / 1.1);
    for (let k = 0; k < 3; k++) drawItem('logs', lerp(L.fx - camX, x + (k - 1) * 20, q), lerp(L.fy + 20, gy - (k === 2 ? 9 : 0), q) - Math.sin(Math.PI * q) * 40, 1.4);
  } else {
    for (let k = 0; k < left; k++) drawItem('logs', x + (k === 2 ? 0 : (k - 0.5) * 20), gy - (k === 2 ? 9 : 0), 1.4);
    tag(x, gy - 30, left > 0 ? '🤝 SPARE LOGS FROM THE OPS TEAM' : '🤝 OPS LOGS: IN THE BRIDGE ✅', '#d3f0e8');
  }
  ctx.restore();
}
// Leader meeting follow-through: what the Leader said yes to reaches the team.
function meetingFollowUp(d) {
  const idx = S.meetings.indexOf(d);
  const free = () => mgFree() && !S.pulses.length && !S.leader.meeting && !S.queue.manager.length && !S.bubbles.some(b => b.who === 'manager') && S.team.mode === 'walk' && clearAhead(300);
  if (idx === 0) whenReady(free, () => say('leader', 'manager', 'Safety gear for the koalas: approved! 🦺 It\'s on its way.', 'Brilliant, thanks boss! 🦺', () => {
    if (!settings.comms) { later(1.2, () => bubble('manager', '(...keeps it to themselves 🤐)', 2.4)); return; }
    later(1.4, () => say('manager', 'team', 'New safety vests for everyone, from the boss! 🦺', 'Ooh, safety first! Thanks! 🦺', () => {
      S.vests = true; kbadge(2, '🦺 New safety vests', 4.5, '#ffcc80');
      caption('Leaders back the team: the safety gear the Leader said yes to reaches the koalas, and on go the new hi-vis vests. 🦺', 'LEADER SUPPORT', { prio: 2 });
    }));
  }));
  if (idx === 1) whenReady(free, () => say('leader', 'manager', 'Here\'s Product\'s better map for you! 🗺️', 'Thanks! That makes scouting much easier. 🗺️'));
}

function runSeq(steps, obstacle, onDone = null) {
  const tm = S.team;
  tm.mode = 'seq'; tm.seq = steps; tm.step = 0; tm.stepT = 0; tm.stepStartX = tm.x; tm.seqOb = obstacle; tm.seqStart = S.t; tm.onDone = onDone;
  if (obstacle) {
    mark((obstacle.isSurprise ? 'sp:' : 'ob:') + obstacle.type);
    if (obstacle.isSurprise) { sfx('sting'); sfx({ sinkhole: 'sinkhole', treefall: 'treefall', snake: 'hiss' }[obstacle.type]); }
  }
  startStep();
}
function startStep() {
  const tm = S.team, st = tm.seq[tm.step], seq = tm.seq, idx = tm.step;
  if (st.cap) caption(st.cap, st.phase || (tm.seqOb ? (tm.seqOb.isSurprise ? 'SURPRISE' : 'Obstacle') : S.phase), { valid: () => tm.seq === seq && tm.step === idx || (idx === 0 && S.t - tm.seqStart < 4), hold: st.capHold, prio: st.capPrio != null ? st.capPrio : idx === 0 && tm.seqOb ? 2 : undefined });
  if (st.say) bubble('team', st.say, Math.max(2, st.dur + 0.6));
  const words = (st.cap || '') + ' ' + (st.say || '');
  if (/SPLASH/.test(words)) sfx('splash'); else if (/sinks|Squelch/.test(words)) sfx('squelch'); else if (/BONK/.test(words)) sfx('thud');
  else if (/BZZZ/.test(words)) sfx('swarm'); else if (/slide/.test(words)) sfx('rustle');
  if (st.train) sfx('idea'); if (st.mood === 'chisel') sfx('sparkle');
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
  if (st.bushHp && tm.bush) { tm.bush.hp = lerp(st.bushHp[0], st.bushHp[1], p); if (rand() < dt * 14) leaf(tm.bush.x - 4, groundBase(tm.bush.x) - 14 - rand() * 14); }
  if (st.rev && tm.seqOb) tm.seqOb.rev = Math.max(tm.seqOb.rev, p);
  if (st.tick) st.tick(p, dt);
  if (p >= 1 && (!st.until || st.until())) {
    tm.step++; tm.stepT = 0; tm.stepStartX = tm.x;
    if (tm.step >= tm.seq.length) {
      const o = tm.seqOb, done = tm.onDone;
      tm.seq = null; tm.seqOb = null; tm.onDone = null; tm.mode = 'walk'; tm.mood = ''; tm.m0 = 0; tm.m0y = 0;
      if (done) done();
      else if (o) obstacleCleared(o);
      else caption('Eventually the koalas pick a direction and head off, unsure if it\'s right.', 'Execution');
    } else startStep();
  }
}
function obstacleCleared(o) {
  const tm = S.team;
  o.done = true; o.prog = 1; o.active = false;
  if (o.type === 'cliff') later(1.0, ropeVisitCheck); // v7.6
  const days = Math.max(1, Math.round((S.t - tm.seqStart) / SEC_PER_DAY));
  const Name = o.name[0].toUpperCase() + o.name.slice(1);
  if (o.isSurprise) {
    tm.cheer = 1.0;
    caption(settings.comms
      ? `Surprise handled! The ${o.name} cost ${dd(days)}, but everyone knew why and the goal stayed the same.`
      : `Handled alone: the ${o.name} cost ${dd(days)}, and nobody up top even knew.`, 'Execution');
    bubble('team', pick(CHEERS, tm.cleared + 2), 2.2);
    if (settings.comms) later(1.0, () => say('manager', 'leader', `${o.icon} ${o.name[0].toUpperCase() + o.name.slice(1)} sorted. Back on track!`, 'Great recovery, team! 🦅'));
    return;
  }
  tm.cleared++; tm.cheer = 1.0;
  if (o.informed) caption(`${Name} cleared in ${dd(days)}! The koalas push on through the undergrowth.`, 'Execution');
  else {
    const plan = Math.max(1, Math.round(sequenceFor(o, true).reduce((a, st) => a + st.dur, 0) / SEC_PER_DAY));
    caption(`${Name} cleared, but going in blind took ${dd(days)} instead of about ${dd(plan)}.`, 'Execution');
  }
  bubble('team', pick(CHEERS, tm.cleared), 2.2);
  if (o.type === 'bees' && settings.comms) { later(0.8, () => whenFree(mgFree, startRecognition)); return; }
  // Manager reports progress up; the Leader recognises the team.
  later(1.0, () => say('manager', 'leader', `${o.icon} ${o.name[0].toUpperCase() + o.name.slice(1)} cleared! ✅`, null, () => {
    if (tm.cleared % 2 === 1 || !settings.comms) bubble('leader', pick(RECOGNITION, tm.cleared >> 1), 2.8);
    else bubble('leader', 'Good progress. Keep going!', 2.4);
    if (settings.comms && o.type === 'river' && tm.lead === 0) whenFree(mgFree, () => say('manager', 'team', 'Great leading, Kip! The boss noticed. ⭐', 'Kip: Thanks! Team effort! 😊', () => { tm.lead = -1; }));
    else if (settings.comms && tm.cleared % 2 === 1) later(0.6, () => say('manager', 'team', 'The boss says great work! 🌟', 'Thanks boss! 😊'));
  }));
}

// ---------- update ----------
function update(dt) {
  S.t += dt;
  for (const e of S.events.slice()) if (S.t >= e.at) { S.events.splice(S.events.indexOf(e), 1); e.fn(); }
  for (const w of S.pend.slice()) if (w.cond()) { S.pend.splice(S.pend.indexOf(w), 1); w.fn(); }
  for (const w of S.todo.slice()) if (w.cond()) { S.todo.splice(S.todo.indexOf(w), 1); w.fn(); }
  pumpCaptions();
  const tm = S.team, mg = S.mgr, ld = S.leader;
  tm.cheer = Math.max(0, tm.cheer - dt);
  tm.upT = Math.max(0, tm.upT - dt);
  tm.fresh = Math.max(0, tm.fresh - dt); tm.supplied = Math.max(0, tm.supplied - dt);
  for (const b of S.kb) b.t -= dt; S.kb = S.kb.filter(b => b.t > 0);
  if (S.idea.go) S.idea.goT += dt;
  if (S.leafFly) { S.leafFly.t += dt; if (S.leafFly.t > 1.0) S.leafFly = null; }
  if (S.drop) { const D = S.drop; D.t += dt; if (!D.landed && D.t >= 3.0) { D.landed = true; sfx('thud'); tm.supplied = 3.2; for (let i = 0; i < 10; i++) leaf(D.x, GROUND - 10); } if (D.sp.done) D.fade = (D.fade || 0) + dt; if (D.fade > 1) S.drop = null; }
  if (!S.finished) { const d = dayOf(S.t); if (d !== S.day) { S.day = d; call('OnDay', d); } }
  if (tm.mood === 'chisel' && rand() < dt * 16) { const b = S.build.on ? { x: STOCK_X - 40, w: 80 } : ob('boulder'); S.particles.push({ kind: 'confetti', x: b.x + 4 + rand() * (b.w - 8), y: GROUND - 14 - rand() * (S.build.on ? 20 : 60), vx: -40 - rand() * 80, vy: -60 - rand() * 90, r: 0, vr: 6, life: 0.7, c: rand() < 0.5 ? '#8a8d91' : '#b9bcc0' }); }

  if (!S.silent) audioTick(dt);
  if (S.teachAt && S.t >= S.teachAt.t) { const i = S.teachAt.idx; S.teachAt = null; if (settings.teach) { settings.playing = false; snd.setPaused(true); call('OnTeachable', i); } }

  // --- team ---
  tm.moved = tm.lastX != null && Math.abs(tm.x - tm.lastX) > 1e-4; tm.lastX = tm.x; tm.stillT = tm.moved ? 0 : (tm.stillT || 0) + dt; // v7.1: walk cycles only when actually moving
  if (S.huddle.on) updateHuddle(dt);
  if (tm.mode === 'walk' && !S.breakDone && tm.x >= BREAK_X && !S.finished && (!settings.comms || mgFree())) startBreak();
  if (tm.mode === 'walk' && S.water && S.water.pending && !S.finished && !S.huddle.on && mgFree() && !S.pulses.length && !S.queue.manager.length && !S.bubbles.some(b => b.who === 'manager')) waterBreakCheck();
  if (S.visit) updateVisit(dt);
  if (S.gifts.logs) { const L = S.gifts.logs; L.t += dt; if (L.t >= 1.1 && !L.landed) { L.landed = true; sfx('thud'); } if (ob('river').prog >= 1) L.fade += dt * 0.8; }
  if (tm.mode === 'walk') {
    const next = S.obstacles.concat(S.surprises).filter(o => !o.done).sort((a, b) => a.x - b.x)[0];
    const spd = (settings.comms ? WALK_SPEED_INFORMED : WALK_SPEED_UNINFORMED) * (tm.tired ? 0.68 : 1);
    const nx = tm.x + spd * dt;
    const stopX = next ? next.x - 28 : BUILD_X;
    const bush = S.pathBushes.find(b => !b.cut && !(b.shrub && S.idea.go) && b.x - 22 > tm.x - 1);
    const bushStop = bush ? bush.x - 22 : Infinity;
    tm.mood = '';
    if (bush && bushStop < stopX && nx >= bushStop) {
      tm.x = bushStop; tm.bush = bush; tm.hackT = 0;
      if (bush.coach && !S.coachDone) { S.coachDone = true; runSeq(coachSeq(), null, () => coachDone(bush)); }
      else tm.mode = 'hack';
    } else if (nx >= stopX) {
      tm.x = stopX;
      if (next) { next.active = true; runSeq(next.isSurprise ? surpriseSeq(next) : sequenceFor(next, next.informed), next); }
      else if (!S.huddle.done) { if (!S.huddle.on) startHuddle(); } // v7.1: a team huddle before the build
      else if (!ld.meeting && !S.build.on && S.meetings.every(m => m.done || m.atX === Infinity)) startBuild(); // v7: then the koalas build the pyramid
    } else tm.x = nx;
  } else if (tm.mode === 'hack') {
    const b = tm.bush;
    let dur = b.shrub ? (settings.comms ? SHRUB_HACK.on : SHRUB_HACK.off) : (settings.comms ? 0.9 : 1.3);
    if (tm.tired) dur *= 1.6;
    tm.hackT += dt; tm.mood = 'hack';
    if (b.shrub && !S.idea.started) startIdea();
    if (b.shrub && S.idea.go) { tm.mode = 'walk'; tm.bush = null; } // leave the shrubs for the creek route
    else {
    b.hp = Math.max(0, 1 - tm.hackT / dur);
    if (rand() < dt * 22) leaf(b.x - 4, groundBase(b.x) - 14 - rand() * 14);
    if (tm.hackT >= dur) {
      b.cut = true; tm.bush = null; tm.mode = 'walk'; tm.bushesCut++;
      for (let i = 0; i < 6; i++) leaf(b.x, groundBase(b.x) - 12);
      if (tm.bushesCut === 1 || (tm.bushesCut % 4 === 0 && S.t - S.capT > 7)) caption(pick(BUSH_LINES, tm.bushesCut >> 2), 'Everyday work');
      if (tm.bushesCut % 3 === 0 && !S.bubbles.some(x => x.who === 'team') && !b.shrub && !S.team.tired) bubble('team', pick(['Hack! 🌿', 'Another one...', 'Chop chop!', 'Snip snip!', 'Next!'], tm.bushesCut), 1.4);
    }
    }
  } else if (tm.mode === 'seq') updateSeq(dt);
  if (S.build.on) updateBuild(dt);

  // --- distractions (triggered by team progress, only between obstacles) ---
  if (!S.finished && (tm.mode === 'walk' || tm.mode === 'hack')) {
    for (const d of S.distractions) {
      const ag = d.who === 'leader' ? ld : mg;
      if (!d.done && tm.x >= d.atX && !ag.dist && !(d.who === 'leader' && ld.meeting) && !(d.who === 'manager' && (mg.meeting || mg.task || mg.busy)) && mg.ready) { d.done = true; startDistraction(ag, d); }
    }
    for (const m of S.meetings) {
      if (!m.done && tm.x >= m.atX && !ld.dist && !ld.meeting && !mg.meeting && !S.waiters.length && mg.ready) { m.done = true; startMeeting(m); }
    }
  }
  // v4: manager meetings start while the koalas are gathering materials for that obstacle
  for (const m of S.mgrMeetings) {
    if (m.done || S.finished) continue;
    const o = ob(m.ob), st = tm.seq && tm.seq[tm.step];
    if (!m.pending && ((tm.seqOb === o && st && st.gather && tm.stepT >= 1.0) || o.done)) m.pending = true;
    if (m.pending && mgFree() && !ld.meeting && !S.waiters.length && !(tm.seqOb && tm.seqOb.isSurprise)) { m.done = true; startMgrMeeting(m); }
  }
  updateMgrMeeting(dt);
  updateDistraction(ld, dt);
  updateMeeting(dt);
  if (S.waiters.length && !ld.dist && !ld.meeting && !(ld.beam === 'creek')) S.waiters.shift()();
  updateDistraction(mg, dt);

  // --- manager: flies ahead of the team, scouting ---
  if (mg.ready && mg.task) {
    const T = mgTaskTarget(mg.task); mg.task.t += dt;
    mg.x += clamp((T.x - mg.x) * 2.6 * dt, -240 * dt, 240 * dt);
    mg.dy += clamp((T.dy - mg.dy) * 2.6 * dt, -150 * dt, 150 * dt);
  } else if (mg.ready) {
    const lead = S.finished ? 60 : 300;
    const target = Math.min(tm.x + lead, GOAL_X - 40);
    const nextUnspotted = S.obstacles.find(o => !o.spotted);
    const distracted = mg.dist && mg.dist.phase === 'distract';
    const ideaPending = S.idea.started && (settings.comms ? !S.idea.go : S.idea.bulb);
    if (!distracted && !ideaPending && nextUnspotted && mg.x + 230 >= nextUnspotted.x) spot(nextUnspotted);
    const dx = target - mg.x;
    mg.x += clamp(dx * 1.4 * dt, -140 * dt, 140 * dt);
    mg.dy += clamp(-mg.dy * 2.4 * dt, -130 * dt, 130 * dt);
  }
  mg.alert = Math.max(0, mg.alert - dt);
  mg.focusT = Math.max(0, mg.focusT - dt);
  mg.y = MANAGER_Y + mg.dy + Math.sin(S.t * 2.1) * (mg.task ? 4 : 8);

  // --- leader: soars above, roughly between team and goal ---
  const base = S.build.on ? (S.finished ? GOAL_X + 170 : GOAL_X + 300) : clamp(Math.max(tm.x, mg.x) + 180, 300, GOAL_X - 120);
  const lx = base + Math.sin(S.t * 0.45) * 90;
  ld.x += clamp((lx - ld.x) * 1.2 * dt, -150 * dt, 150 * dt);
  ld.y = LEADER_Y + Math.sin(S.t * 1.3) * 10;
  if (ld.beamT > 0) { ld.beamT -= dt; if (ld.beamT <= 0) ld.beam = null; }

  // --- routine communication ---
  if (mg.ready && !S.finished && !S.build.on) {
    // v7.6: one conversation at a time, so every reply comes straight after its question
    const mgQuiet = !S.pulses.length && !S.queue.manager.length && !S.bubbles.some(b => b.who === 'manager') && !S.visit;
    if (S.t > S.nextLeaderTalk && !ld.dist && !ld.meeting && mgFree() && mgQuiet && !S.queue.leader.length && !S.bubbles.some(b => b.who === 'leader') && !S.waiters.length && !S.pend.length && !(tm.seqOb && tm.seqOb.isSurprise)) {
      S.nextLeaderTalk = S.t + 19;
      const n = S.leaderTalkI++, T = pick(LEADER_TALK, n), two = Math.floor(n / LEADER_TALK.length) % 2 === 1;
      const a = two && T.a2 || T.a, b = two && T.b2 || T.b, relay = two && T.relay2 || T.relay;
      ld.beam = 'goal'; ld.beamT = 2.4;
      say('leader', 'manager', a, b, () => {
        if (T.ack) later(1.4, () => bubble('leader', T.ack, 2.6));
        if (relay) later(1.6, () => { if (settings.comms) say('manager', 'team', relay[0], relay[1]); else bubble('manager', '(...keeps it to themselves 🤐)', 2.4); });
      });
    }
    else if (S.t > S.nextCheckin && mgFree() && mgQuiet && !S.queue.team.length && tm.mode !== 'seq' && !tm.tired && !S.pend.length && !S.water) {
      S.nextCheckin = S.t + 21;
      if (settings.comms) {
        // v7.6: only promise a water break where there's a clearing coming up (otherwise it's owed for a later check-in)
        const W = MANAGER_CHECKIN.find(c => c[2]);
        let [a, b, then] = S.waterOwed && waterSpot(110) ? (S.waterOwed = false, S.checkinI--, W) : pick(MANAGER_CHECKIN, S.checkinI);
        S.checkinI++;
        if (then && S.breakDone) { a = 'Nearly at the build site, team! 🔺'; b = 'Woohoo, nearly there! 🐨'; then = null; S.waterOwed = false; }
        else if (then && !waterSpot(110)) { S.waterOwed = true; [a, b, then] = pick(MANAGER_CHECKIN, S.checkinI++); }
        say('manager', 'team', a, b, then);
      }
      else bubble('team', pick(LONELY, S.checkinI++), 2.6);
    }
  }

  // --- bubbles (with per-speaker queue) / pulses / particles ---
  for (const b of S.bubbles) b.t += dt;
  S.bubbles = S.bubbles.filter(b => b.t < b.dur);
  for (const who of ['leader', 'manager', 'team', 'visitor']) {
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
  updateOutreach(dt);
  for (const o of S.obstacles) o.angry = Math.max(0, o.angry - dt);
  if (S.finished && rand() < dt * 30) confetti(GOAL_X + (rand() - 0.5) * 300, 40 + rand() * 60, 1);
}

// ---------- v7.4: the Leader's outreach to other teams and projects ----------
// The Leader counts as free when nothing else involves it: no meeting, distraction, beam, supply drop, escalation or message.
function leaderFree() {
  const L = S.leader, tm = S.team;
  return S.mgr.ready && !S.finished && !L.dist && !L.meeting && !L.beam && !S.drop && !S.waiters.length && !S.introCam
    && !S.pulses.some(p => p.from === 'leader' || p.to === 'leader') && !S.bubbles.some(b => b.who === 'leader') && !S.queue.leader.length
    && !(tm.seqOb && tm.seqOb.isSurprise && !tm.seqOb.chainDone);
}
function outreach(ti, withBubble) {
  const B = S.busy, T = OUTREACH_TARGETS[ti], P = outreachPt(T);
  if (P.ax === 0 && Object.values(B.marks).some(m => m.P.ax === 0 && Math.abs(m.P.x - P.x) < 220)) P.x = P.x + 260 < viewW - 200 ? P.x + 260 : Math.max(420, P.x - 260); // two at once: keep apart
  B.rings.push({ ti, P, t: 0, dur: OUT.out, back: false, fade: null, ret: B.n % 2 === 0 });
  B.marks[ti] = { P, t0: S.t, until: S.t + OUT.out + OUT.hold + OUT.back + 1.2, ok: 0 };
  if (outreachSeen()) sfx('outreach');
  if (withBubble) { B.bubble = { who: 'leader', text: T.say, t: 0, dur: OUT.bubble, busy: true }; if (TRACE) TRACE('outreachBubble', T.label, T.say); }
  B.log.push([+S.t.toFixed(2), T.label]);
}
const outreachSeen = () => settings.view === 'all' || settings.view === 'leader';
function updateOutreach(dt) {
  const B = S.busy, L = S.leader, free = leaderFree();
  const big = L.meeting || L.dist || S.drop || S.finished; // the big moments always take over the sky
  B.idleT = free ? B.idleT + dt : 0;
  if (free && B.idleT >= OUT.first && S.t >= B.next) {
    const i = B.n++; B.next = S.t + OUT.gap;
    const k = i % 2 ? (i - 1) / 2 : i / 2 + 3, nO = OUTREACH_ORDER.length; // v7.5: the speaking ones cycle through all six targets
    outreach(OUTREACH_ORDER[k % nO], i % 2 === 1);
    if (i % 3 === 2) outreach(OUTREACH_ORDER[(k + 1) % nO], false); // now and then two at once, in other directions
    // A short Leader caption now and then. The Leader view gets it once its own last caption is a few seconds old; the
    // Everything view only while the caption bar is quiet. Either way it never queues, so the story's own captions are never delayed.
    const lc = S.capBy.leader;
    if (i % 2 === 1 && (!lc || S.t - lc.t > 5)) {
      const text = OUTREACH_CAPS[B.capI++ % OUTREACH_CAPS.length];
      S.capBy.leader = { text, phase: 'Big picture', t: S.t };
      if (TRACE) TRACE('outreachCaption', text);
      if (!S.capQ.length && !capHeld(1) && (!S.cap || S.t - S.cap.shown > 4)) B.cap = { text, phase: 'Big picture', t: S.t };
      B.capLog.push([+S.t.toFixed(1), !!(B.cap && B.cap.t === S.t)]);
      emitCaption();
    }
  }
  for (const r of B.rings.slice()) {
    r.t += dt;
    if (big && r.fade == null) r.fade = 0;
    if (r.fade != null) { r.fade += dt; if (r.fade > 0.4) B.rings.splice(B.rings.indexOf(r), 1); continue; }
    if (r.back && !r.chimed && r.t >= 0) { r.chimed = true; if (outreachSeen()) sfx('outreachBack'); }
    if (r.t >= r.dur) {
      B.rings.splice(B.rings.indexOf(r), 1);
      const m = B.marks[r.ti];
      if (!r.back) { if (m) m.hit = S.t; if (r.ret) B.rings.push({ ti: r.ti, P: r.P, t: -OUT.hold, dur: OUT.back, back: true, fade: null }); }
      else if (m) m.ok = S.t;
    }
  }
  for (const k of Object.keys(B.marks)) if (S.t > B.marks[k].until || (big && !B.rings.some(r => r.ti === +k))) delete B.marks[k];
  if (B.bubble) { B.bubble.t += dt; if (B.bubble.t >= B.bubble.dur || big) B.bubble = null; }
}

function startDistraction(ag, d) {
  ag.dist = { def: d, t: 0, phase: 'distract', last: { ox: 0, oy: 0, rot: 0 } };
  sfx({ magpie: 'magpie', email: 'emailStorm', storm: 'thunder', meeting: 'ding', mosquito: 'mozzie', branch: 'branch' }[d.def ? d.def.kind : d.kind]);
  if (d.kind === 'magpie') later(0.7, () => sfx('screech'));
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
        sfx('flap');
        S.leader.beam = 'goal'; S.leader.beamT = 2.4;
        caption('The Leader refocuses on the vision. Distractions happen; what matters is getting back to the main objective.', 'Refocus');
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
  S.mgr.alert = 2.2; sfx('hoot');
  bubble('manager', `${o.icon} ${o.name[0].toUpperCase() + o.name.slice(1)} ahead!`, 2.6);
  if (settings.comms) {
    caption(`The Manager spots a ${o.name} ahead and radios a warning down to the koalas.`, 'Communication');
    const advice = {
      vines: ['Heads up: vines ahead, bring cutting tools!', 'Tools ready! ✂️'],
      boulder: ['Boulder ahead, too big to go round. Training and hammers on the way! 🔨', 'New skills? Yes please! 🎓'],
      river: ['River ahead: gather logs for a bridge!', 'We\'ll fan out for logs! 🪵'],
      bog: ['Bog ahead: you\'ll need flat stones!', 'Stone hunt! 🪨'],
      log: ['Big log ahead: there\'s a hollow you can crawl through!', 'Ooh, a tunnel! 🐨'],
      cliff: ['Cliff ahead: braid a rope and climb down at the marked spot!', 'Vine rope it is! 🪢'],
      bees: ['Bees\' nest ahead: tiptoe quietly!', '(whispering) Okay... 🤫'],
      wall: S.gifts.ladder ? ['Rock wall ahead: Project Manager B\'s ladder is waiting for you there! 🪜', 'A ladder, ready to go? Yay! 🪜'] : ['Rock wall ahead: gather poles for a ladder!', 'Poles it is! 🪜'],
    }[o.type];
    later(0.8, () => say('manager', 'team', '📻 ' + advice[0], advice[1], () => { o.informed = true; }));
  } else {
    caption(`The Manager spots a ${o.name}, but communication is OFF, so the koalas never hear about it.`, 'No communication');
    later(1.2, () => bubble('manager', '(...keeps it to themselves 🤐)', 2.4));
  }
}

function finish() {
  const tm = S.team, B = S.build, days = Math.ceil(S.t / SEC_PER_DAY);
  S.finished = true; tm.mode = 'done'; tm.mood = 'happy';
  sfx('fanfare');
  caption(settings.comms
    ? `Safely down, now we celebrate! Delivered on day ${days}! 🎉 The koalas built the pyramid themselves: vision (Leader) + support & communication (Manager) + skills & hard work (Team).`
    : `Safely down at last. Finally delivered on day ${days}! 🎉 The koalas built the pyramid, but without communication it took a redo and many extra days.`, 'Goal reached', { force: true });
  S.mgr.task = { kind: 'build', t: 0 }; S.mgr.busy = false; B.mt = { x: 5160, dy: GROUND - 150 - MANAGER_Y }; B.mcarry = false; B.clearT = S.t; // everyone celebrates on the ground
  bubble('team', 'We built it!! 🎉🐨', 5);
  later(1.0, () => bubble('manager', 'Brilliant work, koalas! 🦉', 4));
  later(1.8, () => bubble('leader', settings.comms ? 'You built the vision. Proud of every one of you! 🦅' : 'We got there in the end. Proud of you all! 🦅', 4));
  later(4.6, () => bubble('team', 'Group hug!! 🤗', 4));
  for (let i = 0; i < 80; i++) confetti(5250 + (rand() - 0.5) * 160, GROUND - 90, 1);
  for (let i = 0; i < 30; i++) confetti(GOAL_X + (rand() - 0.5) * 60, CAP_BASE - 20, 1);
  S.day = days; call('OnDay', days);
  S.finArgs = [Math.round(S.t), days, tm.wrong, tm.surprises, tm.distractions, tm.priorities, tm.reported, tm.syncs, tm.ideas, tm.breaks, settings.comms];
  call('OnFinished', ...S.finArgs);
  mark('finish');
}
function confetti(x, y, n) {
  const cols = ['#ff5d5d', '#ffd34d', '#5dd3ff', '#8aff5d', '#d07bff', '#ffffff'];
  for (let i = 0; i < n; i++) S.particles.push({ kind: 'confetti', x, y, vx: (rand() - 0.5) * 220, vy: -120 - rand() * 200, r: rand() * 6, vr: (rand() - 0.5) * 10, life: 2.5 + rand(), c: cols[Math.floor(rand() * cols.length)] });
}
function leaf(x, y) {
  const cols = ['#4caf50', '#66bb6a', '#2e7d32', '#9ccc65'];
  S.particles.push({ kind: 'leaf', x, y, vx: 30 + rand() * 90, vy: -60 - rand() * 80, r: rand() * 6, vr: (rand() - 0.5) * 8, life: 1.1 + rand() * 0.6, c: cols[Math.floor(rand() * 4)] });
}

// ---------- v5: growing people, ideas from the ground, wellbeing ----------
// Where the owl goes when it drops down to the koalas (dy is how far below its usual flight line).
function mgTaskTarget(T) {
  const tm = S.team, kx = i => (S.kpos[i] ? S.kpos[i].x : tm.x - i * MEMBER_GAP);
  if (T.kind === 'coach') return { x: kx(3) - 84, dy: 80 };
  if (T.kind === 'recog') return { x: tm.x + 95, dy: 56 };
  if (T.kind === 'build') return S.build.mt || { x: STOCK_X + 140, dy: 0 };
  return { x: tm.x + 92, dy: 66 }; // break
}
// Wattle (the smallest koala) struggles with her saw at a thick bush. ON: the owl coaches her. OFF: nobody notices.
function coachSeq() {
  const tm = S.team; mark('coach');
  if (settings.comms) return [
    { dur: 2.0, mood: 'hack', struggle: true, bushHp: [1, 0.8], phase: 'COACHING', until: mgFree,
      cap: 'The everyday work, but Wattle, the smallest koala, is struggling: her saw keeps getting stuck and she\'s falling behind.', say: 'Wattle: My saw keeps getting stuck... 😣' },
    { dur: 2.9, mood: 'hack', struggle: true, bushHp: [0.8, 0.6], phase: 'COACHING', cap: 'Managers grow people: the owl drops down to coach Wattle one-to-one.',
      onStart: () => { S.mgr.task = { kind: 'coach', t: 0 }; later(0.7, () => bubble('manager', 'You\'ve got this, Wattle! Hold it like this. ✂️', 2.4, true)); } },
    { dur: 2.0, mood: 'hack', bushHp: [0.6, 0], phase: 'COACHING', cap: 'A little coaching and Wattle cuts as well as anyone. A small investment that lasts the whole journey.',
      say: 'Wattle: Oh! That\'s so much easier! 😊', onStart: () => { tm.coached = true; kbadge(3, '💪 Wattle: coached!', 4.5, '#b9f6ca'); S.mgr.task = null; S.mgr.focusT = 1.6; } },
  ];
  return [
    { dur: 2.0, mood: 'hack', struggle: true, bushHp: [1, 0.7], phase: 'Everyday work', capPrio: 2,
      cap: 'Wattle, the smallest koala, is struggling: her saw keeps getting stuck and she\'s falling behind.', say: 'Wattle: My saw keeps getting stuck... 😣' },
    { dur: 2.6, mood: 'hack', struggle: true, bushHp: [0.7, 0], phase: 'No communication',
      cap: 'Nobody notices. With communication OFF there\'s no one to coach her, so Wattle just keeps struggling.', say: 'Wattle: Am I doing this right? ...anyone? 😓' },
  ];
}
function coachDone(bush) {
  const tm = S.team;
  bush.cut = true; tm.bush = null; tm.bushesCut++;
  for (let i = 0; i < 6; i++) leaf(bush.x, groundBase(bush.x) - 12);
  if (S.mgr.task && S.mgr.task.kind === 'coach') { S.mgr.task = null; S.mgr.focusT = 1.6; }
}
// Banjo spots a dry creek bed beside the shrubs. ON: the idea goes up, the Leader adopts it and changes course.
function startIdea() {
  const I = S.idea; I.started = true; I.bulb = true;
  if (!settings.comms) mark('idea');
  if (settings.comms) whenFree(() => mgFree() && !S.bubbles.some(b => b.who !== 'visitor') && !S.queue.team.length && !S.queue.manager.length, () => {
    mark('idea');
    caption('Team members lead too: hacking through thick shrubbery, Banjo spots a dry creek bed running alongside. A better route, seen from the ground!', 'TEAM IDEA', { hold: 3.2 });
    bubble('team', 'Banjo: There\'s a shortcut along the creek bed! 💡', 2.8, true); sfx('idea');
    whenFree(mgFree, () => {
      S.mgr.busy = true;
      later(0.4, () => say('team', 'manager', 'Banjo: A dry creek bed skips all these shrubs!', 'Smart! Taking it to the boss. 🦉', () => {
        caption('Ideas travel up too: the Manager passes Banjo\'s idea straight to the Leader.', 'TEAM IDEA');
        S.waiters.push(() => say('manager', 'leader', 'The team found a creek route that skips the shrubs.', null, adoptIdea));
      }));
    });
  }); else {
    caption('Banjo spots a dry creek bed that would skip the shrubs, but with communication OFF the idea goes nowhere.', 'No communication', { hold: 3 });
    bubble('team', 'Banjo: Psst... a creek bed! Should we tell someone? 🤔', 3, true); sfx('idea');
    later(3.4, () => bubble('team', 'Banjo: ...hello? Guess we keep hacking. 😕', 2.6));
    later(6.2, () => { I.bulb = false; });
  }
}
function adoptIdea() {
  const I = S.idea, tm = S.team;
  const left = S.pathBushes.filter(b => b.shrub && !b.cut).length;
  const days = Math.max(1, Math.round((left - 1.3) * SHRUB_HACK.on / SEC_PER_DAY));
  I.adopted = true; I.saved = days; tm.ideas++; stats();
  S.leader.beam = 'creek'; S.leader.beamT = 5.5; sfx('yes');
  bubble('leader', `New info from the ground. We'll take the creek route; it saves ${days} days.`, 3.6, true);
  caption(`Course correction: leaders adapt. With new information from the ground, the Leader changes the plan: the creek route saves about ${days} days.`, 'COURSE CORRECTION', { force: true, hold: 3.6 });
  later(2.0, () => pulse('leader', 'manager', PULSE_COL.leader, () => say('manager', 'team', 'Creek route approved! Great idea, Banjo! 🌟', 'Banjo: Woohoo! Follow me! 🐨', () => {
    I.go = true; I.bulb = false; S.mgr.busy = false;
    kbadge(1, '💡 Banjo: idea adopted!', 5, '#b3e5fc');
    caption('Credit flows back down: the koalas leave the shrubs behind and follow Banjo along the creek bed.', 'COURSE CORRECTION');
  })));
}
// Small wins: Matilda gets a gum leaf, "Koala of the week".
function startRecognition() {
  const mg = S.mgr, tm = S.team;
  mg.task = { kind: 'recog', t: 0 };
  caption('Celebrating small wins: the owl names Matilda "Koala of the week" for keeping everyone calm past the bees. 🌿', 'RECOGNITION', { hold: 3.4 });
  later(1.0, () => bubble('manager', 'Koala of the week: Matilda! 🌿 You kept us calm.', 2.6, true));
  later(1.7, () => { S.leafFly = { t: 0 }; sfx('rustle'); });
  later(2.7, () => { tm.leaf = 2; kbadge(2, '🌿 Matilda: Koala of the week', 4.5, '#c5e1a5'); bubble('team', 'Matilda: Aww, thanks! 🥰', 2.2); });
  later(4.4, () => { mg.task = null; mg.focusT = 1.4; say('manager', 'leader', '🐝 Bees\' nest cleared! ✅ Matilda kept everyone calm.', 'Great work, Matilda! 🦅'); });
}
// Wellbeing: after the toughest stretch. ON: the owl calls a break. OFF: no break, and the koalas tire.
function startBreak() {
  const tm = S.team; S.breakDone = true; mark('break');
  if (!settings.comms) {
    tm.tired = true;
    caption('Nobody calls a break. After the toughest stretch of the journey, the koalas push on exhausted, and slow right down.', 'WELLBEING', { hold: 3.5 });
    bubble('team', 'So... tired... 😓', 2.8, true);
    later(5, () => bubble('team', 'Can we stop yet? 💦', 2.4));
    return;
  }
  const t0 = S.t;
  runSeq([
    { dur: 2.4, mood: '', move: 110, phase: 'WELLBEING', cap: 'Trust and wellbeing: after the cliff, the bees, the snake and the rock wall, the owl calls a break.',
      onStart: () => { S.mgr.task = { kind: 'break', t: 0 }; later(0.3, () => bubble('manager', 'Tough stretch! Take five, team. 💧', 2.6, true)); } },
    { dur: 3.9, mood: 'rest', rest: true, phase: 'WELLBEING', cap: 'Water from the billy and a eucalyptus snack. A sustainable pace beats burnout.',
      onStart: () => later(0.9, () => bubble('team', 'Ahh, billy tea and gum leaves! 🌿', 2.6)) },
    { dur: 0.9, mood: '', phase: 'WELLBEING', onStart: () => { tm.breaks++; tm.fresh = 3.2; } },
  ], null, () => {
    S.mgr.task = null; S.mgr.focusT = 1.4;
    caption(`Break over: it cost about ${dd(Math.max(1, Math.round((S.t - t0) / SEC_PER_DAY)))}, and the koalas set off refreshed. ⚡`, 'WELLBEING');
  });
}

// ---------- v7: building the final product ----------
// At the build site the koalas raise the pyramid course by course, using the skills gathered on the journey.
// Every step is a normal sequence step (runSeq) with extra hooks: tick(p) moves the build forward, st(p) gives each
// koala's station, flow(p) describes the blocks passed along the line, route(i, p) walks a koala along a path.
function startBuild() {
  const B = S.build, tm = S.team, on = settings.comms;
  B.on = true; B.t0 = S.t; mark('build'); sfx('layer', { n: -1 });
  B.kp = [0, 1, 2, 3].map(i => ({ x: tm.x - i * MEMBER_GAP, y: GROUND, mv: false, dir: 1 }));
  S.leader.beam = 'goal'; S.leader.beamT = 3.2;
  if (on) { S.mgr.task = { kind: 'build', t: 0 }; B.mt = { x: STOCK_X + 150, dy: 10 }; }
  runSeq(buildSeq(on), null, finish);
}
function skill(icon, name, from) { const B = S.build; B.skills.push({ icon, name, from, t: S.t, hard: !settings.comms }); sfx('sparkle'); }
function rampTopNow() {
  const L = S.build.rampL; if (L < 0) return [RAMP_FOOT, GROUND];
  const a = Math.floor(L), b = Math.min(3, a + 1), q = L - a, A = rampTop(a), C = rampTop(b);
  return [lerp(A[0], C[0], q), lerp(A[1], C[1], q)];
}
// Kip places the blocks: even courses left to right, odd ones right to left (so he only ever hops up a step).
function placeX(k, c, wide) { const h = (wide ? cHalf(k - 1) : cHalf(k)) - 12; return k % 2 === 0 ? lerp(GOAL_X - h, GOAL_X + h, c) : lerp(GOAL_X + h, GOAL_X - h, c); }
const courseC = p => clamp((p - 0.08) / 0.86, 0, 1);
// Stations along the supply line, indexed by koala: Kip places, Banjo loads at the ramp foot, Matilda shapes at the pile, Wattle passes / hauls.
function stations(k, p, o = {}) {
  const c = courseC(p), rt = rampTopNow();
  const kip = { x: placeX(k, o.tear ? 1 - c : c, o.wide || o.tear), y: cTop(k - 1), face: (k % 2 === 0) !== !!o.tear ? 1 : -1 };
  const mat = { x: STOCK_X - 26, y: GROUND, face: 1 };
  let ban, wat;
  if (k === 0) { ban = { x: 5180, y: GROUND, face: 1 }; wat = { x: 5290, y: GROUND, face: 1 }; }
  else {
    ban = { x: RAMP_FOOT - 12, y: GROUND, face: 1 };
    if (k <= 2) wat = { x: lerp(RAMP_FOOT, rt[0], 0.5), y: lerp(GROUND, rt[1], 0.5), face: 1 };
    else if (k <= 4) wat = { x: rt[0] + 18, y: rt[1], face: -1 };          // hauls the rope from the top of the ramp
    else wat = { x: LADDER.b[0] - 14, y: LADDER.b[1], face: 1 };           // passes blocks up the ladder
  }
  return [kip, ban, mat, wat];
}
function holdStations() { return S.build.tgt || S.build.kp.map(P => ({ x: P.x, y: P.y, face: 1 })); }
// v7.1: where the koalas celebrate, safely back on the ground beside the pyramid (first one down walks furthest).
function grounds() { return [[5265, 2, -1], [5230, 6, 1], [5195, 0, 1], [5300, 8, -1]].map(([x, lane, face]) => ({ x, y: GROUND, lane, face })); }
function finals() { return FINAL.map(([dx, lane]) => ({ x: GOAL_X + dx, y: cTop(4), lane, face: dx < 0 ? 1 : -1 })); }
// The supply line: blocks travel from the pile, paw to paw, up the ramp (on rollers, pulled by rope) and the ladder, to Kip.
// Each point is [x, y, height of the block above the feet].
function flowPts(k) {
  const K = S.build.kp, rt = rampTopNow(), [kip, ban, mat, wat] = K;
  const pts = [[mat.x + 12, mat.y, 30], [ban.x, ban.y, 30]];
  if (k === 0) pts.push([wat.x, wat.y, 30]);
  else if (k <= 2) pts.push([wat.x, wat.y, 30], [rt[0], rt[1], 30]);
  else if (k <= 4) pts.push([RAMP_FOOT + 10, GROUND, 8], [rt[0] - 4, rt[1], 8], [wat.x, wat.y, 30]);
  else pts.push([RAMP_FOOT + 10, GROUND, 8], [rt[0] - 4, rt[1], 8], [wat.x, wat.y, 30], [LADDER.b[0] + 4, LADDER.b[1], 30], [LADDER.t[0] + 2, LADDER.t[1], 30]);
  pts.push([kip.x, kip.y, 30]);
  return pts;
}
function along(pts, f) {
  const seg = []; let L = 0;
  for (let j = 1; j < pts.length; j++) { const l = Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]); seg.push(l); L += l; }
  let d = clamp(f, 0, 1) * L;
  for (let j = 0; j < seg.length; j++) {
    if (d <= seg[j] || j === seg.length - 1) {
      const q = seg[j] ? Math.min(1, d / seg[j]) : 1, a = pts[j], b = pts[j + 1];
      return { x: lerp(a[0], b[0], q), y: lerp(a[1], b[1], q), h: lerp(a[2] || 0, b[2] || 0, q), seg: j, dx: b[0] - a[0], dy: b[1] - a[1] };
    }
    d -= seg[j];
  }
  const a = pts[pts.length - 1]; return { x: a[0], y: a[1], h: a[2] || 0, seg: pts.length - 2, dx: 0, dy: 0 };
}
function buildSeq(on) {
  const B = S.build, tm = S.team;
  const shapeSpots = () => [{ x: STOCK_X + 30, y: GROUND, face: -1 }, { x: STOCK_X - 54, y: GROUND, lane: 14, face: 1 }, { x: STOCK_X - 28, y: GROUND, face: 1 }, { x: STOCK_X + 54, y: GROUND, lane: 14, face: -1 }];
  const mgrShuttle = (k, p) => { // the owl flies stone from the pile up to wherever Kip is working
    const f = p < 0.5 ? ease(p / 0.5) : ease((1 - p) / 0.5), kip = B.kp[0];
    B.mcarry = p < 0.48 && p > 0.04;
    return { x: lerp(STOCK_X + 40, kip.x - 46, f), dy: lerp(GROUND - 120, kip.y - 92, f) - MANAGER_Y };
  };
  const course = (k, dur, o = {}) => ({
    dur, b: 'course', k, rope: !!o.rope, wide: !!o.wide, tear: !!o.tear, phase: o.phase || 'BUILD', cap: o.cap, say: o.say, wrong: o.wrong, onStart: o.onStart,
    tick: p => {
      const c = courseC(p);
      if (o.wide) B.wrongP = Math.max(B.wrongP, c); else if (o.tear) B.wrongP = Math.min(B.wrongP, 1 - c); else B.c[k] = Math.max(B.c[k], c);
      if (o.ramp) B.rampL = lerp(o.ramp[0], o.ramp[1], ease(clamp(p / 0.16, 0, 1)));
      if (on) B.mt = mgrShuttle(k, p);
    },
    st: p => stations(k, p, o), flow: () => ({ pts: flowPts(k), n: 3, C: on ? 2 : 1.6, rev: !!o.tear, rope: !!o.rope }),
  });
  const rampStep = (dur, cap, say) => ({
    dur, b: 'ramp', mood: 'work', phase: 'BUILD', cap, say,
    onStart: () => { skill('🪵', 'Planks & a ramp', on ? 'the sinkhole crossing' : 'the sinkhole'); B.rampL = 0; },
    tick: p => { B.rampG = Math.max(B.rampG, ease(p)); if (on) B.mt = { x: RAMP_FOOT + 60, dy: GROUND - 150 - MANAGER_Y }; B.mcarry = false; },
    st: () => { const rt = rampTop(0), g = Math.max(0.15, B.rampG), at = f => ({ x: lerp(RAMP_FOOT, rt[0], f * g), y: lerp(GROUND, rt[1], f * g), face: 1 });
      return [{ x: GOAL_X + cHalf(1) - 12, y: cTop(0), face: -1 }, at(0.25), at(0.55), at(0.85)]; },
  });
  const ladderStep = (dur, cap) => ({
    dur, b: 'ladder', mood: 'work', phase: 'BUILD', cap, say: on ? (S.gifts.ladder ? 'A ladder, just like Project Manager B\'s! 🪜' : 'Ladder, like at the rock wall! 🪜') : 'A ladder... like the wobbly one? 🪜', until: () => !S.leader.meeting,
    onStart: () => skill('🪜', 'Ladder', S.gifts.ladder ? 'Project Manager B\'s ladder at the rock wall' : 'the rock wall'),
    tick: p => { B.ladder = Math.max(B.ladder, ease(p)); B.mcarry = false; },
    st: () => { const T = stations(4, 1); T[3] = { x: LADDER.b[0] - 8, y: LADDER.b[1], face: 1 }; return T; },
  });
  const capFlow = (dur, cap) => ({
    dur, b: 'capflow', phase: 'BUILD', cap,
    onStart: () => { B.cap = { s: 0, lift: 0 }; if (on) say('manager', 'leader', 'Layer 6 done! The capstone is going up! ✨', 'This is it! 🦅'); },
    tick: p => { B.cap.s = p; B.mcarry = false; if (on) B.mt = { x: GOAL_X - 150, dy: cTop(4) - 60 - MANAGER_Y }; },
    st: () => stations(5, 1), flow: () => ({ pts: flowPts(5), n: 0, cap: true }),
  });
  const climb = (dur, cap) => ({
    dur, b: 'climb', phase: 'TEAMWORK', cap, say: 'Everyone up! All four of us! 🐨🐨🐨🐨',
    onStart: () => {
      const K = B.kp, up = [[RAMP_FOOT, GROUND], rampTop(3), LADDER.b, LADDER.t], t4 = cTop(4);
      const over = [[GOAL_X - 26, t4], [GOAL_X - 24, CAP_BASE], [GOAL_X + 24, CAP_BASE], [GOAL_X + 26, t4]], F = finals();
      const P = i => [K[i].x, K[i].y];
      B.climbR = [[P(0), [F[0].x, t4]], [P(1), ...up, ...over, [F[1].x, t4]], [P(2), ...up, ...over, [F[2].x, t4]], [P(3), LADDER.b, LADDER.t, [F[3].x, t4]]];
    },
    route: (i, p) => along(B.climbR[i], ease(clamp((p - [0.1, 0, 0.06, 0.04][i]) / 0.86, 0, 1))),
  });
  const capLift = (dur, cap) => ({
    dur, b: 'caplift', mood: 'lift', phase: 'TEAMWORK', cap, onStart: () => { sfx('haul'); kbadge(0, '🤝 All four, together', 3.5, '#ffe082'); },
    tick: p => { B.cap.lift = p; if (p >= 1 && !B.capSet) { B.capSet = true; sfx('block'); } },
  });
  // v7.1: after the capstone, back down one at a time (ladder, then the ramp) before anyone celebrates.
  const down = (dur, cap, say) => ({
    dur, b: 'down', phase: 'SAFETY', cap, say,
    onStart: () => {
      const K = B.kp, t4 = cTop(4), G = grounds(), P = i => [K[i].x, K[i].y];
      const over = [[GOAL_X + 26, t4], [GOAL_X + 24, CAP_BASE], [GOAL_X - 24, CAP_BASE], [GOAL_X - 26, t4]];
      const rest = i => [LADDER.t, LADDER.b, rampTop(3), [RAMP_FOOT, GROUND], [G[i].x, GROUND]];
      B.downR = [0, 1, 2, 3].map(i => [P(i), ...(K[i].x > GOAL_X ? over : []), ...rest(i)]);
    },
    route: (i, p) => { const q = clamp((p - [0.14, 0.28, 0.42, 0][i]) / 0.56, 0, 1); return along(B.downR[i], q * q * (3 - 2 * q)); },
  });
  const reality = (dur, cap, leaderSays) => ({
    dur, b: 'reality', phase: 'VISION → REALITY', cap, capPrio: 2,
    onStart: () => { B.capSet = true; mark('reality'); sfx('vision'); S.leader.beam = 'goal'; S.leader.beamT = 3; later(0.7, () => bubble('leader', leaderSays, 2.8, true)); },
    tick: p => { B.solid = Math.max(B.solid, ease(clamp(p / 0.7, 0, 1))); },
  });
  if (on) return [
    { dur: 3.4, b: 'arrive', mood: '', phase: 'BUILD', cap: 'The build site, right under the Leader\'s vision. That golden blueprint is the goal: now the koalas will build the real pyramid themselves.',
      onStart: () => { bubble('leader', 'There it stands, in the vision. Let\'s build it! 🔺', 3, true); later(1.1, () => say('manager', 'team', 'I\'ll organise the build: stones first, then layer by layer. 📋', 'Let\'s build! 🐨🔨')); } },
    { dur: 4.6, b: 'gather', gather: 'stones', phase: 'BUILD', cap: 'Skill from the journey: gathering materials. Just like at the river, the bog and the cliff, the koalas fan out and bring back stone.',
      onStart: () => skill('🧺', 'Gathering materials', 'river, bog, cliff and wall'), tick: p => { B.stock = Math.max(B.stock, [0, 1, 2, 3].filter(i => gatherPose(i, p, {}).delivered).length * 2); } },
    { dur: 4.4, b: 'shape', mood: 'chisel', phase: 'BUILD', cap: 'Remember the boulder? The hammer-and-chisel training pays off: the koalas shape rough stone into neat, same-sized blocks.', say: 'Tap... tap... a perfect block! 🔨',
      onStart: () => { B.kpOn = true; B.stock = 8; skill('🔨', 'Hammer & chisel', 'the boulder training'); }, tick: p => { B.shaped = Math.max(B.shaped, p); }, st: shapeSpots },
    course(0, 4.6, { cap: 'Layer 1 of 6: block by block, the base goes down on the forest floor.',
      onStart: () => later(1.4, () => { caption('Good managers support the work, they don\'t take it over: the owl rolls up its sleeves and brings stone to wherever it\'s needed.', 'SUPPORT', { hold: 3.4 }); bubble('manager', 'Next stone, coming through! 🪨', 2.4); }) }),
    rampStep(3.0, 'To build higher they need a ramp: planks laid end to end, just like the sinkhole crossing.', 'Planks, like at the sinkhole! 🪵'),
    course(1, 4.6, { ramp: [0, 0], phase: 'DELEGATION', cap: 'Delegation again: the owl hands Kip the lead on a section of the build, just like the bridge.',
      onStart: () => { tm.lead = 0; say('manager', 'team', 'Kip, can you lead the east side? ⭐', 'Kip: On it! 🌟'); kbadge(0, '⭐ Kip leads a section', 5); later(2.4, () => { B.check = 2.6; bubble('manager', 'Checked against the vision: the angles match! 📐✅', 2.6, true); }); } }),
    course(2, 4.6, { ramp: [0, 1], cap: 'Wattle, coached back at the thick bush, now sets the corner stones with confidence.',
      onStart: () => { kbadge(3, '💪 Wattle: confident since coaching', 4.5, '#b9f6ca'); bubble('team', 'Wattle: I\'ve got the corners! 💪', 2.4); skill('🤝', 'Teamwork & delegation', 'Kip leads, Wattle was coached'); } }),
    { dur: 2.8, b: 'hold', mood: '', phase: 'TEAM IDEA', cap: 'Team members lead too: the blocks are getting heavy for the steep ramp, so Banjo suggests log rollers, a trick from the river bridge.', st: holdStations,
      onStart: () => { B.mcarry = false; say('manager', 'leader', 'Layer 3 done, halfway there! 🔺', 'Brilliant. Keep that shape! 🦅'); later(0.4, () => { bubble('team', 'Banjo: Logs as rollers, like the bridge! 💡', 2.6, true); sfx('idea'); });
        later(1.6, () => { B.rollers = true; kbadge(1, '💡 Banjo: log rollers', 4.5, '#b3e5fc'); skill('💡', 'Log rollers', 'Banjo\'s idea, logs like the bridge'); }); } },
    course(3, 5.0, { ramp: [1, 2], rope: true, cap: 'Ropes, like at the cliff: Wattle hauls each block up the ramp on Banjo\'s rollers, and Kip sets it in place.',
      onStart: () => skill('🪢', 'Ropes', 'the cliff') }),
    course(4, 5.0, { ramp: [2, 3], rope: true, cap: 'Layer 5 of 6. The owl relays progress up: the Leader always knows where the build is.',
      onStart: () => { say('manager', 'leader', 'Layer 4 done, two to go! 🔺', 'So proud of this team! 🦅'); later(1.2, () => { if (!S.leader.meeting) startMeeting(S.meetings[3]); }); } }),
    ladderStep(2.6, S.gifts.ladder ? 'For the very top they lash their own ladder, copying the one Project Manager B lent them at the rock wall.' : 'For the very top they lash a ladder, a skill from the rock wall.'),
    course(5, 4.4, { cap: 'The sixth and final layer, passed up the ladder block by block.' }),
    capFlow(3.6, 'The golden capstone travels up the line, passed from paw to paw.'),
    climb(3.4, 'All four koalas climb to the top: this last stone goes on together.'),
    capLift(3.0, 'Together, all four lift the capstone and set it on top...'),
    reality(3.2, 'Vision becomes reality: the pyramid the team built fills the Leader\'s blueprint exactly, and the outline turns solid. ✨', 'That\'s it! That\'s the vision! 🦅✨'),
    down(6.0, 'Safety first, right to the end: one at a time, the koalas climb back down the ladder and the ramp.', 'Careful now, one at a time! 🪜'),
  ];
  return [
    { dur: 3.0, b: 'arrive', mood: 'confused', phase: 'No communication', cap: 'They\'ve reached the spot, but with communication OFF nobody ever told the koalas what the final product looks like.', say: 'Right... where do we even start? 🤷',
      onStart: () => later(1.2, () => bubble('manager', '(...keeps it to themselves 🤐)', 2.4)) },
    { dur: 6.0, b: 'gather', gather: 'stones', lost: true, phase: 'BUILD', cap: 'They fan out for stone, unsure what they need or how much...', say: 'Big rocks? Small rocks? 🤷',
      onStart: () => skill('🧺', 'Gathering materials', 'river, bog, cliff and wall'), tick: p => { B.stock = Math.max(B.stock, [0, 1, 2, 3].filter(i => gatherPose(i, p, { lost: true }).delivered).length * 2); } },
    { dur: 6.0, b: 'shape', mood: 'chisel', phase: 'BUILD', cap: 'Nobody says what size: the blocks come out all different shapes, and some have to be thrown away.', say: 'Is this one too big? 😕',
      onStart: () => { B.kpOn = true; B.stock = 8; skill('🔨', 'Hammer & chisel', 'the boulder'); }, tick: p => { B.shaped = Math.max(B.shaped, p); B.rejects = Math.max(B.rejects, Math.floor(p * 5)); }, st: shapeSpots },
    course(0, 6.0, { cap: 'Layer 1, a bit wonky. No owl is bringing stone, so every block is a long walk.' }),
    rampStep(4.0, 'They remember the planks from the sinkhole and rig a wobbly ramp.', 'Planks... like at the sinkhole?'),
    course(1, 6.0, { ramp: [0, 0], cap: 'Layer 2. With nobody organising the build, they keep bumping into each other on the ramp.', say: 'Oof! Sorry! 😬' }),
    course(2, 6.0, { ramp: [0, 1], wide: true, cap: 'Without the vision, they build layer 3 straight up, as wide as the layer below...' }),
    { dur: 3.4, b: 'hold', mood: 'confused', phase: 'REDO', wrong: true, st: holdStations, cap: 'Wait... was it meant to be pointy? The vision never reached the koalas, so the shape is wrong.', say: 'Wait, was it meant to be pointy?! 😳',
      onStart: () => { B.wrongShow = true; sfx('sting'); stats(); } },
    course(2, 4.4, { ramp: [1, 1], tear: true, wide: false, phase: 'REDO', cap: 'They tear the whole layer down and start it again. Days of work, lost.', say: 'Take it all down... 😩' }),
    course(2, 6.0, { ramp: [1, 1], phase: 'REDO', cap: 'Second try: layer 3, stepped in this time.', onStart: () => { B.wrongShow = false; B.wrongP = 0; } }),
    course(3, 7.0, { ramp: [1, 2], rope: true, cap: 'Rope from the cliff, but no rollers: Banjo\'s idea never gets passed on, so every block is dragged up the ramp.',
      onStart: () => { skill('🪢', 'Ropes', 'the cliff'); bubble('team', 'Banjo: Rollers might help? ...never mind. 😕', 2.6); } }),
    course(4, 7.0, { ramp: [2, 3], rope: true, cap: 'Layer 5. Slow, heavy going, and nobody up top knows how far along they are.',
      onStart: () => later(1.2, () => { if (!S.leader.meeting) startMeeting(S.meetings[3]); }) }),
    ladderStep(3.2, 'They lash a ladder for the top, a skill learned the hard way at the rock wall.'),
    course(5, 6.0, { cap: 'The sixth and final layer.' }),
    capFlow(4.2, 'The capstone goes up the line, slowly.'),
    climb(3.8, 'All four koalas climb to the top.'),
    capLift(3.4, 'Together they lift the capstone and set it on top...'),
    reality(3.0, 'Finally the pyramid matches the vision, but many days later than it could have.', 'There it is... at last. 🦅'),
    down(6.4, 'Tired, the koalas climb back down carefully, one at a time.', 'Slowly... one at a time. 🪜'),
  ];
}
// Runs every update while building: koalas walk to their stations, blocks are counted (for sound), courses complete.
function updateBuild(dt) {
  const B = S.build, tm = S.team, st = tm.mode === 'seq' && tm.seq ? tm.seq[tm.step] : null, p = st ? Math.min(1, tm.stepT / st.dur) : 1;
  B.check = Math.max(0, B.check - dt);
  for (let k = 0; k < COURSES; k++) {
    const n = Math.floor(B.c[k] * blocksIn(k, false));
    if (n > B.pl[k]) { B.pl[k] = n; sfx('block'); }
    if (B.c[k] >= 1 && !B.doneK[k]) { B.doneK[k] = true; sfx('layer', { n: k }); }
  }
  const nw = Math.floor(B.wrongP * blocksIn(2, true)); if (nw !== B.pl[6]) { if (nw > B.pl[6]) sfx('block'); B.pl[6] = nw; }
  if (!B.kpOn) return;
  if (st && st.route) {
    B.kp.forEach((P, i) => { const q = st.route(i, p), dx = q.x - P.x; P.mv = Math.hypot(dx, q.y - P.y) > 0.05; if (Math.abs(dx) > 0.02) P.dir = Math.sign(dx); P.x = q.x; P.y = q.y; });
    B.tgt = st.b === 'down' ? grounds() : finals(); return;
  }
  let T = st && st.st ? st.st(p) : null;
  if (!T && S.finished) T = grounds();
  if (!T && st && (st.b === 'caplift' || st.b === 'reality')) T = finals();
  if (!T) T = B.tgt; if (!T) return;
  B.tgt = T;
  const V = 170 * dt;
  B.kp.forEach((P, i) => {
    const dx = T[i].x - P.x, dy = T[i].y - P.y, d = Math.hypot(dx, dy);
    if (d < 0.01) { P.mv = false; return; }
    const m = Math.min(d, V); P.x += dx / d * m; P.y += dy / d * m; P.mv = d > 1.5; if (Math.abs(dx) > 0.3) P.dir = Math.sign(dx);
  });
}
// Poses for drawing: positions from the simulation, moods from what each koala is doing right now.
function buildPoses(st, sp) {
  const B = S.build; if (!B.on || !B.kpOn || !B.kp) return null;
  const b = st && st.b, T = B.tgt || [], on = settings.comms;
  const blocks = st && st.flow ? flowBlocks(st, sp).map(q => q.pos) : [];
  return B.kp.map((P, i) => {
    const t = T[i] || { face: 1 }, lane = t.lane || 0;
    let mood = '', carry = null, hop = 0;
    const near = blocks.some(q => Math.abs(q.x - P.x) < 22 && Math.abs(q.y - P.y) < 30);
    if (S.finished) mood = 'happy';
    else if (P.mv) mood = b === 'climb' && i === 0 ? 'lift' : 'walk';
    else if (b === 'caplift' || (b === 'climb' && i === 0)) mood = 'lift';
    else if (b === 'reality') mood = '';
    else if (b === 'shape') mood = 'chisel';
    else if (b === 'ramp' || b === 'ladder') mood = 'work';
    else if (b === 'hold') mood = st.mood || '';
    else if (near) mood = 'carry';
    else if (b === 'course' || b === 'capflow') mood = i === 2 ? 'chisel' : i === 3 && st.rope ? 'haul' : i === 3 && !on ? 'struggle' : 'work';
    if (P.mv && Math.abs(T[i] ? T[i].y - P.y : 0) > 20 && b !== 'climb' && b !== 'down') hop = 4; // hopping up a step
    let x = P.x;
    if (!on && b === 'course' && !P.mv) x += Math.sin(S.t * 2.1 + i * 1.7) * 5; // unsure, shuffling about
    return { x, y: P.y, lane, flip: P.mv ? P.dir < 0 : t.face < 0, carry, mood, moving: P.mv, hop };
  });
}
// Blocks in flight along the supply line (world positions), plus the capstone while it travels up.
function flowBlocks(st, sp) {
  const F = st.flow(sp), out = [];
  if (!F.n) return out;
  const a = Math.min(1, sp / 0.06, (1 - sp) / 0.06);
  for (let j = 0; j < F.n; j++) {
    let s = (sp * F.C + j / F.n) % 1; if (F.rev) s = 1 - s;
    out.push({ pos: along(F.pts, s), j, a: Math.max(0, a) });
  }
  return out;
}
function blocksIn(k, wide) { const h = wide ? cHalf(k - 1) : cHalf(k), n = Math.max(1, Math.round(2 * h / 36)); return n * 2 + 1; }


// ---------- v7.1: the team huddle (a stand-up before the build) ----------
// Formation: a little circle, each koala facing the middle. [dx from the team's centre, lane (depth), faces left]
const HUDDLE = [[60, 9, true], [24, -9, true], [-24, -9, false], [-60, 9, false]];
const HUDDLE_OFF_CAP = 'The koalas huddle too, but nobody ever told them what the final product looks like. A team can\'t self-organise around a goal it can\'t see.';
const HUDDLE_LINES = {
  on: [[0, 0.9, "Kip: Okay team, next steps? 👉🔺"], [2, 2.7, "Matilda: I'll shape the stone. 🔨"], [1, 4.5, "Banjo: Rollers from the logs, like the bridge! 🪵"], [3, 6.3, "Wattle: I can haul. I've got this now! 💪"]],
  off: [[0, 0.9, "Kip: So... what's next?"], [1, 2.6, "Banjo: What are we even building? 🤔"], [2, 4.3, "Matilda: Something big? A box?"]],
};
function startHuddle() {
  const H = S.huddle, on = settings.comms; H.on = true; H.t = 0; H.spk = -1; H.wrapT = -1;
  if (on || !S.leader.meeting) caption(on ? 'The team meets to plan their next steps: teams self-organise when they understand the goal.' : HUDDLE_OFF_CAP, 'TEAM HUDDLE', { hold: 3.4 });
  else H.capLater = true; // OFF: the Leader's meeting holds the caption bar, so say it when the huddle breaks up
  for (const [i, at, text] of HUDDLE_LINES[on ? 'on' : 'off']) later(at, () => { if (!H.on) return; H.spk = i; bubble('team', text, 1.7, true); });
}
function updateHuddle(dt) {
  const H = S.huddle, on = settings.comms; H.t += dt;
  const talkEnd = on ? 8.1 : 6.0;
  if (H.wrapT < 0 && H.t >= talkEnd && !S.leader.meeting) { // the plan is agreed (and the Leader's meeting is over): paws in
    H.wrapT = H.t; H.spk = -1;
    if (on) { sfx('support'); bubble('team', 'Paws in... GO TEAM! 🐾🙌', 1.8, true); caption('Plan agreed, paws in: everyone knows their part and how it fits the vision.', 'TEAM HUDDLE', { hold: 1.8 }); }
    else { H.spk = 3; bubble('team', 'Wattle: Let\'s just... start? 🤷', 2.4, true); if (H.capLater) caption(HUDDLE_OFF_CAP, 'TEAM HUDDLE', { hold: 2.6 }); }
  }
  if (H.wrapT >= 0 && H.t - H.wrapT >= (on ? 2.4 : 2.8)) { H.on = false; H.done = true; H.spk = -1; S.team.lastX = null; }
}
// 0 → 1 as the koalas step into the circle, back to 0 as they step out again.
function huddleK() {
  const H = S.huddle, inK = ease(clamp(H.t / 0.9, 0, 1));
  if (H.wrapT < 0) return inK;
  const outAt = H.wrapT + (settings.comms ? 1.8 : 2.2);
  return inK * (1 - ease(clamp((H.t - outAt) / 0.6, 0, 1)));
}
function huddlePoses() {
  const H = S.huddle; if (!H.on) return null;
  const tm = S.team, cx = tm.x - 1.5 * MEMBER_GAP, k = huddleK(), on = settings.comms;
  const inMove = H.t < 0.9, outMove = H.wrapT >= 0 && k < 0.999 && H.t > H.wrapT + 0.5;
  const paws = on && H.wrapT >= 0 ? clamp((H.t - H.wrapT) / 0.4, 0, 1) * k : 0;
  return HUDDLE.map(([dx, ln, left], i) => {
    const x0 = tm.x - i * MEMBER_GAP, lean = paws * (left ? -16 : 16);
    const x = lerp(x0, cx + dx, k) + lean, lane = ln * k;
    let mood = on ? '' : 'confused', flip = k > 0.5 ? left : false, hop = 0;
    const moving = (inMove || outMove) && Math.abs(cx + dx - x0) > 1;
    if (moving) { mood = 'walk'; flip = outMove ? false : (cx + dx < x0); }
    else if (H.spk === i && H.wrapT < 0) { mood = on ? 'lift' : 'confused'; if (on && i === 0 && H.t < 2.6) flip = false; } // the speaker gestures (Kip points east, to the build site)
    else if (H.wrapT < 0) hop = on ? Math.max(0, Math.sin(H.t * 5 + i * 1.3)) * 1.6 : 0; // listeners nod along
    if (paws > 0) { mood = 'lift'; hop = Math.max(0, Math.sin((H.t - H.wrapT - 0.5) * 9)) * (H.t - H.wrapT > 0.5 && H.t - H.wrapT < 1.6 ? 9 : 0); }
    if (!on && H.wrapT >= 0 && !moving) mood = 'confused';
    return { x, lane, flip, mood, moving, hop };
  });
}
// The plan, scratched in the dirt in the middle of the circle: a stepped triangle (ON) or a wobbly box with a "?" (OFF).
function drawHuddleSketch() {
  const H = S.huddle, tm = S.team, cx = tm.x - 1.5 * MEMBER_GAP, x = cx - camX, y = memberY(cx) + 3, on = settings.comms;
  const a = huddleK(); if (a <= 0.01) return;
  const f = clamp((H.t - 1.2) / (on ? 4.8 : 3.6), 0, 1);
  ctx.save(); ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(150,110,70,0.6)'; ctx.beginPath(); ctx.ellipse(x, y, 32, 8, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = '#3e2a1a'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  const pts = on ? [[-20, 3], [20, 3], [0, -9], [-20, 3]] : [[-15, 3], [15, 4], [14, -7], [-14, -8], [-15, 3]];
  const segs = pts.length - 1, upto = f * segs;
  ctx.beginPath(); ctx.moveTo(x + pts[0][0], y + pts[0][1]);
  for (let j = 1; j <= segs; j++) { const q = clamp(upto - (j - 1), 0, 1); if (q <= 0) break; const A = pts[j - 1], B2 = pts[j]; ctx.lineTo(x + lerp(A[0], B2[0], q), y + lerp(A[1], B2[1], q)); }
  ctx.stroke();
  if (on && f >= 1) { ctx.lineWidth = 1; ctx.beginPath(); for (const yy of [-1, -5]) { const hw = 20 * (9 - (3 - yy)) / 12 * 0 + (yy === -1 ? 13 : 7); ctx.moveTo(x - hw, y + yy); ctx.lineTo(x + hw, y + yy); } ctx.stroke();
    ctx.fillStyle = '#ffd34d'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('★', x, y - 11); ctx.textAlign = 'left'; }
  if (!on && f >= 1) { ctx.fillStyle = '#3e2a1a'; ctx.font = 'bold 11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('?', x + 22, y - 2); ctx.textAlign = 'left'; }
  ctx.restore();
}

// ---------- v3: surprise delays (bottom-up communication) ----------
function surpriseSeq(sp) {
  const snake = sp.type === 'snake';
  const first = { dur: 1.6, mood: 'stuck', cap: sp.reveal, say: sp.revSay, rev: true, phase: 'SURPRISE' };
  if (settings.comms) return [
    first,
    { dur: 1.0, mood: '', until: () => sp.chainDone, onStart: () => upChain(sp) },
    ...(sp.type === 'sinkhole' ? [{ dur: 3.6, gather: 'planks', cap: sp.gatherCap }] : []),
    { dur: snake ? 2.6 : 3.2, mood: snake ? 'sneak' : 'work', prog: true, cap: sp.fixCap },
  ];
  return [
    first,
    { dur: 2.2, mood: 'confused', cap: 'The koalas call up for help... but with communication OFF, nobody answers.', say: sp.up + ' ...hello?' },
    sp.type === 'sinkhole'
      ? { dur: 5.2, gather: 'planks', lost: true, wrong: true, say: 'Guess we\'re on our own... 😟', cap: 'On their own, the koalas search the bush for anything to bridge the hole...' }
      : { dur: 2.0, mood: 'confused', move: -70, wrong: true, say: 'Guess we\'re on our own... 😟' },
    ...(sp.type === 'sinkhole' ? [] : [{ dur: 1.6, mood: 'walk', move: 70 }]),
    { dur: 4.4, mood: snake ? 'sneak' : 'work', prog: true, cap: sp.aloneCap },
  ];
}
// Team -> Manager -> Leader, then the Leader's answer travels back down.
function upChain(sp) {
  caption('Bottom-up communication: the koalas report the surprise straight up to the Manager.', 'SURPRISE');
  say('team', 'manager', sp.up, sp.ack, () => {
    S.waiters.push(() => {
      caption('The Manager escalates it to the Leader: what happened, what the team needs, and the likely delay.', 'SURPRISE');
      say('manager', 'leader', sp.toLeader, sp.leaderReply, () => {
        S.team.reported++; stats();
        S.leader.beam = 'goal'; S.leader.beamT = 2.6;
        const down = () => pulse('leader', 'manager', PULSE_COL.leader, () => say('manager', 'team', sp.down, sp.teamAck, () => { sp.chainDone = true; }));
        if (sp.support) {
          caption('Leaders back the team: the Leader says YES to saws and safety gear, and a supply drop floats down through a gap in the canopy. 🪂', 'LEADER SUPPORT', { hold: 4 });
          S.drop = { x: S.team.x - 160, t: 0, landed: false, sp }; sfx('yes'); later(0.3, () => sfx('parachute'));
          whenFree(() => S.drop && S.drop.landed, () => later(0.5, down));
        } else {
          caption('The Leader accepts the delay and reassures everyone: safety first, the goal stays the same.', 'SURPRISE');
          later(0.8, down);
        }
      });
    });
  });
}

// ---------- v4: manager meetings (sideways coordination under the canopy) ----------
function startMgrMeeting(m) {
  S.mgr.meeting = { def: m, phase: 'arrive', t: 0, li: 0 };
  mark('mm:' + S.mgrMeetings.indexOf(m)); sfx('hoot', { visitor: true });
  caption(`Manager meeting: ${m.who} owl flies in under the canopy ${m.topic}. Managers coordinate sideways too.`, 'Manager meeting', { force: true, hold: () => S.mgr.meeting && S.mgr.meeting.phase !== 'leave' });
}
function updateMgrMeeting(dt) {
  const M = S.mgr.meeting; if (!M) return;
  M.t += dt;
  if (M.phase === 'talk') {
    const L = settings.comms || !M.def.offLines ? M.def.lines : M.def.offLines;
    while (M.li < L.length && M.t >= M.li * MM_LINE_GAP) { const [w, txt] = L[M.li++]; bubble(w, txt, 2.3); mmLine(M, M.li - 1); }
  }
  if (M.t >= MM_PHASES[M.phase]) {
    M.t = 0;
    if (M.phase === 'arrive') M.phase = 'talk';
    else if (M.phase === 'talk') {
      M.phase = 'leave';
      S.team.syncs++; stats();
      S.mgr.focusT = 2.0;
      caption('The visiting owl flies off, and the Manager refocuses on the koalas. 🐨', 'Refocus');
    } else { S.mgr.meeting = null; ropeVisitCheck(); }
  }
}
function mgrVisitorPos() {
  const M = S.mgr.meeting, bx = S.mgr.x + 205, by = MANAGER_Y + 46 + Math.sin(S.t * 2.4) * 5;
  const p = Math.min(1, M.t / MM_PHASES[M.phase]);
  if (M.phase === 'arrive') { const q = ease(p); return { x: bx + (1 - q) * 560, y: by - (1 - q) * (1 - q) * 130 }; }
  if (M.phase === 'leave') { const q = ease(p); return { x: bx + q * 600, y: by - q * q * 150 }; }
  return { x: bx, y: by };
}

// ---------- v3: leader meetings (competing priorities) ----------
function startMeeting(m) {
  S.leader.meeting = { def: m, phase: 'arrive', t: 0, cards: m.visitors.map(() => ({ shown: false, state: 'pending' })) };
  mark('meet:' + S.meetings.indexOf(m)); sfx('whoosh'); later(0.5, () => sfx('flap'));
  caption(m.capArrive || `Meeting time! Eagles from ${m.who} fly in above the canopy, each with their own priority.`, 'Meeting', { hold: () => S.leader.meeting && S.leader.meeting.phase === 'arrive' });
}
function updateMeeting(dt) {
  const M = S.leader.meeting; if (!M) return;
  M.t += dt;
  const d = M.def;
  if (M.phase === 'ask') {
    M.cards.forEach((c, i) => { if (!c.shown && M.t >= i * 0.8) { c.shown = true; if (TRACE) TRACE('card', d.visitors[i].label, d.visitors[i].ask); } });
  } else if (M.phase === 'decide') {
    const yi = d.visitors.findIndex(v => v.accept);
    if (yi >= 0 && M.t >= 0.3 && M.cards[yi].state === 'pending') { M.cards[yi].state = 'yes'; bubble('leader', d.yes, 2.4, true); sfx('yes'); }
    if (M.t >= 1.5 && M.cards.some(c => c.state === 'pending')) {
      let n = 0; M.cards.forEach(c => { if (c.state === 'pending') { c.state = 'parked'; n++; } });
      S.team.priorities += n; stats();
      bubble('leader', d.no, 2.6, true);
    }
  }
  if (M.t >= MEETING_PHASES[M.phase]) {
    M.t = 0;
    if (M.phase === 'arrive') {
      M.phase = 'ask';
      caption(d.capAsk || 'Everyone wants something: lots of competing priorities land on the Leader at once.', 'Meeting', { hold: () => S.leader.meeting && S.leader.meeting.phase === 'ask' });
      M.cards.forEach(c => c.shown = false);
    } else if (M.phase === 'ask') {
      M.phase = 'decide';
      if (d.support) sfx('support');
      if (d.support) caption(d.support, 'LEADER SUPPORT', { hold: () => S.leader.meeting && S.leader.meeting.phase === 'decide' });
      else caption('The Leader weighs them up: yes to what supports the pyramid, "not now" to the rest.', 'Priorities', { hold: () => S.leader.meeting && S.leader.meeting.phase === 'decide' });
    } else if (M.phase === 'decide') {
      M.phase = 'leave'; sfx('whoosh');
      S.leader.beam = 'goal'; S.leader.beamT = 3.0;
      caption(d.capLeave || 'The visiting eagles fly off. The Leader keeps the beam on the vision and the team keeps going. 🔺', 'Focus');
    } else {
      S.leader.meeting = null;
      bubble('leader', 'Onwards, everyone. Eyes on the vision! 🔺', 2.4); meetingFollowUp(d);
    }
  }
}
const MEETING_SLOTS = [[-200, 16], [200, 16], [-420, 30]];
function visitorPos(M, i) {
  const L = S.leader, [sx, sy] = MEETING_SLOTS[i];
  const bx = L.x + L.ox, by = L.y + L.oy;
  const p = Math.min(1, M.t / MEETING_PHASES[M.phase]);
  if (M.phase === 'arrive') { // spiral in, circling the leader
    const q = ease(p), a = (1 - q) * 6 + i * 2.1, R = (1 - q) * 260;
    return { x: bx + sx + Math.cos(a) * R + (1 - q) * (1 - q) * 700, y: by + sy + Math.sin(a) * R * 0.3 - (1 - q) * (1 - q) * 110 };
  }
  if (M.phase === 'leave') { const q = ease(p); return { x: bx + sx + q * 800, y: by + sy - q * 170 }; }
  return { x: bx + sx + Math.sin(S.t * 1.5 + i) * 6, y: by + sy + Math.sin(S.t * 2 + i) * 5 };
}

// ---------- camera ----------
function updateCamera(dt) {
  if (S.introCam === 'team') camTarget = 0;
  else if (S.introCam === 'goal') camTarget = GOAL_X + 260 - viewW;
  else if (S.build.on) camTarget = GOAL_X - viewW / 2 - 160; // v7: frame the build site
  else camTarget = S.team.x - viewW * 0.3;
  camTarget = clamp(camTarget, 0, Math.max(0, WORLD_W - viewW));
  camX += (camTarget - camX) * Math.min(1, dt * 2.2);
}
// ---------- v6: sound that follows the story ----------
// Repeating work sounds (saws, hammer taps, thunks...) are driven from the simulation; sound.js rate-limits them.
function audioTick(dt) {
  const tm = S.team;
  if (tm.mode === 'hack') sfx('saw');
  else if (tm.mode === 'seq' && tm.seq) {
    const st = tm.seq[tm.step];
    if (tm.mood === 'chisel') { S.tapT += dt; if (S.tapT >= 0.3) { S.tapT = 0; S.tapN++; sfx('tap', { accent: S.tapN % 3 === 1 }); } }
    else if (!tm.seqOb && st && st.bushHp) sfx('saw');
    else if (st && st.b === 'course' && st.rope) sfx('haul');
    else if (st && (st.b === 'ramp' || st.b === 'ladder')) sfx('thunk');
    else if (tm.seqOb && st && st.prog && tm.mood !== 'sneak') sfx({ vines: 'snip', river: 'thunk', bog: 'clack', log: 'rustle', cliff: 'creak', wall: 'thunk', sinkhole: 'thunk', treefall: 'saw' }[tm.seqOb.type] || 'thunk');
  }
}
// Ambient levels (0..1) for the forest bed: water near the river (and a trickle in the creek bed), bees, the campfire, storm wind.
function ambLevels() {
  const tm = S.team, tx = tm.x, rv = ob('river'), bz = ob('bees'), ld = S.leader;
  let water = rv ? clamp(1 - Math.abs(tx - (rv.x + rv.w / 2)) / 420, 0, 1) : 0;
  if (S.idea.go && tx > CREEK.x0 - 150 && tx < CREEK.x1 + 80) water = Math.max(water, 0.35);
  const bees = bz ? clamp(1 - Math.abs(tx - bz.x) / 520, 0, 1) : 0;
  const fire = tm.mood === 'rest' || (S.mgr.task && S.mgr.task.kind === 'break' && tm.mode === 'seq' && tm.step === 1) ? 1 : 0;
  const wind = ld.dist && ld.dist.def.kind === 'storm' && ld.dist.phase === 'distract' ? 1 : 0;
  return { water: S.finished ? 0 : water, bees, angry: bz && bz.angry > 0 ? 1 : 0, fire, wind };
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
    if (x < -30 || x > viewW + 30 || Math.abs(v.x - GOAL_X) < PYR_HALF + 20) continue;
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

// v4: the koalas break the boulder down: cracks, then it splits into chunks, then rubble.
const CRACKS = [[[0.5, -104], [0.45, -82], [0.53, -64], [0.46, -42]], [[0.12, -46], [0.27, -44], [0.36, -28]], [[0.86, -62], [0.72, -54], [0.67, -36], [0.73, -14]],
  [[0.46, -42], [0.38, -22], [0.44, 0]], [[0.3, -88], [0.37, -70], [0.33, -58]], [[0.6, -20], [0.72, -8]]];
function drawRubble() {
  const b = ob('boulder'); if (!b.done) return;
  const x = b.x - camX; if (x > viewW + 80 || x + b.w < -80) return;
  // v5: the koalas sweep the rubble aside, so it stays visible beside the path instead of under their feet
  for (let k = 0; k < 16; k++) {
    const rx = x - 40 + ((k * 37) % 100) / 100 * (b.w + 80), rs = 7 + (k * 13) % 8, ry = GROUND + 30 + ((k * 23) % 3) * 7;
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(rx + 2, ry + 2, rs, rs * 0.4, 0, 0, 7); ctx.fill();
    ctx.fillStyle = k % 2 ? '#8a8d91' : '#a6a9ad'; ctx.beginPath(); ctx.ellipse(rx, ry - rs * 0.45, rs, rs * 0.7, 0, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.beginPath(); ctx.ellipse(rx - rs * 0.3, ry - rs * 0.7, rs * 0.4, rs * 0.25, 0, 0, 7); ctx.fill();
  }
}
// v5: a dry creek bed runs beside the shrubs. It was always there; only the koalas could see it.
function drawCreek() {
  const x0 = CREEK.x0 - camX, x1 = CREEK.x1 - camX; if (x1 < -40 || x0 > viewW + 40) return;
  const top = GROUND + 14, w = x1 - x0;
  ctx.fillStyle = '#c9ad7a';
  ctx.beginPath(); ctx.moveTo(x0, top + 12);
  ctx.bezierCurveTo(x0 + 30, top - 2, x0 + 60, top, x0 + 90, top); ctx.lineTo(x1 - 90, top);
  ctx.bezierCurveTo(x1 - 60, top, x1 - 30, top - 2, x1, top + 12);
  ctx.bezierCurveTo(x1 - 40, top + 34, x0 + 40, top + 34, x0, top + 12); ctx.fill();
  ctx.strokeStyle = 'rgba(120,180,230,0.75)'; ctx.lineWidth = 2.2; ctx.beginPath();
  for (let k = 0; k <= 40; k++) { const px = x0 + 50 + k / 40 * (w - 100), py = top + 15 + Math.sin(k * 0.7 + S.t * 1.5) * 2; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
  ctx.stroke();
  const r = rng(5);
  for (let k = 0; k < 22; k++) { const px = x0 + 30 + r() * (w - 60), py = top + 6 + r() * 18, rs = 2 + r() * 3; ctx.fillStyle = k % 2 ? '#9e8a68' : '#b8a27e'; ctx.beginPath(); ctx.ellipse(px, py, rs, rs * 0.7, 0, 0, 7); ctx.fill(); }
  if (S.idea.adopted && !S.finished) { ctx.font = 'bold 10px system-ui, sans-serif'; tag(x0 + 70, top + 40, 'CREEK ROUTE', '#b3e5fc'); }
}
// Thick shrubbery on the planned route.
function drawShrubs() {
  for (const b of S.pathBushes) {
    if (!b.shrub) continue;
    const x = b.x - camX; if (x < -50 || x > viewW + 50) continue;
    const gy = GROUND + 3;
    if (b.cut) { ctx.fillStyle = '#6d4c2f'; ctx.fillRect(x - 6, gy - 10, 4, 10); ctx.fillRect(x + 3, gy - 12, 4, 12); continue; }
    const k = 1.5 * b.s * (0.4 + 0.6 * b.hp), wob = b.hp < 1 && S.team.bush === b ? Math.sin(S.t * 40) * 1.5 : 0;
    ctx.fillStyle = '#2f7d35'; ctx.beginPath();
    ctx.ellipse(x + wob, gy - 18 * k, 19 * k, 18 * k, 0, 0, 7); ctx.ellipse(x - 13 * k + wob, gy - 9 * k, 13 * k, 11 * k, 0, 0, 7); ctx.ellipse(x + 13 * k + wob, gy - 10 * k, 13 * k, 11 * k, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#4a9e45'; ctx.beginPath(); ctx.ellipse(x - 5 * k + wob, gy - 27 * k, 9 * k, 5 * k, -0.3, 0, 7); ctx.fill();
    const fl = [[-9, -20, '#ff8a65'], [7, -26, '#ffd54f'], [11, -12, '#f06292'], [-3, -9, '#ffd54f'], [2, -18, '#f06292']];
    for (const [fx, fy, c] of fl) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x + fx * k + wob, gy + fy * k, 2.6, 0, 7); ctx.fill(); }
  }
}
function drawBoulder() {
  const b = ob('boulder');
  const x = b.x - camX; if (x > viewW + 80 || x + b.w < -80) return;
  const p = b.prog, busy = S.team.seqOb === b && (S.team.mood === 'chisel' || S.team.mood === 'work');
  const shake = busy ? Math.sin(S.t * 40) * 1.2 : 0;
  const rubble = (n, spread) => {
    for (let k = 0; k < n; k++) {
      const rx = x - spread / 2 + ((k * 37) % 100) / 100 * (b.w + spread), rs = 5 + (k * 13) % 7;
      ctx.fillStyle = k % 2 ? '#8a8d91' : '#a6a9ad'; ctx.beginPath(); ctx.ellipse(rx, GROUND - rs * 0.45 + 2, rs, rs * 0.7, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.ellipse(rx - rs * 0.3, GROUND - rs * 0.7 + 2, rs * 0.4, rs * 0.25, 0, 0, 7); ctx.fill();
    }
  };
  if (b.done) return; // the rubble is drawn in front of the bush row (drawRubble)
  if (p < 0.55) {
    ctx.fillStyle = '#8a8d91';
    ctx.beginPath(); ctx.ellipse(x + b.w / 2 + shake, GROUND - 48, b.w / 2, 56, 0, Math.PI, 0); ctx.lineTo(x + b.w + shake, GROUND + 4); ctx.lineTo(x + shake, GROUND + 4); ctx.fill();
    ctx.fillStyle = '#a7aaae';
    ctx.beginPath(); ctx.ellipse(x + b.w * 0.38 + shake, GROUND - 70, b.w * 0.22, 18, -0.4, 0, 7); ctx.fill();
    ctx.fillStyle = '#5f8f3a';
    ctx.beginPath(); ctx.ellipse(x + b.w * 0.7 + shake, GROUND - 92, 24, 9, 0.3, 0, 7); ctx.fill();
    const n = p > 0 ? Math.ceil(p / 0.55 * CRACKS.length) : 0;
    ctx.strokeStyle = '#34363a'; ctx.lineWidth = 2.4; ctx.lineJoin = 'round';
    for (let k = 0; k < n; k++) { ctx.beginPath(); CRACKS[k].forEach(([fx, fy], j) => j ? ctx.lineTo(x + fx * b.w + shake, GROUND + fy) : ctx.moveTo(x + fx * b.w + shake, GROUND + fy)); ctx.stroke(); }
    ctx.lineJoin = 'miter';
    if (p === 0) { ctx.strokeStyle = '#6a6d71'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + b.w * 0.6, GROUND - 40); ctx.lineTo(x + b.w * 0.72, GROUND - 22); ctx.lineTo(x + b.w * 0.66, GROUND - 6); ctx.stroke(); }
  } else {
    if (!b.split) { b.split = true; for (let k = 0; k < 26; k++) S.particles.push({ kind: 'confetti', x: b.x + b.w / 2 + (Math.random() - 0.5) * 60, y: GROUND - 50 - Math.random() * 40, vx: (Math.random() - 0.5) * 220, vy: -80 - Math.random() * 120, r: 0, vr: 5, life: 0.9, c: '#9a9da1' }); }
    const q = ease((p - 0.55) / 0.45), sz = lerp(1, 0.32, q);
    rubble(Math.floor(q * 14), 40);
    const chunk = (cx, cy, rx, ry, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(cx + shake, cy, rx, ry, 0, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(40,40,44,0.5)'; ctx.lineWidth = 1.5; ctx.stroke(); };
    chunk(x + b.w * 0.24 - 34 * q, GROUND - 40 * sz, 40 * sz, 42 * sz, '#868a8e');
    chunk(x + b.w * 0.78 + 34 * q, GROUND - 38 * sz, 38 * sz, 40 * sz, '#8f9296');
    chunk(x + b.w * 0.5, GROUND - lerp(84, 22, q), 32 * sz, 25 * sz, '#a2a5a9');
  }
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
  // rope (v7.6: Project Manager B takes it away once it has been shared)
  if (c.prog > 0 && !S.gifts.ropeTaken) {
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
  const thinK = S.build.on ? clamp((S.t - S.build.t0) / 2, 0, 1) : 0;
  // over the build site the leaves thin out (most of all around the top, where the koalas end up) so the build stays visible
  const thinA = bx => { if (!thinK) return 1; const d = Math.abs(bx - GOAL_X); return d < PYR_HALF + 60 ? lerp(1, 0.85, thinK) : 1; }; // v7.2: just a light thinning now; layering keeps the pyramid in front
  for (const b of deco.blobs) {
    const x = b.x - camX; if (x < -80 || x > viewW + 80) continue;
    ctx.globalAlpha = thinA(b.x);
    ctx.fillStyle = cols[b.c];
    const sw = Math.sin(S.t * 0.8 + b.x) * 2;
    ctx.beginPath(); ctx.ellipse(x + sw, b.y, b.rad, b.rad * 0.62, 0, 0, 7); ctx.fill();
  }
  // leafy highlight along the top edge
  ctx.fillStyle = 'rgba(150,215,120,0.55)';
  for (const b of deco.blobs) {
    const x = b.x - camX; if (x < -80 || x > viewW + 80 || b.y > CANOPY_TOP + 45) continue;
    ctx.globalAlpha = thinA(b.x);
    ctx.beginPath(); ctx.ellipse(x - b.rad * 0.2, b.y - b.rad * 0.3, b.rad * 0.45, b.rad * 0.2, 0, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
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
  const creek = L.beam === 'creek';
  const tx = (creek ? (CREEK.x0 + CREEK.x1) / 2 : L.beam === 'goal' ? visionScreen().x + camX : S.team.x - MEMBER_GAP * 1.5) - camX, ty = creek ? GROUND + 26 : L.beam === 'goal' ? PYR_APEX + 6 : memberY(S.team.x) - 70;
  const a = Math.min(1, L.beamT) * 0.8;
  if (creek) { // course correction: the beam re-aims at the better route, then on to the pyramid
    ctx.save(); ctx.globalAlpha = a; ring(tx, ty, 26 + Math.sin(S.t * 4) * 3, '#ffd34d'); ctx.restore();
    ctx.save(); ctx.strokeStyle = `rgba(255,211,77,${a})`; ctx.lineWidth = 3; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -S.t * 40;
    ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(tx, ty); ctx.stroke(); ctx.restore();
    const lbl = 'New route: via the creek ➜ 🔺';
    ctx.font = 'bold 13px system-ui, sans-serif'; const lw = ctx.measureText(lbl).width + 28;
    ctx.fillStyle = `rgba(0,0,0,${a * 0.6})`; rr(viewW - lw - 16, 18, lw, 26, 13); ctx.fill();
    ctx.fillStyle = `rgba(255,211,77,${a + 0.2})`; ctx.textAlign = 'center';
    ctx.fillText(lbl, viewW - 16 - lw / 2, 36); ctx.textAlign = 'left';
    return;
  }
  ctx.save(); ctx.strokeStyle = `rgba(255,211,77,${a})`; ctx.lineWidth = 3; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -S.t * 40;
  ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(tx, ty); ctx.stroke(); ctx.restore();
  // if the target is off-screen, show an arrow at the edge
  if (tx > viewW - 10 || tx < 10) {
    const ex = tx > viewW ? viewW - 70 : 70;
    ctx.fillStyle = `rgba(0,0,0,${a * 0.6})`; rr(ex - 58, 18, 116, 26, 13); ctx.fill();
    ctx.fillStyle = `rgba(255,211,77,${a + 0.2})`; ctx.font = 'bold 13px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(L.beam === 'goal' ? 'The vision  ➜' : '⬅  The team', ex, 36); ctx.textAlign = 'left';
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

// v7.4: the Leader's outreach. Gold rings travel from the eagle to faint markers for other teams and projects just
// beyond the edge of the screen; some come back (paler) with a decision or feedback, and the marker ticks ✅.
// Where a target's marker sits on screen (fixed when the ring sets off). During the build the skills list fills the top
// left, so left-hand targets move to the top edge; a top marker never sits right on top of the eagle.
function outreachPt(T) {
  const left = T.side === 'L' && !S.build.on;
  if (left) return { x: 14, y: T.y, ax: -1 };
  if (T.side === 'R') return { x: viewW - 14, y: T.y, ax: 1 };
  const ex = S.leader.x - camX;
  let x = viewW * (T.side === 'L' ? (T.y > 120 ? 0.5 : 0.36) : T.fx);
  if (Math.abs(x - ex) < 170) x = ex + (ex > viewW * 0.5 ? -280 : 280);
  return { x: clamp(x, 420, viewW - 200), y: 14, ax: 0 };
}
function drawOutreach() {
  if (!outreachSeen()) return;
  const B = S.busy, L = S.leader; if (!B.rings.length && !Object.keys(B.marks).length) return;
  const ex = L.x + L.ox - camX, ey = L.y + L.oy;
  ctx.save();
  // the distant teams / projects
  ctx.font = 'bold 12px system-ui, sans-serif';
  for (const [k, m] of Object.entries(B.marks)) {
    const T = OUTREACH_TARGETS[k], P = m.P, side = P.ax < 0 ? 'L' : P.ax > 0 ? 'R' : 'T';
    const a = Math.min(1, (S.t - m.t0) / 0.6, (m.until - S.t) / 0.8) * 0.9; if (a <= 0) continue;
    const ok = m.ok && S.t - m.ok < 2.2;
    const text = side === 'L' ? `⬅ ${T.icon} ${T.label}${ok ? ' ✅' : ''}` : side === 'R' ? `${T.icon} ${T.label}${ok ? ' ✅' : ''} ➜` : `⬆ ${T.icon} ${T.label}${ok ? ' ✅' : ''}`;
    const w = ctx.measureText(text).width + 18, h = 22;
    const x = P.ax < 0 ? P.x - 6 : P.ax > 0 ? P.x - w + 6 : P.x - w / 2, y = P.ax === 0 ? P.y - 8 : P.y - h / 2;
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(40,30,0,0.62)'; rr(x, y, w, h, 11); ctx.fill();
    ctx.strokeStyle = ok ? 'rgba(255,241,184,0.95)' : 'rgba(255,211,77,0.8)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#ffe9a6'; ctx.fillText(text, x + 9, y + 15.5);
    if (m.hit && S.t - m.hit < 0.9) { ctx.globalAlpha = a * (1 - (S.t - m.hit) / 0.9); ring(clamp(P.x, x + 12, x + w - 12), y + h / 2, 12 + (S.t - m.hit) * 26, '#ffd34d'); }
  }
  // the rings (same style as the message pulses: a faint dotted path and three trailing circles)
  for (const r of B.rings) {
    if (r.t < 0) continue;
    const P = r.P;
    const [ax, ay, bx, by] = r.back ? [P.x, P.y, ex, ey] : [ex, ey, P.x, P.y];
    const fa = r.fade != null ? Math.max(0, 1 - r.fade / 0.4) : 1, t = r.t / r.dur;
    const col = r.back ? '#fff1b8' : '#ffd34d';
    ctx.globalAlpha = 0.4 * fa; ctx.strokeStyle = r.back ? '#fff1b8' : '#e0a800'; ctx.lineWidth = 2; ctx.setLineDash([3, 6]);
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); ctx.setLineDash([]);
    for (let k = 0; k < 3; k++) {
      const tt = t - k * 0.08; if (tt < 0) continue;
      const cx = lerp(ax, bx, tt), cy = lerp(ay, by, tt), rad = (r.back ? 6 : 7) + k * 5 + Math.sin(S.t * 10) * 1.5;
      ctx.globalAlpha = (1 - k * 0.3) * 0.45 * fa; ctx.strokeStyle = '#8a6a00'; ctx.lineWidth = 5; // soft dark edge so the gold reads against the pale sky
      ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 7); ctx.stroke();
      ctx.globalAlpha = (1 - k * 0.3) * fa; ctx.strokeStyle = col; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 7); ctx.stroke();
    }
    if (!r.back && r.t < 0.8) { ctx.globalAlpha = 0.6 * fa * (1 - r.t / 0.8); ring(ex, ey, 24 + r.t * 40, '#ffd34d'); } // a ripple as it leaves the eagle
  }
  ctx.restore();
}

// Which speakers' bubbles each perspective shows ('visitor' is the visiting owl in a manager meeting; the visiting
// eagles in the Leader's meetings speak through their priority cards, which stay visible).
const BUBBLE_VIEW = { all: null, leader: ['leader'], manager: ['manager', 'visitor'], team: ['team'] };
function drawBubbles() {
  const cols = { leader: ['#fff7d6', '#b08a00'], manager: ['#f3e8ff', '#7b3fb0'], team: ['#e3f6ff', '#1f6f9f'],
    visitor: S.visit ? [S.visit.def.belly, S.visit.def.body] : S.mgr.meeting ? [S.mgr.meeting.def.belly, S.mgr.meeting.def.body] : ['#eee', '#777'] };
  ctx.font = '600 13px system-ui, sans-serif';
  const only = BUBBLE_VIEW[settings.view]; // v7.2: each perspective shows only that role's dialogue
  const ob = S.busy.bubble, list = ob && !S.leader.meeting && !S.bubbles.some(b => b.who === 'leader') ? S.bubbles.concat([ob]) : S.bubbles; // v7.4
  for (const b of list) {
    if (only && !only.includes(b.who)) continue;
    const p = agentPos(b.who);
    if (p.x - camX < -30 || p.x - camX > viewW + 30) continue; // speaker is off-screen
    const a = Math.min(1, b.t * 4, (b.dur - b.t) * 3);
    const w = ctx.measureText(b.text).width + 20, h = 26;
    const px = p.x - camX;
    let x, y;
    ctx.globalAlpha = a;
    ctx.fillStyle = cols[b.who][0]; ctx.strokeStyle = cols[b.who][1]; ctx.lineWidth = 2;
    if (b.who === 'leader' && S.leader.meeting) {
      // In a meeting the visiting eagles' priority cards sit beside the leader, so its bubble goes underneath.
      x = clamp(px - w / 2, 6, viewW - w - 6); y = p.y + 84; // below the visitors' name tags too
      rr(x, y, w, h, 10); ctx.fill(); ctx.stroke();
      const tx = clamp(px, x + 12, x + w - 12);
      ctx.beginPath(); ctx.moveTo(tx - 6, y + 1); ctx.lineTo(tx, y - 9); ctx.lineTo(tx + 6, y + 1); ctx.fill();
    } else if (b.who === 'leader') {
      // The eagle flies near the top of the sky, so its bubble sits beside it instead of above.
      const right = px + 58 + w < viewW - 6;
      x = right ? px + 58 : px - 58 - w; y = clamp(p.y - h / 2 - 6, 4, H - h);
      rr(x, y, w, h, 10); ctx.fill(); ctx.stroke();
      const ex = right ? x + 1 : x + w - 1, dir = right ? -1 : 1;
      ctx.beginPath(); ctx.moveTo(ex, y + h / 2 - 6); ctx.lineTo(ex + dir * 10, y + h / 2 + 2); ctx.lineTo(ex, y + h / 2 + 6); ctx.fill();
    } else {
      x = clamp(px - w / 2, 6, viewW - w - 6);
      y = Math.max(4, p.y - (b.who === 'team' ? 44 : 58) - h);
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
  } else {
    // v7.5: the focus spotlight follows everyone it's about (see focusTarget), easing so it never jumps
    const F = focusEase(v);
    const g = fctx.createRadialGradient(0, 0, F.r0, 0, 0, F.ry);
    if (v === 'manager') { g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.75, 'rgba(0,0,0,0.95)'); g.addColorStop(1, 'rgba(0,0,0,0)'); }
    else { g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.6, 'rgba(0,0,0,0.9)'); g.addColorStop(1, 'rgba(0,0,0,0)'); }
    fctx.save(); fctx.translate(F.cx - camX, F.cy); fctx.scale(F.rx / F.ry, 1);
    fctx.fillStyle = g; fctx.beginPath(); fctx.arc(0, 0, F.ry, 0, 7); fctx.fill(); fctx.restore();
  }
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(fog, 0, 0); ctx.restore();
}

// v7.5: the Manager and Team spotlights. Each starts from its v7 shape (Team: a circle of radius 190 around the koalas;
// Manager: a wide ellipse just ahead of the owl) and grows / moves just enough to keep every character it's about well
// inside the clear part: all four koalas (gathering materials in the bush, the huddle, the build, the climb down and the
// celebration) and, for the Manager, the owl, any visiting owl and the koalas it's guiding. Render-only (world units):
// nothing here touches the simulation.
const FOCUS = {
  team: { r0: 40, rx: 190, ry: 190, clear: 0.62, pad: 26 },   // clear part ~ where the gradient is still 90% open
  manager: { r0: 60, rx: 529, ry: 230, clear: 0.76, pad: 30 },
};
let focusS = null;
function focusPoints(v) {
  const pts = [];
  for (const P of S.kpos) if (P) { const h = 58 * P.s; pts.push([P.x - 16 * P.s, P.y + 6], [P.x + 16 * P.s, P.y + 6], [P.x, P.y - h]); }
  if (v === 'manager') {
    const M = S.mgr, mx = M.x + M.ox, my = M.y + M.oy;
    pts.push([mx - 34, my - 34], [mx + 34, my + 30]);
    if (M.meeting && M.meeting.phase === 'talk') { const q = mgrVisitorPos(); pts.push([q.x - 34, q.y - 34], [q.x + 34, q.y + 30]); }
    if (S.visit && S.visit.phase === 'talk') { const q = visitPos(); pts.push([q.x - 34, q.y - 34], [q.x + 34, q.y + 30]); } // v7.6
  }
  return pts;
}
function focusTarget(v) {
  const C = FOCUS[v], pts = focusPoints(v);
  let cx, cy;
  if (v === 'manager') { // the v7 ellipse sits ahead of the owl; shift it only as far as needed to take in the koalas too
    const M = S.mgr; cx = M.x + M.ox + 120; cy = 400;
    if (pts.length) { const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
      const x0 = Math.min(...xs, cx - C.rx * 0.5), x1 = Math.max(...xs, cx + C.rx * 0.5), y0 = Math.min(...ys, cy - C.ry * 0.4), y1 = Math.max(...ys, cy + C.ry * 0.4);
      cx = (x0 + x1) / 2; cy = (y0 + y1) / 2; }
  } else {
    if (!pts.length) { const p = agentPos('team'); return { cx: p.x, cy: p.y + 10, rx: C.rx, ry: C.ry, r0: C.r0 }; }
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    cx = (Math.min(...xs) + Math.max(...xs)) / 2; cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  }
  let rx = C.rx, ry = C.ry;
  for (const [x, y] of pts) { rx = Math.max(rx, (Math.abs(x - cx) + C.pad) / C.clear); ry = Math.max(ry, (Math.abs(y - cy) + C.pad) / C.clear); }
  let k = 1; // per-axis growth alone can leave a corner outside: scale both until every point is in the clear part
  for (const [x, y] of pts) { const dx = Math.abs(x - cx) + C.pad, dy = Math.abs(y - cy) + C.pad; k = Math.max(k, Math.hypot(dx / rx, dy / ry) / C.clear); }
  rx *= k; ry *= k;
  rx = Math.min(rx, viewW * 0.9); ry = Math.min(ry, H * 0.85); // never more than (roughly) the whole screen
  return { cx, cy, rx, ry, r0: C.r0 * ry / C.ry };
}
// Ease towards the target: grow and move quickly (nobody walks out of the light), shrink slowly (no breathing).
let focusClock = 0;
function focusEase(v) {
  const T = focusTarget(v), now = performance.now(), dt = clamp((now - focusClock) / 1000, 0, 0.1); focusClock = now;
  const F = focusS; // paused, jumped or first frame: just snap
  if (!F || F.v !== v || F.S !== S || Math.abs(F.cx - T.cx) > viewW * 0.8 || !settings.playing || dt >= 0.1) { focusS = Object.assign({ v, S }, T); return focusS; }
  const mv = 1 - Math.exp(-dt * 6), grow = 1 - Math.exp(-dt * 7), shrink = 1 - Math.exp(-dt * 1.2);
  F.cx += (T.cx - F.cx) * mv; F.cy += (T.cy - F.cy) * mv;
  F.rx += (T.rx - F.rx) * (T.rx > F.rx ? grow : shrink); F.ry += (T.ry - F.ry) * (T.ry > F.ry ? grow : shrink);
  F.r0 = FOCUS[v].r0 * F.ry / FOCUS[v].ry;
  return F;
}

function drawViewBanner() {
  const v = settings.view; if (v === 'all') return;
  const text = {
    leader: '🦅 LEADER VIEW: sees the team and holds the vision, but can\'t see the ground',
    manager: '🦉 MANAGER VIEW: sees the obstacles ahead, but not the far-off goal',
    team: '🐨 TEAM VIEW: the koalas see only what\'s right in front of them',
  }[v];
  const hint = { leader: '💬 Showing only the Leader\'s dialogue', manager: '💬 Showing only the Manager\'s dialogue', team: '💬 Showing only the koalas\' dialogue' }[v];
  ctx.font = 'bold 14px system-ui, sans-serif';
  const w1 = ctx.measureText(text).width;
  ctx.font = '600 12px system-ui, sans-serif';
  const w = Math.max(w1, ctx.measureText(hint).width) + 24;
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; rr(12, H - 58, w, 46, 14); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 14px system-ui, sans-serif'; ctx.fillText(text, 24, H - 39);
  ctx.fillStyle = '#ffe082'; ctx.font = '600 12px system-ui, sans-serif'; ctx.fillText(hint, 24, H - 20);
}

function frame(ts) {
  raf = requestAnimationFrame(frame);
  const dt = Math.min(0.05, (ts - (lastT || ts)) / 1000);
  lastT = ts;
  if (settings.playing) {
    const sdt = dt * settings.speed;
    // sub-step for stability at high speeds
    const n = Math.ceil(sdt / 0.02) || 1;
    for (let i = 0; i < n && settings.playing; i++) { update(sdt / n); updateCamera(sdt / n); }
    if (settings.playing) snd.tick(ambLevels());
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
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.code === 'Space') { e.preventDefault(); settings.playing = !settings.playing; snd.setPaused(!settings.playing); call('OnPlayState', settings.playing); }
  else if (e.key === 'r' || e.key === 'R') { reset(); call('OnRestarted'); }
  else if (e.key === 'c' || e.key === 'C') call('OnShortcut', 'chapters');
  else if (e.key === 'n' || e.key === 'N') call('OnShortcut', 'next');
  else if (e.key === 'm' || e.key === 'M') call('OnShortcut', 'mute');
  else if (e.key === 'Escape') call('OnShortcut', 'escape');
  else if (['1', '2', '3', '4'].includes(e.key)) { settings.view = ['all', 'leader', 'manager', 'team'][+e.key - 1]; call('OnViewChanged', settings.view); emitCaption(true); }
}


// ---------- drawing (new in v2) ----------
// ---------- v7 drawing: the vision blueprint, the courses, ramp, ladder and stone pile ----------
const hsh = (a, b, c) => { const v = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return v - Math.floor(v); };
function pyrPath(x, by) { ctx.beginPath(); ctx.moveTo(x - PYR_HALF, by); ctx.lineTo(x, PYR_APEX); ctx.lineTo(x + PYR_HALF, by); ctx.closePath(); }
function drawCap(x, base, a = 1) {
  const h = CAP_BASE - PYR_APEX, w = cHalf(5);
  ctx.save(); ctx.globalAlpha *= a;
  ctx.fillStyle = '#ffd54f'; ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x - w, base); ctx.lineTo(x, base - h); ctx.lineTo(x + w, base); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffecb3'; ctx.beginPath(); ctx.moveTo(x, base - h); ctx.lineTo(x - w * 0.55, base - h * 0.45); ctx.lineTo(x - w * 0.15, base - h * 0.45); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function drawCourse(k, c, wide) {
  const yb = cTop(k - 1), yt = cTop(k), h = wide ? cHalf(k - 1) : cHalf(k), x0 = GOAL_X - camX;
  const n = Math.max(1, Math.round(2 * h / 36)), w = 2 * h / n, rh = (yb - yt) / 2, messy = !settings.comms;
  const pieces = [];
  for (let r = 0; r < 2; r++) {
    const edges = [-h]; if (r % 2) edges.push(-h + w / 2);
    for (let j = 1; j < n; j++) edges.push(-h + j * w + (r % 2 ? w / 2 : 0));
    edges.push(h);
    const row = [];
    for (let j = 0; j + 1 < edges.length; j++) row.push([edges[j], edges[j + 1], r]);
    if (k % 2) row.reverse();
    pieces.push(...row);
  }
  const total = pieces.length, f = c * total, placed = Math.floor(f + 1e-6);
  for (let idx = 0; idx < total && idx <= placed; idx++) {
    let [a, b, r] = pieces[idx], drop = 0, al = 1;
    if (idx === placed) { const q = f - placed; if (q <= 0.02) break; drop = (1 - q) * 14; al = q; }
    const y = yb - (r + 1) * rh - drop;
    let ja = 0, jb = 0, jy = 0;
    if (messy) { ja = hsh(k, idx, 1) * 4; jb = hsh(k, idx, 2) * 4; jy = (hsh(k, idx, 3) - 0.5) * 3; }
    const shade = 0.88 + hsh(k, idx, 4) * 0.2 * (messy ? 1.8 : 1);
    ctx.globalAlpha = al;
    ctx.fillStyle = `rgb(${Math.round(217 * shade)},${Math.round(180 * shade)},${Math.round(111 * shade)})`;
    ctx.fillRect(x0 + a + ja, y + jy, b - a - ja - jb, rh);
    ctx.strokeStyle = '#8f6a35'; ctx.lineWidth = 1.1; ctx.strokeRect(x0 + a + ja, y + jy, b - a - ja - jb, rh);
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(x0 + a + ja, y + jy, b - a - ja - jb, 2.5);
    if (wide && S.build.wrongShow && (a < -cHalf(k) || b > cHalf(k))) { ctx.fillStyle = 'rgba(229,57,53,0.42)'; ctx.fillRect(x0 + a + ja, y + jy, b - a - ja - jb, rh); }
  }
  ctx.globalAlpha = 1;
  if (wide && S.build.wrongShow) { // "Wait, was it meant to be pointy?": the overhang beyond the vision
    ctx.save(); ctx.strokeStyle = '#e53935'; ctx.lineWidth = 2.5; ctx.setLineDash([6, 4]); ctx.lineDashOffset = -S.t * 20;
    ctx.strokeRect(x0 - h, yt, 2 * h, yb - yt); ctx.restore();
    ctx.font = 'bold 22px sans-serif'; ctx.fillStyle = '#e53935'; ctx.fillText('✗', x0 - h - 26, yt + 26); ctx.fillText('✗', x0 + h + 8, yt + 26);
  }
}
function surfaceY(x) { // the highest finished course under x (for the ramp's trestles)
  const B = S.build; let y = GROUND;
  for (let k = 0; k < COURSES; k++) if (B.c[k] >= 1 && Math.abs(x - GOAL_X) < cHalf(k)) y = cTop(k);
  return y;
}
function drawRamp(a) {
  const B = S.build; if (B.rampL < 0 || B.rampG <= 0) return;
  const rt = rampTopNow(), ex = lerp(RAMP_FOOT, rt[0], B.rampG), ey = lerp(GROUND + 2, rt[1], B.rampG), x0 = RAMP_FOOT - camX;
  ctx.save(); ctx.globalAlpha = a;
  ctx.strokeStyle = '#6d4c2f'; ctx.lineWidth = 3;
  for (let s = 0.18; s < 1; s += 0.16) { // trestles down to the ground or the course below
    const px = lerp(RAMP_FOOT, ex, s), py = lerp(GROUND + 2, ey, s);
    ctx.beginPath(); ctx.moveTo(px - camX, py + 3); ctx.lineTo(px - camX, surfaceY(px)); ctx.stroke();
  }
  ctx.strokeStyle = '#8a5f33'; ctx.lineWidth = 8; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, GROUND + 2); ctx.lineTo(ex - camX, ey); ctx.stroke();
  ctx.strokeStyle = '#c99a5b'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x0, GROUND); ctx.lineTo(ex - camX, ey - 2); ctx.stroke();
  ctx.lineCap = 'butt'; ctx.strokeStyle = 'rgba(90,58,26,0.7)'; ctx.lineWidth = 1.2;
  const L = Math.hypot(ex - RAMP_FOOT, ey - GROUND);
  for (let d = 10; d < L; d += 14) { const q = d / L, px = lerp(x0, ex - camX, q), py = lerp(GROUND, ey - 2, q); ctx.beginPath(); ctx.moveTo(px, py - 3); ctx.lineTo(px + 1, py + 3); ctx.stroke(); }
  ctx.restore();
}
function drawLadder(a) {
  const B = S.build; if (B.ladder <= 0) return;
  const [bx, by] = LADDER.b, [tx, ty] = LADDER.t, ex = lerp(bx, tx, B.ladder), ey = lerp(by, ty, B.ladder);
  const len = Math.hypot(ex - bx, ey - by), nx = -(ey - by) / (len || 1) * 6, ny = (ex - bx) / (len || 1) * 6;
  ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = '#c08a4a'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(bx - camX + nx, by + ny); ctx.lineTo(ex - camX + nx, ey + ny); ctx.moveTo(bx - camX - nx, by - ny); ctx.lineTo(ex - camX - nx, ey - ny); ctx.stroke();
  ctx.lineWidth = 2;
  for (let s = 0.12; s < 1; s += 0.15) { const px = lerp(bx, ex, s) - camX, py = lerp(by, ey, s); ctx.beginPath(); ctx.moveTo(px + nx, py + ny); ctx.lineTo(px - nx, py - ny); ctx.stroke(); }
  ctx.restore();
}
function drawPile(a) {
  const B = S.build; if (!B.stock && !B.rejects) return;
  ctx.save(); ctx.globalAlpha = a;
  for (let j = 0; j < B.stock; j++) {
    const shaped = j < B.shaped * B.stock, px = STOCK_X - 22 + (j % 4) * 14 + Math.floor(j / 4) * 6, py = GROUND + 4 - Math.floor(j / 4) * 9;
    drawItem(shaped ? 'block' : 'stones', px - camX, py, 1.15);
  }
  const REJ = [[4985, 0.5, 1.3], [5000, -0.3, 0.8], [5150, 0.9, 1.5], [5205, -0.6, 0.7], [4965, 0.2, 1.1]];
  for (let j = 0; j < B.rejects; j++) { // wrong-sized blocks, thrown away
    const [rx, rot, sz] = REJ[j]; ctx.save(); ctx.translate(rx - camX, GROUND + 6); ctx.rotate(rot); ctx.scale(sz, 0.75 + sz * 0.3);
    ctx.fillStyle = '#c9a466'; ctx.strokeStyle = '#7a5a2a'; ctx.lineWidth = 1; ctx.fillRect(-8, -11, 16, 11); ctx.strokeRect(-8, -11, 16, 11); ctx.restore();
  }
  ctx.restore();
}
// Behind the koalas: the final casing (once the vision turns solid), the courses, the ramp, the ladder, the stone pile.
function drawBuild() {
  const B = S.build, x = GOAL_X - camX;
  if (x < -PYR_HALF - 700 || x > viewW + PYR_HALF + 40) return;
  const tidy = B.clearT != null ? clamp(1 - (S.t - B.clearT) / 1.6, 0, 1) : 1; // v7.1: the gear stays until everyone is safely down, then it's cleared away
  for (let k = 0; k < COURSES; k++) if (B.c[k] > 0) drawCourse(k, B.c[k], false);
  if (B.wrongP > 0) drawCourse(2, B.wrongP, true);
  if (B.solid > 0) { // the finished pyramid: smooth sandstone casing over the courses (the old v2 pyramid look)
    const by = PYR_BY;
    ctx.save(); ctx.globalAlpha = B.solid;
    ctx.fillStyle = '#d9b066'; pyrPath(x, by); ctx.fill();
    ctx.fillStyle = '#b98c45'; ctx.beginPath(); ctx.moveTo(x, PYR_APEX); ctx.lineTo(x + PYR_HALF, by); ctx.lineTo(x + 30, by); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(120,85,40,0.45)'; ctx.lineWidth = 1.2;
    for (let k = 0; k < COURSES; k++) { const y = cTop(k), hh = halfAt(y); ctx.beginPath(); ctx.moveTo(x - hh, y); ctx.lineTo(x + hh, y); ctx.stroke(); }
    ctx.fillStyle = '#4a3418'; ctx.beginPath(); ctx.moveTo(x - 16, by); ctx.lineTo(x - 16, by - 30); ctx.arc(x, by - 30, 16, Math.PI, 0); ctx.lineTo(x + 16, by); ctx.fill();
    ctx.restore();
  }
  if (B.capSet) drawCap(x, CAP_BASE);
  if (tidy > 0) { drawRamp(tidy); drawLadder(tidy); drawPile(tidy); }
}
// In front of the koalas: blocks passed along the line, the rope and rollers, and the capstone on its way up.
function drawBuildFront() {
  const B = S.build; if (!B.on) return;
  const tm = S.team, st = tm.mode === 'seq' && tm.seq ? tm.seq[tm.step] : null, sp = st ? Math.min(1, tm.stepT / st.dur) : 0;
  if (st && st.flow && B.kpOn) {
    const F = st.flow(sp), bl = flowBlocks(st, sp), rt = rampTopNow();
    if (F.rope) { // rope from Wattle's paws down the ramp to the block being hauled
      const w = B.kp[3], hx = w.x - 10, hy = w.y - 30;
      const onRamp = bl.filter(q => q.pos.x > RAMP_FOOT && q.pos.x < rt[0] - 2 && q.pos.h < 12).sort((a, b) => b.pos.x - a.pos.x)[0];
      const ex = onRamp ? onRamp.pos.x + 8 : RAMP_FOOT + 20, ey = onRamp ? onRamp.pos.y - 10 : GROUND - 6;
      ctx.strokeStyle = '#c9a26b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(hx - camX, hy); ctx.quadraticCurveTo((hx + ex) / 2 - camX, (hy + ey) / 2 + 8, ex - camX, ey); ctx.stroke();
    }
    for (const q of bl) {
      const P = q.pos; ctx.save(); ctx.globalAlpha = q.a;
      if (P.h < 12 && B.rollers) { ctx.fillStyle = '#7a4f2a'; for (const dx of [-6, 6]) { ctx.beginPath(); ctx.arc(P.x + dx - camX, P.y - 3, 3, 0, 7); ctx.fill(); } }
      const s = settings.comms ? 1.25 : 1.0 + hsh(q.j, 7, 1) * 0.7;
      drawItem('block', P.x - camX, P.y - P.h - (P.h < 12 && B.rollers ? 4 : 0), s);
      ctx.restore();
    }
  }
  if (B.cap && !B.capSet) {
    const K = B.kp, kip = K[0];
    let cx, cy;
    if (st && st.b === 'capflow') { const P = along(flowPts(5), sp); cx = P.x; cy = P.y - (P.h < 12 ? 6 : 34); }
    else if (st && st.b === 'caplift') {
      const q = B.cap.lift, sx = kip.x + 10, sy = kip.y - 58;
      cx = q < 0.6 ? lerp(sx, GOAL_X, ease(q / 0.6)) : GOAL_X;
      cy = q < 0.6 ? lerp(sy, CAP_BASE - 30, ease(q / 0.6)) : lerp(CAP_BASE - 30, CAP_BASE, ease((q - 0.6) / 0.4));
    } else { cx = kip.x + 10; cy = kip.y - 58; }
    drawCap(cx - camX, cy);
  }
}
// The Leader's vision: a golden, gently shimmering blueprint of the pyramid, brightest where it pokes above the canopy.
// Where the vision is drawn on screen. While the build site is still far off, the Leader's vision hangs on the
// eastern horizon (smaller, as if far away) so it's visible above the canopy for the whole journey; as the team
// gets closer it grows and slides into its real place.
function visionScreen() {
  const x = GOAL_X - camX, pin = viewW - Math.min(110, viewW * 0.16);
  if (x <= pin) return { x, s: 1, far: false };
  return { x: pin, s: clamp(1 - (x - pin) / 1500, 0.34, 1), far: x - pin > 60 };
}
function drawVision() {
  const B = S.build, V = visionScreen(), x = V.x, vs = V.s;
  if (x < -PYR_HALF - 40 || x > viewW + PYR_HALF + 40) return;
  const sol = B.solid, sh = 0.5 + 0.5 * Math.sin(S.t * 2.2), by = PYR_BY;
  const far = () => { if (vs < 1) { ctx.translate(x, PYR_APEX); ctx.scale(vs, vs); ctx.translate(-x, -PYR_APEX); } };
  if (sol < 1) {
    const a = 1 - sol;
    for (const [y0, y1, k] of [[0, CANOPY_TOP + 16, 1], [CANOPY_TOP + 16, H, V.far ? 0.14 : 0.4]]) {
      ctx.save(); ctx.beginPath(); ctx.rect(0, y0, viewW, y1 - y0); ctx.clip(); far();
      ctx.globalAlpha = a * k;
      pyrPath(x, by); ctx.fillStyle = `rgba(255,214,90,${0.10 + 0.07 * sh})`; ctx.fill();
      ctx.strokeStyle = `rgba(255,205,70,${0.22 + 0.12 * sh})`; ctx.lineWidth = 9; pyrPath(x, by); ctx.stroke();
      ctx.setLineDash([10, 7]); ctx.lineDashOffset = -S.t * 16; ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 2.6; pyrPath(x, by); ctx.stroke();
      ctx.setLineDash([4, 6]); ctx.lineWidth = 1.1; ctx.strokeStyle = 'rgba(255,226,140,0.6)';
      for (let c = 0; c < COURSES; c++) { const y = cTop(c), hh = halfAt(y); ctx.beginPath(); ctx.moveTo(x - hh, y); ctx.lineTo(x + hh, y); ctx.stroke(); }
      ctx.restore();
    }
    ctx.save(); far(); ctx.globalAlpha = a; ctx.fillStyle = '#fff7c2'; // shimmer: little sparkles drifting up the edges
    for (let j = 0; j < 8; j++) {
      const q = (S.t * 0.06 + j / 8) % 1, side = j % 2 ? 1 : -1, px = x + side * PYR_HALF * (1 - q), py = lerp(by, PYR_APEX, q);
      if (py > CANOPY_TOP + 16 && j % 4) continue;
      const r = 1.6 + Math.sin(S.t * 6 + j) * 1.1; ctx.beginPath(); ctx.arc(px, py, Math.max(0.4, r), 0, 7); ctx.fill();
    }
    ctx.restore();
    ctx.save(); ctx.globalAlpha = a * (0.75 + 0.25 * sh); tag(x - (V.far ? 34 : 0), PYR_APEX - 14, V.far ? '✨ THE VISION · far to the east ➜' : '✨ THE VISION', '#ffd34d'); ctx.restore();
  }
  if (sol > 0) { // the outline turns solid: a flash of gold, then a steady golden edge
    ctx.save();
    ctx.globalAlpha = Math.sin(Math.PI * Math.min(1, sol)) * 0.6; pyrPath(x, by); ctx.fillStyle = '#fff3b0'; ctx.fill();
    ctx.globalAlpha = sol; ctx.strokeStyle = '#ffcf33'; ctx.lineWidth = 3; pyrPath(x, by); ctx.stroke();
    ctx.restore();
  }
}
// HUD: the skills from the journey, called back one by one as the koalas use them on the build.
function drawSkills() {
  const B = S.build; if (!B.on || !B.skills.length) return;
  const hidden = settings.view === 'team' || settings.view === 'manager';
  let y = hidden ? 16 : 58; const x = 12;
  ctx.save(); ctx.font = 'bold 12px system-ui, sans-serif';
  const head = settings.comms ? '🧰 Skills from the journey' : '🧰 Skills (learned the hard way)';
  let w = ctx.measureText(head).width + 18;
  ctx.fillStyle = 'rgba(20,40,24,0.78)'; rr(x, y, w, 22, 11); ctx.fill(); ctx.fillStyle = '#ffe082'; ctx.fillText(head, x + 9, y + 15.5);
  y += 27; ctx.font = '600 12px system-ui, sans-serif';
  for (const s of B.skills) {
    const age = S.t - s.t, pop = ease(clamp(age / 0.35, 0, 1)), glow = clamp(1 - (age - 1.6) / 1.2, 0, 1);
    const text = `${s.icon} ${s.name} · from ${s.from}`;
    w = ctx.measureText(text).width + 18;
    ctx.save(); ctx.globalAlpha = pop; ctx.translate(x - (1 - pop) * 30, y);
    if (glow > 0) { ctx.fillStyle = `rgba(255,214,90,${0.45 * glow})`; rr(-3, -3, w + 6, 28, 14); ctx.fill(); }
    ctx.fillStyle = s.hard ? 'rgba(80,72,64,0.88)' : 'rgba(255,248,220,0.95)'; ctx.strokeStyle = s.hard ? '#a1887f' : '#c79100'; ctx.lineWidth = 1.5;
    rr(0, 0, w, 22, 11); ctx.fill(); ctx.stroke();
    ctx.fillStyle = s.hard ? '#f5f5f5' : '#3a2c00'; ctx.fillText(text, 9, 15.5);
    ctx.restore();
    y += 26;
  }
  ctx.restore();
}

function drawPathBushes() {
  for (const b of S.pathBushes) {
    if (b.shrub) continue;
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
  const lp = S.gifts.ladder ? 1 : w.prog; // v7.6: Project Manager B's ladder stands ready against the wall
  if (lp > 0) {
    const bx = x - 16, byy = LOW_GROUND - 2, tx = x + w.w + 4, ty = GROUND - 8;
    const L = Math.hypot(tx - bx, byy - ty), th = Math.atan2(byy - ty, tx - bx) * lp;
    const ex = bx + L * Math.cos(th), ey = byy - L * Math.sin(th);
    const nx = -Math.sin(th) * 5, ny = -Math.cos(th) * 5;
    ctx.strokeStyle = '#c08a4a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(bx + nx, byy + ny); ctx.lineTo(ex + nx, ey + ny); ctx.moveTo(bx - nx, byy - ny); ctx.lineTo(ex - nx, ey - ny); ctx.stroke();
    ctx.lineWidth = 2;
    for (let s = 0.1; s < 1; s += 0.12) { const px = lerp(bx, ex, s), py = lerp(byy, ey, s); ctx.beginPath(); ctx.moveTo(px + nx, py + ny); ctx.lineTo(px - nx, py - ny); ctx.stroke(); }
    if (S.gifts.ladder && !w.done) tag(x - 30, LOW_GROUND - 112, '🪜 FROM PROJECT MANAGER B', '#ffe3c4');
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
  ctx.fillStyle = M.alert > 0 ? 'rgba(255,140,90,0.16)' : (distracted || M.task ? 'rgba(255,255,200,0.03)' : 'rgba(255,255,200,0.10)');
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
  tag(x, y - 42, S.build.on && settings.comms && !S.finished ? 'MANAGER · SUPPORTING' : 'MANAGER', '#c792ff');
  if (S.build.on && S.build.mcarry) drawItem('block', x + 2, y + 30, 1.1); // bringing stone to where it's needed
  if (S.build.check > 0) { // checking the plan against the Leader's vision
    ctx.save(); ctx.globalAlpha = Math.min(1, S.build.check); ctx.strokeStyle = '#d6a8ff'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]); ctx.lineDashOffset = -S.t * 20;
    ctx.beginPath(); ctx.moveTo(x + 10, y - 10); ctx.lineTo(GOAL_X - camX, PYR_APEX + 8); ctx.stroke(); ctx.restore();
    ctx.font = '16px sans-serif'; ctx.fillText('📐', x + 18, y - 14);
  }
}
function drawOwlShape(x, y, body, wing, belly, flapSpeed) {
  const flap = Math.sin(S.t * flapSpeed) * 8;
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = wing;
  ctx.beginPath(); ctx.moveTo(-10, 0); ctx.quadraticCurveTo(-28, -8 - flap, -36, 4 - flap); ctx.quadraticCurveTo(-24, 10, -10, 10); ctx.fill();
  ctx.beginPath(); ctx.moveTo(10, 0); ctx.quadraticCurveTo(28, -8 - flap, 36, 4 - flap); ctx.quadraticCurveTo(24, 10, 10, 10); ctx.fill();
  ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(0, 2, 15, 18, 0, 0, 7); ctx.fill();
  ctx.fillStyle = belly; ctx.beginPath(); ctx.ellipse(0, 8, 9, 10, 0, 0, 7); ctx.fill();
  ctx.fillStyle = wing; ctx.beginPath(); ctx.moveTo(-13, -12); ctx.lineTo(-10, -22); ctx.lineTo(-4, -14); ctx.fill();
  ctx.beginPath(); ctx.moveTo(13, -12); ctx.lineTo(10, -22); ctx.lineTo(4, -14); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-6, -6, 6, 0, 7); ctx.arc(6, -6, 6, 0, 7); ctx.fill();
  ctx.fillStyle = '#ffb000'; ctx.beginPath(); ctx.arc(-7.5, -6, 3.4, 0, 7); ctx.arc(4.5, -6, 3.4, 0, 7); ctx.fill();
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(-8, -6, 1.6, 0, 7); ctx.arc(4, -6, 1.6, 0, 7); ctx.fill();
  ctx.fillStyle = '#e8a33a'; ctx.beginPath(); ctx.moveTo(-2, 0); ctx.lineTo(0, 5); ctx.lineTo(2, 0); ctx.fill();
  ctx.restore();
}
// v4: the visiting owl at a manager meeting, with a dashed "sync" link to the Manager while they talk.
function drawMgrMeeting() {
  const M = S.mgr.meeting; if (!M) return;
  const v = mgrVisitorPos(), x = v.x - camX, y = v.y, d = M.def;
  if (x < -80 || x > viewW + 80) return;
  if (M.phase === 'talk') {
    const mx = S.mgr.x + S.mgr.ox - camX, my = S.mgr.y + S.mgr.oy;
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]); ctx.lineDashOffset = -S.t * 18;
    ctx.beginPath(); ctx.moveTo(mx + 24, my + 6); ctx.lineTo(x - 24, y); ctx.stroke(); ctx.restore();
    ctx.font = '16px sans-serif'; ctx.fillText('🤝', (mx + x) / 2 - 9, (my + y) / 2 + 6);
  }
  drawOwlShape(x, y, d.body, d.wing, d.belly, M.phase === 'talk' ? 8 : 14);
  tag(x, y + 34, d.label, d.belly);
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

// v4: gathering materials. Each koala heads off the path into the bush, picks something up and carries it back.
const GATHER_SPOTS = [[-46, -30], [-150, 24], [-214, -28], [-92, 22]]; // [dx from the front koala, depth lane]
function gatherPose(i, p, g) {
  const home = -i * MEMBER_GAP, [sx, sl] = GATHER_SPOTS[i];
  const tx = sx * (g.lost ? 1.35 : 1), tl = sl;
  const q = clamp((p - i * 0.05) / 0.82, 0, 1);
  let x, lane, flip, carry = false, crouch = 0, moving = true;
  if (q < 0.3) { const e = ease(q / 0.3); x = lerp(home, tx, e); lane = tl * e; flip = tx < home; moving = q > 0; }
  else if (q < 0.4) { x = tx; lane = tl; flip = tx < home; crouch = Math.sin((q - 0.3) / 0.1 * Math.PI) * 7; moving = false; }
  else if (q < 0.94) { const e = (q - 0.4) / 0.54; x = lerp(tx, home, e < 0.5 ? 2 * e * e * 0 + e : e); lane = tl * (1 - e); flip = !(tx < home); carry = true; }
  else { x = home; lane = 0; flip = false; moving = false; }
  if (g.lost) x += Math.sin(S.t * 2.2 + i * 2) * 16 * Math.sin(Math.PI * q); // wandering, not sure where to look
  return { x, lane, flip, carry, crouch, moving, tx, tl, picked: q >= 0.36, delivered: q >= 0.94 };
}
// Around the boulder: two at the left face, two round the right side (facing back), so the rock stays visible.
const ROCK_FORM = [[8, 0, false], [-14, 28, false], [170, 0, true], [196, 26, true]];
function drawItem(kind, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  if (kind === 'stones') {
    ctx.fillStyle = '#8f9397'; ctx.beginPath(); ctx.ellipse(0, -4, 9, 5.5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#b4b7bb'; ctx.beginPath(); ctx.ellipse(-2, -6, 4, 2, 0, 0, 7); ctx.fill();
  } else if (kind === 'logs') {
    ctx.fillStyle = '#7a4f2a'; rr(-15, -9, 30, 9, 4); ctx.fill();
    ctx.fillStyle = '#d9b27c'; ctx.beginPath(); ctx.ellipse(15, -4.5, 3, 4.5, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-10, -6); ctx.lineTo(6, -6); ctx.stroke();
  } else if (kind === 'planks') {
    ctx.fillStyle = '#c99a5b'; ctx.strokeStyle = '#6b4a22'; ctx.lineWidth = 1; ctx.fillRect(-14, -6, 28, 5); ctx.strokeRect(-14, -6, 28, 5);
  } else if (kind === 'vines') {
    ctx.strokeStyle = '#3f8f3a'; ctx.lineWidth = 2.6; ctx.beginPath();
    for (let k = 0; k <= 16; k++) { const a = k / 16 * Math.PI * 4; const px = Math.cos(a) * (4 + k * 0.45), py = -5 + Math.sin(a) * (2 + k * 0.2); k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.stroke(); ctx.fillStyle = '#66bb6a'; ctx.beginPath(); ctx.ellipse(9, -9, 3, 1.6, 0.5, 0, 7); ctx.fill();
  } else if (kind === 'poles') {
    ctx.fillStyle = '#8b6a3e'; ctx.fillRect(-20, -4, 40, 3.2);
  } else if (kind === 'block') { // a shaped sandstone block
    ctx.fillStyle = '#d9b46f'; ctx.strokeStyle = '#8f6a35'; ctx.lineWidth = 1; ctx.fillRect(-8, -11, 16, 11); ctx.strokeRect(-8, -11, 16, 11);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(-8, -11, 16, 2.5);
  }
  ctx.restore();
}
function drawTeam() {
  const tm = S.team, logO = ob('log');
  const st = tm.mode === 'seq' && tm.seq ? tm.seq[tm.step] : null;
  const sp = st ? Math.min(1, tm.stepT / st.dur) : 0;
  const g = st && st.gather ? st : null;
  // materials: lying in the bush before pick-up, then piled up by the obstacle
  if (tm.seqOb || (g && S.build.on)) {
    const gy0 = memberY(tm.x);
    let pile = 0;
    if (g) {
      for (let i = 0; i < 4; i++) {
        const P = gatherPose(i, sp, g);
        if (!P.picked) drawItem(g.gather, tm.x + P.tx - camX, memberY(tm.x + P.tx) + P.tl, 1.25 * (1 + P.tl / 120));
        if (P.delivered) pile++;
      }
    } else if (tm.seq && tm.seqOb) {
      const done = tm.seq.slice(0, tm.step).find(x => x.gather);
      if (done) pile = Math.ceil(4 * (1 - (tm.seqOb.prog || 0)) - 0.001);
    }
    const kind = g ? g.gather : (tm.seq && (tm.seq.slice(0, tm.step).find(x => x.gather) || {}).gather);
    if (tm.seqOb) for (let k = 0; k < pile; k++) drawItem(kind, tm.x + 16 + (k % 2) * 6 - camX, gy0 + 6 - Math.floor(k / 1) * (kind === 'stones' ? 5 : 5), 1.3);
  }
  // training board
  if (st && st.train) {
    const bx = tm.x - 178 - camX, by = memberY(tm.x - 178);
    ctx.strokeStyle = '#6d4c2f'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(bx - 22, by); ctx.lineTo(bx - 10, by - 60); ctx.moveTo(bx + 22, by); ctx.lineTo(bx + 10, by - 60); ctx.stroke();
    ctx.fillStyle = '#fafafa'; ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = 3; rr(bx - 42, by - 104, 84, 50, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#263238'; ctx.font = 'bold 10px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(st.slow ? 'TRIAL &' : '🔨 HAMMER &', bx, by - 86); ctx.fillText(st.slow ? 'ERROR...' : 'CHISEL 101', bx, by - 72);
    ctx.textAlign = 'left';
  }
  // the break: a billy on a tiny campfire in the middle of the group
  if (st && st.rest) {
    const bx = tm.x - 54 - camX, by = memberY(tm.x - 54) + 24;
    ctx.fillStyle = '#ff7043'; ctx.beginPath(); ctx.moveTo(bx - 9, by); ctx.quadraticCurveTo(bx, by - 18 - Math.sin(S.t * 12) * 3, bx + 9, by); ctx.fill();
    ctx.fillStyle = '#ffca28'; ctx.beginPath(); ctx.moveTo(bx - 5, by); ctx.quadraticCurveTo(bx, by - 10 - Math.sin(S.t * 15) * 2, bx + 5, by); ctx.fill();
    ctx.strokeStyle = '#5d4037'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(bx - 12, by + 2); ctx.lineTo(bx + 12, by - 2); ctx.moveTo(bx - 12, by - 2); ctx.lineTo(bx + 12, by + 2); ctx.stroke();
    ctx.fillStyle = '#90a4ae'; ctx.fillRect(bx - 8, by - 30, 16, 14); ctx.fillStyle = '#b0bec5'; ctx.fillRect(bx - 8, by - 30, 16, 3);
    ctx.strokeStyle = '#607d8b'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(bx, by - 30, 8, Math.PI, 0); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2;
    for (let k = 0; k < 2; k++) { const ph = (S.t * 0.8 + k * 0.5) % 1; ctx.globalAlpha = 1 - ph; ctx.beginPath(); ctx.moveTo(bx - 3 + k * 6, by - 34 - ph * 26); ctx.quadraticCurveTo(bx + 4 + k * 6, by - 40 - ph * 26, bx - 2 + k * 6, by - 46 - ph * 26); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  const BP = buildPoses(st, sp); // v7: on the build site the koalas have their own stations
  const HP = huddlePoses(); if (HP) drawHuddleSketch();
  for (let i = 3; i >= 0; i--) {
    let mx = tm.x - i * MEMBER_GAP + (i === 0 ? tm.m0 : 0);
    if (st && st.struggle && i === 3) mx -= 22 + Math.sin(S.t * 3) * 3; // Wattle falls behind
    let lane = laneOffset(mx), flip = false, carry = null, crouch = 0;
    let moving = (tm.mode === 'walk' || (st && st.move != null)) && tm.moved;
    if (tm.mode === 'walk' && tm.stillT > 0.4 && !S.huddle.on) flip = Math.sin(S.t * 0.7 + i * 2.1) > 0.75; // waiting: stand and look around
    let mood = tm.mood;
    if (st && st.struggle && i === 3) mood = 'struggle';
    if (st && st.rest) { mood = 'rest'; flip = i < 2; mx += i < 2 ? 4 : -4; lane = 12; moving = false; }
    if (g) {
      const P = gatherPose(i, sp, g);
      mx = tm.x + P.x; lane = P.lane; flip = P.flip; crouch = P.crouch; moving = P.moving;
      if (P.carry) { carry = g.gather; mood = 'carry'; } else mood = g.lost ? 'confused' : 'walk';
    } else if (st && st.form === 'rock') {
      const k = Math.min(ease(Math.min(1, sp / 0.12)), ease(Math.min(1, (1 - sp) / 0.1)));
      mx = lerp(tm.x - i * MEMBER_GAP, tm.x + ROCK_FORM[i][0], k); lane = ROCK_FORM[i][1] * k; flip = ROCK_FORM[i][2] && k > 0.5;
    } else if (st && st.train) { flip = true; mood = 'learn'; }
    let gy = memberY(mx) + lane + (i === 0 ? tm.m0y : 0) + crouch;
    let hhop = 0;
    if (HP) { const P = HP[i]; mx = P.x; lane = P.lane; flip = P.flip; mood = P.mood; moving = P.moving; hhop = P.hop; gy = memberY(mx) + lane; }
    if (BP) { const P = BP[i]; mx = P.x; lane = P.lane; flip = P.flip; carry = P.carry; mood = P.mood; moving = P.moving; gy = P.y + lane; }
    const ph = S.t * 9 + i * 1.7;
    let bob = moving ? Math.abs(Math.sin(ph)) * 2 : 0;
    if (tm.mood === 'happy') bob = Math.abs(Math.sin(S.t * 6 + i)) * 16;
    if (BP && BP[i].hop) bob += BP[i].hop;
    bob += hhop;
    if (tm.cheer > 0) bob += Math.abs(Math.sin(S.t * 10 + i)) * 10 * tm.cheer;
    const shake = tm.mood === 'stuck' ? Math.sin(S.t * 30 + i) * 1.5 : 0;
    if (mx > logO.x - 6 && mx < logO.x + logO.w + 6) mood = 'sneak'; // crawling through the hollow log
    const s = KOALA_SCALE * (1 + lane / 120) * KOALA_SIZE[i];
    if (tm.tired && moving) bob *= 0.4;
    drawKoala(mx - camX + shake, gy - bob, s, TEAM_COLORS[i], moving ? Math.sin(ph) * (tm.tired ? 0.6 : 1) : 0, mood, i, flip, carry, { tired: tm.tired && mood !== 'happy', leaf: tm.leaf === i, lead: tm.lead === i });
    S.kpos[i] = { x: mx, y: gy, s };

    if (st && st.train && sp > (st.slow ? 0.5 : 0.25) + i * 0.12) { // the penny drops: lightbulbs
      ctx.font = '15px sans-serif'; ctx.fillText('💡', mx - camX - 24 * s / KOALA_SCALE - 8, gy - 60 * s / KOALA_SCALE);
    }
  }
  const p = agentPos('team');
  if (tm.mood === 'confused' || (g && g.lost)) { ctx.fillStyle = '#fff'; ctx.font = 'bold 18px sans-serif'; ctx.fillText('?', p.x - camX + 56 + Math.sin(S.t * 3) * 4, p.y + 4); }
  if (S.selected === 'team') ring(p.x - camX, p.y + 30, 74, '#5dd3ff');
  if (tm.upT > 0) badge(p.x - camX, p.y - 26, '🎓 UPSKILLED!', '#ffd34d', Math.min(1, tm.upT * 2));
  else if (st && st.train) badge(p.x - camX, p.y - 26, st.slow ? '📖 SELF-TAUGHT...' : '🎓 TRAINING', '#ffd34d', 1);
  else if (st && st.rest) badge(p.x - camX, p.y - 26, '☕ BREAK', '#b2ebf2', 1);
  else if (tm.fresh > 0) badge(p.x - camX, p.y - 26, '⚡ REFRESHED', '#b9f6ca', Math.min(1, tm.fresh * 2));
  else if (tm.supplied > 0) badge(p.x - camX, p.y - 26, '🪂 SUPPLIES ARRIVED', '#ffe082', Math.min(1, tm.supplied * 2));
  else if (S.idea.bulb) badge(p.x - camX, p.y - 26, '💡 BANJO HAS AN IDEA', '#b3e5fc', 0.8 + Math.sin(S.t * 5) * 0.2);
  else if (tm.tired && !S.finished) badge(p.x - camX, p.y - 26, '😓 EXHAUSTED', '#ffccbc', 1);
  else if (!S.build.kpOn) tag(p.x - camX, p.y - 26, 'TEAM', '#5dd3ff');
  else if (S.kpos[2]) tag(S.kpos[2].x - camX, S.kpos[2].y - 78, 'TEAM', '#5dd3ff'); // on the build site: over Matilda at the stone pile
}
function badge(x, y, text, col, a) {
  ctx.save(); ctx.globalAlpha = a; ctx.font = 'bold 11px system-ui, sans-serif';
  const w = ctx.measureText(text).width + 16;
  ctx.fillStyle = col; ctx.strokeStyle = '#8a6d00'; ctx.lineWidth = 1.5; rr(x - w / 2, y - 10, w, 17, 8); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#3a2c00'; ctx.textAlign = 'center'; ctx.fillText(text, x, y + 3); ctx.textAlign = 'left'; ctx.restore();
}
// A cute koala, facing right, feet at (0,0). Hard hats on even koalas, bandanas on odd ones.
function drawKoala(x, y, s, col, swing, mood, i, flip = false, carry = null, ex = {}) {
  const t = S.t;
  ctx.save(); ctx.translate(x, y); ctx.scale(s * (flip ? -1 : 1), s * (mood === 'sneak' ? 0.86 : 1));
  if (mood === 'rest') ctx.translate(0, 6); // sitting down
  if (ex.tired) ctx.rotate(0.06);           // slumped forward
  if (ex.lead) { // a little leader pennant for the task they were handed
    ctx.strokeStyle = '#5d4037'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(-9, -18); ctx.lineTo(-11, -74); ctx.stroke();
    ctx.fillStyle = '#ffd34d'; ctx.strokeStyle = '#b26a00'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(-11, -74); ctx.lineTo(10, -68.5 + Math.sin(t * 6) * 1.5); ctx.lineTo(-11, -62); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#b26a00'; ctx.font = 'bold 8px sans-serif'; ctx.fillText('★', -8, -65.5);
  }
  // feet
  ctx.fillStyle = '#5f6368';
  ctx.beginPath(); ctx.ellipse(-5 + swing * 4, -2, 5, 3, 0, 0, 7); ctx.ellipse(6 - swing * 4, -2, 5, 3, 0, 0, 7); ctx.fill();
  // back arm
  ctx.strokeStyle = '#8a9198'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-4, -21); ctx.lineTo(-8 - swing * 3, -12); ctx.stroke();
  // body + belly
  ctx.fillStyle = '#9aa1a8'; ctx.beginPath(); ctx.ellipse(0, -15, 12, 14, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#e8e8e8'; ctx.beginPath(); ctx.ellipse(2.5, -13, 7, 9, 0, 0, 7); ctx.fill();
  if (S.vests) { // v7.6: hi-vis safety vest panels with a reflective stripe
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, -15, 12, 14, 0, 0, 7); ctx.clip();
    ctx.fillStyle = '#ff9800'; ctx.fillRect(-12, -26, 8.5, 20); ctx.fillRect(7.5, -26, 6, 20);
    ctx.fillStyle = '#eceff1'; ctx.fillRect(-12, -15, 8.5, 2.6); ctx.fillRect(7.5, -15, 6, 2.6); ctx.restore();
  }
  // scarf / bandana neck
  if (i % 2 === 1) { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-8, -27); ctx.lineTo(10, -27); ctx.lineTo(2, -19); ctx.closePath(); ctx.fill(); }
  if (ex.leaf) { // "Koala of the week": a gum leaf pinned on the chest
    ctx.fillStyle = '#7cb342'; ctx.beginPath(); ctx.ellipse(4, -16, 2.6, 6, 0.6, 0, 7); ctx.fill();
    ctx.strokeStyle = '#33691e'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(0.5, -11); ctx.lineTo(7.5, -21); ctx.stroke();
  }
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
  if (mood === 'happy' || mood === 'rest' || mood === 'drink') { ctx.strokeStyle = '#1d1d1d'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(-1, -36, 2, Math.PI, 0); ctx.arc(8, -36, 2, Math.PI, 0); ctx.stroke(); }
  else if (ex.tired || mood === 'struggle') { ctx.strokeStyle = '#1d1d1d'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-3.5, -36); ctx.lineTo(1.5, -36.5); ctx.moveTo(5.5, -36.5); ctx.lineTo(10.5, -36); ctx.stroke(); }
  else { ctx.beginPath(); ctx.arc(-1, -37, 1.7, 0, 7); ctx.arc(8, -37, 1.7, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-0.5, -37.6, 0.6, 0, 7); ctx.arc(8.5, -37.6, 0.6, 0, 7); ctx.fill(); }
  // big black nose
  ctx.fillStyle = '#262626'; ctx.beginPath(); ctx.ellipse(4, -31, 3.8, 4.8, 0, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.ellipse(3, -33, 1, 1.5, 0, 0, 7); ctx.fill();
  // mouth
  if (mood === 'stuck' || mood === 'confused' || mood === 'struggle' || ex.tired) { ctx.fillStyle = '#5a2a2a'; ctx.beginPath(); ctx.ellipse(4, -25, 2, 1.6, 0, 0, 7); ctx.fill(); }
  if (ex.tired || mood === 'struggle') { // sweat drops
    ctx.fillStyle = '#81d4fa';
    for (let k = 0; k < 2; k++) { const ph = (t * 1.3 + k * 0.5 + i * 0.3) % 1; ctx.globalAlpha = 1 - ph; ctx.beginPath(); ctx.ellipse(-12 - k * 4, -40 + ph * 14 + k * 6, 1.6, 2.6, 0, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  // front arm + tool (a small pruning saw: red garden-tool handle, toothed blade)
  let a;
  if (mood === 'hack') a = -1.4 + (Math.sin(t * 16 + i * 1.1) * 0.5 + 0.5) * 2.3;
  else if (mood === 'work') a = -1.0 + (Math.sin(t * 11 + i) * 0.5 + 0.5) * 1.6;
  else if (mood === 'chisel') { const ph = (t * 1.5 + i * 0.27) % 1; a = ph < 0.75 ? lerp(0.15, -1.9, ease(ph / 0.75)) : lerp(-1.9, 0.3, (ph - 0.75) / 0.25); }
  else if (mood === 'happy') a = -1.9 + Math.sin(t * 8 + i) * 0.3;
  else if (mood === 'stuck') a = Math.sin(t * 18 + i) * 1.1 - 0.4;
  else if (mood === 'struggle') a = -0.5 + Math.sin(t * 24) * 0.12; // saw jammed, arm trembling
  else if (mood === 'rest') a = i % 2 ? -1.3 + Math.sin(t * 2 + i) * 0.25 : -1.7 + Math.max(0, Math.sin(t * 1.6 + i)) * 0.6; // munching / drinking
  else if (mood === 'drink') a = -1.75 + Math.max(0, Math.sin(t * 1.8 + i * 1.3)) * 0.55; // v7.6: water break
  else if (mood === 'sneak') a = -2.2;
  else if (mood === 'carry') a = -0.2;
  else if (mood === 'learn') a = 0.5 + Math.sin(t * 3 + i) * 0.15;
  else if (mood === 'lift') a = -1.65 + Math.sin(t * 3 + i) * 0.08; // paws up under the capstone
  else if (mood === 'haul') a = 0.15 + Math.sin(t * 5 + i) * 0.45;  // hand over hand on the rope
  else a = 0.9 + swing * 0.3;
  const sx = 5, sy = -22, len = mood === 'sneak' ? 7 : 9;
  const hx = sx + Math.cos(a) * len, hy = sy + Math.sin(a) * len;
  if (mood === 'carry' && carry) drawItem(carry, 13, -15, 1.0);
  if (mood === 'drink') { ctx.save(); ctx.translate(hx, hy); ctx.rotate(a + 1.2); ctx.fillStyle = '#4fc3f7'; rr(-2.5, -9, 5, 12, 2); ctx.fill(); ctx.fillStyle = '#0277bd'; ctx.fillRect(-2, -11, 4, 2.5); ctx.restore(); }
  if (mood === 'rest') { // water bottle (hard hats) or a eucalyptus leaf snack (bandanas)
    ctx.save(); ctx.translate(hx, hy);
    if (i % 2) { ctx.fillStyle = '#7cb342'; ctx.beginPath(); ctx.ellipse(2, -3, 3, 7, 0.5, 0, 7); ctx.fill(); }
    else { ctx.rotate(a + 1.2); ctx.fillStyle = '#4fc3f7'; rr(-2.5, -9, 5, 12, 2); ctx.fill(); ctx.fillStyle = '#0277bd'; ctx.fillRect(-2, -11, 4, 2.5); }
    ctx.restore();
  }
  if (mood === 'lift') { ctx.strokeStyle = '#8a9198'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-4, -21); ctx.lineTo(-5, -32); ctx.stroke(); }
  if (mood === 'chisel') {
    // chisel held against the rock, hammer swinging down onto it
    ctx.fillStyle = '#90a4ae'; ctx.fillRect(10, -19, 9, 2.4); ctx.fillStyle = '#6d4c2f'; ctx.fillRect(7, -19.4, 4, 3.2);
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(a + 0.25);
    ctx.fillStyle = '#8d6e63'; ctx.fillRect(-1, -1.5, 14, 3);
    ctx.fillStyle = '#455a64'; ctx.fillRect(12, -6, 6.5, 12); ctx.fillStyle = '#78909c'; ctx.fillRect(12, -6, 6.5, 2.5);
    ctx.restore();
  } else if (mood === 'hack' || mood === 'work' || mood === '' || mood === 'walk' || mood === 'struggle') {
    const ba = mood === 'struggle' ? a + 0.9 : mood === 'hack' || mood === 'work' ? a + 0.25 : 1.35;
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(ba);
    ctx.fillStyle = '#d84315'; rr(-4, -2.6, 7, 5.2, 2); ctx.fill();
    ctx.fillStyle = '#dfe6ea'; ctx.strokeStyle = '#607d8b'; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(3, -2.4); ctx.lineTo(17, -1.2);
    for (let k = 0; k <= 6; k++) ctx.lineTo(17 - k * 2.33, 1.4 + (k % 2 ? 1.5 : 0));
    ctx.lineTo(3, 2.4); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  ctx.strokeStyle = '#9aa1a8'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(hx, hy); ctx.stroke();
  ctx.fillStyle = '#7d848b'; ctx.beginPath(); ctx.arc(hx, hy, 2.6, 0, 7); ctx.fill();
  ctx.lineCap = 'butt';
  ctx.restore();
}

function drawKoalaLabels() {
  const shown = new Set();
  for (const b of S.kb) {
    const P = S.kpos[b.i]; if (!P) continue;
    shown.add(b.i);
    badge(P.x - camX, P.y + 20 + (b.i % 2) * 18, b.text, b.col, Math.min(1, b.t * 2, (b.dur - b.t) * 4));
  }
  if (S.hover >= 0 && !shown.has(S.hover) && S.kpos[S.hover]) {
    const P = S.kpos[S.hover], K = KOALAS[S.hover];
    badge(P.x - camX, P.y + 22, `🐨 ${K.name} (${K.desc})`, ['#ffd0a6', '#bcd9ff', '#fff1a8', '#e2c6f5'][S.hover], 1);
  }
}
// The supply drop: a crate on a parachute floats down through a gap in the canopy.
function drawDrop(phase) {
  const D = S.drop; if (!D) return;
  const x = D.x - camX; if (x < -100 || x > viewW + 100) return;
  const a = 1 - Math.min(1, D.fade || 0);
  ctx.save(); ctx.globalAlpha = a;
  if (phase === 'gap' && !D.landed) { // light pours through the canopy gap
    const g = ctx.createLinearGradient(0, CANOPY_TOP, 0, GROUND);
    g.addColorStop(0, 'rgba(255,250,210,0.5)'); g.addColorStop(1, 'rgba(255,250,210,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - 34, CANOPY_TOP + 40); ctx.lineTo(x + 34, CANOPY_TOP + 40); ctx.lineTo(x + 70, GROUND); ctx.lineTo(x - 70, GROUND); ctx.fill();
    ctx.restore(); return;
  }
  if (phase === 'gap') { ctx.restore(); return; }
  const q = Math.min(1, D.t / 3.0), y = lerp(CANOPY_TOP - 70, GROUND - 2, q), sway = D.landed ? 0 : Math.sin(D.t * 3) * 6;
  if (!D.landed) {
    ctx.fillStyle = 'rgba(158,224,255,0.55)'; ctx.beginPath(); ctx.ellipse(x, CANOPY_TOP + 40, 46, 22, 0, 0, 7); ctx.fill(); // the gap
    ctx.strokeStyle = '#eceff1'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x + sway - 26, y - 62); ctx.lineTo(x - 12, y - 24); ctx.moveTo(x + sway + 26, y - 62); ctx.lineTo(x + 12, y - 24); ctx.moveTo(x + sway, y - 70); ctx.lineTo(x, y - 24); ctx.stroke();
    ctx.fillStyle = '#ef5350'; ctx.beginPath(); ctx.arc(x + sway, y - 60, 28, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(x + sway - 9, y - 60); ctx.arc(x + sway, y - 60, 28, Math.PI * 1.35, Math.PI * 1.65); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = '#a1774a'; ctx.strokeStyle = '#5d4037'; ctx.lineWidth = 2; ctx.fillRect(x - 16, y - 24, 32, 24); ctx.strokeRect(x - 16, y - 24, 32, 24);
  ctx.beginPath(); ctx.moveTo(x - 16, y - 24); ctx.lineTo(x + 16, y); ctx.moveTo(x + 16, y - 24); ctx.lineTo(x - 16, y); ctx.stroke();
  if (D.landed) { // opened: a saw and a hard hat
    ctx.fillStyle = '#ffca28'; ctx.beginPath(); ctx.arc(x - 6, y - 26, 6, Math.PI, 0); ctx.fill(); ctx.fillRect(x - 13, y - 27, 14, 2);
    ctx.fillStyle = '#dfe6ea'; ctx.fillRect(x + 2, y - 34, 3, 10); ctx.fillStyle = '#d84315'; ctx.fillRect(x + 1.5, y - 38, 4, 5);
    tag(x, y + 16, 'SAWS + SAFETY GEAR', '#ffe082');
  }
  ctx.restore();
}
// A gum leaf flies from the owl to Matilda.
function drawLeafFly() {
  const L = S.leafFly, P = S.kpos[2]; if (!L || !P) return;
  const q = ease(Math.min(1, L.t / 0.9)), m = agentPos('manager');
  const x = lerp(m.x, P.x, q) - camX, y = lerp(m.y + 10, P.y - 30 * P.s / KOALA_SCALE, q) - Math.sin(Math.PI * q) * 40;
  ctx.save(); ctx.translate(x, y); ctx.rotate(S.t * 6);
  ctx.fillStyle = '#7cb342'; ctx.beginPath(); ctx.ellipse(0, 0, 4, 9, 0, 0, 7); ctx.fill(); ctx.restore();
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

// ---------- v3 drawing: surprises, meetings ----------
function drawSurprises(late) {
  for (const sp of S.surprises) {
    if ((sp.type === 'treefall' || sp.type === 'snake') !== !!late) continue; // the fallen tree lies in front of the bush row
    const x = sp.x - camX; if (x > viewW + 220 || x + sp.w < -220) continue;
    const gy = groundBase(sp.x + sp.w / 2);
    if (sp.type === 'sinkhole' && sp.rev > 0) {
      const e = ease(sp.rev), cx = x + sp.w / 2;
      ctx.fillStyle = '#8a6a44'; ctx.beginPath(); ctx.ellipse(cx, gy + 5, sp.w / 2 * e + 6, 13 * e + 3, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#140c05'; ctx.beginPath(); ctx.ellipse(cx, gy + 6, sp.w / 2 * e, 11 * e, 0, 0, 7); ctx.fill();
      if (sp.rev < 1 && Math.random() < 0.5) S.particles.push({ kind: 'confetti', x: sp.x + Math.random() * sp.w, y: gy, vx: (Math.random() - 0.5) * 40, vy: -30, r: 0, vr: 3, life: 0.6, c: '#7a5a3a' });
      const n = Math.floor(sp.prog * 6 + 0.0001);
      ctx.fillStyle = '#9a6a3a'; ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 1;
      for (let k = 0; k < n; k++) { const px = x - 8 + k * (sp.w + 16) / 6; ctx.fillRect(px, gy - 5, (sp.w + 16) / 6 - 2, 9); ctx.strokeRect(px, gy - 5, (sp.w + 16) / 6 - 2, 9); }
    } else if (sp.type === 'treefall' && !sp.done && sp.prog < 1) {
      const bx = x + sp.w + 40, Lt = 175, e = ease(sp.rev);
      const lift = sp.prog * 24, fade = 1 - sp.prog * sp.prog, shrink = 1 - sp.prog * 0.25;
      ctx.save(); ctx.globalAlpha = fade; ctx.translate(bx, gy - lift - 26 * e); ctx.scale(shrink, shrink); ctx.rotate(-Math.PI / 2 * e);
      ctx.fillStyle = '#8a5a34'; ctx.strokeStyle = '#3e2410'; ctx.lineWidth = 2.5; ctx.fillRect(-14, -Lt, 28, Lt); ctx.strokeRect(-14, -Lt, 28, Lt);
      ctx.fillStyle = '#e3c08a'; ctx.beginPath(); ctx.ellipse(0, 0, 14, 5, 0, 0, 7); ctx.fill(); ctx.stroke(); // fresh broken base
      ctx.strokeStyle = 'rgba(40,25,10,0.5)'; ctx.lineWidth = 2;
      for (let k = 1; k < 6; k++) { ctx.beginPath(); ctx.moveTo(-8, -k * 28); ctx.lineTo(8, -k * 28 - 6); ctx.stroke(); }
      if (sp.prog > 0) { ctx.strokeStyle = '#f2d9a8'; ctx.lineWidth = 3; for (const k of [0.33, 0.66]) { ctx.beginPath(); ctx.moveTo(-11, -Lt * k); ctx.lineTo(11, -Lt * k); ctx.stroke(); } }
      ctx.fillStyle = '#3f8f3a';
      for (const [cx2, cy2, r2] of [[0, -Lt - 8, 34], [-22, -Lt + 14, 24], [22, -Lt + 12, 24]]) { ctx.beginPath(); ctx.arc(cx2, cy2, r2, 0, 7); ctx.fill(); }
      ctx.restore();
      if (sp.rev > 0.97 && sp.rev < 1 && !sp.crashed) { sp.crashed = true; for (let i = 0; i < 16; i++) leaf(sp.x + Math.random() * 40, gy - 20); }
    } else if (sp.type === 'snake' && sp.rev > 0 && !sp.done && sp.prog < 1) {
      const leaving = sp.prog > 0, dir = leaving ? 1 : -1;
      const hx = leaving ? lerp(x + sp.w * 0.35, x + sp.w + 160, ease(sp.prog)) : lerp(x + sp.w + 90, x + sp.w * 0.35, ease(sp.rev));
      ctx.save(); ctx.globalAlpha = leaving ? 1 - sp.prog : 1;
      ctx.translate(hx, gy); ctx.scale(1.7, 1.7); ctx.translate(-hx, -gy - 3); // big enough to read, in front of the bush row
      const pts = []; for (let k = 0; k < 24; k++) pts.push([hx - dir * k * 5, gy - 4 + Math.sin(k * 0.55 - S.t * 7 * (sp.done ? 0 : 1)) * 4]);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = '#7b5a2e'; ctx.lineWidth = 8; ctx.beginPath(); pts.forEach(([px, py], k) => k ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.stroke();
      ctx.strokeStyle = '#c9a06a'; ctx.lineWidth = 2.5; ctx.beginPath(); pts.forEach(([px, py], k) => k ? ctx.lineTo(px, py + 1.5) : ctx.moveTo(px, py + 1.5)); ctx.stroke();
      ctx.fillStyle = '#6b4a22'; ctx.beginPath(); ctx.ellipse(hx + dir * 4, gy - 5, 8, 5.5, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffeb3b'; ctx.beginPath(); ctx.arc(hx + dir * 7, gy - 7, 1.6, 0, 7); ctx.fill();
      if (Math.sin(S.t * 9) > 0.2) { ctx.strokeStyle = '#e53935'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(hx + dir * 12, gy - 5); ctx.lineTo(hx + dir * 19, gy - 5); ctx.lineTo(hx + dir * 22, gy - 8); ctx.moveTo(hx + dir * 19, gy - 5); ctx.lineTo(hx + dir * 22, gy - 2); ctx.stroke(); }
      ctx.restore(); ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
    }
  }
}
function drawSurpriseMarkers() {
  for (const sp of S.surprises) {
    if (sp.rev <= 0 || sp.done) continue;
    const cx = sp.x + sp.w / 2 - camX; if (cx < -40 || cx > viewW + 40) continue;
    const cy = groundBase(sp.x + sp.w / 2) - 190, k = 1 + Math.sin(S.t * 6) * 0.08;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k);
    ctx.fillStyle = 'rgba(255,87,34,0.25)'; ctx.beginPath(); ctx.arc(0, 0, 24, 0, 7); ctx.fill();
    ctx.fillStyle = '#ff5722'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, 16, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 20px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('?', 0, 7);
    ctx.font = 'bold 10px system-ui, sans-serif'; ctx.fillStyle = '#ffccbc'; ctx.fillText('UNPLANNED', 0, -27); ctx.textAlign = 'left';
    ctx.restore();
  }
}
function drawEagleShape(x, y, s, body, head, flapSpeed, phase) {
  const flap = Math.sin(S.t * flapSpeed + phase) * 14;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.moveTo(-4, 0); ctx.quadraticCurveTo(-26, -10 - flap, -52, -4 - flap * 1.4); ctx.quadraticCurveTo(-30, 4, -4, 6); ctx.fill();
  ctx.beginPath(); ctx.moveTo(4, 0); ctx.quadraticCurveTo(26, -10 - flap, 52, -4 - flap * 1.4); ctx.quadraticCurveTo(30, 4, 4, 6); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, 2, 10, 18, 0, 0, 7); ctx.fill();
  ctx.fillStyle = head; ctx.beginPath(); ctx.arc(0, -14, 8, 0, 7); ctx.fill();
  ctx.fillStyle = '#f2b233'; ctx.beginPath(); ctx.moveTo(-3, -11); ctx.lineTo(0, -4); ctx.lineTo(3, -11); ctx.fill();
  ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(-3, -16, 1.4, 0, 7); ctx.arc(3, -16, 1.4, 0, 7); ctx.fill();
  ctx.restore();
}
function drawMeeting() {
  const M = S.leader.meeting; if (!M) return;
  const d = M.def;
  ctx.font = '600 12px system-ui, sans-serif';
  d.visitors.forEach((v, i) => {
    const p = visitorPos(M, i), x = p.x - camX, y = p.y;
    drawEagleShape(x, y, v.size, v.body, v.head, 6, i * 1.3);
    tag(x, y + 30 * v.size + 6, v.label, v.head);
    const c = M.cards[i];
    if (!c.shown && M.phase !== 'decide' && M.phase !== 'leave') return;
    const text = (c.state === 'yes' ? '✅ ' : c.state === 'parked' ? '⏸ Parked: ' : '') + v.ask;
    const w = ctx.measureText(text).width + 18, h = 22;
    let cx = clamp(x - w / 2, 4, viewW - w - 4), cy = Math.max(4, y - 30 * v.size - 30);
    if (settings.view !== 'team' && settings.view !== 'manager' && cx < 356 && cy < 50) cy = 50; // keep clear of the minimap
    let a = 1;
    if (M.phase === 'leave') { const q = Math.min(1, M.t / MEETING_PHASES.leave); a = 1 - q; if (c.state === 'yes') { const L = S.leader; cx = lerp(cx, L.x - camX - w / 2, q); cy = lerp(cy, L.y, q); } }
    ctx.globalAlpha = a;
    ctx.fillStyle = c.state === 'yes' ? '#e8f5e9' : c.state === 'parked' ? '#e0e0e0' : '#fffde7';
    ctx.strokeStyle = c.state === 'yes' ? '#2e7d32' : c.state === 'parked' ? '#9e9e9e' : '#f9a825';
    ctx.lineWidth = 2; rr(cx, cy, w, h, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = c.state === 'parked' ? '#777' : '#222'; ctx.fillText(text, cx + 9, cy + 15);
    if (c.state === 'parked') { ctx.strokeStyle = '#888'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(cx + 8, cy + 11); ctx.lineTo(cx + w - 8, cy + 11); ctx.stroke(); }
    ctx.globalAlpha = 1;
  });
}

function drawMiniMap() {
  if (settings.view === 'team' || settings.view === 'manager') return;
  const w = 340, h = 34, x = 12, y = 12, k = (w - 20) / WORLD_W;
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; rr(x, y, w, h, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = '#2e7d32'; ctx.fillRect(x + 10, y + 20, w - 20, 4);
  const lx0 = x + 10 + SHRUBS.x0 * k, lx1 = x + 10 + SHRUBS.x1 * k;
  ctx.fillStyle = S.idea.adopted ? 'rgba(120,80,40,0.35)' : '#8d6e3f'; ctx.fillRect(lx0, y + 19, lx1 - lx0, 6); // shrubbery on the planned route
  if (S.idea.adopted) { // the new route, via the creek
    ctx.save(); ctx.strokeStyle = '#1e88e5'; ctx.lineWidth = 2.5; ctx.setLineDash([3, 2]);
    ctx.beginPath(); ctx.moveTo(x + 10 + CREEK.x0 * k, y + 22); ctx.quadraticCurveTo((lx0 + lx1) / 2, y + 33, x + 10 + CREEK.x1 * k, y + 22); ctx.stroke(); ctx.restore();
  }
  ctx.font = '11px sans-serif';
  for (const o of S.obstacles) { ctx.globalAlpha = o.done ? 0.35 : 1; ctx.fillText(o.icon, x + 10 + o.x * k - 6, y + 17); ctx.globalAlpha = 1; }
  for (const o of S.surprises) { if (o.rev <= 0) continue; ctx.globalAlpha = o.done ? 0.35 : 1; ctx.fillText('❓', x + 10 + o.x * k - 6, y + 17); ctx.globalAlpha = 1; }
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
  drawHangingVines();
  drawRiver(false);
  drawGround();
  drawBog(false);
  drawBoulder();
  drawCliff();
  drawWall();
  drawVineThicket();
  drawBees(false);
  drawSurprises();
  drawCreek();
  drawShrubs();
  // v7.2: once the build starts, the pyramid and everyone working on it are drawn after the canopy (see below),
  // so no leaves, trunks or light shafts ever cut across it.
  const site = S.build.on;
  if (!site) drawTeam();
  if (!site) drawGiftLogs();
  drawSurpriseMarkers();
  drawBees(true);
  drawRiver(true);
  drawBog(true);
  drawLog();
  drawBushes();
  drawPathBushes();
  drawRubble();
  drawSurprises(true);
  if (!site) drawKoalaLabels();
  drawDrop('gap');
  if (!site) drawManager();
  drawMgrMeeting();
  drawVisit();
  drawCanopy();
  // The build site, in front of the canopy behind it: pyramid (courses, casing, cap, ramp, ladder, pile), then the koalas
  // and the gear they're carrying, then the owl helping out. The vision outline goes on top, like a blueprint overlay.
  drawBuild();
  if (site) { drawTeam(); drawBuildFront(); drawKoalaLabels(); drawManager(); }
  drawVision();
  drawDrop('crate');
  drawLeafFly();
  drawMeeting();
  drawLeader();
  drawFog();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  drawBeam();
  drawPulses();
  drawOutreach();
  drawParticles();
  drawBubbles();
  drawMiniMap();
  drawSkills();
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
    if (S.kpos.some(P => P && Math.abs(P.x - wx) < 18 * P.s && sy < P.y + 6 && sy > P.y - 58 * P.s)) hit = 'team';
    else if (wx > tx - MEMBER_GAP * 3 - 22 && wx < tx + 22 && sy > memberY(tx) - 95 && sy < memberY(tx) + 50) hit = 'team';
    else {
      const by = groundBase(GOAL_X), half = PYR_HALF * (sy - PYR_APEX) / (by - PYR_APEX);
      if (sy > PYR_APEX && sy < by && Math.abs(wx - GOAL_X) < half) hit = 'goal';
    }
  }
  S.selected = hit;
  call('OnAgentClicked', hit || '');
}
function onMove(ev) {
  const rect = canvas.getBoundingClientRect();
  const sx = (ev.clientX - rect.left) * (canvas.width / rect.width) / scale, sy = (ev.clientY - rect.top) * (canvas.height / rect.height) / scale;
  let h = -1;
  S.kpos.forEach((P, i) => { if (P && Math.abs(P.x - camX - sx) < 16 * P.s && sy < P.y + 4 && sy > P.y - 56 * P.s) h = i; });
  if (h !== S.hover) { S.hover = h; canvas.title = h >= 0 ? `${KOALAS[h].name} (${KOALAS[h].desc})` : ''; canvas.style.cursor = h >= 0 ? 'pointer' : ''; }
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
  canvas.addEventListener('mousemove', onMove);
  window.addEventListener('keydown', onKey);
  snd.init();
  lastT = 0; raf = requestAnimationFrame(frame);
  window.aboveTheCanopy = { settings, get state() { return S; }, get cam() { return { camX, scale, viewW }; }, fastForward, restart, runToEnd, jumpTo, chapters: () => CH_MARKS.slice(), capInfo, setView: v => setView(v), shownCaption: () => S.capShown, focus: () => focusS && Object.assign({}, focusS, { S: undefined }), focusPoints: v => focusPoints(v), setTrace: fn => { TRACE = typeof fn === 'function' ? fn : null; }, sound: () => snd.debug(), soundTestAll: () => snd.testAll() };
}
export function setPlaying(p) { settings.playing = !!p; snd.setPaused(!settings.playing); }
export function restart() { reset(); }
export function setSpeed(v) { settings.speed = clamp(+v || 1, 0.1, 5); snd.setSpeed(settings.speed); }
export function setView(v) { settings.view = v; if (S) emitCaption(true); }
export function setComms(on) { settings.comms = !!on; }
export function select(role) { S.selected = role || null; }
export function fastForward(seconds) { const step = 1 / 30, n = Math.round(seconds / step); S.silent = true; for (let i = 0; i < n; i++) { update(step); updateCamera(step); } S.silent = false; render(); }
// Simulates a full run (used for testing pacing); returns the sim-time when the team finished.
export function runToEnd(maxSeconds = 600) { const step = 1 / 30; S.silent = true; while (!S.finished && S.t < maxSeconds) { update(step); updateCamera(step); } S.silent = false; render(); return S.t; }
// ---- v6: chapters ----
export function setChapters(marks) { if (Array.isArray(marks) && marks.length) CH_MARKS = marks.slice(); }
export function setTeach(on) { settings.teach = !!on; }
export function getChapter() { return S ? S.chapter : 0; }
// Jump = restart, then silently fast-forward the (seeded, fixed-step) simulation until the chapter's first moment.
// Every jump to a chapter therefore lands in exactly the same state. Sound and Blazor callbacks are muted during the run.
export function jumpTo(i) {
  i = clamp(i | 0, 0, CH_MARKS.length - 1);
  reset();
  if (i > 0) {
    S.silent = S.quiet = true;
    while (S.chapter < i && !S.finished && S.t < 900) { update(JUMP_STEP); updateCamera(JUMP_STEP); }
    if (!S.finished) for (let k = Math.round(TEACH_DELAY / JUMP_STEP); k > 0; k--) { update(JUMP_STEP); updateCamera(JUMP_STEP); }
    if (S.capQ.length) { const best = S.capQ.reduce((a, c) => c.prio > a.prio ? c : a, S.capQ[0]); S.capQ.splice(S.capQ.indexOf(best), 1); S.quiet = false; showCaption(best); }
    S.silent = S.quiet = false;
    updateCamera(JUMP_STEP); camX = camTarget;
    stats(); call('OnDay', S.day); emitCaption(true); call('OnChapter', S.chapter);
    if (S.finArgs) call('OnFinished', ...S.finArgs);
  }
  render();
  return S.chapter;
}
// ---- v6: sound ----
export function setSound(on) { snd.setEnabled(on); }
export function setVolume(v) { snd.setVolume(v); }
export function soundPrefs() { return snd.prefs(); }
export function dispose() {
  cancelAnimationFrame(raf);
  if (ro) ro.disconnect();
  if (canvas) { canvas.removeEventListener('click', onClick); canvas.removeEventListener('mousemove', onMove); }
  window.removeEventListener('keydown', onKey);
  snd.dispose();
  dotnet = null;
}
