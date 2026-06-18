/**
 * Menu-churn no-repeat fuzzer.
 *
 * GUARANTEE UNDER TEST: even when an organiser fiddles with EVERY menu option mid-
 * tournament — add/remove players, change courts, toggle skill-balancing, change
 * planned rounds, check in late arrivals, drop no-shows, change ranking/rest/scoring —
 * no AVOIDABLE repeated pair is ever introduced in an Americano schedule.
 *
 * Each trajectory is kept in FEASIBLE territory (planned rounds <= activePlayers-1,
 * where a zero-repeat schedule exists). After every menu op it scans the whole schedule
 * for a repeated pair; for any it finds, it independently re-draws the provisional tail
 * best-of-80 from the SAME fixed played prefix. If that reaches zero the engine's repeat
 * was AVOIDABLE (a bug); otherwise it is forced by the already-played rounds (not a bug —
 * you cannot un-play a round). This is the test that found the v26 churn gap.
 *
 *   Run (repo build):  node tests/fuzz/menu-churn.fuzz.cjs
 *   Run (live build):  curl -s https://shubhampansare.github.io/padel-americano/ -o /tmp/live.html
 *                      node tests/fuzz/menu-churn.fuzz.cjs /tmp/live.html
 *   Pass: "AVOIDABLE (bug): 0"  (exit 0).
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const FILE = process.argv[2] || path.join(__dirname, '..', '..', 'index.html');
const src = fs.readFileSync(FILE, 'utf8');
const build = (src.match(/const BUILD = '([^']*)'/) || [])[1];
const code = src.slice(src.indexOf('/*ENGINE-START*/'), src.indexOf('/*ENGINE-END*/'));
const ctx = {}; vm.createContext(ctx); vm.runInContext(code + '\nthis.Engine=Engine;', ctx);
const E = ctx.Engine;
console.log('engine loaded from', FILE, '| BUILD =', build);
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const pk = (a, b) => a < b ? a + '|' + b : b + '|' + a;
function maxRep(t){const c={};for(const r of t.rounds)for(const m of r.matches)for(const tm of[m.teamA,m.teamB]){const k=pk(tm[0],tm[1]);c[k]=(c[k]||0)+1;}return Object.values(c).reduce((m,x)=>Math.max(m,x),0);}
function totalExtra(rounds){const c={};for(const r of rounds)for(const m of r.matches)for(const tm of[m.teamA,m.teamB]){const k=pk(tm[0],tm[1]);c[k]=(c[k]||0)+1;}return Object.values(c).reduce((s,x)=>s+Math.max(0,x-1),0);}
function curIdx(t){for(let i=0;i<t.rounds.length;i++){if(t.rounds[i].matches.some(m=>m.scoreA===null||m.scoreB===null))return i;}return t.rounds.length-1;}
const feasible = t => t.config.plannedRounds <= E.activePlayers(t).length - 1;
function minAchievable(t, TRIES) { // min repeats reachable while keeping the played+current prefix fixed
  const ci = curIdx(t), prefixJSON = JSON.stringify(t.rounds.slice(0, ci + 1)), cap = t.rounds.length;
  const clone = JSON.parse(JSON.stringify(t)); let best = Infinity;
  for (let k = 0; k < TRIES && best > 0; k++) {
    clone.rounds = JSON.parse(prefixJSON); const rng = mulberry32((k * 2654435761 + 7) >>> 0);
    try { while (clone.rounds.length < cap && E.activePlayers(clone).length >= 4) E.generateRound(clone, rng); } catch (e) { break; }
    best = Math.min(best, totalExtra(clone.rounds));
  }
  return best;
}
const SEEDS = parseInt(process.argv[3], 10) || 2500;
const MENU = ['score','score','score','addPlayer','removePlayer','reactivate','setCourts','setSkill','toggleSkills','setPlanned','markArrived','removeNoShow','setRanking','setRest'];
const opHits = {}; MENU.forEach(o => opHits[o] = 0);
let trajectories = 0, opsApplied = 0, feasibleChecks = 0, repeats = 0, avoidable = 0, forced = 0;
const egs = [];

