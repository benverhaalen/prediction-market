import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth";
import { toNumber } from "@/lib/utils";
import { roundCents } from "@/lib/lmsr";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ marketId: string }> },
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { marketId } = await params;

  const market = await prisma.market.findUnique({
    where: { id: marketId },
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

  const winnerOutcome = market.outcomes.find((o) => o.id === market.resolution);

  const payouts = market.bets.map((b) => ({
    userName: b.user.name,
    outcomeLabel: b.outcome.label,
    shares: b.shares,
    cost: toNumber(b.cost),
    grossPayout: toNumber(b.grossPayout ?? 0),
    rakePaid: toNumber(b.rakePaid ?? 0),
    netPayout: toNumber(b.netPayout ?? 0),
    isWinner: b.outcomeId === market.resolution,
  }));

  const totalPool = roundCents(payouts.reduce((sum, p) => sum + p.cost, 0));
  const totalRake = roundCents(payouts.reduce((sum, p) => sum + p.rakePaid, 0));

  return NextResponse.json({
    market: {
      question: market.question,
      status: market.status,
      winnerLabel: winnerOutcome?.label ?? null,
    },
    payouts,
    totalPool,
    totalRake,
  });
}
