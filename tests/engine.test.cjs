/**
 * Engine simulation tests. Run: node tests/engine.test.cjs
 * Extracts the engine from index.html (shipped artifact) if present, else engine.js.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

function loadEngine() {
  const root = path.join(__dirname, '..');
  const candidates = ['index.html', 'engine.js'];
  for (const f of candidates) {
    const fp = path.join(root, f);
    if (!fs.existsSync(fp)) continue;
    const src = fs.readFileSync(fp, 'utf8');
    const start = src.indexOf('/*ENGINE-START*/');
    const end = src.indexOf('/*ENGINE-END*/');
    if (start === -1 || end === -1) continue;
    const code = src.slice(start, end);
    const ctx = {};
    vm.createContext(ctx);
    vm.runInContext(code + '\nthis.Engine = Engine;', ctx);
    console.log(`[engine loaded from ${f}]`);
    return ctx.Engine;
  }
  throw new Error('No engine found');
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

let failures = 0;
let checks = 0;
function ok(cond, msg) {
  checks++;
  if (!cond) { failures++; console.error('  FAIL: ' + msg); }
}

function names(n) { return Array.from({ length: n }, (_, i) => 'P' + (i + 1)); }

// Independent recompute of standings from raw match data.
// Rests only count up to the round being played (first incomplete round) —
// Americano pre-draws the full schedule and provisional rests must not count.
function recompute(t) {
  const s = {};
  for (const p of t.players) s[p.id] = { points: 0, played: 0, wins: 0, draws: 0, losses: 0, pf: 0, pa: 0, rests: 0 };
  let reached = t.rounds.findIndex(r => r.matches.some(m => m.scoreA === null || m.scoreB === null));
  if (reached === -1) reached = t.rounds.length - 1;
  for (let ri = 0; ri < t.rounds.length; ri++) {
    const r = t.rounds[ri];
    if (ri <= reached) for (const pid of r.resting) s[pid].rests++;
    for (const m of r.matches) {
      if (m.scoreA === null) continue;
      for (const pid of m.teamA) {
        s[pid].points += m.scoreA; s[pid].pf += m.scoreA; s[pid].pa += m.scoreB; s[pid].played++;
        if (m.scoreA > m.scoreB) s[pid].wins++; else if (m.scoreA === m.scoreB) s[pid].draws++; else s[pid].losses++;
      }
      for (const pid of m.teamB) {
        s[pid].points += m.scoreB; s[pid].pf += m.scoreB; s[pid].pa += m.scoreA; s[pid].played++;
        if (m.scoreB > m.scoreA) s[pid].wins++; else if (m.scoreB === m.scoreA) s[pid].draws++; else s[pid].losses++;
      }
    }
  }
  return s;
}

function randomScore(t, rng) {
  const N = t.config.pointsPerMatch;
  if (t.config.scoreEntry === 'combined') {
    const a = Math.floor(rng() * (N + 1));
    return [a, N - a];
  }
  return [Math.floor(rng() * 22), Math.floor(rng() * 22)];
}

function checkRoundStructure(t, round, label) {
  const active = E.activePlayers(t).length;
  const cu = Math.max(1, Math.min(t.config.courts, Math.floor(active / 4)));
  ok(round.matches.length === cu, `${label}: matches=${round.matches.length} expected ${cu}`);
  ok(round.resting.length === active - cu * 4, `${label}: resting=${round.resting.length} expected ${active - cu * 4}`);
  const seen = new Set();
  for (const pid of round.resting) { ok(!seen.has(pid), `${label}: dup rester`); seen.add(pid); }
  for (const m of round.matches) {
    for (const pid of m.teamA.concat(m.teamB)) { ok(!seen.has(pid), `${label}: player in two places`); seen.add(pid); }
    ok(m.teamA.length === 2 && m.teamB.length === 2, `${label}: team sizes`);
  }
  ok(seen.size === active, `${label}: round covers all active players (${seen.size}/${active})`);
}

// ---------------------------------------------------------------- main sweep
console.log('\n== Sweep: players 4-14, courts 1-3, both formats, 12 rounds, seeded ==');
for (const format of ['americano', 'mexicano']) {
  for (let players = 4; players <= 14; players++) {
    for (let courts = 1; courts <= 3; courts++) {
      const rng = mulberry32(players * 1000 + courts * 100 + (format === 'mexicano' ? 7 : 0));
      const t = E.createTournament({
        players: names(players), courts, format,
        pointsPerMatch: 24, scoreEntry: 'combined', plannedRounds: 12,
      });
      const label = `${format} p${players} c${courts}`;
      let prevResting = new Set();
      for (let r = 0; r < 12; r++) {
        const round = E.generateRound(t, rng);
        checkRoundStructure(t, round, `${label} r${r + 1}`);
        // no consecutive rests when feasible
        const active = E.activePlayers(t).length;
        const need = round.resting.length;
        if (active - prevResting.size >= need) {
          for (const pid of round.resting) {
            ok(!prevResting.has(pid), `${label} r${r + 1}: consecutive rest for ${pid}`);
          }
        }
        prevResting = new Set(round.resting);
        for (let mi = 0; mi < round.matches.length; mi++) {
          const [a, b] = randomScore(t, rng);
          E.setScore(t, r, mi, a, b);
        }
      }
      // fairness spreads
      const { rests, games, partner } = E.historyCounts(t);
      const g = Object.values(games), rs = Object.values(rests);
      const gSpread = Math.max(...g) - Math.min(...g);
      const rSpread = Math.max(...rs) - Math.min(...rs);
      ok(gSpread <= 2, `${label}: games spread ${gSpread} > 2 (games=${g.join(',')})`);
      ok(rSpread <= 2, `${label}: rest spread ${rSpread} > 2`);
      // standings vs recompute
      const ours = E.standings(t);
      const ref = recompute(t);
      for (const row of ours) {
        const r2 = ref[row.player.id];
        ok(row.points === r2.points && row.played === r2.played && row.wins === r2.wins &&
          row.draws === r2.draws && row.losses === r2.losses && row.pf === r2.pf &&
          row.pa === r2.pa && row.rests === r2.rests && row.diff === r2.pf - r2.pa,
          `${label}: standings mismatch for ${row.player.name}`);
      }
      // ordering: points desc, then diff, then wins, then name
      for (let i = 1; i < ours.length; i++) {
        const a = ours[i - 1], b = ours[i];
        const cmp = (b.points - a.points) || (b.diff - a.diff) || (b.wins - a.wins) ||
          a.player.name.localeCompare(b.player.name);
        ok(cmp <= 0, `${label}: standings out of order at ${i}`);
      }
      if (format === 'americano' && players === 10 && courts === 2) {
        const maxPartner = Math.max(...Object.values(partner));
        ok(maxPartner <= 2, `${label}: a pair partnered ${maxPartner} times in 12 rounds`);
      }
    }
  }
}

