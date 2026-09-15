import { describe, expect, it } from 'vitest';
import { findTradesWithPartner } from '@/lib/trade-finder';
import { WaiverPlayerInput } from '@/lib/waivers';

const w = (id: string, position: string, value: number): WaiverPlayerInput => ({ id, position, value, weekProjection: value });

describe('findTradesWithPartner', () => {
  const slots = ['QB', 'RB', 'WR', 'FLEX'];

  it('finds a mutually beneficial swap of surplus for need', () => {
    // You: RB-rich, weak WR. Partner: WR-rich, weak RB.
    const you = { rosterId: 1, players: [w('q1', 'QB', 18), w('r1', 'RB', 16), w('r2', 'RB', 15), w('r3', 'RB', 14), w('x1', 'WR', 5)] };
    const partner = { rosterId: 2, players: [w('q2', 'QB', 18), w('y1', 'WR', 16), w('y2', 'WR', 15), w('y3', 'WR', 14), w('s1', 'RB', 5)] };
    const ideas = findTradesWithPartner(slots, you, partner, { includePackages: false });
    expect(ideas.length).toBeGreaterThan(0);
    const best = ideas[0];
    // Your spare (benched) RB for one of their WRs – both starting lineups improve
    expect(best.giveIds).toEqual(['r3']);
    expect(best.receiveIds[0]).toMatch(/^y/);
    expect(best.yourGain).toBeGreaterThan(0);
    expect(best.partnerGain).toBeGreaterThan(0);
  });

  it('does not suggest fleecing the partner', () => {
    const you = { rosterId: 1, players: [w('q1', 'QB', 10), w('r1', 'RB', 5), w('x1', 'WR', 5)] };
    const partner = { rosterId: 2, players: [w('q2', 'QB', 25), w('s1', 'RB', 5), w('y1', 'WR', 5)] };
    const ideas = findTradesWithPartner(slots, you, partner);
    expect(ideas.every(i => i.partnerGain >= -0.5)).toBe(true);
  });
});
