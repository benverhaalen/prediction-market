import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { userName, marketId, outcomeId, amount } = body;

  if (!userName?.trim() || !marketId || !outcomeId || !amount) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  if (amount < 1) {
    return NextResponse.json(
      { error: "Minimum bet is $1" },
      { status: 400 }
    );
  }

  // Check market exists and is open
  const market = await prisma.market.findUnique({
    where: { id: marketId },
    include: { outcomes: true },
  });

  if (!market) {
    return NextResponse.json({ error: "Market not found" }, { status: 404 });
  }

  if (market.status !== "OPEN") {
    return NextResponse.json(
      { error: "Market is not accepting bets" },
      { status: 400 }
    );
  }

  if (new Date() > market.closesAt) {
    return NextResponse.json({ error: "Market has closed" }, { status: 400 });
  }

  const outcomeExists = market.outcomes.some((o) => o.id === outcomeId);
  if (!outcomeExists) {
    return NextResponse.json({ error: "Invalid outcome" }, { status: 400 });
  }

  const betRequest = await prisma.betRequest.create({
    data: {
      userName: userName.trim(),
      marketId,
      outcomeId,
      amount,
    },
  });

  return NextResponse.json({ id: betRequest.id, status: "PENDING" });
}
