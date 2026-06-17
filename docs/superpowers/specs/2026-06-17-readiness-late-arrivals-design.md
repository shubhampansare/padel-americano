# Design — Readiness / late-arrivals flow

**Date:** 2026-06-17
**Status:** Approved design, ready for implementation plan
**Target build:** v22

## Problem

The group rarely arrives all at once. With 12 entered and 2 courts, 8 might be present
while 4 are running late. Today the organiser either waits for everyone or starts and the
latecomers miss out cleanly. We want to **start as soon as the courts can be filled, let
latecomers fold in over the first rounds, but not let a partial roster run indefinitely.**

## Outcome

- Pressing **Start tournament** opens a **"Who's ready?"** check-in screen.
- The session can start once enough players are ticked to **fill every configured court
  (`courts × 4`)**.
- Latecomers can be ticked in **before round 2** and are drawn into the play from round 2 on.
- A partial roster may play **at most rounds 1–2**. **Round 3 is locked** until every entered
  player is either checked in **or** removed as a no-show.
- A tournament started with **everyone** ready behaves exactly as today — no new prompts ever.

## Terminology

- **Entered players** — names typed on the setup screen.
- **Arrived / ready** — checked in; in the draw. (`arrived: true`, `active: true`)
- **Pending** — entered but not yet checked in. (`arrived: false`, `active: false`)
- **Pending exists** — `t.players.some(p => p.arrived === false)`. This single condition drives
  every prompt and gate. No pending ⇒ the app behaves identically to the pre-feature build.

## Data model

One new per-player field: **`arrived`** (boolean).

- Absent / legacy ⇒ treated as `true`. Old saved tournaments and replays are untouched.
- A ready player: `{ active: true, arrived: true }`.
- A pending (late) player: `{ active: false, arrived: false }`.

Because pending players are `active: false`, the existing `activePlayers()` filter already
excludes them from every draw with no change. Marking someone ready flips both flags to
`true` and calls the existing `redrawFuture()`.

`pendingPlayers(t)` ⇒ `t.players.filter(p => p.arrived === false)` — new engine helper.

## UX

### Screen 1 — "Who's ready?" check-in (new, shown on Start)

Pressing **Start tournament** on the setup screen navigates here instead of creating the
tournament immediately.

- Lists **every entered player**. **Nobody is ticked by default.**
- A **Select all** toggle, plus a per-player tick.
- **No "+ Add player" here** — the entered list is fixed at this point; unexpected arrivals
  are added back on the setup screen first.
- Header shows the requirement, e.g. *"Need 8 (2 courts) · 6 ticked"*.
- **Start round 1** enables only when `ticked ≥ config.courts × 4`.
- Tick everyone ⇒ **full start** (no pending). Tick a subset ⇒ **partial start**.

Setup-screen change: the **Start tournament** button now requires `entered ≥ courts × 4`
(was `≥ 4`). This is the "fill all courts" rule the user chose — if turnout/roster is short,
the organiser lowers the court count in setup. Mid-session `courtsUsed` auto-reduction is
unchanged; this gate only governs the initial start.

### Sheet — mid-session readiness (new, only while pending exists)

A bottom sheet listing the **pending** players with tick toggles. Three trigger points:

1. **After round 1 completes, before round 2 — optional.** "Anyone arrived?" Tick latecomers
   in (they redraw into round 2) or **Continue** with the same group.
2. **On "redraw matchups" in partial mode — optional.** Same sheet first, so a just-arrived
   player lands in the redraw, then the redraw proceeds.
3. **Before round 3 — mandatory gate.** Round 3 stays locked until every pending player is
   ticked in **or** removed. Each pending row carries a **Remove (no-show)** action. Message
   when blocked: *"Check everyone in or remove no-shows before round 3."*

When `pendingPlayers(t)` becomes empty (all ticked in and/or removed), the tournament is a
normal full tournament — none of these prompts fire again.

## Engine changes

1. **`createTournament`** — accept a per-player `arrived` flag (default `true`). Pending
   players are created `active: false, arrived: false`.
2. **`pendingPlayers(t)`** — new helper (above); exported.
3. **`standings(t)`** — skip players with `arrived === false` so not-yet-arrived people don't
   appear as 0-point rows. (Players who arrived and later left keep `arrived: true` and still
   render as "(left)".)
4. **Mark-arrived path** — set `arrived: true, active: true`, then `redrawFuture(t)`. Reuses
   `reactivatePlayer`'s redraw; can be a thin wrapper (`markArrived`) or `reactivatePlayer`
   extended to also set `arrived`.
5. **Round-3 gate** — block reaching any round at 0-based index `>= 2` while
   `pendingPlayers(t).length > 0`:
   - Mexicano (lazy): `generateRound` throws.
   - Americano (pre-drawn, provisional rounds already locked until the prior finishes): the
     "can score / open round N" check additionally refuses index `>= 2` while pending exists.
   - Constant `PARTIAL_ROUND_CAP = 2` (fixed, not user-configurable).
6. **Remove no-show** — hard-delete a pending player from `t.players` (they have no matches or
   rests, so nothing to preserve). Distinct from `removePlayer`, which soft-deactivates an
   arrived player and keeps them in standings as "(left)".

### Format interactions

- **Americano** pre-draws the full schedule even on a partial start. Its future rounds are
  already provisional and `redrawFuture()` rewrites them on any roster change, so latecomers
  ticking in before round 2 redraw rounds 2+ automatically. The only added constraint is the
  round-3 lock.
- **Mexicano** draws lazily; round 2 is drawn fresh after round 1 and naturally includes
  whoever is active by then.

## Edge cases

- **Started full (no pending):** zero behaviour change anywhere; gates and sheets never fire.
- **All latecomers arrive by round 2:** pending empties, round 3 proceeds with no gate.
- **Some never arrive:** organiser removes them (no-show) before round 3 to unblock.
- **Entered < courts × 4:** setup Start button stays disabled — add players or reduce courts.
- **Unexpected extra player mid-session:** handled by the existing add-player roster setting,
  not the readiness sheet.
- **Legacy tournaments / replays (no `arrived` field):** `arrived === false` is never true, so
  they list, score, and replay exactly as before.

## Out of scope

- Per-player "available tonight" attendance roster (this is late-arrivals, not attendance).
- Configurable partial-round cap (fixed at 2).
- Adding brand-new (un-entered) players from the readiness screen.

## Testing

**Engine (`tests/engine.test.cjs`) — add assertions:**
- Create with some `arrived: false` ⇒ excluded from round-1 draw and from `standings`.
- `pendingPlayers` returns exactly the un-arrived set.
- Mark a pending player arrived ⇒ appears in the redrawn round 2; `redrawFuture` ran.
- Round-3 gate throws while pending exists (both formats); passes once pending empties.
- Remove no-show ⇒ gone from `t.players`; round 3 proceeds.
- Legacy tournament (no `arrived` field) ⇒ unchanged standings and draws.

**UI (Playwright, Chromium + WebKit per project rule):**
- Setup Start disabled below `courts × 4` entered; readiness Start disabled below `courts × 4`
  ticked.
- Partial start → round 1 with ticked players only.
- After round 1, sheet lets a latecomer in; round 2 visibly redraws to include them.
- Round 3 blocked with pending; unblocks after tick-in or no-show removal.
- Full start (Select all) → no sheets, identical to current flow.

## Release

- Bump `const BUILD` to `v22 · <date>`.
- `node tests/engine.test.cjs` green.
- Browser-verify both engines (Chromium + WebKit).
- Hold for explicit user approval before `git push` (per project release rule).
