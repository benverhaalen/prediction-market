"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminDeleteMarket({
  marketId,
  question,
}: {
  marketId: string;
  question: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/markets/${marketId}/delete`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        alert(`Error: ${data.error || "Failed to delete"}`);
        setLoading(false);
        setConfirming(false);
        return;
      }
      router.refresh();
    } catch {
      alert("Network error");
      setLoading(false);
      setConfirming(false);
    }
  };

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="text-xs text-muted hover:text-red cursor-pointer transition-colors"
      >
        Delete market (no bets)
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-red">Delete &ldquo;{question.slice(0, 30)}...&rdquo;?</span>
      <button
        onClick={handleDelete}
        disabled={loading}
        className="min-h-[36px] rounded-md bg-red px-3 text-xs font-semibold text-white cursor-pointer hover:bg-red/90 disabled:opacity-40 transition-colors"
      >
        {loading ? "..." : "Yes"}
      </button>
      <button
        onClick={() => setConfirming(false)}
        className="min-h-[36px] rounded-md bg-surface-3 border border-border px-3 text-xs text-muted cursor-pointer hover:text-foreground transition-colors"
      >
        No
      </button>
    </div>
  );
}
