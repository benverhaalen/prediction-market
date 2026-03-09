import { prisma } from "./prisma";

/**
 * Post a message to the GroupMe group chat via the bot API.
 * Fails silently — GroupMe errors should never block app operations.
 */
export async function postToGroupMe(text: string): Promise<void> {
  try {
    const settings = await prisma.settings.findUnique({
      where: { id: "global" },
    });

    if (!settings?.groupmeBotId) {
      console.log("[GroupMe] No bot ID configured, skipping:", text);
      return;
    }

    await postWithBotId(settings.groupmeBotId, text);
  } catch (error) {
    console.error("[GroupMe] Error posting message:", error);
  }
}

/**
 * Post a message to the admin GroupMe group.
 * Used for bet request notifications that only the admin should see.
 */
export async function postToAdminGroupMe(text: string): Promise<void> {
  try {
    const settings = await prisma.settings.findUnique({
      where: { id: "global" },
    });

    if (!settings?.adminGroupmeBotId) {
      console.log(
        "[GroupMe Admin] No admin bot ID configured, skipping:",
        text,
      );
      return;
    }

    await postWithBotId(settings.adminGroupmeBotId, text);
  } catch (error) {
    console.error("[GroupMe Admin] Error posting message:", error);
  }
}

/**
 * Post a message using a specific bot ID.
 */
async function postWithBotId(botId: string, text: string): Promise<void> {
  const response = await fetch("https://api.groupme.com/v3/bots/post", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bot_id: botId,
      text,
    }),
  });

  if (!response.ok) {
    console.error(
      "[GroupMe] POST failed:",
      response.status,
      await response.text(),
    );
  }
}

/**
 * Check if odds shifted enough to warrant a GroupMe notification.
 * Returns true if any outcome moved >= 2pp from last notified prices.
 */
export function shouldNotifyOddsShift(
  currentPrices: number[],
  lastNotifiedPrices: Record<string, number> | null,
  outcomeIds: string[],
): boolean {
  if (!lastNotifiedPrices) return true; // first bet always notifies

  for (let i = 0; i < outcomeIds.length; i++) {
    const lastPrice = lastNotifiedPrices[outcomeIds[i]];
    if (lastPrice !== undefined) {
      const delta = Math.abs(currentPrices[i] - lastPrice);
      if (delta >= 0.02) return true;
    }
  }
  return false;
}

/**
 * Format a bet confirmation notification for the public group.
 * Anonymous — no names shown publicly.
 */
export function formatBetConfirmed(
  amount: number,
  outcomeLabel: string,
  marketQuestion: string,
  outcomes: { label: string }[],
  newPrices: number[],
  url: string,
): string {
  const oddsStr = outcomes
    .map((o, i) => `${o.label} ${Math.round(newPrices[i] * 100)}%`)
    .join(" | ");

  return [
    `💰 Someone just put $${amount.toFixed(2)} on "${outcomeLabel}"`,
    `"${marketQuestion}"`,
    "",
    `New odds: ${oddsStr}`,
    "",
    url,
  ].join("\n");
}

/**
 * Format a new market announcement.
 */
export function formatNewMarket(
  question: string,
  outcomes: { label: string }[],
  closesAt: Date,
  url: string,
): string {
  const n = outcomes.length;
  const initProb = Math.round(100 / n);
  const outcomeStr = outcomes
    .map((o) => `${o.label} (${initProb}%)`)
    .join(" | ");

  const closeDate = closesAt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return [
    `🟢 NEW MARKET: "${question}"`,
    "",
    `Outcomes: ${outcomeStr}`,
    `Closes: ${closeDate}`,
    "",
    `Place your bets 👉 ${url}`,
  ].join("\n");
}

/**
 * Format an odds shift notification.
 */
export function formatOddsShift(
  question: string,
  outcomes: { id: string; label: string }[],
  currentPrices: number[],
  previousPrices: Record<string, number>,
  url: string,
): string {
  const lines = outcomes.map((o, i) => {
    const prev = Math.round((previousPrices[o.id] ?? 0) * 100);
    const curr = Math.round(currentPrices[i] * 100);
    const delta = curr - prev;
    const sign = delta >= 0 ? "+" : "";
    return `${o.label}: ${prev}% -> ${curr}% (${sign}${delta})`;
  });

  return [`📊 ODDS SHIFT: "${question}"`, "", ...lines, "", url].join("\n");
}

/**
 * Format a market resolution notification.
 */
export function formatResolution(
  question: string,
  winnerLabel: string,
  winnerCount: number,
  totalPot: number,
  totalRake: number,
  url: string,
): string {
  return [
    `🏆 RESOLVED: "${question}"`,
    "",
    `Result: ${winnerLabel}`,
    "",
    `${winnerCount} winner${winnerCount !== 1 ? "s" : ""} | Total pot: $${totalPot.toFixed(2)} 💸`,
    "",
    `See results 👉 ${url}`,
  ].join("\n");
}

/**
 * Format a cancellation notification.
 */
export function formatCancellation(question: string): string {
  return `🚫 CANCELLED: "${question}" — All bets are refunded.`;
}

/**
 * Format admin notifications for a new bet request.
 * Returns two messages: an info message and a copy-paste ID message.
 */
export function formatBetRequestAdmin(
  betRequestId: string,
  userName: string,
  venmoUsername: string,
  amount: number,
  outcomeLabel: string,
  marketQuestion: string,
  url: string,
): [string, string] {
  const infoMsg = [
    `NEW BET REQUEST`,
    `${userName} (${venmoUsername}) wants $${amount.toFixed(2)} on "${outcomeLabel}"`,
    `Market: ${marketQuestion}`,
    "",
    `Reply "y <id>" to confirm or "n <id>" to reject`,
    "",
    url,
  ].join("\n");

  const idMsg = betRequestId;

  return [infoMsg, idMsg];
}
