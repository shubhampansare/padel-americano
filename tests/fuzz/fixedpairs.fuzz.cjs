/**
 * Fixed-pairs (team) Americano fuzzer.
 *
 * GUARANTEES UNDER TEST, across thousands of randomized team tournaments with mid-session
 * churn (add team / remove team / rejoin / set skill / set courts / set planned / score):
 *
 *  1. IMMUTABILITY — no operation ever changes the round being played (current = first
 *     incomplete) or any earlier round. Only provisional rounds (strictly after current)
 *     may redraw. Mirrors tests/fuzz/immutability.fuzz.cjs at team granularity.
 *  2. PARTNERS STAY FIXED — every match in every round pairs two intact registered teams;
 *     a team is never split.
 *  3. NO AVOIDABLE TEAM REMATCHES from a clean draw — for configs whose planned rounds fit
 *     inside the team round-robin, refillPlanned finds a rematch-free schedule.
 *
 *   Run:  node tests/fuzz/fixedpairs.fuzz.cjs [seeds]   (default 6000)
 *   Pass: "VIOLATIONS: 0"  (exit 0).
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
function loadEngine() {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
  const code = src.slice(src.indexOf('/*ENGINE-START*/'), src.indexOf('/*ENGINE-END*/'));
  const ctx = {}; vm.createContext(ctx); vm.runInContext(code + '\nthis.Engine=Engine;', ctx);
  return ctx.Engine;
}
const E = loadEngine();
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function curIdx(t){for(let i=0;i<t.rounds.length;i++){if(t.rounds[i].matches.some(m=>m.scoreA===null||m.scoreB===null))return i;}return t.rounds.length-1;}
function setKey(arr){return arr.slice().sort().join('|');}

const SEEDS = parseInt(process.argv[2], 10) || 6000;
const OPS = ['score','score','addTeam','removeTeam','reactivateTeam','setSkill','setCourts','setPlanned'];
const opCount = {}; OPS.forEach(o => opCount[o] = 0);
let violations = [], splitViolations = [], trajectories = 0, steps = 0;

for (let seed = 1; seed <= SEEDS; seed++) {
  const rng = mulberry32((seed * 2654435761) >>> 0);
  const nTeams = 2 + Math.floor(rng() * 5);          // 2..6 teams
  const courts = 1 + Math.floor(rng() * 3);          // 1..3
  const planned = 3 + Math.floor(rng() * 5);         // 3..7
  const useSkills = rng() < 0.5;
  const scoring = rng() < 0.5 ? 'rally' : 'games';
  const teams = [];
  for (let i = 0; i < nTeams; i++) {
    teams.push([
      useSkills ? { name: 'A' + i, skill: 1 + Math.floor(rng() * 3) } : 'A' + i,
      useSkills ? { name: 'B' + i, skill: 1 + Math.floor(rng() * 3) } : 'B' + i,
    ]);
  }
  if (nTeams < courts * 2) continue;                 // not enough teams for the courts
  let t;
  try { t = E.createTournament({ fixedPairs: true, teams, courts, plannedRounds: planned, useSkills, scoring, gamesTarget: 4, pointsPerMatch: 24 }); } catch (e) { continue; }
  try { E.refillPlanned(t, rng); } catch (e) { continue; }
  if (!t.rounds.length) continue;
  trajectories++;

  const registered = () => new Set(t.teams.map(tm => setKey(tm.players)));
  const checkNoSplit = () => {
    const reg = registered();
    for (const r of t.rounds) for (const m of r.matches) {
      if (!reg.has(setKey(m.teamA)) || !reg.has(setKey(m.teamB))) return false;
    }
    return true;
  };

  let added = 0; const removed = [];
  for (let step = 0; step < 22; step++) {
    const op = OPS[Math.floor(rng() * OPS.length)];
    if (op === 'score') {
      const ci = curIdx(t), r = t.rounds[ci], mi = r.matches.findIndex(m => m.scoreA === null || m.scoreB === null);
      if (mi < 0) continue;
      try { if (scoring === 'games') E.setScore(t, ci, mi, 4, Math.floor(rng() * 4)); else { const a = Math.floor(rng() * 25); E.setScore(t, ci, mi, a, 24 - a); } opCount.score++; steps++; } catch (e) {}
      continue;
    }
    const ciB = curIdx(t); const before = JSON.stringify(t.rounds.slice(0, ciB + 1)); let applied = false;
    try {
      if (op === 'addTeam') { if (added < 4) { const tm = E.addTeam(t, ['NA' + seed + '_' + step, 'NB' + seed + '_' + step], rng, useSkills ? [1 + Math.floor(rng() * 3), 1 + Math.floor(rng() * 3)] : undefined); removed.length; added++; applied = true; void tm; } }
      else if (op === 'removeTeam') { const a = E.activeTeams(t); if (a.length > 2) { const victim = a[Math.floor(rng() * a.length)]; E.removeTeam(t, victim.id, rng); removed.push(victim.id); applied = true; } }
      else if (op === 'reactivateTeam') { if (removed.length) { E.reactivateTeam(t, removed.pop(), rng); applied = true; } }
      else if (op === 'setSkill') { if (useSkills) { const ps = t.players.filter(p => p.active); if (ps.length) { E.setSkill(t, ps[Math.floor(rng() * ps.length)].id, 1 + Math.floor(rng() * 3), rng); applied = true; } } }
      else if (op === 'setCourts') { E.setCourts(t, 1 + Math.floor(rng() * 3), rng); applied = true; }
      else if (op === 'setPlanned') { E.setPlannedRounds(t, 1 + Math.floor(rng() * 8), rng); applied = true; }
    } catch (e) { continue; }   // a guard legitimately refused the change
    if (!applied) continue;
    opCount[op]++; steps++;
    if (JSON.stringify(t.rounds.slice(0, ciB + 1)) !== before) { violations.push({ seed, step, op, nTeams, courts, planned, useSkills, scoring }); break; }
    if (!checkNoSplit()) { splitViolations.push({ seed, step, op }); break; }
  }
}

