'use client';

import { useState } from 'react';
import { SleeperRoster } from '@/types';
import { findTradesWithPartner, scoreIdea, TradeIdea } from '@/lib/trade-finder';
import { WaiverPlayerInput } from '@/lib/waivers';
import { formatSigned } from '@/lib/utils';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface TradeFinderProps {
  slots: string[];
  userRoster: SleeperRoster;
  rosters: SleeperRoster[];
  toInput: (playerId: string) => WaiverPlayerInput | null;
  teamName: (rosterId: number) => string;
  playerName: (playerId: string) => string;
  onLoad: (idea: TradeIdea) => void;
}

function rosterInputs(roster: SleeperRoster, toInput: TradeFinderProps['toInput']): WaiverPlayerInput[] {
  const excluded = new Set([...(roster.reserve ?? []), ...(roster.taxi ?? [])]);
  return (roster.players ?? []).filter(id => !excluded.has(id)).map(toInput).filter((p): p is WaiverPlayerInput => p !== null);
}

/** Searches every other roster for trades that help your lineup without gutting theirs */
export default function TradeFinder({ slots, userRoster, rosters, toInput, teamName, playerName, onLoad }: TradeFinderProps) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [ideas, setIdeas] = useState<TradeIdea[] | null>(null);

  const run = async () => {
    setRunning(true);
    setIdeas(null);
    setProgress(0);
    const you = { rosterId: userRoster.roster_id, players: rosterInputs(userRoster, toInput) };
    const partners = rosters.filter(r => r.roster_id !== userRoster.roster_id);
    const found: TradeIdea[] = [];
    for (let i = 0; i < partners.length; i++) {
      // Yield between teams so the page stays responsive
      await new Promise(resolve => setTimeout(resolve, 0));
      const partner = { rosterId: partners[i].roster_id, players: rosterInputs(partners[i], toInput) };
      found.push(...findTradesWithPartner(slots, you, partner, { ideasPerTeam: 2 }));
      setProgress(Math.round(((i + 1) / partners.length) * 100));
    }
    setIdeas(found.sort((a, b) => scoreIdea(b) - scoreIdea(a)).slice(0, 12));
    setRunning(false);
  };

  return (
    <section className="bg-field-card/30 border border-field-border rounded-xl p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <span aria-hidden>🔎</span> Trade Finder
          </h3>
          <p className="text-sm text-text-secondary">
            Searches every roster for 1-for-1 and 2-for-1 deals that improve your best lineup while keeping the other team whole.
          </p>
        </div>
        <button type="button" onClick={run} disabled={running} className="btn-primary">
          {running ? `Searching… ${progress}%` : ideas ? 'Search again' : 'Find trades'}
        </button>
      </div>

      {running && <LoadingSpinner />}

      {ideas && ideas.length === 0 && (
        <p className="text-sm text-text-muted">No trades found that help you without hurting the other team. Your roster may already be well balanced.</p>
      )}

      {ideas && ideas.length > 0 && (
        <ul className="grid gap-3">
          {ideas.map(idea => (
            <li key={`${idea.partnerRosterId}-${idea.giveIds.join()}-${idea.receiveIds.join()}`} className="bg-field-dark rounded-lg p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <span className="text-sm text-text-muted">with {teamName(idea.partnerRosterId)}</span>
                <span className="text-sm">
                  <span className="text-turf stat-number">You {formatSigned(idea.yourGain)}</span>
                  <span className="text-text-muted"> · </span>
                  <span className={`stat-number ${idea.partnerGain >= 0 ? 'text-gold' : 'text-text-muted'}`}>Them {formatSigned(idea.partnerGain)}</span>
                  <span className="text-text-muted text-xs"> pts/wk</span>
                </span>
              </div>
              <div className="grid sm:grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm">
                <div>
                  <span className="text-xs text-turf font-semibold mr-2">GIVE</span>
                  <span className="text-white">{idea.giveIds.map(playerName).join(' + ')}</span>
                </div>
                <span className="text-text-muted hidden sm:block" aria-hidden>⇄</span>
                <div>
                  <span className="text-xs text-gold font-semibold mr-2">GET</span>
                  <span className="text-white">{idea.receiveIds.map(playerName).join(' + ')}</span>
                </div>
              </div>
              <button type="button" onClick={() => onLoad(idea)} className="mt-3 text-sm text-cyan hover:text-turf">
                Load into analyzer →
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
