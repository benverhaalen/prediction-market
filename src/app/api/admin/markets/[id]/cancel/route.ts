import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth";
import { toNumber } from "@/lib/utils";
import { postToGroupMe, formatCancellation } from "@/lib/groupme";
import { Prisma } from "@/generated/prisma";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const market = await prisma.market.findUnique({
    where: { id },
    include: {
      bets: { include: { user: true } },
    },
  });

  if (!market) {
    return NextResponse.json({ error: "Market not found" }, { status: 404 });
  }
  if (market.status === "RESOLVED" || market.status === "CANCELLED") {
    return NextResponse.json({ error: "Cannot cancel" }, { status: 409 });
  }

  await prisma.$transaction(async (tx) => {
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
  });

  // GroupMe notification
  await postToGroupMe(formatCancellation(market.question));

  return NextResponse.json({ success: true });
}
