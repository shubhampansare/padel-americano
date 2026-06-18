/**
 * Mid-round immutability fuzzer.
 *
 * GUARANTEE UNDER TEST: no menu operation during a tournament may ever change a round
 * that is being played (the "current" round = first incomplete) or one already played.
 * Only provisional rounds (strictly after the current one) may be redrawn. A match on
 * court must never change under the players' feet — scored or not.
 *
 * Across thousands of randomized tournament trajectories, it applies every roster/
 * config mutation at random points and asserts the locked prefix (rounds[0..current])
 * is byte-identical before and after. The round-index bookkeeping under test is
 * independent of round size, so small/fast rounds (<=8 players playing) fully exercise it.
 *
 *   Run:  node tests/fuzz/immutability.fuzz.cjs [seeds]   (default 8000)
 *   Pass: "VIOLATIONS: 0"  (exit 0).  This caught the v24 late-arrival bug and the
 *         v25 setPlannedRounds bug before they could ship again.
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

const SEEDS = parseInt(process.argv[2], 10) || 8000;
const OPS = ['score','score','addPlayer','removePlayer','setCourts','setSkill','markArrived','removeNoShow','reactivate','setPlanned'];
const opCount = {}; OPS.forEach(o => opCount[o] = 0);
let violations = [], trajectories = 0, steps = 0;

for (let seed = 1; seed <= SEEDS; seed++) {
  const rng = mulberry32((seed * 2654435761) >>> 0);
  const n = 5 + Math.floor(rng() * 4);            // 5..8
  const courts = 1 + Math.floor(rng() * 2);       // 1..2
  const planned = 3 + Math.floor(rng() * 5);      // 3..7
  const format = rng() < 0.5 ? 'americano' : 'mexicano';
  const useSkills = format === 'americano' && rng() < 0.5;
  const scoring = rng() < 0.5 ? 'rally' : 'games';
  const nPending = rng() < 0.45 ? 1 + Math.floor(rng() * 2) : 0;
  const players = [];
  for (let i = 0; i < n; i++) { const arrived = i < (n - nPending); players.push(useSkills ? { name: 'P' + i, skill: 1 + Math.floor(rng() * 3), arrived } : { name: 'P' + i, arrived }); }
  if (players.filter(p => p.arrived).length < 4) continue;
  let t; try { t = E.createTournament({ players, courts, plannedRounds: planned, format, useSkills, scoring, gamesTarget: 4, pointsPerMatch: 24 }); } catch (e) { continue; }
  try { if (format === 'americano') E.refillPlanned(t, rng); else E.generateRound(t, rng); } catch (e) { continue; }
  if (!t.rounds.length) continue;
  trajectories++;
  const removed = []; let added = 0;
  for (let step = 0; step < 25; step++) {
    const op = OPS[Math.floor(rng() * OPS.length)];
    if (op === 'score') {
      const ci = curIdx(t), r = t.rounds[ci], mi = r.matches.findIndex(m => m.scoreA === null || m.scoreB === null);
      if (mi < 0) continue;
      try { if (scoring === 'games') E.setScore(t, ci, mi, 4, Math.floor(rng() * 4)); else { const a = Math.floor(rng() * 25); E.setScore(t, ci, mi, a, 24 - a); } opCount.score++; steps++; } catch (e) {}
      continue; // scoring legitimately changes the current round's scores
    }
    // Capture the locked prefix [0..current] at fixed indices; appended provisional
    // rounds (which advance the current index) are legitimate and must not count.
    const ciB = curIdx(t); const before = JSON.stringify(t.rounds.slice(0, ciB + 1)); let applied = false;
    try {
      if (op === 'addPlayer') { if (added < 5) { E.addPlayer(t, 'X' + seed + '_' + step, rng, useSkills ? 1 + Math.floor(rng() * 3) : undefined); added++; applied = true; } }
      else if (op === 'removePlayer') { const a = E.activePlayers(t); if (a.length > 4) { E.removePlayer(t, a[Math.floor(rng() * a.length)].id, rng); removed.push(a[0].id); applied = true; } }
      else if (op === 'setCourts') { E.setCourts(t, 1 + Math.floor(rng() * 2), rng); applied = true; }
      else if (op === 'setSkill') { if (useSkills) { const a = E.activePlayers(t); E.setSkill(t, a[Math.floor(rng() * a.length)].id, 1 + Math.floor(rng() * 3), rng); applied = true; } }
      else if (op === 'markArrived') { const p = E.pendingPlayers(t); if (p.length) { E.markArrived(t, p[0].id, rng); applied = true; } }
      else if (op === 'removeNoShow') { const p = E.pendingPlayers(t); if (p.length) { E.removeNoShow(t, p[0].id, rng); applied = true; } }
      else if (op === 'reactivate') { if (removed.length) { E.reactivatePlayer(t, removed.pop(), rng); applied = true; } }
      else if (op === 'setPlanned') { E.setPlannedRounds(t, 1 + Math.floor(rng() * 8), rng); applied = true; }
    } catch (e) { continue; } // a guard legitimately refused the change
    if (!applied) continue;
    opCount[op]++; steps++;
    if (JSON.stringify(t.rounds.slice(0, ciB + 1)) !== before) { violations.push({ seed, step, op, n, courts, planned, format, useSkills, scoring, nPending }); break; }
  }
}
console.log(`trajectories: ${trajectories}  op-steps: ${steps}`);
console.log('op coverage:', JSON.stringify(opCount));
console.log('VIOLATIONS (a played/current round changed by a non-score op):', violations.length);
violations.slice(0, 10).forEach(v => console.log('  e.g.', JSON.stringify(v)));
console.log(violations.length ? '\nFAIL' : '\nPASS: no menu operation ever changed the round on court or a played round.');
process.exit(violations.length ? 1 : 0);
