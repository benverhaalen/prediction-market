import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toNumber, getBaseUrl } from "@/lib/utils";
import { getPrices } from "@/lib/lmsr";
import { postToAdminGroupMe, formatBetRequestAdmin } from "@/lib/groupme";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { userName, venmoUsername, marketId, outcomeId, amount, expectedPrice } =
    body;

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
    return NextResponse.json(
      { error: "Minimum amount is $1" },
      { status: 400 },
    );
  }

  // Check settings
  const settings = await prisma.settings.findUnique({
    where: { id: "global" },
  });
  const maxBet = settings ? toNumber(settings.maxBetAmount) : 100;

  if (amount > maxBet) {
    return NextResponse.json(
      { error: `Maximum amount is $${maxBet}` },
      { status: 400 },
    );
  }

  // Block admin from placing predictions
  if (
    settings?.adminUserName &&
    userName.trim().toLowerCase() === settings.adminUserName.toLowerCase()
  ) {
    return NextResponse.json(
      { error: "This name is reserved" },
      { status: 403 },
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
      { error: "Market is not accepting predictions" },
      { status: 400 },
    );
  }

  // Market closing enforcement
  if (new Date() > market.closesAt) {
    if (market.status === "OPEN") {
      await prisma.market.update({
        where: { id: marketId },
        data: { status: "CLOSED" },
      });
    }
    return NextResponse.json({ error: "Market has closed" }, { status: 400 });
  }

  const outcome = market.outcomes.find((o) => o.id === outcomeId);
  if (!outcome) {
    return NextResponse.json({ error: "Invalid outcome" }, { status: 400 });
  }

  // Slippage protection
  if (expectedPrice !== undefined && expectedPrice > 0) {
    const shares = market.outcomes.map((o) => o.shares);
    const prices = getPrices({ shares, b: market.bParam });
    const outcomeIndex = market.outcomes.findIndex((o) => o.id === outcomeId);
    const actualPrice = prices[outcomeIndex];
    const slippage = Math.abs(actualPrice - expectedPrice) / expectedPrice;

    if (slippage > 0.1) {
      return NextResponse.json(
        {
          error: `Odds have changed (was ${Math.round(expectedPrice * 100)}%, now ${Math.round(actualPrice * 100)}%). Please review and try again.`,
        },
        { status: 409 },
      );
    }
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
