# 🎾 Americano — Padel Tournament App

A free, single-file web app for running padel **Americano** and **Mexicano** sessions.
No accounts, no server, no install — everything runs and saves in your browser.

## How to use

**Open `index.html` in any browser.** That's it.

- **On your phone (recommended, it's designed for courtside use):** AirDrop / WhatsApp the
  `index.html` file to yourself and open it in Safari/Chrome — or host it anywhere
  (see below) and open the link.
- Everything autosaves to the browser's local storage on every tap: player names, draws,
  scores, settings. Close the browser, come back later, it's all there.
  ⚠️ It saves *per browser per device* — run the tournament from one phone.

### Hosting it (optional, makes a shareable link)

Any static host works since it's one file. Quickest options:
- [drop it on Netlify](https://app.netlify.com/drop) (drag & drop, free)
- GitHub Pages, Vercel, S3 — anything that serves a file

## Running a session (your 10-player / 2-court / 2-hour case)

1. Enter the 10 names (they're remembered for next time).
2. Courts: **2** · Format: **Americano** · Points: **24** · Session: **2h** → suggests **8 rounds**.
3. Tap **Start tournament** — round 1 is drawn instantly.
4. Each round shows two court cards + who sits out. **Tap a card** to enter the score
   (slide or +/−; the second team's score fills itself). Tap again to edit or clear.
5. When a round is complete, tap **Draw round N+1**.
6. **Standings** tab shows the live leaderboard with movement arrows.
7. After the last round: **Finish & crown winner** → podium + final table + copy-to-clipboard
   results for the group chat. You can always add "one more round" instead.

## Features

| | |
|---|---|
| **Formats** | Americano (rotating partners) · Mexicano (round ≥2 drawn from standings: 1st+4th vs 2nd+3rd per court) |
| **Fair draws** | Never sits anyone out twice in a row · equal games for everyone (±1) · minimises repeated partners, then repeated opponents · sit-out counts shown on chips and in standings |
| **Scoring** | Points per match: 16 / 21 / 24 / 32 / custom · Combined-total entry (slider, +/− or type the number) or free entry (timed rounds, any score, draws allowed) · optional neutral sit-out compensation (+½ match points per rest) |
| **Ranking** | Total points → point diff → wins → name · or "wins first" mode |
| **Flexible** | Rounds drawn one at a time · add / rename / remove / **rejoin** players mid-session (results kept) · change court count mid-session · re-draw an unscored round · add extra rounds · edit any past score |
| **Organizing** | Optional per-round countdown timer · **TV mode** (fullscreen standings + draws for a tablet/screen) · copy round draws or standings as text for WhatsApp · export/import backup file (move devices, keep records) · Rules & Help built in |
| **Extras** | 2-hour session countdown in the header · per-player games estimate at setup · past-tournament archive · works offline once loaded |

With 10 players, 2 courts and 8 rounds, simulations (200 runs) show: **0 consecutive
sit-outs, 6–7 games each, 0 repeated partners** — everyone gets a new partner every match.

## Rules used (researched 2026-06)

- Each match races to a **combined** total (24 standard, 32 = equal serves); both partners
  bank their team's score individually; highest individual total wins the day.
- Serve changes every 4 points (it's on the card hint; the app doesn't track serves).
- Tie-breaks: total points, then point difference, then wins.
- Mexicano: round 1 random, then per-court groups of 4 by live standings, 1st+4th vs 2nd+3rd.

Sources: [padelmix.app](https://padelmix.app/americano-padel) ·
[americano-padel.app rules guide](https://americano-padel.app/en/blog/americano-padel-rules-complete-guide/) ·
[padel.fyi](https://www.padel.fyi/articles/what-is-a-padel-americano/) ·
[pistas365](https://pistas365.com/padel/information/rules/americano-tournament/) ·
[liveforpadel — Mexicano](https://www.liveforpadel.com/blog/padel-mexicano-rules)

## Project layout

```
index.html            the whole app (engine + UI, ~2k lines, zero dependencies)
tests/engine.test.cjs node simulations — run: node tests/engine.test.cjs
docs/                 design doc + screenshots
```

The tournament engine lives in `index.html` between `/*ENGINE-START*/ … /*ENGINE-END*/`
markers; the test file extracts and tests exactly the shipped code (13k+ assertions).
