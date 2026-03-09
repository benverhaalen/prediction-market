import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin, hashPassword, checkCsrfOrigin } from "@/lib/auth";
import { toNumber } from "@/lib/utils";
import { postToGroupMe, formatCancellation } from "@/lib/groupme";
import { Prisma } from "@/generated/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await prisma.settings.upsert({
    where: { id: "global" },
    update: {},
    create: { id: "global" },
  });

  return NextResponse.json({
    defaultBParam: settings.defaultBParam,
    rakePercent: settings.rakePercent,
    siteEnabled: settings.siteEnabled,
    adminUserName: settings.adminUserName,
    groupmeBotId: settings.groupmeBotId,
    adminGroupmeBotId: settings.adminGroupmeBotId,
    adminGroupmeGroupId: settings.adminGroupmeGroupId,
    venmoHandle: settings.venmoHandle,
    maxBetAmount: settings.maxBetAmount,
  });
}

export async function PATCH(request: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!checkCsrfOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();

  // Check if kill switch is being toggled OFF
  if (body.siteEnabled === false) {
    const current = await prisma.settings.findUnique({
      where: { id: "global" },
    });
    if (current?.siteEnabled === true) {
      // Auto-cancel all open markets
      const openMarkets = await prisma.market.findMany({
        where: { status: "OPEN" },
        include: { bets: { include: { user: true } } },
      });

      for (const market of openMarkets) {
        await prisma.$transaction(async (tx) => {
          await tx.market.update({
            where: { id: market.id },
            data: { status: "CANCELLED" },
          });

          for (const bet of market.bets) {
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
                marketId: market.id,
                betId: bet.id,
                type: "REFUND",
                amount: new Prisma.Decimal((-toNumber(bet.cost)).toFixed(4)),
                description: `Refund to ${bet.user.name}`,
              },
            });
          }

          await tx.betRequest.updateMany({
            where: { marketId: market.id, status: "PENDING" },
            data: { status: "EXPIRED" },
          });
        });

        await postToGroupMe(formatCancellation(market.question));
      }
    }
  }

  const updateData: Record<string, unknown> = {};

  if (body.defaultBParam !== undefined)
    updateData.defaultBParam = body.defaultBParam;
  if (body.rakePercent !== undefined) updateData.rakePercent = body.rakePercent;
  if (body.siteEnabled !== undefined) updateData.siteEnabled = body.siteEnabled;
  if (body.adminUserName !== undefined)
    updateData.adminUserName = body.adminUserName || null;
  if (body.groupmeBotId !== undefined)
    updateData.groupmeBotId = body.groupmeBotId;
  if (body.groupmeToken !== undefined)
    updateData.groupmeToken = body.groupmeToken;
  if (body.adminGroupmeBotId !== undefined)
    updateData.adminGroupmeBotId = body.adminGroupmeBotId;
  if (body.adminGroupmeGroupId !== undefined)
    updateData.adminGroupmeGroupId = body.adminGroupmeGroupId;
  if (body.venmoHandle !== undefined) updateData.venmoHandle = body.venmoHandle;
  if (body.maxBetAmount !== undefined)
    updateData.maxBetAmount = body.maxBetAmount;
  if (body.newPassword) {
    updateData.adminPassword = await hashPassword(body.newPassword);
  }

  const settings = await prisma.settings.update({
    where: { id: "global" },
    data: updateData,
  });

  return NextResponse.json({
    defaultBParam: settings.defaultBParam,
    rakePercent: settings.rakePercent,
    siteEnabled: settings.siteEnabled,
    adminUserName: settings.adminUserName,
    groupmeBotId: settings.groupmeBotId,
    adminGroupmeBotId: settings.adminGroupmeBotId,
    adminGroupmeGroupId: settings.adminGroupmeGroupId,
    venmoHandle: settings.venmoHandle,
    maxBetAmount: settings.maxBetAmount,
  });
}
