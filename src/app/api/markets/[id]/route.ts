import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPrices, previewTrade, roundCents } from "@/lib/lmsr";
import { toNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const market = await prisma.market.findUnique({
    where: { id },
    include: {
      outcomes: true,
      _count: { select: { bets: true } },
      bets: { select: { cost: true, outcomeId: true, userId: true } },
    },
  });

  if (!market) {
    return NextResponse.json({ error: "Market not found" }, { status: 404 });
  }

  const shares = market.outcomes.map((o) => o.shares);
  const prices = getPrices({ shares, b: market.bParam });
  const totalVolume = market.bets.reduce((sum, b) => sum + toNumber(b.cost), 0);

  const result: Record<string, unknown> = {
    id: market.id,
    question: market.question,
    description: market.description,
    status: market.status,
    resolution: market.resolution,
    bParam: market.bParam,
    closesAt: market.closesAt,
    createdAt: market.createdAt,
    resolvedAt: market.resolvedAt,
    totalVolume,
    betCount: market._count.bets,
    outcomes: market.outcomes.map((o, i) => ({
      id: o.id,
      label: o.label,
      probability: prices[i],
    })),
  };

  // Preview trade if requested
  const searchParams = request.nextUrl.searchParams;
  if (searchParams.get("preview") === "true") {
    const outcomeId = searchParams.get("outcomeId");
    const amount = parseFloat(searchParams.get("amount") ?? "0");

    if (outcomeId && amount > 0) {
      const outcomeIndex = market.outcomes.findIndex((o) => o.id === outcomeId);
      if (outcomeIndex !== -1) {
        const settings = await prisma.settings.findUnique({
          where: { id: "global" },
        });
        const rakePercent = settings?.rakePercent ?? 0.05;

        const existingOutcomeShares = market.outcomes[outcomeIndex].shares;
        const preview = previewTrade(
          { shares, b: market.bParam },
          outcomeIndex,
          amount,
          totalVolume,
          existingOutcomeShares,
        );

        // Apply rake to preview (off the top of pool)
        const poolAfterBet = totalVolume + amount;
        const rakeAmount = roundCents(poolAfterBet * rakePercent);
        const distributablePool = poolAfterBet - rakeAmount;
        const totalWinningShares = existingOutcomeShares + preview.shares;
        let adjustedPayout =
          totalWinningShares > 0
            ? roundCents(
                (preview.shares / totalWinningShares) * distributablePool,
              )
            : 0;

        // Safety: if rake would make this bettor lose money, show no-rake payout
        if (adjustedPayout < amount) {
          adjustedPayout = preview.estimatedPayout;
        }

        const outcomeBettors = new Set(
          market.bets
            .filter((b) => b.outcomeId === outcomeId)
            .map((b) => b.userId),
        ).size;
        const poolShare = poolAfterBet > 0 ? adjustedPayout / poolAfterBet : 0;

        result.preview = {
          ...preview,
          estimatedPayout: adjustedPayout,
          multiplier: adjustedPayout / amount,
          outcomeBettors,
          poolAfterBet,
          poolShare,
          rakePercent,
        };
      }
    }
  }

  return NextResponse.json(result);
}