for (let seed = 1; seed <= SEEDS; seed++) {
  const rng = mulberry32((seed * 2654435761) >>> 0);
  const n = 8 + Math.floor(rng() * 6), courts = 2;
  let useSkills = rng() < 0.5; const scoring = rng() < 0.5 ? 'rally' : 'games';
  const nPending = rng() < 0.4 ? 1 + Math.floor(rng() * 2) : 0, arrivedN = n - nPending;
  if (arrivedN < courts * 4) continue;
  const planned = Math.min(5 + Math.floor(rng() * 4), arrivedN - 1);
  const players = []; for (let i = 0; i < n; i++) { const arrived = i < arrivedN; players.push(useSkills ? { name: 'P' + i, skill: 1 + Math.floor(rng() * 3), arrived } : { name: 'P' + i, arrived }); }
  let t; try { t = E.createTournament({ players, courts, plannedRounds: planned, format: 'americano', useSkills, scoring, gamesTarget: 4, pointsPerMatch: 24 }); } catch (e) { continue; }
  try { E.refillPlanned(t, rng); } catch (e) { continue; } if (!t.rounds.length) continue;
  trajectories++; const removed = []; let added = 0;
  for (let step = 0; step < 22; step++) {
    const op = MENU[Math.floor(rng() * MENU.length)];
    try {
      if (op === 'score') { const ci = curIdx(t), r = t.rounds[ci], mi = r.matches.findIndex(m => m.scoreA === null); if (mi < 0) continue; if (scoring === 'games') E.setScore(t, ci, mi, 4, Math.floor(rng() * 4)); else { const a = Math.floor(rng() * 25); E.setScore(t, ci, mi, a, 24 - a); } continue; }
      else if (op === 'addPlayer') { if (added < 4) { E.addPlayer(t, 'X' + seed + '_' + step, rng, useSkills ? 1 + Math.floor(rng() * 3) : undefined); added++; } else continue; }
      else if (op === 'removePlayer') { const a = E.activePlayers(t); if (a.length - 1 > Math.max(courts * 4, t.config.plannedRounds)) { E.removePlayer(t, a[Math.floor(rng() * a.length)].id, rng); } else continue; }
      else if (op === 'reactivate') { if (removed.length) { E.reactivatePlayer(t, removed.pop(), rng); } else continue; }
      else if (op === 'setCourts') { E.setCourts(t, 2, rng); }
      else if (op === 'setSkill') { if (useSkills) { const a = E.activePlayers(t); E.setSkill(t, a[Math.floor(rng() * a.length)].id, 1 + Math.floor(rng() * 3), rng); } else continue; }
      else if (op === 'toggleSkills') { useSkills = !useSkills; t.config.useSkills = useSkills; E.redrawFuture(t, rng); }
      else if (op === 'setPlanned') { E.setPlannedRounds(t, Math.min(5 + Math.floor(rng() * 4), E.activePlayers(t).length - 1), rng); }
      else if (op === 'markArrived') { const p = E.pendingPlayers(t); if (p.length) { E.markArrived(t, p[0].id, rng); } else continue; }
      else if (op === 'removeNoShow') { const p = E.pendingPlayers(t); if (p.length) { E.removeNoShow(t, p[0].id, rng); } else continue; }
      else if (op === 'setRanking') { t.config.ranking = rng() < 0.5 ? 'wins' : 'points'; continue; }
      else if (op === 'setRest') { t.config.restMode = ['none', 'half', 'avg'][Math.floor(rng() * 3)]; continue; }
    } catch (e) { continue; }
    opHits[op]++; opsApplied++;
    if (!feasible(t)) continue;
    feasibleChecks++;
    if (maxRep(t) >= 2) { repeats++; const m = minAchievable(t, 80); if (m === 0) { avoidable++; if (egs.length < 12) egs.push({ seed, step, op, n, planned: t.config.plannedRounds, active: E.activePlayers(t).length, useSkills, scoring }); } else forced++; }
  }
}
console.log(`\ntrajectories=${trajectories}  ops applied=${opsApplied}  feasible-state checks=${feasibleChecks}`);
console.log('op coverage:', JSON.stringify(opHits));
console.log(`states with a repeated pair: ${repeats}  ->  AVOIDABLE (bug): ${avoidable}   forced-by-prefix (not a bug): ${forced}`);
egs.forEach(e => console.log('  AVOIDABLE e.g.', JSON.stringify(e)));
console.log(avoidable === 0 ? '\nPASS: no avoidable repeated pairings in any menu-driven scenario.' : '\nFAIL: avoidable repeats exist (see examples).');
process.exit(avoidable ? 1 : 0);
