import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const market = await prisma.market.findUnique({
    where: { id },
    include: {
      _count: { select: { bets: true } },
    },
  });

  if (!market) {
    return NextResponse.json({ error: "Market not found" }, { status: 404 });
  }

  if (market._count.bets > 0) {
    return NextResponse.json(
      { error: "Cannot delete a market with existing bets. Cancel it instead." },
      { status: 400 }
    );
  }

  // Delete related records first, then the market
  await prisma.$transaction(async (tx) => {
    await tx.betRequest.deleteMany({ where: { marketId: id } });
    await tx.priceSnapshot.deleteMany({ where: { marketId: id } });
    await tx.houseLedger.deleteMany({ where: { marketId: id } });
    await tx.outcome.deleteMany({ where: { marketId: id } });
    await tx.market.delete({ where: { id } });
  });

  return NextResponse.json({ success: true });
}