// -------------------------------------------------- the user's exact scenario
console.log('== Scenario: 10 players, 2 courts, 8 rounds (the 2h session) ==');
{
  const agg = { maxPartner: 0, partnerRepeats: 0, gSpread: 0, rSpread: 0, consec: 0, uniquePartners: [] };
  for (let trial = 0; trial < 200; trial++) {
    const rng = mulberry32(424242 + trial);
    const t = E.createTournament({ players: names(10), courts: 2, pointsPerMatch: 24 });
    let prev = new Set();
    for (let r = 0; r < 8; r++) {
      const round = E.generateRound(t, rng);
      for (const pid of round.resting) if (prev.has(pid)) agg.consec++;
      prev = new Set(round.resting);
      for (let mi = 0; mi < round.matches.length; mi++) {
        const [a, b] = randomScore(t, rng); E.setScore(t, r, mi, a, b);
      }
    }
    const { rests, games, partner } = E.historyCounts(t);
    const g = Object.values(games), rs = Object.values(rests);
    agg.gSpread = Math.max(agg.gSpread, Math.max(...g) - Math.min(...g));
    agg.rSpread = Math.max(agg.rSpread, Math.max(...rs) - Math.min(...rs));
    const counts = Object.values(partner);
    agg.maxPartner = Math.max(agg.maxPartner, ...counts);
    agg.partnerRepeats += counts.filter(c => c > 1).length;
    // unique partners per player
    const per = {};
    for (const k of Object.keys(partner)) for (const pid of k.split('|')) per[pid] = (per[pid] || 0) + 1;
    agg.uniquePartners.push(...Object.values(per));
  }
  ok(agg.consec === 0, `consecutive rests happened ${agg.consec} times across 200 trials`);
  ok(agg.gSpread <= 1, `games-played spread ${agg.gSpread} > 1`);
  ok(agg.rSpread <= 1, `rest spread ${agg.rSpread} > 1`);
  ok(agg.maxPartner <= 2, `some pair partnered ${agg.maxPartner} times in 8 rounds`);
  const avgUnique = agg.uniquePartners.reduce((a, b) => a + b, 0) / agg.uniquePartners.length;
  console.log(`  stats: max partner-repeat count=${agg.maxPartner}, pairs repeated per trial=${(agg.partnerRepeats / 200).toFixed(2)}, avg unique partners/player=${avgUnique.toFixed(2)} (max possible ~6.4 games)`);
}

// ------------------------------------------------------------------ mexicano
console.log('== Mexicano: standings-based draws (1st+4th vs 2nd+3rd) ==');
{
  const rng = mulberry32(777);
  const t = E.createTournament({ players: names(10), courts: 2, format: 'mexicano', pointsPerMatch: 24 });
  for (let r = 0; r < 6; r++) {
    const before = E.standings(t).map(s => s.player.id);
    const round = E.generateRound(t, rng);
    if (r > 0) {
      const restSet = new Set(round.resting);
      const ranked = before.filter(pid => !restSet.has(pid));
      for (let c = 0; c < round.matches.length; c++) {
        const grp = ranked.slice(c * 4, c * 4 + 4);
        const m = round.matches[c];
        const teamASorted = m.teamA.slice().sort(), expectA = [grp[0], grp[3]].sort();
        const teamBSorted = m.teamB.slice().sort(), expectB = [grp[1], grp[2]].sort();
        ok(JSON.stringify(teamASorted) === JSON.stringify(expectA) &&
          JSON.stringify(teamBSorted) === JSON.stringify(expectB),
          `mexicano r${r + 1} court ${c}: expected ${expectA}/${expectB} got ${teamASorted}/${teamBSorted}`);
      }
    }
    for (let mi = 0; mi < round.matches.length; mi++) {
      const [a, b] = randomScore(t, rng); E.setScore(t, r, mi, a, b);
    }
  }
}

// ------------------------------------------------------------ score validation
console.log('== Score validation ==');
{
  const rng = mulberry32(5);
  const t = E.createTournament({ players: names(8), courts: 2, pointsPerMatch: 24 });
  E.generateRound(t, rng);
  assert.throws(() => E.setScore(t, 0, 0, 10, 10), /add up to 24/);
  assert.throws(() => E.setScore(t, 0, 0, -1, 25), /non-negative/);
  assert.throws(() => E.setScore(t, 0, 0, 1.5, 22.5), /whole numbers/);
  E.setScore(t, 0, 0, 14, 10);
  ok(t.rounds[0].matches[0].scoreA === 14, 'combined score set');
  E.clearScore(t, 0, 0);
  ok(t.rounds[0].matches[0].scoreA === null, 'score cleared');
  ok(!E.roundComplete(t, 0), 'round not complete after clear');
  E.setScore(t, 0, 0, 24, 0);
  E.setScore(t, 0, 1, 12, 12);
  ok(E.roundComplete(t, 0), 'round complete');
  // draws count as draws
  const st = E.standings(t);
  const drawers = st.filter(s => s.draws === 1);
  ok(drawers.length === 4, 'four players have a draw');

  const tf = E.createTournament({ players: names(8), courts: 2, scoreEntry: 'free', pointsPerMatch: 24 });
  E.generateRound(tf, rng);
  E.setScore(tf, 0, 0, 31, 2); // free mode: any non-negatives
  ok(tf.rounds[0].matches[0].scoreA === 31, 'free score set');
}

