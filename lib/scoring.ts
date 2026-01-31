import { PlayerWithStats, ComparisonResult, StartSitRecommendation, TradeAnalysis } from '@/types';

/**
 * Compare two players head-to-head
 */
export function comparePlayersHeadToHead(
  player1: PlayerWithStats,
  player2: PlayerWithStats
): ComparisonResult {
  const breakdown: ComparisonResult['breakdown'] = [];

  // Compare projected points
  const proj1 = player1.projectedPoints || 0;
  const proj2 = player2.projectedPoints || 0;
  breakdown.push({
    category: 'Projected Points',
    player1Value: proj1,
    player2Value: proj2,
    winner: proj1 > proj2 ? 'player1' : proj2 > proj1 ? 'player2' : 'tie',
  });

  // Compare season average
  const avg1 = player1.avgPoints || 0;
  const avg2 = player2.avgPoints || 0;
  breakdown.push({
    category: 'Season Average',
    player1Value: avg1,
    player2Value: avg2,
    winner: avg1 > avg2 ? 'player1' : avg2 > avg1 ? 'player2' : 'tie',
  });

  // Compare recent form (last 3 weeks)
  const recent1 = player1.recentAvgPoints || 0;
  const recent2 = player2.recentAvgPoints || 0;
  breakdown.push({
    category: 'Recent Form (3wk)',
    player1Value: recent1,
    player2Value: recent2,
    winner: recent1 > recent2 ? 'player1' : recent2 > recent1 ? 'player2' : 'tie',
  });

  // Consistency (standard deviation of points)
  const consistency1 = calculateConsistency(player1);
  const consistency2 = calculateConsistency(player2);
  breakdown.push({
    category: 'Consistency',
    player1Value: consistency1,
    player2Value: consistency2,
    winner: consistency1 < consistency2 ? 'player1' : consistency2 < consistency1 ? 'player2' : 'tie', // Lower is better
  });

  // Determine overall winner with weighted scoring
  // Weights: Projected (35%), Season Avg (25%), Recent Form (30%), Consistency (10%)
  const weights = [0.35, 0.25, 0.30, 0.10];
  let player1Score = 0;
  let player2Score = 0;
  
  breakdown.forEach((cat, index) => {
    const weight = weights[index] || 0.25;
    const maxVal = Math.max(cat.player1Value, cat.player2Value, 0.1);
    
    // For consistency, lower is better, so invert the comparison
    if (cat.category === 'Consistency') {
      // Normalize: player with lower value gets higher score
      const total = cat.player1Value + cat.player2Value;
      if (total > 0) {
        player1Score += (cat.player2Value / total) * weight * 100;
        player2Score += (cat.player1Value / total) * weight * 100;
      }
    } else {
      // Normalize: player with higher value gets proportionally higher score
      player1Score += (cat.player1Value / maxVal) * weight * 100;
      player2Score += (cat.player2Value / maxVal) * weight * 100;
    }
  });

  const winner: ComparisonResult['winner'] = 
    player1Score > player2Score ? 'player1' : 
    player2Score > player1Score ? 'player2' : 'tie';

  // Calculate confidence based on the percentage difference in scores
  const totalScore = player1Score + player2Score;
  const scoreDiff = Math.abs(player1Score - player2Score);
  // Confidence scales from 50% (dead even) to 100% (complete dominance)
  // A 20% relative difference = 75% confidence, 40% diff = 100% confidence
  const relativeGap = totalScore > 0 ? (scoreDiff / totalScore) : 0;
  const confidence = Math.min(100, Math.round(50 + (relativeGap * 250)));

  return {
    player1,
    player2,
    winner,
    confidence,
    breakdown,
  };
}

/**
 * Calculate consistency score (lower = more consistent)
 */
