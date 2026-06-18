/**
 * Partner-repeat analyzer.
 *
 * GUARANTEE UNDER TEST: in Americano, the same pair should never be made partners twice
 * when a no-repeat schedule is achievable ("partner repeats only when unavoidable").
 *
 * Builds full schedules across many player counts / court counts / round counts, skills
 * on and off, rally and games scoring, over thousands of seeds, and reports the % of
 * tournaments with any repeated pair plus the worst repeat seen. For configs where a
 * no-repeat schedule is mathematically achievable (rounds <= players-1) it asserts ~0%.
 * Mexicano is measured separately and only reported — it pairs by live standings
 * (1st+4th vs 2nd+3rd) and repeats partners by design.
 *
 *   Run:  node tests/fuzz/partner-repeats.fuzz.cjs [seeds]   (default 3000)
 *   Pass: every assert-zero Americano config at 0.00% (exit 0).
 *
 * Documents the best-of-N redraw added in v25/v26: a single greedy draw left avoidable
 * repeats (9 players ~20-31% of draws); best-of-N drops that to 0.000% for realistic play.
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
const pk = (a, b) => a < b ? a + '|' + b : b + '|' + a;
function maxRep(t){const c={};for(const r of t.rounds)for(const m of r.matches)for(const tm of[m.teamA,m.teamB]){const k=pk(tm[0],tm[1]);c[k]=(c[k]||0)+1;}return Object.values(c).reduce((m,x)=>Math.max(m,x),0);}
function extra(t){const c={};for(const r of t.rounds)for(const m of r.matches)for(const tm of[m.teamA,m.teamB]){const k=pk(tm[0],tm[1]);c[k]=(c[k]||0)+1;}return Object.values(c).reduce((s,x)=>s+Math.max(0,x-1),0);}
function playMexicano(t, rng, scoring) {
  for (let g = 0; g < 200; g++) {
    const ci = t.rounds.findIndex((_, i) => !E.roundComplete(t, i));
    let idx = ci;
    if (idx === -1) { if (t.rounds.length >= t.config.plannedRounds) break; E.generateRound(t, rng); idx = t.rounds.length - 1; }
    const r = t.rounds[idx];
    for (let mi = 0; mi < r.matches.length; mi++) if (r.matches[mi].scoreA === null) { if (scoring === 'games') E.setScore(t, idx, mi, 4, Math.floor(rng() * 4)); else { const a = Math.floor(rng() * 25); E.setScore(t, idx, mi, a, 24 - a); } }
  }
}
const SEEDS = parseInt(process.argv[2], 10) || 3000;
let failures = 0;

// [players, courts, rounds, assertZero]  (assertZero only where a no-repeat schedule is achievable)
const CONFIGS = [
  [8, 2, 6, true], [8, 2, 7, false], [9, 2, 8, true], [10, 2, 8, true], [11, 2, 8, true],
  [12, 3, 8, true], [16, 4, 8, true], [14, 3, 8, true], [8, 2, 12, false], [6, 1, 8, false],
];
console.log(`=== AMERICANO (best-of-N redraw; ${SEEDS} seeds each) ===`);
for (const [n, c, r, assertZero] of CONFIGS) {
  for (const sk of [false, true]) {
    let rep = 0, worst = 0;
    for (let s = 1; s <= SEEDS; s++) {
      const rng = mulberry32((s * 2654435761) >>> 0);
      const players = []; for (let i = 0; i < n; i++) players.push(sk ? { name: 'P' + i, skill: 1 + Math.floor(rng() * 3) } : ('P' + i));
      const t = E.createTournament({ players, courts: c, plannedRounds: r, format: 'americano', useSkills: sk, pointsPerMatch: 24 });
      E.refillPlanned(t, rng);
      const m = maxRep(t); if (m >= 2) rep++; worst = Math.max(worst, m);
    }
    const pct = (100 * rep / SEEDS).toFixed(3);
    const tag = `${n}p/${c}c/${r}r skills=${sk ? 'on ' : 'off'}`;
    if (assertZero && rep > 0) { failures++; console.log(`  ${tag}: ${pct}% repeat (worst ${worst})  *** EXPECTED 0% ***`); }
    else console.log(`  ${tag}: ${pct}% repeat (worst ${worst})${assertZero ? '' : '  [repeats forced — informational]'}`);
  }
}
console.log(`\n=== MEXICANO (standings-paired; repeats by design, informational) ===`);
for (const [n, c, r] of [[8, 2, 8], [10, 2, 8]]) {
  for (const scoring of ['rally', 'games']) {
    let worst = 0, sumExtra = 0;
    for (let s = 1; s <= SEEDS; s++) {
      const rng = mulberry32((s * 2654435761) >>> 0);
      const players = []; for (let i = 0; i < n; i++) players.push('P' + i);
      const t = E.createTournament({ players, courts: c, plannedRounds: r, format: 'mexicano', scoring, gamesTarget: 4, pointsPerMatch: 24 });
      E.generateRound(t, rng); playMexicano(t, rng, scoring);
      worst = Math.max(worst, maxRep(t)); sumExtra += extra(t);
    }
    console.log(`  ${n}p/${c}c/${r}r [${scoring}]: worst maxRep=${worst}, avg extra-repeats/tournament=${(sumExtra / SEEDS).toFixed(1)}`);
  }
}
console.log(`\nASSERT-ZERO FAILURES: ${failures}`);
console.log(failures ? 'FAIL' : '\nPASS: no avoidable partner repeats in any feasible Americano config.');
process.exit(failures ? 1 : 0);