// ------------------------------------------------------------------ tie-breaks
console.log('== Tie-breakers ==');
{
  // craft: A&B beat C&D 20-4; C&D beat A&B... use 4 players, 1 court, 3 rounds
  const rng = mulberry32(9);
  const t = E.createTournament({ players: ['Ana', 'Bob', 'Cyd', 'Dan'], courts: 1, pointsPerMatch: 24 });
  // round 1: force pairs by writing round directly (engine output order unknown)
  t.rounds.push({ matches: [{ court: 0, teamA: [t.players[0].id, t.players[1].id], teamB: [t.players[2].id, t.players[3].id], scoreA: 20, scoreB: 4 }], resting: [] });
  t.rounds.push({ matches: [{ court: 0, teamA: [t.players[0].id, t.players[2].id], teamB: [t.players[1].id, t.players[3].id], scoreA: 12, scoreB: 12 }], resting: [] });
  const st = E.standings(t);
  // Ana: 32 pts, Bob: 32 pts, diff Ana = (20-4)+(12-12)=16, Bob = 16+0=16 -> wins: Ana 1 Bob 1 -> name: Ana first
  ok(st[0].player.name === 'Ana' && st[1].player.name === 'Bob', 'name tiebreak Ana before Bob');
  ok(st[0].points === 32 && st[1].points === 32, 'tied points computed');
  // wins-first ranking mode
  const t2 = E.createTournament({ players: ['Ana', 'Bob', 'Cyd', 'Dan'], courts: 1, ranking: 'wins', pointsPerMatch: 24 });
  t2.rounds.push({ matches: [{ court: 0, teamA: [t2.players[0].id, t2.players[1].id], teamB: [t2.players[2].id, t2.players[3].id], scoreA: 13, scoreB: 11 }], resting: [] });
  t2.rounds.push({ matches: [{ court: 0, teamA: [t2.players[2].id, t2.players[3].id], teamB: [t2.players[0].id, t2.players[1].id], scoreA: 0, scoreB: 24 }], resting: [] });
  const st2 = E.standings(t2);
  ok(st2[0].wins === 2, 'wins-first puts 2-win players on top');
}

// ------------------------------------------------------------- roster changes
console.log('== Roster changes mid-tournament ==');
{
  const rng = mulberry32(31337);
  const t = E.createTournament({ players: names(9), courts: 2, pointsPerMatch: 24, plannedRounds: 6 });
  E.refillPlanned(t, rng);
  ok(t.rounds.length === 6, 'prefilled to planned');
  // round 0 played & scored -> round 1 is now the current round and stays frozen;
  // the new player joins from the next provisional round (index 2) onward.
  for (let mi = 0; mi < 2; mi++) { const [a, b] = randomScore(t, rng); E.setScore(t, 0, mi, a, b); }
  const curSnap = JSON.stringify(t.rounds[1]);
  const p10 = E.addPlayer(t, 'P10', rng);
  ok(t.rounds.length === 6, 'refilled to planned after add');
  ok(JSON.stringify(t.rounds[1]) === curSnap, 'current round frozen by addPlayer');
  const r3 = t.rounds[2];
  const inRound = new Set(r3.resting.concat(r3.matches.flatMap(m => m.teamA.concat(m.teamB))));
  ok(inRound.has(p10.id), 'new player included from the next provisional round');
  ok(inRound.size === 10, 'redrawn provisional round covers 10 players');
  checkRoundStructure(t, r3, 'after addPlayer');

  // remove a player -> excluded from redrawn provisional rounds, kept in standings.
  // Score round 1 (the frozen current round) so the current round advances to index 2,
  // which is then frozen; the removal lands in the provisional rounds after it.
  for (let mi = 0; mi < t.rounds[1].matches.length; mi++) { const [a, b] = randomScore(t, rng); E.setScore(t, 1, mi, a, b); }
  const victim = E.activePlayers(t)[0];
  E.removePlayer(t, victim.id, rng);
  const r4 = t.rounds[3];
  const inR4 = new Set(r4.resting.concat(r4.matches.flatMap(m => m.teamA.concat(m.teamB))));
  ok(!inR4.has(victim.id), 'removed player not in redrawn provisional round');
  ok(E.standings(t).some(s => s.player.id === victim.id), 'removed player still in standings');
  checkRoundStructure(t, r4, 'after removePlayer');

  // guard: cannot drop below 4 active
  const t4 = E.createTournament({ players: names(4), courts: 1 });
  assert.throws(() => E.removePlayer(t4, t4.players[0].id, rng), /at least 4/);
}

// ----------------------------------- late arrivals never reshuffle a played round
// Regression: checking a latecomer in must not change the round already on court,
// even when its score has not been entered yet. The in-progress round (first
// incomplete) and every earlier round are frozen; only later provisional rounds
// redraw. (The bug: redrawFuture treated any *unscored* trailing round as
// provisional, so a played-but-unscored round got dropped and redrawn.)
console.log('== Late arrivals freeze the round being played ==');
{
  const rng = mulberry32(7);
  // 5 here + 1 pending, 1 court, 6 planned -> capped at 2 rounds while pending.
  const t = E.createTournament({
    players: ['P1', 'P2', 'P3', 'P4', 'P5', { name: 'Late', arrived: false }],
    courts: 1, pointsPerMatch: 24, plannedRounds: 6,
  });
  E.refillPlanned(t, rng);
  ok(t.rounds.length === 2, 'capped at 2 rounds while a player is pending');
  const lateId = t.players.find(p => p.name === 'Late').id;

  // Round 1 was played on court but is NOT scored yet, then the latecomer checks in.
  const round0 = JSON.stringify(t.rounds[0]);
  E.markArrived(t, lateId, rng);
  ok(JSON.stringify(t.rounds[0]) === round0, 'check-in leaves the in-progress (unscored) round untouched');
  const r0ids = new Set(t.rounds[0].resting.concat(t.rounds[0].matches.flatMap(m => m.teamA.concat(m.teamB))));
  ok(!r0ids.has(lateId), 'latecomer not forced into the round already being played');

  // Cap lifts once nobody is pending -> schedule refills to planned, latecomer included.
  ok(t.rounds.length === 6, 'schedule refills to planned once nobody is pending');
  const r1ids = new Set(t.rounds[1].resting.concat(t.rounds[1].matches.flatMap(m => m.teamA.concat(m.teamB))));
  ok(r1ids.has(lateId), 'latecomer joins from the next (provisional) round');
  for (let i = 1; i < t.rounds.length; i++) checkRoundStructure(t, t.rounds[i], `post check-in r${i + 1}`);

  // The played round's score can still be entered afterwards.
  E.setScore(t, 0, 0, 14, 10);
  ok(t.rounds[0].matches[0].scoreA === 14, 'played round stays scorable after a late check-in');
}

