/**
 * Ad-hoc verification for the Highlights cards (statHighlightsHTML), esp. the new
 * v30 "Late bloomer" card. Extracts the SHIPPED function + Engine from index.html.
 * Run: node tests/highlights.check.cjs
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// --- pull the engine ---
const eStart = src.indexOf('/*ENGINE-START*/'), eEnd = src.indexOf('/*ENGINE-END*/');
const engineCode = src.slice(eStart, eEnd);

// --- pull statHighlightsHTML source (function start → next top-level function) ---
const fnStart = src.indexOf('function statHighlightsHTML');
const fnEnd = src.indexOf('\nfunction h2hMatrixHTML');
const fnCode = src.slice(fnStart, fnEnd);

const ctx = {};
vm.createContext(ctx);
vm.runInContext(engineCode + '\nthis.Engine = Engine;', ctx);
// tiny shims the function depends on (verbatim from index.html lines 1278/1329)
vm.runInContext(`
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const scoreUnit = cfg => cfg && cfg.scoring === 'games' ? 'games' : 'pts';
  ${fnCode}
  this.statHighlightsHTML = statHighlightsHTML;
`, ctx);

// --- helpers to hand-build a finished combined-24 tournament ---
let pidc = 0;
function mkPlayers(names) { return names.map(n => ({ id: 'p' + (pidc++), name: n, active: true, arrived: true, skill: 2 })); }
// rounds: array of [ [i,j], [k,l], scoreA ]  (teamA indices, teamB indices, teamA score; B = 24-scoreA)
function mkTourney(players, rounds, total = 24) {
  return {
    id: 't1', config: { format: 'americano', scoring: 'rally', pointsPerMatch: total, scoreEntry: 'combined', ranking: 'points', restMode: 'none' },
    players,
    rounds: rounds.map(([a, b, sa]) => ({
      matches: [{ teamA: [players[a[0]].id, players[a[1]].id], teamB: [players[b[0]].id, players[b[1]].id], scoreA: sa, scoreB: total - sa }],
      resting: [],
    })),
  };
}

function cardsOf(t) {
  const st = ctx.Engine.standings(t);
  const prog = ctx.Engine.progression(t);
  const html = ctx.statHighlightsHTML(t, st, prog);
  // pull out each card's label + big + sub
  const cards = [];
  const re = /<div class="sc-ico">(.*?)<\/div><div class="sc-label">(.*?)<\/div><div class="sc-big">(.*?)<\/div><div class="sc-sub">(.*?)<\/div>/g;
  let m; while ((m = re.exec(html))) cards.push({ ico: m[1], label: m[2], big: m[3], sub: m[4] });
  return { cards, st, prog };
}

function dumpProg(prog, players) {
  const nm = id => players.find(p => p.id === id).name;
  console.log('  progression (rank order each scored round):');
  for (const s of prog) console.log(`    R${s.round}: ` + s.order.map((id, i) => `${i + 1}.${nm(id)}(${Math.round(s.points[id])})`).join('  '));
}

let pass = 0, fail = 0;
function check(cond, msg) { if (cond) { pass++; } else { fail++; console.error('  FAIL: ' + msg); } }

// ===== Scenario 1: distinct climber (early) vs late bloomer (final stretch) =====
console.log('\n== Scenario 1: A climbs early (climber), D surges late (late bloomer) ==');
{
  const P = mkPlayers(['Al', 'Bo', 'Cy', 'Di']);
  // Al climbs to 1st by R3 and holds (overall climber, but flat in the window).
  // Di is high at R1, sinks to last by R3, then wins the final 3 to reach 2nd
  // (late bloomer — distinct from Al). Combined 24.
  const t = mkTourney(P, [
    [[3, 2], [0, 1], 20], // R1 Di&Cy 20 vs Al&Bo 4   -> Al last, Di top
    [[0, 1], [2, 3], 22], // R2 Al&Bo 22 vs Cy&Di 2   -> Al climbs
    [[0, 2], [1, 3], 20], // R3 Al&Cy 20 vs Bo&Di 4   -> Al 1st, Di 4th
    [[3, 1], [0, 2], 16], // R4 Di&Bo 16 vs Al&Cy 8   -> Di wins
    [[3, 0], [1, 2], 16], // R5 Di&Al 16 vs Bo&Cy 8   -> Di wins
    [[3, 1], [0, 2], 15], // R6 Di&Bo 15 vs Al&Cy 9   -> Di wins (clean last 3)
  ]);
  const { cards, prog } = cardsOf(t);
  dumpProg(prog, P);
  for (const c of cards) console.log(`  [${c.ico}] ${c.label}: ${c.big} — ${c.sub}`);
  const climber = cards.find(c => c.label === 'Biggest climber');
  const lb = cards.find(c => c.label === 'Late bloomer');
  check(!!lb, 'Late bloomer card present');
  check(!!climber, 'Biggest climber card present');
  check(lb && climber && lb.big !== climber.big, `Late bloomer (${lb && lb.big}) is a DIFFERENT player than climber (${climber && climber.big})`);
  check(climber && climber.big === 'Al', `climber is Al (got ${climber && climber.big})`);
  check(lb && lb.big === 'Di', `Late bloomer is Di (got ${lb && lb.big})`);
  check(lb && lb.sub === 'won the last 3 to climb from 4th to 2nd', `clean-run subtext (got: "${lb && lb.sub}")`);
}

