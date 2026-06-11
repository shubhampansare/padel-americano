# Padel Americano Apps — Competitor & Pain-Point Research

Date: 2026-06-11. Research for the free Americano/Mexicano web app in this repo.
Method: 4 parallel research agents across App Store / Google Play reviews, product sites,
Product Hunt, GitHub, and review roundups. **Limitation:** reddit.com and DuckDuckGo both
block this environment's IP at the network level, so verbatim Reddit comment *bodies* could
not be retrieved. Reddit thread *titles/topics* (via search) and app-store reviews converge on
the same themes, so the findings are well-triangulated even without raw Reddit quotes.

---

## 1. The product landscape (your 5 + the ones you missed)

> ⚠️ **Naming collision warning** (a finding in itself, relevant to your own naming/SEO):
> there are at least 6 near-identical "americano padel" products. In particular:
> - **americano-padel.com** = Per Kodar's app (iOS/Android, freemium).
> - **americano-padel.app** = "Americano Padel Manager" — a *different* developer, different product.
> - **americanopadel.app** = a third, separate generator.
> - The App Store listing "Americano Padel – Padelmix" (id6505054587) is actually **PadelMix's** iOS app.

### Your list (confirmed)
| Name | Platform | Free/Paid | Notes |
|---|---|---|---|
| **VamosTamos** (vamostamos.app) | Web | Free, no signup, offline, TV mode | Your closest positioning twin (Americano+Mexicano, auto-rotation). No reviews/footprint — invisible, not bad. |
| **PadelMe.io** | Web | Fully free, no login | Open-source (github.com/ptzimmerman/Padel-Americano). **Americano only, no Mexicano.** Best at 8/12/16 players. 0 GitHub issues = undiscovered. |
| **PadelMix** (eu.rsapps.padel) | Web/iOS/Android | Freemium (surprise paywall) | Americano/Mexicano/mixed/team. No account. Good dev responsiveness. |
| **AmericanoPadel.app / "Americano Padel Manager"** | Web/iOS | Freemium | Unlimited players/courts, sharing, PDF/Excel export all **paywalled**. |
| **Padelicano** | iOS (paid ~$1.99) + Android | Paid up-front (iOS) | Americano/Mexicano/"Mixicano". 1.0★ in Norway over a rotation bug (see below). |

### Others you missed (well-evidenced)
| Name | Platform | Free/Paid | One-liner |
|---|---|---|---|
| **Americano Padel** (Per Kodar, se.perkodar.americanopadel) | iOS/Android | Free 1 court; Premium $4.99/mo, $19.99/yr, $159 lifetime | One of the oldest; ~4.6K Play reviews. Multi-court paywalled. |
| **Padel Americano – Round Robin** (Pluto Apps, id1626101352) | iOS | Free + IAP ($14.99–$119.99) | Americano/Mexicano/Mixicano, any count. "Repeats partners" bug. |
| **PadelFast / Padel Fast** | Web/iOS | Freemium | Mexicano 4–64 players, real-time scoring. |
| **Padelio** | Web/iOS/Android | Free (3 tournaments) / Pro €4.17/mo | Americano/Mexicano/KotC + leagues. "One sub, no per-person fees." |
| **Padelboard** (by MATCHi) | iOS + web | Free | Players follow via web. Some Swedish-only UI; no Super Mexicano/Mixed. |
| **FenixPlay** | Web/iOS/Android | Sub or pay-per-tournament | Round robin/Mexicano/elim/leagues; browser spectating. |
| **bracketmaker.app** | Web | Free (PDF/CSV) | Americano + Mixed generator, no account. |
| **PadelBracket** (padel-bracket.com) | Web | Free, no signup, offline | Americano for 4–24 players. |
| **PlayRez generator** | Web | Free, no signup | Classic/mexicano/mixicano/team, print/share. |
| **PadelPuffin** | Web | Free | Browser play, fewer formats. |
| **padelamericano.org** | Web | Free | Americano + Mexicano generator. |
| **Rankedin** | Web/iOS/Android | Freemium | Tournaments & leagues incl. Americano. |
| **PLAYINGA / Setteo / Padel Manager** | Web/mobile | Paid | Club-oriented tournament SaaS (lightly evidenced). |
| **Spreadsheet templates** (PadelMix, plexkits, Better Sheets) | Excel/Sheets | Free | The DIY fallback people use **when apps fail them**. |

