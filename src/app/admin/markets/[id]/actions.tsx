"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface AdminMarketActionsProps {
  marketId: string;
  outcomes: { id: string; label: string }[];
}

export function AdminMarketActions({
  marketId,
  outcomes,
}: AdminMarketActionsProps) {
  const router = useRouter();
  const [resolveOpen, setResolveOpen] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState(outcomes[0]?.id ?? "");
  const [resolutionNote, setResolutionNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);

  const handleResolve = async () => {
    if (!selectedOutcome || !resolutionNote.trim()) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/admin/markets/${marketId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          winningOutcomeId: selectedOutcome,
          resolutionNote: resolutionNote.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(`Error: ${data.error}`);
        setLoading(false);
        return;
      }

      router.refresh();
    } catch {
      alert("Network error");
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    setLoading(true);

    try {
      const res = await fetch(`/api/admin/markets/${marketId}/cancel`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        alert(`Error: ${data.error}`);
        setLoading(false);
        return;
      }

      router.refresh();
    } catch {
      alert("Network error");
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Resolve */}
      {!resolveOpen ? (
        <div className="flex gap-2">
          <button
            onClick={() => setResolveOpen(true)}
            className="flex-1 min-h-[48px] rounded-lg bg-green font-display text-lg font-semibold text-black cursor-pointer hover:bg-green/90 transition-colors"
          >
            Resolve Market
          </button>
          <button
            onClick={() => setCancelConfirm(true)}
            className="min-h-[48px] rounded-lg bg-surface-2 border border-border px-4 text-sm text-muted cursor-pointer hover:text-red hover:border-red transition-colors"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-green/30 bg-green-dim/10 p-4">
          <h4 className="font-display text-sm font-semibold mb-2">
            Select Winning Outcome
          </h4>
          <div className="space-y-2 mb-3">
            {outcomes.map((o) => (
              <button
                key={o.id}
                onClick={() => setSelectedOutcome(o.id)}
                className={`w-full min-h-[44px] rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors cursor-pointer ${
                  selectedOutcome === o.id
                    ? "border-green bg-green-dim/30 text-green"
                    : "border-border bg-surface text-muted hover:border-muted"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <div className="mb-3">
            <label className="text-xs text-muted block mb-1.5">
              Resolution Note (required)
            </label>
            <textarea
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              placeholder='e.g. "Final score: Chiefs 24, Eagles 17 per ESPN.com"'
              required
              rows={2}
              className="w-full rounded-lg bg-surface border border-border px-3 py-2 text-sm focus:border-gold focus:outline-none resize-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleResolve}
              disabled={loading || !resolutionNote.trim()}
              className="flex-1 min-h-[48px] rounded-lg bg-green font-display font-semibold text-black cursor-pointer hover:bg-green/90 disabled:opacity-40 transition-colors"
            >
              {loading ? "Resolving..." : "Confirm Resolution"}
            </button>
            <button
              onClick={() => setResolveOpen(false)}
              className="min-h-[48px] rounded-lg bg-surface-2 border border-border px-4 text-sm text-muted cursor-pointer hover:text-foreground transition-colors"
            >
              Back
            </button>
          </div>
          <p className="text-xs text-muted mt-2">
            This cannot be undone. All payouts will be calculated immediately.
          </p>
        </div>
      )}

      {/* Cancel confirmation */}
      {cancelConfirm && (
        <div className="rounded-xl border border-red/30 bg-red-dim/10 p-4">
          <p className="text-sm mb-3">
            Cancel this market? All predictions will be refunded.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              disabled={loading}
              className="flex-1 min-h-[48px] rounded-lg bg-red font-display font-semibold text-white cursor-pointer hover:bg-red/90 disabled:opacity-40 transition-colors"
            >
              {loading ? "Cancelling..." : "Yes, Cancel Market"}
            </button>
            <button
              onClick={() => setCancelConfirm(false)}
              className="min-h-[48px] rounded-lg bg-surface-2 border border-border px-4 text-sm text-muted cursor-pointer hover:text-foreground transition-colors"
            >
              No
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