// ===== Scenario 2: dedupe — when the only late climber IS the overall climber, no card =====
console.log('\n== Scenario 2: same player tops both → Late bloomer suppressed (deduped) ==');
{
  const P = mkPlayers(['Al', 'Bo', 'Cy', 'Di']);
  // Di dead last the whole way, wins ONLY the final 3 → also the overall climber.
  const t = mkTourney(P, [
    [[0, 1], [2, 3], 18], // Di low
    [[0, 2], [1, 3], 16], // Di low
    [[1, 2], [0, 3], 20], // Di low (Al&Di lose)
    [[0, 3], [1, 2], 20], // Di wins
    [[1, 3], [0, 2], 22], // Di wins
    [[2, 3], [0, 1], 24], // Di wins
  ]);
  const { cards, prog } = cardsOf(t);
  dumpProg(prog, P);
  for (const c of cards) console.log(`  [${c.ico}] ${c.label}: ${c.big} — ${c.sub}`);
  const climber = cards.find(c => c.label === 'Biggest climber');
  const lb = cards.find(c => c.label === 'Late bloomer');
  // If Di is both, the late-bloomer must be deduped to a runner-up or absent (never == climber)
  check(!lb || (climber && lb.big !== climber.big), 'Late bloomer never duplicates the climber');
}

// ===== Scenario 3: generic subtext when the late surge ISN'T a clean win streak =====
console.log('\n== Scenario 3: late bloomer with a draw in the window → generic "up N places" subtext ==');
{
  const P = mkPlayers(['Al', 'Bo', 'Cy', 'Di']);
  // Same R1–R3 as scenario 1 (Di sinks to 4th). In the window Di wins, DRAWS, wins
  // — so it's not a clean run; Bo becomes the overall climber, Di the late bloomer.
  const t = mkTourney(P, [
    [[3, 2], [0, 1], 20], // R1 Di&Cy 20 vs Al&Bo 4
    [[0, 1], [2, 3], 22], // R2 Al&Bo 22 vs Cy&Di 2
    [[0, 2], [1, 3], 20], // R3 Al&Cy 20 vs Bo&Di 4   -> Di 4th
    [[3, 1], [0, 2], 16], // R4 Di&Bo 16 vs Al&Cy 8   -> Di wins
    [[3, 0], [1, 2], 12], // R5 Di&Al 12 vs Bo&Cy 12  -> DRAW
    [[3, 1], [0, 2], 20], // R6 Di&Bo 20 vs Al&Cy 4   -> Di wins
  ]);
  const { cards, prog } = cardsOf(t);
  dumpProg(prog, P);
  for (const c of cards) console.log(`  [${c.ico}] ${c.label}: ${c.big} — ${c.sub}`);
  const climber = cards.find(c => c.label === 'Biggest climber');
  const lb = cards.find(c => c.label === 'Late bloomer');
  check(!!lb, 'Late bloomer present');
  check(lb && climber && lb.big !== climber.big, `late bloomer (${lb && lb.big}) distinct from climber (${climber && climber.big})`);
  check(lb && /^up \d+ places? in the final \d rounds$/.test(lb.sub), `generic subtext "up N places in the final K rounds" (got: "${lb && lb.sub}")`);
}

// ===== Scenario 4: too few rounds → no late bloomer card =====
console.log('\n== Scenario 4: < 4 scored rounds → no Late bloomer card ==');
{
  const P = mkPlayers(['Al', 'Bo', 'Cy', 'Di']);
  const t = mkTourney(P, [
    [[0, 1], [2, 3], 18],
    [[0, 2], [1, 3], 20],
    [[1, 2], [0, 3], 16],
  ]);
  const { cards } = cardsOf(t);
  for (const c of cards) console.log(`  [${c.ico}] ${c.label}: ${c.big} — ${c.sub}`);
  check(!cards.find(c => c.label === 'Late bloomer'), 'No late bloomer card with only 3 rounds');
}

console.log(`\n${pass + fail} checks, ${fail} failures`);
process.exit(fail ? 1 : 0);
