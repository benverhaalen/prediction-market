"use client";

import { useState } from "react";
import { formatDollars, relativeTime } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface BetRequestItem {
  id: string;
  userName: string;
  venmoUsername: string;
  marketQuestion: string;
  outcomeLabel: string;
  amount: number;
  createdAt: string;
}

export function AdminBetConfirm({ request }: { request: BetRequestItem }) {
  const [status, setStatus] = useState<"idle" | "confirming" | "rejecting" | "done">("idle");
  const router = useRouter();

  const handleAction = async (action: "confirm" | "reject") => {
    setStatus(action === "confirm" ? "confirming" : "rejecting");
    try {
      const res = await fetch(`/api/admin/bet-requests/${request.id}/${action}`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        alert(`Error: ${data.error || "Failed"}`);
        setStatus("idle");
        return;
      }
      setStatus("done");
      router.refresh();
    } catch {
      alert("Network error");
      setStatus("idle");
    }
  };

  if (status === "done") return null;

  return (
    <div className="rounded-xl border border-border bg-surface p-4 transition-all">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <span className="font-semibold">{request.userName}</span>
          <span className="text-muted"> wants </span>
          <span className="font-semibold text-gold">
            {formatDollars(request.amount)}
          </span>
          <span className="text-muted"> on </span>
          <span className="font-semibold text-blue">{request.outcomeLabel}</span>
        </div>
        <span className="text-xs text-muted shrink-0">
          {relativeTime(new Date(request.createdAt))}
        </span>
      </div>
      <div className="text-xs text-muted mb-1 line-clamp-1">
        {request.marketQuestion}
      </div>
      <div className="text-xs mb-3">
        <span className="text-muted">Venmo: </span>
        <span className="text-gold font-medium">{request.venmoUsername || "Not provided"}</span>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => handleAction("confirm")}
          disabled={status !== "idle"}
          className="flex-1 min-h-[52px] rounded-lg bg-green font-display text-lg font-semibold text-black transition-colors hover:bg-green/90 disabled:opacity-40 cursor-pointer"
        >
          {status === "confirming" ? "Confirming..." : "CONFIRM"}
        </button>
        <button
          onClick={() => handleAction("reject")}
          disabled={status !== "idle"}
          className="min-h-[52px] rounded-lg bg-surface-3 border border-border px-5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-red disabled:opacity-40 cursor-pointer"
        >
          {status === "rejecting" ? "..." : "Reject"}
        </button>
      </div>
    </div>
  );
}