### Found via Reddit (2nd pass, organizer threads)
| Name | Platform | Free/Paid | One-liner |
|---|---|---|---|
| **VamosTamos** | Web | Free, no limits | Already known; Reddit launch thread is a goldmine of user feedback (see §4). |
| **Lopadel** (lopadel.se) | Web | Free | Club favourite for Mexicano; browser on a tablet/TV. *Not* per-device score entry — one shared screen. |
| **Padelution** (padelution.com) | Web/app | Freemium | Finnish; "everyone switched from RankedIn." But **phone-number registration** puts organizers off. |
| **Padel Puffin** | Web | Free | Unlimited players, **auto-generates finals linked to live scores** (a feature people love). |
| **Satzpunkt** (satzpunkt.app) | Web | Free | Guests enter scores via QR/room code, no registration (founder claim). |
| **SliceWin** | App | — | Praised for handling "uneven players, sit-outs, late joiners, early-leavers"; phantom profiles claimable later. |
| **GameSet.io** | Web/iOS | Free | Dev admitted it **timed out >10 players** until they rewrote the backend. |
| **SYNTPadel** (syntpadel.com) | Web | Paid | Full lifecycle: signups, Stripe, TrueSkill ranking, auto court allocation. |
| **Round Robin Assistant** | App | Free 1 court | Same dev as Per Kodar; "unlimited round robin" handles changing weekly attendance. |
| **Tournify / Score7** | Web | Freemium | League tools; free tiers **count games, can't model sets** (a complaint). |
| **padel.id** | App | — | Phone login that **"never sends the 6-digit code"** (broken onboarding). |
| Also named: brackets.app, printyourbrackets.com, Padelgroup, CupsCreator, Padellog, League Lobster, ligaspel.se, Scorey, Double Happy | mixed | mixed | Discovery leads, lighter evidence. |

---

## 2. The common problems people actually hit

Ranked by how loudly and how often they recur across reviews.

### A. "Free" that isn't — surprise paywalls (loudest complaint)
- PadelMix, UK App Store, 2★ *"Not free"*: *"lures you in as if it is free. However, after I'd used it a few times a notice came up to say I now had to pay £39.99 a year… I'd promised to use it for a friendly Americano of 8 people, 2 courts so I paid the £2.99 but will now be unsubscribing."*
- Multi-court is paywalled across Per Kodar, Americano Padel Manager, and others — and multi-court is the *actual* use case for any real group event.
- Billing anger: users "charged annual instead of monthly," "charged a full year instead of a week trial," support tickets "automatically closed."

### B. The rotation/pairing algorithm is broken (the category's core failure)
- **Uneven games / unfair sit-outs:** *"sometimes a player would play 3 times in a row, then not play twice in a row… some players had played two or even three more games than others."* (Per Kodar — they later shipped "fairer sit-out distribution," confirming it was real.)
- **Repeated partners:** Pluto app, 1★: *"In an Americano Tournament for 6 people it creates 6 rounds but repeats partners."* (Defeats the whole point of Americano.)
- **Broken on small/odd counts:** Padelicano, 1★ (Norway): *"Put in 5 players and it made 7 matches with one player out for 3 matches, 2 players out for 2 [rounds] and 2 players not out at all! Please money back."*
- **Only rotates 2 of 4:** PadelMix paid 20-person tournament — *"the app only rotated 2 players out of 4."*

### C. Mexicano done wrong
- *"With 8 players, round 1 starts with persons 1-4, round 2 with 5-8, round 3 comes back to 1-4"* — static groups instead of re-seeding by ranking, so it isn't really Mexicano. (Per Kodar; PadelMe.io simply doesn't offer Mexicano at all.)

### D. No live mid-tournament editing
- Top feature request on PadelMix: edit player count/names mid-tournament so a **no-show or late arrival** doesn't force recreating the whole event. No-shows are the *normal* case at casual meetups.

