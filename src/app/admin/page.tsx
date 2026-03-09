import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getPrices } from "@/lib/lmsr";
import { toNumber, formatDollars } from "@/lib/utils";
import { AdminAutoRefresh } from "@/components/AdminAutoRefresh";
import { AdminDeleteMarket } from "@/components/AdminDeleteMarket";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  if (!(await isAdmin())) {
    redirect("/admin/login");
  }

  const [pendingRequests, activeMarkets, resolvedMarkets] = await Promise.all([
    prisma.betRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      include: {
        market: { select: { question: true } },
        outcome: { select: { label: true } },
      },
    }),
    prisma.market.findMany({
      where: { status: { in: ["OPEN", "CLOSED"] } },
      orderBy: { createdAt: "desc" },
      include: {
        outcomes: true,
        _count: { select: { bets: true } },
        bets: { select: { cost: true } },
      },
    }),
    prisma.market.findMany({
      where: { status: "RESOLVED" },
      orderBy: { resolvedAt: "desc" },
      take: 10,
      include: {
        outcomes: true,
        _count: { select: { bets: true } },
        bets: { select: { cost: true } },
      },
    }),
  ]);

  return (
    <div className="min-h-screen bg-background">
      <AdminAutoRefresh pendingCount={pendingRequests.length} />

      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold">ADMIN</h1>
            {pendingRequests.length > 0 && (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red text-xs font-bold text-white">
                {pendingRequests.length}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Link
              href="/admin/markets/new"
              className="min-h-[44px] flex items-center rounded-lg bg-gold px-3 text-sm font-semibold text-black cursor-pointer hover:bg-gold/90 transition-colors"
            >
              + Market
            </Link>
            <a
              href="/api/admin/export"
              download
              className="min-h-[44px] flex items-center rounded-lg bg-surface-2 border border-border px-3 text-sm text-muted cursor-pointer hover:text-foreground transition-colors"
            >
              CSV
            </a>
            <Link
              href="/admin/settings"
              className="min-h-[44px] flex items-center rounded-lg bg-surface-2 border border-border px-3 text-sm text-muted cursor-pointer hover:text-foreground transition-colors"
            >
              Settings
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-4 space-y-6">
        {/* Pending Bet Requests */}
        <section>
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted mb-3">
            Pending Requests ({pendingRequests.length})
          </h2>
          {pendingRequests.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface p-4 text-center text-sm text-muted">
              No pending requests
            </div>
          ) : (
            <div className="space-y-2">
              {pendingRequests.map((req) => (
                <div
                  key={req.id}
                  className="rounded-xl border border-gold/30 bg-surface p-3"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium text-sm">{req.userName}</span>
                    <span className="font-display text-lg font-bold text-gold">
                      {formatDollars(toNumber(req.amount))}
                    </span>
                  </div>
                  <div className="text-xs text-muted mt-0.5">
                    {req.venmoUsername} &middot; {req.outcome.label} &middot;{" "}
                    {req.market.question}
                  </div>
                  <div className="text-xs text-muted/50 mt-1">
                    Confirm via GroupMe
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Active Markets */}
        <section>
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted mb-3">
            Active Markets ({activeMarkets.length})
          </h2>
          <div className="space-y-2">
            {activeMarkets.map((m) => {
              const shares = m.outcomes.map((o) => o.shares);
              const prices = getPrices({ shares, b: m.bParam });
              const vol = m.bets.reduce((sum, b) => sum + toNumber(b.cost), 0);
              const hasBets = m._count.bets > 0;

              return (
                <div
                  key={m.id}
                  className="rounded-xl border border-border bg-surface p-3 transition-colors"
                >
                  <Link
                    href={`/admin/markets/${m.id}`}
                    className="block cursor-pointer hover:opacity-80"
                  >
                    <div className="font-medium text-sm mb-1 line-clamp-1">
                      {m.question}
                    </div>
                    <div className="flex gap-3 text-xs text-muted">
                      {m.outcomes.map((o, i) => (
                        <span key={o.id}>
                          {o.label}: {Math.round(prices[i] * 100)}%
                        </span>
                      ))}
                      <span className="ml-auto">
                        {formatDollars(vol)} | {m._count.bets} predictions
                      </span>
                    </div>
                  </Link>
                  {!hasBets && (
                    <div className="mt-2 pt-2 border-t border-border/50">
                      <AdminDeleteMarket
                        marketId={m.id}
                        question={m.question}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Resolved Markets */}
        {resolvedMarkets.length > 0 && (
          <section>
            <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted mb-3">
              Resolved ({resolvedMarkets.length})
            </h2>
            <div className="space-y-2">
              {resolvedMarkets.map((m) => {
                const vol = m.bets.reduce(
                  (sum, b) => sum + toNumber(b.cost),
                  0,
                );
                const winner = m.outcomes.find((o) => o.id === m.resolution);
                return (
                  <Link
                    key={m.id}
                    href={`/admin/markets/${m.id}`}
                    className="block rounded-xl border border-border bg-surface p-3 cursor-pointer hover:bg-surface-2 transition-colors"
                  >
                    <div className="font-medium text-sm mb-1 line-clamp-1">
                      {m.question}
                    </div>
                    <div className="flex gap-3 text-xs text-muted">
                      <span className="text-green">
                        Result: {winner?.label ?? "N/A"}
                      </span>
                      <span className="ml-auto">
                        {formatDollars(vol)} | {m._count.bets} predictions
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <div className="pb-4">
          <Link href="/" className="text-xs text-muted hover:text-foreground">
            ← Public site
          </Link>
        </div>
      </main>
    </div>
  );
}
