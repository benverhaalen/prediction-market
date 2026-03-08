import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPrices } from "@/lib/lmsr";
import { toNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const markets = await prisma.market.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      outcomes: true,
      _count: { select: { bets: true } },
      bets: { select: { cost: true } },
    },
  });

  const result = markets.map((m) => {
    const shares = m.outcomes.map((o) => o.shares);
    const prices = getPrices({ shares, b: m.bParam });
    const totalVolume = m.bets.reduce((sum, b) => sum + toNumber(b.cost), 0);

    return {
      id: m.id,
      question: m.question,
      description: m.description,
      status: m.status,
      resolution: m.resolution,
      closesAt: m.closesAt,
      createdAt: m.createdAt,
      totalVolume,
      betCount: m._count.bets,
      outcomes: m.outcomes.map((o, i) => ({
        id: o.id,
        label: o.label,
        probability: prices[i],
      })),
    };
  });

  return NextResponse.json(result);
}