### E. Edge-case math & missing essentials
- Wrong round counts: *"setting up an americano with 20 people and it says 27 rounds instead of 19."*
- Courts don't rotate: *"My teams dont change courts."*
- Paid playoff broken: yearly-Premium user — *"Once all rounds finish, it won't let me run the playoff round."*
- *"If you fall outside anything on the settings there is no option for help."*

### F. Structural friction — accounts & bloat (esp. Playtomic)
- Playtomic requires **every player to have an account** to join — huge friction for running an americano for 8 friends.
- Its Level/rating system is widely distrusted (people make smurf accounts to game it), and it's *"over-engineered, full of useless features."* Reddit thread topics like *"Other than Playtomic, what match scheduling software…"* and *"Any alternatives to playtomic?"* show organizers actively seeking lighter tools.

### G. Apps fall apart at scale → people retreat to spreadsheets
- *"Excel + WhatsApp… falls apart past 16–20 pairs… spectators left in the dark."* The steady demand for Excel/Sheets templates is itself evidence the apps aren't meeting the need.
- *"I organize americano… 16–20 players on 3–4 courts… [Excel] takes forever to set up each time, and updating scores mid-tournament while also playing is a nightmare."*

---

## 2b. Reddit deep-dive — organizer voices (2nd-pass research)

Verbatim quotes pulled directly from r/padel threads (full URLs in Sources). These add
texture the app-store reviews missed and **surface several things that affect this app directly**.

### The Mexicano pairing rule is contested — make it a setting, not a hardcoded default
This is the single most important new finding. Organizers actively disagree on how Mexicano
should pair the four players in a court by rank, and current apps expose too little control:
- PadelMix organizer: *"people are getting annoyed with repeating partners… there's only a 1&3,2&4 or 1&4&2&3 option."*
- Mexicano-app organizer: *"I would like it to be 1&3 vs 2&4… [padelamericano.org] is 1&2 vs 3&4 — then the two best stay fixed at court 1 and just make the lead bigger and bigger. Maybe 1&4 vs 2&3 is better and would give more changing in the top?"*
- **VamosTamos user (key data point):** *"it seems the Mexicano is 1&3 vs 2&4, whereas normally I've found 1&4 vs 2&3… I can recommend the other way, I noticed because players in 11&13 kept playing together and it seemed less dynamic."*
- **Implication for us:** our app hardcodes **1st+4th vs 2nd+3rd** — which is exactly the variant users say is *more dynamic / less repetitive*. So our default is the well-regarded one. But the demand is for a **toggle** (1+4 v 2+3 / 1+3 v 2+4 / 1+2 v 3+4) plus optional manual round-1 seeding.

### "Equal games is impossible with 6" — surface the math, don't hide it
- Organizer comparing 3 generators for 6 players, all giving different schedules: *"What's the correct/expected schedule?"* Answer from another user: *"In Americano you cannot have equal number of matches for everyone with 6 players. You can with 4, 5 or 8."*
- Some apps silently give the sit-out player **compensation points**, which backfires: *"it's actually massively beneficial to miss games in terms of points… in more serious sessions this would cause issues."*
- **Implication for us:** our engine keeps games within ±1 and gives resters **zero** (no compensation), which is the safe choice. Worth **showing a one-line note** when equal play is mathematically impossible for the player count, so it reads as intentional, not a bug.

### Editing past scores in Mexicano is a known hard problem — we already beat it
- VamosTamos founder: *"I added the ability to edit results. It works only for Americano… for Mexicano pairs are based on score and the app would need to recreate pairs, which is confusing."*
- **Implication for us:** our leaderboard always recomputes from raw scores, and already-played pairings stay as they were played (correct — they happened). We verified score-editing works for **both** formats in testing. This is a genuine advantage to keep.

### Onboarding friction is a real differentiator
- *"I came across Padelution before but having to register and enter a phone number just to get started put me off."*
- *"Padelbord app — players enter their own scores, everyone must have the app."*
- padel.id: *"asks for a phone number… never sends the 6-digit code."*
- Organizer willingness-to-pay split: *"It's okay if the creator (me) needs to pay, but the friends who join should get free view access."* → spectator/TV link with no account is the wedge.

