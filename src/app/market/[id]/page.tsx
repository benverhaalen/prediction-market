import { prisma } from "@/lib/prisma";
import { getPrices } from "@/lib/lmsr";
import { toNumber, formatDollars, shortCode, relativeTime } from "@/lib/utils";
import { OddsDisplay } from "@/components/OddsDisplay";
import { PriceChart } from "@/components/PriceChart";
import { BetRequestForm } from "@/components/BetRequestForm";
import { PayoutPreview } from "@/components/PayoutPreview";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function MarketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const market = await prisma.market.findUnique({
    where: { id },
    include: {
      outcomes: true,
      bets: {
        include: {
          user: true,
          outcome: true,
        },
      },
      _count: { select: { bets: true } },
    },
  });

  if (!market) notFound();

  const settings = await prisma.settings.findUnique({
    where: { id: "global" },
  });

  const shares = market.outcomes.map((o) => o.shares);
  const prices = getPrices({ shares, b: market.bParam });
  const totalVolume = market.bets.reduce((sum, b) => sum + toNumber(b.cost), 0);
  const isBinary = market.outcomes.length === 2;
  const n = market.outcomes.length;
  const initialProb = 1 / n;

  // Price history
  const snapshots = await prisma.priceSnapshot.findMany({
    where: { marketId: id },
    orderBy: { timestamp: "asc" },
  });

  // Group snapshots by timestamp
  const timeMap = new Map<string, Record<string, number>>();
  for (const snap of snapshots) {
    const key = snap.timestamp.toISOString();
    if (!timeMap.has(key)) timeMap.set(key, {});
    timeMap.get(key)![snap.outcomeId] = snap.price;
  }

  const chartData = Array.from(timeMap.entries()).map(
    ([timestamp, pricesMap]) => ({
      timestamp,
      prices: pricesMap,
    }),
  );

  // Add initial point
  const initialPrices: Record<string, number> = {};
  for (const o of market.outcomes) {
    initialPrices[o.id] = initialProb;
  }
  chartData.unshift({
    timestamp: market.createdAt.toISOString(),
    prices: initialPrices,
  });

  // Add current point
  const currentPriceMap: Record<string, number> = {};
  market.outcomes.forEach((o, i) => {
    currentPriceMap[o.id] = prices[i];
  });
  if (snapshots.length > 0) {
    chartData.push({
      timestamp: new Date().toISOString(),
      prices: currentPriceMap,
    });
  }

  const winnerOutcome = market.resolution
    ? market.outcomes.find((o) => o.id === market.resolution)
    : null;

  const isOpen = market.status === "OPEN";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <Link
            href="/"
            className="text-muted hover:text-foreground transition-colors text-sm"
          >
            ← Back
          </Link>
          <h1 className="font-display text-lg font-bold tracking-tight">
            PREDICTIONS
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-4 space-y-4">
        {/* Question */}
        <div>
          <div className="flex items-start justify-between gap-2 mb-1">
            <h2 className="font-display text-xl font-bold leading-tight">
              {market.question}
            </h2>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                market.status === "RESOLVED"
                  ? "bg-green-dim text-green"
                  : market.status === "CLOSED"
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
            <span>
              {market.status === "RESOLVED"
                ? "Resolved"
                : `Closes ${relativeTime(market.closesAt)}`}
            </span>
          </div>
        </div>

        {/* Resolution result */}
        {winnerOutcome && (
          <div className="rounded-xl border border-green/30 bg-green-dim/20 p-4 text-center">
            <div className="text-sm text-muted">Result</div>
            <div className="font-display text-2xl font-bold text-green">
              {winnerOutcome.label}
            </div>
          </div>
        )}

        {/* Odds display */}
        {!winnerOutcome && (
          <OddsDisplay
            outcomes={market.outcomes.map((o, i) => ({
              id: o.id,
              label: o.label,
              probability: prices[i],
              initialProbability: initialProb,
            }))}
            isBinary={isBinary}
          />
        )}

        {/* Price chart */}
        <div>
          <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted mb-2">
            Price History
          </h3>
          <PriceChart
            data={chartData}
            outcomes={market.outcomes.map((o) => ({
              id: o.id,
              label: o.label,
            }))}
          />
        </div>

        {/* Payout preview */}
        {market.bets.length > 0 && (
          <PayoutPreview
            bets={market.bets.map((b) => ({
              userName: b.user.name,
              outcomeLabel: b.outcome.label,
              outcomeId: b.outcomeId,
              shares: b.shares,
              cost: toNumber(b.cost),
            }))}
            outcomes={market.outcomes.map((o) => ({
              id: o.id,
              label: o.label,
            }))}
            totalPool={totalVolume}
          />
        )}

        {/* Bet form */}
        {isOpen && (
          <BetRequestForm
            marketId={market.id}
            outcomes={market.outcomes.map((o, i) => ({
              id: o.id,
              label: o.label,
              probability: prices[i],
            }))}
            venmoHandle={settings?.venmoHandle ?? "@admin"}
            marketShortCode={shortCode(market.id)}
            maxBetAmount={
              settings?.maxBetAmount ? toNumber(settings.maxBetAmount) : 100
            }
          />
        )}
      </main>
    </div>
  );
}
