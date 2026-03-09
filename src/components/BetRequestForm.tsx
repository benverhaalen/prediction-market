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
  maxBetAmount: number;
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
  maxBetAmount,
}: BetRequestFormProps) {
  const [name, setName] = useState("");
  const [venmoUsername, setVenmoUsername] = useState("");
  const [selectedOutcome, setSelectedOutcome] = useState<string>(outcomes[0]?.id ?? "");
  const [amount, setAmount] = useState<string>("");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // Load saved fields from localStorage
  useEffect(() => {
    const savedName = localStorage.getItem("bettor_name");
    if (savedName) setName(savedName);
    const savedVenmo = localStorage.getItem("bettor_venmo");
    if (savedVenmo) setVenmoUsername(savedVenmo);
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
    if (!name.trim() || !venmoUsername.trim() || !selectedOutcome || !numAmount || numAmount < 1) return;

    setStatus("loading");
    setErrorMsg("");

    try {
      localStorage.setItem("bettor_name", name.trim());
      localStorage.setItem("bettor_venmo", venmoUsername.trim());

      const res = await fetch("/api/bet-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userName: name.trim(),
          venmoUsername: venmoUsername.trim(),
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

      const pending = JSON.parse(localStorage.getItem("pending_bets") || "[]");
      pending.push({ marketId, outcomeId: selectedOutcome, amount: numAmount, time: Date.now() });
      localStorage.setItem("pending_bets", JSON.stringify(pending));
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  const selectedLabel = outcomes.find((o) => o.id === selectedOutcome)?.label ?? "";

  if (status === "success") {
    return (
      <div className="rounded-xl border border-green/30 bg-green-dim/20 p-5">
        <h3 className="font-display text-xl font-semibold text-green">
          Bet Request Submitted
        </h3>
        <p className="mt-3 text-sm text-foreground/80">
          Send {formatDollars(parseFloat(amount))} to{" "}
          <span className="font-semibold text-gold">{venmoHandle}</span> on Venmo
          with note:
        </p>
        <div className="mt-2 rounded-lg bg-surface-2 p-3 text-center font-mono text-sm">
          {marketShortCode} {selectedLabel} ${amount}
        </div>
        <p className="mt-3 text-xs text-muted">
          Your bet will go live once payment is confirmed by the admin.
        </p>
        <button
          onClick={() => {
            setStatus("idle");
            setAmount("");
          }}
          className="mt-4 min-h-[44px] w-full rounded-lg border border-border bg-surface-2 text-sm font-medium text-foreground cursor-pointer hover:bg-surface-3 transition-colors"
        >
          Place another bet
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-surface p-5">
      <h3 className="font-display text-xl font-semibold mb-4">Place a Bet</h3>

      {/* Name */}
      <div className="mb-4">
        <label className="text-xs text-muted block mb-1.5">Your Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Jake"
          required
          className="w-full rounded-lg bg-surface-2 border border-border px-3 py-3 text-base focus:border-gold focus:outline-none"
        />
      </div>

      {/* Venmo Username */}
      <div className="mb-4">
        <label className="text-xs text-muted block mb-1.5">Venmo Username</label>
        <input
          type="text"
          value={venmoUsername}
          onChange={(e) => setVenmoUsername(e.target.value)}
          placeholder="@your-venmo"
          required
          className="w-full rounded-lg bg-surface-2 border border-border px-3 py-3 text-base focus:border-gold focus:outline-none"
        />
        <p className="text-xs text-muted mt-1">So we can verify your payment</p>
      </div>

      {/* Outcome dropdown */}
      <div className="mb-4">
        <label className="text-xs text-muted block mb-1.5">Pick Your Bet</label>
        <div className="relative">
          <select
            value={selectedOutcome}
            onChange={(e) => setSelectedOutcome(e.target.value)}
            required
            className="w-full appearance-none rounded-lg bg-surface-2 border border-border px-3 py-3 pr-10 text-base text-foreground focus:border-gold focus:outline-none cursor-pointer"
          >
            {outcomes.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label} — {Math.round(o.probability * 100)}% chance
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
            <svg className="h-4 w-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Amount */}
      <div className="mb-4">
        <label className="text-xs text-muted block mb-1.5">
          Bet Amount ($1 – ${maxBetAmount})
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-base">$</span>
          <input
            type="number"
            min="1"
            max={maxBetAmount}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            required
            inputMode="decimal"
            className="w-full rounded-lg bg-surface-2 border border-border pl-7 pr-3 py-3 text-base focus:border-gold focus:outline-none"
          />
        </div>
      </div>

      {/* Payout Preview */}
      {preview && (
        <div className="mb-4 rounded-xl border border-green/20 bg-green-dim/10 p-4">
          <div className="text-center">
            <div className="text-xs text-muted mb-1">If {selectedLabel} wins, you get</div>
            <div className="font-display text-3xl font-bold text-green">
              {formatDollars(preview.potentialPayout * 0.95)}
            </div>
            <div className="text-xs text-muted mt-1">after 5% rake</div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
            <div>
              <div className="text-muted text-xs">Profit</div>
              <div className="font-semibold text-green">
                +{formatDollars(preview.potentialPayout * 0.95 - parseFloat(amount))}
              </div>
            </div>
            <div>
              <div className="text-muted text-xs">Multiplier</div>
              <div className="font-semibold text-gold">{preview.multiplier.toFixed(1)}x</div>
            </div>
            <div>
              <div className="text-muted text-xs">Shares</div>
              <div className="font-semibold">{preview.shares.toFixed(2)}</div>
            </div>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="mb-4 rounded-lg bg-red-dim/30 p-3 text-sm text-red">
          {errorMsg}
        </div>
      )}

      <button
        type="submit"
        disabled={status === "loading" || !name.trim() || !venmoUsername.trim() || !amount || parseFloat(amount) < 1}
        className="w-full min-h-[52px] rounded-lg bg-gold font-display text-xl font-semibold text-black transition-colors hover:bg-gold/90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
      >
        {status === "loading" ? "Submitting..." : "Place Bet Request"}
      </button>
    </form>
  );
}
