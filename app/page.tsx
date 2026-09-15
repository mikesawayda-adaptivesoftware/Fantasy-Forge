import Link from 'next/link';

type Accent = 'turf' | 'gold' | 'cyan' | 'purple' | 'red';

// Full class names so Tailwind can see them at build time
const ACCENT_CLASSES: Record<Accent, { border: string; text: string }> = {
  turf: { border: 'hover:border-turf', text: 'group-hover:text-turf' },
  gold: { border: 'hover:border-gold', text: 'group-hover:text-gold' },
  cyan: { border: 'hover:border-cyan', text: 'group-hover:text-cyan' },
  purple: { border: 'hover:border-purple', text: 'group-hover:text-purple' },
  red: { border: 'hover:border-red', text: 'group-hover:text-red' },
};

const leagueTools: { icon: string; title: string; description: string; href: string; accent: Accent }[] = [
  {
    icon: '🏆',
    title: 'My Leagues',
    description: 'Live matchup, lineup optimizer, standings and power rankings – scored with your league settings',
    href: '/my-leagues',
    accent: 'turf',
  },
  {
    icon: '📋',
    title: 'Waiver Wire',
    description: 'Best available players in your league, trending pickups, and smart add/drop suggestions',
    href: '/waivers',
    accent: 'gold',
  },
];

const tools: typeof leagueTools = [
  {
    icon: '🏈',
    title: 'Player Database',
    description: 'Search every fantasy-relevant player with projections, game logs and upcoming matchups',
    href: '/players',
    accent: 'cyan',
  },
  {
    icon: '⚔️',
    title: 'Head-to-Head Compare',
    description: 'Compare two players side-by-side, including this week’s defensive matchup',
    href: '/compare',
    accent: 'gold',
  },
  {
    icon: '🎯',
    title: 'Start/Sit Advisor',
    description: 'Projection, form, consistency and matchup combined into one clear recommendation',
    href: '/start-sit',
    accent: 'turf',
  },
  {
    icon: '🔄',
    title: 'Trade Analyzer',
    description: 'Value trades over replacement level so 3-for-1 deals are judged fairly',
    href: '/trade',
    accent: 'purple',
  },
];

const highlights = [
  { label: 'League Scoring', value: 'Exact', icon: '🧮' },
  { label: 'Defenses Rated', value: '32', icon: '🛡️' },
  { label: 'Lineup Optimizer', value: 'FLEX-aware', icon: '🧠' },
  { label: 'Formats', value: 'PPR · ½ · Std', icon: '📊' },
];

function ToolCard({ tool }: { tool: (typeof tools)[number] }) {
  const accent = ACCENT_CLASSES[tool.accent];
  return (
    <Link
      href={tool.href}
      className={`group bg-field-card/50 border border-field-border rounded-xl p-6 hover:bg-field-card transition-all hover:shadow-lg hover:-translate-y-1 ${accent.border}`}
    >
      <div className="text-4xl mb-4 group-hover:scale-110 transition-transform" aria-hidden>
        {tool.icon}
      </div>
      <h3 className={`font-semibold text-white text-lg mb-2 transition-colors ${accent.text}`}>{tool.title}</h3>
      <p className="text-text-secondary text-sm">{tool.description}</p>
    </Link>
  );
}

export default function Home() {
  return (
    <div className="space-y-8">
      <section className="text-center py-6">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
          Your Fantasy Football <span className="text-gradient-gold">Command Center</span>
        </h2>
        <p className="text-text-secondary text-lg max-w-2xl mx-auto">
          Connect your Sleeper account for league-aware lineup, waiver and matchup analysis – or use the tools
          below with PPR, Half PPR or Standard scoring.
        </p>
      </section>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {highlights.map(stat => (
          <div key={stat.label} className="bg-field-card/50 border border-field-border rounded-lg p-4 text-center">
            <span className="text-2xl" aria-hidden>{stat.icon}</span>
            <div className="stat-number text-xl text-gold mt-2">{stat.value}</div>
            <div className="text-xs text-text-muted mt-1">{stat.label}</div>
          </div>
        ))}
      </section>

      <section>
        <div className="flex items-center gap-3 mb-6">
          <span className="text-2xl" aria-hidden>🏟️</span>
          <h2 className="text-xl font-semibold text-white">Your Leagues</h2>
          <div className="flex-1 h-px bg-field-border" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {leagueTools.map(tool => (
            <ToolCard key={tool.href} tool={tool} />
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center gap-3 mb-6">
          <span className="text-2xl" aria-hidden>🛠️</span>
          <h2 className="text-xl font-semibold text-white">Tools</h2>
          <div className="flex-1 h-px bg-field-border" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {tools.map(tool => (
            <ToolCard key={tool.href} tool={tool} />
          ))}
        </div>
      </section>

      <section className="bg-field-card/30 border border-field-border rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl" aria-hidden>🚀</span>
          <h2 className="text-xl font-semibold text-white">Getting Started</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { n: 1, color: 'bg-turf/20 text-turf', title: 'Connect Sleeper', text: 'Enter your username on My Leagues – no password needed' },
            { n: 2, color: 'bg-gold/20 text-gold', title: 'Optimize Your Lineup', text: 'Check matchups and let the optimizer fill every slot' },
            { n: 3, color: 'bg-cyan/20 text-cyan', title: 'Work the Wire', text: 'Grab trending free agents before your leaguemates do' },
          ].map(step => (
            <div key={step.n} className="flex items-start gap-3">
              <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold ${step.color}`}>
                {step.n}
              </span>
              <div>
                <h4 className="font-medium text-white">{step.title}</h4>
                <p className="text-sm text-text-secondary">{step.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