// ----------------------------------- bare check-in freezes the current round too
// After a round is scored, the next-up round becomes the current round. A bare
// markArrived still freezes it (we can't tell "about to play" from "just played");
// the UI folds latecomers into it with an explicit re-draw (the post-round prompt).
console.log('== Bare check-in freezes current round; explicit re-draw folds in ==');
{
  const rng = mulberry32(11);
  const t = E.createTournament({
    players: ['A', 'B', 'C', 'D', 'E', 'F', 'G', { name: 'Z', arrived: false }],
    courts: 1, pointsPerMatch: 24, plannedRounds: 6,
  });
  E.refillPlanned(t, rng);
  E.setScore(t, 0, 0, 14, 10);          // round 0 complete -> current round is index 1
  const zId = t.players.find(p => p.name === 'Z').id;
  const cur = JSON.stringify(t.rounds[1]);
  E.markArrived(t, zId, rng);
  ok(JSON.stringify(t.rounds[1]) === cur, 'bare check-in freezes the current (next-up) round too');
  E.regenerateRound(t, 1, rng);          // explicit re-draw (the inter-prompt path)
  const ids = new Set(t.rounds[1].resting.concat(t.rounds[1].matches.flatMap(m => m.teamA.concat(m.teamB))));
  ok(ids.has(zId), 'explicit re-draw of the current round includes the latecomer');
}

// --------------------------- shrinking the plan never drops the round being played
// Regression: setPlannedRounds trimmed trailing rounds by anyScores, so dropping
// the plan below the round on court (an unscored "current" round) deleted it — the
// same class as the late-arrival bug, reachable from the Planned-rounds stepper.
console.log('== setPlannedRounds keeps the current round ==');
{
  const rng = mulberry32(77);
  const t = E.createTournament({ players: names(8), courts: 2, pointsPerMatch: 24, plannedRounds: 6 });
  E.refillPlanned(t, rng);
  // play & score rounds 0 and 1 -> round 2 is the current (unscored) round on court
  for (let r = 0; r < 2; r++) for (let mi = 0; mi < 2; mi++) E.setScore(t, r, mi, 14, 10);
  const curIdx = t.rounds.findIndex((_, i) => !E.roundComplete(t, i));
  ok(curIdx === 2, 'current round is index 2');
  const curSnap = JSON.stringify(t.rounds[2]);
  // shrink the plan below the current round number — must NOT drop the round on court
  const n = E.setPlannedRounds(t, 1, rng);
  ok(t.rounds.length >= 3, 'current round not trimmed away (length ' + t.rounds.length + ')');
  ok(JSON.stringify(t.rounds[2]) === curSnap, 'round being played is untouched by shrinking the plan');
  ok(n >= 3 && t.config.plannedRounds >= 3, 'plan cannot drop below the current round');
  // and trailing provisional rounds CAN still be trimmed
  const rng2 = mulberry32(78);
  const t2 = E.createTournament({ players: names(8), courts: 2, pointsPerMatch: 24, plannedRounds: 6 });
  E.refillPlanned(t2, rng2);
  E.setScore(t2, 0, 0, 14, 10); E.setScore(t2, 0, 1, 14, 10); // round 0 done, current = 1
  E.setPlannedRounds(t2, 3, rng2);
  ok(t2.rounds.length === 3, 'provisional rounds after the current one still trim to plan');
}

// ------------------------------- no avoidable partner repeats (best-of-N redraw)
// The greedy per-round matcher occasionally left an avoidable repeat (RNG bad luck),
// worst with odd/sit-out counts (9p ≈ 20-31% of draws). refillPlanned now draws the
// schedule several times and keeps the fewest-repeat one — a no-repeat schedule is
// always findable here, so we assert zero repeats across many seeds.
console.log('== Americano: no avoidable partner repeats ==');
{
  const pkey = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
  function maxPartnerRep(t) {
    const c = {};
    for (const r of t.rounds) for (const m of r.matches) for (const tm of [m.teamA, m.teamB]) {
      const k = pkey(tm[0], tm[1]); c[k] = (c[k] || 0) + 1;
    }
    return Object.values(c).reduce((m, x) => Math.max(m, x), 0);
  }
  for (const [n, courts, rounds, label] of [[9, 2, 8, '9p/2c/8r'], [10, 2, 8, '10p/2c/8r'], [8, 2, 7, '8p/2c/7r']]) {
    let withRepeat = 0;
    for (let s = 1; s <= 150; s++) {
      const rng = mulberry32((s * 2654435761) >>> 0);
      const t = E.createTournament({ players: names(n), courts, plannedRounds: rounds, pointsPerMatch: 24 });
      E.refillPlanned(t, rng);
      if (maxPartnerRep(t) >= 2) withRepeat++;
    }
    ok(withRepeat === 0, `${label}: ${withRepeat}/150 schedules had a repeated pair (want 0)`);
  }
  // skills on must also stay repeat-free in a tight group
  let skRepeat = 0;
  for (let s = 1; s <= 150; s++) {
    const rng = mulberry32((s * 40503) >>> 0);
    const t = E.createTournament({ players: names(9).map(nm => ({ name: nm, skill: 1 + (s + nm.length) % 3 })), courts: 2, useSkills: true, plannedRounds: 8, pointsPerMatch: 24 });
    E.refillPlanned(t, rng);
    if (maxPartnerRep(t) >= 2) skRepeat++;
  }
  ok(skRepeat === 0, `9p/2c/8r skills-on: ${skRepeat}/150 had a repeated pair (want 0)`);
}

// ------------------------------------------- skill change redraws provisionals
console.log('== Skill change redraws provisional rounds ==');
{
  const rng = mulberry32(444);
  const t = E.createTournament({
    players: names(10).map(n => ({ name: n, skill: 2 })),
    courts: 2, useSkills: true, plannedRounds: 8,
  });
  E.refillPlanned(t, rng);
  for (let mi = 0; mi < 2; mi++) E.setScore(t, 0, mi, 14, 10);
  const playedSnap = JSON.stringify(t.rounds[0]);
  const futureSnap = JSON.stringify(t.rounds.slice(1));
  E.setSkill(t, t.players[0].id, 3, rng);
  ok(t.rounds.length === 8, 'skill change keeps planned count');
  ok(JSON.stringify(t.rounds[0]) === playedSnap, 'played round untouched by skill change');
  ok(JSON.stringify(t.rounds.slice(1)) !== futureSnap, 'future rounds redrawn on skill change');
  for (let i = 1; i < 8; i++) checkRoundStructure(t, t.rounds[i], `post-skill r${i + 1}`);
}

