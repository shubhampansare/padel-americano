/**
 * Fixed-pairs (team) Americano engine tests. Run: node tests/fixedpairs.test.cjs
 * Extracts the engine from index.html (the shipped artifact).
 *
 * Fixed pairs: partners are frozen for the whole session; the TEAM is the unit of
 * competition. The matcher only chooses which teams face which and which whole
 * teams sit out. Matches still store player ids in teamA/teamB.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

function loadEngine() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const start = src.indexOf('/*ENGINE-START*/');
  const end = src.indexOf('/*ENGINE-END*/');
  const code = src.slice(start, end);
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(code + '\nthis.Engine = Engine;', ctx);
  return ctx.Engine;
}
const E = loadEngine();

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

let failures = 0, checks = 0;
function ok(cond, msg) { checks++; if (!cond) { failures++; console.error('  FAIL: ' + msg); } }

// teams: array of [name1, name2] pairs (or {name,skill} objects)
function teamNames(nTeams) {
  return Array.from({ length: nTeams }, (_, i) => [`A${i + 1}`, `B${i + 1}`]);
}
function setKey(arr) { return arr.slice().sort().join('|'); }
function makeFixed(nTeams, courts, plannedRounds, extra) {
  return E.createTournament(Object.assign({
    fixedPairs: true, teams: teamNames(nTeams), courts, plannedRounds,
    pointsPerMatch: 24, scoreEntry: 'combined',
  }, extra || {}));
}

// ---------------------------------------------------------------- creation
console.log('== Creation ==');
{
  const t = makeFixed(4, 2, 6);
  ok(t.config.fixedPairs === true, 'config.fixedPairs set');
  ok(Array.isArray(t.teams) && t.teams.length === 4, 't.teams has 4 teams');
  ok(t.players.length === 8, '8 players created');
  ok(t.players.every(p => p.active && p.arrived), 'all players active+arrived');
  ok(t.teams.every(tm => tm.players.length === 2 && tm.id), 'each team has 2 players + id');
  // team players reference real player ids
  const allIds = new Set(t.players.map(p => p.id));
  ok(t.teams.every(tm => tm.players.every(pid => allIds.has(pid))), 'team players are real ids');
  ok(E.activeTeams(t).length === 4, 'activeTeams = 4');
}

// guards
{
  assert.throws(() => makeFixed(1, 1, 4), /at least 2 teams|at least 4/i, 'need >= 2 teams');
}

// ---------------------------------------------------------------- round structure
console.log('== Round structure & fixed partners ==');
for (const [nTeams, courts] of [[4, 2], [5, 2], [6, 1], [6, 3], [8, 2], [3, 1]]) {
  const rng = mulberry32(nTeams * 31 + courts);
  const t = makeFixed(nTeams, courts, 8);
  E.refillPlanned(t, rng);
  const registered = new Set(t.teams.map(tm => setKey(tm.players)));
  const cu = Math.min(courts, Math.floor(nTeams / 2));
  for (let ri = 0; ri < t.rounds.length; ri++) {
    const r = t.rounds[ri];
    const label = `${nTeams}t c${courts} r${ri + 1}`;
    ok(r.matches.length === cu, `${label}: matches=${r.matches.length} expected ${cu}`);
    ok(r.resting.length === (nTeams - 2 * cu) * 2, `${label}: resting players=${r.resting.length} expected ${(nTeams - 2 * cu) * 2}`);
    // every team in a match is an intact registered team (partners never split)
    for (const m of r.matches) {
      ok(registered.has(setKey(m.teamA)), `${label}: teamA is an intact team`);
      ok(registered.has(setKey(m.teamB)), `${label}: teamB is an intact team`);
    }
    // resting players are whole teams (both members together)
    const restSet = new Set(r.resting);
    for (const tm of t.teams) {
      const inRest = tm.players.filter(pid => restSet.has(pid)).length;
      ok(inRest === 0 || inRest === 2, `${label}: team rests as a whole (got ${inRest})`);
    }
    // everyone appears exactly once
    const seen = new Set();
    for (const pid of r.resting) { ok(!seen.has(pid), `${label}: dup`); seen.add(pid); }
    for (const m of r.matches) for (const pid of m.teamA.concat(m.teamB)) { ok(!seen.has(pid), `${label}: double-booked`); seen.add(pid); }
    ok(seen.size === nTeams * 2, `${label}: covers all players`);
  }
}

