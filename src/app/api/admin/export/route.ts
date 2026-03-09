import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth";
import { toNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) {
    return new Response("Unauthorized", { status: 401 });
  }

  const bets = await prisma.bet.findMany({
    include: {
      user: true,
      market: { select: { question: true } },
      outcome: { select: { label: true } },
      betRequest: { select: { venmoUsername: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const header = "date,market,user,venmo,outcome,amount_in,amount_out";
  const rows = bets.map((b) => {
    const date = b.createdAt.toISOString().split("T")[0];
    const market = csvEscape(b.market.question);
    const user = csvEscape(b.user.name);
    const venmo = csvEscape(b.betRequest?.venmoUsername ?? "");
    const outcome = csvEscape(b.outcome.label);
    const amountIn = toNumber(b.cost).toFixed(2);
    const amountOut = b.netPayout ? toNumber(b.netPayout).toFixed(2) : "0.00";
    return `${date},${market},${user},${venmo},${outcome},${amountIn},${amountOut}`;
  });

  const csv = [header, ...rows].join("\n");
  const today = new Date().toISOString().split("T")[0];

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="transactions-${today}.csv"`,
    },
  });
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
