"use client";

import { useState } from "react";
import { formatDollars } from "@/lib/utils";

interface PayoutEntry {
  userName: string;
  venmoUsername: string;
  shares: number;
  grossPayout: number;
  netPayout: number;
  isWinner: boolean;
}

interface PayoutTableProps {
  payouts: PayoutEntry[];
  totalPool: number;
  winnerLabel: string;
  isCancelled?: boolean;
}

export function PayoutTable({
  payouts,
  totalPool,
  winnerLabel,
  isCancelled = false,
}: PayoutTableProps) {
  // Cancelled: everyone gets a refund. Resolved: only winners get paid.
  const recipients = isCancelled
    ? payouts.filter((p) => p.netPayout > 0)
    : payouts.filter((p) => p.isWinner && p.netPayout > 0);
  const [paid, setPaid] = useState<Record<number, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);

  const togglePaid = (index: number) => {
    setPaid((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const allPaid = recipients.length > 0 && recipients.every((_, i) => paid[i]);

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-4">
        <h3 className="font-display text-lg font-semibold">
          {isCancelled ? (
            <>
              Refunds — <span className="text-red">Cancelled</span>
            </>
          ) : (
            <>
              Payouts — Result:{" "}
              <span className="text-green">{winnerLabel}</span>
            </>
          )}
        </h3>
      </div>

      {/* Venmo payout cards */}
      <div className="space-y-3 mb-4">
        {recipients.map((w, i) => (
          <div
            key={i}
            className={`rounded-lg border p-3 transition-colors ${
              paid[i]
                ? "border-green/30 bg-green-dim/10"
                : "border-border bg-surface-2"
            }`}
          >
            <div className="flex items-center gap-3">
              {/* Checkbox */}
              <button
                onClick={() => togglePaid(i)}
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border cursor-pointer transition-colors ${
                  paid[i]
                    ? "border-green bg-green text-black"
                    : "border-muted bg-surface-3"
                }`}
              >
                {paid[i] && (
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </button>

              {/* Payout info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className={`font-semibold ${paid[i] ? "line-through text-muted" : ""}`}
                  >
                    {w.userName}
                  </span>
                  <span className="font-display text-lg font-bold text-green shrink-0">
                    {formatDollars(w.netPayout)}
                  </span>
                </div>
                <div className="text-sm text-gold">
                  {w.venmoUsername || "No Venmo provided"}
                </div>
              </div>

              {/* Copy button */}
              <button
                onClick={() =>
                  copyToClipboard(w.venmoUsername || w.userName, `venmo-${i}`)
                }
                className="min-h-[36px] min-w-[36px] shrink-0 rounded-md bg-surface-3 border border-border flex items-center justify-center cursor-pointer hover:bg-surface transition-colors"
              >
                {copied === `venmo-${i}` ? (
                  <svg
                    className="h-4 w-4 text-green"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  <svg
                    className="h-4 w-4 text-muted"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                )}
              </button>
            </div>

            <div className="mt-1.5 flex gap-3 text-xs text-muted pl-9">
              <span>{w.shares.toFixed(1)} shares</span>
              <span>Gross {formatDollars(w.grossPayout)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Progress indicator */}
      {recipients.length > 0 && (
        <div
          className={`rounded-lg p-2 text-center text-sm font-medium ${
            allPaid ? "bg-green-dim/20 text-green" : "bg-surface-2 text-muted"
          }`}
        >
          {allPaid
            ? isCancelled
              ? "All refunds sent!"
              : "All payouts sent!"
            : `${Object.values(paid).filter(Boolean).length} / ${recipients.length} ${isCancelled ? "refunded" : "paid"}`}
        </div>
      )}

      {/* Summary */}
      <div className="mt-4 text-sm text-muted">
        Total Pool:{" "}
        <span className="font-semibold text-foreground">
          {formatDollars(totalPool)}
        </span>
      </div>
    </div>
  );
}