// --------------------------------------------------------------- regeneration
console.log('== Regenerate rounds (americano: from idx onward) ==');
{
  const rng = mulberry32(99);
  const t = E.createTournament({ players: names(10), courts: 2, plannedRounds: 8 });
  E.refillPlanned(t, rng);
  E.regenerateRound(t, 0, rng);
  ok(t.rounds.length === 8, 'full redraw keeps planned count');
  for (let i = 0; i < 8; i++) checkRoundStructure(t, t.rounds[i], `full redraw r${i + 1}`);
  E.setScore(t, 0, 0, 12, 12);
  assert.throws(() => E.regenerateRound(t, 0, rng), /scores/);
  // redraw from round 3 onward: rounds 1-2 (incl. the score) untouched
  const r1snap = JSON.stringify(t.rounds[0]);
  const r2snap = JSON.stringify(t.rounds[1]);
  E.regenerateRound(t, 2, rng);
  ok(t.rounds.length === 8, 'partial redraw refills to planned');
  ok(JSON.stringify(t.rounds[0]) === r1snap && JSON.stringify(t.rounds[1]) === r2snap,
    'earlier rounds untouched by partial redraw');
  ok(t.rounds[0].matches[0].scoreA === 12, 'score preserved through redraw');

  // mexicano: regenerate stays single-round
  const tm = E.createTournament({ players: names(8), courts: 2, format: 'mexicano' });
  E.generateRound(tm, rng);
  E.regenerateRound(tm, 0, rng);
  ok(tm.rounds.length === 1, 'mexicano regenerate keeps single pending round');
}

// ------------------------------------------------------- future-score locking
console.log('== Future rounds cannot be scored ==');
{
  const rng = mulberry32(123);
  const t = E.createTournament({ players: names(8), courts: 2, plannedRounds: 4 });
  E.refillPlanned(t, rng);
  assert.throws(() => E.setScore(t, 2, 0, 14, 10), /Finish round 1 first/);
  E.setScore(t, 0, 0, 14, 10);
  assert.throws(() => E.setScore(t, 1, 0, 14, 10), /Finish round 1 first/); // r1 only half done
  E.setScore(t, 0, 1, 10, 14);
  E.setScore(t, 1, 0, 14, 10); // now allowed
  E.setScore(t, 1, 1, 12, 12);
  // corrections to completed earlier rounds stay allowed
  E.setScore(t, 0, 0, 20, 4);
  ok(t.rounds[0].matches[0].scoreA === 20, 'editing a completed past round still works');
}

// -------------------------------------------------- rename / rejoin / courts
console.log('== Rename, rejoin, change courts (with provisional refill) ==');
{
  const rng = mulberry32(2024);
  const t = E.createTournament({ players: names(10), courts: 2, pointsPerMatch: 24, plannedRounds: 8 });
  E.refillPlanned(t, rng);
  ok(t.rounds.length === 8, 'americano pre-draws all planned rounds');
  for (let i = 0; i < 8; i++) checkRoundStructure(t, t.rounds[i], `prefill r${i + 1}`);

  // rename (never redraws)
  const snapshot = JSON.stringify(t.rounds);
  E.renamePlayer(t, t.players[0].id, 'Zlatan');
  ok(t.players[0].name === 'Zlatan', 'rename applied');
  ok(JSON.stringify(t.rounds) === snapshot, 'rename does not redraw rounds');
  assert.throws(() => E.renamePlayer(t, t.players[1].id, 'zlatan'), /already in use/);
  assert.throws(() => E.renamePlayer(t, t.players[1].id, '  '), /Name required/);

  // future rounds are locked for scoring
  assert.throws(() => E.setScore(t, 1, 0, 14, 10), /Finish round 1 first/);
  for (let mi = 0; mi < 2; mi++) E.setScore(t, 0, mi, 14, 10);
  E.setScore(t, 1, 0, 14, 10); // round 1 complete -> round 2 scorable now
  E.clearScore(t, 1, 0);

  // round 0 played & scored, round 1 (current) frozen -> changes land in provisional rounds 3..8
  // remove someone -> the current round stays put; provisional rounds redraw without them
  const out = E.activePlayers(t)[3];
  E.removePlayer(t, out.id, rng);
  ok(t.rounds.length === 8, 'still filled to planned after removal');
  for (let i = 2; i < 8; i++) {
    const ids = new Set(t.rounds[i].resting.concat(t.rounds[i].matches.flatMap(m => m.teamA.concat(m.teamB))));
    ok(!ids.has(out.id), `removed player absent from redrawn provisional round ${i + 1}`);
    checkRoundStructure(t, t.rounds[i], `after remove r${i + 1}`);
  }
  // rejoin -> provisional rounds redraw to include them again
  E.reactivatePlayer(t, out.id, rng);
  ok(t.rounds.length === 8, 'still filled to planned after rejoin');
  const inR3 = new Set(t.rounds[2].resting.concat(t.rounds[2].matches.flatMap(m => m.teamA.concat(m.teamB))));
  ok(inR3.has(out.id), 'rejoined player back in the next provisional draw');

  // change courts mid-tournament: provisional rounds use 1 court; played & current rounds untouched
  E.setCourts(t, 1, rng);
  ok(t.rounds.length === 8, 'filled to planned after court change');
  ok(t.rounds[2].matches.length === 1 && t.rounds[2].resting.length === 6, 'court change applied to next provisional round');
  ok(t.rounds[0].matches.length === 2, 'played round untouched by court change');
  ok(t.rounds[1].matches.length === 2, 'current round untouched by court change');
  assert.throws(() => E.setCourts(t, 0, rng), /1-6/);

  // shrinking/growing the plan trims/refills unplayed rounds only
  E.setPlannedRounds(t, 5, rng);
  ok(t.rounds.length === 5 && t.config.plannedRounds === 5, 'plan shrunk to 5');
  E.setPlannedRounds(t, 9, rng);
  ok(t.rounds.length === 9 && t.config.plannedRounds === 9, 'plan grown to 9');
  ok(E.setPlannedRounds(t, 0, rng) >= 1, 'plan never below played rounds');
}

// ------------------------------------------------ mexicano stays lazy
console.log('== Mexicano roster change keeps lazy draws ==');
{
  const rng = mulberry32(606);
  const t = E.createTournament({ players: names(9), courts: 2, format: 'mexicano', pointsPerMatch: 24 });
  E.generateRound(t, rng);
  E.refillPlanned(t, rng);
  ok(t.rounds.length === 1, 'refillPlanned is a no-op for mexicano');
  for (let mi = 0; mi < 2; mi++) E.setScore(t, 0, mi, 14, 10);
  E.generateRound(t, rng); // round 2 (index 1) drawn — now the current round
  const curSnap = JSON.stringify(t.rounds[1]);
  const p10 = E.addPlayer(t, 'P10', rng);
  ok(t.rounds.length === 2, 'mexicano: no prefill, current round kept');
  ok(JSON.stringify(t.rounds[1]) === curSnap, 'mexicano: current round frozen by addPlayer');
  const ids = new Set(t.rounds[1].resting.concat(t.rounds[1].matches.flatMap(m => m.teamA.concat(m.teamB))));
  ok(!ids.has(p10.id), 'mexicano: new player not forced into the current round');
  // they join the next lazily-drawn round instead
  for (let mi = 0; mi < t.rounds[1].matches.length; mi++) E.setScore(t, 1, mi, 14, 10);
  E.generateRound(t, rng);
  const ids3 = new Set(t.rounds[2].resting.concat(t.rounds[2].matches.flatMap(m => m.teamA.concat(m.teamB))));
  ok(ids3.has(p10.id), 'mexicano: new player joins the next drawn round');
  checkRoundStructure(t, t.rounds[2], 'mexicano after addPlayer');
}

