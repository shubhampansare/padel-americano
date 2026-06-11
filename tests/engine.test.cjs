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
function recompute(t) {
  const s = {};
  for (const p of t.players) s[p.id] = { points: 0, played: 0, wins: 0, draws: 0, losses: 0, pf: 0, pa: 0, rests: 0 };
  for (const r of t.rounds) {
    for (const pid of r.resting) s[pid].rests++;
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
  const t = E.createTournament({ players: names(9), courts: 2, pointsPerMatch: 24 });
  E.generateRound(t, rng);
  for (let mi = 0; mi < 2; mi++) { const [a, b] = randomScore(t, rng); E.setScore(t, 0, mi, a, b); }
  E.generateRound(t, rng); // unscored round 2
  const p10 = E.addPlayer(t, 'P10', rng);
  ok(t.rounds.length === 2, 'unscored trailing round regenerated, count stable');
  const r2 = t.rounds[1];
  const inRound = new Set(r2.resting.concat(r2.matches.flatMap(m => m.teamA.concat(m.teamB))));
  ok(inRound.has(p10.id), 'new player included in regenerated round');
  ok(inRound.size === 10, 'regenerated round covers 10 players');
  checkRoundStructure(t, r2, 'after addPlayer');

  // remove a player -> excluded from future rounds, kept in standings
  for (let mi = 0; mi < r2.matches.length; mi++) { const [a, b] = randomScore(t, rng); E.setScore(t, 1, mi, a, b); }
  const victim = E.activePlayers(t)[0];
  E.removePlayer(t, victim.id, rng);
  const r3 = E.generateRound(t, rng);
  const inR3 = new Set(r3.resting.concat(r3.matches.flatMap(m => m.teamA.concat(m.teamB))));
  ok(!inR3.has(victim.id), 'removed player not in new round');
  ok(E.standings(t).some(s => s.player.id === victim.id), 'removed player still in standings');
  checkRoundStructure(t, r3, 'after removePlayer');

  // guard: cannot drop below 4 active
  const t4 = E.createTournament({ players: names(4), courts: 1 });
  assert.throws(() => E.removePlayer(t4, t4.players[0].id, rng), /at least 4/);
}

// --------------------------------------------------------------- regeneration
console.log('== Regenerate round ==');
{
  const rng = mulberry32(99);
  const t = E.createTournament({ players: names(10), courts: 2 });
  E.generateRound(t, rng);
  const before = JSON.stringify(t.rounds[0]);
  E.regenerateRound(t, 0, rng);
  ok(t.rounds.length === 1, 'regenerate keeps round count');
  checkRoundStructure(t, t.rounds[0], 'regenerated');
  E.setScore(t, 0, 0, 12, 12);
  assert.throws(() => E.regenerateRound(t, 0, rng), /scores/);
  E.generateRound(t, rng);
  assert.throws(() => E.regenerateRound(t, 0, rng), /last round/);
  void before;
}

// -------------------------------------------------- rename / rejoin / courts
console.log('== Rename, rejoin, change courts ==');
{
  const rng = mulberry32(2024);
  const t = E.createTournament({ players: names(10), courts: 2, pointsPerMatch: 24 });
  E.generateRound(t, rng);
  // rename
  E.renamePlayer(t, t.players[0].id, 'Zlatan');
  ok(t.players[0].name === 'Zlatan', 'rename applied');
  ok(E.standings(t).some(s => s.player.name === 'Zlatan'), 'rename visible in standings');
  assert.throws(() => E.renamePlayer(t, t.players[1].id, 'zlatan'), /already in use/);
  assert.throws(() => E.renamePlayer(t, t.players[1].id, '  '), /Name required/);

  // rejoin: remove someone, score the round, then bring them back
  for (let mi = 0; mi < 2; mi++) E.setScore(t, 0, mi, 14, 10);
  const out = E.activePlayers(t)[3];
  E.removePlayer(t, out.id, rng);
  E.generateRound(t, rng); // round 2 without them (unscored)
  let inR2 = new Set(t.rounds[1].resting.concat(t.rounds[1].matches.flatMap(m => m.teamA.concat(m.teamB))));
  ok(!inR2.has(out.id), 'removed player absent from round 2');
  E.reactivatePlayer(t, out.id, rng);
  ok(t.rounds.length === 2, 'rejoin regenerated trailing unscored round');
  inR2 = new Set(t.rounds[1].resting.concat(t.rounds[1].matches.flatMap(m => m.teamA.concat(m.teamB))));
  ok(inR2.has(out.id), 'rejoined player back in the draw');
  checkRoundStructure(t, t.rounds[1], 'after rejoin');

  // change courts mid-tournament: 2 -> 1 regenerates unscored round with 1 match
  E.setCourts(t, 1, rng);
  ok(t.rounds[1].matches.length === 1 && t.rounds[1].resting.length === 6, 'court change applied to next draw');
  checkRoundStructure(t, t.rounds[1], 'after setCourts');
  assert.throws(() => E.setCourts(t, 0, rng), /1-6/);
  // scored rounds are never touched
  ok(t.rounds[0].matches.length === 2, 'past round untouched by court change');
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
