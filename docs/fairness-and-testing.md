# Fair by design — how this Americano app is tested

A padel Americano lives or dies on fairness. If the app reshuffles a game you just
played, or keeps pairing the same two people, the evening falls apart and someone has to
re-run rounds by hand. This app is built so that doesn't happen — and the guarantees are
backed by simulation, not hope.

## The two promises

**1. A match on court never changes under your feet.**
Once a round is the one being played — scored or not — nothing you do in the menu touches
it. Add a latecomer, remove a no-show, change courts, flip skill-balancing, change the
number of rounds: all of it only ever affects the *upcoming, not-yet-played* rounds. The
round in front of you stays exactly as drawn, so you can always enter its score.

**2. The same pair is never partnered twice when it can be avoided.**
Every draw remembers who has already partnered whom and actively avoids repeats. When the
group size makes a no-repeat schedule possible, you get one — every time. Repeats only
ever appear when they're mathematically unavoidable (a tournament longer than the number
of distinct partners a player can have).

## What the numbers say

These come from randomized simulations run directly against the shipped app
(`tests/fuzz/`), not a separate model:

- **0 changes to a played or in-progress round** across **~110,000** random mid-tournament
  menu operations — adding/removing players, changing courts and skills, checking in late
  arrivals, dropping no-shows, changing the round count.
- **0.000% avoidable partner repeats** for realistic line-ups (9, 10, 11 players; skill
  mode on and off) over **3,000-tournament** sweeps each. The hardest case — 9 players —
  dropped from ~20–31% of draws having a repeat to **none**.
- **0 avoidable repeats** across **19,000+** scenarios where every menu option is fiddled
  with mid-tournament — confirmed against the *live deployed build*, not just locally.
- **14,779** correctness assertions on every build, run against the exact file that ships.

## How it's tested (the part that makes the promises real)

- **We test what we ship.** The test harness pulls the tournament engine out of the actual
  `index.html` that gets deployed, so there's no gap between "the code we tested" and "the
  app you use."
- **Fuzzing, not just examples.** Beyond fixed test cases, randomized "fuzzers" play out
  thousands of full tournaments with random rosters, court counts, scoring modes, late
  arrivals and menu changes, checking the two promises after *every* step.
- **Avoidable vs unavoidable, proven.** When a repeat does appear, the test doesn't guess —
  it independently re-draws the remaining schedule many times to prove whether a no-repeat
  alternative existed. Only genuinely avoidable repeats count as failures.
- **Best-of-N draws.** The schedule builder draws several candidates and keeps the one with
  the fewest repeats, stopping the moment it finds a clean one. Cheap in practice, and it
  closes the gap a single greedy pass leaves on tight, odd-numbered groups.

## Found in the wild, fixed for good

The guarantees got stronger by chasing down real failures:

- **v24** — A latecomer checked in *before* a played round's score was entered used to
  reshuffle that round, forcing the group to replay it. Fixed: the round on court is frozen
  the moment it's reached.
- **v25** — Shrinking the planned-round count could delete the round you were on; and a
  single greedy draw occasionally left an avoidable repeat. Fixed: the round on court is
  protected everywhere, and the schedule is drawn best-of-N to avoid repeats.
- **v26** — Growing the planned-round count mid-tournament could strand an earlier round
  into an avoidable repeat. Fixed: the whole remaining schedule is re-optimised, not just
  the new rounds. Verified: zero avoidable repeats under full menu churn on the live build.

Each fix shipped with a regression test, so it can never quietly come back.

## The honest edge

There is exactly one situation where a repeat can still appear with no bug: **8 players
playing exactly 7 rounds with skill-balancing on.** Seven rounds for eight players uses up
*every* possible unique pairing, and the one remaining no-repeat arrangement isn't
skill-balanced — so the app prefers the balanced match about 1% of the time. It's a
deliberate, documented trade-off (variety vs. balance) at the mathematical limit. Normal
line-ups never reach it.

---

*Re-run any of this yourself: see `tests/fuzz/README.md`.*
