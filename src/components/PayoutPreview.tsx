"use client";

import { formatDollars } from "@/lib/utils";

interface BetEntry {
  userName: string;
  outcomeLabel: string;
  outcomeId: string;
  shares: number;
  cost: number;
}

interface OutcomeInfo {
  id: string;
  label: string;
}

interface PayoutPreviewProps {
  bets: BetEntry[];
  outcomes: OutcomeInfo[];
  totalPool: number;
}

export function PayoutPreview({ bets, outcomes, totalPool }: PayoutPreviewProps) {
  if (bets.length === 0) return null;

  // Group bets by user+outcome and compute payouts per outcome scenario
  const userBets = new Map<
    string,
    { userName: string; outcomeId: string; outcomeLabel: string; shares: number; cost: number }
  >();

  for (const bet of bets) {
    const key = `${bet.userName}::${bet.outcomeId}`;
    const existing = userBets.get(key);
    if (existing) {
      existing.shares += bet.shares;
      existing.cost += bet.cost;
    } else {
      userBets.set(key, { ...bet });
    }
  }

  const aggregated = Array.from(userBets.values());

  // For each outcome, compute what each bettor would get
  const scenarioPayouts = outcomes.map((outcome) => {
    const totalWinningShares = aggregated
      .filter((b) => b.outcomeId === outcome.id)
      .reduce((sum, b) => sum + b.shares, 0);

    const winners = aggregated
      .filter((b) => b.outcomeId === outcome.id && totalWinningShares > 0)
      .map((b) => ({
        userName: b.userName,
        payout: (b.shares / totalWinningShares) * totalPool,
        cost: b.cost,
        profit: (b.shares / totalWinningShares) * totalPool - b.cost,
      }))
      .sort((a, b) => b.payout - a.payout);

    return {
      outcome,
      winners,
      totalWinningShares,
    };
  });

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted mb-3">
        Payout Preview
      </h3>
      <p className="text-xs text-muted mb-3">
        Pool: <span className="text-foreground font-medium">{formatDollars(totalPool)}</span>
        {" \u2014 "}Winners split the entire pool
      </p>

      <div className="space-y-3">
        {scenarioPayouts.map(({ outcome, winners }) => (
          <div key={outcome.id} className="rounded-lg bg-surface-2 p-3">
            <div className="text-sm font-medium mb-2">
              If <span className="text-blue">{outcome.label}</span> wins:
            </div>
            {winners.length === 0 ? (
              <div className="text-xs text-muted">No bets on this outcome</div>
            ) : (
              <div className="space-y-1">
                {winners.map((w, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-muted">{w.userName}</span>
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-xs ${w.profit >= 0 ? "text-green" : "text-red"}`}
                      >
                        {w.profit >= 0 ? "+" : ""}
                        {formatDollars(w.profit)}
                      </span>
                      <span className="font-medium text-green">
                        {formatDollars(w.payout)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
