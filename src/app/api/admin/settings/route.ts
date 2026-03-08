import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin, hashPassword } from "@/lib/auth";

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
    groupmeBotId: settings.groupmeBotId,
    venmoHandle: settings.venmoHandle,
    houseBankroll: settings.houseBankroll,
  });
}

export async function PATCH(request: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const updateData: Record<string, unknown> = {};

  if (body.defaultBParam !== undefined) updateData.defaultBParam = body.defaultBParam;
  if (body.rakePercent !== undefined) updateData.rakePercent = body.rakePercent;
  if (body.groupmeBotId !== undefined) updateData.groupmeBotId = body.groupmeBotId;
  if (body.groupmeToken !== undefined) updateData.groupmeToken = body.groupmeToken;
  if (body.venmoHandle !== undefined) updateData.venmoHandle = body.venmoHandle;
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
    groupmeBotId: settings.groupmeBotId,
    venmoHandle: settings.venmoHandle,
    houseBankroll: settings.houseBankroll,
  });
}
