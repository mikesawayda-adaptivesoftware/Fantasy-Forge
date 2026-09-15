# FantasyForge Enhancement Backlog

A self-contained backlog for agents or contributors picking up work on FantasyForge. Each item says **why** it matters, **where** to work, a suggested **approach**, and **done when** criteria. Items are grouped by type and roughly ordered by value within each group.

Last updated: 2026-09-14 (after the data-accuracy and league-features overhaul).

---

## 0. Before you start

### Ground rules
- Run `npm run lint && npm run typecheck && npm test` before opening a PR. CI (`.github/workflows/ci.yml`) runs the same checks, plus `next build`, a Docker build and a gitleaks secret scan.
- **Merging to `main` deploys.** `.github/workflows/release.yml` publishes `ghcr.io/mikesawayda-adaptivesoftware/fantasy-forge:latest` (a private package), and Watchtower on the Unraid host rolls the container. Don't merge anything you haven't verified.
- Never commit credentials. `deploy.sh` and CI both block obvious secret files.
- Keep pure logic in `lib/*.ts` with Vitest tests in `tests/`. Components should stay thin.
- Match the existing style: 2-space indent, single quotes, Tailwind utility classes, and short comments that explain *why*.

### Architecture in one minute

```text
Browser ─▶ /api/nfl/* (app/api) ─▶ lib/server/sleeper.ts (in-memory cache, trims payloads) ─▶ Sleeper
   │         state · players · weekly/{stats|projections}/{season}/{week} · schedule/{season}
   │         defense (defense-vs-position) · trending
   └─▶ Sleeper directly (lib/sleeper.ts) for user, leagues, rosters, league users, matchups
```

