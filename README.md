# 🏈 FantasyForge

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
![NFL Fantasy Analysis](https://img.shields.io/badge/NFL-Fantasy%20Analysis-10b981?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PC9zdmc+)

FantasyForge is a high-performance NFL fantasy football analysis platform designed for serious league managers. Built with **Next.js 16 (App Router)**, **React 19**, and **Tailwind CSS 4**, it provides real-time data-driven insights by leveraging the Sleeper API.

[Explore Features](#-key-features) • [Getting Started](#-getting-started) • [Deployment](#-docker-deployment) • [Roadmap](#-future-roadmap)

---

## 🌟 Key Features

### 🏈 Advanced Player Database
- **Deep Search:** Explore 2,000+ active NFL players with sub-second latency.
- **Granular Filters:** Filter by position (QB, RB, WR, TE, K, DEF) and team status.
- **Rich Profiles:** View comprehensive career stats, weekly projections, and historical game logs.
- **Live Data:** Direct integration with [Sleeper API](https://docs.sleeper.com/) ensures you have the latest injury updates and stats.

### ⚔️ Head-to-Head Comparison
- **Visual Analytics:** Compare any two players side-by-side with interactive stat bars.
- **Categorical Breakdown:** See exactly where one player edges out the other (e.g., Target Share vs. Redzone Touches).
- **Confidence Scoring:** Algorithmic determination of which player has the higher floor and ceiling.

### 🎯 Start/Sit Advisor
- **Logic-Driven Recommendations:** Get advice based on matchup difficulty, projections, and recent form.
- **Transparent Reasoning:** Don't just get a name; see *why* a player is recommended through detailed logic breakdowns.
- **Context Aware:** Factors in projections, recent volume, and injury designations.

### 🔄 Intelligent Trade Analyzer
- **Multi-Player Swaps:** Support for complex "X for Y" player trades.
- **Positional Scarcity:** Values players based on their relative strength to their position's average.
- **Fairness Meter:** Instant determination of winner/loser with suggestions to balance the deal.

---

## 🛠️ Tech Stack

- **Core:** [Next.js 16](https://nextjs.org/) (App Router) & [React 19](https://react.dev/)
- **Language:** [TypeScript](https://www.typescriptlang.org/) (Strict Mode)
- **Styling:** [Tailwind CSS 4](https://tailwindcss.com/)
- **State & Data:** Server Components & Client-side Caching (1-hour TTL)
- **Data Source:** [Sleeper API](https://docs.sleeper.com/) (No API Key Required)
- **Fonts:** Inter & JetBrains Mono

---

## 🚀 Getting Started

### Prerequisites
- **Node.js:** 18.x or higher
- **Package Manager:** npm (v9+) or yarn

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/fantasy-forge.git
   cd fantasy-forge
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000) in your browser to start forging your championship team.

---

## 🐳 Docker Deployment

FantasyForge is optimized for containerized environments with standalone output enabled.

### Quick Run
```bash
# Build the image
docker build -t fantasy-forge:latest .

# Run the container
docker run -d -p 3000:3000 --name fantasy-forge fantasy-forge:latest
```

### Docker Compose
```yaml
version: '3.8'

services:
  fantasy-forge:
    image: yourusername/fantasy-forge:latest
    container_name: fantasy-forge
    restart: unless-stopped
    ports:
      - "3081:3000"
```

### Multi-Platform Builds (Apple Silicon to x86)
If you're on Apple Silicon and deploying to an x86 server:
```bash
docker buildx build --platform linux/amd64 -t yourusername/fantasy-forge:latest --push .
```

---

## 📁 Project Structure

```text
fantasy-forge/
├── app/                # Next.js 16 App Router (Pages & Layouts)
│   ├── compare/        # H2H Player Comparison
│   ├── my-leagues/     # League Dashboard & Roster View
│   ├── players/        # Player Search & Detail Pages
│   ├── start-sit/      # Recommendation Engine
│   └── trade/          # Trade Analyzer tool
├── components/         # Reusable React components
│   └── ui/             # Atomic UI elements (Stat bars, Cards, etc.)
├── lib/                # Core logic & Utils
│   ├── sleeper.ts      # API Wrapper & Cache Management
│   ├── scoring.ts      # PPR Scoring Engine
│   └── utils.ts        # Shared helper functions
├── types/              # TypeScript Interfaces (Sleeper & App)
└── public/             # Static assets & Icons
```

---

## 📊 Scoring System

FantasyForge uses standard **PPR (Points Per Reception)** scoring by default:

| Category | Value |
| :--- | :--- |
| **Passing** | 0.04 pts/yd, 4 pts/TD, -2 pts/INT |
| **Rushing** | 0.1 pts/yd, 6 pts/TD |
| **Receiving** | 1.0 pt/REC, 0.1 pts/yd, 6 pts/TD |
| **Kicking** | 3 pts/FG, 1 pt/XP |
| **Defense** | 1 pt/Sack, 2 pts/INT/FR, 6 pts/TD, 10 pts for Shutout |

---

## 🗺️ Future Roadmap

- [ ] **Waiver Wire Wizard:** AI analysis of top available free agents based on league needs.
- [ ] **Dynasty Mode:** Age-adjusted values and draft pick trading support.
- [ ] **Live Matchup Tracking:** Real-time updates for active NFL games.
- [ ] **Multi-League Support:** View all your Sleeper leagues in a single unified dashboard.

---

## 🤝 Contributing

Contributions make the open-source community an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.

---

Built with ♥ for fantasy football fans
