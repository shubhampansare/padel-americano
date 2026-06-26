# Fixed-Pairs Americano — Design Spec

**Date:** 2026-06-27
**Status:** Approved (scoping decisions confirmed; proceeding under `/goal` autonomy)
**Build target:** v31

## Goal

Let a group run an Americano where **partners are fixed for the whole session** instead of
rotating every round. The unit of competition becomes the **team** (a fixed pair of players):
teams keep their partner and rotate **opponents**; standings, results, and analytics are by team.

This un-parks the "fixed-partner mode" listed under *Parked / backlog* in `Padel/CLAUDE.md`.

## Scope (confirmed)

- **Americano only.** No fixed-pairs Mexicano in v1.
- **All teams present at start.** No per-team late-arrival/check-in flow; you *can* add or
  remove a whole team mid-session (redraws future rounds).
- **Keep skill balancing**, computed by **team strength = sum of the two players' skills**.
- **Full stats parity:** team leaderboard + bump chart + team-vs-team head-to-head + highlight
  cards + read-only share/replay, all team-aware.

**Out of scope (v1):** Mexicano fixed-pairs, per-team late-arrival check-in, separate
team-name labels (teams display as `"Alice & Bob"`).

## Architecture principle

A fixed-pairs tournament is an Americano where the **pairing is frozen** and the matcher only
chooses **which teams face which** and **which whole teams sit out**. The match data model is
unchanged (`{ teamA:[pidA,pidB], teamB:[pidC,pidD], scoreA, scoreB }`), so scoring, snapshots,
replay, and `historyCounts` keep working. A **team layer** sits on top, and the matcher /
rest-picker / standings / score-views **branch on `config.fixedPairs`**.

Player-level `standings` / `progression` / `headToHead` stay **byte-for-byte identical** — new
team-aware functions are added alongside, so the existing 14k-assertion suite has zero churn.

## Data model (backwards-compatible)

- `config.fixedPairs: boolean` — default `false`. **Absent ⇒ false ⇒ existing tournaments
  behave exactly as today.**
- `t.teams: [{ id, players:[pidA, pidB] }]` — present only in fixed-pairs mode. Players still
  live in `t.players` (id/name/skill/active/arrived). A team is **active iff both its players
  are active**. Display name = `players.map(name).join(' & ')`.
- `createTournament` accepts `{ fixedPairs:true, teams:[[name,name],…] }` (or teams of
  `{name, skill}`), builds the player roster + `t.teams`, and sets every player `arrived:true`.

## Scheduling

- `courtsUsed = min(courts, floor(numActiveTeams / 2))`; sit-out teams =
  `numActiveTeams − 2·courtsUsed`.
- **`pickRestingTeams(t, rng)`** — mirrors `pickResters` at team granularity: hard-exclude last
  round's resting teams, sort by games-played desc → rests asc → jitter, take `need`. Returns
  resting team objects; `round.resting` stores the flattened player IDs of those teams
  (score-independent, no consecutive team sit-outs, games spread ≤1).
- **`bestTeamMatchups(t, playingTeams, rng)`** — reuse `enumeratePairMatchups` over team IDs;
  cost = team-vs-team **faced-count²** (+ skill penalty). Exhaustive (≤6 playing teams).
  Returns matchups as `[[teamA.players, teamB.players], …]`.
- **Skill (kept):** team strength = `skill[pA]+skill[pB]`. Matchup penalty
  `over = max(0, |teamSkillA − teamSkillB| − 1)`, weight `40·over²` (same shape as today; a
  one-step gap stays normal). Faced-repeat weight dominates so rematches are avoided first.
- `generateRound` branches on `fixedPairs` (team rest + team matchups vs the player matcher).
- **Best-of-N schedule quality:** generalize `partnerRepeatTotal` → `scheduleRepeats(t)`:
  partner repeats for individuals, **team-faced repeats** for fixed pairs. `refillPlanned` uses
  it to keep the cleanest of `REFILL_TRIES` draws (early-exit on a rematch-free schedule).
- `redrawFuture` / `setPlannedRounds` / `regenerateRound` already gate on `format==='americano'`
  (fixed-pairs *is* americano) — the current-round freeze and all v24–v26 immutability
  invariants carry over unchanged.

