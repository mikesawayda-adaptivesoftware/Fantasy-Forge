# 🏈 FantasyForge

A modern NFL fantasy football analysis platform built with Next.js 14, TypeScript, and Tailwind CSS. Get data-driven insights to dominate your fantasy league.

![FantasyForge](https://img.shields.io/badge/NFL-Fantasy%20Analysis-10b981?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PC9zdmc+)

## Features

### 🏈 Player Database
- Search and explore 2,000+ NFL players
- Filter by position (QB, RB, WR, TE, K, DEF)
- View detailed player stats, projections, and game logs
- Real-time data from Sleeper API

### ⚔️ Head-to-Head Comparison
- Compare any two players side-by-side
- Visual stat breakdowns with comparison bars
- See who wins across multiple categories
- Confidence score for recommendations

### 🎯 Start/Sit Advisor
- Input two players you're deciding between
- Get AI-powered recommendations
- See reasoning behind the decision
- Factors in projections, recent form, and injuries

### 🔄 Trade Analyzer
- Add multiple players to each side
- Calculate trade value with positional scarcity
- Clear winner/loser determination
- Recommendations for fair trades

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Data Source:** [Sleeper API](https://docs.sleeper.com/)
- **Fonts:** Inter, JetBrains Mono

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone or navigate to the project
cd fantasy-forge

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

### Build for Production

```bash
npm run build
npm start
```

## Docker Deployment

### Prerequisites

- Docker installed
- Docker Hub account (for pushing images)

### Build Docker Image Locally

```bash
cd fantasy-forge

# Build for your local architecture
docker build -t fantasy-forge:latest .

# Run locally
docker run -d -p 3000:3000 --name fantasy-forge fantasy-forge:latest
```

### Build for amd64 (Unraid/x86 Servers)

If you're on Apple Silicon (M1/M2/M3) and deploying to an x86 server:

```bash
# Create buildx builder (one-time setup)
docker buildx create --name multiplatform --use

# Build and push for amd64
docker buildx build --platform linux/amd64 \
  -t yourusername/fantasy-forge:latest \
  --push .
```

### Push to Docker Hub

```bash
# Log in to Docker Hub
docker login

# Tag the image
docker tag fantasy-forge:latest yourusername/fantasy-forge:latest

# Push to Docker Hub
docker push yourusername/fantasy-forge:latest
```

### Run on Server (Unraid, etc.)

```bash
# Pull the image
docker pull yourusername/fantasy-forge:latest

# Run on custom port (e.g., 3081)
docker run -d \
  --name fantasy-forge \
  --restart unless-stopped \
  -p 3081:3000 \
  yourusername/fantasy-forge:latest
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

### Nginx Reverse Proxy

```nginx
server {
    listen 443 ssl http2;
    server_name fantasy.yourdomain.com;

    location / {
        proxy_pass http://localhost:3081;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Project Structure

```
fantasy-forge/
├── app/
│   ├── layout.tsx          # Root layout with navigation
│   ├── page.tsx            # Home dashboard
│   ├── players/
│   │   ├── page.tsx        # Player search & list
│   │   └── [id]/page.tsx   # Player detail view
│   ├── compare/page.tsx    # Head-to-head comparison
│   ├── start-sit/page.tsx  # Start/Sit advisor
│   └── trade/page.tsx      # Trade analyzer
├── components/
│   └── ui/                 # Reusable UI components
├── lib/
│   ├── sleeper.ts          # Sleeper API client
│   ├── scoring.ts          # Fantasy scoring logic
│   └── utils.ts            # Helper functions
└── types/
    └── index.ts            # TypeScript interfaces
```

## API

FantasyForge uses the free [Sleeper API](https://docs.sleeper.com/) for player data:

- **Players:** `/players/nfl` - All NFL player information
- **Stats:** `/stats/nfl/regular/{year}/{week}` - Weekly stats
- **Projections:** `/projections/nfl/regular/{year}/{week}` - Weekly projections

No API key required!

## Scoring System

Default PPR (Points Per Reception) scoring:
- Passing: 0.04 pts/yard, 4 pts/TD, -2 pts/INT
- Rushing: 0.1 pts/yard, 6 pts/TD
- Receiving: 1 pt/reception, 0.1 pts/yard, 6 pts/TD
- Kicking: 3 pts/FG, 1 pt/XP

## Design

Inspired by [ProgrammersBestFriend](../ProgrammersBestFriend), featuring:
- Dark theme with turf green and championship gold accents
- Glass-morphism card effects
- Smooth animations and transitions
- Responsive mobile-first design

## License

MIT

---

Built with ♥ for fantasy football fans
