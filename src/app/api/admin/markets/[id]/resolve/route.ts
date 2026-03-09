import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth";
import { computePayouts } from "@/lib/lmsr";
import { toNumber, getBaseUrl } from "@/lib/utils";
import { postToGroupMe, formatResolution } from "@/lib/groupme";
import { Prisma } from "@/generated/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { winningOutcomeId } = await request.json();

  if (!winningOutcomeId) {
    return NextResponse.json(
      { error: "Winning outcome ID required" },
      { status: 400 },
    );
  }

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
    },
  });

  if (!market) {
    return NextResponse.json({ error: "Market not found" }, { status: 404 });
  }
  if (market.status === "RESOLVED") {
    return NextResponse.json({ error: "Already resolved" }, { status: 409 });
  }
  if (market.status === "CANCELLED") {
    return NextResponse.json(
      { error: "Market was cancelled" },
      { status: 409 },
    );
  }

  const winningOutcome = market.outcomes.find((o) => o.id === winningOutcomeId);
  if (!winningOutcome) {
    return NextResponse.json({ error: "Invalid outcome" }, { status: 400 });
  }

  // Fetch rake setting
  const settings = await prisma.settings.findUnique({
    where: { id: "global" },
  });
  const rakePercent = settings?.rakePercent ?? 0.05;

  // Compute payouts (parimutuel: house takes rake off top, winners split rest)
  const betsForPayout = market.bets.map((b) => ({
    id: b.id,
    userId: b.userId,
    userName: b.user.name,
    outcomeId: b.outcomeId,
    outcomeLabel: b.outcome.label,
    shares: b.shares,
    cost: toNumber(b.cost),
  }));

  const payouts = computePayouts(betsForPayout, winningOutcomeId, rakePercent);

  // Execute in transaction
  await prisma.$transaction(async (tx) => {
    // Update market
    await tx.market.update({
      where: { id },
      data: {
        status: "RESOLVED",
        resolution: winningOutcomeId,
        resolvedAt: new Date(),
      },
    });

    // Update each bet with payout info
    for (const payout of payouts) {
      await tx.bet.update({
        where: { id: payout.betId },
        data: {
          grossPayout: new Prisma.Decimal(payout.grossPayout.toFixed(4)),
          rakePaid: new Prisma.Decimal(payout.rake.toFixed(4)),
          netPayout: new Prisma.Decimal(payout.netPayout.toFixed(4)),
        },
      });
    }

    // Auto-reject pending bet requests
    await tx.betRequest.updateMany({
      where: { marketId: id, status: "PENDING" },
      data: { status: "EXPIRED" },
    });
  });

  // GroupMe notification
  const totalPool = payouts.reduce((sum, p) => sum + p.cost, 0);
  const totalRake = payouts.reduce((sum, p) => sum + p.rake, 0);
  const baseUrl = getBaseUrl();

  const winnerCount = payouts.filter(
    (p) => p.isWinner && p.netPayout > 0,
  ).length;
  await postToGroupMe(
    formatResolution(
      market.question,
      winningOutcome.label,
      winnerCount,
      totalPool,
      totalRake,
      `${baseUrl}/market/${id}`,
    ),
  );

  return NextResponse.json({
    success: true,
    payouts,
    totalPool,
    totalRake,
  });
}
