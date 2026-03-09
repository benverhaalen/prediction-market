import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin, checkCsrfOrigin } from "@/lib/auth";
import { toNumber } from "@/lib/utils";
import { postToGroupMe, formatCancellation } from "@/lib/groupme";
import { Prisma } from "@/generated/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!checkCsrfOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const marketQuestion = await prisma.$transaction(async (tx) => {
    // Lock the market row to prevent double-cancel
    await tx.$queryRaw`SELECT id FROM "Market" WHERE id = ${id} FOR UPDATE`;

    const market = await tx.market.findUnique({
      where: { id },
      include: {
        bets: { include: { user: true } },
      },
    });

    if (!market) {
      throw new Error("Market not found");
    }
    if (market.status === "RESOLVED" || market.status === "CANCELLED") {
      throw new Error("Cannot cancel");
    }

    // Mark market cancelled
    await tx.market.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    // Refund each bet
    for (const bet of market.bets) {
      const cost = toNumber(bet.cost);
      await tx.bet.update({
        where: { id: bet.id },
        data: {
          grossPayout: bet.cost,
          rakePaid: new Prisma.Decimal("0"),
          netPayout: bet.cost,
        },
      });

      await tx.houseLedger.create({
        data: {
          marketId: id,
          betId: bet.id,
          type: "REFUND",
          amount: new Prisma.Decimal((-cost).toFixed(4)),
          description: `Refund to ${bet.user.name}`,
        },
      });
    }

    // Auto-reject pending requests
    await tx.betRequest.updateMany({
      where: { marketId: id, status: "PENDING" },
      data: { status: "EXPIRED" },
    });

    return market.question;
  });

  // GroupMe notification
  await postToGroupMe(formatCancellation(marketQuestion));

  return NextResponse.json({ success: true });
}