## Standings & analytics (team-aware, full parity)

New pure, test-covered engine fns; the UI selects them when `config.fixedPairs`:

- **`teamStandings(t)`** — one row per active team: points/diff/W·D·L/rests aggregated at team
  level. Same rest-compensation modes (`none` / `half` = N/2 / `avg` = team pf/played).
  Sorted by the configured ranking (points or wins), tiebreak by team display name. Rests count
  only up to the round being played (same rule as `standings`).
- **`teamProgression(t)`** — team rank/points timeline (team bump chart).
- **`teamHeadToHead(t)`** — team-vs-team faced/wins/losses/draws/net matrix.
- Team highlight cards derived from team standings/progression.

## UI surfaces

- **Setup:** under Americano, a new segmented toggle **Partners: Rotating · Fixed pairs**
  (hidden when Mexicano is selected — mutually exclusive). Fixed-pairs turns the flat player
  list into **team cards** (Team N: two name inputs; optional skill badge per player when skill
  levels are on; add/remove a whole team). Start gate needs ≥ `courts×2` teams (≥2 teams).
  The "Who's ready?" check-in is **skipped** for fixed pairs — `openCheckin` commits directly
  with all players `arrived:true`. Setup note explains the mode.
- **Rounds tab:** "Alice & Bob vs Carol & Dan"; resting shows whole teams. Provisional/redraw
  logic unchanged.
- **Standings tab / results podium:** team rows / team names on the podium, via `teamStandings`.
- **Score views (results + replay):** team bump chart, team head-to-head, team highlights.
- **Share link:** compact encoding gains a `fixedPairs` flag + a teams index array (pairs of
  player indices); `expandCompact` rebuilds `t.teams`; `renderSharedView` branches to team
  standings/views. Snapshot-based replay already carries `t.teams`+config — only needs the
  team-aware renderers.
- **Menu (mid-session):** add team / remove team (→ `redrawFuture`); courts, rounds, skills
  still work.
- **`copyRoundDraws`** already prints "A + B vs C + D" — fine; optionally label "Team".
- **Help text** gains a fixed-pairs section.

## Roster operations (engine)

- `addTeam(t, [name1, name2], rng, skills?)` — push two players + a team, `redrawFuture`.
- `removeTeam(t, teamId, rng)` — deactivate both players, `redrawFuture` (guard: keep ≥2 active
  teams).
- `renamePlayer` works per player (team label updates automatically). `setSkill` per player;
  team strength recomputes from players.

## Testing & verification

- **Engine-first / TDD.** New `tests/fixedpairs.test.cjs`:
  - team rotation keeps partners fixed across all rounds;
  - no avoidable team rematches (best-of-N) across seed sweeps for realistic configs
    (e.g. 4/5/6/8 teams, 1–3 courts, skills on/off);
  - whole-team sit-out fairness (no consecutive sit-outs, games spread ≤1, score-independent);
  - `teamStandings` correctness incl. all three rest-comp modes;
  - skill-balanced matchups avoid lopsided team-vs-team;
  - backwards-compat: `fixedPairs:false` / absent is unchanged.
- **Fuzzers:** a fixed-pairs immutability/churn fuzzer mirroring `tests/fuzz/*` (current/played
  rounds never mutate under mid-session add/remove-team churn).
- **Existing suites stay green:** `node tests/engine.test.cjs`, `tests/readiness.test.cjs`,
  `tests/highlights.check.cjs`, and all `tests/fuzz/*`.
- **Browser:** verify in **WebKit and Chromium** (iPhone-first) via a local server; cache-bust.
- **`BUILD` → v31**; ship only on explicit user approval (release gate).

## Domain-invariant updates (Padel/CLAUDE.md)

Add a fixed-pairs invariant block: team is the competition unit; partners frozen; whole-team
sit-outs follow the same fairness rules; opponent (team-vs-team) repeats are minimized via
best-of-N instead of partner repeats; `fixedPairs:false`/absent preserves all individual-mode
behavior. Move "fixed-partner mode" out of *Parked / backlog*.