// ---------------------------------------------------------- rest compensation
console.log('== Rest compensation ==');
{
  const rng = mulberry32(555);
  const t = E.createTournament({ players: names(5), courts: 1, pointsPerMatch: 24, restPoints: 12 });
  for (let r = 0; r < 5; r++) {
    E.generateRound(t, rng);
    E.setScore(t, r, 0, 14, 10);
  }
  const st = E.standings(t);
  for (const s of st) {
    const raw = s.pf; // points actually scored
    ok(s.points === raw + s.rests * 12, `rest comp: ${s.player.name} points=${s.points} expected ${raw + s.rests * 12}`);
  }
  // off by default
  const t2 = E.createTournament({ players: names(5), courts: 1, pointsPerMatch: 24 });
  E.generateRound(t2, rng);
  E.setScore(t2, 0, 0, 24, 0);
  const resterId = t2.rounds[0].resting[0];
  const row = E.standings(t2).find(s => s.player.id === resterId);
  ok(row.points === 0, 'no compensation by default');

  // restMode 'half' === legacy restPoints behaviour
  const th = E.createTournament({ players: names(5), courts: 1, pointsPerMatch: 24, restMode: 'half' });
  for (let r = 0; r < 5; r++) { E.generateRound(th, rng); E.setScore(th, r, 0, 14, 10); }
  for (const s of E.standings(th)) {
    ok(s.points === s.pf + s.rests * 12, `restMode half: ${s.player.name} ${s.points} != ${s.pf + s.rests * 12}`);
  }

  // restMode 'avg': each rest credits the player's own points-per-game;
  // zero-game resters fall back to half the match total
  const ta = E.createTournament({ players: names(5), courts: 1, pointsPerMatch: 24, restMode: 'avg' });
  E.generateRound(ta, rng);
  const r1rester = ta.rounds[0].resting[0];
  E.setScore(ta, 0, 0, 18, 6);
  let rows = E.standings(ta);
  ok(Math.abs(rows.find(s => s.player.id === r1rester).points - 12) < 1e-9,
    'avg mode: zero-game rester credited half the match total');
  for (let r = 1; r < 5; r++) { E.generateRound(ta, rng); E.setScore(ta, r, 0, 18, 6); }
  rows = E.standings(ta);
  for (const s of rows) {
    const expected = s.pf + s.rests * (s.played ? s.pf / s.played : 12);
    ok(Math.abs(s.points - expected) < 1e-9, `avg mode: ${s.player.name} ${s.points} != ${expected}`);
  }
  // switching the mode off restores raw points
  ta.config.restMode = 'none';
  ok(E.standings(ta).every(s => s.points === s.pf), 'mode switch back to none = raw points');
}

// -------------------------------------------- provisional rests (v17 fix)
// Americano pre-draws the full schedule (v16); rests in rounds beyond the one
// being played must not show in standings or earn compensation early.
console.log('== Provisional rests: future pre-drawn rounds neither count nor compensate ==');
{
  const rng = mulberry32(777);
  const t = E.createTournament({
    players: names(5), courts: 1, format: 'americano',
    pointsPerMatch: 24, plannedRounds: 8, restMode: 'half',
  });
  E.refillPlanned(t, rng);
  ok(t.rounds.length === 8, 'full schedule pre-drawn');
  ok(t.rounds.reduce((a, r) => a + r.resting.length, 0) === 8, 'a rester in each pre-drawn round');

  // before any scores: only round 1's rester counts (and is compensated)
  let st = E.standings(t);
  const r1rester = t.rounds[0].resting[0];
  for (const s of st) {
    const expect = s.player.id === r1rester ? 1 : 0;
    ok(s.rests === expect, `pre-play: ${s.player.name} rests=${s.rests} expected ${expect}`);
  }
  ok(st.find(s => s.player.id === r1rester).points === 12, 'pre-play: current rester credited +12, future rests not');
  ok(st.filter(s => s.player.id !== r1rester).every(s => s.points === 0), 'pre-play: everyone else at 0');

  // complete round 1 → round 2 becomes current, its rester counts too
  E.setScore(t, 0, 0, 14, 10);
  st = E.standings(t);
  const expected = {};
  for (const pid of t.rounds[0].resting) expected[pid] = (expected[pid] || 0) + 1;
  for (const pid of t.rounds[1].resting) expected[pid] = (expected[pid] || 0) + 1;
  for (const s of st) {
    ok(s.rests === (expected[s.player.id] || 0), `after r1: ${s.player.name} rests=${s.rests} expected ${expected[s.player.id] || 0}`);
  }
  ok(st.reduce((a, s) => a + s.rests, 0) === 2, 'after r1: exactly 2 rests counted (r1 taken + r2 current)');

  // all rounds scored → every pre-drawn rest counts and is compensated
  for (let r = 1; r < 8; r++) E.setScore(t, r, 0, 14, 10);
  st = E.standings(t);
  ok(st.reduce((a, s) => a + s.rests, 0) === 8, 'all played: all 8 rests counted');
  for (const s of st) {
    ok(s.points === s.pf + s.rests * 12, `all played: ${s.player.name} ${s.points} != ${s.pf + s.rests * 12}`);
  }
}

// ------------------------------------------------------------------ perf 24p
console.log('== Performance: 24 players, 6 courts ==');
{
  const rng = mulberry32(31415);
  const t = E.createTournament({ players: names(24), courts: 6, pointsPerMatch: 24 });
  const t0 = Date.now();
  for (let r = 0; r < 10; r++) {
    E.generateRound(t, rng);
    checkRoundStructure(t, t.rounds[r], `24p r${r + 1}`);
    for (let mi = 0; mi < t.rounds[r].matches.length; mi++) E.setScore(t, r, mi, 14, 10);
  }
  const ms = Date.now() - t0;
  const { partner } = E.historyCounts(t);
  const maxPartner = Math.max(...Object.values(partner));
  console.log(`  10 rounds generated in ${ms}ms; max partner repeats: ${maxPartner}`);
  ok(ms < 5000, `24-player generation too slow: ${ms}ms`);
  ok(maxPartner <= 2, `24p: pair partnered ${maxPartner}x in 10 rounds`);
}

