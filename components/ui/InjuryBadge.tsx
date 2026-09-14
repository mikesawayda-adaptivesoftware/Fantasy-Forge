import { getInjuryStatusColor } from '@/lib/utils';

export default function InjuryBadge({ status }: { status?: string | null }) {
  if (!status) return null;
  return <span className={`px-1.5 py-0.5 text-xs rounded font-medium ${getInjuryStatusColor(status)}`}>{status}</span>;
}
