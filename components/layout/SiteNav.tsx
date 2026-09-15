'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ScoringSelector from './ScoringSelector';

export const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: '🏠' },
  { href: '/my-leagues', label: 'My Leagues', icon: '🏆' },
  { href: '/my-teams', label: 'My Teams', icon: '🗂️' },
  { href: '/waivers', label: 'Waivers', icon: '📋' },
  { href: '/players', label: 'Players', icon: '🏈' },
  { href: '/compare', label: 'Compare', icon: '⚔️' },
  { href: '/start-sit', label: 'Start/Sit', icon: '🎯' },
  { href: '/trade', label: 'Trade', icon: '🔄' },
];

export default function SiteNav() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <nav className="mb-8 animate-fade-in" aria-label="Main">
      <div className="card-glass p-2 flex items-center gap-2">
        <div className="flex-1 flex gap-1 overflow-x-auto md:flex-wrap md:justify-center">
          {NAV_ITEMS.map(item => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? 'page' : undefined}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg whitespace-nowrap transition-all ${
                isActive(item.href)
                  ? 'bg-turf/15 text-turf'
                  : 'text-text-secondary hover:text-turf hover:bg-turf/10'
              }`}
            >
              <span aria-hidden>{item.icon}</span>
              <span className="font-medium text-sm md:text-base">{item.label}</span>
            </Link>
          ))}
        </div>
        <div className="flex-shrink-0 border-l border-field-border pl-2">
          <ScoringSelector />
        </div>
      </div>
    </nav>
  );
}
