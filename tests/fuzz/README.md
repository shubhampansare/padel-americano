# Fairness fuzzers

Long-running randomized simulations that stress the tournament engine far beyond the
fast assertion suite (`tests/engine.test.cjs`). They exist to make two promises hold in
*every* situation, not just the happy path:

1. **A match on court never changes under the players' feet.**
2. **The same pair is never made partners twice when it can be avoided.**

Each fuzzer extracts the engine from the shipped `index.html` (so it tests exactly what
deploys), runs thousands of randomized tournaments, and exits non-zero on any failure.
They're deliberately not in the fast suite — run them after any engine change, and after
a deploy against the live build.

| Fuzzer | Guarantees | Run | Pass |
|---|---|---|---|
| `immutability.fuzz.cjs` | No menu operation (add/remove player, courts, skills, planned rounds, arrivals, no-shows, reactivate) ever changes a round being played or already played. | `node tests/fuzz/immutability.fuzz.cjs [seeds=8000]` | `VIOLATIONS: 0` |
| `partner-repeats.fuzz.cjs` | Americano produces no avoidable partner repeat in any feasible config (players/courts/rounds × skills × scoring). Mexicano reported only (repeats by design). | `node tests/fuzz/partner-repeats.fuzz.cjs [seeds=3000]` | all assert-zero configs `0.00%` |
| `menu-churn.fuzz.cjs` | Interleaving *every* menu option mid-tournament never introduces an **avoidable** repeated pair. Classifies each repeat as avoidable (bug) vs forced-by-played-rounds (not a bug). | `node tests/fuzz/menu-churn.fuzz.cjs [file=index.html] [seeds=2500]` | `AVOIDABLE (bug): 0` |

## Verifying the live deployment

`menu-churn.fuzz.cjs` accepts a path to any built `index.html`, so you can point it at the
deployed artifact:

```sh
curl -s https://shubhampansare.github.io/padel-americano/ -o /tmp/live.html
node tests/fuzz/menu-churn.fuzz.cjs /tmp/live.html
```

## What "forced vs avoidable" means

A no-repeat schedule isn't always mathematically possible: with N players you can only
make N-1 distinct partnerships per person, so a tournament longer than that *must* repeat,
and once rounds are played you can't un-play them to fix a later squeeze. The fuzzers only
flag a repeat as a bug when a no-repeat alternative provably exists (found by independently
re-drawing the remaining rounds many times). Repeats that are mathematically forced are
reported but not failures.

## Known, intentional non-zero case

8 players playing **exactly** 7 rounds (the 1-factorization limit — every possible unique
pairing used) **with skill-balancing on**: ~1% of tournaments get one repeated pair. The
single no-repeat arrangement isn't skill-balanced, and the engine is configured to prefer a
balanced match there. Tunable (make repeat-avoidance dominate skill) but deliberately left
as the skill-vs-variety trade-off. Realistic configs (e.g. 10 players / 8 rounds) are 0.000%.
