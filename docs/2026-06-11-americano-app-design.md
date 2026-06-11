# Padel Americano Web App — Design

Date: 2026-06-11. Built autonomously per user request (10 players, 2 courts, ~2 hours, free, full-featured).

**Update (same day, post competitor research):** hardened against every scoring/organizing
complaint found in competitor reviews & Reddit (see `competitor-research.md`). Added: direct
numeric score input; settings sheet (courts/rounds/ranking changeable mid-game); optional
neutral sit-out compensation (+½ match pts, off by default); per-round countdown timer;
player rename + rejoin; TV mode; copy-round-draws; backup export/import; in-app Rules & Help;
games-per-player estimate at setup; sit-out count chips; 33× faster pairing for 16+ players
(early-exit heuristic). Pairing-preference features (Mexicano pairing variants, fixed partners,
mixed-gender) deliberately deferred per user. Tests: 13,745 assertions, all passing.

## Goal

A free, single-file web app to run a padel Americano/Mexicano session: configure once, see fair
draws round by round, tap in scores, watch a live leaderboard. State survives reloads
(localStorage). No server, no accounts, no build step — open `index.html` in any browser.

## Research findings (sources in README)

- **Americano**: partners rotate every round so everyone plays with/against everyone. A match is a
  race to a *combined* point total (presets 16 / 21 / 24 / 32; 24 standard, 32 = equal serves).
  Both players on a team bank the team's score individually. Serve switches every 4 points
  (display hint only).
- **Mexicano**: round 1 random; from round 2, sort by standings, group in 4s per court
  (top 4 → court 1), pair **1st+4th vs 2nd+3rd** for balanced matches.
- **Leaderboard**: total points → point difference → wins → head-to-head (we implement points,
  diff, wins, then stable name order; configurable "wins first" mode).
- **10 players / 2 courts**: 8 play, 2 rest each round. Fairness = no consecutive rests, equal
  games played, minimal partner/opponent repeats.
- ~2 hours on 2 courts ≈ 8 rounds at 24 pts (≈12–15 min/round).

## Architecture

```
Americano/
  index.html        # entire app: CSS + UI JS + engine JS (between /*ENGINE-START*/ markers)
  docs/             # this design doc
  tests/
    engine.test.mjs   # node simulations (extracts engine from index.html via markers)
  README.md
```

Engine is pure (no DOM): `createTournament(config)`, `generateRound(t)`, `setScore(t, roundIdx,
matchIdx, scoreA, scoreB)`, `standings(t)`, `addPlayer/removePlayer`, `regenerateRound`. UI layer
renders state and persists `t` to localStorage on every mutation.

## Config (setup screen)

| Parameter | Options | Default |
|---|---|---|
| Players | 4–24 names, add/remove | last-used names prefilled |
| Courts | 1–6 (capped at floor(players/4)) | 2 |
| Format | Americano / Mexicano | Americano |
| Points per match | 16 / 21 / 24 / 32 / custom | 24 |
| Score entry | Combined total (one side auto-fills) / Free (any two numbers, e.g. timed rounds) | Combined |
| Ranking | Total points first / Wins first | Points |
| Rounds | Planned count (suggested from 2h) + "Add round" anytime; rounds generate lazily | 8 |

"Flexible" support: rounds are generated one at a time when the previous completes, so players can
be added/removed mid-session and the rotation adapts.

## Fairness algorithm (Americano)

Per round:
1. **Resters**: need `P − 4·C` resters. Hard-exclude players who rested the previous round
   (unless infeasible). Pick those with fewest rests; tie → most games played; tie → random.
2. **Pairing**: split active players into pairs+matches minimizing
   `10·partnerRepeats² + 1·opponentRepeats²` (squared to spread repeats evenly). Search: exhaustive
   for ≤8 active players; otherwise 4000 random candidates + pairwise-swap hill climbing.
3. Mexicano replaces step 2 with standings grouping (1+4 v 2+3 per court); round 1 random.

Invariants (asserted in tests): games-played spread ≤ 1 whenever rest counts allow; never two
consecutive rests while `P > resters·2` makes it feasible; partner repeats only after all unique
partners exhausted (within search limits).

## Score entry & leaderboard

- Match card → tap → number pad. Combined mode: entering team A auto-fills `N − A` for B; free
  mode: both sides entered. Editing past scores allowed anytime; leaderboard recomputes from raw
  scores (single source of truth = match scores, never incremental).
- Standings table: rank, name, points, played, W-D-L, diff, rests. Movement arrows vs previous
  round. Podium view on finish.

## Persistence & lifecycle

- Autosave whole tournament JSON to `localStorage['americano.current']` on every mutation;
  restore on load. Finished tournaments archived to `americano.history` (cap 20).
  Player names also saved to `americano.lastPlayers` for next-session prefill.
- New tournament requires explicit confirm if one is active.
- Optional countdown timer (default 2h) shown in header; purely informational.
- Results shareable as copy-to-clipboard text summary.

## Testing

1. **Node sims** (`tests/engine.test.mjs`): hundreds of simulated tournaments across player counts
   4–14, courts 1–3, both formats, both scoring entries; assert invariants + leaderboard math
   against an independent recompute; tie-breaker unit cases.
2. **Playwright**: real browser run-through — 10 players/2 courts, enter mock scores, verify
   rendered leaderboard numbers, reload persistence, edit past score, add player mid-game,
   finish + podium. Screenshots reviewed.

## Out of scope (YAGNI)

Accounts, multi-device sync, brackets/knockouts, Elo, PDF export, i18n.
