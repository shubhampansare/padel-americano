# CLAUDE.md — Padel Americano

Free, single-file web app for running padel Americano/Mexicano tournaments. Built for the
"Padel Potatoes" group (typically 10 players, 2 courts, ~2h ≈ 8 rounds at 24 points).

- **Live:** https://shubhampansare.github.io/padel-americano/ (GitHub Pages, `main` branch root)
- **Repo:** https://github.com/shubhampansare/padel-americano (user's personal account)

## Architecture

- `index.html` — the entire app (CSS + UI + engine), zero dependencies, works offline,
  state in localStorage. The tournament engine is pure logic inlined between
  `/*ENGINE-START*/ … /*ENGINE-END*/` markers.
- `tests/engine.test.cjs` — extracts the engine from `index.html` (tests the shipped
  artifact) and runs 14k+ assertions. Run: `node tests/engine.test.cjs`
- `docs/` — design doc, competitor research (app-store + Reddit pain points), screenshots.

## Release process (IMPORTANT — user mandated)

1. **Never push/deploy without explicit user approval.** Brainstorm → implement → verify →
   present for review → push only on go-ahead. Batch 2–3 changes per release. Local commits
   are fine; `git push` is the gate (Pages auto-deploys `main` in ~1 min).
2. **Bump `const BUILD = 'vNN · date'`** in index.html on every shipped change — it shows in
   the footer so any device's build is identifiable (stale-copy debugging depends on it).
3. After push, verify: `curl -s https://shubhampansare.github.io/padel-americano/ | grep vNN`.

## Verification rules

- Run `node tests/engine.test.cjs` after any engine change; add assertions for new logic.
- Verify UI changes in a real browser (serve via `python3 -m http.server`; the Playwright
  browser blocks `file://`). **Always test WebKit too** for scroll/layout/viewport work —
  the user is iPhone-first; Chromium-only checks have shipped broken fixes before.
  Playwright WebKit is installed (`~/Library/Caches/ms-playwright/webkit-*`; harness
  pattern in /tmp/pw-webkit, recreate with `npm i playwright && npx playwright install webkit`).
- Cache-bust when re-testing (`?v=...`) — both the local server and Pages cache hard.

## Domain invariants (don't break)

- Standings always recompute from raw match scores (never incremental).
- Fairness: no consecutive sit-outs; games played spread ≤1; partner repeats only when
  unavoidable; sit-outs never depend on scores.
- Partner-repeat avoidance (Americano): the per-round matcher (`bestAmericanoMatches`) reads
  `historyCounts` and its cost penalizes repeats (`100·c²`), so it avoids re-pairing people
  who already partnered. But it's **greedy** (no lookahead), so an early round could force an
  avoidable repeat later — worst with odd/sit-out counts (9p ≈ 20–31% of single draws). v25/v26:
  `refillPlanned` draws the provisional tail up to `REFILL_TRIES (40)` times and keeps the
  fewest-`partnerRepeatTotal` variant, stopping early on a clean draw. `setPlannedRounds` drops
  the **whole** provisional tail (everything after the round on court) before refilling, so
  best-of-N optimizes the entire remaining schedule — growing the plan can't strand an earlier
  provisional round into an avoidable repeat (v26 fixed this; pre-v26 grow only appended).
  Result: avoidable repeats →0% for realistic configs (9p/10p/11p skills on+off →0.000% over
  3000-seed sweeps) and **0 avoidable repeats** across ~19k menu-driven churn states. Cost is
  negligible (early-exit when clean; only the rare tight small-group draws iterate). KNOWN edge:
  8 players playing **exactly** 7 rounds (the 1-factorization limit, everyone plays every round)
  WITH skills on ≈ 1% chance of one repeated pair — the only no-repeat arrangement isn't
  skill-balanced, so the cost (`100·c²` repeat vs `40·over²` skill, over≥2 ⇒ skill>repeat) picks
  the balanced match. Tunable by making the repeat weight dominate skill (deliberately not done;
  user chose best-of-N over "variety-over-balance"). Mexicano is unaffected — it pairs by
  standings (1st+4th vs 2nd+3rd) and repeats partners by design (~9–13 repeats/tournament).
- Americano: full schedule pre-drawn; rounds after the current are **provisional** — they
  redraw immediately on any roster/court/skill change and are locked for scoring (engine
  throws "Finish round N first"). The **current round (first incomplete) and every earlier
  round are frozen** — `redrawFuture` only ever drops/redraws rounds *strictly after* the
  current one, keyed on `roundComplete` (NOT on `anyScores`). This is deliberate: a
  played-but-unscored round is indistinguishable from a never-played one, and a match
  already on court must never change under the players' feet. To fold a change into the
  current round on purpose, use `regenerateRound` (the explicit "Re-draw round" button, or
  the post-round arrivals prompt — see v24 below). (v23 and earlier dropped any unscored
  trailing round, so checking a latecomer in before scoring the round on court reshuffled
  it — the v24 fix.) `setPlannedRounds` carried the same `anyScores` flaw — shrinking the
  plan below the round on court deleted it; v25 keys it on `roundComplete` too, only trimming
  provisional rounds strictly after the current one. (Verified: an immutability fuzzer over
  ~110k random mid-tournament operations finds zero changes to any played/current round.)
