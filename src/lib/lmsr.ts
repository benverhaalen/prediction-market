/**
 * LMSR (Logarithmic Market Scoring Rule) — core pricing engine.
 *
 * All money calculations are done in JavaScript doubles and rounded
 * to cents at transaction boundaries. Share quantities are continuous.
 *
 * Uses log-sum-exp trick throughout for numerical stability.
 */

export interface MarketState {
  shares: number[]; // qᵢ for each outcome
  b: number; // liquidity parameter
}

export interface TradeResult {
  shares: number; // Δ — number of shares bought
  cost: number; // dollar cost
  newShares: number[]; // updated shares array
  newPrices: number[]; // prices after trade
}

export interface TradePreview {
  shares: number;
  cost: number;
  currentPrice: number;
  newPrice: number;
  estimatedPayout: number; // pool-based estimated payout
  multiplier: number; // estimatedPayout / cost
}

export interface PayoutResult {
  betId: string;
  userId: string;
  userName: string;
  outcomeLabel: string;
  shares: number;
  cost: number;
  grossPayout: number;
  netProfit: number;
  rake: number;
  netPayout: number;
  isWinner: boolean;
}

// --- Core math ---

/**
 * Log-sum-exp: ln(Σᵢ exp(xᵢ)) computed stably.
 */
function logSumExp(xs: number[]): number {
  const m = Math.max(...xs);
  if (!isFinite(m)) return -Infinity;
  let sum = 0;
  for (const x of xs) {
    sum += Math.exp(x - m);
  }
  return m + Math.log(sum);
}

/**
 * Cost function: C(q⃗) = b × ln(Σᵢ exp(qᵢ / b))
 */
export function costFunction(state: MarketState): number {
  const { shares, b } = state;
  const xs = shares.map((q) => q / b);
  return b * logSumExp(xs);
}

/**
 * Prices (implied probabilities) for all outcomes.
 * Uses softmax with log-sum-exp trick.
 * Always sums to 1.0.
 */
export function getPrices(state: MarketState): number[] {
  const { shares, b } = state;
  const xs = shares.map((q) => q / b);
  const m = Math.max(...xs);
  const exps = xs.map((x) => Math.exp(x - m));
  const sum = exps.reduce((a, c) => a + c, 0);
  return exps.map((e) => e / sum);
}

/**
 * Analytical cost-difference formula for buying Δ shares of outcome i.
 * cost = b × ln(1 + Pᵢ × (exp(Δ/b) - 1))
 *
 * This avoids catastrophic cancellation from C(new) - C(old).
 */
function analyticalCost(
  state: MarketState,
  outcomeIndex: number,
  delta: number,
): number {
  const prices = getPrices(state);
  const pi = prices[outcomeIndex];
  const expDelta = Math.exp(delta / state.b);
  return state.b * Math.log(1 + pi * (expDelta - 1));
}

/**
 * Given a dollar amount and outcome index, compute shares via binary search.
 * Solves: analyticalCost(state, i, Δ) = dollarAmount
 *
 * The cost function is monotonically increasing in Δ, so bisection always converges.
 */
export function computeTrade(
  state: MarketState,
  outcomeIndex: number,
  dollarAmount: number,
): TradeResult {
  if (dollarAmount <= 0) {
    throw new Error("Dollar amount must be positive");
  }
  if (outcomeIndex < 0 || outcomeIndex >= state.shares.length) {
    throw new Error("Invalid outcome index");
  }

  const prices = getPrices(state);
  const currentPrice = prices[outcomeIndex];

  // Binary search for Δ
  let lo = 0;
  let hi = (dollarAmount / Math.max(currentPrice, 0.001)) * 3; // generous upper bound
  const tolerance = 0.0001; // $0.0001 precision

  for (let iter = 0; iter < 200; iter++) {
    const mid = (lo + hi) / 2;
    const cost = analyticalCost(state, outcomeIndex, mid);
    if (Math.abs(cost - dollarAmount) < tolerance) {
      const newShares = [...state.shares];
      newShares[outcomeIndex] += mid;
      return {
        shares: mid,
        cost: dollarAmount,
        newShares,
        newPrices: getPrices({ shares: newShares, b: state.b }),
      };
    }
    if (cost < dollarAmount) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  // Use best estimate after max iterations
  const delta = (lo + hi) / 2;
  const newShares = [...state.shares];
  newShares[outcomeIndex] += delta;
  return {
    shares: delta,
    cost: dollarAmount,
    newShares,
    newPrices: getPrices({ shares: newShares, b: state.b }),
  };
}

/**
 * Preview a trade without executing.
 * Pool-based: estimated payout = (yourShares / totalWinningShares) × (pool + betAmount)
 */
export function previewTrade(
  state: MarketState,
  outcomeIndex: number,
  dollarAmount: number,
  pool: number,
  existingOutcomeShares: number,
): TradePreview {
  const result = computeTrade(state, outcomeIndex, dollarAmount);
  const currentPrice = getPrices(state)[outcomeIndex];
  const estimatedPool = pool + dollarAmount;
  const totalWinningShares = existingOutcomeShares + result.shares;
  const estimatedPayout =
    totalWinningShares > 0
      ? (result.shares / totalWinningShares) * estimatedPool
      : 0;

  return {
    shares: result.shares,
    cost: dollarAmount,
    currentPrice,
    newPrice: result.newPrices[outcomeIndex],
    estimatedPayout: roundCents(estimatedPayout),
    multiplier: estimatedPayout / dollarAmount,
  };
}

/**
 * Compute payouts for all bets in a resolved market.
 * Parimutuel: winners split the entire pool proportional to their shares.
 */
export function computePayouts(
  bets: Array<{
    id: string;
    userId: string;
    userName: string;
    outcomeId: string;
    outcomeLabel: string;
    shares: number;
    cost: number;
  }>,
  winningOutcomeId: string,
): PayoutResult[] {
  const pool = bets.reduce((sum, b) => sum + b.cost, 0);
  const totalWinningShares = bets
    .filter((b) => b.outcomeId === winningOutcomeId)
    .reduce((sum, b) => sum + b.shares, 0);

  const results = bets.map((bet) => {
    const isWinner = bet.outcomeId === winningOutcomeId;
    const payout =
      isWinner && totalWinningShares > 0
        ? (bet.shares / totalWinningShares) * pool
        : 0;

    return {
      betId: bet.id,
      userId: bet.userId,
      userName: bet.userName,
      outcomeLabel: bet.outcomeLabel,
      shares: bet.shares,
      cost: bet.cost,
      grossPayout: roundCents(payout),
      netProfit: roundCents(payout - bet.cost),
      rake: 0,
      netPayout: roundCents(payout),
      isWinner,
    };
  });

  // Fix rounding: ensure total payouts equal pool exactly
  const totalPaid = results
    .filter((r) => r.isWinner)
    .reduce((sum, r) => sum + r.netPayout, 0);
  const remainder = roundCents(pool - totalPaid);
  if (remainder !== 0) {
    const largest = results
      .filter((r) => r.isWinner)
      .sort((a, b) => b.netPayout - a.netPayout)[0];
    if (largest) {
      largest.grossPayout = roundCents(largest.grossPayout + remainder);
      largest.netPayout = roundCents(largest.netPayout + remainder);
      largest.netProfit = roundCents(largest.netPayout - largest.cost);
    }
  }

  return results;
}

/**
 * Round to nearest cent.
 */
export function roundCents(amount: number): number {
  return Math.round(amount * 100) / 100;
}
