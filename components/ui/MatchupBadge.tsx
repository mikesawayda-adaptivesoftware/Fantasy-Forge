import { MatchupInfo, MATCHUP_GRADE_LABELS } from '@/lib/matchups';
import { formatOpponent } from '@/lib/nfl';
import { ordinal } from '@/lib/scoring';
import { formatMultiplier, MATCHUP_GRADE_CLASSES } from '@/lib/utils';

interface MatchupBadgeProps {
  matchup?: MatchupInfo;
  position?: string;
  /** Show just the grade color with opponent (compact) */
  compact?: boolean;
  showWeek?: boolean;
}

// Shape-based cue so grades don't rely on color alone
const GRADE_SYMBOLS: Record<string, string> = { great: '▲▲', good: '▲', neutral: '●', tough: '▼', brutal: '▼▼' };

/** Opponent + defense-vs-position grade, e.g. "@ KC · Tough" */
export default function MatchupBadge({ matchup, position, compact = false, showWeek = false }: MatchupBadgeProps) {
  if (!matchup) return null;

  if (matchup.bye) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs bg-field-elevated text-text-muted border-field-border">
        {showWeek && <span>W{matchup.week}</span>} BYE
      </span>
    );
  }
  if (!matchup.game) return null;

  const grade = matchup.grade ?? 'neutral';
  const title = matchup.entry
    ? `${matchup.opponent} allows ${matchup.entry.allowedPerGame} PPG to ${position ?? 'this position'} (${ordinal(matchup.entry.rank)} most, ${formatMultiplier(matchup.entry.multiplier)} vs avg)`
    : 'No matchup data yet';

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs whitespace-nowrap ${MATCHUP_GRADE_CLASSES[grade]}`}
    >
      {showWeek && <span className="opacity-70">W{matchup.week}</span>}
      <span className="font-medium">{formatOpponent(matchup.game)}</span>
      {matchup.grade && (
        <span aria-hidden className="text-[10px] leading-none">
          {GRADE_SYMBOLS[matchup.grade]}
        </span>
      )}
      {matchup.grade && !compact && <span>· {MATCHUP_GRADE_LABELS[matchup.grade]}</span>}
      {matchup.grade && compact && <span className="sr-only">, {MATCHUP_GRADE_LABELS[matchup.grade]} matchup</span>}
    </span>
  );
}