- Mexicano: rounds drawn lazily (pairings depend on live standings: 1st+4th vs 2nd+3rd per
  court); skill badges have no role in Mexicano.
- Sit-out compensation modes: none | half (fixed N/2) | avg (player's own pts/game,
  recomputed live; legacy `restPoints > 0` config means 'half'). In games mode (below)
  the 'half' base is `gamesTarget/2`, not `pointsPerMatch/2`.
- Rests count only up to the round being played (first incomplete) — provisional
  future rounds' rests must never show in standings or earn compensation (v17 fix).
  Draw fairness uses `historyCounts` (all drawn rounds, score-independent) — distinct
  from `standings` rests by design.
- Scoring modes: `scoring: 'rally' | 'games'` (default 'rally'; absent = rally, so old
  tournaments stay valid). Games mode (v20) stores **games won** in the same
  `scoreA`/`scoreB` fields, so `standings` sums them as "points" with no other math
  change; `setScore` enforces strict first-to-N (winner exactly N, loser below). Both
  formats; Mexicano games draws are coarser early (game-total ties) by design. UI wording
  switches points↔games via the `scoreUnit`/`matchGoalText`/`restHalfOf` helpers.
- `mutate(fn)` returns `true`/`false` (success) so the score sheet can stay open when a
  score is rejected — don't reintroduce an unconditional `closeScoreSheet()` after save.
- Readiness / late arrivals (v22): players carry an `arrived` flag (absent/legacy ⇒ true).
  A "pending" player (`arrived:false`, `active:false`) is on the roster but not yet checked
  in — excluded from `activePlayers`, every draw, and `standings` (which skips `arrived===false`)
  until they tick in. Start routes through a "Who's ready?" check-in (`renderReadiness`);
  Start needs `courts×4` ticked (the setup Start gate also requires `entered ≥ courts×4`).
  While any player is pending the schedule is **capped at `PARTIAL_ROUND_CAP` (2) rounds**
  (`refillPlanned`/`generateRound` honor `roundCap`); reaching round 3 throws until everyone
  checks in (`markArrived`) or is removed (`removeNoShow`, hard-deletes the never-drawn player —
  distinct from `removePlayer`'s soft "(left)"). The in-play readiness sheet (`openReadinessSheet`)
  modes: `{inter}` optional before round 2, `{gate}` mandatory before round 3 (label is cap-based
  so it survives the last check-in, after which Americano refills to planned), `{redrawIdx}`
  redraw, `{}` manage. `arrivalsCheckpoint(r, prevIdx)` (called from score-save) **auto-opens**
  the prompt when the active round finishes with anyone pending. Full-ready start ⇒ zero prompts.
  (v24) `markArrived` (like every roster change) routes through `redrawFuture`, which now
  **freezes the current round** (see Americano invariant above) — so a bare check-in, e.g. from
  the `{}` manage banner mid-round, never disturbs the match on court even if its score isn't in
  yet (the reported bug). The check-in still folds the latecomer into the *next* round only when
  it's safe to: `openReadinessSheet`'s `advance()` re-draws the upcoming round (`regenerateRound`)
  **only in the advancing `{inter}`/`{gate}` flows** (which fire right after a round was scored, so
  the upcoming round is genuinely unplayed) and **only if `opts._changed`** (someone actually
  checked in / was removed) **and the round is missing an active player**. Manual `{}` manage is
  not `advancing`, so it leaves the current round alone and the latecomer joins from the next
  provisional round.
  (v23) `render()` resets scroll to top on top-level screen/tab change (`lastScreen`) — transitions
  are bottom-button-triggered, so without it the new screen inherited the old bottom scroll;
  in-place re-renders (scoring) keep position.

## Shipped score-view & replay analytics (v18–v19)
- Past tournaments are archived as **full snapshots** (`store.archive` stores `snapshot`,
  de-duped by tournament `id`) and replayed read-only (`openReplaySheet`) — standings +
  round-by-round, never touching the live tournament. Legacy summary-only entries still
  list but aren't replayable.
- Score views (`scoreViewsHTML`) on the results screen and in replays: `Engine.progression`
  (rank/points timeline → bump chart), `Engine.headToHead` (opponent net matrix), and
  stat highlights. Both engine fns are pure and test-covered.

## Parked / backlog

- Pairing features deliberately deferred by user: Mexicano pairing-variant toggle
  (1+3 vs 2+4 etc.), manual round-1 seeding, fixed-partner mode, mixed-gender flag.
- Other ideas from competitor research (docs/competitor-research.md): read-only spectator
  link, playoff/final from standings, PDF/CSV export, long-term cross-session rankings.