| Concern | File(s) |
| :--- | :--- |
| Shared page data (players, week, schedule, projections, game logs, matchups) | `lib/hooks/useFantasyData.ts` |
| League data (league, rosters, users, matchups, the signed-in user's team) | `lib/hooks/useLeagueData.ts` |
| Season/week resolution, schedule helpers, team names, image URLs | `lib/nfl.ts` |
| Scoring presets and the points calculator (stat key × scoring value) | `lib/points.ts` |
| Game logs, averages, positional ranks, `blendedValue` | `lib/season.ts` |
| Defense-vs-position ratings, matchup grades, strength of schedule | `lib/matchups.ts` |
| Lineup optimizer (Hungarian assignment over real roster slots) | `lib/lineup.ts` |
| Power rankings, standings order | `lib/power-rankings.ts` |
| Waiver add/drop suggestions | `lib/waivers.ts` |
| Compare, start/sit, trade analysis | `lib/scoring.ts` |
| League view helpers (unknown players, game state, bench) | `lib/league.ts` |
| League dashboard tabs | `components/league/*` |
| URL-synced selections / localStorage | `lib/hooks/useQueryParam.ts`, `lib/hooks/useLocalStorage.ts` |

### Verified data facts (don't re-derive)
- **Scoring keys:** Sleeper weekly stat lines use the same keys as league `scoring_settings`, so points = Σ `stats[k] × scoring[k]`. The presets in `lib/points.ts` match Sleeper's own `pts_ppr` / `pts_half_ppr` / `pts_std`. In 2026, Sleeper scores `pts_allow_14_20` as +1; the precomputed 2025 totals treated it as 0.
- **Opponent points by position:** each team DEF stat row has `fan_pts_allow_{qb,rb,wr,te,k,def}`, the PPR points the *opponent's* players scored at that position in that game.
- **Schedule:** `https://api.sleeper.app/schedule/nfl/regular/{season}` (undocumented) returns `{week, home, away, date, status, game_id}`. `date` is a day with no kickoff time. `status` is `pre_game` / `in_game` / `complete`.
- **Trending:** `/v1/players/nfl/trending/add?lookback_hours=24&limit=N` works.
- **Player DB size:** `/v1/players/nfl` is about 15 MB. Sleeper asks that it be called sparingly; the server caches it for 12 h.
- **Documented Sleeper endpoints this app doesn't use yet:**
  - `/league/{id}/transactions/{week}`
  - `/league/{id}/traded_picks`
  - `/league/{id}/winners_bracket`
  - `/league/{id}/losers_bracket`
  - `/draft/{id}`, `/draft/{id}/picks`

  Verify their response shapes before depending on them.

---

## 1. Verification and known limitations from the overhaul

These are gaps in work that has already shipped. Do them before building new features on top of it.

### 1.1 End-to-end check of the league tabs with a real account (P0)
- **Why:** This Week (`MatchupView`), Lineup (`LineupView`), My Roster (`RosterView`) and waiver add/drop suggestions have unit-tested logic but were never run against a real signed-in roster. Standings and Power Rankings *were* verified against a real league.
- **Approach:** Connect a real Sleeper username on `/my-leagues`, open an in-season league, and go through every tab, ideally on a game day. Check:
  - slot labels line up with starters;
  - live and projected totals look sane;
  - locked players aren't suggested as moves;
  - IR/taxi players appear in the right sections;
  - waiver suggestions never drop starters.
- **Done when:** any bugs found are fixed with regression tests, and a short note is added here.

### 1.2 Browser tests (P1)
- **Why:** there are no component or e2e tests. Pages were only smoke-tested by hand.
- **Approach:** Add Playwright with Sleeper responses mocked at the route or `fetch` layer. Store fixture JSON under `tests/fixtures/`, anonymized. Cover players list, compare (URL sync), league dashboard tabs, and waivers with a mocked user and league. Run it in `ci.yml`.
- **Done when:** CI runs the e2e suite headless and it passes.

### 1.3 Game-start detection is approximate (P1)
- **Why:** The schedule has no kickoff time. `playerGameState` (`lib/league.ts`) treats a player as started when the status is not `pre_game`, when they have points, or when the game date is earlier than today in UTC. Two consequences:
  - Sunday night games can lock early after 00:00 UTC.
  - Status can lag by up to about 90 seconds of cache.
- **Approach:** Find a source with kickoff times. Options: check whether Sleeper's schedule has one under a different query, or use the ESPN scoreboard API (verify its terms). Store the kickoff timestamp on `TeamGame` and use `now >= kickoff`.
- **Done when:** lineup locks match Sleeper's own locks within a minute, with tests for timezone edge cases.

### 1.4 Matchup ratings are PPR-only (P2)
- **Why:** `computeDefenseVsPosition` uses `fan_pts_allow_*`, which Sleeper computes in PPR. The grades mostly hold up in other formats, but the "allows X PPG" numbers are PPR.
- **Approach:** For the current season, compute points allowed by applying the active scoring to each opponent player's stat line, mapped through the schedule. Only use the current season, since roster moves break older mappings. Alternatively, scale by a per-position ratio of half-PPR to PPR. Then either run it client-side for the active scoring, or add a `?format=` parameter to `/api/nfl/defense`.
- **Done when:** a league using Standard or custom scoring sees points-allowed numbers in its own scoring.

### 1.5 Opponents in game logs for traded players (P2)
- **Why:** `buildPlayerSeasons` attaches opponents using the player's *current* team. That's wrong for weeks before a mid-season trade, and offseason logs hide opponents entirely.
- **Approach:** Infer each week's team by matching the player to the team whose DEF row shows opponent points. An easier option is to check whether the stat lines (or `/stats/nfl/player/{id}`) include a team field. Cache a per-week `playerId → team` map on the server.
- **Done when:** traded players show the correct opponents, and last season's logs show opponents again.

### 1.6 League-aware replacement levels (P2)
- **Why:** `computeReplacementLevels` (`lib/scoring.ts`) assumes a 12-team league with fixed starters per position. Trade values are off for 8-, 10- or 14-team and superflex leagues.
- **Approach:** When a league is selected, derive starters per position from `roster_positions × total_rosters`, splitting FLEX slots across eligible positions by share. Add a league selector to `/trade`, as `/waivers` has.
- **Done when:** trade values reflect the selected league's size and slots, with tests for superflex and 10-team setups.

### 1.7 IDP support in the optimizer and waivers (P3)
- **Why:** IDP players are now in the player payload so rosters display correctly, but slots like `DL`, `LB`, `DB` and `IDP_FLEX` are left unoptimized (`isSlotSupported`), and IDP stats aren't served.
- **Approach:**
  1. Add IDP eligibility to `SLOT_ELIGIBILITY`.
  2. Include IDP IDs in `getFantasyPlayerIds` when an IDP league is detected. Consider a separate `/api/nfl/weekly/idp/...` route to keep the default payload small.
  3. Score with league settings, which already include the `idp_*` keys.
- **Done when:** an IDP league gets full lineup optimization and IDP waiver suggestions.

### 1.8 Injury freshness vs. Sleeper's player-DB guidance (P3)
- **Why:** the player DB, which carries injury status, refreshes every 12 h. Sunday-morning inactives can be stale.
- **Approach:** Look for a lighter injury source; don't hammer `/players/nfl`. If none exists, refresh every 3 h from Thursday through Monday of game weeks. Document the choice in `lib/server/sleeper.ts`.
- **Done when:** injury tags are no more than about 3 h old on game days, and API usage stays modest.

### 1.9 Accessibility and mobile polish (P2)
- **Why:** matchup grades rely mostly on color, the league tabs lack arrow-key navigation, and wide tables (waivers, power rankings) scroll horizontally on phones.
- **Approach:**
  - Add text or icons alongside grade colors.
  - Implement the WAI-ARIA tabs pattern in `app/my-leagues/[leagueId]/page.tsx`.
  - Add stacked card layouts under the `sm` breakpoint for large tables.
  - Run axe.
- **Done when:** axe reports no serious issues, and the key pages are usable at 375 px wide.

### 1.10 Housekeeping (P3)
- Remove the unused Next.js starter assets in `public/` (`file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`).
- **First release run:** if `release.yml` fails with `permission_denied` / `write_package`, connect the existing `fantasy-forge` package to this repository in the GitHub package settings. The old image was pushed with a PAT and has no `org.opencontainers.image.source` label.
- **Server cache:** `lib/server/sleeper.ts` is per-process. That's fine for a single Unraid container. If the app is ever scaled out, move the cache to Redis or another shared store.

---

## 2. New features

### 2.1 Playoff odds (P1)
- **Why:** it's the most-asked question in any league after week 5.
- **Where:**
  - new `lib/playoff-odds.ts` with tests
  - new tab in `app/my-leagues/[leagueId]/page.tsx`
  - view `components/league/PlayoffOddsView.tsx`
- **Approach:**
  1. **Remaining schedule:** fetch matchups for each remaining regular-season week (`/league/{id}/matchups/{week}`). Future weeks may already have `matchup_id`s; verify. If not, document the fallback.
  2. **Team strength:** mean and standard deviation of weekly points from completed weeks (reuse `toWeeklyScores` in `lib/power-rankings.ts`), shrunk toward the league average early in the season.
  3. **Simulation:** Monte Carlo (10k runs, using a seeded RNG so tests are deterministic). Apply the tiebreakers from `compareStandings` and seed using `settings.playoff_teams`. Handle median or "vs league" scoring if the league setting indicates it (verify the key).
  4. **Output per team:** playoff %, bye % (if `playoff_teams` implies byes), average projected seed, and "magic number" style notes.
- **Done when:** odds sum to `playoff_teams × 100%`, tests cover clinched and eliminated edge cases, and the page renders in under 1 s for 12 teams.

### 2.2 Trade finder across league rosters (P1)
- **Why:** the trade analyzer only evaluates trades the user types in. Most users want suggestions.
- **Where:**
  - `lib/trade-finder.ts`
  - a league-aware mode on `/trade` (`?league=`) or a new league tab
- **Approach:**
  1. For each opponent roster, compute positional surplus and need using the lineup optimizer: the value lost by removing a player, and the value gained by adding one.
  2. Search 1-for-1 and 2-for-1 swaps where **both** teams' optimal-lineup value (`blendedValue`) improves, or where the user gains and the partner loses less than a threshold.
  3. Rank by the user's gain, weighted by how fair it is to the partner.
  4. Limit the search, e.g. top 12 candidates per team, so it stays fast.
- **Done when:** suggestions appear per team with both sides' gains, clicking one pre-fills `/trade?give=…&receive=…`, and tests cover a synthetic league.

### 2.3 Multi-league dashboard (P1)
- **Why:** many users play in several Sleeper leagues.
- **Where:** new route `app/dashboard/leagues/page.tsx`, or extend `/my-leagues`.
- **Approach:**
  1. For all in-season leagues, load rosters, matchups and league scoring in parallel.
  2. **Exposure:** players rostered across leagues, with counts.
  3. **Action items:** injured, bye-week or empty starters in any league (reuse the `LineupView` logic without UI), and optimizer gains per league.
  4. **This week:** projected result of each matchup.
- **Done when:** one page lists every lineup problem across leagues with deep links to the league's Lineup tab.

### 2.4 Injury details (P2)
- **Why:** "Questionable" means little without the body part and practice notes.
- **Where:**
  - `lib/server/sleeper.ts` `transformPlayer` currently drops `injury_body_part` and `injury_notes`
  - `types/index.ts` `Player`
  - `components/ui/InjuryBadge.tsx` (show a tooltip)
  - the player page
- **Approach:** Add optional `injuryBodyPart` and `injuryNotes` fields, keeping the payload lean (omit when empty). Show them in a tooltip and in the player page header.
- **Done when:** injured players show body part and notes, and the players payload grows by less than 10%.

### 2.5 League transaction feed (P2)
- **Where:** `lib/sleeper.ts` (new `getLeagueTransactions`), plus a new league tab.
- **Approach:**
  1. Fetch `/league/{id}/transactions/{week}` for recent weeks and verify the response shape: adds, drops, trades, FAAB bids and draft picks.
  2. Render a timeline with player names from `resolvePlayer` and team names from `getTeamName`.
  3. Optionally flag "who picked up trending players".
- **Done when:** the last 3 weeks of transactions render with correct team and player names, and there's a test for the parser.

### 2.6 Dynasty mode (P3)
- **Why:** dynasty leagues (`settings.type === 2`) value youth and draft picks, not just this week.
- **Approach:**
  - **Age curves:** per-position multipliers on `blendedValue` for trade and waiver valuation in dynasty leagues. Document their source.
  - **Draft picks:** read `/league/{id}/traded_picks` and assign a value to each pick (round and year) that can be added to trades.
  - **Taxi and rookies:** surface taxi squads (already shown in RosterView) and rookies' projections.
- **Done when:** dynasty leagues show age-adjusted trade values and picks can be added to trades.

### 2.7 Player page charts and multi-player compare (P3)
- **Weekly points chart:** add an actual-vs-projected chart to `app/players/[id]/page.tsx`. A small inline SVG avoids new dependencies. Projections per week are already lazily loaded there.
- **Compare 3–4 players:** generalize `comparePlayersHeadToHead` into a ranking function, and extend the URL params (`?players=a,b,c`).
- **Done when:** the chart renders for any player with games, and compare supports up to 4 players with shareable URLs.

### 2.8 PWA and notifications (P3)
- **Approach:** Add a manifest and a basic service worker for install-to-home-screen. Optional: web push for "a starter was ruled out" alerts. This needs a server-side job and stored subscriptions; the Campsite Finder repo has a VAPID/web-push setup worth copying.
- **Done when:** the app is installable, and alerts, if built, can be opted into per league.

---

## 3. How to pick an item
1. Take the highest-priority unchecked item that doesn't depend on unfinished ones (1.1 unblocks confidence in everything league-related).
2. Create a branch off `main` and add tests alongside the logic.
3. Open a PR describing the verification you did. Merging deploys, so say how you tested.
4. Update this file: mark the item done, or record new findings under section 1.
