import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getPrices } from "@/lib/lmsr";
import { toNumber, formatDollars, relativeTime } from "@/lib/utils";
import { ProbabilityBar } from "@/components/ProbabilityBar";
import { PayoutTable } from "@/components/PayoutTable";
import Link from "next/link";
import { AdminMarketActions } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminMarketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isAdmin())) {
    redirect("/admin/login");
  }

  const { id } = await params;

  const market = await prisma.market.findUnique({
    where: { id },
    include: {
      outcomes: true,
      bets: {
        include: {
          user: true,
          outcome: true,
          betRequest: { select: { venmoUsername: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      _count: { select: { bets: true } },
    },
  });

  if (!market) notFound();

  const shares = market.outcomes.map((o) => o.shares);
  const prices = getPrices({ shares, b: market.bParam });
  const totalVolume = market.bets.reduce((sum, b) => sum + toNumber(b.cost), 0);

  const isResolved = market.status === "RESOLVED";
  const isCancelled = market.status === "CANCELLED";
  const canResolve = market.status === "OPEN" || market.status === "CLOSED";

  // Build payout data if resolved
  let payoutData = null;
  if (isResolved || isCancelled) {
    const payouts = market.bets.map((b) => ({
      userName: b.user.name,
      venmoUsername: b.betRequest?.venmoUsername ?? "",
      shares: b.shares,
      grossPayout: toNumber(b.grossPayout ?? 0),
      rakePaid: toNumber(b.rakePaid ?? 0),
      netPayout: toNumber(b.netPayout ?? 0),
      isWinner: b.outcomeId === market.resolution,
    }));
    const totalRake = payouts.reduce((sum, p) => sum + p.rakePaid, 0);
    const winnerOutcome = market.outcomes.find(
      (o) => o.id === market.resolution,
    );

    payoutData = {
      payouts,
      totalPool: totalVolume,
      totalRake,
      winnerLabel: winnerOutcome?.label ?? "N/A",
      isCancelled,
    };
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <Link
            href="/admin"
            className="text-muted hover:text-foreground text-sm"
          >
            ← Back
          </Link>
          <h1 className="font-display text-lg font-bold">Manage Market</h1>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-4 space-y-4">
        {/* Market info */}
        <div>
          <div className="flex items-start justify-between gap-2 mb-1">
            <h2 className="font-display text-xl font-bold leading-tight">
              {market.question}
            </h2>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                isResolved
                  ? "bg-green-dim text-green"
                  : isCancelled
                    ? "bg-red-dim text-red"
                    : "bg-gold-dim text-gold"
              }`}
            >
              {market.status}
            </span>
          </div>
          {market.description && (
            <p className="text-sm text-muted">{market.description}</p>
          )}
          <div className="mt-2 flex gap-4 text-xs text-muted">
            <span>{formatDollars(totalVolume)} pool</span>
            <span>{market._count.bets} bets</span>
            <span>b={market.bParam}</span>
          </div>
        </div>

        {/* Current odds */}
        {!isResolved && !isCancelled && (
          <ProbabilityBar
            outcomes={market.outcomes.map((o, i) => ({
              label: o.label,
              probability: prices[i],
            }))}
          />
        )}

        {/* Action buttons */}
        {canResolve && (
          <AdminMarketActions
            marketId={market.id}
            outcomes={market.outcomes.map((o) => ({
              id: o.id,
              label: o.label,
            }))}
          />
        )}

        {/* Payout table */}
        {payoutData && payoutData.payouts.length > 0 && (
          <PayoutTable {...payoutData} />
        )}

        {/* All bets (admin view) */}
        <section>
          <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted mb-2">
            All Bets ({market.bets.length})
          </h3>
          {market.bets.length === 0 ? (
            <div className="text-sm text-muted">No bets yet</div>
          ) : (
            <div className="space-y-1">
              {market.bets.map((b) => (
                <div
                  key={b.id}
                  className="rounded-lg bg-surface p-2 text-sm flex items-center justify-between"
                >
                  <div>
                    <span className="font-medium">{b.user.name}</span>
                    <span className="text-muted"> → </span>
                    <span className="text-blue">{b.outcome.label}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">
                      {formatDollars(toNumber(b.cost))}
                    </div>
                    <div className="text-xs text-muted">
                      {b.shares.toFixed(1)} shares @{" "}
                      {Math.round(b.priceAtBet * 100)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