### Live-screen UX details that actually bite (from the VamosTamos thread)
Real bugs users reported there — a checklist of what to get right (we already handle most):
- *"default is 21. If you delete 21 and put in 24, the system puts in a '1' you can't delete."* → we use a slider+stepper, no free-text trap. ✅
- *"make it possible to see the standings after each round"* / *"see the leaderboard without ending the tournament."* → we show standings anytime (tab on mobile, side-by-side on desktop). ✅
- *"add previous/next round buttons."* → we have round nav. ✅
- *"the TV page is broken, cannot see the full table."* → our desktop dual-pane is effectively this; a dedicated full-screen TV mode is still a nice-to-have.

### Recurring feature requests (across VamosTamos & padelamericano.org threads)
Ranked by how often they appear: **fixed-partner mode** ("play always with the same pair — we do that a lot in Portugal"), **a final/playoff generated from live standings** (Padel Puffin is loved for this), **timed rounds** ("play for 16 minutes, leader wins"), **alternative scoring** (sets / first-to-N games, not just points), **mixed-gender flag**, **long-term rankings/history across weekly sessions** (*"Americano apps do not track results long term"*), and **Android/mobile-web** rather than a forced download.

---

## 3. What this means for your app (opportunity map)

Every pain point above is something your build already addresses or easily can:

1. **Genuinely free, no paywall, no accounts** — kills complaint categories A and F outright.
2. **Provably fair rotation** — your engine already enforces no consecutive sit-outs, equal games (±1), and zero partner-repeats in 8 rounds (13k+ tested assertions). This is *the* thing competitors get wrong. **Make it visible** — a per-player "games / sit-outs" counter would directly answer the #1 rage trigger.
3. **Correct Mexicano laddering** (1st+4th vs 2nd+3rd by live standings) — you already do this; competitors fake it.
4. **Live mid-tournament editing** — you already support add/remove player mid-session. Lead with it; it's a top unmet request.
5. **Robust edge cases not paywalled** — multi-court, odd numbers, extra rounds, score editing all free. Worth QA-hardening odd counts (5/7/9/11) since that's where rivals visibly break.
6. **Offline + browser share for spectators** — you have offline; a read-only share link / TV mode would match VamosTamos and Per Kodar's best feature.
7. **Pick a distinctive name** — the "americano padel" namespace is a saturated SEO minefield (6+ collisions). "Americano" alone won't be findable.

**Newly actionable from the Reddit pass (ranked by value/effort for the build):**
1. **Configurable Mexicano pairing** (1+4 v 2+3 default, plus 1+3 v 2+4 and 1+2 v 3+4) + optional manual round-1 seeding. Cheap, and the most-requested Mexicano control. *(Engine: `mexicanoMatches` currently hardcodes the grouping.)*
2. **Visible fairness panel** — per-player games / sit-outs / partner-repeats / opponent-repeats, plus a one-line note when equal play is impossible for the count. Turns our biggest hidden strength into a visible selling point.
3. **Read-only spectator / TV link** — organizer pays nothing, friends view standings with no account. The clearest onboarding-friction wedge.
4. **Fixed-partner mode** — top recurring request; lets the same tool run team-Americano nights.
5. **Final/playoff from live standings** — Padel Puffin is specifically loved for this.
6. **Later:** timed rounds, sets/games scoring, mixed-gender flag, long-term cross-session rankings ("community mode"), PDF/CSV export.