// ---------------------------------------------------------------- sit-out fairness
console.log('== Team sit-out fairness ==');
for (const [nTeams, courts, rounds] of [[5, 2, 8], [6, 1, 9], [3, 1, 6], [7, 3, 10]]) {
  const rng = mulberry32(nTeams * 7 + courts * 3 + rounds);
  const t = makeFixed(nTeams, courts, rounds);
  E.refillPlanned(t, rng);
  const label = `${nTeams}t c${courts}`;
  // map player -> team index for fast lookup
  const teamOf = {}; t.teams.forEach((tm, i) => tm.players.forEach(pid => { teamOf[pid] = i; }));
  let prevRestTeams = new Set();
  const teamGames = t.teams.map(() => 0);
  for (let ri = 0; ri < t.rounds.length; ri++) {
    const r = t.rounds[ri];
    const restTeams = new Set([...new Set(r.resting.map(pid => teamOf[pid]))]);
    const need = restTeams.size;
    // no consecutive team sit-outs when feasible
    if (t.teams.length - prevRestTeams.size >= need) {
      for (const ti of restTeams) ok(!prevRestTeams.has(ti), `${label} r${ri + 1}: team ${ti} rested twice in a row`);
    }
    prevRestTeams = restTeams;
    for (const m of r.matches) { teamGames[teamOf[m.teamA[0]]]++; teamGames[teamOf[m.teamB[0]]]++; }
  }
  const spread = Math.max(...teamGames) - Math.min(...teamGames);
  ok(spread <= 1, `${label}: team games spread ${spread} > 1 (${teamGames.join(',')})`);
}

// sit-outs are score-independent: entering scores never changes who rests in the drawn rounds
{
  const t = makeFixed(5, 2, 6); E.refillPlanned(t, mulberry32(999));
  const before = t.rounds.map(r => r.resting.slice().sort().join(','));
  E.setScore(t, 0, 0, 14, 10); E.setScore(t, 0, 1, 12, 12);
  const after = t.rounds.map(r => r.resting.slice().sort().join(','));
  ok(JSON.stringify(before) === JSON.stringify(after), 'resting unchanged after scoring (score-independent)');
}

// ---------------------------------------------------------------- no avoidable team rematches
console.log('== No avoidable team rematches (best-of-N) ==');
function teamFacedRepeats(t) {
  const teamOf = {}; t.teams.forEach((tm) => tm.players.forEach(pid => { teamOf[pid] = tm.id; }));
  const faced = {};
  for (const r of t.rounds) for (const m of r.matches) {
    const x = teamOf[m.teamA[0]], y = teamOf[m.teamB[0]];
    const k = x < y ? x + '|' + y : y + '|' + x;
    faced[k] = (faced[k] || 0) + 1;
  }
  let extra = 0; for (const k in faced) if (faced[k] > 1) extra += faced[k] - 1;
  return extra;
}
// configs whose planned rounds fit inside the team round-robin should be rematch-free
// NB: 8 teams on 2 courts force two alternating groups of 4 (no-consecutive-sit-out),
// so a clean round-robin fits in 6 rounds (3 per group) but not 7 — see CLAUDE.md.
for (const [nTeams, courts, rounds] of [[4, 2, 3], [6, 1, 5], [6, 3, 5], [8, 2, 6], [5, 2, 5]]) {
  let bad = 0;
  for (let seed = 0; seed < 60; seed++) {
    const t = makeFixed(nTeams, courts, rounds);
    E.refillPlanned(t, mulberry32(seed * 13 + 1));
    if (teamFacedRepeats(t) > 0) bad++;
  }
  ok(bad === 0, `${nTeams}t c${courts} x${rounds}r: ${bad}/60 seeds had avoidable team rematches`);
}

// ---------------------------------------------------------------- team standings
console.log('== Team standings ==');
{
  const t = makeFixed(4, 2, 3);
  E.refillPlanned(t, mulberry32(5));
  // score every round deterministically
  const rng = mulberry32(77);
  for (let ri = 0; ri < t.rounds.length; ri++) {
    for (let mi = 0; mi < t.rounds[ri].matches.length; mi++) {
      const a = Math.floor(rng() * 25); E.setScore(t, ri, mi, a, 24 - a);
    }
  }
  const ts = E.teamStandings(t);
  ok(ts.length === 4, 'one row per team');
  // each team row's points == sum of its match scores (independent recompute)
  const teamOf = {}; t.teams.forEach(tm => tm.players.forEach(pid => { teamOf[pid] = tm.id; }));
  const ref = {}; t.teams.forEach(tm => { ref[tm.id] = { pts: 0, played: 0, wins: 0, pf: 0, pa: 0 }; });
  for (const r of t.rounds) for (const m of r.matches) {
    if (m.scoreA === null) continue;
    const A = teamOf[m.teamA[0]], B = teamOf[m.teamB[0]];
    ref[A].pts += m.scoreA; ref[A].pf += m.scoreA; ref[A].pa += m.scoreB; ref[A].played++; if (m.scoreA > m.scoreB) ref[A].wins++;
    ref[B].pts += m.scoreB; ref[B].pf += m.scoreB; ref[B].pa += m.scoreA; ref[B].played++; if (m.scoreB > m.scoreA) ref[B].wins++;
  }
  for (const row of ts) {
    const r = ref[row.team.id];
    ok(row.points === r.pts, `team points match for ${row.team.id} (${row.points} vs ${r.pts})`);
    ok(row.played === r.played && row.wins === r.wins && row.diff === r.pf - r.pa, `team played/wins/diff match`);
  }
  // sorted points desc
  for (let i = 1; i < ts.length; i++) ok(ts[i - 1].points >= ts[i].points, 'team standings sorted by points');
}

