import { prisma } from "@/lib/prisma";
import { getPrices } from "@/lib/lmsr";
import { MarketCard } from "@/components/MarketCard";
import { toNumber } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Home() {
  const markets = await prisma.market.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      outcomes: true,
      _count: { select: { bets: true } },
      bets: { select: { cost: true } },
    },
  });

  const marketCards = markets.map((m) => {
    const shares = m.outcomes.map((o) => o.shares);
    const prices = getPrices({ shares, b: m.bParam });
    const totalVolume = m.bets.reduce((sum, b) => sum + toNumber(b.cost), 0);
    const winnerOutcome = m.resolution
      ? m.outcomes.find((o) => o.id === m.resolution)
      : null;

    return {
      id: m.id,
      question: m.question,
      status: m.status,
      closesAt: m.closesAt.toISOString(),
      totalVolume,
      betCount: m._count.bets,
      outcomes: m.outcomes.map((o, i) => ({
        id: o.id,
        label: o.label,
        probability: prices[i],
      })),
      winnerLabel: winnerOutcome?.label ?? null,
    };
  });

  const openMarkets = marketCards.filter(
    (m) => m.status === "OPEN" || m.status === "CLOSED",
  );
  const resolvedMarkets = marketCards.filter((m) => m.status === "RESOLVED");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <h1 className="font-display text-2xl font-bold tracking-tight">
            PREDICTIONS
          </h1>
          <Link
            href="/admin"
            className="text-xs text-muted hover:text-foreground transition-colors"
          >
            Admin
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-4">
        {/* Active markets */}
        {openMarkets.length > 0 && (
          <section className="mb-6">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted mb-3">
              Active Markets
            </h2>
            <div className="space-y-3">
              {openMarkets.map((m) => (
                <MarketCard key={m.id} {...m} />
              ))}
            </div>
          </section>
        )}

        {/* Resolved markets */}
        {resolvedMarkets.length > 0 && (
          <section>
            <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted mb-3">
              Resolved
            </h2>
            <div className="space-y-3">
              {resolvedMarkets.map((m) => (
                <MarketCard key={m.id} {...m} />
              ))}
            </div>
          </section>
        )}

        {marketCards.length === 0 && (
          <div className="text-center py-20 text-muted">
            <p className="font-display text-xl">No markets yet</p>
            <p className="text-sm mt-1">Check back soon</p>
          </div>
        )}
      </main>
    </div>
  );
}
