import Link from 'next/link';

const features = [
  {
    icon: '🏈',
    title: 'Player Database',
    description: 'Search and explore NFL players with detailed stats and projections',
    href: '/players',
    color: 'turf',
  },
  {
    icon: '⚔️',
    title: 'Head-to-Head Compare',
    description: 'Compare two players side-by-side with visual stat breakdowns',
    href: '/compare',
    color: 'gold',
  },
  {
    icon: '🎯',
    title: 'Start/Sit Advisor',
    description: 'Get AI-powered recommendations on who to start each week',
    href: '/start-sit',
    color: 'cyan',
  },
  {
    icon: '🔄',
    title: 'Trade Analyzer',
    description: 'Evaluate trades and find out who wins the deal',
    href: '/trade',
    color: 'purple',
  },
];

const quickStats = [
  { label: 'NFL Players', value: '2,000+', icon: '👥' },
  { label: 'Weekly Updates', value: 'Live', icon: '📊' },
  { label: 'Positions', value: '6', icon: '🎯' },
  { label: 'Scoring', value: 'PPR', icon: '🏆' },
];

export default function Home() {
  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <section className="text-center py-8">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
          Your Fantasy Football <span className="text-gradient-gold">Command Center</span>
        </h2>
        <p className="text-text-secondary text-lg max-w-2xl mx-auto">
          Make smarter decisions with real-time player data, head-to-head comparisons, 
          and trade analysis powered by the Sleeper API.
        </p>
      </section>

      {/* Quick Stats */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {quickStats.map((stat) => (
          <div
            key={stat.label}
            className="bg-field-card/50 border border-field-border rounded-lg p-4 text-center"
          >
            <span className="text-2xl">{stat.icon}</span>
            <div className="stat-number text-2xl text-gold mt-2">{stat.value}</div>
            <div className="text-xs text-text-muted mt-1">{stat.label}</div>
          </div>
        ))}
      </section>

      {/* Features Grid */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <span className="text-2xl">🛠️</span>
          <h2 className="text-xl font-semibold text-white">Tools</h2>
          <div className="flex-1 h-px bg-field-border"></div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {features.map((feature) => (
            <Link
              key={feature.href}
              href={feature.href}
              className={`
                group bg-field-card/50 border border-field-border rounded-xl p-6
                hover:border-${feature.color} hover:bg-field-card transition-all
                hover:shadow-lg hover:-translate-y-1
              `}
            >
              <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">
                {feature.icon}
              </div>
              <h3 className={`font-semibold text-white text-lg mb-2 group-hover:text-${feature.color} transition-colors`}>
                {feature.title}
              </h3>
              <p className="text-text-secondary text-sm">
                {feature.description}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* Getting Started */}
      <section className="bg-field-card/30 border border-field-border rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">🚀</span>
          <h2 className="text-xl font-semibold text-white">Getting Started</h2>
        </div>
        
        <div className="grid md:grid-cols-3 gap-4">
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-8 h-8 bg-turf/20 text-turf rounded-full flex items-center justify-center font-bold">1</span>
            <div>
              <h4 className="font-medium text-white">Browse Players</h4>
              <p className="text-sm text-text-secondary">Search the database by name or filter by position</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-8 h-8 bg-gold/20 text-gold rounded-full flex items-center justify-center font-bold">2</span>
            <div>
              <h4 className="font-medium text-white">Compare & Analyze</h4>
              <p className="text-sm text-text-secondary">Use tools to make informed lineup decisions</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-8 h-8 bg-cyan/20 text-cyan rounded-full flex items-center justify-center font-bold">3</span>
            <div>
              <h4 className="font-medium text-white">Dominate Your League</h4>
              <p className="text-sm text-text-secondary">Win your matchup with data-driven decisions</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
