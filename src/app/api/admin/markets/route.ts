import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth";
import { postToGroupMe, formatNewMarket } from "@/lib/groupme";
import { getBaseUrl } from "@/lib/utils";

export async function POST(request: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { question, description, outcomes, closesAt, bParam } = body;

  if (!question?.trim() || !outcomes?.length || !closesAt) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }

  if (outcomes.length < 2) {
    return NextResponse.json(
      { error: "Need at least 2 outcomes" },
      { status: 400 },
    );
  }

  const settings = await prisma.settings.findUnique({
    where: { id: "global" },
  });
  const b = bParam ?? settings?.defaultBParam ?? 100;

  const market = await prisma.market.create({
    data: {
      question: question.trim(),
      description: description?.trim() || null,
      bParam: b,
      closesAt: new Date(closesAt),
      outcomes: {
        create: outcomes.map((label: string) => ({
          label: label.trim(),
          shares: 0,
        })),
      },
      lastNotifiedPrices: undefined,
    },
    include: { outcomes: true },
  });

  // Set initial notified prices (1/n for each outcome)
  const n = market.outcomes.length;
  const initialPrices: Record<string, number> = {};
  for (const o of market.outcomes) {
    initialPrices[o.id] = 1 / n;
  }
  await prisma.market.update({
    where: { id: market.id },
    data: { lastNotifiedPrices: initialPrices },
  });

  // Post to GroupMe (fire-and-forget)
  const baseUrl = getBaseUrl();
  postToGroupMe(
    formatNewMarket(
      market.question,
      market.outcomes,
      market.closesAt,
      `${baseUrl}/market/${market.id}`,
    ),
  );

  return NextResponse.json(market);
}