// ----------------------------------------------------------- skill balancing
console.log('== Skill-balanced draws ==');
{
  // 4 players: two strong (3) and two weak (1). Balanced engine must NEVER
  // team the two strongest together in round 1 (free choice, no history).
  for (let trial = 0; trial < 30; trial++) {
    const rng = mulberry32(9000 + trial);
    const t = E.createTournament({
      players: [{ name: 'S1', skill: 3 }, { name: 'S2', skill: 3 }, { name: 'W1', skill: 1 }, { name: 'W2', skill: 1 }],
      courts: 1, useSkills: true,
    });
    const r = E.generateRound(t, rng);
    const skill = {};
    t.players.forEach(p => { skill[p.id] = p.skill; });
    for (const m of r.matches) {
      const sumA = skill[m.teamA[0]] + skill[m.teamA[1]];
      const sumB = skill[m.teamB[0]] + skill[m.teamB[1]];
      ok(Math.abs(sumA - sumB) === 0, `skill 4p trial ${trial}: lopsided draw ${sumA} vs ${sumB}`);
    }
  }
  // default skill for plain strings + clamping + setSkill
  const t = E.createTournament({ players: names(4), useSkills: true });
  ok(t.players.every(p => p.skill === 2), 'string players default to middle skill');
  E.setSkill(t, t.players[0].id, 3);
  ok(t.players[0].skill === 3, 'setSkill applies');
  E.setSkill(t, t.players[0].id, 99);
  ok(t.players[0].skill === 2, 'invalid skill clamps to middle');

  // 10 players, mixed skills, full 8-round session: no obviously lopsided
  // match (team-sum diff >= 3) should ever be drawn.
  let worstDiff = 0, partnerMax = 0;
  for (let trial = 0; trial < 40; trial++) {
    const rng = mulberry32(7700 + trial);
    const skills = [3, 3, 3, 2, 2, 2, 2, 1, 1, 1];
    const t10 = E.createTournament({
      players: skills.map((s, i) => ({ name: 'P' + (i + 1), skill: s })),
      courts: 2, useSkills: true, pointsPerMatch: 24,
    });
    const skill = {};
    t10.players.forEach(p => { skill[p.id] = p.skill; });
    for (let r = 0; r < 8; r++) {
      const round = E.generateRound(t10, rng);
      for (const m of round.matches) {
        const diff = Math.abs(skill[m.teamA[0]] + skill[m.teamA[1]] - skill[m.teamB[0]] - skill[m.teamB[1]]);
        worstDiff = Math.max(worstDiff, diff);
      }
      for (let mi = 0; mi < round.matches.length; mi++) E.setScore(t10, r, mi, 14, 10);
    }
    partnerMax = Math.max(partnerMax, ...Object.values(E.historyCounts(t10).partner));
  }
  ok(worstDiff <= 2, `skill-balanced 10p: lopsided match drawn (diff ${worstDiff})`);
  ok(partnerMax <= 2, `skill-balanced 10p: partner repeated ${partnerMax}x`);
  console.log(`  10p/8r x40 trials: worst team-sum diff=${worstDiff}, max partner repeats=${partnerMax}`);

  // with useSkills OFF the engine ignores skills: across many seeds the two
  // strongest DO sometimes get paired (proves the term is gated by the flag)
  let stackedSeen = false;
  for (let trial = 0; trial < 60 && !stackedSeen; trial++) {
    const rng = mulberry32(31000 + trial);
    const t4 = E.createTournament({
      players: [{ name: 'S1', skill: 3 }, { name: 'S2', skill: 3 }, { name: 'W1', skill: 1 }, { name: 'W2', skill: 1 }],
      courts: 1, useSkills: false,
    });
    const r = E.generateRound(t4, rng);
    const skill = {};
    t4.players.forEach(p => { skill[p.id] = p.skill; });
    stackedSeen = r.matches.some(m => skill[m.teamA[0]] + skill[m.teamA[1]] === 6 || skill[m.teamB[0]] + skill[m.teamB[1]] === 6);
  }
  ok(stackedSeen, 'useSkills off: skills correctly ignored (stacked pair seen)');
}

// -------------------------------------------------- score views (analytics)
console.log('== Score views: progression + head-to-head ==');
{
  const rng = mulberry32(987654);
  const t = E.createTournament({ players: names(8), courts: 2, pointsPerMatch: 24, plannedRounds: 6 });
  for (let r = 0; r < 6; r++) {
    const round = E.generateRound(t, rng);
    for (let mi = 0; mi < round.matches.length; mi++) { const [a, b] = randomScore(t, rng); E.setScore(t, r, mi, a, b); }
  }
  const finalSt = E.standings(t);

  // ---- progression (rank/points timeline) ----
  const prog = E.progression(t);
  ok(prog.length === 6, `progression: one step per scored round (got ${prog.length})`);
  for (let i = 1; i < prog.length; i++) ok(prog[i].round > prog[i - 1].round, 'progression: round numbers increase');
  for (const step of prog) {
    ok(step.order.length === t.players.length, 'progression: every step ranks all players');
    step.order.forEach((pid, i) => ok(step.rank[pid] === i, 'progression: rank map matches order'));
  }
  const last = prog[prog.length - 1];
  ok(JSON.stringify(last.order) === JSON.stringify(finalSt.map(s => s.player.id)), 'progression: final order == standings');
  for (const s of finalSt) ok(Math.abs(last.points[s.player.id] - s.points) < 1e-9, `progression: final pts == standings (${s.player.name})`);
  // partial step matches a fresh standings on the sliced rounds
  {
    const partial = { players: t.players, config: t.config, rounds: t.rounds.slice(0, 3) };
    const st3 = E.standings(partial);
    ok(JSON.stringify(prog[2].order) === JSON.stringify(st3.map(s => s.player.id)), 'progression: step 3 == standings of first 3 rounds');
  }
  // purity
  const before = JSON.stringify(t);
  E.progression(t);
  ok(JSON.stringify(t) === before, 'progression: pure (no mutation)');

  // ---- head-to-head ----
  const h2h = E.headToHead(t);
  E.headToHead(t);
  ok(JSON.stringify(t) === before, 'headToHead: pure (no mutation)');
  for (const s of finalSt) {
    let netSum = 0, facedSum = 0;
    for (const o of t.players) { const rec = h2h[s.player.id][o.id]; if (rec) { netSum += rec.net; facedSum += rec.faced; } }
    // each match contributes to 2 opponents -> sums are doubled vs the player's own totals
    ok(netSum === 2 * s.diff, `h2h: Σnet = 2·diff for ${s.player.name} (${netSum} vs ${2 * s.diff})`);
    ok(facedSum === 2 * s.played, `h2h: Σfaced = 2·played for ${s.player.name} (${facedSum} vs ${2 * s.played})`);
  }
  // symmetry / mirroring between every ordered pair
  for (const a of t.players) for (const b of t.players) {
    if (a.id === b.id) continue;
    const ab = h2h[a.id][b.id], ba = h2h[b.id][a.id];
    ok((ab ? ab.faced : 0) === (ba ? ba.faced : 0), `h2h: faced symmetric ${a.name}/${b.name}`);
    ok((ab ? ab.net : 0) === -(ba ? ba.net : 0), `h2h: net antisymmetric ${a.name}/${b.name}`);
    ok((ab ? ab.wins : 0) === (ba ? ba.losses : 0), `h2h: wins mirror losses ${a.name}/${b.name}`);
    ok((ab ? ab.draws : 0) === (ba ? ba.draws : 0), `h2h: draws symmetric ${a.name}/${b.name}`);
  }
}

