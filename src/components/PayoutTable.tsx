"use client";

import { useState } from "react";
import { formatDollars } from "@/lib/utils";

interface PayoutEntry {
  userName: string;
  shares: number;
  grossPayout: number;
  rake: number;
  netPayout: number;
  isWinner: boolean;
}

interface PayoutTableProps {
  payouts: PayoutEntry[];
  totalPayouts: number;
  totalRake: number;
  housePnL: number;
  winnerLabel: string;
}

export function PayoutTable({
  payouts,
  totalPayouts,
  totalRake,
  housePnL,
  winnerLabel,
}: PayoutTableProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const winners = payouts.filter((p) => p.isWinner && p.netPayout > 0);
  const venmoInstructions = winners
    .map((w) => `Send ${formatDollars(w.netPayout)} to ${w.userName}`)
    .join("\n");

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold">
          Payouts — Result: <span className="text-green">{winnerLabel}</span>
        </h3>
        <button
          onClick={() => copyToClipboard(venmoInstructions, "all")}
          className="min-h-[44px] rounded-lg bg-gold px-3 text-sm font-semibold text-black cursor-pointer hover:bg-gold/90 transition-colors"
        >
          {copied === "all" ? "Copied!" : "Copy All Venmo"}
        </button>
      </div>

      {/* Winners table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted border-b border-border">
              <th className="pb-2 pr-4">Winner</th>
              <th className="pb-2 pr-4 text-right">Shares</th>
              <th className="pb-2 pr-4 text-right">Gross</th>
              <th className="pb-2 pr-4 text-right">Rake</th>
              <th className="pb-2 pr-4 text-right">Net Payout</th>
              <th className="pb-2"></th>
            </tr>
          </thead>
          <tbody>
            {winners.map((w, i) => (
              <tr key={i} className="border-b border-border/50">
                <td className="py-2 pr-4 font-medium">{w.userName}</td>
                <td className="py-2 pr-4 text-right text-muted">
                  {w.shares.toFixed(2)}
                </td>
                <td className="py-2 pr-4 text-right">
                  {formatDollars(w.grossPayout)}
                </td>
                <td className="py-2 pr-4 text-right text-red">
                  -{formatDollars(w.rake)}
                </td>
                <td className="py-2 pr-4 text-right font-semibold text-green">
                  {formatDollars(w.netPayout)}
                </td>
                <td className="py-2">
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `Send ${formatDollars(w.netPayout)} to ${w.userName}`,
                        `row-${i}`
                      )
                    }
                    className="text-xs text-blue cursor-pointer hover:underline"
                  >
                    {copied === `row-${i}` ? "Copied" : "Copy"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <div>
          Total Payouts:{" "}
          <span className="font-semibold">{formatDollars(totalPayouts)}</span>
        </div>
        <div>
          Total Rake:{" "}
          <span className="font-semibold text-gold">{formatDollars(totalRake)}</span>
        </div>
        <div>
          House P&L:{" "}
          <span
            className={`font-semibold ${housePnL >= 0 ? "text-green" : "text-red"}`}
          >
            {housePnL >= 0 ? "+" : ""}
            {formatDollars(housePnL)}
          </span>
        </div>
      </div>

      {/* Venmo instructions */}
      <div className="mt-4 rounded-lg bg-surface-2 p-3">
        <h4 className="text-xs font-semibold text-muted mb-2">Venmo Instructions</h4>
        {winners.map((w, i) => (
          <div key={i} className="text-sm py-1">
            → Send {formatDollars(w.netPayout)} to {w.userName}
          </div>
        ))}
      </div>
    </div>
  );
}
