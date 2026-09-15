# FantasyForge Enhancement Backlog

A self-contained backlog for agents or contributors picking up work on FantasyForge. Each open item says **why** it matters, **where** to work, a suggested **approach** and **done when** criteria.

Last updated: 2026-09-15, after the enhancement backlog branch (`enhancements/backlog`) implemented almost everything from the first backlog. See [section 3](#3-completed) for what shipped.

---

## 0. Before you start

### Ground rules
- Run `npm run lint && npm run typecheck && npm test` before opening a PR. For UI changes, also run `npm run build && npm run test:e2e`; locally, `E2E_CHANNEL=chrome` uses your installed Chrome.
- **CI:** `.github/workflows/ci.yml` runs the unit checks, `next build`, the Playwright + axe browser suite, a Docker build and a gitleaks secret scan.
- **Merging to `main` deploys.** `.github/workflows/release.yml` publishes `ghcr.io/mikesawayda-adaptivesoftware/fantasy-forge:latest` (a private package), and Watchtower on the Unraid host rolls the container within about 5 minutes. Don't merge anything you haven't verified.
- Never commit credentials. `deploy.sh` and CI both block obvious secret files.
- Keep pure logic in `lib/*.ts` with Vitest tests in `tests/`. Components should stay thin.
- **Mock data:** browser tests mock every network call in `tests/e2e/fixtures.ts`. When you change a data shape, update that file too.
- **Style:** 2-space indent, single quotes, Tailwind utility classes, short comments that explain *why*, and AA color contrast (the axe tests enforce it).

### Architecture in one minute

```text
Browser ─▶ /api/nfl/* (app/api) ─▶ lib/server/sleeper.ts (in-memory cache, trims payloads) ─▶ Sleeper
   │         state · players (+ live injuries) · weekly/{stats|projections}/{season}/{week}[?idp=1]
   │         schedule/{season} (+ kickoff, live score) · defense · trending
   └─▶ Sleeper directly (lib/sleeper.ts): user, leagues, rosters, users, matchups, transactions, traded picks
```

| Concern | File(s) |
| :--- | :--- |
| Shared page data (players, week, schedule, projections, game logs, matchup ratings) | `lib/hooks/useFantasyData.ts` |
| League dashboard data / the user's leagues / keyed async loads | `lib/hooks/useLeagueData.ts`, `lib/hooks/useUserLeagues.ts`, `lib/hooks/useAsync.ts` |
| Season/week resolution, schedule helpers | `lib/nfl.ts` |
| Scoring presets and calculator | `lib/points.ts` |
| Game logs (per-week team/opponent), averages, ranks, `blendedValue` | `lib/season.ts` |
| Defense-vs-position ratings (any scoring), grades, strength of schedule | `lib/matchups.ts` |
| Lineup optimizer (Hungarian assignment; offense + IDP slots) | `lib/lineup.ts` |
| Roster lineup analysis, game state/locks, league shape (IDP, dynasty, starters per position) | `lib/league.ts` |
| Power rankings / standings order | `lib/power-rankings.ts` |
| Playoff odds (Monte Carlo) | `lib/playoff-odds.ts` |
| Waiver suggestions / trade finder | `lib/waivers.ts`, `lib/trade-finder.ts` |
| Compare (2–4 players), start/sit, trade analysis | `lib/scoring.ts` |
| Dynasty age curves and draft picks | `lib/dynasty.ts` |
| Transactions normalization | `lib/transactions.ts` |
| Installable app | `app/manifest.ts`, `public/sw.js`, `components/layout/ServiceWorkerRegister.tsx` |

### Verified data facts (don't re-derive)
- **Scoring:** points = Σ `stats[k] × scoring_settings[k]`. The presets match Sleeper's `pts_*` totals; in 2026, Sleeper scores `pts_allow_14_20` as +1.
- **Weekly stats with teams:** `https://api.sleeper.com/stats/nfl/{season}/{week}?season_type=regular&position[]=QB…` (undocumented web API) returns rows with `team`, `opponent`, `game_id`, `stats` and a `player` object that includes injury fields. The v1 stats endpoint is the fallback.
- **Live injuries:** `https://api.sleeper.com/projections/nfl/{season}/{week}?season_type=regular` rows embed `injury_status`, `injury_body_part`, `injury_notes` and `news_updated` for every projected player.
- **Kickoff and live scores:** `https://api.sleeper.com/scores/nfl/regular/{season}/{week}` returns games whose `metadata` has `home_team`, `away_team`, `date_time` (UTC kickoff), `is_in_progress`, `is_over`, `home_score`, `away_score`, `quarter` and `time_remaining`.
- **Schedule:** `https://api.sleeper.app/schedule/nfl/regular/{season}` returns `{week, home, away, date, status}`, with a date but no time.
- **Opponent points by position:** team DEF stat rows have `fan_pts_allow_{qb,rb,wr,te,k,def}` (PPR, scored by the opponent's players).
- **League endpoints:** these are verified and in use:
  - `/league/{id}/transactions/{week}`: `adds`/`drops` map player→roster, plus `draft_picks`, `waiver_budget` and `settings.waiver_bid`
  - `/league/{id}/traded_picks`: `roster_id` is the original owner, `owner_id` the current one
  - future `/league/{id}/matchups/{week}` responses carry `matchup_id` pairs

  `winners_bracket`/`losers_bracket` (`{r, m, t1, t2, w, l, p, t1_from, t2_from}`) are verified but not used yet.
- **Player DB:** `/v1/players/nfl` is about 15 MB. Sleeper asks that it be called sparingly; the server caches it for 12 h and overlays injuries every 20 minutes.

---

## 1. Open items

### 1.1 Real-account checks – mostly done; confirm on a Sunday (P1)
- **Done 2026-09-15** during Monday Night Football with the owner's account (2 redraft leagues: 12-team Half PPR, 8-team PPR). Checked and working:
  - This Week live scores, game clock and projected finals
  - Kickoff locks on the Lineup tab
  - My Roster, Standings and Transactions
  - Playoff Odds
  - My Teams (live scores, exposure)
  - Waivers (upcoming-week projections, IR tip)
  - Trade finder: 1.3 s for 12 teams and 0.9 s for 8, with no long frames
- **Fixed as a result:**
  - projections now move to the upcoming week once every game has kicked off
  - preseason playoff odds use projected lineups instead of a flat 50%
  - My Teams shows live scores
  - the trade finder only shows deals worth at least 1 point per week
  - waivers suggest using an open IR slot
  - the standings cutoff line is hidden when every team makes the playoffs
- **Still to verify:**
  - a Sunday early window, where players should lock at 1pm and swaps between locked and unlocked players should behave
  - a dynasty league (picks), an IDP league and a superflex league. Owner leagues don't cover these; use a friend's public league ID.
- **Done when:** those are checked, and any bugs are fixed with tests.

### 1.2 Push notifications for lineup problems (P2)
- **Why:** the app is installable, but alerts like "a starter was ruled out" still require opening it.
- **Approach:**
  1. Generate VAPID keys (see Campsite Finder's `infra/README.md` for the web-push setup).
  2. Store push subscriptions server-side per Sleeper username and league. This app has no database, so add a small SQLite or JSON store on a Docker volume, or reuse an existing Supabase.
  3. Run a scheduled server job, e.g. every 15 minutes on game days, that reuses `analyzeRosterLineup` to detect new inactive or questionable starters and sends pushes.
  4. Add a `push` handler to `public/sw.js`.
- **Done when:** a user can opt in per league, receives one alert per new issue, and can unsubscribe.

### 1.3 Model divisions and custom tiebreakers in playoff odds (P2)
- **Why:** `simulatePlayoffOdds` seeds by record, then points for, and ignores divisions (`settings.divisions`, `roster.settings.division`) and leagues that seed by points.
- **Approach:** Read division settings and reserve division-winner seeds before wildcards. Support `playoff_seed_type` if Sleeper exposes it (verify the values first).
- **Done when:** division leagues show division-winner seeding, covered by tests.

### 1.4 Tune the dynasty heuristics (P3)
- **Why:** the age curves and pick values in `lib/dynasty.ts` are heuristics. The next draft's picks use current standings to guess draft slots; future years use a flat 0.85 discount per year.
- **Approach:** Calibrate against a public dynasty trade-value source (check its terms), or learn values from completed trades in the user's leagues via transactions. Consider rookie draft ADP for pick values.
- **Done when:** values are sourced and documented, with tests updated.

### 1.5 Trade finder scale (P3)
- **Why:** `findTradesWithPartner` re-solves both lineups for every candidate, roughly 400 assignment solves per partner. It yields between teams, but very deep rosters or 14+ team leagues could take a few seconds.
- **Approach:** Measure on a real 14-team league first. If needed, move the search into a Web Worker, cache lineup totals per roster subset, or prune candidates that can't start for either team.
- **Done when:** the search finishes in under 3 s for a 14-team superflex league on a mid-range phone.

### 1.6 Resilience to Sleeper web API changes (P2)
- **Why:** per-week teams, live injuries and kickoff times use `api.sleeper.com`, which is undocumented. Stats fall back to v1 (without teams). Injuries and scores fail open: the 12 h injury data and date-based locks remain.
- **Approach:** Add a daily smoke check that calls each endpoint and validates its shape. Options are a small scheduled GitHub Actions workflow, or a health detail on `/api/health?deep=1`. Alert on failure, e.g. by opening an issue.
- **Done when:** a shape change is detected within a day.

### 1.7 Use the playoff bracket once the playoffs start (P3)
- **Why:** after the regular season, playoff odds only show final seeds.
- **Approach:** Read `/league/{id}/winners_bracket` and show the bracket with win probabilities for each remaining matchup, using the same team strength model.
- **Done when:** during the playoffs the Playoff Odds tab shows a live bracket with championship odds.

---

## 2. Ideas not yet scoped
- A draft assistant for startup and rookie drafts (`/draft/{id}/picks`, ADP).
- Keeper value calculator for keeper leagues (`settings.type === 1`).
- FAAB bid guidance using historical winning bids from league transactions.
- A best-ball view where lineups are auto-optimized (`settings.best_ball`).

---

## 3. Completed

All shipped on branch `enhancements/backlog` (see its PR).

| Former item | What shipped |
| :--- | :--- |
| Browser tests | Playwright suite with mocked Sleeper data (desktop and mobile) plus axe WCAG A/AA scans, in CI |
| Exact game-start detection | Kickoff times and live status from the scores feed; locks at kickoff with a date/points fallback |
| Matchup ratings in any scoring | `computeDefenseVsPositionForScoring`, with last season's PPR ratings rescaled as the prior |
| Opponents for traded players | Per-week team/opponent from stats rows; past-season logs show opponents |
| League-aware replacement levels | `startersPerPositionForLeague`; trade analyzer league mode |
| IDP support | DL/LB/DB/IDP_FLEX slots, IDP stats/projections (`?idp=1`), IDP free agents |
| Injury freshness | Injury overlay refreshed every 20 minutes from projection rows |
| Accessibility and mobile | WAI-ARIA tabs, focus rings, grade shape cues, AA contrast, responsive tables |
| Housekeeping | Unused assets removed; Actions on Node 24 |
| Playoff odds | Seeded Monte Carlo, median-game leagues, byes, clinch/elimination |
| Trade finder | 1-for-1 and 2-for-1 search across rosters |
| Multi-league dashboard | `/my-teams` with action items and exposure |
| Injury details | Body part, notes and update time in badges and on player pages |
| Transaction feed | League tab with trades/waivers/FAAB and a trending filter |
| Dynasty mode | Age curves and draft picks (traded picks applied) in trades |
| Charts and multi-compare | Weekly points chart; compare up to 4 players |
| PWA | Manifest, icons, service worker with offline fallback (push notifications are item 1.2) |
