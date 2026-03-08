import Link from "next/link";
import { ProbabilityBar } from "./ProbabilityBar";
import { formatDollars, relativeTime } from "@/lib/utils";

interface MarketCardProps {
  id: string;
  question: string;
  status: string;
  closesAt: string;
  resolution?: string | null;
  totalVolume: number;
  betCount: number;
  outcomes: {
    id: string;
    label: string;
    probability: number;
  }[];
  winnerLabel?: string | null;
}

export function MarketCard({
  id,
  question,
  status,
  closesAt,
  totalVolume,
  betCount,
  outcomes,
  winnerLabel,
}: MarketCardProps) {
  const isResolved = status === "RESOLVED";
  const isClosed = status === "CLOSED";

  return (
    <Link
      href={`/market/${id}`}
      className="block cursor-pointer rounded-xl border border-border bg-surface p-4 transition-colors duration-200 hover:border-muted hover:bg-surface-2 active:bg-surface-3"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="font-display text-lg font-semibold leading-tight">
          {question}
        </h3>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
            isResolved
              ? "bg-green-dim text-green"
              : isClosed
                ? "bg-red-dim text-red"
                : "bg-gold-dim text-gold"
          }`}
        >
          {status}
        </span>
      </div>

      {isResolved && winnerLabel ? (
        <div className="mb-3 flex items-center gap-2">
          <span className="text-sm text-green font-semibold">
            Result: {winnerLabel}
          </span>
        </div>
      ) : (
        <ProbabilityBar outcomes={outcomes} />
      )}

      <div className="mt-3 flex items-center gap-4 text-xs text-muted">
        <span>{formatDollars(totalVolume)} vol</span>
        <span>{betCount} bets</span>
        <span className="ml-auto">
          {isResolved ? "Resolved" : `Closes ${relativeTime(new Date(closesAt))}`}
        </span>
      </div>
    </Link>
  );
}
