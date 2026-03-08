"use client";

import { useState, useEffect } from "react";
import { formatDollars } from "@/lib/utils";

interface Outcome {
  id: string;
  label: string;
  probability: number;
}

interface BetRequestFormProps {
  marketId: string;
  outcomes: Outcome[];
  venmoHandle: string;
  marketShortCode: string;
}

interface PreviewData {
  shares: number;
  potentialPayout: number;
  multiplier: number;
  currentPrice: number;
  newPrice: number;
}

export function BetRequestForm({
  marketId,
  outcomes,
  venmoHandle,
  marketShortCode,
}: BetRequestFormProps) {
  const [name, setName] = useState("");
  const [selectedOutcome, setSelectedOutcome] = useState<string>(outcomes[0]?.id ?? "");
  const [amount, setAmount] = useState<string>("");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // Load saved name from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("bettor_name");
    if (saved) setName(saved);
  }, []);

  // Fetch preview when amount or outcome changes
  useEffect(() => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount < 1 || !selectedOutcome) {
      setPreview(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/markets/${marketId}?preview=true&outcomeId=${selectedOutcome}&amount=${numAmount}`
        );
        if (res.ok) {
          const data = await res.json();
          setPreview(data.preview);
        }
      } catch {
        // silently fail preview
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [amount, selectedOutcome, marketId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!name.trim() || !selectedOutcome || !numAmount || numAmount < 1) return;

    setStatus("loading");
    setErrorMsg("");

    try {
      localStorage.setItem("bettor_name", name.trim());

      const res = await fetch("/api/bet-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userName: name.trim(),
          marketId,
          outcomeId: selectedOutcome,
          amount: numAmount,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit bet request");
      }

      setStatus("success");

      // Store pending bet in localStorage
      const pending = JSON.parse(localStorage.getItem("pending_bets") || "[]");
      pending.push({ marketId, outcomeId: selectedOutcome, amount: numAmount, time: Date.now() });
      localStorage.setItem("pending_bets", JSON.stringify(pending));
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  const selectedLabel = outcomes.find((o) => o.id === selectedOutcome)?.label ?? "";
  const quickAmounts = [5, 10, 20, 50];

  if (status === "success") {
    return (
      <div className="rounded-xl border border-green/30 bg-green-dim/20 p-4">
        <h3 className="font-display text-lg font-semibold text-green">
          Bet Request Submitted
        </h3>
        <p className="mt-2 text-sm text-foreground/80">
          Send {formatDollars(parseFloat(amount))} to{" "}
          <span className="font-semibold text-gold">{venmoHandle}</span> on Venmo
          with note:
        </p>
        <div className="mt-2 rounded-lg bg-surface-2 p-3 text-center font-mono text-sm">
          {marketShortCode} {selectedLabel} ${amount}
        </div>
        <p className="mt-2 text-xs text-muted">
          Your bet will go live once payment is confirmed by the admin.
        </p>
        <button
          onClick={() => {
            setStatus("idle");
            setAmount("");
          }}
          className="mt-3 text-sm text-blue underline cursor-pointer"
        >
          Place another bet
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-surface p-4">
      <h3 className="font-display text-lg font-semibold mb-3">Place a Bet</h3>

      {/* Name */}
      <div className="mb-3">
        <label className="text-xs text-muted block mb-1">Your Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Jake"
          required
          className="w-full rounded-lg bg-surface-2 border border-border px-3 py-2.5 text-sm focus:border-gold focus:outline-none"
        />
      </div>

      {/* Outcome selector */}
      <div className="mb-3">
        <label className="text-xs text-muted block mb-1">Pick a Side</label>
        <div className="flex gap-2">
          {outcomes.map((o, i) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setSelectedOutcome(o.id)}
              className={`flex-1 min-h-[44px] rounded-lg border px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
                selectedOutcome === o.id
                  ? i === 0
                    ? "border-green bg-green-dim/30 text-green"
                    : i === 1 && outcomes.length === 2
                      ? "border-red bg-red-dim/30 text-red"
                      : "border-blue bg-blue/20 text-blue"
                  : "border-border bg-surface-2 text-muted hover:border-muted"
              }`}
            >
              {o.label}
              <span className="block text-xs opacity-70">
                {Math.round(o.probability * 100)}%
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Amount */}
      <div className="mb-3">
        <label className="text-xs text-muted block mb-1">Amount ($)</label>
        <div className="flex gap-2 mb-2">
          {quickAmounts.map((qa) => (
            <button
              key={qa}
              type="button"
              onClick={() => setAmount(String(qa))}
              className={`min-h-[44px] flex-1 rounded-lg border px-2 py-2 text-sm font-medium transition-colors cursor-pointer ${
                amount === String(qa)
                  ? "border-gold bg-gold-dim/30 text-gold"
                  : "border-border bg-surface-2 text-muted hover:border-muted"
              }`}
            >
              ${qa}
            </button>
          ))}
        </div>
        <input
          type="number"
          min="1"
          step="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Custom amount"
          required
          className="w-full rounded-lg bg-surface-2 border border-border px-3 py-2.5 text-sm focus:border-gold focus:outline-none"
        />
      </div>

      {/* Preview */}
      {preview && (
        <div className="mb-3 rounded-lg bg-surface-3 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Shares</span>
            <span>{preview.shares.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Potential payout</span>
            <span className="text-green">
              {formatDollars(preview.potentialPayout * 0.95)} (after 5% rake)
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Multiplier</span>
            <span className="text-gold">{preview.multiplier.toFixed(1)}x</span>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="mb-3 rounded-lg bg-red-dim/30 p-2 text-sm text-red">
          {errorMsg}
        </div>
      )}

      <button
        type="submit"
        disabled={status === "loading" || !name.trim() || !amount || parseFloat(amount) < 1}
        className="w-full min-h-[48px] rounded-lg bg-gold font-display text-lg font-semibold text-black transition-colors hover:bg-gold/90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
      >
        {status === "loading" ? "Submitting..." : "Place Bet Request"}
      </button>
    </form>
  );
}
