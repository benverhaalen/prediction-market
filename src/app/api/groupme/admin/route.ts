import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeTrade } from "@/lib/lmsr";
import { toNumber, getBaseUrl } from "@/lib/utils";
import {
  postToGroupMe,
  postToAdminGroupMe,
  formatBetConfirmed,
} from "@/lib/groupme";
import { Prisma } from "@/generated/prisma";

/**
 * GroupMe callback for admin bot.
 * Receives all messages posted in the admin group.
 * Parses commands: "y <id>", "n <id>", "status"
 */
export async function POST(request: NextRequest) {
  const data = await request.json();

  // Ignore messages from bots (prevent loops)
  if (data.sender_type === "bot") {
    return NextResponse.json({ ok: true });
  }

  // Verify this is from the admin group
  const settings = await prisma.settings.findUnique({
    where: { id: "global" },
  });

  if (
    settings?.adminGroupmeGroupId &&
    data.group_id !== settings.adminGroupmeGroupId
  ) {
    return NextResponse.json({ ok: true });
  }

  const text = (data.text || "").trim().toLowerCase();

  // Handle "y <id>" (confirm)
  const confirmMatch = text.match(/^y\s+(.+)$/i);
  if (confirmMatch) {
    const betRequestId = confirmMatch[1].trim();
    await handleConfirm(betRequestId, settings);
    return NextResponse.json({ ok: true });
  }

  // Handle "n <id>" (reject)
  const rejectMatch = text.match(/^n\s+(.+)$/i);
  if (rejectMatch) {
    const betRequestId = rejectMatch[1].trim();
    await handleReject(betRequestId);
    return NextResponse.json({ ok: true });
  }

  // Handle "status"
  if (text === "status") {
    await handleStatus();
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}

async function handleConfirm(
  betRequestId: string,
  settings: { rakePercent?: number } | null,
) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const betRequest = await tx.betRequest.findUnique({
        where: { id: betRequestId },
        include: {
          market: { include: { outcomes: true } },
          outcome: true,
        },
      });

      if (!betRequest) {
        throw new Error("Bet request not found");
      }
      if (betRequest.status !== "PENDING") {
        throw new Error("Already processed");
      }
      if (betRequest.market.status !== "OPEN") {
        await tx.betRequest.update({
          where: { id: betRequestId },
          data: { status: "EXPIRED" },
        });
        throw new Error("Market is no longer open");
      }

      // Lock outcome rows
      await tx.$queryRaw`
        SELECT id FROM "Outcome"
        WHERE "marketId" = ${betRequest.marketId}
        FOR UPDATE
      `;

      const outcomes = await tx.outcome.findMany({
        where: { marketId: betRequest.marketId },
        orderBy: { id: "asc" },
      });

      const outcomeIndex = outcomes.findIndex(
        (o) => o.id === betRequest.outcomeId,
      );
      if (outcomeIndex === -1) throw new Error("Outcome not found");

      const shares = outcomes.map((o) => o.shares);
      const dollarAmount = toNumber(betRequest.amount);

      const trade = computeTrade(
        { shares, b: betRequest.market.bParam },
        outcomeIndex,
        dollarAmount,
      );

      const priceAtBet = trade.newPrices[outcomeIndex];

      let user = await tx.user.findUnique({
        where: { name: betRequest.userName },
      });
      if (!user) {
        user = await tx.user.create({
          data: { name: betRequest.userName },
        });
      }

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

      await tx.outcome.update({
        where: { id: betRequest.outcomeId },
        data: { shares: { increment: trade.shares } },
      });

      await tx.betRequest.update({
        where: { id: betRequestId },
        data: {
          status: "CONFIRMED",
          confirmedAt: new Date(),
          userId: user.id,
          betId: bet.id,
        },
      });

      await tx.houseLedger.create({
        data: {
          marketId: betRequest.marketId,
          betId: bet.id,
          type: "TRADE_REVENUE",
          amount: new Prisma.Decimal(dollarAmount.toFixed(4)),
          description: `${betRequest.userName} bet $${dollarAmount} on ${betRequest.outcome.label}`,
        },
      });

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
        userName: betRequest.userName,
        outcomeLabel: betRequest.outcome.label,
        dollarAmount,
      };
    });

    // Reply to admin
    await postToAdminGroupMe(
      `Confirmed! ${result.userName}'s $${result.dollarAmount.toFixed(2)} bet on "${result.outcomeLabel}" is live. (${result.bet.shares.toFixed(1)} shares)`,
    );

    // Post to public group chat
    const baseUrl = getBaseUrl();
    await postToGroupMe(
      formatBetConfirmed(
        result.dollarAmount,
        result.outcomeLabel,
        result.market.question,
        result.outcomes.map((o) => ({ label: o.label })),
        result.newPrices,
        `${baseUrl}/market/${result.market.id}`,
      ),
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    await postToAdminGroupMe(`Error confirming bet: ${msg}`);
  }
}

async function handleReject(betRequestId: string) {
  try {
    const betRequest = await prisma.betRequest.findUnique({
      where: { id: betRequestId },
    });

    if (!betRequest) {
      await postToAdminGroupMe(`Bet request not found: ${betRequestId}`);
      return;
    }

    if (betRequest.status !== "PENDING") {
      await postToAdminGroupMe(
        `Bet request already ${betRequest.status.toLowerCase()}`,
      );
      return;
    }

    await prisma.betRequest.update({
      where: { id: betRequestId },
      data: { status: "REJECTED" },
    });

    await postToAdminGroupMe(
      `Rejected ${betRequest.userName}'s $${toNumber(betRequest.amount).toFixed(2)} bet request.`,
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    await postToAdminGroupMe(`Error rejecting bet: ${msg}`);
  }
}

async function handleStatus() {
  try {
    const pending = await prisma.betRequest.findMany({
      where: { status: "PENDING" },
      include: {
        market: { select: { question: true } },
        outcome: { select: { label: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    if (pending.length === 0) {
      await postToAdminGroupMe("No pending bet requests.");
      return;
    }

    const lines = pending.map(
      (r) =>
        `- ${r.userName} (${r.venmoUsername}): $${toNumber(r.amount).toFixed(2)} on "${r.outcome.label}" [${r.market.question}]\n  ID: ${r.id}`,
    );

    await postToAdminGroupMe(
      [`${pending.length} PENDING REQUESTS:`, "", ...lines].join("\n"),
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    await postToAdminGroupMe(`Error fetching status: ${msg}`);
  }
}
