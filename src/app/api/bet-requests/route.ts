import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toNumber, getBaseUrl } from "@/lib/utils";
import { postToAdminGroupMe, formatBetRequestAdmin } from "@/lib/groupme";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { userName, venmoUsername, marketId, outcomeId, amount } = body;

  if (
    !userName?.trim() ||
    !venmoUsername?.trim() ||
    !marketId ||
    !outcomeId ||
    !amount
  ) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }

  if (amount < 1) {
    return NextResponse.json({ error: "Minimum bet is $1" }, { status: 400 });
  }

  // Check max bet amount
  const settings = await prisma.settings.findUnique({
    where: { id: "global" },
  });
  const maxBet = settings ? toNumber(settings.maxBetAmount) : 100;

  if (amount > maxBet) {
    return NextResponse.json(
      { error: `Maximum bet is $${maxBet}` },
      { status: 400 },
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
      { status: 400 },
    );
  }

  if (new Date() > market.closesAt) {
    return NextResponse.json({ error: "Market has closed" }, { status: 400 });
  }

  const outcome = market.outcomes.find((o) => o.id === outcomeId);
  if (!outcome) {
    return NextResponse.json({ error: "Invalid outcome" }, { status: 400 });
  }

  const betRequest = await prisma.betRequest.create({
    data: {
      userName: userName.trim(),
      venmoUsername: venmoUsername.trim(),
      marketId,
      outcomeId,
      amount,
    },
  });

  // Notify admin via GroupMe (await so Vercel doesn't kill the request)
  const baseUrl = getBaseUrl();
  const [infoMsg, idMsg] = formatBetRequestAdmin(
    betRequest.id,
    userName.trim(),
    venmoUsername.trim(),
    amount,
    outcome.label,
    market.question,
    `${baseUrl}/admin`,
  );
  await postToAdminGroupMe(infoMsg);
  await postToAdminGroupMe(idMsg);

  return NextResponse.json({ id: betRequest.id, status: "PENDING" });
}
