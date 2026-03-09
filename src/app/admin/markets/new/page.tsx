"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewMarket() {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [description, setDescription] = useState("");
  const [resolutionCriteria, setResolutionCriteria] = useState("");
  const [marketType, setMarketType] = useState<"binary" | "multi">("binary");
  const [outcomes, setOutcomes] = useState<string[]>(["Yes", "No"]);
  const [closesAt, setClosesAt] = useState("");
  const [bParam, setBParam] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleTypeChange = (type: "binary" | "multi") => {
    setMarketType(type);
    if (type === "binary") {
      setOutcomes(["Yes", "No"]);
    } else {
      setOutcomes(["", "", ""]);
    }
  };

  const addOutcome = () => setOutcomes([...outcomes, ""]);
  const removeOutcome = (i: number) => {
    if (outcomes.length <= 2) return;
    setOutcomes(outcomes.filter((_, idx) => idx !== i));
  };
  const updateOutcome = (i: number, val: string) => {
    const next = [...outcomes];
    next[i] = val;
    setOutcomes(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const filteredOutcomes = outcomes.filter((o) => o.trim());
    if (filteredOutcomes.length < 2) {
      setError("Need at least 2 outcomes");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/admin/markets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          description: description || undefined,
          resolutionCriteria,
          outcomes: filteredOutcomes,
          closesAt,
          bParam,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create market");
      }

      router.push("/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  const n = outcomes.filter((o) => o.trim()).length || 2;
  const initialProb = Math.round(100 / n);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <Link
            href="/admin"
            className="text-muted hover:text-foreground text-sm"
          >
            ← Back
          </Link>
          <h1 className="font-display text-lg font-bold">New Market</h1>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Question */}
          <div>
            <label className="text-xs text-muted block mb-1">Question</label>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder='e.g. "Will Jake break up with his girlfriend before July?"'
              required
              className="w-full rounded-lg bg-surface border border-border px-3 py-3 text-sm focus:border-gold focus:outline-none"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-muted block mb-1">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Extra context about this market"
              rows={2}
              className="w-full rounded-lg bg-surface border border-border px-3 py-3 text-sm focus:border-gold focus:outline-none resize-none"
            />
          </div>

          {/* Resolution Criteria */}
          <div>
            <label className="text-xs text-muted block mb-1">
              Resolution Criteria
            </label>
            <textarea
              value={resolutionCriteria}
              onChange={(e) => setResolutionCriteria(e.target.value)}
              placeholder='e.g. "Resolved YES if Chiefs win per NFL.com final score. Resolved NO otherwise."'
              required
              rows={2}
              className="w-full rounded-lg bg-surface border border-border px-3 py-3 text-sm focus:border-gold focus:outline-none resize-none"
            />
            <p className="text-xs text-muted mt-1">
              How exactly will this be resolved? What source determines the
              result?
            </p>
          </div>

          {/* Market type */}
          <div>
            <label className="text-xs text-muted block mb-1">Type</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleTypeChange("binary")}
                className={`flex-1 min-h-[44px] rounded-lg border px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
                  marketType === "binary"
                    ? "border-gold bg-gold-dim/30 text-gold"
                    : "border-border bg-surface text-muted hover:border-muted"
                }`}
              >
                Binary (Yes/No)
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange("multi")}
                className={`flex-1 min-h-[44px] rounded-lg border px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
                  marketType === "multi"
                    ? "border-gold bg-gold-dim/30 text-gold"
                    : "border-border bg-surface text-muted hover:border-muted"
                }`}
              >
                Multi-Outcome
              </button>
            </div>
          </div>

          {/* Outcomes */}
          {marketType === "multi" && (
            <div>
              <label className="text-xs text-muted block mb-1">Outcomes</label>
              <div className="space-y-2">
                {outcomes.map((o, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="text"
                      value={o}
                      onChange={(e) => updateOutcome(i, e.target.value)}
                      placeholder={`Outcome ${i + 1}`}
                      className="flex-1 rounded-lg bg-surface border border-border px-3 py-2.5 text-sm focus:border-gold focus:outline-none"
                    />
                    {outcomes.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeOutcome(i)}
                        className="min-h-[44px] min-w-[44px] rounded-lg bg-surface-2 border border-border text-muted hover:text-red cursor-pointer transition-colors"
                      >
                        X
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addOutcome}
                  className="w-full min-h-[44px] rounded-lg border border-dashed border-border text-sm text-muted hover:border-muted cursor-pointer transition-colors"
                >
                  + Add Outcome
                </button>
              </div>
            </div>
          )}

          {/* Closing date */}
          <div>
            <label className="text-xs text-muted block mb-1">Closes At</label>
            <input
              type="datetime-local"
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
              required
              className="w-full rounded-lg bg-surface border border-border px-3 py-3 text-sm focus:border-gold focus:outline-none"
            />
          </div>

          {/* b parameter */}
          <div>
            <label className="text-xs text-muted block mb-1">
              Liquidity Parameter (b)
            </label>
            <input
              type="number"
              value={bParam}
              onChange={(e) => setBParam(Number(e.target.value))}
              min={1}
              className="w-full rounded-lg bg-surface border border-border px-3 py-3 text-sm focus:border-gold focus:outline-none"
            />
            <p className="text-xs text-muted mt-1">
              Controls how much odds move per prediction. Higher = more stable
              odds. Default is 20
            </p>
          </div>

          {/* Preview */}
          <div className="rounded-lg bg-surface-2 p-3 text-sm">
            <div className="text-xs text-muted mb-1">Preview</div>
            <div className="text-muted">
              All outcomes start at{" "}
              <span className="text-foreground font-medium">
                {initialProb}%
              </span>
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-dim/30 p-2 text-sm text-red">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[48px] rounded-lg bg-gold font-display text-lg font-semibold text-black hover:bg-gold/90 disabled:opacity-40 cursor-pointer"
          >
            {loading ? "Creating..." : "Create Market & Post to GroupMe"}
          </button>
        </form>
      </main>
    </div>
  );
}
