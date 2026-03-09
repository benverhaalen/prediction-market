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
  rakePercent: number;
}

function roundCents(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function PayoutPreview({
  bets,
  outcomes,
  totalPool,
  rakePercent,
}: PayoutPreviewProps) {
  if (bets.length === 0) return null;

  // Group bets by user+outcome
  const userBets = new Map<
    string,
    {
      userName: string;
      outcomeId: string;
      outcomeLabel: string;
      shares: number;
      cost: number;
    }
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

    // Try applying rake off the top
    const rakeAmount = roundCents(totalPool * rakePercent);
    let distributable = totalPool - rakeAmount;

    // Safety: check if any winner would lose money with rake
    const wouldUnderpay =
      rakeAmount > 0 &&
      totalWinningShares > 0 &&
      aggregated
        .filter((b) => b.outcomeId === outcome.id)
        .some((b) => {
          const payout = roundCents(
            (b.shares / totalWinningShares) * distributable,
          );
          return payout < roundCents(b.cost);
        });

    if (wouldUnderpay) {
      distributable = totalPool;
    }

    const actualRake = wouldUnderpay ? 0 : rakeAmount;

    const winners = aggregated
      .filter((b) => b.outcomeId === outcome.id && totalWinningShares > 0)
      .map((b) => {
        const payout = roundCents(
          (b.shares / totalWinningShares) * distributable,
        );
        return {
          userName: b.userName,
          payout,
          cost: b.cost,
          profit: roundCents(payout - b.cost),
        };
      })
      .sort((a, b) => b.payout - a.payout);

    return {
      outcome,
      winners,
      totalWinningShares,
      rake: actualRake,
    };
  });

  const rakeDisplay = rakePercent > 0 ? Math.round(rakePercent * 100) : 0;

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted mb-3">
        Payout Preview
      </h3>
      <p className="text-xs text-muted mb-3">
        Pool:{" "}
        <span className="text-foreground font-medium">
          {formatDollars(totalPool)}
        </span>
        {rakeDisplay > 0 && (
          <span className="text-gold"> ({rakeDisplay}% house rake)</span>
        )}
      </p>

      <div className="space-y-3">
        {scenarioPayouts.map(({ outcome, winners, rake }) => (
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
                {rake > 0 && (
                  <div className="flex items-center justify-between text-xs text-gold mt-1 pt-1 border-t border-border/50">
                    <span>House rake</span>
                    <span>{formatDollars(rake)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
