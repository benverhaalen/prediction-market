import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth";
import { computeTrade, getPrices } from "@/lib/lmsr";
import { toNumber } from "@/lib/utils";
import {
  postToGroupMe,
  shouldNotifyOddsShift,
  formatOddsShift,
} from "@/lib/groupme";
import { getBaseUrl } from "@/lib/utils";
import { Prisma } from "@/generated/prisma";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Use interactive transaction with row-level locking
  const result = await prisma.$transaction(async (tx) => {
    // 1. Get and lock the bet request
    const betRequest = await tx.betRequest.findUnique({
      where: { id },
      include: {
        market: { include: { outcomes: true } },
        outcome: true,
      },
    });

    if (!betRequest) {
      throw new Error("Bet request not found");
    }
    if (betRequest.status !== "PENDING") {
      throw new Error("Bet request already processed");
    }
    if (betRequest.market.status !== "OPEN") {
      // Auto-reject if market closed
      await tx.betRequest.update({
        where: { id },
        data: { status: "EXPIRED" },
      });
      throw new Error("Market is no longer open");
    }

    // 2. Lock outcome rows with SELECT FOR UPDATE
    await tx.$queryRaw`
      SELECT id FROM "Outcome"
      WHERE "marketId" = ${betRequest.marketId}
      FOR UPDATE
    `;

    // 3. Re-read outcomes (now locked)
    const outcomes = await tx.outcome.findMany({
      where: { marketId: betRequest.marketId },
      orderBy: { id: "asc" },
    });

    const outcomeIndex = outcomes.findIndex((o) => o.id === betRequest.outcomeId);
    if (outcomeIndex === -1) {
      throw new Error("Outcome not found");
    }

    const shares = outcomes.map((o) => o.shares);
    const dollarAmount = toNumber(betRequest.amount);

    // 4. Compute LMSR trade
    const trade = computeTrade(
      { shares, b: betRequest.market.bParam },
      outcomeIndex,
      dollarAmount
    );

    const priceAtBet = trade.newPrices[outcomeIndex];

    // 5. Get or create user
    let user = await tx.user.findUnique({
      where: { name: betRequest.userName },
    });
    if (!user) {
      user = await tx.user.create({
        data: { name: betRequest.userName },
      });
    }

    // 6. Create bet record
    const bet = await tx.bet.create({
      data: {
        userId: user.id,
        marketId: betRequest.marketId,
        outcomeId: betRequest.outcomeId,
        shares: trade.shares,
        cost: new Prisma.Decimal(dollarAmount.toFixed(4)),
        priceAtBet,
      },
    });

    // 7. Update outcome shares
    await tx.outcome.update({
      where: { id: betRequest.outcomeId },
      data: { shares: { increment: trade.shares } },
    });

    // 8. Update bet request
    await tx.betRequest.update({
      where: { id },
      data: {
        status: "CONFIRMED",
        confirmedAt: new Date(),
        userId: user.id,
        betId: bet.id,
      },
    });

    // 9. Record house ledger entry
    await tx.houseLedger.create({
      data: {
        marketId: betRequest.marketId,
        betId: bet.id,
        type: "TRADE_REVENUE",
        amount: new Prisma.Decimal(dollarAmount.toFixed(4)),
        description: `${betRequest.userName} bet $${dollarAmount} on ${betRequest.outcome.label}`,
      },
    });

    // 10. Store price snapshots
    for (let i = 0; i < outcomes.length; i++) {
      await tx.priceSnapshot.create({
        data: {
          marketId: betRequest.marketId,
          outcomeId: outcomes[i].id,
          price: trade.newPrices[i],
        },
      });
    }

    return {
      bet,
      newPrices: trade.newPrices,
      outcomes,
      market: betRequest.market,
    };
  });

  // After transaction: check for GroupMe notification (fire-and-forget)
  const lastNotified = result.market.lastNotifiedPrices as Record<string, number> | null;
  const outcomeIds = result.outcomes.map((o) => o.id);

  if (shouldNotifyOddsShift(result.newPrices, lastNotified, outcomeIds)) {
    const baseUrl = getBaseUrl();
    const outcomesWithIds = result.outcomes.map((o) => ({
      id: o.id,
      label: o.label,
    }));

    postToGroupMe(
      formatOddsShift(
        result.market.question,
        outcomesWithIds,
        result.newPrices,
        lastNotified ?? {},
        `${baseUrl}/market/${result.market.id}`
      )
    );

    // Update last notified prices
    const newNotifiedPrices: Record<string, number> = {};
    result.outcomes.forEach((o, i) => {
      newNotifiedPrices[o.id] = result.newPrices[i];
    });
    prisma.market
      .update({
        where: { id: result.market.id },
        data: { lastNotifiedPrices: newNotifiedPrices },
      })
      .catch(console.error);
  }

  return NextResponse.json({
    success: true,
    betId: result.bet.id,
    shares: result.bet.shares,
    newPrices: result.newPrices,
  });
}