// no-avoidable-rematch check on clean draws (configs that fit a round-robin)
function teamRepeats(t) {
  const owner = {}; t.teams.forEach(tm => tm.players.forEach(pid => owner[pid] = tm.id));
  const faced = {};
  for (const r of t.rounds) for (const m of r.matches) {
    const x = owner[m.teamA[0]], y = owner[m.teamB[0]], k = x < y ? x + '|' + y : y + '|' + x;
    faced[k] = (faced[k] || 0) + 1;
  }
  let extra = 0; for (const k in faced) if (faced[k] > 1) extra += faced[k] - 1;
  return extra;
}
let rematchBad = 0, rematchTested = 0;
// NB: configs must fit inside the team round-robin under the no-consecutive-sit-out rule.
// 4 teams/1 court (and 8/2c etc.) force two alternating groups, so they cap below a full
// round-robin — [4,1,2] is clean but [4,1,3] would force a rematch by design (see CLAUDE.md).
for (const [nTeams, courts, rounds] of [[4,2,3],[6,1,5],[6,3,5],[5,2,5],[4,1,2]]) {
  for (let s = 0; s < 200; s++) {
    const teams = Array.from({ length: nTeams }, (_, i) => ['A' + i, 'B' + i]);
    const t = E.createTournament({ fixedPairs: true, teams, courts, plannedRounds: rounds, pointsPerMatch: 24 });
    E.refillPlanned(t, mulberry32(s * 7 + nTeams * 1000 + courts));
    rematchTested++;
    if (teamRepeats(t) > 0) rematchBad++;
  }
}

console.log(`trajectories: ${trajectories}  op-steps: ${steps}`);
console.log('op coverage:', JSON.stringify(opCount));
console.log('IMMUTABILITY violations (played/current round changed):', violations.length);
violations.slice(0, 8).forEach(v => console.log('  e.g.', JSON.stringify(v)));
console.log('PARTNER-SPLIT violations (a team was split in a match):', splitViolations.length);
splitViolations.slice(0, 8).forEach(v => console.log('  e.g.', JSON.stringify(v)));
console.log(`REMATCH check: ${rematchBad}/${rematchTested} clean draws had avoidable team rematches`);
const fail = violations.length || splitViolations.length || rematchBad;
console.log(fail ? '\nFAIL' : '\nPASS: rounds on court never change, partners never split, clean draws are rematch-free.');
process.exit(fail ? 1 : 0);
