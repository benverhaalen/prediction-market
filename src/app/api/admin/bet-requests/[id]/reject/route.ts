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

  const betRequest = await prisma.betRequest.findUnique({ where: { id } });
  if (!betRequest) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (betRequest.status !== "PENDING") {
    return NextResponse.json(
      { error: "Already processed" },
      { status: 409 }
    );
  }

  await prisma.betRequest.update({
    where: { id },
    data: { status: "REJECTED" },
  });

  return NextResponse.json({ success: true });
}
