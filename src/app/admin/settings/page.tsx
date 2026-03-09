"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatDollars } from "@/lib/utils";

interface SettingsData {
  defaultBParam: number;
  rakePercent: number;
  groupmeBotId: string | null;
  adminGroupmeBotId: string | null;
  adminGroupmeGroupId: string | null;
  venmoHandle: string;
  houseBankroll: number;
  maxBetAmount: number;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => {
        if (!r.ok) {
          window.location.href = "/admin/login";
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (data) {
          setSettings({
            ...data,
            houseBankroll: Number(data.houseBankroll),
            maxBetAmount: Number(data.maxBetAmount),
          });
        }
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setMessage("");

    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultBParam: settings.defaultBParam,
          rakePercent: settings.rakePercent,
          groupmeBotId: settings.groupmeBotId,
          adminGroupmeBotId: settings.adminGroupmeBotId,
          adminGroupmeGroupId: settings.adminGroupmeGroupId,
          venmoHandle: settings.venmoHandle,
          maxBetAmount: settings.maxBetAmount,
          ...(newPassword ? { newPassword } : {}),
        }),
      });

      if (!res.ok) throw new Error("Failed to save");

      setMessage("Settings saved");
      setNewPassword("");
      setTimeout(() => setMessage(""), 3000);
    } catch {
      setMessage("Error saving settings");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted">
        Loading...
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <Link href="/admin" className="text-muted hover:text-foreground text-sm">
            ← Back
          </Link>
          <h1 className="font-display text-lg font-bold">Settings</h1>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-4 space-y-4">
        {/* House bankroll */}
        <div className="rounded-xl border border-border bg-surface p-4 text-center">
          <div className="text-xs text-muted">House Bankroll</div>
          <div className="font-display text-3xl font-bold text-green">
            {formatDollars(settings.houseBankroll)}
          </div>
        </div>

        {/* Settings form */}
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted block mb-1.5">
              Max Bet Amount ($)
            </label>
            <input
              type="number"
              min="1"
              value={settings.maxBetAmount}
              onChange={(e) =>
                setSettings({ ...settings, maxBetAmount: Number(e.target.value) })
              }
              className="w-full rounded-lg bg-surface border border-border px-3 py-3 text-base focus:border-gold focus:outline-none"
            />
            <p className="text-xs text-muted mt-1">
              Maximum anyone can bet on a single wager
            </p>
          </div>

          <div>
            <label className="text-xs text-muted block mb-1.5">
              Default Liquidity Parameter (b)
            </label>
            <input
              type="number"
              value={settings.defaultBParam}
              onChange={(e) =>
                setSettings({ ...settings, defaultBParam: Number(e.target.value) })
              }
              className="w-full rounded-lg bg-surface border border-border px-3 py-3 text-base focus:border-gold focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs text-muted block mb-1.5">
              Rake Percentage
            </label>
            <input
              type="number"
              step="0.01"
              value={settings.rakePercent}
              onChange={(e) =>
                setSettings({ ...settings, rakePercent: Number(e.target.value) })
              }
              className="w-full rounded-lg bg-surface border border-border px-3 py-3 text-base focus:border-gold focus:outline-none"
            />
            <p className="text-xs text-muted mt-1">
              {(settings.rakePercent * 100).toFixed(0)}% of net winnings
            </p>
          </div>

          <div>
            <label className="text-xs text-muted block mb-1.5">Venmo Handle</label>
            <input
              type="text"
              value={settings.venmoHandle}
              onChange={(e) =>
                setSettings({ ...settings, venmoHandle: e.target.value })
              }
              placeholder="@your-venmo"
              className="w-full rounded-lg bg-surface border border-border px-3 py-3 text-base focus:border-gold focus:outline-none"
            />
          </div>

          <div className="rounded-xl border border-border bg-surface-2 p-4">
            <h3 className="font-display text-sm font-semibold mb-3">GroupMe Integration</h3>

            <div className="mb-3">
              <label className="text-xs text-muted block mb-1.5">
                Public Bot ID (notifications to friend group)
              </label>
              <input
                type="text"
                value={settings.groupmeBotId ?? ""}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    groupmeBotId: e.target.value || null,
                  })
                }
                placeholder="Paste bot ID from dev.groupme.com"
                className="w-full rounded-lg bg-surface border border-border px-3 py-3 text-base focus:border-gold focus:outline-none"
              />
            </div>

            <div className="mb-3">
              <label className="text-xs text-muted block mb-1.5">
                Admin Bot ID (private notifications to you)
              </label>
              <input
                type="text"
                value={settings.adminGroupmeBotId ?? ""}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    adminGroupmeBotId: e.target.value || null,
                  })
                }
                placeholder="Bot ID for your private admin group"
                className="w-full rounded-lg bg-surface border border-border px-3 py-3 text-base focus:border-gold focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs text-muted block mb-1.5">
                Admin Group ID (for verifying callback messages)
              </label>
              <input
                type="text"
                value={settings.adminGroupmeGroupId ?? ""}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    adminGroupmeGroupId: e.target.value || null,
                  })
                }
                placeholder="GroupMe group ID"
                className="w-full rounded-lg bg-surface border border-border px-3 py-3 text-base focus:border-gold focus:outline-none"
              />
              <p className="text-xs text-muted mt-1">
                Set callback URL to: https://prediction-market-five-nu.vercel.app/api/groupme/admin
              </p>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted block mb-1.5">
              New Admin Password (leave blank to keep current)
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password"
              className="w-full rounded-lg bg-surface border border-border px-3 py-3 text-base focus:border-gold focus:outline-none"
            />
          </div>
        </div>

        {message && (
          <div
            className={`rounded-lg p-3 text-sm ${
              message.includes("Error")
                ? "bg-red-dim/30 text-red"
                : "bg-green-dim/30 text-green"
            }`}
          >
            {message}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full min-h-[52px] rounded-lg bg-gold font-display text-xl font-semibold text-black hover:bg-gold/90 disabled:opacity-40 cursor-pointer"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </main>
    </div>
  );
}
