# 🏈 FantasyForge

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

FantasyForge is an NFL fantasy football analysis app for Sleeper league managers. Built with **Next.js 16 (App Router)**, **React 19** and **Tailwind CSS 4**, it turns Sleeper's public data into league-aware lineup, matchup, waiver and trade decisions.

[Features](#-key-features) • [Getting Started](#-getting-started) • [Deployment](#-deployment) • [How it works](#-how-it-works) • [Roadmap](#-roadmap)

---

## 🌟 Key Features

### 🗂️ My Teams (every league at once)
- Starters who won't play, questionable starters, empty slots and lineup upgrades across all of your Sleeper teams – each scored with its own league settings.
- Projected result of every matchup and the players you roster in multiple leagues.

### 🏆 League Dashboard (Sleeper)
- **This Week:** live scores with game clock, projected finals, and starters labeled by slot (FLEX, SUPER_FLEX, IDP…).
- **Lineup Optimizer:** the highest-projected legal lineup for your league's exact slots (including IDP), skipping byes and inactive players and locking players at kickoff.
- **Playoff Odds:** 5,000-run Monte Carlo of the remaining schedule – playoff, bye and #1 seed chances, median-game leagues supported.
- **Power Rankings:** all-play record, luck, points per game, lineup efficiency and recent form.
- **Transactions:** trades, waiver claims (with FAAB bids) and free-agent moves, with a trending-pickup filter.
- **Standings & Roster:** correct tiebreakers, bench, IR and taxi squads.

### 📋 Waiver Wire
- Available players with projections, recent form and upcoming schedule strength; IDP players in IDP leagues.
- **Trending pickups** still available in your league and **add/drop suggestions** measured by improvement to your optimal lineup.

### 🛡️ Matchup Ratings
- Defense-vs-position ratings for all 32 teams **in your scoring system**, built from every player's weekly line and opponent, blended with last season early on.
- Weekly grades (with shape cues) and rest-of-season strength of schedule everywhere players appear.

### 🔄 Trades
- Values players over replacement level – in league mode, replacement levels come from your league's size and roster slots.
- **Dynasty leagues:** age-adjusted values and draft picks (traded picks applied, valued by round, year and projected slot).
- **Trade finder:** searches every roster for 1-for-1 and 2-for-1 deals that improve your lineup without hurting the other team.

### 🏈 Players, Compare & Start/Sit
- **Player pages:** live injury details, weekly actual-vs-projected chart, game logs with the right team and opponent (even after trades), upcoming matchups.
- **Compare up to 4 players** and **Start/Sit** using projection, sample-size-weighted production, consistency, injuries, byes and matchup. Shareable URLs.
- **Installable app** (PWA) with an offline fallback.

---

## 🛠️ Tech Stack

- **Core:** [Next.js 16](https://nextjs.org/) (App Router) & [React 19](https://react.dev/)
- **Language:** [TypeScript](https://www.typescriptlang.org/) (strict)
- **Styling:** [Tailwind CSS 4](https://tailwindcss.com/)
- **Tests:** [Vitest](https://vitest.dev/)
- **Data:** [Sleeper API](https://docs.sleeper.com/) (no API key required)

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** 22 LTS (20.9+ works for the app; tests need 20.19+/22)
- **npm** 10+

### Installation

```bash
git clone https://github.com/mikesawayda-adaptivesoftware/Fantasy-Forge.git
cd Fantasy-Forge
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript type-check |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | Browser + accessibility tests (Playwright + axe; run `npm run build` first, `E2E_CHANNEL=chrome` to use local Chrome) |

CI runs lint, type-check, unit tests, browser tests, a Docker build and a secret scan on pull requests; merges to `main` publish a new Docker image (see [Deployment](#-deployment)).

---

## 🐳 Deployment

### Automatic (GitHub Actions → GHCR → Watchtower)

| Workflow | Runs on | Does |
| :--- | :--- | :--- |
| `ci.yml` | Pull requests, non-main branches | Lint, type-check, tests, Next build, Docker build, secret scan |
| `release.yml` | Merge/push to `main` (non-doc changes), manual dispatch | Lint, type-check, tests, then builds `linux/amd64` and pushes `ghcr.io/mikesawayda-adaptivesoftware/fantasy-forge` |

Each release is tagged `latest` and `sha-<full commit sha>`. The package is **private**; publishing uses the workflow's `GITHUB_TOKEN`, so no registry secret is stored in the repo.

On Unraid, Watchtower polls GHCR and restarts the `fantasy-forge` container when `:latest` changes – merging to `main` deploys the site. Because the image is private, the host and Watchtower need GHCR credentials (a classic PAT with `read:packages`):

```bash
echo '<PAT with read:packages>' | docker login ghcr.io -u mikesawayda-adaptivesoftware --password-stdin

docker run -d --name fantasy-forge --restart unless-stopped \
  -p 3085:3000 \
  --label com.centurylinklabs.watchtower.enable=true \
  ghcr.io/mikesawayda-adaptivesoftware/fantasy-forge:latest
```

Watchtower reads registry auth from a Docker `config.json` mounted at `/config.json` (e.g. `-v /root/.docker/config.json:/config.json:ro`). The label only matters if Watchtower runs with `WATCHTOWER_LABEL_ENABLE=true`.

**Rollback:** run a specific `ghcr.io/mikesawayda-adaptivesoftware/fantasy-forge:sha-<commit>` tag (and stop Watchtower from updating it, or re-merge a revert).

### Manual

```bash
docker build -t fantasy-forge:latest .
docker run -d -p 3000:3000 --name fantasy-forge fantasy-forge:latest
# or
HOST_PORT=3085 docker compose up -d --build
```

The container health check calls `GET /api/health`.

### `deploy.sh`
Runs lint/type-check/tests, refuses to commit files that look like secrets, commits and pushes the current branch. Pushing or merging to `main` triggers the release workflow. Set `SKIP_CHECKS=1` to skip the checks.

---

## 🔍 How It Works

```text
Browser ──▶ /api/nfl/*  (Next.js route handlers, in-memory cache)  ──▶ Sleeper API
   │            players (trimmed ~15MB → ~100KB gzipped), weekly stats & projections,
   │            schedule, defense-vs-position, trending
   └──────▶ Sleeper API directly for your user, leagues, rosters and matchups
```

- **Season & week** come from Sleeper's `/state/nfl`, so the app is correct in the preseason, regular season and playoffs.
- **Schedule** (opponents, home/away, byes, game status) comes from Sleeper's schedule feed – nothing is hardcoded.
- **Scoring** is the dot product of Sleeper stat lines and scoring settings. The built-in presets match Sleeper's own `pts_ppr`/`pts_half_ppr`/`pts_std` totals.
- **Privacy:** your Sleeper username is stored in your browser and sent only to Sleeper.

### Project Structure

```text
app/
├── api/nfl/          # Cached, trimmed Sleeper data (players+injuries, weekly, live schedule, defense, trending)
├── my-teams/         # Every team's lineup issues + player exposure
├── my-leagues/       # League list & dashboard (matchup, lineup, roster, standings, power, playoffs, transactions)
├── waivers/          # Waiver wire, trending pickups, add/drop suggestions
├── players/          # Player database & detail pages
├── compare/ start-sit/ trade/
components/
├── league/           # League dashboard views
├── trade/            # Trade finder
├── layout/           # Navigation, scoring selector, service worker registration
└── ui/               # Shared UI (PlayerCard, PlayerPicker, MatchupBadge, Tabs, charts, ...)
lib/
├── server/           # Server-only Sleeper client + cache
├── hooks/            # useFantasyData, useLeagueData, useUserLeagues, useAsync, URL/localStorage hooks
├── points.ts         # Scoring presets & calculator
├── season.ts         # Game logs, averages, ranks, blended value
├── matchups.ts       # Defense-vs-position ratings & grades
├── lineup.ts         # Lineup optimizer (Hungarian assignment)
├── league.ts         # Lineup analysis, game state, league shape
├── power-rankings.ts # All-play, luck, standings order
├── playoff-odds.ts   # Monte Carlo playoff odds
├── waivers.ts        # Add/drop suggestions
├── trade-finder.ts   # Trade search
├── dynasty.ts        # Age curves & draft picks
├── transactions.ts   # Transaction normalization
└── scoring.ts        # Compare, start/sit and trade analysis
tests/                # Vitest unit tests
tests/e2e/            # Playwright tests with mocked Sleeper data
docs/ENHANCEMENTS.md  # Backlog for future work
```

---

## 🗺️ Roadmap

See [`docs/ENHANCEMENTS.md`](docs/ENHANCEMENTS.md). Next up: real-account verification on game day, push notifications, division-aware playoff odds and a playoff bracket view.

---

## 🤝 Contributing

1. Fork the project
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Run `npm run lint && npm run typecheck && npm test`
4. Commit and open a pull request

---

## 📜 License

Distributed under the MIT License. See [`LICENSE`](LICENSE).

---

Built with ♥ for fantasy football fans. Not affiliated with Sleeper.
