import {
  costFunction,
  getPrices,
  computeTrade,
  previewTrade,
  computePayouts,
  roundCents,
  maxHouseLoss,
} from "../lmsr";

describe("LMSR Core Math", () => {
  describe("costFunction", () => {
    it("should compute correct initial cost for binary market", () => {
      const cost = costFunction({ shares: [0, 0], b: 100 });
      // C(0,0) = 100 * ln(e^0 + e^0) = 100 * ln(2) ≈ 69.3147
      expect(cost).toBeCloseTo(69.3147, 3);
    });

    it("should compute correct cost after trade", () => {
      // First compute the actual shares from a $20 trade
      const trade1 = computeTrade({ shares: [0, 0], b: 100 }, 0, 20);
      const cost = costFunction({ shares: [trade1.shares, 0], b: 100 });
      // Cost at initial state was 69.3147, after $20 trade it should be 69.3147 + 20 = 89.3147
      expect(cost).toBeCloseTo(89.3147, 3);
    });
  });

  describe("getPrices", () => {
    it("should return 50/50 for new binary market", () => {
      const prices = getPrices({ shares: [0, 0], b: 100 });
      expect(prices).toHaveLength(2);
      expect(prices[0]).toBeCloseTo(0.5, 4);
      expect(prices[1]).toBeCloseTo(0.5, 4);
    });

    it("should return 1/3 each for new 3-outcome market", () => {
      const prices = getPrices({ shares: [0, 0, 0], b: 100 });
      expect(prices).toHaveLength(3);
      prices.forEach((p) => expect(p).toBeCloseTo(1 / 3, 4));
    });

    it("prices should always sum to 1", () => {
      const prices = getPrices({ shares: [50, 30, 10, 80], b: 100 });
      const sum = prices.reduce((a, c) => a + c, 0);
      expect(sum).toBeCloseTo(1.0, 10);
    });

    it("should handle numerical stability with large values", () => {
      const prices = getPrices({ shares: [10000, 5000], b: 100 });
      const sum = prices.reduce((a, c) => a + c, 0);
      expect(sum).toBeCloseTo(1.0, 10);
      expect(prices[0]).toBeGreaterThan(prices[1]);
    });
  });

  describe("computeTrade — worked example from spec", () => {
    it("Trade 1: $20 on Yes in binary market", () => {
      const state = { shares: [0, 0], b: 100 };
      const result = computeTrade(state, 0, 20);

      // Should get ≈36.61 shares
      expect(result.shares).toBeCloseTo(36.61, 1);
      expect(result.cost).toBe(20);

      // New prices: Yes ≈ 59.1%, No ≈ 40.9%
      expect(result.newPrices[0]).toBeCloseTo(0.591, 2);
      expect(result.newPrices[1]).toBeCloseTo(0.409, 2);

      // Prices still sum to 1
      const sum = result.newPrices.reduce((a, c) => a + c, 0);
      expect(sum).toBeCloseTo(1.0, 10);
    });

    it("Trade 2: $30 on No after first trade", () => {
      // Run trade 1 first to get actual shares
      const trade1 = computeTrade({ shares: [0, 0], b: 100 }, 0, 20);
      const state = { shares: trade1.newShares, b: 100 };
      const result = computeTrade(state, 1, 30);

      // Shares should be positive and reasonable
      expect(result.shares).toBeGreaterThan(40);
      expect(result.shares).toBeLessThan(80);
      expect(result.cost).toBe(30);

      // After $20 Yes and $30 No, prices should rebalance toward No
      // The net effect: more money on No, so No should be > 50%
      expect(result.newPrices[1]).toBeGreaterThan(0.5);
      // Prices sum to 1
      const sum = result.newPrices.reduce((a, c) => a + c, 0);
      expect(sum).toBeCloseTo(1.0, 10);
    });
  });

  describe("computeTrade — edge cases", () => {
    it("should handle very small bets ($1)", () => {
      const state = { shares: [0, 0], b: 100 };
      const result = computeTrade(state, 0, 1);
      expect(result.shares).toBeGreaterThan(0);
      expect(result.cost).toBe(1);
    });

    it("should handle large bets ($100)", () => {
      const state = { shares: [0, 0], b: 100 };
      const result = computeTrade(state, 0, 100);
      expect(result.shares).toBeGreaterThan(0);
      expect(result.cost).toBe(100);
    });

    it("should produce more shares for cheaper outcomes", () => {
      const state = { shares: [100, 0], b: 100 }; // Yes is expensive
      const yesResult = computeTrade(state, 0, 10);
      const noResult = computeTrade(state, 1, 10);
      // No is cheaper, so $10 buys more No shares
      expect(noResult.shares).toBeGreaterThan(yesResult.shares);
    });

    it("should work for multi-outcome markets", () => {
      const state = { shares: [0, 0, 0], b: 100 };
      const result = computeTrade(state, 1, 15);
      expect(result.shares).toBeGreaterThan(0);
      expect(result.newPrices).toHaveLength(3);
      const sum = result.newPrices.reduce((a, c) => a + c, 0);
      expect(sum).toBeCloseTo(1.0, 10);
    });

    it("should throw for zero or negative amounts", () => {
      const state = { shares: [0, 0], b: 100 };
      expect(() => computeTrade(state, 0, 0)).toThrow();
      expect(() => computeTrade(state, 0, -5)).toThrow();
    });
  });

  describe("previewTrade", () => {
    it("should match computeTrade results", () => {
      const state = { shares: [0, 0], b: 100 };
      const preview = previewTrade(state, 0, 20);
      const trade = computeTrade(state, 0, 20);

      expect(preview.shares).toBeCloseTo(trade.shares, 4);
      expect(preview.potentialPayout).toBeCloseTo(trade.shares, 4);
      expect(preview.multiplier).toBeGreaterThan(1);
    });
  });

  describe("computePayouts — worked example", () => {
    it("should compute correct payouts with rake", () => {
      const bets = [
        {
          id: "bet1",
          userId: "user1",
          userName: "User1",
          outcomeId: "yes",
          outcomeLabel: "Yes",
          shares: 36.61,
          cost: 20,
        },
        {
          id: "bet2",
          userId: "user2",
          userName: "User2",
          outcomeId: "no",
          outcomeLabel: "No",
          shares: 52.34,
          cost: 30,
        },
      ];

      const payouts = computePayouts(bets, "yes", 0.05);

      // User1 wins
      const winner = payouts.find((p) => p.betId === "bet1")!;
      expect(winner.isWinner).toBe(true);
      expect(winner.grossPayout).toBeCloseTo(36.61, 1);
      expect(winner.netProfit).toBeCloseTo(16.61, 1);
      expect(winner.rake).toBeCloseTo(0.83, 1);
      expect(winner.netPayout).toBeCloseTo(35.78, 1);

      // User2 loses
      const loser = payouts.find((p) => p.betId === "bet2")!;
      expect(loser.isWinner).toBe(false);
      expect(loser.grossPayout).toBe(0);
      expect(loser.rake).toBe(0);
      expect(loser.netPayout).toBe(0);
    });

    it("should not apply rake when net profit is zero or negative", () => {
      const bets = [
        {
          id: "bet1",
          userId: "user1",
          userName: "User1",
          outcomeId: "yes",
          outcomeLabel: "Yes",
          shares: 10,
          cost: 10, // cost equals payout, zero profit
        },
      ];

      const payouts = computePayouts(bets, "yes", 0.05);
      expect(payouts[0].rake).toBe(0);
      expect(payouts[0].netPayout).toBe(10);
    });
  });

  describe("roundCents", () => {
    it("should round to nearest cent", () => {
      expect(roundCents(35.784)).toBe(35.78);
      expect(roundCents(35.786)).toBe(35.79);
      expect(roundCents(0.001)).toBe(0);
    });
  });

  describe("maxHouseLoss", () => {
    it("should compute binary market max loss", () => {
      expect(maxHouseLoss(100, 2)).toBeCloseTo(69.31, 1);
    });

    it("should compute multi-outcome max loss", () => {
      expect(maxHouseLoss(100, 5)).toBeCloseTo(160.94, 0);
    });
  });
});
