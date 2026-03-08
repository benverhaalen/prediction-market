/**
 * Format a probability as a percentage string.
 */
export function formatPercent(p: number): string {
  return `${Math.round(p * 100)}%`;
}

/**
 * Format a dollar amount.
 */
export function formatDollars(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/**
 * Format a multiplier (e.g., 1.6x).
 */
export function formatMultiplier(price: number): string {
  if (price <= 0) return "-";
  return `${(1 / price).toFixed(1)}x`;
}

/**
 * Generate a short market code from an ID.
 */
export function shortCode(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

/**
 * Get the base URL for the app.
 */
export function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

/**
 * Prisma Decimal to number helper.
 */
export function toNumber(val: unknown): number {
  if (typeof val === "number") return val;
  if (val && typeof val === "object" && "toNumber" in val) {
    return (val as { toNumber: () => number }).toNumber();
  }
  return Number(val);
}

/**
 * Relative time string (e.g., "2 hours ago", "in 3 days").
 */
export function relativeTime(date: Date): string {
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const absDiff = Math.abs(diff);
  const isPast = diff < 0;

  const minutes = Math.floor(absDiff / 60000);
  const hours = Math.floor(absDiff / 3600000);
  const days = Math.floor(absDiff / 86400000);

  let str: string;
  if (minutes < 1) str = "just now";
  else if (minutes < 60) str = `${minutes}m`;
  else if (hours < 24) str = `${hours}h`;
  else str = `${days}d`;

  if (str === "just now") return str;
  return isPast ? `${str} ago` : `in ${str}`;
}