Gaps worth considering later (things rivals have that you don't): knockout/playoff bracket finale, PDF/CSV export, tennis-style/sets scoring, big-screen "TV mode," read-only spectator link, recurring-community rankings.

---

## Sources
App Store: [PadelMix](https://apps.apple.com/gb/app/americano-padel-padelmix/id6505054587) ·
[Per Kodar Americano Padel](https://apps.apple.com/us/app/americano-padel/id1536633475) ·
[Pluto Round Robin](https://apps.apple.com/us/app/padel-americano-round-robin/id1626101352) ·
[Padelicano (NO)](https://apps.apple.com/no/app/padelicano/id6745820501)
Google Play: [Per Kodar](https://play.google.com/store/apps/details?id=se.perkodar.americanopadel) ·
[PadelMix](https://play.google.com/store/apps/details?id=eu.rsapps.padel)
Sites: [PadelMix](https://padelmix.app/) · [Americano Padel Manager](https://americano-padel.app/en/) ·
[americano-padel.com](https://americano-padel.com/) · [VamosTamos](https://vamostamos.app/) ·
[PadelMe.io](https://padelme.io/) ([repo](https://github.com/ptzimmerman/Padel-Americano)) ·
[PadelFast](https://www.padelfast.com/) · [Padelio](https://www.padelio.org/) ·
[Padelboard](https://padelboard.app/) · [FenixPlay](https://fenixplay.app/) ·
[PadelBracket](https://padel-bracket.com/americano/) · [PlayRez](https://playrez.com/tools/padel-americano-generator) ·
[bracketmaker](https://bracketmaker.app/round-robin/padel-americano/) · [PadelPuffin](https://padelpuffin.com/americano) ·
[padelamericano.org](https://www.padelamericano.org/) · [Rankedin](https://rankedin.com/)
Community/context: [Product Hunt – PadelMix](https://www.producthunt.com/products/padelmix) ·
[No Strings Padel – Playtomic ratings](https://clubhouse.nostringspadel.com/the-playtomic-app-are-player-ratings-accurate-2/) ·
[Playtomic Help – account required](https://playerhelp.playtomic.com/hc/en-gb/articles/19832151055121-How-to-sign-up-for-an-Open-Match) ·
[FenixPlay comparison](https://fenixplay.app/en/blog/mejores-apps-torneos-padel/) ·
[SimplePadel](https://simplepadel.com/how-to-play-an-americano-in-padel/) ·
[plexkits templates](https://plexkits.com/padel-tournament-templates-excel-google-sheets/)
Reddit (2nd-pass, retrieved manually via ChatGPT browsing — verbatim quotes in §2b):
[Issues with Mexicano & PadelMix](https://www.reddit.com/r/padel/comments/1jcem05/issues_with_mexicano_and_padelmix_app/) ·
[How do you manage your americano logistics](https://www.reddit.com/r/padel/comments/1tn2of5/how_do_you_manage_your_americano_tournaments/) ·
[VamosTamos launch (rich feedback)](https://www.reddit.com/r/padel/comments/1ptqjie/yet_another_free_americano_mexicano_padel_scoring/) ·
[Mexicano app (pairing debate)](https://www.reddit.com/r/padel/comments/1mmkxxn/mexicano_app/) ·
[6-player schedule question](https://www.reddit.com/r/padel/comments/1e6z451/i_have_a_question_about_padel_americano/) ·
[Feedback for my americano website](https://www.reddit.com/r/padel/comments/1i5vxb7/feedback_for_my_americano_website/) ·
[App/method for scores & rankings](https://www.reddit.com/r/padel/comments/1g0r49j/app_or_alternative_method_to_keep_scores_and/) ·
[What tools for tournament mgmt](https://www.reddit.com/r/padel/comments/1e1aq09/what_tools_do_you_use_for_tournament_management/) ·
[Best app for Mexicano](https://www.reddit.com/r/padel/comments/1ioigzr/best_app_for_mexicano_tournament/) ·
[Tournament software advice](https://www.reddit.com/r/padel/comments/16f6gkt/tournament_software_advice/) ·
[PadelFast launch](https://www.reddit.com/r/padel/comments/zs2kh7/ive_created_a_tool_for_padel_tournaments/) ·
[Padelicano launch](https://www.reddit.com/r/padel/comments/1luiyo9/tired_of_americano_apps_with_subscription_walls_i/) ·
[Americano style tournaments are the best](https://www.reddit.com/r/padel/comments/1t0mmik/americano_style_tournaments_are_the_best/) ·
[Badminton 6-player app sit-out](https://www.reddit.com/r/badminton/comments/1q6qmf7/trying_to_decide_whether_to_rent_a_court_with_5/) ·
[Playtomic club/player questions](https://www.reddit.com/r/padel/comments/1l31sen/questions_for_clubs_and_players_using_playtomic/)

Note: the AmericanoPadel.app recommendation in the logistics thread was flagged by another
user as likely self-promotion; the r/badminton "AmericanoPadel" sit-out complaint can't be
confidently attributed to a specific product. No verifiable complaints surfaced for PadelMe.io,
FenixPlay, PlayRez, or the Pluto app in this pass.
