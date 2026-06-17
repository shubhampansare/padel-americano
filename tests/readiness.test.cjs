/**
 * Readiness / late-arrivals feature tests. Run: node tests/readiness.test.cjs
 * Extracts the engine from index.html (the shipped artifact), same as engine.test.cjs.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadEngine() {
  const fp = path.join(__dirname, '..', 'index.html');
  const src = fs.readFileSync(fp, 'utf8');
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
function throws(fn, re, msg) {
  checks++;
  try { fn(); failures++; console.error('  FAIL (no throw): ' + msg); }
  catch (e) { if (re && !re.test(e.message)) { failures++; console.error(`  FAIL (wrong msg "${e.message}"): ` + msg); } }
}

function partial(opts) {
  const o = Object.assign({ format: 'americano', courts: 2, arrived: 8, pending: 4, plannedRounds: 8 }, opts);
  const players = [];
  for (let i = 0; i < o.arrived; i++) players.push('A' + (i + 1));
  for (let i = 0; i < o.pending; i++) players.push({ name: 'L' + (i + 1), arrived: false });
  return E.createTournament({
    players, courts: o.courts, format: o.format, plannedRounds: o.plannedRounds,
    pointsPerMatch: 24, scoreEntry: 'combined',
  });
}
function scoreRound(t, ri) {
  for (let mi = 0; mi < t.rounds[ri].matches.length; mi++) E.setScore(t, ri, mi, 16, 8);
}
function pidsInRound(round) {
  const s = new Set(round.resting);
  for (const m of round.matches) for (const pid of m.teamA.concat(m.teamB)) s.add(pid);
  return s;
}

console.log('\n== Readiness / late-arrivals ==');

// 1. Pending players are excluded from the active pool but tracked as pending.
{
  const t = partial({});
  ok(E.activePlayers(t).length === 8, '1: active excludes pending (got ' + E.activePlayers(t).length + ')');
  ok(E.pendingPlayers(t).length === 4, '1: pendingPlayers returns 4 (got ' + E.pendingPlayers(t).length + ')');
  ok(t.players.length === 12, '1: all 12 retained on roster');
}

// 2. Partial Americano caps the drawn schedule at 2 rounds while anyone is pending.
{
  const t = partial({ plannedRounds: 8 });
  E.refillPlanned(t, mulberry32(1));
  ok(t.rounds.length === 2, '2: partial americano draws only 2 rounds (got ' + t.rounds.length + ')');
  // and pending players appear in none of those rounds
  const pend = new Set(E.pendingPlayers(t).map(p => p.id));
  let leaked = false;
  for (const r of t.rounds) for (const pid of pidsInRound(r)) if (pend.has(pid)) leaked = true;
  ok(!leaked, '2: pending players never drawn into a round');
}

// 3. standings() excludes not-yet-arrived players.
{
  const t = partial({});
  E.refillPlanned(t, mulberry32(2));
  scoreRound(t, 0);
  const rows = E.standings(t);
  ok(rows.length === 8, '3: standings lists only the 8 arrived (got ' + rows.length + ')');
}

// 4. Marking latecomers in before round 2 redraws round 2 to include them.
{
  const t = partial({});
  const rng = mulberry32(3);
  E.refillPlanned(t, rng);
  scoreRound(t, 0);
  ok(t.rounds[1].resting.length === 0, '4: pre-arrival round 2 has 0 resters (8 players, 2 courts)');
  E.pendingPlayers(t).slice().forEach(p => E.markArrived(t, p.id, rng));
  ok(E.activePlayers(t).length === 12, '4: all 12 active after check-in');
  ok(E.pendingPlayers(t).length === 0, '4: no pending after check-in');
  ok(t.rounds[1].resting.length === 4, '4: round 2 redrawn with 12 players -> 4 rest (got ' + t.rounds[1].resting.length + ')');
}

// 5. Round 3 is blocked while pending exists; allowed once cleared (Mexicano).
{
  const t = partial({ format: 'mexicano' });
  const rng = mulberry32(4);
  E.generateRound(t, rng); scoreRound(t, 0);
  E.generateRound(t, rng); scoreRound(t, 1);
  throws(() => E.generateRound(t, rng), /round 3|check everyone|no-show/i, '5: round 3 blocked while pending');
  E.pendingPlayers(t).slice().forEach(p => E.markArrived(t, p.id, rng));
  E.generateRound(t, rng);
  ok(t.rounds.length === 3, '5: round 3 draws once everyone is in (got ' + t.rounds.length + ')');
}

// 6. Removing no-shows clears pending and unblocks the rest of the schedule (Americano).
{
  const t = partial({ plannedRounds: 8 });
  const rng = mulberry32(5);
  E.refillPlanned(t, rng);
  ok(t.rounds.length === 2, '6: capped at 2 before removal');
  E.pendingPlayers(t).slice().forEach(p => E.removeNoShow(t, p.id, rng));
  ok(t.players.length === 8, '6: no-shows hard-deleted from roster (got ' + t.players.length + ')');
  ok(E.pendingPlayers(t).length === 0, '6: no pending after removal');
  ok(t.rounds.length === 8, '6: full schedule fills once pending cleared (got ' + t.rounds.length + ')');
}

// 7. A full start (no pending) behaves exactly as before — full schedule, no cap.
{
  const t = E.createTournament({
    players: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
    courts: 2, format: 'americano', plannedRounds: 6, pointsPerMatch: 24, scoreEntry: 'combined',
  });
  E.refillPlanned(t, mulberry32(6));
  ok(E.pendingPlayers(t).length === 0, '7: nobody pending on a full start');
  ok(t.rounds.length === 6, '7: full schedule drawn immediately (got ' + t.rounds.length + ')');
}

// 8. Legacy tournaments (players have no `arrived` field) are unaffected.
{
  const t = E.createTournament({
    players: ['A', 'B', 'C', 'D'], courts: 1, format: 'mexicano',
    plannedRounds: 5, pointsPerMatch: 24, scoreEntry: 'combined',
  });
  delete t.players[0].arrived; delete t.players[1].arrived; // simulate legacy stored objects
  ok(E.pendingPlayers(t).length === 0, '8: missing arrived field is treated as arrived');
  E.generateRound(t, mulberry32(7));
  ok(t.rounds.length === 1, '8: legacy mexicano still draws');
  ok(E.standings(t).length === 4, '8: legacy standings list all four');
}

console.log(`\n${failures ? 'FAILED' : 'PASSED'} — ${checks - failures}/${checks} checks`);
process.exit(failures ? 1 : 0);