// -------------------------------------------------- games (first-to-N) mode
console.log('== Games mode: first-to-N scoring ==');
{
  // strict setScore validation
  const t = E.createTournament({ players: names(4), courts: 1, scoring: 'games', gamesTarget: 4, plannedRounds: 3 });
  E.generateRound(t);
  E.setScore(t, 0, 0, 4, 2); ok(t.rounds[0].matches[0].scoreA === 4, 'games: 4-2 accepted');
  E.setScore(t, 0, 0, 0, 4); ok(t.rounds[0].matches[0].scoreB === 4, 'games: 0-4 accepted');
  assert.throws(() => E.setScore(t, 0, 0, 4, 4), /First to 4/, 'games: 4-4 rejected (no winner)');
  assert.throws(() => E.setScore(t, 0, 0, 3, 2), /First to 4/, 'games: 3-2 rejected (winner below N)');
  assert.throws(() => E.setScore(t, 0, 0, 5, 4), /First to 4/, 'games: 5-4 rejected (winner above N)');
  assert.throws(() => E.setScore(t, 0, 0, 4, 5), /First to 4/, 'games: 4-5 rejected');
  ok(true, 'games: strict first-to-N validation enforced');

  // standings: points == games won, match win == set win, no draws
  function playGames(cfg, seed, rounds) {
    const g = E.createTournament(Object.assign({ players: names(8), courts: 2, scoring: 'games', gamesTarget: 4 }, cfg));
    const rng = mulberry32(seed);
    if (g.config.format === 'mexicano') {
      for (let r = 0; r < rounds; r++) {
        const round = E.generateRound(g, rng);
        checkRoundStructure(g, round, `${g.config.format}-games r${r + 1}`);
        for (let mi = 0; mi < round.matches.length; mi++) {
          const loser = Math.floor(rng() * 4), aWins = rng() < 0.5;
          E.setScore(g, r, mi, aWins ? 4 : loser, aWins ? loser : 4);
        }
      }
    } else {
      E.refillPlanned(g, rng);
      for (let r = 0; r < rounds; r++) for (let mi = 0; mi < g.rounds[r].matches.length; mi++) {
        const loser = Math.floor(rng() * 4), aWins = rng() < 0.5;
        E.setScore(g, r, mi, aWins ? 4 : loser, aWins ? loser : 4);
      }
    }
    return g;
  }

  for (const fmt of ['americano', 'mexicano']) {
    const g = playGames({ format: fmt, plannedRounds: 6 }, fmt === 'mexicano' ? 4242 : 55555, 6);
    const st = E.standings(g), ref = recompute(g);
    for (const row of st) {
      ok(row.points === ref[row.player.id].points, `${fmt}-games: standings games == sum for ${row.player.name}`);
      ok(row.wins === ref[row.player.id].wins && row.losses === ref[row.player.id].losses, `${fmt}-games: W/L for ${row.player.name}`);
      ok(row.draws === 0, `${fmt}-games: no draws in strict first-to-N for ${row.player.name}`);
    }
    for (const rd of g.rounds) for (const m of rd.matches) {
      if (m.scoreA === null) continue;
      ok(Math.max(m.scoreA, m.scoreB) === 4 && Math.min(m.scoreA, m.scoreB) < 4, `${fmt}-games: every set is first-to-4`);
    }
  }

  // 'half' compensation in games mode = gamesTarget/2 per rest
  const h = E.createTournament({ players: names(5), courts: 1, scoring: 'games', gamesTarget: 4, restMode: 'half', plannedRounds: 2 });
  const rng2 = mulberry32(222);
  E.refillPlanned(h, rng2);
  for (let r = 0; r < 2; r++) E.setScore(h, r, 0, 4, 1);
  const base = recompute(h), sth = E.standings(h);
  for (const row of sth) {
    const b = base[row.player.id];
    ok(Math.abs(row.points - (b.points + b.rests * 2)) < 1e-9, `games half-comp: +2/rest for ${row.player.name}`);
  }

  // rally mode untouched: combined still requires the sum
  const rl = E.createTournament({ players: names(4), courts: 1, scoring: 'rally', pointsPerMatch: 24, scoreEntry: 'combined' });
  E.generateRound(rl);
  assert.throws(() => E.setScore(rl, 0, 0, 10, 10), /add up to 24/, 'rally: combined sum still enforced');
  E.setScore(rl, 0, 0, 14, 10); ok(rl.rounds[0].matches[0].scoreA === 14, 'rally: combined still works');
}

// ------------------------------------------------------------------- guards
console.log('== Creation guards ==');
{
  assert.throws(() => E.createTournament({ players: names(3) }), /at least 4/);
  assert.throws(() => E.createTournament({ players: names(8), pointsPerMatch: 1 }), /at least 2/);
  const t = E.createTournament({ players: ['  Ana ', 'Bob', '', 'Cyd', 'Dan'] });
  ok(t.players.length === 4 && t.players[0].name === 'Ana', 'names trimmed, empties dropped');
}

console.log(`\n${checks} checks, ${failures} failures`);
process.exit(failures ? 1 : 0);