// rest compensation modes (team level)
{
  // 3 teams, 1 court -> 1 team rests each round; give 'half' credit
  const t = makeFixed(3, 1, 3, { restMode: 'half' });
  E.refillPlanned(t, mulberry32(3));
  for (let ri = 0; ri < t.rounds.length; ri++) E.setScore(t, ri, 0, 14, 10);
  const ts = E.teamStandings(t);
  // a resting team should have gained 12 (half of 24) per rest
  for (const row of ts) {
    const restCredit = row.rests * 12;
    ok(row.points >= restCredit - 0.001, `half rest credit applied (${row.team.id}: pts ${row.points}, rests ${row.rests})`);
  }
  ok(ts.some(r => r.rests > 0), 'at least one team rested');
}

// ---------------------------------------------------------------- progression & head-to-head
console.log('== Team score views ==');
{
  const t = makeFixed(4, 2, 3);
  E.refillPlanned(t, mulberry32(8));
  for (let ri = 0; ri < t.rounds.length; ri++) for (let mi = 0; mi < t.rounds[ri].matches.length; mi++) E.setScore(t, ri, mi, 15, 9);
  const prog = E.teamProgression(t);
  ok(prog.length === 3, 'progression has one step per scored round');
  ok(prog[0].order.length === 4 && prog[0].rank && prog[0].points, 'progression step shape (teams)');
  const h2h = E.teamHeadToHead(t);
  ok(Object.keys(h2h).length === 4, 'head-to-head keyed by team');
  // net is antisymmetric
  const ids = t.teams.map(tm => tm.id);
  for (const a of ids) for (const b of ids) if (a !== b && h2h[a][b]) {
    ok(h2h[a][b].net === -h2h[b][a].net, 'h2h net antisymmetric');
  }
}

// ---------------------------------------------------------------- roster ops
console.log('== Add / remove team ==');
{
  const t = makeFixed(4, 2, 6);
  E.refillPlanned(t, mulberry32(2));
  E.setScore(t, 0, 0, 14, 10); E.setScore(t, 0, 1, 12, 12); // round 1 complete
  const playedR0 = JSON.stringify(t.rounds[0]);
  const nt = E.addTeam(t, ['NewA', 'NewB'], mulberry32(4), [2, 2]);
  ok(t.teams.length === 5, 'addTeam -> 5 teams');
  ok(nt && nt.players.length === 2, 'addTeam returns team');
  ok(JSON.stringify(t.rounds[0]) === playedR0, 'played round 1 frozen after addTeam');
  // new team appears in some future round
  const newKey = setKey(nt.players);
  const appears = t.rounds.some(r => r.matches.some(m => setKey(m.teamA) === newKey || setKey(m.teamB) === newKey) || r.resting.some(pid => nt.players.includes(pid)));
  ok(appears, 'new team scheduled in a future round');

  E.removeTeam(t, nt.id, mulberry32(6));
  ok(E.activeTeams(t).length === 4, 'removeTeam -> 4 active teams');
  ok(JSON.stringify(t.rounds[0]) === playedR0, 'played round 1 still frozen after removeTeam');
  assert.throws(() => { const t2 = makeFixed(2, 1, 4); E.refillPlanned(t2, mulberry32(1)); E.removeTeam(t2, t2.teams[0].id, mulberry32(2)); }, /at least 2/i, 'cannot drop below 2 teams');
}

// ---------------------------------------------------------------- backwards compatibility
console.log('== Backwards compatibility (individual mode unchanged) ==');
{
  const t = E.createTournament({ players: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'], courts: 2, plannedRounds: 6 });
  ok(!t.config.fixedPairs, 'default fixedPairs falsy');
  ok(t.teams === undefined, 'no t.teams in individual mode');
  E.refillPlanned(t, mulberry32(1));
  // partners rotate: at least one player has >1 distinct partner
  const partners = {};
  for (const r of t.rounds) for (const m of r.matches) {
    for (const [x, y] of [[m.teamA[0], m.teamA[1]], [m.teamB[0], m.teamB[1]]]) {
      (partners[x] = partners[x] || new Set()).add(y);
      (partners[y] = partners[y] || new Set()).add(x);
    }
  }
  ok(Object.values(partners).some(s => s.size > 1), 'individual mode rotates partners');
}

console.log(`\n${checks} checks, ${failures} failures`);
process.exit(failures ? 1 : 0);
