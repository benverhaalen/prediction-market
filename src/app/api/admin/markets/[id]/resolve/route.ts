import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin, checkCsrfOrigin } from "@/lib/auth";
import { computePayouts } from "@/lib/lmsr";
import { toNumber, getBaseUrl, formatDollars } from "@/lib/utils";
import {
  postToGroupMe,
  postToAdminGroupMe,
  formatResolution,
} from "@/lib/groupme";
import { Prisma } from "@/generated/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!checkCsrfOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { winningOutcomeId, resolutionNote } = await request.json();

  if (!winningOutcomeId) {
    return NextResponse.json(
      { error: "Winning outcome ID required" },
      { status: 400 },
    );
  }

  if (!resolutionNote?.trim()) {
    return NextResponse.json(
      { error: "Resolution note required" },
      { status: 400 },
    );
  }

  // Fetch rake setting
  const settings = await prisma.settings.findUnique({
    where: { id: "global" },
  });
  const rakePercent = settings?.rakePercent ?? 0.05;

  // Execute everything inside a transaction with row-level locking
  const result = await prisma.$transaction(async (tx) => {
    // Lock the market row to prevent double-resolve
    await tx.$queryRaw`SELECT id FROM "Market" WHERE id = ${id} FOR UPDATE`;

    const market = await tx.market.findUnique({
      where: { id },
      include: {
        outcomes: true,
        bets: {
          include: {
            user: true,
            outcome: true,
            betRequest: { select: { venmoUsername: true } },
          },
        },
      },
    });

    if (!market) {
      throw new Error("Market not found");
    }
    if (market.status === "RESOLVED") {
      throw new Error("Already resolved");
    }
    if (market.status === "CANCELLED") {
      throw new Error("Market was cancelled");
    }

    const winningOutcome = market.outcomes.find(
      (o) => o.id === winningOutcomeId,
    );
    if (!winningOutcome) {
      throw new Error("Invalid outcome");
    }

    // Compute payouts
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

    // Update market
    await tx.market.update({
      where: { id },
      data: {
        status: "RESOLVED",
        resolution: winningOutcomeId,
        resolvedAt: new Date(),
        resolutionNote: resolutionNote.trim(),
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

    // Build winner info for admin pay reminder
    const winners = payouts
      .filter((p) => p.isWinner && p.netPayout > 0)
      .map((p) => {
        const bet = market.bets.find((b) => b.id === p.betId);
        return {
          userName: p.userName,
          venmoUsername: bet?.betRequest?.venmoUsername ?? "",
          netPayout: p.netPayout,
        };
      });

    return {
      payouts,
      market,
      winningOutcome,
      winners,
    };
  });

  // GroupMe notifications (fire-and-forget, after transaction commits)
  const totalPool = result.payouts.reduce((sum, p) => sum + p.cost, 0);
  const totalRake = result.payouts.reduce((sum, p) => sum + p.rake, 0);
  const baseUrl = getBaseUrl();

  const winnerCount = result.payouts.filter(
    (p) => p.isWinner && p.netPayout > 0,
  ).length;

  await postToGroupMe(
    formatResolution(
      result.market.question,
      result.winningOutcome.label,
      winnerCount,
      totalPool,
      totalRake,
      `${baseUrl}/market/${id}`,
      resolutionNote.trim(),
    ),
  );

  // Admin pay-now reminder
  if (result.winners.length > 0) {
    const payLines = result.winners.map(
      (w) =>
        `- ${w.userName} (${w.venmoUsername || "no venmo"}): ${formatDollars(w.netPayout)}`,
    );
    const adminMsg = [
      `PAY NOW: "${result.market.question}"`,
      "",
      ...payLines,
      "",
      `Total: ${formatDollars(result.winners.reduce((s, w) => s + w.netPayout, 0))}`,
    ].join("\n");
    await postToAdminGroupMe(adminMsg);
  }

  return NextResponse.json({
    success: true,
    payouts: result.payouts,
    totalPool,
    totalRake,
  });
}
