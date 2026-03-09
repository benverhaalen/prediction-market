"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Auto-refreshes the admin page every 30 seconds.
 * Plays a sound when new pending requests appear.
 */
export function AdminAutoRefresh({ pendingCount }: { pendingCount: number }) {
  const router = useRouter();
  const prevCount = useRef(pendingCount);

  useEffect(() => {
    // Play notification sound if count increased
    if (pendingCount > prevCount.current) {
      try {
        // Use the Web Audio API for a simple notification beep
        const ctx = new AudioContext();
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.frequency.value = 880;
        oscillator.type = "sine";
        gain.gain.value = 0.3;
        oscillator.start();
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        oscillator.stop(ctx.currentTime + 0.5);
      } catch {
        // Audio not available
      }
    }
    prevCount.current = pendingCount;
  }, [pendingCount]);

  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, 30_000);

    return () => clearInterval(interval);
  }, [router]);

  return null;
}