function calculateConsistency(player: PlayerWithStats): number {
  if (!player.gameLog || player.gameLog.length < 2) return 0;

  const points = player.gameLog.map(g => g.fantasyPoints);
  const mean = points.reduce((a, b) => a + b, 0) / points.length;
  const squaredDiffs = points.map(p => Math.pow(p - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length;
  
  return Math.round(Math.sqrt(avgSquaredDiff) * 10) / 10; // Standard deviation
}

/**
 * Get Start/Sit recommendation
 */
export function getStartSitRecommendation(
  player1: PlayerWithStats,
  player2: PlayerWithStats
): StartSitRecommendation {
  const comparison = comparePlayersHeadToHead(player1, player2);
  const reasons: string[] = [];

  // Build reasons based on comparison
  comparison.breakdown.forEach(cat => {
    if (cat.winner !== 'tie') {
      const winnerName = cat.winner === 'player1' ? player1.name : player2.name;
      const diff = Math.abs(cat.player1Value - cat.player2Value);
      
      if (cat.category === 'Projected Points' && diff > 2) {
        reasons.push(`${winnerName} has ${diff.toFixed(1)} more projected points this week`);
      } else if (cat.category === 'Recent Form (3wk)' && diff > 3) {
        reasons.push(`${winnerName} has been hotter recently (+${diff.toFixed(1)} PPG over last 3 weeks)`);
      } else if (cat.category === 'Consistency') {
        reasons.push(`${winnerName} is more consistent week-to-week`);
      }
    }
  });

  // Check injury status
  if (player1.injuryStatus && !player2.injuryStatus) {
    reasons.push(`${player1.name} is listed as ${player1.injuryStatus}`);
  } else if (player2.injuryStatus && !player1.injuryStatus) {
    reasons.push(`${player2.name} is listed as ${player2.injuryStatus}`);
  }

  // Determine start/sit
  const start = comparison.winner === 'player1' ? player1 : player2;
  const sit = comparison.winner === 'player1' ? player2 : player1;

  // Adjust confidence for injury
  let confidence = comparison.confidence;
  if (start.injuryStatus === 'Out' || start.injuryStatus === 'IR') {
    // If recommended start is out, flip recommendation
    return {
      start: sit,
      sit: start,
      confidence: 90,
      reasons: [`${start.name} is out with injury`],
    };
  }

  // Add default reason if none
  if (reasons.length === 0) {
    reasons.push(`${start.name} has a slight edge in overall projections`);
  }

  return {
    start,
    sit,
    confidence,
    reasons,
  };
}

/**
 * Analyze a trade
 */
export function analyzeTrade(
  team1Players: PlayerWithStats[],
  team2Players: PlayerWithStats[]
): TradeAnalysis {
  // Calculate total value for each side
  // Value = weighted average of projected, season avg, and recent form
  const calculatePlayerValue = (player: PlayerWithStats): number => {
    const proj = player.projectedPoints || 0;
    const avg = player.avgPoints || 0;
    const recent = player.recentAvgPoints || 0;
    
    // Weight: 40% projected, 30% season avg, 30% recent
    let value = (proj * 0.4) + (avg * 0.3) + (recent * 0.3);
    
    // Apply positional scarcity multiplier
    const scarcityMultiplier = getPositionalScarcity(player.position);
    value *= scarcityMultiplier;
    
    // Penalty for injuries
    if (player.injuryStatus === 'Out' || player.injuryStatus === 'IR') {
      value *= 0.5;
    } else if (player.injuryStatus === 'Questionable') {
      value *= 0.85;
    }
    
    return Math.round(value * 10) / 10;
  };

  const team1Value = team1Players.reduce((sum, p) => sum + calculatePlayerValue(p), 0);
  const team2Value = team2Players.reduce((sum, p) => sum + calculatePlayerValue(p), 0);
  const valueDifference = Math.abs(team1Value - team2Value);

  // Determine winner
  let winner: TradeAnalysis['winner'];
  let recommendation: string;

  if (valueDifference < 2) {
    winner = 'fair';
    recommendation = 'This trade is relatively fair. Consider team needs and roster construction.';
  } else if (team1Value > team2Value) {
    winner = 'team1';
    recommendation = `Team 1 wins this trade by ${valueDifference.toFixed(1)} points of value.`;
  } else {
    winner = 'team2';
    recommendation = `Team 2 wins this trade by ${valueDifference.toFixed(1)} points of value.`;
  }

  return {
    team1Players,
    team2Players,
    team1Value: Math.round(team1Value * 10) / 10,
    team2Value: Math.round(team2Value * 10) / 10,
    winner,
    valueDifference: Math.round(valueDifference * 10) / 10,
    recommendation,
  };
}

/**
 * Get positional scarcity multiplier
 * Higher value = more scarce/valuable
 */
function getPositionalScarcity(position: string): number {
  const scarcity: Record<string, number> = {
    QB: 1.0,    // Deep position
    RB: 1.15,   // Most scarce
    WR: 1.05,   // Slightly above average
    TE: 1.1,    // Premium TEs are scarce
    K: 0.8,     // Easily replaceable
    DEF: 0.85,  // Streamable
  };
  return scarcity[position] || 1.0;
}

/**
 * Get tier for a player based on points
 */
export function getPlayerTier(avgPoints: number, position: string): number {
  // Tier thresholds vary by position
  const thresholds: Record<string, number[]> = {
    QB: [25, 20, 15, 10],
    RB: [20, 15, 10, 5],
    WR: [18, 14, 10, 6],
    TE: [15, 10, 6, 3],
    K: [10, 8, 6, 4],
    DEF: [12, 9, 6, 3],
  };

  const tiers = thresholds[position] || thresholds.WR;
  
  for (let i = 0; i < tiers.length; i++) {
    if (avgPoints >= tiers[i]) return i + 1;
  }
  return 5; // Lowest tier
}

